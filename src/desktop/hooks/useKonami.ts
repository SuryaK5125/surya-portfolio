import { useEffect, useRef } from 'react';

const SEQUENCE = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
];

const isTyping = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el || !el.tagName) return false;
    return (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
    );
};

/**
 * Calls `onCode` when the Konami code is typed. Ignored while a text field
 * (Terminal, search boxes, Notes) has focus, and any such keystroke resets
 * the progress, so normal typing can never complete it.
 */
export function useKonami(onCode: () => void) {
    const callback = useRef(onCode);
    callback.current = onCode;

    useEffect(() => {
        let index = 0;
        const onKey = (event: KeyboardEvent) => {
            if (isTyping(event.target) || (event.target as HTMLElement | null)?.closest?.('.dsk-window, .dsk-menu')) {
                index = 0;
                return;
            }
            if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
            const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
            if (key === SEQUENCE[index]) index++;
            else index = key === SEQUENCE[0] ? 1 : 0;
            if (index === SEQUENCE.length) {
                index = 0;
                callback.current();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);
}
