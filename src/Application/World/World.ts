import * as THREE from 'three';
import Application from '../Application';
import Resources from '../Utils/Resources';
import Laptop from './Laptop';
import MonitorScreen from './MonitorScreen';
import Lighting from './Lighting';
import Stage from './Stage';
import DeskProps from './DeskProps';
import DeskAndChair from './DeskAndChair';
import Speakers from './Speakers';
import LegoPorsche from './LegoPorsche';
import AudioManager from '../Audio/AudioManager';
import ContactShadows from './ContactShadows';

export default class World {
    application: Application;
    scene: THREE.Scene;
    resources: Resources;

    // Objects in the scene
    lighting: Lighting;
    stage: Stage;
    props: DeskProps;
    deskAndChair: DeskAndChair;
    speakers: Speakers;
    porsche: LegoPorsche;
    laptop: Laptop;
    monitorScreen: MonitorScreen;
    audioManager: AudioManager;
    contactShadows: ContactShadows;

    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;
        this.resources = this.application.resources;
        // Wait for resources
        this.resources.on('ready', () => {
            this.lighting = new Lighting();
            this.stage = new Stage();
            this.deskAndChair = new DeskAndChair();
            this.speakers = new Speakers();
            this.props = new DeskProps();
            this.porsche = new LegoPorsche();
            this.laptop = new Laptop();
            this.monitorScreen = new MonitorScreen(this.laptop.screenFrame);
            this.lighting.addScreenLight(this.laptop.screenFrame);
            // After every object is placed: footprints are measured from them
            this.contactShadows = new ContactShadows();
            this.lighting.applyEnvironmentIntensity();
            this.audioManager = new AudioManager();
        });
    }

    update() {
        if (this.deskAndChair) this.deskAndChair.drawer.update();
        if (this.monitorScreen) this.monitorScreen.update();
    }
}
