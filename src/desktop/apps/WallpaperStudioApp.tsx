import React, { useContext, useState } from 'react';
import { DesktopContext } from '../context';
import { wallpapers } from '../content/wallpapers';
import { Wallpaper } from '../content/types';
import { getWallpaper, wallpaperStyle } from '../hooks/useWallpaper';
import { WallpaperIcon } from '../icons';

type Filter = 'all' | 'image' | 'drawn';

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'image', label: 'Images' },
    { id: 'drawn', label: 'Drawn in code' },
];

const kindLabel = (w: Wallpaper) => (w.kind === 'image' ? 'Static image' : 'Drawn in code');

/** Preview surface; the built-in uses the same CSS as the desktop. */
const Swatch: React.FC<{ wallpaper: Wallpaper; thumbnail?: boolean; className?: string }> = ({
    wallpaper,
    thumbnail,
    className = '',
}) => (
    <span
        className={`wps-swatch${wallpaper.kind === 'builtin' ? ' is-builtin' : ''} ${className}`}
        style={wallpaperStyle(wallpaper, thumbnail)}
        role="img"
        aria-label={`${wallpaper.title} preview`}
    />
);

const WallpaperStudioApp: React.FC = () => {
    const { wallpaperId, setWallpaper } = useContext(DesktopContext);
    const [selectedId, setSelectedId] = useState(wallpaperId);
    const [filter, setFilter] = useState<Filter>('all');

    const selected = getWallpaper(selectedId);
    const shown = wallpapers.filter((w) =>
        filter === 'all' ? true : filter === 'image' ? w.kind === 'image' : w.kind !== 'image'
    );
    const hasImages = wallpapers.some((w) => w.kind === 'image');
    const applied = selected.id === wallpaperId;

    return (
        <div className="wps-app">
            <section className="wps-gallery" aria-label="Wallpapers">
                <header className="wps-toolbar">
                    <span className="wps-brand">
                        <WallpaperIcon size={24} />
                        Wallpaper Studio
                    </span>
                    <div className="wps-filters" role="tablist" aria-label="Filter">
                        {FILTERS.map((f) => (
                            <button
                                key={f.id}
                                role="tab"
                                aria-selected={filter === f.id}
                                className={filter === f.id ? 'is-active' : undefined}
                                onClick={() => setFilter(f.id)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="wps-grid">
                    {shown.map((w) => (
                        <button
                            key={w.id}
                            className={[
                                'wps-tile',
                                w.id === selectedId && 'is-selected',
                                w.id === wallpaperId && 'is-applied',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            onClick={() => setSelectedId(w.id)}
                            onDoubleClick={() => setWallpaper(w.id)}
                            aria-pressed={w.id === selectedId}
                        >
                            <Swatch wallpaper={w} thumbnail />
                            <span className="wps-tile-title">{w.title}</span>
                            {w.id === wallpaperId && <span className="wps-badge">Applied</span>}
                        </button>
                    ))}
                    {!shown.length && (
                        <p className="wps-empty">
                            No images yet. Add your own to <code>static/desktop/wallpapers/</code> and
                            list them in <code>src/desktop/content/wallpapers.ts</code>.
                        </p>
                    )}
                </div>
                {!hasImages && filter === 'all' && (
                    <p className="wps-note">
                        Add your own images in <code>src/desktop/content/wallpapers.ts</code>.
                    </p>
                )}
            </section>

            <aside className="wps-detail" aria-label="Preview">
                <div className="wps-preview">
                    <Swatch wallpaper={selected} className="is-large" />
                    <span className="wps-preview-bar" aria-hidden="true" />
                </div>
                <h3>{selected.title}</h3>
                <dl className="wps-meta">
                    <dt>Type</dt>
                    <dd>{kindLabel(selected)}</dd>
                    {selected.credit && (
                        <>
                            <dt>Credit</dt>
                            <dd>{selected.credit}</dd>
                        </>
                    )}
                </dl>
                <button
                    className="wps-apply"
                    onClick={() => setWallpaper(selected.id)}
                    disabled={applied}
                >
                    {applied ? 'Applied' : 'Apply'}
                </button>
                <p className="wps-hint">Your choice is saved in this browser.</p>
            </aside>
        </div>
    );
};

export default WallpaperStudioApp;
