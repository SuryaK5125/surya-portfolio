import React from 'react';

/** A failed optional chunk must not take down the desktop shell. */
export default class AppLoadingBoundary extends React.Component<{}, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        if (this.state.failed) return (
            <div role="alert" style={{ padding: '12px 16px', fontSize: 12 }}>
                <p>This application could not be downloaded. Check your connection and reload the desktop to try again.</p>
                <button type="button" onClick={() => window.location.reload()}>Reload desktop</button>
            </div>
        );
        return this.props.children;
    }
}
