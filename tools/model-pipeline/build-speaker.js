#!/usr/bin/env node
/**
 * Builds static/models/Speaker/speaker.glb from the downloaded Sketchfab model.
 *
 * Source: "Speaker Bookshelf V2 - Optimized" by rendysix, CC-BY-4.0
 *   https://sketchfab.com/3d-models/speaker-bookshelf-v2-optimized-cbb87dee55e84a389cbccb4ddc0036e0
 *   Download the glTF version into assets-source/speaker_bookshelf_v2_-_optimized/.
 *
 * Modifications (recorded in the GLB's asset.extras):
 * - dropped unused skinning, tangent and extra UV attributes and KHR_materials_specular
 * - adjusted roughness/metalness for realistic satin wood veneer, rubber surrounds
 *   and aluminium cones
 * - merged meshes per material (baked transforms), quantized positions/normals
 * - re-oriented (front faces +Z), scaled to a 300 mm tall bookshelf speaker in mm,
 *   feet on y = 0
 * - downsampled colour textures 1024² → 512² and normal maps → 256²
 *
 * Usage: node tools/model-pipeline/build-speaker.js [sourceDir] [outFile]
 */
const path = require('path');
const {
    mat4Multiply,
    transformPoint,
    transformDirection,
    determinant3,
    readGltf,
    writeGlb,
} = require('./lib/gltf');
const { decodePng, toRgba, toRgb, downsampleRgba, encodePng } = require('./lib/png');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.resolve(
    process.argv[2] || path.join(ROOT, 'assets-source/speaker_bookshelf_v2_-_optimized')
);
const OUT_FILE = path.resolve(process.argv[3] || path.join(ROOT, 'static/models/Speaker/speaker.glb'));

// Typical two-way bookshelf speaker height; width/depth follow the model (≈189 × 224 mm)
const TARGET_HEIGHT_MM = 300;
// Model's drivers face +X; rotate −90° about Y so the front faces +Z
const ROTATE_Y = -Math.PI / 2;
// Colour textures 1024² → 512²; normal maps (fine surface detail, invisible
// beyond arm's length) 1024² → 256²
const DOWNSAMPLE = { color: 2, normal: 4 };

// Per-material overrides on top of the source values (null = keep source)
const MATERIAL_OVERRIDES = {
    brownwood: { name: 'CabinetVeneer', roughness: 0.55, metallic: 0 },
    darkwood: { name: 'Baffle', roughness: 0.6, metallic: 0 },
    guma: { name: 'RubberSurround', roughness: 0.75, metallic: 0, color: [0.02, 0.02, 0.02] },
    membrane_alu: { name: 'AluminiumCone', roughness: 0.35, metallic: 0.6 },
    black: { name: 'DriverTrim', roughness: 0.3, metallic: 0.5, color: [0.02, 0.02, 0.02] },
    darkgraymetal: { name: 'DriverBasket', roughness: 0.4, metallic: 0.3, color: [0.03, 0.03, 0.03] },
    no_material: { name: 'Port', roughness: 0.9, metallic: 0, color: [0.05, 0.05, 0.05] },
    cinchhl: { name: 'Terminals', roughness: 0.35, metallic: 0.9, color: [0.75, 0.62, 0.35] },
    material: { name: 'TerminalRed', roughness: 0.6, metallic: 0, color: [0.5, 0.02, 0.02] },
};

const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

function build() {
    const src = readGltf(path.join(SOURCE_DIR, 'scene.gltf'));
    const { json } = src;

    // First pass: bounds in model space after rotation, to derive the scale
    const c = Math.cos(ROTATE_Y);
    const s = Math.sin(ROTATE_Y);
    const rotate = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
    const prims = src.primitives();
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const { world, prim } of prims) {
        const m = mat4Multiply(rotate, world);
        for (const p of src.readAccessor(prim.attributes.POSITION)) {
            const q = transformPoint(m, p);
            for (let k = 0; k < 3; k++) {
                if (q[k] < min[k]) min[k] = q[k];
                if (q[k] > max[k]) max[k] = q[k];
            }
        }
    }
    const scale = TARGET_HEIGHT_MM / (max[1] - min[1]);
    const place = [
        scale, 0, 0, 0,
        0, scale, 0, 0,
        0, 0, scale, 0,
        -((min[0] + max[0]) / 2) * scale, -min[1] * scale, -((min[2] + max[2]) / 2) * scale, 1,
    ];
    const orient = mat4Multiply(place, rotate);

    // Merge primitives per material
    const groups = new Map();
    for (const { world, prim } of prims) {
        const m = mat4Multiply(orient, world);
        const key = prim.material;
        const g = groups.get(key) || { positions: [], normals: [], uvs: [], indices: [] };
        groups.set(key, g);
        const base = g.positions.length;
        const positions = src.readAccessor(prim.attributes.POSITION);
        const normals = src.readAccessor(prim.attributes.NORMAL);
        const uvs = src.readAccessor(prim.attributes.TEXCOORD_0);
        const indices = src.readAccessor(prim.indices);
        const mirrored = determinant3(m) < 0;
        positions.forEach((p, i) => {
            g.positions.push(transformPoint(m, p));
            g.normals.push(transformDirection(m, normals[i]));
            g.uvs.push(uvs[i]);
        });
        for (let i = 0; i < indices.length; i += 3) {
            const [a, b, c2] = [indices[i], indices[i + 1], indices[i + 2]];
            g.indices.push(base + a, base + (mirrored ? c2 : b), base + (mirrored ? b : c2));
        }
    }

    // Textures: downsample each used image once
    const images = [];
    const textures = [];
    const textureFor = new Map(); // source texture index → output texture index
    const textureNotes = [];
    const useTexture = (info, isNormal) => {
        if (!info) return undefined;
        if (!textureFor.has(info.index)) {
            const image = src.readImage(json.textures[info.index].source);
            const decoded = toRgba(decodePng(image.data));
            const small = downsampleRgba(decoded, isNormal ? DOWNSAMPLE.normal : DOWNSAMPLE.color);
            const opaque = isNormal || small.data.every((v, i) => i % 4 !== 3 || v === 255);
            const data = encodePng(opaque ? toRgb(small) : small);
            images.push({ name: image.name.replace(/\.png$/, ''), mimeType: 'image/png', data });
            textures.push({ source: images.length - 1, sampler: 0 });
            textureFor.set(info.index, textures.length - 1);
            textureNotes.push(
                `${image.name}: ${decoded.width}² → ${small.width}² (${Math.round(data.length / 1024)} KB)`
            );
        }
        return { index: textureFor.get(info.index) };
    };

    const materialKeys = [...groups.keys()];
    const materials = materialKeys.map((sourceIndex) => {
        const source = json.materials[sourceIndex];
        const override = MATERIAL_OVERRIDES[source.name];
        if (!override) throw new Error(`Unmapped source material "${source.name}"`);
        const pbr = source.pbrMetallicRoughness || {};
        const material = {
            name: override.name,
            pbrMetallicRoughness: {
                baseColorFactor: override.color ? [...override.color, 1] : pbr.baseColorFactor || [1, 1, 1, 1],
                metallicFactor: override.metallic,
                roughnessFactor: override.roughness,
            },
            doubleSided: true,
        };
        const baseColor = useTexture(pbr.baseColorTexture, false);
        if (baseColor) material.pbrMetallicRoughness.baseColorTexture = baseColor;
        const normal = useTexture(source.normalTexture, true);
        if (normal) material.normalTexture = normal;
        return material;
    });

    const meshes = materialKeys.map((key, i) => {
        const g = groups.get(key);
        const textured = materials[i].normalTexture || materials[i].pbrMetallicRoughness.baseColorTexture;
        return {
            name: materials[i].name,
            material: i,
            positions: g.positions,
            normals: g.normals,
            uvs: textured ? g.uvs : null,
            indices: g.indices,
        };
    });

    const sourceAsset = json.asset.extras || {};
    const { size } = writeGlb(OUT_FILE, {
        asset: {
            version: '2.0',
            generator: 'surya-portfolio tools/model-pipeline/build-speaker.js',
            copyright: `${sourceAsset.author || 'rendysix'} (CC-BY-4.0); modified`,
            extras: {
                title: sourceAsset.title || 'Speaker Bookshelf V2 - Optimized',
                author: sourceAsset.author,
                source: sourceAsset.source,
                license: sourceAsset.license,
                modifications:
                    'Adjusted materials; merged meshes; dropped unused attributes; ' +
                    're-oriented and scaled to millimetres; downsampled textures.',
            },
        },
        materials,
        images,
        samplers: json.samplers,
        textures,
        meshes,
        rootName: 'Speaker',
        quantize: 50,
    });

    const finalMin = [Infinity, Infinity, Infinity];
    const finalMax = [-Infinity, -Infinity, -Infinity];
    for (const m of meshes)
        for (const p of m.positions)
            for (let k = 0; k < 3; k++) {
                finalMin[k] = Math.min(finalMin[k], p[k]);
                finalMax[k] = Math.max(finalMax[k], p[k]);
            }
    console.log(
        JSON.stringify(
            {
                output: path.relative(ROOT, OUT_FILE),
                sizeKB: Math.round(size / 1024),
                triangles: meshes.reduce((n, m) => n + m.indices.length / 3, 0),
                vertices: meshes.reduce((n, m) => n + m.positions.length, 0),
                meshes: meshes.length,
                scale: round(scale, 2),
                sizeMm: {
                    width: round(finalMax[0] - finalMin[0], 1),
                    height: round(finalMax[1] - finalMin[1], 1),
                    depth: round(finalMax[2] - finalMin[2], 1),
                },
                frontZ: round(finalMax[2], 1),
                textures: textureNotes,
            },
            null,
            2
        )
    );
}

build();
