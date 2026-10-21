/**
 * Per-topic rules, keyed by the top-level folder under `src/content/docs/`.
 *
 * To give another topic its own notice or required fields, add an entry to
 * `topicRules`. The content loader enforces `requiredFields` at build time, and
 * the `TopicNotice` component shows `notice` at the top of every page in the topic.
 */

/** Frontmatter fields this site adds to Starlight's schema. */
export interface GuidesFrontmatter {
	tags?: string[];
	created?: Date;
	updated?: Date;
	reviewed?: Date;
}

export interface TopicNotice {
	/** Accessible name for the notice region, e.g. "Disclaimer". */
	label: string;
	/** Builds the notice text from the page's frontmatter. */
	text: (data: GuidesFrontmatter) => string;
}

export interface TopicRule {
	/** Top-level folder under `src/content/docs/`, e.g. "finance". */
	topic: string;
	/** Frontmatter fields every page in this topic must set. */
	requiredFields: readonly (keyof GuidesFrontmatter)[];
	/** Notice shown at the top of every page in this topic. */
	notice?: TopicNotice;
}

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

/** Formats a frontmatter date (YAML dates are midnight UTC) as e.g. "October 20, 2026". */
export function formatDate(date: Date): string {
	return dateFormat.format(date);
}

export const topicRules: readonly TopicRule[] = [
	{
		topic: "finance",
		requiredFields: ["reviewed"],
		notice: {
			label: "Disclaimer",
			text: ({ reviewed }) => {
				if (!reviewed) throw new Error("Finance pages must set a `reviewed` date.");
				return `This guide is general education, not financial, tax, or legal advice. Rules and rates change. Last reviewed: ${formatDate(reviewed)}.`;
			},
		},
	},
];

const DOCS_DIR = "src/content/docs/";

/**
 * Returns a content file's path relative to `src/content/docs/`, or `undefined`
 * if the file is not in that folder. Accepts absolute or project-relative paths.
 *
 * Rules match on the file path rather than the entry id, because frontmatter
 * `slug` can change the id but not where the file lives.
 */
export function docsRelativePath(filePath: string | undefined): string | undefined {
	if (!filePath) return undefined;
	const normalized = filePath.replaceAll("\\", "/");
	const index = normalized.lastIndexOf(DOCS_DIR);
	if (index === -1) return undefined;
	return normalized.slice(index + DOCS_DIR.length);
}

/** Finds the rule for the topic a content file belongs to. */
export function findTopicRule(
	filePath: string | undefined,
	rules: readonly TopicRule[] = topicRules,
): TopicRule | undefined {
	const relative = docsRelativePath(filePath);
	if (!relative?.includes("/")) return undefined;
	const topic = relative.slice(0, relative.indexOf("/")).toLowerCase();
	return rules.find((rule) => rule.topic === topic);
}
