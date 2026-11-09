import React, { useEffect, useState } from 'react';
import { getApp } from '../registry';
import type { AppId } from '../registry';
import { WindowState } from './Window';

const formatTime = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Clock: React.FC = () => {
    const [time, setTime] = useState(formatTime());
    useEffect(() => {
        const interval = setInterval(() => setTime(formatTime()), 10000);
        return () => clearInterval(interval);
    }, []);
    return (
        <time className="dsk-clock" dateTime={new Date().toISOString()}>
            <span>{time}</span>
            <small>
                {new Date().toLocaleDateString([], {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                })}
            </small>
        </time>
    );
};

type TaskbarProps = {
    owner: string;
    windows: WindowState[];
    activeId: AppId | null;
    menuOpen: boolean;
    onToggleMenu: () => void;
    onTaskClick: (id: AppId) => void;
    onOpenApp: (id: AppId) => void;
    onShowDesktop: () => void;
};

const Taskbar: React.FC<TaskbarProps> = ({
    owner,
    windows,
    activeId,
    menuOpen,
    onToggleMenu,
    onTaskClick,
    onOpenApp,
    onShowDesktop,
}) => {
    const pinned: AppId[] = ['projects', 'resume', 'contact'];
    const tasks = [...pinned, ...windows.map((w) => w.id).filter((id) => !pinned.includes(id))];
    return (
        <footer className="dsk-taskbar">
            <button
                className={`dsk-start${menuOpen ? ' is-open' : ''}`}
                aria-label={`Open ${owner}'s Start menu`}
                title="Start"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={onToggleMenu}
            >
                <span className="dsk-start-mark" aria-hidden="true">
                    S
                </span>
            </button>
            <div className="dsk-tasks">
                {tasks.map((id) => {
                    const app = getApp(id);
                    const w = windows.find((window) => window.id === id);
                    return (
                        <button
                            key={id}
                            className={[
                                'dsk-task',
                                w && 'is-running',
                                id === activeId && 'is-active',
                                w?.minimized && 'is-minimized',
                            ].filter(Boolean).join(' ')}
                            title={app.title}
                            aria-label={app.title}
                            aria-pressed={id === activeId}
                            onClick={() => w ? onTaskClick(id) : onOpenApp(id)}
                        >
                            <app.Icon size={32} />
                        </button>
                    );
            })}
        </div>
        <Clock />
        <button className="dsk-show-desktop" aria-label="Show desktop" title="Show desktop" onClick={onShowDesktop} />
    </footer>
    );
};

export default Taskbar;
