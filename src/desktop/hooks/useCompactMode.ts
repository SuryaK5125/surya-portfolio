import { useEffect, useState } from 'react';

const COMPACT_QUERY = '(max-width: 700px), (max-height: 500px) and (pointer: coarse)';

/** True on phone-sized viewports, or when forced with ?mode=compact. */
export function useCompactMode(): boolean {
    const forced =
        new URLSearchParams(window.location.search).get('mode') === 'compact';
    const [matches, setMatches] = useState(
        () => window.matchMedia(COMPACT_QUERY).matches
    );

    useEffect(() => {
        const query = window.matchMedia(COMPACT_QUERY);
        const onChange = () => setMatches(query.matches);
        // addListener: older Safari lacks addEventListener on MediaQueryList
        query.addListener(onChange);
        return () => query.removeListener(onChange);
    }, []);

    return forced || matches;
}
