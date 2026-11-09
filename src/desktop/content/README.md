# Desktop content

Everything visitors read on the desktop comes from these files. Edit them, and the apps update with no UI changes.

| File | App |
|---|---|
| `profile.ts` | The **About page** (`/about/`, also shown in the desktop's **Who Am I?** browser): photo, headline, introduction and interests. The name and headline also appear in the taskbar and the 3D overlay; the headline falls back to "Portfolio" while empty. |
| `projects.ts` | **Projects**: list and detail (architecture, technologies, results, GitHub/demo links) |
| `experience.ts` | **Experience** timeline |
| `resume.ts` | **Resume**: PDF viewer with Download and Open in new tab |
| `contact.ts` | **Contact**: email and profile links (also listed on the About page) |
| `albums.ts` | **Music**: your favourite albums, each with an optional note and a Spotify link |
| `wallpapers.ts` | **Wallpaper Studio**: the wallpaper gallery |

The field types are documented in `types.ts`.

## Placeholders
- Template entries carry `placeholder: true`, which shows a "Placeholder" tag. Remove the flag once an entry holds real content.
- Empty fields (`''`, `[]`, `null`) show a short hint telling you which file to edit.

## Adding your photo and resume
1. Put the files in `static/desktop/`, which is served at `/desktop/`:
   - `static/desktop/photo.jpg`: a real photograph of you (no AI-generated or AI-edited images). About 800 px on the long edge is plenty.
   - `static/desktop/resume.pdf`: the public version, with **no phone number, home address, date of birth or institutional/employee IDs**.
2. Strip metadata before adding them, for example:
   - `exiftool -all= static/desktop/photo.jpg`
   - `qpdf --remove-info --remove-metadata resume-original.pdf static/desktop/resume.pdf` (qpdf 11+), or re-export the PDF with its document properties cleared
3. Point the content at them:
   - `profile.ts` → `photo: { src: 'photo.jpg', alt: 'Portrait of Surya K' }`
   - `resume.ts` → `file: 'resume.pdf'`
4. Record both files in [ASSETS.md](../../../ASSETS.md).

## Adding albums
1. Edit `albums.ts`. Each album needs `id`, `title`, `artist`, `year`, `cover`, `spotifyUrl` and optionally `note`. Set `placeholder: false` (or delete it) once the entry is real.
2. Cover images are optional: put a square image in `static/desktop/albums/` and set `cover: 'albums/name.jpg'`. Use images you have the right to publish, and list them in ASSETS.md. Without one, an original generated cover is shown.
3. `spotifyUrl` is a normal `https://open.spotify.com/album/...` link. It opens in a new tab; nothing is played, embedded or sent to Spotify from this site.

## Adding wallpapers
1. Put static images (JPG, PNG or WebP; about 2560 px wide is plenty) in `static/desktop/wallpapers/`. Use your own photos or images licensed for redistribution. Optionally add a small thumbnail (about 400 px wide) for the gallery.
2. Add an entry to `wallpapers.ts`: `{ id, title, kind: 'image', src: 'wallpapers/name.jpg', thumbnail?, credit? }`.
3. Record each file in [ASSETS.md](../../../ASSETS.md).

A visitor's choice is saved in their browser (localStorage). `DEFAULT_WALLPAPER_ID` sets the wallpaper first-time visitors see.

## Links
Only `https:`, `http:` and `mailto:` URLs are rendered. Anything else is treated as not provided. External links open in a new tab.
