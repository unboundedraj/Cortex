"use client";

import { X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

const MAX_TAG_LENGTH = 40;

export function TagInput({
  id,
  tags,
  suggestions,
  onChange,
}: {
  id?: string;
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  const add = (raw: string) => {
    const tag = raw.trim().replace(/^#/, "").slice(0, MAX_TAG_LENGTH);
    if (!tag) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...tags, tag]);
  };

  const commitDraft = () => {
    // Pasting "a, b, c" adds all three.
    draft.split(",").forEach(add);
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && draft === "" && tags.length) {
      event.preventDefault();
      onChange(tags.slice(0, -1));
    }
  };

  const available = suggestions.filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="border-border bg-background focus-within:ring-ring flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border px-2 py-1.5 focus-within:ring-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="bg-surface-hover inline-flex h-7 items-center gap-1 rounded-full pr-1 pl-2.5 text-xs"
        >
          #{tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            aria-label={`Remove tag ${tag}`}
            className="text-muted hover:text-foreground grid h-5 w-5 place-items-center rounded-full"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(event) => {
          const value = event.target.value;
          // Picking a datalist suggestion (not typing the same letters by
          // hand, which would block typing "python3") adds it immediately.
          const inputType = (event.nativeEvent as InputEvent).inputType;
          if (
            inputType === "insertReplacementText" &&
            available.includes(value)
          ) {
            add(value);
            setDraft("");
          } else {
            setDraft(value);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        list={listId}
        placeholder={tags.length ? "" : "Add tags — Enter or comma"}
        autoComplete="off"
        className="h-8 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none"
        aria-describedby={`${listId}-hint`}
      />
      <datalist id={listId}>
        {available.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <span id={`${listId}-hint`} className="sr-only">
        Press Enter or comma to add a tag, Backspace to remove the last one.
      </span>
    </div>
  );
}
