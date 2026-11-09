// Cœur de la simulation : aucune dépendance au navigateur, à l'horloge ou à
// Math.random. Mêmes données, même graine et mêmes ordres donnent la même partie.
import { findLandNeighbors } from '../map/adjacency.ts';
import { distanceToBoundary } from '../map/distance.ts';
import {
  ADJACENCY_INTERVAL_TICKS,
  LAND_NEIGHBORS_TICK,
  SEA_NEIGHBORS_TICK,
  AI_MIN_LAUNCH_SUPPLY,
  CONSOLIDATED_COST,
  CONSOLIDATION_SECONDS,
  INFRASTRUCTURE_COST_MAX,
  INFRASTRUCTURE_COST_MIN,
  MIN_SUPPLY,
  OFFENSIVE_SUPPLY_ATTRITION,
  SEA_SUPPLY_COST,
  SUPPLY_ATTACK_PENALTY,
  SUPPLY_ATTRITION,
  SUPPLY_COST_SCALE,
  SUPPLY_DEFENSE_PENALTY,
  SUPPLY_FADE_RANGE,
  SUPPLY_FREE_RANGE,
  TERRAIN_SUPPLY_COST,
  AI_AMPHIBIOUS_CHANCE,
  AI_ATTACK_RATIO,
  AI_ENGAGED_SHARE,
  AI_INTERVAL_TICKS,
  AI_MAX_OFFENSIVES,
  AI_OFFENSIVE_CHANCE,
  AI_OFFENSIVE_MIN_RESERVE,
  AI_OFFENSIVE_SHARE,
  AI_OUTNUMBERED_SHARE,
  AI_TARGET_MAX_DISTANCE,
  AI_TARGET_MIN_DISTANCE,
  AMPHIBIOUS_BASE_LOSS,
  AMPHIBIOUS_LOSS_PER_CELL,
  AMPHIBIOUS_MAX_LENGTH,
  AMPHIBIOUS_MAX_LOSS,
  AMPHIBIOUS_MIN_LOSS,
  AMPHIBIOUS_SPEED,
  AI_DESPERATE_EFFORT,
  AI_EFFORT_SPREAD,
  AI_PEACE_EFFORT,
  AI_WAR_EFFORT,
  ANNEXED_NAVY,
  AT_WAR_GROWTH,
  CAPTURE_DAMAGE,
  DEFAULT_WAR_EFFORT,
  DEMOBILIZE_PER_TICK,
  ECONOMY_INTERVAL_TICKS,
  EFFORT_CAPACITY_BASE,
  EFFORT_CHANGE_PER_SECOND,
  GROWTH_PER_MINUTE,
  MAX_DEVELOPMENT,
  MIN_DAMAGED_DEVELOPMENT,
  MIN_DEVELOPMENT,
  TICKS_PER_SECOND,
  VALUE_GDP_WEIGHT,
  ANNEXED_VALUE,
  ATTRITION_PER_TICK,
  BEACHHEAD_RADIUS,
  CAPITULATION_INTERVAL_TICKS,
  CAPITULATION_TICK,
  CAPITULATION_SHARE,
  DEFAULT_ALLOCATION,
  DEFENSE_MULTIPLIER,
  FLIP_STEEPNESS,
  HOME_DEFENSE,
  INITIAL_MOBILIZATION,
  LOSS_MULTIPLIER,
  LOST_PROVINCE_RETAINED,
  MAX_FLIP_CHANCE,
  MAX_FRONT_FLIPS_PER_TICK,
  MAX_FRONT_FLIP_BUDGET,
  MAX_OFFENSIVES_PER_NATION,
  MAX_OFFENSIVE_LENGTH,
  MAX_WAR_SHARE,
  MIN_FRONT_LENGTH,
  NAVAL_SUPPLY_RATIO,
  NEIGHBOR_WEIGHT,
  OCCUPIED_VALUE,
  OFFENSIVE_ATTRITION,
  OFFENSIVE_CELL_BASE_COST,
  OFFENSIVE_CELL_COST,
  OFFENSIVE_DEFENDER_LOSS,
  OFFENSIVE_DEPTH_FADE,
  OFFENSIVE_EDGE_FALLOFF,
  OFFENSIVE_HALF_WIDTH,
  OFFENSIVE_MIN_FORCE,
  OFFENSIVE_SPEED,
  OFFENSIVE_STALL_TICKS,
  PLAYER_GRACE_TICKS,
  POCKET_DRAIN,
  POCKET_EDGE,
  POCKET_MIN_CELLS_SHOWN,
  POCKET_SPEED,
  REINFORCE_PER_TICK,
  RETREAT_ADVANTAGE,
  SEA_NEIGHBOR_RADIUS,
  SECTOR_CHURN,
  SECTOR_NOISE,
  SECTOR_SHIFT,
  SUPPLY_GROUPS,
  SUPPLY_INTERVAL_TICKS,
  TERRAIN_DEFENSE,
  TERRAIN_SPEED,
  TRANSFER_RATE,
  WAR_CAPACITY_RATIO,
  WAR_CHANCE,
  WAR_INTERVAL_TICKS,
  baseCapacity,
  baseNavy,
} from './balance.ts';
import type {
  EconomySnapshot,
  FrontSnapshot,
  NationLabel,
  PocketSnapshot,
  SimCommand,
  SimEvent,
  SimSave,
  SimSnapshot,
  Stance,
} from './protocol.ts';
import { traceRoute } from './route.ts';

export interface SimConfig {
  width: number;
  height: number;
  nations: { population: number; gdpMusd: number }[];
  /**
   * Le propriétaire initial d'une province est `nation + 1`. Sans population ni PIB,
   * la valeur d'une province suit la racine de sa surface.
   */
  provinces: { nation: number; areaKm2: number; x: number; y: number; population?: number; gdpMusd?: number }[];
  provinceGrid: Uint16Array;
  /** Carte de départ, copiée : la simulation possède sa propre grille. */
  ownerGrid: Uint16Array;
  /** Plaine partout si absente. */
  terrainGrid?: Uint8Array;
  seed: number;
  /** Nation pilotée par le joueur (0 si toutes sont pilotées par l'IA). */
  player: number;
  /** Faux : les autres nations n'agissent que sur ordre (utile pour les tests). */
  ai?: boolean;
  /** Faux : tout est ravitaillé partout, pour mesurer l'effet de la logistique. */
  logistics?: boolean;
  /** Partie à reprendre. */
  saved?: SimSave;
}

interface FrontSide {
  allocation: number;
  stance: Stance;
  force: number;
  captured: number;
  /** Forces par cellule de front, sans la posture. */
  rawDensity: number;
  /** Forces par cellule de front, posture comprise. */
  density: number;
  /** Ravitaillement moyen de ses cellules de front, de 0 à 1. */
  supply: number;
}

interface Front {
  a: number;
  b: number;
  sides: FrontSide[];
  length: number;
  logRatio: number;
  /** Bascules encore permises à ce front. */
  flipBudget: number;
}

interface Offensive {
  id: number;
  nation: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Vecteur du couloir, bouclage pris en compte. */
  dx: number;
  dy: number;
  lengthSquared: number;
  force: number;
  startForce: number;
  captured: number;
  stalledTicks: number;
  /** Tick d'arrivée d'un débarquement encore en mer, 0 sinon. */
  transitUntil: number;
  landingX: number;
  landingY: number;
  seaLoss: number;
  targetX: number;
  targetY: number;
  /** Ravitaillement de l'offensive, mesuré au tick précédent sur son couloir. */
  supply: number;
  supplySum: number;
  supplyCount: number;
}

const INITIAL_LIST_CAPACITY = 1 << 14;
/** Niveau de ravitaillement de chaque octet de la grille : 0 vaut plein (sol national). */
const SUPPLY_LEVELS = Float32Array.from({ length: 256 }, (_, value) => (value === 0 ? 1 : (value - 1) / 254));
const UNREACHED = 0xffff;
/** Un bit par groupe de nations dont les poches et le ravitaillement sont à recalculer. */
const ALL_SUPPLY_GROUPS = (1 << SUPPLY_GROUPS) - 1;
const SUPPLY_PHASE_TICKS = SUPPLY_INTERVAL_TICKS / SUPPLY_GROUPS;

export class Simulation {
  readonly width: number;
  readonly height: number;
  readonly owners: Uint16Array;
  readonly provinceGrid: Uint16Array;
  readonly player: number;
  tick = 0;

  private readonly stride: number;
  private readonly aiEnabled: boolean;
  private readonly logisticsEnabled: boolean;
  private rngState: number;
  private readonly terrain: Uint8Array | null;

  fronts: Front[] = [];
  private readonly frontIndex: Int32Array;
  private readonly advantage: Float32Array;
  private readonly lengthCounts: Int32Array;

  readonly offensives: Offensive[] = [];
  private readonly offensivesByNation: Offensive[][];
  private nextOffensiveId = 1;
  private matchedOffensive: Offensive | null = null;

  private frontier: Int32Array = new Int32Array(INITIAL_LIST_CAPACITY);
  private frontierCount = 0;
  private readonly frontierPosition: Int32Array;

  private readonly sectors: Float32Array;
  private readonly sectorColumns: number;

  private readonly reserve: Float64Array;
  private readonly capacity: Float64Array;
  private readonly cellCounts: Int32Array;
  private readonly armies: Float64Array;
  private readonly navy: Float64Array;
  private readonly alive: Uint8Array;
  private readonly heldHome: Float64Array;
  private readonly totalHome: Float64Array;

  private readonly provinces: SimConfig['provinces'];
  private readonly provinceHome: Uint16Array;
  private readonly provinceCells: Int32Array;
  private readonly provinceValue: Float64Array;
  private readonly controller: Uint16Array;
  private readonly provinceCounts: (Map<number, number> | null)[];
  private capacityDirty = false;
  /** Vrai pendant une annexion : les provinces changent de mains sans destructions. */
  private peacefulTransfer = false;
  private readonly demobilized: Float64Array;

  // Économie.
  /** PIB de départ de chaque province, en millions de dollars (réduit par l'annexion). */
  private readonly provinceGdp: Float64Array;
  /** Développement de chaque province, relatif à son niveau de départ. */
  readonly development: Float64Array;
  private readonly effort: Float64Array;
  private readonly effortTarget: Float64Array;
  /** Tempérament de chaque IA : décalage de l'effort qu'elle choisit. */
  private readonly temperament: Float64Array;
  /** PIB courant, provinces occupées et perdues comprises. */
  private readonly output: Float64Array;
  /** Croissance du PIB courant, par minute (négative en cas d'usure). */
  private readonly growth: Float64Array;

  // Ravitaillement.
  private readonly landCells: Int32Array;
  private readonly coastCells: Int32Array;
  private readonly visited: Uint8Array;
  private readonly visitOrder: Int32Array;
  private readonly pocket: Uint8Array;
  /** Cellules en poche, par groupe de nations qui les a trouvées. */
  private pocketLists: number[][] = Array.from({ length: SUPPLY_GROUPS }, () => []);
  private readonly pocketCounts: Int32Array;
  private pockets: PocketSnapshot[] = [];
  /** Cellule d'ancrage par territoire d'origine : l'Alaska n'est pas une poche. */
  private readonly anchorOwner = new Map<number, number>();
  private readonly isAnchor: Uint8Array;
  private supplyDirty = 0;

  // Logistique.
  /** Ravitaillement de chaque cellule : 0 sur le sol national, sinon 1 + 254 × niveau. */
  readonly supply: Uint8Array;
  /** Cellules dont le ravitaillement n'est pas plein. */
  private supplyList: number[] = [];
  /** 1 pour les cellules de supplyList (marque de travail pendant le calcul). */
  private readonly supplyListed: Uint8Array;
  private readonly supplyDistance: Uint16Array;
  private readonly supplyCost: Uint8Array;
  /** Consolidation de chaque province occupée, de 0 à 1. */
  readonly consolidation: Float64Array;
  /** Somme du ravitaillement des cellules de front, par paire (attaquant, défenseur). */
  private readonly supplySums: Float64Array;
  private pendingSupplyCells: number[] = [];
  private pendingSupplyValues: number[] = [];

  // Voisinages, pour les déclarations de guerre de l'IA.
  private landNeighbors: number[][];
  private seaNeighbors: number[][];
  private readonly labelCells: Int32Array;

  private flipCells: Int32Array = new Int32Array(1024);
  private flipOwners: Uint16Array = new Uint16Array(1024);
  private flipOffensives: Int32Array = new Int32Array(1024);
  private flipCount = 0;
  private pendingCells: number[] = [];
  private pendingOwners: number[] = [];
  private pendingProvinces: number[] = [];
  private pendingHomes: number[] = [];
  private pendingEvents: SimEvent[] = [];

  constructor(config: SimConfig) {
    this.width = config.width;
    this.height = config.height;
    this.owners = config.ownerGrid.slice();
    this.provinceGrid = config.provinceGrid;
    this.terrain = config.terrainGrid ?? null;
    this.player = config.saved ? config.saved.state.player : config.player;
    this.aiEnabled = config.ai ?? true;
    this.logisticsEnabled = config.logistics ?? true;
    this.rngState = config.seed >>> 0 || 1;
    this.provinces = config.provinces;

    this.stride = config.nations.length + 1;
    const pairs = this.stride * this.stride;
    this.frontIndex = new Int32Array(pairs).fill(-1);
    this.advantage = new Float32Array(pairs).fill(-Infinity);
    this.lengthCounts = new Int32Array(pairs);
    this.supplySums = new Float64Array(pairs);
    this.frontierPosition = new Int32Array(this.owners.length).fill(-1);
    this.offensivesByNation = Array.from({ length: this.stride }, () => []);
    this.landNeighbors = Array.from({ length: this.stride }, () => []);
    this.seaNeighbors = Array.from({ length: this.stride }, () => []);

    this.sectorColumns = (this.width >> SECTOR_SHIFT) + 1;
    const sectorRows = (this.height >> SECTOR_SHIFT) + 1;
    this.sectors = new Float32Array(this.sectorColumns * sectorRows);
    for (let i = 0; i < this.sectors.length; i++) this.sectors[i] = (this.random() * 2 - 1) * SECTOR_NOISE;

    const provinceCount = config.provinces.length + 1;
    this.provinceHome = new Uint16Array(provinceCount);
    this.provinceCells = new Int32Array(provinceCount);
    this.provinceValue = new Float64Array(provinceCount);
    this.controller = new Uint16Array(provinceCount);
    this.consolidation = new Float64Array(provinceCount);
    this.provinceCounts = new Array(provinceCount).fill(null);

    this.reserve = new Float64Array(this.stride);
    this.capacity = new Float64Array(this.stride);
    this.cellCounts = new Int32Array(this.stride);
    this.armies = new Float64Array(this.stride);
    this.pocketCounts = new Int32Array(this.stride);
    this.navy = new Float64Array(this.stride);
    this.alive = new Uint8Array(this.stride);
    this.heldHome = new Float64Array(this.stride);
    this.totalHome = new Float64Array(this.stride);
    this.labelCells = new Int32Array(this.stride);
    this.provinceGdp = new Float64Array(provinceCount);
    this.development = new Float64Array(provinceCount).fill(1);
    this.effort = new Float64Array(this.stride).fill(DEFAULT_WAR_EFFORT);
    this.effortTarget = new Float64Array(this.stride).fill(DEFAULT_WAR_EFFORT);
    this.temperament = new Float64Array(this.stride);
    for (let n = 1; n < this.stride; n++) this.temperament[n] = (this.random() * 2 - 1) * AI_EFFORT_SPREAD;
    this.output = new Float64Array(this.stride);
    this.growth = new Float64Array(this.stride);
    this.demobilized = new Float64Array(this.stride);

    let land = 0;
    for (let i = 0; i < this.owners.length; i++) {
      this.cellCounts[this.owners[i]]++;
      this.provinceCells[this.provinceGrid[i]]++;
      if (this.owners[i] !== 0) land++;
    }
    this.landCells = new Int32Array(land);
    const coast: number[] = [];
    for (let i = 0, k = 0; i < this.owners.length; i++) {
      if (this.owners[i] === 0) continue;
      this.landCells[k++] = i;
      if (this.touchesWater(i)) coast.push(i);
    }
    this.coastCells = Int32Array.from(coast);
    this.labelCells.set(this.cellCounts);
    this.visited = new Uint8Array(this.owners.length);
    this.visitOrder = new Int32Array(land);
    this.pocket = new Uint8Array(this.owners.length);
    this.isAnchor = new Uint8Array(this.owners.length);
    this.supply = new Uint8Array(this.owners.length);
    this.supplyListed = new Uint8Array(this.owners.length);
    this.supplyDistance = new Uint16Array(this.owners.length);
    this.supplyCost = new Uint8Array(this.owners.length);
    this.placeAnchors();

    // La capacité militaire se répartit entre les provinces selon leur part du PIB et de
    // la population : elle change de camp avec elles. Sans ces données, la racine de la
    // surface, pour ne pas tout donner aux déserts.
    const gdpTotal = new Float64Array(this.stride);
    const populationTotal = new Float64Array(this.stride);
    const rootArea = new Float64Array(this.stride);
    config.provinces.forEach((province, index) => {
      const n = province.nation + 1;
      this.provinceHome[index + 1] = n;
      this.controller[index + 1] = n;
      gdpTotal[n] += province.gdpMusd ?? 0;
      populationTotal[n] += province.population ?? 0;
      rootArea[n] += Math.sqrt(province.areaKm2);
    });
    config.provinces.forEach((province, index) => {
      const n = province.nation + 1;
      const nation = config.nations[province.nation];
      const area = Math.sqrt(province.areaKm2) / rootArea[n];
      const population = populationTotal[n] > 0 ? (province.population ?? 0) / populationTotal[n] : area;
      const gdp = gdpTotal[n] > 0 ? (province.gdpMusd ?? 0) / gdpTotal[n] : population;
      const weight = VALUE_GDP_WEIGHT * gdp + (1 - VALUE_GDP_WEIGHT) * population;
      this.provinceValue[index + 1] = baseCapacity(nation.population, nation.gdpMusd) * weight;
      this.provinceGdp[index + 1] = gdpTotal[n] > 0 ? (province.gdpMusd ?? 0) : nation.gdpMusd * gdp;
    });
    this.recomputeCapacity();

    const hasCoast = new Uint8Array(this.stride);
    for (let k = 0; k < this.coastCells.length; k++) hasCoast[this.owners[this.coastCells[k]]] = 1;
    for (let n = 1; n < this.stride; n++) {
      this.reserve[n] = this.capacity[n] * INITIAL_MOBILIZATION;
      this.alive[n] = this.cellCounts[n] > 0 ? 1 : 0;
      this.navy[n] = hasCoast[n] ? baseNavy(config.nations[n - 1].gdpMusd) : 0;
    }
    if (this.aiEnabled) this.refreshNeighbors();
    if (config.saved) this.restore(config.saved);
  }

  private touchesWater(cell: number): boolean {
    const { owners, width: W, height: H } = this;
    const x = cell % W;
    const y = (cell - x) / W;
    return (
      owners[x > 0 ? cell - 1 : cell + W - 1] === 0 ||
      owners[x < W - 1 ? cell + 1 : cell - W + 1] === 0 ||
      (y > 0 && owners[cell - W] === 0) ||
      (y < H - 1 && owners[cell + W] === 0)
    );
  }

  private random(): number {
    let x = this.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return this.rngState / 4294967296;
  }

  private wrapDelta(from: number, to: number): number {
    const W = this.width;
    let d = (to - from) % W;
    if (d > W / 2) d -= W;
    if (d < -W / 2) d += W;
    return d;
  }

  /** Total d'une nation : réserve, forces engagées et offensives en cours. */
  armyOf(nation: number): number {
    let total = this.reserve[nation];
    for (const front of this.fronts) {
      if (front.a === nation) total += front.sides[0].force;
      else if (front.b === nation) total += front.sides[1].force;
    }
    for (const offensive of this.offensivesByNation[nation]) total += offensive.force;
    return total;
  }

  reserveOf(nation: number): number {
    return this.reserve[nation];
  }

  cellsOf(nation: number): number {
    return this.cellCounts[nation];
  }

  capacityOf(nation: number): number {
    return this.capacity[nation];
  }

  /** PIB courant, en millions de dollars. */
  outputOf(nation: number): number {
    return this.output[nation];
  }

  effortOf(nation: number): number {
    return this.effort[nation];
  }

  isAlive(nation: number): boolean {
    return this.alive[nation] === 1;
  }

  controllerOf(province: number): number {
    return this.controller[province];
  }

  /** Ravitaillement d'une cellule, de 0 à 1 (1 sur le sol national). */
  supplyAt(cell: number): number {
    return SUPPLY_LEVELS[this.supply[cell]];
  }

  isPocket(cell: number): boolean {
    return this.pocket[cell] === 1;
  }

  get frontierSize(): number {
    return this.frontierCount;
  }

  get aliveCount(): number {
    let count = 0;
    for (let n = 1; n < this.stride; n++) count += this.alive[n];
    return count;
  }

  private frontOf(x: number, y: number): Front | null {
    const index = this.frontIndex[x * this.stride + y];
    return index < 0 ? null : this.fronts[index];
  }

  apply(command: SimCommand): void {
    switch (command.type) {
      case 'declareWars':
        this.declareWars(command.pairs);
        break;
      case 'setFront':
        this.setFront(command.nation, command.enemy, command.allocation, command.stance);
        break;
      case 'launchOffensive':
        this.launchOffensive(command.nation, command.fromX, command.fromY, command.toX, command.toY, command.share);
        break;
      case 'cancelOffensive':
        this.cancelOffensive(command.nation, command.id);
        break;
      case 'setEffort':
        this.setEffort(command.nation, command.effort);
        break;
    }
  }

  /** L'économie se reconvertit progressivement vers l'effort demandé. */
  setEffort(nation: number, effort: number): void {
    if (nation <= 0 || nation >= this.stride || !Number.isFinite(effort)) return;
    this.effortTarget[nation] = Math.max(0, Math.min(1, effort));
  }

  declareWars(pairs: [number, number][]): void {
    const added: Front[] = [];
    for (const [x, y] of pairs) {
      if (x === y || x <= 0 || y <= 0 || this.frontOf(x, y)) continue;
      if (!this.alive[x] || !this.alive[y]) continue;
      const a = Math.min(x, y);
      const b = Math.max(x, y);
      const side = (): FrontSide => ({ allocation: 0, stance: 'hold', force: 0, captured: 0, rawDensity: 0, density: 0, supply: 1 });
      const front: Front = { a, b, sides: [side(), side()], length: 0, logRatio: 0, flipBudget: 0 };
      const index = this.fronts.push(front) - 1;
      this.frontIndex[a * this.stride + b] = index;
      this.frontIndex[b * this.stride + a] = index;
      added.push(front);
      this.pendingEvents.push({ type: 'war', tick: this.tick, a, b });
    }
    if (added.length === 0) return;
    // Seules les cellules des nations entrées en guerre peuvent rejoindre la frontière.
    const involved = new Uint8Array(this.stride);
    for (const front of added) {
      involved[front.a] = 1;
      involved[front.b] = 1;
    }
    for (let k = 0; k < this.landCells.length; k++) {
      if (involved[this.owners[this.landCells[k]]]) this.refreshFrontier(this.landCells[k]);
    }
    this.measureFronts();
    this.supplyDirty = ALL_SUPPLY_GROUPS;
    if (this.player) {
      for (const front of added) {
        const enemy = front.a === this.player ? front.b : front.b === this.player ? front.a : 0;
        // Sans frontière commune, immobiliser des forces sur ce front ne servirait à rien.
        if (enemy !== 0 && front.length > 0) this.setFront(this.player, enemy, DEFAULT_ALLOCATION, 'hold');
      }
    }
    if (this.aiEnabled) this.decideAllocations();
  }

  /** Longueur de chaque front, sans attendre le prochain tick. */
  private measureFronts(): void {
    const { owners, width: W, height: H, stride, frontIndex, lengthCounts } = this;
    for (const front of this.fronts) {
      lengthCounts[front.a * stride + front.b] = 0;
      lengthCounts[front.b * stride + front.a] = 0;
    }
    for (let i = 0; i < this.frontierCount; i++) {
      const cell = this.frontier[i];
      const defender = owners[cell];
      const x = cell % W;
      const y = (cell - x) / W;
      const n0 = owners[x > 0 ? cell - 1 : cell + W - 1];
      const n1 = owners[x < W - 1 ? cell + 1 : cell - W + 1];
      const n2 = y > 0 ? owners[cell - W] : 0;
      const n3 = y < H - 1 ? owners[cell + W] : 0;
      for (let j = 0; j < 4; j++) {
        const attacker = j === 0 ? n0 : j === 1 ? n1 : j === 2 ? n2 : n3;
        if (attacker === 0 || attacker === defender) continue;
        if (j > 0 && attacker === n0) continue;
        if (j > 1 && attacker === n1) continue;
        if (j > 2 && attacker === n2) continue;
        const key = attacker * stride + defender;
        if (frontIndex[key] >= 0) lengthCounts[key]++;
      }
    }
    for (const front of this.fronts) {
      front.length = (lengthCounts[front.a * stride + front.b] + lengthCounts[front.b * stride + front.a]) / 2;
    }
  }

  /** La somme des allocations d'une nation ne dépasse jamais 100 %. */
  setFront(nation: number, enemy: number, allocation: number, stance: Stance): void {
    const front = this.frontOf(nation, enemy);
    if (!front) return;
    let others = 0;
    for (const other of this.fronts) {
      if (other === front) continue;
      if (other.a === nation) others += other.sides[0].allocation;
      else if (other.b === nation) others += other.sides[1].allocation;
    }
    const side = front.a === nation ? front.sides[0] : front.sides[1];
    side.allocation = Math.max(0, Math.min(allocation, 1 - others));
    side.stance = stance;
  }

  /**
   * Engage une part de la réserve dans un couloir. Le départ doit être sur le territoire
   * de la nation. Un trajet qui traverse assez d'eau devient un débarquement.
   * Renvoie l'identifiant, ou 0 si l'offensive est refusée.
   */
  launchOffensive(nation: number, fromX: number, fromY: number, toX: number, toY: number, share: number): number {
    const W = this.width;
    const H = this.height;
    const inside = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < W && y >= 0 && y < H;
    if (!inside(fromX, fromY) || !inside(toX, toY)) return 0;
    if (this.owners[fromY * W + fromX] !== nation) return 0;
    const list = this.offensivesByNation[nation];
    if (!list || list.length >= MAX_OFFENSIVES_PER_NATION) return 0;
    const force = this.reserve[nation] * Math.max(0, Math.min(1, share));
    if (force < OFFENSIVE_MIN_FORCE) return 0;
    let dx = this.wrapDelta(fromX, toX);
    let dy = toY - fromY;
    const length = Math.hypot(dx, dy);
    if (length === 0) return 0;

    const route = traceRoute(this.owners, W, H, fromX, fromY, toX, toY);
    let transitUntil = 0;
    let seaLoss = 0;
    if (route.amphibious) {
      if (length > AMPHIBIOUS_MAX_LENGTH || this.navy[nation] <= 0) return 0;
      const landingOwner = this.owners[route.landingY * W + route.landingX];
      if (landingOwner === nation || !this.frontOf(nation, landingOwner)) return 0;
      transitUntil = this.tick + Math.max(1, Math.ceil(route.seaCells / AMPHIBIOUS_SPEED));
      seaLoss = this.seaLoss(nation, landingOwner, route.seaCells);
    } else if (length > MAX_OFFENSIVE_LENGTH) {
      dx = Math.round((dx / length) * MAX_OFFENSIVE_LENGTH);
      dy = Math.round((dy / length) * MAX_OFFENSIVE_LENGTH);
    }

    this.reserve[nation] -= force;
    const offensive: Offensive = {
      id: this.nextOffensiveId++,
      nation,
      fromX,
      fromY,
      toX: ((fromX + dx) % W + W) % W,
      toY: fromY + dy,
      dx,
      dy,
      lengthSquared: dx * dx + dy * dy,
      force,
      startForce: force,
      captured: 0,
      stalledTicks: 0,
      transitUntil,
      landingX: route.landingX,
      landingY: route.landingY,
      seaLoss,
      targetX: toX,
      targetY: toY,
      supply: 1,
      supplySum: 0,
      supplyCount: 0,
    };
    this.offensives.push(offensive);
    list.push(offensive);
    return offensive.id;
  }

  /** Les pertes en mer dépendent de la distance et du rapport des marines. */
  private seaLoss(nation: number, enemy: number, seaCells: number): number {
    const own = this.navy[nation];
    const other = this.navy[enemy];
    const pressure = own + other > 0 ? (2 * other) / (own + other) : 1;
    const loss = (AMPHIBIOUS_BASE_LOSS + AMPHIBIOUS_LOSS_PER_CELL * seaCells) * pressure;
    return Math.max(AMPHIBIOUS_MIN_LOSS, Math.min(AMPHIBIOUS_MAX_LOSS, loss));
  }

  cancelOffensive(nation: number, id: number): void {
    const offensive = this.offensives.find((entry) => entry.id === id && entry.nation === nation);
    if (offensive) this.endOffensive(offensive);
  }

  /** Les forces restantes retournent en réserve. */
  private endOffensive(offensive: Offensive): void {
    this.reserve[offensive.nation] += offensive.force;
    offensive.force = 0;
    this.offensives.splice(this.offensives.indexOf(offensive), 1);
    const list = this.offensivesByNation[offensive.nation];
    list.splice(list.indexOf(offensive), 1);
  }

  // -------------------------------------------------------------------------
  // Tick
  // -------------------------------------------------------------------------

  step(): void {
    this.tick++;
    this.evolveSectors();
    if (this.aiEnabled) {
      const phase = this.tick % ADJACENCY_INTERVAL_TICKS;
      if (phase === LAND_NEIGHBORS_TICK) this.refreshLandNeighbors();
      else if (phase === SEA_NEIGHBORS_TICK) this.seaNeighbors = this.findSeaNeighbors();
      if (this.tick % WAR_INTERVAL_TICKS === 0) this.decideWars();
      if (this.tick % AI_INTERVAL_TICKS === 0) {
        this.decideAllocations();
        this.decideOffensives();
        this.decideEfforts();
      }
    }
    if (this.tick % ECONOMY_INTERVAL_TICKS === 0) this.updateEconomy();
    this.computeArmies();
    this.updateFronts();
    this.reinforce();
    this.updateOffensives();
    this.scanFrontier();
    this.applyFlips();
    if (this.tick % SUPPLY_PHASE_TICKS === 0) {
      const group = (this.tick / SUPPLY_PHASE_TICKS) % SUPPLY_GROUPS;
      if (this.supplyDirty & (1 << group)) this.updateSupply(group);
    }
    if (this.tick % CAPITULATION_INTERVAL_TICKS === CAPITULATION_TICK) this.checkCapitulations();
  }

  private evolveSectors(): void {
    const changes = Math.ceil(this.sectors.length * SECTOR_CHURN);
    for (let i = 0; i < changes; i++) {
      const sector = Math.floor(this.random() * this.sectors.length);
      this.sectors[sector] = (this.random() * 2 - 1) * SECTOR_NOISE;
    }
  }

  private decideAllocations(): void {
    const lengths = new Float64Array(this.stride);
    const opposing = new Float64Array(this.stride);
    for (const front of this.fronts) {
      lengths[front.a] += front.length;
      lengths[front.b] += front.length;
      if (front.length > 0) {
        opposing[front.a] += front.sides[1].force;
        opposing[front.b] += front.sides[0].force;
      }
    }
    for (const front of this.fronts) {
      for (let s = 0; s < 2; s++) {
        const nation = s === 0 ? front.a : front.b;
        if (nation === this.player) continue;
        const side = front.sides[s];
        const enemy = front.sides[1 - s];
        const army = this.armyOf(nation);
        const share = opposing[nation] > army * AI_ENGAGED_SHARE ? AI_OUTNUMBERED_SHARE : AI_ENGAGED_SHARE;
        side.allocation = lengths[nation] > 0 ? (share * front.length) / lengths[nation] : 0;
        const planned = army * side.allocation;
        side.stance = planned > enemy.force * AI_ATTACK_RATIO ? 'attack' : 'hold';
      }
    }
  }

  /** L'IA grandit en paix, s'arme en guerre, et jette tout dans la balance en sous-nombre. */
  private decideEfforts(): void {
    const opposing = new Float64Array(this.stride);
    const atWar = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
      opposing[front.a] += front.sides[1].force;
      opposing[front.b] += front.sides[0].force;
    }
    for (let n = 1; n < this.stride; n++) {
      if (n === this.player || !this.alive[n]) continue;
      let effort = AI_PEACE_EFFORT;
      if (atWar[n]) effort = opposing[n] > this.armies[n] * AI_ENGAGED_SHARE ? AI_DESPERATE_EFFORT : AI_WAR_EFFORT;
      this.effortTarget[n] = Math.max(0, Math.min(1, effort + this.temperament[n]));
    }
  }

  private decideOffensives(): void {
    const attempted = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      for (let s = 0; s < 2; s++) {
        const nation = s === 0 ? front.a : front.b;
        const enemy = s === 0 ? front.b : front.a;
        if (nation === this.player || attempted[nation]) continue;
        attempted[nation] = 1;
        if (this.random() >= AI_OFFENSIVE_CHANCE) continue;
        if (this.offensivesByNation[nation].length >= AI_MAX_OFFENSIVES) continue;
        if (this.reserve[nation] < this.armyOf(nation) * AI_OFFENSIVE_MIN_RESERVE) continue;
        if (front.length === 0 || this.random() < AI_AMPHIBIOUS_CHANCE) this.launchAiAmphibious(nation, enemy);
        else this.launchAiOffensive(nation);
      }
    }
  }

  /** Part d'une cellule de front au hasard, vers une province ennemie de valeur à portée. */
  private launchAiOffensive(nation: number): void {
    if (this.frontierCount === 0) return;
    const { owners, width: W, height: H } = this;
    for (let attempt = 0; attempt < 24; attempt++) {
      const cell = this.frontier[Math.floor(this.random() * this.frontierCount)];
      if (owners[cell] !== nation) continue;
      // Pas d'offensive depuis une pointe déjà à bout de souffle.
      if (SUPPLY_LEVELS[this.supply[cell]] < AI_MIN_LAUNCH_SUPPLY) continue;
      const x = cell % W;
      const y = (cell - x) / W;
      const around = [
        owners[y * W + (x + 1) % W],
        owners[y * W + (x + W - 1) % W],
        y > 0 ? owners[cell - W] : 0,
        y < H - 1 ? owners[cell + W] : 0,
      ];
      const enemy = around.find((other) => other !== 0 && other !== nation && this.frontOf(nation, other));
      if (!enemy) continue;

      let best = -1;
      let bestScore = 0;
      for (let province = 1; province < this.controller.length; province++) {
        if (this.controller[province] !== enemy) continue;
        const data = this.provinces[province - 1];
        const distance = Math.hypot(this.wrapDelta(x, data.x), data.y - y);
        if (distance < AI_TARGET_MIN_DISTANCE || distance > AI_TARGET_MAX_DISTANCE) continue;
        const score = this.provinceValue[province] * (0.4 + this.random());
        if (score > bestScore) {
          bestScore = score;
          best = province;
        }
      }
      if (best < 0) continue;
      const target = this.provinces[best - 1];
      this.launchOffensive(nation, x, y, Math.floor(target.x), Math.floor(target.y), AI_OFFENSIVE_SHARE);
      return;
    }
  }

  /** Cherche sur sa côte le départ le plus proche d'une province ennemie, puis débarque. */
  private launchAiAmphibious(nation: number, enemy: number): void {
    if (this.navy[nation] <= 0) return;
    const held: number[] = [];
    for (let province = 1; province < this.controller.length; province++) {
      if (this.controller[province] === enemy) held.push(province);
    }
    if (held.length === 0) return;
    const target = this.provinces[held[Math.floor(this.random() * held.length)] - 1];
    const toX = Math.floor(target.x);
    const toY = Math.floor(target.y);
    if (this.owners[toY * this.width + toX] !== enemy) return;

    const own: number[] = [];
    for (let k = 0; k < this.coastCells.length; k++) {
      if (this.owners[this.coastCells[k]] === nation) own.push(this.coastCells[k]);
    }
    if (own.length === 0) return;
    let bestCell = -1;
    let bestSea = Infinity;
    for (let attempt = 0; attempt < 16; attempt++) {
      const cell = own[Math.floor(this.random() * own.length)];
      const x = cell % this.width;
      const y = (cell - x) / this.width;
      const route = traceRoute(this.owners, this.width, this.height, x, y, toX, toY);
      if (!route.amphibious || route.seaCells >= bestSea) continue;
      if (this.owners[route.landingY * this.width + route.landingX] !== enemy) continue;
      bestSea = route.seaCells;
      bestCell = cell;
    }
    if (bestCell < 0) return;
    const x = bestCell % this.width;
    this.launchOffensive(nation, x, (bestCell - x) / this.width, toX, toY, AI_OFFENSIVE_SHARE);
  }

  // -------------------------------------------------------------------------
  // Guerres décidées par l'IA
  // -------------------------------------------------------------------------

  private refreshNeighbors(): void {
    this.refreshLandNeighbors();
    this.seaNeighbors = this.findSeaNeighbors();
  }

  private refreshLandNeighbors(): void {
    const land: number[][] = Array.from({ length: this.stride }, () => []);
    for (const [a, b] of findLandNeighbors(this.owners, this.width, this.height)) {
      land[a].push(b);
      land[b].push(a);
    }
    this.landNeighbors = land;
  }

  /**
   * Étend chaque côte sur la mer, à demi-résolution : deux nations dont les zones se
   * rencontrent à moins de SEA_NEIGHBOR_RADIUS cellules sont voisines par la mer.
   */
  private findSeaNeighbors(): number[][] {
    const w = this.width >> 1;
    const h = this.height >> 1;
    const labels = new Uint16Array(w * h);
    const depth = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        labels[y * w + x] = this.owners[y * 2 * this.width + x * 2];
      }
    }
    let tail = 0;
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] !== 0) queue[tail++] = i;
    }
    const seen = new Set<number>();
    const result: number[][] = Array.from({ length: this.stride }, () => []);
    const link = (a: number, b: number) => {
      if (a === b) return;
      const key = Math.min(a, b) * 65536 + Math.max(a, b);
      if (seen.has(key)) return;
      seen.add(key);
      result[a].push(b);
      result[b].push(a);
    };
    let head = 0;
    while (head < tail) {
      const cell = queue[head++];
      const owner = labels[cell];
      const x = cell % w;
      const y = (cell - x) / w;
      for (let j = 0; j < 4; j++) {
        let next: number;
        if (j === 0) next = y * w + (x + w - 1) % w;
        else if (j === 1) next = y * w + (x + 1) % w;
        else if (j === 2) {
          if (y === 0) continue;
          next = cell - w;
        } else {
          if (y === h - 1) continue;
          next = cell + w;
        }
        const other = labels[next];
        if (other === 0) {
          if (depth[cell] < SEA_NEIGHBOR_RADIUS) {
            labels[next] = owner;
            depth[next] = depth[cell] + 1;
            queue[tail++] = next;
          }
        } else if (other !== owner && (depth[cell] > 0 || depth[next] > 0)) {
          link(owner, other);
        }
      }
    }
    return result;
  }

  /** Une nation en paix attaque parfois un voisin plus faible, par terre d'abord. */
  private decideWars(): void {
    if (this.random() >= WAR_CHANCE) return;
    const living: number[] = [];
    for (let n = 1; n < this.stride; n++) {
      if (this.alive[n] && n !== this.player) living.push(n);
    }
    if (living.length === 0) return;
    if (this.fronts.length >= Math.max(1, this.aliveCount * MAX_WAR_SHARE)) return;
    const nation = living[Math.floor(this.random() * living.length)];
    if (this.fronts.some((front) => front.a === nation || front.b === nation)) return;

    const pick = (candidates: number[]) => {
      const weak = candidates.filter((other) => {
        if (!this.alive[other]) return false;
        if (other === this.player && this.tick < PLAYER_GRACE_TICKS) return false;
        return this.capacity[nation] >= this.capacity[other] * WAR_CAPACITY_RATIO;
      });
      return weak.length > 0 ? weak[Math.floor(this.random() * weak.length)] : 0;
    };
    const land = pick(this.landNeighbors[nation]);
    const enemy = land !== 0 ? land : this.navy[nation] > 0 ? pick(this.seaNeighbors[nation]) : 0;
    if (enemy !== 0) this.declareWars([[nation, enemy]]);
  }

  // -------------------------------------------------------------------------
  // Capitulation et annexion
  // -------------------------------------------------------------------------

  private checkCapitulations(): void {
    if (this.fronts.length === 0) return;
    const atWar = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
    }
    for (let n = 1; n < this.stride; n++) {
      if (atWar[n] && this.alive[n] && this.heldHome[n] < this.totalHome[n] * CAPITULATION_SHARE) {
        this.capitulate(n);
      }
    }
  }

  /** Le vainqueur est l'ennemi qui tient la plus grande part du territoire du vaincu. */
  private capitulate(loser: number): void {
    const tally = new Float64Array(this.stride);
    for (let p = 1; p < this.controller.length; p++) {
      if (this.provinceHome[p] === loser && this.controller[p] !== loser && this.frontOf(loser, this.controller[p])) {
        tally[this.controller[p]] += this.provinceValue[p];
      }
    }
    let winner = 0;
    for (let n = 1; n < this.stride; n++) {
      if (tally[n] > (winner ? tally[winner] : 0)) winner = n;
    }
    if (winner === 0) return;

    // Tout ce qu'il reste au vaincu, îles comprises, revient au vainqueur.
    const transferred: number[] = [];
    this.peacefulTransfer = true;
    for (let k = 0; k < this.landCells.length; k++) {
      const cell = this.landCells[k];
      if (this.owners[cell] !== loser) continue;
      transferred.push(cell);
      this.owners[cell] = winner;
      this.pocket[cell] = 0;
      this.cellCounts[loser]--;
      this.cellCounts[winner]++;
      this.pendingCells.push(cell);
      this.pendingOwners.push(winner);
      this.transferProvinceCell(this.provinceGrid[cell], loser, winner);
    }
    this.peacefulTransfer = false;

    for (let p = 1; p < this.controller.length; p++) {
      if (this.provinceHome[p] !== loser) continue;
      if (this.controller[p] === loser) {
        this.controller[p] = winner;
        this.pendingProvinces.push(p, winner);
      }
      this.provinceHome[p] = this.controller[p];
      this.consolidation[p] = 0;
      this.provinceValue[p] *= ANNEXED_VALUE;
      this.provinceGdp[p] *= ANNEXED_VALUE;
      this.pendingHomes.push(p, this.controller[p]);
    }

    this.navy[winner] += this.navy[loser] * ANNEXED_NAVY;
    this.navy[loser] = 0;
    this.alive[loser] = 0;
    for (const offensive of [...this.offensivesByNation[loser]]) this.endOffensive(offensive);
    this.reserve[loser] = 0;
    this.removeFrontsOf(loser);
    this.recomputeCapacity();
    // Peut quitter la frontière : ce qui y était. Peut y entrer : ce qui vient de changer de main.
    const previous = this.frontier.slice(0, this.frontierCount);
    for (let i = 0; i < previous.length; i++) this.refreshFrontier(previous[i]);
    for (const cell of transferred) this.refreshAround(cell);
    this.measureFronts();
    this.supplyDirty = ALL_SUPPLY_GROUPS;
    this.pendingEvents.push({ type: 'capitulation', tick: this.tick, loser, winner });
  }

  /** Les forces des nations encore en guerre ailleurs regagnent leur réserve. */
  private removeFrontsOf(loser: number): void {
    const kept: Front[] = [];
    for (const front of this.fronts) {
      const { a, b } = front;
      this.frontIndex[a * this.stride + b] = -1;
      this.frontIndex[b * this.stride + a] = -1;
      if (a === loser || b === loser) {
        this.advantage[a * this.stride + b] = -Infinity;
        this.advantage[b * this.stride + a] = -Infinity;
        const other = a === loser ? b : a;
        this.reserve[other] += front.sides[a === loser ? 1 : 0].force;
      } else {
        kept.push(front);
      }
    }
    this.fronts = kept;
    this.reindexFronts();
  }

  private reindexFronts(): void {
    this.fronts.forEach((front, index) => {
      this.frontIndex[front.a * this.stride + front.b] = index;
      this.frontIndex[front.b * this.stride + front.a] = index;
    });
  }

  /**
   * Capacité militaire et PIB courant. Une province rapporte selon son développement ;
   * occupée, presque rien à l'occupant, et une part à son pays d'origine. L'effort de
   * guerre multiplie ensuite la capacité. La capitulation, elle, ne regarde que la valeur
   * de départ du territoire : bâtir ou détruire ne la rapproche pas.
   */
  private recomputeCapacity(): void {
    const { capacity, output, development, provinceGdp } = this;
    capacity.fill(0);
    output.fill(0);
    this.heldHome.fill(0);
    this.totalHome.fill(0);
    for (let p = 1; p < this.controller.length; p++) {
      const value = this.provinceValue[p];
      const home = this.provinceHome[p];
      const holder = this.controller[p];
      const developed = development[p];
      this.totalHome[home] += value;
      if (holder === home) {
        this.heldHome[home] += value;
        capacity[home] += value * developed;
        output[home] += provinceGdp[p] * developed;
      } else {
        capacity[holder] += value * developed * OCCUPIED_VALUE;
        output[holder] += provinceGdp[p] * developed * OCCUPIED_VALUE;
        capacity[home] += value * developed * LOST_PROVINCE_RETAINED;
        output[home] += provinceGdp[p] * developed * LOST_PROVINCE_RETAINED;
      }
    }
    for (let n = 1; n < this.stride; n++) capacity[n] *= EFFORT_CAPACITY_BASE + this.effort[n];
    this.capacityDirty = false;
  }

  /**
   * Chaque seconde : l'économie se reconvertit vers l'effort voulu, puis les provinces
   * tenues par leur pays grandissent (effort bas) ou s'usent (effort haut).
   */
  private updateEconomy(): void {
    const { effort, effortTarget, development, provinceGdp } = this;
    const step = (EFFORT_CHANGE_PER_SECOND * ECONOMY_INTERVAL_TICKS) / TICKS_PER_SECOND;
    for (let n = 1; n < this.stride; n++) {
      const gap = effortTarget[n] - effort[n];
      effort[n] += Math.max(-step, Math.min(step, gap));
    }
    const atWar = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
    }
    const minutes = ECONOMY_INTERVAL_TICKS / TICKS_PER_SECOND / 60;
    const rate = new Float64Array(this.stride);
    for (let n = 1; n < this.stride; n++) {
      rate[n] = 2 * GROWTH_PER_MINUTE * (DEFAULT_WAR_EFFORT - effort[n]) * minutes;
      if (rate[n] > 0 && atWar[n]) rate[n] *= AT_WAR_GROWTH;
    }
    const gained = new Float64Array(this.stride);
    const base = new Float64Array(this.stride);
    for (let p = 1; p < this.controller.length; p++) {
      const holder = this.controller[p];
      if (holder !== this.provinceHome[p] || rate[holder] === 0) continue;
      const before = development[p];
      // Croissance et usure ralentissent à l'approche de leurs bornes.
      const room = rate[holder] > 0 ? (MAX_DEVELOPMENT - before) / (MAX_DEVELOPMENT - 1) : (before - MIN_DEVELOPMENT) / (1 - MIN_DEVELOPMENT);
      const after = before + rate[holder] * Math.max(0, Math.min(1, room));
      development[p] = after;
      gained[holder] += provinceGdp[p] * (after - before);
      base[holder] += provinceGdp[p] * before;
    }
    for (let n = 1; n < this.stride; n++) this.growth[n] = base[n] > 0 ? gained[n] / base[n] / minutes : 0;
    this.recomputeCapacity();

    // L'occupant répare peu à peu les voies des provinces qu'il tient.
    const consolidating = ECONOMY_INTERVAL_TICKS / TICKS_PER_SECOND / CONSOLIDATION_SECONDS;
    for (let p = 1; p < this.controller.length; p++) {
      if (this.controller[p] === this.provinceHome[p] || this.consolidation[p] >= 1) continue;
      this.consolidation[p] = Math.min(1, this.consolidation[p] + consolidating);
      this.supplyDirty = ALL_SUPPLY_GROUPS;
    }
  }

  private computeArmies(): void {
    const { armies } = this;
    for (let n = 1; n < this.stride; n++) armies[n] = this.reserve[n];
    for (const front of this.fronts) {
      armies[front.a] += front.sides[0].force;
      armies[front.b] += front.sides[1].force;
    }
    for (const offensive of this.offensives) armies[offensive.nation] += offensive.force;
  }

  private updateFronts(): void {
    const { advantage, stride } = this;
    for (const front of this.fronts) {
      const [sideA, sideB] = front.sides;
      this.moveForces(front.a, sideA);
      this.moveForces(front.b, sideB);

      const length = Math.max(front.length, MIN_FRONT_LENGTH);
      sideA.rawDensity = sideA.force / length;
      sideB.rawDensity = sideB.force / length;
      sideA.density = sideA.rawDensity * DEFENSE_MULTIPLIER[sideA.stance];
      sideB.density = sideB.rawDensity * DEFENSE_MULTIPLIER[sideB.stance];
      const logRatio = Math.log((sideA.density + 1e-3) / (sideB.density + 1e-3));
      front.logRatio = logRatio;

      const aRetreats = sideA.stance === 'retreat';
      const bRetreats = sideB.stance === 'retreat';
      advantage[front.a * stride + front.b] =
        !aRetreats && (sideA.stance === 'attack' || bRetreats)
          ? logRatio + (bRetreats ? RETREAT_ADVANTAGE : 0)
          : -Infinity;
      advantage[front.b * stride + front.a] =
        !bRetreats && (sideB.stance === 'attack' || aRetreats)
          ? -logRatio + (aRetreats ? RETREAT_ADVANTAGE : 0)
          : -Infinity;

      // Deux camps qui tiennent ne se combattent pas. Sinon, chacun perd une part
      // de ses forces d'autant plus grande que l'adversaire est nombreux.
      const engaged = front.length > 0 && (sideA.stance !== 'hold' || sideB.stance !== 'hold');
      const total = sideA.force + sideB.force;
      if (engaged && total > 0) {
        const scale = ATTRITION_PER_TICK * Math.min(1, front.length / MIN_FRONT_LENGTH);
        const lossA = sideA.force * (2 * sideB.force) / total * scale * LOSS_MULTIPLIER[sideA.stance];
        const lossB = sideB.force * (2 * sideA.force) / total * scale * LOSS_MULTIPLIER[sideB.stance];
        sideA.force = Math.max(0, sideA.force - lossA);
        sideB.force = Math.max(0, sideB.force - lossB);
      }
      // Un camp mal ravitaillé s'use, même quand personne n'attaque.
      if (front.length > 0) {
        sideA.force *= 1 - SUPPLY_ATTRITION * (1 - sideA.supply);
        sideB.force *= 1 - SUPPLY_ATTRITION * (1 - sideB.supply);
      }
    }
  }

  /** Les forces rejoignent ou quittent le front progressivement. */
  private moveForces(nation: number, side: FrontSide): void {
    const army = this.armies[nation];
    const target = army * side.allocation;
    const limit = army * TRANSFER_RATE;
    if (side.force < target) {
      const moved = Math.min(target - side.force, limit, this.reserve[nation]);
      side.force += moved;
      this.reserve[nation] -= moved;
    } else if (side.force > target) {
      const moved = Math.min(side.force - target, limit);
      side.force -= moved;
      this.reserve[nation] += moved;
    }
  }

  /**
   * L'armée tend vers la capacité militaire : elle se renforce en dessous et se
   * démobilise au-dessus, quand l'économie ne peut plus l'entretenir.
   */
  private reinforce(): void {
    this.computeArmies();
    let shrinking = false;
    const keep = this.demobilized;
    keep.fill(1);
    for (let n = 1; n < this.stride; n++) {
      if (!this.alive[n]) continue;
      const missing = this.capacity[n] - this.armies[n];
      if (missing > 0) {
        this.reserve[n] += missing * REINFORCE_PER_TICK;
      } else if (missing < 0 && this.armies[n] > 0) {
        keep[n] = 1 + (missing / this.armies[n]) * DEMOBILIZE_PER_TICK;
        this.reserve[n] *= keep[n];
        shrinking = true;
      }
    }
    if (!shrinking) return;
    for (const front of this.fronts) {
      front.sides[0].force *= keep[front.a];
      front.sides[1].force *= keep[front.b];
    }
    for (const offensive of this.offensives) offensive.force *= keep[offensive.nation];
  }

  private updateOffensives(): void {
    const { owners, width: W, height: H } = this;
    for (let i = this.offensives.length - 1; i >= 0; i--) {
      const offensive = this.offensives[i];
      if (offensive.transitUntil > 0) {
        if (this.tick >= offensive.transitUntil) this.land(offensive);
        continue;
      }
      if (offensive.supplyCount > 0) {
        offensive.supply = offensive.supplySum / offensive.supplyCount;
        offensive.supplySum = 0;
        offensive.supplyCount = 0;
      }
      offensive.force *= 1 - OFFENSIVE_ATTRITION * (1 + OFFENSIVE_SUPPLY_ATTRITION * (1 - offensive.supply));
      offensive.stalledTicks++;
      const toY = Math.max(0, Math.min(H - 1, offensive.toY));
      const reached = owners[toY * W + offensive.toX] === offensive.nation;
      if (reached || offensive.force < OFFENSIVE_MIN_FORCE || offensive.stalledTicks > OFFENSIVE_STALL_TICKS) {
        this.endOffensive(offensive);
      }
    }
  }

  /** Arrivée d'un débarquement : tête de pont, puis couloir classique vers la cible. */
  private land(offensive: Offensive): void {
    const { owners, width: W, height: H } = this;
    const { landingX: x, landingY: y, nation } = offensive;
    const owner = owners[y * W + x];
    const front = this.frontOf(nation, owner);
    if (owner === nation || !front) {
      this.endOffensive(offensive);
      return;
    }
    offensive.force *= 1 - offensive.seaLoss;
    offensive.transitUntil = 0;
    offensive.stalledTicks = 0;

    const taken: number[] = [];
    for (let dy = -BEACHHEAD_RADIUS; dy <= BEACHHEAD_RADIUS; dy++) {
      for (let dx = -BEACHHEAD_RADIUS; dx <= BEACHHEAD_RADIUS; dx++) {
        if (dx * dx + dy * dy > BEACHHEAD_RADIUS * BEACHHEAD_RADIUS) continue;
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        const cell = ny * W + ((x + dx + W) % W);
        if (owners[cell] !== owner) continue;
        this.takeCell(cell, nation, owner);
        taken.push(cell);
      }
    }
    for (const cell of taken) this.refreshAround(cell);
    if (this.capacityDirty) this.recomputeCapacity();

    let dx = this.wrapDelta(x, offensive.targetX);
    let dy = offensive.targetY - y;
    const length = Math.hypot(dx, dy);
    if (length === 0 || this.owners[offensive.targetY * W + offensive.targetX] === nation) {
      this.endOffensive(offensive);
      return;
    }
    if (length > MAX_OFFENSIVE_LENGTH) {
      dx = Math.round((dx / length) * MAX_OFFENSIVE_LENGTH);
      dy = Math.round((dy / length) * MAX_OFFENSIVE_LENGTH);
    }
    offensive.fromX = x;
    offensive.fromY = y;
    offensive.dx = dx;
    offensive.dy = dy;
    offensive.toX = ((x + dx) % W + W) % W;
    offensive.toY = y + dy;
    offensive.lengthSquared = Math.max(1, dx * dx + dy * dy);
    this.supplyDirty = ALL_SUPPLY_GROUPS;
  }

  /**
   * Avantage de la meilleure offensive de `attacker` qui couvre cette cellule,
   * -Infinity si aucune. Laisse l'offensive retenue dans matchedOffensive.
   */
  private offensiveEdge(attacker: number, front: Front, x: number, y: number): number {
    let best = -Infinity;
    this.matchedOffensive = null;
    const own = front.a === attacker ? front.sides[0] : front.sides[1];
    const enemy = front.a === attacker ? front.sides[1] : front.sides[0];
    for (const offensive of this.offensivesByNation[attacker]) {
      if (offensive.transitUntil > 0) continue;
      const px = this.wrapDelta(offensive.fromX, x);
      const py = y - offensive.fromY;
      const t = Math.max(0, Math.min(1, (px * offensive.dx + py * offensive.dy) / offensive.lengthSquared));
      const ex = px - t * offensive.dx;
      const ey = py - t * offensive.dy;
      const squared = ex * ex + ey * ey;
      if (squared > OFFENSIVE_HALF_WIDTH * OFFENSIVE_HALF_WIDTH) continue;
      const pressure = own.rawDensity + offensive.force / (2 * OFFENSIVE_HALF_WIDTH);
      const depth = t * Math.sqrt(offensive.lengthSquared);
      const edge =
        Math.log((pressure + 1e-3) / (enemy.density + 1e-3)) -
        (Math.sqrt(squared) / OFFENSIVE_HALF_WIDTH) * OFFENSIVE_EDGE_FALLOFF -
        depth / OFFENSIVE_DEPTH_FADE;
      if (edge > best) {
        best = edge;
        this.matchedOffensive = offensive;
      }
    }
    return best;
  }

  private scanFrontier(): void {
    const { owners, width: W, height: H, stride, frontIndex, advantage, lengthCounts, supplySums, supply, sectors, sectorColumns, terrain, pocket, fronts, offensivesByNation, provinceHome, provinceGrid } = this;
    const list = this.frontier;
    const count = this.frontierCount;
    for (const front of fronts) {
      lengthCounts[front.a * stride + front.b] = 0;
      lengthCounts[front.b * stride + front.a] = 0;
      supplySums[front.a * stride + front.b] = 0;
      supplySums[front.b * stride + front.a] = 0;
      front.flipBudget = Math.min(MAX_FRONT_FLIP_BUDGET, front.flipBudget + MAX_FRONT_FLIPS_PER_TICK);
    }
    this.flipCount = 0;

    for (let i = 0; i < count; i++) {
      const cell = list[i];
      const defender = owners[cell];
      const x = cell % W;
      const y = (cell - x) / W;
      const i0 = x > 0 ? cell - 1 : cell + W - 1;
      const i1 = x < W - 1 ? cell + 1 : cell - W + 1;
      const n0 = owners[i0];
      const n1 = owners[i1];
      const n2 = y > 0 ? owners[cell - W] : 0;
      const n3 = y < H - 1 ? owners[cell + W] : 0;
      const sector = sectors[(y >> SECTOR_SHIFT) * sectorColumns + (x >> SECTOR_SHIFT)];
      const terrainId = terrain ? terrain[cell] : 0;
      const onHomeSoil = provinceHome[provinceGrid[cell]] === defender;
      const encircled = pocket[cell] === 1;
      // Un occupant mal ravitaillé défend mal. Une poche a déjà sa propre règle.
      const defenderSupply = SUPPLY_LEVELS[supply[cell]];
      const local =
        sector - TERRAIN_DEFENSE[terrainId] - (onHomeSoil ? HOME_DEFENSE : 0) + (encircled ? 0 : SUPPLY_DEFENSE_PENALTY * (1 - defenderSupply));

      let best = 0;
      let bestChance = 0;
      let bestOffensive: Offensive | null = null;
      for (let j = 0; j < 4; j++) {
        const attacker = j === 0 ? n0 : j === 1 ? n1 : j === 2 ? n2 : n3;
        if (attacker === 0 || attacker === defender) continue;
        if (j > 0 && attacker === n0) continue;
        if (j > 1 && attacker === n1) continue;
        if (j > 2 && attacker === n2) continue;
        const key = attacker * stride + defender;
        const index = frontIndex[key];
        if (index < 0) continue;
        lengthCounts[key]++;
        supplySums[key] += defenderSupply;
        // L'attaque part de la cellule voisine : c'est son ravitaillement qui compte.
        const from = j === 0 ? i0 : j === 1 ? i1 : j === 2 ? cell - W : cell + W;
        const attackerSupply = SUPPLY_LEVELS[supply[from]];

        let edge = advantage[key];
        let speed = 1;
        let matched: Offensive | null = null;
        if (offensivesByNation[attacker].length > 0) {
          const offensiveEdge = this.offensiveEdge(attacker, fronts[index], x, y);
          if (offensiveEdge > -Infinity) {
            matched = this.matchedOffensive!;
            matched.supplySum += attackerSupply;
            matched.supplyCount++;
            speed = OFFENSIVE_SPEED;
            if (offensiveEdge > edge) edge = offensiveEdge;
          }
        }
        edge -= SUPPLY_ATTACK_PENALTY * (1 - attackerSupply);
        if (encircled) {
          if (edge < POCKET_EDGE) edge = POCKET_EDGE;
          speed *= POCKET_SPEED;
        }
        edge += local;
        if (edge <= 0) continue;
        const neighbors = (n0 === attacker ? 1 : 0) + (n1 === attacker ? 1 : 0) + (n2 === attacker ? 1 : 0) + (n3 === attacker ? 1 : 0);
        const chance = MAX_FLIP_CHANCE * (1 - Math.exp(-FLIP_STEEPNESS * edge)) * NEIGHBOR_WEIGHT[neighbors] * speed * TERRAIN_SPEED[terrainId];
        if (chance > bestChance) {
          bestChance = chance;
          best = attacker;
          bestOffensive = matched;
        }
      }
      if (best !== 0 && this.random() < bestChance) {
        const front = fronts[frontIndex[best * stride + defender]];
        if (front.flipBudget < 1) continue;
        front.flipBudget--;
        if (this.flipCount === this.flipCells.length) this.growFlips();
        this.flipCells[this.flipCount] = cell;
        this.flipOwners[this.flipCount] = best;
        this.flipOffensives[this.flipCount] = bestOffensive ? bestOffensive.id : 0;
        this.flipCount++;
      }
    }

    for (const front of fronts) {
      const aFacesB = front.b * stride + front.a;
      const bFacesA = front.a * stride + front.b;
      front.length = (lengthCounts[bFacesA] + lengthCounts[aFacesB]) / 2;
      front.sides[0].supply = lengthCounts[aFacesB] > 0 ? supplySums[aFacesB] / lengthCounts[aFacesB] : 1;
      front.sides[1].supply = lengthCounts[bFacesA] > 0 ? supplySums[bFacesA] / lengthCounts[bFacesA] : 1;
    }
  }

  private growFlips(): void {
    const size = this.flipCells.length * 2;
    const cells = new Int32Array(size);
    cells.set(this.flipCells);
    this.flipCells = cells;
    const owners = new Uint16Array(size);
    owners.set(this.flipOwners);
    this.flipOwners = owners;
    const offensives = new Int32Array(size);
    offensives.set(this.flipOffensives);
    this.flipOffensives = offensives;
  }

  /** Une cellule change de camp. La frontière active est à rafraîchir ensuite. */
  private takeCell(cell: number, attacker: number, defender: number): Front | null {
    this.owners[cell] = attacker;
    this.pocket[cell] = 0;
    this.cellCounts[defender]--;
    this.cellCounts[attacker]++;
    this.pendingCells.push(cell);
    this.pendingOwners.push(attacker);
    this.transferProvinceCell(this.provinceGrid[cell], defender, attacker);
    const front = this.frontOf(attacker, defender);
    if (front) front.sides[front.a === attacker ? 0 : 1].captured++;
    return front;
  }

  private refreshAround(cell: number): void {
    const { width: W, height: H } = this;
    const x = cell % W;
    const y = (cell - x) / W;
    this.refreshFrontier(cell);
    this.refreshFrontier(x > 0 ? cell - 1 : cell + W - 1);
    this.refreshFrontier(x < W - 1 ? cell + 1 : cell - W + 1);
    if (y > 0) this.refreshFrontier(cell - W);
    if (y < H - 1) this.refreshFrontier(cell + W);
  }

  private applyFlips(): void {
    if (this.flipCount > 0) this.supplyDirty = ALL_SUPPLY_GROUPS;
    for (let i = 0; i < this.flipCount; i++) {
      const cell = this.flipCells[i];
      const attacker = this.flipOwners[i];
      const defender = this.owners[cell];
      const front = this.takeCell(cell, attacker, defender)!;

      const offensiveId = this.flipOffensives[i];
      if (offensiveId !== 0) {
        const offensive = this.offensivesByNation[attacker].find((entry) => entry.id === offensiveId);
        if (offensive) {
          const enemySide = front.sides[front.a === attacker ? 1 : 0];
          const cost = OFFENSIVE_CELL_BASE_COST + OFFENSIVE_CELL_COST * enemySide.density;
          offensive.force = Math.max(0, offensive.force - cost);
          offensive.captured++;
          offensive.stalledTicks = 0;
          enemySide.force = Math.max(0, enemySide.force - cost * OFFENSIVE_DEFENDER_LOSS);
        }
      }
    }
    for (let i = 0; i < this.flipCount; i++) this.refreshAround(this.flipCells[i]);
    if (this.capacityDirty) this.recomputeCapacity();
  }

  private transferProvinceCell(province: number, from: number, to: number): void {
    let counts = this.provinceCounts[province];
    if (!counts) {
      counts = new Map([[this.controller[province], this.provinceCells[province]]]);
      this.provinceCounts[province] = counts;
    }
    counts.set(from, (counts.get(from) ?? 0) - 1);
    const held = (counts.get(to) ?? 0) + 1;
    counts.set(to, held);
    if (held * 2 > this.provinceCells[province] && this.controller[province] !== to) {
      const previous = this.controller[province];
      const home = this.provinceHome[province];
      const value = this.provinceValue[province];
      if (previous === home) this.heldHome[home] -= value;
      if (to === home) this.heldHome[home] += value;
      // Les combats détruisent une part de l'industrie, à chaque changement de mains.
      // Une annexion se fait sans combat, donc sans destructions.
      if (!this.peacefulTransfer) {
        const damaged = this.development[province] * (1 - CAPTURE_DAMAGE);
        this.development[province] = Math.min(this.development[province], Math.max(MIN_DAMAGED_DEVELOPMENT, damaged));
      }
      this.controller[province] = to;
      this.consolidation[province] = 0;
      this.capacityDirty = true;
      this.pendingProvinces.push(province, to);
    }
  }

  // -------------------------------------------------------------------------
  // Ravitaillement : une partie du territoire coupée du reste et au contact d'un
  // ennemi est une poche. Elle s'effrite, même si l'ennemi ne fait que tenir.
  // -------------------------------------------------------------------------

  /** Un point d'ancrage par territoire d'origine : les exclaves restent ravitaillées. */
  private placeAnchors(): void {
    const { landCells, owners, visited, visitOrder } = this;
    visited.fill(0);
    let cursor = 0;
    for (let k = 0; k < landCells.length; k++) {
      const seed = landCells[k];
      if (visited[seed]) continue;
      const start = cursor;
      cursor = this.floodFill(seed, cursor, null);
      const anchor = visitOrder[start + ((cursor - start) >> 1)];
      this.isAnchor[anchor] = 1;
      this.anchorOwner.set(anchor, owners[seed]);
    }
    // Le contrôle des poches suppose un marquage vierge.
    visited.fill(0);
  }

  /**
   * Remplit la zone d'un même propriétaire. Les cellules sont écrites à la suite dans
   * visitOrder ; renvoie la fin de la zone. Si `flags` est fourni, il décrit la zone.
   */
  private floodFill(
    seed: number,
    begin: number,
    flags: { touchesEnemy: boolean; anchored: boolean; coastal: boolean } | null,
  ): number {
    const { owners, visited, visitOrder, width: W, height: H, frontIndex, stride, isAnchor, anchorOwner } = this;
    const owner = owners[seed];
    let head = begin;
    let tail = begin;
    visitOrder[tail++] = seed;
    visited[seed] = 1;
    while (head < tail) {
      const cell = visitOrder[head++];
      const x = cell % W;
      const y = (cell - x) / W;
      if (flags && isAnchor[cell] && anchorOwner.get(cell) === owner) flags.anchored = true;
      for (let j = 0; j < 4; j++) {
        let next: number;
        if (j === 0) next = x > 0 ? cell - 1 : cell + W - 1;
        else if (j === 1) next = x < W - 1 ? cell + 1 : cell - W + 1;
        else if (j === 2) {
          if (y === 0) continue;
          next = cell - W;
        } else {
          if (y === H - 1) continue;
          next = cell + W;
        }
        const other = owners[next];
        if (other === owner) {
          if (!visited[next]) {
            visited[next] = 1;
            visitOrder[tail++] = next;
          }
        } else if (flags) {
          if (other === 0) flags.coastal = true;
          else if (frontIndex[other * stride + owner] >= 0) flags.touchesEnemy = true;
        }
      }
    }
    return tail;
  }

  /** Poches et ravitaillement des nations d'un groupe (identifiant modulo SUPPLY_GROUPS). */
  private updateSupply(group: number): void {
    const { owners, landCells, visited, visitOrder, pocket, pocketCounts } = this;
    this.supplyDirty &= ~(1 << group);
    const inGroup = (nation: number) => nation % SUPPLY_GROUPS === group;

    const atWar = new Uint8Array(this.stride);
    const enemyNavy = new Float64Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
      enemyNavy[front.a] = Math.max(enemyNavy[front.a], this.navy[front.b]);
      enemyNavy[front.b] = Math.max(enemyNavy[front.b], this.navy[front.a]);
    }

    const pocketList: number[] = [];
    for (const cell of this.pocketLists[group]) pocket[cell] = 0;
    this.pocketLists[group] = pocketList;
    for (let n = group; n < this.stride; n += SUPPLY_GROUPS) pocketCounts[n] = 0;
    this.pockets = this.pockets.filter((entry) => !inGroup(entry.nation));

    // Nations de ce groupe en guerre : les seules dont les cellules comptent ici.
    const active = new Uint8Array(this.stride);
    for (let n = group; n < this.stride; n += SUPPLY_GROUPS) active[n] = atWar[n];
    const { provinceHome, provinceGrid } = this;
    const zones: { owner: number; start: number; end: number; touchesEnemy: boolean; anchored: boolean; coastal: boolean }[] = [];
    const largest = new Int32Array(this.stride);
    const occupied: number[] = [];
    let cursor = 0;
    // Un seul parcours de la terre : territoire conquis à ravitailler, et zones à remplir.
    for (let k = 0; k < landCells.length; k++) {
      const seed = landCells[k];
      const owner = owners[seed];
      if (active[owner] === 0) continue;
      if (provinceHome[provinceGrid[seed]] !== owner) occupied.push(seed);
      if (visited[seed]) continue;
      const flags = { touchesEnemy: false, anchored: false, coastal: false };
      const start = cursor;
      cursor = this.floodFill(seed, cursor, flags);
      zones.push({ owner, start, end: cursor, ...flags });
      if (cursor - start > largest[owner]) largest[owner] = cursor - start;
    }

    const mainClaimed = new Uint8Array(this.stride);
    for (const zone of zones) {
      const size = zone.end - zone.start;
      // La première zone de taille maximale est le cœur du pays.
      if (size === largest[zone.owner] && !mainClaimed[zone.owner]) {
        mainClaimed[zone.owner] = 1;
        continue;
      }
      if (zone.anchored || !zone.touchesEnemy) continue;
      // Par la mer : têtes de pont et côtes tiennent tant que la marine suit.
      const navy = this.navy[zone.owner];
      if (zone.coastal && navy > 0 && navy >= enemyNavy[zone.owner] * NAVAL_SUPPLY_RATIO) continue;
      let sumX = 0;
      let sumY = 0;
      const anchorX = visitOrder[zone.start] % this.width;
      for (let i = zone.start; i < zone.end; i++) {
        const cell = visitOrder[i];
        pocket[cell] = 1;
        pocketList.push(cell);
        const x = cell % this.width;
        sumX += this.wrapDelta(anchorX, x);
        sumY += (cell - x) / this.width;
      }
      if (size >= POCKET_MIN_CELLS_SHOWN) {
        pocketCounts[zone.owner] += size;
        this.pockets.push({
          nation: zone.owner,
          x: anchorX + sumX / size,
          y: sumY / size,
          cells: size,
        });
      }
    }

    // Le marquage de visite ne sert qu'à ce calcul : on l'efface derrière soi.
    for (let i = 0; i < cursor; i++) visited[visitOrder[i]] = 0;

    for (const front of this.fronts) {
      for (let s = 0; s < 2; s++) {
        const nation = s === 0 ? front.a : front.b;
        if (pocketCounts[nation] === 0 || !inGroup(nation)) continue;
        const share = pocketCounts[nation] / Math.max(1, this.cellCounts[nation]);
        front.sides[s].force *= 1 - share * POCKET_DRAIN;
      }
    }
    if (this.logisticsEnabled) this.updateLogistics(group, occupied, enemyNavy, pocketList);
  }

  /**
   * Ravitaillement du territoire conquis : distance au sol national de son occupant, en
   * coût de transport (terrain, infrastructure, consolidation), par l'algorithme de Dial.
   * Une côte conquise est aussi ravitaillée par la mer si la marine la tient. Une poche
   * n'est plus ravitaillée du tout.
   */
  private updateLogistics(group: number, occupied: number[], enemyNavy: Float64Array, pocketList: number[]): void {
    const { owners, provinceGrid, provinceHome, supply, supplyListed, supplyDistance: distance, terrain, width: W, height: H } = this;

    const provinceCost = new Float64Array(this.controller.length);
    for (let p = 1; p < provinceCost.length; p++) {
      const area = Math.max(1, this.provinces[p - 1].areaKm2);
      const density = Math.log10(Math.max(1e-6, (this.provinceGdp[p] * this.development[p]) / area));
      const wealth = Math.max(0, Math.min(1, (density + 1.5) / 3.5));
      const infrastructure = INFRASTRUCTURE_COST_MAX - (INFRASTRUCTURE_COST_MAX - INFRASTRUCTURE_COST_MIN) * wealth;
      provinceCost[p] = infrastructure * (1 - (1 - CONSOLIDATED_COST) * this.consolidation[p]);
    }
    // Coût de transport de chaque cellule conquise, en pas entiers.
    const cost = this.supplyCost;
    for (const cell of occupied) {
      distance[cell] = UNREACHED;
      const terrainCost = TERRAIN_SUPPLY_COST[terrain ? terrain[cell] : 0];
      cost[cell] = Math.max(1, Math.round(terrainCost * provinceCost[provinceGrid[cell]] * SUPPLY_COST_SCALE));
    }

    const maxDistance = (SUPPLY_FREE_RANGE + SUPPLY_FADE_RANGE) * SUPPLY_COST_SCALE;
    const buckets: number[][] = Array.from({ length: maxDistance + 1 }, () => []);
    const last = W * (H - 1);
    const seaStart = SEA_SUPPLY_COST * SUPPLY_COST_SCALE;
    // Points de départ : les cellules conquises au contact du sol national, ou d'une mer tenue.
    for (const cell of occupied) {
      const owner = owners[cell];
      const navalSupply = this.navy[owner] > 0 && this.navy[owner] >= enemyNavy[owner] * NAVAL_SUPPLY_RATIO;
      const x = cell % W;
      let start = Infinity;
      for (let j = 0; j < 4; j++) {
        const next = j === 0 ? (x > 0 ? cell - 1 : cell + W - 1) : j === 1 ? (x < W - 1 ? cell + 1 : cell - W + 1) : j === 2 ? cell - W : cell + W;
        if ((j === 2 && cell < W) || (j === 3 && cell >= last)) continue;
        const other = owners[next];
        if (other === owner && provinceHome[provinceGrid[next]] === owner) start = 0;
        else if (other === 0 && navalSupply && seaStart < start) start = seaStart;
      }
      if (start === Infinity) continue;
      const d = start + cost[cell];
      if (d <= maxDistance && d < distance[cell]) {
        distance[cell] = d;
        buckets[d].push(cell);
      }
    }
    for (let d = 0; d <= maxDistance; d++) {
      const bucket = buckets[d];
      for (let i = 0; i < bucket.length; i++) {
        const cell = bucket[i];
        if (distance[cell] !== d) continue;
        const owner = owners[cell];
        const x = cell % W;
        for (let j = 0; j < 4; j++) {
          if ((j === 2 && cell < W) || (j === 3 && cell >= last)) continue;
          const next = j === 0 ? (x > 0 ? cell - 1 : cell + W - 1) : j === 1 ? (x < W - 1 ? cell + 1 : cell - W + 1) : j === 2 ? cell - W : cell + W;
          // Seul le territoire conquis du même occupant prolonge le trajet.
          if (owners[next] !== owner || provinceHome[provinceGrid[next]] === owner) continue;
          const nd = d + cost[next];
          if (nd <= maxDistance && nd < distance[next]) {
            distance[next] = nd;
            buckets[nd].push(next);
          }
        }
      }
    }

    // Nouvelles valeurs, et retour au plein pour ce qui n'est plus occupé.
    const fresh: number[] = [];
    const write = (cell: number, value: number) => {
      if (supplyListed[cell] === 2) return;
      supplyListed[cell] = 2;
      fresh.push(cell);
      if (supply[cell] !== value) {
        supply[cell] = value;
        this.pendingSupplyCells.push(cell);
        this.pendingSupplyValues.push(value);
      }
    };
    for (const cell of pocketList) write(cell, 1);
    for (const cell of occupied) {
      const d = distance[cell] / SUPPLY_COST_SCALE;
      const level = distance[cell] === UNREACHED ? MIN_SUPPLY : d <= SUPPLY_FREE_RANGE ? 1 : Math.max(MIN_SUPPLY, 1 - ((d - SUPPLY_FREE_RANGE) / SUPPLY_FADE_RANGE) * (1 - MIN_SUPPLY));
      write(cell, 1 + Math.round(level * 254));
    }
    for (const cell of this.supplyList) {
      if (supplyListed[cell] === 2) continue;
      // Les cellules des autres groupes attendent leur tour, telles quelles.
      if (owners[cell] % SUPPLY_GROUPS !== group) {
        fresh.push(cell);
        continue;
      }
      supplyListed[cell] = 0;
      if (supply[cell] !== 0) {
        supply[cell] = 0;
        this.pendingSupplyCells.push(cell);
        this.pendingSupplyValues.push(0);
      }
    }
    for (const cell of fresh) supplyListed[cell] = 1;
    this.supplyList = fresh;
  }

  // -------------------------------------------------------------------------
  // Frontière active : seules les cellules touchant un ennemi sont calculées.
  // -------------------------------------------------------------------------

  private isFrontier(cell: number): boolean {
    const { owners, width: W, height: H, stride, frontIndex } = this;
    const owner = owners[cell];
    if (owner === 0) return false;
    const x = cell % W;
    const y = (cell - x) / W;
    const left = owners[x > 0 ? cell - 1 : cell + W - 1];
    if (left !== 0 && left !== owner && frontIndex[left * stride + owner] >= 0) return true;
    const right = owners[x < W - 1 ? cell + 1 : cell - W + 1];
    if (right !== 0 && right !== owner && frontIndex[right * stride + owner] >= 0) return true;
    if (y > 0) {
      const up = owners[cell - W];
      if (up !== 0 && up !== owner && frontIndex[up * stride + owner] >= 0) return true;
    }
    if (y < H - 1) {
      const down = owners[cell + W];
      if (down !== 0 && down !== owner && frontIndex[down * stride + owner] >= 0) return true;
    }
    return false;
  }

  private refreshFrontier(cell: number): void {
    const position = this.frontierPosition[cell];
    const should = this.isFrontier(cell);
    if (should && position < 0) {
      if (this.frontierCount === this.frontier.length) {
        const grown = new Int32Array(this.frontier.length * 2);
        grown.set(this.frontier);
        this.frontier = grown;
      }
      this.frontier[this.frontierCount] = cell;
      this.frontierPosition[cell] = this.frontierCount;
      this.frontierCount++;
    } else if (!should && position >= 0) {
      const last = this.frontier[--this.frontierCount];
      this.frontier[position] = last;
      this.frontierPosition[last] = position;
      this.frontierPosition[cell] = -1;
    }
  }

  // -------------------------------------------------------------------------
  // Sorties
  // -------------------------------------------------------------------------

  /** Tout ce qui a changé depuis le dernier appel. */
  drainChanges(): {
    cells: Uint32Array;
    owners: Uint16Array;
    provinces: Uint16Array;
    homes: Uint16Array;
    supplyCells: Uint32Array;
    supplyValues: Uint8Array;
    events: SimEvent[];
  } {
    const changes = {
      cells: Uint32Array.from(this.pendingCells),
      owners: Uint16Array.from(this.pendingOwners),
      provinces: Uint16Array.from(this.pendingProvinces),
      homes: Uint16Array.from(this.pendingHomes),
      supplyCells: Uint32Array.from(this.pendingSupplyCells),
      supplyValues: Uint8Array.from(this.pendingSupplyValues),
      events: this.pendingEvents,
    };
    this.pendingSupplyCells = [];
    this.pendingSupplyValues = [];
    this.pendingCells = [];
    this.pendingOwners = [];
    this.pendingProvinces = [];
    this.pendingHomes = [];
    this.pendingEvents = [];
    return changes;
  }

  /**
   * Nouvel emplacement du nom des nations dont le territoire a nettement changé.
   * Sans effet sur la partie : c'est de l'affichage.
   */
  updateLabels(): NationLabel[] {
    const changed: number[] = [];
    const updates: NationLabel[] = [];
    for (let n = 1; n < this.stride; n++) {
      if (this.labelCells[n] < 0) continue;
      if (!this.alive[n] || this.cellCounts[n] === 0) {
        this.labelCells[n] = -1;
        updates.push({ id: n, x: 0, y: 0, r: -1 });
      } else if (Math.abs(this.cellCounts[n] - this.labelCells[n]) > this.labelCells[n] * 0.05) {
        changed.push(n);
      }
    }
    if (changed.length === 0) return updates;

    const w = this.width >> 1;
    const h = this.height >> 1;
    const grid = new Uint16Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) grid[y * w + x] = this.owners[y * 2 * this.width + x * 2];
    }
    const distances = distanceToBoundary(grid, w, h);
    const best = new Float32Array(this.stride).fill(-1);
    const bestCell = new Int32Array(this.stride);
    for (let i = 0; i < grid.length; i++) {
      const owner = grid[i];
      if (owner !== 0 && distances[i] > best[owner]) {
        best[owner] = distances[i];
        bestCell[owner] = i;
      }
    }
    for (const n of changed) {
      if (best[n] < 0) continue;
      this.labelCells[n] = this.cellCounts[n];
      const x = bestCell[n] % w;
      updates.push({ id: n, x: x * 2, y: ((bestCell[n] - x) / w) * 2, r: best[n] * 2 });
    }
    return updates;
  }

  /** Économie de tout le monde, pour la carte économique et la fiche des pays. */
  economySnapshot(): EconomySnapshot {
    return {
      development: Float32Array.from(this.development),
      provinceGdp: Float32Array.from(this.provinceGdp),
      output: Float32Array.from(this.output),
      capacity: Float32Array.from(this.capacity),
      effort: Float32Array.from(this.effort),
      consolidation: Float32Array.from(this.consolidation),
    };
  }

  snapshot(): SimSnapshot {
    const fronts: FrontSnapshot[] = this.fronts.map((front) => {
      const side = (s: FrontSide) => ({ allocation: s.allocation, stance: s.stance, force: s.force, captured: s.captured, supply: s.supply });
      return {
        a: front.a,
        b: front.b,
        length: front.length,
        logRatio: front.logRatio,
        sides: [side(front.sides[0]), side(front.sides[1])],
      };
    });
    const participants = new Set<number>();
    if (this.player) participants.add(this.player);
    for (const front of this.fronts) {
      participants.add(front.a);
      participants.add(front.b);
    }
    return {
      tick: this.tick,
      frontierSize: this.frontierCount,
      aliveNations: this.aliveCount,
      fronts,
      nations: [...participants].map((id) => ({
        id,
        army: this.armyOf(id),
        reserve: this.reserve[id],
        capacity: this.capacity[id],
        cells: this.cellCounts[id],
        pocketCells: this.pocketCounts[id],
        navy: this.navy[id],
        output: this.output[id],
        effort: this.effort[id],
        effortTarget: this.effortTarget[id],
        growth: this.growth[id],
      })),
      offensives: this.offensives.map(({ id, nation, fromX, fromY, toX, toY, force, startForce, captured, transitUntil, targetX, targetY, supply }) => ({
        id,
        nation,
        fromX,
        fromY,
        toX: transitUntil > 0 ? targetX : toX,
        toY: transitUntil > 0 ? targetY : toY,
        force,
        startForce,
        captured,
        inTransit: transitUntil > 0,
        supply,
      })),
      pockets: this.pockets,
    };
  }

  // -------------------------------------------------------------------------
  // Sauvegarde : tout ce qui n'est pas déductible de la carte de départ.
  // -------------------------------------------------------------------------

  save(): SimSave {
    return {
      owners: this.owners.slice(),
      supply: this.supply.slice(),
      state: {
        tick: this.tick,
        rngState: this.rngState,
        player: this.player,
        nextOffensiveId: this.nextOffensiveId,
        supplyDirty: this.supplyDirty,
        fronts: this.fronts.map((front) => ({ ...front, sides: front.sides.map((side) => ({ ...side })) })),
        offensives: this.offensives.map((offensive) => ({ ...offensive })),
        frontier: Array.from(this.frontier.subarray(0, this.frontierCount)),
        sectors: Array.from(this.sectors),
        reserve: Array.from(this.reserve),
        capacity: Array.from(this.capacity),
        cellCounts: Array.from(this.cellCounts),
        navy: Array.from(this.navy),
        alive: Array.from(this.alive),
        heldHome: Array.from(this.heldHome),
        totalHome: Array.from(this.totalHome),
        provinceHome: Array.from(this.provinceHome),
        provinceValue: Array.from(this.provinceValue),
        controller: Array.from(this.controller),
        provinceCounts: this.provinceCounts.map((counts) => (counts ? [...counts] : null)),
        pocketLists: this.pocketLists.map((list) => list.slice()),
        pocketCounts: Array.from(this.pocketCounts),
        pockets: this.pockets.map((pocket) => ({ ...pocket })),
        landNeighbors: this.landNeighbors,
        seaNeighbors: this.seaNeighbors,
        labelCells: Array.from(this.labelCells),
        provinceGdp: Array.from(this.provinceGdp),
        development: Array.from(this.development),
        effort: Array.from(this.effort),
        effortTarget: Array.from(this.effortTarget),
        growth: Array.from(this.growth),
        consolidation: Array.from(this.consolidation),
      },
    };
  }

  private restore(saved: SimSave): void {
    const { state } = saved;
    this.owners.set(saved.owners);
    this.tick = state.tick;
    this.rngState = state.rngState;
    this.nextOffensiveId = state.nextOffensiveId;
    this.supplyDirty = state.supplyDirty;
    this.sectors.set(state.sectors);
    this.reserve.set(state.reserve);
    this.capacity.set(state.capacity);
    this.cellCounts.set(state.cellCounts);
    this.navy.set(state.navy);
    this.alive.set(state.alive);
    this.heldHome.set(state.heldHome);
    this.totalHome.set(state.totalHome);
    this.provinceHome.set(state.provinceHome);
    this.provinceValue.set(state.provinceValue);
    this.controller.set(state.controller);
    state.provinceCounts.forEach((counts, province) => {
      this.provinceCounts[province] = counts ? new Map(counts) : null;
    });
    this.pocketCounts.set(state.pocketCounts);
    this.pockets = state.pockets;
    this.pocketLists = state.pocketLists.map((list) => list.slice());
    for (const list of this.pocketLists) for (const cell of list) this.pocket[cell] = 1;
    this.landNeighbors = state.landNeighbors;
    this.seaNeighbors = state.seaNeighbors;
    this.labelCells.set(state.labelCells);
    this.provinceGdp.set(state.provinceGdp);
    this.development.set(state.development);
    this.effort.set(state.effort);
    this.effortTarget.set(state.effortTarget);
    this.growth.set(state.growth);
    this.consolidation.set(state.consolidation);
    this.recomputeCapacity();
    // Le ravitaillement repart tel quel : le recalculer ici changerait la suite de la partie.
    this.supply.set(saved.supply);
    for (let k = 0; k < this.landCells.length; k++) {
      const cell = this.landCells[k];
      if (this.supply[cell] === 0) continue;
      this.supplyList.push(cell);
      this.supplyListed[cell] = 1;
      this.pendingSupplyCells.push(cell);
      this.pendingSupplyValues.push(this.supply[cell]);
    }

    this.fronts = state.fronts.map((front) => ({ ...front, sides: front.sides.map((side) => ({ ...side })) }));
    this.reindexFronts();
    for (const offensive of state.offensives) {
      const copy = { ...offensive };
      this.offensives.push(copy);
      this.offensivesByNation[copy.nation].push(copy);
    }

    // L'ordre de la frontière fixe l'ordre des tirages au sort : il est conservé.
    if (state.frontier.length > this.frontier.length) this.frontier = new Int32Array(state.frontier.length * 2);
    state.frontier.forEach((cell, index) => {
      this.frontier[index] = cell;
      this.frontierPosition[cell] = index;
    });
    this.frontierCount = state.frontier.length;
  }

  /** Empreinte de l'état complet, pour vérifier le déterminisme. */
  stateHash(): number {
    let hash = 2166136261;
    const mix = (value: number) => {
      hash = Math.imul(hash ^ value, 16777619) >>> 0;
    };
    for (let i = 0; i < this.owners.length; i++) mix(this.owners[i]);
    for (const front of this.fronts) {
      mix(Math.round(front.sides[0].force * 1000));
      mix(Math.round(front.sides[1].force * 1000));
    }
    for (const offensive of this.offensives) mix(Math.round(offensive.force * 1000));
    for (let n = 1; n < this.stride; n++) {
      mix(Math.round(this.reserve[n] * 1000));
      mix(Math.round(this.effort[n] * 1e6));
    }
    for (let p = 1; p < this.development.length; p++) {
      mix(Math.round(this.development[p] * 1e6));
      mix(Math.round(this.consolidation[p] * 1e6));
    }
    // Somme commutative : l'ordre de la liste ne change rien à la partie.
    let supplySum = 0;
    for (const cell of this.supplyList) supplySum = (supplySum + Math.imul(cell + 1, 2654435761) + this.supply[cell]) >>> 0;
    mix(supplySum);
    mix(this.rngState);
    return hash;
  }
}
