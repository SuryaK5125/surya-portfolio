import React from 'react';
import ReactDOM from 'react-dom';
import AboutPage from './AboutPage';
import './about.css';

/**
 * In-page links (contents, "Back to top") scroll this document only.
 * A native fragment jump also scrolls every same-origin ancestor to bring
 * the target into view, which shifts the 3D room around the laptop screen
 * when this page is shown inside it (desktop → Who Am I? browser → here).
 */
document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest && (event.target as Element).closest('a[href^="#"]');
    if (!link) return;
    const id = decodeURIComponent((link.getAttribute('href') || '').slice(1));
    const target = id && id !== 'top' ? document.getElementById(id) : null;
    if (id && id !== 'top' && !target) return;
    event.preventDefault();
    const top = target ? target.getBoundingClientRect().top + window.scrollY - 16 : 0;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    try {
        history.replaceState(null, '', `#${id || 'top'}`);
    } catch (_) {
        /* sandboxed or file: URLs; the scroll still happened */
    }
});

ReactDOM.render(<AboutPage />, document.getElementById('about-root'));
