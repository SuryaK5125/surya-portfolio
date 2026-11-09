import { POSTERS, POSTER_FOLDER } from './World/PosterLayout';

const sources: Resource[] = [
    { name: 'cube2Model', type: 'gltfModel', path: 'models/Props/cube-2x2.glb', phase: 'background' },
    { name: 'cube3Model', type: 'gltfModel', path: 'models/Props/cube-3x3.glb', phase: 'background' },
    { name: 'cube4Model', type: 'gltfModel', path: 'models/Props/cube-4x4.glb', phase: 'background' },
    { name: 'headphoneModel', type: 'gltfModel', path: 'models/Props/headphones.meshopt.glb' },
    { name: 'mouseModel', type: 'gltfModel', path: 'models/Props/mouse.meshopt.glb' },
    // "Office Chair Modern" by thethieme, CC-BY-4.0 (tools/model-pipeline/build-chair.js)
    { name: 'chairModel', type: 'gltfModel', path: 'models/Props/chair.meshopt.glb' },
    {
        // Dell Latitude 5400 by Yolala1232, CC-BY-4.0 (see ASSETS.md);
        // built by tools/model-pipeline/build-laptop.js
        name: 'laptopModel',
        type: 'gltfModel',
        path: 'models/Laptop/laptop.meshopt.glb',
    },
    {
        // LEGO 10295 Porsche 911 by Sleepy Sea Otter, CC-BY-4.0 (see ASSETS.md);
        // built by tools/model-pipeline/blender/optimize_porsche.py + build-porsche.js
        name: 'porscheModel',
        type: 'gltfModel',
        path: 'models/Porsche/porsche.meshopt.glb',
    },
    {
        // Bookshelf speaker by rendysix, CC-BY-4.0 (see ASSETS.md);
        // built by tools/model-pipeline/build-speaker.js
        name: 'speakerModel',
        type: 'gltfModel',
        path: 'models/Speaker/speaker.meshopt.glb',
    },
    {
        // TEMPORARY: original project's desk and chair (see ASSETS.md)
        name: 'deskModel',
        type: 'gltfModel',
        path: 'models/World/environment.glb',
    },
    {
        // Baked texture with the old desk objects' footprints removed
        // (tools/model-pipeline/clean-desk-texture.js)
        name: 'deskTexture',
        type: 'texture',
        path: 'models/World/baked_environment_desk.jpg',
    },
    // Visible artwork is part of the first complete frame, not a late pop-in.
    ...POSTERS.map(poster => ({ name: `poster:${poster.id}`, type: 'texture' as const, path: `${POSTER_FOLDER}${poster.file}`, optional: true })),
];

// Fetch desk + display first, then other visible objects, then wall prints.
const priority = ['deskModel', 'deskTexture', 'laptopModel'];
sources.sort((a, b) => {
    const rank = (source: Resource) => {
        const index = priority.indexOf(source.name);
        return index >= 0 ? index : source.name.startsWith('poster:') ? 4 : 3;
    };
    return rank(a) - rank(b);
});

export default sources;
