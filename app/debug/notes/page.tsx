import { getNote, listNotebooks, listNotes, listTags } from "@/lib/notes";

function Section({ title, data }: { title: string; data: unknown }) {
  return (
    <section className="border-border border-b pb-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <pre className="bg-code-background overflow-x-auto rounded-lg p-4 text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}

export default async function DebugNotesPage() {
  const [notes, notebooks, tags] = await Promise.all([
    listNotes(),
    listNotebooks(),
    listTags(),
  ]);
  const firstNote = notes[0] ? await getNote(notes[0].id) : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="font-heading text-2xl font-bold">Notes debug output</h1>
        <p className="text-muted mt-1 text-sm">
          Temporary verification page — delete once the real UI reads this data.
        </p>
      </div>

      <Section title={`listNotes() — ${notes.length} note(s)`} data={notes} />
      <Section
        title={`listNotebooks() — ${notebooks.length} notebook(s)`}
        data={notebooks}
      />
      <Section title={`listTags() — ${tags.length} tag(s)`} data={tags} />
      <Section
        title={`getNote(${notes[0] ? JSON.stringify(notes[0].id) : "…"})`}
        data={firstNote}
      />
    </div>
  );
}
