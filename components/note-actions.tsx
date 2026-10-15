"use client";

import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Toast, useToast } from "@/components/toast";
import {
  describeDeleteFailure,
  requestDelete,
  requestTogglePin,
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
  const [currentPinned, setCurrentPinned] = useState(pinned);
  const [currentSha, setCurrentSha] = useState(sha);
  const [pinning, setPinning] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const router = useRouter();

  const togglePin = async () => {
    if (pinning) return;
    const nextPinned = !currentPinned;
    setPinning(true);
    setCurrentPinned(nextPinned);
    const result = await requestTogglePin({
      id,
      pinned: currentPinned,
      sha: currentSha,
    });
    if (!result.ok) {
      setCurrentPinned(!nextPinned);
      setPinning(false);
      toast.show(
        result.error.code === "conflict"
          ? "This note changed elsewhere, refresh and try again"
          : result.error.message,
      );
      if (result.error.code === "conflict") router.refresh();
      return;
    }
    setCurrentSha(result.data.sha);
    setPinning(false);
    router.refresh();
  };

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
        onClick={togglePin}
        disabled={pinning}
        aria-pressed={currentPinned}
        aria-label={currentPinned ? "Unpin note" : "Pin note"}
        className={`${button} disabled:cursor-wait disabled:opacity-60`}
      >
        {currentPinned ? (
          <PinOff
            className="text-accent h-4 w-4 fill-current"
            aria-hidden="true"
          />
        ) : (
          <Pin className="h-4 w-4" aria-hidden="true" />
        )}
        {currentPinned ? "Unpin" : "Pin"}
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
