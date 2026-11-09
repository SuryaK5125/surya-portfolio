import { SoundCue, SoundVoice, synthesize } from './AudioSources';

const isGesture = (event?: Event) => !!event?.isTrusted &&
    ['click', 'mousedown', 'pointerdown', 'keydown', 'touchend'].indexOf(event.type) !== -1;
const isCue = (cue: unknown): cue is SoundCue =>
    ['tap', 'dismiss', 'drawer-open', 'drawer-close'].indexOf(cue as string) !== -1;

type SoundWindow = Window & { webkitAudioContext?: typeof AudioContext };
type ActivationNavigator = Navigator & { userActivation?: { isActive: boolean } };

const GESTURES = ['pointerdown', 'keydown', 'touchend'];
/** Overall level: clearly audible on laptop speakers, still quiet UI feedback. */
const MASTER_GAIN = 0.55;

/**
 * One shared audio context for the scene and its same-origin desktop.
 * Sound is on by default: browsers only allow audio after a real user
 * gesture, so the context is created and resumed on the visitor's first
 * click, tap or key press (unless they muted first).
 */
export default class AudioManager {
    private context?: AudioContext;
    private master?: GainNode;
    private muted = true;
    private generation = 0;
    private lastPlay = -Infinity;
    private voices = new Set<SoundVoice>();
    private drawerVoice?: SoundVoice;
    /** The visitor's choice; on by default, off once they press Sound off. */
    private wanted = true;
    private armed = false;

    constructor() {
        // No context, buffers or nodes are created before the first real gesture.
        this.arm();
        document.addEventListener('muteToggle', this.onToggle);
        document.addEventListener('sceneSound', this.onSceneSound);
        document.addEventListener('visibilitychange', this.onVisibility);
        window.addEventListener('message', this.onDesktopSound);
        window.addEventListener('pagehide', this.onPageHide);
        // Scene feedback: real button presses, and stepping into/out of the laptop
        document.addEventListener('click', this.onButtonClick, true);
        document.addEventListener('enterMonitor', this.onEnterMonitor);
        document.addEventListener('leftMonitor', this.onLeftMonitor);
    }

    private onButtonClick = (event: Event) => {
        if (!event.isTrusted || !(event.target instanceof Element)) return;
        const button = event.target.closest('button, [role="button"]') as HTMLButtonElement | null;
        if (!button || button.disabled) return;
        this.play('tap');
    };
    private onEnterMonitor = () => this.play('tap');
    private onLeftMonitor = () => this.play('dismiss');

    private publish() {
        document.dispatchEvent(new CustomEvent('soundState', { detail: this.muted }));
    }

    /** Waits for the first trusted gesture, then starts sound if still wanted. */
    private arm() {
        if (this.armed) return;
        this.armed = true;
        GESTURES.forEach(type => window.addEventListener(type, this.onFirstGesture, true));
    }
    private disarm() {
        if (!this.armed) return;
        this.armed = false;
        GESTURES.forEach(type => window.removeEventListener(type, this.onFirstGesture, true));
    }
    private onFirstGesture = (event: Event) => {
        if (!isGesture(event)) return;
        this.disarm();
        if (this.wanted) this.setMuted(false, event);
    };

    private onToggle = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (!detail || typeof detail.muted !== 'boolean') return;
        this.setMuted(detail.muted, detail.input);
    };

    private setMuted(muted: boolean, input?: Event) {
        if (!muted && !isGesture(input)) return;
        this.wanted = !muted;
        this.disarm();
        const generation = ++this.generation;
        this.muted = muted;
        this.silence();
        if (muted) { this.publish(); return; }
        try {
            if (!this.context) {
                const Context = window.AudioContext || (window as SoundWindow).webkitAudioContext;
                if (!Context) throw new Error('Web Audio unavailable');
                this.context = new Context();
                this.master = this.context.createGain();
                this.master.gain.value = 0;
                this.master.connect(this.context.destination);
            }
            const context = this.context;
            // Called synchronously inside the toggle's real click/keyboard activation.
            const resumed = context.resume();
            this.publish();
            Promise.resolve(resumed).then(() => {
                if (generation !== this.generation || this.muted) return;
                if (context.state !== 'running') { this.muted = true; this.publish(); return; }
                this.master!.gain.setValueAtTime(MASTER_GAIN, context.currentTime);
            }).catch(() => {
                if (generation !== this.generation) return;
                this.muted = true; this.silence(); this.publish();
            });
        } catch (_) {
            this.muted = true; this.silence(); this.publish();
        }
    }

    private onSceneSound = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail && isCue(detail.cue) && isGesture(detail.input)) this.play(detail.cue);
    };

    private onDesktopSound = (event: MessageEvent) => {
        const screen = document.getElementById('computer-screen') as HTMLIFrameElement | null;
        if (!screen?.contentWindow || event.source !== screen.contentWindow || event.origin !== window.location.origin) return;
        const data = event.data;
        if (!data || data.type !== 'portfolio-sound' || (data.cue !== 'tap' && data.cue !== 'dismiss')) return;
        // Activation propagates from the same-origin iframe to its parent.
        // The sender additionally checks isTrusted on the original native click.
        const activation = (navigator as ActivationNavigator).userActivation;
        if (activation && !activation.isActive) return;
        // A first click inside the laptop also starts the default-on sound.
        // The click's user activation (checked above) allows resuming here.
        if (this.armed && this.wanted && activation?.isActive) {
            this.disarm();
            this.setMuted(false, { isTrusted: true, type: 'click' } as Event);
        }
        this.play(data.cue);
    };

    private play(cue: SoundCue) {
        const context = this.context;
        // Drop cues while suspended; never queue effects to play after a resume.
        if (this.muted || document.hidden || !context || context.state !== 'running' || !this.master || this.master.gain.value === 0) return;
        if (context.currentTime - this.lastPlay < 0.06) return;
        this.lastPlay = context.currentTime;
        if (cue === 'drawer-open' || cue === 'drawer-close') this.drawerVoice?.stop();
        if (this.voices.size >= 4) this.voices.values().next().value?.stop();
        try {
            const voice = synthesize(context, this.master, cue, () => this.voices.delete(voice));
            this.voices.add(voice);
            if (cue === 'drawer-open' || cue === 'drawer-close') this.drawerVoice = voice;
        } catch (_) {
            // An audio failure must never interrupt a drawer or desktop action.
            this.muted = true; this.silence(); this.publish();
        }
    }

    private silence() {
        if (this.context && this.master) {
            this.master.gain.cancelScheduledValues(this.context.currentTime);
            this.master.gain.setValueAtTime(0, this.context.currentTime);
        }
        this.stopVoices();
    }

    private stopVoices() {
        this.voices.forEach(voice => voice.stop());
        this.voices.clear(); this.drawerVoice = undefined;
        this.lastPlay = -Infinity;
    }

    private onVisibility = () => {
        // Preserve the visitor's choice across tab switches, without letting
        // an unfinished effect carry over or scheduling anything on return.
        if (document.hidden) this.stopVoices();
    };
    private onPageHide = () => {
        // Silence on navigation; a restored page waits for a new gesture,
        // but keeps the visitor's on/off choice.
        ++this.generation; this.muted = true; this.silence();
        if (this.wanted) this.arm();
        document.dispatchEvent(new CustomEvent('soundState', { detail: !this.wanted }));
    };

    destroy() {
        ++this.generation; this.muted = true; this.silence(); this.disarm();
        document.removeEventListener('muteToggle', this.onToggle);
        document.removeEventListener('sceneSound', this.onSceneSound);
        document.removeEventListener('visibilitychange', this.onVisibility);
        window.removeEventListener('message', this.onDesktopSound);
        window.removeEventListener('pagehide', this.onPageHide);
        document.removeEventListener('click', this.onButtonClick, true);
        document.removeEventListener('enterMonitor', this.onEnterMonitor);
        document.removeEventListener('leftMonitor', this.onLeftMonitor);
        this.master?.disconnect();
        if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    }
}
