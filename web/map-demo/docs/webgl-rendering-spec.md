# WebGL GPU 渲染方案规范

## 1. 目标

将等距 2.5D 地图的渲染任务从 CPU（Canvas2D）迁移到 GPU（WebGL），以释放 CPU 资源用于游戏逻辑、NPC AI、物理模拟等计算密集型任务。

## 2. 现状分析

### 2.1 当前 Canvas2D 方案
- **渲染流程**：首次烘焙整图到 offscreen Canvas，后续每帧 `drawImage` 复制可见区域
- **CPU 占用**：低（烘焙一次后 O(1) 每帧）
- **瓶颈**：
  - 大地图首次烘焙慢（数秒卡顿）
  - 无法支持动态效果（水流、天气、光照）
  - 建筑细节依赖 Canvas2D 路径绘制，复杂建筑 CPU 开销大
  - 缩放/平移时只能看到预渲染的静态图像

### 2.2 为什么需要 GPU
| 场景 | Canvas2D | WebGL |
|------|----------|-------|
| 静态地图 | ✅ 优秀（烘焙后） | ✅ 优秀 |
| 动态水流 | ❌ 需每帧重绘 | ✅ GPU 顶点动画 |
| 天气粒子（雨/雪） | ❌ CPU 计算位置 | ✅ GPU 实例化渲染 |
| 实时光照（日夜循环） | ❌ 需重烘焙 | ✅ 片元着色器动态计算 |
| 大规模地图（500x500） | ❌ 内存爆炸 | ✅ 视锥剔除 + 流式加载 |
| 建筑动画（炊烟/旗帜） | ❌ CPU 绘制 | ✅ GPU 顶点着色器 |

## 3. 技术方案

### 3.1 核心架构

```
┌─────────────────────────────────────────┐
│           JavaScript (主线程)            │
│  - 游戏逻辑、AI、输入处理                 │
│  - 每帧更新：相机位置、NPC 位置、天气参数  │
│  - 只传递 uniform 数据到 GPU              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         WebGL Rendering Context          │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Vertex Shader│  │ Fragment Shader │   │
│  │ 顶点变换     │  │ 片元着色         │   │
│  │ - 等距投影   │  │ - 纹理采样       │   │
│  │ - 高度位移   │  │ - 光照计算       │   │
│  │ - 视锥剔除   │  │ - 雾效混合       │   │
│  └─────────────┘  └─────────────────┘   │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ VBO/IBO     │  │ Texture Atlas   │   │
│  │ 顶点缓冲     │  │ 纹理图集         │   │
│  │ - 地形网格   │  │ - 瓦片纹理       │   │
│  │ - 建筑模型   │  │ - 建筑贴图       │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
```

### 3.2 渲染管线设计

#### 阶段 1：地形渲染（Tilemap）
```glsl
// Vertex Shader
attribute vec2 a_position;      // 瓦片本地坐标（标准化）
attribute vec2 a_gridPos;       // 网格坐标 (x, y)
attribute float a_terrain;      // 地形类型 ID
attribute float a_elev;         // 海拔高度

uniform vec2 u_camera;          // 相机世界坐标
uniform float u_zoom;           // 缩放级别
uniform vec2 u_screenSize;      // 屏幕尺寸
uniform float u_time;           // 时间（用于动画）

varying float v_terrain;
varying float v_elev;
varying vec2 v_uv;

vec2 gridToIso(vec2 grid, float elev) {
  float hw = 32.0;  // 半瓦片宽
  float hh = 16.0;  // 半瓦片高
  float hs = 4.0;   // 高度缩放
  float wx = (grid.x - grid.y) * hw;
  float wy = (grid.x + grid.y) * hh - elev * hs;
  return vec2(wx, wy);
}

void main() {
  v_terrain = a_terrain;
  v_elev = a_elev;
  
  vec2 worldCenter = gridToIso(a_gridPos, a_elev);
  vec2 worldPos = worldCenter + a_position;
  vec2 screenPos = (worldPos - u_camera) * u_zoom;
  vec2 ndc = screenPos / (u_screenSize * 0.5);
  
  gl_Position = vec4(ndc, 0.0, 1.0);
}
```

```glsl
// Fragment Shader
precision mediump float;

varying float v_terrain;
varying float v_elev;
varying vec2 v_uv;

uniform sampler2D u_tileset;    // 纹理图集
uniform float u_time;           // 全局时间
uniform vec3 u_sunDir;          // 太阳方向（日夜循环）

// 地形颜色表（可改用纹理查找）
vec3 getTerrainColor(float terrain, vec2 uv) {
  // 从纹理图集采样
  vec2 tileUV = vec2(
    mod(terrain, 4.0) * 0.25 + uv.x * 0.25,
    floor(terrain / 4.0) * 0.25 + uv.y * 0.25
  );
  return texture2D(u_tileset, tileUV).rgb;
}

void main() {
  vec3 color = getTerrainColor(v_terrain, v_uv);
  
  // 简易光照
  float light = max(0.3, dot(vec3(0.0, 0.0, 1.0), u_sunDir));
  color *= light;
  
  // 水体动画
  if (v_terrain == 3.0) {
    float wave = sin(v_uv.x * 10.0 + u_time) * 0.1;
    color += vec3(wave * 0.2, wave * 0.3, wave * 0.4);
  }
  
  gl_FragColor = vec4(color, 1.0);
}
```

#### 阶段 2：建筑渲染（Instanced Rendering）
```glsl
// 使用 Instanced Arrays 扩展
// 每个建筑实例只需传递：位置、类型、颜色变体
attribute vec2 a_instancePos;   // 实例位置
attribute float a_buildingType; // 建筑类型
attribute float a_variant;      // 颜色变体

// 建筑几何体使用预定义的 VBO（立方体/屋顶）
```

#### 阶段 3：粒子系统（雨/雪/烟）
```glsl
// GPU 粒子系统
// 每个粒子：位置、速度、生命周期、类型
// 在顶点着色器中根据时间更新位置
// 使用 GL.POINTS 或 billboard quad
```

### 3.3 数据流设计

```
初始化阶段（一次）：
  1. 解析地图数据 → 生成瓦片顶点缓冲（VBO）
  2. 生成地形纹理图集（Texture Atlas）
  3. 生成建筑模型库（VBO + IBO）
  4. 上传所有数据到 GPU

每帧更新：
  1. JS 更新 uniform：相机位置、缩放、时间、天气参数
  2. GPU 执行：
     - 顶点着色器：等距投影 + 视锥剔除
     - 片元着色器：纹理采样 + 光照 + 特效
  3. 输出到屏幕
```

### 3.4 视锥剔除（Frustum Culling）

```glsl
// 在顶点着色器中进行粗粒度剔除
// 将世界坐标转换到屏幕坐标后，判断是否在视口外
// 如果在视口外，将顶点移到裁剪空间外（gl_Position = vec4(0,0,2,1)）
```

### 3.5 细节层次（LOD）

| 距离 | 策略 |
|------|------|
| 近景（0-200px） | 完整几何 + 纹理 + 动画 |
| 中景（200-500px） | 简化几何 + 纹理 |
| 远景（500px+） | 纯色块 / 不渲染 |

## 4. 性能对比预期

| 指标 | Canvas2D | WebGL | 提升 |
|------|----------|-------|------|
| 首次加载 | 3-5秒烘焙 | 0.5秒上传 | 6-10x |
| 每帧渲染（100x100地图） | 5ms drawImage | 1ms GPU | 5x |
| 每帧渲染（500x500地图） | 不可行 | 2ms GPU | ∞ |
| 动态效果（水流） | 不可行 | 免费 | ∞ |
| CPU 占用 | 30-50% | 5-10% | 3-5x |
| GPU 占用 | 0% | 20-40% | 合理负载 |

## 5. 实现步骤

### 阶段 1：基础 WebGL 地形渲染
1. 创建 `WebGLIsoRenderer` 类
2. 实现顶点/片元着色器（基础等距投影）
3. 生成瓦片网格 VBO
4. 实现相机控制（平移/缩放）
5. **验收标准**：100x100 地图流畅渲染，无明显视觉差异

### 阶段 2：建筑渲染
1. 定义建筑几何体（墙体 + 屋顶）
2. 实现 Instanced Rendering
3. 支持建筑类型变体（房屋/商店/农田）
4. **验收标准**：建筑正确显示，有立体感

### 阶段 3：纹理与特效
1. 创建地形纹理图集
2. 实现片元着色器光照
3. 添加水体动画
4. **验收标准**：视觉效果优于 Canvas2D 版本

### 阶段 4：粒子与天气
1. GPU 粒子系统
2. 雨雪效果
3. 雾效
4. **验收标准**：天气系统流畅运行

### 阶段 5：优化
1. 视锥剔除
2. LOD 系统
3. 大地图流式加载
4. **验收标准**：500x500 地图流畅运行

## 6. 回退策略

```typescript
class Game {
  private useWebGL = true;
  
  init() {
    try {
      this.webglRenderer = new WebGLIsoRenderer(this.canvas);
      this.webglRenderer.uploadMapData(...);
    } catch (e) {
      console.warn("WebGL 初始化失败，回退到 Canvas2D:", e);
      this.useWebGL = false;
    }
  }
  
  draw() {
    if (this.useWebGL) {
      this.webglRenderer.render(...);
    } else {
      renderIsoMap(...); // Canvas2D 回退
    }
  }
}
```

## 7. 文件结构

```
src/render/
├── IsometricMap.ts          # Canvas2D 渲染器（保留作为回退）
├── WebGLIsoRenderer.ts      # WebGL 渲染器主类
├── shaders/
│   ├── tile.vert            # 地形顶点着色器
│   ├── tile.frag            # 地形片元着色器
│   ├── building.vert        # 建筑顶点着色器
│   ├── building.frag        # 建筑片元着色器
│   ├── particle.vert        # 粒子顶点着色器
│   └── particle.frag        # 粒子片元着色器
├── geometry/
│   ├── TileMesh.ts          # 瓦片网格生成
│   ├── BuildingMesh.ts      # 建筑网格生成
│   └── ParticleSystem.ts    # GPU 粒子系统
└── textures/
    └── TilesetAtlas.ts      # 纹理图集管理
```

## 8. 关键技术点

### 8.1 等距投影在 GPU 中的实现
```glsl
// 网格坐标 → 世界坐标（等距投影）
vec2 gridToWorld(vec2 grid, float elev) {
  float hw = 32.0;  // 半瓦片宽
  float hh = 16.0;  // 半瓦片高
  float wx = (grid.x - grid.y) * hw;
  float wy = (grid.x + grid.y) * hh - elev * 4.0;
  return vec2(wx, wy);
}
```

### 8.2 深度排序
- WebGL 默认使用深度缓冲（Z-buffer）
- 等距地图需要画家算法（从远到近绘制）
- 解决方案：在 CPU 侧对可见瓦片排序，按顺序提交 draw call
- 或使用 `gl.enable(gl.DEPTH_TEST)` 配合正确设置 Z 值

### 8.3 纹理图集
- 将所有瓦片纹理合并到一张大图
- 通过 UV 坐标访问不同纹理
- 避免纹理切换导致的 draw call 中断

### 8.4 实例化渲染（Instancing）
- 相同几何体的建筑只需上传一次模型数据
- 通过 `ANGLE_instanced_arrays` 或 WebGL2 的 `drawArraysInstanced`
- 每个实例传递不同的变换矩阵和颜色

## 9. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| WebGL 不支持 | 高 | 保留 Canvas2D 回退 |
| 着色器编译失败 | 高 | 运行时检测，自动回退 |
| 移动端性能差 | 中 | 提供画质选项（低/中/高） |
| 开发复杂度高 | 中 | 分阶段实现，先基础后特效 |
| 浏览器兼容性 | 低 | 使用 WebGL1 + 扩展，覆盖 95%+ 浏览器 |

## 10. 参考实现

已有的 `WebGLIsoRenderer.ts` 是一个起点，但存在以下问题需要修复：
1. 使用 `gl.POINTS` 导致瓦片变形 → 改用 `gl.TRIANGLES`
2. 建筑渲染未实现 → 添加 Instanced Rendering
3. 纹理支持缺失 → 添加 Texture Atlas
4. 动态效果缺失 → 添加时间 uniform 和动画
