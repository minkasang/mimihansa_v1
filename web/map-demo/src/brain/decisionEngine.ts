/**
 * 大脑决策引擎 - TypeScript版本
 * 根据性格维度动态决策
 */

export interface ActionScore {
  actionId: string;
  baseScore: number;
  personalityBonus: number;
  personalityPenalty: number;
  stateModifier: number;
  targetBonus: number;
  finalScore: number;
  canExecute: boolean;
  reason: string;
}

export interface NpcData {
  性格: Record<string, number>;
  生理状态: Record<string, number>;
  当前状态?: string;
}

export interface Environment {
  可见目标?: Array<{ 外貌?: number; 名称?: string }>;
  时间?: string;
}

// 动作配置
const ACTION_REQUIREMENTS: Record<string, {
  说明: string;
  必要条件: Record<string, string>;
  加分项?: Record<string, string>;
  减分项?: Record<string, string>;
}> = {
  "action_追求": {
    说明: "主动追求异性",
    必要条件: {
      "乐观": ">=6",
      "社交欲": ">=5"
    },
    加分项: {
      "勇敢": ">=6",
      "大方": ">=7",
      "冲动": ">=6"
    },
    减分项: {
      "谨慎": ">=7",
      "城府": ">=7"
    }
  },
  "action_搭讪": {
    说明: "主动上前对话",
    必要条件: {
      "社交欲": ">=5"
    },
    加分项: {
      "乐观": ">=6",
      "勇敢": ">=5",
      "幽默": ">=6"
    },
    减分项: {
      "谦虚": ">=7",
      "敏感": ">=7"
    }
  },
  "action_送礼": {
    说明: "送礼物给目标",
    必要条件: {
      "大方": ">=4"
    },
    加分项: {
      "乐观": ">=6",
      "勤奋": ">=6"
    },
    减分项: {
      "节俭": ">=7",
      "嫉妒": ">=7"
    }
  },
  "action_工作": {
    说明: "执行工作任务",
    必要条件: {
      "勤奋": ">=4"
    },
    加分项: {
      "耐心": ">=6"
    },
    减分项: {}
  },
  "action_分享信息": {
    说明: "回答路人问题",
    必要条件: {
      "善良": ">=4"
    },
    加分项: {
      "社交欲": ">=6",
      "大方": ">=6"
    },
    减分项: {}
  },
  "action_移动": {
    说明: "在地图上移动",
    必要条件: {},
    加分项: {},
    减分项: {}
  }
};

export class BrainDecisionEngine {
  canTriggerAction(personality: Record<string, number>, actionId: string): { can: boolean; reason: string } {
    const config = ACTION_REQUIREMENTS[actionId];
    if (!config) {
      return { can: true, reason: "动作无特殊要求" };
    }

    const requirements = config.必要条件;
    for (const [trait, condition] of Object.entries(requirements)) {
      const npcValue = personality[trait] ?? 5;

      if (condition.startsWith(">=")) {
        const threshold = parseInt(condition.slice(2));
        if (npcValue < threshold) {
          return { 
            can: false, 
            reason: `${trait}需要>=${threshold},实际为${npcValue}` 
          };
        }
      } else if (condition.startsWith("<=")) {
        const threshold = parseInt(condition.slice(2));
        if (npcValue > threshold) {
          return { 
            can: false, 
            reason: `${trait}需要<=${threshold},实际为${npcValue}` 
          };
        }
      }
    }

    return { can: true, reason: "满足所有必要条件" };
  }

  calculateActionScore(
    personality: Record<string, number>,
    actionId: string,
    currentState: Record<string, number>,
    targetInfo?: { 外貌?: number }
  ): ActionScore {
    const baseScore = 50;
    const { can, reason } = this.canTriggerAction(personality, actionId);

    if (!can) {
      return {
        actionId,
        baseScore,
        personalityBonus: 0,
        personalityPenalty: 0,
        stateModifier: 0,
        targetBonus: 0,
        finalScore: 0,
        canExecute: false,
        reason
      };
    }

    const config = ACTION_REQUIREMENTS[actionId];
    let bonus = 0;
    let penalty = 0;

    // 计算加分
    if (config?.加分项) {
      for (const [trait, condition] of Object.entries(config.加分项)) {
        const npcValue = personality[trait] ?? 5;
        if (condition.startsWith(">=")) {
          const threshold = parseInt(condition.slice(2));
          if (npcValue >= threshold) {
            bonus += 15;
          }
        }
      }
    }

    // 计算减分
    if (config?.减分项) {
      for (const [trait, condition] of Object.entries(config.减分项)) {
        const npcValue = personality[trait] ?? 5;
        if (condition.startsWith(">=")) {
          const threshold = parseInt(condition.slice(2));
          if (npcValue >= threshold) {
            penalty += 15;
          }
        }
      }
    }

    // 状态修正
    let stateModifier = 0;
    const hunger = currentState["饥饿"] ?? 7;
    const fatigue = currentState["疲劳"] ?? 3;

    if (hunger < 4) stateModifier -= 20;
    if (fatigue > 7) stateModifier -= 15;

    // 目标加成
    let targetBonus = 0;
    if (targetInfo?.外貌) {
      targetBonus += targetInfo.外貌 * 2;
    }

    const finalScore = Math.max(0, baseScore + bonus - penalty + stateModifier + targetBonus);

    return {
      actionId,
      baseScore,
      personalityBonus: bonus,
      personalityPenalty: penalty,
      stateModifier,
      targetBonus,
      finalScore,
      canExecute: true,
      reason
    };
  }

  decideAction(npcData: NpcData, environment: Environment): ActionScore | null {
    const personality = npcData.性格;
    const currentState = npcData.生理状态;
    const availableActions = Object.keys(ACTION_REQUIREMENTS);

    const targetInfo = environment.可见目标?.[0];

    const scoredActions: ActionScore[] = [];
    for (const actionId of availableActions) {
      const score = this.calculateActionScore(
        personality,
        actionId,
        currentState,
        targetInfo
      );
      scoredActions.push(score);
    }

    const validActions = scoredActions.filter(s => s.canExecute);
    if (validActions.length === 0) return null;

    return validActions.reduce((best, current) => 
      current.finalScore > best.finalScore ? current : best
    );
  }
}
