import React from 'react';
import type { AppId } from './registry';
import { DEFAULT_WALLPAPER_ID } from './content/wallpapers';
import type { ThemeId } from './hooks/useTheme';

export type DesktopContextValue = {
    openApp: (id: AppId) => void;
    /** Phone-sized layout: full-screen windows, no dragging. */
    compact: boolean;
    /** Currently applied wallpaper (see content/wallpapers.ts). */
    wallpaperId: string;
    setWallpaper: (id: string) => void;
    /** Active visual theme (see hooks/useTheme.ts). */
    theme: ThemeId;
};

export const DesktopContext = React.createContext<DesktopContextValue>({
    openApp: () => undefined,
    compact: false,
    wallpaperId: DEFAULT_WALLPAPER_ID,
    setWallpaper: () => undefined,
    theme: 'aero',
});
