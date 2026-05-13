/** 与《世界系统》地形类型表一致（供多文件复用） */
export enum Terrain {
  Grass = 0,
  Dirt = 1,
  Stone = 2,
  Water = 3,
}

export const TERRAIN_NAMES: Record<Terrain, string> = {
  [Terrain.Grass]: "草地",
  [Terrain.Dirt]: "泥土",
  [Terrain.Stone]: "石头",
  [Terrain.Water]: "水面",
};
