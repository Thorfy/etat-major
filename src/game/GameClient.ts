// Côté jeu : lance le Worker, transmet les ordres et applique ses résultats à la carte.
import { findLandNeighbors } from '../map/adjacency.ts';
import type { LoadedWorld } from '../map/loadWorld.ts';
import type { MapView } from '../render/MapView.ts';
import { DEFAULT_ALLOCATION, DEFAULT_OFFENSIVE_SHARE, MAX_OFFENSIVES_PER_NATION, OFFENSIVE_MIN_FORCE, TICKS_PER_SECOND } from '../sim/balance.ts';
import type { FrontSnapshot, OffensiveSnapshot, SimCommand, SimSnapshot, Stance, ToWorker, WorkerInit, WorkerUpdate } from '../sim/protocol.ts';
import { rebalance } from './allocation.ts';

export interface FrontOrder {
  allocation: number;
  stance: Stance;
}

export const GAME_SPEEDS = [1, 2, 4] as const;
const MESSAGE_MS = 3500;

export class GameClient {
  readonly player: number;
  readonly startCells: number;
  snapshot: SimSnapshot | null = null;
  tickMs = 0;
  maxTickMs = 0;
  flipsPerSecond = 0;
  error: string | null = null;
  /** 0 = pause. */
  speed = 1;
  offensiveShare = DEFAULT_OFFENSIVE_SHARE;
  message: string | null = null;

  private readonly worker: Worker;
  private readonly world: LoadedWorld;
  private readonly view: MapView;
  private readonly onChange: () => void;
  private readonly controllers: Uint16Array;
  /** Ordres du joueur, à jour dès le geste sans attendre le retour du Worker. */
  private readonly orders = new Map<number, FrontOrder>();
  private frontCount = 0;
  private flipsWindow = 0;
  private windowStart = performance.now();
  private speedBeforePause = 1;
  private messageTimer = 0;

  constructor(world: LoadedWorld, view: MapView, player: number, enemy: number, seed: number, onChange: () => void) {
    this.world = world;
    this.view = view;
    this.player = player;
    this.onChange = onChange;
    this.controllers = new Uint16Array(world.data.provinces.length + 1);
    world.data.provinces.forEach((province, index) => {
      this.controllers[index + 1] = province.nation + 1;
    });
    this.startCells = world.data.nations[player - 1].cells;

    this.worker = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerUpdate>) => this.receive(event.data);
    this.worker.onerror = (event) => {
      this.error = event.message || 'La simulation s\'est arrêtée.';
      this.onChange();
    };

    const provinceGrid = world.provinceGrid.slice();
    const ownerGrid = world.ownerGrid.slice();
    const terrainGrid = world.terrainGrid.slice();
    const init: WorkerInit = {
      type: 'init',
      width: world.data.width,
      height: world.data.height,
      nations: world.data.nations.map(({ population, gdpMusd }) => ({ population, gdpMusd })),
      provinces: world.data.provinces.map(({ nation, areaKm2, x, y }) => ({ nation, areaKm2, x, y })),
      provinceGrid,
      ownerGrid,
      terrainGrid,
      seed,
      player,
    };
    this.post(init, [provinceGrid.buffer, ownerGrid.buffer, terrainGrid.buffer]);
    this.command({ type: 'declareWars', pairs: [[player, enemy]] });
    this.orders.set(enemy, { allocation: DEFAULT_ALLOCATION, stance: 'hold' });
  }

  private post(message: ToWorker, transfer: Transferable[] = []): void {
    this.worker.postMessage(message, transfer);
  }

  private command(command: SimCommand): void {
    this.post({ type: 'command', command });
  }

  private receive(update: WorkerUpdate): void {
    this.view.applyOwnerChanges(update.cells, update.owners);
    for (let i = 0; i < update.provinces.length; i += 2) {
      this.controllers[update.provinces[i]] = update.provinces[i + 1];
    }
    this.tickMs = update.tickMs;
    this.maxTickMs = Math.max(this.maxTickMs, update.tickMs);
    this.flipsWindow += update.cells.length;
    const now = performance.now();
    if (now - this.windowStart >= 1000) {
      this.flipsPerSecond = (this.flipsWindow * 1000) / (now - this.windowStart);
      this.flipsWindow = 0;
      this.windowStart = now;
    }
    if (update.snapshot) {
      this.snapshot = update.snapshot;
      if (update.snapshot.fronts.length !== this.frontCount) {
        this.frontCount = update.snapshot.fronts.length;
        this.view.setWars(update.snapshot.fronts.map((front) => [front.a, front.b]));
      }
      this.view.setCampaign(update.snapshot.offensives, update.snapshot.pockets);
      this.onChange();
    }
  }

  get elapsedSeconds(): number {
    return (this.snapshot?.tick ?? 0) / TICKS_PER_SECOND;
  }

  controllerOf(province: number): number {
    return this.controllers[province];
  }

  playerFronts(): FrontSnapshot[] {
    return (this.snapshot?.fronts ?? []).filter((front) => front.a === this.player || front.b === this.player);
  }

  playerOffensives(): OffensiveSnapshot[] {
    return (this.snapshot?.offensives ?? []).filter((offensive) => offensive.nation === this.player);
  }

  orderFor(enemy: number): FrontOrder {
    return this.orders.get(enemy) ?? { allocation: 0, stance: 'hold' };
  }

  isAtWarWith(nation: number): boolean {
    return this.orders.has(nation);
  }

  /** Si le total dépasse 100 %, les autres fronts cèdent la différence. */
  setFront(enemy: number, allocation: number, stance: Stance): void {
    const current = new Map([...this.orders].map(([other, order]) => [other, order.allocation]));
    const next = rebalance(current, enemy, allocation);
    // Les baisses d'abord : la simulation refuse de dépasser 100 % à tout instant.
    for (const [other, value] of next) {
      const order = this.orders.get(other);
      if (other === enemy || !order || order.allocation === value) continue;
      this.orders.set(other, { allocation: value, stance: order.stance });
      this.command({ type: 'setFront', nation: this.player, enemy: other, allocation: value, stance: order.stance });
    }
    const value = next.get(enemy)!;
    this.orders.set(enemy, { allocation: value, stance });
    this.command({ type: 'setFront', nation: this.player, enemy, allocation: value, stance });
    this.onChange();
  }

  /** Le nouveau front prend ce qui reste disponible, dans la limite de l'allocation par défaut. */
  openFront(enemy: number): void {
    if (this.orders.has(enemy)) return;
    let used = 0;
    for (const order of this.orders.values()) used += order.allocation;
    const allocation = Math.min(DEFAULT_ALLOCATION, Math.max(0, 1 - used));
    this.orders.set(enemy, { allocation, stance: 'hold' });
    this.command({ type: 'declareWars', pairs: [[this.player, enemy]] });
    this.command({ type: 'setFront', nation: this.player, enemy, allocation, stance: 'hold' });
    this.onChange();
  }

  setOffensiveShare(share: number): void {
    this.offensiveShare = share;
    this.onChange();
  }

  /** Vérifie l'ordre pour expliquer un refus : la simulation l'ignorerait sans rien dire. */
  launchOffensive(fromX: number, fromY: number, toX: number, toY: number): void {
    const { ownerGrid, data } = this.world;
    const stats = this.snapshot?.nations.find((nation) => nation.id === this.player);
    const target = ownerGrid[toY * data.width + toX];
    if (ownerGrid[fromY * data.width + fromX] !== this.player) {
      this.notify('Une offensive doit partir de ton territoire.');
    } else if (target === 0) {
      this.notify('La cible doit être sur la terre ferme.');
    } else if (target !== this.player && !this.isAtWarWith(target)) {
      this.notify('Tu n\'es pas en guerre contre ce pays.');
    } else if (this.playerOffensives().length >= MAX_OFFENSIVES_PER_NATION) {
      this.notify(`${MAX_OFFENSIVES_PER_NATION} offensives au plus en même temps.`);
    } else if (!stats || stats.reserve * this.offensiveShare < OFFENSIVE_MIN_FORCE) {
      this.notify('Réserve insuffisante : baisse les forces engagées sur les fronts.');
    } else {
      this.command({ type: 'launchOffensive', nation: this.player, fromX, fromY, toX, toY, share: this.offensiveShare });
    }
  }

  cancelOffensive(id: number): void {
    this.command({ type: 'cancelOffensive', nation: this.player, id });
  }

  setSpeed(speed: number): void {
    if (speed !== 0) this.speedBeforePause = speed;
    this.speed = speed;
    this.post({ type: 'speed', speed });
    this.onChange();
  }

  togglePause(): void {
    this.setSpeed(this.speed === 0 ? this.speedBeforePause : 0);
  }

  private notify(text: string): void {
    this.message = text;
    clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => {
      this.message = null;
      this.onChange();
    }, MESSAGE_MS);
    this.onChange();
  }

  /** Mesure du pire cas : toutes les nations voisines en guerre. */
  debugWorldWar(): number {
    const { ownerGrid, data } = this.world;
    const pairs = findLandNeighbors(ownerGrid, data.width, data.height);
    this.command({ type: 'declareWars', pairs });
    for (const [a, b] of pairs) {
      if (a === this.player && !this.orders.has(b)) this.orders.set(b, { allocation: 0, stance: 'hold' });
      if (b === this.player && !this.orders.has(a)) this.orders.set(a, { allocation: 0, stance: 'hold' });
    }
    return pairs.length;
  }
}
