import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DesktopContext } from '../context';
import { getApp } from '../registry';
import { ProjectDetail } from './ProjectsApp';
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    DocumentIcon,
    FolderIcon,
    IconProps,
    WallpaperIcon,
} from '../icons';
import {
    Path,
    VNode,
    crumbLabel,
    homePath,
    nodeAt,
    onExplorerRequest,
    pathOf,
    pathString,
    searchTree,
    takePendingExplorerPath,
} from '../vfs';

type View = 'icons' | 'list';
type Menu = { x: number; y: number; node: VNode | null };

const FAVORITES: { label: string; path: () => Path }[] = [
    { label: 'Desktop', path: () => [...homePath(), 'Desktop'] },
    { label: 'Projects', path: () => [...homePath(), 'Projects'] },
    { label: 'Documents', path: () => [...homePath(), 'Documents'] },
    { label: 'Downloads', path: () => [...homePath(), 'Downloads'] },
    { label: 'About Me', path: () => [...homePath(), 'About Me'] },
];

const iconFor = (node: VNode): React.FC<IconProps> => {
    if (node.folder) return FolderIcon;
    if (node.action?.kind === 'app') return getApp(node.action.app).Icon;
    if (node.action?.kind === 'image') return WallpaperIcon;
    return DocumentIcon;
};

const key = (node: VNode) => pathString(pathOf(node));

const sortNodes = (nodes: VNode[]) =>
    nodes
        .slice()
        .sort((a, b) =>
            a.folder === b.folder ? a.name.localeCompare(b.name) : a.folder ? -1 : 1
        );

const ExplorerApp: React.FC = () => {
    const { openApp, compact } = useContext(DesktopContext);
    const rootRef = useRef<HTMLDivElement>(null);
    const [history, setHistory] = useState<{ stack: Path[]; index: number }>(() => ({
        stack: [takePendingExplorerPath() || [...homePath(), 'Desktop']],
        index: 0,
    }));
    const [view, setView] = useState<View>('icons');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<string | null>(null);
    const [menu, setMenu] = useState<Menu | null>(null);
    const [properties, setProperties] = useState<VNode | null>(null);
    const [narrow, setNarrow] = useState(false);

    const location = history.stack[history.index];
    const node = nodeAt(location);

    const navigate = useCallback((path: Path) => {
        setQuery('');
        setSelected(null);
        setMenu(null);
        setHistory((h) => {
            const current = h.stack[h.index];
            if (current.join('\\') === path.join('\\')) return h;
            const stack = [...h.stack.slice(0, h.index + 1), path];
            return { stack, index: stack.length - 1 };
        });
    }, []);

    // Terminal `open` asks Explorer to show a path
    useEffect(
        () =>
            onExplorerRequest((path) => {
                takePendingExplorerPath();
                navigate(path);
            }),
        [navigate]
    );

    useEffect(() => {
        const el = rootRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) =>
            setNarrow(entry.contentRect.width < 600)
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const canBack = history.index > 0;
    const canForward = history.index < history.stack.length - 1;
    const canUp = location.length > 1;
    const back = () => canBack && setHistory((h) => ({ ...h, index: h.index - 1 }));
    const forward = () => canForward && setHistory((h) => ({ ...h, index: h.index + 1 }));
    const up = () => {
        if (!canUp) return;
        navigate(location.slice(0, -1));
    };

    // Viewing a file shows its folder's items behind the viewer; folder is the parent
    const folderNode = node && node.folder ? node : nodeAt(location.slice(0, -1));
    const searching = query.trim().length > 0;
    const items = useMemo(() => {
        if (!folderNode) return [];
        return searching ? searchTree(folderNode, query) : sortNodes(folderNode.children || []);
    }, [folderNode, query, searching]);

    const open = (target: VNode) => {
        setMenu(null);
        if (target.folder) return navigate(pathOf(target));
        if (target.action?.kind === 'app') return openApp(target.action.app);
        navigate(pathOf(target));
    };

    const copyPath = (target: VNode) => {
        try {
            const result = navigator.clipboard && navigator.clipboard.writeText(pathString(pathOf(target)));
            if (result) result.catch(() => undefined);
        } catch {
            /* clipboard unavailable */
        }
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        if ((event.target as HTMLElement).tagName === 'INPUT') return;
        if (event.key === 'Escape') {
            setMenu(null);
            setProperties(null);
        } else if (event.key === 'Backspace' || (event.altKey && event.key === 'ArrowUp')) {
            event.preventDefault();
            up();
        } else if (event.altKey && event.key === 'ArrowLeft') {
            back();
        } else if (event.altKey && event.key === 'ArrowRight') {
            forward();
        } else if (event.key === 'Enter' && selected) {
            const target = items.find((n) => key(n) === selected);
            if (target) open(target);
        } else if (event.key === 'F5') {
            event.preventDefault();
        }
    };

    const showMenu = (event: React.MouseEvent, target: VNode | null) => {
        event.preventDefault();
        event.stopPropagation();
        const box = rootRef.current?.getBoundingClientRect();
        if (!box) return;
        if (target) setSelected(key(target));
        setMenu({ x: event.clientX - box.left, y: event.clientY - box.top, node: target });
    };

    const viewing = node && !node.folder ? node : null;
    const effectiveView: View = compact ? 'icons' : view;

    const renderViewer = (file: VNode) => {
        const action = file.action;
        if (!action) return null;
        if (action.kind === 'project') {
            return (
                <div className="fx-viewer">
                    <ProjectDetail project={action.project} />
                </div>
            );
        }
        if (action.kind === 'image') {
            return (
                <div className="fx-viewer is-image">
                    <img src={action.src} alt={action.alt} />
                </div>
            );
        }
        if (action.kind === 'text') {
            return (
                <div className="fx-viewer">
                    <pre className="fx-text">{action.text}</pre>
                </div>
            );
        }
        return null;
    };

    return (
        <div
            className={`fx${narrow ? ' is-narrow' : ''}`}
            ref={rootRef}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            onMouseDown={() => setMenu(null)}
        >
            <div className="fx-bar">
                <button className="fx-nav" onClick={back} disabled={!canBack} aria-label="Back" title="Back">
                    <ArrowLeftIcon size={16} />
                </button>
                <button className="fx-nav" onClick={forward} disabled={!canForward} aria-label="Forward" title="Forward">
                    <ArrowRightIcon size={16} />
                </button>
                <button className="fx-nav fx-up" onClick={up} disabled={!canUp} aria-label="Up one level" title="Up one level">
                    ↑
                </button>
                <nav className="fx-address" aria-label="Address">
                    <FolderIcon size={16} />
                    <ol>
                        <li>
                            <button onClick={() => navigate(['C:'])} title="Computer">Computer</button>
                        </li>
                        {location.map((segment, i) => (
                            <li key={i}>
                                <b aria-hidden="true">›</b>
                                <button onClick={() => navigate(location.slice(0, i + 1))}>
                                    {crumbLabel(segment)}
                                </button>
                            </li>
                        ))}
                    </ol>
                </nav>
                <input
                    className="fx-search"
                    type="search"
                    placeholder={`Search ${folderNode ? crumbLabel(folderNode.name) : ''}`}
                    aria-label="Search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>

            <div className="fx-tools">
                <span className="fx-tools-title">
                    {searching ? `Search results (${items.length})` : crumbLabel(location[location.length - 1])}
                </span>
                {!compact && (
                    <span className="fx-views" role="group" aria-label="View">
                        <button
                            className={view === 'icons' ? 'is-on' : ''}
                            aria-pressed={view === 'icons'}
                            onClick={() => setView('icons')}
                        >
                            Icons
                        </button>
                        <button
                            className={view === 'list' ? 'is-on' : ''}
                            aria-pressed={view === 'list'}
                            onClick={() => setView('list')}
                        >
                            List
                        </button>
                    </span>
                )}
            </div>

            <div className="fx-main">
                {!compact && !narrow && (
                    <aside className="fx-side" aria-label="Favorites">
                        <h4>Favorites</h4>
                        {FAVORITES.map((fav) => {
                            const path = fav.path();
                            const active = location.join('\\') === path.join('\\');
                            return (
                                <button
                                    key={fav.label}
                                    className={active ? 'is-active' : ''}
                                    onClick={() => navigate(path)}
                                >
                                    <FolderIcon size={18} />
                                    {fav.label}
                                </button>
                            );
                        })}
                    </aside>
                )}

                <div
                    className="fx-content"
                    onMouseDown={() => setSelected(null)}
                    onContextMenu={(event) => !viewing && showMenu(event, null)}
                >
                    {!node ? (
                        <p className="dsk-hint">Windows can't find that location.</p>
                    ) : viewing ? (
                        renderViewer(viewing)
                    ) : items.length === 0 ? (
                        <p className="fx-empty">
                            {searching ? 'No items match your search.' : 'This folder is empty.'}
                        </p>
                    ) : effectiveView === 'icons' ? (
                        <ul className="fx-icons" role="listbox" aria-label="Items">
                            {items.map((item) => {
                                const Icon = iconFor(item);
                                const k = key(item);
                                return (
                                    <li key={k} role="option" aria-selected={selected === k}>
                                        <button
                                            className={selected === k ? 'is-selected' : ''}
                                            title={item.info ? `${item.name}\n${item.info}` : item.name}
                                            onMouseDown={(event) => {
                                                event.stopPropagation();
                                                setSelected(k);
                                                setMenu(null);
                                            }}
                                            onClick={() => compact && open(item)}
                                            onDoubleClick={() => open(item)}
                                            onContextMenu={(event) => showMenu(event, item)}
                                        >
                                            <Icon size={44} />
                                            <span>{item.name}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <table className="fx-list">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>{searching ? 'Location' : 'Description'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => {
                                    const Icon = iconFor(item);
                                    const k = key(item);
                                    return (
                                        <tr
                                            key={k}
                                            className={selected === k ? 'is-selected' : ''}
                                            onMouseDown={(event) => {
                                                event.stopPropagation();
                                                setSelected(k);
                                                setMenu(null);
                                            }}
                                            onDoubleClick={() => open(item)}
                                            onContextMenu={(event) => showMenu(event, item)}
                                        >
                                            <td>
                                                <Icon size={18} />
                                                {item.name}
                                            </td>
                                            <td>{item.type}</td>
                                            <td>
                                                {searching
                                                    ? pathString(pathOf(item).slice(0, -1))
                                                    : item.info || ''}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <footer className="fx-status">
                {viewing
                    ? `${viewing.name} · ${viewing.type}`
                    : selected
                    ? (() => {
                          const s = items.find((n) => key(n) === selected);
                          return s ? `${s.name} · ${s.type}` : '';
                      })()
                    : `${items.length} item${items.length === 1 ? '' : 's'}`}
            </footer>

            {menu && (
                <ul
                    className="fx-menu"
                    role="menu"
                    style={{ left: menu.x, top: menu.y }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    {menu.node ? (
                        <>
                            <li role="none">
                                <button role="menuitem" onClick={() => menu.node && open(menu.node)}>
                                    <strong>Open</strong>
                                </button>
                            </li>
                            <li role="none">
                                <button
                                    role="menuitem"
                                    onClick={() => {
                                        if (menu.node) copyPath(menu.node);
                                        setMenu(null);
                                    }}
                                >
                                    Copy path
                                </button>
                            </li>
                            <li role="none">
                                <button
                                    role="menuitem"
                                    onClick={() => {
                                        setProperties(menu.node);
                                        setMenu(null);
                                    }}
                                >
                                    Properties
                                </button>
                            </li>
                        </>
                    ) : (
                        <>
                            <li role="none">
                                <button role="menuitem" onClick={() => { setView('icons'); setMenu(null); }}>
                                    View: Icons
                                </button>
                            </li>
                            <li role="none">
                                <button role="menuitem" onClick={() => { setView('list'); setMenu(null); }}>
                                    View: List
                                </button>
                            </li>
                            {canUp && (
                                <li role="none">
                                    <button role="menuitem" onClick={() => { up(); }}>
                                        Up one level
                                    </button>
                                </li>
                            )}
                        </>
                    )}
                </ul>
            )}

            {properties && (
                <div className="fx-dialog-wrap" onMouseDown={() => setProperties(null)}>
                    <div
                        className="fx-dialog"
                        role="dialog"
                        aria-label={`${properties.name} properties`}
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <h3>{properties.name}</h3>
                        <dl>
                            <dt>Type</dt>
                            <dd>{properties.type}</dd>
                            <dt>Location</dt>
                            <dd>{pathString(pathOf(properties).slice(0, -1))}</dd>
                            {properties.info && (
                                <>
                                    <dt>Details</dt>
                                    <dd>{properties.info}</dd>
                                </>
                            )}
                        </dl>
                        <button className="dsk-button is-primary" onClick={() => setProperties(null)}>
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExplorerApp;
