import * as THREE from 'three';
import Application from '../Application';
import { HEADPHONES, MOUSE } from './SceneLayout';

/** Existing CC BY models; source credits and reproducible pipeline in ASSETS.md. */
export default class DeskProps {
    constructor() {
        const application = new Application();
        const { gltfModel } = application.resources.items;
        const headphones = gltfModel.headphoneModel.scene;
        headphones.name = 'HeadphonesAndStand';
        headphones.position.copy(HEADPHONES.position);
        headphones.rotation.y = HEADPHONES.rotationY;
        const mouse = gltfModel.mouseModel.scene;
        mouse.name = 'BloodyV7Mouse';
        mouse.position.copy(MOUSE.position);
        mouse.rotation.y = MOUSE.rotationY;
        [headphones, mouse].forEach((model) => {
            model.traverse((child) => {
                if (!(child instanceof THREE.Mesh)) return;
                child.castShadow = true; child.receiveShadow = true;
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((material) => {
                    if (!(material instanceof THREE.MeshStandardMaterial)) return;
                    if (material.map) material.map.anisotropy = Math.min(8, application.renderer.instance.capabilities.getMaxAnisotropy());
                });
            });
            application.scene.add(model);
        });
        // A thin, unbranded felt pad, safely within the tabletop bounds.
        const pad = new THREE.Shape();
        const w = 238, d = 238, radius = 12;
        pad.moveTo(-w / 2 + radius, -d / 2);
        pad.lineTo(w / 2 - radius, -d / 2); pad.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + radius);
        pad.lineTo(w / 2, d / 2 - radius); pad.quadraticCurveTo(w / 2, d / 2, w / 2 - radius, d / 2);
        pad.lineTo(-w / 2 + radius, d / 2); pad.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - radius);
        pad.lineTo(-w / 2, -d / 2 + radius); pad.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + radius, -d / 2);
        const mousepad = new THREE.Mesh(new THREE.ExtrudeGeometry(pad, { depth: 3, bevelEnabled: false, curveSegments: 6 }), new THREE.MeshStandardMaterial({ color: new THREE.Color(0x343632).convertSRGBToLinear(), roughness: .97 }));
        mousepad.name = 'FeltMousepad';
        mousepad.rotation.x = -Math.PI / 2;
        mousepad.position.set(325, .5, 56);
        // Receives only: a 3 mm slab casting onto itself shows acne stripes
        mousepad.receiveShadow = true; mousepad.castShadow = false;
        application.scene.add(mousepad);
    }
}
