/**
 * Writes `.pages.yml` (the web editor's config) from the section list.
 * Run with `pnpm cms:generate`. See src/lib/pages-cms.ts.
 */
import { writeFileSync } from "node:fs";
import { renderPagesCmsConfig } from "../src/lib/pages-cms.ts";

const target = new URL("../.pages.yml", import.meta.url);
writeFileSync(target, renderPagesCmsConfig());
console.log("Wrote .pages.yml");
