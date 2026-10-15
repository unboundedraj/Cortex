import matter from "gray-matter";

const titleFallback = "Untitled";

export function editPinnedFrontmatter(
  raw: string,
  pinned: boolean,
  fallbackTitle = titleFallback,
): { raw: string; title: string } {
  const lineEnding = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);
  const hasFrontmatter = lines[0]?.trim() === "---";
  const title = matter(raw).data.title;
  const titleText =
    typeof title === "string" && title.trim() ? title.trim() : fallbackTitle;

  if (!hasFrontmatter) {
    if (!pinned) return { raw, title: titleText };
    return {
      raw: `---${lineEnding}pinned: true${lineEnding}---${lineEnding}${raw}`,
      title: titleText,
    };
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (closingIndex < 0) {
    throw new Error("The note has an unterminated frontmatter block.");
  }

  const pinnedIndex = lines.findIndex(
    (line, index) =>
      index > 0 && index < closingIndex && /^\s*pinned\s*:/.test(line),
  );
  if (pinnedIndex >= 0) {
    lines[pinnedIndex] = lines[pinnedIndex].replace(
      /^(\s*pinned\s*:\s*).*/,
      `$1${pinned}`,
    );
    return { raw: lines.join(lineEnding), title: titleText };
  }
  if (!pinned) return { raw, title: titleText };

  lines.splice(closingIndex, 0, "pinned: true");
  return { raw: lines.join(lineEnding), title: titleText };
}
