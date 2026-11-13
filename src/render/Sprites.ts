// Sprites de la carte (public/art/carte/) : troupes au front, blindés en tête des offensives, et le
// trafic des routes commerciales — camions sur terre, navires et avions en mer.
import type { Camera } from './Camera.ts';

const images = new Map<string, HTMLImageElement>();
let onLoad: () => void = () => {};

/** Appelé quand un sprite finit de se charger : la carte se redessine. */
export function onSpriteLoad(callback: () => void): void {
  onLoad = callback;
}

function sprite(id: string): HTMLImageElement | null {
  let image = images.get(id);
  if (!image) {
    image = new Image();
    image.decoding = 'async';
    image.onload = () => onLoad();
    image.src = `art/carte/${id}.webp`;
    images.set(id, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}

/**
 * Un sprite vu de côté, tourné face à l'Est : il suit la direction (dx, dy) en restant à
 * l'endroit — retourné plutôt que la tête en bas quand il va vers l'Ouest.
 */
export function drawSprite(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number, dx = 1, dy = 0, alpha = 1): void {
  const image = sprite(id);
  if (!image) return;
  const flip = dx < 0;
  const angle = Math.atan2(dy, Math.abs(dx));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.rotate(flip ? -angle : angle);
  ctx.drawImage(image, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** Une pastille de couleur sous un sprite : à qui il appartient. */
export function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${color}, 0.35)`;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(${color}, 0.95)`;
  ctx.stroke();
}

/** Un tronçon de route : sa courbe de Bézier à l'écran, s'il est en mer, et combien de routes le portent. */
export interface FlowEdge {
  curve: [number, number, number, number, number, number, number, number];
  sea: boolean;
  count: number;
}

const bezier = (c: FlowEdge['curve'], t: number): [number, number, number, number] => {
  const u = 1 - t;
  const x = u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6];
  const y = u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7];
  const dx = 3 * u * u * (c[2] - c[0]) + 6 * u * t * (c[4] - c[2]) + 3 * t * t * (c[6] - c[4]);
  const dy = 3 * u * u * (c[3] - c[1]) + 6 * u * t * (c[5] - c[3]) + 3 * t * t * (c[7] - c[5]);
  return [x, y, dx, dy];
};

/**
 * Le trafic des routes : des camions sur terre, des navires (et quelques avions) en mer, qui vont
 * et viennent à vitesse constante ; plus nombreux sur les tronçons que plusieurs routes empruntent.
 * `time` en secondes ; rien à trop petit zoom, où ils ne seraient que des points.
 */
export function drawFlows(ctx: CanvasRenderingContext2D, camera: Camera, edges: readonly FlowEdge[], time: number): void {
  const { zoom, viewWidth, viewHeight } = camera;
  if (zoom < 1.2) return;
  // Le dessin occupe la moitié de son image : on la prend deux fois plus grande que le véhicule voulu.
  const size = Math.min(56, 16 + zoom * 7);
  const speed = 18 + zoom * 6; // pixels par seconde
  for (const edge of edges) {
    const c = edge.curve;
    const minX = Math.min(c[0], c[2], c[4], c[6]);
    const maxX = Math.max(c[0], c[2], c[4], c[6]);
    const minY = Math.min(c[1], c[3], c[5], c[7]);
    const maxY = Math.max(c[1], c[3], c[5], c[7]);
    if (maxX < -size || minX > viewWidth + size || maxY < -size || minY > viewHeight + size) continue;
    const length = Math.hypot(c[6] - c[0], c[7] - c[1]);
    if (length < size * 2) continue;
    // Un véhicule tous les 90 pixels environ, davantage là où les routes se rejoignent.
    const vehicles = Math.max(1, Math.min(6, Math.round((length / 140) * Math.min(3, edge.count))));
    for (let i = 0; i < vehicles; i++) {
      const back = i % 2 === 1;
      const phase = (time * speed) / length + i / vehicles + (c[0] * 0.013 + c[1] * 0.007);
      let t = phase - Math.floor(phase);
      if (back) t = 1 - t;
      const [x, y, dx, dy] = bezier(c, t);
      const sx = back ? -dx : dx;
      const sy = back ? -dy : dy;
      if (edge.sea) {
        // En mer : des navires, et un avion de temps à autre, un peu au-dessus de la route.
        if (i % 3 === 2) drawSprite(ctx, 'avion', x, y - size * 0.6, size * 0.9, sx, sy, 0.95);
        else drawSprite(ctx, 'navire', x, y, size * 1.1, sx, sy);
      } else {
        drawSprite(ctx, 'camion', x, y, size, sx, sy);
      }
    }
  }
}
