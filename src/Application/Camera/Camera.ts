import * as THREE from 'three';
import Application from '../Application';
import Sizes from '../Utils/Sizes';
import EventEmitter from '../Utils/EventEmitter';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import TWEEN from '@tweenjs/tween.js';
import Renderer from '../Renderer';
import Resources from '../Utils/Resources';
import UIEventBus from '../UI/EventBus';
import Time from '../Utils/Time';
import BezierEasing from 'bezier-easing';
import {
    CameraKeyframeInstance,
    MonitorKeyframe,
    IdleKeyframe,
    LoadingKeyframe,
    DeskKeyframe,
    OrbitControlsStart,
    DetailKeyframe,
} from './CameraKeyframes';
import { CAMERA } from '../World/SceneLayout';
import { ScreenFrame } from '../World/ScreenFrame';

// Inlined (rather than imported from Utils/motion) so the camera module stays
// self-contained for the Node-based checks in tools/model-pipeline.
const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Camera moves run at half length under reduced motion. */
const motionScale = () => (prefersReducedMotion() ? 0.5 : 1);

export enum CameraKey {
    IDLE = 'idle',
    MONITOR = 'monitor',
    LOADING = 'loading',
    DESK = 'desk',
    DRAWER = 'drawer',
    ORBIT_CONTROLS_START = 'orbitControlsStart',
}
export default class Camera extends EventEmitter {
    application: Application;
    sizes: Sizes;
    scene: THREE.Scene;
    instance: THREE.PerspectiveCamera;
    renderer: Renderer;
    resources: Resources;
    time: Time;

    position: THREE.Vector3;
    focalPoint: THREE.Vector3;

    private interactionRay = new THREE.Raycaster();
    private interactionPointer = new THREE.Vector2();
    freeCam: boolean;
    orbitControls: OrbitControls;

    currentKeyframe: CameraKey | undefined;
    targetKeyframe: CameraKey | undefined;
    keyframes: { [key in CameraKey]: CameraKeyframeInstance };

    /** True while the opening flight is playing (any input skips it). */
    introPlaying = false;
    private touchMouseUntil = 0;

    constructor() {
        super();
        this.application = new Application();
        this.sizes = this.application.sizes;
        this.scene = this.application.scene;
        this.renderer = this.application.renderer;
        this.resources = this.application.resources;
        this.time = this.application.time;

        this.position = new THREE.Vector3(0, 0, 0);
        this.focalPoint = new THREE.Vector3(0, 0, 0);

        this.freeCam = false;

        this.keyframes = {
            idle: new IdleKeyframe(),
            monitor: new MonitorKeyframe(),
            loading: new LoadingKeyframe(),
            desk: new DeskKeyframe(),
            drawer: new DetailKeyframe(CAMERA.drawer),
            orbitControlsStart: new OrbitControlsStart(),
        };

        document.addEventListener('mousedown', (event) => {
            const target = event.target as HTMLElement;
            if (Date.now() < this.touchMouseUntil && !target.closest?.('#ui, #ui-interactive, #drawer-controls, #cubing-records, iframe')) return;
            const fromOverlay = !!(target.closest && target.closest('#ui, #ui-interactive'));
            // Any click in the scene during the opening flight skips it.
            if (this.introPlaying && !fromOverlay) {
                event.preventDefault();
                this.skipIntro();
                return;
            }
            // Start/UI clicks and forwarded desktop input are not background clicks.
            if ((event as MouseEvent & { inComputer?: boolean }).inComputer || target.closest('#computer-screen, #ui, #ui-interactive, #drawer-controls, #cubing-records')) return;
            event.preventDefault();
            if (target.id === 'prevent-click') return;
            // print target and current keyframe
            if (
                this.currentKeyframe === CameraKey.IDLE ||
                this.targetKeyframe === CameraKey.IDLE
            ) {
                this.transition(CameraKey.DESK);
            } else if (
                this.currentKeyframe === CameraKey.DESK ||
                this.targetKeyframe === CameraKey.DESK
            ) {
                this.transition(CameraKey.IDLE);
            }
        });

        // Keyboard skip for the opening flight. Forwarded desktop keys are
        // CustomEvents flagged inComputer and never reach this branch.
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.freeCam) {
                UIEventBus.dispatch('freeCamToggle', false);
                return;
            }
            if (!this.introPlaying || (event as KeyboardEvent & { inComputer?: boolean }).inComputer) return;
            if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.skipIntro();
            }
        });
        UIEventBus.on('skipIntro', () => this.skipIntro());

        this.setPostLoadTransition();
        this.setInstance();
        this.setMonitorListeners();
        this.setFreeCamListeners();
        this.setFreeCamPicking();
        this.setTouchPicking();
        UIEventBus.on('requestSceneFocus', (hit: 'laptop' | 'drawer') => {
            const key = this.targetKeyframe || this.currentKeyframe;
            if (this.introPlaying || ![CameraKey.DESK, CameraKey.IDLE, CameraKey.DRAWER].includes(key as CameraKey)) return;
            this.activateTouchHit(hit);
        });
    }

    /**
     * Animates to a keyframe. Progress is tweened and the camera interpolates
     * towards the keyframe's *live* position each frame, so moving targets
     * (desk parallax, the idle orbit) are met exactly, with no snap on arrival.
     */
    transition(
        key: CameraKey,
        duration: number = 1000,
        easing?: any,
        callback?: () => void
    ) {
        const keyframe = this.keyframes[key];
        if (this.currentKeyframe === key && this.position.distanceToSquared(keyframe.position) < .01 && this.focalPoint.distanceToSquared(keyframe.focalPoint) < .01) return;

        // Any explicit move (e.g. opening the drawer mid-flight) ends the intro.
        if (this.introPlaying) this.endIntro(true);
        if (this.targetKeyframe) TWEEN.removeAll();

        this.currentKeyframe = undefined;
        this.targetKeyframe = key;

        const ease = easing || TWEEN.Easing.Quintic.InOut;
        const time = duration * motionScale();
        const fromPos = this.position.clone();
        const fromFoc = this.focalPoint.clone();
        const pos = { t: 0 };
        const foc = { t: 0 };

        const posTween = new TWEEN.Tween(pos)
            .to({ t: 1 }, time)
            .easing(ease)
            .onUpdate(() => {
                this.position.lerpVectors(fromPos, this.keyframes[key].position, pos.t);
            })
            .onComplete(() => {
                this.currentKeyframe = key;
                this.targetKeyframe = undefined;
                if (callback) callback();
            });

        const focTween = new TWEEN.Tween(foc)
            .to({ t: 1 }, time)
            .easing(ease)
            .onUpdate(() => {
                this.focalPoint.lerpVectors(fromFoc, this.keyframes[key].focalPoint, foc.t);
            });

        posTween.start();
        focTween.start();
    }

    /**
     * Opening camera move after the boot screen. Skipped (a cut to the desk,
     * hidden by the boot screen's fade) when asked to, or under reduced motion.
     */
    playIntro(skip: boolean) {
        const desk = this.keyframes.desk;
        if (skip || prefersReducedMotion()) {
            TWEEN.removeAll();
            desk.update();
            this.position.copy(desk.position);
            this.focalPoint.copy(desk.focalPoint);
            this.currentKeyframe = CameraKey.DESK;
            this.targetKeyframe = undefined;
            UIEventBus.dispatch('introDone', { skipped: true });
            return;
        }

        const { path, duration, easing } = CAMERA.intro;
        const positions = path.map((p) => p.position.clone());
        const focals = path.map((p) => p.focalPoint.clone());
        // Start from wherever the camera actually is, end on the live desk view.
        positions[0].copy(this.position);
        focals[0].copy(this.focalPoint);
        positions.push(desk.position.clone());
        focals.push(desk.focalPoint.clone());
        const posCurve = new THREE.CatmullRomCurve3(positions, false, 'centripetal');
        const focCurve = new THREE.CatmullRomCurve3(focals, false, 'centripetal');
        const last = positions.length - 1;

        TWEEN.removeAll();
        this.currentKeyframe = undefined;
        this.targetKeyframe = CameraKey.DESK;
        this.introPlaying = true;
        UIEventBus.dispatch('introStart', {});

        const state = { t: 0 };
        new TWEEN.Tween(state)
            .to({ t: 1 }, duration)
            .easing(BezierEasing(easing[0], easing[1], easing[2], easing[3]))
            .onUpdate(() => {
                posCurve.points[last].copy(desk.position);
                focCurve.points[last].copy(desk.focalPoint);
                posCurve.getPoint(state.t, this.position);
                focCurve.getPoint(state.t, this.focalPoint);
            })
            .onComplete(() => {
                this.currentKeyframe = CameraKey.DESK;
                this.targetKeyframe = undefined;
                this.endIntro(false);
            })
            .start();
    }

    /** Leave the opening flight early with a short, soft move to the desk. */
    skipIntro() {
        if (!this.introPlaying) return;
        this.endIntro(true);
        TWEEN.removeAll();
        this.targetKeyframe = undefined;
        this.transition(CameraKey.DESK, 900, TWEEN.Easing.Cubic.Out);
    }

    private endIntro(skipped: boolean) {
        if (!this.introPlaying) return;
        this.introPlaying = false;
        UIEventBus.dispatch('introDone', { skipped });
    }

    setInstance() {
        this.instance = new THREE.PerspectiveCamera(
            CAMERA.fov,
            this.sizes.width / this.sizes.height,
            CAMERA.near,
            CAMERA.far
        );
        this.currentKeyframe = CameraKey.LOADING;

        this.scene.add(this.instance);
    }

    setMonitorListeners() {
        this.on('enterMonitor', () => {
            this.transition(
                CameraKey.MONITOR,
                2000,
                BezierEasing(0.13, 0.99, 0, 1)
            );
            UIEventBus.dispatch('enterMonitor', {});
        });
        this.on('leftMonitor', () => {
            this.transition(CameraKey.DESK);
            UIEventBus.dispatch('leftMonitor', {});
        });
    }

    setFreeCamListeners() {
        UIEventBus.on('freeCamToggle', (toggle: boolean) => {
            // if (toggle === this.freeCam) return;
            if (toggle) {
                this.orbitControls.enabled = true;
                this.transition(
                    CameraKey.ORBIT_CONTROLS_START,
                    750,
                    BezierEasing(0.13, 0.99, 0, 1),
                    () => {
                        this.instance.position.copy(
                            this.keyframes.orbitControlsStart.position
                        );

                        this.orbitControls.update();
                        this.freeCam = true;
                    }
                );
                // @ts-ignore
                document.getElementById('webgl').style.pointerEvents = 'auto';
            } else {
                this.leaveFreeCamForFocus();
                this.transition(
                    CameraKey.IDLE,
                    4000,
                    TWEEN.Easing.Exponential.Out
                );
                // @ts-ignore
                document.getElementById('webgl').style.pointerEvents = 'none';
            }
        });
    }

    /** Release orbit control without starting an intermediate idle/desk tween. */
    leaveFreeCamForFocus() {
        const orbiting = this.freeCam;
        if (!orbiting && this.targetKeyframe !== CameraKey.ORBIT_CONTROLS_START) return;
        this.position.copy(this.instance.position);
        if (orbiting) this.focalPoint.copy(this.orbitControls.target);
        this.freeCam = false;
        this.orbitControls.enabled = false;
        const canvas = document.getElementById('webgl');
        if (canvas) canvas.style.pointerEvents = 'none';
        document.body.style.cursor = '';
        UIEventBus.dispatch('freeCamFocus', {});
    }

    private freeCamHit(x: number, y: number) {
        const world = this.application.world;
        if (!world?.laptop || !world.deskAndChair) return null;
        this.scene.updateMatrixWorld(true); this.instance.updateMatrixWorld(true);
        this.interactionPointer.set(x / this.sizes.width * 2 - 1, 1 - y / this.sizes.height * 2);
        this.interactionRay.setFromCamera(this.interactionPointer, this.instance);
        const nearest = this.interactionRay.intersectObjects(this.scene.children, true).find(({ object }) => {
            for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return false;
            return object instanceof THREE.Mesh && object !== world.deskAndChair.shadowCatcher;
        });
        const drawer = world.deskAndChair.drawer;
        if (nearest?.object === drawer.front) return 'drawer';
        for (let p: THREE.Object3D | null = nearest?.object || null; p; p = p.parent) {
            if (p === world.laptop.model || p === world.monitorScreen?.group) return 'laptop';
            if (p === drawer.timer && drawer.open) return 'timer';
        }
        return null;
    }

    private setFreeCamPicking() {
        let down: { x: number; y: number; moved: boolean } | null = null;
        const isUI = (event: Event) => (event.target as HTMLElement)?.closest?.('#ui, #ui-interactive, #drawer-controls, #cubing-records, iframe');
        document.addEventListener('pointerdown', (event) => {
            down = event.isPrimary !== false && this.freeCam && event.button === 0 && !isUI(event) ? { x: event.clientX, y: event.clientY, moved: false } : null;
        }, true);
        document.addEventListener('pointermove', (event) => {
            if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.moved = true;
            if (this.freeCam && !isUI(event)) document.body.style.cursor = down?.moved ? 'grabbing' : this.freeCamHit(event.clientX, event.clientY) ? 'pointer' : '';
        });
        document.addEventListener('pointercancel', () => { down = null; });
        document.addEventListener('click', (event) => {
            const gesture = down; down = null;
            if (!this.freeCam || !gesture || gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6 || event.button !== 0 || isUI(event)) return;
            const hit = this.freeCamHit(event.clientX, event.clientY);
            if (!hit) return;
            event.preventDefault();
            this.leaveFreeCamForFocus();
            const world = this.application.world, drawer = world.deskAndChair.drawer;
            if (hit === 'laptop') {
                if (drawer.open) drawer.setOpen(false, event, false);
                world.monitorScreen.monitorActive = true;
                this.trigger('enterMonitor');
            } else {
                drawer.setOpen(hit === 'timer' || !drawer.open, event);
                if (hit === 'timer') drawer.recordsPanel.show('click');
            }
        });
    }

    /** Tap on release, never on a drag, pinch, cancelled gesture or UI. */
    private setTouchPicking() {
        let down: { id: number; x: number; y: number; moved: boolean } | null = null;
        const isUI = (event: Event) => (event.target as HTMLElement)?.closest?.('#ui, #ui-interactive, #drawer-controls, #cubing-records, iframe');
        document.addEventListener('pointerdown', event => {
            if (event.pointerType !== 'touch' || isUI(event)) return;
            this.touchMouseUntil = Date.now() + 900;
            if (!event.isPrimary) { down = null; return; }
            down = !this.freeCam ? { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false } : null;
        }, true);
        document.addEventListener('pointermove', event => {
            if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) down.moved = true;
        });
        document.addEventListener('pointercancel', () => { down = null; });
        document.addEventListener('pointerup', event => {
            if (event.pointerType !== 'touch' || isUI(event)) return;
            this.touchMouseUntil = Date.now() + 900;
            const gesture = down; down = null;
            if (!gesture || gesture.id !== event.pointerId || gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8 || this.freeCam) return;
            if (this.introPlaying) { this.skipIntro(); return; }
            const key = this.targetKeyframe || this.currentKeyframe;
            if (![CameraKey.DESK, CameraKey.IDLE, CameraKey.DRAWER].includes(key as CameraKey)) return;
            const hit = this.freeCamHit(event.clientX, event.clientY);
            if (hit) this.activateTouchHit(hit, event);
        });
        // Block only compatibility mouse events from scene touch gestures.
        // UI buttons, iframe scrolling and native mouse input retain their path.
        document.addEventListener('mousedown', event => {
            if (Date.now() < this.touchMouseUntil && !isUI(event)) event.stopImmediatePropagation();
        }, true);
    }

    private activateTouchHit(hit: 'drawer' | 'laptop' | 'timer', input?: Event) {
        const world = this.application.world;
        if (!world?.deskAndChair || !world.monitorScreen) return;
        const drawer = world.deskAndChair.drawer;
        if (hit === 'laptop') {
            if (drawer.open) drawer.setOpen(false, input, false);
            world.monitorScreen.monitorActive = true;
            this.trigger('enterMonitor');
        } else {
            drawer.setOpen(hit === 'timer' || !drawer.open, input);
            if (hit === 'timer') drawer.recordsPanel.show('click');
        }
    }

    setPostLoadTransition() {
        UIEventBus.on('loadingScreenDone', (detail?: { skipIntro?: boolean }) => {
            this.playIntro(!!(detail && detail.skipIntro));
        });
    }

    /** Called once the laptop is loaded, so the monitor view can frame its display. */
    setScreenFrame(frame: ScreenFrame) {
        (this.keyframes.monitor as MonitorKeyframe).setScreenFrame(frame);
    }

    resize() {
        this.instance.aspect = this.sizes.width / this.sizes.height;
        this.instance.updateProjectionMatrix();
        if (this.orbitControls) {
            this.updateOrbitLimits();
            if (this.freeCam) this.orbitControls.update();
        }
    }

    createControls() {
        this.renderer = this.application.renderer;
        this.orbitControls = new OrbitControls(
            this.instance,
            this.renderer.instance.domElement
        );

        const { x, y, z } = this.keyframes.orbitControlsStart.focalPoint;
        this.orbitControls.target.set(x, y, z);

        this.orbitControls.enabled = false;
        this.orbitControls.enablePan = false;
        this.orbitControls.enableDamping = true;
        this.orbitControls.object.position.copy(
            this.keyframes.orbitControlsStart.position
        );
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.maxPolarAngle = Math.PI / 2;
        this.orbitControls.maxDistance = CAMERA.orbit.maxDistance;
        this.updateOrbitLimits();

        this.orbitControls.update();
    }

    /** Keep the full frustum on the sweep, including wide Free Camera views. */
    private updateOrbitLimits() {
        // Phone pinch zoom stops outside furniture; inspect via object taps.
        const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
        this.orbitControls.minDistance = phone ? 1400 : CAMERA.orbit.minDistance;
        const halfHorizontal = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.instance.fov / 2)) * this.instance.aspect);
        const limit = Math.max(0, Math.min(CAMERA.orbit.maxAzimuth, Math.PI / 2 - halfHorizontal - THREE.MathUtils.degToRad(10)));
        this.orbitControls.minAzimuthAngle = -limit;
        this.orbitControls.maxAzimuthAngle = limit;
    }

    update() {
        TWEEN.update();

        if (this.freeCam && this.orbitControls) {
            this.position.copy(this.orbitControls.object.position);
            this.focalPoint.copy(this.orbitControls.target);
            this.orbitControls.update();
            return;
        }

        for (const key in this.keyframes) {
            const _key = key as CameraKey;
            this.keyframes[_key].update();
        }

        if (this.currentKeyframe) {
            const keyframe = this.keyframes[this.currentKeyframe];
            this.position.copy(keyframe.position);
            this.focalPoint.copy(keyframe.focalPoint);
        }

        this.instance.position.copy(this.position);
        this.instance.lookAt(this.focalPoint);
    }
}
