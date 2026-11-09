import * as THREE from 'three';
import Application from '../Application';
import { LEGO_CAR } from './SceneLayout';

/**
 * LEGO 10295 Porsche 911 (Turbo) by Sleepy Sea Otter (CC-BY-4.0, see ASSETS.md),
 * optimised by tools/model-pipeline (optimize_porsche.py in Blender, then
 * build-porsche.js): millimetres, wheels on y = 0, nose towards +X, one mesh
 * per LEGO colour.
 */
export default class LegoPorsche {
    application: Application;
    model: THREE.Group;

    constructor() {
        this.application = new Application();
        const gltf = this.application.resources.items.gltfModel.porscheModel;

        this.model = gltf.scene;
        this.model.position.copy(LEGO_CAR.position);
        this.model.rotation.y = LEGO_CAR.rotationY;

        this.model.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            const material = child.material as THREE.MeshStandardMaterial;
            child.receiveShadow = true;
            if (material.transparent) {
                // Trans-clear/black pieces: let the cabin show through
                child.castShadow = false;
                material.depthWrite = false;
            } else {
                child.castShadow = true;
            }
            if (material.userData.print) {
                // Printed decorations lie on the surface of the part below them
                material.polygonOffset = true;
                material.polygonOffsetFactor = -1;
                material.polygonOffsetUnits = -4;
            }
        });

        this.application.scene.add(this.model);
    }
}
