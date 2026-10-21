import { unified } from "@astrojs/markdown-remark";
import preact from "@astrojs/preact";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import starlightLinksValidator from "starlight-links-validator";
import { rehypeContentSafety } from "./src/lib/markdown/rehype-content-safety";
import { remarkMermaid } from "./src/lib/markdown/remark-mermaid";

export default defineConfig({
	site: "https://guides.stellway.me",
	output: "static",
	markdown: {
		// The remark/rehype pipeline, for math, Mermaid, and HTML cleanup plugins.
		// Starlight adds its own plugins after these.
		processor: unified({
			remarkPlugins: [
				// `$` is common in finance writing, so math needs `$$`:
				// `$$x$$` inside a paragraph is inline; `$$` on its own lines is a block.
				[remarkMath, { singleDollarTextMath: false }],
				remarkMermaid,
			],
			// Content safety must run first, before plugins that add markup.
			rehypePlugins: [rehypeContentSafety, rehypeKatex],
		}),
	},
	integrations: [
		starlight({
			title: "Guides",
			description: "Practical guides, starting with personal finance.",
			// Dates come from git history; frontmatter `updated` overrides them.
			lastUpdated: true,
			editLink: {
				baseUrl: "https://github.com/lstellway/notes/edit/main/",
			},
			social: [{ icon: "github", label: "GitHub", href: "https://github.com/lstellway/notes" }],
			sidebar: [
				{ label: "Finance", items: [{ autogenerate: { directory: "finance" } }] },
				{ label: "Contributing", items: [{ autogenerate: { directory: "contributing" } }] },
			],
			customCss: ["katex/dist/katex.min.css", "./src/styles/custom.css"],
			components: {
				MarkdownContent: "./src/components/MarkdownContent.astro",
			},
			routeMiddleware: "./src/route-middleware.ts",
			// Fails the build on broken internal links.
			plugins: [starlightLinksValidator()],
		}),
		preact(),
	],
});
