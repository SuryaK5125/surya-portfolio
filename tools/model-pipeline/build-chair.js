#!/usr/bin/env node
/**
 * Builds static/models/Props/chair.glb from the downloaded Sketchfab model.
 *
 * Source: "Office Chair Modern" by thethieme, CC-BY-4.0
 *   https://sketchfab.com/3d-models/office-chair-modern-675f34f7304e4d92812a41e9750539aa
 *   glTF download in assets-source/office_chair_modern/ (licence kept there).
 *
 * The source is already light (one mesh, one material, 1,234 triangles), so
 * the geometry is kept as is. Modifications (recorded in asset.extras):
 * - node transforms baked; converted from metres to millimetres at true size
 * - re-oriented so the backrest faces +Z (the seat faces the desk at -Z),
 *   centred on the column, casters on y = 0
 * - dropped the unused TANGENT attribute (three.js derives tangent space)
 * - textures 2048 px → colour 1024 px JPEG, metallic/roughness 512 px JPEG,
 *   normal 512 px PNG (tools/model-pipeline/chair-textures.py)
 *
 * Usage: node tools/model-pipeline/build-chair.js [sourceDir] [outFile]
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { mat4Multiply, transformPoint, transformDirection, determinant3, readGltf, writeGlb } = require('./lib/gltf');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.resolve(process.argv[2] || path.join(ROOT, 'assets-source/office_chair_modern'));
const OUT_FILE = path.resolve(process.argv[3] || path.join(ROOT, 'static/models/Props/chair.glb'));
const TEX_DIR = path.join(SOURCE_DIR, 'build');

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

function bounds(points) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const p of points)
        for (let k = 0; k < 3; k++) {
            if (p[k] < min[k]) min[k] = p[k];
            if (p[k] > max[k]) max[k] = p[k];
        }
    return { min, max };
}

function build() {
    const src = readGltf(path.join(SOURCE_DIR, 'scene.gltf'));
    const { json } = src;
    const prims = src.primitives();
    if (prims.length !== 1) throw new Error(`expected one primitive, found ${prims.length}`);
    const { world, prim } = prims[0];

    // Metres (after the source node transforms) → millimetres
    const toMm = [1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 1];
    let m = mat4Multiply(toMm, world);
    const raw = src.readAccessor(prim.attributes.POSITION).map((p) => transformPoint(m, p));
    const b = bounds(raw);

    // Which side is the backrest? Average z of the top quarter of the chair.
    const height = b.max[1] - b.min[1];
    const top = raw.filter((p) => p[1] > b.max[1] - height * 0.25);
    const centreZ = (b.min[2] + b.max[2]) / 2;
    const backZ = top.reduce((s, p) => s + p[2], 0) / top.length;
    const flip = backZ < centreZ; // backrest must end up on +Z
    const rot = flip ? [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1] : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    m = mat4Multiply(rot, m);

    // Centre on the column (the base's footprint), casters on y = 0
    const turned = src.readAccessor(prim.attributes.POSITION).map((p) => transformPoint(m, p));
    const base = turned.filter((p) => p[1] < b.min[1] + height * 0.12);
    const bb = bounds(base);
    const all = bounds(turned);
    const place = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
        -(bb.min[0] + bb.max[0]) / 2, -all.min[1], -(bb.min[2] + bb.max[2]) / 2, 1];
    m = mat4Multiply(place, m);

    const positions = src.readAccessor(prim.attributes.POSITION).map((p) => transformPoint(m, p));
    const normals = src.readAccessor(prim.attributes.NORMAL).map((n) => transformDirection(m, n));
    const uvs = src.readAccessor(prim.attributes.TEXCOORD_0);
    const indices = Array.from(src.readAccessor(prim.indices));
    if (determinant3(m) < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];

    // Textures
    const report = JSON.parse(execFileSync('python', [path.join(__dirname, 'chair-textures.py'), path.join(SOURCE_DIR, 'textures'), TEX_DIR]).toString());
    const image = (file, mimeType, name) => ({ name, mimeType, data: fs.readFileSync(path.join(TEX_DIR, file)) });
    const images = [
        image('baseColor.jpg', 'image/jpeg', 'OfficeChair_baseColor'),
        image('metallicRoughness.jpg', 'image/jpeg', 'OfficeChair_metallicRoughness'),
        image('normal.png', 'image/png', 'OfficeChair_normal'),
    ];
    const textures = images.map((_, i) => ({ source: i, sampler: 0 }));
    const source = json.materials[prim.material];
    const materials = [{
        name: 'OfficeChair',
        pbrMetallicRoughness: {
            baseColorTexture: { index: 0 },
            metallicRoughnessTexture: { index: 1 },
            metallicFactor: 1,
            roughnessFactor: 1,
        },
        normalTexture: { index: 2 },
        doubleSided: !!source.doubleSided,
    }];

    const sourceAsset = json.asset.extras || {};
    const { size } = writeGlb(OUT_FILE, {
        asset: {
            version: '2.0',
            generator: 'surya-portfolio tools/model-pipeline/build-chair.js',
            copyright: `${sourceAsset.author || 'thethieme'} (CC-BY-4.0); modified`,
            extras: {
                title: sourceAsset.title || 'Office Chair Modern',
                author: sourceAsset.author,
                source: sourceAsset.source,
                license: sourceAsset.license,
                modifications: 'Transforms baked; millimetres at true size; re-oriented and grounded; ' +
                    'tangents dropped; textures downsampled and re-encoded.',
            },
        },
        materials,
        images,
        samplers: json.samplers || [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
        textures,
        meshes: [{ name: 'OfficeChair', material: 0, positions, normals, uvs, indices }],
        rootName: 'OfficeChair',
        quantize: 20, // 0.05 mm steps; the chair is ~960 mm tall (int16 range)
    });

    const fb = bounds(positions);
    console.log(JSON.stringify({
        output: path.relative(ROOT, OUT_FILE),
        sizeKB: Math.round(size / 1024),
        triangles: indices.length / 3,
        flippedToFaceDesk: flip,
        sizeMm: { width: round(fb.max[0] - fb.min[0]), height: round(fb.max[1] - fb.min[1]), depth: round(fb.max[2] - fb.min[2]) },
        boundsMm: { min: fb.min.map((v) => round(v)), max: fb.max.map((v) => round(v)) },
        textures: report,
    }, null, 2));
}

build();
