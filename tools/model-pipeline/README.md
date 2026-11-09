# Model pipeline

Scripts that turn downloaded source models into the optimised GLBs under `static/models/`. They use only Node built-ins: no packages and no network.

## Laptop

```bash
# 1. Download the glTF version of "Laptop Dell Latitude 5400" (CC-BY-4.0):
#    https://sketchfab.com/3d-models/laptop-dell-latitude-5400-c3dfc53a600e427c9db9be83aec9860d
#    and unzip it into assets-source/dell-latitude-5400/
# 2. Build:
node tools/model-pipeline/build-laptop.js
```

Output: `static/models/Laptop/laptop.glb`, plus a JSON report covering size, triangle count, dimensions and the screen fit.

What the script does:
- **Removes** the ground plane, the CPU sticker and the screen wallpaper.
- **Converts** `KHR_materials_pbrSpecularGlossiness` to metallic-roughness and consolidates the materials. The `MATERIALS` table in the script maps each source material to its target.
- **Merges** meshes into one per material, with transforms baked in.
- **Orients and scales:** Y-up, screen facing +Z, millimetres (1 source unit = 110 mm, so the width matches the real 321.6 mm), centred footprint, base on y = 0.
- **Quantizes** positions to int16 at 0.02 mm, and normals to int8 (`KHR_mesh_quantization`).
- **Screen node:** replaces the display quad with a node named `Screen`. Its transform is the display frame (+X right, +Y up, +Z out of the screen), and `extras.screen.{width,height}` gives the active area in mm. The site places the CSS3D desktop and frames the monitor camera from this node, so a re-export can't misalign the screen.

The script fails loudly if the source changes shape: an unmapped material, a screen quad that isn't 4 vertices, or a screen normal that doesn't face +Z.

## Speaker

```bash
# Download the glTF version of "Speaker Bookshelf V2 - Optimized" (CC-BY-4.0):
#   https://sketchfab.com/3d-models/speaker-bookshelf-v2-optimized-cbb87dee55e84a389cbccb4ddc0036e0
# into assets-source/speaker_bookshelf_v2_-_optimized/, then:
node tools/model-pipeline/build-speaker.js
```

The script:
- re-orients the speaker (front faces +Z) and scales it to 300 mm tall, which makes it about 189 × 224 mm;
- sets realistic roughness and metalness (satin veneer, rubber surrounds, aluminium cones);
- merges the meshes per material;
- downsamples colour textures to 512² and normal maps to 256²;
- quantizes the geometry.

## LEGO Porsche 911

This one needs Blender for the geometry; packaging stays in Node. The full workflow, the budget choice and the CC BY change list are in [PORSCHE.md](PORSCHE.md).

```bash
blender -b --factory-startup --python tools/model-pipeline/blender/optimize_porsche.py -- \
    --source assets-source/lego-porsche/scene.gltf --out assets-source/lego-porsche/build
node tools/model-pipeline/build-porsche.js
```

Output: `static/models/Porsche/porsche.glb` (100k triangles, 2.2 MB, one mesh per LEGO colour).

## Desk texture cleanup (temporary desk)

The original project's baked desk texture has black footprints where its desk objects used to sit. `clean-desk-texture.js` lifts the desk-top region to its own fitted, unshadowed lighting (lighten-only), so it stays seamless. JPEG isn't readable with Node built-ins, so it runs through PNG:

```bash
powershell -File tools/model-pipeline/convert-image.ps1 static/models/World/baked_environment.jpg tmp.png
node tools/model-pipeline/clean-desk-texture.js tmp.png clean.png
powershell -File tools/model-pipeline/convert-image.ps1 clean.png static/models/World/baked_environment_desk.jpg 92
```

## Checking a build

`rectangleFitErrorMm` in the report is how far the original quad's corners deviate from the fitted rectangle. Anything under about 1 mm is invisible at the closest camera distance.


## Desk props and fragrance drawer

See [DESK-PROPS.md](DESK-PROPS.md) for the four licensed prop conversions, geometry budgets, measured drawer extraction and regression checks.
