/**
 * Virtual filesystem shared by File Explorer and the Terminal.
 *
 * Nothing here touches the visitor's computer: the tree is generated from the
 * portfolio content files and the app registry. It is built lazily because
 * the registry imports the apps that import this module.
 */
import { APPS, AppId } from './registry';
import { profile } from './content/profile';
import { projects } from './content/projects';
import { experience } from './content/experience';
import { resume } from './content/resume';
import { Project } from './content/types';

export type NodeAction =
    | { kind: 'app'; app: AppId }
    | { kind: 'text'; text: string }
    | { kind: 'project'; project: Project }
    | { kind: 'image'; src: string; alt: string };

export type VNode = {
    name: string;
    folder: boolean;
    /** Explorer "Type" column. */
    type: string;
    /** One-line description for the Explorer details view. */
    info?: string;
    children?: VNode[];
    action?: NodeAction;
    /** Set while building: names of ancestors, root first. */
    parent?: VNode;
};

/** A location is the list of node names from the root. */
export type Path = string[];

const folder = (name: string, children: VNode[], info?: string): VNode => ({
    name,
    folder: true,
    type: 'File folder',
    info,
    children,
});

const text = (name: string, body: string, info?: string): VNode => ({
    name,
    folder: false,
    type: 'Text Document',
    info,
    action: { kind: 'text', text: body },
});

const shortcut = (name: string, app: AppId, info?: string): VNode => ({
    name,
    folder: false,
    type: 'Shortcut',
    info,
    action: { kind: 'app', app },
});

const slug = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const homeName = () => profile.name.split(/\s+/)[0] || 'Guest';

const list = (items: string[]) => items.map((item) => `  - ${item}`).join('\r\n');

export const projectText = (p: Project) =>
    [
        p.name,
        [p.role, p.period].filter(Boolean).join(' | '),
        '',
        p.summary,
        '',
        ...(p.architecture.length ? ['Architecture', ...p.architecture, ''] : []),
        ...(p.technologies.length ? ['Technologies', p.technologies.join(', '), ''] : []),
        ...(p.results.length ? ['Results', list(p.results), ''] : []),
        ...(p.links.github ? [`GitHub: ${p.links.github}`] : []),
        ...(p.links.demo ? [`Demo: ${p.links.demo}`] : []),
    ]
        .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
        .join('\r\n')
        .trim();

export const experienceText = (e: (typeof experience)[number]) =>
    [
        `${e.role} - ${e.organization}`,
        e.period,
        '',
        ...(e.summary ? [e.summary, ''] : []),
        ...(e.responsibilities.length ? ['Responsibilities', list(e.responsibilities), ''] : []),
        ...(e.technologies && e.technologies.length
            ? ['Technologies', e.technologies.join(', ')]
            : []),
    ]
        .join('\r\n')
        .trim();

export const skillsText = () =>
    resume.skills.length
        ? resume.skills.join('\r\n')
        : 'No skills listed yet.';

export const aboutText = () =>
    [
        profile.name,
        profile.headline,
        '',
        ...profile.intro.flatMap((paragraph) => [paragraph, '']),
        ...(profile.interests.length ? ['Interests', profile.interests.join(', ')] : []),
    ]
        .join('\r\n')
        .trim() || profile.name;

/** Project file names: the project's slug, or its id when slugs collide or are empty. */
export function projectFileName(project: Project): string {
    const s = slug(project.name);
    const clash = projects.filter((p) => slug(p.name) === s).length > 1;
    return `${s && !clash ? s : project.id}.project`;
}

let cached: VNode | null = null;

function link(node: VNode, parent?: VNode) {
    node.parent = parent;
    (node.children || []).forEach((child) => link(child, node));
}

function build(): VNode {
    const desktop = APPS.filter((app) => app.onDesktop).map((app) =>
        shortcut(`${app.title}.lnk`, app.id)
    );

    const projectFiles = projects.map(
        (project): VNode => ({
            name: projectFileName(project),
            folder: false,
            type: 'Project',
            info: project.summary,
            action: { kind: 'project', project },
        })
    );

    const experienceFiles = experience.map((e) =>
        text(`${slug(e.organization) || e.id}-${slug(e.role) || 'role'}.txt`, experienceText(e), e.period)
    );

    const aboutFiles: VNode[] = [
        text('about.txt', aboutText(), profile.headline || 'About me'),
        shortcut('Who Am I.lnk', 'about', 'Opens the browser page about me'),
        shortcut('Contact.lnk', 'contact', 'Get in touch'),
    ];
    if (profile.photo) {
        aboutFiles.push({
            name: 'photo.jpg',
            folder: false,
            type: 'JPEG Image',
            action: { kind: 'image', src: profile.photo.src, alt: profile.photo.alt },
        });
    }

    const resumeFile = (): VNode => ({
        name: 'resume.pdf',
        folder: false,
        type: 'PDF Document',
        info: resume.updated ? `Updated ${resume.updated}` : 'Resume',
        action: { kind: 'app', app: 'resume' },
    });

    const home = folder(homeName(), [
        folder('Desktop', desktop, 'Shortcuts to everything on the desktop'),
        folder('Projects', projectFiles, 'Selected engineering work'),
        folder('Documents', [
            resumeFile(),
            text('skills.txt', skillsText(), 'Key skills'),
            folder('Experience', experienceFiles, 'Roles and responsibilities'),
        ]),
        folder('Downloads', [resumeFile()]),
        folder('About Me', aboutFiles),
    ]);

    const root = folder('C:', [folder('Users', [home])]);
    link(root);
    return root;
}

export const getRoot = (): VNode => cached || (cached = build());

export const homePath = (): Path => ['C:', 'Users', homeName()];

/** Display name for a drive-root segment, used in Explorer breadcrumbs. */
export const crumbLabel = (name: string) => (name === 'C:' ? 'Local Disk (C:)' : name);

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function nodeAt(path: Path): VNode | null {
    let node: VNode = getRoot();
    if (!path.length || !same(path[0], node.name)) return null;
    for (const segment of path.slice(1)) {
        const next = (node.children || []).find((c) => same(c.name, segment));
        if (!next) return null;
        node = next;
    }
    return node;
}

export function pathOf(node: VNode): Path {
    const path: Path = [];
    for (let n: VNode | undefined = node; n; n = n.parent) path.unshift(n.name);
    return path;
}

export const pathString = (path: Path) => path.join('\\') + (path.length === 1 ? '\\' : '');

/**
 * Resolves a CMD-style path (absolute `C:\Users\…`, relative, `..`, `.`, `\`,
 * `~`) against `cwd`. Returns null when it points outside the tree.
 */
export function resolvePath(input: string, cwd: Path): Path | null {
    let raw = input.trim().replace(/\//g, '\\');
    let path: Path;
    if (/^c:/i.test(raw)) {
        path = ['C:'];
        raw = raw.slice(2);
    } else if (raw.startsWith('\\')) {
        path = ['C:'];
    } else if (raw === '~' || raw.startsWith('~\\')) {
        path = homePath();
        raw = raw.slice(1);
    } else {
        path = cwd.slice();
    }
    for (const segment of raw.split('\\')) {
        if (!segment || segment === '.') continue;
        if (segment === '..') {
            if (path.length > 1) path.pop();
            continue;
        }
        const parent = nodeAt(path);
        const next = parent && (parent.children || []).find((c) => same(c.name, segment));
        if (!next) return null;
        path.push(next.name);
    }
    return nodeAt(path) ? path : null;
}

/** Depth-first search below `from` for names containing `query`. */
export function searchTree(from: VNode, query: string): VNode[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const found: VNode[] = [];
    const walk = (node: VNode) => {
        for (const child of node.children || []) {
            if (child.name.toLowerCase().includes(q)) found.push(child);
            walk(child);
        }
    };
    walk(from);
    return found;
}

export const findApp = (query: string) => {
    const q = query.trim().toLowerCase().replace(/\.lnk$/, '');
    return APPS.find((app) => app.id === q || app.title.toLowerCase() === q);
};

/* ---------- Cross-app launch requests (Terminal `open` → Explorer) ---------- */

type Listener = (path: Path) => void;
let pending: Path | null = null;
const listeners = new Set<Listener>();

/** Asks Explorer to show `path` (opens it first when it is not running). */
export function requestExplorer(path: Path, open: () => void) {
    pending = path;
    if (listeners.size) listeners.forEach((l) => l(path));
    open();
}

export function takePendingExplorerPath(): Path | null {
    const p = pending;
    pending = null;
    return p;
}

export function onExplorerRequest(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
