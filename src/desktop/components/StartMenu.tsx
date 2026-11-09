import React, { useState } from 'react';
import { APPS } from '../registry';
import type { AppId } from '../registry';
import { PersonIcon } from '../icons';

type StartMenuProps = {
    owner: string;
    onOpen: (id: AppId) => void;
};

const descriptions: Record<AppId, string> = {
    explorer: 'Browse files and folders',
    terminal: 'Command-line tour of my work',
    projects: 'Explore selected work',
    experience: 'Roles, teams & milestones',
    about: 'A little about me, in the browser',
    resume: 'View or download my resume',
    contact: 'Get in touch',
    music: 'My favourite albums',
    wallpapers: 'Change the desktop background',
    credits: 'What I made, and who I borrowed from',
};

const StartMenu: React.FC<StartMenuProps> = ({ owner, onOpen }) => {
    const [query, setQuery] = useState('');
    const apps = APPS.filter((app) =>
        `${app.title} ${descriptions[app.id]}`.toLowerCase().includes(query.trim().toLowerCase())
    );

    return (
        <div className="dsk-menu" aria-label="Start menu">
            <div className="dsk-menu-main">
                <div className="dsk-menu-apps" role="menu" aria-label="Programs">
                    {apps.map((app) => (
                        <button key={app.id} role="menuitem" className="dsk-menu-item" onClick={() => onOpen(app.id)}>
                            <app.Icon size={36} />
                            <span><strong>{app.title}</strong><small>{descriptions[app.id]}</small></span>
                        </button>
                    ))}
                    {!apps.length && <p className="dsk-menu-empty" role="status">No matching programs</p>}
                </div>
                <form className="dsk-menu-search" onSubmit={(event) => {
                    event.preventDefault();
                    if (apps.length) onOpen(apps[0].id);
                }}>
                    <input aria-label="Search programs" placeholder="Search programs" value={query} onChange={(event) => setQuery(event.target.value)} />
                    <span aria-hidden="true">⌕</span>
                </form>
            </div>
            <aside className="dsk-menu-side">
                <span className="dsk-avatar" aria-hidden="true"><PersonIcon size={42} /></span>
                <strong className="dsk-menu-owner">{owner}</strong>
                <span className="dsk-menu-caption">Personal folder</span>
                <div className="dsk-menu-links">
                    <button onClick={() => onOpen('explorer')}>File Explorer</button>
                    <button onClick={() => onOpen('terminal')}>Command Prompt</button>
                    <hr />
                    <button onClick={() => onOpen('projects')}>Projects</button>
                    <button onClick={() => onOpen('experience')}>Experience</button>
                    <button onClick={() => onOpen('resume')}>Resume</button>
                    {/* Music is hidden for now (see registry.tsx):
                    <button onClick={() => onOpen('music')}>Music</button> */}
                    <hr />
                    <button onClick={() => onOpen('wallpapers')}>Wallpapers</button>
                    <button onClick={() => onOpen('contact')}>Contact</button>
                    <button onClick={() => onOpen('credits')}>Credits</button>
                </div>

            </aside>
        </div>
    );
};

export default StartMenu;
