import { useCallback, useEffect, useState } from 'react';

export type ThemeId = 'aero' | 'minecraft';

const STORAGE_KEY = 'desktop.theme';

// localStorage can throw (private mode, blocked storage); fall back quietly
function readStored(): ThemeId {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'minecraft' ? 'minecraft' : 'aero';
    } catch {
        return 'aero';
    }
}

function writeStored(theme: ThemeId) {
    try {
        window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        /* not persisted; the theme still applies for this visit */
    }
}

/**
 * Active desktop theme. It is exposed as `data-theme` on <html>, so the CSS in
 * minecraft.css restyles every app through shared variables and selectors
 * without any component knowing about themes.
 */
export function useTheme(): [ThemeId, () => ThemeId] {
    const [theme, setTheme] = useState<ThemeId>(() => {
        // Applied before the first paint, so a saved theme never flashes Aero
        const stored = readStored();
        document.documentElement.setAttribute('data-theme', stored);
        return stored;
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    /** Flips the theme and returns the new one. */
    const toggle = useCallback(() => {
        const next: ThemeId = theme === 'minecraft' ? 'aero' : 'minecraft';
        setTheme(next);
        writeStored(next);
        return next;
    }, [theme]);

    return [theme, toggle];
}
