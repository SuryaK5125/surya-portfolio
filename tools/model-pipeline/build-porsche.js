#!/usr/bin/env node
/**
 * Packages static/models/Porsche/porsche.glb from the Blender pass.
 *
 * Source: "LEGO 10295 Porsche 911 (Turbo)" by Sleepy Sea Otter, CC-BY-4.0
 *   https://sketchfab.com/3d-models/lego-10295-porsche-911-turbo-73d0cef548c04c3f9b6cef9871ea8d52
 *
 * Step 1 (geometry, Blender): tools/model-pipeline/blender/optimize_porsche.py
 *   writes assets-source/lego-porsche/build/porsche-blender.glb and
 *   optimize-report.json (stage counts and the source colour table).
 * Step 2 (this script, Node built-ins only):
 * - rebuilds the materials from the source colours: Studio stores LEGO's sRGB
 *   colour values in glTF's linear baseColorFactor, so they are linearised
 *   here; roughness/metalness are set per finish (solid, trans, pearl, rubber)
 * - keeps printed decorations as separate "<colour>.print" materials so the
 *   site can depth-offset them against the surface they sit on
 * - quantizes positions to int16 at 0.01 mm and normals to int8
 *   (KHR_mesh_quantization)
 * - embeds the CC BY credit and the list of modifications in asset metadata
 *
 * Usage: node tools/model-pipeline/build-porsche.js [buildDir] [outFile] [--max-triangles N]
 */
const fs = require('fs');
const path = require('path');
const { mat4Multiply, transformPoint, transformDirection, readGltf, writeGlb } = require('./lib/gltf');

const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').startsWith('--'));
const flag = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const BUILD_DIR = path.resolve(args[0] || path.join(ROOT, 'assets-source/lego-porsche/build'));
const OUT_FILE = path.resolve(args[1] || path.join(ROOT, 'static/models/Porsche/porsche.glb'));
const MAX_TRIANGLES = flag('max-triangles', 110000); // shipped budget is 100k
const QUANTIZE = 100; // int16 positions at 0.01 mm

const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** PBR finish by LEGO colour family (the source uses roughness 0.66 for everything). */
function finish(name) {
    if (name.startsWith('TRANS-')) return { roughness: 0.08, metallic: 0 };
    if (name.startsWith('RUBBER-')) return { roughness: 0.85, metallic: 0 };
    if (name.startsWith('PEARL-') || name.startsWith('METAL-')) return { roughness: 0.35, metallic: 0.7 };
    return { roughness: 0.32, metallic: 0 }; // moulded ABS
}

function build() {
    const glbFile = path.join(BUILD_DIR, 'porsche-blender.glb');
    const reportFile = path.join(BUILD_DIR, 'optimize-report.json');
    for (const f of [glbFile, reportFile]) {
        if (!fs.existsSync(f)) {
            throw new Error(`${f} not found. Run the Blender step first (see tools/model-pipeline/README.md).`);
        }
    }
    const blender = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    const { json, readAccessor, primitives } = readGltf(glbFile);

    const groups = new Map();
    for (const { world, prim, node } of primitives()) {
        const matName = json.materials[prim.material].name;
        const colourName = matName.replace(/\.print$/, '');
        const colour = blender.materials[colourName];
        if (!colour) throw new Error(`Material "${matName}" (${node}) is not in the source colour table`);
        if (!groups.has(matName)) groups.set(matName, { colour, positions: [], normals: [], indices: [] });
        const g = groups.get(matName);
        const base = g.positions.length;
        const pos = readAccessor(prim.attributes.POSITION);
        const nrm = readAccessor(prim.attributes.NORMAL);
        pos.forEach((p) => g.positions.push(transformPoint(world, p)));
        nrm.forEach((n) => g.normals.push(transformDirection(world, n)));
        readAccessor(prim.indices).forEach((i) => g.indices.push(base + i));
    }

    const names = [...groups.keys()].sort();
    const materials = names.map((name) => {
        const { colour } = groups.get(name);
        const [r, g, b, a] = colour.source_color;
        const m = {
            name,
            pbrMetallicRoughness: {
                baseColorFactor: [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b), a].map((v) => round(v, 5)),
                metallicFactor: finish(name).metallic,
                roughnessFactor: finish(name).roughness,
            },
        };
        if (colour.blend) m.alphaMode = 'BLEND';
        if (name.endsWith('.print')) m.extras = { print: true };
        return m;
    });
    const meshes = names.map((name, i) => ({ name, material: i, ...groups.get(name) }));

    const triangles = meshes.reduce((n, m) => n + m.indices.length / 3, 0);
    const vertices = meshes.reduce((n, m) => n + m.positions.length, 0);
    if (triangles > MAX_TRIANGLES) throw new Error(`${triangles} triangles exceeds the budget of ${MAX_TRIANGLES}`);

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    meshes.forEach((m) => m.positions.forEach((p) => p.forEach((v, k) => {
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
    })));
    if (Math.abs(min[1]) > 0.05) throw new Error(`Model base is at y = ${min[1]}, expected 0`);

    const src = blender.source || {};
    const stages = Object.fromEntries(blender.stages.map((s) => [s.stage, s]));
    const credit =
        `This work is based on "${src.title}" (${src.source}) by ${src.author} ` +
        `licensed under ${src.license}`;
    const fmt = (n) => Number(n).toLocaleString('en-GB');
    const modifications = [
        `Removed the embossed LEGO logo from every stud (${fmt(stages.load.logo_meshes)} meshes).`,
        `Removed ${fmt(stages.visibility.parts_removed)} parts and all faces not visible from above ` +
            'the desk: interior Technic chassis and gearbox, brick interiors, anti-stud tubes and covered studs.',
        'Merged duplicate colour materials and all parts into one mesh per colour.',
        `Simplified the ${fmt(stages.visibility.tris_after)} visible triangles to ${fmt(triangles)} ` +
            '(coplanar dissolve, then edge-collapse decimation).',
        'Re-oriented (Y-up, nose +X) and scaled to millimetres (1 LDU = 0.4 mm), base on y = 0.',
        'Converted colours from sRGB to linear and set roughness/metalness per LEGO finish.',
    ];

    const { size } = writeGlb(OUT_FILE, {
        asset: {
            version: '2.0',
            generator: 'surya-portfolio tools/model-pipeline (optimize_porsche.py + build-porsche.js)',
            copyright: `${src.author || 'Sleepy Sea Otter'} (CC-BY-4.0); modified`,
            extras: {
                title: src.title,
                author: src.author,
                source: src.source,
                license: src.license,
                credit,
                modifications,
            },
        },
        materials,
        images: [],
        meshes,
        rootName: 'LEGO_Porsche_911',
        quantize: QUANTIZE,
    });

    const report = {
        output: path.relative(ROOT, OUT_FILE),
        sizeKB: Math.round(size / 1024),
        sourceTriangles: stages.load && stages.load.source_tris,
        afterLogoRemoval: stages.load && stages.load.tris_after_logos,
        afterVisibility: stages.visibility && stages.visibility.tris_after,
        triangles,
        vertices,
        meshes: meshes.length,
        printMaterials: names.filter((n) => n.endsWith('.print')),
        boundsMm: {
            length: round(max[0] - min[0], 1),
            height: round(max[1] - min[1], 1),
            width: round(max[2] - min[2], 1),
        },
    };
    console.log(JSON.stringify(report, null, 2));
}

build();
