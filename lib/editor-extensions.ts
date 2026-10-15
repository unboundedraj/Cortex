import { getSchema, type AnyExtension, type JSONContent } from "@tiptap/core";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { Markdown, MarkdownManager } from "@tiptap/markdown";
import { StarterKit } from "@tiptap/starter-kit";
import { all, createLowlight } from "lowlight";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import type { RootContent } from "mdast";

/*
 * Deliberately free of "@/..." imports and "server-only": the editor
 * (client) and the headless markdown round-trip check both import this
 * file, so the two can never drift apart.
 *
 * Syntax highlighting registers lowlight's `all` language set, the same
 * set lib/markdown.ts gives rehype-highlight for the note view. The
 * instances can't be literally shared (rehype-highlight takes a grammar
 * map, not a lowlight instance), but both come from the same `all`.
 */
export const lowlight = createLowlight(all);

export const CODE_LANGUAGES: readonly string[] = lowlight
  .listLanguages()
  .sort();

export function createEditorExtensions({
  placeholder = "",
}: { placeholder?: string } = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      // Replaced by the highlighting variant below.
      codeBlock: false,
      // Markdown has no underline syntax: allowing it would let the editor
      // show formatting that silently disappears on save.
      underline: false,
      // Registered separately below with a behavior change.
      link: false,
    }),
    // Link's `inclusive` normally mirrors `autolink`, which makes text typed
    // right after a link silently become part of it ("docs" + "." ->
    // "docs."). Keep autolink, but stop links growing at their edge.
    Link.extend({ inclusive: () => false }).configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: "https",
    }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    // No toolbar button — this exists so notes that already contain
    // markdown images survive an edit instead of failing to load.
    Image.configure({ inline: true, allowBase64: false }),
    Placeholder.configure({ placeholder }),
    Markdown.configure({ indentation: MARKDOWN_INDENTATION }),
  ];
}

const MARKDOWN_INDENTATION = { style: "space", size: 2 } as const;

/**
 * The markdown parser can emit inline nodes (e.g. an image alone on its own
 * line) directly at the document root, which the schema rejects. Wrap each
 * run of them in a paragraph — exactly how markdown itself renders them.
 */
function wrapRootInlineNodes(
  doc: JSONContent,
  isInline: (type: string) => boolean,
): JSONContent {
  const content: JSONContent[] = [];
  let run: JSONContent[] = [];
  const flush = () => {
    if (run.length) content.push({ type: "paragraph", content: run });
    run = [];
  };
  for (const node of doc.content ?? []) {
    if (node.type && isInline(node.type)) {
      run.push(node);
    } else {
      flush();
      content.push(node);
    }
  }
  flush();
  return { ...doc, content };
}

const markdownAst = unified().use(remarkParse).use(remarkStringify);
const LIST_ITEM_CHILDREN = new Set(["paragraph", "list"]);

/**
 * Tiptap's Markdown parser represents an indented heading in a list item as
 * a heading followed by its inline text. Normalize the mdast tree first so
 * that those blocks are siblings of the list before Tiptap parses it.
 */
function liftUnsupportedListBlocks(nodes: RootContent[]): RootContent[] {
  return nodes.flatMap((node) => {
    if (node.type !== "list") return [node];

    const listItems = [];
    const lifted: RootContent[] = [];
    for (const item of node.children) {
      const firstUnsupported = item.children.findIndex(
        (child) => !LIST_ITEM_CHILDREN.has(child.type),
      );
      if (firstUnsupported < 0) {
        listItems.push(item);
        continue;
      }
      const prefix = item.children.slice(0, firstUnsupported);
      if (prefix.length) listItems.push({ ...item, children: prefix });
      lifted.push(...item.children.slice(firstUnsupported));
    }

    return [
      ...(listItems.length ? [{ ...node, children: listItems }] : []),
      ...lifted,
    ];
  });
}

function normalizeMarkdownTree(markdown: string): string {
  const tree = markdownAst.parse(markdown);
  tree.children = liftUnsupportedListBlocks(tree.children);
  return String(markdownAst.stringify(tree));
}

/** Markdown -> editor document. Shared by the editor and the fidelity
 * check so both parse identically. */
export function markdownToDoc(
  markdown: string,
  extensions: AnyExtension[] = createEditorExtensions(),
): JSONContent {
  const schema = getSchema(extensions);
  const manager = new MarkdownManager({
    extensions,
    indentation: MARKDOWN_INDENTATION,
  });
  const doc = wrapRootInlineNodes(
    manager.parse(normalizeMarkdownTree(markdown)),
    (type) => schema.nodes[type]?.isInline ?? false,
  );
  // An empty note parses to a doc with no children; the schema needs one.
  if (!doc.content?.length) doc.content = [{ type: "paragraph" }];
  // Throws on anything the schema can't hold, rather than letting the
  // editor silently drop it.
  try {
    schema.nodeFromJSON(doc).check();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}\nDocument JSON:\n${JSON.stringify(doc, null, 2)}`,
      { cause: error },
    );
  }
  return doc;
}

/** Validate an editor JSON document with the same schema used by the editor. */
export function checkEditorDocument(doc: JSONContent): void {
  const schema = getSchema(createEditorExtensions());
  schema.nodeFromJSON(doc).check();
}

/** Editor document -> markdown (the note body saved to GitHub). */
export function docToMarkdown(
  doc: JSONContent,
  extensions: AnyExtension[] = createEditorExtensions(),
): string {
  return new MarkdownManager({
    extensions,
    indentation: MARKDOWN_INDENTATION,
  }).serialize(doc);
}
