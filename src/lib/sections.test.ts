import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildSidebar, flattenSections, type Section, sections } from "./sections";

const DOCS_DIR = fileURLToPath(new URL("../content/docs/", import.meta.url));
const PAGE = /\.mdx?$/;

/** Pages (`.md`/`.mdx` files) in each folder under `src/content/docs/`, by relative path. */
function pagesByFolder(dir = DOCS_DIR, relative = ""): Map<string, string[]> {
	const result = new Map<string, string[]>();
	const entries = readdirSync(dir, { withFileTypes: true });
	const pages = entries.filter((e) => e.isFile() && PAGE.test(e.name)).map((e) => e.name);
	if (relative && pages.length > 0) result.set(relative, pages);
	for (const entry of entries.filter((e) => e.isDirectory())) {
		const child = relative ? `${relative}/${entry.name}` : entry.name;
		for (const [path, files] of pagesByFolder(`${dir}${entry.name}/`, child)) {
			result.set(path, files);
		}
	}
	return result;
}

const folders = pagesByFolder();
const resolved = flattenSections();
const isImagesFolder = (path: string) => path.split("/").includes("images");

describe("section list", () => {
	it("uses lowercase, hyphenated folder names, unique among siblings", () => {
		const check = (list: readonly Section[]) => {
			const names = list.map((section) => section.folder);
			expect(new Set(names).size, names.join(", ")).toBe(names.length);
			for (const section of list) {
				expect(section.folder).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
				expect(section.folder, "`images` is reserved for images").not.toBe("images");
				expect(section.label.trim()).not.toBe("");
				check(section.sections ?? []);
			}
		};
		check(sections);
	});

	it("includes every folder that contains pages", () => {
		const listed = new Set(resolved.map((section) => section.path));
		const missing = [...folders.keys()].filter(
			(path) => !listed.has(path) && !isImagesFolder(path),
		);
		expect(missing, "Add these folders to src/lib/sections.ts").toEqual([]);
	});

	it("has a folder with pages for every section", () => {
		const missing = resolved.map((s) => s.path).filter((path) => !folders.has(path));
		expect(missing, "These sections have no pages in src/content/docs/").toEqual([]);
	});

	it("keeps pages out of images folders", () => {
		expect([...folders.keys()].filter(isImagesFolder)).toEqual([]);
	});

	it("gives each section with subsections an overview page and no other pages", () => {
		for (const section of resolved.filter((s) => s.hasSubsections)) {
			const pages = folders.get(section.path) ?? [];
			expect(pages, `${section.path}/ needs an index.md or index.mdx`).toSatisfy(
				(files: string[]) => files.some((file) => /^index\.mdx?$/.test(file)),
			);
			const others = pages.filter((file) => !/^index\.mdx?$/.test(file));
			expect(others, `Move these pages from ${section.path}/ into a subsection`).toEqual([]);
		}
	});
});

describe("flattenSections", () => {
	it("works out paths and labels at any depth", () => {
		const tree: Section[] = [
			{
				folder: "a",
				label: "A",
				sections: [{ folder: "b", label: "B", sections: [{ folder: "c", label: "C" }] }],
			},
		];
		expect(
			flattenSections(tree).map(({ path, labels, hasSubsections }) => [
				path,
				labels,
				hasSubsections,
			]),
		).toEqual([
			["a", ["A"], true],
			["a/b", ["A", "B"], true],
			["a/b/c", ["A", "B", "C"], false],
		]);
	});
});

describe("buildSidebar", () => {
	it("lists the overview and subsections of parents, and the pages of leaves", () => {
		const tree: Section[] = [
			{
				folder: "a",
				label: "A",
				sections: [{ folder: "b", label: "B", sections: [{ folder: "c", label: "C" }] }],
			},
			{ folder: "d", label: "D" },
		];
		expect(buildSidebar(tree)).toEqual([
			{
				label: "A",
				items: [
					{ slug: "a" },
					{
						label: "B",
						items: [
							{ slug: "a/b" },
							{ label: "C", items: [{ autogenerate: { directory: "a/b/c" } }] },
						],
					},
				],
			},
			{ label: "D", items: [{ autogenerate: { directory: "d" } }] },
		]);
	});
});
