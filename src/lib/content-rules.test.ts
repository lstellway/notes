import { describe, expect, it } from "vitest";
import { checkEntry } from "./content-rules";

const finance = "src/content/docs/finance/budgeting.md";
const reviewed = new Date("2026-10-20");

describe("topic rules", () => {
	it("requires `reviewed` on finance pages", () => {
		expect(checkEntry({ filePath: finance, data: {} })).toEqual([
			expect.stringContaining("`reviewed` is required for pages under finance/"),
		]);
	});

	it("requires `reviewed` on the finance landing page", () => {
		const problems = checkEntry({ filePath: "src/content/docs/finance/index.md", data: {} });
		expect(problems).toHaveLength(1);
	});

	it("accepts finance pages with `reviewed`", () => {
		expect(checkEntry({ filePath: finance, data: { reviewed } })).toEqual([]);
	});

	it("does not require `reviewed` elsewhere", () => {
		expect(checkEntry({ filePath: "src/content/docs/index.mdx", data: {} })).toEqual([]);
	});

	it("uses the file path, so a custom slug can't skip the rule", () => {
		const data = { slug: "elsewhere/page" };
		expect(checkEntry({ filePath: finance, data })).toHaveLength(1);
	});
});

describe("frontmatter in .md files", () => {
	const md = "src/content/docs/guide.md";
	const mdx = "src/content/docs/guide.mdx";

	it.each([
		["head", { head: [{ tag: "script", content: "alert(1)" }] }],
		["banner", { banner: { content: "<b>hi</b>" } }],
		["hero", { hero: { tagline: "<img onerror=x>" } }],
		["sidebar.attrs", { sidebar: { attrs: { onclick: "x" } } }],
	])("blocks `%s`", (field, data) => {
		expect(checkEntry({ filePath: md, data })).toEqual([
			`\`${field}\` is not allowed in .md files. Use an .mdx file instead.`,
		]);
	});

	it("allows Starlight's empty defaults", () => {
		expect(checkEntry({ filePath: md, data: { head: [], sidebar: { attrs: {} } } })).toEqual([]);
	});

	it("allows these fields in .mdx files", () => {
		const data = { head: [{ tag: "meta" }], hero: { tagline: "x" }, banner: { content: "x" } };
		expect(checkEntry({ filePath: mdx, data })).toEqual([]);
	});

	it("rejects unsafe prev/next links and edit URLs", () => {
		const data = {
			prev: { link: "javascript:alert(1)" },
			next: { link: "/finance/" },
			editUrl: "data:text/html,x",
		};
		expect(checkEntry({ filePath: md, data })).toEqual([
			"`prev.link` uses a link type that is not allowed.",
			"`editUrl` uses a link type that is not allowed.",
		]);
	});
});

describe("field names", () => {
	it("asks for `updated` instead of a `lastUpdated` date", () => {
		const data = { lastUpdated: new Date() };
		expect(checkEntry({ filePath: "src/content/docs/a.md", data })).toEqual([
			"Use `updated` instead of `lastUpdated` to set the updated date.",
		]);
	});

	it("allows `lastUpdated: false` to hide the date", () => {
		expect(checkEntry({ filePath: "src/content/docs/a.md", data: { lastUpdated: false } })).toEqual(
			[],
		);
	});
});
