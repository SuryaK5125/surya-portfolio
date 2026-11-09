/** Exercise the actual intro scheduler with a deterministic clock and preferences. */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../src/Application/UI/IntroReveal.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018 },
}).outputText;
function scenario({ reduced = false } = {}) {
    let now = 0, id = 0;
    const timers = new Map(), listeners = new Set();
    const motion = { matches: reduced, addEventListener(_, fn) { listeners.add(fn); }, removeEventListener(_, fn) { listeners.delete(fn); } };
    const exports = {};
    const context = { exports, window: {
        matchMedia: () => motion,
        // A fresh page must not consult or update a persistent replay cooldown.
        get localStorage() { throw new Error('Intro must not access persistent storage'); },
    }, setTimeout(fn, delay) { const key = ++id; timers.set(key, { fn, at: now + delay }); return key; }, clearTimeout(key) { timers.delete(key); } };
    vm.runInNewContext(source, context);
    return { api: exports, timers, listeners,
        advance(ms) {
            const end = now + ms;
            while (true) {
                const next = [...timers].sort((a,b) => a[1].at-b[1].at)[0];
                if (!next || next[1].at > end) break;
                now = next[1].at; timers.delete(next[0]); next[1].fn();
            }
            now = end;
        },
        reduce() { motion.matches = true; [...listeners].forEach(fn => fn()); },
    };
}
const first = scenario(), counts = [], { INTRO_NAME, INTRO_DETAIL, INTRO_LENGTH } = first.api;
assert.equal(INTRO_NAME, 'Surya Kalimuthu');
assert.equal(INTRO_DETAIL, 'B.Tech IT @ NIT Kurukshetra');
assert.equal(first.api.initialIntroCount(), 0);
first.api.startIntroReveal(n => counts.push(n));
first.advance(219); assert.equal(counts.length, 0, 'brief initial pause missing');
first.advance(1); assert.deepEqual(counts, [1], 'first frame must contain one real character');
first.advance((INTRO_NAME.length-1)*55); assert.equal(counts.at(-1), INTRO_NAME.length);
first.advance(179); assert.equal(counts.at(-1), INTRO_NAME.length, 'subtitle began before the name pause ended');
first.advance(1); assert.equal(counts.at(-1), INTRO_NAME.length+1);
first.advance(5000); assert.equal(counts.at(-1), INTRO_LENGTH);
assert.deepEqual(counts, Array.from({length:INTRO_LENGTH}, (_,i) => i+1), 'characters must appear sequentially without gaps');
assert.equal(first.timers.size, 0); assert.equal(first.listeners.size, 0);
assert.equal(first.api.initialIntroCount(), INTRO_LENGTH, 'inspection/remount must not replay');
assert.equal(scenario().api.initialIntroCount(), 0, 'a fresh page must replay regardless of previous visits');
const reduced = scenario({reduced:true}), reducedCounts = [];
assert.equal(reduced.api.initialIntroCount(), INTRO_LENGTH);
reduced.api.startIntroReveal(n => reducedCounts.push(n));
assert.deepEqual(reducedCounts,[INTRO_LENGTH]); assert.equal(reduced.timers.size,0);
const changed = scenario(), changedCounts = [];
changed.api.startIntroReveal(n => changedCounts.push(n)); changed.advance(220); changed.reduce();
assert.equal(changedCounts.at(-1), INTRO_LENGTH); assert.equal(changed.timers.size,0); assert.equal(changed.listeners.size,0);
const canceled = scenario(), canceledCounts = [];
const stop = canceled.api.startIntroReveal(n => canceledCounts.push(n)); canceled.advance(260); stop();
const before = canceledCounts.length; canceled.advance(5000); assert.equal(canceledCounts.length,before); assert.equal(canceled.listeners.size,0);
console.log('PASS: exact text, sequential characters, line order, replay on fresh load, reduced-motion startup/change and cancellation; no persistent storage');
