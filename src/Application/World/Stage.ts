import * as THREE from 'three';
import Application from '../Application';
import createWallPosters from './WallPosters';
import { createStudioSweep, createStudioBaseboard } from './StudioEnvironment';

/** A lightweight, open cyclorama; the desk and its baked materials stay intact. */
export default class Stage {
    group: THREE.Group;
    constructor() {
        const application = new Application();
        this.group = new THREE.Group();
        this.group.name = 'Stage';
        this.group.add(createStudioSweep(), createStudioBaseboard(), createWallPosters(Math.max(1, Math.min(8, application.renderer.instance.capabilities.getMaxAnisotropy())), application.resources.items.texture));
        application.scene.add(this.group);
    }
}
