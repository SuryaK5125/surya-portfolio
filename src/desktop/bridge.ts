/**
 * Input bridge: forwards pointer and key events from the desktop document to
 * the 3D scene in the parent window for camera input. A separate, limited
 * channel requests quiet sounds for native desktop control activations only.
 *
 * Message shape: { type, clientX?, clientY?, key? } — validated by the
 * parent's listener in World/MonitorScreen.ts.
 */

const POINTER_EVENTS = ['mousemove', 'mousedown', 'mouseup'] as const;
const KEY_EVENTS = ['keydown', 'keyup'] as const;

export function startBridge() {
    // Opened standalone (not framed): nothing to forward to.
    if (window.parent === window) return;

    // The desktop is served from the same origin as the scene, so never
    // broadcast to '*'.
    const targetOrigin = window.location.origin;
    const send = (message: object) =>
        window.parent.postMessage(message, targetOrigin);

    for (const type of POINTER_EVENTS) {
        document.addEventListener(type, (event: MouseEvent) => {
            send({ type, clientX: event.clientX, clientY: event.clientY });
        });
    }

    for (const type of KEY_EVENTS) {
        document.addEventListener(type, (event: KeyboardEvent) => {
            send({ type, key: event.key });
        });
    }

    // Capture before React can remove a closing window/menu from the document.
    // Native keyboard-activated buttons also emit trusted clicks; programmatic
    // clicks, hover, dragging, scrolling and ordinary typing remain silent.
    document.addEventListener('click', (event: MouseEvent) => {
        if (!event.isTrusted || !(event.target instanceof Element)) return;
        const control = event.target.closest(
            '.dsk-icon, .dsk-start, .dsk-task, .dsk-show-desktop, .dsk-controls button, .dsk-menu-item, .dsk-menu-links button'
        ) as HTMLButtonElement | null;
        if (!control || control.disabled) return;
        const dismiss = control.closest('.dsk-controls') && control.title === 'Close';
        send({ type: 'portfolio-sound', cue: dismiss ? 'dismiss' : 'tap' });
    }, true);
}
