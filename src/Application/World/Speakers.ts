import * as THREE from 'three';
import Application from '../Application';
import { SPEAKERS } from './SceneLayout';

/**
 * Pair of bookshelf speakers: "Speaker Bookshelf V2 - Optimized" by rendysix
 * (CC-BY-4.0, see ASSETS.md), prepared by tools/model-pipeline/build-speaker.js
 * (millimetres, front facing +Z, feet on y = 0). Both share geometry and materials.
 */
export default class Speakers {
    application: Application;
    left: THREE.Object3D;
    right: THREE.Object3D;

    constructor() {
        this.application = new Application();
        const source = this.application.resources.items.gltfModel.speakerModel.scene;

        source.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.left = this.place(source.clone(), 'speaker-left', SPEAKERS.left);
        this.right = this.place(source, 'speaker-right', SPEAKERS.right);
    }

    place(
        speaker: THREE.Object3D,
        name: string,
        placement: { position: THREE.Vector3; rotationY: number }
    ) {
        speaker.name = name;
        speaker.position.copy(placement.position);
        speaker.rotation.y = placement.rotationY;
        this.application.scene.add(speaker);
        return speaker;
    }
}
