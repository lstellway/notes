# Notes

A public knowledge base of practical guides, written and maintained by a trusted group of contributors. It starts with **finance** and will grow to cover other topics over time.

## Goals

- **Useful to the public:** clear, accurate, well-organized guides that anyone can find and read.
- **Easy to contribute to:** Markdown is the main format. Technical contributors use git, and others use a web editor.
- **Interactive where it helps:** tools like calculators sit next to the writing that explains them.
- **Durable and simple:** a static site, with all content in plain files under version control.

## Scope

### In scope

- **Content:** Markdown and MDX files stored in this repository.
- **Organization:** top-level topic folders (starting with `finance/`), with cross-links and tags between notes.
- **Interactive tools:** components such as calculators (for example, a mortgage calculator). Each one can be its own page or embedded in an article.
- **Search:** full-text search built into the site, with no server.
- **Rich content:** Mermaid diagrams and LaTeX math.
- **Dates:** created and updated dates come from git history. A file can set them in its frontmatter (the metadata block at the top) to override git.
- **Review:** every change goes through a pull request and needs approval. Each pull request gets a preview deployment.

### Out of scope (for now)

- Logins or member-only content
- Live editing outside of git, and comments
- A graph view of how notes connect
- Multiple languages

## Stack

| Concern | Choice |
|---|---|
| Framework | [Astro](https://astro.build) with [Starlight](https://starlight.astro.build) |
| Content | Markdown / MDX in git |
| Search | Pagefind (built into Starlight) |
| Hosting | Cloudflare, on a custom domain |
| Web editor | Git-backed CMS (likely [Keystatic](https://keystatic.com)), to be decided |

## Open decisions

1. **Web editor: Keystatic vs. Decap.**
   - **Keystatic** is the nicer editor and fits Astro better, but its editor page runs as a small Cloudflare server function. The public site stays static.
   - **Decap** is fully static but older and clunkier.
   - Neither handles complex MDX components well, so articles that embed tools may still need a GitHub edit.
2. **Finance disclaimers.** Decide whether finance pages carry a standard "not financial advice" notice and a "last reviewed" date.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

See [LICENSE](LICENSE).
