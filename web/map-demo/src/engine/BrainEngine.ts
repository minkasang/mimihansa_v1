/**
 * 🧠 BrainEngine - NPC大脑主循环
 *
 * 每Tick完整管线:
 *   ① 中断检查 → ② 需求更新 → ③ 感知刷新 → ④ 欲望计算
 *   → ⑤ 目标生成 → ⑥ GOAP规划 → ⑦ 执行一步 → 回到①
 *
 * 这是NPC的"心跳"。引擎不关心"为什么做"——那是欲望库和动作库的事。
 * 引擎只负责忠实地跑完每一步。
 */

import { ConditionEvaluator } from "./ConditionEvaluator";
import { DesireEvaluator, type NpcContext } from "./DesireEvaluator";
import { GOAPPlanner, type Instruction, type Goal, type NpcState } from "./GOAPPlanner";
import { InterruptChecker } from "./InterruptChecker";
import { ModuleRegistry } from "./ModuleRegistry";
import { ScoreCalculator } from "./ScoreCalculator";
import { ActionLibrary } from "./ActionLibrary";

// 引擎返回的执行动作
export interface BrainOutput {
  type: "move" | "dialogue" | "animation" | "wait" | "shop_open" | "shop_close" | "state_change" | "idle";
  data: Record<string, any>;
  // 当前大脑状态（用于调试）
  debug?: {
    当前欲望: string | null;
    当前目标: string | null;
    计划步骤: number;
    总步骤: number;
    中断原因: string | null;
  };
}

// 每个NPC的大脑中转状态
interface BrainNpcState {
  // 当前计划
  currentPlan: Instruction[] | null;
  planStepIndex: number;
  // 当前目标
  currentGoal: Goal | null;
  currentGoalPriority: number;
  // 当前欲望
  currentDesireId: string | null;
  // 时间追踪
  lastPlanTime: number;
  lastDecisionTime: number;
  // 指令执行中间状态
  instructionProgress: number; // 用于 wait/play_animation 等耗时指令
  currentInstruction: Instruction | null;
  // 是否被中断
  interruptedReason: string | null;
}

export class BrainEngine {
  conditionEvaluator = new ConditionEvaluator();
  desireEvaluator = new DesireEvaluator();
  goapPlanner: GOAPPlanner;
  interruptChecker = new InterruptChecker();
  moduleRegistry: ModuleRegistry;
  scoreCalculator: ScoreCalculator;
  actionLib: ActionLibrary;

  private brainStates: Map<string, BrainNpcState> = new Map();

  private decisionInterval = 1000;

  constructor(moduleRegistry: ModuleRegistry) {
    this.moduleRegistry = moduleRegistry;
    this.scoreCalculator = new ScoreCalculator();
    this.actionLib = new ActionLibrary();
    this.goapPlanner = new GOAPPlanner(this.actionLib);
  }

  /**
   * 初始化NPC大脑状态
   */
  initNpc(npcId: string): void {
    this.brainStates.set(npcId, {
      currentPlan: null,
      planStepIndex: 0,
      currentGoal: null,
      currentGoalPriority: 0,
      currentDesireId: null,
      lastPlanTime: 0,
      lastDecisionTime: 0,
      instructionProgress: 0,
      currentInstruction: null,
      interruptedReason: null,
    });
  }

  /**
   * 🔄 主循环：每Tick调用一次
   *
   * @param npcId NPC标识
   * @param npcState NPC完整状态
   * @param perception 感知结果
   * @param now 当前时间（毫秒）
   * @param deltaMs 距上次Tick的时间差（毫秒）
   * @param timeScale 时间加速倍率
   */
  tick(
    npcId: string,
    npcState: NpcState & { 当前动作?: string },
    perception: PerceptionSnapshot,
    now: number,
    deltaMs: number,
    timeScale: number
  ): BrainOutput[] {
    let brainState = this.brainStates.get(npcId);
    if (!brainState) {
      this.initNpc(npcId);
      brainState = this.brainStates.get(npcId)!;
    }

    // ① + ② 更新生理状态（每Tick）
    this.updatePhysiology(deltaMs, timeScale, npcState);

    // ③ 中断检查
    const interrupt = this.interruptChecker.check(
      {
        生理状态: npcState.生理状态,
        性格: npcState.性格,
        当前动作: npcState.当前动作 || null,
        环境: npcState.环境,
      },
      brainState.currentDesireId,
      brainState.currentGoalPriority
    );

    if (interrupt.interrupted) {
      // 被中断！清空当前计划，重新决策
      brainState.currentPlan = null;
      brainState.planStepIndex = 0;
      brainState.interruptedReason = interrupt.说明;
    } else {
      brainState.interruptedReason = null;
    }

    // ④ 定期决策（不是每Tick都决策，节省性能）
    const effectiveInterval = this.decisionInterval / timeScale;
    if (now - brainState.lastDecisionTime > effectiveInterval) {
      brainState.lastDecisionTime = now;

      const npcContext = this.buildNpcContext(npcState, perception);
      const desires = this.desireEvaluator.evaluate(npcContext);

      if (desires.length > 0) {
        // 🧮 从欲望出发，为每个欲望找到此NPC性格下最适合的动作
        let bestCombinedScore = -1;
        let bestDesire: typeof desires[0] | null = null;
        let bestActionId = "";
        let bestActionScore = 0;

        for (const desire of desires.slice(0, 5)) {
          const candidates = this.actionLib.findActionsByTargetType(
            desire.目标类型,
            npcState.性格
          );
          for (const candidate of candidates) {
            const scored = this.scoreCalculator.scoreAction(
              candidate.id,
              npcState.性格,
              npcState.生理状态
            );
            if (!scored.prerequisitesMet || scored.score <= 0) continue;

            const combined = desire.优先级 * 10 + scored.score;
            if (combined > bestCombinedScore) {
              bestCombinedScore = combined;
              bestDesire = desire;
              bestActionId = candidate.id;
              bestActionScore = scored.score;
            }
          }

          // 如果该欲望没有在 ActionLibrary 中找到动作，用欲望自带的动作id兜底
          if (!bestDesire || bestDesire !== desire) {
            const fallbackScore = this.scoreCalculator.scoreAction(
              desire.动作id,
              npcState.性格,
              npcState.生理状态
            );
            if (fallbackScore.prerequisitesMet && fallbackScore.score > 0) {
              const combined = desire.优先级 * 10 + fallbackScore.score;
              if (combined > bestCombinedScore) {
                bestCombinedScore = combined;
                bestDesire = desire;
                bestActionId = desire.动作id;
                bestActionScore = fallbackScore.score;
              }
            }
          }
        }

        if (bestDesire) {
          const effectiveDesire = { ...bestDesire, 动作id: bestActionId };

          if (
            effectiveDesire.id !== brainState.currentDesireId ||
            bestCombinedScore > brainState.currentGoalPriority
          ) {
            brainState.currentDesireId = effectiveDesire.id;
            brainState.currentGoalPriority = bestCombinedScore;

            const goal: Goal = this.buildGoal(effectiveDesire, perception, npcState);
            brainState.currentGoal = goal;

            const plans = this.goapPlanner.plan(goal, npcState);
            if (plans.length > 0) {
              brainState.currentPlan = plans[0];
              brainState.planStepIndex = 0;
              brainState.lastPlanTime = now;
            }
          }
        }
      }
    }

    // ⑦ 执行一步（每Tick推进）
    const outputs = this.executeStep(brainState, now, deltaMs);
    return outputs;
  }

  /**
   * ② 更新生理状态
   */
  private updatePhysiology(deltaMs: number, timeScale: number, npcState: NpcState): void {
    const tickSeconds = (deltaMs * timeScale) / 1000;

    // 每现实秒的生理变化（基准值）
    npcState.生理状态.疲劳 = Math.min(10, (npcState.生理状态.疲劳 || 3) + 0.01 * tickSeconds);
    npcState.生理状态.饥饿 = Math.min(10, (npcState.生理状态.饥饿 || 5) + 0.005 * tickSeconds);
    // 心情向中性回归
    const mood = npcState.生理状态.开心 || 6;
    npcState.生理状态.开心 = mood + (5 - mood) * 0.001 * tickSeconds;
  }

  /**
   * ⑤ 根据欲望类型选择正确的目标，而非永远取 visual[0]
   */
  private buildGoal(
    desire: { 动作id: string; 目标类型: string; 位置策略: string; 持续条件?: any; 目标选择?: string },
    perception: PerceptionSnapshot,
    npcState: NpcState,
  ): Goal {
    const goal: Goal = {
      id: desire.动作id + "_" + Date.now(),
      目标类型: desire.目标类型,
      动作id: desire.动作id,
      位置策略: desire.位置策略,
      持续条件: desire.持续条件,
      目标选择: desire.目标选择,
    };

    // 社交类欲望 → 选感知范围内的最近/最美 NPC
    if (desire.目标类型 === "社交") {
      if (desire.目标选择 === "最美女NPC") {
        const best = perception.visual
          .filter(v => v.类型 !== "player")
          .sort((a, b) => (b.颜值 || 5) - (a.颜值 || 5))[0];
        goal.目标NPC = best?.id;
        goal.目标位置 = best ? [best.x, best.y] as [number, number] : undefined;
      } else {
        const nearest = perception.visual[0];
        goal.目标NPC = nearest?.id;
        goal.目标位置 = nearest ? [nearest.x, nearest.y] as [number, number] : undefined;
      }
    }

    // 送礼 → 上次拒绝我的人（从记忆中取，兜底用感知结果）
    if (desire.目标类型 === "送礼") {
      const rejectedBy = (npcState.记忆标签 || [])
        .filter(t => t.startsWith("被"))[0] || perception.visual[0]?.id;
      goal.目标NPC = rejectedBy;
      const target = perception.visual.find(v => v.id === rejectedBy);
      goal.目标位置 = target ? [target.x, target.y] as [number, number] : undefined;
    }

    // 休息/休闲/工作/吃东西/购物 → 不指定 NPC 目标，由 GOAPPlanner 根据 npcState 规划
    return goal;
  }

  /**
   * 构建NPC上下文（给欲望计算器用）
   */
  private buildNpcContext(npcState: NpcState, perception: PerceptionSnapshot): NpcContext {
    return {
      性格: npcState.性格,
      生理状态: npcState.生理状态,
      当前动作: npcState.当前动作 || "idle",
      当前状态: "alive",
      记忆标签: npcState.记忆标签 || [],
      金钱: npcState.金钱 || 0,
      物品栏: npcState.物品栏,
      家坐标: (npcState as any).家坐标 || null,
      标签: (npcState as any).标签 || [],
      感知: {
        附近有NPC: perception.visual.length > 0,
        看到高颜值NPC: perception.visual.some(v => (v.颜值 || 5) >= 7),
        看到有趣目标: perception.visual.length > 0,
        感知到的NPC: perception.visual.map(v => ({ id: v.id, 颜值: v.颜值, 类型: v.类型 })),
      },
    };
  }

  /**
   * ⑦ 执行当前计划中的一步
   */
  private executeStep(brainState: BrainNpcState, now: number, deltaMs: number): BrainOutput[] {
    const outputs: BrainOutput[] = [];

    if (!brainState.currentPlan || brainState.planStepIndex >= brainState.currentPlan.length) {
      // 没有计划或计划已完成 → 空闲
      return outputs;
    }

    // 处理当前指令的耗时逻辑
    if (brainState.currentInstruction) {
      brainState.instructionProgress += deltaMs;

      const inst = brainState.currentInstruction;
      const duration = inst.params?.duration as number || 0;

      if (duration > 0 && brainState.instructionProgress >= duration) {
        // 当前指令耗时完成，进入下一步
        brainState.instructionProgress = 0;
        brainState.currentInstruction = null;
        brainState.planStepIndex++;
      } else {
        // 还在等待中（wait/play_animation），不需要输出新动作
        return outputs;
      }
    }

    // 取下一步指令
    if (brainState.planStepIndex < brainState.currentPlan.length) {
      const step = brainState.currentPlan[brainState.planStepIndex];
      brainState.currentInstruction = step;
      brainState.instructionProgress = 0;

      // 转换为 BrainOutput
      const output = this.instructionToOutput(step);
      if (output) {
        outputs.push(output);
      }

      // 瞬时指令（不需要等待的）直接进入下一步
      const isInstant = !["wait", "play_animation"].includes(step.module);
      if (isInstant) {
        brainState.currentInstruction = null;
        brainState.planStepIndex++;
      }
    }

    return outputs;
  }

  /**
   * 将指令模块转换为BrainOutput（委托给ModuleRegistry）
   */
  private instructionToOutput(inst: Instruction): BrainOutput | null {
    const result = this.moduleRegistry.execute(inst.module, { npcId: "", npcX: 0, npcY: 0, mapManager: null as any }, inst.params);
    if (!result) return null;

    // ModuleResult.type → BrainOutput.type 映射
    const typeMap: Record<string, BrainOutput["type"]> = {
      move: "move",
      dialogue: "dialogue",
      animation: "animation",
      wait: "wait",
      shop_open: "shop_open",
      shop_close: "shop_close",
      state_change: "state_change",
      set_state: "state_change",
      interact: "idle",
    };

    const outputType = typeMap[result.type] || "idle";

    return {
      type: outputType,
      data: result.data,
    };
  }

  /**
   * 获取NPC的大脑调试信息
   */
  getDebugState(npcId: string) {
    const state = this.brainStates.get(npcId);
    if (!state) return null;
    return {
      当前欲望: state.currentDesireId,
      当前目标: state.currentGoal?.动作id || null,
      计划步骤: state.planStepIndex,
      总步骤: state.currentPlan?.length || 0,
      中断原因: state.interruptedReason,
    };
  }
}

// 感知快照（简化版）
export interface PerceptionSnapshot {
  visual: Array<{
    id: string;
    x: number;
    y: number;
    颜值?: number;
    类型?: string;
  }>;
  auditory: Array<{
    id: string;
    x: number;
    y: number;
  }>;
}
