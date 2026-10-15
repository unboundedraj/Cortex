import { docToMarkdown, markdownToDoc } from "@/lib/editor-extensions";
import { renderMarkdown } from "@/lib/markdown-pipeline";

export type EditorFidelity =
  | { faithful: true }
  | {
      faithful: false;
      parseable: boolean;
      constructs: string[];
      reason: string;
    };

type Tree = unknown;

/** Strips positions and collapses insignificant whitespace (outside <pre>)
 * so only differences a reader could actually see remain. */
function normalize(node: Tree, inPre = false): Tree {
  if (Array.isArray(node)) {
    return node
      .map((child) => normalize(child, inPre))
      .filter(
        (child) =>
          !(
            (child as { type?: string }).type === "text" &&
            !inPre &&
            (child as { value?: string }).value === ""
          ),
      );
  }
  if (node && typeof node === "object") {
    const source = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const pre = inPre || source.tagName === "pre";
    for (const [key, value] of Object.entries(source)) {
      if (key === "position" || key === "data") continue;
      out[key] = normalize(value, pre);
    }
    if (out.tagName === "li" && Array.isArray(out.children)) {
      out.children = out.children.flatMap((child) => {
        if (
          child &&
          typeof child === "object" &&
          !Array.isArray(child) &&
          (child as { tagName?: string }).tagName === "p"
        ) {
          return (child as { children?: Tree[] }).children ?? [];
        }
        return [child];
      });
    }
    if (out.type === "text") {
      const value = String(out.value)
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+$/gm, "");
      out.value = inPre
        ? value.replace(/\n+$/, "")
        : value.replace(/\s+/g, " ").trim();
    }
    return out;
  }
  return node;
}

function firstDifference(before: Tree, after: Tree): string {
  const beforeChildren =
    before && typeof before === "object" && !Array.isArray(before)
      ? ((before as { children?: Tree[] }).children ?? [])
      : [];
  const afterChildren =
    after && typeof after === "object" && !Array.isArray(after)
      ? ((after as { children?: Tree[] }).children ?? [])
      : [];
  const index = beforeChildren.findIndex(
    (child, childIndex) =>
      JSON.stringify(child) !== JSON.stringify(afterChildren[childIndex]),
  );
  const differingIndex =
    index >= 0 ? index : Math.min(beforeChildren.length, afterChildren.length);
  const summarize = (value: Tree | undefined) => JSON.stringify(value ?? null);
  return `block ${differingIndex + 1}: before ${summarize(
    beforeChildren[differingIndex],
  )}; after ${summarize(afterChildren[differingIndex])}`;
}

function differenceConstructs(before: Tree, after: Tree): string[] {
  const text = `${JSON.stringify(before)} ${JSON.stringify(after)}`;
  const constructs: string[] = [];
  if (/"tagName":"a","properties":\{"href":"(?!#h-)/.test(text))
    constructs.push("links");
  if (/"tagName":"(?:pre|code)"/.test(text)) constructs.push("code");
  if (/"tagName":"(?:table|td|th)"/.test(text)) constructs.push("table cells");
  if (/"tagName":"(?:ul|ol|li)"/.test(text)) constructs.push("list structure");
  if (!constructs.length) constructs.push("visible text");
  return constructs;
}

/** Best-effort names for what's likely to be lost, for the warning text. */
function detectConstructs(markdown: string): string[] {
  const found: string[] = [];
  if (/\[\^[^\]\s]+\]/.test(markdown)) found.push("footnotes");
  if (/<\/?[a-zA-Z][\w-]*(?:\s[^>]*)?>/.test(markdown)) found.push("raw HTML");
  return found;
}

/**
 * Would opening this note in the editor and saving it unchanged alter how
 * it renders? Runs the exact editor parse/serialize path and compares the
 * note view's rendered output before and after.
 */
export function checkEditorFidelity(markdown: string): EditorFidelity {
  let roundTripped: string;
  try {
    roundTripped = docToMarkdown(markdownToDoc(markdown));
  } catch (error) {
    const diagnostic =
      error instanceof Error
        ? [error.name + ": " + error.message, error.stack]
            .filter(Boolean)
            .join("\n")
        : "The editor rejected this note while loading it.";
    console.error(
      "[editor-fidelity] Note could not be loaded into the editor:",
      diagnostic,
    );
    return {
      faithful: false,
      parseable: false,
      constructs: detectConstructs(markdown),
      reason: diagnostic,
    };
  }

  const beforeTree = normalize(renderMarkdown(markdown).tree);
  const afterTree = normalize(renderMarkdown(roundTripped).tree);
  if (JSON.stringify(beforeTree) === JSON.stringify(afterTree)) {
    return { faithful: true };
  }

  const constructs = differenceConstructs(beforeTree, afterTree);
  const reason = firstDifference(beforeTree, afterTree);
  console.error(
    "[editor-fidelity] Rendered markdown differs after round-trip:",
    {
      constructs,
      reason,
    },
  );

  return {
    faithful: false,
    parseable: true,
    constructs: [...new Set([...constructs, ...detectConstructs(markdown)])],
    reason,
  };
}
