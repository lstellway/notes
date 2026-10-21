# Contributing

> **Draft:** The site and tooling are not set up yet. This describes the intended workflow.

Contributions come from a trusted group of collaborators. Every change goes through a pull request and needs at least one approval before it is published.

## Ways to contribute

### 1. On GitHub (recommended for most edits)

1. Open the page on the site and click **Edit this page**. GitHub's web editor opens.
2. Make your changes and choose **Propose changes**. This creates a branch and a pull request.
3. Check the preview link posted on the pull request.
4. A reviewer approves and merges, and the site updates automatically.

### 2. Locally

1. Clone the repository and create a branch.
2. Install dependencies and run the dev server (commands will be listed here once the site exists).
3. Commit, push, and open a pull request.

Work locally when you are adding interactive components or making changes across many files.

### 3. Web editor

Contributors who don't use GitHub are invited by email to [Pages CMS](https://pagescms.org). Always edit on the `content` branch. Your saves collect there, and they go live after the pull request from `content` to `main` is reviewed and merged. The web editor handles plain articles best. Articles that embed interactive components may need to be edited on GitHub or locally.

## Drafts

Add `draft: true` to an article's frontmatter to merge it without publishing it. Drafts appear locally and in previews, but not on the public site. Remove the flag when the article is ready.

## Writing guidelines

- **One topic per note.** Link to related notes instead of repeating them.
- **File placement:** put notes in the folder for their topic, such as `finance/`. Use lowercase, hyphenated file names like `fixed-vs-adjustable-mortgages.md`.
- **Links:** link to other notes with relative links.
- **Frontmatter:** include at least a `title` and a `description`. Tags are optional.
- **Dates:** created and updated dates come from git. Add `created` or `updated` to the frontmatter only to override them, for example after moving a file.
- **Sources:** cite sources for facts, figures, and anything time-sensitive.
- **Finance content:** stick to general education. Avoid personalized advice, and note the date that rates, limits, or rules apply to. Every finance page must have a `reviewed` date in its frontmatter. The site shows the standard disclaimer automatically, so don't add your own.

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
