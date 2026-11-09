import React, { useState } from 'react';
import { profile } from '../content/profile';
import {
    OutsideCredit,
    inspiration,
    libraries,
    madeHere,
    models,
    posters,
    wallpapers,
} from '../content/credits';
import { ExternalLink } from '../components/ui';
import { safeUrl } from '../util';
import './CreditsApp.css';

/**
 * Credits: what was made for this portfolio, and who made everything else.
 * All text lives in content/credits.ts.
 */

const hostOf = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
};

const Row: React.FC<{ credit: OutsideCredit }> = ({ credit }) => {
    const by = credit.byUrl ? safeUrl(credit.byUrl) : null;
    const license = credit.licenseUrl ? safeUrl(credit.licenseUrl) : null;
    return (
        <li className="crd-row">
            <div className="crd-main">
                <strong>{credit.name}</strong>
                {credit.by && (
                    <span className="crd-by">
                        {' '}
                        by {by ? <ExternalLink href={by}>{credit.by}</ExternalLink> : credit.by}
                    </span>
                )}
                {credit.license && (
                    <span className="crd-license">
                        {' '}
                        &middot; {license ? <ExternalLink href={license}>{credit.license}</ExternalLink> : credit.license}
                    </span>
                )}
            </div>
            <div className="crd-source">
                <ExternalLink href={credit.source}>{hostOf(credit.source)}</ExternalLink>
            </div>
            {credit.notes && (
                <details className="crd-notes">
                    <summary>Details</summary>
                    <p>{credit.notes}</p>
                </details>
            )}
        </li>
    );
};

const Group: React.FC<{ title: string; intro?: string; items: OutsideCredit[] }> = ({ title, intro, items }) => (
    <section className="crd-group">
        <h3>{title}</h3>
        {intro && <p className="crd-intro">{intro}</p>}
        <ul>
            {items.map((credit) => (
                <Row key={credit.source} credit={credit} />
            ))}
        </ul>
    </section>
);

type Tab = 'made' | 'credits';

const CreditsApp: React.FC = () => {
    const [tab, setTab] = useState<Tab>('made');
    const tabs: { id: Tab; label: string }[] = [
        { id: 'made', label: 'Made in-house' },
        { id: 'credits', label: 'Credits and sources' },
    ];

    return (
        <div className="crd">
            <header className="crd-head">
                <h2>Credits</h2>
                <p>
                    How {profile.name}&rsquo;s portfolio was put together: what was made here, and the work of
                    others it stands on.
                </p>
            </header>

            <div className="crd-tabs" role="tablist" aria-label="Credits sections">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        id={`crd-tab-${t.id}`}
                        aria-selected={tab === t.id}
                        aria-controls={`crd-panel-${t.id}`}
                        className={tab === t.id ? 'is-on' : ''}
                        onClick={() => setTab(t.id)}
                        onKeyDown={(event) => {
                            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                                event.preventDefault();
                                setTab(tab === 'made' ? 'credits' : 'made');
                            }
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div
                className="crd-panel"
                role="tabpanel"
                id={`crd-panel-${tab}`}
                aria-labelledby={`crd-tab-${tab}`}
            >
                {tab === 'made' ? (
                    <ul className="crd-made">
                        {madeHere.map((item) => (
                            <li key={item.title}>
                                <h3>{item.title}</h3>
                                <p>{item.text}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <>
                        <Group title="Inspiration" items={inspiration} />
                        <Group title="3D models" intro="From Sketchfab, shared under Creative Commons." items={models} />
                        <Group
                            title="Posters"
                            intro="Artwork found on Pinterest; each link goes to the pin it came from."
                            items={posters}
                        />
                        <Group
                            title="Wallpapers"
                            intro="Windows 7 wallpapers, from the Windows Wallpaper wiki."
                            items={wallpapers}
                        />
                        <section className="crd-group">
                            <h3>Libraries</h3>
                            <p>{libraries}</p>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
};

export default CreditsApp;
