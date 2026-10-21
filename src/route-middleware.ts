import { defineRouteMiddleware } from "@astrojs/starlight/route-data";

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;

	// A frontmatter `updated` date replaces the date from git history.
	const { updated } = route.entry.data;
	if (updated) route.lastUpdated = updated;
});
