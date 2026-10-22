# Kathy Zhang / Personal website

A dark, terminal-inspired personal site with a vivid rainbow text-art header, resume-based experience, an About section, and a Markdown journal. Built with Astro and deployed as a static site on GitHub Pages. No backend, tracking, or tokens in the browser.

## Local development

Use Node.js 22.12+ (24 recommended).

```powershell
npm ci
npm run dev
```

Open `http://localhost:4321/kathyaixizhang-website/`.

```powershell
npm run check
npm run build
npm test
```

The browser tests use the production build. If Chromium isn't installed for Playwright yet, run `npx playwright install chromium` once.

## Writing posts

Posts are published only through GitHub. The website is read-only: there is no public editor, upload form, or browser draft storage.

Open [`src/content/blog/` on GitHub](https://github.com/kazhang68/kathyaixizhang-website/tree/main/src/content/blog) and choose **Add file > Create new file** or **Upload files**. Create a `.md` file such as `your-post.md` with this structure:

```markdown
---
title: "Your post title"
description: "A short description for the listing."
date: 2026-10-19
tags: ["Personal", "Engineering"]
draft: false
---

Your **Markdown** goes here.
```

Choose **Commit changes** to save to `main`. Only repository collaborators with write access can publish directly; GitHub Actions rebuilds and deploys the site after the commit. You can also edit or add Markdown files in a local checkout and push them to GitHub.

Set `draft: true` to keep a post out of the built site (the source is still public in this repository). Published posts are ordered by date; future dates are labels, not scheduled publication. The introductory entry, "About this website," is starter copy and can be edited or removed. Don't include private information in posts: this repository is public.

## Personalizing

Site copy uses factual headings and resume-supported details. The About section has no decorative interest badges. Journal topic buttons filter posts; article topics are shown as plain metadata.

The interface uses monospace typography with mostly white and gray body copy. Titles, all three hero focus areas, profile facts, and small controls use coordinated terminal colors; paragraphs, dates, and tags stay neutral. The experience summary emphasizes financial-reporting systems and concrete, resume-supported accomplishments rather than just listing technologies.

The header spells `kathy zhang` using the original lowercase DOS Rebel FIGlet glyphs and their built-in dotted shading, rather than drawn polygon approximations. A continuous diagonal rainbow and left-to-right decoding animate the letters. The full name stays on one line and scales with the available width. The glyph subset is embedded at build time, with no new dependency or browser font request; attribution and the collection's distribution notice are in [`public/font-credits.txt`](public/font-credits.txt).

The shared header has accessible email, GitHub, and LinkedIn SVG icon links, including on mobile. Their destinations come from `src/lib/site.ts`; the footer no longer repeats social links. Bootstrap Icons attribution and the MIT license are in [`public/icon-credits.txt`](public/icon-credits.txt).

Work illustrations include a four-color waving Windows flag, an infinity loop, and a server rack; journal thumbnails use more detailed preformatted drawings. Decorative art is hidden from screen readers, with real text headings and link labels provided separately.

- `src/pages/index.astro`: About, experience, and homepage copy.
- `src/lib/site.ts`: contact, social, and resume links.
- `src/components/PixelName.astro`: the DOS Rebel lowercase glyph subset, full-name character sequence, diagonal rainbow stops, original dotted shading, left-to-right code decoding, and the decorative blinking caret. Timing includes both face and shadow generation so the caret appears only after the whole illustration completes.
- `src/components/AsciiArt.astro`: shared text drawings for work icons and journal thumbnails.
- `src/lib/text-art.ts`: shared quarter-block and Braille-dot sampling for the work illustrations. All artwork is generated at build time, not drawn with browser JavaScript.
- `src/styles/global.css`: coordinated title/term accents, neutral body typography, layout, and reduced-motion rules (static lettering, shadows, and caret, without the decoding or blink).
- `src/content/blog/`: Markdown entries.

## Hosting

`.github/workflows/deploy.yml` checks, builds, and deploys each push to `main`. In repository **Settings > Pages**, set **Source** to **GitHub Actions**. The site URL is `https://www.katspace.cc/`. Enable **Enforce HTTPS** there once GitHub has issued the custom-domain certificate so HTTP requests and the legacy Pages address redirect to HTTPS. An HTTPS canonical URL alone does not enforce secure connections.

For a custom domain or different repository name, update `site` and `base` in `astro.config.mjs`. All internal links use the shared base-path helper. Google Fonts are optional network-loaded enhancements; system fonts are the fallback.

The prominent **Full resume (PDF)** button in the Work section uses `site.resume` in `src/lib/site.ts`. The introduction has unboxed `> experience` and `> about` command-style links with white labels and prompts matching their destination headings: yellow for Work and cyan for About. The resume button stays in Work. The resume URL exports only the Google document's first tab, named `original` (`tab=t.0`), as a PDF. Keep that tab ID in the URL: omitting it exports all resume versions together. Edits to the original tab are reflected in future downloads without rebuilding the site; the Google document must remain publicly accessible.