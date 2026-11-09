import React, { useEffect, useRef, useState } from 'react';

const SceneHelp: React.FC<{ available: boolean }> = ({ available }) => {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (!available) setOpen(false); }, [available]);
    useEffect(() => {
        if (!open) return;
        const dismiss = (event: PointerEvent) => {
            if (!(event.target as HTMLElement).closest?.('.scene-help, .scene-help-trigger')) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault(); event.stopImmediatePropagation(); setOpen(false); trigger.current?.focus();
        };
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', escape, true);
        return () => {
            document.removeEventListener('pointerdown', dismiss);
            document.removeEventListener('keydown', escape, true);
        };
    }, [open]);
    return <>
        <button type="button" ref={trigger} className="scene-help-trigger" aria-label="Scene help" aria-expanded={open}
            aria-controls="scene-help" onClick={() => setOpen(value => !value)}>?</button>
        {open && <section id="scene-help" className="scene-help" role="dialog" aria-label="Portfolio controls">
            <header><strong>Quick guide</strong><button type="button" aria-label="Close help" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button></header>
            <dl>
                <dt>Explore</dt><dd>Free camera: drag to look around; scroll or pinch to zoom.</dd>
                <dt>Enter</dt><dd>Click/tap the laptop for the desktop, or the top drawer to open it.</dd>
                <dt>Return</dt><dd>Use Desk, Close drawer or Esc to leave a focused view. Free camera’s Exit camera returns to the scene.</dd>
                <dt>One more thing</dt><dd>There might be a Steve above the date. I wonder what would happen if you clicked him.</dd>
            </dl>
        </section>}
    </>;
};
export default SceneHelp;
