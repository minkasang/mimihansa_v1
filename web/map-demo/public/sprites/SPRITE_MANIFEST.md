# 精灵图生成清单

> ⚠️ 把这个文件喂给 AI 图像生成工具（Kimi 2.6 / Midjourney / DALL-E）
> AI 应该读此文件，为每个 NPC 生成对应的精灵表 PNG
> 输出到 `f:\project\games1\shapan2\web\map-demo\public\sprites\`

---

## 一、输出目录

```
web\map-demo\public\sprites\
  ├── farmer_m.1.png      农民男1（张文博）
  ├── farmer_m.2.png      农民男2（陈德厚）
  ├── farmer_f.1.png      农民女（李秀兰）
  ├── merchant_m.1.png    水果店老板男（周明哲）
  ├── merchant_f.1.png    花店老板女（陈晓燕）
  ├── tailor_f.1.png      服装店老板女（林玉芳）
  ├── hunter_m.1.png      猎人男（黄志远）
  ├── scholar_m.1.png     书生男（郑广福）
  ├── farmer_m.3.png      村民男通用版
  ├── farmer_f.2.png      村民女通用版
  ├── thug_m.1.png        恶霸男
  ├── girl_f.1.png        少女
  ├── elder_f.1.png       老奶奶
  └── kid_m.1.png         小男孩
```

共 **14 个角色**。

---

## 二、技术规格（每个 PNG 必须遵守）

| 参数 | 值 |
|:------|:---|
| 文件格式 | PNG，透明背景 |
| 单帧尺寸 | **32×48 像素** |
| 总帧数 | **8 帧水平排列** |
| 精灵表总尺寸 | **256×48 像素**（8 × 32 = 256） |
| 色彩 | 16-bit，每色块 2-3 色阶，无渐变 |
| 风格 | 像素风，Q版大头（头占身高 1/3），2.5D 等角俯视 |
| 阴影 | 精灵图中不画阴影，代码运行时画 |


## 三、8 帧布局（从左到右）

```
帧0: 正面-左脚在前, 右手在前
帧1: 正面-右脚在前, 左手在前
帧2: 背面-左脚在前, 右手在前
帧3: 背面-右脚在前, 左手在前
帧4: 左侧-左脚在前, 右手在前
帧5: 左侧-右脚在前, 左手在前
帧6: 右侧-左脚在前, 右手在前
帧7: 右侧-右脚在前, 左手在前
```


## 四、AI 绘画通用提示词（每条附在角色描述后面）

```
Pixel art character sprite sheet for isometric 2.5D RPG game,
8-frame horizontal animation strip, 32x48 pixels per frame, 256x48 total,
isometric top-down view, 4-directional walking animation,
Q-style chibi proportions with big head (1/3 of body height),
16-bit SNES color palette, flat cel-shading, no gradients,
crisp clean pixel edges, 2-3 shade levels per color,
Stardew Valley art style, transparent PNG background
```


## 五、14 个角色的具体描述

### 1. 农民男 — 张文博（farmer_m.1.png）
```
Character: male, young adult (25)
Body: medium height, standard build, straight back
Skin: warm tone (#F5D0B0)
Hair: black, short, neat
Face: round face, large round eyes, thick eyebrows, small nose, small mouth
Expression: gentle smile, bright eyes
Clothes: grass-green short-sleeve shirt, brown long pants, cloth shoes
Hat: straw hat (yellowish beige #c9a96e)
Style: clean but worn, practical
```

### 2. 农民男 — 陈德厚（farmer_m.2.png）
```
Character: male, middle-aged (45)
Body: medium height, strong build, wide shoulders, slightly hunched
Skin: wheat tone (#E8C4A0)
Hair: black with gray streaks, short, receding hairline
Face: square face, small eyes (slanted up), bushy eyebrows, big nose
Expression: serious, sharp gaze
Clothes: gray tank top, dark brown pants, boots
Belt: leather belt with bronze buckle
Style: worn, patched
```

### 3. 农民女 — 李秀兰（farmer_f.1.png）
```
Character: female, young adult (22)
Body: medium height, slim
Skin: warm tone (#F5D0B0)
Hair: black, double ponytails
Face: oval face, large round eyes, thin eyebrows, small nose, small mouth, rosy cheeks
Expression: bright smile, lively eyes
Clothes: pink short-sleeve shirt, dark blue skirt, cloth shoes
Hair accessory: red ribbon
Style: clean, cute
```

### 4. 水果店老板男 — 周明哲（merchant_m.1.png）
```
Character: male, middle-aged (50)
Body: medium height, heavy build, round belly
Skin: warm tone (#F5D0B0)
Hair: gray, balding (sides only), short
Face: round face, small eyes (droopy), thin eyebrows, round nose, double chin
Expression: friendly smile, warm eyes
Clothes: dark purple long robe, gold-bordered belt
Style: clean, slightly fancy
```

### 5. 花店老板女 — 陈晓燕（merchant_f.1.png）
```
Character: female, young adult (28)
Body: medium height, standard build
Skin: pale tone (#FFEFE0)
Hair: deep brown, medium length, loose
Face: heart-shaped face, large almond eyes, thin arched eyebrows, small nose, small mouth
Expression: warm smile, gentle eyes, light makeup
Clothes: light pink long dress with floral pattern, white apron, cloth shoes
Hair accessory: small flower pin
Style: elegant, feminine
```

### 6. 服装店老板女 — 林玉芳（tailor_f.1.png）
```
Character: female, young adult (30)
Body: tall, slim
Skin: pale tone (#FFEFE0)
Hair: black, high ponytail
Face: oval face, sharp eyes (slanted up), thin eyebrows, pointed nose, thin lips
Expression: confident smirk, sharp gaze, heavy makeup (red lips)
Clothes: purple fitted blouse, black pencil skirt, heels
Neck accessory: silver necklace
Style: fashionable, slightly dramatic
```

### 7. 猎人男 — 黄志远（hunter_m.1.png）
```
Character: male, middle-aged (40)
Body: tall, strong build, wide shoulders, straight posture
Skin: dark tone (#C49464)
Hair: dark brown with gray, short, messy
Face: angular face, small sharp eyes, thick bushy eyebrows, hooked nose, facial scar across left cheek, stubble beard
Expression: stern, piercing gaze
Clothes: brown leather vest over gray shirt, dark brown pants, leather boots
Belt: thick leather belt
Accessory: bow on back
Style: rugged, practical, worn
```

### 8. 书生男 — 郑广福（scholar_m.1.png）
```
Character: male, young adult (23)
Body: medium height, thin, narrow shoulders, hunched back
Skin: pale tone (#FFEFE0)
Hair: black, medium length, messy
Face: long face, droopy eyes, thin eyebrows, flat nose, thick lips, dark circles under eyes
Expression: melancholic, dull gaze
Clothes: faded gray long robe, cloth shoes
Accessory: holding a book scroll
Style: worn, wrinkled, too large
```

### 9. 村民男通用版（farmer_m.3.png）
```
Character: male, young adult (28)
Body: medium height, standard build
Skin: warm tone (#F5D0B0)
Hair: dark brown, short, side-parted
Face: round face, medium round eyes, normal eyebrows, small nose, standard mouth
Expression: friendly smile
Clothes: light blue short-sleeve shirt, gray pants, cloth shoes
Style: clean, ordinary
```

### 10. 村民女通用版（farmer_f.2.png）
```
Character: female, young adult (26)
Body: medium height, standard build
Skin: warm tone (#F5D0B0)
Hair: black, low ponytail
Face: round face, large round eyes, thin eyebrows, small nose
Expression: gentle smile
Clothes: beige long-sleeve dress, brown apron, cloth shoes
Style: clean, practical
```

### 11. 恶霸男（thug_m.1.png）
```
Character: male, young adult (28)
Body: tall, strong, wide shoulders, slouched posture
Skin: warm tone (#F5D0B0)
Hair: red, mohawk
Face: square face, slanted-up sharp eyes, angled eyebrows, broken nose, thin mouth with smirk, chin stubble, neck tattoo
Expression: arrogant scowl, menacing eyes
Clothes: dark red sleeveless vest, black pants, boots
Belt: skull buckle
Accessory: pipe in mouth
Style: rough, intimidating
```

### 12. 少女（girl_f.1.png）
```
Character: female, child-teen (14)
Body: short, slim
Skin: pale tone (#FFEFE0)
Hair: light brown, twin braids
Face: round chubby face, large sparkling round eyes, thin eyebrows, small nose, rosy cheeks, freckles
Expression: bright smile, sparkling eyes
Clothes: yellow short-sleeve dress, white sandals
Hair accessory: flower hair clip
Style: cute, colorful, youthful
```

### 13. 老奶奶（elder_f.1.png）
```
Character: female, elderly (70)
Body: short, heavy, hunched back
Skin: warm tone with age spots
Hair: white, bun at back
Face: round face, small droopy eyes with eye bags, wrinkles (crow's feet, smile lines), round nose, thin mouth with gentle smile
Expression: kind smile, soft warm eyes
Clothes: dark blue floral long-sleeve dress, black long skirt, cloth shoes, white apron
Accessory: walking cane (optional)
Style: modest, traditional, slightly worn
```

### 14. 小男孩（kid_m.1.png）
```
Character: male, child (8)
Body: very short, chubby, short neck
Skin: warm tone (#F5D0B0)
Hair: light brown, curly, messy
Face: round chubby face, huge round sparkling eyes, tiny nose, small mouth, dimples
Expression: innocent wide-eyed stare, bright curious eyes
Clothes: yellow T-shirt, orange shorts, sandals
Style: bright, playful, slightly dirty
```


## 六、使用方式

```
1. 把这 14 个角色描述逐个喂给 AI
2. 每个角色附上"通用提示词"
3. AI 输出 256×48 PNG 放到 public/sprites/
4. 文件名必须跟上面指定的一致
5. 生成完了告诉我，我把它们挂到地图上
```


## 七、代码加载方式

生成后，在 `main.ts` 里这样加载：

```typescript
// 加载所有精灵图
const spriteCache = new Map<string, HTMLImageElement>();
const spriteFiles = [
  'farmer_m.1.png', 'farmer_m.2.png', 'farmer_f.1.png',
  'merchant_m.1.png', 'merchant_f.1.png', 'tailor_f.1.png',
  'hunter_m.1.png', 'scholar_m.1.png',
  'farmer_m.3.png', 'farmer_f.2.png',
  'thug_m.1.png', 'girl_f.1.png', 'elder_f.1.png', 'kid_m.1.png',
];

await Promise.all(spriteFiles.map(async (file) => {
  const img = new Image();
  img.src = `/sprites/${file}`;
  await img.decode();
  spriteCache.set(file, img);
}));

// NPC 根据外观属性选精灵图
function selectSprite(appearance): HTMLImageElement {
  const key = `${appearance.职业}_${appearance.性别}`;
  // ... 映射逻辑
}
```

帧提取（8 帧水平排列，每帧 32×48）：

```typescript
function drawSpriteFrame(ctx, img, direction, walkFrame) {
  const dirMap = { down: 0, up: 2, left: 4, right: 6 };
  const frameIdx = dirMap[direction] + (walkFrame % 2);
  ctx.drawImage(img,
    frameIdx * 32, 0, 32, 48,    // 源
    targetX, targetY, 32, 48     // 目标
  );
}
```
