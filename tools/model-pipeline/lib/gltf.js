/**
 * Minimal glTF 2.0 reader/writer for the model pipeline (Node built-ins only).
 * Supports what our source models use: triangle lists, float/int attributes,
 * indexed geometry, external or embedded buffers, PNG/JPEG images.
 */
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- math

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Column-major 4×4 multiply (a × b). */
function mat4Multiply(a, b) {
    const r = new Array(16).fill(0);
    for (let i = 0; i < 4; i++)
        for (let k = 0; k < 4; k++)
            for (let l = 0; l < 4; l++) r[i + 4 * k] += a[i + 4 * l] * b[l + 4 * k];
    return r;
}

function nodeMatrix(node) {
    if (node.matrix) return node.matrix;
    const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
    const [sx, sy, sz] = node.scale || [1, 1, 1];
    const [tx, ty, tz] = node.translation || [0, 0, 0];
    return [
        (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
        2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
        2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
        tx, ty, tz, 1,
    ];
}

const transformPoint = (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

/** Normal transform for rotation + uniform scale (no shear), renormalised. */
const transformDirection = (m, d) => {
    const v = [
        m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
        m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
        m[2] * d[0] + m[6] * d[1] + m[10] * d[2],
    ];
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
};

const determinant3 = (m) =>
    m[0] * (m[5] * m[10] - m[9] * m[6]) -
    m[4] * (m[1] * m[10] - m[9] * m[2]) +
    m[8] * (m[1] * m[6] - m[5] * m[2]);

// ---------------------------------------------------------------- reading

const COMPONENT = {
    5120: { size: 1, read: (b, o) => b.readInt8(o), norm: 127 },
    5121: { size: 1, read: (b, o) => b.readUInt8(o), norm: 255 },
    5122: { size: 2, read: (b, o) => b.readInt16LE(o), norm: 32767 },
    5123: { size: 2, read: (b, o) => b.readUInt16LE(o), norm: 65535 },
    5125: { size: 4, read: (b, o) => b.readUInt32LE(o) },
    5126: { size: 4, read: (b, o) => b.readFloatLE(o) },
};
const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readGltf(file) {
    const raw = fs.readFileSync(file);
    let json;
    let glbBin = null;
    if (raw.readUInt32LE(0) === 0x46546c67) {
        const jsonLength = raw.readUInt32LE(12);
        json = JSON.parse(raw.slice(20, 20 + jsonLength).toString('utf8'));
        const binStart = 20 + jsonLength;
        if (binStart < raw.length) {
            glbBin = raw.slice(binStart + 8, binStart + 8 + raw.readUInt32LE(binStart));
        }
    } else {
        json = JSON.parse(raw.toString('utf8'));
    }
    const dir = path.dirname(file);
    const buffers = (json.buffers || []).map((b) =>
        b.uri ? fs.readFileSync(path.join(dir, decodeURIComponent(b.uri))) : glbBin
    );

    const readAccessor = (index) => {
        const a = json.accessors[index];
        const view = json.bufferViews[a.bufferView];
        const comp = COMPONENT[a.componentType];
        const n = TYPE_SIZE[a.type];
        const stride = view.byteStride || n * comp.size;
        const base = (view.byteOffset || 0) + (a.byteOffset || 0);
        const buf = buffers[view.buffer];
        const out = new Array(a.count);
        for (let i = 0; i < a.count; i++) {
            const v = new Array(n);
            for (let k = 0; k < n; k++) {
                let x = comp.read(buf, base + i * stride + k * comp.size);
                if (a.normalized) x = Math.max(x / comp.norm, -1);
                v[k] = x;
            }
            out[i] = n === 1 ? v[0] : v;
        }
        return out;
    };

    const readImage = (index) => {
        const img = json.images[index];
        if (img.uri) {
            const file = path.join(dir, decodeURIComponent(img.uri));
            const ext = path.extname(file).toLowerCase();
            return {
                data: fs.readFileSync(file),
                mimeType: img.mimeType || (ext === '.png' ? 'image/png' : 'image/jpeg'),
                name: path.basename(file),
            };
        }
        const view = json.bufferViews[img.bufferView];
        const buf = buffers[view.buffer];
        return {
            data: buf.slice(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength),
            mimeType: img.mimeType,
            name: img.name || `image_${index}`,
        };
    };

    /** Every mesh primitive with its node's world matrix. */
    const primitives = () => {
        const out = [];
        const visit = (nodeIndex, parent, chain) => {
            const node = json.nodes[nodeIndex];
            const world = mat4Multiply(parent, nodeMatrix(node));
            const names = chain.concat(node.name || `node_${nodeIndex}`);
            if (node.mesh != null) {
                for (const prim of json.meshes[node.mesh].primitives) {
                    if (prim.mode != null && prim.mode !== 4) {
                        throw new Error(`Unsupported primitive mode ${prim.mode} in ${names.join(' > ')}`);
                    }
                    out.push({ node: names.join(' > '), world, prim });
                }
            }
            for (const child of node.children || []) visit(child, world, names);
        };
        for (const root of json.scenes[json.scene || 0].nodes) visit(root, IDENTITY, []);
        return out;
    };

    return { json, readAccessor, readImage, primitives };
}

// ---------------------------------------------------------------- writing

/**
 * Builds a GLB from simple descriptions.
 * meshes: [{ name, material, positions: number[][], normals?, uvs?, indices: number[] }]
 * materials: glTF material objects; textures reference `images` by index.
 */
function writeGlb(file, { asset, materials, images, samplers, textures, meshes, nodes, rootName, quantize = 0 }) {
    const chunks = [];
    let byteLength = 0;
    const bufferViews = [];
    const accessors = [];

    const pushView = (data, target, byteStride) => {
        const pad = (4 - (byteLength % 4)) % 4;
        if (pad) {
            chunks.push(Buffer.alloc(pad));
            byteLength += pad;
        }
        const view = { buffer: 0, byteOffset: byteLength, byteLength: data.length };
        if (byteStride) view.byteStride = byteStride;
        if (target) view.target = target;
        chunks.push(data);
        byteLength += data.length;
        bufferViews.push(view);
        return bufferViews.length - 1;
    };

    const floatAccessor = (rows, type) => {
        const n = TYPE_SIZE[type];
        const data = Buffer.alloc(rows.length * n * 4);
        const min = new Array(n).fill(Infinity);
        const max = new Array(n).fill(-Infinity);
        rows.forEach((row, i) =>
            row.forEach((v, k) => {
                data.writeFloatLE(v, (i * n + k) * 4);
                if (v < min[k]) min[k] = v;
                if (v > max[k]) max[k] = v;
            })
        );
        accessors.push({
            bufferView: pushView(data, 34962),
            componentType: 5126,
            count: rows.length,
            type,
            min,
            max,
        });
        return accessors.length - 1;
    };

    /**
     * KHR_mesh_quantization positions: int16 values of `position × factor`
     * (stride 8); the mesh node carries scale 1/factor.
     */
    const quantizedPositionAccessor = (rows, factor) => {
        const data = Buffer.alloc(rows.length * 8);
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        rows.forEach((row, i) =>
            row.forEach((v, k) => {
                const q = Math.round(v * factor);
                if (q < -32768 || q > 32767) throw new Error(`Position ${v} out of int16 range at factor ${factor}`);
                data.writeInt16LE(q, i * 8 + k * 2);
                if (q < min[k]) min[k] = q;
                if (q > max[k]) max[k] = q;
            })
        );
        accessors.push({
            bufferView: pushView(data, 34962, 8),
            componentType: 5122,
            count: rows.length,
            type: 'VEC3',
            min,
            max,
        });
        return accessors.length - 1;
    };

    /** KHR_mesh_quantization normals: normalized int8 (stride 4). */
    const quantizedNormalAccessor = (rows) => {
        const data = Buffer.alloc(rows.length * 4);
        rows.forEach((row, i) =>
            row.forEach((v, k) => data.writeInt8(Math.max(-127, Math.min(127, Math.round(v * 127))), i * 4 + k))
        );
        accessors.push({
            bufferView: pushView(data, 34962, 4),
            componentType: 5120,
            normalized: true,
            count: rows.length,
            type: 'VEC3',
        });
        return accessors.length - 1;
    };

    const indexAccessor = (indices, vertexCount) => {
        const wide = vertexCount > 65535;
        const data = Buffer.alloc(indices.length * (wide ? 4 : 2));
        indices.forEach((v, i) => (wide ? data.writeUInt32LE(v, i * 4) : data.writeUInt16LE(v, i * 2)));
        accessors.push({
            bufferView: pushView(data, 34963),
            componentType: wide ? 5125 : 5123,
            count: indices.length,
            type: 'SCALAR',
        });
        return accessors.length - 1;
    };

    const gltfImages = images.map((img) => ({
        name: img.name,
        mimeType: img.mimeType,
        bufferView: pushView(img.data),
    }));

    const q = quantize; // position factor (units → int16), or 0 for float
    const gltfMeshes = meshes.map((m) => {
        const attributes = {
            POSITION: q ? quantizedPositionAccessor(m.positions, q) : floatAccessor(m.positions, 'VEC3'),
        };
        if (m.normals) attributes.NORMAL = q ? quantizedNormalAccessor(m.normals) : floatAccessor(m.normals, 'VEC3');
        if (m.uvs) attributes.TEXCOORD_0 = floatAccessor(m.uvs, 'VEC2');
        if (m.colors) attributes.COLOR_0 = floatAccessor(m.colors, 'VEC3');
        return {
            name: m.name,
            primitives: [{ attributes, indices: indexAccessor(m.indices, m.positions.length), material: m.material }],
        };
    });

    const gltfNodes = [];
    const rootChildren = [];
    gltfMeshes.forEach((m, i) => {
        const node = { name: m.name, mesh: i };
        if (q) node.scale = [1 / q, 1 / q, 1 / q];
        gltfNodes.push(node);
        rootChildren.push(gltfNodes.length - 1);
    });
    for (const extra of nodes || []) {
        gltfNodes.push(extra);
        rootChildren.push(gltfNodes.length - 1);
    }
    gltfNodes.push({ name: rootName, children: rootChildren });

    const json = {
        asset,
        scene: 0,
        scenes: [{ nodes: [gltfNodes.length - 1] }],
        nodes: gltfNodes,
        meshes: gltfMeshes,
        materials,
        accessors,
        bufferViews,
        buffers: [{ byteLength }],
    };
    if (q) {
        json.extensionsUsed = ['KHR_mesh_quantization'];
        json.extensionsRequired = ['KHR_mesh_quantization'];
    }
    if (gltfImages.length) {
        json.images = gltfImages;
        json.samplers = samplers;
        json.textures = textures;
    }

    const bin = Buffer.concat(chunks);
    const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
    let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
    jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);

    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binPadded.length, 8);
    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonBuf.length, 0);
    jsonHeader.writeUInt32LE(0x4e4f534a, 4);
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binPadded.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4);

    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.concat([header, jsonHeader, jsonBuf, binHeader, binPadded]));
    return { json, size: 12 + 16 + jsonBuf.length + binPadded.length };
}

module.exports = {
    IDENTITY,
    mat4Multiply,
    transformPoint,
    transformDirection,
    determinant3,
    readGltf,
    writeGlb,
};
