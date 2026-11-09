import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APPS, AppId, getApp } from './registry';
import { DesktopContext } from './context';
import AppLoadingBoundary from './components/AppLoadingBoundary';
import Window, { Bounds, WindowState, clampPosition } from './components/Window';
import Taskbar from './components/Taskbar';
import StartMenu from './components/StartMenu';
import { useCompactMode } from './hooks/useCompactMode';
import { getWallpaper, useWallpaper, wallpaperStyle } from './hooks/useWallpaper';
import { profile } from './content/profile';
import { minecraftTheme } from './content/theme';
import { useTheme } from './hooks/useTheme';
import { useKonami } from './hooks/useKonami';
import ThemeDiscovery from './components/ThemeDiscovery';
import { safeUrl } from './util';

const MARGIN = 8;
const CASCADE = { x: 168, y: 28, step: 30, count: 6 };

const Desktop: React.FC = () => {
    const compact = useCompactMode();
    const surfaceRef = useRef<HTMLElement>(null);
    // Kept in opening order (stable DOM order); stacking comes from `z`.
    const [windows, setWindows] = useState<WindowState[]>([]);
    const [menuOpen, setMenuOpen] = useState(false);
    const [wallpaperId, setWallpaper] = useWallpaper();
    const [theme, toggleTheme] = useTheme();
    const [toast, setToast] = useState<string | null>(null);
    const zCounter = useRef(0);

    // Konami code toggles the Minecraft-inspired theme
    const [hintVisible, setHintVisible] = useState(false);
    const changeTheme = () => {
        setHintVisible(false);
        const next = toggleTheme();
        setToast(next === 'minecraft' ? 'Minecraft theme on.' : 'Back to Aero.');
    };
    useKonami(changeTheme);

    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), 3200);
        return () => window.clearTimeout(timer);
    }, [toast]);
    // Windows hidden by "Show desktop", restored by clicking it again.
    const peeked = useRef<AppId[]>([]);

    const getBounds = useCallback((): Bounds => {
        const surface = surfaceRef.current;
        return surface
            ? { width: surface.clientWidth, height: surface.clientHeight }
            : { width: window.innerWidth, height: window.innerHeight };
    }, []);

    const nextZ = () => ++zCounter.current;

    const focus = useCallback((id: AppId) => {
        setWindows((current) => {
            const top = current.reduce((max, w) => Math.max(max, w.z), 0);
            const target = current.find((w) => w.id === id);
            // Avoid a re-render when it's already on top and visible
            if (!target || (target.z === top && !target.minimized)) {
                return current;
            }
            const z = nextZ();
            return current.map((w) =>
                w.id === id ? { ...w, z, minimized: false } : w
            );
        });
    }, []);

    const openApp = useCallback(
        (id: AppId) => {
            setMenuOpen(false);
            setWindows((current) => {
                const z = nextZ();
                if (current.some((w) => w.id === id)) {
                    return current.map((w) =>
                        w.id === id ? { ...w, z, minimized: false } : w
                    );
                }
                const bounds = getBounds();
                const { size } = getApp(id);
                const w = Math.min(size.w, bounds.width - MARGIN * 2);
                const h = Math.min(size.h, bounds.height - MARGIN * 2);
                const step = (current.length % CASCADE.count) * CASCADE.step;
                const x = Math.max(
                    MARGIN,
                    Math.min(CASCADE.x + step, bounds.width - w - MARGIN)
                );
                const y = Math.max(
                    MARGIN,
                    Math.min(CASCADE.y + step, bounds.height - h - MARGIN)
                );
                return [
                    ...current,
                    { id, x, y, w, h, z, minimized: false, maximized: false },
                ];
            });
        },
        [getBounds]
    );

    const update = (id: AppId, patch: Partial<WindowState>) =>
        setWindows((current) =>
            current.map((w) => (w.id === id ? { ...w, ...patch } : w))
        );

    const close = (id: AppId) => {
        setWindows((current) => current.filter((w) => w.id !== id));
        surfaceRef.current?.focus({ preventScroll: true });
    };

    const visible = windows.filter((w) => !w.minimized);
    const activeId = visible.length
        ? visible.reduce((top, w) => (w.z > top.z ? w : top)).id
        : null;

    const onTaskClick = (id: AppId) => {
        setMenuOpen(false);
        if (id === activeId) update(id, { minimized: true });
        else focus(id);
    };

    // Keep windows reachable when the viewport shrinks
    useEffect(() => {
        const onResize = () => {
            const bounds = getBounds();
            setWindows((current) =>
                current.map((w) => ({
                    ...w,
                    ...clampPosition(w.x, w.y, w.w, bounds),
                }))
            );
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [getBounds]);

    // Escape closes the start menu; with nothing open it asks the 3D scene
    // to step back from the laptop (focus is inside this frame after a click,
    // so the scene's own Escape listener never sees the key).
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            if (menuOpen) { setMenuOpen(false); return; }
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'portfolio-leave' }, window.location.origin);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [menuOpen]);

    const contextValue = useMemo(
        () => ({ openApp, compact, wallpaperId, setWallpaper, theme }),
        [openApp, compact, wallpaperId, setWallpaper, theme]
    );

    // The Minecraft theme brings its own wallpaper (CSS) unless a screenshot is configured
    const themeWallpaper = safeUrl(minecraftTheme.wallpaper);
    const surfaceStyle: React.CSSProperties =
        theme === 'minecraft'
            ? themeWallpaper
                ? { background: `#2b4a1f url("${themeWallpaper}") center / cover no-repeat` }
                : {}
            : wallpaperStyle(getWallpaper(wallpaperId));

    return (
        <DesktopContext.Provider value={contextValue}>
            <div className={`dsk-root${compact ? ' is-compact' : ''}`}>
                <main
                    className="dsk-surface"
                    style={surfaceStyle}
                    ref={surfaceRef}
                    onPointerDown={() => setMenuOpen(false)}
                    tabIndex={-1}
                    aria-label="Desktop"
                >
                    <div className="dsk-signature" aria-hidden="true">
                        <strong>{profile.name}</strong>
                        <span>Personal workspace</span>
                    </div>
                    <nav className="dsk-icons" aria-label="Applications">
                        {APPS.filter((app) => app.onDesktop).map((app) => (
                            <button
                                key={app.id}
                                className="dsk-icon"
                                onClick={() => openApp(app.id)}
                            >
                                <app.Icon size={40} />
                                <span>{app.title}</span>
                            </button>
                        ))}
                    </nav>

                    <ThemeDiscovery compact={compact} open={hintVisible} onToggle={() => setHintVisible(open => !open)}
                        onClose={() => setHintVisible(false)} onChangeTheme={changeTheme} theme={theme} />

                    {windows.map((w) => {
                        const app = getApp(w.id);
                        const Content = app.Component;
                        return (
                            <Window
                                key={w.id}
                                state={w}
                                title={app.title}
                                Icon={app.Icon}
                                active={w.id === activeId}
                                compact={compact}
                                locationBar={app.locationBar !== false}
                                getBounds={getBounds}
                                onFocus={() => focus(w.id)}
                                onClose={() => close(w.id)}
                                onMinimize={() => update(w.id, { minimized: true })}
                                onToggleMaximize={() =>
                                    update(w.id, { maximized: !w.maximized })
                                }
                                onMove={(x, y) => update(w.id, { x, y })}
                            >
                                <AppLoadingBoundary>
                                    <React.Suspense fallback={<p role="status" style={{ padding: '12px 16px', fontSize: 12 }}>Opening {app.title}...</p>}>
                                        <Content />
                                    </React.Suspense>
                                </AppLoadingBoundary>
                            </Window>
                        );
                    })}
                </main>

                {toast && (
                    <div className="dsk-toast" role="status" aria-live="polite">
                        {toast}
                    </div>
                )}

                {menuOpen && <StartMenu owner={profile.name} onOpen={openApp} />}

                <Taskbar
                    owner={profile.name}
                    windows={windows}
                    activeId={activeId}
                    menuOpen={menuOpen}
                    onToggleMenu={() => setMenuOpen((open) => !open)}
                    onTaskClick={onTaskClick}
                    onOpenApp={openApp}
                    onShowDesktop={() => {
                        setMenuOpen(false);
                        setWindows((current) => {
                            const shown = current.filter((w) => !w.minimized).map((w) => w.id);
                            if (shown.length) {
                                // First click hides everything and remembers what was showing.
                                peeked.current = shown;
                                return current.map((w) => ({ ...w, minimized: true }));
                            }
                            // Second click (nothing restored in between) brings those windows back.
                            const restore = peeked.current;
                            peeked.current = [];
                            return current.map((w) => restore.indexOf(w.id) !== -1 ? { ...w, minimized: false } : w);
                        });
                    }}
                />
            </div>
        </DesktopContext.Provider>
    );
};

export default Desktop;
