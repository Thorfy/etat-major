import type { LoadedWorld } from '../map/loadWorld.ts';
import { buildCoastField } from '../map/loadWorld.ts';
import type { Camera } from './Camera.ts';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders.ts';

/** Les bascules sont envoyées au GPU par tuiles de 64×64 cellules. */
const TILE_SHIFT = 6;

export interface Highlights {
  hoverProvince: number;
  selectedProvince: number;
  selectedOwner: number;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader : ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function hexToBytes(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export class MapRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly canvas: HTMLCanvasElement;
  private readonly world: LoadedWorld;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private readonly timerExt: object | null;
  private query: WebGLQuery | null = null;
  private readonly dirtyTiles = new Set<number>();
  private readonly supplyTiles = new Set<number>();
  private readonly fortTiles = new Set<number>();
  /** Fortification de chaque cellule, comme dans la simulation. */
  readonly forts: Uint8Array;
  /** Ravitaillement de chaque cellule, comme dans la simulation (0 : plein). */
  readonly supply: Uint8Array;
  private readonly homes: Uint16Array;
  private mapMode = 0;
  /** Dernière durée GPU mesurée, en ms (null si le navigateur ne l'expose pas). */
  gpuMs: number | null = null;

  constructor(canvas: HTMLCanvasElement, world: LoadedWorld) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 n\'est pas disponible dans ce navigateur.');
    const required = Math.max(world.data.width, world.data.height);
    if (gl.getParameter(gl.MAX_TEXTURE_SIZE) < required) {
      throw new Error(`La carte graphique ne gère pas les textures de ${required} pixels.`);
    }
    this.gl = gl;
    this.canvas = canvas;
    this.world = world;
    this.homes = new Uint16Array(world.data.provinces.length + 1);
    this.supply = new Uint8Array(world.data.width * world.data.height);
    this.forts = new Uint8Array(world.data.width * world.data.height);
    this.timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.setup();
  }

  private setup(): void {
    const { gl, world } = this;
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Programme : ${gl.getProgramInfoLog(program)}`);
    }
    gl.useProgram(program);
    gl.bindVertexArray(gl.createVertexArray());
    for (const name of [
      'uOwners', 'uProvinces', 'uPalette', 'uCoast', 'uProvinceHome', 'uWars', 'uTerrain', 'uCenter', 'uResolution', 'uZoom',
      'uHoverProvince', 'uSelectedProvince', 'uSelectedOwner', 'uEconomy', 'uMapMode', 'uSupply', 'uFort', 'uAllies',
    ]) {
      this.uniforms.set(name, gl.getUniformLocation(program, name));
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const { width, height, nations } = world.data;
    this.bindDataTexture(0, 'uOwners', gl.R16UI, width, height, gl.RED_INTEGER, gl.UNSIGNED_SHORT, world.ownerGrid);
    this.bindDataTexture(1, 'uProvinces', gl.R16UI, width, height, gl.RED_INTEGER, gl.UNSIGNED_SHORT, world.provinceGrid);

    const palette = new Uint8Array((nations.length + 1) * 4);
    nations.forEach((nation, index) => {
      palette.set([...hexToBytes(nation.color), 255], (index + 1) * 4);
    });
    this.bindDataTexture(2, 'uPalette', gl.RGBA8, nations.length + 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, palette);

    const coast = buildCoastField(world.provinceGrid, width, height);
    this.bindDataTexture(3, 'uCoast', gl.R8, coast.width, coast.height, gl.RED, gl.UNSIGNED_BYTE, coast.field);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);

    world.data.provinces.forEach((province, index) => {
      this.homes[index + 1] = province.nation + 1;
    });
    this.bindDataTexture(4, 'uProvinceHome', gl.R16UI, this.homes.length, 1, gl.RED_INTEGER, gl.UNSIGNED_SHORT, this.homes);

    const size = nations.length + 1;
    this.bindDataTexture(5, 'uWars', gl.R8, size, size, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(size * size));
    this.bindDataTexture(6, 'uTerrain', gl.R8, width, height, gl.RED, gl.UNSIGNED_BYTE, world.terrainGrid);
    this.bindDataTexture(7, 'uEconomy', gl.R8, this.homes.length, 1, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(this.homes.length));
    this.bindDataTexture(8, 'uSupply', gl.R8, width, height, gl.RED, gl.UNSIGNED_BYTE, this.supply);
    this.bindDataTexture(9, 'uFort', gl.R8, width, height, gl.RED, gl.UNSIGNED_BYTE, this.forts);
    this.bindDataTexture(10, 'uAllies', gl.R8, nations.length + 1, 1, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(nations.length + 1));
  }

  /** Nations à mettre en évidence comme alliées du pays sélectionné. */
  setAllies(nations: readonly number[]): void {
    const { gl } = this;
    const flags = new Uint8Array(this.world.data.nations.length + 1);
    for (const nation of nations) flags[nation] = 255;
    gl.activeTexture(gl.TEXTURE10);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, flags.length, 1, gl.RED, gl.UNSIGNED_BYTE, flags);
  }

  updateForts(cells: Uint32Array, values: Uint8Array): void {
    const { width } = this.world.data;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      this.forts[cell] = values[i];
      const x = cell % width;
      const y = (cell - x) / width;
      this.fortTiles.add((y >> TILE_SHIFT) * 65536 + (x >> TILE_SHIFT));
    }
  }

  /** Reporte les changements de ravitaillement ; l'envoi au GPU se fait au prochain rendu. */
  updateSupply(cells: Uint32Array, values: Uint8Array): void {
    const { width } = this.world.data;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      this.supply[cell] = values[i];
      const x = cell % width;
      const y = (cell - x) / width;
      this.supplyTiles.add((y >> TILE_SHIFT) * 65536 + (x >> TILE_SHIFT));
    }
  }

  /** Richesse de chaque province, de 0 à 255 (indice = identifiant de province). */
  updateEconomy(wealth: Uint8Array): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE7);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.homes.length, 1, gl.RED, gl.UNSIGNED_BYTE, wealth);
  }

  /** 0 : carte politique, 1 : carte économique, 2 : ravitaillement. */
  setMapMode(mode: number): void {
    this.mapMode = mode;
  }

  /** Une province annexée n'est plus hachurée : elle appartient à son nouveau pays. */
  private uploadHomes(): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.homes.length, 1, gl.RED_INTEGER, gl.UNSIGNED_SHORT, this.homes);
  }

  homeOf(province: number): number {
    return this.homes[province];
  }

  updateHomes(pairs: Uint16Array): void {
    for (let i = 0; i < pairs.length; i += 2) this.homes[pairs[i]] = pairs[i + 1];
    this.uploadHomes();
  }

  /** Remplace toute la carte, à la reprise d'une partie. */
  loadState(owners: Uint16Array, homes: Uint16Array): void {
    const { gl, world } = this;
    world.ownerGrid.set(owners);
    this.homes.set(homes);
    this.uploadHomes();
    gl.activeTexture(gl.TEXTURE0);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, world.data.width, world.data.height, gl.RED_INTEGER, gl.UNSIGNED_SHORT, world.ownerGrid);
    this.dirtyTiles.clear();
  }

  /** Reporte les bascules dans la grille ; l'envoi au GPU se fait au prochain rendu. */
  updateOwners(cells: Uint32Array, owners: Uint16Array): void {
    const { width } = this.world.data;
    const grid = this.world.ownerGrid;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      grid[cell] = owners[i];
      const x = cell % width;
      const y = (cell - x) / width;
      this.dirtyTiles.add((y >> TILE_SHIFT) * 65536 + (x >> TILE_SHIFT));
    }
  }

  private flushOwners(): void {
    this.flushTiles(this.dirtyTiles, 0, this.world.ownerGrid, this.gl.RED_INTEGER, this.gl.UNSIGNED_SHORT);
    // Le ravitaillement ne se voit que sur sa carte : inutile de l'envoyer avant.
    if (this.mapMode === 2) this.flushTiles(this.supplyTiles, 8, this.supply, this.gl.RED, this.gl.UNSIGNED_BYTE);
    this.flushTiles(this.fortTiles, 9, this.forts, this.gl.RED, this.gl.UNSIGNED_BYTE);
  }

  private flushTiles(tiles: Set<number>, unit: number, grid: ArrayBufferView, format: number, type: number): void {
    if (tiles.size === 0) return;
    const { gl, world } = this;
    const { width, height } = world.data;
    const size = 1 << TILE_SHIFT;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, width);
    for (const tile of tiles) {
      const x = (tile & 0xffff) << TILE_SHIFT;
      const y = (tile >>> 16) << TILE_SHIFT;
      gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, Math.min(size, width - x), Math.min(size, height - y), format, type, grid);
    }
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    tiles.clear();
  }

  setWars(pairs: [number, number][]): void {
    const { gl } = this;
    const size = this.world.data.nations.length + 1;
    const matrix = new Uint8Array(size * size);
    for (const [a, b] of pairs) {
      matrix[a * size + b] = 255;
      matrix[b * size + a] = 255;
    }
    gl.activeTexture(gl.TEXTURE5);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RED, gl.UNSIGNED_BYTE, matrix);
  }

  private bindDataTexture(
    unit: number,
    uniform: string,
    internalFormat: number,
    width: number,
    height: number,
    format: number,
    type: number,
    pixels: ArrayBufferView,
  ): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, pixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.uniforms.get(uniform)!, unit);
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(camera: Camera, dpr: number, highlights: Highlights): void {
    const { gl, uniforms } = this;
    this.flushOwners();
    gl.uniform2f(uniforms.get('uCenter')!, camera.x, camera.y);
    gl.uniform2f(uniforms.get('uResolution')!, this.canvas.width, this.canvas.height);
    gl.uniform1f(uniforms.get('uZoom')!, camera.zoom * dpr);
    gl.uniform1ui(uniforms.get('uHoverProvince')!, highlights.hoverProvince);
    gl.uniform1ui(uniforms.get('uSelectedProvince')!, highlights.selectedProvince);
    gl.uniform1ui(uniforms.get('uSelectedOwner')!, highlights.selectedOwner);
    gl.uniform1ui(uniforms.get('uMapMode')!, this.mapMode);

    const measuring = this.beginTiming();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (measuring) gl.endQuery(0x88bf /* TIME_ELAPSED_EXT */);
  }

  private beginTiming(): boolean {
    const { gl, timerExt } = this;
    if (!timerExt) return false;
    if (this.query) {
      if (!gl.getQueryParameter(this.query, gl.QUERY_RESULT_AVAILABLE)) return false;
      if (!gl.getParameter(0x8fbb /* GPU_DISJOINT_EXT */)) {
        this.gpuMs = gl.getQueryParameter(this.query, gl.QUERY_RESULT) / 1e6;
      }
      gl.deleteQuery(this.query);
    }
    this.query = gl.createQuery();
    gl.beginQuery(0x88bf, this.query!);
    return true;
  }
}
