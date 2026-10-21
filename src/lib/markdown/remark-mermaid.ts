import type { Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * Turns ```mermaid code blocks into `<pre class="mermaid">` elements holding
 * the diagram source as text. A client script (`src/scripts/mermaid.ts`)
 * renders them in the browser. Without JavaScript, readers see the source.
 *
 * This runs before syntax highlighting, so Expressive Code leaves diagrams alone.
 */
export function remarkMermaid() {
	return (tree: Root) => {
		visit(tree, "code", (node, index, parent) => {
			if (node.lang !== "mermaid" || !parent || index === undefined) return;
			// A node type unknown to mdast-util-to-hast becomes the element
			// described by `data.hName`, `data.hProperties`, and `data.hChildren`.
			const diagram = {
				type: "mermaidDiagram",
				data: {
					hName: "pre",
					hProperties: { className: ["mermaid"] },
					hChildren: [{ type: "text", value: node.value }],
				},
			};
			parent.children.splice(index, 1, diagram as unknown as (typeof parent.children)[number]);
		});
	};
}
