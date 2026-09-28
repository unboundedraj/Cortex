"use client";

import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Toast, useToast } from "@/components/toast";
import { noteEditHref } from "@/lib/routes";

const button =
  "border-border bg-surface hover:bg-surface-hover inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors sm:h-9";

export function NoteActions({
  id,
  title,
  pinned,
}: {
  id: string;
  title: string;
  pinned: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Link href={noteEditHref(id)} prefetch={false} className={button}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Edit
      </Link>
      <button
        type="button"
        // TODO(writes): toggle `pinned` in frontmatter + revalidate "notes".
        onClick={() =>
          toast.show(
            pinned ? "Unpinning is coming soon" : "Pinning is coming soon",
          )
        }
        className={button}
      >
        {pinned ? (
          <PinOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Pin className="h-4 w-4" aria-hidden="true" />
        )}
        {pinned ? "Unpin" : "Pin"}
      </button>
      <button
        ref={deleteRef}
        type="button"
        onClick={() => setConfirmOpen(true)}
        className={`${button} hover:text-danger`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete “${title}”?`}
        description="This will permanently remove the note from your notes repo. (Deleting isn't wired up yet — nothing will actually be deleted.)"
        confirmLabel="Delete note"
        onConfirm={() => {
          // TODO(writes): delete the note, revalidate "notes", go back to the list.
          setConfirmOpen(false);
          toast.show("Deleting notes is coming soon");
        }}
        onCancel={() => setConfirmOpen(false)}
        returnFocus={() => deleteRef.current}
      />
      <Toast message={toast.message} />
    </div>
  );
}
