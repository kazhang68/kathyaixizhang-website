# Kathy Zhang / Personal website

A dark, terminal-inspired personal site with an animated rainbow pixel header, resume-based experience, an About section, and a Markdown journal. Built with Astro and deployed as a static site on GitHub Pages. No backend, tracking, or tokens in the browser.

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

Open **Write a post** in the footer. Type or paste Markdown, import a `.md` / `.markdown` file, or drop a file on the editor. A complete pasted post with YAML front matter populates its metadata fields. The body preview is sanitized; draft content stays in browser local storage. Markdown images can still request their source URLs. Don't put private information into public posts.

Fill in the title, description, publication date, and optional comma-separated tags. **Continue on GitHub** opens a new file with the full content prefilled. Review and commit it to `main` using your GitHub account; publishing requires repository write access. Larger posts use **Download .md**, then **Upload on GitHub**, to avoid URL-length limits. Download drafts for a portable backup. No visitor can publish through the editor without GitHub permissions.

Alternatively, create `src/content/blog/your-post.md`:

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

Set `draft: true` to keep a repository-authored post out of the built site (the source is still public in this repository). Importing through the editor prepares a publishable post with `draft: false`. Only title, description, date, and tags are imported. Published posts are ordered by date; future dates are labels, not scheduled publication. The initial welcome entry is starter copy and can be edited or removed.

## Personalizing

- `src/pages/index.astro`: About, experience, and homepage copy.
- `src/lib/site.ts`: contact, social, resume, and repository links.
- `src/components/PixelName.astro`: pixel-letter artwork and reveal animation.
- `src/styles/global.css`: colors, typography, layout, and reduced-motion rules.
- `src/content/blog/`: Markdown entries.

## Hosting

`.github/workflows/deploy.yml` checks, builds, and deploys each push to `main`. In repository **Settings > Pages**, set **Source** to **GitHub Actions**. The site URL is `https://kazhang68.github.io/kathyaixizhang-website/`.

For a custom domain or different repository name, update `site` and `base` in `astro.config.mjs`. All internal links use the shared base-path helper. The resume download points to the original Google document; it must remain publicly accessible. Google Fonts are optional network-loaded enhancements; system fonts are the fallback.