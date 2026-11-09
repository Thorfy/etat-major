// Flèches d'offensive et poches, dessinées par-dessus les noms de pays.
import { wrapDeltaX } from '../map/projection.ts';
import type { OffensiveSnapshot, PocketSnapshot } from '../sim/protocol.ts';
import type { Camera } from './Camera.ts';

export interface ArrowDraft {
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

export function drawCampaign(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  player: number,
  atWar: (nation: number) => boolean,
  offensives: readonly OffensiveSnapshot[],
  pockets: readonly PocketSnapshot[],
  draft: ArrowDraft | null,
): void {
  const { viewWidth, viewHeight, zoom } = camera;
  const toScreenX = (x: number) => wrapDeltaX(camera.x, x) * zoom + viewWidth / 2;
  const toScreenY = (y: number) => (y - camera.y) * zoom + viewHeight / 2;

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
  }

  if (draft) {
    const x0 = toScreenX(draft.fromX);
    const y0 = toScreenY(draft.fromY);
    const dx = wrapDeltaX(draft.fromX, draft.toX) * zoom;
    const dy = (draft.toY - draft.fromY) * zoom;
    const color = !draft.valid ? ENEMY_COLOR : draft.amphibious ? SEA_COLOR : OWN_COLOR;
    drawArrow(ctx, x0, y0, x0 + dx, y0 + dy, 9, color, 0.55, true);
  }
}
