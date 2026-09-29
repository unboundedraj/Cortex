"use client";

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table,
  Undo2,
  Unlink,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CODE_LANGUAGES,
  createEditorExtensions,
  markdownToDoc,
} from "@/lib/editor-extensions";

/** Creates the Tiptap editor for a note body. Every keystroke stays local
 * to this editor instance — nothing is saved until the form's Save flow. */
export function useNoteEditor(
  initialMarkdown: string,
  onUpdate: (editor: Editor) => void,
) {
  // Created once: re-creating the extension list on every render would
  // make Tiptap tear down and rebuild the editor.
  const [extensions] = useState(() =>
    createEditorExtensions({ placeholder: "Start writing…" }),
  );
  const [initialDoc] = useState(() => markdownToDoc(initialMarkdown));

  return useEditor({
    extensions,
    content: initialDoc,
    // Required with SSR: the editor only exists in the browser.
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: "markdown-body note-editor-content",
        "aria-label": "Note content",
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor }) => onUpdate(editor),
  });
}

function ToolButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      // Keep focus (and the selection) in the editor: if the button took
      // focus, Tiptap refocuses the editor a frame later and keystrokes
      // typed right after the click are lost. Keyboard users can still Tab
      // to the buttons.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active === undefined ? undefined : active}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-35 ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground/80 hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span aria-hidden="true" className="bg-border mx-1 h-5 w-px shrink-0" />
  );
}

const keepEditorFocus = (event: { preventDefault: () => void }) =>
  event.preventDefault();

const TEXT_BUTTON =
  "hover:bg-surface-hover h-8 shrink-0 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors";

/** Accepts http(s), mailto, and in-app relative links. A bare domain like
 * "example.com" gets https:// added. Returns null for anything else. */
function normalizeHref(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^(?:https?:\/\/|mailto:)/i.test(value)) return value;
  if (value.startsWith("/") || value.startsWith("#")) return value;
  if (/^[\w-]+(\.[\w-]+)+(?:[/?#].*)?$/.test(value)) return `https://${value}`;
  return null;
}

/** What was selected when the link form opened. Captured up front because
 * focus moves to the URL input, and by submit time the editor's live
 * selection can no longer be trusted to still be the user's selection. */
interface LinkTarget {
  from: number;
  to: number;
  existingHref: string;
}

function LinkForm({
  editor,
  target,
  onClose,
}: {
  editor: Editor;
  target: LinkTarget;
  onClose: () => void;
}) {
  const inputId = useId();
  const existing = target.existingHref;
  const [value, setValue] = useState(existing);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const { from, to } = target;

  /** Back to writing: cursor collapsed just after the affected text (so
   * the next keystroke can't overwrite the link) and focus restored now —
   * Tiptap's own focus() is deferred a frame, and anything typed in that
   * gap would be lost. */
  const finish = () => {
    editor.commands.setTextSelection(editor.state.selection.to);
    editor.view.focus();
    onClose();
  };

  const removeLink = () => {
    editor
      .chain()
      .setTextSelection({ from, to })
      .extendMarkRange("link")
      .unsetLink()
      .run();
    finish();
  };

  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      removeLink();
      return;
    }
    const href = normalizeHref(value);
    if (!href) {
      setError("Enter a web address (https://…), mailto:, or a /path.");
      return;
    }
    if (from === to && !existing) {
      // Nothing selected and not inside a link: insert the URL itself as
      // the link text.
      editor
        .chain()
        .setTextSelection(from)
        .insertContent({
          type: "text",
          text: href,
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    } else {
      // Restore the original selection; inside an existing link with no
      // selection, extendMarkRange grows it to the whole link (editing).
      editor
        .chain()
        .setTextSelection({ from, to })
        .extendMarkRange("link")
        .setLink({ href })
        .run();
    }
    finish();
  };

  return (
    <form
      onSubmit={apply}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          editor.view.focus();
        }
      }}
      className="border-border flex flex-wrap items-center gap-2 border-t px-2 py-2"
    >
      <label htmlFor={inputId} className="text-muted text-xs font-medium">
        Link
      </label>
      <input
        id={inputId}
        ref={inputRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        placeholder="https://example.com"
        inputMode="url"
        autoComplete="off"
        className="border-border bg-background h-9 min-w-0 flex-1 rounded-lg border px-2.5 text-sm"
      />
      <button
        type="submit"
        className="bg-accent text-accent-foreground h-9 rounded-lg px-3 text-sm font-medium"
      >
        Apply
      </button>
      {existing && (
        <button
          type="button"
          onClick={removeLink}
          className="hover:bg-surface-hover inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm"
        >
          <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
          Remove
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          onClose();
          editor.view.focus();
        }}
        className="text-muted hover:text-foreground h-9 px-2 text-sm"
      >
        Cancel
      </button>
      {error && (
        <p role="alert" className="text-danger w-full text-xs">
          {error}
        </p>
      )}
    </form>
  );
}

const INITIAL_TOOLBAR_STATE = {
  bold: false,
  italic: false,
  strike: false,
  code: false,
  h1: false,
  h2: false,
  h3: false,
  bulletList: false,
  orderedList: false,
  taskList: false,
  blockquote: false,
  codeBlock: false,
  codeLanguage: "",
  link: false,
  table: false,
  canUndo: false,
  canRedo: false,
};

export function NoteEditor({ editor }: { editor: Editor | null }) {
  const [linkTarget, setLinkTarget] = useState<LinkTarget | null>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            strike: e.isActive("strike"),
            code: e.isActive("code"),
            h1: e.isActive("heading", { level: 1 }),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bulletList: e.isActive("bulletList"),
            orderedList: e.isActive("orderedList"),
            taskList: e.isActive("taskList"),
            blockquote: e.isActive("blockquote"),
            codeBlock: e.isActive("codeBlock"),
            codeLanguage:
              (e.getAttributes("codeBlock").language as string | null) ?? "",
            link: e.isActive("link"),
            table: e.isActive("table"),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });

  if (!editor) {
    return (
      <div className="border-border bg-surface min-h-96 rounded-2xl border" />
    );
  }

  // useEditorState only recomputes on editor transactions, so it can still
  // be null right after the editor is created. The content must render
  // regardless: gating it on `state` deadlocks (no content -> no typing ->
  // no transaction -> state never arrives).
  const s = state ?? INITIAL_TOOLBAR_STATE;

  const openLink = () => {
    // ProseMirror syncs its selection from the browser's `selectionchange`
    // event, which may not have been processed yet (e.g. Shift+Arrow then
    // Ctrl+K in quick succession). Read the browser selection directly and
    // sync it first, so the link wraps exactly what's highlighted.
    const dom = window.getSelection();
    if (
      dom?.anchorNode &&
      dom.focusNode &&
      editor.view.dom.contains(dom.anchorNode) &&
      editor.view.dom.contains(dom.focusNode)
    ) {
      const anchor = editor.view.posAtDOM(dom.anchorNode, dom.anchorOffset);
      const head = editor.view.posAtDOM(dom.focusNode, dom.focusOffset);
      editor.commands.setTextSelection({
        from: Math.min(anchor, head),
        to: Math.max(anchor, head),
      });
    }
    const { from, to } = editor.state.selection;
    setLinkTarget({
      from,
      to,
      existingHref:
        (editor.getAttributes("link").href as string | undefined) ?? "",
    });
  };

  const run = (command: (chain: ReturnType<Editor["chain"]>) => void) => () => {
    const chain = editor.chain().focus();
    command(chain);
  };

  return (
    // No overflow-hidden here: it would stop the toolbar from sticking.
    <div className="note-editor border-border bg-surface rounded-2xl border">
      <div className="bg-surface border-border sticky top-16 z-20 rounded-t-2xl border-b">
        {/* Scrolls sideways on narrow screens rather than wrapping. */}
        <div
          role="toolbar"
          aria-label="Formatting"
          className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5"
        >
          <ToolButton
            label="Undo"
            shortcut="Ctrl+Z"
            disabled={!s.canUndo}
            onClick={run((c) => c.undo().run())}
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Redo"
            shortcut="Ctrl+Shift+Z"
            disabled={!s.canRedo}
            onClick={run((c) => c.redo().run())}
          >
            <Redo2 className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <Divider />
          <ToolButton
            label="Bold"
            shortcut="Ctrl+B"
            active={s.bold}
            onClick={run((c) => c.toggleBold().run())}
          >
            <Bold className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Italic"
            shortcut="Ctrl+I"
            active={s.italic}
            onClick={run((c) => c.toggleItalic().run())}
          >
            <Italic className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Strikethrough"
            shortcut="Ctrl+Shift+S"
            active={s.strike}
            onClick={run((c) => c.toggleStrike().run())}
          >
            <Strikethrough className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Inline code"
            shortcut="Ctrl+E"
            active={s.code}
            onClick={run((c) => c.toggleCode().run())}
          >
            <Code className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Link"
            shortcut="Ctrl+K"
            active={s.link}
            onClick={() => (linkTarget ? setLinkTarget(null) : openLink())}
          >
            <LinkIcon className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <Divider />
          <ToolButton
            label="Heading 1"
            active={s.h1}
            onClick={run((c) => c.toggleHeading({ level: 1 }).run())}
          >
            <Heading1 className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Heading 2"
            active={s.h2}
            onClick={run((c) => c.toggleHeading({ level: 2 }).run())}
          >
            <Heading2 className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Heading 3"
            active={s.h3}
            onClick={run((c) => c.toggleHeading({ level: 3 }).run())}
          >
            <Heading3 className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <Divider />
          <ToolButton
            label="Bullet list"
            active={s.bulletList}
            onClick={run((c) => c.toggleBulletList().run())}
          >
            <List className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            active={s.orderedList}
            onClick={run((c) => c.toggleOrderedList().run())}
          >
            <ListOrdered className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Task list"
            active={s.taskList}
            onClick={run((c) => c.toggleTaskList().run())}
          >
            <ListTodo className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Quote"
            active={s.blockquote}
            onClick={run((c) => c.toggleBlockquote().run())}
          >
            <Quote className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Code block"
            active={s.codeBlock}
            onClick={run((c) => c.toggleCodeBlock().run())}
          >
            <SquareCode className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Insert table"
            active={s.table}
            disabled={s.table}
            onClick={run((c) =>
              c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
            )}
          >
            <Table className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label="Divider line"
            onClick={run((c) => c.setHorizontalRule().run())}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </ToolButton>
        </div>

        {/* Contextual controls — only while the cursor is inside one. */}
        {s.codeBlock && (
          <div className="border-border flex items-center gap-2 border-t px-3 py-1.5">
            <label className="text-muted flex items-center gap-2 text-xs font-medium">
              Language
              <select
                value={s.codeLanguage}
                onChange={(event) =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("codeBlock", {
                      language: event.target.value || null,
                    })
                    .run()
                }
                className="border-border bg-background text-foreground h-8 max-w-48 rounded-md border px-2 text-sm"
              >
                <option value="">Plain text</option>
                {CODE_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {s.table && (
          <div
            role="toolbar"
            aria-label="Table"
            className="border-border flex items-center gap-1 overflow-x-auto border-t px-2 py-1.5"
          >
            <span className="text-muted mr-1 shrink-0 text-xs font-medium">
              Table
            </span>
            <button
              type="button"
              onMouseDown={keepEditorFocus}
              className={TEXT_BUTTON}
              onClick={run((c) => c.addRowAfter().run())}
            >
              + Row
            </button>
            <button
              type="button"
              onMouseDown={keepEditorFocus}
              className={TEXT_BUTTON}
              onClick={run((c) => c.deleteRow().run())}
            >
              − Row
            </button>
            <button
              type="button"
              onMouseDown={keepEditorFocus}
              className={TEXT_BUTTON}
              onClick={run((c) => c.addColumnAfter().run())}
            >
              + Column
            </button>
            <button
              type="button"
              onMouseDown={keepEditorFocus}
              className={TEXT_BUTTON}
              onClick={run((c) => c.deleteColumn().run())}
            >
              − Column
            </button>
            <button
              type="button"
              onMouseDown={keepEditorFocus}
              className={`${TEXT_BUTTON} text-danger`}
              onClick={run((c) => c.deleteTable().run())}
            >
              Delete table
            </button>
          </div>
        )}
        {linkTarget && (
          <LinkForm
            editor={editor}
            target={linkTarget}
            onClose={() => setLinkTarget(null)}
          />
        )}
      </div>

      {/* Mod+K opens the link form; the keydown bubbles up from the
          editable area, so no access to the editor view is needed. */}
      <EditorContent
        editor={editor}
        className="px-4 py-5 sm:px-6"
        onKeyDown={(event) => {
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "k"
          ) {
            event.preventDefault();
            openLink();
          }
        }}
      />
    </div>
  );
}
