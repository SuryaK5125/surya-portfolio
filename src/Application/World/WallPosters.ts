import * as THREE from 'three';
import { MOUNT_Z, POSTERS, POSTER_FOLDER, PosterDef } from './PosterLayout';

const PAPER_DEPTH = 0.7;
// The print floats this far in front of the paper. It must be well above the
// depth buffer's resolution at viewing distance, or the two surfaces z-fight
// (white flicker across the poster whenever the camera moves).
const PRINT_LIFT = 0.6;
const TACK_COLOR = 0xa9b3bd;

/**
 * Prints on paper, pressed to the wall with a dab of putty at each corner.
 * Layout and file names live in PosterLayout.ts. Each image is fitted inside
 * its sheet without changing its ratio; the sheet takes the colour of the
 * print's border, so any spare margin reads as part of the print. If an image
 * cannot be loaded, a blank sheet stays on the wall.
 */
export default function createWallPosters(maxAnisotropy = 4, preloaded?: { [name: string]: THREE.Texture }) {
    const group = new THREE.Group();
    group.name = 'Wall posters';
    const loader = new THREE.TextureLoader();
    const tackGeometry = new THREE.CylinderGeometry(4.2, 4.6, 1.6, 16);
    tackGeometry.rotateX(Math.PI / 2);
    const tackMaterial = new THREE.MeshStandardMaterial({ color: TACK_COLOR, roughness: 0.85, metalness: 0 });

    const mount = (def: PosterDef) => {
        const { width, height } = def.paper;
        const centreY = def.bottom + height / 2;
        const sheet = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, PAPER_DEPTH),
            new THREE.MeshStandardMaterial({ color: 0xe9e7e0, roughness: 0.96, metalness: 0, envMapIntensity: 0.1 })
        );
        sheet.name = `Poster ${def.id}: paper`;
        sheet.position.set(def.x, centreY, MOUNT_Z);
        sheet.castShadow = true;
        sheet.receiveShadow = true;
        group.add(sheet);

        const frontZ = MOUNT_Z + PAPER_DEPTH / 2;
        for (const sx of [-1, 1]) {
            for (const sy of [-1, 1]) {
                const tack = new THREE.Mesh(tackGeometry, tackMaterial);
                tack.name = `Poster ${def.id}: putty`;
                tack.position.set(def.x + sx * (width / 2 - 5), centreY + sy * (height / 2 - 5), frontZ + PRINT_LIFT + 0.8);
                tack.castShadow = true;
                group.add(tack);
            }
        }

        const addPrint = (texture: THREE.Texture) => {
            const image = texture.image as HTMLImageElement;
            texture.encoding = THREE.sRGBEncoding;
            texture.anisotropy = maxAnisotropy;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            const scale = Math.min(width / image.width, height / image.height);
            const print = new THREE.Mesh(
                new THREE.PlaneGeometry(image.width * scale, image.height * scale),
                new THREE.MeshStandardMaterial({
                    map: texture,
                    roughness: 0.94,
                    metalness: 0,
                    envMapIntensity: 0.1,
                    // Always wins the depth test against the paper behind it
                    polygonOffset: true,
                    polygonOffsetFactor: -2,
                    polygonOffsetUnits: -4,
                })
            );
            print.name = `Poster ${def.id}: print`;
            print.position.set(def.x, centreY, frontZ + PRINT_LIFT);
            // The paper sits just behind the print, so receiving shadows here only adds acne
            print.receiveShadow = false;
            group.add(print);
            (sheet.material as THREE.MeshStandardMaterial).color.copy(borderColour(image));
        };
        if (preloaded) {
            const texture = preloaded[`poster:${def.id}`];
            if (texture) addPrint(texture);
        } else {
            loader.load(`${POSTER_FOLDER}${def.file}`, addPrint, undefined,
                () => console.warn(`Poster image missing, leaving blank paper: ${POSTER_FOLDER}${def.file}`));
        }
    };

    POSTERS.forEach(mount);
    return group;
}

/** Average colour of the four corners of an image (linear), for the paper margin. */
function borderColour(image: HTMLImageElement) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return new THREE.Color(0xe9e7e0);
    context.drawImage(image, 0, 0, size, size);
    let r = 0, g = 0, b = 0;
    const corners = [[1, 1], [size - 2, 1], [1, size - 2], [size - 2, size - 2]];
    for (const [x, y] of corners) {
        const [cr, cg, cb] = context.getImageData(x, y, 1, 1).data;
        r += cr; g += cg; b += cb;
    }
    return new THREE.Color(r / 1020, g / 1020, b / 1020).convertSRGBToLinear();
}
