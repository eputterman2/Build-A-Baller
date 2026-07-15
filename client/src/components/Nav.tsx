import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { AuthModal } from './AuthModal';

export function Nav() {
  const { user, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Always returns to the home screen, even from mid-game (the nonce forces a reset).
  const goHome = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/', { state: { home: Date.now() } });
  };
  const goPlay = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/', { state: { play: Date.now() } });
  };

  return (
    <header className="nav">
      <Link to="/" className="brand" onClick={goHome}><img className="nav-logo" src="/logo.png" alt="Build-A-Baller" /></Link>
      <nav className="nav-links">
        <Link to="/" className={pathname === '/' ? 'active' : ''} onClick={goPlay}>Play</Link>
        <Link to="/leaderboard" className={pathname === '/leaderboard' ? 'active' : ''}>Leaderboard</Link>
        <Link to="/collection" className={pathname === '/collection' ? 'active' : ''}>Collection</Link>
        <Link to="/market" className={pathname === '/market' ? 'active' : ''}>Market</Link>
      </nav>
      <div className="nav-auth">
        {user ? (
          <span className="nav-user">
            <span className="username">@{user.username}</span>
            <button className="link" onClick={logout}>Log out</button>
          </span>
        ) : (
          <button className="btn btn-small btn-login" onClick={() => setShowAuth(true)}>Log in</button>
        )}
      </div>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </header>
  );
}
