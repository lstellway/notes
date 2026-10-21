import { describe, expect, it } from "vitest";
import { isPreviewBuild, robotsTxt } from "./build-mode";

describe("isPreviewBuild", () => {
	it("is true only in preview mode", () => {
		expect(isPreviewBuild("preview")).toBe(true);
		expect(isPreviewBuild("production")).toBe(false);
		expect(isPreviewBuild("development")).toBe(false);
	});
});

describe("robotsTxt", () => {
	const site = new URL("https://guides.stellway.me");

	it("points crawlers to the sitemap in production", () => {
		expect(robotsTxt({ preview: false, site })).toBe(
			"User-agent: *\nAllow: /\n\nSitemap: https://guides.stellway.me/sitemap-index.xml\n",
		);
	});

	it("leaves out the sitemap in previews and still allows crawling, so noindex is seen", () => {
		const text = robotsTxt({ preview: true, site });
		expect(text).not.toContain("Sitemap");
		expect(text).not.toContain("Disallow");
	});
});
