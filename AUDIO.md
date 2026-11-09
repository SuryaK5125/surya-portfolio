# Interaction audio audit

The inherited audio system and all **17 recordings (22,673,453 bytes)** have been removed. Eleven of those files were previously loaded and copied into production (1,105,711 bytes).

## Removed recordings and triggers

All paths below were under `static/audio/`; no copies remain in the production source tree.

| Files | Previous use | Replacement |
|---|---|---|
| `mouse/mouse_down.mp3`, `mouse/mouse_up.mp3` | Every forwarded laptop mouse down/up | Quiet original synthesized tick only on selected desktop control clicks |
| `keyboard/key_1.mp3` through `key_6.mp3` | Forwarded laptop keydown, random sample | Removed; ordinary typing stays silent |
| `cc/type.mp3` | Synthetic `_AUTO_` keydown / overlay typing | Removed, including the legacy self-message channel; intro stays silent |
| `startup/startup.mp3` | Loading completion | Removed; no startup or enable sound |
| `atmosphere/office.mp3` | Loading completion, continuously looped and filtered with camera distance | Removed; no ambience or camera-linked audio |
| `atmosphere/office.ogg` | Unused alternative | Deleted |
| `computer/idle.wav`, `computer/idle_2.wav` | Unused | Deleted |
| `radio/1.mp3`, `radio/2.mp3`, `radio/3.mp3` | Unused | Deleted |

The audio resource entries, Three.js audio loader/listener/positional meshes, per-frame ambience update, file-loader rule and direct `file-loader` dependency were removed. Webpack excludes `**/audio/**` as an additional guard against accidentally reintroducing archived recordings. The preview server's generic MIME mappings are not assets or playback dependencies and remain supported. The currently hidden Music app is an album browser, with no audio element, files or playback code; it was left unchanged.

## Original sound design and provenance

All recipes are newly written project code in `src/Application/Audio/AudioSources.ts`, licensed under the project's MIT license. There are **no external samples, proprietary sounds, copied Windows tones, music or AI-generated audio**; no CC0 download or third-party sound attribution is necessary.

| Cue | Recipe | Trigger |
|---|---|---|
| `tap` | 35 ms sine tick, 620 → 420 Hz, 3 ms attack and exponential decay | Native click / keyboard-activated click on desktop icons, Start, task buttons, Show desktop, window controls or Start menu items |
| `dismiss` | 35 ms sine tick, 390 → 260 Hz | Desktop window Close control |
| `drawer-open` | 240 ms seeded noise, bandpass 650 Hz, low 130 → 85 Hz body resonance | Actual top-drawer handle/front activation that changes closed to open |
| `drawer-close` | Same original short slide, bandpass 480 Hz | Handle, Close drawer or Escape activation that changes open to closed |

Envelope peaks are at most 0.13, followed by a master gain of 0.2. All sources have finite stop times (at most 250 ms), no looping and complete node cleanup. At most four voices coexist; repeated requests are limited to one per 60 ms. Reversing the drawer stops its previous slide sound. These are mechanical cues, not melodies or notification chimes.

## Consent and lifecycle

- Every fresh page starts at **Sound off**, with no persisted opt-in and no AudioContext created during loading, intro typing or initial camera flight.
- The existing Sound control sends its native trusted activation synchronously; only explicit enable creates/resumes the single shared context. Enabling itself is silent.
- Muting immediately zeroes the master gain and stops/disconnects all active voices. A pending resume cannot undo a later mute. Resume/unsupported-browser failures revert the control to Sound off without disrupting the scene.
- Room sound requests require a trusted input event. Desktop effects use a separate same-origin message channel from the screen iframe, restricted to its exact window, two allowed cue names and transient user activation where supported. The sending bridge requires a native trusted click, including touch and keyboard activation, and ignores disabled controls and programmatic clicks.
- Suspended-context requests are discarded, never queued. If the browser suspends audio, Sound off/on explicitly resumes it. Hiding the page stops current effects and drops hidden-page requests while preserving the toggle choice. Leaving the page resets Sound off, including bfcache return. Becoming visible never starts or resumes audio.
- Hover, drag, scrolling, text entry, intro typing, loading, records popup, free camera, laptop enter/exit and all camera transitions are silent. Drawer sounds are bound to the physical drawer action, never to the camera transition that accompanies it.
- The room's sound choice also governs desktop effects; the iframe creates no separate audio context. The standalone desktop stays silent.
- Application teardown removes listeners, stops voices and closes the context.

## Verification

Run `node tools/check-audio.js` for opt-in/muting/resume-race/source-cleanup/message validation and actual synthesis scheduling checks. After `npm run build`, run `node tools/check-audio.js --production` to confirm no recorded audio is emitted and no original runtime paths/loaders remain. `--browser` additionally writes ignored local QA pages into `public/` to exercise the actual recipes/controller/desktop bridge against the browser's native AudioContext, with visible source/cleanup counters, plus an instrumented copy of the actual built scene for integration checks. Those pages are local verification aids, never committed or deployed.

Also run TypeScript, intro, scene-input, camera and drawer regression checks. Use the production preview to confirm Sound off on refresh, silent camera/hover behavior, drawer and desktop interactions, repeated toggling and no visual changes. Listening level remains device-dependent; the conservative gain is intentional.

Verified against the built scene in the local Chromium preview: opening flight and intro produced zero contexts/sources; Sound on created one context without a cue; opening the real top drawer produced one finite cue; drawer camera switches and records did not increase the count; muting before closing produced no cue. Laptop entry/exit remained silent, Projects open/close produced the selected ticks when enabled, and Projects still opened silently when muted. The original three PB records and drawer/camera behavior were checked visually. Native keyboard activation through the iframe also produced the expected tick, synthetic clicks were silent, re-enabling reused the context, and a fresh load again had zero contexts. No new runtime audio errors or autoplay warnings were reported; build output retains its existing asset/entrypoint size warnings.
