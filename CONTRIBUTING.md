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

Contributors who don't use GitHub can sign in to the site's web editor (details to come). Saving creates a pull request that is reviewed the same way. The web editor handles plain articles best. Articles that embed interactive components may need to be edited on GitHub or locally.

## Writing guidelines

- **One topic per note.** Link to related notes instead of repeating them.
- **File placement:** put notes in the folder for their topic, such as `finance/`. Use lowercase, hyphenated file names like `fixed-vs-adjustable-mortgages.md`.
- **Links:** link to other notes with relative links.
- **Frontmatter:** include at least a `title` and a `description`. Tags are optional.
- **Dates:** created and updated dates come from git. Add `created` or `updated` to the frontmatter only to override them, for example after moving a file.
- **Sources:** cite sources for facts, figures, and anything time-sensitive.
- **Finance content:** stick to general education. Avoid personalized advice, and note the date that rates, limits, or rules apply to.

## Interactive components

Components such as calculators live alongside the content. Each one should:

- Work as its own page and also when embedded in an article.
- Explain its assumptions and inputs in plain language.
- Work without JavaScript where practical, or show a clear message when it can't.

## Review checklist

Reviewers check that:

- [ ] The content is accurate, sourced, and in the right topic folder.
- [ ] The preview renders correctly, including diagrams, math, and components.
- [ ] Links work.
- [ ] Titles and descriptions are clear.
