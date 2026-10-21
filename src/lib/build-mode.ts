/**
 * Build modes.
 *
 * - `astro build` (mode "production"): the public site. Drafts are left out.
 * - `astro build --mode preview`: pull request previews. Drafts are included
 *   (Starlight includes drafts in every mode except "production") and every
 *   page tells search engines not to index it.
 */
export const PREVIEW_MODE = "preview";

export function isPreviewBuild(mode: string = import.meta.env.MODE): boolean {
	return mode === PREVIEW_MODE;
}

/** Contents of `/robots.txt` for the given build. */
export function robotsTxt({ preview, site }: { preview: boolean; site: URL | undefined }): string {
	if (preview) {
		// Crawlers must be allowed to fetch pages to see their `noindex` tag;
		// a `Disallow` here could still let blocked URLs show up in results.
		return "# Preview build: every page has a noindex robots meta tag.\nUser-agent: *\nAllow: /\n";
	}
	const lines = ["User-agent: *", "Allow: /"];
	if (site) lines.push("", `Sitemap: ${new URL("sitemap-index.xml", site).href}`);
	return `${lines.join("\n")}\n`;
}
