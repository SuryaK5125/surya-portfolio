import { Project } from './types';

/**
 * Projects shown in the Projects app, in display order. Each entry becomes
 * a case study: problem, architecture, implementation, technical decisions
 * and results. Every section is optional: leave a field empty (or omit it)
 * and that section is simply not shown. Keep claims to what you can back up.
 */
export const projects: Project[] = [
    {
        id: 'distributed-rate-limiter',
        name: 'Distributed API Rate Limiter',
        summary:
            'A token-bucket rate limiter shared by multiple Express instances through Redis.',
        problem: 'Rate-limit requests consistently across multiple Express instances.',
        architecture: [
            'A distributed token-bucket rate limiter for multiple Express instances, with its state held in Redis.',
            'An atomic Lua script updates that shared state, so concurrent requests cannot race.',
        ],
        implementation: [
            'Tier-based rate-limit policies.',
            'TTL-based cleanup of idle client buckets.',
        ],
        decisions: [
            'Redis-backed shared state updated by an atomic Lua script, to prevent race conditions across concurrent requests.',
            'Configurable fail-open or fail-closed behavior for when Redis is unavailable.',
        ],
        technologies: ['Node.js', 'Express.js', 'Redis', 'Lua', 'Jest', 'k6'],
        results: [
            'Validated concurrency and client isolation using 15 Jest integration tests and k6 load tests (300 virtual users, 9,900 requests), with zero cross-client throttling errors.',
        ],
        links: { github: 'https://github.com/SuryaK5125/distributed-rate-limiter' },
    },
    {
        id: 'healthledger',
        name: 'HealthLedger',
        summary:
            'A full-stack family health records platform with profiles, medications, appointments and documents.',
        problem:
            'Keep a family’s health records in one place: multiple profiles, medications, appointments and medical documents.',
        architecture: ['A full-stack platform built with React and Express.'],
        implementation: [
            'Multiple profiles, medications, appointments and medical document management.',
        ],
        decisions: [
            'JWT-based authentication and profile-level access control to secure family health records.',
            'Failure-safe Cloudinary workflows, to prevent orphaned files and dangling database references.',
        ],
        technologies: ['React', 'Express.js', 'MongoDB', 'Mongoose', 'JWT', 'Cloudinary'],
        results: [],
        links: { github: 'https://github.com/SuryaK5125/HealthLedger' },
    },
    {
        id: 'behavioral-drift-detection',
        name: 'Behavioral Drift Detection',
        summary:
            'A PySpark pipeline that detects resource-usage drift in Google Borg cluster traces and predicts failures.',
        problem:
            'Detect drift in resource usage across Google Borg cluster traces, and classify failures.',
        architecture: [
            'A PySpark ETL pipeline that processes 405K Google Borg cluster-trace records, retaining 349K records.',
        ],
        implementation: [
            'Engineered CPU and memory usage features.',
            'Analyzed resource-usage drift across 10 chronological windows.',
            'Trained a Random Forest failure classifier.',
        ],
        decisions: ['KS tests and PSI were used to measure drift across the chronological windows.'],
        technologies: ['PySpark', 'Python', 'Pandas', 'NumPy', 'scikit-learn'],
        results: [
            'Random Forest failure classifier achieving 0.873 ROC-AUC and 0.816 average precision.',
        ],
        links: { github: 'https://github.com/SuryaK5125/behavioral-drift-detection' },
    },
];
