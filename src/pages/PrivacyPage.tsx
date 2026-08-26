export const PrivacyPage = () => (
  <div className="wl-register-root">
    <div className="wl-register-card wl-privacy-card">
      <h1 className="wl-register-title">Privacy Policy</h1>
      <p className="wl-register-subtitle">Last updated August 2026</p>

      <p>
        WildcatLedger is a budget-tracking tool built for Northwestern student
        organizations. This page explains, in plain terms, what data the app collects and
        how it&apos;s handled. If anything here is unclear, email{' '}
        <a href="mailto:christopherridad@gmail.com">christopherridad@gmail.com</a> any
        time.
      </p>

      <h2>How you sign in</h2>
      <p>
        WildcatLedger doesn&apos;t have its own passwords. Signing in redirects you to
        Google, and only Google accounts on the <code>@u.northwestern.edu</code> domain
        are allowed to create an account &mdash; this is enforced on the server, not just
        in the sign-in screen, so no other domain can get in even if it slips past
        Google&apos;s own account picker. Google handles the authentication itself;
        WildcatLedger never sees or stores a password.
      </p>

      <h2>What data is collected</h2>
      <p>
        Signing in shares your name and <code>@u.northwestern.edu</code> email address
        with the app. Beyond that, WildcatLedger only stores what you or your
        organization&apos;s officers and SOFO approvers enter directly into the ledger:
        transaction records, budget line allocations, and any receipt or
        supporting-document files uploaded for a transaction. Nothing is collected
        passively &mdash; there&apos;s no analytics or tracking script on this site.
      </p>

      <h2>Who can access your data</h2>
      <p>
        Each organization&apos;s data is walled off from every other organization&apos;s
        at the database level. Within your organization, only the officers and SOFO
        approvers you&apos;ve listed can see its transactions, budgets, and files &mdash;
        nobody outside that list, and nobody from a different organization, can see it.
      </p>

      <h2>Where your data lives</h2>
      <p>
        WildcatLedger runs on Supabase, which hosts the database and file storage, and
        uses Google only to verify who you are at sign-in. Neither is given your data for
        any purpose beyond running the app, and it isn&apos;t sold or shared with anyone
        else.
      </p>

      <h2>Signing out</h2>
      <p>
        WildcatLedger is a small, early-stage project and doesn&apos;t yet have a
        dedicated sign-out button. Your session is stored in your browser and stays active
        there; to end it, clear this site&apos;s cookies/site data, or use a
        private/incognito window. This is on the list of things to add.
      </p>

      <h2>Security</h2>
      <p>
        Because sign-in goes through Google, your account&apos;s security is largely
        Google&apos;s account security &mdash; keep that account secure the way you
        normally would. If you ever think your WildcatLedger data has been accessed
        without your permission, or have any other question about how your data is
        handled, reach out at{' '}
        <a href="mailto:christopherridad@gmail.com">christopherridad@gmail.com</a>.
      </p>
    </div>
  </div>
);
