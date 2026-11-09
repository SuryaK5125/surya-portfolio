import React, { useEffect, useRef, useState } from 'react';
import eventBus from '../EventBus';
import Application from '../../Application';
import { prefersReducedMotion } from '../../Utils/motion';

/**
 * Minimal loading screen: near-black, a short status line and a thin bar
 * that follows the real asset count. When everything is loaded and the
 * first frames of the scene have rendered, it fades straight into the room.
 * There is no artificial minimum duration, so cached visits enter at once.
 */

type Stage = 'start' | 'assets' | 'scene' | 'environment' | 'ready' | 'leaving' | 'gone' | 'error';

const MESSAGES: { [key in Stage]?: string } = {
    start: 'Loading...',
    assets: 'Loading assets...',
    scene: 'Initializing scene...',
    environment: 'Preparing environment...',
    ready: 'Almost ready...',
    leaving: 'Almost ready...',
};

const hasWebGL = () => {
    try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
        return false;
    }
};

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const LoadingScreen: React.FC = () => {
    const [stage, setStage] = useState<Stage>(() => (hasWebGL() ? 'start' : 'error'));
    const [progress, setProgress] = useState(0);
    const [assetError, setAssetError] = useState(false);
    const entered = useRef(false);

    const enter = () => {
        if (entered.current) return;
        entered.current = true;
        setStage('leaving');
        const ui = document.getElementById('ui');
        if (ui) ui.style.pointerEvents = 'none';
        // The camera's opening move starts underneath the fade.
        eventBus.dispatch('loadingScreenDone', { skipIntro: new Application().resources.criticalFromCache() });
        window.setTimeout(() => setStage('gone'), prefersReducedMotion() ? 200 : 600);
    };

    useEffect(() => {
        if (stage === 'error') return;
        const onProgress = (loaded: number, toLoad: number) => {
            if (!toLoad) return;
            setProgress(loaded / toLoad);
            if (loaded > 0) setStage((s) => (s === 'start' ? 'assets' : s));
        };
        eventBus.on('loadingFailed', () => { setAssetError(true); setStage('error'); });
        eventBus.on('loadedSource', (data: { loaded: number; toLoad: number }) => onProgress(data.loaded, data.toLoad));
        // Catch up on anything that finished before this component mounted
        const resources = new Application().resources;
        if (resources) onProgress(resources.loaded, resources.toLoad);
        if (new URLSearchParams(window.location.search).has('debug')) enter();
    }, []);

    // Once every asset is in, wait for real frames: the world is built on
    // the resources' ready event, then the first frames compile its shaders.
    useEffect(() => {
        if (progress < 1 || entered.current || stage === 'error') return;
        let cancelled = false;
        (async () => {
            setStage('scene');
            await nextFrame();
            if (cancelled) return;
            setStage('environment');
            await nextFrame();
            await nextFrame();
            if (cancelled) return;
            setStage('ready');
            await nextFrame();
            // Cached entry skips the flight, so do not expose a blank laptop
            // while the real desktop document finishes its cached CSS/images.
            if (new Application().resources.criticalFromCache()) {
                const screen = document.getElementById('computer-screen') as HTMLIFrameElement | null;
                if (screen && (screen.contentDocument?.readyState !== 'complete' || screen.contentDocument.URL === 'about:blank')) {
                    await new Promise<void>(resolve => screen.addEventListener('load', () => resolve(), { once: true }));
                }
            }
            if (!cancelled) enter();
        })();
        return () => {
            cancelled = true;
        };
    }, [progress >= 1]);

    if (stage === 'gone') return null;

    return (
        <div className={`loader${stage === 'leaving' ? ' is-leaving' : ''}`} aria-busy={stage !== 'leaving'}>
            {stage === 'error' ? (
                <div className="loader-box">
                    <p className="loader-text" role="alert">{assetError ? 'A scene asset could not be loaded.' : 'WebGL is required to view this site. Please enable it or try another browser.'}</p>
                    {assetError && <button type="button" onClick={() => window.location.reload()}>Retry loading</button>}
                </div>
            ) : (
                <div className="loader-box">
                    <div className="loader-row">
                        <p className="loader-text" role="status" aria-live="polite">
                            {MESSAGES[stage]}
                        </p>
                        <p className="loader-pct">{Math.round(progress * 100)}%</p>
                    </div>
                    <div
                        className="loader-bar"
                        role="progressbar"
                        aria-label="Loading"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress * 100)}
                    >
                        <span style={{ transform: `scaleX(${progress})` }} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoadingScreen;
