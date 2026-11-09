import React, { useEffect, useMemo, useState } from 'react';
import { albums } from '../content/albums';
import { Album } from '../content/types';
import { ArrowLeftIcon, LinkIcon } from '../icons';
import { PlaceholderTag } from '../components/ui';
import { safeUrl } from '../util';

/**
 * Favourite-albums library, inspired by Windows Media Player 11's album
 * view. It only lists albums and links out to Spotify: no playback, no
 * Spotify API, no embeds.
 */

type Sort = 'mine' | 'title' | 'artist' | 'year';

const SORTS: { id: Sort; label: string }[] = [
    { id: 'mine', label: 'My order' },
    { id: 'title', label: 'Title' },
    { id: 'artist', label: 'Artist' },
    { id: 'year', label: 'Year' },
];

/** Deterministic original cover for albums without artwork. */
const coverStyle = (seed: string): React.CSSProperties => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
    return {
        background:
            `radial-gradient(circle at 50% 50%, #0b0f14 0 9%, transparent 10%),` +
            `repeating-radial-gradient(circle at 50% 50%, #0000 0 5px, #00000022 5px 6px),` +
            `linear-gradient(135deg, hsl(${h} 55% 46%), hsl(${(h + 60) % 360} 50% 20%))`,
    };
};

const Cover: React.FC<{ album: Album; large?: boolean }> = ({ album, large }) => {
    const art = album.cover ? safeUrl(album.cover) : null;
    const cls = `alb-cover${large ? ' is-large' : ''}`;
    return art ? (
        <img className={cls} src={art} alt={`${album.title} cover`} />
    ) : (
        <span className={`${cls} is-generated`} style={coverStyle(album.id)} aria-hidden="true" />
    );
};

const sortAlbums = (list: Album[], sort: Sort) => {
    if (sort === 'mine') return list;
    const copy = list.slice();
    copy.sort((a, b) => {
        if (sort === 'year') return (a.year ?? 9999) - (b.year ?? 9999);
        return a[sort].localeCompare(b[sort]);
    });
    return copy;
};

const Detail: React.FC<{ album: Album; onBack: () => void }> = ({ album, onBack }) => {
    const raw = album.spotifyUrl ? safeUrl(album.spotifyUrl) : null;
    const spotify = raw && raw.startsWith('https://') ? raw : null;
    return (
        <article className="alb-detail">
            <button type="button" className="alb-back" onClick={onBack}>
                <ArrowLeftIcon size={14} /> Back to library
            </button>
            <div className="alb-detail-body">
                <div className="alb-art">
                    <Cover album={album} large />
                </div>
                <div className="alb-info">
                    <h2>
                        {album.title}
                        <PlaceholderTag show={album.placeholder} />
                    </h2>
                    <p className="alb-artist">{album.artist}</p>
                    <p className="alb-year">{album.year ? `Released ${album.year}` : 'Release year not added yet'}</p>
                    {album.note ? (
                        <p className="alb-note">{album.note}</p>
                    ) : (
                        album.placeholder && (
                            <p className="alb-note is-empty">
                                [Placeholder: a personal note about why this album matters.] Edit
                                src/desktop/content/albums.ts.
                            </p>
                        )
                    )}
                    {spotify ? (
                        <a
                            className="alb-listen"
                            href={spotify}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <LinkIcon size={16} /> Listen on Spotify
                        </a>
                    ) : (
                        <span className="alb-listen is-disabled" aria-disabled="true">
                            <LinkIcon size={16} /> Spotify link coming soon
                        </span>
                    )}
                    <small className="alb-fineprint">Opens Spotify in a new tab. Nothing plays here.</small>
                </div>
            </div>
        </article>
    );
};

const MusicApp: React.FC = () => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [sort, setSort] = useState<Sort>('mine');
    const list = useMemo(() => sortAlbums(albums, sort), [sort]);
    const selected = albums.find((a) => a.id === selectedId) || null;

    // Escape returns to the library, as Back does
    useEffect(() => {
        if (!selected) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setSelectedId(null);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [selected]);

    return (
        <div className="alb-app">
            <header className="alb-top">
                <span className="alb-crumbs">
                    <button type="button" onClick={() => setSelectedId(null)}>
                        Library
                    </button>
                    <b aria-hidden="true">›</b>
                    <span>Favourite albums</span>
                    {selected && (
                        <>
                            <b aria-hidden="true">›</b>
                            <span>{selected.title}</span>
                        </>
                    )}
                </span>
                {!selected && (
                    <span className="alb-sort" role="group" aria-label="Sort albums">
                        <small>Sort by</small>
                        {SORTS.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                className={sort === s.id ? 'is-on' : ''}
                                aria-pressed={sort === s.id}
                                onClick={() => setSort(s.id)}
                            >
                                {s.label}
                            </button>
                        ))}
                    </span>
                )}
            </header>

            <div className="alb-main">
                {selected ? (
                    <Detail album={selected} onBack={() => setSelectedId(null)} />
                ) : albums.length === 0 ? (
                    <p className="alb-empty">No albums yet. Add some in src/desktop/content/albums.ts.</p>
                ) : (
                    <ul className="alb-grid">
                        {list.map((album) => (
                            <li key={album.id}>
                                <button
                                    type="button"
                                    className="alb-tile"
                                    onClick={() => setSelectedId(album.id)}
                                    title={`${album.title} · ${album.artist}`}
                                >
                                    <Cover album={album} />
                                    <strong>{album.title}</strong>
                                    <span>{album.artist}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <footer className="alb-status">
                {selected
                    ? `${selected.title} · ${selected.artist}`
                    : `${albums.length} album${albums.length === 1 ? '' : 's'}`}
            </footer>
        </div>
    );
};

export default MusicApp;
