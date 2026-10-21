# Guides

> "Guides" is a working name. The final site name is still to be decided.

A public knowledge base of practical guides, written and maintained by a trusted group of contributors. It starts with **finance** and will grow to cover other topics over time.

Temporary home: `guides.stellway.me`

## Goals

- **Useful to the public:** clear, accurate, well-organized guides that anyone can find and read.
- **Easy to contribute to:** contributing should take as little effort as possible. Markdown is the main format, and non-technical contributors use a web editor.
- **Interactive where it helps:** tools like calculators sit next to the writing that explains them.
- **Durable and simple:** a static site, with all content in plain files under version control.

## Scope

### In scope

- **Content:** Markdown and MDX files stored in this repository.
- **Organization:** top-level topic folders (starting with `finance/`), with cross-links and tags between notes.
- **Interactive tools:** components such as calculators (for example, a mortgage calculator). Each one can be its own page or embedded in an article.
- **Search:** full-text search built into the site, with no server.
- **Rich content:** Mermaid diagrams and LaTeX math.
- **Drafts:** articles marked as drafts appear in previews but not on the public site.
- **Dates:** created and updated dates come from git history. A file can set them in its frontmatter (the metadata block at the top) to override git.
- **Review:** every change goes through a pull request and needs approval. Each pull request gets a preview deployment.
- **Web editor:** non-technical contributors can edit in the browser from launch.

### Out of scope (for now)

- Logins or member-only content
- Live editing outside of git, and comments
- A graph view of how notes connect
- Multiple languages

## Decisions

| Area | Decision |
|---|---|
| Content format | Markdown / MDX in git |
| Build and deploy | GitHub Actions builds, checks, and deploys. Cloudflare hosts. Actions makes a full clone, so git-based page dates are correct (Cloudflare's own builder makes a shallow clone). |
| Hosting | Cloudflare, on a custom domain (`guides.stellway.me` for now) |
| Infrastructure as code | Not yet. Worker settings will live in the repo (`wrangler.jsonc`), and one-time setup steps will be documented in `docs/setup.md`. Revisit when we add more Cloudflare resources or more admins. |
| Previews | One per pull request. Public, but hidden from search engines. |
| Review | Changes merge through pull requests with at least one approval. Checks must pass. |
| Finance disclaimer | Every finance page shows a notice automatically: *"This guide is general education, not financial, tax, or legal advice. Rules and rates change. Last reviewed: {date}."* Finance pages must have a `reviewed` date. |
| Web editor | Hosted [Pages CMS](https://pagescms.org). Collaborators are invited by email and need no GitHub account. Edits are saved to a shared `content` branch, and one pull request from `content` to `main` collects them for review and preview. See [Security](#security). |
| Deploy frequency | Production deploys only when `main` changes. Web-editor edits pile up on the `content` branch, so we control deploys by choosing when to merge it. |
| Licensing | Code: MIT ([LICENSE](LICENSE)). Content: CC BY 4.0 ([LICENSE-CONTENT](LICENSE-CONTENT)). |

## Editing experience

We don't build a custom editor. All edits end in a reviewed pull request, whichever way they are made:

| Who | How |
|---|---|
| Developers | Edit locally with a live dev server |
| Comfortable with GitHub | "Edit this page" link → GitHub's web editor |
| Non-technical | Pages CMS: form fields plus a word-processor-style editor, saving to the `content` branch |

## Security

GitHub, not Pages CMS, is the security boundary. A 2026-10 review found that Pages CMS doesn't enforce on its server which branches collaborators can write to or which workflows they can trigger. Its hosted operator can also write to repos where the app is installed. The safeguards below limit the worst case to a bad pull request:

1. **One repo only.** The Pages CMS GitHub App is installed on this repository only.
2. **Protected `main`.** Changes need an approved pull request and passing checks. The app gets no exception.
3. **Owners for sensitive files.** CODEOWNERS requires owner review for `.github/`, `.pages.yml`, `package.json`, and build config.
4. **Secrets only on `main`.** Deploy secrets live in a GitHub Environment limited to `main`. Workflows on other branches get no secrets and read-only access.
5. **No free-form workflow inputs.** No workflow accepts a `payload` input or puts inputs into shell commands.
6. **Tight `.pages.yml`.**
   - Specific content folders.
   - Image-only uploads (no SVG or HTML).
   - `.md` files, not `.mdx`.
   - `settings.commit.identity: user`, so commits are credited to the real person.
7. **HTML cleanup.** The site build strips or sanitizes raw HTML in Markdown.

Revisit hosting when the Pages CMS rewrite ships. It fixes several of these issues and adds self-hosting on Cloudflare.

## Open decisions

1. **Site framework.** The leading candidate is [Astro](https://astro.build) with [Starlight](https://starlight.astro.build), which provides docs layout, search, drafts, and MDX. Not decided. Pages CMS works with any framework that reads Markdown files.
2. **Interactive component library.** Tentatively Preact (React-style code, small download, official Astro integration). It depends on the site framework.
3. **Site name and domain.** "Guides" on `guides.stellway.me` for now.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

- **Code** (site source, components, scripts, configuration) is licensed under the [MIT License](LICENSE).
- **Content** (articles, images, and other written or media content) is licensed under [Creative Commons Attribution 4.0 International](LICENSE-CONTENT) (CC BY 4.0).
