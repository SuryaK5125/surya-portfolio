import EventEmitter from './EventEmitter';

export default class Sizes extends EventEmitter {
    width: number;
    height: number;
    pixelRatio: number;

    constructor() {
        super();

        // Setup
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.pixelRatio = Math.min(window.devicePixelRatio, window.matchMedia('(max-width: 700px), (max-height: 500px) and (pointer: coarse)').matches ? 1.5 : 2);

        // Resize event
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.pixelRatio = Math.min(window.devicePixelRatio, window.matchMedia('(max-width: 700px), (max-height: 500px) and (pointer: coarse)').matches ? 1.5 : 2);

            this.trigger('resize');
        });
    }
}
