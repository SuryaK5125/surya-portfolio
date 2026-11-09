import React, { useEffect, useRef, useState } from 'react';
import UIEventBus from '../EventBus';
import { isTouchPrimary } from '../../Utils/motion';

/**
 * Small, state-aware guidance shown over the 3D scene (the opening flight
 * itself has no UI; a click or Esc quietly skips it):
 * - on the desk: a one-off hint about what can be clicked;
 * - on the laptop screen: a persistent Back control (the only way back on
 *   touch screens) plus a one-off hint the first time;
 * - in free camera: a one-off hint about dragging and zooming.
 * Hints never block input (pointer-events: none) and fade on their own.
 */

type Mode = 'boot' | 'intro' | 'scene' | 'monitor' | 'free';

const HINT_MS = { desk: 4800, monitor: 3200, free: 4200 };

const SceneHints: React.FC = () => {
    // Mounted with the boot screen so it hears introStart/introDone, which the
    // camera dispatches synchronously when the boot screen is dismissed.
    const [mode, setMode] = useState<Mode>('boot');
    const [hint, setHint] = useState<string | null>(null);
    const [inDrawer, setInDrawer] = useState(false);
    const shown = useRef<{ [key: string]: boolean }>({});
    const current = useRef<string | null>(null);
    const timer = useRef<number | undefined>(undefined);
    const touch = isTouchPrimary();

    const clearHint = () => {
        window.clearTimeout(timer.current);
        current.current = null;
        setHint(null);
    };
    const showOnce = (key: keyof typeof HINT_MS, text: string) => {
        if (shown.current[key]) return;
        shown.current[key] = true;
        window.clearTimeout(timer.current);
        current.current = key;
        setHint(text);
        timer.current = window.setTimeout(clearHint, HINT_MS[key]);
    };

    useEffect(() => {
        let activeMode: Mode = 'boot';
        let drawerFocused = false;
        let pending: number | undefined;
        const changeMode = (next: Mode) => {
            activeMode = next; setMode(next);
            window.clearTimeout(pending); clearHint();
        };
        const schedule = (key: keyof typeof HINT_MS, text: string, delay: number) => {
            window.clearTimeout(pending);
            pending = window.setTimeout(() => {
                if (!drawerFocused && activeMode === (key === 'desk' ? 'scene' : key)) showOnce(key, text);
            }, delay);
        };
        UIEventBus.on('introStart', () => changeMode('intro'));
        UIEventBus.on('introDone', (detail?: { skipped?: boolean }) => {
            changeMode('scene');
            schedule('desk', touch ? 'Tap screen: laptop / Tap handle: drawer' : 'Click screen: laptop / Click handle: drawer', detail?.skipped ? 900 : 200);
        });
        UIEventBus.on('enterMonitor', () => {
            changeMode('monitor');
            schedule('monitor', touch ? 'Desk: return to scene' : 'Esc / Click outside: desk', 900);
        });
        UIEventBus.on('leftMonitor', () => changeMode('scene'));
        UIEventBus.on('freeCamFocus', () => changeMode('scene'));
        UIEventBus.on('freeCamToggle', (on: boolean) => {
            changeMode(on ? 'free' : 'scene');
            if (on) schedule('free', touch ? 'Drag: orbit / Pinch: zoom' : 'Drag: orbit / Scroll: zoom', 200);
        });
        UIEventBus.on('drawerFocusChange', (focused: boolean) => {
            drawerFocused = focused; setInDrawer(focused);
            if (focused) { window.clearTimeout(pending); clearHint(); }
        });
        // The first real interaction dismisses the desk hint early
        const onDown = () => {
            if (current.current !== 'desk') return;
            window.setTimeout(() => {
                if (current.current === 'desk') clearHint();
            }, 1200);
        };
        document.addEventListener('pointerdown', onDown);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            window.clearTimeout(pending); window.clearTimeout(timer.current);
        };
    }, []);

    return (
        <div className="scene-ui">
            <p className={`scene-hint${hint ? ' is-visible' : ''}`} role="status" aria-live="polite">
                {hint || ''}
            </p>
            {mode === 'scene' && <nav className="scene-touch-actions" aria-label="Desk interactions">
                <button type="button" onClick={() => UIEventBus.dispatch('requestSceneFocus', 'laptop')}>Open laptop</button>
                {!inDrawer && <button type="button" onClick={() => UIEventBus.dispatch('requestSceneFocus', 'drawer')}>Top drawer</button>}
            </nav>}
            {mode === 'monitor' && (
                <button
                    type="button"
                    className="scene-back"
                    aria-label="Back to the desk"
                    title="Back to the desk (Esc)"
                    onClick={() => UIEventBus.dispatch('requestLeaveMonitor', {})}
                >
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                        <path d="M12.5 4.5 7 10l5.5 5.5" />
                    </svg>
                    <span>Desk</span>
                </button>
            )}
        </div>
    );
};

export default SceneHints;
