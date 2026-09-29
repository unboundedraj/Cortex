"use client";

import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Toast, useToast } from "@/components/toast";
import {
  describeDeleteFailure,
  requestDelete,
  type WriteFailure,
} from "@/lib/notes-client";
import { noteEditHref } from "@/lib/routes";

const button =
  "border-border bg-surface hover:bg-surface-hover inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors sm:h-9";

export function NoteActions({
  id,
  title,
  pinned,
  sha,
}: {
  id: string;
  title: string;
  pinned: boolean;
  sha: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<WriteFailure | null>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const result = await requestDelete({ id, sha, title });
    if (result.ok) {
      // Full load, deliberately not router.push: the list must come from
      // the freshly revalidated server cache, not the client router's copy.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
      return;
    }
    setDeleting(false);
    setDeleteError(result.error);
  };

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
        onClick={() => {
          setDeleteError(null);
          setConfirmOpen(true);
        }}
        className={`${button} hover:text-danger`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete “${title}”?`}
        description="This permanently removes the note from your notes repo (it stays recoverable from the repo's git history)."
        confirmLabel={deleting ? "Deleting…" : "Delete note"}
        pending={deleting}
        error={
          deleteError && (
            <>
              {describeDeleteFailure(deleteError)}{" "}
              {deleteError.code === "unauthorized" && (
                <Link
                  href={`/login?from=${encodeURIComponent(window.location.pathname)}`}
                  className="underline"
                >
                  Sign in
                </Link>
              )}
            </>
          )
        }
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
        returnFocus={() => deleteRef.current}
      />
      <Toast message={toast.message} />
    </div>
  );
}
