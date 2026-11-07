
import { isValidElement, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  AlertTriangle,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
} from "lucide-react";

import { PublicNavbar } from "@/components/PublicNavbar";
import rawGuide from "@/content/ledger-mpesa-sms-guide.md?raw";

// --------------------------------------------------
// 1. Normalize the Markdown source
// --------------------------------------------------

const guide = rawGuide
  .replace(/\r\n?/g, "\n")
  // Restore headings wrapped in bold markers.
  .replace(/^\s*\*\*(#{1,6}\s.+?)\*\*\s*$/gm, "$1")
  // Restore horizontal rules.
  .replace(/^\s*\*\*(---)\*\*\s*$/gm, "$1")
  // Restore escaped Markdown code fences.
  .replace(/\\`/g, "`")
  // Restore common escaped Markdown punctuation.
  .replace(/\\([.()#+!|>:-])/g, "$1")
  // Replace encoded spaces.
  .replace(/&#x20;/gi, " ");

// --------------------------------------------------
// 2. Heading utilities
// --------------------------------------------------

const slugify = (value: string) =>
  value
    .replace(/^\d+\.\s*/, "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Extract text from React Markdown heading children.
const getText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getText(node.props.children);
  }

  return "";
};

// --------------------------------------------------
// 3. Generate the table of contents
// --------------------------------------------------

const sections = Array.from(
  guide.matchAll(/^#\s+(\d+)\.\s+(.+)$/gm)
).map((match) => ({
  number: match[1],
  label: `${match[1]}. ${match[2].trim()}`,
  id: slugify(match[2]),
}));

// --------------------------------------------------
// 4. Markdown rendering components
// --------------------------------------------------

const markdownComponents: Components = {
  h1: ({ children }) => {
    const text = getText(children);
    const isSection = /^\d+\.\s/.test(text);

    if (isSection) {
      return (
        <h2
          id={slugify(text)}
          className="scroll-mt-28 border-b border-border/60 pb-3 pt-12 font-display text-2xl font-semibold tracking-tight text-foreground first:pt-0 md:text-3xl"
        >
          {children}
        </h2>
      );
    }

    return (
      <h1
        id={slugify(text)}
        className="mb-5 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl"
      >
        {children}
      </h1>
    );
  },

  h2: ({ children }) => (
    <h2 className="scroll-mt-28 mb-4 mt-10 font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl">
      {children}
    </h2>
  ),

  h3: ({ children }) => (
    <h3 className="scroll-mt-28 mb-3 mt-8 font-display text-lg font-semibold text-foreground">
      {children}
    </h3>
  ),

  h4: ({ children }) => (
    <h4 className="mb-2 mt-6 text-base font-semibold text-foreground">
      {children}
    </h4>
  ),

  p: ({ children }) => (
    <p className="mb-5 text-sm leading-7 text-muted-foreground md:text-[15px]">
      {children}
    </p>
  ),

  ul: ({ children }) => (
    <ul className="mb-6 ml-5 list-disc space-y-2 text-sm leading-7 text-muted-foreground marker:text-primary md:text-[15px]">
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol className="mb-6 ml-5 list-decimal space-y-2 text-sm leading-7 text-muted-foreground marker:font-semibold marker:text-primary md:text-[15px]">
      {children}
    </ol>
  ),

  li: ({ children }) => <li className="pl-1">{children}</li>,

  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">
      {children}
    </strong>
  ),

  a: ({ href, children }) => (
    <a
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      className="font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary"
    >
      {children}
    </a>
  ),

  pre: ({ children }) => (
    <pre className="my-6 overflow-x-auto rounded-xl border border-border bg-slate-950 p-5 text-sm leading-6 text-slate-100 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
      {children}
    </pre>
  ),

  code: ({ className, children }) => (
    <code
      className={
        className
          ? "font-mono text-[13px]"
          : "rounded-md border border-border/60 bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
      }
    >
      {children}
    </code>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-6 border-l-2 border-primary/60 bg-secondary/40 px-5 py-4 text-sm leading-7 text-muted-foreground [&_p:last-child]:mb-0">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-10 border-border/60" />,

  table: ({ children }) => (
    <div className="my-7 overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="bg-secondary/70 text-foreground">
      {children}
    </thead>
  ),

  tbody: ({ children }) => (
    <tbody className="divide-y divide-border/60">
      {children}
    </tbody>
  ),

  tr: ({ children }) => (
    <tr className="transition-colors hover:bg-secondary/30">
      {children}
    </tr>
  ),

  th: ({ children }) => (
    <th className="whitespace-nowrap px-4 py-3 font-semibold">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className="min-w-32 px-4 py-3 align-top leading-6 text-muted-foreground">
      {children}
    </td>
  ),
};

// --------------------------------------------------
// 5. Documentation page
// --------------------------------------------------

const Documentation = () => {
  return (
    <div id="top" className="min-h-screen scroll-smooth bg-background">
      <PublicNavbar />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 lg:px-8 lg:pt-14">

        {/* PAGE HEADER */}

        <header className="mb-8 border-b border-border/60 pb-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                  Technical documentation
                </span>

                <span className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  VERSION 1.0
                </span>
              </div>

              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Ledger – M-Pesa SMS Automation
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Complete integration and configuration guide using
                MacroDroid and Supabase Edge Functions.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  16 chapters
                </span>

                <span>Android 15</span>
                <span>Last updated: 7 November 2026</span>
              </div>
            </div>
          </div>
        </header>

        <section
          aria-labelledby="project-links-heading"
          className="mb-10 rounded-xl border border-border/70 bg-card p-5 shadow-sm md:p-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Project Links
              </p>
              <h2
                id="project-links-heading"
                className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground"
              >
                Explore My Financial Compass
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="https://my-financial-ledger.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                View Live Project
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href="https://github.com/sirmakau/my-financial-compass"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                View Source Code
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* IMPLEMENTATION STATUS */}

        <section
          aria-label="Implementation status"
          className="mb-10 grid gap-4 md:grid-cols-2"
        >
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">
                Online delivery
              </h2>
            </div>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Configured and tested. Incoming M-Pesa SMS messages
              can be forwarded to the Ledger inbox.
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-semibold text-foreground">
                Offline synchronisation
              </h2>
            </div>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Partially configured. Retry processing, duplicate
              protection, and safe queue cleanup remain unfinished.
            </p>
          </div>
        </section>

        {/* DOCUMENTATION LAYOUT */}

        <div className="grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">

          {/* TABLE OF CONTENTS */}

          <aside className="min-w-0 lg:sticky lg:top-24">

            {/* Mobile contents */}

            <details className="mb-6 rounded-xl border border-border/70 bg-card lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold">
                Table of contents
                <ChevronRight className="h-4 w-4 transition-transform [details[open]_&]:rotate-90" />
              </summary>

              <nav
                aria-label="Mobile documentation contents"
                className="grid max-h-80 gap-1 overflow-y-auto border-t border-border/60 p-3 sm:grid-cols-2"
              >
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="rounded-lg px-3 py-2 text-xs leading-5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {section.label}
                  </a>
                ))}
              </nav>
            </details>

            {/* Desktop contents */}

            <nav
              aria-label="Documentation contents"
              className="hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-border/70 bg-card p-4 lg:block"
            >
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                On this page
              </h2>

              <div className="space-y-1">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="group flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs leading-5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60 group-hover:text-primary">
                      {section.number.padStart(2, "0")}
                    </span>

                    <span>{section.label.replace(/^\d+\.\s*/, "")}</span>
                  </a>
                ))}
              </div>
            </nav>
          </aside>

          {/* MARKDOWN ARTICLE */}

          <article className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 px-5 py-4 md:px-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Documentation
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Implementation manual
                  </p>
                </div>

                <BookOpen className="h-5 w-5 text-muted-foreground/60" />
              </div>
            </div>

            <div className="min-w-0 p-5 md:p-8 lg:p-10">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {guide}
              </ReactMarkdown>
            </div>
          </article>
        </div>

        {/* FOOTER ACTIONS */}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open Ledger
            <ChevronRight className="h-4 w-4" />
          </Link>

          <a
            href="#top"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowUp className="h-4 w-4" />
            Back to top
          </a>
        </footer>

      </main>
    </div>
  );
};

export default Documentation;
