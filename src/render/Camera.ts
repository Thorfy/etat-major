// Caméra de la carte : x boucle, y reste dans la carte. Unités : cellules et pixels CSS.

export const MAX_ZOOM = 16;

export class Camera {
  readonly mapWidth: number;
  readonly mapHeight: number;
  viewWidth = 1;
  viewHeight = 1;
  x: number;
  y: number;
  /** Pixels CSS par cellule. */
  zoom = 1;

  constructor(mapWidth: number, mapHeight: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.x = mapWidth / 2;
    this.y = mapHeight / 2;
  }

  get minZoom(): number {
    return this.viewHeight / this.mapHeight;
  }

  resize(viewWidth: number, viewHeight: number): void {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.zoom = Math.max(this.zoom, this.minZoom);
    this.normalize();
  }

  /** Cadre toute la hauteur de la carte. */
  fit(): void {
    this.zoom = this.minZoom;
    this.y = this.mapHeight / 2;
    this.normalize();
  }

  panPixels(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.normalize();
  }

  /** Change le zoom en gardant fixe le point sous (sx, sy). */
  zoomAt(zoom: number, sx: number, sy: number): void {
    const next = Math.min(MAX_ZOOM, Math.max(this.minZoom, zoom));
    const before = this.screenToWorld(sx, sy);
    this.zoom = next;
    this.x = before.x - (sx - this.viewWidth / 2) / next;
    this.y = before.y - (sy - this.viewHeight / 2) / next;
    this.normalize();
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: this.x + (sx - this.viewWidth / 2) / this.zoom,
      y: this.y + (sy - this.viewHeight / 2) / this.zoom,
    };
  }

  /** Cellule sous le point d'écran, x ramené dans la carte, null hors carte. */
  screenToCell(sx: number, sy: number): { x: number; y: number } | null {
    const world = this.screenToWorld(sx, sy);
    const y = Math.floor(world.y);
    if (y < 0 || y >= this.mapHeight) return null;
    const x = Math.floor(world.x);
    return { x: ((x % this.mapWidth) + this.mapWidth) % this.mapWidth, y };
  }

  private normalize(): void {
    this.x = ((this.x % this.mapWidth) + this.mapWidth) % this.mapWidth;
    const halfHeight = this.viewHeight / 2 / this.zoom;
    this.y = Math.min(this.mapHeight - halfHeight, Math.max(halfHeight, this.y));
  }
}
