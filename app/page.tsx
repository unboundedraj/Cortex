import { HomeClient } from "@/components/home-client";
import { listNotebooks, listNotes, listTags } from "@/lib/notes";

export default async function Home() {
  const [notes, notebooks, tags] = await Promise.all([
    listNotes(),
    listNotebooks(),
    listTags(),
  ]);

  return <HomeClient notes={notes} notebooks={notebooks} tags={tags} />;
}
