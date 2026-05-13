/**
 * 16×32 星露谷风格角色精灵（纯 Canvas 矩形拼像素）
 * 
 * 角色结构（从上到下）：
 * - 头发：4px
 * - 头部：8px（含眼睛）
 * - 身体：10px（含手臂）
 * - 腿部：10px（含鞋子）
 */

export type Facing = "down" | "up" | "left" | "right";

export type AnimationState = "idle" | "walk";

export interface CharacterAppearance {
  发色: string;
  肤色: string;
  眼睛颜色: string;
  衣服颜色: string;
  裤子颜色: string;
  鞋子颜色: string;
  轮廓颜色: string;
}

const DEFAULT_APPEARANCE: CharacterAppearance = {
  发色: "#4a3728",
  肤色: "#f2d3b4",
  眼睛颜色: "#2c1810",
  衣服颜色: "#c45c4a",
  裤子颜色: "#3d5a80",
  鞋子颜色: "#5c4033",
  轮廓颜色: "#1a1a1a",
};

const SPRITE_WIDTH = 16;
const SPRITE_HEIGHT = 32;

export function drawNpcSprite(
  ctx: CanvasRenderingContext2D,
  pixelX: number,
  pixelY: number,
  tilePx: number,
  facing: Facing,
  appearance: Partial<CharacterAppearance> = {},
  animState: AnimationState = "idle",
  frame: number = 0
): void {
  const app = { ...DEFAULT_APPEARANCE, ...appearance };
  
  ctx.save();
  
  const offsetX = pixelX + (tilePx - SPRITE_WIDTH) / 2;
  const offsetY = pixelY + tilePx - SPRITE_HEIGHT;
  ctx.translate(offsetX, offsetY);

  const walkOffset = animState === "walk" ? getWalkOffset(frame) : { leg: 0, arm: 0, body: 0 };

  drawHair(ctx, app, facing);
  drawHead(ctx, app, facing);
  drawBody(ctx, app, facing, walkOffset);
  drawLegs(ctx, app, facing, walkOffset);

  ctx.restore();
}

function getWalkOffset(frame: number): { leg: number; arm: number; body: number } {
  const cycle = [0, 1, 0, -1];
  const idx = frame % 4;
  return {
    leg: cycle[idx] ?? 0,
    arm: -(cycle[idx] ?? 0),
    body: idx === 1 || idx === 3 ? -1 : 0
  };
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  app: CharacterAppearance,
  facing: Facing
): void {
  ctx.fillStyle = app.发色;
  
  if (facing === "down") {
    ctx.fillRect(4, 0, 8, 1);
    ctx.fillRect(3, 1, 10, 2);
    ctx.fillRect(4, 3, 8, 1);
    ctx.fillStyle = darken(app.发色, 0.8);
    ctx.fillRect(3, 1, 1, 2);
    ctx.fillRect(12, 1, 1, 2);
  } else if (facing === "up") {
    ctx.fillRect(4, 0, 8, 4);
    ctx.fillStyle = darken(app.发色, 0.7);
    ctx.fillRect(4, 2, 8, 2);
  } else {
    ctx.fillRect(5, 0, 6, 1);
    ctx.fillRect(4, 1, 7, 2);
    ctx.fillRect(5, 3, 5, 1);
    ctx.fillStyle = darken(app.发色, 0.8);
    ctx.fillRect(4, 1, 1, 2);
  }
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  app: CharacterAppearance,
  facing: Facing
): void {
  ctx.fillStyle = app.肤色;
  
  if (facing === "down") {
    ctx.fillRect(4, 4, 8, 7);
    ctx.fillStyle = darken(app.肤色, 0.85);
    ctx.fillRect(4, 9, 8, 2);
    drawEyesFront(ctx, app);
  } else if (facing === "up") {
    // 背面不画脸
  } else {
    ctx.fillRect(5, 4, 6, 7);
    ctx.fillStyle = darken(app.肤色, 0.85);
    ctx.fillRect(5, 9, 6, 2);
    drawEyesSide(ctx, app, facing);
  }
  
  drawEars(ctx, app, facing);
}

function drawEyesFront(ctx: CanvasRenderingContext2D, app: CharacterAppearance): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(5, 6, 2, 2);
  ctx.fillRect(9, 6, 2, 2);
  
  ctx.fillStyle = app.眼睛颜色;
  ctx.fillRect(5, 6, 2, 1);
  ctx.fillRect(9, 6, 2, 1);
  
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(6, 6, 1, 1);
  ctx.fillRect(10, 6, 1, 1);
}

function drawEyesSide(ctx: CanvasRenderingContext2D, app: CharacterAppearance, facing: Facing): void {
  ctx.fillStyle = "#ffffff";
  if (facing === "left") {
    ctx.fillRect(6, 6, 2, 2);
  } else {
    ctx.fillRect(8, 6, 2, 2);
  }
  
  ctx.fillStyle = app.眼睛颜色;
  if (facing === "left") {
    ctx.fillRect(6, 6, 2, 1);
  } else {
    ctx.fillRect(8, 6, 2, 1);
  }
  
  ctx.fillStyle = "#ffffff";
  if (facing === "left") {
    ctx.fillRect(7, 6, 1, 1);
  } else {
    ctx.fillRect(9, 6, 1, 1);
  }
}

function drawEars(ctx: CanvasRenderingContext2D, app: CharacterAppearance, facing: Facing): void {
  ctx.fillStyle = darken(app.肤色, 0.9);
  if (facing === "down") {
    ctx.fillRect(3, 6, 1, 2);
    ctx.fillRect(12, 6, 1, 2);
  } else if (facing === "up") {
    // 背面不画耳朵
  } else if (facing === "left") {
    ctx.fillRect(11, 6, 1, 2);
  } else {
    ctx.fillRect(4, 6, 1, 2);
  }
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  app: CharacterAppearance,
  facing: Facing,
  walkOffset: { leg: number; arm: number; body: number }
): void {
  ctx.fillStyle = app.衣服颜色;
  
  const bodyY = 11 + walkOffset.body;
  
  if (facing === "down") {
    ctx.fillRect(4, bodyY, 8, 8);
    ctx.fillStyle = darken(app.衣服颜色, 0.85);
    ctx.fillRect(4, bodyY + 6, 8, 2);
    drawArmsFront(ctx, app, walkOffset);
  } else if (facing === "up") {
    ctx.fillRect(4, bodyY, 8, 8);
    ctx.fillStyle = darken(app.衣服颜色, 0.8);
    ctx.fillRect(4, bodyY, 8, 2);
  } else {
    ctx.fillRect(5, bodyY, 6, 8);
    ctx.fillStyle = darken(app.衣服颜色, 0.85);
    ctx.fillRect(5, bodyY + 6, 6, 2);
    drawArmsSide(ctx, app, facing, walkOffset);
  }
  
  drawCollar(ctx, app, facing, bodyY);
}

function drawArmsFront(
  ctx: CanvasRenderingContext2D,
  app: CharacterAppearance,
  walkOffset: { leg: number; arm: number; body: number }
): void {
  ctx.fillStyle = app.衣服颜色;
  const armY = 13 + walkOffset.arm;
  ctx.fillRect(2, armY, 2, 5);
  ctx.fillRect(12, armY, 2, 5);
  
  ctx.fillStyle = app.肤色;
  ctx.fillRect(2, armY + 5, 2, 2);
  ctx.fillRect(12, armY + 5, 2, 2);
}

function drawArmsSide(
  ctx: CanvasRenderingContext2D,
  app: CharacterAppearance,
  facing: Facing,
  walkOffset: { leg: number; arm: number; body: number }
): void {
  ctx.fillStyle = app.衣服颜色;
  const armY = 13 + walkOffset.arm;
  if (facing === "left") {
    ctx.fillRect(11, armY, 2, 5);
    ctx.fillStyle = app.肤色;
    ctx.fillRect(11, armY + 5, 2, 2);
  } else {
    ctx.fillRect(3, armY, 2, 5);
    ctx.fillStyle = app.肤色;
    ctx.fillRect(3, armY + 5, 2, 2);
  }
}

function drawCollar(ctx: CanvasRenderingContext2D, app: CharacterAppearance, facing: Facing, bodyY: number): void {
  ctx.fillStyle = lighten(app.衣服颜色, 1.1);
  if (facing === "down") {
    ctx.fillRect(6, bodyY, 4, 1);
  } else if (facing === "up") {
    // 背面不画领口
  } else {
    ctx.fillRect(6, bodyY, 3, 1);
  }
}

function drawLegs(
  ctx: CanvasRenderingContext2D,
  app: CharacterAppearance,
  facing: Facing,
  walkOffset: { leg: number; arm: number; body: number }
): void {
  const legY = 19;
  
  ctx.fillStyle = app.裤子颜色;
  
  if (facing === "down" || facing === "up") {
    const leftLegX = 5 + walkOffset.leg;
    const rightLegX = 9 - walkOffset.leg;
    
    ctx.fillRect(leftLegX, legY, 3, 7);
    ctx.fillRect(rightLegX, legY, 3, 7);
    
    ctx.fillStyle = darken(app.裤子颜色, 0.85);
    ctx.fillRect(leftLegX, legY + 5, 3, 2);
    ctx.fillRect(rightLegX, legY + 5, 3, 2);
  } else {
    const legOffset = walkOffset.leg;
    ctx.fillRect(6, legY + Math.abs(legOffset), 4, 7);
    ctx.fillStyle = darken(app.裤子颜色, 0.85);
    ctx.fillRect(6, legY + 5, 4, 2);
  }
  
  drawShoes(ctx, app, facing, walkOffset);
}

function drawShoes(
  ctx: CanvasRenderingContext2D,
  app: CharacterAppearance,
  facing: Facing,
  walkOffset: { leg: number; arm: number; body: number }
): void {
  ctx.fillStyle = app.鞋子颜色;
  const shoeY = 26;
  
  if (facing === "down") {
    const leftShoeX = 4 + walkOffset.leg;
    const rightShoeX = 9 - walkOffset.leg;
    ctx.fillRect(leftShoeX, shoeY, 4, 2);
    ctx.fillRect(rightShoeX, shoeY, 4, 2);
    ctx.fillRect(leftShoeX, shoeY + 2, 3, 4);
    ctx.fillRect(rightShoeX + 1, shoeY + 2, 3, 4);
  } else if (facing === "up") {
    ctx.fillRect(5, shoeY + 4, 3, 2);
    ctx.fillRect(8, shoeY + 4, 3, 2);
  } else {
    ctx.fillRect(5, shoeY, 5, 2);
    ctx.fillRect(6, shoeY + 2, 4, 4);
  }
}

function darken(hex: string, factor: number): string {
  const r = Math.floor(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.floor(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.floor(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, factor: number): string {
  const r = Math.min(255, Math.floor(parseInt(hex.slice(1, 3), 16) * factor));
  const g = Math.min(255, Math.floor(parseInt(hex.slice(3, 5), 16) * factor));
  const b = Math.min(255, Math.floor(parseInt(hex.slice(5, 7), 16) * factor));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export const SPRITE_PX = { width: SPRITE_WIDTH, height: SPRITE_HEIGHT };
