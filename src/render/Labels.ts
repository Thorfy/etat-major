// Noms de pays, dessinés sur un canvas 2D au-dessus de la carte.
import type { NationData } from '../map/types.ts';
import type { NationLabel } from '../sim/protocol.ts';
import type { Camera } from './Camera.ts';

const MIN_FONT_PX = 9.5;
const MAX_FONT_PX = 30;
const REFERENCE_FONT_PX = 100;
const FONT = (px: number) => `600 ${px}px "Segoe UI", system-ui, sans-serif`;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface LabelEntry {
  id: number;
  name: string;
  label: NationData['label'];
  refWidth: number;
  /** Nation disparue, ou région pas encore née. */
  hidden: boolean;
}

export class Labels {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private entries: LabelEntry[];

  constructor(canvas: HTMLCanvasElement, nations: NationData[]) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.font = FONT(REFERENCE_FONT_PX);
    this.entries = nations.map((nation, index) => {
      const name = nation.name.toUpperCase();
      return { id: index + 1, name, label: nation.label, refWidth: this.ctx.measureText(name).width, hidden: nation.parent !== undefined };
    });
    this.sort();
  }

  private sort(): void {
    this.entries.sort((a, b) => b.label.r - a.label.r);
  }

  /** Un rayon négatif cache le nom : la nation n'existe plus, ou pas encore. */
  update(labels: readonly NationLabel[]): void {
    const byId = new Map(labels.map((label) => [label.id, label]));
    for (const entry of this.entries) {
      const label = byId.get(entry.id);
      if (!label) continue;
      entry.hidden = label.r < 0;
      if (!entry.hidden) entry.label = { x: label.x, y: label.y, r: label.r };
    }
    this.sort();
  }

  get context(): CanvasRenderingContext2D {
    return this.ctx;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(camera: Camera): void {
    const { ctx } = this;
    const { viewWidth, viewHeight, zoom, mapWidth } = camera;
    ctx.clearRect(0, 0, viewWidth, viewHeight);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    const placed: Box[] = [];
    for (const { name, label, refWidth, hidden } of this.entries) {
      if (hidden) continue;
      const inscribed = label.r * zoom;
      const fitted = (REFERENCE_FONT_PX * inscribed * 2.6) / refWidth;
      const fontPx = Math.min(MAX_FONT_PX, inscribed * 0.8, fitted);
      if (fontPx < MIN_FONT_PX) continue;

      const halfWidth = (refWidth * fontPx) / REFERENCE_FONT_PX / 2;
      const halfHeight = fontPx * 0.6;
      const sy = (label.y - camera.y) * zoom + viewHeight / 2;
      if (sy < -halfHeight || sy > viewHeight + halfHeight) continue;

      const base = ((label.x - camera.x) * zoom + viewWidth / 2) % (mapWidth * zoom);
      for (let sx = base - mapWidth * zoom * 2; sx < viewWidth + halfWidth; sx += mapWidth * zoom) {
        if (sx < -halfWidth) continue;
        const box = { x0: sx - halfWidth, y0: sy - halfHeight, x1: sx + halfWidth, y1: sy + halfHeight };
        if (placed.some((o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0)) continue;
        placed.push(box);

        ctx.font = FONT(fontPx);
        ctx.lineWidth = Math.max(2, fontPx * 0.16);
        ctx.strokeStyle = 'rgba(238, 230, 205, 0.5)';
        ctx.fillStyle = 'rgba(32, 29, 25, 0.86)';
        ctx.strokeText(name, sx, sy);
        ctx.fillText(name, sx, sy);
      }
    }
  }
}
