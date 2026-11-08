// Cœur de la simulation : aucune dépendance au navigateur, à l'horloge ou à
// Math.random. Mêmes données, même graine et mêmes ordres donnent la même partie.
import {
  AI_ATTACK_RATIO,
  AI_ENGAGED_SHARE,
  AI_INTERVAL_TICKS,
  ATTRITION_PER_TICK,
  DEFAULT_ALLOCATION,
  DEFENSE_MULTIPLIER,
  FLIP_STEEPNESS,
  INITIAL_MOBILIZATION,
  LOSS_MULTIPLIER,
  MAX_FLIP_CHANCE,
  MIN_FRONT_LENGTH,
  NEIGHBOR_WEIGHT,
  OCCUPIED_VALUE,
  REINFORCE_PER_TICK,
  RETREAT_ADVANTAGE,
  SECTOR_CHURN,
  SECTOR_NOISE,
  SECTOR_SHIFT,
  TRANSFER_RATE,
  baseCapacity,
} from './balance.ts';
import type { FrontSnapshot, SimCommand, SimSnapshot, Stance } from './protocol.ts';

export interface SimConfig {
  width: number;
  height: number;
  nations: { population: number; gdpMusd: number }[];
  /** Le propriétaire initial d'une province est `nation + 1`. */
  provinces: { nation: number; areaKm2: number }[];
  provinceGrid: Uint16Array;
  /** Copiée : la simulation possède sa propre grille. */
  ownerGrid: Uint16Array;
  seed: number;
  /** Nation pilotée par le joueur (0 si toutes sont pilotées par l'IA). */
  player: number;
}

interface FrontSide {
  allocation: number;
  stance: Stance;
  force: number;
  captured: number;
}

interface Front {
  a: number;
  b: number;
  sides: [FrontSide, FrontSide];
  length: number;
  logRatio: number;
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
  private rngState: number;

  readonly fronts: Front[] = [];
  private readonly frontIndex: Int32Array;
  private readonly advantage: Float32Array;
  private readonly lengthCounts: Int32Array;

  private frontier: Int32Array = new Int32Array(INITIAL_LIST_CAPACITY);
  private frontierCount = 0;
  private readonly frontierPosition: Int32Array;

  private readonly sectors: Float32Array;
  private readonly sectorColumns: number;

  private readonly reserve: Float64Array;
  private readonly capacity: Float64Array;
  private readonly cellCounts: Int32Array;

  private readonly provinceHome: Uint16Array;
  private readonly provinceCells: Int32Array;
  private readonly provinceValue: Float64Array;
  private readonly controller: Uint16Array;
  private readonly provinceCounts: (Map<number, number> | null)[];

  private flipCells: Int32Array = new Int32Array(1024);
  private flipOwners: Uint16Array = new Uint16Array(1024);
  private flipCount = 0;
  private pendingCells: number[] = [];
  private pendingOwners: number[] = [];
  private pendingProvinces: number[] = [];

  constructor(config: SimConfig) {
    this.width = config.width;
    this.height = config.height;
    this.owners = config.ownerGrid.slice();
    this.provinceGrid = config.provinceGrid;
    this.player = config.player;
    this.rngState = config.seed >>> 0 || 1;

    this.nationCount = config.nations.length;
    this.stride = this.nationCount + 1;
    const pairs = this.stride * this.stride;
    this.frontIndex = new Int32Array(pairs).fill(-1);
    this.advantage = new Float32Array(pairs).fill(-Infinity);
    this.lengthCounts = new Int32Array(pairs);
    this.frontierPosition = new Int32Array(this.owners.length).fill(-1);

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
    for (let i = 0; i < this.owners.length; i++) {
      this.cellCounts[this.owners[i]]++;
      this.provinceCells[this.provinceGrid[i]]++;
    }

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

  /** Total d'une nation : réserve et forces engagées. */
  armyOf(nation: number): number {
    let total = this.reserve[nation];
    for (const front of this.fronts) {
      if (front.a === nation) total += front.sides[0].force;
      else if (front.b === nation) total += front.sides[1].force;
    }
    return total;
  }

  cellsOf(nation: number): number {
    return this.cellCounts[nation];
  }

  controllerOf(province: number): number {
    return this.controller[province];
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
    }
  }

  declareWars(pairs: [number, number][]): void {
    let added = false;
    for (const [x, y] of pairs) {
      if (x === y || x <= 0 || y <= 0 || this.frontOf(x, y)) continue;
      const a = Math.min(x, y);
      const b = Math.max(x, y);
      const side = (): FrontSide => ({ allocation: 0, stance: 'hold', force: 0, captured: 0 });
      const index = this.fronts.push({ a, b, sides: [side(), side()], length: 0, logRatio: 0 }) - 1;
      this.frontIndex[a * this.stride + b] = index;
      this.frontIndex[b * this.stride + a] = index;
      added = true;
    }
    if (!added) return;
    this.rebuildFrontier();
    if (this.player) {
      for (const front of this.fronts) {
        const side = front.a === this.player ? front.sides[0] : front.b === this.player ? front.sides[1] : null;
        if (side && side.allocation === 0) {
          const enemy = front.a === this.player ? front.b : front.a;
          this.setFront(this.player, enemy, DEFAULT_ALLOCATION, side.stance);
        }
      }
    }
    this.runAi();
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

  // -------------------------------------------------------------------------
  // Tick
  // -------------------------------------------------------------------------

  step(): void {
    this.tick++;
    this.evolveSectors();
    if (this.tick % AI_INTERVAL_TICKS === 0) this.runAi();
    this.updateFronts();
    this.reinforce();
    this.scanFrontier();
    this.applyFlips();
  }

  private evolveSectors(): void {
    const changes = Math.ceil(this.sectors.length * SECTOR_CHURN);
    for (let i = 0; i < changes; i++) {
      const sector = Math.floor(this.random() * this.sectors.length);
      this.sectors[sector] = (this.random() * 2 - 1) * SECTOR_NOISE;
    }
  }

  private runAi(): void {
    const lengths = new Float64Array(this.stride);
    for (const front of this.fronts) {
      lengths[front.a] += front.length;
      lengths[front.b] += front.length;
    }
    for (const front of this.fronts) {
      for (let s = 0; s < 2; s++) {
        const nation = s === 0 ? front.a : front.b;
        if (nation === this.player) continue;
        const side = front.sides[s];
        const enemy = front.sides[1 - s];
        side.allocation = lengths[nation] > 0 ? (AI_ENGAGED_SHARE * front.length) / lengths[nation] : 0;
        const planned = this.armyOf(nation) * side.allocation;
        side.stance = planned > enemy.force * AI_ATTACK_RATIO ? 'attack' : 'hold';
      }
    }
  }

  private updateFronts(): void {
    const { advantage, stride } = this;
    for (const front of this.fronts) {
      const [sideA, sideB] = front.sides;
      this.moveForces(front.a, sideA);
      this.moveForces(front.b, sideB);

      const length = Math.max(front.length, MIN_FRONT_LENGTH);
      const densityA = (sideA.force * DEFENSE_MULTIPLIER[sideA.stance]) / length;
      const densityB = (sideB.force * DEFENSE_MULTIPLIER[sideB.stance]) / length;
      const logRatio = Math.log((densityA + 1e-3) / (densityB + 1e-3));
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
    const army = this.armyOf(nation);
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
    const armies = new Float64Array(this.stride);
    for (let n = 1; n < this.stride; n++) armies[n] = this.reserve[n];
    for (const front of this.fronts) {
      armies[front.a] += front.sides[0].force;
      armies[front.b] += front.sides[1].force;
    }
    for (let n = 1; n < this.stride; n++) {
      const missing = this.capacity[n] - armies[n];
      if (missing > 0) this.reserve[n] += missing * REINFORCE_PER_TICK;
    }
  }

  private scanFrontier(): void {
    const { owners, width: W, height: H, stride, frontIndex, advantage, lengthCounts, sectors, sectorColumns } = this;
    const list = this.frontier;
    const count = this.frontierCount;
    for (const front of this.fronts) {
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

      let best = 0;
      let bestChance = 0;
      for (let j = 0; j < 4; j++) {
        const attacker = j === 0 ? n0 : j === 1 ? n1 : j === 2 ? n2 : n3;
        if (attacker === 0 || attacker === defender) continue;
        if (j > 0 && attacker === n0) continue;
        if (j > 1 && attacker === n1) continue;
        if (j > 2 && attacker === n2) continue;
        const key = attacker * stride + defender;
        if (frontIndex[key] < 0) continue;
        lengthCounts[key]++;
        const edge = advantage[key] + sector;
        if (edge <= 0) continue;
        const neighbors = (n0 === attacker ? 1 : 0) + (n1 === attacker ? 1 : 0) + (n2 === attacker ? 1 : 0) + (n3 === attacker ? 1 : 0);
        const chance = MAX_FLIP_CHANCE * (1 - Math.exp(-FLIP_STEEPNESS * edge)) * NEIGHBOR_WEIGHT[neighbors];
        if (chance > bestChance) {
          bestChance = chance;
          best = attacker;
        }
      }
      if (best !== 0 && this.random() < bestChance) {
        if (this.flipCount === this.flipCells.length) this.growFlips();
        this.flipCells[this.flipCount] = cell;
        this.flipOwners[this.flipCount] = best;
        this.flipCount++;
      }
    }

    for (const front of this.fronts) {
      front.length = (lengthCounts[front.a * stride + front.b] + lengthCounts[front.b * stride + front.a]) / 2;
    }
  }

  private growFlips(): void {
    const cells = new Int32Array(this.flipCells.length * 2);
    cells.set(this.flipCells);
    this.flipCells = cells;
    const owners = new Uint16Array(this.flipOwners.length * 2);
    owners.set(this.flipOwners);
    this.flipOwners = owners;
  }

  private applyFlips(): void {
    const { owners, width: W, height: H } = this;
    for (let i = 0; i < this.flipCount; i++) {
      const cell = this.flipCells[i];
      const attacker = this.flipOwners[i];
      const defender = owners[cell];
      owners[cell] = attacker;
      this.cellCounts[defender]--;
      this.cellCounts[attacker]++;
      this.pendingCells.push(cell);
      this.pendingOwners.push(attacker);

      const front = this.frontOf(attacker, defender)!;
      front.sides[front.a === attacker ? 0 : 1].captured++;
      this.transferProvinceCell(this.provinceGrid[cell], defender, attacker);
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
      this.capacity[previous] -= this.provinceWorth(province, previous);
      this.capacity[to] += this.provinceWorth(province, to);
      this.controller[province] = to;
      this.pendingProvinces.push(province, to);
    }
  }

  private provinceWorth(province: number, holder: number): number {
    const value = this.provinceValue[province];
    return holder === this.provinceHome[province] ? value : value * OCCUPIED_VALUE;
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
    for (let cell = 0; cell < this.owners.length; cell++) {
      if (this.owners[cell] !== 0) this.refreshFrontier(cell);
    }
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
    const fronts: FrontSnapshot[] = this.fronts.map((front) => ({
      a: front.a,
      b: front.b,
      length: front.length,
      logRatio: front.logRatio,
      sides: [{ ...front.sides[0] }, { ...front.sides[1] }],
    }));
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
      })),
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
    mix(this.rngState);
    return hash;
  }
}
