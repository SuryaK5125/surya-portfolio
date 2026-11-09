import React from 'react';

const HintBalloon: React.FC<{ onClose: () => void; touch: boolean; onChangeTheme: () => void; theme: string }> =
    ({ onClose, touch, onChangeTheme, theme }) => (
        <section id="theme-discovery" className="dsk-balloon" role="dialog" aria-label="Hidden desktop theme">
            <button type="button" className="dsk-balloon-close" aria-label="Dismiss theme hint" onClick={onClose}>×</button>
            <strong className="dsk-balloon-title">A theme might be hidden here.</strong>
            {touch ? <>
                <p>Try the Minecraft-inspired desktop theme.</p>
                <button type="button" className="dsk-button" onClick={onChangeTheme}>
                    {theme === 'minecraft' ? 'Return to Aero' : 'Try Minecraft theme'}
                </button>
                <small>Your choice is saved on this device.</small>
            </> : <>
                <p>Press <span className="dsk-keys" aria-label="Up, Up, Down, Down, Left, Right, Left, Right, B, A">↑ ↑ ↓ ↓ ← → ← → B A</span> while the desktop is focused.</p>
                <small>Enter the keys one at a time — not inside an app or text field.</small>
            </>}
        </section>
    );
export default HintBalloon;
