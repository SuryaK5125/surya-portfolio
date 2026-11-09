import { Resume } from './types';

export const resume: Resume = {
    // Public copy of Surya_Kalimuthu_SWE.pdf with phone number, email and
    // PDF metadata removed.
    file: 'resume.pdf',
    // Rendered from resume.pdf at 200 dpi for phones, which can't embed PDFs.
    // Re-render it whenever the PDF changes.
    pages: ['resume-page-1.png'],

    updated: 'October 2026',

    skills: [
        'Languages: Python, C++, SQL, JavaScript',
        'Web: Node.js, Express.js, React.js, REST APIs, JWT Authentication, HTML, CSS',
        'Databases: MongoDB, Redis',
        'ML & Data: PySpark, Pandas, NumPy, scikit-learn, DuckDB, Parquet',
        'Developer Tools: Git, GitHub, Jest, k6',
        'Core CS: Data Structures & Algorithms (400+ LeetCode problems solved), OOP, DBMS, OS, Computer Networks',
    ],
};
