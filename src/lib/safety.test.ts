import { describe, expect, it } from "vitest";
import { isSafeUrl, isUntrustedContent } from "./safety";

describe("isSafeUrl", () => {
	it.each([
		"https://example.com",
		"http://example.com",
		"mailto:a@example.com",
		"tel:+15555550100",
		"/finance/",
		"../a/",
		"#section",
		"?q=1",
		"image.png",
	])("allows %s", (url) => {
		expect(isSafeUrl(url)).toBe(true);
	});

	it.each([
		"javascript:alert(1)",
		"JavaScript:alert(1)",
		"  javascript:alert(1)",
		"java\tscript:alert(1)",
		"java\nscript:alert(1)",
		"\u0000javascript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"vbscript:msgbox(1)",
		"file:///etc/passwd",
	])("rejects %j", (url) => {
		expect(isSafeUrl(url)).toBe(false);
	});
});

describe("isUntrustedContent", () => {
	it("treats everything except MDX as untrusted", () => {
		expect(isUntrustedContent("a.md")).toBe(true);
		expect(isUntrustedContent("a.markdown")).toBe(true);
		expect(isUntrustedContent(undefined)).toBe(true);
		expect(isUntrustedContent("a.mdx")).toBe(false);
		expect(isUntrustedContent("A.MDX")).toBe(false);
	});
});
