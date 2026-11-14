import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { cn } from "@/lib/utils";

/** Shared shell for /privacy, /terms and /cookies: plain, readable, same chrome as the landing page. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" aria-label="Downbeat home">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="container max-w-3xl flex-1 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        <div className="mt-8 space-y-10 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

/** A value only the owner can supply. Rendered visibly so it can't ship unnoticed. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-amber-100 px-1 font-mono text-[0.9em] text-amber-950 dark:bg-amber-400/20 dark:text-amber-100">
      [PLACEHOLDER: {children}]
    </mark>
  );
}

export function LegalTable({
  head,
  rows,
  className,
}: {
  head: string[];
  rows: React.ReactNode[][];
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border", className)}>
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary/60 text-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t align-top">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
