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
- **Organization:** topic folders (starting with `finance/`) split into nested section folders (such as `finance/mortgages/`), with cross-links and tags between notes. The section list in `src/lib/sections.ts` builds the sidebar.
- **Interactive tools:** components such as calculators (for example, a mortgage calculator). Each one can be its own page or embedded in an article.
- **Search:** full-text search built into the site, with no server.
- **Rich content:** Mermaid diagrams and LaTeX math.
- **Drafts:** articles marked as drafts appear in previews but not on the public site.
- **Dates:** the updated date comes from git history. A file can set `updated` in its frontmatter (the metadata block at the top) to override git. `created` is an optional frontmatter field.
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
| Site framework | [Astro](https://astro.build) with [Starlight](https://starlight.astro.build), which provides the docs layout, search, drafts, and MDX. Interactive components use [Preact](https://preactjs.com) (React-style code, small download, official Astro integration). |
| Build and deploy | GitHub Actions builds, checks, and deploys. Cloudflare hosts. Actions makes a full clone, so git-based page dates are correct (Cloudflare's own builder makes a shallow clone). Workflows: `CI` (checks and a preview build for every pull request), `Preview`, `Deploy`, and `Content branch`. See [docs/setup.md](docs/setup.md). |
| Hosting | A Cloudflare Worker that serves the built files as static assets, with no server code, on a custom domain (`guides.stellway.me` for now) |
| Infrastructure as code | Not yet. Worker settings live in the repo ([`wrangler.jsonc`](wrangler.jsonc)), and one-time setup steps are in [docs/setup.md](docs/setup.md). Revisit when we add more Cloudflare resources or more admins. |
| Previews | One per pull request, at `pr-<number>-guides.<subdomain>.workers.dev`. The `content` pull request always uses `content-guides.<subdomain>.workers.dev`. Public, but hidden from search engines (robots meta tag and `X-Robots-Tag` header). The deploy runs `main`'s copy of the workflow, so pull request code never runs next to the Cloudflare credentials. Fork pull requests get no preview. |
| Review | Changes merge through pull requests with at least one approval. Checks must pass. |
| Finance disclaimer | Every finance page shows a notice automatically: *"This guide is general education, not financial, tax, or legal advice. Rules and rates change. Last reviewed: {date}."* Finance pages must have a `reviewed` date. |
| Web editor | Hosted [Pages CMS](https://pagescms.org). Collaborators are invited by email and need no GitHub account. Edits are saved to a shared `content` branch, and one pull request from `content` to `main` collects them for review and preview. See [Security](#security). |
| Deploy frequency | Production deploys only when `main` changes, through a GitHub Environment limited to `main`. Several merges in a row collapse into one deploy. Web-editor edits pile up on the `content` branch, so we control deploys by choosing when to merge it. A workflow opens the `content` pull request and updates `content` from `main` after merges. |
| Dependency updates | Dependabot, weekly and grouped, waiting a week after each release. It's built into GitHub, so no extra app gets write access. Actions are pinned to commit SHAs. |
| Licensing | Code: MIT ([LICENSE](LICENSE)). Content: CC BY 4.0 ([LICENSE-CONTENT](LICENSE-CONTENT)). |

## Editing experience

We don't build a custom editor. All edits end in a reviewed pull request, whichever way they are made:

| Who | How |
|---|---|
| Developers | Edit locally with a live dev server |
| Comfortable with GitHub | "Edit page" link → GitHub's web editor |
| Non-technical | Pages CMS: form fields plus a word-processor-style editor, saving to the `content` branch |

## Security

GitHub, not Pages CMS, is the security boundary. A 2026-10 review found that Pages CMS doesn't enforce on its server which branches collaborators can write to or which workflows they can trigger. Its hosted operator can also write to repos where the app is installed. The safeguards below limit the worst case to a bad pull request:

1. **One repo only.** The Pages CMS GitHub App is installed on this repository only.
2. **Protected `main`.** Changes need an approved pull request and passing checks. The app gets no exception.
3. **Owners for sensitive files.** [CODEOWNERS](.github/CODEOWNERS) requires owner review for `.github/`, `.pages.yml`, `scripts/`, dependencies, build config, site code under `src/`, and `.mdx` files. Markdown pages and images in the content folder can be approved by any reviewer.
4. **Secrets only on `main`.** Deploy secrets live in a GitHub Environment limited to `main`. Workflows on other branches get no secrets and read-only access.
5. **No free-form workflow inputs.** No workflow accepts a `payload` input or puts inputs into shell commands.
6. **Tight [`.pages.yml`](.pages.yml).** Generated from the section list (`pnpm cms:generate`). Unit tests check that it is up to date and follows these rules.
   - One collection per editable section (such as `src/content/docs/finance/mortgages/`), limited to that folder. Editors can't create folders or rename pages, and each section's overview page can't be deleted.
   - Raster image uploads only (PNG, JPEG, WebP, AVIF, GIF; no SVG or HTML), saved in the section's `images/` folder.
   - `.md` files, not `.mdx`.
   - No actions (buttons that start workflows), because Pages CMS doesn't check them on its server.
   - `settings.commit.identity: user`, so commits are credited to the real person.
   - The Pages CMS Settings page is hidden, so `.pages.yml` is changed through reviewed pull requests.
7. **HTML cleanup.** The site build removes raw HTML from `.md` files, drops unsafe links such as `javascript:`, and rejects frontmatter fields that would add raw HTML to a page. `.mdx` files can contain code, so they are reviewed as code.

Revisit hosting when the Pages CMS rewrite ships. It fixes several of these issues and adds self-hosting on Cloudflare.

## Open decisions

1. **Site name and domain.** "Guides" on `guides.stellway.me` for now.

## Development

Prerequisites:

- Node.js, at the version in [`.node-version`](.node-version) (the current LTS).
- [pnpm](https://pnpm.io/installation). The version is pinned in `package.json`, and pnpm switches to it automatically.

Commands:

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the dev server at `http://localhost:4321`. Drafts are shown. |
| `pnpm verify` | Run every check CI runs: types (`check`), lint and formatting (`lint`), unit tests (`test`), and the production build (`build`), which also fails on broken internal links or invalid frontmatter |
| `pnpm format` | Fix formatting and import order |
| `pnpm cms:generate` | Regenerate the web editor's config (`.pages.yml`) after changing the section list in `src/lib/sections.ts`. `pnpm test` fails if it is out of date. |
| `pnpm build` | Build the public site into `dist/`. Drafts are left out. |
| `pnpm build:preview` | Build a pull request preview (`astro build --mode preview`). Drafts are included, and every page gets a `noindex` robots tag. |

Build notes for the deploy pipeline:

- Production deploys run `pnpm build`. Previews run `pnpm build:preview`. Nothing else is needed to switch drafts and `noindex`.
- Last-updated dates come from git, so the build needs a full clone (`fetch-depth: 0` in GitHub Actions).
- Preview builds also write `dist/_headers`, which makes Cloudflare send `X-Robots-Tag: noindex` with every file. Production builds don't write it.
- `pnpm exec wrangler deploy --dry-run` checks the Worker config against `dist/` without credentials. Real deploys happen only in GitHub Actions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

- **Code** (site source, components, scripts, configuration) is licensed under the [MIT License](LICENSE).
- **Content** (articles, images, and other written or media content) is licensed under [Creative Commons Attribution 4.0 International](LICENSE-CONTENT) (CC BY 4.0).
