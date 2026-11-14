import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/** Footer for the public pages: the landing page and the legal pages. */
export function SiteFooter() {
  return (
    <footer className="border-t py-10">
      <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <Link href="/" aria-label="Downbeat home">
          <Logo />
        </Link>
        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/cookies" className="hover:text-foreground">
            Cookies
          </Link>
        </nav>
        <p>&copy; {new Date().getFullYear()} Downbeat. Made for bands with busy lives.</p>
      </div>
    </footer>
  );
}
