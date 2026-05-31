/**
 * 事件总线 - 跨系统触发链的统一机制
 * 与 docs/005_愿景与设计/ 各系统文档对齐
 *
 * 使用方式：
 *   eventBus.on("NPC死亡", (event) => { ... });
 *   eventBus.emit({ 类型: "NPC死亡", 来源: npcId, 数据: { ... } });
 */

import type { GameEvent, EventListener } from "../types/worldTypes";

export class EventBus {
  private listeners: Map<string, EventListener[]> = new Map();

  /**
   * 注册事件监听器
   */
  on(eventType: string, listener: EventListener): void {
    const existing = this.listeners.get(eventType) || [];
    existing.push(listener);
    this.listeners.set(eventType, existing);
  }

  /**
   * 移除事件监听器
   */
  off(eventType: string, listener: EventListener): void {
    const existing = this.listeners.get(eventType);
    if (!existing) return;
    const index = existing.indexOf(listener);
    if (index >= 0) {
      existing.splice(index, 1);
    }
  }

  /**
   * 触发事件
   */
  emit(event: GameEvent): void {
    const listeners = this.listeners.get(event.类型);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (err) {
          console.error(`事件处理器出错 [${event.类型}]:`, err);
        }
      }
    }
  }

  /**
   * 一次性监听器
   */
  once(eventType: string, listener: EventListener): void {
    const wrapper: EventListener = (event) => {
      this.off(eventType, wrapper);
      listener(event);
    };
    this.on(eventType, wrapper);
  }

  /**
   * 获取某类型事件的监听器数量
   */
  listenerCount(eventType: string): number {
    return this.listeners.get(eventType)?.length || 0;
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.listeners.clear();
  }
}

// 全局事件总线实例
export const globalEventBus = new EventBus();
