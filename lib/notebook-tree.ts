import type { NotebookSummary } from "@/types/note";

export const UNCATEGORIZED_PATH = "uncategorized";

export interface NotebookNode {
  path: string;
  label: string;
  /** Cumulative: this notebook's own notes plus all descendants'. */
  count: number;
  children: NotebookNode[];
}

export function humanizeSegment(segment: string): string {
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** "study/programming" -> "Study / Programming" */
export function notebookDisplayPath(path: string): string {
  return path.split("/").map(humanizeSegment).join(" / ");
}

/**
 * listNotebooks() only returns folders that directly contain notes, with
 * direct (non-cumulative) counts. This builds the full tree — creating any
 * intermediate folders that hold no notes themselves — and rolls counts up
 * so a parent's count includes every descendant.
 */
export function buildNotebookTree(
  notebooks: NotebookSummary[],
): NotebookNode[] {
  const roots: NotebookNode[] = [];
  const byPath = new Map<string, NotebookNode>();

  for (const notebook of notebooks) {
    const segments = notebook.path.split("/").filter(Boolean);
    let siblings = roots;
    let path = "";
    for (const segment of segments) {
      path = path ? `${path}/${segment}` : segment;
      let node = byPath.get(path);
      if (!node) {
        node = {
          path,
          label: humanizeSegment(segment),
          count: 0,
          children: [],
        };
        byPath.set(path, node);
        siblings.push(node);
      }
      node.count += notebook.count;
      siblings = node.children;
    }
  }

  const byLabel = (a: NotebookNode, b: NotebookNode) =>
    a.label.localeCompare(b.label);
  const sortDeep = (nodes: NotebookNode[]) => {
    nodes.sort(byLabel);
    for (const node of nodes) sortDeep(node.children);
  };
  sortDeep(roots);

  // Uncategorized always last at the root.
  const index = roots.findIndex((node) => node.path === UNCATEGORIZED_PATH);
  if (index !== -1) roots.push(...roots.splice(index, 1));
  return roots;
}

/** "a/b/c" -> ["a", "a/b"] — the ancestors to auto-expand for a selection. */
export function ancestorPaths(path: string): string[] {
  const segments = path.split("/");
  return segments
    .slice(0, -1)
    .map((_, i) => segments.slice(0, i + 1).join("/"));
}
