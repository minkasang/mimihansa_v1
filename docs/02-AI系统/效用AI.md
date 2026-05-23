# 效用AI规范

> 本文档定义效用AI的决策机制，是游戏的核心驱动系统。

---

## 核心理念

**不写死任何固定对话或行为**，通过计算动态涌现行为。

---

## 实现状态

✅ **已全部实现**（阶段1-14）。核心引擎文件：

| 引擎组件 | 文件 | 职责 |
|---------|------|------|
| DesireEvaluator | `engine/DesireEvaluator.ts` | 加载 `Desires_Library.json`（19条欲望），逐条检查触发条件 |
| ScoreCalculator | `engine/ScoreCalculator.ts` | 加载 `Brains_Library.json`，按34维性格为动作打分 |
| ActionLibrary | `engine/ActionLibrary.ts` | 加载 `Actions_Library.json`（14个动作），提供指令序列 |
| GOAPPlanner | `engine/GOAPPlanner.ts` | 数据驱动规划，从ActionLibrary取指令 |
| InterruptChecker | `engine/InterruptChecker.ts` | 生存威胁+天气感知中断 |
| BrainEngine | `engine/BrainEngine.ts` | 主循环tick，欲望×性格打分→选最优→执行 |
| WorldDynamics | `engine/WorldDynamics.ts` | 动作完成后：性格变化+好感度+知识传递 |
| PathFinder | `engine/PathFinder.ts` | A*寻路，替代直线移动 |
| ConditionEvaluator | `engine/ConditionEvaluator.ts` | 通用条件解析（>=、<、且/或/非/概率） |
| ModuleRegistry | `engine/ModuleRegistry.ts` | 指令模块注册表 |
| ModuleFactory | `engine/ModuleFactory.ts` | 加载 `指令模块库.json`，注册所有内置模块 |

数据账本（全部JSON驱动）：

| 数据文件 | 用途 |
|---------|------|
| `data/libraries/Desires_Library.json` | 19条欲望定义（触发条件+优先级+生成目标） |
| `data/libraries/Brains_Library.json` | 34维性格体系+每动作的评分规则+弹性性格变化规则 |
| `data/libraries/Actions_Library.json` | 14个动作（指令序列+性格倾向+效果） |
| `data/libraries/指令模块库.json` | 所有原子模块元数据 |
| `NPC/*/个人信息.json` | 每个NPC的34维性格+生理状态+知识库 |

---

## 实际决策流程

```
Tick推进(每16ms)
  → 生理更新: 疲劳+0.01, 饥饿+0.005, 心情→5
  → 感知扫描: PerceptionSystem → 周围NPC/物品
  → 每1000ms一次决策:
     → DesireEvaluator 评估19条欲望 → 激活列表(按优先级排序)
     → ActionLibrary.findActionsByTargetType() 找候选动作
     → ScoreCalculator.scoreAction() 按34维性格对每个候选打分
     → 组合分 = 欲望优先级×10 + 动作性格分
     → 选最优(欲望,动作)组合
  → GOAPPlanner 从ActionLibrary取指令序列(替换$变量)
  → executeStep() 逐步执行(wait/play_animation有耗时，其他瞬时)
  → state_change落地(Npc.applyStateChange): 饥饿↓、疲劳↓、金钱增减
  → 计划完成 → WorldDynamics.onActionCompleted(): 性格变化+好感度+知识传递
  → 每天黎明 → dailyReversion(): 性格向5回弹
```

---

## 动作打分公式

```
必要条件检查: 乐观>=6 AND 社交欲>=5 → 通过
抑制条件检查: 道德>=8 OR 宽容>=7 → 如满足则直接0分
基础分: 50
加分项: 勇敢>=6 → +20; 大方>=7 → +15; 冲动>=6 → +10
减分项: 谨慎>=7 → -20; 城府>=7 → -10
状态修正: 饥饿>7 → score=max(score, 饥饿×5)
最终得分 = 50 + 20 + 15 - 0 = 85
```

完整评分规则定义在 `Brains_Library.json` 的 `动作性格要求` 中。

---

## 欲望库（19条）

| 优先级 | 欲望id | 触发条件示例 |
|--------|--------|-------------|
| 9 | want_sleep | 疲劳>7 |
| 8 | want_eat | 饥饿>7 |
| 6 | want_chat_up | 好色≥5 AND 看到高颜值NPC |
| 5 | want_rest/want_give_gift | 疲劳5~7 / 被拒绝记忆+乐观≥5 |
| 4 | want_socialize/want_work | 社交欲≥5+附近有NPC / 勤奋≥5+缺钱 |
| 3 | want_sunbathe/want_tend_crops/want_exercise/want_fish/want_trade/want_share_knowledge | 各性格+状态门槛 |
| 2 | want_admire_nature/want_organize_home | 审美≥6 / 自律≥6 |
| 1 | want_wander | 疲劳<6且饥饿≤6 |
| 0 | want_idle(兜底) | 无条件 |

---

## 动作库（14个）

`action_sleep`, `action_eat`, `action_rest`, `action_sunbathe`, `action_wander`, `action_greet`, `action_搭讪`, `action_送礼`, `action_工作`, `action_购物`, `action_分享信息`, `action_seek_shelter`, `action_逃避`, `action_报复`

---

## 弹性性格

动作完成时触发性格变化（定义在 `Brains_Library.json` 的 `性格弹性系统.变化规则`）：

| 事件 | 性格变化 |
|------|---------|
| 被拒绝 | 乐观-0.03, 社交欲-0.02 |
| 被接受 | 乐观+0.02, 社交欲+0.01 |
| 成功送礼 | 乐观+0.05, 大方+0.02 |
| 放弃追求 | 乐观-0.05, 意志力-0.03 |
| 完成工作 | 勤奋+0.02 |
| 长期闲逛 | 勤奋-0.01 |

每天凌晨性格向中性值(5)回弹一步（速率0.01）。

---

## 扩展预留

- [x] 动作效果落地（state_change）
- [x] 弹性性格编码
- [x] 好感度更新
- [x] 知识图谱传递
- [ ] 动作冲突处理
- [ ] LLM接管（预留接口）

---

*版本: 2.0*
*最后更新: 2026-05-13*
