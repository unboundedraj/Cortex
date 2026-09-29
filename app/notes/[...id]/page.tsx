import { ChevronRight, Clock, Pin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackToNotes } from "@/components/back-to-notes";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { NoteActions } from "@/components/note-actions";
import { SiteHeader } from "@/components/site-header";
import {
  processMarkdown,
  readingTimeMinutes,
  type NoteHeading,
} from "@/lib/markdown";
import { formatNoteDate } from "@/lib/note-filter";
import { humanizeSegment } from "@/lib/notebook-tree";
import { getNote } from "@/lib/notes";
import { decodeNoteId, listHref } from "@/lib/routes";

const MIN_HEADINGS_FOR_TOC = 3;

/*
 * Deliberately no generateStaticParams: with it (the cache-rendered-pages
 * path), Next 16 double-decodes catch-all params and a filename containing
 * a literal "%" fails with "failed to decode param". Rendered on demand
 * instead — getNote() stays cached under the "notes" tag, so only the
 * markdown render runs per request. Not force-dynamic.
 */

export async function generateMetadata({
  params,
}: PageProps<"/notes/[...id]">): Promise<Metadata> {
  const note = await getNote(decodeNoteId((await params).id));
  return { title: note ? `${note.title} · Cortex` : "Note not found · Cortex" };
}

function Breadcrumb({ notebook }: { notebook: string }) {
  const segments = notebook.split("/");
  return (
    <nav aria-label="Notebook" className="text-muted text-sm">
      <ol className="flex flex-wrap items-center gap-1">
        {segments.map((segment, index) => {
          const path = segments.slice(0, index + 1).join("/");
          return (
            <li key={path} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <Link
                href={listHref({ notebook: path })}
                className="hover:text-foreground rounded underline-offset-4 hover:underline"
              >
                {humanizeSegment(segment)}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function TableOfContents({ headings }: { headings: NoteHeading[] }) {
  const minDepth = Math.min(...headings.map((h) => h.depth));
  return (
    <aside className="note-toc print:hidden" aria-label="On this page">
      <p className="text-muted mb-3 text-xs font-medium tracking-widest uppercase">
        On this page
      </p>
      <ol className="border-border space-y-1.5 border-l text-sm">
        {headings.map((heading) => (
          <li
            key={heading.id}
            style={{
              paddingLeft: `${(heading.depth - minDepth) * 0.75 + 0.75}rem`,
            }}
          >
            <a
              href={`#${heading.id}`}
              className="text-muted hover:text-foreground block leading-snug"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export default async function NotePage({
  params,
}: PageProps<"/notes/[...id]">) {
  const note = await getNote(decodeNoteId((await params).id));
  if (!note) notFound();

  const { headings } = processMarkdown(note.content);
  const showToc = headings.length >= MIN_HEADINGS_FOR_TOC;
  const minutes = readingTimeMinutes(note.content);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader wordmark="link" />
      <main className="flex-1 px-4 pt-4 pb-16 sm:px-6 sm:pt-6">
        <div className={`note-layout ${showToc ? "has-toc" : ""}`}>
          <article className="note-column">
            <BackToNotes className="print:hidden" />

            <header className="border-border mt-4 mb-8 flex flex-col gap-4 border-b pb-6">
              <Breadcrumb notebook={note.notebook} />
              <h1 className="flex items-start gap-2.5 text-3xl leading-tight font-semibold tracking-tight wrap-break-word sm:text-4xl">
                {note.pinned && (
                  <Pin
                    className="text-accent mt-2.5 h-5 w-5 shrink-0 fill-current sm:mt-3"
                    aria-label="Pinned"
                  />
                )}
                <span className="min-w-0">{note.title}</span>
              </h1>
              <div className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <time dateTime={note.date}>{formatNoteDate(note.date)}</time>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {minutes} min read
                </span>
              </div>
              {note.tags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
                  {note.tags.map((tag) => (
                    <li key={tag}>
                      <Link
                        href={listHref({ tags: [tag] })}
                        className="border-border hover:bg-surface-hover inline-flex h-8 items-center rounded-full border px-3 text-xs transition-colors"
                      >
                        #{tag}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <NoteActions
                id={note.id}
                title={note.title}
                pinned={note.pinned}
                sha={note.sha}
              />
            </header>

            <MarkdownRenderer markdown={note.content} />
          </article>

          {showToc && <TableOfContents headings={headings} />}
        </div>
      </main>
    </div>
  );
}
