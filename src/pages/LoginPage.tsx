import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../features/authentication/hooks/useAuth';
import { getErrorMessage } from '../utils/errors';

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
