import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ARCHETYPE_CHARACTER_RULES, type CollectionBuild, type DrawingCollectionStats,
} from '@shared/index';
import { useAuth } from '../auth';
import { api, type MarketDrawingRequest } from '../api';

const DRAWING_BUILD_HINTS: Record<string, string> = {
  'b1-top-left': 'Versatile two-way or playmaking builds',
  'b1-top-middle': 'Creative guard or underdog builds',
  'b1-top-right': 'Shooting or scoring builds',
  'b1-bottom-left': 'Elite scoring or athletic builds',
  'b2-left': 'Interior or big-man builds',
  'b2-middle': 'Athletic two-way guard builds',
  'b2-right': 'Playmaking or athletic builds',
  'b3-left': 'Elite all-around or two-way builds',
  'b3-middle': 'Balanced playmaking builds',
  'b3-right': 'Physical interior or defensive builds',
  'b4-left': 'Developing big or defensive builds',
  'b4-middle': 'Shooting or playmaking builds',
  'b4-right': 'Shooting or all-around wing builds',
  'b5-left': 'Interior or defensive builds',
  'b5-right': 'Elite scoring or two-way builds',
  'b6-middle': 'Legendary all-around builds',
  'ball-handler': 'Ball-handling or scoring builds',
  brian: 'Defensive or balanced wing builds',
  steven: 'Unconventional or developing builds',
  'wonder-woman': 'Versatile two-way or interior builds',
  'a1-left': 'Elite shooting big builds',
  'a1-right': 'Elite athletic two-way builds',
  'a2-middle': '99 overall legendary builds',
  'a3-left': 'Physical interior builds',
  'a3-middle': 'Two-way defensive creator builds',
  'a3-right': 'Developing finishing builds',
  'a4-left': '99 overall legendary builds',
  'a4-middle': '99 overall legendary builds',
  'a4-right': '99 overall legendary builds',
  'a5-left': 'Quick scoring guard builds',
  'a5-right': 'Young two-way guard builds',
  'a6-left': 'Interior defensive finisher builds',
  'a6-middle': 'Steady playmaking guard builds',
  'a6-right': 'Creative scoring guard builds',
  'a7-left': '99 overall legendary builds',
  'a8-left': 'Rebounding and strength builds',
  'a8-middle': 'Quick midrange scoring builds',
  'a8-right': 'Shooting and ball-handling builds',
  'gs-sharpshooter': 'Shooting and ball-handling builds',
};

function formatOverallRange(minOverall: number, maxOverall: number) {
  if (minOverall === maxOverall) return `${minOverall} overall`;
  if (minOverall <= 0) return `${maxOverall} overall or lower`;
  return `${minOverall}-${maxOverall} overall`;
}

export function DrawingCollection() {
  const { user, loading } = useAuth();
  const [builds, setBuilds] = useState<CollectionBuild[] | null>(null);
  const [drawingStats, setDrawingStats] = useState<DrawingCollectionStats | null>(null);
  const [customRequests, setCustomRequests] = useState<MarketDrawingRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setBuilds(null);
      setDrawingStats(null);
      setCustomRequests(null);
      return;
    }
    setError(null);
    Promise.all([api.collection(), api.drawingStats(), api.drawingRequests()])
      .then(([collection, stats, requests]) => {
        setBuilds(collection);
        setDrawingStats(stats);
        setCustomRequests(requests);
      })
      .catch(err => setError((err as Error).message));
  }, [user]);

  const drawings = useMemo(() => {
    return ARCHETYPE_CHARACTER_RULES.map((drawing, index) => ({
      id: drawing.id,
      src: drawing.src,
      number: index + 1,
      collected: (drawingStats?.[drawing.id]?.cards ?? 0) > 0,
      collectionStats: drawingStats?.[drawing.id] ?? {
        cards: 0,
        highestOverall: 0,
        playerOfDayWins: 0,
      },
      overallRange: formatOverallRange(drawing.minOverall, drawing.maxOverall),
      buildHint: drawing.minOverall === 99 && drawing.maxOverall === 99
        ? '?'
        : DRAWING_BUILD_HINTS[drawing.id] ?? 'A matching all-around build',
    }));
  }, [drawingStats]);

  const selectedDrawing = drawings.find(drawing => drawing.id === selectedDrawingId);

  useEffect(() => {
    if (!selectedDrawing) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedDrawingId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedDrawing]);

  if (loading) return <div className="notice">Loading drawings…</div>;
  if (!user) return <div className="notice">Log in to view your drawing collection.</div>;
  if (error) return <div className="notice error">Couldn’t load drawings: {error}</div>;
  if (!builds || !drawingStats || !customRequests) return <div className="notice">Loading drawings…</div>;

  const collectedCount = drawings.filter(drawing => drawing.collected).length;

  return (
    <div className="drawing-collection">
      <div className="collection-subpage-head">
        <Link className="link" to="/collection">Back to Collection</Link>
        <h2 className="results-title">Player Drawings</h2>
        <p>{collectedCount}/{drawings.length} collected</p>
      </div>
      {customRequests.length > 0 && (
        <section className="custom-drawing-placeholders" aria-label="Custom drawing placeholders">
          <h3>Custom Drawing Placeholders</h3>
          <div className="drawing-collection-grid">
            {customRequests.map(request => (
              <div className="drawing-collection-item custom-drawing-placeholder" key={request.id}>
                <div className="custom-drawing-placeholder-art">
                  <span>?</span>
                </div>
                <b>{request.subject}</b>
                <small>{request.status === 'paid' ? 'In review' : 'Payment processing'}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="drawing-collection-grid">
        {drawings.map(drawing => {
          const drawingImage = (
            <img src={drawing.src} alt={`Player drawing ${drawing.number}`} />
          );

          return (
            <button
              aria-label={drawing.collected
                ? `See collection stats for player drawing ${drawing.number}`
                : `See how to unlock player drawing ${drawing.number}`}
              className={`drawing-collection-item ${drawing.collected ? 'is-collected' : 'is-locked'}`}
              key={drawing.id}
              onClick={() => setSelectedDrawingId(drawing.id)}
              type="button"
            >
              {drawingImage}
            </button>
          );
        })}
      </div>

      {selectedDrawing && (
        <div
          className="drawing-hint-backdrop"
          onClick={() => setSelectedDrawingId(null)}
          role="presentation"
        >
          <div
            aria-labelledby="drawing-hint-title"
            aria-modal="true"
            className="drawing-hint-dialog"
            onClick={event => event.stopPropagation()}
            role="dialog"
          >
            <button
              aria-label="Close unlock details"
              className="drawing-hint-close"
              onClick={() => setSelectedDrawingId(null)}
              title="Close"
              type="button"
            >
              X
            </button>
            {selectedDrawing.collected ? (
              <>
                <p className="drawing-hint-label is-collected">COLLECTED DRAWING</p>
                <h3 id="drawing-hint-title">Your stats</h3>
                <dl className="drawing-hint-details">
                  <div>
                    <dt>Cards</dt>
                    <dd>{selectedDrawing.collectionStats.cards}</dd>
                  </div>
                  <div>
                    <dt>Highest overall</dt>
                    <dd>{selectedDrawing.collectionStats.highestOverall}</dd>
                  </div>
                  <div>
                    <dt>Player of the Day wins</dt>
                    <dd>{selectedDrawing.collectionStats.playerOfDayWins}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <p className="drawing-hint-label">LOCKED DRAWING</p>
                <h3 id="drawing-hint-title">How to unlock</h3>
                <dl className="drawing-hint-details">
                  <div>
                    <dt>Overall</dt>
                    <dd>{selectedDrawing.overallRange}</dd>
                  </div>
                  <div>
                    <dt>Build type</dt>
                    <dd>{selectedDrawing.buildHint}</dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
