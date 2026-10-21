import { defineCollection } from "astro:content";
import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";
import { guidesDocsLoader } from "./lib/docs-loader";

/**
 * A date written as a YAML date (`2026-10-20`) or an ISO date string
 * (`"2026-10-20"`, as some editors write it). Anything else is an error.
 */
const date = z.union([z.date(), z.iso.date().transform((value) => new Date(value))]);

export const collections = {
	docs: defineCollection({
		// Also enforces path-based rules, e.g. `reviewed` on finance pages.
		// See src/lib/content-rules.ts.
		loader: guidesDocsLoader(),
		schema: docsSchema({
			extend: z.object({
				/** Optional topic tags. */
				tags: z.array(z.string().trim().min(1)).optional(),
				/** Optional date the page was first published. */
				created: date.optional(),
				/** Overrides the updated date from git history. */
				updated: date.optional(),
				/** Date the content was last checked for accuracy. Required for finance pages. */
				reviewed: date.optional(),
			}),
		}),
	}),
};
