import type { Metadata } from "next";
import { NoteEditorForm } from "@/components/note-editor-form";
import { SiteHeader } from "@/components/site-header";
import { listNotebooks, listTags } from "@/lib/notes";

export const metadata: Metadata = { title: "New note · Cortex" };

export default async function NewNotePage() {
  const [notebooks, tags] = await Promise.all([listNotebooks(), listTags()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader wordmark="link" />
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          <NoteEditorForm
            mode="new"
            notebooks={notebooks.filter((nb) => nb.path !== "uncategorized")}
            tagSuggestions={tags.map((t) => t.tag)}
          />
        </div>
      </main>
    </div>
  );
}
