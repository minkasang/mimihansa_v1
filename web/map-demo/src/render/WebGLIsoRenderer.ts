import { CellTerrain, type TileGrid } from "../world/tileGrid";
import { type BuildingDef } from "../world/mapData";

export interface IsoRenderConfig {
  tileHalfWidth: number;
  tileHalfHeight: number;
  heightScale: number;
  waterDepth: number;
  baseElevation: number;
  backgroundColor: [number, number, number, number];
}

const DEFAULT_CONFIG: IsoRenderConfig = {
  tileHalfWidth: 32,
  tileHalfHeight: 16,
  heightScale: 4,
  waterDepth: 3,
  baseElevation: 5,
  backgroundColor: [0.051, 0.106, 0.165, 1.0],
};

interface TerrainColorEntry {
  top: [number, number, number];
  left: [number, number, number];
  right: [number, number, number];
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

function buildTerrainLUT(): TerrainColorEntry[] {
  const grassColors = [
    { t: "#6B9E42", l: "#5A8A38", r: "#4A7A30" },
    { t: "#7CB342", l: "#6A9E38", r: "#5A8E30" },
    { t: "#5D8C3A", l: "#4D7C32", r: "#3D6C28" },
    { t: "#8BC34A", l: "#7AAF40", r: "#6A9F38" },
  ];
  const dirtColors = [
    { t: "#B8956A", l: "#A08055", r: "#8B7048" },
    { t: "#A08050", l: "#8B7040", r: "#7A6038" },
    { t: "#C4A574", l: "#B09060", r: "#9A8050" },
    { t: "#9A7B55", l: "#8A6B48", r: "#7A5B40" },
  ];
  const stoneColors = [
    { t: "#9A9A9A", l: "#8A8A8A", r: "#7A7A7A" },
    { t: "#A8A8A8", l: "#989898", r: "#888888" },
    { t: "#B8B8B8", l: "#A8A8A8", r: "#989898" },
    { t: "#8A8A8A", l: "#7A7A7A", r: "#6A6A6A" },
  ];
  const waterColors = [
    { t: "#4A9BC8", l: "#3A8BB8", r: "#2A7BA8" },
    { t: "#5AABD8", l: "#4A9BC8", r: "#3A8BB8" },
    { t: "#3A8BB8", l: "#2A7BA8", r: "#1E6B98" },
    { t: "#6BBBE8", l: "#5AABD8", r: "#4A9BC8" },
  ];
  const roadColors = [
    { t: "#C4A05A", l: "#B09050", r: "#A08048" },
    { t: "#B09050", l: "#A08048", r: "#907040" },
    { t: "#D0B070", l: "#C0A060", r: "#B09050" },
    { t: "#A08048", l: "#907040", r: "#806038" },
  ];

  const terrainGroups: Record<string, typeof grassColors> = {
    grass: grassColors,
    dirt: dirtColors,
    stone: stoneColors,
    water: waterColors,
    road: roadColors,
  };

  const terrainToGroup: Record<number, string> = {
    [CellTerrain.GRASS]: "grass",
    [CellTerrain.DIRT]: "dirt",
    [CellTerrain.STONE]: "stone",
    [CellTerrain.WATER]: "water",
    [CellTerrain.ROAD_EDGE]: "road",
    [CellTerrain.ROAD_CENTER]: "road",
    [CellTerrain.ROAD_CROSS]: "road",
  };

  const maxTerrain = Math.max(...Object.keys(terrainToGroup).map(Number));
  const lut: TerrainColorEntry[] = new Array(maxTerrain + 1).fill(null as any);

  for (const [terrainStr, group] of Object.entries(terrainToGroup)) {
    const terrain = Number(terrainStr);
    const colors = terrainGroups[group];
    const avg: TerrainColorEntry = {
      top: [0, 0, 0],
      left: [0, 0, 0],
      right: [0, 0, 0],
    };
    for (const c of colors) {
      const t = hexToRgb(c.t);
      const l = hexToRgb(c.l);
      const r = hexToRgb(c.r);
      avg.top[0] += t[0]; avg.top[1] += t[1]; avg.top[2] += t[2];
      avg.left[0] += l[0]; avg.left[1] += l[1]; avg.left[2] += l[2];
      avg.right[0] += r[0]; avg.right[1] += r[1]; avg.right[2] += r[2];
    }
    const n = colors.length;
    avg.top[0] /= n; avg.top[1] /= n; avg.top[2] /= n;
    avg.left[0] /= n; avg.left[1] /= n; avg.left[2] /= n;
    avg.right[0] /= n; avg.right[1] /= n; avg.right[2] /= n;
    lut[terrain] = avg;
  }

  return lut;
}

function getElevation(terrain: CellTerrain, config: IsoRenderConfig): number {
  if (terrain === CellTerrain.WATER) return 0;
  if (terrain === CellTerrain.DIRT) return 3;
  if (terrain === CellTerrain.STONE) return 8;
  if (terrain >= CellTerrain.ROAD_EDGE) return terrain === CellTerrain.ROAD_EDGE ? 5 : 4;
  return config.baseElevation;
}

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_gridPos;
attribute float a_terrain;
attribute float a_elev;
attribute float a_face;
attribute float a_variant;
attribute vec3 a_colorTop;
attribute vec3 a_colorLeft;
attribute vec3 a_colorRight;

uniform vec2 u_camera;
uniform float u_zoom;
uniform vec2 u_screenSize;
uniform float u_tileHW;
uniform float u_tileHH;
uniform float u_heightScale;
uniform float u_mapOffsetX;
uniform float u_mapOffsetY;

varying vec3 v_color;
varying float v_terrain;
varying float v_face;
varying float v_variant;
varying vec2 v_gridPos;

vec2 gridToIso(vec2 grid, float elev) {
  float wx = u_mapOffsetX + (grid.x - grid.y) * u_tileHW;
  float wy = u_mapOffsetY + (grid.x + grid.y) * u_tileHH - elev * u_heightScale;
  return vec2(wx, wy);
}

void main() {
  v_terrain = a_terrain;
  v_face = a_face;
  v_variant = a_variant;
  v_gridPos = a_gridPos;

  int face = int(a_face);
  if (face == 0) {
    v_color = a_colorTop;
  } else if (face == 1) {
    v_color = a_colorLeft;
  } else {
    v_color = a_colorRight;
  }

  float noise = fract(sin(dot(a_gridPos, vec2(127.1, 311.7))) * 43758.5453);
  v_color *= (0.95 + noise * 0.1);

  vec2 worldCenter = gridToIso(a_gridPos, a_elev);
  vec2 worldPos = worldCenter + a_position;
  vec2 screenPos = (worldPos - u_camera) * u_zoom;
  vec2 ndc = screenPos / (u_screenSize * 0.5);
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec3 v_color;
varying float v_terrain;
varying float v_face;
varying float v_variant;
varying vec2 v_gridPos;

void main() {
  vec3 color = v_color;
  color *= (0.88 + v_face * 0.06);
  gl_FragColor = vec4(color, 1.0);
}
`;

export class WebGLIsoRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private config: IsoRenderConfig;

  private a_position: number;
  private a_gridPos: number;
  private a_terrain: number;
  private a_elev: number;
  private a_face: number;
  private a_variant: number;
  private a_colorTop: number;
  private a_colorLeft: number;
  private a_colorRight: number;

  private u_camera: WebGLUniformLocation | null;
  private u_zoom: WebGLUniformLocation | null;
  private u_screenSize: WebGLUniformLocation | null;
  private u_tileHW: WebGLUniformLocation | null;
  private u_tileHH: WebGLUniformLocation | null;
  private u_heightScale: WebGLUniformLocation | null;
  private u_mapOffsetX: WebGLUniformLocation | null;
  private u_mapOffsetY: WebGLUniformLocation | null;

  private vertexBuffer: WebGLBuffer | null = null;
  private vertexCount = 0;
  private mapWidth = 0;
  private mapHeight = 0;

  constructor(canvas: HTMLCanvasElement, config?: Partial<IsoRenderConfig>) {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);

    this.a_position = gl.getAttribLocation(this.program, "a_position");
    this.a_gridPos = gl.getAttribLocation(this.program, "a_gridPos");
    this.a_terrain = gl.getAttribLocation(this.program, "a_terrain");
    this.a_elev = gl.getAttribLocation(this.program, "a_elev");
    this.a_face = gl.getAttribLocation(this.program, "a_face");
    this.a_variant = gl.getAttribLocation(this.program, "a_variant");
    this.a_colorTop = gl.getAttribLocation(this.program, "a_colorTop");
    this.a_colorLeft = gl.getAttribLocation(this.program, "a_colorLeft");
    this.a_colorRight = gl.getAttribLocation(this.program, "a_colorRight");

    this.u_camera = gl.getUniformLocation(this.program, "u_camera");
    this.u_zoom = gl.getUniformLocation(this.program, "u_zoom");
    this.u_screenSize = gl.getUniformLocation(this.program, "u_screenSize");
    this.u_tileHW = gl.getUniformLocation(this.program, "u_tileHW");
    this.u_tileHH = gl.getUniformLocation(this.program, "u_tileHH");
    this.u_heightScale = gl.getUniformLocation(this.program, "u_heightScale");
    this.u_mapOffsetX = gl.getUniformLocation(this.program, "u_mapOffsetX");
    this.u_mapOffsetY = gl.getUniformLocation(this.program, "u_mapOffsetY");

    const bg = this.config.backgroundColor;
    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${info}`);
    }
    return shader;
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link failed: ${info}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return program;
  }

  uploadMapData(grid: TileGrid, mapW: number, mapH: number, buildings?: BuildingDef[]): void {
    const gl = this.gl;
    this.mapWidth = mapW;
    this.mapHeight = mapH;
    const cfg = this.config;
    const hw = cfg.tileHalfWidth;
    const hh = cfg.tileHalfHeight;
    const hs = cfg.heightScale;

    const lut = buildTerrainLUT();

    const buildingCells = new Set<number>();
    if (buildings) {
      for (const b of buildings) {
        const [x1, y1, x2, y2] = b.bounds;
        for (let by = y1; by <= y2; by++)
          for (let bx = x1; bx <= x2; bx++)
            buildingCells.add(by * mapW + bx);
      }
    }

    const FLOATS_PER_VERTEX = 16;
    const VERTICES_PER_TILE = 18;
    const maxTiles = mapW * mapH;
    const data = new Float32Array(maxTiles * VERTICES_PER_TILE * FLOATS_PER_VERTEX);

    let idx = 0;

    const pushVertex = (
      px: number, py: number,
      gx: number, gy: number,
      terrain: number, elev: number, face: number, variant: number,
      ct: [number, number, number], cl: [number, number, number], cr: [number, number, number],
    ) => {
      data[idx++] = px; data[idx++] = py;
      data[idx++] = gx; data[idx++] = gy;
      data[idx++] = terrain; data[idx++] = elev; data[idx++] = face; data[idx++] = variant;
      data[idx++] = ct[0]; data[idx++] = ct[1]; data[idx++] = ct[2];
      data[idx++] = cl[0]; data[idx++] = cl[1]; data[idx++] = cl[2];
      data[idx++] = cr[0]; data[idx++] = cr[1]; data[idx++] = cr[2];
    };

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const cell = grid.getCell(x, y);
        if (!cell) continue;

        const isBuilding = buildingCells.has(y * mapW + x);
        const cellElev = isBuilding ? cfg.baseElevation : getElevation(cell.terrain, cfg);
        const terrain = cell.terrain;
        const variant = Math.floor(hash2D(x, y) * 4);

        const colors = lut[terrain] || lut[CellTerrain.GRASS];
        const ct = colors.top;
        const cl = colors.left;
        const cr = colors.right;

        const sideH = cellElev * hs;

        // Top face (diamond): 2 triangles
        //   0(top) -> 1(left) -> 2(right)
        //   1(left) -> 3(bottom) -> 2(right)
        pushVertex(0, -hh, x, y, terrain, cellElev, 0, variant, ct, cl, cr);
        pushVertex(-hw, 0, x, y, terrain, cellElev, 0, variant, ct, cl, cr);
        pushVertex(hw, 0, x, y, terrain, cellElev, 0, variant, ct, cl, cr);

        pushVertex(-hw, 0, x, y, terrain, cellElev, 0, variant, ct, cl, cr);
        pushVertex(0, hh, x, y, terrain, cellElev, 0, variant, ct, cl, cr);
        pushVertex(hw, 0, x, y, terrain, cellElev, 0, variant, ct, cl, cr);

        // Left face: 0(top) -> -hw,0 -> -hw,sideH -> 0,sideH
        //   Triangles: (0,-hh) -> (-hw,0) -> (-hw,sideH)  and  (0,-hh) -> (-hw,sideH) -> (0,sideH-hh)
        pushVertex(0, -hh, x, y, terrain, cellElev, 1, variant, ct, cl, cr);
        pushVertex(-hw, 0, x, y, terrain, cellElev, 1, variant, ct, cl, cr);
        pushVertex(-hw, sideH, x, y, terrain, cellElev, 1, variant, ct, cl, cr);

        pushVertex(0, -hh, x, y, terrain, cellElev, 1, variant, ct, cl, cr);
        pushVertex(-hw, sideH, x, y, terrain, cellElev, 1, variant, ct, cl, cr);
        pushVertex(0, sideH - hh, x, y, terrain, cellElev, 1, variant, ct, cl, cr);

        // Right face: 0(top) -> hw,0 -> hw,sideH -> 0,sideH
        pushVertex(0, -hh, x, y, terrain, cellElev, 2, variant, ct, cl, cr);
        pushVertex(hw, 0, x, y, terrain, cellElev, 2, variant, ct, cl, cr);
        pushVertex(hw, sideH, x, y, terrain, cellElev, 2, variant, ct, cl, cr);

        pushVertex(0, -hh, x, y, terrain, cellElev, 2, variant, ct, cl, cr);
        pushVertex(hw, sideH, x, y, terrain, cellElev, 2, variant, ct, cl, cr);
        pushVertex(0, sideH - hh, x, y, terrain, cellElev, 2, variant, ct, cl, cr);
      }
    }

    this.vertexCount = idx / FLOATS_PER_VERTEX;

    if (!this.vertexBuffer) {
      this.vertexBuffer = gl.createBuffer();
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, idx), gl.STATIC_DRAW);

    console.log(`[WebGLIsoRenderer] Uploaded ${this.vertexCount} vertices (${Math.round(this.vertexCount / 18)} tiles)`);
  }

  render(cameraX: number, cameraY: number, zoom: number, screenW: number, screenH: number): void {
    const gl = this.gl;
    const cfg = this.config;

    gl.viewport(0, 0, screenW, screenH);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    const stride = 16 * 4;
    const enableAttr = (loc: number, size: number, offset: number) => {
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    };

    enableAttr(this.a_position, 2, 0);
    enableAttr(this.a_gridPos, 2, 8);
    enableAttr(this.a_terrain, 1, 16);
    enableAttr(this.a_elev, 1, 20);
    enableAttr(this.a_face, 1, 24);
    enableAttr(this.a_variant, 1, 28);
    enableAttr(this.a_colorTop, 3, 32);
    enableAttr(this.a_colorLeft, 3, 44);
    enableAttr(this.a_colorRight, 3, 56);

    gl.uniform2f(this.u_camera, cameraX, cameraY);
    gl.uniform1f(this.u_zoom, zoom);
    gl.uniform2f(this.u_screenSize, screenW, screenH);
    gl.uniform1f(this.u_tileHW, cfg.tileHalfWidth);
    gl.uniform1f(this.u_tileHH, cfg.tileHalfHeight);
    gl.uniform1f(this.u_heightScale, cfg.heightScale);
    gl.uniform1f(this.u_mapOffsetX, (this.mapHeight - 1) * cfg.tileHalfWidth);
    gl.uniform1f(this.u_mapOffsetY, 20);

    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
  }

  destroy(): void {
    const gl = this.gl;
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.program) gl.deleteProgram(this.program);
  }
}
