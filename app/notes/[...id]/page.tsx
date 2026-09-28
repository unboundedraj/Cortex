import { PlaceholderPage } from "@/components/placeholder-page";

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Placeholder. A catch-all segment has to be the last segment of a route,
 * so /notes/<id>/edit can't be its own nested folder here — a trailing
 * "edit" segment is treated as the edit view instead. (This means a note
 * whose own filename is literally "edit" inside a notebook would be
 * ambiguous; revisit when the real routes land.)
 */
export default async function NotePage({
  params,
}: PageProps<"/notes/[...id]">) {
  const segments = (await params).id.map(safeDecode);
  const isEdit = segments.length > 1 && segments.at(-1) === "edit";
  const id = (isEdit ? segments.slice(0, -1) : segments).join("/");

  return isEdit ? (
    <PlaceholderPage eyebrow="Edit note · coming soon" title={id}>
      The editor isn&apos;t built yet.
    </PlaceholderPage>
  ) : (
    <PlaceholderPage eyebrow="Note · coming soon" title={id}>
      The note view is built in the next step. This page just confirms the link
      and id routing work.
    </PlaceholderPage>
  );
}
