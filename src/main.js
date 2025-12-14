import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// 场景、相机、渲染器设置
let scene, camera, renderer, controls;
let model;
let composer, bloomPass;
let mixer; // AnimationMixer for avatar
const clock = new THREE.Clock();
// Avatar scale control: multiplier applied on top of computed base model scale
let avatarScale = 0.5;
let baseModelScale = 1.0; // computed when model loads
// Avatar origin / vertical offset control (added to model's centered Y)
let modelYOffset = 0.0;
let baseModelYOffset = 0.0; // recorded after centering/scaling

function setAvatarScale(s) {
    avatarScale = Number(s) || 1.0;
    if (model) {
        model.scale.setScalar(baseModelScale * avatarScale);
        console.log('Avatar scale set to', avatarScale);
    }
}

function setModelYOffset(y) {
    modelYOffset = Number(y) || 0;
    if (model) {
        model.position.y = baseModelYOffset + modelYOffset;
        console.log('Avatar Y offset set to', modelYOffset);
    }
}

// Expose setter for quick runtime control (e.g., in DevTools)
window.setAvatarScale = setAvatarScale;
window.setModelYOffset = setModelYOffset;

function init() {
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08080f);

    // 创建相机
    camera = new THREE.PerspectiveCamera(
        35,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1.8, 6);
    // 通过lookAt设置相机朝向目标点，自动计算rotation
    camera.lookAt(0, .7, 0);

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制最大像素比为2，提升性能同时保持质量
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.6;
    
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // 添加手势交互控制模型旋转
    setupModelInteraction();

    // 加载HDR环境贴图
    loadHDREnvironment();

    // 添加环境光 (Ambient Light) - 提亮暗部
    const ambientLight = new THREE.AmbientLight(0xffffff, 0);
    scene.add(ambientLight);

    // 添加方向光 (Directional Light) - 主光源
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.3);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.radius = 4;
    directionalLight.shadow.bias = 0.1;
    scene.add(directionalLight);

    // 添加半球光 (Hemisphere Light) - 模拟天空和地面的光照
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemisphereLight.position.set(0, 20, 0);
    scene.add(hemisphereLight);


    // 添加地面 - 使用单色
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x9a6a9a,
        roughness: 0.8,
        metalness: 0.2
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 添加背景墙 - 比地面更亮的单色
    const wallGeometry = new THREE.PlaneGeometry(20, 20);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xb88ab8,
        roughness: 0.8,
        metalness: 0.2
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(0, 10, -10);
    wall.receiveShadow = true;
    scene.add(wall);

    // 加载GLB模型
    loadGLBModel();

    // 处理窗口大小调整
    window.addEventListener('resize', onWindowResize, false);

    // 设置后处理
    setupPostProcessing();

    // 开始动画循环
    animate();
}

function setupPostProcessing() {
    // 创建EffectComposer
    composer = new EffectComposer(renderer);

    // 添加渲染通道
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 添加Bloom效果
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.06,  // strength - 强度
        0.4,  // radius - 半径
        0.1  // threshold - 阈值
    );
    composer.addPass(bloomPass);
}

function loadHDREnvironment() {
    const rgbeLoader = new RGBELoader();
    // 将HDR文件放在 public/textures/ 文件夹中
    rgbeLoader.load(
        '/textures/environment.hdr',
        (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.environment = texture;
            // 如果想要HDR作为背景，取消下面这行注释
            // scene.background = texture;
            console.log('HDR环境贴图加载成功！');
        },
        undefined,
        (error) => {
            console.warn('HDR加载失败，使用默认光照:', error);
        }
    );
}

function loadGLBModel() {
    const loader = new GLTFLoader();
    const loadingElement = document.getElementById('loading');
    const progressFill = document.getElementById('progress-fill');

    // 将你的GLB文件放在 public/models/ 文件夹中
    // 例如: public/models/avatar.glb
    const modelPath = '/models/avatar.glb';

    loader.load(
        modelPath,
        // onLoad 回调
        (gltf) => {
            model = gltf.scene;

            // 确保材质和纹理正确加载
            model.traverse((child) => {
                if (child.isMesh) {
                    // 启用阴影
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // 确保材质正确设置
                    if (child.material) {
                        // 如果是数组材质
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => {
                                setupMaterial(material);
                            });
                        } else {
                            setupMaterial(child.material);
                        }
                    }
                }
            });

            // 居中模型
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            // 缩放模型以适应场景
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim;
            // 保存基础缩放并应用外部控制器 `avatarScale`
            baseModelScale = scale;
            model.scale.setScalar(baseModelScale * avatarScale);

            // 记录基础 Y 偏移（居中/缩放后），并应用可配置的 Y 偏移
            baseModelYOffset = model.position.y;
            model.position.y = baseModelYOffset + modelYOffset;

            scene.add(model);

            // 创建 AnimationMixer，用于播放模型的动画
            mixer = new THREE.AnimationMixer(model);

            // 优先尝试从 external animation 文件加载动画（/animations/aniA.glb）
            (function tryExternalThenEmbedded() {
                const animPath = '/animations/aniA.glb';
                const animLoader = new GLTFLoader();

                animLoader.load(
                    animPath,
                    (animGltf) => {
                        if (animGltf.animations && animGltf.animations.length > 0) {
                            const clip = animGltf.animations[0];
                            try {
                                console.log('External animations found in', animPath, 'count:', animGltf.animations.length);
                                const extNames = animGltf.animations.map(c => c.name || '(no name)');
                                console.log('External clip names:', extNames);
                                if (clip.tracks && clip.tracks.length) {
                                    console.log('External clip tracks:');
                                    clip.tracks.forEach(t => console.log('  -', t.name));
                                }
                            } catch (e) { console.warn(e); }

                            // 尝试将外部动画应用到当前 mixer（model 根）
                            let applied = false;
                            try {
                                const action = mixer.clipAction(clip);
                                action.reset();
                                action.play();
                                applied = true;
                                console.log('Applied external animation to model root:', animPath, 'clip:', clip.name || 'clip0');
                            } catch (e) {
                                console.warn('Direct apply of external animation to model failed:', e);
                            }

                            // 回退：如果直接应用无效，尝试在 SkinnedMesh 上创建 mixer 并播放骨骼动画
                            if (!applied) {
                                let skinned = null;
                                model.traverse((c) => { if (c.isSkinnedMesh) skinned = c; });
                                if (skinned) {
                                    try {
                                        mixer = new THREE.AnimationMixer(skinned);
                                        const skAction = mixer.clipAction(clip);
                                        skAction.reset();
                                        skAction.play();
                                        console.log('Applied external animation to SkinnedMesh root:', skinned.name || skinned.id);
                                    } catch (e) {
                                        console.warn('Failed to apply clip to SkinnedMesh:', e);
                                    }
                                } else {
                                    console.warn('No SkinnedMesh found to try fallback application for external animation');
                                }
                            }
                        } else {
                            console.log('No animations in external file, falling back to embedded animations if present');
                            if (gltf.animations && gltf.animations.length > 0) {
                                const clip = gltf.animations[0];
                                const action = mixer.clipAction(clip);
                                action.reset();
                                action.play();
                                console.log('Playing embedded model animation (fallback):', clip.name || 'clip0');
                            }
                        }
                    },
                    undefined,
                    (err) => {
                        console.warn('Failed to load external animation:', animPath, err, '\nFalling back to embedded animations if present.');
                        if (gltf.animations && gltf.animations.length > 0) {
                            const clip = gltf.animations[0];
                            const action = mixer.clipAction(clip);
                            action.reset();
                            action.play();
                            console.log('Playing embedded model animation (fallback):', clip.name || 'clip0');
                        }
                    }
                );
            })();

            // 隐藏加载提示
            loadingElement.classList.add('hidden');

            console.log('模型加载成功！');
            console.log('Animations (embedded):', gltf.animations);
            try {
                const names = (gltf.animations || []).map(c => c.name || '(no name)');
                console.log('Embedded clip names:', names);
                (gltf.animations || []).forEach((c, i) => console.log(` embedded[${i}] name:${c.name||'(no name)'} duration:${c.duration} tracks:${(c.tracks?c.tracks.length:0)}`));
            } catch (e) { console.warn('Error logging embedded animations', e); }

            // DEBUG: 打印每个动画片段的轨道名称，帮助定位轨道所属对象
            function logClipDetails(clip, label) {
                try {
                    console.log(label, 'clip name:', clip.name || '(no name)');
                    if (clip.tracks && clip.tracks.length) {
                        console.log(label, 'tracks:');
                        clip.tracks.forEach((t) => console.log('  -', t.name));
                    } else {
                        console.log(label, 'no tracks');
                    }
                } catch (e) {
                    console.warn('Error logging clip details', e);
                }
            }

            if (gltf.animations && gltf.animations.length > 0) {
                gltf.animations.forEach((clip, idx) => logClipDetails(clip, `embedded[${idx}]`));
            }
        },
        // onProgress 回调
        (xhr) => {
            if (xhr.lengthComputable && xhr.total > 0) {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                progressFill.style.width = percentComplete + '%';
                console.log('加载进度: ' + Math.round(percentComplete) + '%');
            } else {
                // 如果无法获取总大小，显示加载的字节数
                console.log('已加载: ' + Math.round(xhr.loaded / 1024) + ' KB');
                progressFill.style.width = '50%'; // 显示一个估计进度
            }
        },
        // onError 回调
        (error) => {
            console.error('加载模型时出错:', error);
            loadingElement.innerHTML = '<div>加载失败</div><div style="font-size: 14px; margin-top: 10px;">错误: ' + error.message + '</div><div style="font-size: 12px; margin-top: 5px;">请检查控制台以获取详细信息</div>';
        }
    );
}

function setupMaterial(material) {
    // 确保材质需要更新
    material.needsUpdate = true;

    // 如果材质有纹理贴图，确保正确设置
    if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
        material.map.needsUpdate = true;
    }

    // 设置其他纹理贴图
    if (material.normalMap) {
        material.normalMap.needsUpdate = true;
    }

    if (material.roughnessMap) {
        material.roughnessMap.needsUpdate = true;
    }

    if (material.metalnessMap) {
        material.metalnessMap.needsUpdate = true;
    }

    if (material.emissiveMap) {
        material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        material.emissiveMap.needsUpdate = true;
    }

    // 确保材质的侧面渲染正确
    material.side = THREE.FrontSide;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// 手势交互变量
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let modelRotationVelocity = 0;
const rotationDamping = 0.95;

function setupModelInteraction() {
    const canvas = renderer.domElement;

    // 鼠标事件
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging && model) {
            const deltaX = e.clientX - previousMousePosition.x;

            modelRotationVelocity = deltaX * 0.005;
            model.rotation.y += modelRotationVelocity;

            previousMousePosition = { x: e.clientX, y: e.clientY };
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    // 触摸事件（移动设备）
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            previousMousePosition = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        if (isDragging && model && e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - previousMousePosition.x;

            modelRotationVelocity = deltaX * 0.005;
            model.rotation.y += modelRotationVelocity;

            previousMousePosition = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        }
    });

    canvas.addEventListener('touchend', () => {
        isDragging = false;
    });
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // 更新动画混合器
    if (mixer) {
        mixer.update(delta);
    }

    // 应用惯性阻尼效果（仅Y轴）
    if (!isDragging && model) {
        model.rotation.y += modelRotationVelocity;
        modelRotationVelocity *= rotationDamping;
    }

    // 使用composer渲染以应用后处理效果
    composer.render();
}

// 初始化应用
init();
