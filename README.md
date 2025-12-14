# GensenWebAvatar

基于 Three.js 的 GLB 模型查看器，支持多实例 Avatar 加载、外部/嵌入动画、HDR 环境和简单后处理。

## 快速开始

安装依赖并启动开发服务器：

```bash
npm install
npm run dev
```

浏览器会打开 http://localhost:3000（或按 Vite 输出的地址）。

## 新增：Avatar 抽象与多实例支持

代码已重构为可复用的 `Avatar` 类（文件：`src/avatar.js`），它封装了模型加载、材质修正、居中/缩放、Y 轴偏移和动画播放逻辑。

- 动画加载顺序：优先尝试外部动画文件（由 `animPath` 指定），若无则回退到模型内嵌动画。
- 对于骨骼动画（SkinnedMesh），类会尝试在 `SkinnedMesh` 上创建 `AnimationMixer` 并播放。

同时在 `src/main.js` 中提供统一调用：

```javascript
// 在浏览器控制台或代码中调用，参数为 public/ 下的资源路径
loadTwoAvatars(modelPathA, modelPathB, animPathA, animPathB)
```

示例：

```javascript
loadTwoAvatars('/models/avatarA.glb', '/models/avatarB.glb', '/animations/aniA.glb', '/animations/aniB.glb')
```

运行后会在场景中并排显示两个 Avatar（默认左右分布），每个 Avatar 使用各自的动画资源。

## 运行时 API（浏览器控制台）

- `setAvatarScale(s, idx = 0)`：设置序号为 `idx` 的 Avatar 缩放倍数。
- `setModelYOffset(y, idx = 0)`：设置序号为 `idx` 的 Avatar 垂直偏移。
- `loadTwoAvatars(modelA, modelB, animA, animB)`：按需加载两个 Avatar（见上）。

示例：

```javascript
// 第一个 Avatar 放大为 1.2
setAvatarScale(1.2, 0)

// 第二个 Avatar 向上偏移 0.5
setModelYOffset(0.5, 1)
```

## 原有功能速览

- GLB/GLTF 模型加载（`GLTFLoader`）
- 材质与贴图色彩空间修正（sRGB）
- HDR 环境贴图：`public/textures/environment.hdr`（由 `RGBELoader` 加载）
- 后处理：`EffectComposer` + `UnrealBloomPass`
- 自定义手势控制：鼠标/触摸拖动用于模型 Y 轴旋转（当前实现会旋转所有加载的 Avatar）

## 约定与性能

- 资源放置：`public/models/` 和 `public/animations/`（Vite 将 `/` 映射到 `public/`）
- 像素比被限制为设备像素比的最大 2 倍以提高性能
- 阴影分辨率：1024×1024

## 调试与常见问题

- 控制台提供动画调试日志（列出嵌入与外部 clip 名称及轨道），用于帮助定位动画目标不匹配的问题。
- 如果动画未作用于模型，请确认外部动画的轨道目标名称与模型节点一致，或在控制台查看 `External clip tracks:` 日志并提交给维护者以便重映射。

## 开发建议

- 如果需要：我可以添加每个 Avatar 的独立旋转选择、UI 控件（缩放/偏移滑块）或将 `Avatar` 类导出为更完整的组件接口。

