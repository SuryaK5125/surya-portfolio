import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import HintBalloon from './HintBalloon';

/** Original seated pixel character, drawn here from rectangles; no game sprite. */
const ThemeDiscovery: React.FC<{ compact: boolean; open: boolean; onToggle: () => void; onClose: () => void; onChangeTheme: () => void; theme: string }> =
    ({ compact, open, onToggle, onClose, onChangeTheme, theme }) => {
        const trigger = useRef<HTMLButtonElement>(null);
        const [touch, setTouch] = useState(() => window.matchMedia('(hover: none) and (pointer: coarse)').matches);
        useEffect(() => {
            if (!open) return;
            const dismiss = (event: Event) => {
                const target = event.target as HTMLElement;
                if (!target.closest?.('#theme-discovery, .dsk-steve')) onClose();
            };
            const escape = (event: KeyboardEvent) => {
                if (event.key !== 'Escape') return;
                event.preventDefault(); event.stopPropagation(); onClose(); trigger.current?.focus();
            };
            document.addEventListener('pointerdown', dismiss);
            document.addEventListener('keydown', escape, true);
            return () => {
                document.removeEventListener('pointerdown', dismiss);
                document.removeEventListener('keydown', escape, true);
            };
        }, [open, onClose]);
        return <>
            <button type="button" ref={trigger} className="dsk-steve" title="Steve — discover another theme"
                aria-label="Steve — discover another theme" aria-controls="theme-discovery" aria-expanded={open}
                onPointerDown={event => setTouch(event.pointerType === 'touch' || event.pointerType === 'pen' || window.matchMedia('(hover: none) and (pointer: coarse)').matches)}
                onClick={onToggle}>
                <svg viewBox="0 0 24 32" width="30" height="40" shapeRendering="crispEdges" aria-hidden="true">
                    <path fill="#342923" d="M7 1h11v10H7z" />
                    <path fill="#b98464" d="M8 5h9v8H8zM4 15h4v10H4zM18 15h3v9h-3z" />
                    <path fill="#d49b76" d="M8 6h3v4H8zM4 23h4v3H4zM18 22h3v3h-3z" />
                    <path fill="#e4d9ca" d="M9 7h3v2H9zM14 7h3v2h-3z" />
                    <path fill="#404955" d="M10 7h2v2h-2zM14 7h2v2h-2z" />
                    <path fill="#684334" d="M11 10h5v2h-5z" />
                    <path fill="#379ba4" d="M7 13h11v11H7zM4 14h3v4H4zM18 14h3v4h-3z" />
                    <path fill="#287780" d="M7 20h3v4H7zM16 14h2v10h-2z" />
                    <path fill="#555280" d="M7 24h12v4H7zM9 27h4v4H9zM18 25h4v5h-4z" />
                    <path fill="#353541" d="M8 30h6v2H8zM18 29h5v2h-5z" />
                </svg>
            </button>
            {open && createPortal(<HintBalloon touch={touch || compact} onClose={() => { onClose(); trigger.current?.focus(); }} onChangeTheme={onChangeTheme} theme={theme} />, document.querySelector('.dsk-root')!)}
        </>;
    };
export default ThemeDiscovery;
