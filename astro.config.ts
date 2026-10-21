import preact from "@astrojs/preact";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";

export default defineConfig({
	site: "https://guides.stellway.me",
	output: "static",
	integrations: [
		starlight({
			title: "Guides",
			description: "Practical guides, starting with personal finance.",
			// Dates come from git history.
			lastUpdated: true,
			editLink: {
				baseUrl: "https://github.com/lstellway/notes/edit/main/",
			},
			social: [{ icon: "github", label: "GitHub", href: "https://github.com/lstellway/notes" }],
			sidebar: [{ label: "Finance", items: [{ autogenerate: { directory: "finance" } }] }],
			// Fails the build on broken internal links.
			plugins: [starlightLinksValidator()],
		}),
		preact(),
	],
});
