/** Focused regressions for desktop-only keys, responsive iframe reuse and GPU budget. */
const assert = require('assert'), fs = require('fs'), path = require('path'), Module = require('module');
const ts = require('typescript');
function load(relative, stubs = {}) {
    const filename = path.resolve(__dirname, '..', relative), mod = new Module(filename, module);
    mod.filename = filename; mod.paths = module.paths;
    mod.require = name => name in stubs ? stubs[name] : require(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018,
    }}).outputText, filename);
    return mod.exports;
}
const listeners = new Map(); let cleanup;
global.document = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
};
const { useKonami } = load('src/desktop/hooks/useKonami.ts', { react: {
    useRef: current => ({ current }), useEffect: fn => { cleanup = fn(); },
}});
let toggles = 0; useKonami(() => toggles++);
const sequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
const desktop = { tagName: 'MAIN', closest: () => null };
const app = { tagName: 'SECTION', closest: () => ({}) };
const input = { tagName: 'INPUT', closest: () => null };
const key = (value, target = desktop, extra = {}) => listeners.get('keydown')({ key: value, target, ...extra });
sequence.forEach(value => key(value)); assert.equal(toggles, 1);
for (const target of [app, input, { ...desktop, isContentEditable: true }]) {
    sequence.forEach(value => key(value, target)); assert.equal(toggles, 1, 'keys inside app/input toggled theme');
}
sequence.slice(0, 4).forEach(value => key(value)); key('x', input);
sequence.slice(4).forEach(value => key(value)); assert.equal(toggles, 1, 'typing failed to reset sequence');
sequence.forEach(value => key(value, desktop, { ctrlKey: true })); assert.equal(toggles, 1);
sequence.map(value => value.length === 1 ? value.toUpperCase() : value).forEach(value => key(value)); assert.equal(toggles, 2);
cleanup(); assert(!listeners.has('keydown'));

const classes = new Set(), variables = {};
const classList = { toggle(name, on) { on ? classes.add(name) : classes.delete(name); }, contains: name => classes.has(name) };
global.document = { body: { classList, style: { setProperty: (name, value) => { variables[name] = value; } } } };
global.window = { innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
    visualViewport: { height: 620 }, matchMedia: () => ({ matches: window.innerWidth <= 700 || (window.innerHeight <= 500 && window.coarse) }),
    addEventListener: (name, fn) => listeners.set(name, fn),
};
const screenModule = load('src/Application/World/MonitorScreen.ts', {
    '../Application': { default: class {} }, '../Camera/Camera': {},
    '../Utils/EventEmitter': { default: class {} },
    'three/examples/jsm/renderers/CSS3DRenderer.js': {},
});
const screen = Object.create(screenModule.default.prototype);
const frame = { style: {} }; screen.iframe = frame; screen.screenContainer = { classList };
screen.cssSize = { w: 1600, h: 900 }; screen.monitorActive = true;
screen.updateMobileSurface(); assert(classes.has('mobile-desktop-active'));
assert.equal(frame.style.width, '100%'); assert.equal(variables['--mobile-viewport-height'], '620px');
window.innerWidth = 844; window.innerHeight = 390; window.coarse = true; screen.updateMobileSurface(); assert(classes.has('mobile-desktop-active'), 'landscape phone lost full-screen desktop');
window.innerWidth = 1280; window.innerHeight = 800; window.coarse = false; screen.updateMobileSurface(); assert(!classes.has('mobile-desktop-active')); assert.equal(frame.style.width, '1600px');
window.innerWidth = 390; screen.monitorActive = false; screen.updateMobileSurface(); assert(!classes.has('mobile-desktop-active')); assert.strictEqual(screen.iframe, frame);

const sizesModule = load('src/Application/Utils/Sizes.ts', { './EventEmitter': { default: class { trigger() {} } } });
const sizes = new sizesModule.default(); assert.equal(sizes.pixelRatio, 1.5);
window.innerWidth = 1280; listeners.get('resize')(); assert.equal(sizes.pixelRatio, 2);
const Renderer = load('src/Application/Renderer.ts', {
    './Application': { default: class {} }, 'three/examples/jsm/renderers/CSS3DRenderer.js': {},
}).default;
const renderer = Object.create(Renderer.prototype); let gl = 0, css = 0;
renderer.instance = { render() { gl++; } }; renderer.cssInstance = { render() { css++; } }; renderer.camera = {};
renderer.update(); classList.toggle('mobile-desktop-active', true); renderer.update();
assert.equal(gl, 1); assert.equal(css, 1, 'hidden mobile room was redrawn');
classList.toggle('mobile-desktop-active', false); renderer.update(); assert.equal(gl, 2); assert.equal(css, 2);
delete global.window; delete global.document;
console.log('PASS: desktop Konami works; apps/inputs reset it; same iframe survives phone/desktop/keyboard resize; phone DPR capped at 1.5; hidden room render pauses and resumes');
