import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import Avatar from './avatar.js';

// 场景、相机、渲染器设置
let scene, camera, renderer, controls;
let composer, bloomPass;
const clock = new THREE.Clock();

// List of Avatar instances
const avatars = [];

// simple runtime helpers operating on first avatar for backwards compatibility
function setAvatarScale(s, idx = 0) {
    if (avatars[idx]) avatars[idx].setScale(s);
}

function setModelYOffset(y, idx = 0) {
    if (avatars[idx]) avatars[idx].setYOffset(y);
}

window.setAvatarScale = setAvatarScale;
window.setModelYOffset = setModelYOffset;

// Unified loader for two avatars: loadTwoAvatars(modelA, modelB, animA, animB)
window.loadTwoAvatars = async function(modelA, modelB, animA, animB) {
    const loadingElement = document.getElementById('loading');
    loadingElement.classList.remove('hidden');
    // create two avatars positioned left and right
    const a1 = new Avatar(scene, { modelPath: modelA, animPath: animA, position: new THREE.Vector3(0,0,0), avatarScale: 0.5 });
    const a2 = new Avatar(scene, { modelPath: modelB, animPath: animB, position: new THREE.Vector3(0,0,0), avatarScale: 0.5 });
    avatars.length = 0; avatars.push(a1, a2);
    try {
        await Promise.all([a1.load(), a2.load()]);
        console.log('Both avatars loaded');
    } catch (e) {
        console.warn('One or more avatars failed to load', e);
    } finally {
        loadingElement.classList.add('hidden');
    }
};

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
    camera.position.set(0, 1.8, 9);
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

    // 加载两个 Avatar（默认占位路径），可在运行时通过 `loadTwoAvatars(...)` 覆盖
    loadTwoAvatars('/models/avatar1.glb', '/models/avatar2.glb', '/animations/aniA.glb', '/animations/aniB.glb');

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
    // Create a single Avatar from the default model path and push to avatars list
    const loadingElement = document.getElementById('loading');
    const progressFill = document.getElementById('progress-fill');
    const modelPath = '/models/avatar.glb';
    const avatar = new Avatar(scene, { modelPath, animPath: '/animations/aniA.glb', position: new THREE.Vector3(0,0,0), avatarScale: 0.5 });
    avatars.push(avatar);
    // show loading (already visible by default)
    avatar.load().then(() => {
        loadingElement.classList.add('hidden');
        console.log('Default avatar loaded');
    }).catch((e) => {
        loadingElement.classList.add('hidden');
        console.warn('Default avatar failed to load', e);
    });
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
        if (isDragging && avatars.length > 0) {
            const deltaX = e.clientX - previousMousePosition.x;

            modelRotationVelocity = deltaX * 0.005;
            avatars.forEach(av => { if (av.model) av.model.rotation.y += modelRotationVelocity; });

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
        if (isDragging && avatars.length > 0 && e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - previousMousePosition.x;

            modelRotationVelocity = deltaX * 0.005;
            avatars.forEach(av => { if (av.model) av.model.rotation.y += modelRotationVelocity; });

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

    // 更新所有 Avatar 的动画混合器
    avatars.forEach(av => av.update(delta));

    // 应用惯性阻尼效果（仅Y轴）对所有 avatars
    if (!isDragging && avatars.length > 0) {
        avatars.forEach(av => { if (av.model) av.model.rotation.y += modelRotationVelocity; });
        modelRotationVelocity *= rotationDamping;
    }

    // 使用composer渲染以应用后处理效果
    composer.render();
}

// 初始化应用
init();
