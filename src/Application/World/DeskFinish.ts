import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createWalnut } from '../Utils/SurfaceTextures';
import { HENRY_DESK } from './SceneLayout';

/**
 * Finish for the existing desk. The baked desk model, its drawer and its
 * interaction logic are untouched; this adds a lit walnut-veneer top with a
 * softly rounded edge, a thin brass inlay, walnut drawer fronts and satin
 * brass handles, and warms the baked metal frame. Everything is procedural.
 */

/** One texture tile covers about this much of the desk, in millimetres. */
const TILE_U = 1000;
const TILE_V = 500;

export type DeskMaterials = {
    /** Veneer for surfaces with normals (the tabletop slab). */
    wood: THREE.MeshPhysicalMaterial;
    /** Same veneer for the normal-less source drawer faces (flat shaded). */
    woodFlat: THREE.MeshPhysicalMaterial;
    brass: THREE.MeshStandardMaterial;
    /** Brass for the normal-less source handles (flat shaded). */
    brassFlat: THREE.MeshStandardMaterial;
};

let cached: DeskMaterials | null = null;

export function deskMaterials(): DeskMaterials {
    if (cached) return cached;
    const walnut = createWalnut();
    const common = {
        map: walnut.map,
        bumpMap: walnut.bump,
        bumpScale: 0.6,
        roughnessMap: walnut.roughness,
        // Scales the map (~0.46) to a softer satin, so the key and screen light
        // spread across the grain instead of forming a bright hotspot.
        roughness: 1.18,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.34,
        envMapIntensity: 0.7,
    };
    const brass = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xb59a62).convertSRGBToLinear(),
        metalness: 0.9,
        roughness: 0.34,
        envMapIntensity: 1,
    });
    const brassFlat = brass.clone();
    brassFlat.flatShading = true;
    cached = {
        wood: new THREE.MeshPhysicalMaterial(common),
        woodFlat: new THREE.MeshPhysicalMaterial({ ...common, flatShading: true }),
        brass,
        brassFlat,
    };
    return cached;
}

/**
 * Planar texture coordinates in millimetres: grain runs along x. Top and
 * bottom faces map (x, z), front and back (x, y), end faces (z, y).
 */
export function planarUV(geometry: THREE.BufferGeometry, mmPerUnit = 1) {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i) * mmPerUnit;
        const y = position.getY(i) * mmPerUnit;
        const z = position.getZ(i) * mmPerUnit;
        let u = x / TILE_U;
        let v = y / TILE_V;
        if (normal) {
            const nx = Math.abs(normal.getX(i));
            const ny = Math.abs(normal.getY(i));
            const nz = Math.abs(normal.getZ(i));
            if (ny >= nx && ny >= nz) v = z / TILE_V;
            else if (nx > nz) {
                u = z / TILE_U;
            }
        }
        uv[i * 2] = u;
        uv[i * 2 + 1] = v;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/**
 * Colour grade for the baked (unlit) desk material: a touch deeper and
 * warmer, so the cool grey metal frame reads as warm graphite beside the
 * walnut. Affects only this material.
 */
export function gradeBakedMaterial(material: THREE.MeshBasicMaterial) {
    material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#include <map_fragment>
            {
                vec3 c = pow(diffuseColor.rgb, vec3(1.14));
                float l = dot(c, vec3(0.299, 0.587, 0.114));
                c = mix(vec3(l), c, 1.08) * vec3(1.05, 0.99, 0.93);
                diffuseColor.rgb = c;
            }`
        );
    };
    material.needsUpdate = true;
}

/** The lit tabletop: walnut slab with a rounded edge, plus a brass inlay line. */
export default function createDeskFinish() {
    const { wood, brass } = deskMaterials();
    const group = new THREE.Group();
    group.name = 'DeskFinish';
    const { minX, maxX, minZ, maxZ } = HENRY_DESK.top;
    // The baked top is at y = 0 and 36.4 mm thick; the slab is a hair larger
    // and proud so the two never z-fight.
    const proud = 0.6;
    const width = maxX - minX + proud * 2;
    const depth = maxZ - minZ + proud * 2;
    const topY = 0.3;
    const thickness = 36.4 + topY + 0.2;
    const slabGeometry = new RoundedBoxGeometry(width, thickness, depth, 4, 3.5);
    planarUV(slabGeometry);
    const slab = new THREE.Mesh(slabGeometry, wood);
    slab.name = 'DeskTopWalnut';
    slab.position.set((minX + maxX) / 2, topY - thickness / 2, (minZ + maxZ) / 2);
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);

    // Satin brass inlay 14 mm in from the front edge
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(width - 40, 0.5, 1.4), brass);
    inlay.name = 'DeskBrassInlay';
    inlay.position.set((minX + maxX) / 2, topY + 0.15, maxZ - 14);
    inlay.receiveShadow = true;
    group.add(inlay);
    return group;
}
