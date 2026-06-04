/**
 * 内置指令模块工厂 - 一次性注册所有内置模块
 *
 * 这是唯一需要"写代码"的地方：
 *   每个模块的对接代码写在这里，注册一次，
 *   之后所有NPC的行为都从JSON组合这些模块，不需要再改代码。
 *
 * 新增模块的步骤：
 *   1. 在这里实现注册函数
 *   2. 在 指令模块库.json 里加定义
 *   3. 在 Actions_Library.json / 剧本 里引用
 *   4. 结束，所有NPC都能用了
 */

import {
  ModuleRegistry,
  type ModuleContext,
  type ModuleResult,
  type ModuleDefinition,
} from "./ModuleRegistry";
import moduleDefsRaw from "../../../../data/libraries/指令模块库.json";

/**
 * 创建并初始化模块注册表（注册所有内置模块）
 */
export function createModuleRegistry(): ModuleRegistry {
  const registry = new ModuleRegistry();

  // 加载JSON模块定义（元数据）
  const defsData = moduleDefsRaw as any;
  if (defsData.modules) {
    const defs: ModuleDefinition[] = Object.values(defsData.modules);
    registry.registerDefinitions(defs);
  }

  // ============= A类：移动与寻路 =============

  registry.register("move_to", (ctx, params): ModuleResult | null => {
    const target = params.target;
    if (Array.isArray(target) && target.length >= 2) {
      return { type: "move", data: { targetX: target[0], targetY: target[1] } };
    }
    return null;
  });

  registry.register("move_in_area", (ctx, params): ModuleResult | null => {
    const center = params.center as [number, number];
    const radius = params.radius as number || 3;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    return {
      type: "move",
      data: {
        targetX: center[0] + Math.cos(angle) * dist,
        targetY: center[1] + Math.sin(angle) * dist,
      },
    };
  });

  registry.register("flee_from", (ctx, params): ModuleResult | null => {
    const threatX = params.threatX as number;
    const threatY = params.threatY as number;
    const safeDistance = (params.safeDistance as number) || 10;
    const dx = ctx.npcX - threatX;
    const dy = ctx.npcY - threatY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const targetX = Math.round(ctx.npcX + (dx / dist) * safeDistance);
    const targetY = Math.round(ctx.npcY + (dy / dist) * safeDistance);
    return { type: "move", data: { targetX, targetY } };
  });

  registry.register("move_to_building", (ctx, params): ModuleResult | null => {
    const buildingId = params.building_id as string;
    const buildings = ctx.mapManager.getBuildings();
    const building = buildings.find(b => b.id === buildingId);
    if (building && building.entrance) {
      return { type: "move", data: { targetX: building.entrance[0], targetY: building.entrance[1] } };
    }
    return null;
  });

  // ============= B类：对话与语言 =============

  registry.register("say", (ctx, params): ModuleResult | null => {
    return {
      type: "dialogue",
      data: {
        text: params.text,
        duration: params.duration || 3000,
        dialogueType: params.type || "speak",
      },
    };
  });

  registry.register("say_from_template", (ctx, params): ModuleResult | null => {
    const templateId = params.template_id as string;
    if (!ctx.dialogueSystem && !ctx.dialogueTemplates) return null;

    if (ctx.dialogueTemplates) {
      const template = ctx.dialogueTemplates.get(templateId);
      if (template && template.对话列表.length > 0) {
        let text = template.对话列表[Math.floor(Math.random() * template.对话列表.length)];
        // 替换变量
        if (params.variables) {
          for (const [key, value] of Object.entries(params.variables as Record<string, string>)) {
            text = text.replace(`{${key}}`, value);
          }
        }
        return {
          type: "dialogue",
          data: { text, duration: params.duration || 3000, dialogueType: "speak" },
        };
      }
    }
    return null;
  });

  registry.register("cmd_start_dialogue", (ctx, params): ModuleResult | null => {
    if (!ctx.dialogueSystem) return null;

    const intentId = params.intent_id as string;
    const speakerNPC = params.speaker_npc as any;
    const targetNPC = params.target_npc as any;
    const variables = params.variables as Record<string, string> || {};
    const affection = params.affection as number || 0;

    if (!speakerNPC || !targetNPC) return null;

    const intent = (ctx.dialogueSystem as any).intentLib?.find((i: any) => i.意图id === intentId);
    if (!intent) return null;

    const packet = {
      意图id: intent.意图id,
      名称: intent.名称,
      语气: "neutral",
      主动方NPC: {
        id: speakerNPC.id,
        姓名: speakerNPC.姓名 || speakerNPC.id,
        性格: speakerNPC.性格 || {},
        标签: speakerNPC.标签 || [],
      },
      被动方NPC: {
        id: targetNPC.id,
        姓名: targetNPC.姓名 || targetNPC.id,
        性格: targetNPC.性格 || {},
        好感度: affection,
        标签: targetNPC.标签 || [],
      },
      变量: variables,
      环境: params.environment || { 公开场合: true, 是否白天: true },
    };

    const dialogues = (ctx.dialogueSystem as any).startDialogueScene(intent, packet);
    if (dialogues && dialogues.length > 0) {
      const first = dialogues[0];
      return {
        type: "dialogue",
        data: {
          text: first.text,
          duration: first.duration || 4000,
          dialogueType: "speak",
          _dialogues: dialogues,
        },
      };
    }
    return null;
  });

  // ============= C类：交互与社交 =============

  registry.register("look_at", (ctx, params): ModuleResult | null => {
    return { type: "animation", data: { animation: "look", target: params.target } };
  });

  registry.register("interact", (ctx, params): ModuleResult | null => {
    return { type: "interact", data: { target: params.target, action: params.action } };
  });

  registry.register("greet", (ctx, params): ModuleResult | null => {
    return { type: "dialogue", data: { text: "你好！", duration: 2500, dialogueType: "speak" } };
  });

  // ============= D类：动画与等待 =============

  registry.register("play_animation", (ctx, params): ModuleResult | null => {
    return {
      type: "animation",
      data: { animation: params.animation, duration: params.duration },
    };
  });

  registry.register("wait", (ctx, params): ModuleResult | null => {
    return { type: "wait", data: { duration: params.duration || 1000 } };
  });

  // ============= E类：状态控制 =============

  registry.register("set_state", (ctx, params): ModuleResult | null => {
    return {
      type: "state_change",
      data: { key: params.key, value: params.value, operation: params.operation },
    };
  });

  // ============= F类：商业 =============

  registry.register("open_shop", (ctx, params): ModuleResult | null => {
    if (ctx.npcStates) {
      const state = ctx.npcStates.get(ctx.npcId);
      if (state) state.isOpen = true;
    }
    return { type: "shop_open", data: { shopId: params.shop_id } };
  });

  registry.register("close_shop", (ctx, params): ModuleResult | null => {
    if (ctx.npcStates) {
      const state = ctx.npcStates.get(ctx.npcId);
      if (state) state.isOpen = false;
    }
    return { type: "shop_close", data: { shopId: params.shop_id } };
  });

  registry.register("attract_customer", (ctx, params): ModuleResult | null => {
    const range = (params.range as number) || 8;
    if (!ctx.nearbyNpcs) return { type: "wait", data: { duration: 1000 } };

    const hasNearby = ctx.nearbyNpcs.some(npc => {
      const dist = Math.sqrt((npc.x - ctx.npcX) ** 2 + (npc.y - ctx.npcY) ** 2);
      return dist < range;
    });

    if (hasNearby && ctx.dialogueTemplates) {
      const templateId = params.template_id as string;
      const template = ctx.dialogueTemplates.get(templateId);
      if (template && template.对话列表.length > 0) {
        const text = template.对话列表[Math.floor(Math.random() * template.对话列表.length)];
        return { type: "dialogue", data: { text, duration: 3000, dialogueType: "speak" } };
      }
    }
    return { type: "wait", data: { duration: 1000 } };
  });

  // ============= G类：控制流 =============

  registry.register("probability_check", (ctx, params): ModuleResult | null => {
    const chance = (params.chance as number) || 0.5;
    const success = Math.random() < chance;
    return {
      type: "probability_result",
      data: { success, nextModule: success ? params.success_module : params.fail_module },
    };
  });

  registry.register("condition_check", (ctx, params): ModuleResult | null => {
    // 简化版条件检查，实际由BrainEngine的ConditionEvaluator处理
    return { type: "condition_result", data: { condition: params.condition } };
  });

  console.log("ModuleRegistry: 已注册", registry.getAllModuleIds().length, "个内置模块:", registry.getAllModuleIds().join(", "));
  return registry;
}
