import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import Application from '../Application';
import { ScreenFrame } from './ScreenFrame';
import { STUDIO } from './StudioEnvironment';

// Neutral softbox reflections; no visible room geometry or image assets.
const ENV_INTENSITY = 0.45;

/** Broad, neutral studio light with soft contact grounding and no atmospheric fog. */
export default class Lighting {
    application: Application;
    scene: THREE.Scene;
    key: THREE.SpotLight;
    screenLight: THREE.PointLight | null = null;

    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;

        this.scene.background = new THREE.Color(STUDIO.background);
        this.scene.fog = null;

        const renderer = this.application.renderer.instance;
        const pmrem = new THREE.PMREMGenerator(renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();

        // Restrained neutral-warm bounce keeps the sage welcoming. Kept well
        // below the key so the room reads as lit from one side, not evenly.
        const hemisphere = new THREE.HemisphereLight(0xe7ece9, 0xa09c92, 0.40);
        this.scene.add(hemisphere);

        // Key: a broad, soft source from the front-left (the scene's original
        // light direction). A wide spotlight rather than a parallel light, so the
        // light pools on the desk and falls off gently across the wall and floor.
        // Slightly lower and further to the side than overhead, so objects cast
        // readable shadows back and to the right onto the desk and wall.
        this.key = new THREE.SpotLight(0xfffaf2, 1.62, 0, 0.5, 1, 0);
        this.key.position.set(-2900, 3000, 2300);
        this.key.target.position.set(-150, -220, -120);
        this.key.castShadow = true;
        this.key.shadow.mapSize.set(2048, 2048);
        // Tighter cone than before (0.5 rad, was 0.78) puts more shadow-map texels on
        // the desk without raising the map size.
        this.key.shadow.camera.near = 1500;
        this.key.shadow.camera.far = 8000;
        // Variance shadow map (Renderer.ts): radius/blurSamples give a soft penumbra
        this.key.shadow.bias = -0.0004;
        this.key.shadow.normalBias = 0.4;
        this.key.shadow.radius = 10;
        this.key.shadow.blurSamples = 12;
        this.scene.add(this.key, this.key.target);

        // Soft cool fill from front-right so speaker baffles and the keyboard read
        // keeps detail on the shadowed side (no shadows of its own)
        const fill = new THREE.DirectionalLight(0xe8eeeb, 0.30);
        fill.position.set(1400, 500, 1600);
        this.scene.add(fill);

        // Neutral rim separates dark objects from the studio backdrop
        const rim = new THREE.DirectionalLight(0xe1e5e8, 0.26);
        rim.position.set(900, 900, -900);
        this.scene.add(rim);
    }

    /**
     * The lit display gently illuminates the keyboard and desk in front of it.
     * A short-range point light just in front of the panel (much lighter than
     * an area light, which would add ~200 KB of lookup tables to the bundle).
     */
    addScreenLight(frame: ScreenFrame) {
        const light = new THREE.PointLight(0xdbe4ff, 0.3, 520, 2);
        light.position.copy(frame.position).addScaledVector(frame.normal, 70);
        this.scene.add(light);
        this.screenLight = light;
    }

    /** Applies the shared reflection strength to every PBR material in the scene. */
    applyEnvironmentIntensity() {
        this.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const materials = Array.isArray(child.material)
                    ? child.material
                    : [child.material];
                for (const material of materials) {
                    if (material instanceof THREE.MeshStandardMaterial) {
                        material.envMapIntensity = Math.min(material.envMapIntensity, ENV_INTENSITY);
                    }
                }
            }
        });
    }
}
