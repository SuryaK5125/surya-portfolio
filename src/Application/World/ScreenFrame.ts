import * as THREE from 'three';

/**
 * World-space frame of a display's active area: local +X right, +Y up,
 * +Z out of the screen. Sizes in world units (mm).
 */
export type ScreenFrame = {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    normal: THREE.Vector3;
    width: number;
    height: number;
};

/** Reads the frame from a GLB node carrying `extras.screen = { width, height }`. */
export function readScreenFrame(node: THREE.Object3D): ScreenFrame {
    const info = node.userData && node.userData.screen;
    if (!info || !(info.width > 0) || !(info.height > 0)) {
        throw new Error(`"${node.name}" has no screen size in its extras`);
    }
    node.updateWorldMatrix(true, false);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    node.matrixWorld.decompose(position, quaternion, scale);
    return {
        position,
        quaternion,
        normal: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
        width: info.width * scale.x,
        height: info.height * scale.y,
    };
}
