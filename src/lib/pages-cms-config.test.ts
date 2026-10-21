/**
 * Checks the safety rules for the web editor's config (`.pages.yml`).
 *
 * Pages CMS has no config validator to run outside the app, and its server doesn't
 * enforce every setting (see "Security" in README.md). These tests keep the config
 * within the limits the rest of the site relies on.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
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
	type: "collection" | "file" | "group";
	path?: string;
	filename?: string | { template: string };
	format?: string;
	subfolders?: boolean;
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

const RASTER_IMAGES = ["png", "jpg", "jpeg", "webp", "avif", "gif"];
const DOCS_DIR = "src/content/docs";

const source = readFileSync(new URL("../../.pages.yml", import.meta.url), "utf8");
const document = parseDocument(source);
const config = document.toJSON() as {
	media?: MediaSource[];
	components?: Record<string, Partial<Field>>;
	content?: ContentEntry[];
	settings?: {
		content?: { merge?: boolean };
		commit?: { identity?: string; templates?: Record<string, string> };
	};
	[key: string]: unknown;
};

/** Every collection and file entry, including those inside groups. */
function leafEntries(entries: ContentEntry[] = []): ContentEntry[] {
	return entries.flatMap((entry) => (entry.type === "group" ? leafEntries(entry.items) : [entry]));
}

/** A field with its component's settings filled in, as Pages CMS resolves it. */
function resolveField(field: Field): Field {
	if (!field.component) return field;
	const component = config.components?.[field.component];
	if (!component) throw new Error(`Unknown component "${field.component}"`);
	return {
		...component,
		...field,
		options: { ...component.options, ...field.options },
	};
}

/** The topic folder a content path belongs to, e.g. "finance". */
function topicOf(path: string): string | undefined {
	return /^src\/content\/docs\/([a-z0-9-]+)(?:\/|$)/.exec(path)?.[1];
}

/** Every value stored under `key` anywhere in the config. */
function findKey(value: unknown, key: string): unknown[] {
	if (Array.isArray(value)) return value.flatMap((item) => findKey(item, key));
	if (typeof value !== "object" || value === null) return [];
	return Object.entries(value).flatMap(([k, v]) => [...(k === key ? [v] : []), ...findKey(v, key)]);
}

const entries = leafEntries(config.content);
const media = config.media ?? [];

describe(".pages.yml", () => {
	it("is valid YAML", () => {
		expect(document.errors).toEqual([]);
		expect(entries.length).toBeGreaterThan(0);
	});

	it("defines no actions (workflow buttons)", () => {
		expect(findKey(config, "actions")).toEqual([]);
	});

	it("keeps content in topic folders under src/content/docs/", () => {
		for (const entry of entries) {
			expect(entry.path, entry.name).toBeTypeOf("string");
			const path = entry.path as string;
			expect(path, entry.name).not.toMatch(/\.\.|\/\/|^\/|\/$/);
			expect(topicOf(path), `${entry.name}: ${path}`).toBeDefined();
		}
	});

	it("only lists and creates .md files, never .mdx", () => {
		for (const entry of entries) {
			expect(entry.format ?? "yaml-frontmatter", entry.name).toBe("yaml-frontmatter");
			if (entry.type === "collection") {
				// Pages CMS lists and saves only files with the extension of `filename`.
				const filename =
					typeof entry.filename === "string" ? entry.filename : entry.filename?.template;
				expect(filename, entry.name).toMatch(/\.md$/);
				expect(entry.subfolders, `${entry.name} must set subfolders: false`).toBe(false);
			} else {
				expect(entry.type, entry.name).toBe("file");
				expect(entry.path, entry.name).toMatch(/\.md$/);
			}
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
			const body = entry.fields?.map(resolveField).find((field) => field.name === "body");
			expect(body?.type, entry.name).toBe("rich-text");
			expect(body?.options?.format, entry.name).toBe("markdown");
		}
	});

	it("marks each topic's required fields as required", () => {
		for (const entry of entries) {
			const rule = topicRules.find((r) => r.topic === topicOf(entry.path ?? ""));
			for (const required of rule?.requiredFields ?? []) {
				const field = entry.fields?.map(resolveField).find((f) => f.name === required);
				expect(field?.required, `${entry.name}: ${required}`).toBe(true);
			}
		}
	});

	it("allows only raster image uploads, in topic folders", () => {
		expect(media.length).toBeGreaterThan(0);
		for (const source of media) {
			// `categories: [image]` would allow SVG, so extensions must be listed instead.
			expect(source.categories, source.name).toBeUndefined();
			expect(source.extensions?.length, source.name).toBeGreaterThan(0);
			for (const extension of source.extensions ?? []) {
				expect(RASTER_IMAGES, `${source.name}: ${extension}`).toContain(extension);
			}
			expect(source.input, source.name).not.toMatch(/\.\./);
			expect(topicOf(source.input), source.name).toBeDefined();
			expect(source.input.startsWith(`${DOCS_DIR}/`)).toBe(true);
		}
	});

	it("uploads images only through configured media sources", () => {
		const names = new Set(media.map((source) => source.name));
		for (const entry of entries) {
			for (const field of (entry.fields ?? []).map(resolveField)) {
				if (field.type === "image" || field.type === "file" || field.type === "rich-text") {
					expect(field.options?.media, `${entry.name}.${field.name}`).toBeTypeOf("string");
					expect(names.has(field.options?.media as string)).toBe(true);
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
