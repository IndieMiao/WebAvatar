import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export default class Avatar {
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.modelPath = opts.modelPath || '';
        this.animPath = opts.animPath || '';
        this.position = opts.position || new THREE.Vector3(0, 0, 0);

        this.model = null;
        this.mixer = null;

        this.baseModelScale = 1.0;
        this.avatarScale = opts.avatarScale || 1.0;

        this.baseModelYOffset = 0.0;
        this.modelYOffset = opts.modelYOffset || 0.0;
    }

    setupMaterial(material) {
        material.needsUpdate = true;
        if (material.map) {
            material.map.colorSpace = THREE.SRGBColorSpace;
            material.map.needsUpdate = true;
        }
        if (material.normalMap) material.normalMap.needsUpdate = true;
        if (material.roughnessMap) material.roughnessMap.needsUpdate = true;
        if (material.metalnessMap) material.metalnessMap.needsUpdate = true;
        if (material.emissiveMap) {
            material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
            material.emissiveMap.needsUpdate = true;
        }
        material.side = THREE.FrontSide;
    }

    load() {
        const loader = new GLTFLoader();
        return new Promise((resolve, reject) => {
            loader.load(
                this.modelPath,
                (gltf) => {
                    this.model = gltf.scene;

                    this.model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(m => this.setupMaterial(m));
                                } else {
                                    this.setupMaterial(child.material);
                                }
                            }
                        }
                    });

                    // center
                    const box = new THREE.Box3().setFromObject(this.model);
                    const center = box.getCenter(new THREE.Vector3());
                    this.model.position.sub(center);

                    // scale
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z) || 1;
                    const scale = 2 / maxDim;
                    this.baseModelScale = scale;
                    this.model.scale.setScalar(this.baseModelScale * this.avatarScale);

                    // record base Y and apply offset
                    this.baseModelYOffset = this.model.position.y;
                    this.model.position.y = this.baseModelYOffset + this.modelYOffset;

                    // apply requested world position offset (x/z)
                    this.model.position.x += this.position.x;
                    this.model.position.z += this.position.z;

                    this.scene.add(this.model);

                    // mixer
                    this.mixer = new THREE.AnimationMixer(this.model);

                    // try external anim first (if provided), else use embedded
                    const tryExternal = () => {
                        if (!this.animPath) return Promise.resolve(false);
                        return new Promise((res) => {
                            const aLoader = new GLTFLoader();
                            aLoader.load(this.animPath, (aGltf) => {
                                if (aGltf.animations && aGltf.animations.length > 0) {
                                    const clip = aGltf.animations[0];
                                    try {
                                        const action = this.mixer.clipAction(clip);
                                        action.reset();
                                        action.play();
                                        console.log('Avatar: applied external animation', this.animPath, clip.name || '(no name)');
                                        res(true);
                                    } catch (e) {
                                        console.warn('Avatar: failed to apply external clip to model root', e);
                                        // try skinned fallback
                                        let sk = null;
                                        this.model.traverse(c => { if (c.isSkinnedMesh) sk = c; });
                                        if (sk) {
                                            try {
                                                this.mixer = new THREE.AnimationMixer(sk);
                                                const skAction = this.mixer.clipAction(clip);
                                                skAction.reset();
                                                skAction.play();
                                                console.log('Avatar: applied external clip to SkinnedMesh');
                                                res(true);
                                                return;
                                            } catch (e2) { console.warn(e2); }
                                        }
                                        res(false);
                                    }
                                } else {
                                    res(false);
                                }
                            }, undefined, (err) => { console.warn('Avatar: external anim load failed', err); res(false); });
                        });
                    };

                    const tryEmbedded = () => {
                        if (gltf.animations && gltf.animations.length > 0) {
                            const clip = gltf.animations[0];
                            const action = this.mixer.clipAction(clip);
                            action.reset();
                            action.play();
                            console.log('Avatar: playing embedded clip', clip.name || '(no name)');
                            return true;
                        }
                        return false;
                    };

                    tryExternal().then((ok) => {
                        if (!ok) tryEmbedded();
                        resolve(this);
                    });
                },
                undefined,
                (err) => {
                    console.error('Avatar: model load failed', this.modelPath, err);
                    reject(err);
                }
            );
        });
    }

    update(delta) {
        if (this.mixer) this.mixer.update(delta);
    }

    setScale(s) {
        this.avatarScale = Number(s) || 1.0;
        if (this.model) this.model.scale.setScalar(this.baseModelScale * this.avatarScale);
    }

    setYOffset(y) {
        this.modelYOffset = Number(y) || 0;
        if (this.model) this.model.position.y = this.baseModelYOffset + this.modelYOffset;
    }
}
