// Flèches d'offensive et poches, dessinées par-dessus les noms de pays.
import { wrapDeltaX } from '../map/projection.ts';
import type { AxisSnapshot, FrontSnapshot, OffensiveSnapshot, PocketSnapshot } from '../sim/protocol.ts';
import type { Camera } from './Camera.ts';
import { type FlowEdge, drawBadge, drawUnit } from './Sprites.ts';

export interface ArrowDraft {
  /** Flèche d'offensive, ligne fortifiée ou axe commercial en projet. */
  kind: 'arrow' | 'fort' | 'axis';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  valid: boolean;
  amphibious: boolean;
}

const SEA_COLOR = '96, 170, 214';
const OWN_COLOR = '224, 184, 79';
const ENEMY_COLOR = '216, 67, 47';
const OTHER_COLOR = '70, 70, 70';
const POCKET_LABEL_MIN_RADIUS = 13;

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  color: string,
  alpha: number,
  dashed = false,
): void {
  const length = Math.hypot(x1 - x0, y1 - y0);
  if (length < 2) return;
  const ux = (x1 - x0) / length;
  const uy = (y1 - y0) / length;
  const headLength = Math.min(length * 0.5, width * 3 + 6);
  const headHalf = width * 1.3 + 3;
  const neckX = x1 - ux * headLength;
  const neckY = y1 - uy * headLength;

  ctx.beginPath();
  ctx.moveTo(x0 + uy * width * 0.25, y0 - ux * width * 0.25);
  ctx.lineTo(neckX + uy * width * 0.5, neckY - ux * width * 0.5);
  ctx.lineTo(neckX + uy * headHalf, neckY - ux * headHalf);
  ctx.lineTo(x1, y1);
  ctx.lineTo(neckX - uy * headHalf, neckY + ux * headHalf);
  ctx.lineTo(neckX - uy * width * 0.5, neckY + ux * width * 0.5);
  ctx.lineTo(x0 - uy * width * 0.25, y0 + ux * width * 0.25);
  ctx.closePath();
  ctx.fillStyle = `rgba(${color}, ${alpha})`;
  ctx.fill();
  ctx.setLineDash(dashed ? [6, 5] : []);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(20, 22, 24, 0.85)';
  ctx.stroke();
  ctx.setLineDash([]);
}

export interface ResourceMarker {
  x: number;
  y: number;
  oil: number;
  steel: number;
}

/** Gisements, sur la carte économique : goutte noire pour le pétrole, carré d'acier pour l'acier. */
export function drawResources(ctx: CanvasRenderingContext2D, camera: Camera, markers: readonly ResourceMarker[]): void {
  const { viewWidth, viewHeight, zoom } = camera;
  for (const marker of markers) {
    const x = wrapDeltaX(camera.x, marker.x) * zoom + viewWidth / 2;
    const y = (marker.y - camera.y) * zoom + viewHeight / 2;
    if (x < -20 || x > viewWidth + 20 || y < -20 || y > viewHeight + 20) continue;
    const both = marker.oil > 0 && marker.steel > 0;
    if (marker.oil > 0) {
      const r = Math.min(9, 3 + Math.sqrt(marker.oil) * 2);
      const cx = both ? x - r * 0.8 : x;
      ctx.beginPath();
      ctx.moveTo(cx, y - r * 1.6);
      ctx.bezierCurveTo(cx + r * 1.1, y - r * 0.2, cx + r, y + r, cx, y + r);
      ctx.bezierCurveTo(cx - r, y + r, cx - r * 1.1, y - r * 0.2, cx, y - r * 1.6);
      ctx.fillStyle = 'rgba(24, 22, 20, 0.92)';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(232, 226, 208, 0.9)';
      ctx.stroke();
    }
    if (marker.steel > 0) {
      const r = Math.min(8, 3 + Math.sqrt(marker.steel) * 0.9);
      const cx = both ? x + r * 0.9 : x;
      ctx.fillStyle = 'rgba(126, 146, 160, 0.95)';
      ctx.fillRect(cx - r, y - r, r * 2, r * 2);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(24, 22, 20, 0.9)';
      ctx.strokeRect(cx - r, y - r, r * 2, r * 2);
    }
  }
}

/** Ligne fortifiée en projet : un trait épais à dents, comme sur une carte d'état-major. */
function drawFortLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, valid: boolean): void {
  const length = Math.hypot(x1 - x0, y1 - y0);
  if (length < 2) return;
  const ux = (x1 - x0) / length;
  const uy = (y1 - y0) / length;
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = valid ? 'rgba(35, 38, 40, 0.9)' : `rgba(${ENEMY_COLOR}, 0.9)`;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  // Des dents tournées vers l'ennemi supposé : à gauche du sens du tracé.
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let d = 6; d < length; d += 12) {
    const x = x0 + ux * d;
    const y = y0 + uy * d;
    ctx.moveTo(x, y);
    ctx.lineTo(x + uy * 9, y - ux * 9);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

const AXIS_COLOR = '247, 236, 205';
const PARTNER_AXIS_COLOR = '168, 216, 190';
/** Sur la carte des routes, celles des pays sans lien avec le joueur. */
const FOREIGN_AXIS_COLOR = '196, 182, 150';
const AXIS_CASING = '52, 40, 28';

interface RoadEdge {
  /** Courbe de Bézier du tronçon, à l'écran : départ, deux points de contrôle, arrivée. */
  curve: [number, number, number, number, number, number, number, number];
  /** Nombre d'axes qui l'empruntent. */
  count: number;
  active: boolean;
  sea: boolean;
  own: boolean;
  color: string;
  rank: number;
}

interface RoadNode {
  x: number;
  y: number;
  end: boolean;
  lost: boolean;
  own: boolean;
  count: number;
  color: string;
  rank: number;
}

/**
 * Axes commerciaux, comme le réseau routier d'un atlas : chaque axe passe de ville en ville (le
 * centre de chaque province traversée) en courbe douce. Les tronçons que plusieurs axes partagent
 * ne se dessinent qu'une fois, d'autant plus larges qu'ils en portent : on voit des routes
 * principales et des embranchements. Seuls comptent les siens, ceux de ses partenaires commerciaux
 * (en vert) et ceux de ses ennemis (en rouge) ; une ville perdue est rouge, un tronçon coupé tireté,
 * une ligne maritime pointillée.
 */
export function drawAxes(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  player: number,
  atWar: (nation: number) => boolean,
  partner: (nation: number) => boolean,
  axes: readonly AxisSnapshot[],
  all = false,
): FlowEdge[] {
  const { viewWidth, viewHeight, zoom } = camera;
  const edges = new Map<string, RoadEdge>();
  const nodes = new Map<string, RoadNode>();
  for (const axis of axes) {
    const own = axis.nation === player || axis.partner === player;
    const enemy = !own && atWar(axis.nation);
    if (!all && !own && !enemy && !partner(axis.nation)) continue;
    const color = own ? AXIS_COLOR : enemy ? ENEMY_COLOR : partner(axis.nation) ? PARTNER_AXIS_COLOR : FOREIGN_AXIS_COLOR;
    // Une route partagée prend la teinte la plus proche du joueur : la sienne, puis celle d'un partenaire.
    const rank = own ? 3 : enemy ? 1 : partner(axis.nation) ? 2 : 0;
    const raw = axis.points;
    if (raw.length < 4) continue;
    // Points à l'écran, déroulés depuis le premier sans couper la carte au raccord.
    const xs: number[] = [wrapDeltaX(camera.x, raw[0]) * zoom + viewWidth / 2];
    const ys: number[] = [(raw[1] - camera.y) * zoom + viewHeight / 2];
    for (let i = 2; i < raw.length; i += 2) {
      xs.push(xs[xs.length - 1] + wrapDeltaX(raw[i - 2], raw[i]) * zoom);
      ys.push((raw[i + 1] - camera.y) * zoom + viewHeight / 2);
    }
    const n = xs.length;
    // Toutes les routes passent par les mêmes villes : un tronçon commun n'est dessiné qu'une fois.
    const keyOf = (i: number) => `${raw[2 * i]},${raw[2 * i + 1]}`;
    const bySea = new Set(axis.seaLinks ?? []);
    for (let i = 0; i < n; i++) {
      const key = keyOf(i);
      const node = nodes.get(key) ?? { x: xs[i], y: ys[i], end: false, lost: false, own, count: 0, color, rank };
      if (rank > node.rank) Object.assign(node, { own, color, rank });
      node.end ||= i === 0 || i === n - 1;
      node.lost ||= axis.held[i] === false;
      node.count++;
      nodes.set(key, node);
    }
    for (let i = 0; i < n - 1; i++) {
      const [a, b] = [keyOf(i), keyOf(i + 1)];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const existing = edges.get(key);
      if (existing) {
        existing.count++;
        existing.active ||= axis.active;
        if (rank > existing.rank) Object.assign(existing, { own, color, rank });
        continue;
      }
      let curve: RoadEdge['curve'];
      const sea = bySea.has(i);
      if (sea) {
        // Une traversée : un arc léger au-dessus de la mer.
        const bend = 0.18;
        const qx = (xs[i] + xs[i + 1]) / 2 - (ys[i + 1] - ys[i]) * bend;
        const qy = (ys[i] + ys[i + 1]) / 2 + (xs[i + 1] - xs[i]) * bend;
        curve = [xs[i], ys[i], xs[i] + ((qx - xs[i]) * 2) / 3, ys[i] + ((qy - ys[i]) * 2) / 3, xs[i + 1] + ((qx - xs[i + 1]) * 2) / 3, ys[i + 1] + ((qy - ys[i + 1]) * 2) / 3, xs[i + 1], ys[i + 1]];
      } else {
        // Catmull-Rom : la courbe passe par chaque ville sans angle.
        const x0 = xs[Math.max(0, i - 1)];
        const y0 = ys[Math.max(0, i - 1)];
        const x3 = xs[Math.min(n - 1, i + 2)];
        const y3 = ys[Math.min(n - 1, i + 2)];
        curve = [xs[i], ys[i], xs[i] + (xs[i + 1] - x0) / 6, ys[i] + (ys[i + 1] - y0) / 6, xs[i + 1] - (x3 - xs[i]) / 6, ys[i + 1] - (y3 - ys[i]) / 6, xs[i + 1], ys[i + 1]];
      }
      edges.set(key, { curve, count: 1, active: axis.active, sea, own, color, rank });
    }
  }
  if (edges.size === 0) return [];

  const widthOf = (edge: { own: boolean; count: number }) => (edge.own ? 3.5 : 3) + 1.6 * (Math.min(4, edge.count) - 1);
  const stroke = (edge: RoadEdge) => {
    const [x0, y0, c1x, c1y, c2x, c2y, x1, y1] = edge.curve;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x1, y1);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // D'abord toutes les bordures, puis toutes les bandes claires : les croisements se fondent.
  for (const edge of edges.values()) {
    ctx.setLineDash(edge.sea ? [5, 7] : []);
    ctx.lineWidth = widthOf(edge) + 3.5;
    ctx.strokeStyle = `rgba(${AXIS_CASING}, ${edge.sea ? 0.55 : 0.85})`;
    stroke(edge);
  }
  for (const edge of edges.values()) {
    ctx.setLineDash(edge.sea ? [5, 7] : edge.active ? [] : [7, 7]);
    ctx.lineWidth = widthOf(edge);
    ctx.strokeStyle = `rgba(${edge.sea ? SEA_COLOR : edge.color}, 0.95)`;
    stroke(edge);
  }
  ctx.setLineDash([]);
  // Les villes : plus grosses aux bouts et aux carrefours, rouges si elles sont perdues.
  for (const node of nodes.values()) {
    const base = node.own ? 3.5 : 3;
    const radius = node.end ? base + 2.5 : node.count > 1 ? base + 1.2 : base * 0.8 + 1.2;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = node.lost ? `rgb(${ENEMY_COLOR})` : `rgb(${node.color})`;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(${AXIS_CASING}, 0.9)`;
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  // Le trafic ne circule que sur ses routes et celles de ses partenaires.
  return [...edges.values()].filter((edge) => edge.rank >= 2).map((edge) => ({ curve: edge.curve, sea: edge.sea, count: edge.count }));
}

/** Secteurs prioritaires du joueur : cercles tiretés. */
export function drawPriorityZones(ctx: CanvasRenderingContext2D, camera: Camera, zones: readonly { x: number; y: number }[], radius: number): void {
  const { viewWidth, viewHeight, zoom } = camera;
  for (const zone of zones) {
    const x = wrapDeltaX(camera.x, zone.x) * zoom + viewWidth / 2;
    const y = (zone.y - camera.y) * zoom + viewHeight / 2;
    const r = radius * zoom;
    if (x < -r || x > viewWidth + r || y < -r || y > viewHeight + r) continue;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `rgba(${OWN_COLOR}, 0.95)`;
    ctx.stroke();
    ctx.setLineDash([]);
    if (r >= 26) {
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20, 22, 24, 0.85)';
      ctx.fillStyle = `rgb(${OWN_COLOR})`;
      ctx.strokeText('PRIORITÉ', x, y - r - 9);
      ctx.fillText('PRIORITÉ', x, y - r - 9);
    }
  }
}

export function drawCampaign(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  player: number,
  atWar: (nation: number) => boolean,
  offensives: readonly OffensiveSnapshot[],
  pockets: readonly PocketSnapshot[],
  draft: ArrowDraft | null,
  fronts: readonly FrontSnapshot[] = [],
  time = 0,
  /** Faux : ni troupes au front, ni blindés en tête des offensives. */
  sprites = true,
): void {
  const { viewWidth, viewHeight, zoom } = camera;
  const toScreenX = (x: number) => wrapDeltaX(camera.x, x) * zoom + viewWidth / 2;
  const toScreenY = (y: number) => (y - camera.y) * zoom + viewHeight / 2;
  const troopSize = Math.min(64, 22 + zoom * 8);

  // Les troupes de ses fronts : de l'infanterie de chaque côté de la ligne.
  // Elles apparaissent en fondu quand on zoome, au lieu de surgir d'un coup.
  const troopFade = sprites ? Math.max(0, Math.min(1, (zoom - 0.7) / 0.4)) : 0;
  if (troopFade > 0) {
    ctx.save();
    ctx.globalAlpha = troopFade;
    for (const front of fronts) {
      const marks = front.marks;
      // Les deux camps d'un même secteur se font face : chacun recule de son côté de la ligne.
      const sectors = new Map<string, { own?: [number, number]; enemy?: [number, number] }>();
      for (let i = 0; i + 2 < marks.length; i += 3) {
        const nation = marks[i + 2] === 0 ? front.a : front.b;
        const key = `${Math.floor(marks[i] / 24)},${Math.floor(marks[i + 1] / 24)}`;
        const sector = sectors.get(key) ?? {};
        sector[nation === player ? 'own' : 'enemy'] = [marks[i], marks[i + 1]];
        sectors.set(key, sector);
      }
      for (const { own, enemy } of sectors.values()) {
        let dx = 1;
        let dy = 0;
        if (own && enemy) {
          dx = wrapDeltaX(own[0], enemy[0]);
          dy = enemy[1] - own[1];
          const length = Math.hypot(dx, dy) || 1;
          dx /= length;
          dy /= length;
        }
        const gap = troopSize * 0.5;
        for (const [cell, side] of [[own, 1], [enemy, -1]] as const) {
          if (!cell) continue;
          const x = toScreenX(cell[0]) - side * dx * gap;
          const y = toScreenY(cell[1]) - side * dy * gap;
          if (x < -troopSize || x > viewWidth + troopSize || y < -troopSize || y > viewHeight + troopSize) continue;
          drawBadge(ctx, x, y + troopSize * 0.05, troopSize * 0.5, side === 1 ? OWN_COLOR : ENEMY_COLOR);
          // Un petit groupe de soldats, chacun tourné vers l'ennemi, qui ne bougent pas en même temps.
          const seed = (cell[0] * 0.37 + cell[1] * 0.71) % 1;
          for (const [ox, oy, k] of [[-0.22, -0.08, 0], [0.2, -0.12, 1], [0, 0.1, 2]] as const) {
            drawUnit(ctx, 'infanterie', x + ox * troopSize, y + oy * troopSize, troopSize * 0.62, side * dx, side * dy, time, 1, seed + k * 0.33);
          }
        }
      }
    }
    ctx.restore();
  }

  for (const pocket of pockets) {
    const x = toScreenX(pocket.x);
    const y = toScreenY(pocket.y);
    const radius = Math.max(7, Math.sqrt(pocket.cells / Math.PI) * zoom + 3);
    if (x < -radius || x > viewWidth + radius || y < -radius || y > viewHeight + radius) continue;
    const own = pocket.nation === player;
    if (!own && !atWar(pocket.nation)) continue;
    const color = own ? ENEMY_COLOR : OWN_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(${color}, 0.95)`;
    ctx.stroke();
    ctx.setLineDash([]);
    if (radius >= POCKET_LABEL_MIN_RADIUS) {
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20, 22, 24, 0.85)';
      ctx.fillStyle = `rgb(${color})`;
      ctx.strokeText('ENCERCLÉ', x, y);
      ctx.fillText('ENCERCLÉ', x, y);
    }
  }

  for (const offensive of offensives) {
    const own = offensive.nation === player;
    const enemy = !own && atWar(offensive.nation);
    const x0 = toScreenX(offensive.fromX);
    const y0 = toScreenY(offensive.fromY);
    const dx = wrapDeltaX(offensive.fromX, offensive.toX) * zoom;
    const dy = (offensive.toY - offensive.fromY) * zoom;
    const strength = Math.min(1, offensive.force / Math.max(1, offensive.startForce));
    const width = 4 + 7 * strength;
    const color = own ? OWN_COLOR : enemy ? ENEMY_COLOR : OTHER_COLOR;
    // En mer, la flèche est pointillée : sa bordure dit qui débarque.
    const fill = offensive.inTransit && (own || enemy) ? SEA_COLOR : color;
    drawArrow(ctx, x0, y0, x0 + dx, y0 + dy, width, fill, own || enemy ? 0.8 : 0.35, offensive.inTransit);
    // En tête de l'offensive : des blindés, ou un navire de guerre pendant la traversée.
    if (sprites && (own || enemy)) {
      const lead = 0.55;
      const size = troopSize * 1.15;
      drawUnit(ctx, offensive.inTransit ? 'navire-guerre' : 'blinde', x0 + dx * lead, y0 + dy * lead, size, dx, dy, time);
    }
  }

  if (draft && draft.kind === 'axis') {
    const x0 = toScreenX(draft.fromX);
    const y0 = toScreenY(draft.fromY);
    const x1 = x0 + wrapDeltaX(draft.fromX, draft.toX) * zoom;
    const y1 = y0 + (draft.toY - draft.fromY) * zoom;
    ctx.setLineDash([10, 6]);
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = draft.valid ? `rgba(${AXIS_COLOR}, 0.9)` : `rgba(${ENEMY_COLOR}, 0.9)`;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
  } else if (draft && draft.kind === 'fort') {
    const x0 = toScreenX(draft.fromX);
    const y0 = toScreenY(draft.fromY);
    const x1 = x0 + wrapDeltaX(draft.fromX, draft.toX) * zoom;
    const y1 = y0 + (draft.toY - draft.fromY) * zoom;
    drawFortLine(ctx, x0, y0, x1, y1, draft.valid);
  } else if (draft) {
    const x0 = toScreenX(draft.fromX);
    const y0 = toScreenY(draft.fromY);
    const dx = wrapDeltaX(draft.fromX, draft.toX) * zoom;
    const dy = (draft.toY - draft.fromY) * zoom;
    const color = !draft.valid ? ENEMY_COLOR : draft.amphibious ? SEA_COLOR : OWN_COLOR;
    drawArrow(ctx, x0, y0, x0 + dx, y0 + dy, 9, color, 0.55, true);
  }
}
