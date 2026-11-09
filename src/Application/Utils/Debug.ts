import type { GUI } from 'lil-gui';

export default class Debug {
    active: boolean;
    ui?: GUI;
    private destroyed = false;

    constructor() {
        this.active = window.location.hash === '#debug';
        if (this.active) {
            void import(/* webpackChunkName: "debug-tools" */ 'lil-gui').then(({ GUI }) => {
                if (!this.destroyed) this.ui = new GUI();
            });
        }
    }

    destroy() {
        this.destroyed = true;
        this.ui?.destroy();
    }
}
