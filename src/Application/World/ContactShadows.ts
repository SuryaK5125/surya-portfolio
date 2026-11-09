import * as THREE from 'three';
import Application from '../Application';
import { FLOOR_Y, HENRY_DESK, WALL_Z } from './SceneLayout';
import { STUDIO } from './StudioEnvironment';

/**
 * Soft contact shadows ("ambient occlusion" where things touch a surface).
 *
 * The key light's shadow map gives directional shadows, but real objects
 * also darken the surface right beneath them, which is what makes them feel
 * grounded. Each object gets a tight, darker footprint plus a wider, faint
 * falloff, sized from its actual bounds. They are unlit, depth-tested,
 * non-writing quads (a handful of draw calls; no post-processing pass).
 */

type Footprint = {
    /** World-space centre on the surface */
    x: number;
    z: number;
    width: number;
    depth: number;
    rotationY?: number;
};

type Clip = { minX: number; maxX: number; minZ: number; maxZ: number };

const SURFACE_LIFT = 1.1; // mm above the surface; clears the current desk shadow catcher (0.8)
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

let softBoxTexture: THREE.Texture | null = null;

/**
 * A rounded-rectangle falloff: full strength inside, smooth (quintic) fade
 * over the outer margin. Shared by every footprint.
 */
function getSoftBox() {
    if (softBoxTexture) return softBoxTexture;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    const image = context.createImageData(size, size);
    const inner = 0.5; // half-size of the solid core in normalised units (of 1)
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = Math.abs((x + 0.5) / size * 2 - 1);
            const v = Math.abs((y + 0.5) / size * 2 - 1);
            // Rounded-box distance (corner radius 0.35), 0 inside the core
            const r = 0.35;
            const qx = Math.max(u - (inner - r), 0);
            const qy = Math.max(v - (inner - r), 0);
            const d = Math.max(Math.hypot(qx, qy) - r, 0) / (1 - inner);
            const t = Math.min(Math.max(1 - d, 0), 1);
            const a = t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
            const i = (y * size + x) * 4;
            image.data[i] = image.data[i + 1] = image.data[i + 2] = 0;
            image.data[i + 3] = Math.round(a * 255);
        }
    }
    context.putImageData(image, 0, 0);
    softBoxTexture = new THREE.CanvasTexture(canvas);
    return softBoxTexture;
}

function shadowMaterial(texture: THREE.Texture, opacity: number) {
    return new THREE.MeshBasicMaterial({
        color: 0x000000,
        // The procedural image stores its falloff in alpha, not the green
        // channel sampled by alphaMap. Use map so the footprint is visible.
        map: texture,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });
}

/** Footprint of an object on the horizontal plane, from its world bounds. */
function footprintOf(object: THREE.Object3D): Footprint {
    object.updateWorldMatrix(true, true);
    // Measure in the object's own yaw so rotated objects get a snug rectangle
    const yaw = new THREE.Euler().setFromQuaternion(object.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
    const inverse = new THREE.Matrix4().makeRotationY(-yaw);
    const box = new THREE.Box3();
    const point = new THREE.Vector3();
    object.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !child.visible) return;
        const position = child.geometry.getAttribute('position');
        // Sample vertices (stride keeps this cheap on dense meshes)
        const stride = Math.max(1, Math.floor(position.count / 4000));
        for (let i = 0; i < position.count; i += stride) {
            point.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld).applyMatrix4(inverse);
            box.expandByPoint(point);
        }
    });
    const centre = box.getCenter(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
    const size = box.getSize(new THREE.Vector3());
    return { x: centre.x, z: centre.z, width: size.x, depth: size.z, rotationY: yaw };
}

export default class ContactShadows {
    application: Application;
    group: THREE.Group;

    constructor() {
        this.application = new Application();
        this.group = new THREE.Group();
        this.group.name = 'ContactShadows';
        this.application.scene.add(this.group);

        const { world, scene } = this.application;
        const deskY = 0;
        const deskTop: Clip = HENRY_DESK.top;
        // Keep the complete alpha falloff on the flat floor. A quad extending
        // beneath the cove is cut off by its rising surface and creates a seam.
        const floorClip: Clip = { minX: -STUDIO.halfWidth, maxX: STUDIO.halfWidth, minZ: WALL_Z + STUDIO.deskRadius, maxZ: STUDIO.frontZ };

        // Desk-top objects: tight contact + wider soft falloff
        const onDesk: [THREE.Object3D | undefined | null, number, number][] = [
            // [object, contact strength, spread strength]
            [world.laptop?.model, 0.4, 0.14],
            [world.speakers?.left, 0.46, 0.17],
            [world.speakers?.right, 0.46, 0.17],
            [world.porsche?.model, 0.38, 0.13],
            [scene.getObjectByName('BloodyV7Mouse'), 0.36, 0.13],
        ];
        for (const [object, contact, spread] of onDesk) {
            if (object) this.addFootprint(footprintOf(object), deskY, contact, spread, 1.6, deskTop);
        }

        // Headphone stand: only its feet touch the desk, so a lighter, rounder pool
        const headphones = scene.getObjectByName('HeadphonesAndStand');
        if (headphones) {
            const f = footprintOf(headphones);
            const s = Math.max(f.width, f.depth);
            this.addFootprint({ ...f, width: s * 0.9, depth: s * 0.9 }, deskY, 0.32, 0.12, 1.6, deskTop);
        }

        // Floor: under the desk (its legs and the dark space beneath it)
        const top = HENRY_DESK.top;
        const deskWidth = top.maxX - top.minX;
        const deskDepth = top.maxZ - top.minZ;
        this.addFootprint(
            { x: (top.minX + top.maxX) / 2, z: (top.minZ + top.maxZ) / 2, width: deskWidth * 0.96, depth: deskDepth * 0.9 },
            FLOOR_Y,
            0.3,
            0.11,
            1.25,
            floorClip
        );

        // Floor: the chair's five-star base
        const chair = scene.getObjectByName('OfficeChair');
        if (chair) {
            const f = footprintOf(chair);
            const s = Math.min(f.width, f.depth) * 0.95;
            this.addFootprint({ ...f, width: s, depth: s }, FLOOR_Y, 0.3, 0.12, 1.6, floorClip);
        }
        this.addFloorContacts([world.deskAndChair?.group, chair].filter(Boolean) as THREE.Object3D[]);
    }

    /** Low vertices locate the actual feet/casters. One instanced draw adds
     * tight grounding without another texture or a screen-space AO pass. */
    private addFloorContacts(objects: THREE.Object3D[]) {
        const patches: THREE.Box3[] = [];
        for (const object of objects) {
            object.updateWorldMatrix(true, true);
            const low = new THREE.Box3().setFromObject(object).min.y;
            const local: THREE.Box3[] = [];
            object.traverse(child => {
                if (!(child instanceof THREE.Mesh) || !child.visible) return;
                const vertices = child.geometry.getAttribute('position');
                for (let i = 0; i < vertices.count; i++) {
                    const point = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(child.matrixWorld);
                    if (point.y > low + 14 || point.y < FLOOR_Y - 2 || point.y > FLOOR_Y + 30) continue;
                    const patch = local.find(bounds => bounds.getCenter(new THREE.Vector3()).distanceToSquared(point) < 70 * 70);
                    if (patch) patch.expandByPoint(point);
                    else if (local.length < 10) local.push(new THREE.Box3(point.clone(), point.clone()));
                }
            });
            patches.push(...local);
        }
        if (!patches.length) return;
        const feet = new THREE.InstancedMesh(UNIT_PLANE, shadowMaterial(getSoftBox(), .28), patches.length);
        const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        patches.forEach((patch, index) => {
            const centre = patch.getCenter(new THREE.Vector3()), size = patch.getSize(new THREE.Vector3());
            centre.y = FLOOR_Y + SURFACE_LIFT + .1;
            const scale = new THREE.Vector3(Math.max(72, Math.min(220, size.x * 2 + 32)), Math.max(72, Math.min(220, size.z * 2 + 32)), 1);
            feet.setMatrixAt(index, new THREE.Matrix4().compose(centre, rotation, scale));
        });
        feet.name = 'FloorFootContacts'; feet.renderOrder = 1;
        feet.frustumCulled = false; feet.raycast = () => {};
        this.group.add(feet);
    }

    /**
     * Two stacked quads: a tight contact footprint (slightly larger than the
     * object) and a broad, faint penumbra.
     */
    addFootprint(f: Footprint, surfaceY: number, contact: number, spread: number, spreadScale = 1.6, clip?: Clip) {
        const layers: [number, number, number][] = [
            // [scale of footprint, extra margin mm, opacity]
            [1.08, 24, contact],
            [spreadScale, 90, spread],
        ];
        for (const [scale, margin, opacity] of layers) {
            const mesh = new THREE.Mesh(UNIT_PLANE, shadowMaterial(getSoftBox(), opacity));
            // Purely visual: never intercept clicks meant for the drawer or props
            mesh.raycast = () => {};
            // Lay flat, then turn to the object's yaw
            mesh.rotation.set(-Math.PI / 2, f.rotationY || 0, 0, 'YXZ');
            // Half-extent of the whole quad (the texture's solid core is the
            // middle half), kept within the surface so nothing hangs past an edge
            let halfW = f.width * scale + margin;
            let halfD = f.depth * scale + margin;
            if (clip) {
                halfW = Math.min(halfW, f.x - clip.minX, clip.maxX - f.x);
                halfD = Math.min(halfD, f.z - clip.minZ, clip.maxZ - f.z);
            }
            mesh.scale.set(halfW * 2, halfD * 2, 1);
            mesh.position.set(f.x, surfaceY + SURFACE_LIFT, f.z);
            mesh.renderOrder = 1;
            mesh.name = 'ContactShadow';
            this.group.add(mesh);
        }
    }

}
