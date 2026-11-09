# Speedcubing drawer

The drawer keeps Henry's original front/handle, UVs and baked material, its opaque cavity, 365mm travel, 650ms smooth animation, closed default and existing drawer-focus camera. The lower drawer stays fixed. Perfume bottles, fitted recesses and bottle inspection are removed; their GLBs are archived/excluded from the build.

## Assets and rebuild

`Rubik's Cubes Solved And Unsolved` by Default Digital is CC BY 4.0. The downloaded license and glTF metadata agree. Only the nodes named `2x2 Solved`, `3x3 Solved` and `4x4 Solved` are selected. Source geometry and all sticker colours remain intact. Seven source materials are merged into one per cube through linear vertex colours, with positions quantized to 0.02mm and normals to int8; no textures are needed. Each solved face remains a single colour. Source files are untouched.

```text
node tools/model-pipeline/build-cubes.js
node tools/model-pipeline/check-drawer.js
node tools/model-pipeline/check-drawer-runtime.js
node tools/model-pipeline/check-camera-detail.js
node tools/model-pipeline/check-scene-input.js
node tools/model-pipeline/check-intro-reveal.js
node node_modules/typescript/bin/tsc --project src/tsconfig.json --noEmit
npm run build
```

| Variant | Edge | Triangles | Draw calls |
|---|---:|---:|---:|
| Solved 2x2 | 50mm | 352 | 1 |
| Solved 3x3 | 56mm | 1,188 | 1 |
| Solved 4x4 | 60mm | 2,816 | 1 |

These are representative handheld dimensions, not verified product measurements. Cubes sit at different yaw angles on a plain 2.5mm fabric liner. Their source proportions remain uniform. Placement bounds check the drawer sides/front/back and collisions between props. All contents share the moving drawer parent and return without drift.

The timer is original, unbranded geometry in `src/Application/World/CubingTimer.ts`, created after the user selected this alternative. It has a 275.3 x 88.5mm body, 29.6mm overall height, and 5,796 triangles in eight material meshes. The tapered moulded shell has a separate rubber underside/feet, recessed circular metal sensors with concentric tool lines and tactile ribs, screw seats, a pitched LCD housing, and three physical buttons with geometric legends. Its fixed geometric `0:00.00` display is a records affordance, not a working stopwatch. Repeated pieces are baked into shared material meshes so three.js r137's bounds reflect the actual geometry; no unaccounted instance offsets cause floating. No downloaded geometry, reference imagery, textures or logos are used. The plain liner and timer receive contact shadows.

## Records configuration and interaction

Edit `src/desktop/content/cubing.ts`. Event names, displayed times and format label are configurable. The three records use the user-requested **Ao5** label (Average of 5):

| Event | Record |
|---|---|
| 2x2 | 13.62 s |
| 3x3 | 33.59 s |
| 4x4 | 2:41.31 |

Set a time to `null` for the explicit `Not set` placeholder. Values are inserted as text, never HTML.

Hovering the visible timer opens the small screen-space neutral information overlay anchored beside the timer, outside the projected drawer contents and kept inside the viewport (above the contents on narrow screens). A short 140ms leave grace lets the pointer cross into the panel. Moving away hides it. Clicking/tapping the timer also opens it; outside click, Dismiss and Escape dismiss it. The `Records` text control opens on keyboard focus or click/touch. The panel exposes a labelled region, an expanded-state relationship, tabular numeric times, and a dismiss button. Escape dismisses records before it can close the drawer. Focus moving out dismisses the panel. Closing the drawer or leaving the detail camera hides it. A short contextual hint identifies the handle/Escape closing action. Compact square text labels offer Records, Close drawer (also returns to the desk), and Desk view (leaves the drawer open). Drawer view returns to the open drawer; the distant records control is hidden until that view is active. Cube clicks do not change the camera. Top-front/handle click retains its previous smooth open/close/focus behavior.

## Scene identification and UI polish

The room introduction has two tightly fitted, solid-black labels with white monospace text, anchored at the bottom-left: **Surya Kalimuthu**, **B.Tech IT @ NIT Kurukshetra**. Both use 16px Courier with 4px/14px padding and a 4px gap on desktop. The second line does not wrap; mobile typography/padding scale down to preserve that treatment. Each row reserves its height while its background grows with the typed characters. There are no initials, date, clock or additional identification lines. Sound and Free camera remain separate at the bottom-right.

The name types first (55ms per character), followed by a 180ms pause and the second line. The reveal replays on every fresh page load, after the existing opening camera flight; there is **no local-storage cooldown**. Screen readers get each complete line immediately. Reduced motion displays the labels immediately and enabling it during typing completes/cancels the animation. Returning from drawer/laptop inspection does not repeat the reveal within that page. Timers/listeners are cleaned up on completion and unmount.

The PB overlay is a compact square records plaque: monochrome monospace typography, small event labels, larger aligned tabular times, fine rules, and a near-black surface. The bottom hint/actions use matching fitted square labels rather than default buttons. No gradients, rounded cards or blur. All data, hover/click/focus/dismissal logic, drawer mechanism and camera keyframes are unchanged. The existing projected placement keeps records away from the drawer contents and places them above the contents on narrow screens. The current chair, lighting, Who Am I page, desktop apps and Minecraft theme are unchanged.

The full-viewport grain renderer has been removed from `Renderer.ts`. **Grain is limited to the laptop glass**, where `MonitorScreen.ts` uses static noise with a maximum alpha contribution of 0.004 (previously animated noise at 0.035), much weaker smudges and shimmer. Room material textures remain on their physical meshes; there is no global grain canvas over the room, UI or browser content. The desktop iframe remains unchanged.

## License review: QiYi download excluded

The requested `Qiyi Timer scanned` by artmix044 is **Sketchfab Standard**, not CC BY. The downloaded license and source glTF metadata agree. Sketchfab's terms restrict delivery of an extractable standalone model file. Additional author permission was not available, and automatic approval review rejected static-GLB packaging. The user selected an original unbranded timer instead.

No QiYi mesh, texture, reference image or GLB is loaded or shipped. The downloaded license is retained only as a review record. Raw files and local inspection renders remain ignored under `assets-source/`. This project does not imply QiYi endorsement.

## Verification

The runtime check instantiates the actual drawer class with the actual packaged cube meshes and original timer. It verifies grounding/clearance, non-overlap, visibility from the unchanged focus camera, default hiding, lower-drawer rejection, animation reversal, joint movement and exact return. It exercises record values, hover enter/leave, keyboard focus/blur, click/touch-compatible controls, Escape, dismissal, popup clearance at wide/narrow sizes, timer geometry budget and returning to the desk without closing. Separate checks cover source drawer topology/UV preservation, actual camera tweens and click-only laptop entry. Browser QA checks the production render and input controls. The deterministic intro check exercises the actual scheduler, sequential character output, replay on fresh loads without storage, reduced-motion changes and cancellation.

Henry's existing desk/baked-texture licensing review flag remains unchanged in ASSETS.md.

The Xbox controller, loader entry, contact footprint, packaged GLB and build helper have been removed. The existing cube placements, drawer travel, timer and records interaction are preserved.

The Ao5 format label is focusable and exposes an associated “Average of 5” tooltip on hover or keyboard focus. Only three records are intended; the earlier mention of five records was confirmed as a typo. Free Camera selection distinguishes clicks from orbit drags, releases orbit control and focuses the drawer or laptop; drawer-to-laptop handoff and Back/Escape return remain supported.
