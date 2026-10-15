import type { Element, Root } from "hast";
import { toString } from "hast-util-to-string";
import { all } from "lowlight";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema, type Options } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

const HEADING_ID_PREFIX = "h-";
const SAFE_ID = /^(?:h-|user-content-)/;
const globalAttributes = (defaultSchema.attributes?.["*"] ?? []).filter(
  (attr) => attr !== "id" && attr !== "name",
);

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

export function renderMarkdown(markdown: string): {
  tree: Root;
  headings: NoteHeading[];
} {
  const tree = processor.runSync(processor.parse(markdown)) as Root;
  const headings: NoteHeading[] = [];
  visit(tree, "element", (node: Element) => {
    if (!["h1", "h2", "h3"].includes(node.tagName)) return;
    const id = node.properties?.id;
    if (typeof id !== "string") return;
    headings.push({
      id,
      text: toString(node),
      depth: Number(node.tagName.slice(1)),
    });
  });
  return { tree, headings };
}
