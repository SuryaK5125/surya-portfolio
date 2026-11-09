import React, { useEffect, useRef } from 'react';
import type { AppId } from '../registry';
import { IconProps } from '../icons';
import { clamp } from '../util';

export type WindowState = {
    id: AppId;
    x: number;
    y: number;
    w: number;
    h: number;
    /** Stacking order; the highest visible window is active. */
    z: number;
    minimized: boolean;
    maximized: boolean;
};

export type Bounds = { width: number; height: number };

// How much of a window must stay on screen while dragging
const KEEP_VISIBLE_X = 120;
const TITLEBAR_HEIGHT = 34;

/** Keeps a window's title bar reachable inside the given bounds. */
export function clampPosition(
    x: number,
    y: number,
    w: number,
    bounds: Bounds
): { x: number; y: number } {
    return {
        x: clamp(x, KEEP_VISIBLE_X - w, bounds.width - KEEP_VISIBLE_X),
        y: clamp(y, 0, bounds.height - TITLEBAR_HEIGHT),
    };
}

type WindowProps = {
    state: WindowState;
    title: string;
    Icon: React.FC<IconProps>;
    active: boolean;
    compact: boolean;
    /** Explorer-style location bar under the title bar (default on). */
    locationBar?: boolean;
    getBounds: () => Bounds;
    onFocus: () => void;
    onClose: () => void;
    onMinimize: () => void;
    onToggleMaximize: () => void;
    onMove: (x: number, y: number) => void;
};

const Window: React.FC<WindowProps> = ({
    state,
    title,
    Icon,
    active,
    compact,
    locationBar = true,
    getBounds,
    onFocus,
    onClose,
    onMinimize,
    onToggleMaximize,
    onMove,
    children,
}) => {
    const ref = useRef<HTMLElement>(null);
    const drag = useRef<{ dx: number; dy: number; pointerId: number } | null>(
        null
    );
    const canDrag = !compact && !state.maximized;

    // Move keyboard focus into a newly opened window
    useEffect(() => {
        ref.current?.focus();
    }, []);

    // Pointer capture keeps the drag going even if the cursor outruns the
    // title bar. No preventDefault: the bridge relies on the compatibility
    // mouse events that pointer events still produce.
    const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
        if (!canDrag || event.button !== 0) return;
        if ((event.target as HTMLElement).closest('button')) return;
        drag.current = {
            dx: event.clientX - state.x,
            dy: event.clientY - state.y,
            pointerId: event.pointerId,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const { x, y } = clampPosition(
            event.clientX - current.dx,
            event.clientY - current.dy,
            state.w,
            getBounds()
        );
        onMove(x, y);
    };

    const endDrag = (event: React.PointerEvent<HTMLElement>) => {
        if (drag.current && drag.current.pointerId === event.pointerId) {
            drag.current = null;
        }
    };

    const geometry: React.CSSProperties =
        compact || state.maximized
            ? {}
            : { left: state.x, top: state.y, width: state.w, height: state.h };

    const className = [
        'dsk-window',
        active && 'is-active',
        state.maximized && 'is-maximized',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <section
            ref={ref}
            className={className}
            style={{ ...geometry, zIndex: 10 + state.z }}
            hidden={state.minimized}
            tabIndex={-1}
            aria-label={title}
            onMouseDown={onFocus}
        >
            <header
                className={`dsk-titlebar${canDrag ? ' is-draggable' : ''}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onDoubleClick={() => !compact && onToggleMaximize()}
            >
                <Icon size={16} />
                <span className="dsk-title">{title}</span>
                <div className="dsk-controls">
                    <button
                        aria-label={`Minimize ${title}`}
                        title="Minimize"
                        onClick={onMinimize}
                    >
                        <span className="dsk-glyph-min" />
                    </button>
                    {!compact && (
                        <button
                            aria-label={`${state.maximized ? 'Restore' : 'Maximize'} ${title}`}
                            title={state.maximized ? 'Restore' : 'Maximize'}
                            onClick={onToggleMaximize}
                        >
                            <span className="dsk-glyph-max" />
                        </button>
                    )}
                    <button
                        aria-label={`Close ${title}`}
                        title="Close"
                        onClick={onClose}
                    >
                        <span className="dsk-glyph-close" />
                    </button>
                </div>
            </header>
            {locationBar && (
                <div className="dsk-location" aria-label={`Personal workspace, ${title}`}>
                    <Icon size={16} />
                    <span>Personal workspace</span><b aria-hidden="true">›</b><span>{title}</span>
                </div>
            )}
            <div className="dsk-window-body">{children}</div>
        </section>
    );
};

export default Window;
