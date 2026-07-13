import { Route, Routes } from 'react-router-dom';
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

export function App() {
  return (
    <div className="app">
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<Game />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/collection/drawings" element={<DrawingCollection />} />
          <Route path="/collection/player-of-day" element={<PlayerOfDayWins />} />
          <Route path="/collection/accessories" element={<Accessories />} />
          <Route path="/market" element={<Market />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/build/:id" element={<BuildPage />} />
          <Route path="*" element={<div className="notice">Page not found.</div>} />
        </Routes>
      </main>
    </div>
  );
}
