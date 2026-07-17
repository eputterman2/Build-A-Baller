import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page-card">
        <h2 className="results-title">Reset Password</h2>
        <p className="notice">This reset link is missing a token.</p>
        <Link className="btn btn-login" to="/">Back Home</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-page-card">
        <h2 className="results-title">Password Updated</h2>
        <p>Your password has been reset. You can log in with your new password now.</p>
        <Link className="btn btn-login" to="/">Back Home</Link>
      </div>
    );
  }

  return (
    <div className="auth-page-card">
      <h2 className="results-title">Reset Password</h2>
      <form className="auth-page-form" onSubmit={submit}>
        <label>
          New Password
          <input type="password" value={password} onChange={event => setPassword(event.target.value)}
            autoComplete="new-password" minLength={6} maxLength={100} placeholder="6-100 characters" required />
        </label>
        <label>
          Confirm Password
          <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}
            autoComplete="new-password" minLength={6} maxLength={100} placeholder="type it again" required />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Please wait...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
