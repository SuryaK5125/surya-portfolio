import React, { useCallback, useState } from 'react';
import { DEFAULT_WALLPAPER_ID, wallpapers } from '../content/wallpapers';
import { Wallpaper } from '../content/types';
import { safeUrl } from '../util';

const STORAGE_KEY = 'desktop.wallpaper';

const exists = (id: string | null): id is string =>
    !!id && wallpapers.some((w) => w.id === id);

// localStorage can throw (private mode, blocked storage); fall back quietly
function readStored(): string | null {
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function writeStored(id: string) {
    try {
        window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
        /* not persisted; the choice still applies for this visit */
    }
}

/** Selected wallpaper id, persisted per browser. Unknown ids fall back to the default. */
export function useWallpaper(): [string, (id: string) => void] {
    const [id, setId] = useState(() => {
        const stored = readStored();
        return exists(stored) ? stored : DEFAULT_WALLPAPER_ID;
    });
    const set = useCallback((next: string) => {
        if (!exists(next)) return;
        setId(next);
        writeStored(next);
    }, []);
    return [id, set];
}

export const getWallpaper = (id: string): Wallpaper =>
    wallpapers.find((w) => w.id === id) ||
    (wallpapers.find((w) => w.id === DEFAULT_WALLPAPER_ID) as Wallpaper);

/** CSS background for a wallpaper; empty for the built-in (styled in desktop.css). */
export function wallpaperStyle(
    wallpaper: Wallpaper,
    preferThumbnail = false
): React.CSSProperties {
    if (wallpaper.kind === 'css') return { background: wallpaper.css };
    if (wallpaper.kind === 'image') {
        const src = safeUrl(
            preferThumbnail && wallpaper.thumbnail ? wallpaper.thumbnail : wallpaper.src
        );
        return src
            ? { background: `#0b2236 url("${src}") center / cover no-repeat` }
            : {};
    }
    return {};
}
