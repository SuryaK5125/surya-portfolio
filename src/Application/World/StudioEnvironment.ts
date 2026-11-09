import * as THREE from 'three';
import { FLOOR_Y, WALL_Z } from './SceneLayout';

// Millimetres. One open studio sweep, with no side walls or enclosing room.
export const STUDIO = {
    halfWidth: 80000,
    frontZ: 28000,
    height: 24000,
    radius: 12,
    deskRadius: 12,
    tightHalfWidth: 2600,
    blendWidth: 2800,
    acrossSegments: 64,
    curveSegments: 8,
    color: 0xa8bdb0,
    background: 0x899d94,
    floor: 0x555957,
    baseboard: 0xe5e3dc,
};

/** A small floor fillet beneath the baseboard keeps the backdrop continuous.
 * The vertical display plane stays flat and continuous across the entire scene. */
export function studioCoveAt(x: number) {
    const t = THREE.MathUtils.clamp((Math.abs(x) - STUDIO.tightHalfWidth) / STUDIO.blendWidth, 0, 1);
    const blend = t * t * t * (t * (t * 6 - 15) + 10);
    const derivative = 30 * t * t * (t - 1) * (t - 1) / STUDIO.blendWidth;
    return {
        radius: STUDIO.deskRadius + (STUDIO.radius - STUDIO.deskRadius) * blend,
        slope: Math.sign(x) * (STUDIO.radius - STUDIO.deskRadius) * derivative,
    };
}

/** One indexed floor/cove/backdrop, with analytic, tangent-continuous normals. */
export function createStudioSweep() {
    const floorZ = [STUDIO.frontZ, 18000, 10000, 6000, 3500, 2000, 1000];
    const profile = [
        ...floorZ.map(z => ({ kind: 'floor', value: z })),
        { kind: 'curve', value: 0 },
        ...Array.from({ length: STUDIO.curveSegments }, (_, i) => ({ kind: 'curve', value: (i + 1) / STUDIO.curveSegments * Math.PI / 2 })),
        ...[1000, 2500, 5000, 10000, STUDIO.height].map(height => ({ kind: 'wall', value: height })),
    ];
    const positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
    const columns = STUDIO.acrossSegments + 1;
    const wall = new THREE.Color(STUDIO.color).convertSRGBToLinear();
    const atmosphere = new THREE.Color(STUDIO.background).convertSRGBToLinear();
    const floor = new THREE.Color(STUDIO.floor).convertSRGBToLinear();
    for (const p of profile) {
        for (let column = 0; column < columns; column++) {
            // Concentrate samples around the furniture and cove blend, retaining
            // distant boundaries without wasting a dense grid across 160 metres.
            const u = column / STUDIO.acrossSegments * 2 - 1;
            const x = Math.sinh(u * 5) / Math.sinh(5) * STUDIO.halfWidth;
            const { radius, slope } = studioCoveAt(x);
            const tangentZ = WALL_Z + radius;
            const floorLength = STUDIO.frontZ - tangentZ;
            let z: number, y: number, distance: number;
            const normal = new THREE.Vector3(0, 1, 0);
            if (p.kind === 'floor') {
                z = p.value; y = FLOOR_Y; distance = STUDIO.frontZ - z;
            } else if (p.kind === 'curve') {
                const sine = Math.sin(p.value), cosine = Math.cos(p.value);
                z = tangentZ - radius * sine;
                y = FLOOR_Y + radius * (1 - cosine);
                // Includes the sideways derivative of the smoothly varying radius.
                normal.set(-slope * (cosine + sine - 1), cosine, sine).normalize();
                distance = floorLength + radius * p.value;
            } else {
                z = WALL_Z; y = FLOOR_Y + p.value;
                normal.set(0, 0, 1);
                distance = floorLength + radius * Math.PI / 2 + p.value - radius;
            }
            positions.push(x, y, z); normals.push(normal.x, normal.y, normal.z);
            // Matte plaster-like tonal variation, below 1.3%; no screen grain.
            // Separate charcoal floor, close poster wall and side falloff. Surface
            // colour blends through the cove, without fog or screen overlays.
            const tint = 1 + 0.009 * Math.sin(x * 0.004 + y * 0.002) * Math.cos(x * 0.0013 - y * 0.003)
                + 0.004 * Math.cos(x * 0.0003 - distance * 0.0008);
            const wallTone = atmosphere.clone().lerp(wall, 1 - THREE.MathUtils.smoothstep(Math.abs(x), 1600, 6000));
            // Lift only the distant floor into the atmosphere. Keep the area
            // beneath the desk darker so warm wood and contact shadows read.
            const floorFalloff = THREE.MathUtils.smoothstep(Math.hypot(x, z - 800), 2800, 14000);
            const wallWeight = THREE.MathUtils.smoothstep(normal.z, 0, 1);
            const tone = floor.clone().lerp(atmosphere, floorFalloff).lerp(wallTone, wallWeight).multiplyScalar(tint);
            colors.push(tone.r, tone.g, tone.b);
        }
    }
    for (let row = 0; row < profile.length - 1; row++) {
        for (let column = 0; column < columns - 1; column++) {
            const a = row * columns + column, b = a + 1, c = a + columns, d = c + 1;
            indices.push(a, b, c, b, d, c);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.94, metalness: 0, vertexColors: true,
        // The neutral room environment is shadowless and uniform; on this large
        // matte surface it flattened the whole wall. Keep a little of it so the
        // sage stays airy, and let the key light shape the wall instead.
        envMapIntensity: 0.26,
    });
    const sweep = new THREE.Mesh(geometry, material);
    sweep.name = 'SeamlessStudioSweep';
    sweep.receiveShadow = true;
    // Scenery never intercepts the drawer/laptop interaction raycasters.
    sweep.raycast = () => {};
    return sweep;
}

/** Original 84 x 14 mm matte skirting; its endpoints lie beyond supported views. */
export function createStudioBaseboard() {
    const board = new THREE.Mesh(
        new THREE.BoxGeometry(STUDIO.halfWidth * 2, 84, 14),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(STUDIO.baseboard).convertSRGBToLinear(), roughness: .98, metalness: 0, envMapIntensity: .12 })
    );
    board.name = 'StudioBaseboard';
    board.position.set(0, FLOOR_Y + 42, WALL_Z + 7.3);
    board.receiveShadow = true;
    board.raycast = () => {};
    return board;
}
