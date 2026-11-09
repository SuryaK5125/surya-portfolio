# Production loading tools

Local-only measurement and offline packaging. None of these scripts, the encoder, Python or Pillow are bundled into the website.

## Rebuild delivery models

From the repository root (Node.js and Python with Pillow):

```
npm ci --prefix tools/loading --ignore-scripts
node tools/loading/package-models.cjs
```

The pinned MIT meshoptimizer encoder lives in this nested tooling package; do not install it into the application's dependencies. The script reads the six existing editable GLBs, emits `.meshopt.glb` delivery variants, and updates `model-sizes.json` with sizes and SHA-256 hashes. Every encoded geometry stream must decode byte-for-byte with the installed Three.js decoder. PNG replacements must decode to identical RGBA pixels at identical dimensions; JPEGs are unchanged. Never run simplification/extra quantization as part of this pipeline.

Commit the delivery models and manifest together after rebuilding the source models. Webpack excludes their original delivery duplicates from `public/`, but the originals stay available for editing and geometry regression tests.

## Verify

```
node tools/loading/check-loading.cjs
node tools/model-pipeline/check-drawer-runtime.js
node tools/model-pipeline/check-texture-filtering.js
node tools/model-pipeline/check-free-camera-picking.js
node tools/model-pipeline/check-scene-input.js
node node_modules/typescript/bin/tsc --noEmit -p src/tsconfig.json
npm run build
```

## Measure a production build

```
node tools/loading/measure-preview.cjs --root public --out loading-measurements --port 4210 --label candidate --cache on
```

Use a fresh localhost port for an HTTP-cold visit and the same viewport for before/after. The server injects local-only instrumentation into the room and desktop iframe, logging resource transfer/body sizes, load order, long tasks, loading-screen completion, intro completion and a short animation-frame sample as JSON. Reports and requests remain on localhost; no third-party telemetry is sent. `--cache off` forces full asset transfers on each reload; `--cache on` allows a separate cached-visit comparison. Navigate away and back for a cache test, rather than forcibly reloading/revalidating files.

Preserve the baseline `public/` elsewhere before rebuilding. Do not run builds/encoders while timing. Browser/driver shader caches and host contention affect timings; record those limits and do not equate an animation-frame median with sustained FPS. The existing full intro is deliberately timed separately from asset readiness. Ordinary cached entry uses the existing direct-to-desk path under the loader fade only when ResourceTiming confirms successful critical assets came from cache; the text reveal still replays.
