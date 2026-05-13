/** 与仓库根目录 NPC/*.json 对齐的最小演示结构（字段中文名与《角色系统》一致） */
export interface WorldNpcFile {
  角色id: string;
  姓名: string;
  坐标: [number, number];
  占位说明?: string;
}
