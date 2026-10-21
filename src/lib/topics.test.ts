import { describe, expect, it } from "vitest";
import { docsRelativePath, findTopicRule, formatDate, topicRules } from "./topics";

describe("docsRelativePath", () => {
	it("handles project-relative and absolute paths", () => {
		expect(docsRelativePath("src/content/docs/finance/index.md")).toBe("finance/index.md");
		expect(docsRelativePath("/repo/src/content/docs/finance/a/b.md")).toBe("finance/a/b.md");
	});

	it("handles Windows separators", () => {
		expect(docsRelativePath("C:\\repo\\src\\content\\docs\\finance\\a.md")).toBe("finance/a.md");
	});

	it("returns undefined outside the docs folder", () => {
		expect(docsRelativePath("src/pages/index.astro")).toBeUndefined();
		expect(docsRelativePath(undefined)).toBeUndefined();
		expect(docsRelativePath("")).toBeUndefined();
	});
});

describe("findTopicRule", () => {
	it("matches the topic landing page and nested pages", () => {
		expect(findTopicRule("src/content/docs/finance/index.md")?.topic).toBe("finance");
		expect(findTopicRule("src/content/docs/finance/taxes/brackets.md")?.topic).toBe("finance");
	});

	it("matches the folder name exactly", () => {
		expect(findTopicRule("src/content/docs/finance-news/a.md")).toBeUndefined();
		expect(findTopicRule("src/content/docs/finance.md")).toBeUndefined();
	});

	it("ignores pages without a topic", () => {
		expect(findTopicRule("src/content/docs/index.mdx")).toBeUndefined();
		expect(findTopicRule("src/content/docs/cooking/a.md")).toBeUndefined();
		expect(findTopicRule(undefined)).toBeUndefined();
	});

	it("uses the rules it is given", () => {
		const rules = [{ topic: "health", requiredFields: [] }];
		expect(findTopicRule("src/content/docs/health/a.md", rules)?.topic).toBe("health");
		expect(findTopicRule("src/content/docs/finance/a.md", rules)).toBeUndefined();
	});
});

describe("finance notice", () => {
	const notice = findTopicRule("src/content/docs/finance/a.md", topicRules)?.notice;

	it("includes the standard text and the reviewed date", () => {
		expect(notice?.text({ reviewed: new Date("2026-10-20") })).toBe(
			"This guide is general education, not financial, tax, or legal advice. Rules and rates change. Last reviewed: October 20, 2026.",
		);
	});

	it("throws without a reviewed date, so a page can't render without one", () => {
		expect(() => notice?.text({})).toThrow(/reviewed/);
	});
});

describe("formatDate", () => {
	it("formats YAML dates (midnight UTC) without shifting the day", () => {
		expect(formatDate(new Date("2026-01-01"))).toBe("January 1, 2026");
	});
});
