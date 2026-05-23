/**
 * 指令模块注册表 - 替代switch-case的通用模块分派系统
 *
 * 设计原则：
 *   1. 每个模块 = 一个执行函数，注册到注册表
 *   2. 新增模块 = 实现函数 + 注册，不用改引擎其他代码
 *   3. 模块参数格式统一，返回格式统一
 *
 * 使用方式：
 *   const registry = new ModuleRegistry();
 *   registry.register("move_to", (ctx, params) => { ... });
 *   const result = registry.execute("move_to", ctx, params);
 */

import type { MapManager } from "../world/mapData";
import type { DialogueSystem } from "../systems/dialogue";

// ==================== 模块上下文 ====================
export interface ModuleContext {
  npcId: string;
  npcX: number;
  npcY: number;
  mapManager: MapManager;
  dialogueSystem?: DialogueSystem;
  dialogueTemplates?: Map<string, { 对话列表: string[]; 变量?: string[] }>;
  nearbyNpcs?: Array<{ id: string; x: number; y: number }>;
  npcStates?: Map<string, { isOpen: boolean }>;
  personality?: Record<string, number>;
  [key: string]: any;
}

// ==================== 模块结果 ====================
export interface ModuleResult {
  type: string;
  data: Record<string, any>;
}

// ==================== 模块执行函数签名 ====================
export type ModuleExecutor = (
  ctx: ModuleContext,
  params: Record<string, any>
) => ModuleResult | null;

// ==================== 模块定义（从JSON加载） ====================
export interface ModuleDefinition {
  id: string;
  名称: string;
  描述: string;
  参数: Record<string, string>;
  示例?: Record<string, any>;
}

// ==================== 注册表 ====================
export class ModuleRegistry {
  private executors: Map<string, ModuleExecutor> = new Map();
  private definitions: Map<string, ModuleDefinition> = new Map();

  /**
   * 注册一个指令模块
   */
  register(id: string, executor: ModuleExecutor, definition?: ModuleDefinition): void {
    this.executors.set(id, executor);
    if (definition) {
      this.definitions.set(id, definition);
    }
  }

  /**
   * 批量注册模块定义（从JSON加载的元数据）
   */
  registerDefinitions(definitions: ModuleDefinition[]): void {
    for (const def of definitions) {
      this.definitions.set(def.id, def);
    }
  }

  /**
   * 执行一个指令模块
   */
  execute(moduleId: string, ctx: ModuleContext, params: Record<string, any>): ModuleResult | null {
    const executor = this.executors.get(moduleId);
    if (!executor) {
      console.warn(`ModuleRegistry: 未知模块 "${moduleId}"`);
      return null;
    }
    return executor(ctx, params);
  }

  /**
   * 检查模块是否存在
   */
  has(moduleId: string): boolean {
    return this.executors.has(moduleId);
  }

  /**
   * 获取所有已注册模块ID
   */
  getAllModuleIds(): string[] {
    return Array.from(this.executors.keys());
  }

  /**
   * 获取模块定义
   */
  getDefinition(moduleId: string): ModuleDefinition | undefined {
    return this.definitions.get(moduleId);
  }

  /**
   * 获取所有模块定义
   */
  getAllDefinitions(): ModuleDefinition[] {
    return Array.from(this.definitions.values());
  }
}
