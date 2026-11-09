type Resource = (
    | TextureResource
    | CubeTextureResource
    | ModelResource) & { phase?: 'background'; optional?: boolean };

declare interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}

type TextureResource = {
    name: string;
    type: 'texture';
    path: string;
};

type CubeTextureResource = {
    name: string;
    type: 'cubeTexture';
    path: string[];
};

type ModelResource = {
    name: string;
    type: 'gltfModel';
    path: string;
};

type EnclosingPlane = {
    size: THREE.Vector2;
    position: THREE.Vector3;
    rotation: THREE.Euler;
};

type CameraKeyframe = {
    position: THREE.Vector3;
    focalPoint: THREE.Vector3;
};

type LoadedResource =
    | LoadedTexture
    | LoadedCubeTexture
    | LoadedModel;

type LoadedTexture = THREE.Texture;

type LoadedModel = import('three/examples/jsm/loaders/GLTFLoader').GLTF;

type LoadedCubeTexture = THREE.CubeTexture;

type ResourceType = 'texture' | 'cubeTexture' | 'gltfModel';

// Runtime decoder is bundled with Three.js 0.137; DefinitelyTyped omits it.
declare module 'three/examples/jsm/libs/meshopt_decoder.module.js' {
    export const MeshoptDecoder: {
        supported: boolean;
        ready: Promise<void>;
        decodeGltfBuffer(target: Uint8Array, count: number, stride: number, source: Uint8Array, mode: string, filter?: string): void;
    };
}
