import React, { useEffect, useState } from 'react';
import UIEventBus from '../EventBus';

const MuteToggle: React.FC = () => {
    // Sound is on by default; it starts with the visitor's first gesture
    const [muted, setMuted] = useState(false);
    useEffect(() => {
        const update = (event: Event) => setMuted((event as CustomEvent<boolean>).detail);
        document.addEventListener('soundState', update);
        return () => document.removeEventListener('soundState', update);
    }, []);
    return <button type="button" aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted}
        onClick={(event) => UIEventBus.dispatch('muteToggle', { muted: !muted, input: event.nativeEvent })}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M2 6h3l4-3v10l-4-3H2Z" fill="currentColor" />
            {muted ? <path d="m11 6 4 4m0-4-4 4" fill="none" stroke="currentColor" /> : <path d="M11 5q5 3 0 6" fill="none" stroke="currentColor" />}
        </svg>
        <span>{muted ? 'Sound off' : 'Sound on'}</span>
    </button>;
};
export default MuteToggle;
