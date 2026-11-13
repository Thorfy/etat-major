// Sprites de la carte : troupes au front, blindés en tête des offensives, et le trafic des routes
// commerciales — camions sur terre, navires et avions en mer.
//
// Les unités sont des planches tirées de modèles 3D (public/art/unites/, tools/units3d.ts et
// tools/sprite-baker.html) : une colonne par direction, en vue isométrique, une ligne par image
// d'animation. À défaut de planche, le sprite plat de public/art/carte/ sert encore.
import type { Camera } from './Camera.ts';

const images = new Map<string, HTMLImageElement>();
let onLoad: () => void = () => {};

/** Appelé quand un sprite finit de se charger : la carte se redessine. */
export function onSpriteLoad(callback: () => void): void {
  onLoad = callback;
}

function image(path: string): HTMLImageElement | null {
  let entry = images.get(path);
  if (!entry) {
    entry = new Image();
    entry.decoding = 'async';
    entry.onload = () => onLoad();
    entry.src = path;
    images.set(path, entry);
  }
  return entry.complete && entry.naturalWidth > 0 ? entry : null;
}

/** Planches des unités : directions (colonnes) et images d'animation (lignes), carrées. */
const ATLAS: Record<string, { directions: number; frames: number; fps: number }> = {
  camion: { directions: 16, frames: 4, fps: 2.5 },
  navire: { directions: 16, frames: 4, fps: 0.8 },
  avion: { directions: 16, frames: 4, fps: 1.2 },
  blinde: { directions: 16, frames: 4, fps: 2.5 },
  infanterie: { directions: 16, frames: 4, fps: 1.5 },
  'navire-guerre': { directions: 16, frames: 4, fps: 0.8 },
};

/**
 * Une unité qui va dans la direction (dx, dy) de l'écran : l'image de sa planche la plus proche de
 * cette direction, et de son animation à l'instant `time` (secondes). À défaut de planche, le
 * sprite plat, tourné.
 */
export function drawUnit(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number, dx: number, dy: number, time = 0, alpha = 1, phase = 0): void {
  const atlas = ATLAS[id];
  const sheet = atlas ? image(`art/unites/${id}.webp`) : null;
  if (!atlas || !sheet) {
    drawSprite(ctx, id, x, y, size * 0.9, dx, dy, alpha);
    return;
  }
  const cell = sheet.naturalWidth / atlas.directions;
  const angle = Math.atan2(dy, dx);
  const direction = ((Math.round((angle / (Math.PI * 2)) * atlas.directions) % atlas.directions) + atlas.directions) % atlas.directions;
  const frame = Math.floor(time * atlas.fps + phase * atlas.frames) % atlas.frames;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(sheet, direction * cell, frame * cell, cell, cell, x - size / 2, y - size * 0.62, size, size);
  ctx.restore();
}

/**
 * Un sprite plat vu de côté, tourné face à l'Est : il suit la direction (dx, dy) en restant à
 * l'endroit — retourné plutôt que la tête en bas quand il va vers l'Ouest.
 */
export function drawSprite(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number, dx = 1, dy = 0, alpha = 1): void {
  const picture = image(`art/carte/${id}.webp`);
  if (!picture) return;
  const flip = dx < 0;
  const angle = Math.atan2(dy, Math.abs(dx));
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.rotate(flip ? -angle : angle);
  ctx.drawImage(picture, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** Une pastille de couleur sous un sprite : à qui il appartient. */
export function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${color}, 0.35)`;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(${color}, 0.95)`;
  ctx.stroke();
}

/** Une ombre douce au sol, sous une unité (plus petite et plus loin pour un avion en vol). */
function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, alpha: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, width, width * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(16, 20, 24, ${alpha})`;
  ctx.fill();
}

/** Poussière derrière un véhicule : quelques bouffées qui pâlissent en s'éloignant. */
function drawDust(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number, size: number, time: number, seed: number): void {
  for (let k = 0; k < 3; k++) {
    const age = (time * 0.7 + seed + k / 3) % 1;
    const back = size * (0.35 + age * 0.55);
    const px = x - ux * back + Math.sin(seed * 7 + k) * size * 0.06;
    const py = y - uy * back + size * 0.08;
    ctx.beginPath();
    ctx.arc(px, py, size * (0.05 + age * 0.09), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(214, 196, 160, ${0.35 * (1 - age)})`;
    ctx.fill();
  }
}

/** Le sillage d'un navire : un V d'écume qui s'ouvre derrière lui. */
function drawWake(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number, size: number, time: number): void {
  const length = size * 0.9;
  const spread = 0.35 + 0.04 * Math.sin(time * 1.2);
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const nx = -uy * side;
    const ny = ux * side;
    const gradient = ctx.createLinearGradient(x, y, x - ux * length, y - uy * length);
    gradient.addColorStop(0, 'rgba(236, 244, 246, 0.75)');
    gradient.addColorStop(1, 'rgba(236, 244, 246, 0)');
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - ux * size * 0.2, y - uy * size * 0.2);
    ctx.lineTo(x - ux * length + nx * length * spread, y - uy * length + ny * length * spread);
    ctx.stroke();
  }
}

/** Un tronçon de route : sa courbe de Bézier à l'écran, s'il est en mer, et combien de routes le portent. */
export interface FlowEdge {
  curve: [number, number, number, number, number, number, number, number];
  /** Une traversée qui suit l'eau : sa ligne brisée à l'écran ; les navires la suivent. */
  path?: number[];
  sea: boolean;
  count: number;
}

/**
 * Où en est un véhicule à la fraction `t` d'un tronçon : position et direction. Sur une ligne brisée,
 * `t` se compte en longueur parcourue.
 */
function pathSampler(path: readonly number[]): { length: number; at(t: number): [number, number, number, number] } {
  const n = path.length / 2;
  const cumulative = [0];
  for (let i = 1; i < n; i++) cumulative.push(cumulative[i - 1] + Math.hypot(path[2 * i] - path[2 * i - 2], path[2 * i + 1] - path[2 * i - 1]));
  const length = cumulative[n - 1];
  return {
    length,
    at(t: number) {
      const target = Math.max(0, Math.min(1, t)) * length;
      let i = 1;
      while (i < n - 1 && cumulative[i] < target) i++;
      const span = cumulative[i] - cumulative[i - 1] || 1;
      const f = (target - cumulative[i - 1]) / span;
      const dx = path[2 * i] - path[2 * i - 2];
      const dy = path[2 * i + 1] - path[2 * i - 1];
      return [path[2 * i - 2] + dx * f, path[2 * i - 1] + dy * f, dx, dy];
    },
  };
}

const bezier = (c: FlowEdge['curve'], t: number): [number, number, number, number] => {
  const u = 1 - t;
  const x = u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6];
  const y = u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7];
  const dx = 3 * u * u * (c[2] - c[0]) + 6 * u * t * (c[4] - c[2]) + 3 * t * t * (c[6] - c[4]);
  const dy = 3 * u * u * (c[3] - c[1]) + 6 * u * t * (c[5] - c[3]) + 3 * t * t * (c[7] - c[5]);
  return [x, y, dx, dy];
};

/** Hachage d'un nombre en [0, 1), pour varier vitesses et départs sans tirage au sort. */
const noise = (value: number) => {
  const s = Math.sin(value * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Le trafic des routes : des convois de camions sur terre, des navires (et quelques avions) en mer,
 * qui vont et viennent ; chaque convoi a son allure, les véhicules d'un convoi se suivent de près.
 * Plus de convois sur les tronçons que plusieurs routes empruntent. `time` en secondes ; rien à trop
 * petit zoom, où ils ne seraient que des points.
 */
export function drawFlows(ctx: CanvasRenderingContext2D, camera: Camera, edges: readonly FlowEdge[], time: number): void {
  const { zoom, viewWidth, viewHeight } = camera;
  // Ils apparaissent en fondu quand on zoome, au lieu de surgir d'un coup.
  const appear = Math.max(0, Math.min(1, (zoom - 1) / 0.6));
  if (appear <= 0) return;
  const size = Math.min(34, 10 + zoom * 3.5);
  // Tout se compte sur la carte (en cellules), pas à l'écran : zoomer ne fait rien sauter.
  const base = 0.8; // cellules par seconde
  const toWorld = (sx: number, sy: number) => [camera.x + (sx - viewWidth / 2) / zoom, camera.y + (sy - viewHeight / 2) / zoom];
  for (const edge of edges) {
    const c = edge.curve;
    const xs = edge.path ? edge.path.filter((_, i) => i % 2 === 0) : [c[0], c[2], c[4], c[6]];
    const ys = edge.path ? edge.path.filter((_, i) => i % 2 === 1) : [c[1], c[3], c[5], c[7]];
    if (Math.max(...xs) < -size || Math.min(...xs) > viewWidth + size || Math.max(...ys) < -size || Math.min(...ys) > viewHeight + size) continue;
    const sampler = edge.path ? pathSampler(edge.path) : null;
    const point = (t: number) => (sampler ? sampler.at(t) : bezier(c, t));
    const screenLength = sampler ? sampler.length : Math.hypot(c[6] - c[0], c[7] - c[1]);
    if (screenLength < size * 1.5) continue;
    const length = screenLength / zoom;
    // La graine vient des deux bouts du tronçon sur la carte : la même quel que soit le cadrage.
    const [ax, ay] = toWorld(c[0], c[1]);
    const [bx, by] = toWorld(c[6], c[7]);
    const seed = noise(Math.round(ax + bx) * 0.013 + Math.round(ay + by) * 0.007);
    const convoys = Math.max(1, Math.min(3, Math.round((length / 70) * Math.min(2, edge.count))));
    for (let i = 0; i < convoys; i++) {
      const back = i % 2 === 1;
      const own = noise(seed * 31 + i * 7.3);
      // Chaque convoi a son allure ; sur mer, plus lente pour les navires.
      const speed = base * (edge.sea ? 0.55 : 1) * (0.75 + 0.5 * own);
      const vehicles = edge.sea ? 1 : 1 + Math.floor(own * 2);
      for (let v = 0; v < vehicles; v++) {
        const gap = (size * 0.75 * v) / screenLength;
        const phase = (time * speed) / length + i / convoys + seed - gap;
        let t = phase - Math.floor(phase);
        if (back) t = 1 - t;
        const [x, y, dx, dy] = point(t);
        const sx = back ? -dx : dx;
        const sy = back ? -dy : dy;
        const norm = Math.hypot(sx, sy) || 1;
        const ux = sx / norm;
        const uy = sy / norm;
        // Les véhicules entrent et sortent en fondu au bout du tronçon.
        const fade = Math.min(1, t * 8, (1 - t) * 8) * appear;
        if (fade <= 0) continue;
        if (edge.sea) {
          if (i % 3 === 2) {
            // Un avion : son ombre au sol, lui plus haut, plus vite.
            const fly = (((time * speed * 2.5) / length + i / convoys + seed) % 1 + 1) % 1;
            const [ax, ay, adx, ady] = point(back ? 1 - fly : fly);
            const fadeAir = Math.min(1, fly * 8, (1 - fly) * 8) * appear;
            drawShadow(ctx, ax, ay, size * 0.28, 0.25 * fadeAir);
            drawUnit(ctx, 'avion', ax, ay - size * 0.45, size * 0.95, back ? -adx : adx, back ? -ady : ady, time, fadeAir, own);
          } else {
            drawWake(ctx, x, y, ux, uy, size, time + own * 5);
            drawUnit(ctx, 'navire', x, y, size * 1.15, sx, sy, time, fade, own);
          }
        } else {
          drawShadow(ctx, x, y + size * 0.12, size * 0.25, 0.22 * fade);
          drawDust(ctx, x, y, ux, uy, size, time, own + v * 0.37);
          drawUnit(ctx, 'camion', x, y, size, sx, sy, time, fade, own + v * 0.3);
        }
      }
    }
  }
}
