import "server-only";
import type { Element } from "hast";
import { toString } from "hast-util-to-string";
import { toJsxRuntime, type Components } from "hast-util-to-jsx-runtime";
import type { ComponentProps } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { CopyButton } from "@/components/copy-button";
import { processMarkdown } from "@/lib/markdown";

type WithNode<T> = T & { node?: Element };

function codeLanguage(pre: Element | undefined): string | null {
  const code = pre?.children.find(
    (child): child is Element =>
      child.type === "element" && child.tagName === "code",
  );
  const classes = code?.properties?.className;
  if (!Array.isArray(classes)) return null;
  const languageClass = classes.find(
    (c): c is string => typeof c === "string" && c.startsWith("language-"),
  );
  return languageClass ? languageClass.slice("language-".length) : null;
}

function CodeBlock({
  node,
  children,
  ...rest
}: WithNode<ComponentProps<"pre">>) {
  const language = codeLanguage(node);
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language ?? "plain text"}</span>
        <CopyButton text={node ? toString(node).replace(/\n$/, "") : ""} />
      </div>
      <pre {...rest}>{children}</pre>
    </div>
  );
}

function Table({ node: _node, ...rest }: WithNode<ComponentProps<"table">>) {
  return (
    <div className="table-scroll">
      <table {...rest} />
    </div>
  );
}

function Anchor({ node: _node, href, ...rest }: WithNode<ComponentProps<"a">>) {
  const external = typeof href === "string" && /^https?:\/\//i.test(href);
  return external ? (
    <a {...rest} href={href} target="_blank" rel="noopener noreferrer" />
  ) : (
    <a {...rest} href={href} />
  );
}

/** GFM task-list checkboxes are static (disabled); rendering them as
 * uncontrolled avoids React's "checked without onChange" warning. */
function Input({
  node: _node,
  checked,
  ...rest
}: WithNode<ComponentProps<"input">>) {
  return <input {...rest} defaultChecked={checked} />;
}

const components = {
  pre: CodeBlock,
  table: Table,
  a: Anchor,
  input: Input,
} as Partial<Components>;

/**
 * Server component: parsing, highlighting and sanitizing all happen on the
 * server, so none of the markdown libraries ship to the browser — only the
 * small CopyButton client component does.
 */
export function MarkdownRenderer({ markdown }: { markdown: string }) {
  const { tree } = processMarkdown(markdown);
  return (
    <div className="markdown-body">
      {toJsxRuntime(tree, {
        Fragment,
        jsx,
        jsxs,
        passNode: true,
        components,
      })}
    </div>
  );
}
