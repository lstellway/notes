import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { VFile } from "vfile";
import { describe, expect, it, vi } from "vitest";
import { rehypeContentSafety } from "./rehype-content-safety";
import { remarkMermaid } from "./remark-mermaid";

/** The same plugin order as astro.config.ts, without Astro and Starlight. */
async function render(markdown: string, path = "src/content/docs/a.md") {
	const report = vi.fn<(message: string) => void>();
	const html = await unified()
		.use(remarkParse)
		.use(remarkMath, { singleDollarTextMath: false })
		.use(remarkMermaid)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeContentSafety, { report })
		.use(rehypeKatex)
		.use(rehypeStringify, { allowDangerousHtml: true })
		.process(new VFile({ value: markdown, path }));
	return { html: String(html), report };
}

describe("rehypeContentSafety", () => {
	it("removes raw HTML blocks and inline HTML from .md files", async () => {
		const { html, report } = await render(
			[
				"Before.",
				"",
				'<script>alert("x")</script>',
				"",
				'Inline <img src=x onerror="alert(1)"> and <span onclick="alert(2)">text</span>.',
				"",
				'<iframe src="https://example.com"></iframe>',
			].join("\n"),
		);
		expect(html).toContain("<p>Before.</p>");
		expect(html).toContain("text");
		expect(html).not.toMatch(/<script|<iframe|<img|<span|onerror|onclick/);
		expect(report).toHaveBeenCalled();
	});

	it("removes HTML comments without a warning", async () => {
		const { html, report } = await render("Text.\n\n<!-- a note for editors -->\n");
		expect(html).not.toContain("<!--");
		expect(report).not.toHaveBeenCalled();
	});

	it("drops unsafe link and image URLs but keeps safe ones", async () => {
		const { html } = await render(
			"[bad](javascript:alert(1)) [good](https://example.com) [page](/finance/) ![img](javascript:x)",
		);
		expect(html).not.toContain("javascript:");
		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('href="/finance/"');
	});

	it("leaves MDX files alone", async () => {
		const { html } = await render("<span>kept</span>", "src/content/docs/a.mdx");
		expect(html).toContain("<span>kept</span>");
	});
});

describe("math", () => {
	it("treats single dollar signs as text", async () => {
		const { html } = await render("It costs $100 or $200.");
		expect(html).toContain("It costs $100 or $200.");
		expect(html).not.toContain("katex");
	});

	it("renders $$ inline and as a block", async () => {
		const { html } = await render("Inline $$x^2$$ here.\n\n$$\ny = mx + b\n$$\n");
		expect(html).toContain('class="katex"');
		expect(html).toContain('class="katex-display"');
	});
});

describe("remarkMermaid", () => {
	it("turns mermaid code blocks into pre.mermaid with escaped source", async () => {
		const { html } = await render("```mermaid\nflowchart LR\n  A[<b>x</b>] --> B\n```\n");
		expect(html).toBe('<pre class="mermaid">flowchart LR\n  A[&#x3C;b>x&#x3C;/b>] --> B</pre>');
	});

	it("leaves other code blocks alone", async () => {
		const { html } = await render("```js\nlet a = 1;\n```\n");
		expect(html).toContain('<code class="language-js">');
	});
});
