// Voies d'eau : les mers, et les grands fleuves qui y mènent. Une route maritime part de l'accès à
// l'eau de sa région (sa côte, ou le fleuve qui la traverse), suit l'eau sans couper les terres, et
// rejoint l'accès à l'eau de la région d'arrivée.
//
// Les distances se calculent sur un graphe grossier : la carte est découpée en blocs de STEP × STEP
// cellules, et chaque étendue d'eau d'un bloc (un bras de mer, un fleuve) en est un nœud, relié à ceux
// des blocs voisins qu'elle touche vraiment. Un isthme ne laisse donc rien passer, même étroit. Le
// tracé d'une traversée se reprend ensuite cellule par cellule, dans le couloir de ces blocs.

/** Cellules de la carte par côté d'un bloc du graphe des voies d'eau. */
export const WATER_STEP = 8;

export interface WaterwaysInput {
  width: number;
  height: number;
  /** Propriétaire de chaque cellule : 0 pour l'eau. */
  owners: Uint16Array;
  /** Mer de chaque cellule d'eau, 0 pour une étendue trop petite pour en être une. */
  seas: Uint16Array;
  /** 1 sur les cellules de terre où passe un grand fleuve. */
  rivers?: Uint8Array | null;
  provinceGrid: Uint16Array;
  /** Centre (la ville) de chaque province, indexé à partir de 1. */
  centers: { x: number; y: number }[];
}

interface Access {
  /** Nœud du graphe où l'on prend l'eau. */
  node: number;
  /** Cellule d'eau où l'on prend l'eau. */
  point: number;
  /** Trajet à terre, de la ville jusque-là. */
  land: number;
}

export class Waterways {
  private readonly width: number;
  private readonly height: number;
  private readonly owners: Uint16Array;
  private readonly seas: Uint16Array;
  private readonly rivers: Uint8Array | null;
  /** Embouchure de chaque cellule de fleuve reliée à la mer. */
  private readonly drain = new Map<number, number>();
  /** Bloc de chaque nœud, et sa cellule représentative (au plus près du milieu du bloc). */
  private readonly nodeBlock: Int32Array;
  private readonly nodeAnchor: Int32Array;
  /** Voisins de chaque nœud (format compact) et longueur de chaque lien. */
  private readonly edgeStart: Int32Array;
  private readonly edgeTarget: Int32Array;
  private readonly edgeCost: Float32Array;
  private readonly access = new Map<number, Access[]>();
  /** Provinces qui prennent l'eau à un nœud. */
  private readonly accessAt = new Map<number, { province: number; land: number }[]>();
  private readonly reachCache = new Map<number, Map<number, number>>();
  private readonly pathCache = new Map<number, number[] | null>();
  // Tampons du plus court chemin, réutilisés d'une recherche à l'autre.
  private readonly dist: Float32Array;
  private readonly prev: Int32Array;
  private readonly source: Int32Array;
  private readonly stamp: Uint32Array;
  private generation = 0;
  private heapNodes: Int32Array = new Int32Array(1024);
  private heapCosts: Float32Array = new Float32Array(1024);

  constructor(input: WaterwaysInput) {
    const { width: W, height: H, owners, seas, provinceGrid, centers } = input;
    const rivers = input.rivers ?? null;
    this.width = W;
    this.height = H;
    this.owners = owners;
    this.seas = seas;
    this.rivers = rivers;
    const S = WATER_STEP;
    const bw = Math.ceil(W / S);
    const bh = Math.ceil(H / S);

    // Cellules navigables : la mer, et les fleuves.
    const nav = new Uint8Array(W * H);
    for (let cell = 0; cell < W * H; cell++) {
      if ((owners[cell] === 0 && seas[cell] !== 0) || (rivers !== null && rivers[cell] === 1)) nav[cell] = 1;
    }

    // Chaque cellule de fleuve se rattache à l'embouchure la plus proche en le suivant : deux fleuves
    // qui se touchent par leurs sources ne font pas un passage d'une mer à l'autre.
    const drain = this.drain;
    if (rivers !== null) {
      const queue: number[] = [];
      for (let cell = 0; cell < W * H; cell++) {
        if (nav[cell] === 0 || this.isSea(cell)) continue;
        const x = cell % W;
        const y = (cell - x) / W;
        let mouth = false;
        for (let dy = -1; dy <= 1 && !mouth; dy++) {
          if (y + dy < 0 || y + dy >= H) continue;
          for (let dx = -1; dx <= 1 && !mouth; dx++) mouth = this.isSea((y + dy) * W + ((x + dx + W) % W));
        }
        if (!mouth) continue;
        drain.set(cell, cell);
        queue.push(cell);
      }
      for (let head = 0; head < queue.length; head++) {
        const cell = queue[head];
        const x = cell % W;
        const y = (cell - x) / W;
        for (let dy = -1; dy <= 1; dy++) {
          if (y + dy < 0 || y + dy >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const next = (y + dy) * W + ((x + dx + W) % W);
            if (nav[next] === 0 || this.isSea(next) || drain.has(next)) continue;
            drain.set(next, drain.get(cell)!);
            queue.push(next);
          }
        }
      }
    }

    // Les nœuds : chaque étendue d'eau d'un seul tenant à l'intérieur d'un bloc.
    const nodeOf = new Int32Array(W * H).fill(-1);
    const blocks: number[] = [];
    const anchors: number[] = [];
    const touchesSea: number[] = [];
    const stack: number[] = [];
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        const x0 = bx * S;
        const y0 = by * S;
        const x1 = Math.min(W, x0 + S);
        const y1 = Math.min(H, y0 + S);
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const start = y * W + x;
            if (nodeOf[start] >= 0 || nav[start] === 0) continue;
            const node = blocks.length;
            blocks.push(by * bw + bx);
            let anchor = start;
            let anchorDistance = Infinity;
            let sea = false;
            nodeOf[start] = node;
            stack.push(start);
            while (stack.length > 0) {
              const cell = stack.pop()!;
              const cx = cell % W;
              const cy = (cell - cx) / W;
              const d = (cx + 0.5 - mx) ** 2 + (cy + 0.5 - my) ** 2;
              if (d < anchorDistance) {
                anchorDistance = d;
                anchor = cell;
              }
              if (this.isSea(cell)) sea = true;
              for (let dy = -1; dy <= 1; dy++) {
                const ny = cy + dy;
                if (ny < y0 || ny >= y1) continue;
                for (let dx = -1; dx <= 1; dx++) {
                  const nx = cx + dx;
                  if (nx < x0 || nx >= x1) continue;
                  const next = ny * W + nx;
                  if (nodeOf[next] >= 0 || nav[next] === 0 || !this.joined(cell, next)) continue;
                  nodeOf[next] = node;
                  stack.push(next);
                }
              }
            }
            anchors.push(anchor);
            touchesSea.push(sea ? 1 : 0);
          }
        }
      }
    }
    const count = blocks.length;
    this.nodeBlock = Int32Array.from(blocks);
    this.nodeAnchor = Int32Array.from(anchors);

    // Les liens : deux nœuds de blocs voisins dont l'eau se touche.
    const neighbors: number[][] = Array.from({ length: count }, () => []);
    const link = (a: number, b: number) => {
      if (!neighbors[a].includes(b)) {
        neighbors[a].push(b);
        neighbors[b].push(a);
      }
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = nodeOf[y * W + x];
        if (a < 0) continue;
        // Seules les cellules au bord d'un bloc touchent un autre nœud.
        const right = (x + 1) % W;
        const left = (x - 1 + W) % W;
        const cell = y * W + x;
        const join = (next: number) => {
          const b = nodeOf[next];
          if (b >= 0 && b !== a && this.joined(cell, next)) link(a, b);
        };
        join(y * W + right);
        if (y + 1 >= H) continue;
        const below = (y + 1) * W;
        join(below + left);
        join(below + x);
        join(below + right);
      }
    }

    // Seules restent les eaux reliées à une mer : un fleuve qui se perd dans les terres ne mène nulle part.
    const live = new Uint8Array(count);
    const queue: number[] = [];
    for (let n = 0; n < count; n++) {
      if (!touchesSea[n] || live[n]) continue;
      live[n] = 1;
      queue.push(n);
      while (queue.length > 0) {
        const current = queue.pop()!;
        for (const next of neighbors[current]) {
          if (live[next]) continue;
          live[next] = 1;
          queue.push(next);
        }
      }
    }
    const edgeStart = new Int32Array(count + 1);
    for (let n = 0; n < count; n++) edgeStart[n + 1] = edgeStart[n] + (live[n] ? neighbors[n].length : 0);
    const edgeTarget = new Int32Array(edgeStart[count]);
    const edgeCost = new Float32Array(edgeStart[count]);
    for (let n = 0; n < count; n++) {
      if (!live[n]) continue;
      neighbors[n].forEach((m, k) => {
        edgeTarget[edgeStart[n] + k] = m;
        edgeCost[edgeStart[n] + k] = this.cellDistance(anchors[n], anchors[m]);
      });
    }
    this.edgeStart = edgeStart;
    this.edgeTarget = edgeTarget;
    this.edgeCost = edgeCost;

    // Accès à l'eau : les cellules d'une province au bord d'une mer, ou sur le fleuve qui la traverse.
    const best = new Map<number, Access>();
    for (let cell = 0; cell < W * H; cell++) {
      const province = provinceGrid[cell];
      if (province === 0) continue;
      const x = cell % W;
      const y = (cell - x) / W;
      let point = -1;
      if (rivers !== null && rivers[cell] === 1) point = cell;
      else {
        for (let j = 0; j < 4 && point < 0; j++) {
          if ((j === 2 && y === 0) || (j === 3 && y === H - 1)) continue;
          const next = j === 0 ? (x > 0 ? cell - 1 : cell + W - 1) : j === 1 ? (x < W - 1 ? cell + 1 : cell - W + 1) : j === 2 ? cell - W : cell + W;
          if (this.isSea(next)) point = next;
        }
      }
      if (point < 0) continue;
      const node = nodeOf[point];
      if (node < 0 || !live[node]) continue;
      const center = centers[province];
      if (!center) continue;
      const land = Math.hypot(wrap(center.x - (x + 0.5), W), center.y - (y + 0.5));
      const key = province * count + node;
      const previous = best.get(key);
      if (!previous || land < previous.land) best.set(key, { node, point, land });
    }
    for (const [key, entry] of best) {
      const province = Math.floor(key / count);
      const list = this.access.get(province) ?? [];
      list.push(entry);
      this.access.set(province, list);
      const here = this.accessAt.get(entry.node) ?? [];
      here.push({ province, land: entry.land });
      this.accessAt.set(entry.node, here);
    }

    this.dist = new Float32Array(count);
    this.prev = new Int32Array(count);
    this.source = new Int32Array(count);
    this.stamp = new Uint32Array(count);
  }

  private isSea(cell: number): boolean {
    return this.owners[cell] === 0 && this.seas[cell] !== 0;
  }

  private navigable(cell: number): boolean {
    return this.isSea(cell) || (this.rivers !== null && this.rivers[cell] === 1);
  }

  /** Deux cellules d'eau voisines communiquent-elles ? Deux bouts de fleuve, seulement s'ils vont à la même embouchure. */
  private joined(a: number, b: number): boolean {
    if (this.isSea(a) || this.isSea(b)) return true;
    return this.drain.get(a) === this.drain.get(b);
  }

  private cellDistance(a: number, b: number): number {
    const W = this.width;
    const ax = a % W;
    const bx = b % W;
    return Math.hypot(wrap(bx - ax, W), (b - bx) / W - (a - ax) / W);
  }

  /** La province a-t-elle un accès à l'eau qui mène à la mer ? */
  isPort(province: number): boolean {
    return this.access.has(province);
  }

  /**
   * Ports qu'on atteint depuis une province par l'eau, à moins de `limit` cellules, avec la longueur
   * du trajet : de la ville à l'eau, par l'eau, puis de l'eau à la ville d'arrivée.
   */
  reach(province: number, limit: number): Map<number, number> {
    const key = province * 4096 + Math.round(limit);
    const cached = this.reachCache.get(key);
    if (cached) return cached;
    const found = new Map<number, number>();
    this.search(province, limit, (node, d) => {
      for (const { province: other, land } of this.accessAt.get(node) ?? []) {
        if (other === province) continue;
        const total = d + land;
        if (total <= limit && total < (found.get(other) ?? Infinity)) found.set(other, total);
      }
      return false;
    });
    this.reachCache.set(key, found);
    return found;
  }

  /**
   * Le tracé d'une traversée, en cellules de la carte (x, y à la suite) : du point où l'on quitte la
   * terre jusqu'à celui où l'on accoste, toujours sur l'eau. Nul si l'eau ne relie pas les deux.
   */
  path(from: number, to: number, limit: number): number[] | null {
    const key = from * 65536 + to;
    if (this.pathCache.has(key)) return this.pathCache.get(key)!;
    const reverse = this.pathCache.get(to * 65536 + from);
    if (reverse !== undefined) {
      const flipped = reverse && reverse.length > 0 ? flip(reverse) : reverse;
      this.pathCache.set(key, flipped);
      return flipped;
    }
    let bestTotal = Infinity;
    let bestNode = -1;
    this.search(from, limit, (node, d) => {
      if (d >= bestTotal) return true;
      for (const { province, land } of this.accessAt.get(node) ?? []) {
        if (province !== to || d + land >= bestTotal) continue;
        bestTotal = d + land;
        bestNode = node;
      }
      return false;
    });
    if (bestNode < 0) {
      this.pathCache.set(key, null);
      return null;
    }
    const nodes: number[] = [];
    for (let n = bestNode; n >= 0; n = this.prev[n]) nodes.push(n);
    nodes.reverse();
    const start = this.access.get(from)!.find((entry) => entry.node === this.source[bestNode])!.point;
    const end = this.access.get(to)!.find((entry) => entry.node === bestNode)!.point;
    const cells = this.refine(start, end, nodes) ?? [start, ...nodes.slice(1, -1).map((n) => this.nodeAnchor[n]), end];
    const W = this.width;
    const points: number[] = [];
    for (const cell of this.simplify(cells)) points.push((cell % W) + 0.5, Math.floor(cell / W) + 0.5);
    this.pathCache.set(key, points);
    return points;
  }

  /**
   * Le chemin cellule par cellule, sur l'eau, dans le couloir des blocs du trajet grossier (et de
   * leurs voisins). Nul si le couloir ne relie pas les deux bouts.
   */
  private refine(start: number, end: number, nodes: number[]): number[] | null {
    const W = this.width;
    const H = this.height;
    const S = WATER_STEP;
    const bw = Math.ceil(W / S);
    const bh = Math.ceil(H / S);
    const corridor = new Set<number>();
    for (const node of nodes) {
      const block = this.nodeBlock[node];
      const bx = block % bw;
      const by = (block - bx) / bw;
      for (let dy = -1; dy <= 1; dy++) {
        if (by + dy < 0 || by + dy >= bh) continue;
        for (let dx = -1; dx <= 1; dx++) corridor.add((by + dy) * bw + ((bx + dx + bw) % bw));
      }
    }
    const blockOf = (cell: number) => {
      const x = cell % W;
      return Math.floor((cell - x) / W / S) * bw + Math.floor(x / S);
    };
    // Parcours en largeur, huit directions : le plus court en nombre de pas, lissé ensuite.
    const previous = new Map<number, number>([[start, -1]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head];
      if (cell === end) break;
      const x = cell % W;
      const y = (cell - x) / W;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const next = ny * W + ((x + dx + W) % W);
          if (previous.has(next) || !this.navigable(next) || !this.joined(cell, next) || !corridor.has(blockOf(next))) continue;
          previous.set(next, cell);
          queue.push(next);
        }
      }
    }
    if (!previous.has(end)) return null;
    const cells: number[] = [];
    for (let cell = end; cell >= 0; cell = previous.get(cell)!) cells.push(cell);
    return cells.reverse();
  }

  /** Ne garde que les coins : d'un point, on file tout droit jusqu'au dernier qu'on voit sans toucher terre. */
  private simplify(cells: number[]): number[] {
    if (cells.length <= 2) return cells;
    const kept = [cells[0]];
    let i = 0;
    while (i < cells.length - 1) {
      let j = i + 1;
      while (j + 1 < cells.length && this.clear(cells[i], cells[j + 1])) j++;
      kept.push(cells[j]);
      i = j;
    }
    return kept;
  }

  /** Le segment entre deux cellules reste-t-il sur l'eau ? */
  private clear(a: number, b: number): boolean {
    const W = this.width;
    const ax = a % W;
    const ay = (a - ax) / W;
    const bx = b % W;
    const by = (b - bx) / W;
    const dx = wrap(bx - ax, W);
    const dy = by - ay;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2);
    for (let s = 1; s < steps; s++) {
      const x = ((Math.round(ax + (dx * s) / steps) % W) + W) % W;
      const y = Math.round(ay + (dy * s) / steps);
      if (!this.navigable(y * W + x)) return false;
    }
    return true;
  }

  /**
   * Plus court chemin par l'eau depuis tous les accès d'une province à la fois, chacun partant avec
   * son trajet à terre. `visit` reçoit chaque nœud atteint ; vrai l'arrête.
   */
  private search(province: number, limit: number, visit: (node: number, d: number) => boolean): void {
    const sources = this.access.get(province);
    if (!sources) return;
    const { edgeStart, edgeTarget, edgeCost, dist, prev, source, stamp } = this;
    const generation = ++this.generation;
    let size = 0;
    const push = (node: number, cost: number) => {
      if (size === this.heapNodes.length) {
        const nodes = new Int32Array(size * 2);
        nodes.set(this.heapNodes);
        const costs = new Float32Array(size * 2);
        costs.set(this.heapCosts);
        this.heapNodes = nodes;
        this.heapCosts = costs;
      }
      const nodes = this.heapNodes;
      const costs = this.heapCosts;
      let i = size++;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (costs[parent] <= cost) break;
        nodes[i] = nodes[parent];
        costs[i] = costs[parent];
        i = parent;
      }
      nodes[i] = node;
      costs[i] = cost;
    };
    const pop = (): number => {
      const nodes = this.heapNodes;
      const costs = this.heapCosts;
      const top = nodes[0];
      const lastNode = nodes[--size];
      const lastCost = costs[size];
      let i = 0;
      while (true) {
        let child = 2 * i + 1;
        if (child >= size) break;
        if (child + 1 < size && costs[child + 1] < costs[child]) child++;
        if (costs[child] >= lastCost) break;
        nodes[i] = nodes[child];
        costs[i] = costs[child];
        i = child;
      }
      nodes[i] = lastNode;
      costs[i] = lastCost;
      return top;
    };
    for (const { node, land } of sources) {
      if (stamp[node] === generation && dist[node] <= land) continue;
      stamp[node] = generation;
      dist[node] = land;
      prev[node] = -1;
      source[node] = node;
      push(node, land);
    }
    while (size > 0) {
      const cost = this.heapCosts[0];
      const node = pop();
      if (cost > dist[node]) continue;
      if (cost > limit) break;
      if (visit(node, cost)) break;
      for (let e = edgeStart[node]; e < edgeStart[node + 1]; e++) {
        const next = edgeTarget[e];
        const d = cost + edgeCost[e];
        if (stamp[next] === generation && dist[next] <= d) continue;
        stamp[next] = generation;
        dist[next] = d;
        prev[next] = node;
        source[next] = source[node];
        push(next, d);
      }
    }
  }
}

/** Une ligne brisée parcourue dans l'autre sens. */
function flip(points: number[]): number[] {
  const flipped: number[] = [];
  for (let i = points.length - 2; i >= 0; i -= 2) flipped.push(points[i], points[i + 1]);
  return flipped;
}

function wrap(dx: number, width: number): number {
  let d = dx % width;
  if (d > width / 2) d -= width;
  if (d < -width / 2) d += width;
  return d;
}
