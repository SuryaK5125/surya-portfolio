# LEGO 10295 Porsche 911: optimisation workflow

Turns the 440 MB, 15M-triangle Sketchfab download into a 2.2 MB GLB (100k triangles), using Blender for the geometry and Node for packaging.

## Source and licence

"LEGO 10295 Porsche 911 (Turbo)" by [Sleepy Sea Otter](https://sketchfab.com/sleepyseaotter), from [Sketchfab](https://sketchfab.com/3d-models/lego-10295-porsche-911-turbo-73d0cef548c04c3f9b6cef9871ea8d52), licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Required credit, which must appear wherever the model is shared:

> This work is based on "LEGO 10295 Porsche 911 (Turbo)" (https://sketchfab.com/3d-models/lego-10295-porsche-911-turbo-73d0cef548c04c3f9b6cef9871ea8d52) by Sleepy Sea Otter (https://sketchfab.com/sleepyseaotter) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

The same credit and the list of modifications below are embedded in the GLB's `asset.extras`. LEGO and Porsche are trademarks of their owners; this project is not affiliated with or endorsed by either.

The source download stays in `assets-source/lego-porsche/`. It is gitignored, except for `license.txt`, and is never committed.

## Build

```bash
# 1. Download the glTF version from Sketchfab and unzip it into assets-source/lego-porsche/
# 2. Geometry (Blender 4.2+, tested with 5.2; about 5 minutes, mostly GPU ID renders):
blender -b --factory-startup --python tools/model-pipeline/blender/optimize_porsche.py -- \
    --source assets-source/lego-porsche/scene.gltf --out assets-source/lego-porsche/build
# 3. Package: materials, quantization, credit
node tools/model-pipeline/build-porsche.js
```

With the Microsoft Store version of Blender, run `blender-launcher.exe` (the app's execution alias) instead of `blender`. The launcher doesn't pass stdout through, so read `assets-source/lego-porsche/build/optimize.log` instead.

To try a different budget without repeating the ID renders, add `--resume 1 --target N` to step 2. It reuses `build/_culled.pickle` and takes about 15 seconds.

Outputs in `assets-source/lego-porsche/build/` (gitignored):

| File | What it is |
|---|---|
| `porsche-blender.glb` | Blender result, float, before packaging |
| `optimize-report.json`, `optimize.log` | Triangle counts per stage, source colour table, settings |
| `preview-1-source-*.png`, `preview-2-optimized-*.png` | Before/after renders for review (`--previews 2` adds per-stage renders) |

`build-porsche.js` writes `static/models/Porsche/porsche.glb` by default. Pass `[buildDir] [outFile]` to write elsewhere.

## What each stage does

| Stage | Triangles | Notes |
|---|---|---|
| Source | 14,953,859 | 4,279 meshes, one per part piece, no instancing; 41 materials |
| Drop stud logos | 2,147,062 | The embossed "LEGO" on each stud: 2,819 copies of one 0.2 LDU (0.08 mm) relief, 85% of the source |
| Hidden-geometry removal | 375,135 | 136 parts and every hidden face removed (Technic chassis, gearbox, brick interiors, anti-stud tubes, covered studs) |
| Coplanar dissolve | 339,828 | Re-triangulates flat faces, with no change in shape |
| Edge-collapse decimation | 99,999 | Quadric collapse; open edges are weighted so they don't erode |

Details:

- **Loading.** The script reads the glTF with numpy rather than Blender's importer, which would build all 15M triangles first. Every source part has a mirrored transform, so winding is fixed per triangle against the source normals (29,824 triangles flipped). Vertices that were split per normal are welded. Duplicate colours (`SOLID-BLACK`, `SOLID-BLACK_0`, …) are merged: 41 materials become 22.
- **Visibility.** Each opaque face is rendered with a unique 24-bit ID colour (Workbench, flat, no anti-aliasing, float EXR; decoding is exact). There are 144 orthographic views at 2,048 px (0.5 LDU per pixel), on the hemisphere plus a horizon ring. Nothing is viewed from below, because the car sits on the desk.
  - Studio fan-triangulates flat faces into long slivers: 90% of source triangles are under 1 LDU wide, and a pixel grid misses them. So a face is kept if *any* triangle of its coplanar region (the original LDraw polygon) was seen. Thin faces edge-adjacent to kept ones are kept too.
  - An earlier per-triangle version left large holes; the region rule leaves none.
  - Transparent parts and printed decorations never block the view and are always kept.
- **Simplification.** All parts are joined into one mesh with a material slot per colour. Parts stay separate islands, so colours never bleed into each other.
- **Finish.** Edges sharper than 35° get hard normals. The model is converted to millimetres (1 LDU = 0.4 mm), Y-up, nose towards +X, wheels on y = 0, footprint centred. Result: 355 × 160 × 109 mm, the real set's size.
- **Packaging** (`build-porsche.js`):
  - Studio stores LEGO's sRGB colour values in glTF's linear `baseColorFactor` (Red 0.784, 0.098, 0.031 = #C91A09), so they are converted to linear.
  - Roughness and metalness are set per finish: ABS 0.32, trans 0.08 with alpha blending, rubber 0.85, pearl/metal 0.35 at 0.7 metalness.
  - Printed decorations (Porsche crest, rear "PORSCHE" and "turbo" lettering, stripes) keep their own `<colour>.print` materials with `extras.print`, so the site can depth-offset them against the surface underneath.
  - Positions are quantized to int16 at 0.01 mm and normals to int8 (`KHR_mesh_quantization`).
  - One mesh per material: 26 meshes.

## Choosing the budget

The previews were compared at three budgets, all built from the same visibility cache:

| Budget | GLB | Gzipped | Result |
|---|---|---|---|
| 60k | — | — | Rejected: hood, roof and fenders crumpled, with spikes along the roof edge, C-pillars and bumper; blobby headlights; jagged wing studs |
| **100k** | **2.17 MB** | **1.11 MB** | **Shipped.** No holes, no distorted pieces, all exterior details present |
| 150k | 3.03 MB | 1.57 MB | Rounder headlight rims and arch lips; otherwise the same as 100k |

## Known limitations

- The underside is open, because faces only visible from below the desk plane are removed. To use the model elsewhere, rebuild with `--min-elevation -90`.
- A few short dark marks show on the hood where the seams between curved slope bricks catch a hard-normal edge.
- The headlight rims and wheel-arch lips are slightly faceted at close range.

## Modifications (CC BY change list)

1. Removed the embossed LEGO logo from every stud (2,819 meshes).
2. Removed 136 parts and all faces not visible from above the desk: interior Technic chassis and gearbox, brick interiors, anti-stud tubes and covered studs.
3. Merged duplicate colour materials, and all parts into one mesh per colour.
4. Simplified the 375,135 visible triangles to 99,999 (coplanar dissolve, then edge-collapse decimation).
5. Re-oriented (Y-up, nose +X) and scaled to millimetres (1 LDU = 0.4 mm), base on y = 0.
6. Converted colours from sRGB to linear and set roughness/metalness per LEGO finish.

## In the site

- Loaded as `porscheModel` (`src/Application/sources.ts`) and placed by `src/Application/World/LegoPorsche.ts` at `LEGO_CAR` in `SceneLayout.ts`.
- Opaque meshes cast and receive shadows. Transparent meshes don't cast shadows and don't write depth, so the cabin shows through.
- `*.print` materials get `polygonOffset` (factor −1, units −4) so they draw over the surface beneath them.
- Credited in `ASSETS.md`, `THIRD_PARTY_NOTICES.md` and the desktop's *About this site* app.
