import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Game } from './components/Game';
import { Leaderboard } from './components/Leaderboard';
import { Collection } from './components/Collection';
import { BuildPage } from './components/BuildPage';
import { DrawingCollection } from './components/DrawingCollection';
import { PlayerOfDayWins } from './components/PlayerOfDayWins';
import { ResetPassword } from './components/ResetPassword';
import { Market } from './components/Market';
import { Accessories } from './components/Accessories';
import { AdminMarket } from './components/AdminMarket';
import { SiteFooter } from './components/SiteFooter';
import { HowToPlayPage, PrivacyPage, TermsPage } from './components/LegalPage';
import { PrizeDetailsPage } from './components/PrizesSection';
import { api } from './api';

const VISITOR_ID_KEY = 'build-a-baller-visitor-id';

function visitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const next = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `visitor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VISITOR_ID_KEY, next);
    return next;
  } catch {
    return `visitor-${Date.now().toString(36)}`;
  }
}

export function App() {
  const location = useLocation();

  useEffect(() => {
    void api.trackSiteVisit(visitorId(), location.pathname).catch(() => undefined);
  }, [location.pathname]);

  useEffect(() => {
    const report = (type: 'error' | 'unhandled-rejection', message: string) => {
      const normalized = message.trim().slice(0, 500);
      if (!normalized) return;
      void api.reportSiteIssue({
        visitorId: visitorId(),
        type,
        message: normalized,
        path: window.location.pathname,
      }).catch(() => undefined);
    };
    const onError = (event: ErrorEvent) => report('error', event.error?.message || event.message);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || 'Unhandled promise rejection');
      report('unhandled-rejection', reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return (
    <div className="app">
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<Game />} />
          <Route path="/play" element={<Game autoStart />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/collection/drawings" element={<DrawingCollection />} />
          <Route path="/collection/player-of-day" element={<PlayerOfDayWins />} />
          <Route path="/collection/accessories" element={<Accessories />} />
          <Route path="/market" element={<Market />} />
          <Route path="/prizes" element={<Market />} />
          <Route path="/prizes/2k-contest" element={<PrizeDetailsPage />} />
          <Route path="/admin/drawings" element={<AdminMarket />} />
          <Route path="/admin/market" element={<AdminMarket />} />
          <Route path="/how-to-play" element={<HowToPlayPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/build/:id" element={<BuildPage />} />
          <Route path="*" element={<div className="notice">Page not found.</div>} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  );
}
