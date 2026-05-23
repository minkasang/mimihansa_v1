/**
 * 欲望计算器 - 从 Desires_Library.json 加载欲望定义
 * 根据NPC当前状态 + 环境 + 性格，计算激活的欲望列表
 */

import { ConditionEvaluator, type Condition } from "./ConditionEvaluator";
import desiresRaw from "../../../../data/libraries/Desires_Library.json";

// 欲望库JSON结构
interface DesireDef {
  欲望id: string;
  名称: string;
  描述: string;
  触发条件: Condition;
  优先级: number;
  生成目标: {
    目标类型: string;
    动作id: string;
    位置策略: string;
    持续条件?: Condition;
    目标选择?: string;
  };
  触发概率?: number;
  打断条件?: Condition;
}

interface DesiresLibrary {
  欲望定义: DesireDef[];
}

// 欲望评估结果
export interface ActiveDesire {
  id: string;
  名称: string;
  优先级: number;
  目标类型: string;
  动作id: string;
  位置策略: string;
  持续条件?: Condition;
  打断条件?: Condition;
  目标选择?: string;
}

// NPC运行时上下文
export interface NpcContext {
  性格: Record<string, number>;
  生理状态: Record<string, number>;
  当前动作: string;
  当前状态: string;
  记忆标签: string[];
  金钱: number;
  物品栏: any[] | null;
  感知: {
    附近有NPC: boolean;
    看到高颜值NPC: boolean;
    看到有趣目标: boolean;
    感知到的NPC: Array<{ id: string; 颜值?: number }>;
  };
}

export class DesireEvaluator {
  private conditionEvaluator = new ConditionEvaluator();
  private library: DesiresLibrary;

  constructor() {
    this.library = desiresRaw as DesiresLibrary;
  }

  /**
   * 计算NPC当前激活的欲望列表（按优先级从高到低排序）
   */
  evaluate(npcContext: NpcContext): ActiveDesire[] {
    const activeDesires: ActiveDesire[] = [];

    for (const def of this.library.欲望定义) {
      // 构建上下文
      const context: Record<string, any> = {
        性格: npcContext.性格,
        生理状态: npcContext.生理状态,
        当前动作: npcContext.当前动作,
        当前状态: npcContext.当前状态,
        记忆标签: npcContext.记忆标签,
        金钱: npcContext.金钱,
        物品栏: npcContext.物品栏,
        感知: npcContext.感知,
      };

      // 检查触发条件
      const conditionMet = this.conditionEvaluator.evaluate(def.触发条件, context);
      if (!conditionMet) continue;

      // 检查概率
      if (def.触发概率 !== undefined && Math.random() >= def.触发概率) continue;

      // 添加到激活列表
      activeDesires.push({
        id: def.欲望id,
        名称: def.名称,
        优先级: def.优先级,
        目标类型: def.生成目标.目标类型,
        动作id: def.生成目标.动作id,
        位置策略: def.生成目标.位置策略,
        持续条件: def.生成目标.持续条件,
        打断条件: def.打断条件,
        目标选择: def.生成目标.目标选择,
      });
    }

    // 按优先级从高到低排序
    activeDesires.sort((a, b) => b.优先级 - a.优先级);

    return activeDesires;
  }

  /**
   * 获取最高优先级的欲望
   */
  getTopDesire(npcContext: NpcContext): ActiveDesire | null {
    const desires = this.evaluate(npcContext);
    return desires.length > 0 ? desires[0] : null;
  }
}
