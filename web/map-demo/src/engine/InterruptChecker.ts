/**
 * 中断检测器 - 检查是否有高优先级事件需要打断当前行为
 *
 * 当前版本内置基础中断规则（后续可从 Interrupts_Library.json 加载）：
 *   - 生存威胁：精力<2、饥饿>9 → 最高优先级
 *   - 天气威胁：暴雨天在户外 → 找建筑躲避
 *   - 社交感知：高优先级感知（看到高颜值+好色）→ 重新决策
 */

export interface InterruptResult {
  interrupted: boolean;
  reason: string;
  priority: number;
  动作id?: string;
  说明: string;
}

export class InterruptChecker {

  /**
   * 检查是否需要中断当前行为
   *
   * @param npcState NPC当前状态
   * @param currentAction 当前正在执行的动作
   * @param currentPriority 当前动作的优先级
   * @returns 中断结果
   */
  check(
    npcState: NpcInterruptContext,
    currentAction: string | null,
    currentPriority: number
  ): InterruptResult {

    // 1. 生存威胁：极度疲劳 → 必须睡觉
    if (npcState.生理状态.疲劳 >= 9) {
      return {
        interrupted: true,
        reason: "极度疲劳",
        priority: 10,
        动作id: "action_sleep",
        说明: "太累了，必须马上休息",
      };
    }

    // 2. 生存威胁：极度饥饿 → 必须吃东西
    if (npcState.生理状态.饥饿 >= 9) {
      return {
        interrupted: true,
        reason: "极度饥饿",
        priority: 10,
        动作id: "action_eat",
        说明: "饿得受不了了",
      };
    }

    // 3. 精力极低 → 睡觉
    if (npcState.生理状态.疲劳 >= 8 && currentPriority < 9) {
      return {
        interrupted: true,
        reason: "精力过低",
        priority: 9,
        动作id: "action_sleep",
        说明: "太困了，需要睡觉",
      };
    }

    // 4. 饥饿 → 吃东西
    if (npcState.生理状态.饥饿 >= 8 && currentPriority < 8) {
      return {
        interrupted: true,
        reason: "饥饿",
        priority: 8,
        动作id: "action_eat",
        说明: "饿了，需要吃东西",
      };
    }

    // 5. 天气威胁（预留接口）
    if (npcState.环境?.天气 === "暴雨" && npcState.环境?.是否在室内 === false) {
      return {
        interrupted: true,
        reason: "暴雨",
        priority: 9,
        动作id: "action_seek_shelter",
        说明: "下暴雨了，需要找地方避雨",
      };
    }

    // 不中断
    return {
      interrupted: false,
      reason: "",
      priority: currentPriority,
      说明: "",
    };
  }
}

// 中断检测需要的信息
export interface NpcInterruptContext {
  生理状态: Record<string, number>;
  性格: Record<string, number>;
  当前动作: string | null;
  环境?: {
    天气: string;
    是否在室内: boolean;
  };
}
