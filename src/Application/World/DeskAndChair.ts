import * as THREE from 'three';
import Application from '../Application';
import BakedModel from '../Utils/BakedModel';
import CubingDrawer from './CubingDrawer';
import { CHAIR, HENRY_DESK } from './SceneLayout';
import createDeskFinish, { gradeBakedMaterial } from './DeskFinish';

/**
 * TEMPORARY: the original project's desk (environment.glb, Henry
 * Heffernan) with its baked lighting texture. The desk-top region of the
 * texture has been cleaned of the old desk objects' footprints by
 * tools/model-pipeline/clean-desk-texture.js. The model's "Background" room
 * shell is not shown. Redistribution rights for these assets are unconfirmed;
 * see ASSETS.md before any public deployment.
 */
export default class DeskAndChair {
    application: Application;
    group: THREE.Group;
    shadowCatcher: THREE.Mesh;
    chair: THREE.Group;
    drawer: CubingDrawer;

    constructor() {
        this.application = new Application();
        const { gltfModel, texture } = this.application.resources.items;

        const baked = new BakedModel(gltfModel.deskModel, texture.deskTexture);
        // Keep the baked look exactly: unlit and not tone mapped
        baked.material.toneMapped = false;
        // Slightly deeper, warmer frame and pedestal tones (see DeskFinish)
        gradeBakedMaterial(baked.material);

        const model = baked.getModel();
        model.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
        const background = model.getObjectByName('Background');
        if (background) background.removeFromParent();
        // The original chair is replaced by a lit, CC-BY office chair (below)
        for (const name of ['chair_base', 'chair_seat']) {
            const part = model.getObjectByName(name);
            if (part) part.removeFromParent();
        }

        this.group = new THREE.Group();
        this.group.name = 'temp:henry-desk-and-chair';
        this.group.userData.temporary = true;
        this.group.scale.setScalar(HENRY_DESK.scale);
        this.group.position.copy(HENRY_DESK.position);
        this.group.add(model);
        this.application.scene.add(this.group);

        // Lit walnut tabletop over the baked one
        this.application.scene.add(createDeskFinish());

        this.shadowCatcher = this.createShadowCatcher();
        this.application.scene.add(this.shadowCatcher);
        this.chair = this.createChair(gltfModel.chairModel.scene);
        this.application.scene.add(this.chair);
        const desk = model.getObjectByName('desk');
        if (!(desk instanceof THREE.Mesh)) throw new Error('Henry desk mesh not found');
        this.drawer = new CubingDrawer(desk);
    }

    /** "Office Chair Modern" by thethieme (CC-BY-4.0), lit and shadowed in real time. */
    createChair(scene: THREE.Group) {
        const chair = new THREE.Group();
        chair.name = 'OfficeChair';
        scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.castShadow = true;
            object.receiveShadow = true;
        });
        chair.add(scene);
        chair.position.copy(CHAIR.position);
        chair.rotation.y = CHAIR.rotationY;
        return chair;
    }

    /**
     * The baked desk is unlit, so real-time contact shadows from the laptop,
     * speakers and props land on this invisible shadow-only plane instead.
     */
    createShadowCatcher() {
        const { minX, maxX, minZ, maxZ } = HENRY_DESK.top;
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(maxX - minX, maxZ - minZ),
            new THREE.ShadowMaterial({ opacity: 0.46 })
        );
        plane.name = 'DeskShadowCatcher';
        plane.rotation.x = -Math.PI / 2;
        plane.position.set((minX + maxX) / 2, 0.8, (minZ + maxZ) / 2);
        plane.receiveShadow = true;
        return plane;
    }
}
