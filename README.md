# GensenWebAvatar

基于 Three.js 的 GLB 模型加载器，支持完整的材质、纹理和光照系统。

## 功能特性

- ✅ GLB/GLTF 模型加载
- ✅ 完整的材质和纹理支持
- ✅ 多种光照类型（环境光、方向光、半球光、点光源）
- ✅ 阴影渲染
- ✅ 轨道控制器（可旋转、缩放、平移）
- ✅ 加载进度显示
- ✅ 响应式设计

## 安装

```bash
npm install
```

## 使用

1. 将你的 GLB 模型文件放在 `public/models/` 文件夹中
2. 重命名为 `avatar.glb` 或修改 `src/main.js` 中的路径
3. 运行开发服务器：

```bash
npm run dev
```

4. 浏览器将自动打开 http://localhost:3000

## 构建

```bash
npm run build
```

构建后的文件将输出到 `dist/` 文件夹。

## 项目结构

```
GensenWebAvatar/
├── public/
│   └── models/          # 存放 GLB 模型文件
│       └── avatar.glb   # 你的模型文件（需要自己添加）
├── src/
│   └── main.js          # 主要的 Three.js 代码
├── index.html           # HTML 入口文件
├── package.json         # 依赖配置
├── vite.config.js       # Vite 配置
└── README.md            # 说明文档
```

## 光照系统

项目包含以下光照：

- **环境光 (AmbientLight)**: 0.5 强度，提供基础照明
- **方向光 (DirectionalLight)**: 1.5 强度，模拟太阳光，支持阴影
- **半球光 (HemisphereLight)**: 0.6 强度，模拟天空和地面反射
- **点光源 (PointLight)**: 0.8 强度，作为补光

## 控制

- **鼠标左键拖动**: 旋转视角
- **鼠标滚轮**: 缩放
- **鼠标右键拖动**: 平移

## 技术栈

- Three.js - 3D 渲染引擎
- Vite - 现代前端构建工具
- GLTFLoader - GLTF/GLB 模型加载器
- OrbitControls - 相机控制器
