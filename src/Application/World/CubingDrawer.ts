import * as THREE from 'three';
import Application from '../Application';
import { CameraKey } from '../Camera/Camera';
import { HENRY_DESK } from './SceneLayout';
import { splitTopDrawer } from './DrawerGeometry';
import { deskMaterials, planarUV } from './DeskFinish';
import TimerRecordsPanel from './TimerRecordsPanel';
import createCubingTimer from './CubingTimer';
import UIEventBus from '../UI/EventBus';

// Edges and body of the drawer: dark walnut, matching the veneer front
const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x2e1d13).convertSRGBToLinear(), roughness: .62 });
const felt = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x373b36).convertSRGBToLinear(), roughness: 1 });
const cavity = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x12120f).convertSRGBToLinear(), roughness: 1 });
const rail = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x454a4e).convertSRGBToLinear(), metalness: .65, roughness: .4 });
const box = (w: number, h: number, d: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
};

/** An additive drawer mechanism behind the existing UV-mapped front.
 * The original GLB and baked image are never rewritten. Units are millimetres. */
export default class CubingDrawer {
    application: Application;
    moving = new THREE.Group();
    contents = new THREE.Group();
    front: THREE.Mesh;
    progress = 0;
    open = false;
    readonly travel = 365;
    readonly duration = 650;
    timer: THREE.Group;
    private fillContents: () => void;
    private contentsReady = false;
    private pendingOpen = false;
    private loadFailed = false;
    recordsPanel: TimerRecordsPanel;
    private controls: HTMLDivElement;
    private recordsButton: HTMLButtonElement;
    private caption: HTMLSpanElement;
    private viewButton: HTMLButtonElement;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();
    private hovered = false;
    private drawerFocused = false;
    private lastPointer: { x: number; y: number } | null = null;

    constructor(desk: THREE.Mesh) {
        this.application = new Application();
        const parts = splitTopDrawer(desk.geometry);
        desk.geometry = parts.fixed;
        // Finish: walnut drawer fronts with satin brass handles (the baked
        // texture still colours the rest of the desk). Both drawers match.
        const { woodFlat, brassFlat } = deskMaterials();
        for (const geometry of [parts.moving, parts.lowerFront]) planarUV(geometry, HENRY_DESK.scale);
        const lowerFront = new THREE.Mesh(parts.lowerFront, woodFlat);
        const lowerHandle = new THREE.Mesh(parts.lowerHandle, brassFlat);
        lowerFront.name = 'LowerDrawerFront';
        lowerHandle.name = 'LowerDrawerHandle';
        for (const piece of [lowerFront, lowerHandle]) {
            piece.position.copy(desk.position);
            piece.quaternion.copy(desk.quaternion);
            piece.scale.copy(desk.scale);
            piece.castShadow = true;
            piece.receiveShadow = true;
            desk.parent?.add(piece);
        }
        this.front = new THREE.Mesh(parts.moving, [woodFlat, brassFlat]);
        this.front.castShadow = true;
        this.front.name = 'TopDrawerOriginalFrontAndHandle';
        this.front.scale.setScalar(HENRY_DESK.scale);
        this.front.position.copy(HENRY_DESK.position);
        this.moving.name = 'TopDrawer';
        this.moving.userData.interactive = 'Top speedcubing drawer';
        this.moving.add(this.front);
        this.application.scene.add(this.moving);
        this.makeInterior();
        this.contents.visible = false;
        this.createControls();
        this.installInteraction();
        this.application.resources.on('backgroundReady', () => {
            if (this.contentsReady) return;
            this.fillContents();
            this.contentsReady = true;
            this.application.world.lighting.applyEnvironmentIntensity();
        });
    }

    makeInterior() {
        const scale = HENRY_DESK.scale;
        const centreX = (-3.45813 - 1.76203) / 2 * scale;
        const frontZ = 1.60541 * scale + HENRY_DESK.position.z;
        const frontTop = -.68804 * scale + HENRY_DESK.position.y;
        const bottom = -1.19290 * scale + HENRY_DESK.position.y;
        const width = (3.45813 - 1.76203) * scale;
        const depth = 420;
        const rearZ = frontZ - 16 - depth;
        const centreZ = (rearZ + frontZ - 16) / 2;
        const floor = bottom + 18;
        const bodyWidth = width - 10;

        // Fixed opaque liner: closes the cabinet behind the top opening, including
        // the roof and divider above the untouched lower drawer.
        const fixed = new THREE.Group();
        fixed.name = 'TopDrawerCabinetLiner';
        const liningWidth = width + 48;
        const liningTop = frontTop + 9;
        const liningBottom = bottom - 8;
        const liningHeight = liningTop - liningBottom;
        const addFixed = (w: number, h: number, d: number, x: number, y: number, z: number) => {
            const mesh = box(w, h, d, cavity); mesh.position.set(x, y, z); fixed.add(mesh);
        };
        addFixed(liningWidth, 8, depth + 30, centreX, liningTop, centreZ);
        addFixed(liningWidth, 8, depth + 30, centreX, liningBottom, centreZ);
        addFixed(liningWidth, liningHeight, 10, centreX, (liningTop + liningBottom) / 2, rearZ - 12);
        [-1, 1].forEach((side) => {
            addFixed(10, liningHeight, depth + 30, centreX + side * (liningWidth / 2 - 5), (liningTop + liningBottom) / 2, centreZ);
            const runner = box(8, 14, depth - 30, rail);
            runner.position.set(centreX + side * (bodyWidth / 2 + 5), floor + 12, centreZ);
            fixed.add(runner);
        });
        this.application.scene.add(fixed);

        const addMoving = (w: number, h: number, d: number, x: number, y: number, z: number, material = wood) => {
            const mesh = box(w, h, d, material); mesh.position.set(x, y, z); this.moving.add(mesh);
        };
        // The source front was a plane. Add a 16 mm back and edge thickness,
        // slightly recessed to retain its original textured surface exactly.
        addMoving(width, frontTop - bottom, 16, centreX, (frontTop + bottom) / 2, frontZ - 8.25);
        addMoving(bodyWidth, 10, depth, centreX, bottom + 13, centreZ);
        addMoving(bodyWidth, 82, 10, centreX, bottom + 54, rearZ + 5);
        [-1, 1].forEach((side) => {
            addMoving(10, 82, depth, centreX + side * (bodyWidth / 2 - 5), bottom + 54, centreZ);
            addMoving(5, 12, depth - 20, centreX + side * (bodyWidth / 2 + 1), floor + 12, centreZ, rail);
        });
        this.contents.name = 'SpeedcubingContents';
        this.moving.add(this.contents);
        // A thin plain fabric liner, with no fitted perfume organizer or recesses.
        const lining = box(bodyWidth - 22, 2.5, depth - 24, felt);
        lining.name = 'PlainDrawerLiner';
        lining.position.set(centreX, floor + 1.25, centreZ);
        this.contents.add(lining);
        this.fillContents = () => {
            const { gltfModel } = this.application.resources.items;
            const models = [gltfModel.cube2Model.scene, gltfModel.cube3Model.scene, gltfModel.cube4Model.scene, createCubingTimer()];
            // Uneven spacing across the liner, rather than a display-like row.
            // Each cube rests flat; yaw and position vary while the timer stays put.
            const placements = [
                { x: -18, z: frontZ - 249, yaw: -24, name: 'Solved2x2' },
                { x: -146, z: frontZ - 115, yaw: 19, name: 'Solved3x3' },
                { x: 110, z: frontZ - 63, yaw: -9, name: 'Solved4x4' },
                { x: 43, z: frontZ - 150, yaw: 0, name: 'OriginalCubingTimer' },
            ];
            const occupied: THREE.Box3[] = [];
            models.forEach((model, i) => {
                const placement = placements[i];
                model.name = placement.name;
                model.rotation.y = THREE.MathUtils.degToRad(placement.yaw);
                model.traverse((object) => {
                    if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
                });
                model.updateMatrixWorld(true);
                const bounds = new THREE.Box3().setFromObject(model);
                const centre = bounds.getCenter(new THREE.Vector3());
                model.position.set(centreX + placement.x - centre.x, floor + 2.7 - bounds.min.y, placement.z - centre.z);
                model.updateMatrixWorld(true); bounds.setFromObject(model);
                if (bounds.max.y > frontTop - 8 || bounds.min.z < rearZ + 20 || bounds.max.z > frontZ - 17 || bounds.min.x < centreX - bodyWidth/2 + 12 || bounds.max.x > centreX + bodyWidth/2 - 12) {
                    throw new Error(`${model.name} does not clear the drawer interior`);
                }
                if (occupied.some(other => other.intersectsBox(bounds))) throw new Error(`${model.name} overlaps another drawer prop`);
                occupied.push(bounds.clone()); this.contents.add(model);
                if (i === 3) this.timer = model;
            });
        };
    }

    private canInteract() {
        const camera = this.application.camera;
        const key = camera.targetKeyframe || camera.currentKeyframe;
        return !camera.freeCam && [CameraKey.DESK, CameraKey.IDLE, CameraKey.DRAWER].includes(key as CameraKey);
    }

    private hit(x: number, y: number): THREE.Object3D | null {
        if (!this.canInteract()) return null;
        this.pointer.set(x / this.application.sizes.width * 2 - 1, 1 - y / this.application.sizes.height * 2);
        this.application.camera.instance.updateMatrixWorld();
        this.application.scene.updateMatrixWorld();
        this.raycaster.setFromCamera(this.pointer, this.application.camera.instance);
        const hits = this.raycaster.intersectObjects(this.application.scene.children, true);
        const nearest = hits.find(({ object }) => {
            for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
            return object instanceof THREE.Mesh && object !== this.application.world.deskAndChair?.shadowCatcher;
        });
        if (nearest?.object === this.front) return this.front;
        if (this.open && this.progress === 1) {
            for (let p: THREE.Object3D | null = nearest?.object || null; p; p = p.parent) {
                if (p === this.timer) return p;
            }
        }
        return null;
    }

    setOpen(open: boolean, input?: Event, focusCamera = true) {
        if (!open) { this.pendingOpen = false; this.loadFailed = false; }
        if (open && !this.contentsReady) {
            if (this.pendingOpen) return;
            this.pendingOpen = true;
            this.loadFailed = false;
            this.refreshControls();
            void this.application.resources.ensureBackground().then(() => {
                if (!this.pendingOpen) return;
                this.pendingOpen = false;
                // A laptop/orbit selection while loading supersedes this request.
                if (!this.canInteract()) { this.refreshControls(); return; }
                this.setOpen(true, input, focusCamera);
            }).catch(error => {
                console.warn('Unable to prepare drawer; retry is available', error);
                this.pendingOpen = false;
                this.loadFailed = true;
                this.refreshControls();
            });
            return;
        }
        const changed = this.open !== open;
        this.open = open;
        if (changed && input?.isTrusted) UIEventBus.dispatch('sceneSound', { cue: open ? 'drawer-open' : 'drawer-close', input });
        this.recordsPanel.hide();
        const camera = this.application.camera;
        // Laptop handoff closes the mechanism without starting a competing desk tween.
        if (focusCamera && !camera.freeCam) camera.transition(open ? CameraKey.DRAWER : CameraKey.DESK, 1000);
        this.refreshControls();
    }

    private createControls() {
        this.controls = document.createElement('div');
        this.controls.id = 'drawer-controls'; this.controls.hidden = true;
        this.controls.setAttribute('aria-label', 'Speedcubing drawer');
        this.caption = document.createElement('span'); this.caption.textContent = 'DRAWER / Esc closes';
        this.recordsButton = document.createElement('button');
        this.recordsButton.type = 'button'; this.recordsButton.textContent = 'Records';
        this.recordsButton.title = 'View timer records';
        this.recordsPanel = new TimerRecordsPanel(this.recordsButton);
        const close = document.createElement('button');
        close.type = 'button'; close.textContent = 'Close drawer';
        close.title = 'Close drawer and return to desk (Esc)';
        close.addEventListener('click', (event) => this.setOpen(false, event));
        this.viewButton = document.createElement('button'); this.viewButton.type = 'button';
        this.viewButton.addEventListener('click', () => {
            if (this.loadFailed) { this.setOpen(true); return; }
            const camera = this.application.camera;
            const key = camera.targetKeyframe || camera.currentKeyframe;
            this.recordsPanel.hide();
            camera.transition(key === CameraKey.DRAWER ? CameraKey.DESK : CameraKey.DRAWER, 1000);
            this.refreshControls();
        });
        this.controls.append(this.caption, this.recordsButton, close, this.viewButton);
        document.body.appendChild(this.controls);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && (this.open || this.pendingOpen || this.loadFailed) && this.canInteract()) this.setOpen(false, event);
        });
    }

    private refreshControls() {
        const camera = this.application.camera;
        const key = camera.targetKeyframe || camera.currentKeyframe;
        const drawerFocused = this.open && !camera.freeCam && key === CameraKey.DRAWER;
        if (drawerFocused !== this.drawerFocused) {
            this.drawerFocused = drawerFocused;
            UIEventBus.dispatch('drawerFocusChange', drawerFocused);
        }
        this.controls.setAttribute('data-view', drawerFocused ? 'detail' : 'desk');
        this.controls.hidden = !(this.open || this.pendingOpen || this.loadFailed) || camera.freeCam || ![CameraKey.DRAWER, CameraKey.DESK].includes(key as CameraKey);
        this.caption.textContent = this.loadFailed ? 'Drawer unavailable' : this.pendingOpen ? 'Preparing drawer...' : 'DRAWER / Esc closes';
        this.recordsButton.disabled = !this.contentsReady || this.progress < 1 || key !== CameraKey.DRAWER;
        this.viewButton.disabled = this.pendingOpen;
        this.viewButton.textContent = this.loadFailed ? 'Retry' : key === CameraKey.DRAWER ? 'Desk view' : 'Drawer view';
        this.viewButton.title = key === CameraKey.DRAWER ? 'Return to desk view; keep drawer open' : 'Look inside the open drawer';
        if (this.controls.hidden || key !== CameraKey.DRAWER) this.recordsPanel.hide();
    }

    installInteraction() {
        const isUI = (event: MouseEvent) => (event as MouseEvent & { inComputer?: boolean }).inComputer || (event.target as HTMLElement).closest('#ui, #ui-interactive, #drawer-controls, #cubing-records, iframe');
        document.addEventListener('mousemove', (event) => {
            if (this.application.camera.freeCam) { this.lastPointer = null; this.recordsPanel.setHovered(false); return; }
            if (isUI(event)) {
                this.lastPointer = null; this.setHover(false); this.recordsPanel.setHovered(false);
                return;
            }
            this.lastPointer = { x: event.clientX, y: event.clientY };
            const hit = this.hit(event.clientX, event.clientY);
            this.setHover(!!hit); this.recordsPanel.setHovered(hit === this.timer);
        });
        document.addEventListener('mousedown', (event) => {
            if (event.button !== 0 || isUI(event)) return;
            const hit = this.hit(event.clientX, event.clientY);
            if (!hit) return;
            event.preventDefault(); event.stopImmediatePropagation();
            if (hit === this.front) this.setOpen(!(this.open || this.pendingOpen), event);
            else { this.recordsPanel.setHovered(true); this.recordsPanel.show('click'); }
        }, true);
    }

    private setHover(hovered: boolean) {
        if (hovered === this.hovered) return;
        this.hovered = hovered;
        document.body.style.cursor = hovered ? 'pointer' : '';
    }

    update() {
        const step = Math.min(this.application.time.delta, 50) / this.duration;
        this.progress = THREE.MathUtils.clamp(this.progress + (this.open ? step : -step), 0, 1);
        const eased = this.progress * this.progress * (3 - 2 * this.progress);
        this.moving.position.z = eased * this.travel;
        this.contents.visible = this.progress > 0;
        this.refreshControls();
        // Refresh hover while the moving handle passes under a stationary pointer.
        if (this.lastPointer) {
            const hit = this.hit(this.lastPointer.x, this.lastPointer.y);
            this.setHover(!!hit); this.recordsPanel.setHovered(hit === this.timer);
        }
        if (this.timer && !this.recordsPanel.element.hidden) {
            const anchor = new THREE.Box3().setFromObject(this.timer).getCenter(new THREE.Vector3());
            anchor.y += 20;
            anchor.project(this.application.camera.instance);
            // Keep the dialog outside the projected contents, even after resize.
            const bounds = new THREE.Box3().setFromObject(this.contents);
            const projected: THREE.Vector3[] = [];
            [bounds.min.x,bounds.max.x].forEach(x => [bounds.min.y,bounds.max.y].forEach(y => [bounds.min.z,bounds.max.z].forEach(z => {
                projected.push(new THREE.Vector3(x,y,z).project(this.application.camera.instance));
            })));
            const { width, height } = this.application.sizes;
            this.recordsPanel.position((anchor.x+1)/2*width,(1-anchor.y)/2*height,width,height,{
                left: (Math.min(...projected.map(p=>p.x))+1)/2*width,
                right: (Math.max(...projected.map(p=>p.x))+1)/2*width,
                top: (1-Math.max(...projected.map(p=>p.y)))/2*height,
            });
        }
    }
}
