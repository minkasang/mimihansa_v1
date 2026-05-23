/**
 * 任务系统 - 通用机制
 * NPC可以接受/生成/执行任务
 */

import type { MapManager } from "../world/mapData";

// ==================== 任务类型 ====================
export enum TaskType {
  MOVE = "move",           // 移动到指定位置
  TALK = "talk",           // 与目标对话
  WORK = "work",           // 工作
  REST = "rest",           // 休息
  BUY = "buy",             // 购买
  SELL = "sell",           // 出售
  PURSUE = "pursue",       // 追求
  FOLLOW = "follow",       // 跟随
  WAIT = "wait",           // 等待
}

// ==================== 任务优先级 ====================
export enum TaskPriority {
  CRITICAL = 0,   // 紧急（生存需求）
  HIGH = 1,       // 高（重要任务）
  NORMAL = 2,     // 正常（日常）
  LOW = 3,        // 低（可选）
}

// ==================== 任务定义 ====================
export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  // 任务目标
  target?: {
    x?: number;
    y?: number;
    npcId?: string;
    buildingId?: string;
  };
  // 任务描述
  description: string;
  // 任务创建时间
  createdAt: number;
  // 任务超时时间（毫秒）
  timeout?: number;
  // 任务完成条件
  completionCondition?: (npc: any) => boolean;
  // 任务来源
  source: "self" | "player" | "npc" | "system";
}

// ==================== NPC任务管理器 ====================
export interface TaskOwner {
  id: string;
  x: number;
  y: number;
  personality: Record<string, number>;
  currentTask?: Task;
  taskQueue: Task[];
}

// ==================== 任务系统 ====================
export class TaskSystem {
  private mapManager: MapManager;
  private tasks: Map<string, Task[]> = new Map(); // npcId -> tasks

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
  }

  /**
   * 给NPC分配任务
   */
  assignTask(npcId: string, task: Task): boolean {
    const npcTasks = this.tasks.get(npcId) || [];

    // 检查NPC是否会接受这个任务
    if (!this.willAcceptTask(npcId, task)) {
      return false;
    }

    npcTasks.push(task);
    // 按优先级排序
    npcTasks.sort((a, b) => a.priority - b.priority);
    this.tasks.set(npcId, npcTasks);

    return true;
  }

  /**
   * 检查NPC是否会接受任务
   * 基于性格判断
   */
  private willAcceptTask(npcId: string, task: Task): boolean {
    // TODO: 从NPC数据中获取性格
    // 这里简化处理，所有任务都接受
    return true;
  }

  /**
   * 获取NPC的当前任务
   */
  getCurrentTask(npcId: string): Task | undefined {
    const npcTasks = this.tasks.get(npcId);
    if (!npcTasks || npcTasks.length === 0) return undefined;
    return npcTasks[0];
  }

  /**
   * 获取NPC的所有任务
   */
  getTasks(npcId: string): Task[] {
    return this.tasks.get(npcId) || [];
  }

  /**
   * 完成任务
   */
  completeTask(npcId: string, taskId: string): void {
    const npcTasks = this.tasks.get(npcId);
    if (!npcTasks) return;

    const index = npcTasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      npcTasks.splice(index, 1);
      this.tasks.set(npcId, npcTasks);
    }
  }

  /**
   * 取消任务
   */
  cancelTask(npcId: string, taskId: string): void {
    this.completeTask(npcId, taskId);
  }

  /**
   * 清空所有任务
   */
  clearTasks(npcId: string): void {
    this.tasks.delete(npcId);
  }

  /**
   * 创建移动任务
   */
  createMoveTask(
    x: number,
    y: number,
    priority: TaskPriority = TaskPriority.NORMAL,
    source: Task["source"] = "player"
  ): Task {
    return {
      id: `move_${Date.now()}_${Math.random()}`,
      type: TaskType.MOVE,
      priority,
      target: { x, y },
      description: `移动到 (${x}, ${y})`,
      createdAt: Date.now(),
      source,
    };
  }

  /**
   * 创建对话任务
   */
  createTalkTask(
    targetNpcId: string,
    priority: TaskPriority = TaskPriority.NORMAL,
    source: Task["source"] = "self"
  ): Task {
    return {
      id: `talk_${Date.now()}_${Math.random()}`,
      type: TaskType.TALK,
      priority,
      target: { npcId: targetNpcId },
      description: `与 ${targetNpcId} 对话`,
      createdAt: Date.now(),
      source,
    };
  }

  /**
   * 创建工作任务
   */
  createWorkTask(
    buildingId?: string,
    priority: TaskPriority = TaskPriority.NORMAL,
    source: Task["source"] = "self"
  ): Task {
    return {
      id: `work_${Date.now()}_${Math.random()}`,
      type: TaskType.WORK,
      priority,
      target: { buildingId },
      description: buildingId ? `在 ${buildingId} 工作` : "工作",
      createdAt: Date.now(),
      source,
    };
  }

  /**
   * 创建追求任务
   */
  createPursueTask(
    targetNpcId: string,
    priority: TaskPriority = TaskPriority.HIGH,
    source: Task["source"] = "self"
  ): Task {
    return {
      id: `pursue_${Date.now()}_${Math.random()}`,
      type: TaskType.PURSUE,
      priority,
      target: { npcId: targetNpcId },
      description: `追求 ${targetNpcId}`,
      createdAt: Date.now(),
      source,
    };
  }

  /**
   * 更新任务（检查超时等）
   */
  updateTasks(now: number): void {
    for (const [npcId, npcTasks] of this.tasks.entries()) {
      // 移除超时任务
      const validTasks = npcTasks.filter(task => {
        if (task.timeout && now - task.createdAt > task.timeout) {
          return false;
        }
        return true;
      });

      if (validTasks.length !== npcTasks.length) {
        this.tasks.set(npcId, validTasks);
      }
    }
  }

  /**
   * 简单的路径查找（直线）
   * TODO: 实现A*寻路
   */
  findPath(startX: number, startY: number, endX: number, endY: number): Array<[number, number]> {
    const path: Array<[number, number]> = [];
    const dx = endX - startX;
    const dy = endY - startY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(startX + dx * t);
      const y = Math.round(startY + dy * t);

      // 检查是否可通行
      if (this.mapManager.isPassable(x, y)) {
        path.push([x, y]);
      } else {
        // 尝试找附近的可通行点
        const [nx, ny] = this.mapManager.findNearestPassable(x, y);
        path.push([nx, ny]);
      }
    }

    return path;
  }
}
