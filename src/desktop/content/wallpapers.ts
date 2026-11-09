import { Wallpaper } from './types';

/**
 * Wallpapers for Wallpaper Studio. The visitor's choice is remembered in
 * their browser (localStorage).
 *
 * Add your own static images under static/desktop/wallpapers/ (photos you
 * took, or images with a licence that allows redistribution; record them in
 * ASSETS.md) and list them here:
 *
 *   { id: 'lake', title: 'Lake at dusk', kind: 'image',
 *     src: 'wallpapers/lake.jpg', thumbnail: 'wallpapers/lake-thumb.jpg',
 *     credit: 'Photo by Surya K' },
 *
 * The first three entries are original backgrounds drawn in code.
 */
export const DEFAULT_WALLPAPER_ID = 'win7-default';

export const wallpapers: Wallpaper[] = [
    {
        id: 'aero-arcs',
        title: 'Aero Arcs',
        kind: 'builtin',
        credit: 'Original desktop artwork',
    },
    {
        id: 'deep-water',
        title: 'Deep Water',
        kind: 'css',
        css:
            'radial-gradient(ellipse at 30% 20%, #3fa3d8 0%, transparent 55%),' +
            'radial-gradient(ellipse at 80% 90%, #0f6b8f 0%, transparent 60%),' +
            'linear-gradient(160deg, #0b3f6b 0%, #06243f 100%)',
        credit: 'Original gradient',
    },
    {
        id: 'warm-dusk',
        title: 'Warm Dusk',
        kind: 'css',
        css:
            'radial-gradient(ellipse at 70% 110%, #f4a259 0%, transparent 55%),' +
            'radial-gradient(ellipse at 15% 10%, #5b6c9e 0%, transparent 60%),' +
            'linear-gradient(170deg, #2c2f55 0%, #5a3b52 55%, #b06a52 100%)',
        credit: 'Original gradient',
    },
    {
        id: 'graphite',
        title: 'Graphite',
        kind: 'css',
        css:
            'repeating-linear-gradient(135deg, #ffffff06 0 2px, transparent 2px 9px),' +
            'radial-gradient(ellipse at 50% 35%, #4a5561 0%, #1d2228 75%)',
        credit: 'Original pattern',
    },
    {
        id: 'win7-default',
        title: 'Windows 7 Default',
        kind: 'image',
        src: 'wallpapers/img0.jpg',
        credit: 'Windows 7 stock wallpaper (Img0), supplied by Surya K',
    },
    {
        id: 'win7-autumn',
        title: 'Autumn Leaves',
        kind: 'image',
        src: 'wallpapers/img6.jpg',
        credit: 'Windows 7 stock wallpaper (Img6), supplied by Surya K',
    },
    {
        id: 'sky-turtle',
        title: 'Sky Turtle',
        kind: 'image',
        src: 'wallpapers/img1.jpg',
        credit: 'Windows 7 stock wallpaper (Img19), supplied by Surya K',
    },
];
