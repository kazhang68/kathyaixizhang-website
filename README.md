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

The interface uses monospace typography and an ANSI-inspired palette: cyan links and technologies, yellow labels and roles, purple headings, pink actions, green topics, and orange dates. The header is actual block/shade character art; work icons and journal thumbnails use preformatted ASCII drawings. Decorative art is hidden from screen readers, with real text headings and link labels provided separately.

- `src/pages/index.astro`: About, experience, and homepage copy.
- `src/lib/site.ts`: contact, social, and resume links.
- `src/components/PixelName.astro`: rainbow block-character artwork, left-to-right code decoding, and the decorative blinking caret. Timing is derived from the character delays so the caret appears only after generation completes.
- `src/components/AsciiArt.astro`: shared text drawings for work icons and journal thumbnails.
- `src/styles/global.css`: ANSI palette variables, typography, layout, and reduced-motion rules (static lettering and caret, without the decoding or blink). The banner's per-column rainbow is defined in `PixelName.astro`.
- `src/content/blog/`: Markdown entries.

## Hosting

`.github/workflows/deploy.yml` checks, builds, and deploys each push to `main`. In repository **Settings > Pages**, set **Source** to **GitHub Actions**. The site URL is `https://kazhang68.github.io/kathyaixizhang-website/`.

For a custom domain or different repository name, update `site` and `base` in `astro.config.mjs`. All internal links use the shared base-path helper. The resume download points to the original Google document; it must remain publicly accessible. Google Fonts are optional network-loaded enhancements; system fonts are the fallback.