# One-time setup

Manual steps to set up hosting and deploys. Do them in order. Worker settings live in [`wrangler.jsonc`](../wrangler.jsonc) and the workflows in [`.github/workflows/`](../.github/workflows/). Nothing here is created automatically.

## How the pipeline works

| Workflow | Runs on | What it does | Secrets |
|---|---|---|---|
| `CI` ([ci.yml](../.github/workflows/ci.yml)) | Every pull request | `Verify` runs `pnpm verify`. `Build preview` runs `pnpm build:preview` and saves the result. | None |
| `Preview` ([preview.yml](../.github/workflows/preview.yml)) | When `CI` finishes | Uploads the saved preview to Cloudflare without deploying it, and keeps one comment on the pull request up to date with the link. | `preview` environment |
| `Deploy` ([deploy.yml](../.github/workflows/deploy.yml)) | Push to `main`, or "Run workflow" | Runs `pnpm verify`, then deploys the production build. | `production` environment |
| `Content branch` ([content-branch.yml](../.github/workflows/content-branch.yml)) | Push to `content` or `main` | Opens the `content` → `main` pull request, and updates `content` from `main` after merges. | None |

Preview links:

- Pull request #12: `https://pr-12-guides.<subdomain>.workers.dev`
- The `content` pull request (web editor): `https://content-guides.<subdomain>.workers.dev`. This link stays the same from one content pull request to the next.
- Pull requests from forks get checks but no preview.

`<subdomain>` is the account's `workers.dev` subdomain. Previews are public, so anyone with the link can see drafts. They are hidden from search engines by a robots meta tag and an `X-Robots-Tag` header.

The `Preview` workflow always runs its copy from `main`, and only uploads files that `CI` built. Code from a pull request never runs where the Cloudflare credentials are. This is also why GitHub only uses changes to `preview.yml` after they merge.

## 1. Cloudflare

### 1.1 Domain

1. The `stellway.me` zone must be active in the Cloudflare account that will host the site.
2. Make sure there is no DNS record for `guides.stellway.me`. The first deploy creates it, and it fails if a record already exists.

### 1.2 workers.dev subdomain

Previews are served from the account's `workers.dev` subdomain. In the dashboard, go to **Workers & Pages** and choose a subdomain if the account doesn't have one yet. Production isn't served there (`workers_dev: false`). It's only served on `guides.stellway.me`.

### 1.3 Account ID

Copy the **Account ID** from the account's overview page. It isn't secret, but it is stored next to the token.

### 1.4 Production API token

**My Profile → API Tokens → Create Token → Create Custom Token** (or an account-owned token under **Manage Account → API Tokens**):

| Permission | Access | Resources |
|---|---|---|
| Account › Workers Scripts | Edit | This account only |
| Zone › Workers Routes | Edit | Zone `stellway.me` only |
| Zone › Zone | Read | Zone `stellway.me` only. **Verify on first deploy:** this lets Wrangler look up the zone for the custom domain. If the first deploy works, try removing it and deploying again. Keep it if the deploy then fails. |

Workers Routes is needed to attach the custom domain, and on later deploys to check it.

### 1.5 Preview API token

Create a second token with only:

| Permission | Access | Resources |
|---|---|---|
| Account › Workers Scripts | Edit | This account only |

Previews never change the custom domain, so this token needs no zone access.

Trade-off: Cloudflare has no permission that allows uploading previews but not deploying. This token could deploy to production too. To limit the risk, it's kept in its own environment that only `main` can use, and only the `Preview` workflow (as it is on `main`) uses it. Keeping it separate from the production token means it can't change the domain, and it can be revoked on its own.

## 2. GitHub

### 2.1 Actions settings

**Settings → Actions → General:**

1. **Workflow permissions:** choose **Read repository contents and packages permissions**. Each workflow asks for anything more it needs.
2. Check **Allow GitHub Actions to create and approve pull requests**. The `Content branch` workflow needs this to open the `content` pull request.
3. **Approval for running fork pull request workflows:** require approval for outside contributors (the default or stricter).

### 2.2 Environments

**Settings → Environments → New environment.** Create both:

| Environment | Deployment branches and tags | Secrets |
|---|---|---|
| `production` | **Selected branches and tags** → `main` | `CLOUDFLARE_API_TOKEN` = production token (1.4), `CLOUDFLARE_ACCOUNT_ID` |
| `preview` | **Selected branches and tags** → `main` | `CLOUDFLARE_API_TOKEN` = preview token (1.5), `CLOUDFLARE_ACCOUNT_ID` |

`preview` is limited to `main` too, because the `Preview` workflow runs from `main`.

Don't add these secrets at the repository level. Then only the jobs that use these environments can read them.

If you add required reviewers to `production` later: a new merge cancels a deploy that is still waiting for approval, and only the newest one needs approving.

### 2.3 Dependabot

**Settings → Advanced Security** (or **Code security**): turn on **Dependabot alerts** and **Dependabot security updates**. Version updates follow [`.github/dependabot.yml`](../.github/dependabot.yml) automatically.

Dependabot's support for pnpm 12 lockfiles is new. Alerts for indirect dependencies may be incomplete ([dependabot-core#15904](https://github.com/dependabot/dependabot-core/issues/15904)). Run `pnpm audit` locally now and then until that is fixed.

## 3. First deploy

1. Merge the pipeline to `main`. The `Deploy` workflow creates the Worker and attaches `guides.stellway.me`. You can also start it from **Actions → Deploy → Run workflow**.
2. Open `https://guides.stellway.me` to confirm.
3. Check the Zone: Read permission (1.4).

Previews only work once the Worker exists and `preview.yml` is on `main`. To check, push a commit to any open pull request.

## 4. Web editor branch

1. Create the `content` branch from `main` (on GitHub: branch menu → type `content` → **Create branch**), and point Pages CMS at it.
2. Each time the `content` pull request is opened, a maintainer may need to select **Approve workflows to run** on it. After that, CI runs on every save. This happens because GitHub holds the first run on pull requests opened by a workflow.
   - To avoid the click, a GitHub App could open the pull request instead of the workflow's own token. That means an app to create and a private key to keep as a secret, so it isn't set up.
3. After a merge, the workflow updates `content` from `main`. Editors always keep their saves. If an update fails because the same lines changed on both branches, a developer fixes it:

   ```sh
   git fetch origin
   git switch content
   git merge origin/main   # resolve conflicts, then commit
   git push
   ```

## 5. Later: protect `main`

Once CI has run at least once, so the checks appear in the picker, add a branch ruleset for `main` (**Settings → Rules → Rulesets**):

- Require a pull request with at least one approval.
- Require these status checks to pass: **`Verify`** and **`Build preview`** (from the `CI` workflow).
- No bypass for the Pages CMS app.

If a job in `ci.yml` is renamed, update the required checks to match.
