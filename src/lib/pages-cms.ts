/**
 * Generates the web editor's config (`.pages.yml`) from the section list.
 *
 * Pages CMS reads `.pages.yml` from the repository, so the generated file is committed.
 * Run `pnpm cms:generate` after changing `src/lib/sections.ts`; a test fails when the
 * committed file is out of date. `pages-cms-config.test.ts` checks the safety rules.
 *
 * Imports use `.ts` extensions so `scripts/cms-generate.ts` can run with plain Node.
 */
import { Document, isMap, isSeq, visit } from "yaml";
import { flattenSections, type ResolvedSection, type Section, sections } from "./sections.ts";
import { type TopicRule, topicRules } from "./topics.ts";

/** Raster images only. `categories: [image]` would also allow SVG. */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "avif", "gif"] as const;

const DOCS_DIR = "src/content/docs";

/** Field definitions shared by every entry (Pages CMS `components`). */
const components = {
	title: { label: "Title", type: "string", required: true },
	description: {
		label: "Description",
		description: "One sentence that sums up the page. Shown in search results.",
		type: "text",
		required: true,
	},
	tags: { label: "Tags", type: "string", list: true },
	draft: {
		label: "Draft",
		description: "Drafts appear in previews but not on the public site.",
		type: "boolean",
	},
	reviewed: {
		label: "Last reviewed",
		description: "The date you last checked this page for accuracy.",
		type: "date",
	},
	updated: {
		label: "Last updated (override)",
		description: "Leave empty. The site uses the date of the last change.",
		type: "date",
	},
	created: { label: "Created", type: "date" },
	body: { label: "Body", type: "rich-text", options: { format: "markdown" } },
} as const;

type FieldName = keyof typeof components;

const pageFields: readonly FieldName[] = [
	"title",
	"description",
	"tags",
	"draft",
	"reviewed",
	"updated",
	"created",
	"body",
];

/**
 * Overview pages have no `draft` field: the sidebar links to them directly, so a
 * draft overview would break the production build.
 */
const overviewFields: readonly FieldName[] = [
	"title",
	"description",
	"tags",
	"reviewed",
	"updated",
	"body",
];

/** Unique Pages CMS names. Folder names never contain `_`, so these can't collide. */
const baseName = (section: ResolvedSection) => section.path.replaceAll("/", "_");
const mediaName = (section: ResolvedSection) => `${baseName(section)}__images`;
const overviewName = (section: ResolvedSection) => `${baseName(section)}__overview`;
const breadcrumb = (labels: readonly string[]) => labels.join(" › ");

function fieldsFor(
	section: ResolvedSection,
	names: readonly FieldName[],
	rules: readonly TopicRule[],
) {
	const topic = section.path.split("/")[0];
	const required = new Set<string>(rules.find((rule) => rule.topic === topic)?.requiredFields);
	return names.map((name) => ({
		name,
		component: name,
		...(required.has(name) ? { required: true } : {}),
		...(name === "body" ? { options: { media: mediaName(section) } } : {}),
	}));
}

function mediaFor(section: ResolvedSection) {
	return {
		name: mediaName(section),
		label: `${breadcrumb(section.labels)} images`,
		input: `${DOCS_DIR}/${section.path}/images`,
		// Relative to the section's pages, so images are written as `./images/<file>`.
		// Astro then optimizes them (files in `public/` are not).
		output: "./images",
		extensions: [...IMAGE_EXTENSIONS],
		// Lowercase, hyphenated file names (this also lowercases `.JPG`).
		rename: "safe",
	};
}

function contentFor(section: ResolvedSection, rules: readonly TopicRule[]) {
	const overview = {
		name: overviewName(section),
		label: breadcrumb([...section.labels, "Overview"]),
		type: "file",
		path: `${DOCS_DIR}/${section.path}/index.md`,
		fields: fieldsFor(section, overviewFields, rules),
	};
	// Pages in a section with subsections belong in a subsection, so there is no
	// collection to add them to.
	if (section.hasSubsections) return [overview];
	const collection = {
		name: baseName(section),
		label: breadcrumb(section.labels),
		type: "collection",
		path: `${DOCS_DIR}/${section.path}`,
		// The page's title as a lowercase, hyphenated slug, e.g. `fixed-vs-adjustable-mortgages.md`.
		filename: "{primary}.md",
		// The overview page is its own entry, so it can't be deleted or renamed.
		exclude: ["index.md"],
		// Editors pick a section; they never create folders.
		subfolders: false,
		// Renaming changes the page's address and breaks links to it.
		operations: { rename: false },
		view: {
			primary: "title",
			fields: ["title", "reviewed", "draft"],
			sort: ["title", "reviewed"],
			default: { sort: "title", order: "asc" },
		},
		fields: fieldsFor(section, pageFields, rules),
	};
	return [collection, overview];
}

/** The `.pages.yml` config as a plain object. */
export function buildPagesCmsConfig(
	list: readonly Section[] = sections,
	rules: readonly TopicRule[] = topicRules,
) {
	const editable = flattenSections(list).filter((section) => section.section.editable);
	return {
		media: editable.map(mediaFor),
		components,
		content: editable.flatMap((section) => contentFor(section, rules)),
		settings: {
			// The Settings page edits this file. Change it in git, where CODEOWNERS applies.
			// (This only hides the page. Pages CMS already lets only GitHub users save it.)
			hide: true,
			// Keep frontmatter fields that aren't in the form (e.g. `sidebar`).
			content: { merge: true },
			commit: {
				// Credit commits to the editor instead of the Pages CMS app.
				identity: "user",
				templates: {
					create: "Create {path} by {userName} (via Pages CMS)",
					update: "Update {path} by {userName} (via Pages CMS)",
					delete: "Delete {path} by {userName} (via Pages CMS)",
					rename: "Rename {oldPath} to {newPath} by {userName} (via Pages CMS)",
				},
			},
		},
	};
}

const HEADER = `# Pages CMS configuration (https://pagescms.org/docs/configuration/).
#
# GENERATED FILE: don't edit. It is built from the section list in src/lib/sections.ts
# by src/lib/pages-cms.ts. Run \`pnpm cms:generate\` after changing either one; a test
# fails when this file is out of date.
#
# Pages CMS doesn't enforce every setting on its server, so GitHub is the security
# boundary (see "Security" in README.md). This file is still kept tight, and
# src/lib/pages-cms-config.test.ts checks the rules below:
#
# - Content: each editable section has an "Overview" entry for its index.md, which
#   can't be deleted or renamed. A section without subsections also has a collection
#   for its other pages, limited to its own folder (no subfolders, no renaming).
#   Only \`.md\` files: Pages CMS lists and saves only files with the extension of
#   \`filename\`, so \`.mdx\` files are never shown or written.
# - Media: raster images only, stored in each section's \`images/\` folder, next to its
#   pages, so Astro optimizes them.
# - Fields: shared definitions in \`components\`. Fields listed in \`topicRules\`
#   (src/lib/topics.ts) are required.
# - No \`actions\` (buttons that start GitHub workflows). Pages CMS doesn't check them on
#   its server.
`;

/** The `.pages.yml` file contents. */
export function renderPagesCmsConfig(
	list: readonly Section[] = sections,
	rules: readonly TopicRule[] = topicRules,
): string {
	const document = new Document(buildPagesCmsConfig(list, rules));
	// Write each field on one line, e.g. `- { name: title, component: title }`.
	visit(document, {
		Pair(_, pair) {
			const key = (pair.key as { value?: unknown } | null)?.value;
			if (key === "fields" && isSeq(pair.value)) {
				for (const item of pair.value.items) if (isMap(item)) item.flow = true;
				// `view.fields` is a list of names.
				if (!pair.value.items.some(isMap)) pair.value.flow = true;
			}
			if ((key === "extensions" || key === "exclude" || key === "sort") && isSeq(pair.value)) {
				pair.value.flow = true;
			}
		},
	});
	return `${HEADER}\n${document.toString({ lineWidth: 0, flowCollectionPadding: false })}`;
}
