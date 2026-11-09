import React, { useEffect, useState } from 'react';
import { profile } from '../desktop/content/profile';
import { contact } from '../desktop/content/contact';
import type { Photo } from '../desktop/content/types';

/**
 * Standalone personal page at /about/, also shown inside the desktop's
 * browser app. Laid out like a classic personal homepage: a narrow sidebar
 * with the site name and section links, and one long scrolling column.
 * All text comes from src/desktop/content/*; asset paths in the content
 * files are relative to /desktop/.
 */

const ALLOWED = ['https:', 'http:'];

/** Resolves a content path (relative to /desktop/) to a safe absolute URL. */
const desktopAsset = (path: string | null | undefined): string | null => {
    if (!path) return null;
    try {
        const url = new URL(path, new URL('../desktop/', window.location.href));
        return ALLOWED.indexOf(url.protocol) !== -1 ? url.href : null;
    } catch {
        return null;
    }
};

const external = (href: string | null | undefined): string | null => {
    if (!href) return null;
    try {
        const url = new URL(href);
        return ALLOWED.indexOf(url.protocol) !== -1 ? url.href : null;
    } catch {
        return null;
    }
};

const isFramed = (() => {
    try {
        return window.self !== window.top;
    } catch {
        return true;
    }
})();

const THEME_KEY = 'desktop.theme';

const slug = (title: string) =>
    title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

/**
 * Follows the desktop's theme (same origin, same localStorage key). The
 * desktop writes it when the Konami code is entered; the `storage` event
 * reaches this page even while it is framed inside the browser app.
 */
const useDesktopTheme = () => {
    useEffect(() => {
        const read = () => {
            try {
                return window.localStorage.getItem(THEME_KEY) === 'minecraft' ? 'minecraft' : 'aero';
            } catch {
                return 'aero';
            }
        };
        const apply = () => document.documentElement.setAttribute('data-theme', read());
        apply();
        const onStorage = (event: StorageEvent) => {
            if (event.key === THEME_KEY || event.key === null) apply();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
};

/** Marks the section currently being read, for the sidebar's ○ marker. */
const useCurrentSection = (ids: string[]) => {
    const [current, setCurrent] = useState(ids[0]);
    useEffect(() => {
        const update = () => {
            const line = window.innerHeight * 0.3;
            let active = ids[0];
            for (const id of ids) {
                const el = document.getElementById(id);
                if (el && el.getBoundingClientRect().top <= line) active = id;
            }
            // At the very bottom, the last section is the one being read
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
                active = ids[ids.length - 1];
            }
            setCurrent(active);
        };
        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [ids.join('|')]);
    return current;
};

const Figure: React.FC<{ photo: Photo | null | undefined; number: number; className: string }> = ({
    photo,
    number,
    className,
}) => {
    const src = photo ? desktopAsset(photo.src) : null;
    if (!photo || !src) return null;
    return (
        <figure className={className}>
            <div className="ab-frame">
                <img src={src} alt={photo.alt} decoding="async" />
            </div>
            <figcaption>
                <b>Figure {number}</b>. {photo.caption || photo.alt}
            </figcaption>
        </figure>
    );
};

/** A paragraph that is still template text is shown muted, so it reads as a draft. */
const Para: React.FC<{ text: string }> = ({ text }) => (
    <p className={/^\[.*\]$/.test(text.trim()) ? 'ab-draft' : undefined}>{text}</p>
);

const AboutPage: React.FC = () => {
    useDesktopTheme();
    const { name, headline, intro, photo, story = [] } = profile;
    const link = (label: string) =>
        external((contact.links.find((l) => l.label === label) || { url: null }).url);
    const github = link('GitHub');
    const linkedin = link('LinkedIn');

    useEffect(() => {
        document.title = `About ${name}`;
    }, [name]);

    const sections = [{ id: 'welcome', title: 'Welcome' }, ...story.map((c) => ({ id: slug(c.title), title: c.title }))];
    const current = useCurrentSection(sections.map((s) => s.id));
    const firstName = name.split(' ')[0];
    let figure = 0;

    return (
        <div className="ab-site" id="top">
            <aside className="ab-sidebar">
                <div className="ab-sidebar-inner">
                    <a className="ab-sitename" href="#top">
                        {name.split(' ').map((part) => (
                            <span key={part}>{part}</span>
                        ))}
                    </a>
                    <p className="ab-sitelabel">Personal homepage</p>
                    <nav aria-label="On this page">
                        <ul>
                            {sections.map((section) => (
                                <li key={section.id} className={section.id === current ? 'is-current' : undefined}>
                                    <a href={`#${section.id}`} aria-current={section.id === current ? 'location' : undefined}>
                                        {section.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>
            </aside>

            <main className="ab-main">
                <section id="welcome" className="ab-welcome">
                    <h1>Welcome</h1>
                    <p className="ab-subtitle">I&rsquo;m {name}</p>
                    {headline && <p className="ab-headline">{headline}</p>}
                    {intro.map((p, i) => (
                        <Para key={i} text={p} />
                    ))}
                </section>

                {story.map((chapter, i) => {
                    const id = slug(chapter.title);
                    const last = i === story.length - 1;
                    // The last chapter sits beside the present-day portrait, as on
                    // classic personal pages; earlier chapters show their own photo
                    // as a wide figure after the first paragraph.
                    if (last) {
                        const portrait = photo && desktopAsset(photo.src) ? photo : null;
                        if (portrait) figure += 1;
                        return (
                            <section key={id} id={id} className="ab-chapter ab-split">
                                <div className="ab-split-text">
                                    <h2>{chapter.title}</h2>
                                    {chapter.paragraphs.map((p, j) => (
                                        <Para key={j} text={p} />
                                    ))}
                                </div>
                                {portrait && <Figure photo={portrait} number={figure} className="ab-figure ab-portrait" />}
                            </section>
                        );
                    }
                    const wide = chapter.photo && desktopAsset(chapter.photo.src) ? chapter.photo : null;
                    if (wide) figure += 1;
                    const n = figure;
                    return (
                        <section key={id} id={id} className="ab-chapter">
                            <h2>{chapter.title}</h2>
                            {chapter.paragraphs.slice(0, 1).map((p, j) => (
                                <Para key={j} text={p} />
                            ))}
                            {wide && <Figure photo={wide} number={n} className="ab-figure ab-landscape" />}
                            {chapter.paragraphs.slice(1).map((p, j) => (
                                <Para key={j + 1} text={p} />
                            ))}
                        </section>
                    );
                })}

                <section className="ab-closing">
                    <p>
                        Thanks for reading about me, and for taking the time to look around.
                        {(github || linkedin) && ' If you would like to see more of my work or get in touch, you can find me on '}
                        {github && (
                            <a href={github} target="_blank" rel="noopener noreferrer">
                                GitHub
                            </a>
                        )}
                        {github && linkedin && ' and '}
                        {linkedin && (
                            <a href={linkedin} target="_blank" rel="noopener noreferrer">
                                LinkedIn
                            </a>
                        )}
                        {(github || linkedin) && '.'}
                    </p>
                    <p>
                        &mdash; {firstName}
                        {!isFramed && (
                            <>
                                {' · '}
                                <a href="../">Back to the 3D desk</a>
                            </>
                        )}
                    </p>
                </section>
            </main>

            <footer className="ab-status">
                <span>&copy; {new Date().getFullYear()} {name}</span>
                <a href="#top">Back to top</a>
            </footer>
        </div>
    );
};

export default AboutPage;
