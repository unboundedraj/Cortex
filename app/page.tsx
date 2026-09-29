import { HomeClient } from "@/components/home-client";
import { listNotebooks, listNotes, listTags } from "@/lib/notes";
import { getSearchIndex } from "@/lib/search-index";

export default async function Home() {
  const [notes, notebooks, tags, searchIndex] = await Promise.all([
    listNotes(),
    listNotebooks(),
    listTags(),
    // Only the hash is sent to the page — the index itself is fetched
    // lazily by the client from /api/search-index?v=<hash>.
    getSearchIndex(),
  ]);

  return (
    <HomeClient
      notes={notes}
      notebooks={notebooks}
      tags={tags}
      searchIndexVersion={searchIndex.version}
    />
  );
}
