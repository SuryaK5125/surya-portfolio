import * as THREE from 'three';
import Application from '../Application';
import Mouse from '../Utils/Mouse';
import Sizes from '../Utils/Sizes';
import Time from '../Utils/Time';
import { CAMERA } from '../World/SceneLayout';
import { ScreenFrame } from '../World/ScreenFrame';
import { prefersReducedMotion } from '../Utils/motion';

export class CameraKeyframeInstance {
    position: THREE.Vector3;
    focalPoint: THREE.Vector3;

    constructor(keyframe: CameraKeyframe) {
        this.position = keyframe.position.clone();
        this.focalPoint = keyframe.focalPoint.clone();
    }

    update() {}
}

/**
 * Looks squarely at the laptop display, at the distance where the panel just
 * fits the viewport (plus a small margin).
 */
export class MonitorKeyframe extends CameraKeyframeInstance {
    application: Application;
    sizes: Sizes;
    frame: ScreenFrame | null = null;

    constructor() {
        super({
            position: CAMERA.desk.position,
            focalPoint: CAMERA.desk.focalPoint,
        });
        this.application = new Application();
        this.sizes = this.application.sizes;
    }

    setScreenFrame(frame: ScreenFrame) {
        this.frame = frame;
        this.update();
    }

    update() {
        if (!this.frame) return;
        const halfFov = THREE.MathUtils.degToRad(CAMERA.fov) / 2;
        const aspect = this.sizes.width / this.sizes.height;
        const fitHeight = this.frame.height / 2 / Math.tan(halfFov);
        const fitWidth = this.frame.width / 2 / (Math.tan(halfFov) * aspect);
        const distance = Math.max(fitHeight, fitWidth) * CAMERA.monitor.margin;

        this.focalPoint.copy(this.frame.position);
        this.position
            .copy(this.frame.position)
            .addScaledVector(this.frame.normal, distance);
    }
}

export class LoadingKeyframe extends CameraKeyframeInstance {
    constructor() {
        super(CAMERA.loading);
    }
}

/** Seated view of the whole desk, with gentle mouse parallax. */
export class DeskKeyframe extends CameraKeyframeInstance {
    application: Application;
    mouse: Mouse;
    sizes: Sizes;
    targetPos: THREE.Vector3;
    targetFoc: THREE.Vector3;

    constructor() {
        super(CAMERA.desk);
        this.application = new Application();
        this.mouse = this.application.mouse;
        this.sizes = this.application.sizes;
        this.targetPos = this.position.clone();
        this.targetFoc = this.focalPoint.clone();
    }

    update() {
        const { desk } = CAMERA;
        // Normalised pointer position, -1 to 1 (0 before the first mouse move).
        // No pointer parallax for visitors who prefer reduced motion.
        const still = prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches;
        const nx = this.mouse.x && !still ? (this.mouse.x / this.sizes.width) * 2 - 1 : 0;
        const ny = this.mouse.y && !still ? (this.mouse.y / this.sizes.height) * 2 - 1 : 0;

        // Dolly back on viewports narrower than the reference aspect
        const aspect = this.sizes.width / this.sizes.height;
        const dolly = Math.min(aspect < .8 ? 2.6 : desk.maxDolly, Math.max(1, desk.referenceAspect / aspect));
        const goalPos = desk.focalPoint
            .clone()
            .add(desk.position.clone().sub(desk.focalPoint).multiplyScalar(dolly))
            .add(
                new THREE.Vector3(
                    nx * desk.parallax.position.x,
                    -ny * desk.parallax.position.y,
                    0
                )
            );
        const goalFoc = desk.focalPoint
            .clone()
            .add(
                new THREE.Vector3(
                    nx * desk.parallax.focalPoint.x,
                    -ny * desk.parallax.focalPoint.y,
                    0
                )
            );

        this.targetPos.lerp(goalPos, 0.04);
        this.targetFoc.lerp(goalFoc, 0.06);
        this.position.copy(this.targetPos);
        this.focalPoint.copy(this.targetFoc);
    }
}

/** Slow, swaying orbit in front of the desk. */
export class IdleKeyframe extends CameraKeyframeInstance {
    time: Time;

    constructor() {
        const { idle } = CAMERA;
        super({
            position: idle.focalPoint
                .clone()
                .add(new THREE.Vector3(0, idle.height, idle.radius)),
            focalPoint: idle.focalPoint,
        });
        this.time = new Application().time;
    }

    update() {
        const { idle } = CAMERA;
        // Held still (no sway or bob) under reduced motion
        const t = prefersReducedMotion() ? 0 : this.time.elapsed;
        const angle = t ? Math.sin((t + 19000) * 0.00008) * idle.sweep : 0;
        this.position.set(
            idle.focalPoint.x + Math.sin(angle) * idle.radius,
            idle.focalPoint.y + idle.height + (t ? Math.sin((t + 1000) * 0.00004) * idle.heightBob : 0),
            idle.focalPoint.z + Math.cos(angle) * idle.radius
        );
    }
}

export class OrbitControlsStart extends CameraKeyframeInstance {
    constructor() {
        super(CAMERA.orbitStart);
    }
}

/** Stable detail views: no pointer parallax, with room for portrait viewports. */
export class DetailKeyframe extends CameraKeyframeInstance {
    private base: CameraKeyframe;
    private sizes: Sizes;
    constructor(view: CameraKeyframe) {
        super(view);
        this.base = { position: view.position.clone(), focalPoint: view.focalPoint.clone() };
        this.sizes = new Application().sizes;
    }
    setView(position: THREE.Vector3, focalPoint: THREE.Vector3) {
        this.base = { position, focalPoint };
        this.update();
    }
    update() {
        const dolly = Math.max(1, 1.35 / (this.sizes.width / this.sizes.height));
        this.focalPoint.copy(this.base.focalPoint);
        this.position.copy(this.focalPoint).add(this.base.position.clone().sub(this.focalPoint).multiplyScalar(dolly));
    }
}
