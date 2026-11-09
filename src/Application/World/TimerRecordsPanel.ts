import { cubingPersonalBests } from '../../desktop/content/cubing';

/** DOM companion to the 3D timer: mouse hover, keyboard focus and touch/click. */
export default class TimerRecordsPanel {
    readonly element = document.createElement('section');
    private mode: 'hover' | 'focus' | 'click' | null = null;
    private overTimer = false;
    private overPanel = false;
    private dismissedHover = false;
    private skipFocus = false;
    private hideTimeout: ReturnType<typeof setTimeout> | undefined;

    constructor(readonly trigger: HTMLButtonElement) {
        const panel = this.element;
        panel.id = 'cubing-records'; panel.hidden = true;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-live', 'polite');
        panel.setAttribute('aria-label', 'Speedcubing personal best records');
        trigger.setAttribute('aria-controls', panel.id);
        trigger.setAttribute('aria-expanded', 'false');
        const header = document.createElement('div'); header.className = 'cubing-records-header';
        const title = document.createElement('strong'); title.textContent = 'Personal bests';
        const format = document.createElement('span');
        format.className = 'cubing-records-format'; format.tabIndex = 0;
        format.textContent = cubingPersonalBests.format;
        format.setAttribute('aria-describedby', 'cubing-average-help');
        const help = document.createElement('span'); help.id = 'cubing-average-help';
        help.className = 'cubing-records-help'; help.setAttribute('role', 'tooltip');
        help.textContent = 'Average of 5'; format.appendChild(help);
        const close = document.createElement('button'); close.type = 'button';
        close.textContent = '\u00d7'; close.setAttribute('aria-label', 'Dismiss cubing records');
        close.addEventListener('click', () => this.dismiss());
        header.append(title, format, close);
        const records = document.createElement('dl');
        cubingPersonalBests.records.forEach(({ event, time }) => {
            const name = document.createElement('dt'); name.textContent = event;
            const value = document.createElement('dd'); value.textContent = time || 'Not set';
            records.append(name, value);
        });
        panel.append(header, records); document.body.appendChild(panel);
        trigger.addEventListener('focus', () => {
            if (this.skipFocus) { this.skipFocus = false; return; }
            this.show('focus');
        });
        trigger.addEventListener('click', () => this.show('click'));
        const blur = (event: FocusEvent) => {
            if (event.relatedTarget === trigger || panel.contains(event.relatedTarget as Node)) return;
            this.scheduleHide();
        };
        trigger.addEventListener('blur', blur); panel.addEventListener('focusout', blur);
        panel.addEventListener('pointerenter', () => { this.overPanel = true; this.cancelHide(); });
        panel.addEventListener('pointerleave', () => { this.overPanel = false; this.scheduleHide(); });
        document.addEventListener('pointerdown', (event) => {
            if (!panel.hidden && !panel.contains(event.target as Node) && event.target !== trigger) this.hide();
        }, true);
        // Consume Escape first: dismissing records should not also close the drawer.
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape' || panel.hidden) return;
            event.preventDefault(); event.stopImmediatePropagation(); this.dismiss();
        }, true);
        document.addEventListener('mouseleave', () => { this.overTimer = false; this.overPanel = false; this.scheduleHide(); });
    }

    show(mode: 'hover' | 'focus' | 'click') {
        if (mode === 'hover' && this.dismissedHover) return;
        this.cancelHide(); if (mode !== 'hover' || !this.focusInside()) this.mode = mode;
        this.element.hidden = false; this.trigger.setAttribute('aria-expanded', 'true');
    }

    setHovered(hovered: boolean) {
        if (hovered === this.overTimer) return;
        this.overTimer = hovered;
        if (hovered) this.show('hover');
        else { this.dismissedHover = false; this.scheduleHide(); }
    }

    private focusInside() {
        const active = document.activeElement;
        return this.element.contains(active) || (active === this.trigger && (this.mode === 'focus' || !!active?.matches(':focus-visible')));
    }

    private scheduleHide() {
        this.cancelHide();
        this.hideTimeout = setTimeout(() => {
            if (!this.overTimer && !this.overPanel && !this.focusInside()) this.hide();
        }, 140);
    }

    private cancelHide() {
        if (this.hideTimeout !== undefined) clearTimeout(this.hideTimeout);
        this.hideTimeout = undefined;
    }

    private dismiss() {
        const returnFocus = this.element.contains(document.activeElement);
        this.dismissedHover = this.overTimer; this.hide();
        if (returnFocus) { this.skipFocus = true; this.trigger.focus({ preventScroll: true }); }
    }

    hide() {
        this.cancelHide(); this.mode = null; this.element.hidden = true;
        this.trigger.setAttribute('aria-expanded', 'false');
    }

    position(x: number, y: number, width: number, height: number, contents?: { left: number; right: number; top: number }) {
        if (this.element.hidden) return;
        const rect = this.element.getBoundingClientRect(), gap = 18;
        const right = Math.max(x+gap, (contents?.right ?? x)+gap);
        const left = Math.min(x-gap, (contents?.left ?? x)-gap)-rect.width;
        let px: number, py = y-rect.height/2;
        if (right+rect.width <= width-16) {
            px=right; this.element.setAttribute('data-side','right');
        } else if (left >= 16) {
            px=left; this.element.setAttribute('data-side','left');
        } else {
            px=x-rect.width/2; py=(contents?.top ?? y)-rect.height-gap;
            this.element.setAttribute('data-side','above');
        }
        this.element.style.left = `${Math.max(16,Math.min(px,width-rect.width-16))}px`;
        this.element.style.top = `${Math.max(16,Math.min(py,height-rect.height-72))}px`;
    }
}
