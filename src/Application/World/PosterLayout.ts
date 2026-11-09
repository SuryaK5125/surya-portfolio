import { WALL_Z } from './SceneLayout';

/**
 * Wall poster layout. Edit this file to swap or move posters; WallPosters.ts
 * only turns these entries into meshes.
 *
 * Units are millimetres, like the rest of the scene: x runs left to right
 * (the laptop is at x = 0), y is height above the desk surface (y = 0).
 *
 * The image files live in static/textures/posters/local/. They are fan
 * posters by other artists, shown with their sources in the desktop's
 * Credits app (src/desktop/content/credits.ts). A missing file leaves a
 * blank sheet of paper.
 */

export const POSTER_FOLDER = 'textures/posters/local/';

export const PAPER = {
    A4: { width: 210, height: 297 },
    /** A3 turned sideways */
    A3L: { width: 420, height: 297 },
} as const;

export type Paper = (typeof PAPER)[keyof typeof PAPER] | { width: number; height: number };

export type PosterDef = {
    id: string;
    /** File name inside POSTER_FOLDER */
    file: string;
    /** Sheet size in mm: a PAPER entry, or any { width, height } */
    paper: Paper;
    /** Centre of the sheet, mm */
    x: number;
    /** Bottom edge of the sheet above the desk surface, mm */
    bottom: number;
};

/** Gap between neighbouring sheets in a row or stack */
const SIDE_GAP = 12;
const STACK_GAP = 22;

const A4 = PAPER.A4;

// The Star Destroyer print is a wide (2.16:1) landscape, shown larger than a
// plain A3 sheet and cut to the print's own proportions, so it has no margin.
const STAR_DESTROYER = { width: 580, height: 269 };

// Centre group, behind the laptop: three A4 car posters in a row (the 911 in
// the middle) with the Star Destroyer centred above them. Kept low enough
// that the whole wall stays inside the desk camera's view.
const centreBottom = 175;
const rowStep = A4.width + SIDE_GAP;
const topBottom = centreBottom + A4.height + STACK_GAP;

// Left stack: two A4 flower posters, one above the other, hung behind the headphones (x -835).
const leftX = -840;
const leftTop = centreBottom + A4.height + STACK_GAP;

// Right pair: two A4 video-game posters side by side, vertically centred
// between the car row's bottom and the Star Destroyer's top. The left edge
// stays about 140 mm from the M3 poster.
const rightX = 700;
const rightBottom = (centreBottom + topBottom + STAR_DESTROYER.height - A4.height) / 2;

export const POSTERS: PosterDef[] = [
    { id: 'f40', file: 'f40.jpg', paper: A4, x: -rowStep, bottom: centreBottom },
    { id: 'porsche-911', file: 'porsche-911.jpg', paper: A4, x: 0, bottom: centreBottom },
    { id: 'm3-e30', file: 'm3-e30.jpg', paper: A4, x: rowStep, bottom: centreBottom },
    { id: 'star-destroyer', file: 'star-destroyer.jpg', paper: STAR_DESTROYER, x: 0, bottom: topBottom },

    { id: 'blue-orchid', file: 'blue-orchid.jpg', paper: A4, x: leftX, bottom: leftTop },
    { id: 'tsubaki', file: 'tsubaki.jpg', paper: A4, x: leftX, bottom: centreBottom },

    { id: 'gos-game', file: 'gos-game.jpg', paper: A4, x: rightX - rowStep / 2, bottom: rightBottom },
    { id: 'resident-evil-4', file: 'resident-evil-4.jpg', paper: A4, x: rightX + rowStep / 2, bottom: rightBottom },
];

/** Gap between paper and wall: lets the key light cast a soft contact shadow */
export const MOUNT_Z = WALL_Z + 2;
