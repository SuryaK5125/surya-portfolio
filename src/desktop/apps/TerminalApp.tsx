import React, { useContext, useEffect, useRef, useState } from 'react';
import { DesktopContext } from '../context';
import { APPS, AppId, getApp } from '../registry';
import { profile } from '../content/profile';
import { projects } from '../content/projects';
import { experience } from '../content/experience';
import {
    Path,
    VNode,
    experienceText,
    findApp,
    homePath,
    nodeAt,
    pathString,
    projectFileName,
    projectText,
    requestExplorer,
    resolvePath,
    skillsText,
} from '../vfs';

/**
 * CMD-style terminal. Every command is simulated in this file against the
 * virtual filesystem and portfolio content; nothing is ever executed and
 * nothing on the visitor's computer is read.
 */

type Line = { kind: 'cmd' | 'out' | 'err'; text: string };

const COMMANDS: [string, string][] = [
    ['help', 'Lists the available commands.'],
    ['dir, ls', 'Lists the contents of a folder.'],
    ['cd', 'Changes folder (cd .., cd \\, cd ~).'],
    ['cls, clear', 'Clears the screen.'],
    ['whoami', 'Shows who this portfolio belongs to.'],
    ['cat, type', 'Prints a text file (type skills.txt).'],
    ['projects', 'Lists projects; "projects <name>" shows one.'],
    ['skills', 'Lists my key skills.'],
    ['experience', 'Shows my work experience.'],
    ['open', 'Opens an app or a file (open resume, open Projects).'],
    ['echo, ver, date', 'Small extras.'],
];

const NAMES = [
    'help', 'dir', 'ls', 'cd', 'chdir', 'cls', 'clear', 'whoami', 'cat', 'type',
    'projects', 'skills', 'experience', 'open', 'echo', 'ver', 'date',
];
const PATH_COMMANDS = ['cd', 'chdir', 'dir', 'ls', 'cat', 'type', 'open'];
const FOLDER_ONLY = ['cd', 'chdir'];

const tokenize = (input: string) => {
    const tokens: string[] = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input))) tokens.push(m[1] !== undefined ? m[1] : m[2]);
    return tokens;
};

const out = (text: string): Line => ({ kind: 'out', text });
const err = (text: string): Line => ({ kind: 'err', text });
const lines = (text: string, kind: Line['kind'] = 'out'): Line[] =>
    text.split(/\r?\n/).map((t) => ({ kind, text: t }));

const tag = (node: VNode) => {
    if (node.folder) return '<DIR>';
    if (node.type === 'Shortcut') return '<LNK>';
    if (node.type === 'Project') return '<PRJ>';
    if (node.type === 'PDF Document') return '<PDF>';
    if (node.type === 'JPEG Image') return '<IMG>';
    return '<TXT>';
};

const findProject = (query: string) => {
    const q = query.toLowerCase().replace(/\.project$/, '');
    return projects.find(
        (p) =>
            p.id.toLowerCase() === q ||
            p.name.toLowerCase() === q ||
            projectFileName(p).replace(/\.project$/, '') === q
    );
};

type Env = {
    cwd: Path;
    openApp: (id: AppId) => void;
};

type Result = { out: Line[]; cwd?: Path; clear?: boolean };

function run(input: string, env: Env): Result {
    const tokens = tokenize(input);
    if (!tokens.length) return { out: [] };
    const name = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    switch (name) {
        case 'help':
            return {
                out: [
                    out('Commands (all simulated; nothing runs on your computer):'),
                    out(''),
                    ...COMMANDS.map(([cmd, desc]) => out(`${cmd.padEnd(16)}${desc}`)),
                    out(''),
                    out('Tab completes commands and names. Up/Down browse history.'),
                ],
            };

        case 'cls':
        case 'clear':
            return { out: [], clear: true };

        case 'ver':
            return { out: [out(''), out('Command Prompt [Version 1.0]')] };

        case 'date':
            return { out: [out(`The current date is: ${new Date().toDateString()}`)] };

        case 'echo':
            return { out: [out(args.join(' '))] };

        case 'whoami':
            return {
                out: [
                    out(`portfolio\\${homePath()[2].toLowerCase()}`),
                    out(profile.name),
                    ...(profile.headline ? [out(profile.headline)] : []),
                ],
            };

        case 'cd':
        case 'chdir': {
            if (!args.length) return { out: [out(pathString(env.cwd))] };
            const target = resolvePath(args.join(' '), env.cwd);
            if (!target) return { out: [err('The system cannot find the path specified.')] };
            const node = nodeAt(target) as VNode;
            if (!node.folder) return { out: [err('The directory name is invalid.')] };
            return { out: [], cwd: target };
        }

        case 'dir':
        case 'ls': {
            const target = args.length ? resolvePath(args.join(' '), env.cwd) : env.cwd;
            const node = target && nodeAt(target);
            if (!target || !node) return { out: [err('File Not Found')] };
            if (!node.folder) {
                return { out: [out(''), out(`${tag(node)}  ${node.name}`), out('')] };
            }
            const items = (node.children || [])
                .slice()
                .sort((a, b) =>
                    a.folder === b.folder ? a.name.localeCompare(b.name) : a.folder ? -1 : 1
                );
            return {
                out: [
                    out(` Directory of ${pathString(target)}`),
                    out(''),
                    ...items.map((n) => out(`${tag(n).padEnd(7)} ${n.name}`)),
                    out(items.length ? '' : 'File Not Found'),
                    ...(items.length ? [out(`        ${items.length} item(s)`)] : []),
                ],
            };
        }

        case 'cat':
        case 'type': {
            if (!args.length) return { out: [err('The syntax of the command is incorrect.')] };
            const raw = args.join(' ');
            const target = resolvePath(raw, env.cwd);
            const node = target && nodeAt(target);
            if (!node) return { out: [err('The system cannot find the file specified.')] };
            if (node.folder) return { out: [err('Access is denied.')] };
            const action = node.action;
            if (action?.kind === 'text') return { out: lines(action.text) };
            if (action?.kind === 'project') return { out: lines(projectText(action.project)) };
            return {
                out: [err(`${node.name} is not a text file. Try: open "${node.name}"`)],
            };
        }

        case 'projects': {
            if (!projects.length) return { out: [out('No projects yet.')] };
            if (args.length) {
                const project = findProject(args.join(' '));
                if (!project) {
                    return {
                        out: [err(`No project named '${args.join(' ')}'. Type "projects" to list them.`)],
                    };
                }
                return { out: lines(projectText(project)) };
            }
            const width = Math.max(...projects.map((p) => projectFileName(p).length)) + 2;
            return {
                out: [
                    out(`${projects.length} project(s). Type "projects <name>" for details.`),
                    out(''),
                    ...projects.map((p) =>
                        out(`${projectFileName(p).replace(/\.project$/, '').padEnd(width)}${p.name}: ${p.summary}`)
                    ),
                ],
            };
        }

        case 'skills':
            return { out: lines(skillsText()) };

        case 'experience':
            if (!experience.length) return { out: [out('No experience listed yet.')] };
            return {
                out: experience.flatMap((e, i) => [
                    ...(i ? [out(''), out('----------------------------------------')] : []),
                    ...lines(experienceText(e)),
                ]),
            };

        case 'open':
        case 'start': {
            if (!args.length) {
                return { out: [err('Usage: open <app | file | folder>   e.g. open resume')] };
            }
            const raw = args.join(' ');
            const app = findApp(raw);
            if (app) {
                env.openApp(app.id);
                return { out: [out(`Opening ${app.title}...`)] };
            }
            const target = resolvePath(raw, env.cwd);
            const node = target && nodeAt(target);
            if (!target || !node) {
                return {
                    out: [err(`Cannot find '${raw}'. Try "open resume", "open projects" or "dir".`)],
                };
            }
            if (node.action?.kind === 'app') {
                env.openApp(node.action.app);
                return { out: [out(`Opening ${getApp(node.action.app).title}...`)] };
            }
            requestExplorer(target, () => env.openApp('explorer'));
            return { out: [out(`Opening ${node.name} in File Explorer...`)] };
        }

        default:
            return {
                out: [
                    err(`'${tokens[0]}' is not recognized as an internal or external command,`),
                    err('operable program or batch file.'),
                ],
            };
    }
}

/** Completion candidates for the token being typed, plus where that token starts. */
function complete(input: string, cwd: Path): { start: number; matches: string[] } {
    const quoted = (input.match(/"/g) || []).length % 2 === 1;
    const start = quoted ? input.lastIndexOf('"') : input.lastIndexOf(' ') + 1;
    const first = tokenize(input)[0]?.toLowerCase() || '';
    const word = input.slice(start).replace(/^"/, '');

    if (start === 0) {
        return {
            start,
            matches: NAMES.filter((n) => n.startsWith(word.toLowerCase())),
        };
    }

    const wrap = (value: string) => (/\s/.test(value) ? `"${value}"` : value);

    if (first === 'projects') {
        return {
            start,
            matches: projects
                .map((p) => projectFileName(p).replace(/\.project$/, ''))
                .filter((n) => n.startsWith(word.toLowerCase()))
                .map(wrap),
        };
    }
    if (PATH_COMMANDS.indexOf(first) === -1) return { start, matches: [] };

    const slash = Math.max(word.lastIndexOf('\\'), word.lastIndexOf('/'));
    const dirPart = word.slice(0, slash + 1);
    const namePart = word.slice(slash + 1).toLowerCase();
    const dir = dirPart ? resolvePath(dirPart, cwd) : cwd;
    const node = dir && nodeAt(dir);
    const matches: string[] = [];
    if (node && node.folder) {
        for (const child of node.children || []) {
            if (FOLDER_ONLY.indexOf(first) !== -1 && !child.folder) continue;
            if (child.name.toLowerCase().startsWith(namePart)) {
                matches.push(wrap(dirPart + child.name + (child.folder ? '\\' : '')));
            }
        }
    }
    if (first === 'open' && !dirPart) {
        for (const id of ['resume', 'projects', 'experience', 'contact', 'music', 'wallpapers', 'explorer', 'terminal']) {
            if (!APPS.some((app) => app.id === id)) continue; // skip hidden apps
            if (id.startsWith(namePart) && matches.indexOf(id) === -1) matches.push(id);
        }
    }
    return { start, matches };
}

const MAX_LINES = 600;

const TerminalApp: React.FC = () => {
    const { openApp } = useContext(DesktopContext);
    const [cwd, setCwd] = useState<Path>(() => homePath());
    const [log, setLog] = useState<Line[]>(() => [
        out('Command Prompt [Version 1.0]'),
        out('A simulated shell for this portfolio. Nothing here runs on your computer.'),
        out('Type "help" to see the commands.'),
        out(''),
    ]);
    const [input, setInput] = useState('');
    const history = useRef<string[]>([]);
    const cursor = useRef(-1);
    const draft = useRef('');
    const cycle = useRef<{ last: string; base: string; matches: string[]; i: number } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    const prompt = `${pathString(cwd)}>`;

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        const el = bodyRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [log, input]);

    const push = (added: Line[]) => setLog((l) => [...l, ...added].slice(-MAX_LINES));

    const submit = () => {
        const text = input;
        const echoed: Line = { kind: 'cmd', text: `${prompt}${text}` };
        setInput('');
        cursor.current = -1;
        cycle.current = null;
        if (text.trim()) history.current.push(text);
        const result = run(text, { cwd, openApp });
        if (result.clear) setLog([]);
        else push([echoed, ...result.out]);
        if (result.cwd) setCwd(result.cwd);
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        } else if (event.key === 'Tab') {
            event.preventDefault();
            let state = cycle.current;
            if (!state || state.last !== input) {
                const { start, matches } = complete(input, cwd);
                if (!matches.length) return;
                state = { last: input, base: input.slice(0, start), matches, i: -1 };
            }
            state.i = (state.i + 1) % state.matches.length;
            const next = state.base + state.matches[state.i];
            state.last = next;
            cycle.current = state;
            setInput(next);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const h = history.current;
            if (!h.length) return;
            if (cursor.current === -1) {
                draft.current = input;
                cursor.current = h.length - 1;
            } else if (cursor.current > 0) cursor.current--;
            setInput(h[cursor.current]);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            const h = history.current;
            if (cursor.current === -1) return;
            if (cursor.current < h.length - 1) {
                cursor.current++;
                setInput(h[cursor.current]);
            } else {
                cursor.current = -1;
                setInput(draft.current);
            }
        } else if (event.ctrlKey && event.key.toLowerCase() === 'l') {
            event.preventDefault();
            setLog([]);
        } else if (event.ctrlKey && event.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
            event.preventDefault();
            push([{ kind: 'cmd', text: `${prompt}${input}^C` }]);
            setInput('');
        } else if (event.key === 'Escape') {
            setInput('');
        }
    };

    return (
        <div
            className="term"
            ref={bodyRef}
            onMouseUp={() => {
                if (!window.getSelection()?.toString()) inputRef.current?.focus();
            }}
        >
            {log.map((line, i) => (
                <div key={i} className={`term-line is-${line.kind}`}>
                    {line.text || ' '}
                </div>
            ))}
            <label className="term-input">
                <span className="term-prompt">{prompt}</span>
                <input
                    ref={inputRef}
                    value={input}
                    onChange={(event) => {
                        setInput(event.target.value);
                        cycle.current = null;
                    }}
                    onKeyDown={onKeyDown}
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    aria-label="Command"
                />
            </label>
        </div>
    );
};

export default TerminalApp;
