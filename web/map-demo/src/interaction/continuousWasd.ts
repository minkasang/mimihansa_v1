import { applyEdgeScrollCamera } from "./edgeScrollCamera";
import { tryStepTile } from "./gridMovement";

const REPEAT_MS = 72;
const MAX_STEPS_PER_FRAME = 4;

/** 当前按下的方向键（小写 wasd） */
function readMoveDelta(keys: ReadonlySet<string>): { dx: number; dy: number } | null {
  const w = keys.has("w");
  const s = keys.has("s");
  const a = keys.has("a");
  const d = keys.has("d");
  let dy = 0;
  let dx = 0;
  if (w && !s) dy = -1;
  else if (s && !w) dy = 1;
  if (a && !d) dx = -1;
  else if (d && !a) dx = 1;
  if (dy !== 0 && dx !== 0) return { dx: 0, dy };
  if (dy !== 0 || dx !== 0) return { dx, dy };
  return null;
}

export interface ContinuousWasdOptions {
  grid: Uint8Array;
  mapW: number;
  mapH: number;
  tilePx: number;
  getPlayer: () => { x: number; y: number };
  setPlayer: (x: number, y: number) => void;
  setFacingFromDelta: (dx: number, dy: number) => void;
  canvas: HTMLCanvasElement;
  getCam: () => { camX: number; camY: number; scale: number };
  setCam: (camX: number, camY: number) => void;
  clampCam: () => void;
  /** 边缘卷屏边距（像素） */
  edgeMarginPx: number;
  /** 每帧末尾：重绘 + 悬停格等 */
  onFrame: () => void;
  /** 开始移动时调用 */
  onMoveStart?: () => void;
  /** 停止移动时调用 */
  onMoveEnd?: () => void;
}

function attemptStep(
  opts: ContinuousWasdOptions,
  d: { dx: number; dy: number },
): boolean {
  const p = opts.getPlayer();
  const next = tryStepTile(opts.grid, opts.mapW, opts.mapH, p.x, p.y, d.dx, d.dy);
  if (!next) return false;
  opts.setPlayer(next.x, next.y);
  opts.setFacingFromDelta(d.dx, d.dy);
  return true;
}

/**
 * WASD 长按连续走格 + 每帧边缘卷屏。返回卸载函数。
 * 首次按下立即走一格（忽略 keydown 的 repeat）；之后按 REPEAT_MS 间隔走格。
 */
export function bindWasdContinuousGrid(opts: ContinuousWasdOptions): () => void {
  const keys = new Set<string>();
  let stepAcc = 0;

  const onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (k !== "w" && k !== "a" && k !== "s" && k !== "d") return;
    e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    const d = readMoveDelta(keys);
    if (d) {
      attemptStep(opts, d);
      stepAcc = 0;
    }
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (k !== "w" && k !== "a" && k !== "s" && k !== "d") return;
    keys.delete(k);
    e.preventDefault();
  };

  const onBlur = (): void => {
    keys.clear();
    stepAcc = 0;
  };

  let raf = 0;
  let lastTs = performance.now();
  let wasMoving = false;

  const tick = (now: number): void => {
    const dt = Math.min(100, now - lastTs);
    lastTs = now;

    const d = readMoveDelta(keys);
    const isMoving = d !== null;
    
    if (isMoving && !wasMoving) {
      opts.onMoveStart?.();
    } else if (!isMoving && wasMoving) {
      opts.onMoveEnd?.();
    }
    wasMoving = isMoving;

    if (d) {
      stepAcc += dt;
      let n = 0;
      while (stepAcc >= REPEAT_MS && n < MAX_STEPS_PER_FRAME) {
        stepAcc -= REPEAT_MS;
        if (!attemptStep(opts, d)) break;
        n++;
      }
    } else {
      stepAcc = 0;
    }

    const cam = opts.getCam();
    const p = opts.getPlayer();
    const scrolled = applyEdgeScrollCamera({
      camX: cam.camX,
      camY: cam.camY,
      scale: cam.scale,
      canvasW: opts.canvas.width,
      canvasH: opts.canvas.height,
      playerTileX: p.x,
      playerTileY: p.y,
      tilePx: opts.tilePx,
      marginPx: opts.edgeMarginPx,
    });
    opts.setCam(scrolled.camX, scrolled.camY);
    opts.clampCam();
    opts.onFrame();
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  raf = requestAnimationFrame(tick);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    cancelAnimationFrame(raf);
    keys.clear();
  };
}
