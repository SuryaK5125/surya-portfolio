const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const compile = file => ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018 } }).outputText;
const recipes = compile('src/Application/Audio/AudioSources.ts');
const manager = compile('src/Application/Audio/AudioManager.ts');
const bridge = compile('src/desktop/bridge.ts');
class Target {
    constructor() { this.handlers = new Map(); }
    addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn); }
    removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }
    dispatchEvent(event) { this.handlers.get(event.type)?.forEach(fn => fn(event)); }
}
class Param {
    constructor(value = 1) { this.value = value; this.calls = []; }
    setValueAtTime(value, time) { this.value = value; this.calls.push(['set', value, time]); }
    linearRampToValueAtTime(value, time) { this.calls.push(['linear', value, time]); }
    exponentialRampToValueAtTime(value, time) { this.calls.push(['exponential', value, time]); }
    cancelScheduledValues(time) { this.calls.push(['cancel', time]); }
}
class Node {
    constructor(context, kind) { this.context = context; this.kind = kind; this.connections = []; this.gain = new Param(); this.frequency = new Param(); this.Q = new Param(); context.nodes.push(this); }
    connect(node) { this.connections.push(node); }
    disconnect() { this.connections = []; this.disconnected = true; }
    start(at) { this.started = at; }
    stop(at) { this.stops = [...(this.stops || []), at]; }
}
function scenario({ unavailable = false, reject = false, deferred = false } = {}) {
    const document = new Target(), window = new Target(), contexts = [];
    const frame = { contentWindow: {} };
    document.hidden = false;
    document.getElementById = id => id === 'computer-screen' ? frame : null;
    window.location = { origin: 'https://portfolio.test' };
    const navigator = { userActivation: { isActive: true } };
    class Context {
        constructor() { this.state = deferred ? 'suspended' : 'running'; this.currentTime = 0; this.sampleRate = 48000; this.nodes = []; this.buffers = []; this.destination = {}; contexts.push(this); }
        createGain() { return new Node(this, 'gain'); }
        createOscillator() { return new Node(this, 'oscillator'); }
        createBiquadFilter() { return new Node(this, 'filter'); }
        createBufferSource() { return new Node(this, 'noise'); }
        createBuffer(_, count) { const samples = new Float32Array(count); this.buffers.push(samples); return { getChannelData: () => samples }; }
        resume() { if (reject) return Promise.reject(new Error('blocked')); if (deferred) return new Promise(resolve => { this.resolveResume = () => { this.state = 'running'; resolve(); }; }); return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
    }
    if (!unavailable) window.AudioContext = Context;
    const sandbox = { window, document, navigator, CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } } };
    const api = {};
    vm.runInNewContext(recipes, { ...sandbox, exports: api });
    const exports = {};
    vm.runInNewContext(manager, { ...sandbox, exports, require: name => { assert.equal(name, './AudioSources'); return api; } });
    const instance = new exports.default();
    const dispatch = (type, detail) => document.dispatchEvent({ type, detail });
    const input = { isTrusted: true, type: 'click' };
    const toggle = (muted, event = input) => dispatch('muteToggle', { muted, input: event });
    const scene = (cue, event = input) => dispatch('sceneSound', { cue, input: event });
    const desktop = (data = { type: 'portfolio-sound', cue: 'tap' }, extra = {}) => window.dispatchEvent({ type: 'message', data, origin: window.location.origin, source: frame.contentWindow, ...extra });
    const sources = () => contexts.flatMap(c => c.nodes.filter(n => n.kind === 'noise' || n.kind === 'oscillator'));
    return { ...sandbox, instance, contexts, input, toggle, scene, desktop, dispatch, sources, api };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
async function run() {
    const s = scenario(), states = [];
    s.document.addEventListener('soundState', e => states.push(e.detail));
    s.navigator.userActivation.isActive = false;
    s.scene('drawer-open'); s.desktop(); s.navigator.userActivation.isActive = true; s.dispatch('loadingScreenDone'); s.dispatch('introDone'); s.dispatch('enterMonitor'); s.dispatch('cameraTransition');
    assert.equal(s.contexts.length, 0, 'load, camera and muted inputs must not create a context');
    s.toggle(false, { isTrusted: false, type: 'click' });
    s.toggle(false, { isTrusted: true, type: 'mousemove' });
    assert.equal(s.contexts.length, 0, 'synthetic input/hover must not enable audio');
    s.toggle(false); await flush();
    assert.equal(s.contexts.length, 1); assert.equal(s.sources().length, 0, 'enable must be silent');
    const c = s.contexts[0], master = c.nodes[0];
    assert.equal(master.gain.value, 0.55); assert.equal(states.at(-1), false);
    s.scene('drawer-open'); assert.equal(s.sources().length, 2);
    const slide = s.sources().slice();
    s.scene('drawer-open'); assert.equal(s.sources().length, 2, 'rate limiting failed');
    c.currentTime += 0.07; s.scene('drawer-close');
    assert(slide.every(n => n.disconnected && n.stops.includes(undefined)), 'reversing a drawer must stop its prior sound');
    const beforeInvalid = s.sources().length;
    c.currentTime += 0.07;
    s.scene('unknown'); s.scene('tap', { isTrusted: false, type: 'click' });
    s.desktop(undefined, { origin: 'https://other.test' }); s.desktop(undefined, { source: {} });
    s.desktop({ type: 'portfolio-sound', cue: 'drawer-open' }); s.desktop({ type: 'mousemove', cue: 'tap' }); s.desktop(null);
    s.navigator.userActivation.isActive = false; s.desktop(); s.navigator.userActivation.isActive = true;
    assert.equal(s.sources().length, beforeInvalid, 'untrusted or malformed requests must be ignored');
    s.desktop(); assert.equal(s.sources().length, beforeInvalid + 2, 'a tap is a transient plus a body');
    // Six spaced requests with deliberately unfinished mock sources: cap voices.
    for (let i = 0; i < 6; i++) { c.currentTime += 0.07; s.desktop(); }
    assert(s.sources().filter(n => !n.disconnected).length <= 8, 'voice cap failed (4 voices x 2 sources)');
    s.toggle(true);
    assert.equal(master.gain.value, 0); assert(s.sources().every(n => n.disconnected), 'mute left active sources');
    const stoppedCount = s.sources().length; c.currentTime += 1; s.desktop(); s.scene('drawer-close');
    assert.equal(s.sources().length, stoppedCount);
    s.toggle(false); await flush(); assert.equal(s.contexts.length, 1, 'toggle created a second context');
    c.state = 'suspended'; s.desktop(); await flush(); assert.equal(s.sources().length, stoppedCount);
    c.state = 'running'; await flush(); assert.equal(s.sources().length, stoppedCount, 'suspended effects were queued');
    s.scene('tap'); const last = s.sources().at(-1); last.onended(); assert(last.disconnected, 'natural completion leaked nodes');
    c.currentTime += 1; s.scene('drawer-open');
    s.document.hidden = true; s.document.dispatchEvent({ type: 'visibilitychange' });
    assert.equal(states.at(-1), false, 'tab visibility changed the user sound choice'); assert(s.sources().every(n => n.disconnected));
    const hiddenCount = s.sources().length; c.currentTime += 1; s.desktop(); assert.equal(s.sources().length, hiddenCount);
    s.document.hidden = false; s.document.dispatchEvent({ type: 'visibilitychange' });
    assert.equal(s.sources().length, hiddenCount, 'visibility return started audio');
    s.window.dispatchEvent({ type: 'pagehide' }); assert.equal(states.at(-1), false, 'pagehide forgot the on choice');
    c.currentTime += 1; s.desktop(); assert.equal(s.sources().filter(n => !n.disconnected).length, 0);
    s.toggle(true); s.window.dispatchEvent({ type: 'pagehide' }); assert.equal(states.at(-1), true, 'pagehide forgot the off choice');
    s.instance.destroy(); assert.equal(c.state, 'closed');
    assert([...s.document.handlers].every(([type, set]) => set.size === (type === 'soundState' ? 1 : 0)), 'document listeners were not removed');
    assert([...s.window.handlers.values()].every(set => set.size === 0), 'window listeners were not removed');
    // Default on: the first real gesture anywhere starts sound; hover/synthetic do not.
    const auto = scenario(), autoStates = [];
    auto.document.addEventListener('soundState', e => autoStates.push(e.detail));
    auto.window.dispatchEvent({ type: 'pointerdown', isTrusted: false }); auto.window.dispatchEvent({ type: 'mousemove', isTrusted: true });
    assert.equal(auto.contexts.length, 0, 'non-gesture started audio');
    auto.window.dispatchEvent({ type: 'pointerdown', isTrusted: true }); await flush();
    assert.equal(auto.contexts.length, 1, 'first gesture did not start default sound'); assert.equal(autoStates.at(-1), false);
    assert.equal(auto.sources().length, 0, 'starting sound must itself be silent');
    auto.instance.destroy();
    // A visitor who mutes before any gesture stays muted.
    const quiet = scenario(); quiet.toggle(true); quiet.window.dispatchEvent({ type: 'pointerdown', isTrusted: true }); await flush();
    assert.equal(quiet.contexts.length, 0, 'muted visitor got audio'); quiet.instance.destroy();
    // A first click inside the laptop (real user activation) also starts it.
    const lap = scenario(); lap.desktop(); await flush(); assert.equal(lap.contexts.length, 1); lap.instance.destroy();
    const race = scenario({ deferred: true }); race.toggle(false); race.scene('tap'); race.toggle(true);
    race.contexts[0].resolveResume(); await flush();
    assert.equal(race.contexts[0].nodes[0].gain.value, 0); assert.equal(race.sources().length, 0, 'resume raced past mute');
    const failed = scenario({ reject: true }), failedStates = [];
    failed.document.addEventListener('soundState', e => failedStates.push(e.detail)); failed.toggle(false); await flush();
    assert.equal(failedStates.at(-1), true); assert.equal(failed.sources().length, 0);
    const missing = scenario({ unavailable: true }), missingStates = [];
    missing.document.addEventListener('soundState', e => missingStates.push(e.detail)); missing.toggle(false); await flush();
    assert.equal(missingStates.at(-1), true); assert.equal(missing.contexts.length, 0);

    // Inspect actual recipe envelopes, finite source lifetimes, cleanup and seeded samples.
    const recipe = scenario(); recipe.toggle(false); await flush();
    const rc = recipe.contexts[0];
    for (const cue of ['tap', 'dismiss', 'drawer-open', 'drawer-close']) {
        const before = rc.nodes.length; let ended = 0;
        const voice = recipe.api.synthesize(rc, rc.destination, cue, () => ended++);
        const nodes = rc.nodes.slice(before), sources = nodes.filter(n => n.started !== undefined);
        assert(sources.length >= 1 && sources.length <= 2);
        sources.forEach(n => { assert(n.stops[0] > rc.currentTime && n.stops[0] <= rc.currentTime + 0.25 + 1e-8); assert(!n.loop); });
        const envelope = nodes[0];
        assert(envelope.gain.calls.some(([kind, value]) => kind === 'linear' && value <= 0.13));
        assert.equal(envelope.gain.calls.at(-1)[1], 0, 'envelope does not finish at zero');
        voice.stop(); voice.stop(); assert.equal(ended, 1); assert(nodes.every(n => n.disconnected));
    }
    assert.equal(rc.buffers.length, 1, 'drawer noise should be cached per context');
    assert(rc.buffers[0].every(n => Number.isFinite(n) && Math.abs(n) <= 1));

    // Exercise the actual desktop bridge: semantic audio is separate from camera input.
    const messages = [], doc = new Target(), win = { location: { origin: 'https://portfolio.test' }, parent: { postMessage: (data, origin) => messages.push({ data, origin }) } };
    class Element { constructor(control) { this.control = control; } closest() { return this.control; } }
    const b = {}; vm.runInNewContext(bridge, { exports: b, document: doc, window: win, Element }); b.startBridge();
    const control = { disabled: false, closest: () => false, title: '' };
    const target = new Element(control);
    doc.dispatchEvent({ type: 'click', target, isTrusted: false });
    doc.dispatchEvent({ type: 'click', target: new Element(null), isTrusted: true });
    control.disabled = true; doc.dispatchEvent({ type: 'click', target, isTrusted: true }); control.disabled = false;
    assert.equal(messages.length, 0);
    doc.dispatchEvent({ type: 'click', target, isTrusted: true });
    assert.equal(messages[0].data.cue, 'tap'); assert.equal(messages[0].origin, win.location.origin);
    control.closest = () => true; control.title = 'Close'; doc.dispatchEvent({ type: 'click', target, isTrusted: true }); assert.equal(messages[1].data.cue, 'dismiss');
    doc.dispatchEvent({ type: 'mousemove', clientX: 10, clientY: 15 }); doc.dispatchEvent({ type: 'keydown', key: 'a' });
    assert.equal(messages.filter(m => m.data.type === 'portfolio-sound').length, 2, 'typing/moving requested audio');
    assert.equal(messages.at(-1).data.type, 'keydown', 'camera keyboard forwarding changed');
    console.log('PASS: lazy context, default-on via first trusted gesture, remembered mute, mute/async-resume race, suspension, failures, visibility, finite quiet synthesis, cleanup, voice/rate limits and desktop bridge validation');
}
function production() {
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
    const files = walk(path.join(root, 'public'));
    assert.equal(files.filter(f => /\.(mp3|wav|ogg|flac|m4a)$/i.test(f)).length, 0, 'recorded audio was emitted');
    assert(!fs.existsSync(path.join(root, 'static/audio')));
    for (const file of files.filter(f => /\.js$/.test(f))) {
        assert(!/audio\/(?:mouse|keyboard|cc|startup|atmosphere|radio|computer)\//.test(fs.readFileSync(file, 'utf8')), `old audio path in ${file}`);
    }
    assert(!/AudioLoader|LoadedAudio|type: 'audio'/.test(read('src/Application/Utils/Resources.ts') + read('src/Application/sources.ts')));
    assert(!read('bundler/webpack.common.js').includes("loader: 'file-loader'"));
    assert(!JSON.parse(read('package.json')).dependencies['file-loader']);
    console.log('PASS: production contains zero recorded audio files, original sound paths/loaders or direct file-loader dependency');
}
function browser() {
    // Ignored QA-only pages. Use actual modules, real native gestures and real Web Audio.
    const wrap = (name, source) => `modules[${JSON.stringify(name)}]=(function(){const exports={};const require=name=>modules[name];${source}\nreturn exports;})();`;
    const counters = `
const status=document.querySelector('output');let created=0,starts=0,active=0,muted=true,ctx;
const Native=window.AudioContext;
window.AudioContext=class extends Native {
 constructor(){super();ctx=this;created++;this.addEventListener('statechange',render);}
 createOscillator(){const node=super.createOscillator(),start=node.start.bind(node),disconnect=node.disconnect.bind(node);let live=false;
 node.start=(...args)=>{starts++;active++;live=true;start(...args);render();};
 node.disconnect=(...args)=>{if(live){active--;live=false;}disconnect(...args);render();};return node;}
};
function render(){status.textContent=JSON.stringify({created,starts,active,muted,state:ctx?.state||'none'},null,2);}
document.addEventListener('soundState',event=>{muted=event.detail;render();});
`;
    const script = `const modules={};${counters}${wrap('./AudioSources', recipes)}${wrap('./AudioManager', manager)}
new modules['./AudioManager'].default();
for(const button of document.querySelectorAll('[data-muted]'))button.addEventListener('click',input=>document.dispatchEvent(new CustomEvent('muteToggle',{detail:{muted:button.dataset.muted==='true',input}})));
for(const button of document.querySelectorAll('[data-cue]'))button.addEventListener('click',input=>document.dispatchEvent(new CustomEvent('sceneSound',{detail:{cue:button.dataset.cue,input}})));
document.querySelector('#synthetic').addEventListener('click',()=>document.dispatchEvent(new CustomEvent('sceneSound',{detail:{cue:'tap',input:new MouseEvent('click')}})));
render();`;
    fs.writeFileSync(path.join(root, 'public/audio-check.html'), `<!doctype html><meta charset="utf-8"><title>Local audio verification</title><style>body{font:16px monospace;margin:32px;background:#eee;color:#111}button{padding:12px;margin:5px}iframe{display:block;width:650px;height:120px;margin:20px 0}output{white-space:pre;display:block}</style><h1>Local audio verification</h1><p>Original controller and synthesis; real browser context. No test page is shipped.</p><button data-muted="false">Enable sound</button><button data-muted="true">Mute</button><button data-cue="drawer-open">Open drawer cue</button><button data-cue="drawer-close">Close drawer cue</button><button data-cue="tap">Laptop tap</button><button id="synthetic">Synthetic click (silent)</button><iframe id="computer-screen" title="Audio bridge verification" src="audio-check-desktop.html"></iframe><output></output><script>${script}</script>`);
    fs.writeFileSync(path.join(root, 'public/audio-check-desktop.html'), `<!doctype html><meta charset="utf-8"><title>Desktop bridge test</title><p>Real iframe bridge</p><button class="dsk-start">Start test</button><div class="dsk-controls"><button title="Close">Close test</button></div><script>const exports={};${bridge}\nexports.startBridge();</script>`);
    const sceneCounters = counters.replace("document.querySelector('output')", "document.querySelector('#audio-check-status')");
    const sceneProbe = `<output id="audio-check-status" style="position:fixed;top:12px;left:12px;z-index:999999;pointer-events:none;white-space:pre;background:#111;color:#fff;padding:8px;font:12px monospace"></output><script>${sceneCounters}render();</script>`;
    fs.writeFileSync(path.join(root, 'public/audio-scene-check.html'), read('public/index.html').replace('<body>', '<body>' + sceneProbe));
    console.log('Wrote ignored local QA pages: /audio-check.html, /audio-check-desktop.html and /audio-scene-check.html');
}
run().then(() => { if (process.argv.includes('--production')) production(); if (process.argv.includes('--browser')) browser(); }).catch(error => { console.error(error); process.exitCode = 1; });
