import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { docsLoader } from "@astrojs/starlight/loaders";
import { AstroError } from "astro/errors";
import type { Loader } from "astro/loaders";
import { checkEntry } from "./content-rules";

/**
 * Starlight's docs loader, plus the checks in `content-rules.ts`.
 *
 * Each entry is first validated against the schema as usual, then checked
 * against rules that depend on where the file lives (e.g. finance pages need
 * `reviewed`). A failed check stops `astro build` with a message naming the file.
 */
export function guidesDocsLoader(): Loader {
	const base = docsLoader();
	return {
		name: "guides-docs-loader",
		load: (context) =>
			base.load({
				...context,
				parseData: async (props) => {
					const data = await context.parseData(props);
					const problems = checkEntry({ filePath: props.filePath, data });
					if (problems.length > 0) {
						const root = fileURLToPath(context.config.root);
						const file = props.filePath ? relative(root, props.filePath) : props.id;
						throw new AstroError(
							`Invalid frontmatter in ${file}:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
							"See CONTRIBUTING.md for the frontmatter fields each page needs.",
						);
					}
					return data;
				},
			}),
	};
}
