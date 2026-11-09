import React, { useContext } from 'react';
import { DesktopContext } from '../context';
import { profile } from '../content/profile';
import { resume } from '../content/resume';
import { DocumentIcon, DownloadIcon, LinkIcon } from '../icons';
import { safeUrl } from '../util';

/**
 * Document viewer for the public resume PDF, with download and
 * open-in-new-tab controls. Shows a placeholder page until the PDF is added.
 */
const ResumeApp: React.FC = () => {
    const { compact } = useContext(DesktopContext);
    const href = safeUrl(resume.file);
    const fileName = resume.file ? resume.file.split('/').pop() : 'resume.pdf';
    const pages = (resume.pages || []).map((page) => safeUrl(page)).filter(Boolean) as string[];

    return (
        <div className="doc-app">
            <header className="doc-toolbar">
                <span className="doc-file">
                    <DocumentIcon size={22} />
                    <span>
                        <strong>{href ? fileName : 'Resume'}</strong>
                        <small>
                            {href
                                ? resume.updated
                                    ? `PDF · updated ${resume.updated}`
                                    : 'PDF document'
                                : 'Not added yet'}
                        </small>
                    </span>
                </span>
                <span className="doc-actions">
                    {href ? (
                        <>
                            <a className="dsk-button" href={href} download={fileName}>
                                <DownloadIcon size={16} />
                                Download
                            </a>
                            <a
                                className="dsk-button is-primary"
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <LinkIcon size={14} />
                                Open in new tab
                            </a>
                        </>
                    ) : (
                        <>
                            <span className="dsk-button is-disabled" aria-disabled="true">
                                <DownloadIcon size={16} />
                                Download
                            </span>
                            <span className="dsk-button is-disabled" aria-disabled="true">
                                <LinkIcon size={14} />
                                Open in new tab
                            </span>
                        </>
                    )}
                </span>
            </header>

            <div className={`doc-canvas${href && !compact ? ' is-frame' : ''}`}>
                {href && !compact ? (
                    <iframe
                        className="doc-frame"
                        src={`${href}#view=FitH`}
                        title={`${profile.name} resume (PDF)`}
                    />
                ) : href && pages.length ? (
                    <div className="doc-images">
                        {pages.map((src, i) => (
                            <a key={src} href={href} target="_blank" rel="noopener noreferrer">
                                <img
                                    src={src}
                                    alt={i === 0 ? `${profile.name} resume, page ${i + 1}` : `Resume page ${i + 1}`}
                                    loading="lazy"
                                    decoding="async"
                                />
                            </a>
                        ))}
                    </div>
                ) : (
                    <article className="doc-page" aria-label="Resume placeholder">
                        <h2>{profile.name}</h2>
                        {profile.headline && <p className="doc-headline">{profile.headline}</p>}
                        <hr />
                        {href ? (
                            <>
                                <p>PDF previews aren't available on this screen size.</p>
                                <p>Use Download or Open in new tab above.</p>
                            </>
                        ) : (
                            <>
                                <p className="doc-placeholder-title">Resume coming soon</p>
                                <p className="dsk-hint">
                                    Add a public-safe PDF at static/desktop/resume.pdf (no phone
                                    number, home address or IDs; metadata stripped), then set
                                    file: 'resume.pdf' in src/desktop/content/resume.ts.
                                </p>
                                <span className="doc-lines" aria-hidden="true">
                                    {Array.from({ length: 9 }, (_, i) => (
                                        <span key={i} style={{ width: `${92 - ((i * 17) % 38)}%` }} />
                                    ))}
                                </span>
                            </>
                        )}
                    </article>
                )}
            </div>
        </div>
    );
};

export default ResumeApp;
