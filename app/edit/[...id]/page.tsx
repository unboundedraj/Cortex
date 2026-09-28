import { PlaceholderPage } from "@/components/placeholder-page";
import { decodeNoteId } from "@/lib/routes";

export default async function EditNotePage({
  params,
}: PageProps<"/edit/[...id]">) {
  const id = decodeNoteId((await params).id);
  return (
    <PlaceholderPage eyebrow="Edit note · coming soon" title={id}>
      The editor isn&apos;t built yet.
    </PlaceholderPage>
  );
}
