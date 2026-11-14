import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection, LegalTable, Placeholder } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Cookie policy",
  alternates: { canonical: "/cookies" },
  description: "Every cookie and browser storage item Downbeat uses, and the companies your browser contacts.",
};

const code = (text: string) => <code className="font-mono text-xs text-foreground">{text}</code>;

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie policy for Downbeat" updated="14 November 2026">
      <p>
        This site only uses the cookies and browser storage it needs to work. It does not use analytics,
        advertising or cross-site tracking cookies, so there is nothing to opt in to. This page lists
        exactly what is stored and what loads from other companies.
      </p>

      <LegalSection title="Cookies">
        <LegalTable
          head={["Name", "Set by", "Purpose", "Type", "How long"]}
          rows={[
            [code("__client"), "Clerk (on clerk.trydownbeat.app)", "Identifies your browser to the sign-in service so a band leader stays signed in", "Necessary", "400 days"],
            [code("__client_uat"), "Clerk (on trydownbeat.app), also with a suffix", "Records when you last signed in or out so the app knows whether to check your session", "Necessary", "400 days"],
            [code("__session"), "Clerk (on trydownbeat.app), also with a suffix", "Short-lived proof that a band leader is signed in; only set while signed in", "Necessary", "About a minute, renewed while signed in"],
            [code("__cf_bm"), "Cloudflare, for Clerk (on clerk.trydownbeat.app)", "Bot protection for the sign-in service", "Necessary", "30 minutes"],
            [code("_cfuvid"), "Cloudflare, for Clerk (on clerk.trydownbeat.app)", "Rate limiting for the sign-in service", "Necessary", "Session"],
          ]}
        />
      </LegalSection>

      <LegalSection title="Browser storage">
        <LegalTable
          head={["Key", "Where", "Purpose", "Type"]}
          rows={[
            [code("theme"), "localStorage", "Read to show light or dark mode", "Functional"],
            [code("downbeat:member:<band link>"), "localStorage", "Remembers which member you are in a band (your personal link and name) so the invite page can welcome you back", "Necessary"],
            [code("downbeat:week-start"), "localStorage", "Remembers which day your week starts on", "Functional"],
            [code("downbeat:ios-home-screen-dismissed"), "localStorage", "Remembers that you dismissed the 'add to Home Screen' tip", "Functional"],
            [code("downbeat:passkey-prompt-dismissed:<member id>"), "localStorage", "Remembers that you dismissed the passkey suggestion", "Functional"],
            [code("__clerk_environment"), "localStorage", "Clerk caches its sign-in settings", "Necessary"],
            [code("__clerk_protect_pid, __clerk_protect_st:clerk.trydownbeat.app"), "localStorage", "Clerk Protect bot detection (security)", "Necessary"],
            [code("cookie-consent"), "localStorage", "Remembers that you have seen the cookie notice, for 180 days", "Necessary"],
          ]}
        />
      </LegalSection>

      <LegalSection title="Other companies your browser contacts">
        <LegalTable
          head={["Company", "Host", "Why", "When", "What they receive"]}
          rows={[
            ["Clerk", "clerk.trydownbeat.app", "Sign-in and account service for band leaders; its script loads on every page", "Every page view", "IP address, browser details; email, name and password when signing up or in"],
            ["Clerk Protect", "cdn.protect.clerk.com and *.client.protect.clerk.com", "Bot and fraud detection for sign-in; it loads bot detection scripts for security", "Every page view", "IP address, browser and device signals"],
          ]}
        />
      </LegalSection>

      <LegalSection title="Your choices">
        <LegalList>
          <li>
            You can clear or block cookies and site storage in your browser settings. Necessary items are
            needed for the site to work: without them a band leader cannot stay signed in, and this
            device forgets which band member you are.
          </li>
        </LegalList>
        <div>
          <button
            type="button"
            data-cookie-settings
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cookie settings
          </button>
        </div>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about this page: <Placeholder>contact email</Placeholder>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
