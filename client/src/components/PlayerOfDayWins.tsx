import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlayerOfDayWin } from '@shared/index';
import { useAuth } from '../auth';
import { api } from '../api';
import { SportsCard } from './SportsCard';

function displayDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PlayerOfDayWins() {
  const { user, loading } = useAuth();
  const [wins, setWins] = useState<PlayerOfDayWin[] | null>(null);
  const [totalWins, setTotalWins] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setWins(null);
      setTotalWins(null);
      return;
    }
    api.playerOfDayWins()
      .then(history => {
        setWins(history.wins);
        setTotalWins(history.totalWins);
      })
      .catch(err => setError((err as Error).message));
  }, [user]);

  if (loading) return <div className="notice">Loading wins…</div>;
  if (!user) return <div className="notice">Log in to view your Player of the Day wins.</div>;
  if (error) return <div className="notice error">Couldn’t load wins: {error}</div>;
  if (!wins || totalWins == null) return <div className="notice">Loading wins…</div>;

  return (
    <div className="player-of-day-wins">
      <div className="collection-subpage-head">
        <Link className="link" to="/collection">Back to Collection</Link>
        <h2 className="results-title">Player of the Day</h2>
        <p>{totalWins} {totalWins === 1 ? 'win' : 'wins'}</p>
      </div>
      {wins.length === 0 ? (
        <div className="notice">Your first Player of the Day win is still up for grabs.</div>
      ) : (
        <div className="sports-card-grid">
          {wins.map(win => (
            <div className="player-of-day-win" key={`${win.winDate}-${win.id}`}>
              <span className="player-of-day-win-date">{displayDate(win.winDate)}</span>
              <SportsCard
                build={win}
                viewTo={`/build/${win.id}?from=player-of-day`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
