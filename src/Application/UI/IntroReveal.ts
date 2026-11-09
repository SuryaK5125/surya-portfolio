/** Timing for the room introduction only; no desktop events or typing sounds. */
export const INTRO_NAME = 'Surya Kalimuthu';
export const INTRO_DETAIL = 'B.Tech IT @ NIT Kurukshetra';
export const INTRO_LENGTH = INTRO_NAME.length + INTRO_DETAIL.length;
// This flag resets on a fresh page load. Inspection views do not replay it.
let revealedThisLoad = false;

export function initialIntroCount() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || revealedThisLoad ? INTRO_LENGTH : 0;
}

export function completeIntroReveal() { revealedThisLoad = true; }

/** Emits actual character counts, with a small pause between the two lines. */
export function startIntroReveal(update: (count: number) => void) {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let count = 0, stopped = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
        stopped = true;
        if (timeout !== undefined) clearTimeout(timeout);
        motion.removeEventListener('change', changedMotion);
    };
    const finish = () => { stop(); update(INTRO_LENGTH); };
    const changedMotion = () => { if (motion.matches) finish(); };
    // Only suppress a remount within this page; refresh always starts anew.
    completeIntroReveal();
    if (motion.matches) { update(INTRO_LENGTH); return stop; }
    motion.addEventListener('change', changedMotion);
    const next = () => {
        if (stopped) return;
        update(++count);
        if (count === INTRO_LENGTH) { stop(); return; }
        const delay = count === INTRO_NAME.length ? 180 : 55;
        timeout = setTimeout(next, delay);
    };
    timeout = setTimeout(next, 220);
    return stop;
}
