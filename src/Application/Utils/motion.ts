/**
 * Reduced-motion and input helpers for the overlay UI and keyframes.
 * (Camera.ts keeps its own copy so it stays loadable by the Node checks.)
 */
const query = (q: string) =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(q).matches
        : false;

/** The visitor asked the OS/browser for less motion. Read live, so it can change mid-visit. */
export const prefersReducedMotion = () => query('(prefers-reduced-motion: reduce)');

/** Primary input can't hover (phones, most tablets). */
export const isTouchPrimary = () => query('(hover: none)');
