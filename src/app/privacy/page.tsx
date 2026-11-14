import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection, LegalTable, Placeholder } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Downbeat collects from band leaders and band members, why, who processes it, and how to delete it.",
};

const linkClass = "font-medium text-foreground underline underline-offset-2 hover:text-primary";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy for Downbeat" updated="14 November 2026">
      <LegalSection title="Who is responsible">
        <p>
          Downbeat (https://trydownbeat.app) is run by <Placeholder>owner legal name</Placeholder>,{" "}
          <Placeholder>city, state, country</Placeholder>. Contact:{" "}
          <Placeholder>contact email for privacy requests</Placeholder>.
        </p>
      </LegalSection>

      <LegalSection title="What is collected and why">
        <p>Downbeat collects only what it needs to help a band find time to play.</p>
        <LegalList>
          <li>
            <strong className="text-foreground">Band leaders:</strong> your name, your verified email
            address and your account id from Clerk, the sign-in service. This lets you sign in and manage
            your bands.
          </li>
          <li>
            <strong className="text-foreground">Bands:</strong> the band or event name, description,
            rehearsal location, time zone, date range and any date labels the leader adds.
          </li>
          <li>
            <strong className="text-foreground">Band members:</strong> your name, instrument and, if you
            choose to add it, a phone number or email so your bandmates can reach you.
          </li>
          <li>
            <strong className="text-foreground">Band members:</strong> the availability you mark for each
            date and time, when you last updated it, a hashed copy of your recovery code (never the code
            itself) and, if you save one, your passkey&apos;s credential id and public key (never your
            fingerprint, face or PIN, which stay on your device).
          </li>
          <li>
            <strong className="text-foreground">Abuse protection:</strong> to stop people flooding a band
            with fake members or guessing recovery codes, a one-way hash of your IP address is counted for
            a short time when you join, recover a spot or sign in with a passkey. These counters are
            deleted within a day.
          </li>
          <li>
            <strong className="text-foreground">Technical data:</strong> like every website, the hosting
            provider and the sign-in service receive your IP address and browser details in order to
            deliver pages and keep the service secure.
          </li>
        </LegalList>
        <p>
          Legal bases under EU and UK law: providing the service you asked for (contract), keeping the
          site secure and working (legitimate interests), and your consent where this policy says
          something is optional, such as adding contact details.
        </p>
      </LegalSection>

      <LegalSection title="Band members do not need an account">
        <p>
          When you join a band you only type your name. Downbeat gives you a personal link, and that link
          is how the site knows it is you, so keep it to yourself. Your browser also remembers it on this
          device so the invite page can welcome you back. If your link ever ends up somewhere it should
          not, open it and choose &quot;Get a new personal link&quot;: the old one stops working at once.
          Your band leader can see your name, instrument, contact details and availability.
        </p>
      </LegalSection>

      <LegalSection title="Who it is shared with">
        <p>These companies process data for Downbeat:</p>
        <LegalTable
          head={["Company", "What they do for this site", "Where"]}
          rows={[
            ["Clerk", "Sign-in, leader accounts and bot protection", "United States"],
            ["Railway", "Hosting for the app and its Postgres database", "United States"],
            ["Cloudflare", "Email routing for the domain and network protection on the Clerk host", "United States"],
          ]}
        />
        <p>Your browser also contacts these companies directly when you use the site:</p>
        <LegalTable
          head={["Company", "Why", "When"]}
          rows={[
            ["Clerk", "Sign-in and account service for band leaders; its script loads on every page", "Every page view"],
            ["Clerk Protect", "Bot and fraud detection for sign-in (security)", "Every page view"],
          ]}
        />
        <p>
          Personal information is not sold, and it is not shared for cross-context behavioural
          advertising. There are no analytics or advertising tools on this site.
        </p>
      </LegalSection>

      <LegalSection title="International transfers">
        <p>
          The companies above are based in the United States. Where data leaves the EU or UK it is
          covered by the provider&apos;s standard contractual clauses or Data Privacy Framework
          certification.
        </p>
      </LegalSection>

      <LegalSection title="How long it is kept">
        <LegalList>
          <li>A band, its members and their availability: until the band leader deletes the band or their account.</li>
          <li>A band member&apos;s own details and availability: until they leave the band, the leader removes them, or the band is deleted.</li>
          <li>A band leader&apos;s account: until they delete it from the dashboard.</li>
          <li>Abuse-protection counters: up to one day.</li>
          <li>
            Server logs kept by the hosting provider: <Placeholder>log retention period set in Railway</Placeholder>.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Deleting and exporting your data">
        <LegalList>
          <li>
            <strong className="text-foreground">Band leaders</strong> can delete a band (with everything in
            it) from the band&apos;s edit page, remove a member from the member list, download all their
            data as a file, and delete their whole account from the dashboard.
          </li>
          <li>
            <strong className="text-foreground">Band members</strong> can change or remove their details
            and leave the band from their personal page. Leaving deletes your details and availability.
          </li>
          <li>
            For anything else, or if you have lost your link, email <Placeholder>contact email for privacy requests</Placeholder>.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Your rights">
        <LegalList>
          <li>
            EU and UK visitors: access, correction, deletion, restriction, objection, portability,
            withdrawing consent, and the right to complain to your data protection authority.
          </li>
          <li>
            California and other US state residents: the right to know, delete and correct, and to opt out
            of sale or sharing. This site does not sell or share personal information, and it honours
            Global Privacy Control signals.
          </li>
          <li>
            To use any of these rights, email <Placeholder>contact email for privacy requests</Placeholder>.
            You will get an answer within 30 days. You will never be treated differently for using them.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          This site is not directed at children under 13 (under 16 in the EU and UK) and does not
          knowingly collect their data.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and storage">
        <p>
          See the{" "}
          <Link href="/cookies" className={linkClass}>
            cookie policy
          </Link>{" "}
          for the full list.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If this policy changes in a way that matters, the date above changes and a notice is shown on
          the site.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
