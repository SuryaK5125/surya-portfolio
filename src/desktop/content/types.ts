/**
 * Content types for the desktop apps. All visitor-facing text lives in the
 * sibling files (profile.ts, projects.ts, …) so copy edits never touch UI code.
 *
 * Set `placeholder: true` on an entry while it still holds template text; the
 * UI then marks it with a "Placeholder" tag.
 */

export type Photo = {
    /** Path relative to /desktop/, e.g. 'photo.jpg' for static/desktop/photo.jpg */
    src: string;
    alt: string;
    /** One-line caption under the photo, e.g. 'City, Country · Month Year'. */
    caption?: string;
};

/** A titled chapter on the About page, optionally with a photo. */
export type StorySection = {
    title: string;
    paragraphs: string[];
    photo?: Photo | null;
    /** Shows a "Placeholder" tag while the text is still a template. */
    placeholder?: boolean;
};

export type EducationEntry = {
    degree: string;
    institution: string;
    /** e.g. '2023 – 2027'. Omit when unknown. */
    period?: string;
    /** e.g. 'CGPA 7.48'. */
    score?: string;
};

export type Profile = {
    name: string;
    /** Short line under the name, e.g. a role or focus. Empty = not provided yet. */
    headline: string;
    /** Introduction paragraphs for the About page. */
    intro: string[];
    /** Short interest labels, e.g. hobbies or topics. Empty = not provided yet. */
    interests: string[];
    photo: Photo | null;
    /** Chapters shown after the introduction, in order. */
    story?: StorySection[];
    education?: EducationEntry[];
};

export type ProjectLinks = {
    github?: string | null;
    demo?: string | null;
};

export type Project = {
    id: string;
    name: string;
    summary: string;
    role?: string;
    period?: string;
    /** Case study: the problem the project addresses (one or two sentences). */
    problem?: string;
    /** Paragraphs describing the system design. */
    architecture: string[];
    /** Case study: what was built, one point per item. */
    implementation?: string[];
    /** Case study: notable technical decisions, one point per item. */
    decisions?: string[];
    technologies: string[];
    /** Outcomes, ideally measurable. */
    results: string[];
    links: ProjectLinks;
    placeholder?: boolean;
};

export type Experience = {
    id: string;
    role: string;
    organization: string;
    period: string;
    summary?: string;
    responsibilities: string[];
    technologies?: string[];
    /** 'leadership' entries (clubs, positions of responsibility) get their own section. Default: work. */
    kind?: 'work' | 'leadership';
    placeholder?: boolean;
};

/** Stored in two parts and joined at render time to deter simple scrapers. */
export type EmailAddress = {
    user: string;
    domain: string;
};

export type ContactLink = {
    label: string;
    /** Full https:// URL. null = not provided yet. */
    url: string | null;
    /** Optional display text, e.g. a username. Defaults to the URL. */
    handle?: string;
};

export type Contact = {
    email: EmailAddress | null;
    links: ContactLink[];
    /** Optional line shown above the contact list. */
    note?: string;
};

export type Resume = {
    /** Path relative to /desktop/, e.g. 'resume.pdf' for static/desktop/resume.pdf. null = not added yet. */
    file: string | null;
    /** Page images of the same PDF, shown where browsers can't embed a PDF (phones). */
    pages?: string[];
    /** Free text such as 'January 2027'. */
    updated: string | null;
    skills: string[];
};

/** A favourite album shown in the Music app. Nothing is played in the portfolio. */
export type Album = {
    id: string;
    title: string;
    artist: string;
    /** Release year, e.g. 1997. null = not provided yet. */
    year: number | null;
    /** Square cover image relative to /desktop/, e.g. 'albums/ok-computer.jpg'. null = generated cover. */
    cover: string | null;
    /** Link to the album on Spotify (opens in a new tab). null = not provided yet. */
    spotifyUrl: string | null;
    /** Optional personal note about why the album matters to you. */
    note?: string;
    placeholder?: boolean;
};

/**
 * builtin: the original desktop artwork (wallpaper.svg); css: a background
 * drawn in code; image: a static image file under static/desktop/.
 */
export type Wallpaper =
    | { id: string; title: string; kind: 'builtin'; credit?: string }
    | { id: string; title: string; kind: 'css'; css: string; credit?: string }
    | {
          id: string;
          title: string;
          kind: 'image';
          /** e.g. 'wallpapers/lake.jpg' for static/desktop/wallpapers/lake.jpg */
          src: string;
          /** Smaller preview image for the gallery. Defaults to src. */
          thumbnail?: string;
          credit?: string;
      };
