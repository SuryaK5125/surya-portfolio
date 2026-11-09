import React from 'react';
import { LinkIcon } from '../icons';
import { safeUrl } from '../util';

export const Section: React.FC<{ title: string }> = ({ title, children }) => (
    <section className="dsk-section">
        <h3>{title}</h3>
        {children}
    </section>
);

export const Chips: React.FC<{ items: string[] }> = ({ items }) => (
    <ul className="dsk-chips">
        {items.map((item, i) => (
            <li key={i}>{item}</li>
        ))}
    </ul>
);

export const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
    <ul className="dsk-bullets">
        {items.map((item, i) => (
            <li key={i}>{item}</li>
        ))}
    </ul>
);

/** Shown where content hasn't been provided yet. */
export const Hint: React.FC = ({ children }) => (
    <p className="dsk-hint">{children}</p>
);

export const PlaceholderTag: React.FC<{ show?: boolean }> = ({ show }) =>
    show ? <span className="dsk-tag">Placeholder</span> : null;

/** External link that opens in a new tab; renders nothing for unsafe URLs. */
export const ExternalLink: React.FC<{
    href: string | null | undefined;
    className?: string;
}> = ({ href, className, children }) => {
    const url = safeUrl(href);
    if (!url) return null;
    return (
        <a
            className={className}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
        >
            {children}
            <LinkIcon size={14} />
        </a>
    );
};
