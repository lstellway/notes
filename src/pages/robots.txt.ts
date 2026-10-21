import type { APIRoute } from "astro";
import { isPreviewBuild, robotsTxt } from "../lib/build-mode";

export const GET: APIRoute = ({ site }) =>
	new Response(robotsTxt({ preview: isPreviewBuild(), site }), {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
