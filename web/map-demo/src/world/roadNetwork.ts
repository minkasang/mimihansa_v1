/**
 * 独立道路网络系统 - 真实道路渲染
 * 道路不再绑定到地图格子，而是独立的路径数据
 * 优化：预渲染到离屏 Canvas，运行时只复制
 */

export type RoadType = 'dirt' | 'stone';

export interface RoadPoint {
  x: number;
  y: number;
}

export interface RoadPath {
  id: string;
  points: RoadPoint[];
  width: number;
  type: RoadType;
  createdBy?: string;
  createdAt?: number;
}

const SUB_GRID_SIZE = 4; // 增大子格子减少计算量

export class RoadNetwork {
  paths: Map<string, RoadPath> = new Map();
  private tileSize: number = 32;
  private mapWidth: number = 0;
  private mapHeight: number = 0;
  /** 预渲染的离屏 Canvas */
  private bakedCanvas: HTMLCanvasElement | null = null;
  private isBaked: boolean = false;

  constructor(tileSize: number = 32) {
    this.tileSize = tileSize;
  }

  addPath(path: RoadPath): void {
    this.paths.set(path.id, path);
    this.isBaked = false; // 标记需要重新烘焙
  }

  removePath(id: string): void {
    this.paths.delete(id);
    this.isBaked = false;
  }

  createRoadFromLine(
    id: string,
    start: [number, number],
    end: [number, number],
    width: number,
    type: RoadType,
    steps: number = 100
  ): RoadPath {
    const points: RoadPoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: start[0] * this.tileSize + (end[0] - start[0]) * this.tileSize * t,
        y: start[1] * this.tileSize + (end[1] - start[1]) * this.tileSize * t
      });
    }
    const path: RoadPath = { id, points, width, type };
    this.addPath(path);
    return path;
  }

  /**
   * 设置地图尺寸并触发烘焙
   */
  setMapSize(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
    this.bakeRoads();
  }

  /**
   * 预渲染所有道路到离屏 Canvas
   */
  private bakeRoads(): void {
    if (this.mapWidth === 0 || this.mapHeight === 0) return;

    // 创建离屏 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = this.mapWidth;
    canvas.height = this.mapHeight;
    const ctx = canvas.getContext('2d')!;

    // 渲染所有道路
    for (const path of this.paths.values()) {
      this.bakeRoad(ctx, path);
    }

    this.bakedCanvas = canvas;
    this.isBaked = true;
    console.log('道路网络已烘焙:', this.paths.size, '条道路');
  }

  /**
   * 烘焙单条道路到离屏 Canvas
   */
  private bakeRoad(ctx: CanvasRenderingContext2D, path: RoadPath): void {
    if (path.points.length < 2) return;

    const bounds = this.getPathBounds(path);
    const startX = Math.floor(bounds.minX / SUB_GRID_SIZE) * SUB_GRID_SIZE;
    const startY = Math.floor(bounds.minY / SUB_GRID_SIZE) * SUB_GRID_SIZE;
    const endX = bounds.maxX;
    const endY = bounds.maxY;

    for (let y = startY; y < endY; y += SUB_GRID_SIZE) {
      for (let x = startX; x < endX; x += SUB_GRID_SIZE) {
        const cx = x + SUB_GRID_SIZE / 2;
        const cy = y + SUB_GRID_SIZE / 2;

        const { dist, onRoad } = this.getDistanceToRoad(cx, cy, path);
        if (!onRoad) continue;

        const halfWidth = path.width / 2;
        const edgeFactor = Math.max(0, Math.min(1, (halfWidth - dist) / 3));

        if (path.type === 'dirt') {
          this.drawDirtPixel(ctx, x, y, edgeFactor);
        } else {
          this.drawStonePixel(ctx, x, y, edgeFactor);
        }
      }
    }
  }

  /**
   * 运行时渲染 - 直接从离屏 Canvas 复制
   */
  render(ctx: CanvasRenderingContext2D, viewport: { x: number; y: number; width: number; height: number }): void {
    if (!this.isBaked || !this.bakedCanvas) {
      // 如果还没烘焙，先烘焙
      if (this.mapWidth > 0 && this.mapHeight > 0) {
        this.bakeRoads();
      }
      return;
    }

    // 计算可见区域
    const srcX = Math.max(0, viewport.x);
    const srcY = Math.max(0, viewport.y);
    const srcW = Math.min(viewport.width, this.bakedCanvas.width - srcX);
    const srcH = Math.min(viewport.height, this.bakedCanvas.height - srcY);

    if (srcW <= 0 || srcH <= 0) return;

    // 直接复制
    ctx.drawImage(
      this.bakedCanvas,
      srcX, srcY, srcW, srcH,
      srcX, srcY, srcW, srcH
    );
  }

  private drawDirtPixel(ctx: CanvasRenderingContext2D, x: number, y: number, edgeFactor: number): void {
    const noise = this.hash2D(x, y);
    let r = 196, g = 160, b = 90;

    if (noise > 0.5) {
      const variation = (noise - 0.5) * 30;
      r += variation;
      g += variation * 0.8;
      b += variation * 0.5;
    }

    r = Math.floor(r * (0.6 + 0.4 * edgeFactor));
    g = Math.floor(g * (0.6 + 0.4 * edgeFactor));
    b = Math.floor(b * (0.6 + 0.4 * edgeFactor));

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, SUB_GRID_SIZE, SUB_GRID_SIZE);

    if (noise > 0.95) {
      ctx.fillStyle = noise > 0.98 ? '#908878' : '#787060';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  private drawStonePixel(ctx: CanvasRenderingContext2D, x: number, y: number, edgeFactor: number): void {
    const stoneSize = 8;
    const sx = Math.floor(x / stoneSize) * stoneSize;
    const sy = Math.floor(y / stoneSize) * stoneSize;

    const isEven = (Math.floor(sx / stoneSize) + Math.floor(sy / stoneSize)) % 2 === 0;
    const baseColor = isEven ? '#C0C0C0' : '#B0B0B0';
    const variation = this.hash2D(sx, sy);

    let r = parseInt(baseColor.substring(1, 3), 16);
    let g = parseInt(baseColor.substring(3, 5), 16);
    let b = parseInt(baseColor.substring(5, 7), 16);

    const v = (variation - 0.5) * 15;
    r = Math.max(0, Math.min(255, r + v));
    g = Math.max(0, Math.min(255, g + v));
    b = Math.max(0, Math.min(255, b + v));

    r = Math.floor(r * (0.7 + 0.3 * edgeFactor));
    g = Math.floor(g * (0.7 + 0.3 * edgeFactor));
    b = Math.floor(b * (0.7 + 0.3 * edgeFactor));

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, SUB_GRID_SIZE, SUB_GRID_SIZE);

    const localX = x - sx;
    const localY = y - sy;
    if (localX === 0 || localY === 0) {
      ctx.fillStyle = '#686868';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  private getDistanceToRoad(x: number, y: number, path: RoadPath): { dist: number; onRoad: boolean } {
    const halfWidth = path.width / 2;
    let minDist = Infinity;

    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i];
      const p2 = path.points[i + 1];
      const dist = this.pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
      minDist = Math.min(minDist, dist);
    }

    const startDist = Math.hypot(x - path.points[0].x, y - path.points[0].y);
    const endDist = Math.hypot(x - path.points[path.points.length - 1].x, y - path.points[path.points.length - 1].y);
    minDist = Math.min(minDist, startDist, endDist);

    return { dist: minDist, onRoad: minDist <= halfWidth };
  }

  private pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);

    if (len === 0) return Math.hypot(px - x1, py - y1);

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.hypot(px - projX, py - projY);
  }

  private getPathBounds(path: RoadPath): { minX: number; minY: number; maxX: number; maxY: number } {
    const halfWidth = path.width / 2;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const p of path.points) {
      minX = Math.min(minX, p.x - halfWidth);
      minY = Math.min(minY, p.y - halfWidth);
      maxX = Math.max(maxX, p.x + halfWidth);
      maxY = Math.max(maxY, p.y + halfWidth);
    }
    return { minX, minY, maxX, maxY };
  }

  private hash2D(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  toJSON(): object {
    return {
      paths: Array.from(this.paths.values()),
      tileSize: this.tileSize
    };
  }

  static fromJSON(data: { paths: RoadPath[]; tileSize: number }): RoadNetwork {
    const network = new RoadNetwork(data.tileSize);
    for (const path of data.paths) {
      if (path.points.length < 10) {
        path.points = RoadNetwork.interpolatePoints(path.points, 100);
      }
      network.addPath(path);
    }
    return network;
  }

  private static interpolatePoints(points: RoadPoint[], steps: number): RoadPoint[] {
    if (points.length < 2) return points;

    const result: RoadPoint[] = [];
    const totalSegments = points.length - 1;
    const stepsPerSegment = Math.max(1, Math.floor(steps / totalSegments));

    for (let i = 0; i < totalSegments; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      for (let j = 0; j < stepsPerSegment; j++) {
        const t = j / stepsPerSegment;
        result.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t
        });
      }
    }

    result.push({ ...points[points.length - 1] });
    return result;
  }
}
