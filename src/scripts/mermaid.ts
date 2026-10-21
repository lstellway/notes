/**
 * Renders `<pre class="mermaid">` diagrams (see `remark-mermaid.ts`).
 * Mermaid is large, so it is only downloaded on pages that have a diagram.
 * Diagrams re-render when the reader switches between light and dark themes.
 */
const diagrams = [...document.querySelectorAll<HTMLElement>("pre.mermaid")];
const sources = new Map(diagrams.map((el) => [el, el.textContent ?? ""]));

async function render(): Promise<void> {
	const { default: mermaid } = await import("mermaid");
	for (const [el, source] of sources) {
		el.removeAttribute("data-processed");
		el.textContent = source;
	}
	mermaid.initialize({
		startOnLoad: false,
		// "strict" escapes HTML in labels and disables click handlers.
		securityLevel: "strict",
		theme: document.documentElement.dataset.theme === "dark" ? "dark" : "default",
	});
	await mermaid.run({ nodes: diagrams, suppressErrors: true });
}

if (diagrams.length > 0) {
	void render();
	new MutationObserver(() => void render()).observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});
}
