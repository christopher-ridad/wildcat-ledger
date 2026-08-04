import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../features/authentication/hooks/useAuth';

export const LoginPage = () => {
  const { user, sendLoginLink } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'form' | 'sent'>('form');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.removeItem('activeOrganizationId');
      navigate('/organizations', { replace: true });
    }
  }, [user, navigate]);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await sendLoginLink(trimmed);
      setView('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send link. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wl-register-root">
      <div className="wl-register-card">
        <h1 className="wl-register-title">WildcatLedger</h1>

        {view === 'form' && (
          <>
            <p className="wl-register-subtitle">
              Enter your email to receive a sign-in link. No password needed.
            </p>
            <div className="wl-login-field">
              <label className="wl-login-label" htmlFor="login-email">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                className="wl-form-input wl-login-input"
                value={email}
                placeholder="you@northwestern.edu"
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
            </div>
            {error && <div className="wl-form-error wl-login-error">{error}</div>}
            <button
              type="button"
              className="wl-btn-primary wl-register-done"
              onClick={handleSend}
              disabled={submitting}
            >
              {submitting ? 'Sending…' : 'Send me a link'}
            </button>
          </>
        )}

        {view === 'sent' && (
          <div className="wl-login-sent">
            <div className="wl-login-sent-icon" aria-hidden="true">
              ✉
            </div>
            <p className="wl-login-sent-heading">Check your email</p>
            <p className="wl-login-sent-body">
              We sent a sign-in link to <strong>{email}</strong>. Click it to sign in —
              the link expires in 1 hour.
            </p>
            <button
              type="button"
              className="wl-login-sent-retry"
              onClick={() => {
                setView('form');
                setError(null);
              }}
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
