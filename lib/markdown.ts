import "server-only";
import type { Element, Root } from "hast";
import { toString } from "hast-util-to-string";
import { all } from "lowlight";
import { cache } from "react";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema, type Options } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

/** Heading ids are namespaced so a heading like "__next_f" can't become an
 * id that shadows a global (DOM clobbering). GFM footnote ids already get
 * remark-rehype's "user-content-" prefix. */
const HEADING_ID_PREFIX = "h-";
const SAFE_ID = /^(?:h-|user-content-)/;

const globalAttributes = (defaultSchema.attributes?.["*"] ?? []).filter(
  (attr) => attr !== "id" && attr !== "name",
);

/**
 * Runs LAST, over the finished tree, so nothing any plugin emitted skips
 * it. Starts from the GitHub-style default and only widens what the
 * trusted plugins need:
 * - highlight classes on <code>/<span> (rehype-highlight),
 * - ids, restricted to the prefixes above (clobberPrefix is disabled
 *   because it would re-prefix ids unconditionally and break every anchor;
 *   the SAFE_ID pattern does that job instead).
 * Task-list checkboxes (<input type=checkbox disabled>) and the
 * task-list classes are already allowed by the default schema.
 * Raw HTML never reaches this point: remark-rehype runs without
 * allowDangerousHtml, so HTML in a note is dropped at conversion.
 */
export const sanitizeSchema: Options = {
  ...defaultSchema,
  clobberPrefix: "",
  attributes: {
    ...defaultSchema.attributes,
    "*": [...globalAttributes, ["id", SAFE_ID]],
    code: [["className", "hljs", /^language-./]],
    span: [["className", /^hljs-/, /^[a-z]+_{1,2}$/]],
  },
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug, { prefix: HEADING_ID_PREFIX })
  .use(rehypeAutolinkHeadings, { behavior: "wrap" })
  .use(rehypeHighlight, { languages: all, detect: false })
  .use(rehypeSanitize, sanitizeSchema);

export interface NoteHeading {
  id: string;
  text: string;
  depth: number;
}

const HEADING_TAGS = new Set(["h1", "h2", "h3"]);

/** Parsed + sanitized hast for a note body, plus its h1–h3 outline.
 * Wrapped in React's cache() so the page and the renderer share one parse
 * per request. */
export const processMarkdown = cache(
  (markdown: string): { tree: Root; headings: NoteHeading[] } => {
    const tree = processor.runSync(processor.parse(markdown)) as Root;

    const headings: NoteHeading[] = [];
    visit(tree, "element", (node: Element) => {
      if (!HEADING_TAGS.has(node.tagName)) return;
      const id = node.properties?.id;
      if (typeof id !== "string") return;
      headings.push({
        id,
        text: toString(node),
        depth: Number(node.tagName.slice(1)),
      });
    });

    return { tree, headings };
  },
);

const WORDS_PER_MINUTE = 220;

export function readingTimeMinutes(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
