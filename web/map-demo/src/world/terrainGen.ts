import { Terrain } from "../terrain";

const PALETTE: Record<Terrain, readonly [number, number, number][]> = {
  [Terrain.Grass]: [
    [0x6b, 0xad, 0x5f],
    [0x7c, 0xbd, 0x6a],
    [0x5a, 0x9d, 0x52],
  ],
  [Terrain.Dirt]: [
    [0xa6, 0x7f, 0x52],
    [0xb8, 0x95, 0x6b],
    [0x8f, 0x6e, 0x45],
  ],
  [Terrain.Stone]: [
    [0x7a, 0x7e, 0x85],
    [0x8b, 0x90, 0x99],
    [0x6a, 0x6e, 0x74],
  ],
  [Terrain.Water]: [
    [0x3d, 0x7a, 0xbc],
    [0x4a, 0x90, 0xd9],
    [0x5c, 0xa0, 0xe8],
  ],
};

export function terrainAt(tileX: number, tileY: number): Terrain {
  const n =
    Math.sin(tileX * 0.12) * Math.cos(tileY * 0.11) * 8 +
    Math.sin((tileX + tileY) * 0.07) * 5 +
    Math.sin(tileX * 0.03 + tileY * 0.05) * 3;
  if (n < -4) return Terrain.Water;
  if (n < -1) return Terrain.Stone;
  if (n < 3.5) return Terrain.Dirt;
  return Terrain.Grass;
}

export function pickColor(kind: Terrain, tileX: number, tileY: number): string {
  const variants = PALETTE[kind];
  const idx = (tileX * 31 + tileY * 17) % variants.length;
  const [r, g, b] = variants[idx]!;
  return `rgb(${r},${g},${b})`;
}

export function buildTerrainGrid(mapW: number, mapH: number): Uint8Array {
  const cells = mapW * mapH;
  const grid = new Uint8Array(cells);
  let i = 0;
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      grid[i++] = terrainAt(x, y);
    }
  }
  return grid;
}
