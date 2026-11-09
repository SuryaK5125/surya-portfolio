const ALLOWED_PROTOCOLS = ['https:', 'http:', 'mailto:'];

/**
 * Returns an absolute URL if `url` uses an allowed protocol, otherwise null.
 * Relative paths resolve against the desktop page (/desktop/).
 */
export function safeUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url, window.location.href);
        return ALLOWED_PROTOCOLS.indexOf(parsed.protocol) !== -1
            ? parsed.href
            : null;
    } catch {
        return null;
    }
}

export const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));
