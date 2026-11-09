# Surya K — 3D portfolio

An interactive portfolio: a 3D desk scene rendered with Three.js, with a working desktop on the in-scene screen. The desktop is a separate same-origin page (`src/desktop`) shown through a CSS3D iframe.

> **Work in progress.** The scene uses CC-BY laptop and speaker models, the original project's desk and chair (temporary; licensing unconfirmed), and placeholder geometry for the other desk objects. The desk, chair, UI icons and favicon come from the original project, and must not be deployed publicly until their rights are confirmed or they're replaced. See [ASSETS.md](ASSETS.md).

## Credits

This project is built on Henry Heffernan's open-source 3D portfolio ([henryjeff/portfolio-website](https://github.com/henryjeff/portfolio-website)), used under the MIT License. The original copyright notice is kept in [LICENSE.md](LICENSE.md).

The laptop is "Laptop Dell Latitude 5400" by [Yolala1232](https://sketchfab.com/Yolala1232), and the speakers are "Speaker Bookshelf V2 - Optimized" by [rendysix](https://sketchfab.com/ironmenleader). Both are licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) and modified. Third-party libraries and models are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## 3D models

Optimised models are built from downloaded sources by dependency-free scripts. See [tools/model-pipeline/README.md](tools/model-pipeline/README.md).

World units are millimetres. Composition and camera framing live in `src/Application/World/SceneLayout.ts`.

## Development

```bash
npm ci            # install the exact versions in package-lock.json
npm run dev       # dev server with live reload (prints its URL)
```

- 3D scene: `/`. Append `?debug` for an FPS panel and `#debug` for lil-gui.
- Desktop on its own: `/desktop/`. Append `?mode=compact` to force the phone layout.
- About page on its own: `/about/`. It's also shown inside the desktop's **Who Am I?** browser.

## Production build

```bash
npm run build     # writes the static site to public/
npm run preview   # serves public/ at http://127.0.0.1:4173
```

The output is fully static. Any static host can serve `public/`, and there is no backend.

## Editing the desktop content

All portfolio text lives in `src/desktop/content/`. See [src/desktop/content/README.md](src/desktop/content/README.md).
