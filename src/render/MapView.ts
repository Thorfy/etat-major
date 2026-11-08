// Relie la carte aux entrées du joueur : déplacement, zoom, survol, clic.
import type { LoadedWorld } from '../map/loadWorld.ts';
import { Camera } from './Camera.ts';
import { Labels } from './Labels.ts';
import { MapRenderer } from './MapRenderer.ts';

const CLICK_TOLERANCE_PX = 5;
const KEY_PAN_PX_PER_SECOND = 700;
const MAX_DPR = 2;

export interface MapEvents {
  onHover(province: number): void;
  onSelect(province: number): void;
  onToggleDebug(): void;
}

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

  private dpr = 1;
  private dirty = true;
  private lastFrame = 0;
  private frameMs = 0;
  private dragDistance = 0;
  private pinchDistance = 0;
  private zoomTarget: { zoom: number; x: number; y: number } | null = null;
  private lastPointer: { x: number; y: number } | null = null;
  private hoverProvince = 0;
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

  select(province: number): void {
    this.selectedProvince = province;
    this.selectedOwner = province ? this.world.data.provinces[province - 1].nation + 1 : 0;
    this.dirty = true;
    this.events.onSelect(province);
  }

  private provinceAt(sx: number, sy: number): number {
    const cell = this.camera.screenToCell(sx, sy);
    return cell ? this.world.provinceGrid[cell.y * this.world.data.width + cell.x] : 0;
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

  private setHover(province: number): void {
    if (province === this.hoverProvince) return;
    this.hoverProvince = province;
    this.dirty = true;
    this.events.onHover(province);
  }

  private bindInputs(): void {
    const { canvas } = this;
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.dragDistance = 0;
      this.pinchDistance = 0;
      this.zoomTarget = null;
      canvas.classList.add('dragging');
    });

    canvas.addEventListener('pointermove', (event) => {
      this.lastPointer = { x: event.clientX, y: event.clientY };
      const previous = this.pointers.get(event.pointerId);
      if (!previous) {
        this.setHover(this.provinceAt(event.clientX, event.clientY));
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
      if (!this.pointers.delete(event.pointerId)) return;
      this.pinchDistance = 0;
      if (this.pointers.size === 0) canvas.classList.remove('dragging');
      if (event.type === 'pointerup' && this.dragDistance < CLICK_TOLERANCE_PX) {
        this.select(this.provinceAt(event.clientX, event.clientY));
      }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', () => {
      this.lastPointer = null;
      if (this.pointers.size === 0) this.setHover(0);
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
      const key = event.key.toLowerCase();
      if (key === 'f3') {
        event.preventDefault();
        this.events.onToggleDebug();
      } else if (key === 'escape') {
        this.select(0);
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
        this.setHover(this.provinceAt(this.lastPointer.x, this.lastPointer.y));
      }
      this.renderer.draw(this.camera, this.dpr, {
        hoverProvince: this.hoverProvince,
        selectedProvince: this.selectedProvince,
        selectedOwner: this.selectedOwner,
      });
      this.labels.draw(this.camera);
      this.dirty = false;
    }
    requestAnimationFrame((next) => this.tick(next));
  }
}
