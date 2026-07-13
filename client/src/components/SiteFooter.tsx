import { Link } from 'react-router-dom';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <span>© 2026 Build-A-Baller. All rights reserved.</span>
        <a href="mailto:baballersupport@gmail.com">Contact</a>
      </div>
      <p className="site-footer-disclaimer">
        Build-A-Baller is an independent project and is not affiliated with, endorsed by, or sponsored by the National Basketball Association, WNBA, or any professional basketball league.
      </p>
      <nav className="site-footer-links" aria-label="Footer">
        <Link to="/how-to-play">How to Play</Link>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Use</Link>
      </nav>
    </footer>
  );
}
