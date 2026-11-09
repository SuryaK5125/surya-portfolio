import { Profile } from './types';

export const profile: Profile = {
    name: 'Surya Kalimuthu',

    headline: 'B.Tech Information Technology · NIT Kurukshetra',

    intro: [
        "I'm a B.Tech Information Technology student at the National Institute of Technology, Kurukshetra (2023–2027). I build backend systems, full-stack applications and data/machine-learning pipelines.",
    ],

    interests: ['Backend systems', 'Data and machine learning', 'Debating and literature'],

    photo: {
        src: 'photo.jpeg',
        alt: 'Portrait of Surya Kalimuthu by the marina',
        caption: 'Bandar Marina, Muscat · July 2026',
    },

    story: [
        {
            title: 'Where It Started',
            paragraphs: [
                'I was born in a small town near Madurai, but grew up in Muscat, Oman. We went back to Tamil Nadu every summer, so my childhood was split between the two. In Muscat, it was mostly school, playing outside with friends, and probably too many video games.',
                'I got into LEGO pretty young. I’d build the sets normally at first, but eventually take them apart and use the pieces to make my own things. I usually enjoyed that more than building the actual set. Looking back, that’s probably where my interest in engineering started.',
            ],
            photo: {
                src: 'childhood.jpg',
                alt: 'Surya as a child, driving a go-kart',
                caption: 'Ferrari World Karting Academy, Abu Dhabi · December 2016',
            },
        },
        {
            title: 'Why Tech?',
            paragraphs: [
                'Gaming was what first got me into tech. I played a lot of Minecraft growing up, and spent almost as much time messing around with mods. I also spent a ridiculous amount of time watching tech videos on YouTube.',
                'During COVID, I tried learning Python, but didn’t get very far. I started programming more seriously when I got to college in 2023.',
                'Since then, I’ve worked on everything from full-stack applications and machine learning to backend and distributed systems. I’ve found myself enjoying backend and systems work the most.',
            ],
        },
        {
            title: 'Where I Am Now',
            paragraphs: [
                'I’m studying Information Technology at NIT Kurukshetra. Most of what I build these days is around backend systems, distributed systems, and machine learning, with the occasional full-stack project mixed in.',
                'In summer 2026, I worked as a Machine Learning Engineering Intern at FlyRank AI, where I spent most of my time working with search analytics data and building models to help rank pages for review.',
            ],
            // The page ends this chapter with the present-day photograph (profile.photo).
        },
    ],

    education: [
        {
            degree: 'B.Tech, Information Technology',
            institution: 'National Institute of Technology, Kurukshetra',
            period: '2023 – 2027',
            score: 'CGPA 7.48 · Semester VI SGPA 9.26',
        },
        {
            degree: 'Senior Secondary (Class XII), CBSE',
            institution: 'Indian School Muscat',
            score: '88.6%',
        },
    ],
};
