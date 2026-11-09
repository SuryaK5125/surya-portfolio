import * as THREE from 'three';

/**
 * Small, tileable procedural textures for the room's painted plaster and
 * floor finish (original; no image assets). Generated once at start-up on
 * a 512 px canvas each, which takes a few milliseconds.
 */

/** Seeded PRNG (mulberry32) so the surfaces look the same on every visit. */
function random(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Tileable fractal value noise in [0, 1]. Each octave uses a lattice whose
 * period divides the texture size, so the result wraps seamlessly.
 */
function fbm(size: number, seed: number, octaves: { cells: number; weight: number }[]) {
    const out = new Float32Array(size * size);
    let total = 0;
    octaves.forEach(({ cells, weight }, o) => {
        const rand = random(seed * 977 + o * 131);
        const lattice = new Float32Array(cells * cells);
        for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
        const step = size / cells;
        for (let y = 0; y < size; y++) {
            const gy = y / step;
            const y0 = Math.floor(gy) % cells;
            const y1 = (y0 + 1) % cells;
            let ty = gy - Math.floor(gy);
            ty = ty * ty * (3 - 2 * ty);
            for (let x = 0; x < size; x++) {
                const gx = x / step;
                const x0 = Math.floor(gx) % cells;
                const x1 = (x0 + 1) % cells;
                let tx = gx - Math.floor(gx);
                tx = tx * tx * (3 - 2 * tx);
                const a = lattice[y0 * cells + x0] + (lattice[y0 * cells + x1] - lattice[y0 * cells + x0]) * tx;
                const b = lattice[y1 * cells + x0] + (lattice[y1 * cells + x1] - lattice[y1 * cells + x0]) * tx;
                out[y * size + x] += (a + (b - a) * ty) * weight;
            }
        }
        total += weight;
    });
    for (let i = 0; i < out.length; i++) out[i] /= total;
    return out;
}

function toTexture(size: number, value: (i: number) => number, colorSpace: 'srgb' | 'linear') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    const image = context.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
        const v = Math.round(Math.min(1, Math.max(0, value(i))) * 255);
        image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v;
        image.data[i * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    if (colorSpace === 'srgb') texture.encoding = THREE.sRGBEncoding;
    return texture;
}

export type SurfaceSet = {
    /** Multiplies the material colour: a gentle tonal mottle around 1.0 */
    map: THREE.Texture;
    /** Height for bumpMap: fine relief */
    bump: THREE.Texture;
    /** Roughness variation */
    roughness: THREE.Texture;
};

/**
 * Hand-troweled painted plaster: soft, cloudy tonal variation (a few %),
 * fine sandy relief and slightly uneven sheen.
 */
export function createPlaster(): SurfaceSet {
    const size = 512;
    const cloud = fbm(size, 11, [
        { cells: 4, weight: 1 },
        { cells: 8, weight: 0.6 },
        { cells: 16, weight: 0.35 },
    ]);
    const grain = fbm(size, 23, [
        { cells: 64, weight: 1 },
        { cells: 128, weight: 0.8 },
        { cells: 256, weight: 0.5 },
    ]);
    return {
        map: toTexture(size, (i) => 0.9 + (cloud[i] - 0.5) * 0.16 + (grain[i] - 0.5) * 0.04, 'srgb'),
        bump: toTexture(size, (i) => 0.5 + (grain[i] - 0.5) * 0.9 + (cloud[i] - 0.5) * 0.3, 'linear'),
        roughness: toTexture(size, (i) => 0.86 + (cloud[i] - 0.5) * 0.18, 'linear'),
    };
}

/**
 * Sealed micro-cement floor: broad, quiet clouding, a faint fine speckle and
 * a soft satin sheen that varies across the surface.
 */
export function createMicrocement(): SurfaceSet {
    const size = 512;
    const cloud = fbm(size, 37, [
        { cells: 3, weight: 1 },
        { cells: 6, weight: 0.7 },
        { cells: 12, weight: 0.4 },
        { cells: 24, weight: 0.2 },
    ]);
    const speck = fbm(size, 41, [
        { cells: 128, weight: 1 },
        { cells: 256, weight: 0.7 },
    ]);
    return {
        map: toTexture(size, (i) => 0.9 + (cloud[i] - 0.5) * 0.22 + (speck[i] - 0.5) * 0.05, 'srgb'),
        bump: toTexture(size, (i) => 0.5 + (speck[i] - 0.5) * 0.6, 'linear'),
        roughness: toTexture(size, (i) => 0.58 + (cloud[i] - 0.5) * 0.24, 'linear'),
    };
}

/**
 * Dark walnut veneer, tileable. The texture covers about 1000 × 500 mm with
 * the grain running along the long (u) axis: soft growth bands, fine fibres
 * and a slightly varying satin sheen. Procedural, so no image assets.
 */
export function createWalnut(): SurfaceSet {
    const width = 1024;
    const height = 512;
    const low = fbm(256, 53, [
        { cells: 4, weight: 1 },
        { cells: 8, weight: 0.6 },
        { cells: 16, weight: 0.3 },
    ]);
    const fibre = fbm(256, 67, [
        { cells: 64, weight: 1 },
        { cells: 128, weight: 0.8 },
        { cells: 256, weight: 0.5 },
    ]);
    const colour = document.createElement('canvas');
    const relief = document.createElement('canvas');
    const sheen = document.createElement('canvas');
    for (const canvas of [colour, relief, sheen]) {
        canvas.width = width;
        canvas.height = height;
    }
    const cc = colour.getContext('2d') as CanvasRenderingContext2D;
    const rc = relief.getContext('2d') as CanvasRenderingContext2D;
    const sc = sheen.getContext('2d') as CanvasRenderingContext2D;
    const ci = cc.createImageData(width, height);
    const ri = rc.createImageData(width, height);
    const si = sc.createImageData(width, height);
    const dark = [0.2, 0.12, 0.08];
    const light = [0.32, 0.2, 0.125];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const n = low[((y * 0.5) | 0) % 256 * 256 + ((x * 0.25) | 0) % 256];
            const f = fibre[((y * 2) | 0) % 256 * 256 + ((x * 0.5) | 0) % 256];
            const s = (y / height) * 34 + (n - 0.5) * 4.2;
            const band = 0.5 + 0.5 * Math.sin(s * Math.PI * 2);
            const t = Math.min(1, Math.max(0, band * 0.45 + (f - 0.5) * 0.5 + (n - 0.5) * 0.35 + 0.15));
            const i = (y * width + x) * 4;
            for (let k = 0; k < 3; k++) {
                const v = dark[k] + (light[k] - dark[k]) * t;
                // The canvas holds sRGB values directly
                ci.data[i + k] = Math.round(Math.min(1, v) * 255);
            }
            ci.data[i + 3] = 255;
            const h = Math.round(Math.min(1, Math.max(0, 0.5 + (f - 0.5) * 0.7 + (t - 0.5) * 0.3)) * 255);
            ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = h;
            ri.data[i + 3] = 255;
            const r = Math.round(Math.min(1, Math.max(0, 0.46 + (f - 0.5) * 0.2 - (t - 0.5) * 0.12)) * 255);
            si.data[i] = si.data[i + 1] = si.data[i + 2] = r;
            si.data[i + 3] = 255;
        }
    }
    cc.putImageData(ci, 0, 0);
    rc.putImageData(ri, 0, 0);
    sc.putImageData(si, 0, 0);
    const make = (canvas: HTMLCanvasElement, srgb: boolean) => {
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = 8;
        if (srgb) texture.encoding = THREE.sRGBEncoding;
        return texture;
    };
    return { map: make(colour, true), bump: make(relief, false), roughness: make(sheen, false) };
}
