import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import Application from './Application';
import Sizes from './Utils/Sizes';
import Camera from './Camera/Camera';

export default class Renderer {
    application: Application;
    sizes: Sizes;
    scene: THREE.Scene;
    cssScene: THREE.Scene;
    camera: Camera;
    instance: THREE.WebGLRenderer;
    cssInstance: CSS3DRenderer;

    constructor() {
        this.application = new Application();
        this.sizes = this.application.sizes;
        this.scene = this.application.scene;
        this.cssScene = this.application.cssScene;
        this.camera = this.application.camera;

        this.setInstance();
    }

    setInstance() {
        this.instance = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
        });
        // Settings
        // this.instance.physicallyCorrectLights = true;
        this.instance.outputEncoding = THREE.sRGBEncoding;
        this.instance.toneMapping = THREE.ACESFilmicToneMapping;
        // Lit surfaces only; the baked desk is not tone mapped and keeps its look
        this.instance.toneMappingExposure = 0.78;
        this.instance.shadowMap.enabled = true;
        // Variance shadows: genuinely soft, blurred penumbras (radius set per light)
        this.instance.shadowMap.type = THREE.VSMShadowMap;
        this.instance.setSize(this.sizes.width, this.sizes.height);
        this.instance.setPixelRatio(Math.min(this.sizes.pixelRatio, 2));
        this.instance.setClearColor(0x000000, 0.0);

        // Style
        this.instance.domElement.style.position = 'absolute';
        this.instance.domElement.style.zIndex = '1';
        this.instance.domElement.style.top = '0px';

        document.querySelector('#webgl')?.appendChild(this.instance.domElement);

        // No full-viewport film-grain pass: room UI and iframe content stay clean.
        this.cssInstance = new CSS3DRenderer();
        this.cssInstance.setSize(this.sizes.width, this.sizes.height);
        this.cssInstance.domElement.style.position = 'absolute';
        this.cssInstance.domElement.style.top = '0px';

        document
            .querySelector('#css')
            ?.appendChild(this.cssInstance.domElement);
    }

    resize() {
        this.instance.setSize(this.sizes.width, this.sizes.height);
        this.instance.setPixelRatio(Math.min(this.sizes.pixelRatio, 2));

        this.cssInstance.setSize(this.sizes.width, this.sizes.height);
    }

    update() {
        // The mobile desktop covers the scene completely; avoid drawing the
        // hidden WebGL/CSS3D room while visitors read apps. State stays live.
        if (document.body.classList.contains('mobile-desktop-active')) return;
        this.instance.render(this.scene, this.camera.instance);
        this.cssInstance.render(this.cssScene, this.camera.instance);
    }
}
