import React, { useEffect, useRef, useState } from 'react';
import { projects } from '../content/projects';
import { Project } from '../content/types';
import { ExternalLink, Hint, PlaceholderTag } from '../components/ui';
import { FolderIcon } from '../icons';
import { safeUrl } from '../util';
import './ProjectsApp.css';

/**
 * Projects, laid out like a Windows 7 Explorer window: a details list with a
 * details pane underneath. Opening an item shows its case study. All text
 * comes from content/projects.ts.
 */

/** Case study for one project. Also used by File Explorer's file viewer. */
export const ProjectDetail: React.FC<{ project: Project; focusOnMount?: boolean }> = ({
    project,
    focusOnMount,
}) => {
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (focusOnMount && heading.current) heading.current.focus();
    }, [focusOnMount, project.id]);

    const github = safeUrl(project.links.github);
    const demo = safeUrl(project.links.demo);
    const meta = [project.role, project.period].filter(Boolean).join(' · ');

    const textSection = (title: string, paragraphs?: string[]) =>
        paragraphs && paragraphs.length > 0 ? (
            <section className="prj-section">
                <h3>{title}</h3>
                {paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                ))}
            </section>
        ) : null;

    const listSection = (title: string, items?: string[]) =>
        items && items.length > 0 ? (
            <section className="prj-section">
                <h3>{title}</h3>
                <ul>
                    {items.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
            </section>
        ) : null;

    return (
        <article className="prj-case" aria-labelledby={`prj-${project.id}-title`}>
            <header>
                <h2 id={`prj-${project.id}-title`} ref={heading} tabIndex={-1}>
                    {project.name}
                    <PlaceholderTag show={project.placeholder} />
                </h2>
                <p className="prj-summary">{project.summary}</p>
            </header>

            <div className="prj-case-grid">
                <div className="prj-case-main">
                    {project.problem ? textSection('Problem', [project.problem]) : null}
                    {textSection('Architecture', project.architecture)}
                    {listSection('Implementation', project.implementation)}
                    {listSection('Technical decisions', project.decisions)}
                    {listSection('Results', project.results)}
                </div>

                <aside className="prj-facts" aria-label="Project details">
                    <h3>Details</h3>
                    <dl>
                        {meta && (
                            <>
                                <dt>Role and period</dt>
                                <dd>{meta}</dd>
                            </>
                        )}
                        {project.technologies.length > 0 && (
                            <>
                                <dt>Tech stack</dt>
                                <dd>
                                    <ul className="prj-stack">
                                        {project.technologies.map((t) => (
                                            <li key={t}>{t}</li>
                                        ))}
                                    </ul>
                                </dd>
                            </>
                        )}
                        {(github || demo) && (
                            <>
                                <dt>Links</dt>
                                <dd>
                                    <ExternalLink href={github}>Source on GitHub</ExternalLink>
                                    {github && demo && <br />}
                                    <ExternalLink href={demo}>Live demo</ExternalLink>
                                </dd>
                            </>
                        )}
                    </dl>
                    {!github && !demo && project.placeholder && (
                        <Hint>Add the GitHub link in src/desktop/content/projects.ts</Hint>
                    )}
                </aside>
            </div>
        </article>
    );
};

const stackSummary = (project: Project) => {
    const shown = project.technologies.slice(0, 4).join(', ');
    return project.technologies.length > 4 ? `${shown}…` : shown;
};

const ProjectsApp: React.FC = () => {
    const rootRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const [openId, setOpenId] = useState<string | null>(null);
    const [previewId, setPreviewId] = useState<string | null>(projects[0] ? projects[0].id : null);
    const [returnTo, setReturnTo] = useState<string | null>(null);
    const [narrow, setNarrow] = useState(false);

    useEffect(() => {
        const el = rootRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 520));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Back to the list: put keyboard focus on the project that was open
    useEffect(() => {
        if (!openId && returnTo && rowRefs.current[returnTo]) {
            rowRefs.current[returnTo]?.focus();
            setReturnTo(null);
        }
    }, [openId, returnTo]);

    if (projects.length === 0) {
        return <Hint>Add projects in src/desktop/content/projects.ts</Hint>;
    }

    const open = (id: string) => {
        setPreviewId(id);
        setOpenId(id);
    };
    const back = () => {
        if (!openId) return;
        setReturnTo(openId);
        setOpenId(null);
    };

    const index = projects.findIndex((p) => p.id === openId);
    const opened = index >= 0 ? projects[index] : null;
    const preview = projects.find((p) => p.id === previewId) || projects[0];

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (opened) {
            if (event.key === 'Escape' || (event.altKey && event.key === 'ArrowLeft')) {
                event.preventDefault();
                back();
            }
            return;
        }
        const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
        if (keys.indexOf(event.key) === -1) return;
        event.preventDefault();
        const current = projects.findIndex((p) => rowRefs.current[p.id] === document.activeElement);
        let next = current;
        if (event.key === 'ArrowDown') next = Math.min(projects.length - 1, current + 1);
        if (event.key === 'ArrowUp') next = Math.max(0, current < 0 ? 0 : current - 1);
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = projects.length - 1;
        rowRefs.current[projects[next].id]?.focus();
    };

    return (
        <div className={`prj${narrow ? ' is-narrow' : ''}`} ref={rootRef} onKeyDown={onKeyDown}>
            <div className="prj-toolbar">
                {opened ? (
                    <>
                        <button type="button" className="prj-tool" onClick={back}>
                            <span aria-hidden="true">‹</span> Projects
                        </button>
                        <span className="prj-crumb" aria-hidden="true">
                            Projects › {opened.name}
                        </span>
                        <span className="prj-pager">
                            <button
                                type="button"
                                className="prj-tool"
                                disabled={index === 0}
                                onClick={() => open(projects[index - 1].id)}
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                className="prj-tool"
                                disabled={index === projects.length - 1}
                                onClick={() => open(projects[index + 1].id)}
                            >
                                Next
                            </button>
                        </span>
                    </>
                ) : (
                    <>
                        <span className="prj-count">
                            {projects.length} item{projects.length === 1 ? '' : 's'}
                        </span>
                    </>
                )}
            </div>

            {opened ? (
                <div className="prj-scroll">
                    <ProjectDetail project={opened} focusOnMount />
                </div>
            ) : (
                <>
                    <div className="prj-table" role="list" aria-label="Projects">
                        <div className="prj-head" aria-hidden="true">
                            <span>Name</span>
                            <span>Technologies</span>
                            <span>Source</span>
                        </div>
                        {projects.map((project) => (
                            <div role="listitem" key={project.id}>
                                <button
                                    type="button"
                                    className={`prj-row${project.id === preview.id ? ' is-selected' : ''}`}
                                    ref={(el) => {
                                        rowRefs.current[project.id] = el;
                                    }}
                                    onClick={() => open(project.id)}
                                    onFocus={() => setPreviewId(project.id)}
                                    onMouseEnter={() => setPreviewId(project.id)}
                                >
                                    <span className="prj-name">
                                        <FolderIcon size={20} />
                                        {project.name}
                                        <PlaceholderTag show={project.placeholder} />
                                    </span>
                                    <span className="prj-cell">{stackSummary(project)}</span>
                                    <span className="prj-cell">
                                        {project.links.github ? 'GitHub' : '—'}
                                    </span>
                                </button>
                            </div>
                        ))}
                    </div>

                    <footer className="prj-details" aria-live="polite">
                        <FolderIcon size={40} />
                        <div>
                            <strong>{preview.name}</strong>
                            <p>{preview.summary}</p>
                            <small>Click or press Enter to open the case study.</small>
                        </div>
                    </footer>
                </>
            )}
        </div>
    );
};

export default ProjectsApp;
