import type { NextRequest } from "next/server";
import { getSearchIndex } from "@/lib/search-index";

/**
 * The serialized MiniSearch index, content-addressed by `?v=<hash>`.
 *
 * The page embeds the hash of the index it was rendered with. When `v`
 * matches, the response can never go stale — that URL only ever means this
 * exact content — so it's cached as immutable. When notes change,
 * revalidateTag("notes") rebuilds the index, the page renders a new hash,
 * and the client asks for a new URL. A request with an outdated or missing
 * `v` still gets the current index, but uncached, so nothing is ever
 * stored under a key that doesn't match its content.
 */
export async function GET(request: NextRequest) {
  const { json, version } = await getSearchIndex();
  const requested = request.nextUrl.searchParams.get("v");
  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control":
        requested === version
          ? "public, max-age=31536000, immutable"
          : "no-store",
      "X-Search-Index-Version": version,
    },
  });
}
