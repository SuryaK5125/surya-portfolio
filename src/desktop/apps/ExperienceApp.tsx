import React from 'react';
import { experience } from '../content/experience';
import { Experience } from '../content/types';
import { Bullets, Chips, Hint, PlaceholderTag, Section } from '../components/ui';

const Timeline: React.FC<{ items: Experience[] }> = ({ items }) => (
    <ol className="dsk-timeline">
        {items.map((item) => (
            <li key={item.id} className="dsk-timeline-item">
                <header>
                    <h2>
                        {item.role}
                        <PlaceholderTag show={item.placeholder} />
                    </h2>
                    <p className="dsk-meta">
                        {item.organization} · {item.period}
                    </p>
                </header>
                {item.summary && <p>{item.summary}</p>}
                {item.responsibilities.length > 0 && <Bullets items={item.responsibilities} />}
                {item.technologies && item.technologies.length > 0 && (
                    <Chips items={item.technologies} />
                )}
            </li>
        ))}
    </ol>
);

const ExperienceApp: React.FC = () => {
    if (experience.length === 0) {
        return (
            <div className="dsk-pane">
                <Hint>Add experience in src/desktop/content/experience.ts</Hint>
            </div>
        );
    }

    const work = experience.filter((item) => item.kind !== 'leadership');
    const leadership = experience.filter((item) => item.kind === 'leadership');

    return (
        <div className="dsk-pane">
            {work.length > 0 && (
                <Section title="Experience">
                    <Timeline items={work} />
                </Section>
            )}
            {leadership.length > 0 && (
                <Section title="Leadership">
                    <Timeline items={leadership} />
                </Section>
            )}
        </div>
    );
};

export default ExperienceApp;
