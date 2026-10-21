/**
 * Checks the web editor's config (`.pages.yml`): that it matches the generator, and
 * that it follows the safety rules.
 *
 * Pages CMS has no config validator to run outside the app, and its server doesn't
 * enforce every setting (see "Security" in README.md). These tests keep the config
 * within the limits the rest of the site relies on.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
import { buildPagesCmsConfig, IMAGE_EXTENSIONS, renderPagesCmsConfig } from "./pages-cms";
import { flattenSections, type Section } from "./sections";
import { topicRules } from "./topics";

interface Field {
	name: string;
	type?: string;
	component?: string;
	required?: boolean;
	options?: Record<string, unknown>;
	[key: string]: unknown;
}

interface ContentEntry {
	name: string;
	label?: string;
	type: "collection" | "file" | "group";
	path?: string;
	filename?: string | { template: string };
	format?: string;
	subfolders?: boolean;
	exclude?: string[];
	operations?: { create?: boolean; delete?: boolean; rename?: boolean };
	fields?: Field[];
	items?: ContentEntry[];
	[key: string]: unknown;
}

interface MediaSource {
	name: string;
	input: string;
	output: string;
	extensions?: string[];
	[key: string]: unknown;
}

interface Config {
	media?: MediaSource[];
	components?: Record<string, Partial<Field>>;
	content?: ContentEntry[];
	settings?: {
		content?: { merge?: boolean };
		commit?: { identity?: string; templates?: Record<string, string> };
	};
	[key: string]: unknown;
}

const RASTER_IMAGES = ["png", "jpg", "jpeg", "webp", "avif", "gif"];
const DOCS_DIR = "src/content/docs";
/** Pages CMS's rule for entry, field, and component names. */
const PAGES_CMS_NAME = /^[a-zA-Z0-9-_]+$/;

const source = readFileSync(new URL("../../.pages.yml", import.meta.url), "utf8");
const document = parseDocument(source);
const config = document.toJSON() as Config;

/** Every collection and file entry, including those inside groups. */
function leafEntries(entries: ContentEntry[] = []): ContentEntry[] {
	return entries.flatMap((entry) => (entry.type === "group" ? leafEntries(entry.items) : [entry]));
}

/** A field with its component's settings filled in, as Pages CMS resolves it. */
function resolveField(field: Field, components = config.components): Field {
	if (!field.component) return field;
	const component = components?.[field.component];
	if (!component) throw new Error(`Unknown component "${field.component}"`);
	return {
		...component,
		...field,
		options: { ...component.options, ...field.options },
	};
}

/** The section folder (path under `src/content/docs/`) a content entry belongs to. */
function sectionOf(entry: ContentEntry): string | undefined {
	const path = entry.path ?? "";
	const folder = entry.type === "file" ? path.replace(/\/[^/]+$/, "") : path;
	return folder.startsWith(`${DOCS_DIR}/`) ? folder.slice(DOCS_DIR.length + 1) : undefined;
}

/** Every value stored under `key` anywhere in the config. */
function findKey(value: unknown, key: string): unknown[] {
	if (Array.isArray(value)) return value.flatMap((item) => findKey(item, key));
	if (typeof value !== "object" || value === null) return [];
	return Object.entries(value).flatMap(([k, v]) => [...(k === key ? [v] : []), ...findKey(v, key)]);
}

const entries = leafEntries(config.content);
const media = config.media ?? [];
const sections = flattenSections();
const editable = sections.filter((section) => section.section.editable);

describe(".pages.yml", () => {
	it("is up to date with the section list (run `pnpm cms:generate`)", () => {
		expect(source).toBe(renderPagesCmsConfig());
	});

	it("is valid YAML with valid, unique names", () => {
		expect(document.errors).toEqual([]);
		expect(entries.length).toBeGreaterThan(0);
		const names = [...entries.map((e) => e.name), ...media.map((m) => m.name)];
		expect(new Set(names).size).toBe(names.length);
		for (const name of [...names, ...Object.keys(config.components ?? {})]) {
			expect(name).toMatch(PAGES_CMS_NAME);
		}
	});

	it("defines no actions (workflow buttons)", () => {
		expect(findKey(config, "actions")).toEqual([]);
	});

	it("keeps content in editable section folders under src/content/docs/", () => {
		const allowed = new Set(editable.map((section) => section.path));
		for (const entry of entries) {
			expect(entry.path, entry.name).toBeTypeOf("string");
			const path = entry.path as string;
			expect(path, entry.name).not.toMatch(/\.\.|\/\/|^\/|\/$/);
			expect(allowed.has(sectionOf(entry) ?? ""), `${entry.name}: ${path}`).toBe(true);
		}
	});

	it("has an overview entry for each editable section, and a collection for each without subsections", () => {
		const files = entries.filter((e) => e.type === "file").map((e) => e.path);
		const collections = entries.filter((e) => e.type === "collection").map((e) => e.path);
		expect(files.sort()).toEqual(editable.map((s) => `${DOCS_DIR}/${s.path}/index.md`).sort());
		expect(collections.sort()).toEqual(
			editable
				.filter((s) => !s.hasSubsections)
				.map((s) => `${DOCS_DIR}/${s.path}`)
				.sort(),
		);
	});

	it("only lists and creates .md files, never .mdx", () => {
		for (const entry of entries) {
			expect(entry.format ?? "yaml-frontmatter", entry.name).toBe("yaml-frontmatter");
			if (entry.type === "collection") {
				// Pages CMS lists and saves only files with the extension of `filename`.
				const filename =
					typeof entry.filename === "string" ? entry.filename : entry.filename?.template;
				expect(filename, entry.name).toMatch(/\.md$/);
			} else {
				expect(entry.type, entry.name).toBe("file");
				expect(entry.path, entry.name).toMatch(/\.md$/);
			}
		}
	});

	it("keeps editors in the section folder, and overview pages out of collections", () => {
		for (const entry of entries.filter((e) => e.type === "collection")) {
			expect(entry.subfolders, `${entry.name} must set subfolders: false`).toBe(false);
			expect(entry.exclude, entry.name).toContain("index.md");
			// Renaming changes the page's address and breaks links to it.
			expect(entry.operations?.rename, entry.name).toBe(false);
		}
	});

	it("names new pages with a lowercase, hyphenated slug of the title", () => {
		for (const entry of entries.filter((e) => e.type === "collection")) {
			expect(entry.filename, entry.name).toBe("{primary}.md");
			expect(entry.fields?.some((field) => field.name === "title")).toBe(true);
		}
	});

	it("saves the body as Markdown", () => {
		for (const entry of entries) {
			const body = entry.fields?.map((f) => resolveField(f)).find((f) => f.name === "body");
			expect(body?.type, entry.name).toBe("rich-text");
			expect(body?.options?.format, entry.name).toBe("markdown");
		}
	});

	it("marks each topic's required fields as required", () => {
		for (const entry of entries) {
			const topic = sectionOf(entry)?.split("/")[0];
			const rule = topicRules.find((r) => r.topic === topic);
			for (const required of rule?.requiredFields ?? []) {
				const field = entry.fields?.map((f) => resolveField(f)).find((f) => f.name === required);
				expect(field?.required, `${entry.name}: ${required}`).toBe(true);
			}
		}
	});

	it("has no draft field on overview pages, which the sidebar links to directly", () => {
		for (const entry of entries.filter((e) => e.type === "file")) {
			expect(
				entry.fields?.map((f) => f.name),
				entry.name,
			).not.toContain("draft");
		}
	});

	it("allows only raster image uploads", () => {
		expect(media.length).toBeGreaterThan(0);
		expect([...IMAGE_EXTENSIONS].sort()).toEqual([...RASTER_IMAGES].sort());
		for (const source of media) {
			// `categories: [image]` would allow SVG, so extensions must be listed instead.
			expect(source.categories, source.name).toBeUndefined();
			expect(source.extensions?.length, source.name).toBeGreaterThan(0);
			for (const extension of source.extensions ?? []) {
				expect(RASTER_IMAGES, `${source.name}: ${extension}`).toContain(extension);
			}
		}
	});

	it("stores each section's images in its own images/ folder, next to its pages", () => {
		expect(media.map((m) => m.input).sort()).toEqual(
			editable.map((s) => `${DOCS_DIR}/${s.path}/images`).sort(),
		);
		for (const source of media) {
			expect(source.input, source.name).not.toMatch(/\.\./);
			// Relative to the pages, so Astro optimizes the images.
			expect(source.output, source.name).toBe("./images");
		}
	});

	it("uploads images only to the entry's own section", () => {
		const inputs = new Map(media.map((source) => [source.name, source.input]));
		for (const entry of entries) {
			for (const field of (entry.fields ?? []).map((f) => resolveField(f))) {
				if (field.type === "image" || field.type === "file" || field.type === "rich-text") {
					const name = field.options?.media;
					expect(name, `${entry.name}.${field.name}`).toBeTypeOf("string");
					expect(inputs.get(name as string), `${entry.name}.${field.name}`).toBe(
						`${DOCS_DIR}/${sectionOf(entry)}/images`,
					);
				}
				// Field-level extensions would override the media source's list.
				expect(field.options?.extensions, `${entry.name}.${field.name}`).toBeUndefined();
				expect(field.options?.categories, `${entry.name}.${field.name}`).toBeUndefined();
			}
		}
	});

	it("credits commits to the editor", () => {
		expect(config.settings?.commit?.identity).toBe("user");
		for (const identity of findKey(config, "identity")) expect(identity).toBe("user");
		const templates = config.settings?.commit?.templates ?? {};
		for (const action of ["create", "update", "delete", "rename"]) {
			expect(templates[action], action).toContain("{userName}");
		}
	});

	it("keeps frontmatter fields that aren't in the form", () => {
		expect(config.settings?.content?.merge).toBe(true);
	});
});

describe("buildPagesCmsConfig", () => {
	const tree: Section[] = [
		{
			folder: "a",
			label: "A",
			editable: true,
			sections: [
				{
					folder: "b",
					label: "B",
					editable: true,
					sections: [{ folder: "c", label: "C", editable: true }],
				},
				{ folder: "x", label: "X", editable: false },
			],
		},
		{ folder: "d", label: "D", editable: false },
	];
	const built = buildPagesCmsConfig(tree, [{ topic: "a", requiredFields: ["reviewed"] }]);

	it("handles nesting: overviews for parents, collections only for sections without subsections", () => {
		expect(built.content.map(({ name, label, type, path }) => [name, label, type, path])).toEqual([
			["a__overview", "A › Overview", "file", `${DOCS_DIR}/a/index.md`],
			["a_b__overview", "A › B › Overview", "file", `${DOCS_DIR}/a/b/index.md`],
			["a_b_c", "A › B › C", "collection", `${DOCS_DIR}/a/b/c`],
			["a_b_c__overview", "A › B › C › Overview", "file", `${DOCS_DIR}/a/b/c/index.md`],
		]);
		expect(built.media.map((m) => [m.name, m.input])).toEqual([
			["a__images", `${DOCS_DIR}/a/images`],
			["a_b__images", `${DOCS_DIR}/a/b/images`],
			["a_b_c__images", `${DOCS_DIR}/a/b/c/images`],
		]);
	});

	it("applies topic rules to every level of the topic", () => {
		for (const entry of built.content) {
			const reviewed = entry.fields.find((f) => f.name === "reviewed");
			expect(reviewed, entry.name).toMatchObject({ required: true });
		}
	});

	it("resolves every field to a shared component", () => {
		for (const entry of built.content) {
			for (const field of entry.fields) {
				expect(Object.keys(built.components), entry.name).toContain(field.component);
			}
		}
	});
});
