/** Original, quiet one-shot synthesis. No samples, tunes or system sounds. */
export type SoundCue = 'tap' | 'dismiss' | 'drawer-open' | 'drawer-close';
export type SoundVoice = { stop: () => void };

// One short, seeded noise buffer per context: the drawer's slide and the
// tactile transient of a click both read from it.
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function drawerNoise(context: BaseAudioContext) {
    let buffer = noiseBuffers.get(context);
    if (!buffer) {
        buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.26), context.sampleRate);
        const samples = buffer.getChannelData(0);
        let seed = 731;
        for (let i = 0; i < samples.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            samples[i] = (seed / 4294967296) * 2 - 1;
        }
        noiseBuffers.set(context, buffer);
    }
    return buffer;
}

export function synthesize(context: BaseAudioContext, output: AudioNode, cue: SoundCue, ended: () => void): SoundVoice {
    const drawer = cue === 'drawer-open' || cue === 'drawer-close';
    const duration = drawer ? 0.24 : cue === 'tap' ? 0.03 : 0.045;
    const now = context.currentTime;
    const envelope = context.createGain();
    const nodes: AudioNode[] = [envelope];
    const sources: AudioScheduledSourceNode[] = [];
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(drawer ? 0.1 : 0.12, now + (drawer ? 0.025 : 0.002));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    envelope.gain.setValueAtTime(0, now + duration + 0.005);
    envelope.connect(output);

    // Drawer: a soft, low bandpassed slide. Click: a brief, bright noise
    // transient (the keycap/trackpad contact) rather than a pitched beep.
    const noise = context.createBufferSource();
    noise.buffer = drawerNoise(context);
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(
        cue === 'drawer-open' ? 650 : cue === 'drawer-close' ? 480 : cue === 'tap' ? 3200 : 2100,
        now
    );
    filter.Q.value = drawer ? 0.65 : 1.1;
    const noiseGain = context.createGain();
    noiseGain.gain.value = drawer ? 1 : 0.9;
    noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(envelope);
    nodes.push(filter, noiseGain); sources.push(noise);
    // A low body resonance under the slide, or a small, muted thock under the click.
    const tone = context.createOscillator();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(drawer ? 130 : cue === 'tap' ? 340 : 260, now);
    tone.frequency.exponentialRampToValueAtTime(drawer ? 85 : cue === 'tap' ? 210 : 160, now + duration);
    const toneGain = context.createGain();
    toneGain.gain.value = drawer ? 0.18 : 0.35;
    tone.connect(toneGain); toneGain.connect(envelope);
    nodes.push(toneGain); sources.push(tone);

    let finished = false;
    const cleanup = () => {
        if (finished) return;
        finished = true;
        sources.forEach(source => { source.onended = null; source.disconnect(); });
        nodes.forEach(node => node.disconnect());
        ended();
    };
    // All sources end together; the oscillator owns cleanup.
    tone.onended = cleanup;
    sources.forEach(source => { source.start(now); source.stop(now + duration + 0.01); });
    return { stop: () => {
        if (finished) return;
        sources.forEach(source => { source.onended = null; source.stop(); });
        cleanup();
    } };
}
