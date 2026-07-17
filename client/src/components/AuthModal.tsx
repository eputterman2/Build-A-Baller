import { useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';

interface AuthModalProps {
  onClose: () => void;
  intro?: string;
}

export function AuthModal({ onClose, intro }: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setDevResetUrl(null);
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const result = await api.requestPasswordReset(email);
        setNotice(result.message);
        setDevResetUrl(result.resetUrl ?? null);
        return;
      }
      if (mode === 'register') await register(username, email, password);
      else await login(email, password);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (nextMode: 'login' | 'register' | 'forgot') => {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setDevResetUrl(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2>{mode === 'register' ? 'Create an account' : mode === 'forgot' ? 'Reset password' : 'Welcome back'}</h2>
        {intro && <p className="modal-intro">{intro}</p>}
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Username
              <input value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" placeholder="3-20 letters, numbers, _" required />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" placeholder="you@example.com" required />
          </label>
          {mode !== 'forgot' && (
            <label>
              Password
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={6}
                maxLength={100}
                placeholder="6-100 characters" required />
            </label>
          )}
          {error && <div className="form-error">{error}</div>}
          {notice && <div className="form-success">{notice}</div>}
          {devResetUrl && (
            <a className="dev-reset-link" href={devResetUrl}>
              Open local reset link
            </a>
          )}
          <button className={`btn btn-primary${mode === 'login' ? ' btn-login' : ''}`} type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'register' ? 'Sign Up' : mode === 'forgot' ? 'Send Reset Link' : 'Log In'}
          </button>
        </form>
        {mode === 'forgot' ? (
          <p className="modal-switch">
            Remembered it?{' '}
            <button className="link" onClick={() => switchMode('login')}>Log in</button>
          </p>
        ) : (
          <>
            {mode === 'login' && (
              <p className="modal-switch modal-switch-tight">
                <button className="link" onClick={() => switchMode('forgot')}>Forgot password?</button>
              </p>
            )}
            <p className="modal-switch">
              {mode === 'register' ? 'Already have an account?' : 'Need an account?'}{' '}
              <button className="link" onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}>
                {mode === 'register' ? 'Log in' : 'Sign up'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
