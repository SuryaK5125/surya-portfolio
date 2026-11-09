# Desk props and top drawer

The archived fragrance/headphone/tree/mouse downloads carry CC BY 4.0 licenses. Authors, source URLs and changes are in ASSETS.md, THIRD_PARTY_NOTICES.md, the desktop credits and each shipped GLB's asset.extras. Source glTFs/textures are never edited. No generated imagery or model substitutions are used.

The current drawer contains solved cubes and an original unbranded speedcubing timer. See [CUBING.md](CUBING.md) for its pipeline, exact records configuration, placement and license review. The perfume organizer and bottle inspection are removed; perfume GLBs remain archived and are excluded from the build. The mechanism inspection below still applies; perfume placement details are historical.

## Archived prop rebuild

Download the glTF sources into their matching assets-source folders, then run from the repository root:

```text
blender -b --factory-startup --python tools/model-pipeline/blender/build_desk_props.py
python tools/model-pipeline/resize-prop-textures.py
node tools/model-pipeline/package-desk-props.js
blender -b --factory-startup --python tools/model-pipeline/blender/build_mouse.py
node tools/model-pipeline/check-drawer.js
node tools/model-pipeline/check-drawer-runtime.js
node tools/model-pipeline/check-scene-input.js
node tools/model-pipeline/check-camera-detail.js
```

The Microsoft Store install uses blender-launcher.exe with the same arguments. Build logs, source/optimized comparison renders and reports are in ignored assets-source/scene-update-build/. Blender 5.2 and Python with Pillow were used. `-- --only cartier` rebuilds one asset. Texture/packager scripts also accept a comma-separated asset argument. For a clean rebuild, regenerate all models before packaging; do not repeatedly JPEG-encode an already packaged output.

| Prop | Output triangles | Draw calls | GLB | Width × height × depth (mm) |
|---|---:|---:|---:|---|
| cartier | 60,666 | 5 | 1.19 MiB | 49.3 × 120 × 49.3 |
| tom-ford | 12,714 | 2 | 0.23 MiB | 55.68 × 105 × 55.84 |
| headphones | 20,635 | 4 | 3.47 MiB | 220.24 × 300.06 × 216.16 |
| cherry-tree (archived) | 129,626 | 7 | 4.91 MiB | 290.84 × 330.02 × 223.32 |
| Bloody V7 mouse | 40,400 | 3 | 1.47 MiB | 86.13 x 38.37 x 125.02 |

The source budgets are Cartier 74,032, Tom Ford 44,288, headphones 58,506 and cherry tree 1,378,407 triangles. Headphones reduce five draw calls to four by sharing the earcup finish; tree primitives merge into seven material groups. The Cartier cap keeps its original geometry and split normals: more aggressive collapse distorted the ribbing. All other surfaces use welded, conservative decimation. Base-colour maps are at most 1024px; normal and packed maps at most 512px. Tree textures are 512px. Opaque colour maps use JPEG; alpha/linear maps remain PNG. The four original prop outputs use positions quantized to 0.02mm and normals to int8; the mouse retains Blender float attributes. These are realistic representative display dimensions, not verified manufacturer measurements. The outdoor cherry tree is intentionally adapted as a miniature.

## Desk inspection and safe mechanism

Henry's GLB contains four mesh nodes: Background, desk, chair_base, chair_seat. `desk` is one indexed mesh with 304 triangles. It has no independent drawer box, rails or interior. The top front is a 2-triangle plane (source x −3.45813…−1.76203, y −1.19290…−0.68804, z 1.60541), and the top handle is a disconnected 68-triangle island. The lower front/handle remain part of the fixed 234 triangles.

`DrawerGeometry.ts` identifies those measured surfaces, validates the expected 70/304 triangle counts and clones their indices/UV attributes at runtime. An unexpected replacement desk fails safely instead of cutting arbitrary geometry. The original environment.glb and baked_environment_desk.jpg remain byte-for-byte unchanged. The selected front/handle reuse the original baked material. All new box/liner/rail geometry is additive; the lower drawer and chair are untouched.

Only the top front/handle pick target toggles. It starts fully closed (progress 0, contents hidden), slides 290mm in 650ms with smoothstep easing, and reverses from its current position. Animation uses its own progress rather than the camera's global tween group. A pointer cursor indicates the actual visible pick surface; the tabletop and scene objects occlude picking. Drawer clicks are consumed before the background-camera toggle.

The moving tray is about 437mm wide and 420mm deep. Its lined floor, 16mm front backing, rear and sides form a solid box; the fixed opaque cavity liner includes a back, ceiling, divider and sides. Metal runners retain overlap at full extension. Two rounded foam recesses contain bottles reclined 15 degrees above horizontal, labels up and caps raised rearward. Cartier's source label normal is +X, so that bottle is turned 90 degrees about its own axis before reclining. Upright bottles leave inadequate allowance for the insert, cap and sliding clearance. Each bottle rests on a moulded support derived from its actual lower convex profile, with a 0.3mm contact tolerance, above a 12mm felt foundation. Bottles, supports and insert move under the same parent; the tilted bottles clear the original front top by 25.9mm (Cartier) and 21.8mm (Tom Ford). The raised insert and rearward slot placement keep the labels visible over the original tall front. At full travel both sit beyond the desktop overhang. Runtime bounds assertions and the drawer checks validate these clearances against the actual packaged geometry. check-drawer-runtime.js instantiates the real drawer class, exercises the front/handle click and cursor, rejects lower-drawer clicks, verifies both bottles move with the tray, ray-checks that their upper surfaces are visible over the original front, and checks return to the exact closed state. There is no open portal through the cabinet when closed.

## Previous fragrance placement and input (historical)

The cherry tree is removed from resource loading and excluded from the build; its GLB/license remain archived. The headphone base is at (-835, 0, -225), with the Porsche at (-650, 0, 100): front-left car, stand behind/outboard, with clear space to the left speaker. The Bloody V7 is grounded at y=3.5mm on an original 3mm felt pad to the laptop's right at (320, 3.5, 65). It is normalized uniformly to 125mm length; source proportions are preserved (representative size, not a manufacturer measurement). No textures were present or generated. Source and optimized Blender comparison renders preserve seams, buttons, wheel and emissive hand logo.

Opening transitions into a stable drawer focus at (-670, 930, 1240), aimed at (-650, -60, 350), with desk context and a steeper sightline over the front. Clicking either visible bottle transitions closer without moving the bottle. Back to drawer and Escape return from inspection; Close drawer, Escape from drawer view, or the same handle/front close and return to the normal desk keyframe. Focus views dolly back on narrow viewports. Free-camera/monitor controls remain available; drawer controls hide outside the detail views.

Room planes now use subtle deterministic vertex-colour variation with no bitmap textures. Skirting and a narrow reveal separate the warm plaster wall from the matte floor. The unchanged baked desk/chair now cast real shadows on the floor, while a slightly stronger shadow-only tabletop catcher grounds the props. Original baked materials, posters and existing model assets are unchanged.

MonitorScreen mousemove updates pointer/audio state only. Explicit screen mousedown after loading/transition completion enters the laptop view. Start/UI input and forwarded iframe input are excluded from background desk/idle toggling. Existing leave/drag behavior is retained after an explicit entry. Desk/overview framing is widened to include the full drawer travel; FOV, orbit sweep, normal-view parallax and exact laptop-screen framing remain unchanged.

## Review limits

The moving front retains baked lighting painted for the closed position; its UVs are deliberately not rebaked. New interior geometry uses real-time lighting. Henry's inherited desk/texture redistribution flag in ASSETS.md remains unresolved for a future public release; this update stays local. Brand marks in the downloaded perfume/headphone models remain their owners' property.
