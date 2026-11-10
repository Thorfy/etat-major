// Côté jeu : lance le Worker, transmet les ordres et applique ses résultats à la carte.
import { areLandNeighbors, findLandNeighbors } from '../map/adjacency.ts';
import type { LoadedWorld } from '../map/loadWorld.ts';
import type { MapView } from '../render/MapView.ts';
import {
  BUILD_COST,
  DEFAULT_OFFENSIVE_SHARE,
  GAME_SPEEDS,
  DEPOT_MIN_CONSOLIDATION,
  MAX_BUILD_QUEUE,
  MAX_PRIORITY_ZONES,
  MAX_FACTORY_LEVEL,
  MAX_INFRASTRUCTURE_LEVEL,
  MAX_OFFENSIVES_PER_NATION,
  OFFENSIVE_MIN_FORCE,
} from '../sim/balance.ts';
import type {
  BuildKind,
  EconomySnapshot,
  FromWorker,
  FrontSnapshot,
  NationLabel,
  NationSnapshot,
  OffensiveSnapshot,
  SimCommand,
  SimEvent,
  SimSave,
  SimSnapshot,
  Stance,
  ToWorker,
  WorkerInit,
  WorkerUpdate,
} from '../sim/protocol.ts';
import { traceRoute } from '../sim/route.ts';
import { rebalance } from './allocation.ts';
import { provinceWealth } from './economy.ts';
import { SAVE_VERSION, type SaveFile, type SaveMeta, encodeSave, hashGrid } from './saveFormat.ts';
import { type SaveSlot, writeSave } from './saves.ts';

export interface FrontOrder {
  allocation: number;
  stance: Stance;
}

export { GAME_SPEEDS, SPEED_LABELS } from '../sim/balance.ts';
const MESSAGE_MS = 3500;
const AUTOSAVE_MS = 120_000;
const JOURNAL_SIZE = 40;
/** En dessous, une offensive est signalée comme à bout de ravitaillement. */
export const LOW_SUPPLY = 0.4;

export interface BuildOption {
  kind: BuildKind;
  label: string;
  /** Points de construction. */
  cost: number;
  /** Vide si le chantier est possible, sinon la raison du refus. */
  reason: string;
}

export interface GameStart {
  player: number;
  seed: number;
  saved?: SaveFile;
}

/** Empreinte de la carte de départ : une sauvegarde ne vaut que pour cette carte. */
export const mapHashOf = (world: LoadedWorld) => hashGrid(world.provinceGrid);

export class GameClient {
  readonly player: number;
  readonly startCells: number;
  snapshot: SimSnapshot | null = null;
  tickMs = 0;
  maxTickMs = 0;
  flipsPerSecond = 0;
  error: string | null = null;
  /** 0 = pause, sinon un multiple de la cadence de base (voir GAME_SPEEDS). */
  speed: number = GAME_SPEEDS[0];
  offensiveShare = DEFAULT_OFFENSIVE_SHARE;
  message: string | null = null;
  journal: SimEvent[] = [];
  /** Vainqueur du joueur, s'il a capitulé. */
  defeatedBy = 0;
  defeatSeen = false;
  saving = false;
  /** Économie du monde, rafraîchie toutes les quelques secondes. */
  economy: EconomySnapshot | null = null;
  /** Effort de guerre demandé, à jour dès le geste. */
  private effortOrder: number | null = null;
  private counterOrder: number | null = null;

  private readonly worker: Worker;
  private readonly world: LoadedWorld;
  private readonly view: MapView;
  private readonly onChange: () => void;
  private readonly controllers: Uint16Array;
  /** Ordres du joueur, à jour dès le geste sans attendre le retour du Worker. */
  private readonly orders = new Map<number, FrontOrder>();
  /** Guerres demandées que la simulation n'a pas encore confirmées. */
  private readonly pendingWars = new Set<number>();
  /** Ennemis avec qui le joueur a déjà une frontière terrestre. */
  private readonly inContact = new Set<number>();
  private readonly labels = new Map<number, NationLabel>();
  private readonly saveRequests = new Map<number, (save: SimSave) => void>();
  private readonly warnedOffensives = new Set<number>();
  private readonly announcedCounters = new Set<number>();
  private nextSaveRequest = 1;
  private frontCount = 0;
  private flipsWindow = 0;
  private windowStart = performance.now();
  private speedBeforePause: number = GAME_SPEEDS[0];
  private messageTimer = 0;
  private readonly mapHash: number;

  constructor(world: LoadedWorld, view: MapView, start: GameStart, onChange: () => void) {
    this.world = world;
    this.view = view;
    this.player = start.player;
    this.onChange = onChange;
    this.mapHash = mapHashOf(world);
    this.controllers = new Uint16Array(world.data.provinces.length + 1);
    world.data.provinces.forEach((province, index) => {
      this.controllers[index + 1] = province.nation + 1;
    });
    this.startCells = world.data.nations[start.player - 1].cells;

    this.worker = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<FromWorker>) => {
      if (event.data.type === 'saved') {
        this.saveRequests.get(event.data.requestId)?.(event.data.save);
        this.saveRequests.delete(event.data.requestId);
      } else {
        this.receive(event.data);
      }
    };
    this.worker.onerror = (event) => {
      this.error = event.message || 'La simulation s\'est arrêtée.';
      this.onChange();
    };

    // Le Worker reçoit toujours la carte de départ, puis applique la sauvegarde.
    const provinceGrid = world.provinceGrid.slice();
    const ownerGrid = world.ownerGrid.slice();
    const terrainGrid = world.terrainGrid.slice();
    const init: WorkerInit = {
      type: 'init',
      width: world.data.width,
      height: world.data.height,
      nations: world.data.nations.map(({ population, gdpMusd }) => ({ population, gdpMusd })),
      provinces: world.data.provinces.map(({ nation, areaKm2, x, y, population, gdpMusd, oil, steel }) => ({
        nation,
        areaKm2,
        x,
        y,
        population,
        gdpMusd,
        oil,
        steel,
      })),
      provinceGrid,
      ownerGrid,
      terrainGrid,
      seed: start.seed,
      player: start.player,
      saved: start.saved?.sim,
    };
    this.post(init, [provinceGrid.buffer, ownerGrid.buffer, terrainGrid.buffer]);

    if (start.saved) this.applySave(start.saved);
    window.setInterval(() => {
      if (this.speed !== 0) void this.save('auto');
    }, AUTOSAVE_MS);
  }

  private applySave({ meta, sim }: SaveFile): void {
    this.offensiveShare = meta.offensiveShare;
    this.journal = meta.journal;
    this.controllers.set(sim.state.controller);
    this.view.loadState(sim.owners, Uint16Array.from(sim.state.provinceHome));
    for (const label of meta.labels) this.labels.set(label.id, label);
    this.view.setNationLabels(meta.labels);
    if (!sim.state.alive[this.player]) {
      const defeat = [...meta.journal].reverse().find((event) => event.type === 'capitulation' && event.loser === this.player);
      this.defeatedBy = defeat && defeat.type === 'capitulation' ? defeat.winner : this.player;
      this.defeatSeen = true;
      this.view.setCommandEnabled(false);
    }
    // Une partie reprise attend le joueur.
    this.setSpeed(0);
  }

  private post(message: ToWorker, transfer: Transferable[] = []): void {
    this.worker.postMessage(message, transfer);
  }

  private command(command: SimCommand): void {
    this.post({ type: 'command', command });
  }

  private receive(update: WorkerUpdate): void {
    this.view.applyOwnerChanges(update.cells, update.owners);
    this.view.applySupplyChanges(update.supplyCells, update.supplyValues);
    this.view.applyFortChanges(update.fortCells, update.fortValues);
    for (let i = 0; i < update.provinces.length; i += 2) {
      this.controllers[update.provinces[i]] = update.provinces[i + 1];
    }
    if (update.homes.length > 0) this.view.applyHomeChanges(update.homes);
    if (update.labels.length > 0) {
      for (const label of update.labels) this.labels.set(label.id, label);
      this.view.setNationLabels(update.labels);
    }
    for (const event of update.events) this.handleEvent(event);
    if (update.economy) {
      this.economy = update.economy;
      const areas = this.world.data.provinces.map((province) => province.areaKm2);
      this.view.setEconomy(provinceWealth(areas, update.economy.provinceGdp, update.economy.development));
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
      this.syncOrders(update.snapshot);
      if (update.snapshot.fronts.length !== this.frontCount || update.events.length > 0) {
        this.frontCount = update.snapshot.fronts.length;
        this.view.setWars(update.snapshot.fronts.map((front) => [front.a, front.b]));
      }
      this.view.setCampaign(update.snapshot.offensives, update.snapshot.pockets);
      this.watchSupply(update.snapshot);
      this.watchCounters(update.snapshot);
      this.view.setPriorityZones(this.playerStats?.priorityZones ?? []);
      this.onChange();
    }
  }

  private handleEvent(event: SimEvent): void {
    this.journal.push(event);
    if (this.journal.length > JOURNAL_SIZE) this.journal.shift();
    const name = (id: number) => this.world.data.nations[id - 1].name;
    if (event.type === 'war') {
      const involved = event.a === this.player || event.b === this.player;
      const enemy = event.a === this.player ? event.b : event.a;
      if (involved && !this.pendingWars.has(enemy)) this.notify(`${name(enemy)} te déclare la guerre !${this.effortReminder()}`);
      else if (involved) this.notify(`Guerre déclarée : ${name(enemy)}.${this.effortReminder()}`);
    } else if (event.loser === this.player) {
      this.defeatedBy = event.winner;
      this.view.setCommandEnabled(false);
      this.view.setTool(null);
    } else if (event.winner === this.player) {
      this.notify(`${name(event.loser)} capitule : tu annexes tout son territoire.`);
    } else if (this.isAtWarWith(event.loser)) {
      this.notify(`${name(event.loser)} capitule devant ${name(event.winner)}.`);
    }
  }

  /** Annonce les contre-attaques lancées d'elles-mêmes par la réserve du joueur. */
  private watchCounters(snapshot: SimSnapshot): void {
    for (const offensive of snapshot.offensives) {
      if (offensive.nation !== this.player || !offensive.counter || this.announcedCounters.has(offensive.id)) continue;
      this.announcedCounters.add(offensive.id);
      this.notify('Ta réserve contre-attaque : une tenaille frappe la percée ennemie à sa base.');
    }
  }

  /** Prévient une fois quand une offensive du joueur arrive à bout de ravitaillement. */
  private watchSupply(snapshot: SimSnapshot): void {
    for (const offensive of snapshot.offensives) {
      if (offensive.nation !== this.player || offensive.inTransit) continue;
      if (offensive.supply < LOW_SUPPLY && !this.warnedOffensives.has(offensive.id)) {
        this.warnedOffensives.add(offensive.id);
        this.notify('Une offensive s\'essouffle : elle est trop loin de ses bases. Laisse le front se consolider.');
      }
    }
  }

  /** Une économie restée en temps de paix arme moins vite que celle de l'adversaire. */
  private effortReminder(): string {
    return this.effortTarget <= 0.5 ? ' Relève ton effort de guerre pour armer davantage.' : '';
  }

  /** Les ordres suivent la simulation : guerres reçues, ennemis disparus, choix de l'IA. */
  private syncOrders(snapshot: SimSnapshot): void {
    const current = new Set<number>();
    for (const front of snapshot.fronts) {
      if (front.a !== this.player && front.b !== this.player) continue;
      const mine = front.a === this.player ? 0 : 1;
      const enemy = mine === 0 ? front.b : front.a;
      current.add(enemy);
      // Guerre nouvelle : la simulation a choisi l'allocation de départ selon la frontière.
      if (this.pendingWars.delete(enemy) || !this.orders.has(enemy)) {
        const side = front.sides[mine];
        this.orders.set(enemy, { allocation: side.allocation, stance: side.stance });
      }
      // Un front né d'un débarquement démarre sans troupes : il faut le dire au joueur.
      const contact = front.length > 0;
      if (contact && !this.inContact.has(enemy) && this.orderFor(enemy).allocation === 0) {
        this.notify(`Front ouvert avec ${this.world.data.nations[enemy - 1].name} : affecte-lui des forces !`);
      }
      if (contact) this.inContact.add(enemy);
      else this.inContact.delete(enemy);
    }
    for (const enemy of [...this.orders.keys()]) {
      if (!current.has(enemy) && !this.pendingWars.has(enemy)) this.orders.delete(enemy);
    }
  }

  get tick(): number {
    return this.snapshot?.tick ?? 0;
  }

  get worldData() {
    return this.world.data;
  }

  get playerStats(): NationSnapshot | undefined {
    return this.snapshot?.nations.find((nation) => nation.id === this.player);
  }

  get canCommand(): boolean {
    return this.defeatedBy === 0;
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

  /** On peut attaquer un voisin par la terre, ou n'importe qui si l'on a une marine. */
  canDeclareWar(nation: number): boolean {
    if (!this.canCommand || nation === 0 || nation === this.player || this.isAtWarWith(nation)) return false;
    if ((this.playerStats?.navy ?? 0) > 0) return true;
    const { ownerGrid, data } = this.world;
    return areLandNeighbors(ownerGrid, data.width, data.height, this.player, nation);
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

  declareWar(enemy: number): void {
    if (!this.canDeclareWar(enemy)) return;
    this.orders.set(enemy, { allocation: 0, stance: 'hold' });
    this.pendingWars.add(enemy);
    this.command({ type: 'declareWars', pairs: [[this.player, enemy]] });
    this.onChange();
  }

  /**
   * Économie d'une nation. Celle du joueur et de ses ennemis vient de l'état le plus
   * récent ; celle des autres, du relevé mondial, plus espacé.
   */
  nationEconomy(nation: number): { output: number; capacity: number; effort: number } {
    const live = this.snapshot?.nations.find((entry) => entry.id === nation);
    if (live) return { output: live.output, capacity: live.capacity, effort: live.effort };
    return {
      output: this.economy?.output[nation] ?? 0,
      capacity: this.economy?.capacity[nation] ?? 0,
      effort: this.economy?.effort[nation] ?? 0,
    };
  }

  /** Effort de guerre visé : celui qu'affiche le curseur. */
  get effortTarget(): number {
    return this.effortOrder ?? this.playerStats?.effortTarget ?? 0.5;
  }

  setEffort(effort: number): void {
    if (!this.canCommand) return;
    this.effortOrder = effort;
    this.command({ type: 'setEffort', nation: this.player, effort });
    this.onChange();
  }

  /**
   * Ce que le joueur peut bâtir dans une province, et pourquoi pas sinon. Reprend les règles
   * de la simulation, qui ignorerait l'ordre sans rien dire.
   */
  buildOptions(province: number): BuildOption[] {
    const economy = this.economy;
    if (!economy || !this.canCommand || province <= 0) return [];
    if (this.controllers[province] !== this.player) return [];
    const national = this.homeOf(province) === this.player;
    const queue = this.playerStats?.builds ?? [];
    const queued = (kind: BuildKind) => queue.filter((order) => order.province === province && order.kind === kind).length;
    const full = queue.length >= MAX_BUILD_QUEUE ? `File pleine (${MAX_BUILD_QUEUE} chantiers).` : '';
    const options: BuildOption[] = [];
    if (national) {
      const level = economy.factories[province] + queued('factory');
      options.push({
        kind: 'factory',
        label: `Usine, niveau ${level + 1}`,
        cost: BUILD_COST.factory * (level + 1),
        reason: full || (level >= MAX_FACTORY_LEVEL ? `Niveau maximal (${MAX_FACTORY_LEVEL}).` : ''),
      });
    }
    const roads = economy.infrastructure[province] + queued('infrastructure');
    options.push({
      kind: 'infrastructure',
      label: `Infrastructure, niveau ${roads + 1}`,
      cost: BUILD_COST.infrastructure * (roads + 1),
      reason: full || (roads >= MAX_INFRASTRUCTURE_LEVEL ? `Niveau maximal (${MAX_INFRASTRUCTURE_LEVEL}).` : ''),
    });
    if (!national) {
      const consolidated = economy.consolidation[province] >= DEPOT_MIN_CONSOLIDATION;
      options.push({
        kind: 'depot',
        label: 'Dépôt',
        cost: BUILD_COST.depot,
        reason:
          full ||
          (economy.depots[province] || queued('depot') ? 'Un dépôt est déjà là ou en chantier.' : '') ||
          (!consolidated ? `Province consolidée à ${Math.round(DEPOT_MIN_CONSOLIDATION * 100)} % au moins.` : ''),
      });
    }
    return options;
  }

  /** Pays d'origine actuel d'une province (il change après une annexion). */
  homeOf(province: number): number {
    return this.view.homeOf(province);
  }

  build(province: number, kind: BuildKind): void {
    if (!this.canCommand) return;
    this.command({ type: 'build', nation: this.player, province, kind });
  }

  fortifyLine(fromX: number, fromY: number, toX: number, toY: number): void {
    if (!this.canCommand) return;
    const { ownerGrid, data } = this.world;
    if (ownerGrid[fromY * data.width + fromX] !== this.player) {
      this.notify('Une ligne fortifiée part de ton territoire.');
      return;
    }
    if ((this.playerStats?.builds.length ?? 0) >= MAX_BUILD_QUEUE) {
      this.notify(`File de chantiers pleine (${MAX_BUILD_QUEUE}).`);
      return;
    }
    this.command({ type: 'fortifyLine', nation: this.player, fromX, fromY, toX, toY });
    this.notify('Ligne fortifiée mise en chantier.');
  }

  fortifyFront(enemy: number): void {
    if (!this.canCommand) return;
    if ((this.playerStats?.builds.length ?? 0) >= MAX_BUILD_QUEUE) {
      this.notify(`File de chantiers pleine (${MAX_BUILD_QUEUE}).`);
      return;
    }
    this.command({ type: 'fortifyFront', nation: this.player, enemy });
    this.notify(`Front avec ${this.world.data.nations[enemy - 1].name} mis en chantier de fortification.`);
  }

  setCounterShare(share: number): void {
    if (!this.canCommand) return;
    this.counterOrder = share;
    this.command({ type: 'setCounterShare', nation: this.player, share });
    this.onChange();
  }

  /** Réserve de contre-attaque voulue : celle qu'affiche le curseur. */
  get counterShare(): number {
    return this.counterOrder ?? this.playerStats?.counterShare ?? 0;
  }

  addPriority(x: number, y: number): void {
    if (!this.canCommand) return;
    const { ownerGrid, data } = this.world;
    if (ownerGrid[y * data.width + x] !== this.player) {
      this.notify('Un secteur prioritaire se place sur ton territoire.');
      return;
    }
    if ((this.playerStats?.priorityZones.length ?? 0) >= MAX_PRIORITY_ZONES) {
      this.notify(`${MAX_PRIORITY_ZONES} secteurs prioritaires au plus.`);
      return;
    }
    this.command({ type: 'addPriority', nation: this.player, x, y });
  }

  removePriority(index: number): void {
    this.command({ type: 'removePriority', nation: this.player, index });
  }

  cancelBuild(index: number): void {
    this.command({ type: 'cancelBuild', nation: this.player, index });
  }

  setOffensiveShare(share: number): void {
    this.offensiveShare = share;
    this.onChange();
  }

  /** Vérifie l'ordre pour expliquer un refus : la simulation l'ignorerait sans rien dire. */
  launchOffensive(fromX: number, fromY: number, toX: number, toY: number): void {
    const { ownerGrid, data } = this.world;
    const stats = this.playerStats;
    const target = ownerGrid[toY * data.width + toX];
    const route = traceRoute(ownerGrid, data.width, data.height, fromX, fromY, toX, toY);
    const landing = route.amphibious ? ownerGrid[route.landingY * data.width + route.landingX] : 0;
    if (!this.canCommand) {
      this.notify('Ton pays a capitulé : tu ne donnes plus d\'ordres.');
    } else if (ownerGrid[fromY * data.width + fromX] !== this.player) {
      this.notify('Une offensive doit partir de ton territoire.');
    } else if (target === 0) {
      this.notify('La cible doit être sur la terre ferme.');
    } else if (target !== this.player && !this.isAtWarWith(target)) {
      this.notify('Tu n\'es pas en guerre contre ce pays.');
    } else if (route.amphibious && (stats?.navy ?? 0) <= 0) {
      this.notify('Sans accès à la mer, tu ne peux pas débarquer.');
    } else if (route.amphibious && landing !== this.player && !this.isAtWarWith(landing)) {
      this.notify('Ce trajet débarque chez un pays neutre : trace plus près de la côte ennemie.');
    } else if (route.amphibious && landing === this.player) {
      this.notify('Ce trajet revient sur ton territoire : trace vers la côte ennemie.');
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

  acknowledgeDefeat(): void {
    this.defeatSeen = true;
    this.onChange();
  }

  /** Renvoie vrai si la partie est bien écrite dans le navigateur. */
  async save(slot: SaveSlot): Promise<boolean> {
    if (this.saving) return false;
    this.saving = true;
    this.onChange();
    try {
      const sim = await new Promise<SimSave>((resolve) => {
        const requestId = this.nextSaveRequest++;
        this.saveRequests.set(requestId, resolve);
        this.post({ type: 'save', requestId });
      });
      const meta: SaveMeta = {
        version: SAVE_VERSION,
        mapHash: this.mapHash,
        player: this.player,
        playerName: this.world.data.nations[this.player - 1].name,
        tick: sim.state.tick,
        savedAt: Date.now(),
        offensiveShare: this.offensiveShare,
        journal: this.journal,
        labels: [...this.labels.values()],
      };
      const blob = await encodeSave({ meta, sim });
      await writeSave({ slot, meta, blob });
      if (slot === 'manual') this.notify('Partie sauvegardée.');
      return true;
    } catch (error) {
      this.notify(`Sauvegarde impossible : ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      this.saving = false;
      this.onChange();
    }
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
    return pairs.length;
  }
}
