import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import { isPreviewBuild } from "./lib/build-mode";

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;

	// A frontmatter `updated` date replaces the date from git history.
	const { updated } = route.entry.data;
	if (updated) route.lastUpdated = updated;

	// Keep preview builds out of search results.
	if (isPreviewBuild()) {
		route.head.push({ tag: "meta", attrs: { name: "robots", content: "noindex, nofollow" } });
	}
});
