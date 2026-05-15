/**
 * 精灵表生成工具
 * 将单张角色图片切割成精灵表，或生成示例精灵表
 */

export type Facing = "down" | "up" | "left" | "right";
export type AnimationState = "idle" | "walk";

export interface SpriteSheetConfig {
  /** 单帧宽度 */
  frameWidth: number;
  /** 单帧高度 */
  frameHeight: number;
  /** 动画类型列表 */
  animations: string[];
  /** 朝向列表 */
  directions: string[];
  /** 每动画帧数 */
  framesPerAnimation: number;
}

export const DEFAULT_CONFIG: SpriteSheetConfig = {
  frameWidth: 32,
  frameHeight: 64,
  animations: ["idle", "walk"],
  directions: ["down", "up", "left"],
  framesPerAnimation: 4,
};

/**
 * 生成示例精灵表（程序化绘制，用于测试）
 */
export function generateSampleSpriteSheet(
  config: Partial<SpriteSheetConfig> = {}
): HTMLCanvasElement {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cols = cfg.framesPerAnimation;
  const rows = cfg.animations.length * cfg.directions.length;

  const canvas = document.createElement("canvas");
  canvas.width = cfg.frameWidth * cols;
  canvas.height = cfg.frameHeight * rows;
  const ctx = canvas.getContext("2d")!;

  // 填充透明背景
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let row = 0;
  for (const anim of cfg.animations) {
    for (const dir of cfg.directions) {
      for (let frame = 0; frame < cfg.framesPerAnimation; frame++) {
        const x = frame * cfg.frameWidth;
        const y = row * cfg.frameHeight;
        drawSampleFrame(ctx, x, y, cfg.frameWidth, cfg.frameHeight, anim, dir, frame);
      }
      row++;
    }
  }

  return canvas;
}

/**
 * 绘制示例单帧（32×64 精美角色）
 */
function drawSampleFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  anim: string,
  dir: string,
  frame: number
): void {
  ctx.save();
  ctx.translate(x, y);

  // 走路动画偏移
  const walkOffset = anim === "walk" ? getWalkOffset(frame) : { body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };

  // 绘制阴影
  drawShadow(ctx, w);

  // 绘制身体各部分
  drawLegs32(ctx, w, h, dir, walkOffset);
  drawBody32(ctx, w, h, dir, walkOffset);
  drawHead32(ctx, w, h, dir);
  drawHair32(ctx, w, h, dir);

  ctx.restore();
}

function getWalkOffset(frame: number) {
  const cycle = [0, 1, 0, -1];
  const offset = cycle[frame % 4] ?? 0;
  return {
    body: frame === 1 || frame === 3 ? -1 : 0,
    leftArm: -offset,
    rightArm: offset,
    leftLeg: offset,
    rightLeg: -offset,
  };
}

function drawShadow(ctx: CanvasRenderingContext2D, w: number): void {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(w / 2, 62, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHead32(ctx: CanvasRenderingContext2D, w: number, h: number, dir: string): void {
  const centerX = w / 2;
  const headY = 8;
  const headW = 20;
  const headH = 18;

  // 脸部底色（圆脸）
  ctx.fillStyle = "#f5d0b0";
  ctx.beginPath();
  ctx.ellipse(centerX, headY + headH / 2, headW / 2, headH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 脸部阴影
  ctx.fillStyle = "#e8c4a0";
  ctx.beginPath();
  ctx.ellipse(centerX, headY + headH / 2 + 2, headW / 2 - 1, headH / 2 - 2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (dir === "down") {
    // 正面眼睛
    drawEyesDown32(ctx, centerX, headY);
    // 嘴巴
    ctx.fillStyle = "#d4a574";
    ctx.beginPath();
    ctx.arc(centerX, headY + 14, 2, 0, Math.PI);
    ctx.fill();
  } else if (dir === "up") {
    // 背面不画脸
  } else {
    // 侧面眼睛
    drawEyesSide32(ctx, centerX, headY, dir);
  }

  // 耳朵
  ctx.fillStyle = "#e8c4a0";
  if (dir === "down") {
    ctx.beginPath();
    ctx.arc(centerX - 10, headY + 8, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + 10, headY + 8, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (dir === "left") {
    ctx.beginPath();
    ctx.arc(centerX + 10, headY + 8, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (dir === "right") {
    ctx.beginPath();
    ctx.arc(centerX - 10, headY + 8, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEyesDown32(ctx: CanvasRenderingContext2D, centerX: number, headY: number): void {
  // 左眼
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(centerX - 5, headY + 8, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 右眼
  ctx.beginPath();
  ctx.ellipse(centerX + 5, headY + 8, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 虹膜
  ctx.fillStyle = "#2d5016";
  ctx.beginPath();
  ctx.ellipse(centerX - 5, headY + 8, 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(centerX + 5, headY + 8, 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 瞳孔
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(centerX - 5, headY + 8, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + 5, headY + 8, 1, 0, Math.PI * 2);
  ctx.fill();

  // 高光
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(centerX - 4, headY + 7, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + 6, headY + 7, 1, 0, Math.PI * 2);
  ctx.fill();
}

function drawEyesSide32(ctx: CanvasRenderingContext2D, centerX: number, headY: number, dir: string): void {
  const eyeX = dir === "left" ? centerX + 4 : centerX - 4;

  // 眼白
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(eyeX, headY + 8, 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 虹膜
  ctx.fillStyle = "#2d5016";
  ctx.beginPath();
  ctx.ellipse(eyeX, headY + 8, 1.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 瞳孔
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(eyeX, headY + 8, 1, 0, Math.PI * 2);
  ctx.fill();

  // 高光
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(eyeX + (dir === "left" ? 0.5 : -0.5), headY + 7, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawHair32(ctx: CanvasRenderingContext2D, w: number, h: number, dir: string): void {
  const centerX = w / 2;
  const hairY = 4;

  if (dir === "down") {
    // 长发 - 有层次感
    ctx.fillStyle = "#8b4513";
    // 顶部头发
    ctx.beginPath();
    ctx.ellipse(centerX, hairY + 4, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 刘海
    ctx.fillStyle = "#6b3410";
    ctx.beginPath();
    ctx.ellipse(centerX, hairY + 6, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 两侧长发
    ctx.fillStyle = "#8b4513";
    ctx.fillRect(centerX - 12, hairY + 6, 4, 12);
    ctx.fillRect(centerX + 8, hairY + 6, 4, 12);

    // 头发高光
    ctx.fillStyle = "#a0522d";
    ctx.beginPath();
    ctx.ellipse(centerX - 3, hairY + 3, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (dir === "up") {
    // 背面头发
    ctx.fillStyle = "#8b4513";
    ctx.beginPath();
    ctx.ellipse(centerX, hairY + 4, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 长发背影
    ctx.fillRect(centerX - 10, hairY + 6, 20, 14);
    ctx.fillStyle = "#6b3410";
    ctx.fillRect(centerX - 8, hairY + 14, 16, 6);
  } else {
    // 侧面头发
    const isLeft = dir === "left";
    const offsetX = isLeft ? 2 : -2;

    ctx.fillStyle = "#8b4513";
    ctx.beginPath();
    ctx.ellipse(centerX + offsetX, hairY + 4, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 侧面长发
    ctx.fillRect(centerX + (isLeft ? -10 : 0), hairY + 6, 10, 12);

    ctx.fillStyle = "#6b3410";
    ctx.fillRect(centerX + (isLeft ? -8 : 2), hairY + 14, 6, 4);
  }
}

function drawBody32(ctx: CanvasRenderingContext2D, w: number, h: number, dir: string, walkOffset: { body: number; leftArm: number; rightArm: number }): void {
  const centerX = w / 2;
  const bodyY = 26 + walkOffset.body;

  if (dir === "down") {
    // 身体
    ctx.fillStyle = "#cd853f";
    ctx.fillRect(centerX - 8, bodyY, 16, 18);

    // 衣服阴影
    ctx.fillStyle = "#b0783a";
    ctx.fillRect(centerX - 8, bodyY + 12, 16, 6);
    ctx.fillRect(centerX + 6, bodyY + 2, 2, 14);

    // 衣服高光
    ctx.fillStyle = "#daa06d";
    ctx.fillRect(centerX - 6, bodyY, 4, 10);

    // 领口
    ctx.fillStyle = "#f5d0b0";
    ctx.fillRect(centerX - 3, bodyY, 6, 3);

    // 手臂
    drawArmsDown32(ctx, centerX, bodyY, walkOffset);
  } else if (dir === "up") {
    // 背面身体
    ctx.fillStyle = "#cd853f";
    ctx.fillRect(centerX - 8, bodyY, 16, 18);

    ctx.fillStyle = "#b0783a";
    ctx.fillRect(centerX - 8, bodyY, 16, 4);

    // 背面手臂
    drawArmsUp32(ctx, centerX, bodyY, walkOffset);
  } else {
    // 侧面身体
    const isLeft = dir === "left";
    const offsetX = isLeft ? 2 : -2;

    ctx.fillStyle = "#cd853f";
    ctx.fillRect(centerX + offsetX - 6, bodyY, 12, 18);

    ctx.fillStyle = "#b0783a";
    ctx.fillRect(centerX + offsetX - 6, bodyY + 12, 12, 6);

    if (isLeft) {
      ctx.fillRect(centerX + offsetX + 4, bodyY + 2, 2, 12);
    } else {
      ctx.fillRect(centerX + offsetX - 6, bodyY + 2, 2, 12);
    }

    // 侧面手臂
    drawArmsSide32(ctx, centerX, bodyY, dir, walkOffset);
  }
}

function drawArmsDown32(ctx: CanvasRenderingContext2D, centerX: number, bodyY: number, walkOffset: { leftArm: number; rightArm: number }): void {
  const leftArmY = bodyY + 3 + walkOffset.leftArm;
  const rightArmY = bodyY + 3 + walkOffset.rightArm;

  // 左臂
  ctx.fillStyle = "#cd853f";
  ctx.fillRect(centerX - 12, leftArmY, 4, 12);
  ctx.fillStyle = "#b0783a";
  ctx.fillRect(centerX - 12, leftArmY, 2, 10);

  // 左手
  ctx.fillStyle = "#f5d0b0";
  ctx.fillRect(centerX - 12, leftArmY + 12, 4, 3);

  // 右臂
  ctx.fillStyle = "#cd853f";
  ctx.fillRect(centerX + 8, rightArmY, 4, 12);
  ctx.fillStyle = "#b0783a";
  ctx.fillRect(centerX + 10, rightArmY, 2, 10);

  // 右手
  ctx.fillStyle = "#f5d0b0";
  ctx.fillRect(centerX + 8, rightArmY + 12, 4, 3);
}

function drawArmsUp32(ctx: CanvasRenderingContext2D, centerX: number, bodyY: number, walkOffset: { leftArm: number; rightArm: number }): void {
  const leftArmY = bodyY + 3 + walkOffset.leftArm;
  const rightArmY = bodyY + 3 + walkOffset.rightArm;

  ctx.fillStyle = "#cd853f";
  ctx.fillRect(centerX - 12, leftArmY, 4, 12);
  ctx.fillRect(centerX + 8, rightArmY, 4, 12);

  ctx.fillStyle = "#f5d0b0";
  ctx.fillRect(centerX - 12, leftArmY + 12, 4, 3);
  ctx.fillRect(centerX + 8, rightArmY + 12, 4, 3);
}

function drawArmsSide32(ctx: CanvasRenderingContext2D, centerX: number, bodyY: number, dir: string, walkOffset: { leftArm: number; rightArm: number }): void {
  const isLeft = dir === "left";
  const armY = bodyY + 3 + (isLeft ? walkOffset.leftArm : walkOffset.rightArm);

  if (isLeft) {
    // 左侧面 - 右臂在前
    ctx.fillStyle = "#cd853f";
    ctx.fillRect(centerX + 6, armY, 4, 12);
    ctx.fillStyle = "#b0783a";
    ctx.fillRect(centerX + 8, armY, 2, 10);
    ctx.fillStyle = "#f5d0b0";
    ctx.fillRect(centerX + 6, armY + 12, 4, 3);
  } else {
    // 右侧面 - 左臂在前
    ctx.fillStyle = "#cd853f";
    ctx.fillRect(centerX - 10, armY, 4, 12);
    ctx.fillStyle = "#b0783a";
    ctx.fillRect(centerX - 10, armY, 2, 10);
    ctx.fillStyle = "#f5d0b0";
    ctx.fillRect(centerX - 10, armY + 12, 4, 3);
  }
}

function drawLegs32(ctx: CanvasRenderingContext2D, w: number, h: number, dir: string, walkOffset: { leftLeg: number; rightLeg: number }): void {
  const centerX = w / 2;
  const legY = 44;

  if (dir === "down") {
    const leftLegX = centerX - 6 + walkOffset.leftLeg;
    const rightLegX = centerX + 2 + walkOffset.rightLeg;

    // 左腿
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(leftLegX, legY, 5, 16);
    ctx.fillStyle = "#1a252f";
    ctx.fillRect(leftLegX + 3, legY, 2, 16);
    ctx.fillStyle = "#34495e";
    ctx.fillRect(leftLegX, legY, 2, 12);

    // 右腿
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(rightLegX, legY, 5, 16);
    ctx.fillStyle = "#1a252f";
    ctx.fillRect(rightLegX + 3, legY, 2, 16);
    ctx.fillStyle = "#34495e";
    ctx.fillRect(rightLegX, legY, 2, 12);

    // 鞋子
    drawShoesDown32(ctx, leftLegX, rightLegX);
  } else if (dir === "up") {
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(centerX - 6, legY, 5, 16);
    ctx.fillRect(centerX + 1, legY, 5, 16);

    ctx.fillStyle = "#1a252f";
    ctx.fillRect(centerX - 4, legY, 2, 16);
    ctx.fillRect(centerX + 3, legY, 2, 16);

    drawShoesUp32(ctx, centerX);
  } else {
    const isLeft = dir === "left";
    const offsetX = isLeft ? 2 : -2;
    const legOffset = isLeft ? walkOffset.leftLeg : walkOffset.rightLeg;

    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(centerX + offsetX - 4, legY + Math.abs(legOffset), 8, 16);

    ctx.fillStyle = "#1a252f";
    if (isLeft) {
      ctx.fillRect(centerX + offsetX + 2, legY, 2, 16);
    } else {
      ctx.fillRect(centerX + offsetX - 4, legY, 2, 16);
    }

    drawShoesSide32(ctx, centerX, legOffset, dir);
  }
}

function drawShoesDown32(ctx: CanvasRenderingContext2D, leftLegX: number, rightLegX: number): void {
  ctx.fillStyle = "#3e2723";
  ctx.fillRect(leftLegX - 1, 58, 7, 4);
  ctx.fillRect(rightLegX - 1, 58, 7, 4);

  ctx.fillStyle = "#2d1b18";
  ctx.fillRect(leftLegX + 4, 58, 2, 4);
  ctx.fillRect(rightLegX + 4, 58, 2, 4);
}

function drawShoesUp32(ctx: CanvasRenderingContext2D, centerX: number): void {
  ctx.fillStyle = "#3e2723";
  ctx.fillRect(centerX - 6, 58, 5, 4);
  ctx.fillRect(centerX + 1, 58, 5, 4);
}

function drawShoesSide32(ctx: CanvasRenderingContext2D, centerX: number, legOffset: number, dir: string): void {
  const isLeft = dir === "left";
  const offsetX = isLeft ? 2 : -2;
  const shoeY = 58 + Math.abs(legOffset);

  ctx.fillStyle = "#3e2723";
  ctx.fillRect(centerX + offsetX - 5, shoeY, 10, 4);

  ctx.fillStyle = "#2d1b18";
  if (isLeft) {
    ctx.fillRect(centerX + offsetX + 3, shoeY, 2, 4);
  } else {
    ctx.fillRect(centerX + offsetX - 5, shoeY, 2, 4);
  }
}

/**
 * 从精灵表获取单帧
 */
export function getFrameFromSpriteSheet(
  spriteSheet: HTMLCanvasElement | HTMLImageElement,
  frameWidth: number,
  frameHeight: number,
  animationIndex: number,
  directionIndex: number,
  frameIndex: number,
  directionsPerAnimation: number
): { x: number; y: number; width: number; height: number } {
  const row = animationIndex * directionsPerAnimation + directionIndex;
  const col = frameIndex;

  return {
    x: col * frameWidth,
    y: row * frameHeight,
    width: frameWidth,
    height: frameHeight,
  };
}

/**
 * 下载精灵表为 PNG
 */
export function downloadSpriteSheet(canvas: HTMLCanvasElement, filename: string = "sprite_sheet.png"): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
