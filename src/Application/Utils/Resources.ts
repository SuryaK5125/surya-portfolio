import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import Application from '../Application';
import UIEventBus from '../UI/EventBus';
import EventEmitter from './EventEmitter';
import Loading from './Loading';

/** First-frame objects gate entry. Hidden drawer assets never gate the desk. */
export default class Resources extends EventEmitter {
    sources: Resource[];
    items: {
        texture: { [name: string]: LoadedTexture };
        cubeTexture: { [name: string]: LoadedCubeTexture };
        gltfModel: { [name: string]: LoadedModel };
    } = { texture: {}, cubeTexture: {}, gltfModel: {} };
    toLoad: number;
    loaded = 0;
    loaders: { gltfLoader: GLTFLoader; textureLoader: THREE.TextureLoader; cubeTextureLoader: THREE.CubeTextureLoader };
    application: Application;
    loading: Loading;
    private backgroundTask?: Promise<void>;

    constructor(sources: Resource[]) {
        super();
        this.sources = sources;
        this.toLoad = sources.filter(source => source.phase !== 'background').length;
        this.application = new Application();
        this.loading = this.application.loading;
        this.loaders = {
            gltfLoader: new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
            textureLoader: new THREE.TextureLoader(),
            cubeTextureLoader: new THREE.CubeTextureLoader(),
        };
        this.startLoading();
        // After the complete scene has rendered, use the existing intro flight
        // to prepare the closed drawer. Clicking early promotes the same task.
        document.addEventListener('loadingScreenDone', () => {
            void this.ensureBackground().catch(error => console.warn('Drawer assets can be retried on open', error));
        }, { once: true });
    }

    private load(source: Resource): Promise<void> {
        if (this.items[source.type][source.name]) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
            const done = (file: LoadedResource) => { this.sourceLoaded(source, file); resolve(); };
            const failed = (error: unknown) => {
                if (source.optional) {
                    console.warn(`Optional artwork unavailable: ${source.path}`);
                    this.sourceLoaded(source);
                    resolve();
                } else reject(error);
            };
            if (source.type === 'gltfModel') this.loaders.gltfLoader.load(source.path, done, undefined, failed);
            else if (source.type === 'texture') this.loaders.textureLoader.load(source.path, file => {
                file.encoding = THREE.sRGBEncoding; done(file);
            }, undefined, failed);
            else this.loaders.cubeTextureLoader.load(source.path, done, undefined, failed);
        });
    }

    startLoading() {
        void Promise.all(this.sources.filter(source => source.phase !== 'background').map(source => this.load(source)))
            .then(() => this.trigger('ready'))
            .catch(error => {
                console.error('Initial scene asset failed', error);
                UIEventBus.dispatch('loadingFailed', {});
            });
    }

    /** Use the existing short camera entry only with positive HTTP-cache evidence.
     * No visit cookie/cooldown: a genuinely cold visit retains the full flight. */
    criticalFromCache(entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]): boolean {
        const critical = this.sources.filter(source => source.phase !== 'background' && !source.optional);
        return critical.length > 0 && critical.every(source => {
            const paths = Array.isArray(source.path) ? source.path : [source.path];
            return paths.every(path => {
                const url = new URL(path, document.baseURI).href;
                const entry = entries.filter(entry => entry.name === url).pop();
                return !!entry && entry.encodedBodySize > 0 && entry.transferSize < entry.encodedBodySize;
            });
        });
    }

    ensureBackground(): Promise<void> {
        if (!this.backgroundTask) {
            this.backgroundTask = Promise.all(this.sources.filter(source => source.phase === 'background').map(source => this.load(source)))
                .then(() => {
                    this.trigger('backgroundReady');
                    UIEventBus.dispatch('backgroundResourcesReady', {});
                }).catch(error => { this.backgroundTask = undefined; throw error; });
        }
        return this.backgroundTask;
    }

    sourceLoaded(source: Resource, file?: LoadedResource) {
        const maxAnisotropy = Math.min(4, this.application.renderer?.instance.capabilities.getMaxAnisotropy() || 1);
        const tune = (texture: THREE.Texture | null) => {
            if (!texture) return;
            texture.anisotropy = maxAnisotropy;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
        };
        if (file instanceof THREE.Texture) tune(file);
        else if (file) (file as LoadedModel).scene.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material: THREE.MeshStandardMaterial) => {
                [material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.aoMap, material.emissiveMap].forEach(tune);
            });
        });
        if (file) this.items[source.type][source.name] = file;
        if (source.phase === 'background') return;
        this.loaded++;
        this.loading.trigger('loadedSource', [source.name, this.loaded, this.toLoad]);
    }
}
