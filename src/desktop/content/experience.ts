import { Experience } from './types';

// Work experience first; entries with kind: 'leadership' appear in their own
// Leadership section below it. Most recent first within each section.
export const experience: Experience[] = [
    {
        id: 'flyrank-ai',
        role: 'Machine Learning Engineering Intern',
        organization: 'FlyRank AI',
        period: 'Jul 2026 – Aug 2026 · Remote',
        responsibilities: [
            'Queried a 9.84M-row search-analytics dataset using DuckDB SQL over Parquet, checking for duplicate rows, date coverage and missing analytics data.',
            'Trained Logistic Regression and Random Forest models to rank content pages for review, reaching 0.720 Precision@50 on unseen clients versus 0.520 for an impressions-only baseline.',
            'Showed that a random train-test split inflated Precision@50 to 0.940, versus 0.720 with clients held out, because the same clients appeared in both sets.',
        ],
        technologies: ['DuckDB', 'Parquet', 'Logistic Regression', 'Random Forest'],
    },
    {
        id: 'literary-debating-club',
        role: 'Social Media Head',
        organization: 'English Literary and Debating Club, NIT Kurukshetra',
        period: '2026 – Present',
        kind: 'leadership',
        responsibilities: [
            'Lead a 10+ member team as Social Media Head, organizing institute-level debates, quizzes and Model United Nations events while coordinating publicity and event execution.',
        ],
    },
];
