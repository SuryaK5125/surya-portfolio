# Third-party notices

## Original project

- **henryjeff/portfolio-website** by Henry Heffernan. MIT License, Copyright 2024 Henry Heffernan. The rendering, camera and screen systems in `src/Application` derive from it. The inherited audio playback system and all its recordings have been replaced by original Web Audio synthesis (see [AUDIO.md](AUDIO.md)). Notice kept in [LICENSE.md](LICENSE.md).
- *To verify:* `Utils/EventEmitter.ts` and the `Application` singleton with `Sizes`/`Time`/`Resources` follow the structure taught in Bruno Simon's Three.js Journey course. Confirm where this code came from and credit it here if required.

## 3D models

### Laptop: `static/models/Laptop/laptop.glb`

This work is based on "Laptop Dell Latitude 5400" (https://sketchfab.com/3d-models/laptop-dell-latitude-5400-c3dfc53a600e427c9db9be83aec9860d) by Yolala1232 (https://sketchfab.com/Yolala1232), licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).

**Changes made** (by `tools/model-pipeline/build-laptop.js`):
- removed the ground plane, the CPU-brand sticker and the screen wallpaper image
- converted materials to metallic-roughness and consolidated them
- merged meshes, re-oriented the model, and scaled it to millimetres
- downsampled the lid logo texture
- replaced the display quad with a reference node for the live desktop

The same credit is shown on the site under *About this site*, and is embedded in the GLB's `asset` metadata.

Dell and the Dell logo are trademarks of Dell Inc. This project is not affiliated with or endorsed by Dell.

### Speakers: `static/models/Speaker/speaker.glb`

This work is based on "Speaker Bookshelf V2 - Optimized" (https://sketchfab.com/3d-models/speaker-bookshelf-v2-optimized-cbb87dee55e84a389cbccb4ddc0036e0) by rendysix (https://sketchfab.com/ironmenleader), licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).

**Changes made** (by `tools/model-pipeline/build-speaker.js`):
- adjusted material roughness and metalness
- dropped unused attributes and `KHR_materials_specular`
- merged meshes, re-oriented the model, and scaled it to millimetres
- downsampled textures

### LEGO Porsche 911: `static/models/Porsche/porsche.glb`

This work is based on "LEGO 10295 Porsche 911 (Turbo)" (https://sketchfab.com/3d-models/lego-10295-porsche-911-turbo-73d0cef548c04c3f9b6cef9871ea8d52) by Sleepy Sea Otter (https://sketchfab.com/sleepyseaotter), licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).

**Changes made** (by `tools/model-pipeline/blender/optimize_porsche.py` and `build-porsche.js`; details in [PORSCHE.md](tools/model-pipeline/PORSCHE.md)):
- removed the embossed LEGO logo from every stud
- removed parts and faces that aren't visible from above the desk (interior chassis, brick interiors, covered studs)
- merged duplicate colour materials, and all parts into one mesh per colour
- simplified from 15 million to 100,000 triangles
- re-oriented the model and scaled it to millimetres
- converted the colours to linear and adjusted roughness and metalness

The same credit is shown on the site under *About this site*, and is embedded in the GLB's `asset` metadata.

LEGO is a trademark of the LEGO Group. Porsche, 911 and the Porsche crest are trademarks of Dr. Ing. h.c. F. Porsche AG. This project is not affiliated with or endorsed by either.

### Desk (temporary): `static/models/World/environment.glb`

From Henry Heffernan's portfolio (henryjeff/portfolio-website, MIT License, Copyright 2024 Henry Heffernan). The baked texture's desk top has been cleaned of the original desk objects' footprints (`baked_environment_desk.jpg`). Its chair meshes are hidden (replaced by "Office Chair Modern", below). Whether the MIT grant covers these 3D assets is unconfirmed; see [ASSETS.md](ASSETS.md) before deploying.

## Bundled libraries

The production JavaScript bundles include these libraries. Webpack also extracts their license comments into `*.LICENSE.txt` next to each bundle.

| Library | License |
|---|---|
| three.js (including the CSS3DRenderer, GLTFLoader and OrbitControls examples) | MIT |
| React, React DOM | MIT |
| framer-motion | MIT |
| @tweenjs/tween.js | MIT |
| bezier-easing | MIT |
| lil-gui | MIT |
| stats.js | MIT |

## Files in the repository

| Path | License |
|---|---|
| `static/draco/` (Google Draco decoders) | Apache-2.0. See `static/draco/README.md`. |


## Desk props

### Pasha De Cartier Edition Noire (archived; excluded from build)

This work is based on "Pasha De Cartier Edition Noire" ([source](https://sketchfab.com/3d-models/pasha-de-cartier-edition-noire-ff699cd06f0d40c99554b425fe9c6a30)) by [TURBO TURBO](https://sketchfab.com/turboturbo), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Modifications: Ribbed chrome cap retained intact; other geometry simplified; dark glass made opaque; colour texture reduced to 1024px; normalized to 120 mm tall. Baked transforms, grouped meshes by material and quantized positions/normals. Source license is retained in `assets-source/pasha_de_cartier_edition_noire/license.txt`.

### Tom Ford Perfume Bottle – High-Quality 3D Model (archived; excluded from build)

This work is based on "Tom Ford Perfume Bottle – High-Quality 3D Model" ([source](https://sketchfab.com/3d-models/tom-ford-perfume-bottle-high-quality-3d-model-e1b05151b98643488c1436f65859e024)) by [ProductViz](https://sketchfab.com/ProductViz), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Modifications: Geometry simplified with the label preserved; colour texture limited to 1024px; normalized to 105 mm tall. Baked transforms, grouped meshes by material and quantized positions/normals. Source license is retained in `assets-source/tom_ford_perfume_bottle__high-quality_3d_model/license.txt`.

### Headphone with stand

This work is based on "Headphone with stand" ([source](https://sketchfab.com/3d-models/headphone-with-stand-4ffedc9bffad4a549f6e0a46b0f92b05)) by [Halil Kantarci](https://sketchfab.com/halilkantarci), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Modifications: Geometry simplified; shared earcup finish; optional clearcoat/specular layers removed; colour maps limited to 1024px, normal and packed maps to 512px; grounded at 300 mm tall. Baked transforms, grouped meshes by material and quantized positions/normals. Source license is retained in `assets-source/headphone_with_stand/license.txt`.

### Cherry Tree (archived; excluded from production build)

This work is based on "Cherry Tree" ([source](https://sketchfab.com/3d-models/cherry-tree-2e8111f87c2b4c06826406accccfbdc2)) by [local.yany](https://sketchfab.com/local.yany), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Modifications: Geometry simplified and merged by material; textures limited to 512px; petals alpha-tested; scaled to a 330 mm miniature and set in an original ceramic planter. Baked transforms, grouped meshes by material and quantized positions/normals. Source license is retained in `assets-source/cherry_tree/license.txt`.

Cartier and Tom Ford names and logos belong to their respective owners. The miniature tree presentation, planter and drawer mechanism are original scene adaptations.

### Office Chair Modern

This work is based on "Office Chair Modern" ([source](https://sketchfab.com/3d-models/office-chair-modern-675f34f7304e4d92812a41e9750539aa)) by [thethieme](https://sketchfab.com/thethieme), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Modified by `tools/model-pipeline/build-chair.js`: source transforms baked; converted to millimetres at true size (720 × 966 × 760 mm); turned to face the desk and grounded on its casters; unused tangents dropped; geometry otherwise unchanged (1,234 triangles). Textures downsampled from 2048 px to a 1024 px colour map and 512 px metallic/roughness and normal maps. The unmodified downloaded license is in `assets-source/office_chair_modern/license.txt`, and attribution is embedded in the GLB and shown in site credits.

### Computer mouse A4Tech bloody V7

This work is based on "Computer mouse A4Tech bloody V7" ([source](https://sketchfab.com/3d-models/computer-mouse-a4tech-bloody-v7-69e3f3ec5cc44b14afaa85c53db09c1f)) by [Prokyovec](https://sketchfab.com/fipro333), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Modified by `tools/model-pipeline/blender/build_mouse.py`: baked source transforms, Y-up millimetres, base-centred pivot, 125 mm length; welded/simplified from 136,520 to 40,400 triangles; six primitives joined into three material groups, near-identical matte plastics shared. Original colours and emissive hand logo/wheel retained. No image textures. The unmodified downloaded license is in `assets-source/computer_mouse_a4tech_bloody_v7/license.txt`, and attribution is embedded in the GLB and shown in site credits. A4Tech/Bloody names and logos belong to their owners; no endorsement is implied.

The contoured bottle supports, fitted organizer, felt mousepad and wall skirting are original code geometry. The cherry tree and its planter are no longer displayed.

## Speedcubing drawer

This work is based on "Rubik's Cubes Solved And Unsolved" ([source](https://sketchfab.com/3d-models/rubiks-cubes-solved-and-unsolved-4906dda419924335b02332c69adb3d38)) by [Default Digital](https://sketchfab.com/defaultdigital), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Changes: retained only the solved 2x2, 3x3 and 4x4 variants; baked transforms, grounded pivots and uniformly scaled edges to 50/56/60mm; retained original triangles and sticker colours; merged each cube's seven materials into one using linear vertex colours; quantized positions to 0.02mm and normals to int8. No image textures. Source license is in `assets-source/rubiks_cubes_solved_and_unsolved/license.txt`; attribution is shown in site credits and embedded in each GLB.

The unbranded timer is original procedural mesh geometry (`CubingTimer.ts`), including its sensor pads and geometric LCD-style display, under the project's MIT license. It does not use any geometry, textures or logos from the QiYi scan.

The downloaded "Qiyi Timer scanned" by artmix044 ([source](https://sketchfab.com/3d-models/qiyi-timer-scanned-8785fd8d9c454341a178250fbf29a0c1)) carries **Sketchfab Standard**, not CC BY. It is **not shipped or used in the scene** because clearance to deliver an extractable GLB was unavailable. The source license text is retained solely to document this review. See [Sketchfab license terms](https://sketchfab.com/licenses).
