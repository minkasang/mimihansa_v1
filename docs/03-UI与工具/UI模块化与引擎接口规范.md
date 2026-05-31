# UI 模块化与引擎接口规范

> 本文档定义：**表现层如何只做「画面输出」**、**引擎/API 如何只做「结构化输入」**，以及二者之间的**可扩展接口族**。  
> 视觉像素、配色、布局细则仍以 [UI设计规范.md](./UI设计规范.md) 为准；调试与可视化需求分别对齐 [调试工具规范.md](./调试工具规范.md)、[可视化面板规范.md](./可视化面板规范.md)。

---

## 1. 设计目标与参考风格

### 1.1 参考风格（星露谷物语式像素）

- **整体气质**：高对比、暖色点缀、清晰描边、少渐变；控件像「木牌/便签」叠在画面上，而非扁平商务风。  
- **与现有 UI 设计规范的关系**：`UI设计规范.md` 中的 16×16 基础格、800×600 基准画布、调色板限制**保留**；本文件不重复像素绘制细节，只要求**接口层传下来的数据**足以支撑该风格（例如格子坐标、昼夜阶段枚举、图标图集索引）。  
- **命名说明**：口头常说的「星云谷语」一般指《星露谷物语》(Stardew Valley)，下文统一写「星露式」。

### 1.2 三份 UI 规范在本架构中的位置

| 规范文档 | 在本架构中的角色 |
|----------|------------------|
| UI设计规范 | 视觉与交互「怎么画、点哪里」 |
| 调试工具规范 | 调试类面板需要订阅哪些**调试接口** |
| 可视化面板规范 | 统计/图表类面板需要订阅哪些**分析接口** |

---

## 2. 输入 / 输出模型（核心）

```
                    ┌─────────────────────────────┐
  各类「引擎接口」   │  只读快照 / 事件 / 配置    │  ← 输入（数据进 UI）
  （见第 5 节）      └──────────────┬────────────┘
                                   │  订阅、合并、节流
                                   ▼
                    ┌─────────────────────────────┐
                    │  UI 模块（Panel / Widget）   │
                    │  无游戏逻辑，只做展示与输入  │
                    └──────────────┬────────────┘
                                   │  Canvas / DOM 绘制
                                   ▼
                    ┌─────────────────────────────┐
                    │  像素画面（一帧输出）       │  ← 输出
                    └─────────────────────────────┘
```

- **输出**：每一帧（或按需）在屏幕上呈现的像素结果；**不得**在 UI 内计算「走一步后的世界状态」，只**展示**引擎已通过接口给出的状态。  
- **输入**：引擎或 API 层暴露的**只读数据结构**与**少量控制意图**（例如暂停、选中 NPC）；具体形状由下文接口族约定。  
- **实时性**：人物走了一步 → 引擎在下一 Tick 或下一快照中更新坐标 → UI 在下一渲染周期读到新快照 → 画面更新；允许**显示层节流**（例如调试面板 10Hz），但语义上仍是「订阅最新快照」。

---

## 3. 分层与模块边界

| 层级 | 职责 | 禁止事项 |
|------|------|----------|
| **引擎 / API** | 产出权威状态、Tick 推进、校验指令 | 不关心像素、字体 |
| **UI 适配层（Adapter）** | 把引擎内部模型映射为「UI 快照 DTO」、版本号、缺省字段填充 | 不写业务规则（如战斗胜负） |
| **UI 状态合成（Composer）** | 合并多路接口、去抖、脏区域标记 | 不修改引擎状态 |
| **Panel 模块** | 某一块界面（顶栏、小地图、NPC 卡等） | 不直接读 Storage JSON 文件 |
| **绘制层（Renderer）** | 像素字、九宫格框、精灵批处理 | 不发起「改变游戏世界」的副作用（除明确 `I玩家指令回传`） |

**模块化要求**：每个 Panel **只依赖**其声明的一组接口 ID；未注册的接口缺失时，Panel 必须**降级展示**（占位图 +「数据未接入」），不得崩溃。

---

## 4. 快照与版本（冗余与演进）

### 4.1 快照通用字段

凡引擎推送给 UI 的快照对象，建议在适配层统一带上（字段名供 JSON / TS 类型对齐用；若落地 JSON，字段名用**中文**与 NPC参数总表 一致）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `快照版本` | number | 单调递增，UI 可用于丢弃过期帧 |
| `逻辑Tick` | number | 当前逻辑帧，便于调试对齐 |
| `时间戳` | string | ISO 或 `游戏时间` 展示串，二选一或并存由适配层定 |
| `扩展块` | object | **可选**，未知键由 UI 忽略，便于 Mod 或后续加字段 |

### 4.2 兼容策略

- **未知字段**：忽略。  
- **缺省字段**：Adapter 填合理默认值并打 DEBUG 日志（调试模式）。  
- **多实现并存**：同一接口可有「主实现 + 备用实现」（见 6.2），用于引擎迁移或 A/B。

---

## 5. 接口族定义（可扩展清单）

以下接口 ID 为稳定字符串，供注册表引用。  
TypeScript 中接口名用英文；若序列化为 JSON，**属性键名用中文**（与 NPC参数总表 一致）。

### 5.1 核心：`I世界画布快照`（主画面输入）

**接口 ID**：`ui.snapshot.world_canvas`

**职责**：主画布所需的瓦片、实体占位、摄像机、昼夜、可选高亮层。

```ts
/** 引擎 → UI；JSON 序列化时对象键用中文 */
interface IWorldCanvasSnapshot {
  快照版本: number;
  逻辑Tick: number;
  摄像机: { 格子x: number; 格子y: number; 缩放: number };
  地图尺寸: { 宽格: number; 高格: number };
  /** 可见范围内简化的绘制指令或瓦片索引，具体结构由世界系统规范细化 */
  图层索引表: unknown;
  实体简表: Array<{
    实体id: string;
    类型: "玩家" | "NPC" | "物品" | "建筑" | string;
    格子x: number;
    格子y: number;
    朝向?: "down" | "up" | "left" | "right";
    动画状态?: "idle" | "walk" | "run" | string;
    帧索引?: number;
    /** 外观信息，与《角色精灵与动画规范》对齐 */
    外观?: {
      发型?: { id: string; 颜色: string };
      肤色?: string;
      眼睛?: { 样式: string; 颜色: string };
      上衣?: { id: string; 颜色: string };
      下装?: { id: string; 颜色: string };
      鞋子?: { id: string; 颜色: string };
    };
  }>;
  昼夜?: "昼" | "昏" | "夜";
  扩展块?: Record<string, unknown>;
}
```

### 5.2 `I顶部信息栏`（对齐 UI设计规范 · 顶部信息栏）

**接口 ID**：`ui.snapshot.top_bar`

```ts
interface ITopBarSnapshot {
  快照版本: number;
  逻辑Tick: number;
  游戏时间显示: string;
  资源概览?: Array<{ 名称: string; 数量: number; 图标键?: string }>;
  扩展块?: Record<string, unknown>;
}
```

### 5.3 `I底部控制栏`

**接口 ID**：`ui.snapshot.bottom_bar`

```ts
interface IBottomBarSnapshot {
  快照版本: number;
  当前速度档?: number;
  可用工具列表?: Array<{ 工具id: string; 名称: string; 选中: boolean }>;
  扩展块?: Record<string, unknown>;
}
```

### 5.4 `I选中焦点`（谁被点开 / 悬停）

**接口 ID**：`ui.snapshot.selection`

```ts
interface ISelectionSnapshot {
  快照版本: number;
  选中类型?: "无" | "格子" | "NPC" | "物品" | "建筑";
  目标id?: string;
  格子x?: number;
  格子y?: number;
  扩展块?: Record<string, unknown>;
}
```

### 5.5 `INPC详情卡`（悬浮面板数据源）

**接口 ID**：`ui.snapshot.npc_card`

与 `NPC参数总表.md` 对齐的**展示用子集**，不含秘密策划用字段时可裁剪。

### 5.6 `I调试聚合快照`（对齐 调试工具规范）

**接口 ID**：`ui.snapshot.debug_bundle`

一个「容器接口」，内部再分子键，便于只开部分面板：

```ts
interface IDebugBundleSnapshot {
  快照版本: number;
  逻辑Tick: number;
  世界状态?: {
    活跃NPC数: number;
    活跃事件数: number;
    fps?: number;
  };
  当前选中NPC?: unknown; // 结构同 NPC 调试面板需求
  效用AI?: unknown;       // 痛点、候选动作、得分表
  日志尾部?: Array<{ 级别: string; 模块: string; 文本: string }>;
  扩展块?: Record<string, unknown>;
}
```

### 5.7 `I可视化统计`（对齐 可视化面板规范）

**接口 ID**：`ui.snapshot.analytics`

```ts
interface IAnalyticsSnapshot {
  快照版本: number;
  图表包?: Array<{
    图表id: string;
    类型: "折线" | "柱状" | "饼" | "网络" | string;
    数据: unknown;
  }>;
  扩展块?: Record<string, unknown>;
}
```

### 5.8 `I玩家指令回传`（UI → 引擎，窄通道）

**接口 ID**：`ui.command.player`

仅允许「意图」，不允许 UI 直接改存档：

```ts
interface IPlayerUiCommand {
  指令类型:
    | "设置速度档"
    | "请求暂停切换"
    | "选中实体"
    | "移动摄像机"
    | "调试用_单步"
    | string;
  载荷?: Record<string, unknown>;
}
```

由 **API 层**校验后转引擎；UI 不实现游戏规则。

### 5.9 预留注册位（冗余 / 可自行增加）

| 预留接口 ID | 用途 |
|---------------|------|
| `ui.snapshot.mod.1` ~ `ui.snapshot.mod.8` | 第三方或试验模块快照槽位 |
| `ui.command.mod.1` ~ `ui.command.mod.4` | 试验指令回传槽位 |

新增业务接口时：**优先**使用 `扩展块` + Panel 私有解析；确需独立契约时再申请新 ID 并更新本表。

---

## 6. 注册表、依赖注入与扩展

### 6.1 Panel 声明式依赖

每个 Panel 配置（可为 JSON）声明：

| 字段 | 说明 |
|------|------|
| `面板id` | 唯一 |
| `依赖接口列表` | 接口 ID 数组；**任一**缺失则走降级 UI |
| `刷新策略` | `每帧` / `每Tick` / `节流_ms` |
| `优先级` | 重叠时绘制顺序 |

### 6.2 多实现与优先级（冗余）

同一 `接口 ID` 可注册多个 Provider：

- 解析顺序：**优先级数字大者覆盖**；或 **merge 策略**（仅针对 `扩展块`）。  
- 用途：旧引擎 / 新引擎双实现；单机 / 联机数据源切换。

### 6.3 动态增删接口

- 启动时扫描「接口模块清单」（如 `ui_providers.json`），加载额外 Provider。  
- **不得**在运行时要求 UI 重新编译；动态部分通过注册表 + 已知 `扩展块` 完成。

---

## 7. 与三份规范的模块映射（实现 checklist）

| 用户可见能力 | 主要 Panel | 依赖接口 ID |
|--------------|-------------|----------------|
| 顶部信息栏 | TopBarPanel | `ui.snapshot.top_bar` |
| 主世界画布 | WorldCanvasPanel | `ui.snapshot.world_canvas` |
| 底部控制栏 | BottomBarPanel | `ui.snapshot.bottom_bar` + `ui.command.player` |
| 悬浮 NPC 详情 | NpcFloatPanel | `ui.snapshot.npc_card` + `ui.snapshot.selection` |
| 世界状态调试 | DebugWorldPanel | `ui.snapshot.debug_bundle.世界状态` |
| NPC 调试 | DebugNpcPanel | `ui.snapshot.debug_bundle.当前选中NPC` |
| 效用 AI 调试 | DebugUtilityPanel | `ui.snapshot.debug_bundle.效用AI` |
| 日志 | LogPanel | `ui.snapshot.debug_bundle.日志尾部` |
| 统计 / 关系图 | AnalyticsPanel | `ui.snapshot.analytics` |

（具体拆分可在实现阶段把 `debug_bundle` 拆成独立接口，但 ID 保持稳定别名。）

---

## 8. 刷新与性能（100+ NPC 场景）

- **默认**：主画布每渲染帧读取最新 `I世界画布快照`；若 `快照版本` 未变可跳过重绘。  
- **调试/统计面板**：默认节流（例如 100ms），在 `调试工具规范` 中可后续写死推荐值。  
- **日志**：环形缓冲，只传尾部引用，避免每帧大数组拷贝。

---

## 9. 与其他引擎对接时的注意点

若将来迁移 Unity / Godot：

- **保留**接口 ID 与快照语义；  
- **替换** Adapter：由新引擎的 Tick / LateUpdate 填充同一套 DTO；  
- UI 模块与 Panel 配置**尽量不重写**。

---

*版本: 0.1*  
*状态: 讨论稿 — 可与实现并行细化字段表*
