import React, { useEffect, useState } from 'react';
import InfoOverlay from './InfoOverlay';

const InterfaceUI: React.FC = () => {
    const [loading, setLoading] = useState(true);
    // The overlay (and its name reveal) waits for the camera's opening flight
    // to land or be skipped, so it doesn't type over the moving room.
    const [introDone, setIntroDone] = useState(false);
    const [inMonitor, setInMonitor] = useState(false);
    const [inDrawer, setInDrawer] = useState(false);

    useEffect(() => {
        // Native event handlers can be removed exactly on unmount.
        const loaded = () => setLoading(false);
        const landed = () => setIntroDone(true);
        const entered = () => setInMonitor(true);
        const left = () => setInMonitor(false);
        const drawer = (event: CustomEvent<boolean>) => setInDrawer(event.detail);
        document.addEventListener('loadingScreenDone', loaded);
        document.addEventListener('introDone', landed);
        document.addEventListener('enterMonitor', entered);
        document.addEventListener('leftMonitor', left);
        document.addEventListener('drawerFocusChange', drawer as EventListener);
        return () => {
            document.removeEventListener('loadingScreenDone', loaded);
            document.removeEventListener('introDone', landed);
            document.removeEventListener('enterMonitor', entered);
            document.removeEventListener('leftMonitor', left);
            document.removeEventListener('drawerFocusChange', drawer as EventListener);
        };
    }, []);

    return !loading && introDone ? (
        <InfoOverlay visible={!inMonitor && !inDrawer} controlsVisible={!inMonitor} />
    ) : null;
};

export default InterfaceUI;
