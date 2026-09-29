import type { NextRequest } from "next/server";
import { getSearchIndex, getSearchTexts } from "@/lib/search-index";

const MAX_IDS = 25;

/**
 * Plain body text for specific notes (?id=a&id=b), fetched lazily by the
 * client only to build snippets for body matches. Cached the same way as
 * the index: immutable when `v` matches the current index hash, uncached
 * otherwise.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ids = params.getAll("id").slice(0, MAX_IDS);
  if (ids.length === 0) {
    return Response.json(
      { error: "Pass one or more ?id= values." },
      { status: 400 },
    );
  }
  const [{ version }, texts] = await Promise.all([
    getSearchIndex(),
    getSearchTexts(ids),
  ]);
  return Response.json(texts, {
    headers: {
      "Cache-Control":
        params.get("v") === version
          ? "public, max-age=31536000, immutable"
          : "no-store",
    },
  });
}
