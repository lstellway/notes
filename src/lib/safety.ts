/**
 * Shared rules for content that is not reviewed as code.
 *
 * Plain Markdown (`.md`) files can be edited through the web editor, so they get
 * the strict treatment: no raw HTML, no unsafe link protocols, and no frontmatter
 * fields that Starlight renders as raw HTML or attributes. MDX (`.mdx`) files can
 * contain code, so they are treated as code and reviewed as such.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Returns true for relative URLs, fragments, and absolute URLs with an allowed
 * protocol. Rejects `javascript:`, `data:`, `vbscript:`, and anything else.
 */
export function isSafeUrl(url: string): boolean {
	// Browsers ignore control characters and whitespace inside a scheme,
	// e.g. "java\tscript:", so strip them before checking.
	// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point.
	const cleaned = url.replace(/[\u0000- \u007f-\u009f]/g, "");
	const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
	if (!scheme?.[1]) return true;
	return ALLOWED_PROTOCOLS.has(`${scheme[1].toLowerCase()}:`);
}

/** Returns true for files that must get the strict treatment (everything except MDX). */
export function isUntrustedContent(filePath: string | undefined): boolean {
	if (!filePath) return true;
	return !/\.mdx$/i.test(filePath);
}
