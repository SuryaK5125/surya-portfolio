import * as THREE from 'three';
import Application from '../Application';
import { LAPTOP } from './SceneLayout';
import { ScreenFrame, readScreenFrame } from './ScreenFrame';

/**
 * Dell Latitude 5400 model (CC-BY-4.0, see ASSETS.md), prepared by
 * tools/model-pipeline/build-laptop.js: millimetres, base on y = 0, screen
 * facing +Z, and a "Screen" node marking the display's active area.
 */
export default class Laptop {
    application: Application;
    model: THREE.Group;
    screenFrame: ScreenFrame;

    constructor() {
        this.application = new Application();
        const gltf = this.application.resources.items.gltfModel.laptopModel;

        this.model = gltf.scene;
        this.model.position.copy(LAPTOP.position);
        this.model.rotation.y = LAPTOP.rotationY;

        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.application.scene.add(this.model);
        this.model.updateMatrixWorld(true);

        const screen = this.model.getObjectByName('Screen');
        if (!screen) throw new Error('Laptop model has no "Screen" node');
        this.screenFrame = readScreenFrame(screen);
    }
}
