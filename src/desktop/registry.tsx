import React from 'react';
import {
    BriefcaseIcon,
    BrowserIcon,
    DocumentIcon,
    EnvelopeIcon,
    FolderIcon,
    IconProps,
    InfoIcon,
    MusicIcon,
    ExplorerIcon,
    TerminalIcon,
    WallpaperIcon,
} from './icons';
const ProjectsApp = React.lazy(() => import(/* webpackChunkName: "app-projects" */ './apps/ProjectsApp'));
const ExperienceApp = React.lazy(() => import(/* webpackChunkName: "app-experience" */ './apps/ExperienceApp'));
const BrowserApp = React.lazy(() => import(/* webpackChunkName: "app-browser" */ './apps/BrowserApp'));
const ResumeApp = React.lazy(() => import(/* webpackChunkName: "app-resume" */ './apps/ResumeApp'));
const ContactApp = React.lazy(() => import(/* webpackChunkName: "app-contact" */ './apps/ContactApp'));
const CreditsApp = React.lazy(() => import(/* webpackChunkName: "app-credits" */ './apps/CreditsApp'));
const MusicApp = React.lazy(() => import(/* webpackChunkName: "app-music" */ './apps/MusicApp'));
const WallpaperStudioApp = React.lazy(() => import(/* webpackChunkName: "app-wallpaperstudio" */ './apps/WallpaperStudioApp'));
const ExplorerApp = React.lazy(() => import(/* webpackChunkName: "app-explorer" */ './apps/ExplorerApp'));
const TerminalApp = React.lazy(() => import(/* webpackChunkName: "app-terminal" */ './apps/TerminalApp'));

export type AppId =
    | 'explorer'
    | 'terminal'
    | 'projects'
    | 'experience'
    | 'about'
    | 'resume'
    | 'contact'
    | 'music'
    | 'wallpapers'
    | 'credits';

export type AppDef = {
    id: AppId;
    title: string;
    Icon: React.FC<IconProps>;
    /** Preferred window size in CSS px; clamped to the screen. */
    size: { w: number; h: number };
    Component: React.ComponentType;
    /** Shown as a desktop icon (all apps are listed in the start menu). */
    onDesktop: boolean;
    /**
     * Show the Explorer-style location bar under the title bar. Apps with
     * their own toolbar (browser, player, viewer) turn it off.
     */
    locationBar?: boolean;
    /**
     * Kept in the code but not offered anywhere (desktop, Start menu,
     * Explorer, Command Prompt). Remove the flag to bring the app back.
     */
    hidden?: boolean;
};

const ALL_APPS: AppDef[] = [
    {
        id: 'explorer',
        title: 'File Explorer',
        Icon: ExplorerIcon,
        size: { w: 860, h: 560 },
        Component: ExplorerApp,
        onDesktop: true,
        locationBar: false,
    },
    {
        id: 'terminal',
        title: 'Command Prompt',
        Icon: TerminalIcon,
        size: { w: 760, h: 480 },
        Component: TerminalApp,
        onDesktop: true,
        locationBar: false,
    },
    {
        id: 'projects',
        title: 'Projects',
        Icon: FolderIcon,
        size: { w: 820, h: 600 },
        Component: ProjectsApp,
        onDesktop: true,
    },
    {
        id: 'experience',
        title: 'Experience',
        Icon: BriefcaseIcon,
        size: { w: 640, h: 560 },
        Component: ExperienceApp,
        onDesktop: true,
    },
    {
        id: 'about',
        title: 'Who Am I?',
        Icon: BrowserIcon,
        size: { w: 980, h: 680 },
        Component: BrowserApp,
        onDesktop: true,
        locationBar: false,
    },
    {
        id: 'resume',
        title: 'Resume',
        Icon: DocumentIcon,
        size: { w: 760, h: 720 },
        Component: ResumeApp,
        onDesktop: true,
        locationBar: false,
    },
    {
        id: 'contact',
        title: 'Contact',
        Icon: EnvelopeIcon,
        size: { w: 480, h: 360 },
        Component: ContactApp,
        onDesktop: true,
    },
    {
        id: 'music',
        title: 'Music',
        Icon: MusicIcon,
        size: { w: 900, h: 600 },
        Component: MusicApp,
        onDesktop: true,
        locationBar: false,
        // Hidden for now; delete this line to bring Music back.
        hidden: true,
    },
    {
        id: 'wallpapers',
        title: 'Wallpaper Studio',
        Icon: WallpaperIcon,
        size: { w: 940, h: 600 },
        Component: WallpaperStudioApp,
        onDesktop: true,
        locationBar: false,
    },
    {
        id: 'credits',
        title: 'Credits',
        Icon: InfoIcon,
        size: { w: 680, h: 580 },
        Component: CreditsApp,
        onDesktop: true,
    },
];

/** Apps visitors can see and open. */
export const APPS: AppDef[] = ALL_APPS.filter((app) => !app.hidden);

export const getApp = (id: AppId) =>
    ALL_APPS.find((app) => app.id === id) as AppDef;
