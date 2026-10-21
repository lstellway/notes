import type { Element, Root } from "hast";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { isSafeUrl, isUntrustedContent } from "../safety";

/** Elements that never belong in rendered Markdown. */
const BLOCKED_TAGS = new Set([
	"base",
	"embed",
	"form",
	"frame",
	"frameset",
	"iframe",
	"link",
	"meta",
	"object",
	"script",
	"style",
	"template",
]);

/** hast property names that hold URLs. */
const URL_PROPERTIES = new Set([
	"action",
	"background",
	"cite",
	"formAction",
	"href",
	"poster",
	"src",
	"xLinkHref",
]);

export interface ContentSafetyOptions {
	/** Called once per removed piece of raw HTML. Defaults to `console.warn`. */
	report?: (message: string) => void;
}

function cleanProperties(element: Element): void {
	for (const [name, value] of Object.entries(element.properties)) {
		const unsafeHandler = /^on/i.test(name);
		const unsafeUrl = URL_PROPERTIES.has(name) && typeof value === "string" && !isSafeUrl(value);
		if (unsafeHandler || unsafeUrl) delete element.properties[name];
	}
}

/**
 * Removes raw HTML from plain Markdown (`.md`) files, keeping only what
 * Markdown syntax itself produces.
 *
 * Raw HTML in Markdown reaches the HTML tree as `raw` nodes; this plugin drops
 * them all (HTML comments silently, anything else with a warning). As a second
 * layer it also drops blocked elements, `on*` event handler attributes, and
 * links or sources with unsafe protocols such as `javascript:`.
 *
 * MDX files are skipped: they are code and are reviewed as code.
 * Run it as the first rehype plugin so later plugins (KaTeX, Starlight,
 * Expressive Code) work on clean input.
 */
export function rehypeContentSafety(options: ContentSafetyOptions = {}) {
	const report = options.report ?? ((message: string) => console.warn(message));

	return (tree: Root, file: VFile) => {
		if (!isUntrustedContent(file.path)) return;

		visit(tree, (node, index, parent) => {
			if (node.type === "raw") {
				if (parent && index !== undefined) parent.children.splice(index, 1);
				const isComment = /^\s*<!--[\s\S]*-->\s*$/.test(node.value);
				if (!isComment) {
					const line = node.position?.start.line;
					const where = line ? `${file.path}:${line}` : file.path;
					report(`[content-safety] Removed raw HTML from ${where}. Use Markdown syntax instead.`);
				}
				return [SKIP, index];
			}
			if (node.type === "element") {
				if (BLOCKED_TAGS.has(node.tagName)) {
					if (parent && index !== undefined) parent.children.splice(index, 1);
					return [SKIP, index];
				}
				cleanProperties(node);
			}
			return undefined;
		});
	};
}
