import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { checkEditorDocument, markdownToDoc } from "../lib/editor-extensions";

const fixtures = [
  "cpp-note.md",
  "entities.md",
  "inline-code.md",
  "hard-break.md",
  "escaped.md",
  "nested-heading.md",
];

for (const fixture of fixtures) {
  test(`loads ${fixture} without refusal`, async () => {
    const markdown = await readFile(
      new URL(`./fixtures/${fixture}`, import.meta.url),
      "utf8",
    );
    const body = markdown.replace(/^---[\s\S]*?\n---\s*\n/u, "");
    const doc = markdownToDoc(body);
    assert.doesNotThrow(() => checkEditorDocument(doc));
  });
}
