#!/usr/bin/env node
/**
 * Builds static/models/Laptop/laptop.glb from the downloaded Sketchfab model.
 *
 * Source: "Laptop Dell Latitude 5400" by Yolala1232, CC-BY-4.0
 *   https://sketchfab.com/3d-models/laptop-dell-latitude-5400-c3dfc53a600e427c9db9be83aec9860d
 *   Download the glTF version into assets-source/dell-latitude-5400/.
 *
 * Modifications made here (recorded in the GLB's asset.extras):
 * - removed the ground plane, the CPU-brand sticker and the screen wallpaper image
 * - converted KHR_materials_pbrSpecularGlossiness to metallic-roughness,
 *   consolidated 30 materials into 13, and made key legends printed rather than emissive
 * - merged 329 meshes into one mesh per material (baked transforms)
 * - re-oriented to Y-up / screen facing +Z, scaled to millimetres, base on y = 0
 * - downsampled the lid logo texture 2048 → 256
 * - replaced the display quad with a "Screen" node: an exact rectangle (frame
 *   in the node transform, size in extras) used to place the live desktop
 *
 * Usage: node tools/model-pipeline/build-laptop.js [sourceDir] [outFile]
 */
const fs = require('fs');
const path = require('path');
const {
    IDENTITY,
    mat4Multiply,
    transformPoint,
    transformDirection,
    determinant3,
    readGltf,
    writeGlb,
} = require('./lib/gltf');
const { decodePng, toRgba, downsampleRgba, encodePng } = require('./lib/png');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.resolve(process.argv[2] || path.join(ROOT, 'assets-source/dell-latitude-5400'));
const OUT_FILE = path.resolve(process.argv[3] || path.join(ROOT, 'static/models/Laptop/laptop.glb'));

// Real Latitude 5400 chassis width is 321.6 mm; the model's base is 2.9224 units wide.
const MM_PER_UNIT = 110;
// Model faces −X; rotate +90° about Y so the screen faces +Z (towards the camera).
const ROTATE_Y = Math.PI / 2;

const EXCLUDE = {
    'Material.023': 'ground plane',
    '8th_gen_core_i5_logo': 'CPU-brand sticker (trademark, 2048² texture)',
};
const SCREEN_MATERIAL = 'Material.026';

// Consolidated metallic-roughness materials. Colours are linear (glTF convention).
const MATERIALS = {
    Chassis: { from: ['Material'], color: [0.042, 0.042, 0.042], roughness: 0.45 },
    LidShell: { from: ['Material.006'], color: [0.05, 0.05, 0.05], roughness: 0.5 },
    Bezel: { from: ['Material.010'], color: [0.012, 0.012, 0.012], roughness: 0.55 },
    Keycaps: { from: ['Material.012'], color: [0.014, 0.014, 0.014], roughness: 0.47 },
    BlackPlastic: {
        from: ['Material.002', 'Material.004', 'Material.005', 'Material.009', 'Material.011', 'Material.025'],
        color: [0.012, 0.012, 0.012],
        roughness: 0.5,
    },
    Legends: {
        from: [
            'Material.007', 'Material.013', 'Material.014', 'Material.015',
            'Material.016', 'Material.017', 'Material.019', 'Material.021',
        ],
        color: [0.55, 0.55, 0.55],
        roughness: 0.6,
    },
    GreyTrim: { from: ['material_0', 'Material.003'], color: [0.25, 0.25, 0.25], roughness: 0.55 },
    DarkTrim: { from: ['Material.020', 'Material.022'], color: [0.14, 0.14, 0.14], roughness: 0.5 },
    LightTrim: { from: ['Material.018'], color: [0.48, 0.48, 0.48], roughness: 0.5 },
    PortMetal: { from: ['Material.008'], color: [0.6, 0.6, 0.6], roughness: 0.45, metallic: 1 },
    PortBlue: { from: ['Material.027'], color: [0.0, 0.068, 0.8], roughness: 0.5 },
    LogoLid: {
        from: ['dell_logo2edited'],
        color: [1, 1, 1],
        roughness: 0.4,
        texture: { downsample: 8 },
        alphaMode: 'BLEND',
    },
    LogoBezel: {
        from: ['delllogo3'],
        color: [1, 1, 1],
        roughness: 0.5,
        texture: {},
        alphaMode: 'MASK',
        alphaCutoff: 0.5,
    },
};

// ------------------------------------------------------------------ helpers

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a) => scale(a, 1 / length(a));
const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

/** Quaternion [x, y, z, w] from orthonormal basis columns. */
function quaternionFromBasis(xAxis, yAxis, zAxis) {
    const [m00, m10, m20] = xAxis;
    const [m01, m11, m21] = yAxis;
    const [m02, m12, m22] = zAxis;
    const trace = m00 + m11 + m22;
    let x, y, z, w;
    if (trace > 0) {
        const s = 0.5 / Math.sqrt(trace + 1);
        w = 0.25 / s;
        x = (m21 - m12) * s;
        y = (m02 - m20) * s;
        z = (m10 - m01) * s;
    } else if (m00 > m11 && m00 > m22) {
        const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
        w = (m21 - m12) / s;
        x = 0.25 * s;
        y = (m01 + m10) / s;
        z = (m02 + m20) / s;
    } else if (m11 > m22) {
        const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
        w = (m02 - m20) / s;
        x = (m01 + m10) / s;
        y = 0.25 * s;
        z = (m12 + m21) / s;
    } else {
        const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
        w = (m10 - m01) / s;
        x = (m02 + m20) / s;
        y = (m12 + m21) / s;
        z = 0.25 * s;
    }
    return [x, y, z, w];
}

// ------------------------------------------------------------------ build

function build() {
    const src = readGltf(path.join(SOURCE_DIR, 'scene.gltf'));
    const { json } = src;

    const groupOf = {};
    for (const [key, def] of Object.entries(MATERIALS)) for (const name of def.from) groupOf[name] = key;

    // Orientation + unit scale (translation is added once the bounds are known)
    const c = Math.cos(ROTATE_Y);
    const s = Math.sin(ROTATE_Y);
    const orient = [
        c * MM_PER_UNIT, 0, -s * MM_PER_UNIT, 0,
        0, MM_PER_UNIT, 0, 0,
        s * MM_PER_UNIT, 0, c * MM_PER_UNIT, 0,
        0, 0, 0, 1,
    ];

    const groups = {};
    const screenCorners = [];
    const skipped = {};
    let sourceTriangles = 0;

    for (const { node, world, prim } of src.primitives()) {
        const material = json.materials[prim.material];
        const name = material ? material.name : '(none)';
        const indices = src.readAccessor(prim.indices);
        sourceTriangles += indices.length / 3;
        const m = mat4Multiply(orient, world);

        if (name === SCREEN_MATERIAL) {
            for (const p of src.readAccessor(prim.attributes.POSITION)) screenCorners.push(transformPoint(m, p));
            continue;
        }
        if (EXCLUDE[name]) {
            skipped[name] = (skipped[name] || 0) + indices.length / 3;
            continue;
        }
        const key = groupOf[name];
        if (!key) throw new Error(`Unmapped source material "${name}" (${node})`);

        const group = (groups[key] = groups[key] || { positions: [], normals: [], uvs: [], indices: [] });
        const base = group.positions.length;
        const positions = src.readAccessor(prim.attributes.POSITION);
        const normals = src.readAccessor(prim.attributes.NORMAL);
        const uvs = prim.attributes.TEXCOORD_0 != null ? src.readAccessor(prim.attributes.TEXCOORD_0) : null;
        const mirrored = determinant3(m) < 0;

        positions.forEach((p, i) => {
            group.positions.push(transformPoint(m, p));
            group.normals.push(transformDirection(m, normals[i]));
            group.uvs.push(uvs ? uvs[i] : [0, 0]);
        });
        for (let i = 0; i < indices.length; i += 3) {
            const [a, b, c2] = [indices[i], indices[i + 1], indices[i + 2]];
            group.indices.push(base + a, base + (mirrored ? c2 : b), base + (mirrored ? b : c2));
        }
    }

    if (screenCorners.length !== 4) throw new Error(`Expected a 4-vertex screen quad, got ${screenCorners.length}`);

    // Place the laptop: footprint centred on the origin, base resting on y = 0
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const g of Object.values(groups))
        for (const p of g.positions)
            for (let k = 0; k < 3; k++) {
                if (p[k] < min[k]) min[k] = p[k];
                if (p[k] > max[k]) max[k] = p[k];
            }
    const offset = [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2];
    for (const g of Object.values(groups)) g.positions = g.positions.map((p) => add(p, offset));
    const corners = screenCorners.map((p) => add(p, offset));

    // Fit an exact rectangle to the (slightly skewed) display quad
    const byX = [...corners].sort((a, b) => a[0] - b[0]);
    const left = byX.slice(0, 2).sort((a, b) => a[1] - b[1]); // [bottom, top]
    const right = byX.slice(2).sort((a, b) => a[1] - b[1]);
    const mid = (a, b) => scale(add(a, b), 0.5);
    const leftMid = mid(left[0], left[1]);
    const rightMid = mid(right[0], right[1]);
    const bottomMid = mid(left[0], right[0]);
    const topMid = mid(left[1], right[1]);
    const center = scale(corners.reduce(add, [0, 0, 0]), 0.25);
    const xAxis = normalize(sub(rightMid, leftMid));
    let yAxis = sub(topMid, bottomMid);
    yAxis = normalize(sub(yAxis, scale(xAxis, dot(yAxis, xAxis))));
    const zAxis = normalize(cross(xAxis, yAxis));
    const screenWidth = length(sub(rightMid, leftMid));
    const screenHeight = length(sub(topMid, bottomMid));
    const fitError = Math.max(
        ...corners.map((p) => {
            const d = sub(p, center);
            const lx = Math.abs(dot(d, xAxis)) - screenWidth / 2;
            const ly = Math.abs(dot(d, yAxis)) - screenHeight / 2;
            return Math.max(Math.abs(lx), Math.abs(ly), Math.abs(dot(d, zAxis)));
        })
    );
    if (zAxis[2] <= 0) throw new Error('Screen normal does not face +Z');

    // Images and textures
    const images = [];
    const textures = [];
    const imageFor = (sourceMaterialName, options) => {
        const material = json.materials.find((m) => m.name === sourceMaterialName);
        const sg = material.extensions && material.extensions.KHR_materials_pbrSpecularGlossiness;
        const texInfo = (sg && sg.diffuseTexture) || (material.pbrMetallicRoughness || {}).baseColorTexture;
        const texture = json.textures[texInfo.index];
        const image = src.readImage(texture.source);
        let data = image.data;
        let note = `${image.name} (original)`;
        if (options.downsample && image.mimeType === 'image/png') {
            const decoded = decodePng(data);
            const small = downsampleRgba(toRgba(decoded), options.downsample);
            data = encodePng(small);
            note = `${image.name} ${decoded.width}² → ${small.width}²`;
        }
        images.push({ name: sourceMaterialName, mimeType: image.mimeType, data });
        textures.push({ source: images.length - 1, sampler: 0 });
        return { index: textures.length - 1, note };
    };

    const materialKeys = Object.keys(groups);
    const textureNotes = [];
    const materials = materialKeys.map((key) => {
        const def = MATERIALS[key];
        const material = {
            name: key,
            pbrMetallicRoughness: {
                baseColorFactor: [...def.color, 1],
                metallicFactor: def.metallic || 0,
                roughnessFactor: def.roughness,
            },
            doubleSided: true,
        };
        if (def.texture) {
            const t = imageFor(def.from[0], def.texture);
            material.pbrMetallicRoughness.baseColorTexture = { index: t.index };
            textureNotes.push(`${key}: ${t.note}`);
        }
        if (def.alphaMode) material.alphaMode = def.alphaMode;
        if (def.alphaCutoff != null) material.alphaCutoff = def.alphaCutoff;
        return material;
    });

    const meshes = materialKeys.map((key, i) => {
        const g = groups[key];
        return {
            name: key,
            material: i,
            positions: g.positions,
            normals: g.normals,
            uvs: MATERIALS[key].texture ? g.uvs : null,
            indices: g.indices,
        };
    });

    const screenNode = {
        name: 'Screen',
        translation: center.map((v) => round(v, 5)),
        rotation: quaternionFromBasis(xAxis, yAxis, zAxis).map((v) => round(v, 7)),
        extras: {
            screen: {
                width: round(screenWidth, 4),
                height: round(screenHeight, 4),
                units: 'mm',
                note: 'Display active area. Local +X right, +Y up, +Z out of the screen.',
            },
        },
    };

    const sourceAsset = json.asset.extras || {};
    const { size } = writeGlb(OUT_FILE, {
        asset: {
            version: '2.0',
            generator: 'surya-portfolio tools/model-pipeline/build-laptop.js',
            copyright: `${sourceAsset.author || 'Yolala1232'} (CC-BY-4.0); modified`,
            extras: {
                title: sourceAsset.title || 'Laptop Dell Latitude 5400',
                author: sourceAsset.author,
                source: sourceAsset.source,
                license: sourceAsset.license,
                modifications:
                    'Removed ground plane, CPU sticker and screen image; converted and consolidated materials; ' +
                    'merged meshes; re-oriented and scaled to millimetres; downsampled lid logo; ' +
                    'replaced display quad with a Screen reference node.',
            },
        },
        materials,
        images,
        samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
        textures,
        meshes,
        nodes: [screenNode],
        rootName: 'Laptop',
        // int16 positions at 0.02 mm precision (KHR_mesh_quantization)
        quantize: 50,
    });

    const triangles = meshes.reduce((n, m) => n + m.indices.length / 3, 0);
    const vertices = meshes.reduce((n, m) => n + m.positions.length, 0);
    const report = {
        output: path.relative(ROOT, OUT_FILE),
        sizeKB: Math.round(size / 1024),
        sourceTriangles,
        triangles,
        vertices,
        meshes: meshes.length,
        skippedTriangles: skipped,
        boundsMm: {
            width: round(max[0] - min[0], 1),
            height: round(max[1] - min[1], 1),
            depth: round(max[2] - min[2], 1),
        },
        screen: {
            widthMm: round(screenWidth, 2),
            heightMm: round(screenHeight, 2),
            aspect: round(screenWidth / screenHeight, 4),
            center: center.map((v) => round(v, 2)),
            normal: zAxis.map((v) => round(v, 4)),
            tiltDeg: round((Math.acos(yAxis[1]) * 180) / Math.PI, 2),
            rectangleFitErrorMm: round(fitError, 3),
        },
        textures: textureNotes,
    };
    console.log(JSON.stringify(report, null, 2));
}

build();
