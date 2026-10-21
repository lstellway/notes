# Contributing

> **Draft:** Pull request previews and the web editor start working once the one-time setup in [docs/setup.md](docs/setup.md) is done.

Contributions come from a trusted group of collaborators. Every change goes through a pull request and needs at least one approval before it is published.

## Ways to contribute

### 1. On GitHub (recommended for most edits)

1. Open the page on the site and click **Edit page**. GitHub's web editor opens.
2. Make your changes and choose **Propose changes**. This creates a branch and a pull request.
3. Check the preview link posted on the pull request.
4. A reviewer approves and merges, and the site updates automatically.

### 2. Locally

1. Install Node.js (the version in `.node-version`) and [pnpm](https://pnpm.io/installation).
2. Clone the repository and create a branch.
3. Run `pnpm install`, then `pnpm dev` to start the dev server at `http://localhost:4321`. Pages reload as you edit.
4. Run `pnpm verify` to run the same checks as CI. `pnpm format` fixes formatting.
5. Commit, push, and open a pull request.

Work locally when you are adding interactive components or making changes across many files.

### 3. Web editor

Contributors who don't use GitHub are invited by email to [Pages CMS](https://pagescms.org). Always edit on the `content` branch. Your saves collect there, and they go live after the pull request from `content` to `main` is reviewed and merged. The web editor handles plain articles best. Articles that embed interactive components may need to be edited on GitHub or locally.

## Drafts

Add `draft: true` to an article's frontmatter to merge it without publishing it. Drafts appear locally and in previews, but not on the public site. Remove the flag when the article is ready.

## Writing guidelines

- **One topic per note.** Link to related notes instead of repeating them.
- **File placement:** put notes in `src/content/docs/`, in the folder for their topic, such as `src/content/docs/finance/`. Use lowercase, hyphenated file names like `fixed-vs-adjustable-mortgages.md`.
- **Links:** link to other notes with their path on the site, starting with `/`, like `[Mortgages](/finance/mortgages/)`. The build fails if a link points to a page that doesn't exist.
- **Frontmatter:** include at least a `title` and a `description`. Tags are optional.
- **Dates:** the "Last updated" date on each page comes from git. Add `updated` to the frontmatter only to override it, for example after moving a file. `created` is optional and isn't shown on pages yet.
- **Sources:** cite sources for facts, figures, and anything time-sensitive.
- **Finance content:** stick to general education. Avoid personalized advice, and note the date that rates, limits, or rules apply to. Every finance page must have a `reviewed` date in its frontmatter, or the build fails. The site shows the standard disclaimer automatically, so don't add your own.

### Frontmatter fields

```yaml
---
title: Fixed vs. adjustable mortgages
description: How the two loan types differ and when each makes sense.
tags: [mortgages, loans]
reviewed: 2026-10-20 # required for finance pages
updated: 2026-10-20 # optional, overrides the date from git
created: 2026-09-01 # optional
draft: true # optional, leaves the page off the public site
---
```

Write dates as `YYYY-MM-DD`. Use `updated`, not Starlight's `lastUpdated`. Other [Starlight frontmatter fields](https://starlight.astro.build/reference/frontmatter/) also work, except the ones listed under [HTML](#html).

### Formatting

Pages are Markdown. The site also supports asides (`:::note`), math, and Mermaid diagrams. The formatting reference page ([source](src/content/docs/contributing/formatting.md), `/contributing/formatting/` on the site) shows each one with examples. Two things differ from some other sites:

- **Math** goes between double dollar signs: `$$x^2$$`. A single `$` is plain text, so amounts like $100 are safe.
- **Diagrams** go in a code block marked `mermaid`.

### HTML

Raw HTML is removed from `.md` files when the site builds (the build log names the file and line). This keeps the web editor from being used to add scripts or embeds. Use Markdown syntax instead. In `.md` files, the build also:

- Removes links and images that use unsafe link types such as `javascript:` or `data:`. Allowed: `https:`, `http:`, `mailto:`, `tel:`, and links within the site.
- Rejects the `head`, `banner`, `hero`, and `sidebar.attrs` frontmatter fields, which add raw HTML or attributes to a page.

`.mdx` files can contain HTML and components, so they are reviewed as code.

## Interactive components

Components such as calculators live alongside the content. Each one should:

- Work as its own page and also when embedded in an article.
- Explain its assumptions and inputs in plain language.
- Work without JavaScript where practical, or show a clear message when it can't.

## Licensing of contributions

By contributing, you agree that your contributions are licensed under this project's licenses:

- Code under the [MIT License](LICENSE).
- Content under [CC BY 4.0](LICENSE-CONTENT).

Only contribute material you wrote yourself or that is compatibly licensed, and credit the source in either case.

## Review checklist

Reviewers check that:

- [ ] The content is accurate, sourced, and in the right topic folder.
- [ ] The preview renders correctly, including diagrams, math, and components.
- [ ] Links work.
- [ ] Finance pages have an up-to-date `reviewed` date.
- [ ] Titles and descriptions are clear.
