import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { checkEditorDocument, markdownToDoc } from "../lib/editor-extensions";
import { editPinnedFrontmatter } from "../lib/frontmatter";

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

test("edits only pinned frontmatter and preserves the body", () => {
  const body = "## Heading\r\n\r\nC++ body\r\n";
  const raw = `---\r\ntitle: C++\r\ncustom: keep\r\ntags: [cpp]\r\n---\r\n\r\n${body}`;
  const edited = editPinnedFrontmatter(raw, true);
  assert.equal(edited.title, "C++");
  assert.equal(
    edited.raw,
    `---\r\ntitle: C++\r\ncustom: keep\r\ntags: [cpp]\r\npinned: true\r\n---\r\n\r\n${body}`,
  );
  assert.equal(edited.raw.endsWith(body), true);
});

test("updates an existing pinned key without changing key order", () => {
  const raw =
    "---\ntitle: Note\ndate: 2026-01-01\npinned: true\ncustom: x\n---\n\nBody";
  assert.equal(editPinnedFrontmatter(raw, true).raw, raw);
  const edited = editPinnedFrontmatter(raw, false);
  assert.equal(
    edited.raw,
    "---\ntitle: Note\ndate: 2026-01-01\npinned: false\ncustom: x\n---\n\nBody",
  );
});

test("creates frontmatter only when pinning a file without frontmatter", () => {
  const raw = "Body\nwith a second line";
  assert.equal(editPinnedFrontmatter(raw, false).raw, raw);
  assert.equal(
    editPinnedFrontmatter(raw, true).raw,
    "---\npinned: true\n---\nBody\nwith a second line",
  );
});
