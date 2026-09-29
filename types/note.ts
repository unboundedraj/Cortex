export interface NoteLocation {
  repo: string;
  path: string;
  sha?: string;
}

export interface NoteMeta {
  id: string;
  title: string;
  date: string; // ISO string
  tags: string[];
  notebook: string;
  pinned: boolean;
  /** Git blob sha of the file as read — required to update or delete it,
   * and how a write detects that the file changed since it was loaded. */
  sha: string;
  excerpt: string;
}

export interface Note extends NoteMeta {
  content: string; // markdown body, frontmatter stripped
}

/** One folder that directly contains notes; `count` is NOT cumulative. */
export interface NotebookSummary {
  name: string;
  path: string;
  count: number;
}

export interface TagSummary {
  tag: string;
  count: number;
}
