import React, { useEffect, useRef, useState } from 'react';
import FreeCamToggle from './FreeCamToggle';
import MuteToggle from './MuteToggle';
import SceneHelp from './SceneHelp';
import { INTRO_NAME, INTRO_DETAIL, INTRO_LENGTH, initialIntroCount, completeIntroReveal, startIntroReveal } from '../IntroReveal';

// Screen readers receive the complete lines; the visual labels grow one
// character at a time. Each line reserves its height so the stack stays anchored.
const TypedLine: React.FC<{ text: string; count: number; className: string }> = ({ text, count, className }) => (
    <p className={className}>
        <span className="scene-sr-only">{text}</span>
        <span className="scene-type-reveal" aria-hidden="true" data-empty={count === 0}>{text.slice(0, count)}</span>
    </p>
);

/** Scene-only introduction and utilities, independent of the desktop apps. */
const InfoOverlay: React.FC<{ visible: boolean; controlsVisible: boolean }> = ({ visible, controlsVisible }) => {
    const [count, setCount] = useState(initialIntroCount);
    const finished = useRef(count === INTRO_LENGTH);
    useEffect(() => {
        // Entering an inspection view ends the intro, rather than queuing a
        // second reveal when the visitor returns to the room.
        if (!visible) {
            finished.current = true; completeIntroReveal(); setCount(INTRO_LENGTH);
            return;
        }
        if (finished.current) return;
        return startIntroReveal(next => {
            finished.current = next === INTRO_LENGTH;
            setCount(next);
        });
    }, [visible]);
    return <>
        <aside className="scene-introduction" aria-label="About Surya Kalimuthu" aria-hidden={!visible}>
            <TypedLine className="scene-introduction-name" text={INTRO_NAME} count={Math.min(count, INTRO_NAME.length)} />
            <TypedLine className="scene-introduction-detail" text={INTRO_DETAIL} count={Math.max(0, count - INTRO_NAME.length)} />
        </aside>
        <nav className="scene-utilities" aria-label="Scene controls" aria-hidden={!controlsVisible}>
            <MuteToggle /><FreeCamToggle /><SceneHelp available={controlsVisible} />
        </nav>
    </>;
};

export default InfoOverlay;
