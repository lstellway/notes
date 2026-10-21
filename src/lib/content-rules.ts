import { isSafeUrl, isUntrustedContent } from "./safety";
import { findTopicRule, type TopicRule, topicRules } from "./topics";

/** The parts of a docs entry these checks read. */
export interface EntryToCheck {
	filePath: string | undefined;
	data: Record<string, unknown>;
}

function isSet(value: unknown): boolean {
	return value !== undefined && value !== null && value !== "";
}

function isNonEmptyObject(value: unknown): boolean {
	return typeof value === "object" && value !== null && Object.keys(value).length > 0;
}

function linkOf(value: unknown): string | undefined {
	if (typeof value !== "object" || value === null) return undefined;
	const link = (value as { link?: unknown }).link;
	return typeof link === "string" ? link : undefined;
}

/** Required fields for the page's topic, e.g. `reviewed` for finance. */
function checkTopicRules(entry: EntryToCheck, rules: readonly TopicRule[]): string[] {
	const rule = findTopicRule(entry.filePath, rules);
	if (!rule) return [];
	return rule.requiredFields
		.filter((field) => !isSet(entry.data[field]))
		.map(
			(field) =>
				`\`${field}\` is required for pages under ${rule.topic}/. Add it to the frontmatter, for example \`${field}: 2026-01-31\`.`,
		);
}

/**
 * Frontmatter fields that Starlight renders as raw HTML, raw attributes, or
 * links. They are blocked or checked in plain Markdown files, which the web
 * editor can change. Use an `.mdx` file if a page really needs them.
 */
function checkUntrustedFrontmatter(entry: EntryToCheck): string[] {
	if (!isUntrustedContent(entry.filePath)) return [];
	const { data } = entry;
	const problems: string[] = [];
	const blocked = (field: string) =>
		problems.push(`\`${field}\` is not allowed in .md files. Use an .mdx file instead.`);

	if (Array.isArray(data.head) && data.head.length > 0) blocked("head");
	if (isSet(data.banner)) blocked("banner");
	if (isSet(data.hero)) blocked("hero");
	if (isNonEmptyObject((data.sidebar as { attrs?: unknown } | undefined)?.attrs)) {
		blocked("sidebar.attrs");
	}
	for (const field of ["prev", "next"] as const) {
		const link = linkOf(data[field]);
		if (link !== undefined && !isSafeUrl(link)) {
			problems.push(`\`${field}.link\` uses a link type that is not allowed.`);
		}
	}
	if (typeof data.editUrl === "string" && !isSafeUrl(data.editUrl)) {
		problems.push("`editUrl` uses a link type that is not allowed.");
	}
	return problems;
}

/** One name per idea: dates use `created`/`updated`, not Starlight's `lastUpdated`. */
function checkFieldNames(entry: EntryToCheck): string[] {
	if (entry.data.lastUpdated instanceof Date) {
		return ["Use `updated` instead of `lastUpdated` to set the updated date."];
	}
	return [];
}

/** Returns a list of problems with an entry's frontmatter. Empty means valid. */
export function checkEntry(
	entry: EntryToCheck,
	rules: readonly TopicRule[] = topicRules,
): string[] {
	return [
		...checkTopicRules(entry, rules),
		...checkUntrustedFrontmatter(entry),
		...checkFieldNames(entry),
	];
}
