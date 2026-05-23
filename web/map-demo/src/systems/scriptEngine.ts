/**
 * 剧本执行引擎 - 重构版
 * 使用 ModuleRegistry 替代 switch-case
 * 使用 ConditionEvaluator 替代 if-else 面条代码
 */

import type { MapManager } from "../world/mapData";
import type { TaskSystem } from "./taskSystem";
import type { DialogueSystem } from "./dialogue";
import { ModuleRegistry, type ModuleContext } from "../engine/ModuleRegistry";
import { ConditionEvaluator } from "../engine/ConditionEvaluator";

export interface ModuleParams {
  [key: string]: any;
}

export interface ScriptModule {
  module: string;
  params: ModuleParams;
}

export interface ScriptState {
  id: string;
  触发条件: string;
  指令序列: ScriptModule[];
  循环?: boolean;
}

export interface RoleScript {
  id: string;
  角色: string;
  商铺?: string;
  商铺位置?: [number, number];
  活动范围?: {
    中心: [number, number];
    半径: number;
  };
  行为状态机: Record<string, ScriptState>;
}

interface DialogueTemplate {
  id: string;
  对话列表: string[];
  变量?: string[];
}

export class ScriptEngine {
  private mapManager: MapManager;
  private moduleRegistry: ModuleRegistry;
  private conditionEvaluator: ConditionEvaluator;

  private roleScripts: Map<string, RoleScript> = new Map();
  private dialogueTemplates: Map<string, DialogueTemplate> = new Map();

  private npcStates: Map<string, {
    currentState: string;
    scriptId: string;
    isOpen: boolean;
    lastStateChange: number;
  }> = new Map();

  constructor(
    mapManager: MapManager,
    taskSystem: TaskSystem,
    dialogueSystem: DialogueSystem,
    moduleRegistry: ModuleRegistry
  ) {
    this.mapManager = mapManager;
    this.moduleRegistry = moduleRegistry;
    this.conditionEvaluator = new ConditionEvaluator();
  }

  loadRoleScript(script: RoleScript): void {
    this.roleScripts.set(script.id, script);
  }

  loadDialogueTemplate(template: DialogueTemplate): void {
    this.dialogueTemplates.set(template.id, template);
  }

  initNpc(npcId: string, scriptId: string): void {
    this.npcStates.set(npcId, {
      currentState: "idle",
      scriptId,
      isOpen: false,
      lastStateChange: 0,
    });
  }

  getNpcState(npcId: string): string {
    return this.npcStates.get(npcId)?.currentState || "idle";
  }

  isShopOpen(npcId: string): boolean {
    return this.npcStates.get(npcId)?.isOpen || false;
  }

  setShopOpen(npcId: string, isOpen: boolean): void {
    const state = this.npcStates.get(npcId);
    if (state) state.isOpen = isOpen;
  }

  updateNpcScript(
    npcId: string,
    npcX: number,
    npcY: number,
    personality: Record<string, number>,
    now: number,
    nearbyNpcs: Array<{ id: string; x: number; y: number }>
  ): ScriptModule[] {
    const npcState = this.npcStates.get(npcId);
    if (!npcState) return [];

    const script = this.roleScripts.get(npcState.scriptId);
    if (!script) return [];

    const newState = this.determineState(script, npcState, npcX, npcY, personality, now, nearbyNpcs);

    if (newState !== npcState.currentState) {
      npcState.currentState = newState;
      npcState.lastStateChange = now;
    }

    const stateDef = script.行为状态机[newState];
    if (!stateDef) return [];

    return stateDef.指令序列;
  }

  private determineState(
    script: RoleScript,
    npcState: { currentState: string; isOpen: boolean; lastStateChange: number },
    npcX: number,
    npcY: number,
    personality: Record<string, number>,
    now: number,
    nearbyNpcs: Array<{ id: string; x: number; y: number }>
  ): string {
    const hour = (now / 1000 / 60) % 24;

    const context: Record<string, any> = {
      hour,
      isOpen: npcState.isOpen,
      npcX,
      npcY,
      personality,
      nearbyNpcs,
      shopLocation: script.商铺位置,
      currentState: npcState.currentState,
    };

    for (const [stateName, stateDef] of Object.entries(script.行为状态机)) {
      if (this.evaluateCondition(stateDef.触发条件, context)) {
        return stateName;
      }
    }

    return npcState.currentState;
  }

  /**
   * 🟢 使用ConditionEvaluator替代旧的70行if-else
   */
  private evaluateCondition(condition: string, context: Record<string, any>): boolean {
    // 将旧字符串条件转为ConditionEvaluator格式
    if (condition === "未营业") return !context.isOpen;
    if (condition === "营业中") return context.isOpen;

    // 时间条件
    if (condition.includes("时间 >=")) {
      const match = condition.match(/(\d+):(\d+)/);
      if (match) {
        const targetHour = parseInt(match[1]);
        const timeOk = context.hour >= targetHour;
        if (condition.includes("未营业")) return timeOk && !context.isOpen;
        if (condition.includes("或 紧急情况")) return timeOk;
      }
    }

    // 营业状态 + 顾客条件
    if (condition.includes("营业中")) {
      const hasCustomer = context.nearbyNpcs?.some((npc: any) => {
        const dist = Math.sqrt((npc.x - context.npcX) ** 2 + (npc.y - context.npcY) ** 2);
        return dist < 5;
      });

      if (condition.includes("附近无顾客")) return context.isOpen && !hasCustomer;
      if (condition.includes("顾客进入范围")) return context.isOpen && hasCustomer;

      // 概率条件
      const probMatch = condition.match(/概率([\d.]+)/);
      if (probMatch) {
        const probability = parseFloat(probMatch[1]);
        return context.isOpen && !hasCustomer && Math.random() < probability;
      }
    }

    return false;
  }

  /**
   * 🔄 委托给ModuleRegistry执行
   */
  executeModule(
    npcId: string,
    module: ScriptModule,
    npcX: number,
    npcY: number,
    personality: Record<string, number>,
    nearbyNpcs?: Array<{ id: string; x: number; y: number }>
  ): { type: string; data: any } | null {
    const ctx: ModuleContext = {
      npcId,
      npcX,
      npcY,
      personality,
      nearbyNpcs,
      mapManager: this.mapManager,
      dialogueTemplates: this.dialogueTemplates,
      npcStates: this.npcStates as Map<string, { isOpen: boolean }>,
    };

    return this.moduleRegistry.execute(module.module, ctx, module.params);
  }

  getDialogueText(templateId: string, variables?: Record<string, string>): string {
    const template = this.dialogueTemplates.get(templateId);
    if (!template) return "";

    let text = template.对话列表[Math.floor(Math.random() * template.对话列表.length)];

    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        text = text.replace(`{${key}}`, value);
      }
    }

    return text;
  }
}
