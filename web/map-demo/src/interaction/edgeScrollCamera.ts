/**
 * 屏幕边缘自动卷镜头（世界坐标 camX/camY），与《世界系统》地图演示约定一致。
 * 在玩家格中心接近画布四边「安全边距」时平移摄像机，使角色留在可视区内。
 */

export function applyEdgeScrollCamera(options: {
  camX: number;
  camY: number;
  scale: number;
  canvasW: number;
  canvasH: number;
  playerTileX: number;
  playerTileY: number;
  tilePx: number;
  /** 玩家中心距画布边缘小于该像素时开始卷屏 */
  marginPx: number;
}): { camX: number; camY: number } {
  let { camX, camY } = options;
  const { scale, canvasW, canvasH, playerTileX, playerTileY, tilePx, marginPx } = options;
  const pcx = playerTileX * tilePx + tilePx / 2;
  const pcy = playerTileY * tilePx + tilePx / 2;
  const sx = (pcx - camX) * scale;
  const sy = (pcy - camY) * scale;
  if (sx < marginPx) camX -= (marginPx - sx) / scale;
  if (sx > canvasW - marginPx) camX += (sx - (canvasW - marginPx)) / scale;
  if (sy < marginPx) camY -= (marginPx - sy) / scale;
  if (sy > canvasH - marginPx) camY += (sy - (canvasH - marginPx)) / scale;
  return { camX, camY };
}
