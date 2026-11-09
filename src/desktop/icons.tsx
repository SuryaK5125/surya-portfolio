import React from 'react';

/**
 * Hand-authored line icons on a 24×24 grid (original work, no external
 * icon sets). Stroke colour comes from CSS `currentColor`.
 */

export type IconProps = { size?: number };

const icon = (paths: React.ReactNode): React.FC<IconProps> => {
    const Icon: React.FC<IconProps> = ({ size = 24 }) => (
        <svg
            className="dsk-svg"
            viewBox="0 0 24 24"
            width={size}
            height={size}
            aria-hidden="true"
            focusable="false"
        >
            {paths}
        </svg>
    );
    return Icon;
};

let instance = 0;

const objectIcon = (drawing: (id: string) => React.ReactNode): React.FC<IconProps> => {
    const Icon: React.FC<IconProps> = ({ size = 24 }) => {
        const [id] = React.useState(() => `desktop-object-${++instance}`);
        return (
            <svg className="dsk-svg dsk-app-icon" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
                <defs>
                    <linearGradient id={`${id}-gold`} x2="0.25" y2="1">
                        <stop stopColor="#fff2a9" /><stop offset=".45" stopColor="#f9cb53" /><stop offset="1" stopColor="#cf8d20" />
                    </linearGradient>
                    <linearGradient id={`${id}-blue`} x2=".2" y2="1">
                        <stop stopColor="#bceeff" /><stop offset=".45" stopColor="#5bade0" /><stop offset="1" stopColor="#25629d" />
                    </linearGradient>
                    <linearGradient id={`${id}-paper`} x2=".4" y2="1">
                        <stop stopColor="#fff" /><stop offset=".6" stopColor="#f4f8fc" /><stop offset="1" stopColor="#b5cbdc" />
                    </linearGradient>
                    <linearGradient id={`${id}-green`} x2=".3" y2="1">
                        <stop stopColor="#d5f3a6" /><stop offset=".5" stopColor="#83bc61" /><stop offset="1" stopColor="#397d59" />
                    </linearGradient>
                </defs>
                {drawing(id)}
            </svg>
        );
    };
    return Icon;
};

export const FolderIcon = objectIcon((id) => <>
    <path fill={`url(#${id}-gold)`} stroke="#a87322" d="M5 11q0-3 3-3h12l4 5h17v27H5z" />
    <path fill={`url(#${id}-paper)`} stroke="#8ca5b5" d="M12 11l23-2 2 25-23 2z" />
    <path stroke="#c0cbd2" d="M17 17l14-1M17 21l14-1" />
    <path fill={`url(#${id}-gold)`} stroke="#b2812c" d="M4 20q0-2 3-2h34q3 0 2 3l-3 17q0 2-3 2H8q-3 0-3-3z" />
    <path stroke="#fff3b3" d="M7 21h32M8 37h28" />
</>);

export const BriefcaseIcon = objectIcon((id) => <>
    <path fill="#b9d7e7" stroke="#527589" strokeWidth="2" d="M17 15V9q0-3 3-3h9q3 0 3 3v6h-4V10h-7v5z" />
    <rect x="5" y="13" width="38" height="28" rx="3" fill={`url(#${id}-blue)`} stroke="#315a7f" />
    <path fill="#3b7caa" stroke="#a9dcf1" d="M6 15h36v11q-17 7-36 0z" />
    <path stroke="#d8f1ff" d="M9 16h29M9 37h29" />
    <rect x="21" y="25" width="7" height="7" rx="1" fill={`url(#${id}-paper)`} stroke="#456b83" />
</>);

export const PersonIcon = objectIcon((id) => <>
    <path fill={`url(#${id}-paper)`} stroke="#6b8c9f" d="M9 5l30 3-2 36-30-3z" />
    <path fill={`url(#${id}-green)`} stroke="#558b5f" d="M13 10l22 2-2 25-22-2z" />
    <circle cx="24" cy="20" r="6" fill="#f7f9ea" stroke="#47795d" />
    <path fill="#eff4de" stroke="#47795d" d="M14 34q1-10 10-10t9 12z" />
    <path stroke="#fff9" d="M15 12l18 2" />
</>);

export const DocumentIcon = objectIcon((id) => <>
    <path fill={`url(#${id}-paper)`} stroke="#7e9aaf" d="M10 4h21l9 9v31H10z" />
    <path fill="#c3dbe9" stroke="#7e9aaf" d="M31 4v10h9" />
    <rect x="15" y="18" width="19" height="5" fill={`url(#${id}-blue)`} stroke="#729cb4" />
    <path stroke="#829dae" strokeWidth="1.5" d="M15 28h19M15 32h19M15 36h14" />
    <path stroke="#fff" d="M12 7v34" />
</>);

export const EnvelopeIcon = objectIcon((id) => <>
    <path fill={`url(#${id}-blue)`} stroke="#32638b" d="M11 5h28v28H11z" />
    <path stroke="#d8f5ff" d="M16 11h17M16 15h13" />
    <path fill={`url(#${id}-paper)`} stroke="#6e8fa3" d="M3 17h39v26H3z" />
    <path fill="#d3e2e9" stroke="#90a9b8" d="M3 43l19-16 20 16z" />
    <path fill={`url(#${id}-paper)`} stroke="#90a9b8" d="M3 17l19 17 20-17z" />
    <path stroke="#fff" d="M5 19l17 15 18-15" />
</>);

/** Vinyl record in a sleeve with a note: Music. */
export const MusicIcon = objectIcon((id) => <>
    <rect x="4" y="8" width="30" height="32" rx="2" fill={`url(#${id}-blue)`} stroke="#2d5f86" />
    <path stroke="#d6f2ff" d="M7 11h24" />
    <circle cx="30" cy="25" r="14" fill="#1b2430" stroke="#0b1118" />
    <circle cx="30" cy="25" r="10.5" fill="none" stroke="#3b4a5a" />
    <circle cx="30" cy="25" r="7" fill="none" stroke="#2c3946" />
    <circle cx="30" cy="25" r="4" fill={`url(#${id}-gold)`} stroke="#9a6a1e" />
    <circle cx="30" cy="25" r="1" fill="#1b2430" />
    <path fill="#fff" stroke="#24506f" d="M12 33V18l9-2v13" />
    <ellipse cx="10" cy="33.5" rx="3.2" ry="2.4" fill="#fff" stroke="#24506f" />
    <ellipse cx="19" cy="29.5" rx="3.2" ry="2.4" fill="#fff" stroke="#24506f" />
</>);

/** Framed landscape picture: Wallpaper Studio. */
export const WallpaperIcon = objectIcon((id) => <>
    <rect x="4" y="9" width="40" height="30" rx="2" fill={`url(#${id}-paper)`} stroke="#6f8ea4" />
    <rect x="8" y="13" width="32" height="22" fill={`url(#${id}-blue)`} stroke="#2f668f" />
    <circle cx="32" cy="19" r="3" fill="#fff6c7" stroke="#d9a63c" />
    <path fill={`url(#${id}-green)`} stroke="#3f7a52" d="M8 35l9-11 6 6 5-4 12 9z" />
    <path stroke="#fff" d="M6 11h36" />
</>);

/** Globe with a browser frame: About Me browser. */
export const BrowserIcon = objectIcon((id) => <>
    <rect x="4" y="8" width="40" height="32" rx="3" fill={`url(#${id}-paper)`} stroke="#6f8ea4" />
    <path fill="#d7e6f0" stroke="#6f8ea4" d="M4 11q0-3 3-3h34q3 0 3 3v4H4z" />
    <circle cx="9" cy="11.5" r="1.4" fill="#e0715b" />
    <circle cx="13.5" cy="11.5" r="1.4" fill="#e9b949" />
    <circle cx="18" cy="11.5" r="1.4" fill="#6fb35b" />
    <circle cx="24" cy="27.5" r="9.5" fill={`url(#${id}-blue)`} stroke="#2a5f88" />
    <path fill="none" stroke="#e9f8ff" d="M14.5 27.5h19M24 18q-6 9.5 0 19M24 18q6 9.5 0 19M16.5 22h15M16.5 33h15" />
</>);

export const ExplorerIcon = objectIcon((id) => <>
    <path fill={`url(#${id}-blue)`} stroke="#25629d" d="M4 12q0-3 3-3h11l3 4h20q3 0 3 3v19q0 3-3 3H7q-3 0-3-3z" />
    <path fill={`url(#${id}-paper)`} stroke="#8ca5b5" d="M9 16h30v18H9z" />
    <path fill={`url(#${id}-gold)`} stroke="#b2812c" d="M4 22q0-2 3-2h34q3 0 2 3l-3 16q0 2-3 2H8q-3 0-3-3z" />
    <path stroke="#fff3b3" d="M8 23h32" />
</>);

export const TerminalIcon = objectIcon((id) => <>
    <rect x="4" y="7" width="40" height="34" rx="4" fill={`url(#${id}-blue)`} stroke="#25629d" />
    <rect x="7" y="14" width="34" height="24" rx="2" fill="#0d1620" stroke="#06101a" />
    <path fill="none" stroke="#e8f3fa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M13 20l7 5-7 5" />
    <path stroke="#8fd0f2" strokeWidth="2.4" strokeLinecap="round" d="M24 31h10" />
    <circle cx="10" cy="10.5" r="1.4" fill="#fff" /><circle cx="15" cy="10.5" r="1.4" fill="#fff" />
</>);

export const InfoIcon = icon(
    <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 11v6M12 7v1" />
    </>
);

export const LinkIcon = icon(
    <>
        <path d="M14 4h6v6M20 4l-9 9" />
        <path d="M18 14v6H4V6h6" />
    </>
);

// Media and browser controls (line icons)
export const PlayIcon = icon(<path fill="currentColor" stroke="none" d="M8 5.5v13l11-6.5z" />);

export const PauseIcon = icon(
    <path fill="currentColor" stroke="none" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
);

export const PrevIcon = icon(
    <path fill="currentColor" stroke="none" d="M6 5h2v14H6zM19 5.5v13L9 12z" />
);

export const NextIcon = icon(
    <path fill="currentColor" stroke="none" d="M16 5h2v14h-2zM5 5.5v13L15 12z" />
);

export const VolumeIcon = icon(
    <>
        <path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z" />
        <path d="M16 8.5q2 3.5 0 7M18.5 6q4 6 0 12" />
    </>
);

export const ArrowLeftIcon = icon(<path d="M19 12H5M11 6l-6 6 6 6" />);

export const ArrowRightIcon = icon(<path d="M5 12h14M13 6l6 6-6 6" />);

export const ReloadIcon = icon(
    <>
        <path d="M19 12a7 7 0 1 1-2.1-5" />
        <path d="M17.5 3.5V7.5H13.5" />
    </>
);

export const LockIcon = icon(
    <>
        <rect x="6" y="11" width="12" height="9" rx="1.5" />
        <path d="M9 11V8a3 3 0 0 1 6 0v3" />
    </>
);

export const DownloadIcon = icon(
    <>
        <path d="M12 3v12M7 10l5 5 5-5" />
        <path d="M4 17v4h16v-4" />
    </>
);
