import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../features/authentication/hooks/useAuth';
import { getErrorMessage } from '../utils/errors';

// Supabase double-encodes error_description before appending it to the
// redirect fragment, so URLSearchParams's one decode pass leaves literal
// sequences like "%40" behind instead of "@". A second pass fixes that; it's
// a safe no-op on a string that's already fully decoded (none of our error
// messages contain a literal "%").
const decodeErrorDescription = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const LoginPage = () => {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.removeItem('activeOrganizationId');
      navigate('/organizations', { replace: true });
    }
  }, [user, navigate]);

  // Supabase redirects back here with error details in the URL fragment
  // (not a query param) when the OAuth flow itself fails -- most relevantly
  // when the restrict_signup_to_northwestern_email/restrict_login_to_northwestern_email
  // hooks reject a non-@u.northwestern.edu account. Without this, that
  // rejection is invisible: the browser just lands back on this page with
  // no explanation.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const description = params.get('error_description');
    const errorCode = params.get('error');
    if (description || errorCode) {
      setError(
        description ? decodeErrorDescription(description) : 'Sign-in failed. Try again.',
      );
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      // The browser is being redirected to Google -- this component is
      // about to unmount, so there's nothing left to reset submitting for.
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to start sign-in. Try again.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="wl-register-root">
      <div className="wl-register-card">
        <h1 className="wl-register-title">WildcatLedger</h1>
        <p className="wl-register-subtitle">
          Sign in with your Northwestern Google account (@u.northwestern.edu).
        </p>
        {error && <div className="wl-form-error wl-login-error">{error}</div>}
        <button
          type="button"
          className="wl-btn-primary wl-login-signin-btn"
          onClick={handleSignIn}
          disabled={submitting}
        >
          {submitting ? 'Redirecting…' : 'Sign in with Google'}
        </button>
        <p className="wl-login-footer">
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
};
