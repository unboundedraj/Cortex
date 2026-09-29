import "server-only";
import { docToMarkdown, markdownToDoc } from "@/lib/editor-extensions";
import { processMarkdown } from "@/lib/markdown";

export type EditorFidelity =
  | { faithful: true }
  | { faithful: false; parseable: boolean; constructs: string[] };

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
    if (out.type === "text" && !inPre) {
      out.value = String(out.value).replace(/\s+/g, " ").trim();
    }
    return out;
  }
  return node;
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
    console.error(
      "[editor-fidelity] Note could not be loaded into the editor:",
      error,
    );
    return {
      faithful: false,
      parseable: false,
      constructs: detectConstructs(markdown),
    };
  }

  const before = JSON.stringify(normalize(processMarkdown(markdown).tree));
  const after = JSON.stringify(normalize(processMarkdown(roundTripped).tree));
  if (before === after) return { faithful: true };

  return {
    faithful: false,
    parseable: true,
    constructs: detectConstructs(markdown),
  };
}
