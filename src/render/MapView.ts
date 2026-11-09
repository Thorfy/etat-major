// Relie la carte aux entrées du joueur : déplacement, zoom, survol, clic.
import type { LoadedWorld } from '../map/loadWorld.ts';
import { wrapDeltaX } from '../map/projection.ts';
import { MAX_OFFENSIVE_LENGTH } from '../sim/balance.ts';
import type { NationLabel, OffensiveSnapshot, PocketSnapshot } from '../sim/protocol.ts';
import { traceRoute } from '../sim/route.ts';
import { Camera } from './Camera.ts';
import { Labels } from './Labels.ts';
import { MapRenderer } from './MapRenderer.ts';
import { type ArrowDraft, drawCampaign } from './Overlay.ts';

const CLICK_TOLERANCE_PX = 5;
const KEY_PAN_PX_PER_SECOND = 700;
const MAX_DPR = 2;

/** Carte politique (pays) ou économique (richesse des provinces). */
export type MapMode = 'political' | 'economic';

export interface CellInfo {
  province: number;
  owner: number;
  terrain: number;
}

export interface MapEvents {
  onHover(cell: CellInfo): void;
  onSelect(cell: CellInfo): void;
  onToggleDebug(): void;
  onOffensive(fromX: number, fromY: number, toX: number, toY: number): void;
  onAimingChange(aiming: boolean): void;
}

const NO_CELL: CellInfo = { province: 0, owner: 0, terrain: 0 };
const MIN_ARROW_CELLS = 3;

export interface FrameStats {
  frameMs: number;
  gpuMs: number | null;
  zoom: number;
}

export class MapView {
  readonly camera: Camera;
  private readonly renderer: MapRenderer;
  private readonly labels: Labels;
  private readonly canvas: HTMLCanvasElement;
  private readonly world: LoadedWorld;
  private readonly events: MapEvents;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private readonly keys = new Set<string>();
  private mode: MapMode = 'political';

  private dpr = 1;
  private dirty = true;
  private lastFrame = 0;
  private frameMs = 0;
  private dragDistance = 0;
  private pinchDistance = 0;
  private zoomTarget: { zoom: number; x: number; y: number } | null = null;
  private lastPointer: { x: number; y: number } | null = null;
  private hoverProvince = 0;
  private hoverOwner = 0;
  private hoverTerrain = 0;
  private player = 0;
  private atWar: (nation: number) => boolean = () => false;
  private offensives: readonly OffensiveSnapshot[] = [];
  private pockets: readonly PocketSnapshot[] = [];
  private draft: ArrowDraft | null = null;
  private draftPointer = -1;
  private aimingMode = false;
  private commandEnabled = false;
  private selectedProvince = 0;
  private selectedOwner = 0;
  /** Force un rendu à chaque image, pour mesurer les performances. */
  continuous = false;

  constructor(mapCanvas: HTMLCanvasElement, labelCanvas: HTMLCanvasElement, world: LoadedWorld, events: MapEvents) {
    this.canvas = mapCanvas;
    this.world = world;
    this.events = events;
    this.camera = new Camera(world.data.width, world.data.height);
    this.renderer = new MapRenderer(mapCanvas, world);
    this.labels = new Labels(labelCanvas, world.data.nations);
    this.bindInputs();
    this.resize();
    this.camera.fit();
    requestAnimationFrame((time) => this.tick(time));
  }

  get stats(): FrameStats {
    return { frameMs: this.frameMs, gpuMs: this.renderer.gpuMs, zoom: this.camera.zoom };
  }

  select(cell: CellInfo = NO_CELL): void {
    this.selectedProvince = cell.province;
    this.selectedOwner = cell.owner;
    this.dirty = true;
    this.events.onSelect(cell);
  }

  /** Active le tracé des offensives pour la nation du joueur. */
  setPlayer(player: number, atWar: (nation: number) => boolean): void {
    this.player = player;
    this.atWar = atWar;
    this.commandEnabled = true;
    this.dirty = true;
  }

  /** Faux après une défaite : le joueur observe, sans tracer d'offensive. */
  setCommandEnabled(enabled: boolean): void {
    this.commandEnabled = enabled;
    if (!enabled) this.cancelDraft();
  }

  get mapMode(): MapMode {
    return this.mode;
  }

  setMapMode(mode: MapMode): void {
    this.mode = mode;
    this.renderer.setMapMode(mode === 'economic' ? 1 : 0);
    this.dirty = true;
  }

  /** Richesse de chaque province, pour la carte économique. */
  setEconomy(wealth: Uint8Array): void {
    this.renderer.updateEconomy(wealth);
    if (this.mode === 'economic') this.dirty = true;
  }

  applyHomeChanges(pairs: Uint16Array): void {
    this.renderer.updateHomes(pairs);
    this.dirty = true;
  }

  loadState(owners: Uint16Array, homes: Uint16Array): void {
    this.renderer.loadState(owners, homes);
    this.dirty = true;
  }

  setNationLabels(labels: readonly NationLabel[]): void {
    this.labels.update(labels);
    this.dirty = true;
  }

  /** Trajet d'une flèche : portée réelle, et débarquement ou non. */
  private planArrow(fromX: number, fromY: number, endX: number, endY: number): { toX: number; toY: number; amphibious: boolean } {
    const { width, height } = this.world.data;
    const route = traceRoute(this.world.ownerGrid, width, height, fromX, fromY, endX, endY);
    if (route.amphibious) return { toX: endX, toY: endY, amphibious: true };
    const dx = wrapDeltaX(fromX, endX);
    const dy = endY - fromY;
    const length = Math.hypot(dx, dy);
    const scale = length > MAX_OFFENSIVE_LENGTH ? MAX_OFFENSIVE_LENGTH / length : 1;
    return {
      toX: ((fromX + Math.round(dx * scale)) % width + width) % width,
      toY: fromY + Math.round(dy * scale),
      amphibious: false,
    };
  }

  setCampaign(offensives: readonly OffensiveSnapshot[], pockets: readonly PocketSnapshot[]): void {
    this.offensives = offensives;
    this.pockets = pockets;
    this.dirty = true;
  }

  get aiming(): boolean {
    return this.aimingMode;
  }

  setAiming(aiming: boolean): void {
    if (aiming === this.aimingMode) return;
    this.aimingMode = aiming;
    this.canvas.classList.toggle('aiming', aiming);
    this.events.onAimingChange(aiming);
  }

  private cancelDraft(): void {
    this.draft = null;
    this.draftPointer = -1;
    this.dirty = true;
  }

  private isOwnCell(x: number, y: number): boolean {
    return this.world.ownerGrid[y * this.world.data.width + x] === this.player;
  }

  applyOwnerChanges(cells: Uint32Array, owners: Uint16Array): void {
    if (cells.length === 0) return;
    this.renderer.updateOwners(cells, owners);
    this.dirty = true;
  }

  setWars(pairs: [number, number][]): void {
    this.renderer.setWars(pairs);
    this.dirty = true;
  }

  /** Cadre un point de la carte avec la largeur voulue, en cellules. */
  focus(x: number, y: number, spanCells: number): void {
    const { viewWidth, viewHeight } = this.camera;
    this.zoomTarget = null;
    this.camera.centerOn(x, y, Math.min(viewWidth, viewHeight) / spanCells);
    this.dirty = true;
  }

  private cellAt(sx: number, sy: number): CellInfo {
    const cell = this.camera.screenToCell(sx, sy);
    if (!cell) return NO_CELL;
    const index = cell.y * this.world.data.width + cell.x;
    return {
      province: this.world.provinceGrid[index],
      owner: this.world.ownerGrid[index],
      terrain: this.world.terrainGrid[index],
    };
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.camera.resize(width, height);
    this.renderer.resize(width, height, this.dpr);
    this.labels.resize(width, height, this.dpr);
    this.dirty = true;
  }

  private setHover(cell: CellInfo): void {
    const unchanged = cell.province === this.hoverProvince && cell.owner === this.hoverOwner && cell.terrain === this.hoverTerrain;
    if (unchanged) return;
    if (cell.province !== this.hoverProvince) this.dirty = true;
    this.hoverProvince = cell.province;
    this.hoverOwner = cell.owner;
    this.hoverTerrain = cell.terrain;
    this.events.onHover(cell);
  }

  private hoverAt(sx: number, sy: number): void {
    this.setHover(this.cellAt(sx, sy));
  }

  private bindInputs(): void {
    const { canvas } = this;
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      const wantsArrow = this.commandEnabled && (event.button === 2 || (this.aimingMode && event.button === 0));
      if (wantsArrow) {
        const start = this.camera.screenToCell(event.clientX, event.clientY);
        if (start) {
          this.draft = { fromX: start.x, fromY: start.y, toX: start.x, toY: start.y, valid: this.isOwnCell(start.x, start.y), amphibious: false };
          this.draftPointer = event.pointerId;
          this.zoomTarget = null;
          this.dirty = true;
        }
        return;
      }
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.dragDistance = 0;
      this.pinchDistance = 0;
      this.zoomTarget = null;
      canvas.classList.add('dragging');
    });

    canvas.addEventListener('pointermove', (event) => {
      this.lastPointer = { x: event.clientX, y: event.clientY };
      if (this.draft && event.pointerId === this.draftPointer) {
        const end = this.camera.screenToCell(event.clientX, event.clientY);
        if (end) {
          // Le tracé montre la portée réelle : au-delà, la flèche s'arrête.
          this.draft = { ...this.draft, ...this.planArrow(this.draft.fromX, this.draft.fromY, end.x, end.y) };
          this.dirty = true;
        }
        return;
      }
      const previous = this.pointers.get(event.pointerId);
      if (!previous) {
        this.hoverAt(event.clientX, event.clientY);
        return;
      }
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.dragDistance += Math.hypot(dx, dy);

      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDistance > 0) {
          this.camera.zoomAt(this.camera.zoom * (distance / this.pinchDistance), (a.x + b.x) / 2, (a.y + b.y) / 2);
        }
        this.pinchDistance = distance;
        this.dragDistance = Infinity;
      } else {
        this.camera.panPixels(dx, dy);
      }
      this.dirty = true;
    });

    const release = (event: PointerEvent) => {
      if (this.draft && event.pointerId === this.draftPointer) {
        const { fromX, fromY, toX, toY } = this.draft;
        this.cancelDraft();
        const length = Math.hypot(wrapDeltaX(fromX, toX), toY - fromY);
        if (event.type === 'pointerup' && length >= MIN_ARROW_CELLS) {
          this.events.onOffensive(fromX, fromY, toX, toY);
          this.setAiming(false);
        }
        return;
      }
      if (!this.pointers.delete(event.pointerId)) return;
      this.pinchDistance = 0;
      if (this.pointers.size === 0) canvas.classList.remove('dragging');
      if (event.type === 'pointerup' && this.dragDistance < CLICK_TOLERANCE_PX) {
        this.select(this.cellAt(event.clientX, event.clientY));
      }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', () => {
      this.lastPointer = null;
      if (this.pointers.size === 0) this.setHover(NO_CELL);
    });

    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const unit = event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? 400 : 1;
        const from = this.zoomTarget?.zoom ?? this.camera.zoom;
        this.zoomTarget = {
          zoom: from * Math.exp(-event.deltaY * unit * 0.0018),
          x: event.clientX,
          y: event.clientY,
        };
      },
      { passive: false },
    );

    window.addEventListener('keydown', (event) => {
      // Les flèches d'un curseur ou d'une liste ne doivent pas déplacer la carte.
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const key = event.key.toLowerCase();
      if (key === 'f3') {
        event.preventDefault();
        this.events.onToggleDebug();
      } else if (key === 'escape') {
        if (this.draft) this.cancelDraft();
        else if (this.aimingMode) this.setAiming(false);
        else this.select();
      } else if (key === '+' || key === '=' || key === '-') {
        const from = this.zoomTarget?.zoom ?? this.camera.zoom;
        this.zoomTarget = {
          zoom: from * (key === '-' ? 1 / 1.4 : 1.4),
          x: this.camera.viewWidth / 2,
          y: this.camera.viewHeight / 2,
        };
      } else {
        this.keys.add(key);
      }
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private applyKeys(dt: number): void {
    const has = (...names: string[]) => names.some((name) => this.keys.has(name));
    const dx = (has('arrowleft', 'a', 'q') ? 1 : 0) - (has('arrowright', 'd') ? 1 : 0);
    const dy = (has('arrowup', 'w', 'z') ? 1 : 0) - (has('arrowdown', 's') ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      this.camera.panPixels(dx * KEY_PAN_PX_PER_SECOND * dt, dy * KEY_PAN_PX_PER_SECOND * dt);
      this.dirty = true;
    }
  }

  private applyZoom(dt: number): void {
    if (!this.zoomTarget) return;
    const { zoom, x, y } = this.zoomTarget;
    const blend = 1 - Math.exp(-dt * 16);
    const current = this.camera.zoom;
    const next = Math.exp(Math.log(current) + (Math.log(zoom) - Math.log(current)) * blend);
    this.camera.zoomAt(next, x, y);
    this.dirty = true;
    const settled = Math.abs(Math.log(this.camera.zoom / zoom)) < 0.002;
    const atLimit = this.camera.zoom === current;
    if (settled || atLimit) this.zoomTarget = null;
  }

  private tick(time: number): void {
    const dt = Math.min(0.1, (time - this.lastFrame) / 1000);
    this.frameMs = time - this.lastFrame;
    this.lastFrame = time;

    this.applyKeys(dt);
    this.applyZoom(dt);

    if (this.dirty || this.continuous) {
      if (this.lastPointer && this.pointers.size === 0) {
        this.hoverAt(this.lastPointer.x, this.lastPointer.y);
      }
      this.renderer.draw(this.camera, this.dpr, {
        hoverProvince: this.hoverProvince,
        selectedProvince: this.selectedProvince,
        selectedOwner: this.selectedOwner,
      });
      this.labels.draw(this.camera);
      if (this.player !== 0) {
        drawCampaign(this.labels.context, this.camera, this.player, this.atWar, this.offensives, this.pockets, this.draft);
      }
      this.dirty = false;
    }
    requestAnimationFrame((next) => this.tick(next));
  }
}
