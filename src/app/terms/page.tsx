import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection, Placeholder } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of service",
  alternates: { canonical: "/terms" },
  description: "The rules for using Downbeat, the rehearsal scheduler for bands.",
};

const linkClass = "font-medium text-foreground underline underline-offset-2 hover:text-primary";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="14 November 2026">
      <p className="rounded-lg border border-dashed p-4">
        Draft for the owner to review before publishing. This is not legal advice.
      </p>

      <LegalSection title="1. Who provides Downbeat">
        <p>
          Downbeat (https://trydownbeat.app) is provided by <Placeholder>owner legal name</Placeholder>,{" "}
          <Placeholder>city, state, country</Placeholder>. Questions about these terms:{" "}
          <Placeholder>contact email</Placeholder>.
        </p>
      </LegalSection>

      <LegalSection title="2. The service">
        <p>
          Downbeat helps a band find time to rehearse or play. A band leader creates a band and shares
          its invite link; band members open the link, type their name and mark when they are free,
          without making an account. The service is provided as is and as available, without any
          warranty, to the extent the law allows. It may change, and parts of it may be unavailable from
          time to time.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts and links">
        <LegalList>
          <li>Band leaders sign in with an account. One person per account. Keep your sign-in details safe.</li>
          <li>
            Band members get a personal link instead of an account. Anyone who has that link can act as
            you in that band, so do not share it. You can get a new link from your personal page at any
            time.
          </li>
          <li>You must be at least 13 years old to use Downbeat (16 in the EU and UK).</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. Band leaders">
        <p>
          As a band leader you decide who gets your band&apos;s invite link, and you are responsible for
          sharing it only with people you want in the band. The names, instruments, contact details and
          availability your members enter are visible to you. Use them only to organise your band, and
          remove anyone who asks to be removed.
        </p>
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <LegalList>
          <li>No unlawful, hateful or harassing content in band names, descriptions, labels or member details.</li>
          <li>No fake or spam members, and no joining bands whose link was not shared with you.</li>
          <li>No scraping, automated sign-ups, guessing links or codes, or attempts to break, overload or get around the security of the service.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="6. Your content">
        <p>
          You keep ownership of what you enter. You give the operator only the permission needed to store
          it and show it to your band in order to run the service. You confirm you have the right to
          enter it, including any contact details.
        </p>
      </LegalSection>

      <LegalSection id="price" title="7. Price and the free plan">
        <p>
          Downbeat is free to use. The pricing section on the{" "}
          <Link href="/#pricing" className={linkClass}>
            home page
          </Link>{" "}
          describes the current plan. The free plan includes:
        </p>
        <LegalList>
          <li>unlimited bands, with up to 50 members in each band;</li>
          <li>weekly and date-specific availability;</li>
          <li>one invite link per band, with no accounts or logins for band members.</li>
        </LegalList>
        <p>
          There are no payments, so there is nothing to bill, refund or cancel. If paid plans are ever
          added, <Placeholder>confirm what stays free, for example: everything listed above stays free for existing bands</Placeholder>,
          and the change is announced on this site and by email to band leaders at least{" "}
          <Placeholder>notice period, for example 30 days</Placeholder> before it applies.
        </p>
      </LegalSection>

      <LegalSection title="8. Ending your use">
        <LegalList>
          <li>A band leader can delete a band, or their whole account and all their bands, from the dashboard at any time.</li>
          <li>A band member can leave a band from their personal page at any time.</li>
          <li>
            The operator may suspend or remove a band, member or account that breaks these terms or puts
            the service or other people at risk, and will explain why where it is safe to do so.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="9. Liability and governing law">
        <p>
          To the extent the law allows, the operator is not liable for indirect or consequential loss,
          or for missed rehearsals, gigs or bookings that relied on the service. Nothing in these terms
          limits liability that cannot be limited by law, or your rights as a consumer. These terms are
          governed by the law of <Placeholder>state and country whose law governs these terms</Placeholder>.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to these terms">
        <p>
          If these terms change in a way that matters, the date above changes and a notice is shown on
          the site before the new terms apply. See also the{" "}
          <Link href="/privacy" className={linkClass}>
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
