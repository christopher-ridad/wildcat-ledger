export const PrivacyPage = () => (
  <div className="wl-register-root">
    <div className="wl-register-card wl-privacy-card">
      <h1 className="wl-register-title">Privacy Policy</h1>
      <p className="wl-register-subtitle">Last updated August 2026</p>

      <p>
        WildcatLedger is a budget-tracking tool built for Northwestern student
        organizations. This page explains what information the app collects and how
        it&apos;s used.
      </p>

      <h2>What we collect</h2>
      <p>
        Signing in requires a Northwestern Google account (
        <code>@u.northwestern.edu</code>), which shares your name and email address with
        the app. Beyond that, WildcatLedger stores whatever your organization&apos;s
        officers and SOFO approvers enter directly into the ledger: transaction records,
        budget line allocations, and any receipt or supporting-document files uploaded for
        a transaction.
      </p>

      <h2>How it&apos;s used</h2>
      <p>
        This data is used only to run the ledger for your organization &mdash; tracking
        transactions, budget balances, and the approval history behind each one. It&apos;s
        visible to the officers and SOFO approvers of your own organization, and
        isn&apos;t shared with, or sold to, any third party.
      </p>

      <h2>Who else sees it</h2>
      <p>
        WildcatLedger runs on Supabase, which hosts the app&apos;s database, file storage,
        and authentication, and on Google, which handles the sign-in itself. Both only
        process data as needed to operate the app; neither uses it for any other purpose.
      </p>

      <h2>Questions or data removal</h2>
      <p>
        For questions about this policy, or to request that your data be removed, contact{' '}
        <a href="mailto:christopherridad@gmail.com">christopherridad@gmail.com</a>.
      </p>
    </div>
  </div>
);
