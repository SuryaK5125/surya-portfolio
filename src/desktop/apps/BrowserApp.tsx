import React, { useRef, useState } from 'react';
import { profile } from '../content/profile';
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    BrowserIcon,
    LinkIcon,
    LockIcon,
    ReloadIcon,
} from '../icons';
import { safeUrl } from '../util';

// The standalone About page (src/about), served at /about/ next to /desktop/
const ABOUT_PATH = '../about/';

/**
 * Original browser-style window that shows the About page. Back/forward
 * stay disabled: the page has no internal navigation, and calling history
 * on a nested frame could navigate the portfolio itself.
 */
const BrowserApp: React.FC = () => {
    const frame = useRef<HTMLIFrameElement>(null);
    const url = safeUrl(ABOUT_PATH) || ABOUT_PATH;
    const [title, setTitle] = useState(`About ${profile.name}`);
    const [loading, setLoading] = useState(true);

    const display = (() => {
        try {
            const u = new URL(url);
            return { host: u.host, path: u.pathname };
        } catch {
            return { host: '', path: ABOUT_PATH };
        }
    })();

    const onLoad = () => {
        setLoading(false);
        try {
            const docTitle = frame.current?.contentDocument?.title;
            if (docTitle) setTitle(docTitle);
        } catch {
            /* cross-origin (shouldn't happen): keep the default title */
        }
    };

    const reload = () => {
        setLoading(true);
        try {
            frame.current?.contentWindow?.location.reload();
        } catch {
            if (frame.current) frame.current.src = url;
        }
    };

    return (
        <div className="brw-app">
            <div className="brw-tabs" role="tablist" aria-label="Tabs">
                <span className="brw-tab is-active" role="tab" aria-selected="true">
                    <BrowserIcon size={16} />
                    <span className="brw-tab-title">{title}</span>
                    {loading && <span className="brw-spinner" aria-label="Loading" />}
                </span>
            </div>
            <div className="brw-toolbar">
                <button aria-label="Back" title="Back" disabled>
                    <ArrowLeftIcon size={16} />
                </button>
                <button aria-label="Forward" title="Forward" disabled>
                    <ArrowRightIcon size={16} />
                </button>
                <button aria-label="Reload" title="Reload" onClick={reload}>
                    <ReloadIcon size={16} />
                </button>
                <label className="brw-omnibox">
                    <LockIcon size={14} />
                    <input
                        readOnly
                        aria-label="Address"
                        value={`${display.host}${display.path}`}
                        onFocus={(e) => e.currentTarget.select()}
                    />
                </label>
                <a
                    className="brw-open"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in a new tab"
                    aria-label="Open in a new tab"
                >
                    <LinkIcon size={15} />
                </a>
            </div>
            <iframe
                ref={frame}
                className="brw-frame"
                src={url}
                title={title}
                onLoad={onLoad}
            />
        </div>
    );
};

export default BrowserApp;
