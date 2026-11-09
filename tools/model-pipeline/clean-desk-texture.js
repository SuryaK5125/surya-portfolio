#!/usr/bin/env node
/**
 * Removes the baked footprints and shadows of the original project's desk
 * objects (keyboard, computer, monitor, papers, mug, cables, binders) from the
 * desk-top region of static/models/World/baked_environment.jpg. The rest of
 * the atlas (desk sides, chair, background) is untouched. Deterministic image
 * processing, no generated art.
 *
 * The baked texture is the original project's work (see ASSETS.md); this
 * produces a derived copy for the desk-only scene.
 *
 * Method (desk-top UV rectangle only):
 *   1. Robustly fit the clean lighting field: a quadratic surface per channel,
 *      refitted while discarding pixels darker than the fit, which converges
 *      on the unshadowed upper envelope.
 *   2. Lighten-only: out = max(original, fit − tolerance). Footprints, their
 *      halos and the old monitor's soft shadow lift to the clean surface;
 *      clean pixels keep their original values, so there are no seams.
 *
 * JPEG isn't readable with Node built-ins, so this works on PNG:
 *   powershell -File tools/model-pipeline/convert-image.ps1 <in.jpg> <tmp.png>
 *   node tools/model-pipeline/clean-desk-texture.js <tmp.png> <clean.png>
 *   powershell -File tools/model-pipeline/convert-image.ps1 <clean.png> <out.jpg> 92
 */
const fs = require('fs');
const { decodePng, toRgba, encodePng } = require('./lib/png');

// Desk-top island in the 4096² atlas, from the desk mesh's UVs:
// u 0.38328–0.53273, v 0.66605–0.99167
const UV_RECT = { u0: 0.383285, u1: 0.532732, v0: 0.666046, v1: 0.99167 };
const FIT_ITERATIONS = 10;
const SHADOW_REJECT = 1.5; // pixels this much darker than the fit are excluded from refits
// Also clean the atlas padding around the island (sampled by texture filtering)
const GUTTER = 6;
const TOLERANCE = 1; // keep original when within this of the fit

const [input, output] = process.argv.slice(2);
if (!input || !output) {
    console.error('Usage: node clean-desk-texture.js <in.png> <out.png>');
    process.exit(1);
}

const img = toRgba(decodePng(fs.readFileSync(input)));
const { width: W, height: H, data } = img;

const x0 = Math.ceil(UV_RECT.u0 * W) - GUTTER;
const x1 = Math.min(W, Math.floor(UV_RECT.u1 * W) + GUTTER);
const y0 = Math.ceil(UV_RECT.v0 * H) - GUTTER;
const y1 = Math.min(H, Math.floor(UV_RECT.v1 * H) + GUTTER);
const rw = x1 - x0;
const rh = y1 - y0;
const idx = (x, y) => ((y0 + y) * W + (x0 + x)) * 4;

// Quadratic bivariate basis on normalised coordinates (stiff on purpose, so
// it cannot bend into the broad shadow the old monitor left mid-desk)
const basis = (x, y) => {
    const u = x / rw - 0.5;
    const v = y / rh - 0.5;
    return [1, u, v, u * u, u * v, v * v];
};
const N = 6;

function solve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
        let p = i;
        for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
        [A[i], A[p]] = [A[p], A[i]];
        [b[i], b[p]] = [b[p], b[i]];
        for (let r = i + 1; r < n; r++) {
            const k = A[r][i] / A[i][i];
            for (let j = i; j < n; j++) A[r][j] -= k * A[i][j];
            b[r] -= k * b[i];
        }
    }
    const s = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let acc = b[i];
        for (let j = i + 1; j < n; j++) acc -= A[i][j] * s[j];
        s[i] = acc / A[i][i];
    }
    return s;
}

function fit(include) {
    return [0, 1, 2].map((c) => {
        const A = Array.from({ length: N }, () => new Array(N).fill(0));
        const b = new Array(N).fill(0);
        for (let y = 0; y < rh; y += 2)
            for (let x = 0; x < rw; x += 2) {
                if (!include(x, y)) continue;
                const f = basis(x, y);
                const val = data[idx(x, y) + c];
                for (let i = 0; i < N; i++) {
                    b[i] += f[i] * val;
                    for (let j = 0; j < N; j++) A[i][j] += f[i] * f[j];
                }
            }
        return solve(A, b);
    });
}

const evaluate = (coeffs, x, y) => {
    const f = basis(x, y);
    return coeffs.map((s) => s.reduce((acc, k, i) => acc + k * f[i], 0));
};
const lumOf = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
const pixel = (x, y) => {
    const i = idx(x, y);
    return [data[i], data[i + 1], data[i + 2]];
};

// 1. Robust fit of the unshadowed surface
let coeffs = fit(() => true);
let used = 0;
for (let it = 0; it < FIT_ITERATIONS; it++) {
    const current = coeffs;
    used = 0;
    coeffs = fit((x, y) => {
        const ok = lumOf(pixel(x, y)) >= lumOf(evaluate(current, x, y)) - SHADOW_REJECT;
        if (ok) used++;
        return ok;
    });
}

// 2. Lighten-only replacement
let changed = 0;
let residualSq = 0;
let residualN = 0;
for (let y = 0; y < rh; y++)
    for (let x = 0; x < rw; x++) {
        const target = evaluate(coeffs, x, y);
        const i = idx(x, y);
        let touched = false;
        for (let c = 0; c < 3; c++) {
            const floor = target[c] - TOLERANCE;
            if (data[i + c] < floor) {
                data[i + c] = Math.max(0, Math.min(255, Math.round(floor)));
                touched = true;
            } else {
                residualSq += (data[i + c] - target[c]) ** 2;
                residualN++;
            }
        }
        if (touched) changed++;
    }

fs.writeFileSync(output, encodePng({ width: W, height: H, channels: 4, data }));
console.log(
    JSON.stringify({
        region: { x0, y0, width: rw, height: rh },
        fitSamples: used,
        changedPercent: +((100 * changed) / (rw * rh)).toFixed(1),
        cleanResidualRms: +Math.sqrt(residualSq / Math.max(1, residualN)).toFixed(2),
    })
);
