import type { APIRoute, GetStaticPaths } from "astro";
import { cloudflareHeaders, isPreviewBuild } from "../lib/build-mode";

// Writes `dist/_headers` (Cloudflare static asset headers) for preview builds only.
// A dynamic route is used because Astro skips page files whose names start with `_`.
export const getStaticPaths = (() =>
	cloudflareHeaders({ preview: isPreviewBuild() }) === undefined
		? []
		: [{ params: { file: "_headers" } }]) satisfies GetStaticPaths;

export const GET: APIRoute = () =>
	new Response(cloudflareHeaders({ preview: isPreviewBuild() }), {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
