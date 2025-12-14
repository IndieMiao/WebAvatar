# GensenWebAvatar AI Coding Instructions

## Project Overview
This is a Three.js-based GLB/GLTF 3D model viewer with post-processing effects, gesture-based model rotation, and HDR environment mapping. The project uses Vite as its build tool and is written entirely in vanilla JavaScript (ES modules).

## Architecture & Key Components

### Main Entry Point: `src/main.js`
- **Single-file architecture**: All Three.js scene setup, model loading, lighting, post-processing, and interaction logic is in one 349-line file
- **No framework or state management**: Pure Three.js with no React/Vue/Svelte wrapper
- **Module imports**: Uses Three.js addons from `three/addons/` paths (not `three/examples/jsm/`)

### Rendering Pipeline
1. **Scene setup**: Dark background (`0x08080f`), perspective camera at `(0, 1.8, 6)` looking at `(0, 0.7, 0)`
2. **Renderer config**: ACES tone mapping, SRGB color space, PCF soft shadows, pixel ratio capped at 2x for performance
3. **Post-processing**: Uses `EffectComposer` with `RenderPass` and `UnrealBloomPass` (low strength: 0.06)
4. **Lighting system**: Ambient (0), Directional (1.3), Hemisphere (0.6) lights + HDR environment map from `/textures/environment.hdr`

### Model Loading Pattern
- **GLTFLoader** loads from `/models/avatar.glb` (public folder, Vite resolves `/` to `public/`)
- **Material setup function**: `setupMaterial()` ensures all texture maps use correct color space (SRGB for color/emissive)
- **Auto-centering & scaling**: Models are centered via `Box3.getCenter()` and scaled to fit 2-unit height, then elevated by `0.92` units
- **Shadow casting**: All meshes traverse and enable `castShadow` and `receiveShadow`

### Interaction System
- **Custom gesture controls**: Manual mouse/touch drag implementation (not OrbitControls) for Y-axis model rotation only
- **Inertial damping**: `modelRotationVelocity` with 0.95 damping factor for smooth deceleration
- **No camera controls**: Camera is static; only the model rotates

## Development Workflow

### Running the Project
```bash
npm run dev        # Starts Vite dev server on port 3000, auto-opens browser
npm run build      # Builds to dist/ folder
npm run preview    # Previews production build
```

### Adding/Changing Models
1. Place GLB file in `public/models/` directory
2. Update `modelPath` variable in `loadGLBModel()` function (line ~167)
3. Adjust `model.position.y` offset (currently `0.92`) if model appears too high/low

### HDR Environment Maps
- Place HDR files in `public/textures/`
- Current path: `/textures/environment.hdr`
- Used for PBR material reflections via `scene.environment`

## Project-Specific Conventions

### Chinese Comments & UI
- Code comments are in Chinese (e.g., "场景、相机、渲染器设置")
- Loading UI displays Chinese text: "加载模型中..." and "加载失败"
- Maintain this language convention when adding features

### No TypeScript
- Pure JavaScript with ES modules
- No type annotations or JSDoc types used in existing code

### Color Scheme
- Scene background: Very dark purple `0x08080f`
- Ground plane: Purple `0x9a6a9a` with 0.8 roughness
- Back wall: Lighter purple `0xb88ab8`
- HTML gradient: `#667eea` to `#764ba2`

### Performance Optimizations
- Pixel ratio capped at 2x (not full device pixel ratio)
- Shadow map resolution: 1024x1024 (not higher)
- Bloom effect kept minimal (0.06 strength)
- Uses `powerPreference: 'high-performance'` for WebGL context

## File Organization
```
public/
  models/       # GLB/GLTF files (not tracked, users add their own)
  textures/     # HDR environment maps
src/
  main.js       # ONLY source file - contains everything
```

## Common Tasks

### Adding New Lights
Add after existing lights in `init()` function (lines ~51-75). Always call `scene.add(lightInstance)`.

### Modifying Post-Processing
Edit `setupPostProcessing()` function (lines ~125-141). Add new passes via `composer.addPass()`.

### Changing Camera Position/Angle
Modify `camera.position.set()` and `camera.lookAt()` in `init()` (lines ~24-29). Use lookAt instead of manual rotation.

### Adjusting Model Auto-Scaling
Change the divisor in `const scale = 2 / maxDim;` (line ~193). Higher numerator = larger model in scene.

## External Dependencies
- **Three.js v0.160.0**: Core 3D library
- **Vite v5.0.0**: Build tool and dev server
- No additional plugins or loaders configured in `vite.config.js` beyond defaults

## What This Project Does NOT Have
- No animation system (though GLTF animations are logged, none are played)
- No OrbitControls (imported but never instantiated)
- No UI controls for lights/effects (all values hardcoded)
- No backend/API integration
- No texture generation or procedural materials
- No physics engine
