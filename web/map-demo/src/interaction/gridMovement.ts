import { Terrain } from "../terrain";

/** 根据地形判断是否可走入该格（与《世界系统》可通行语义对齐：水面、石头不可） */
export function isWalkableTerrain(kind: Terrain): boolean {
  return kind === Terrain.Grass || kind === Terrain.Dirt;
}

export function tryStepTile(
  grid: Uint8Array,
  mapW: number,
  mapH: number,
  fromX: number,
  fromY: number,
  dx: number,
  dy: number,
): { x: number; y: number } | null {
  const nx = fromX + dx;
  const ny = fromY + dy;
  if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH) return null;
  const kind = grid[ny * mapW + nx] as Terrain;
  if (!isWalkableTerrain(kind)) return null;
  return { x: nx, y: ny };
}
