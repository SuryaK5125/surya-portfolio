/**
 * Content of the Credits app. Edit freely: `madeHere` is what was made for
 * this portfolio; the other lists credit outside work, with links to where it
 * came from. Keep every outside asset listed here and in ASSETS.md.
 */

export type CreditLink = { label: string; url: string };

export type OutsideCredit = {
    name: string;
    /** Who made it */
    by?: string;
    byUrl?: string;
    /** e.g. 'CC BY 4.0' */
    license?: string;
    licenseUrl?: string;
    /** Where it came from */
    source: string;
    /** Optional note on what was changed or on trademarks; shown on request */
    notes?: string;
};

export type MadeHere = { title: string; text: string };

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

export const madeHere: MadeHere[] = [
    {
        title: 'The Windows 7-style desktop',
        text: 'The window manager, taskbar and Start menu, plus File Explorer (with its virtual filesystem), Command Prompt, Projects, Experience, Resume, Contact, Wallpaper Studio and this Credits window. The glass styling is written in CSS.',
    },
    {
        title: 'Icons, wallpapers and the Minecraft-inspired theme',
        text: 'The icons are hand-written SVG. The wallpapers Aero Arcs, Deep Water, Warm Dusk and Graphite are drawn in code. The Minecraft-inspired theme, including its pixel landscape, is original CSS and SVG with no Minecraft textures, fonts or sounds.',
    },
    {
        title: 'The room and its finish',
        text: 'The plaster wall, micro-cement floor and walnut desk veneer are generated procedurally. The lighting, soft contact shadows, wall poster layout and mounting are also written for this scene.',
    },
    {
        title: 'The speedcubing drawer',
        text: 'The drawer mechanism, felt liner, mousepad and the unbranded speedcubing timer with its personal-best records are original. The cubes are a credited model (see Credits and sources).',
    },
    {
        title: 'The Who Am I? page, words and photographs',
        text: 'The page design, the story, the project and experience write-ups and the photographs are my own. No AI-generated images, textures or models are used anywhere.',
    },
];

export const inspiration: OutsideCredit[] = [
    {
        name: 'Website idea and 3D scene foundation',
        by: 'Henry Heffernan',
        byUrl: 'https://henryheffernan.com/',
        license: 'MIT License',
        source: 'https://github.com/henryjeff/portfolio-website',
        notes: 'The rendering, camera and screen systems derive from his open-source portfolio. The temporary desk and its baked texture are also from it.',
    },
];

export const models: OutsideCredit[] = [
    {
        name: 'LEGO 10295 Porsche 911 (Turbo)',
        by: 'Sleepy Sea Otter',
        byUrl: 'https://sketchfab.com/sleepyseaotter',
        license: 'CC BY 4.0',
        licenseUrl: CC_BY,
        source: 'https://sketchfab.com/3d-models/lego-10295-porsche-911-turbo-73d0cef548c04c3f9b6cef9871ea8d52',
        notes: 'Changed: stud logos and hidden parts removed, simplified, meshes merged by colour, colours adjusted, re-scaled. LEGO is a trademark of the LEGO Group; Porsche and the Porsche crest are trademarks of Dr. Ing. h.c. F. Porsche AG. This site is not affiliated with or endorsed by either.',
    },
    {
        name: 'Headphone with stand',
        by: 'Halil Kantarci',
        byUrl: 'https://sketchfab.com/halilkantarci',
        license: 'CC BY 4.0',
        licenseUrl: CC_BY,
        source: 'https://sketchfab.com/3d-models/headphone-with-stand-4ffedc9bffad4a549f6e0a46b0f92b05',
        notes: 'Changed: geometry simplified, shared earcup finish, optional layers removed, textures reduced, grounded at 300 mm tall.',
    },
    {
        name: 'Laptop Dell Latitude 5400',
        by: 'Yolala1232',
        byUrl: 'https://sketchfab.com/Yolala1232',
        license: 'CC BY 4.0',
        licenseUrl: CC_BY,
        source: 'https://sketchfab.com/3d-models/laptop-dell-latitude-5400-c3dfc53a600e427c9db9be83aec9860d',
        notes: 'Changed: materials converted and simplified, meshes merged, stickers and screen image removed, re-scaled. Dell is a trademark of Dell Inc.; this site is not affiliated with or endorsed by Dell.',
    },
    {
        name: 'Speaker Bookshelf V2 - Optimized',
        by: 'rendysix',
        byUrl: 'https://sketchfab.com/ironmenleader',
        license: 'CC BY 4.0',
        licenseUrl: CC_BY,
        source: 'https://sketchfab.com/3d-models/speaker-bookshelf-v2-optimized-cbb87dee55e84a389cbccb4ddc0036e0',
        notes: 'Changed: materials adjusted, meshes merged, textures downsampled, re-scaled.',
    },
    {
        name: 'Computer mouse A4Tech bloody V7',
        by: 'Prokyovec',
        byUrl: 'https://sketchfab.com/fipro333',
        license: 'CC BY 4.0',
        licenseUrl: CC_BY,
        source: 'https://sketchfab.com/3d-models/computer-mouse-a4tech-bloody-v7-69e3f3ec5cc44b14afaa85c53db09c1f',
        notes: 'Changed: transforms baked, grounded at 125 mm long, geometry simplified from 136,520 to 40,400 triangles, similar plastics shared.',
    },
    {
        name: 'Office Chair Modern',
        by: 'thethieme',
        byUrl: 'https://sketchfab.com/thethieme',
        license: 'CC BY 4.0',
        licenseUrl: CC_BY,
        source: 'https://sketchfab.com/3d-models/office-chair-modern-675f34f7304e4d92812a41e9750539aa',
        notes: 'Changed: transforms baked, true size, turned to face the desk and grounded, textures reduced.',
    },
    {
        name: "Rubik's Cubes Solved And Unsolved",
        by: 'Default Digital',
        byUrl: 'https://sketchfab.com/defaultdigital',
        license: 'CC BY 4.0',
        licenseUrl: CC_BY,
        source: 'https://sketchfab.com/3d-models/rubiks-cubes-solved-and-unsolved-4906dda419924335b02332c69adb3d38',
        notes: 'Changed: only the solved 2x2, 3x3 and 4x4 kept, normalized to 50, 56 and 60 mm edges, merged with vertex colours.',
    },
];

export const posters: OutsideCredit[] = [
    { name: 'Ferrari F40 poster', source: 'https://in.pinterest.com/pin/1003176885757825280/' },
    { name: 'BMW E30 M3 poster', source: 'https://in.pinterest.com/pin/899312619346044827/' },
    { name: 'Porsche 911 poster', source: 'https://in.pinterest.com/pin/1003247254494803816/' },
    { name: 'Imperial Star Destroyer poster', source: 'https://www.pinterest.com/pin/559853797398470802/' },
    { name: 'Ghost of Tsushima poster', source: 'https://www.pinterest.com/ideas/ghost-of-tsushima-logo-no-background/946215481571/' },
    { name: 'Resident Evil 4 poster', source: 'https://in.pinterest.com/pin/1031535489645022539/' },
    { name: 'Flower poster', source: 'https://in.pinterest.com/pin/1108096683334616913/' },
    { name: 'Flower poster', source: 'https://in.pinterest.com/pin/909304981044055269/' },
];

export const wallpapers: OutsideCredit[] = [
    { name: 'Windows 7 Default (Img0)', by: 'Microsoft', source: 'https://windowswallpaper.miraheze.org/wiki/Img0_(Windows_7)' },
    { name: 'Autumn Leaves (Img6)', by: 'Microsoft', source: 'https://windowswallpaper.miraheze.org/wiki/Img6_(Windows_7)' },
    { name: 'Sky Turtle (Img19)', by: 'Microsoft', source: 'https://windowswallpaper.miraheze.org/wiki/Img19_(Windows_7)' },
];

export const libraries = 'three.js, React, framer-motion, tween.js, bezier-easing, lil-gui and stats.js (MIT License).';
