import React, { useEffect, useState } from 'react';
import UIEventBus from '../EventBus';

const FreeCamToggle: React.FC = () => {
    const [active, setActive] = useState(false);
    useEffect(() => {
        const focused = () => setActive(false);
        const changed = (event: CustomEvent<boolean>) => setActive(event.detail);
        document.addEventListener('freeCamFocus', focused);
        document.addEventListener('freeCamToggle', changed as EventListener);
        return () => {
            document.removeEventListener('freeCamFocus', focused);
            document.removeEventListener('freeCamToggle', changed as EventListener);
        };
    }, []);
    const toggle = () => {
        setActive(!active);
        UIEventBus.dispatch('freeCamToggle', !active);
    };
    return <button type="button" aria-label={active ? 'Return to normal camera' : 'Explore with free camera'}
        aria-pressed={active} onClick={toggle}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M2 5h3l1-2h4l1 2h3v8H2Z" fill="none" stroke="currentColor" />
            <circle cx="8" cy="9" r="2" fill="none" stroke="currentColor" />
        </svg>
        <span>{active ? 'Exit camera' : 'Free camera'}</span>
    </button>;
};
export default FreeCamToggle;
