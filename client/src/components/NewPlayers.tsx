import { useEffect, useState } from 'react';
import { api, type RecentPlayerDrawing } from '../api';

const REFRESH_MS = 60_000;

export function NewPlayers() {
  const [drawings, setDrawings] = useState<RecentPlayerDrawing[]>([]);
  const [flippedCardKeys, setFlippedCardKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const load = () => {
      api.recentPlayerDrawings()
        .then(data => {
          if (!alive) return;
          setDrawings(data.slice(0, 3));
          setError(null);
        })
        .catch(err => {
          if (!alive) return;
          setError((err as Error).message);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    };

    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const cards = drawings.slice(0, 3);

  return (
    <section className="new-players">
      <div className="new-players-head">
        <span className="pod-kicker">New Players</span>
        <h2>Recently Added Drawings</h2>
      </div>

      <div
        className={`new-player-card-grid count-${Math.max(cards.length, 1)}`}
        aria-label="Most recent player drawings added to the game"
      >
        {cards.map((drawing, index) => {
          const cardKey = `${drawing.id}:${index}`;
          const flipped = flippedCardKeys.includes(cardKey);
          return (
            <button
              aria-label={
                flipped
                  ? `Show ${drawing.name} drawing`
                  : `Show how to get ${drawing.name}`
              }
              aria-pressed={flipped}
              className={`new-player-card new-drawing-flip-card${flipped ? ' is-flipped' : ''}`}
              key={cardKey}
              onClick={() => setFlippedCardKeys(current =>
                current.includes(cardKey)
                  ? current.filter(key => key !== cardKey)
                  : [...current, cardKey])}
              type="button"
            >
              <span className="new-drawing-flip-inner">
                <span className="new-drawing-card-face new-drawing-card-front" aria-hidden={flipped}>
                  <span className="new-player-card-inner">
                    <img src={drawing.src} alt={drawing.name} />
                  </span>
                </span>
                <span className="new-drawing-card-face new-drawing-card-back" aria-hidden={!flipped}>
                  <span className="new-drawing-back-kicker">How to get it</span>
                  <b>{drawing.name}</b>
                  <span>{drawing.obtainText}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {cards.length === 0 && (
        <div className="poll-loading">{loading ? 'Loading...' : 'No new drawings yet.'}</div>
      )}
      {error && <div className="form-error poll-error">{error}</div>}

    </section>
  );
}
