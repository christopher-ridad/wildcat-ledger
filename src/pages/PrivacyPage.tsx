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

      <h2>What data is collected</h2>
      <p>
        WildcatLedger doesn&apos;t have its own passwords. Signing in goes through Google,
        restricted to <code>@u.northwestern.edu</code> accounts, which shares your name
        and email address with the app. Beyond that, WildcatLedger only stores what you or
        your organization&apos;s officers and SOFO approvers enter directly into the
        ledger, including transaction records, budget line allocations, and any receipt or
        supporting-document files uploaded for a transaction. Nothing is collected
        passively, and there&apos;s no analytics or tracking script on this site.
      </p>

      <h2>How it&apos;s used</h2>
      <p>
        This data is used only to run the ledger for your organization, tracking
        transactions, budget balances, and the approval history behind each one. It
        isn&apos;t used for any other purpose, and it isn&apos;t sold or shared with any
        third party.
      </p>

      <h2>Who can access your data</h2>
      <p>
        Each organization&apos;s data is walled off from every other organization&apos;s
        at the database level. Within your organization, only the officers and SOFO
        approvers you&apos;ve listed can see its transactions, budgets, and files. Nobody
        outside that list, and nobody from a different organization, can see it.
      </p>

      <h2>Third parties</h2>
      <p>
        WildcatLedger runs on Supabase, which hosts the database and file storage, and
        uses Google only to verify who you are at sign-in. Neither is given your data for
        any purpose beyond running the app.
      </p>

      <h2>Security</h2>
      <p>
        Because sign-in goes through Google, your account&apos;s security is largely
        Google&apos;s account security, so keep that account secure the way you normally
        would. If you ever think your WildcatLedger data has been accessed without your
        permission, or have any other question about how your data is handled, reach out
        at <a href="mailto:christopherridad@gmail.com">christopherridad@gmail.com</a>.
      </p>
    </div>
  </div>
);
