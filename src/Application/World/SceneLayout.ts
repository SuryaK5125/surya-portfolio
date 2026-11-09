import * as THREE from 'three';

/**
 * Scene composition. World units are millimetres; the desk surface is y = 0
 * and the camera looks towards −Z (the wall).
 *
 * The laptop's screen frame comes from its GLB ("Screen" node), so only the
 * placement of the laptop itself is set here.
 */

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const deg = THREE.MathUtils.degToRad;

export const LAPTOP = {
    position: v(0, 0, 0),
    rotationY: 0,
};

/**
 * TEMPORARY: the original project's desk and chair (environment.glb).
 * Its units map to millimetres at 263.53 mm/unit, which makes the desk
 * 740 mm tall, 1776 × 816 mm; its old monitor position becomes x = 0 and its
 * desk top becomes y = 0. Source desk-top bounds: x −3.986…2.757,
 * z −1.274…1.821, top y −0.502.
 */
const HENRY_UNIT_MM = 263.53;
const HENRY_DESK_TOP_Y = -0.502;
const HENRY_Z_OFFSET = 0.834; // puts the desk's front edge 120 mm in front of the laptop
export const HENRY_DESK = {
    scale: HENRY_UNIT_MM,
    position: v(0, -HENRY_DESK_TOP_Y * HENRY_UNIT_MM, -HENRY_Z_OFFSET * HENRY_UNIT_MM),
    // Desk-top rectangle in world space (for the contact-shadow catcher)
    top: {
        minX: -3.986 * HENRY_UNIT_MM,
        maxX: 2.757 * HENRY_UNIT_MM,
        minZ: (-1.274 - HENRY_Z_OFFSET) * HENRY_UNIT_MM,
        maxZ: (1.821 - HENRY_Z_OFFSET) * HENRY_UNIT_MM,
    },
};

// A 75 mm clearance behind the desktop; the compact central cove clears its feet.
export const WALL_Z = -630;
export const FLOOR_Y = -743;

// Bookshelf speakers (≈189 × 300 × 224 mm) flanking the laptop, slight toe-in
export const SPEAKERS = {
    left: { position: v(-470, 0, -320), rotationY: deg(10) },
    right: { position: v(470, 0, -320), rotationY: deg(-10) },
};

// Leave breathing room between the front-left car and the headphone base behind it.
export const HEADPHONES = {
    position: v(-835, 0, -225),
    rotationY: deg(14),
};

// LEGO 10295 Porsche 911, nose +X, approximately 356 × 160 × 109 mm.
export const LEGO_CAR = {
    position: v(-650, 0, 100),
    rotationY: deg(-8),
};

export const MOUSE = {
    position: v(320, 3.5, 65),
    rotationY: deg(-8),
};

// "Office Chair Modern" (720 × 966 × 760 mm; seat faces −Z at rotation 0).
// Square to the desk in front of the laptop, pulled out just enough for its
// arms to clear the desk front (front edge z ≈ 260), with a slight turn.
export const CHAIR = {
    position: v(170, -743, 640),
    rotationY: deg(-7),
};

// Camera framing
export const CAMERA = {
    fov: 35,
    near: 5,
    far: 120000,
    desk: {
        // Include the poster stack and fully extended top drawer.
        position: v(-150, 800, 2050),
        focalPoint: v(-150, 160, -100),
        // Parallax (mm) at the edges of the viewport
        parallax: { position: v(90, 45, 0), focalPoint: v(45, 25, 0) },
        // Dolly back on viewports narrower than the reference aspect
        referenceAspect: 16 / 9,
        // Cap for portrait phones: beyond this the camera leaves the room and
        // the desk shrinks to a speck; at 2× the laptop and both speakers fit.
        maxDolly: 2,
    },
    drawer: {
        position: v(-670, 930, 1240),
        focalPoint: v(-650, -60, 350),
    },
    idle: {
        focalPoint: v(-120, 110, -150),
        radius: 2550,
        height: 760,
        heightBob: 140,
        sweep: deg(36),
    },
    // Behind the loading screen the camera already waits at the intro's first shot.
    loading: {
        position: v(1900, 1250, 1500),
        focalPoint: v(300, 380, -380),
    },
    // Opening flight: from a raised three-quarter view of the wall, speakers
    // and posters, gliding round in front of the desk and settling on the
    // seated desk view (the live desk keyframe is the final point).
    intro: {
        path: [
            { position: v(1900, 1250, 1500), focalPoint: v(300, 380, -380) },
            { position: v(1150, 1050, 2550), focalPoint: v(20, 260, -280) },
        ],
        duration: 5600,
        // Gentle start, long soft landing (cubic-bezier control points)
        easing: [0.42, 0, 0.12, 1] as [number, number, number, number],
    },
    orbitStart: {
        position: v(-1300, 900, 1500),
        focalPoint: v(-120, 120, -150),
    },
    orbit: {
        minDistance: 350,
        maxDistance: 3500,
        // Camera.ts narrows this by the viewport's horizontal field of view,
        // so even edge rays keep looking into the open studio sweep.
        maxAzimuth: deg(65),
    },
    monitor: {
        // Distance multiplier beyond an exact fit, so a sliver of bezel shows
        margin: 1.05,
    },
};
