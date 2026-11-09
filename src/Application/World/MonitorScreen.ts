import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import Application from '../Application';
import Camera, { CameraKey } from '../Camera/Camera';
import EventEmitter from '../Utils/EventEmitter';
import { ScreenFrame } from './ScreenFrame';

// Inlined so this module stays loadable by the Node checks in tools/model-pipeline.
const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// CSS resolution of the desktop. The height follows the panel's aspect ratio,
// and the CSS plane is scaled to the panel's physical size (mm).
const SCREEN_CSS_WIDTH = 1600;

// Lift the screen layers off the lid's display surface to avoid z-fighting (mm)
const SURFACE_OFFSET = 0.35;
const GLASS_OFFSET = 0.6;

// Same-origin desktop app (src/desktop), emitted at public/desktop/index.html.
// Relative so it stays same-origin on localhost, a LAN IP or a subpath.
const DESKTOP_SRC = 'desktop/';

// Input events the desktop bridge (src/desktop/bridge.ts) may forward.
const BRIDGE_EVENT_TYPES = ['mousemove', 'mousedown', 'mouseup', 'keydown', 'keyup', 'portfolio-leave'];
const MAX_KEY_LENGTH = 32;

type BridgeMessage = {
    type: string;
    clientX?: number;
    clientY?: number;
    key?: string;
};

const isValidKey = (key: unknown): key is string =>
    typeof key === 'string' && key.length <= MAX_KEY_LENGTH;

/**
 * Returns the message if it comes from an allowed sender and has an allowed
 * shape, otherwise null. Everything else is dropped, so other windows/frames
 * cannot replay arbitrary DOM events (e.g. UI event bus names) into the page.
 */
function validateBridgeMessage(
    event: MessageEvent,
    iframe: HTMLIFrameElement
): BridgeMessage | null {
    if (event.origin !== window.location.origin) return null;

    const data = event.data;
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
        return null;
    }

    // 1. The desktop inside the screen iframe: whitelisted input events only.
    if (event.source !== null && event.source === iframe.contentWindow) {
        // indexOf rather than includes: tsconfig targets ES6 lib
        if (BRIDGE_EVENT_TYPES.indexOf(data.type) === -1) return null;

        if (data.type === 'keydown' || data.type === 'keyup') {
            return isValidKey(data.key) ? { type: data.type, key: data.key } : null;
        }

        if (data.type === 'mousemove') {
            return Number.isFinite(data.clientX) && Number.isFinite(data.clientY)
                ? { type: data.type, clientX: data.clientX, clientY: data.clientY }
                : null;
        }

        return { type: data.type };
    }

    return null;
}

/** Soft, static reflection on the panel glass: a faint diagonal sheen. */
const GLASS_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Additive "live panel" layer: diagonal sheen, faint fingerprint smudges,
 * very faint static grain and a slow refresh shimmer. All procedural (original),
 * in the spirit of the layered screen in the original project.
 */
const GLASS_FRAGMENT = /* glsl */ `
uniform float uStrength;
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
}

void main() {
    float band = smoothstep(0.0, 0.55, vUv.x + vUv.y * 0.6 - 0.15)
        * (1.0 - smoothstep(0.55, 1.25, vUv.x + vUv.y * 0.6));
    float edge = smoothstep(0.75, 1.0, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0);

    // Smudges: soft, low-frequency blotches, strongest where the sheen catches them
    float smudge = smoothstep(0.55, 0.85, fbm(vUv * vec2(5.0, 3.2) + 7.3));

    // Static, sub-percent grain is confined to the physical display glass.
    // It never covers the room/UI, and does not crawl over text while reading.
    float grain = hash(floor(vUv * uResolution));

    // Slow refresh shimmer travelling down the panel
    float roll = fract(vUv.y * 0.6 + uTime * 0.035);
    float shimmer = smoothstep(0.0, 0.08, roll) * (1.0 - smoothstep(0.08, 0.22, roll));

    float alpha = uStrength * (0.55 * band + 0.25 * edge)
        + smudge * (0.004 + 0.012 * band)
        + grain * 0.004
        + shimmer * 0.003;
    gl_FragColor = vec4(vec3(1.0), alpha);
}
`;

/** Inner-bezel shadow and vignette: gives the panel depth under the glass. */
const SHADOW_FRAGMENT = /* glsl */ `
uniform float uAspect;
varying vec2 vUv;
void main() {
    vec2 d = abs(vUv - 0.5) * 2.0;
    // Thin shadow cast by the bezel lip along every edge
    float lip = max(smoothstep(1.0 - 0.035, 1.0, d.x), smoothstep(1.0 - 0.035 * uAspect, 1.0, d.y));
    // Broad, gentle vignette towards the corners
    float vig = smoothstep(0.45, 1.45, length(d * vec2(1.0, 0.85)));
    gl_FragColor = vec4(vec3(0.0), 0.42 * lip + 0.22 * vig);
}
`;

/**
 * The laptop display: the same-origin desktop in a CSS3D iframe, placed
 * exactly on the model's "Screen" frame, with a WebGL occluder (so the
 * laptop correctly hides it), a glass sheen and a viewing-angle dimmer.
 */
export default class MonitorScreen extends EventEmitter {
    application: Application;
    scene: THREE.Scene;
    cssScene: THREE.Scene;
    camera: Camera;
    frame: ScreenFrame;
    cssSize: { w: number; h: number };
    private iframe: HTMLIFrameElement;
    private screenContainer: HTMLDivElement;
    group: THREE.Group;
    prevInComputer = false;
    monitorActive = false;
    shouldLeaveMonitor: boolean;
    inComputer: boolean;
    mouseClickInProgress: boolean;
    dimmer: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    glassUniforms: { uStrength: { value: number }; uTime: { value: number }; uResolution: { value: THREE.Vector2 } };

    constructor(frame: ScreenFrame) {
        super();
        this.application = new Application();
        this.scene = this.application.scene;
        this.cssScene = this.application.cssScene;
        this.camera = this.application.camera;
        this.frame = frame;
        this.mouseClickInProgress = false;
        this.shouldLeaveMonitor = false;

        this.cssSize = {
            w: SCREEN_CSS_WIDTH,
            h: Math.round((SCREEN_CSS_WIDTH * frame.height) / frame.width),
        };

        // All screen layers live in the panel's own frame
        this.group = new THREE.Group();
        this.group.name = 'ScreenLayers';
        this.group.position.copy(frame.position);
        this.group.quaternion.copy(frame.quaternion);
        this.scene.add(this.group);

        this.initializeScreenEvents();
        this.initializeExitControls();
        this.createIframe();
        this.createGlass();
        this.createDimmer();

        this.camera.setScreenFrame(frame);
        // Reuse the same iframe (and its state) in a readable phone viewport.
        // Moving a live iframe between parents reloads it in many browsers, so
        // promote its CSS3D wrapper with CSS instead of reparenting the frame.
        const updateSurface = () => this.updateMobileSurface();
        document.addEventListener('enterMonitor', updateSurface);
        document.addEventListener('leftMonitor', updateSurface);
        window.addEventListener('resize', updateSurface);
        window.visualViewport?.addEventListener('resize', updateSurface);
    }

    initializeScreenEvents() {
        document.addEventListener(
            'mousemove',
            (event) => {
                // @ts-ignore
                const id = event.target.id;
                if (id === 'computer-screen') {
                    // @ts-ignore
                    event.inComputer = true;
                }

                // @ts-ignore
                this.inComputer = event.inComputer;

                // Pointer position only: the zoomed-in screen is never left by
                // moving off it (or by finishing a drag outside it). Entering and
                // leaving both need a click; see mousedown.
                this.application.mouse.trigger('mousemove', [event]);

                this.prevInComputer = this.inComputer;
            },
            false
        );
        document.addEventListener(
            'mousedown',
            (event) => {
                // @ts-ignore
                this.inComputer = event.inComputer;
                const isScreen = this.inComputer || (event.target as HTMLElement).id === 'computer-screen';
                // A click anywhere outside the screen (not on the overlay UI, which has
                // its own Back control) steps back to the desk.
                const target = event.target as HTMLElement;
                const onOverlay = !!(target && target.closest && target.closest('#ui, #ui-interactive, #drawer-controls, #cubing-records'));
                if (this.monitorActive && !isScreen && !onOverlay) {
                    this.leaveMonitor();
                    this.application.mouse.trigger('mousedown', [event]);
                    this.mouseClickInProgress = true;
                    this.prevInComputer = this.inComputer;
                    return;
                }
                const key = this.camera.targetKeyframe || this.camera.currentKeyframe;
                // Drawer focus is a scene view too. Allow an explicit screen click
                // during its opening glide, while retaining the intro/Free Camera locks.
                const ready = !this.camera.targetKeyframe || this.camera.targetKeyframe === CameraKey.DRAWER;
                if (isScreen && !this.monitorActive && !this.camera.freeCam && !this.camera.introPlaying && ready &&
                    (key === CameraKey.DESK || key === CameraKey.IDLE || key === CameraKey.DRAWER)) {
                    const drawer = this.application.world?.deskAndChair?.drawer;
                    if (drawer?.open) drawer.setOpen(false, event, false);
                    this.monitorActive = true;
                    this.camera.trigger('enterMonitor');
                }
                this.application.mouse.trigger('mousedown', [event]);

                this.mouseClickInProgress = true;
                this.prevInComputer = this.inComputer;
            },
            false
        );
        document.addEventListener(
            'mouseup',
            (event) => {
                // @ts-ignore
                this.inComputer = event.inComputer;
                this.application.mouse.trigger('mouseup', [event]);

                this.mouseClickInProgress = false;
                this.prevInComputer = this.inComputer;
            },
            false
        );
    }

    /** Steps back from the screen to the desk view (no-op when not zoomed in). */
    leaveMonitor() {
        if (!this.monitorActive) return;
        this.monitorActive = false;
        this.shouldLeaveMonitor = false;
        this.camera.trigger('leftMonitor');
    }

    /**
     * Explicit ways back besides moving the pointer off the screen, which
     * touch screens can't do: the overlay's Back button (a UI event bus
     * message) and Escape pressed outside the desktop. Escape inside the
     * desktop belongs to its apps; those keys arrive as forwarded
     * CustomEvents flagged inComputer and are ignored here.
     */
    initializeExitControls() {
        document.addEventListener('requestLeaveMonitor', () => this.leaveMonitor());
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if ((event as KeyboardEvent & { inComputer?: boolean }).inComputer) return;
            this.leaveMonitor();
        });
    }

    /**
     * Re-dispatches validated postMessage input as bubbling events on the
     * iframe element (flagged inComputer), remapping pointer coordinates from
     * the desktop's viewport to the page.
     */
    initializeMessageBridge(iframe: HTMLIFrameElement) {
        window.addEventListener('message', (event) => {
            const message = validateBridgeMessage(event, iframe);
            if (!message) return;
            // Escape inside the desktop with nothing left for it to close
            if (message.type === 'portfolio-leave') { this.leaveMonitor(); return; }

            const evt = new CustomEvent(message.type, {
                bubbles: true,
                cancelable: false,
            });

            // @ts-ignore
            evt.inComputer = true;
            if (message.type === 'mousemove') {
                const { top, left, width, height } =
                    iframe.getBoundingClientRect();
                const widthRatio = width / iframe.clientWidth;
                const heightRatio = height / iframe.clientHeight;

                // @ts-ignore
                evt.clientX = Math.round(
                    (message.clientX as number) * widthRatio + left
                );
                // @ts-ignore
                evt.clientY = Math.round(
                    (message.clientY as number) * heightRatio + top
                );
            } else if (message.type === 'keydown' || message.type === 'keyup') {
                // @ts-ignore
                evt.key = message.key;
            }

            iframe.dispatchEvent(evt);
        });
    }

    /**
     * Creates the desktop iframe and places it on the screen frame.
     */
    createIframe() {
        const { w, h } = this.cssSize;

        const container = document.createElement('div');
        this.screenContainer = container;
        container.className = 'laptop-desktop-surface';
        container.style.width = w + 'px';
        container.style.height = h + 'px';
        container.style.background = '#000';

        const iframe = document.createElement('iframe');
        this.iframe = iframe;

        // Bubble validated desktop input events into the main application, so
        // we can affect the camera. Registered once; sound uses a separate semantic channel.
        this.initializeMessageBridge(iframe);

        iframe.src = DESKTOP_SRC;
        iframe.style.width = w + 'px';
        iframe.style.height = h + 'px';
        iframe.style.boxSizing = 'border-box';
        iframe.style.border = '0';
        iframe.style.display = 'block';
        iframe.id = 'computer-screen';
        iframe.title = 'Desktop';

        container.appendChild(iframe);
        this.createCssPlane(container);
    }

    /**
     * Places the element on the screen frame (scaled from CSS px to mm) and
     * adds a matching WebGL plane that "punches through" the canvas, so the
     * laptop geometry in front of the screen correctly occludes it.
     */
    createCssPlane(element: HTMLElement) {
        this.group.updateMatrixWorld(true);

        const object = new CSS3DObject(element);
        object.position.copy(
            this.group.localToWorld(new THREE.Vector3(0, 0, SURFACE_OFFSET))
        );
        object.quaternion.copy(this.frame.quaternion);
        object.scale.setScalar(this.frame.width / this.cssSize.w);
        this.cssScene.add(object);

        // NoBlending writes transparent black, revealing the CSS layer below
        const occluder = new THREE.Mesh(
            new THREE.PlaneGeometry(this.frame.width, this.frame.height),
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0,
                blending: THREE.NoBlending,
                fog: false,
            })
        );
        occluder.name = 'ScreenOccluder';
        // Explicit order: occluder, shadow, glass, then dimmer (they're < 1 mm apart)
        occluder.renderOrder = 1;
        occluder.position.z = SURFACE_OFFSET;
        this.group.add(occluder);
    }

    createGlass() {
        const shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(this.frame.width, this.frame.height),
            new THREE.ShaderMaterial({
                vertexShader: GLASS_VERTEX,
                fragmentShader: SHADOW_FRAGMENT,
                uniforms: { uAspect: { value: this.frame.width / this.frame.height } },
                transparent: true,
                depthWrite: false,
            })
        );
        shadow.name = 'ScreenShadow';
        shadow.renderOrder = 2;
        shadow.position.z = (SURFACE_OFFSET + GLASS_OFFSET) / 2;
        this.group.add(shadow);

        this.glassUniforms = {
            uStrength: { value: 0.07 },
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(this.cssSize.w, this.cssSize.h) },
        };
        const glass = new THREE.Mesh(
            new THREE.PlaneGeometry(this.frame.width, this.frame.height),
            new THREE.ShaderMaterial({
                vertexShader: GLASS_VERTEX,
                fragmentShader: GLASS_FRAGMENT,
                uniforms: this.glassUniforms,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            })
        );
        glass.name = 'ScreenGlass';
        glass.renderOrder = 3;
        glass.position.z = GLASS_OFFSET;
        this.group.add(glass);
    }

    /** Darkens the panel when viewed off-axis or from far away. */
    createDimmer() {
        this.dimmer = new THREE.Mesh(
            new THREE.PlaneGeometry(this.frame.width, this.frame.height),
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                fog: false,
            })
        );
        this.dimmer.name = 'ScreenDimmer';
        this.dimmer.renderOrder = 4;
        this.dimmer.position.z = GLASS_OFFSET + 0.1;
        this.group.add(this.dimmer);
    }

    private updateMobileSurface() {
        const active = this.monitorActive && window.matchMedia('(max-width: 700px), (max-height: 500px) and (pointer: coarse)').matches;
        document.body.style.setProperty('--mobile-viewport-height', `${window.visualViewport?.height || window.innerHeight}px`);
        document.body.classList.toggle('mobile-desktop-active', active);
        this.screenContainer.classList.toggle('is-mobile-desktop', active);
        this.iframe.style.width = active ? '100%' : this.cssSize.w + 'px';
        this.iframe.style.height = active ? '100%' : this.cssSize.h + 'px';
    }

    update() {
        if (!this.dimmer) return;
        // Gentle glass shimmer; held still for visitors who prefer reduced motion
        if (this.glassUniforms && !prefersReducedMotion()) {
            this.glassUniforms.uTime.value = this.application.time.elapsed / 1000;
        }
        const cameraPosition = this.camera.instance.position;
        const toCamera = cameraPosition.clone().sub(this.frame.position);
        const distance = toCamera.length();
        const facing = Math.max(toCamera.normalize().dot(this.frame.normal), 0);

        const angleDim = Math.pow(1 - facing, 1.5) * 0.85;
        const distanceDim =
            THREE.MathUtils.smoothstep(distance, 600, 1800) * 0.12;
        this.dimmer.material.opacity = Math.min(0.85, angleDim + distanceDim);
    }
}
