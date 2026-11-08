// Cœur de la simulation : aucune dépendance au navigateur, à l'horloge ou à
// Math.random. Mêmes données, même graine et mêmes ordres donnent la même partie.
import {
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
  ATTRITION_PER_TICK,
  DEFAULT_ALLOCATION,
  DEFENSE_MULTIPLIER,
  FLIP_STEEPNESS,
  HOME_DEFENSE,
  INITIAL_MOBILIZATION,
  LOSS_MULTIPLIER,
  LOST_PROVINCE_RETAINED,
  MAX_FLIP_CHANCE,
  MAX_OFFENSIVES_PER_NATION,
  MAX_OFFENSIVE_LENGTH,
  MIN_FRONT_LENGTH,
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
  POCKET_DRAIN,
  POCKET_EDGE,
  POCKET_MIN_CELLS_SHOWN,
  POCKET_SPEED,
  REINFORCE_PER_TICK,
  RETREAT_ADVANTAGE,
  SECTOR_CHURN,
  SECTOR_NOISE,
  SECTOR_SHIFT,
  SUPPLY_INTERVAL_TICKS,
  TERRAIN_DEFENSE,
  TERRAIN_SPEED,
  TRANSFER_RATE,
  baseCapacity,
} from './balance.ts';
import type { FrontSnapshot, PocketSnapshot, SimCommand, SimSnapshot, Stance } from './protocol.ts';

export interface SimConfig {
  width: number;
  height: number;
  nations: { population: number; gdpMusd: number }[];
  /** Le propriétaire initial d'une province est `nation + 1`. */
  provinces: { nation: number; areaKm2: number; x: number; y: number }[];
  provinceGrid: Uint16Array;
  /** Copiée : la simulation possède sa propre grille. */
  ownerGrid: Uint16Array;
  /** Plaine partout si absente. */
  terrainGrid?: Uint8Array;
  seed: number;
  /** Nation pilotée par le joueur (0 si toutes sont pilotées par l'IA). */
  player: number;
  /** Faux : les autres nations n'agissent que sur ordre (utile pour les tests). */
  ai?: boolean;
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
}

interface Front {
  a: number;
  b: number;
  sides: [FrontSide, FrontSide];
  length: number;
  logRatio: number;
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
}

const INITIAL_LIST_CAPACITY = 1 << 14;

export class Simulation {
  readonly width: number;
  readonly height: number;
  readonly owners: Uint16Array;
  readonly provinceGrid: Uint16Array;
  readonly player: number;
  tick = 0;

  private readonly stride: number;
  private readonly nationCount: number;
  private readonly aiEnabled: boolean;
  private rngState: number;
  private readonly terrain: Uint8Array | null;

  readonly fronts: Front[] = [];
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

  private readonly provinces: SimConfig['provinces'];
  private readonly provinceHome: Uint16Array;
  private readonly provinceCells: Int32Array;
  private readonly provinceValue: Float64Array;
  private readonly controller: Uint16Array;
  private readonly provinceCounts: (Map<number, number> | null)[];

  // Ravitaillement.
  private readonly landCells: Int32Array;
  private readonly visited: Uint8Array;
  private readonly visitOrder: Int32Array;
  private readonly pocket: Uint8Array;
  private pocketList: number[] = [];
  private readonly pocketCounts: Int32Array;
  private pockets: PocketSnapshot[] = [];
  /** Cellule d'ancrage par territoire d'origine : l'Alaska n'est pas une poche. */
  private readonly anchorOwner = new Map<number, number>();
  private readonly isAnchor: Uint8Array;
  private supplyDirty = false;

  private flipCells: Int32Array = new Int32Array(1024);
  private flipOwners: Uint16Array = new Uint16Array(1024);
  private flipOffensives: Int32Array = new Int32Array(1024);
  private flipCount = 0;
  private pendingCells: number[] = [];
  private pendingOwners: number[] = [];
  private pendingProvinces: number[] = [];

  constructor(config: SimConfig) {
    this.width = config.width;
    this.height = config.height;
    this.owners = config.ownerGrid.slice();
    this.provinceGrid = config.provinceGrid;
    this.terrain = config.terrainGrid ?? null;
    this.player = config.player;
    this.aiEnabled = config.ai ?? true;
    this.rngState = config.seed >>> 0 || 1;
    this.provinces = config.provinces;

    this.nationCount = config.nations.length;
    this.stride = this.nationCount + 1;
    const pairs = this.stride * this.stride;
    this.frontIndex = new Int32Array(pairs).fill(-1);
    this.advantage = new Float32Array(pairs).fill(-Infinity);
    this.lengthCounts = new Int32Array(pairs);
    this.frontierPosition = new Int32Array(this.owners.length).fill(-1);
    this.offensivesByNation = Array.from({ length: this.stride }, () => []);

    this.sectorColumns = (this.width >> SECTOR_SHIFT) + 1;
    const sectorRows = (this.height >> SECTOR_SHIFT) + 1;
    this.sectors = new Float32Array(this.sectorColumns * sectorRows);
    for (let i = 0; i < this.sectors.length; i++) this.sectors[i] = (this.random() * 2 - 1) * SECTOR_NOISE;

    const provinceCount = config.provinces.length + 1;
    this.provinceHome = new Uint16Array(provinceCount);
    this.provinceCells = new Int32Array(provinceCount);
    this.provinceValue = new Float64Array(provinceCount);
    this.controller = new Uint16Array(provinceCount);
    this.provinceCounts = new Array(provinceCount).fill(null);

    this.reserve = new Float64Array(this.stride);
    this.capacity = new Float64Array(this.stride);
    this.cellCounts = new Int32Array(this.stride);
    this.armies = new Float64Array(this.stride);
    this.pocketCounts = new Int32Array(this.stride);

    let land = 0;
    for (let i = 0; i < this.owners.length; i++) {
      this.cellCounts[this.owners[i]]++;
      this.provinceCells[this.provinceGrid[i]]++;
      if (this.owners[i] !== 0) land++;
    }
    this.landCells = new Int32Array(land);
    for (let i = 0, k = 0; i < this.owners.length; i++) {
      if (this.owners[i] !== 0) this.landCells[k++] = i;
    }
    this.visited = new Uint8Array(this.owners.length);
    this.visitOrder = new Int32Array(land);
    this.pocket = new Uint8Array(this.owners.length);
    this.isAnchor = new Uint8Array(this.owners.length);
    this.placeAnchors();

    // La capacité militaire se répartit entre les provinces (racine de la surface
    // pour ne pas tout donner aux déserts) : elle change de camp avec elles.
    const weights = new Float64Array(this.stride);
    config.provinces.forEach((province, index) => {
      this.provinceHome[index + 1] = province.nation + 1;
      this.controller[index + 1] = province.nation + 1;
      weights[province.nation + 1] += Math.sqrt(province.areaKm2);
    });
    config.provinces.forEach((province, index) => {
      const owner = province.nation + 1;
      const nation = config.nations[province.nation];
      const value = (baseCapacity(nation.population, nation.gdpMusd) * Math.sqrt(province.areaKm2)) / weights[owner];
      this.provinceValue[index + 1] = value;
      this.capacity[owner] += value;
    });
    for (let n = 1; n < this.stride; n++) this.reserve[n] = this.capacity[n] * INITIAL_MOBILIZATION;
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

  controllerOf(province: number): number {
    return this.controller[province];
  }

  isPocket(cell: number): boolean {
    return this.pocket[cell] === 1;
  }

  get frontierSize(): number {
    return this.frontierCount;
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
    }
  }

  declareWars(pairs: [number, number][]): void {
    let added = false;
    for (const [x, y] of pairs) {
      if (x === y || x <= 0 || y <= 0 || this.frontOf(x, y)) continue;
      const a = Math.min(x, y);
      const b = Math.max(x, y);
      const side = (): FrontSide => ({ allocation: 0, stance: 'hold', force: 0, captured: 0, rawDensity: 0, density: 0 });
      const index = this.fronts.push({ a, b, sides: [side(), side()], length: 0, logRatio: 0 }) - 1;
      this.frontIndex[a * this.stride + b] = index;
      this.frontIndex[b * this.stride + a] = index;
      added = true;
    }
    if (!added) return;
    this.rebuildFrontier();
    this.supplyDirty = true;
    if (this.player) {
      for (const front of this.fronts) {
        const side = front.a === this.player ? front.sides[0] : front.b === this.player ? front.sides[1] : null;
        if (side && side.allocation === 0) {
          const enemy = front.a === this.player ? front.b : front.a;
          this.setFront(this.player, enemy, DEFAULT_ALLOCATION, side.stance);
        }
      }
    }
    if (this.aiEnabled) this.decideAllocations();
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
   * Engage une part de la réserve dans un couloir. Le départ doit être sur le
   * territoire de la nation. Renvoie l'identifiant, ou 0 si l'offensive est refusée.
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
    if (length > MAX_OFFENSIVE_LENGTH) {
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
    };
    this.offensives.push(offensive);
    list.push(offensive);
    return offensive.id;
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
    if (this.aiEnabled && this.tick % AI_INTERVAL_TICKS === 0) {
      this.decideAllocations();
      this.decideOffensives();
    }
    this.computeArmies();
    this.updateFronts();
    this.reinforce();
    this.updateOffensives();
    this.scanFrontier();
    this.applyFlips();
    if (this.tick % SUPPLY_INTERVAL_TICKS === 0 && this.supplyDirty) this.updateSupply();
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

  private decideOffensives(): void {
    if (this.frontierCount === 0) return;
    const attempted = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      if (front.length === 0) continue;
      for (const nation of [front.a, front.b]) {
        if (nation === this.player || attempted[nation]) continue;
        attempted[nation] = 1;
        if (this.random() >= AI_OFFENSIVE_CHANCE) continue;
        if (this.offensivesByNation[nation].length >= AI_MAX_OFFENSIVES) continue;
        if (this.reserve[nation] < this.armyOf(nation) * AI_OFFENSIVE_MIN_RESERVE) continue;
        this.launchAiOffensive(nation);
      }
    }
  }

  /** Part d'une cellule de front au hasard, vers une province ennemie de valeur à portée. */
  private launchAiOffensive(nation: number): void {
    const { owners, width: W, height: H } = this;
    for (let attempt = 0; attempt < 24; attempt++) {
      const cell = this.frontier[Math.floor(this.random() * this.frontierCount)];
      if (owners[cell] !== nation) continue;
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

  private reinforce(): void {
    this.computeArmies();
    for (let n = 1; n < this.stride; n++) {
      const missing = this.capacity[n] - this.armies[n];
      if (missing > 0) this.reserve[n] += missing * REINFORCE_PER_TICK;
    }
  }

  private updateOffensives(): void {
    const { owners, width: W } = this;
    for (let i = this.offensives.length - 1; i >= 0; i--) {
      const offensive = this.offensives[i];
      offensive.force *= 1 - OFFENSIVE_ATTRITION;
      offensive.stalledTicks++;
      const reached = owners[offensive.toY * W + offensive.toX] === offensive.nation;
      if (reached || offensive.force < OFFENSIVE_MIN_FORCE || offensive.stalledTicks > OFFENSIVE_STALL_TICKS) {
        this.endOffensive(offensive);
      }
    }
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
    const { owners, width: W, height: H, stride, frontIndex, advantage, lengthCounts, sectors, sectorColumns, terrain, pocket, fronts, offensivesByNation, provinceHome, provinceGrid } = this;
    const list = this.frontier;
    const count = this.frontierCount;
    for (const front of fronts) {
      lengthCounts[front.a * stride + front.b] = 0;
      lengthCounts[front.b * stride + front.a] = 0;
    }
    this.flipCount = 0;

    for (let i = 0; i < count; i++) {
      const cell = list[i];
      const defender = owners[cell];
      const x = cell % W;
      const y = (cell - x) / W;
      const n0 = owners[x > 0 ? cell - 1 : cell + W - 1];
      const n1 = owners[x < W - 1 ? cell + 1 : cell - W + 1];
      const n2 = y > 0 ? owners[cell - W] : 0;
      const n3 = y < H - 1 ? owners[cell + W] : 0;
      const sector = sectors[(y >> SECTOR_SHIFT) * sectorColumns + (x >> SECTOR_SHIFT)];
      const terrainId = terrain ? terrain[cell] : 0;
      const onHomeSoil = provinceHome[provinceGrid[cell]] === defender;
      const local = sector - TERRAIN_DEFENSE[terrainId] - (onHomeSoil ? HOME_DEFENSE : 0);
      const encircled = pocket[cell] === 1;

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

        let edge = advantage[key];
        let speed = 1;
        let matched: Offensive | null = null;
        if (offensivesByNation[attacker].length > 0) {
          const offensiveEdge = this.offensiveEdge(attacker, fronts[index], x, y);
          if (offensiveEdge > -Infinity) {
            matched = this.matchedOffensive;
            speed = OFFENSIVE_SPEED;
            if (offensiveEdge > edge) edge = offensiveEdge;
          }
        }
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
        if (this.flipCount === this.flipCells.length) this.growFlips();
        this.flipCells[this.flipCount] = cell;
        this.flipOwners[this.flipCount] = best;
        this.flipOffensives[this.flipCount] = bestOffensive ? bestOffensive.id : 0;
        this.flipCount++;
      }
    }

    for (const front of fronts) {
      front.length = (lengthCounts[front.a * stride + front.b] + lengthCounts[front.b * stride + front.a]) / 2;
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

  private applyFlips(): void {
    const { owners, width: W, height: H } = this;
    if (this.flipCount > 0) this.supplyDirty = true;
    for (let i = 0; i < this.flipCount; i++) {
      const cell = this.flipCells[i];
      const attacker = this.flipOwners[i];
      const defender = owners[cell];
      owners[cell] = attacker;
      this.pocket[cell] = 0;
      this.cellCounts[defender]--;
      this.cellCounts[attacker]++;
      this.pendingCells.push(cell);
      this.pendingOwners.push(attacker);

      const front = this.frontOf(attacker, defender)!;
      const attackerIndex = front.a === attacker ? 0 : 1;
      front.sides[attackerIndex].captured++;
      this.transferProvinceCell(this.provinceGrid[cell], defender, attacker);

      const offensiveId = this.flipOffensives[i];
      if (offensiveId !== 0) {
        const offensive = this.offensivesByNation[attacker].find((entry) => entry.id === offensiveId);
        if (offensive) {
          const enemySide = front.sides[1 - attackerIndex];
          const cost = OFFENSIVE_CELL_BASE_COST + OFFENSIVE_CELL_COST * enemySide.density;
          offensive.force = Math.max(0, offensive.force - cost);
          offensive.captured++;
          offensive.stalledTicks = 0;
          enemySide.force = Math.max(0, enemySide.force - cost * OFFENSIVE_DEFENDER_LOSS);
        }
      }
    }
    for (let i = 0; i < this.flipCount; i++) {
      const cell = this.flipCells[i];
      const x = cell % W;
      const y = (cell - x) / W;
      this.refreshFrontier(cell);
      this.refreshFrontier(x > 0 ? cell - 1 : cell + W - 1);
      this.refreshFrontier(x < W - 1 ? cell + 1 : cell - W + 1);
      if (y > 0) this.refreshFrontier(cell - W);
      if (y < H - 1) this.refreshFrontier(cell + W);
    }
  }

  private transferProvinceCell(province: number, from: number, to: number): void {
    let counts = this.provinceCounts[province];
    if (!counts) {
      counts = new Map([[this.provinceHome[province], this.provinceCells[province]]]);
      this.provinceCounts[province] = counts;
    }
    counts.set(from, (counts.get(from) ?? 0) - 1);
    const held = (counts.get(to) ?? 0) + 1;
    counts.set(to, held);
    if (held * 2 > this.provinceCells[province] && this.controller[province] !== to) {
      const previous = this.controller[province];
      const home = this.provinceHome[province];
      const retained = this.provinceValue[province] * LOST_PROVINCE_RETAINED;
      this.capacity[previous] -= this.provinceWorth(province, previous);
      this.capacity[to] += this.provinceWorth(province, to);
      // Le pays d'origine garde une part de la valeur tant que la province est perdue.
      if (previous === home) this.capacity[home] += retained;
      if (to === home) this.capacity[home] -= retained;
      this.controller[province] = to;
      this.pendingProvinces.push(province, to);
    }
  }

  private provinceWorth(province: number, holder: number): number {
    const value = this.provinceValue[province];
    return holder === this.provinceHome[province] ? value : value * OCCUPIED_VALUE;
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
  }

  /**
   * Remplit la zone d'un même propriétaire. Les cellules sont écrites à la suite dans
   * visitOrder ; renvoie la fin de la zone. Si `flags` est fourni, flags.touchesEnemy
   * et flags.anchored décrivent la zone.
   */
  private floodFill(seed: number, begin: number, flags: { touchesEnemy: boolean; anchored: boolean } | null): number {
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
        } else if (flags && other !== 0 && frontIndex[other * stride + owner] >= 0) {
          flags.touchesEnemy = true;
        }
      }
    }
    return tail;
  }

  private updateSupply(): void {
    const { owners, landCells, visited, visitOrder, pocket, pocketCounts } = this;
    this.supplyDirty = false;

    const atWar = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
    }

    for (const cell of this.pocketList) pocket[cell] = 0;
    this.pocketList = [];
    pocketCounts.fill(0);
    this.pockets = [];
    visited.fill(0);

    const zones: { owner: number; start: number; end: number; touchesEnemy: boolean; anchored: boolean }[] = [];
    const largest = new Int32Array(this.stride);
    let cursor = 0;
    for (let k = 0; k < landCells.length; k++) {
      const seed = landCells[k];
      const owner = owners[seed];
      if (visited[seed] || !atWar[owner]) continue;
      const flags = { touchesEnemy: false, anchored: false };
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
      let sumX = 0;
      let sumY = 0;
      const anchorX = visitOrder[zone.start] % this.width;
      for (let i = zone.start; i < zone.end; i++) {
        const cell = visitOrder[i];
        pocket[cell] = 1;
        this.pocketList.push(cell);
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

    for (const front of this.fronts) {
      for (let s = 0; s < 2; s++) {
        const nation = s === 0 ? front.a : front.b;
        if (pocketCounts[nation] === 0) continue;
        const share = pocketCounts[nation] / Math.max(1, this.cellCounts[nation]);
        front.sides[s].force *= 1 - share * POCKET_DRAIN;
      }
    }
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

  private rebuildFrontier(): void {
    for (let k = 0; k < this.landCells.length; k++) this.refreshFrontier(this.landCells[k]);
  }

  // -------------------------------------------------------------------------
  // Sorties
  // -------------------------------------------------------------------------

  /** Cellules et provinces modifiées depuis le dernier appel. */
  drainChanges(): { cells: Uint32Array; owners: Uint16Array; provinces: Uint16Array } {
    const changes = {
      cells: Uint32Array.from(this.pendingCells),
      owners: Uint16Array.from(this.pendingOwners),
      provinces: Uint16Array.from(this.pendingProvinces),
    };
    this.pendingCells = [];
    this.pendingOwners = [];
    this.pendingProvinces = [];
    return changes;
  }

  snapshot(): SimSnapshot {
    const fronts: FrontSnapshot[] = this.fronts.map((front) => {
      const side = (s: FrontSide) => ({ allocation: s.allocation, stance: s.stance, force: s.force, captured: s.captured });
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
      fronts,
      nations: [...participants].map((id) => ({
        id,
        army: this.armyOf(id),
        reserve: this.reserve[id],
        capacity: this.capacity[id],
        cells: this.cellCounts[id],
        pocketCells: this.pocketCounts[id],
      })),
      offensives: this.offensives.map(({ id, nation, fromX, fromY, toX, toY, force, startForce, captured }) => ({
        id, nation, fromX, fromY, toX, toY, force, startForce, captured,
      })),
      pockets: this.pockets,
    };
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
    mix(this.rngState);
    return hash;
  }
}
