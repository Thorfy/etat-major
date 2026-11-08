import { describe, expect, it } from 'vitest';
import { decodeRle, encodeRle } from '../src/map/codec.ts';
import { distanceToBoundary } from '../src/map/distance.ts';
import { buildCoastField } from '../src/map/loadWorld.ts';
import { MAP_HEIGHT, MAP_WIDTH, cellAreaKm2, latToY, lonToX, wrapDeltaX, xToLon, yToLat } from '../src/map/projection.ts';
import { Camera, MAX_ZOOM } from '../src/render/Camera.ts';
import { rasterizePolygon } from '../tools/lib/rasterize.ts';

describe('projection', () => {
  it('revient au point de départ', () => {
    for (const lat of [-55, -20, 0, 45.5, 80]) expect(yToLat(latToY(lat))).toBeCloseTo(lat, 6);
    for (const lon of [-179, 0, 2.35, 179]) expect(xToLon(lonToX(lon))).toBeCloseTo(lon, 6);
  });

  it('couvre les terres habitées sous 58° S', () => {
    expect(latToY(83.7)).toBeCloseTo(0, 6);
    expect(yToLat(MAP_HEIGHT)).toBeLessThan(-55);
  });

  it('additionne les rangées vers la surface réelle de la bande couverte', () => {
    let total = 0;
    for (let row = 0; row < MAP_HEIGHT; row++) total += cellAreaKm2(row) * MAP_WIDTH;
    const band = (lat: number) => Math.sin((lat * Math.PI) / 180);
    const expected = 2 * Math.PI * 6371 ** 2 * (band(83.7) - band(yToLat(MAP_HEIGHT)));
    expect(total / expected).toBeCloseTo(1, 3);
  });

  it('prend le chemin le plus court à travers le bouclage', () => {
    expect(wrapDeltaX(MAP_WIDTH - 10, 10)).toBe(20);
    expect(wrapDeltaX(10, MAP_WIDTH - 10)).toBe(-20);
  });
});

describe('codec', () => {
  it('restitue la grille à l\'identique', () => {
    const cells = new Uint16Array(200_000);
    cells.fill(7, 10, 100_000);
    cells[150_000] = 65535;
    expect(decodeRle(encodeRle(cells), cells.length)).toEqual(cells);
  });

  it('refuse une grille tronquée', () => {
    expect(() => decodeRle(Uint16Array.from([1, 5]), 10)).toThrow();
  });
});

describe('pixellisation', () => {
  const W = MAP_WIDTH;
  const H = MAP_HEIGHT;
  const box = (lon0: number, lat0: number, lon1: number, lat1: number) => [
    [lon0, lat0], [lon1, lat0], [lon1, lat1], [lon0, lat1], [lon0, lat0],
  ];

  it('remplit un rectangle à la bonne position', () => {
    const grid = new Uint16Array(W * H);
    const written = rasterizePolygon(grid, W, H, [box(0, 0, 10, 10)], 3);
    expect(written).toBeGreaterThan(0);
    const inside = Math.floor(latToY(5)) * W + Math.floor(lonToX(5));
    const outside = Math.floor(latToY(5)) * W + Math.floor(lonToX(15));
    expect(grid[inside]).toBe(3);
    expect(grid[outside]).toBe(0);
  });

  it('respecte les trous', () => {
    const grid = new Uint16Array(W * H);
    rasterizePolygon(grid, W, H, [box(0, 0, 10, 10), box(4, 4, 6, 6)], 3);
    expect(grid[Math.floor(latToY(5)) * W + Math.floor(lonToX(5))]).toBe(0);
    expect(grid[Math.floor(latToY(8)) * W + Math.floor(lonToX(8))]).toBe(3);
  });

  it('garde une petite île sans écraser l\'existant', () => {
    const grid = new Uint16Array(W * H);
    const island = box(20.01, 10.01, 20.05, 10.05);
    expect(rasterizePolygon(grid, W, H, [island], 4)).toBe(1);
    expect(rasterizePolygon(grid, W, H, [island], 5)).toBe(0);
    expect(grid.filter((id) => id === 5).length).toBe(0);
  });
});

describe('distance', () => {
  it('croît vers le centre d\'une zone', () => {
    const w = 11;
    const labels = new Uint8Array(w * w);
    for (let y = 1; y < w - 1; y++) for (let x = 1; x < w - 1; x++) labels[y * w + x] = 1;
    const d = distanceToBoundary(labels, w, w);
    expect(d[5 * w + 5]).toBeGreaterThan(d[1 * w + 1]);
    expect(d[1 * w + 5]).toBeCloseTo(1, 5);
  });
});

describe('dégradé côtier', () => {
  it('traverse la longitude 180° sans couture', () => {
    const width = 256;
    const height = 64;
    const grid = new Uint16Array(width * height);
    for (let y = 0; y < height; y++) grid[y * width] = grid[y * width + 1] = 1; // terre au bord gauche
    const { field, width: w } = buildCoastField(grid, width, height);
    const row = 16 * w;
    expect(field[row]).toBe(0);
    // Juste à droite de la terre et juste à gauche à travers la couture : même distance.
    expect(field[row + w - 1]).toBe(field[row + 1]);
    expect(field[row + w - 1]).toBeLessThan(20);
  });
});

describe('caméra', () => {
  const make = () => {
    const camera = new Camera(4096, 2048);
    camera.resize(1600, 900);
    camera.fit();
    return camera;
  };

  it('ne montre jamais au-delà des bords haut et bas', () => {
    const camera = make();
    camera.panPixels(0, 100_000);
    expect(camera.screenToWorld(0, 0).y).toBeCloseTo(0, 6);
    camera.panPixels(0, -100_000);
    expect(camera.screenToWorld(0, 900).y).toBeCloseTo(2048, 6);
  });

  it('boucle en longitude', () => {
    const camera = make();
    camera.panPixels(camera.zoom * 3000, 0);
    camera.panPixels(camera.zoom * 3000, 0);
    expect(camera.x).toBeGreaterThanOrEqual(0);
    expect(camera.x).toBeLessThan(4096);
    expect(camera.screenToCell(800, 450)!.x).toBeLessThan(4096);
  });

  it('garde fixe le point sous le curseur au zoom', () => {
    const camera = make();
    const before = camera.screenToWorld(1000, 500);
    camera.zoomAt(4, 1000, 500);
    const after = camera.screenToWorld(1000, 500);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('borne le zoom', () => {
    const camera = make();
    camera.zoomAt(1e6, 0, 0);
    expect(camera.zoom).toBe(MAX_ZOOM);
    camera.zoomAt(1e-6, 0, 0);
    expect(camera.zoom).toBe(camera.minZoom);
  });
});
