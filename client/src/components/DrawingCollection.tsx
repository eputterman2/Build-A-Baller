import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ARCHETYPE_CHARACTER_RULES, FLAME_BUNDLE_DRAWING_ID, PLAYER_OF_DAY_PRIZE_CHARACTER_ID,
  type CollectionBuild, type DrawingCollectionStats,
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
  [FLAME_BUNDLE_DRAWING_ID]: 'Shooting and ball-handling builds',
  [PLAYER_OF_DAY_PRIZE_CHARACTER_ID]: 'Tall shooting and finishing builds',
};

function isBaySniperDrawing(drawing: { id: string; name: string }) {
  return drawing.id === 'gs-sharpshooter' || drawing.name.trim().toLowerCase() === 'bay sniper';
}

function isFuegoCurryDrawing(drawing: { id: string; name: string }) {
  return drawing.id === FLAME_BUNDLE_DRAWING_ID || drawing.name.trim().toLowerCase() === 'fuego curry';
}

function isHighFlyerDrawing(drawing: { id: string; name: string }) {
  return drawing.id === 'b5-right' || drawing.name.trim().toLowerCase() === 'high flyer';
}

function drawingCollectionItemClass(drawing: { id: string; name: string; unlocked: boolean }) {
  return `drawing-collection-item ${drawing.unlocked ? 'is-collected' : 'is-locked'}`
    + `${isBaySniperDrawing(drawing) ? ' is-bay-sniper-drawing' : ''}`
    + `${isHighFlyerDrawing(drawing) ? ' is-high-flyer-drawing' : ''}`;
}

function isPrizeDrawing(drawing: { id: string; name: string; rewardPrize?: boolean }) {
  return isBaySniperDrawing(drawing)
    || isFuegoCurryDrawing(drawing)
    || drawing.id === PLAYER_OF_DAY_PRIZE_CHARACTER_ID
    || Boolean(drawing.rewardPrize);
}

function drawingPrizeName(drawing: { id: string; name: string; rewardPrize?: boolean }) {
  if (isBaySniperDrawing(drawing)) return '3 Day Login Prize';
  if (isFuegoCurryDrawing(drawing)) return 'Leaderboard Tier Prize';
  if (drawing.id === PLAYER_OF_DAY_PRIZE_CHARACTER_ID) return 'Player of the Day Prize';
  if (drawing.rewardPrize) return '93+ OVR Prize';
  return 'Prize';
}

function formatOverallRange(minOverall: number, maxOverall: number) {
  if (minOverall <= 0 && maxOverall >= 99) return 'Any overall';
  if (minOverall === maxOverall) return `${minOverall} overall`;
  if (minOverall <= 0) return `${maxOverall} overall or lower`;
  return `${minOverall}-${maxOverall} overall`;
}

export function DrawingCollection() {
  const { user, loading } = useAuth();
  const [builds, setBuilds] = useState<CollectionBuild[] | null>(null);
  const [drawingStats, setDrawingStats] = useState<DrawingCollectionStats | null>(null);
  const [customRequests, setCustomRequests] = useState<MarketDrawingRequest[] | null>(null);
  const [ownedMarketDrawingIds, setOwnedMarketDrawingIds] = useState<string[]>([]);
  const [rewardDrawingIds, setRewardDrawingIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setBuilds(null);
      setDrawingStats(null);
      setCustomRequests(null);
      setOwnedMarketDrawingIds([]);
      setRewardDrawingIds([]);
      return;
    }
    setError(null);
    Promise.all([api.collection(), api.drawingStats(), api.drawingRequests(), api.marketBundles()])
      .then(([collection, stats, requests, market]) => {
        setBuilds(collection);
        setDrawingStats(stats);
        setCustomRequests(requests);
        setRewardDrawingIds(market.rewardDrawingIds ?? []);
        const ownedSet = new Set(market.ownedBundleIds);
        const bundleOptions = [...market.bundles, ...(market.rewardBundles ?? [])];
        setOwnedMarketDrawingIds(bundleOptions
          .filter(bundle => ownedSet.has(bundle.id))
          .map(bundle => bundle.drawingId)
          .concat(market.rewardDrawingIds ?? []));
      })
      .catch(err => setError((err as Error).message));
  }, [user]);

  const drawings = useMemo(() => {
    const ownedMarketDrawingSet = new Set(ownedMarketDrawingIds);
    const rewardDrawingSet = new Set(rewardDrawingIds);
    const customDrawings = (customRequests ?? [])
      .filter(request => request.status === 'fulfilled' && request.finalDrawingSrc)
      .map(request => ({
        id: request.characterId,
        src: request.finalDrawingSrc,
        name: request.finalName || request.subject,
        number: null,
        custom: true,
        collected: (drawingStats?.[request.characterId]?.cards ?? 0) > 0,
        marketUnlocked: true,
        prizeUnlocked: false,
        rewardPrize: false,
        unlocked: true,
        collectionStats: drawingStats?.[request.characterId] ?? {
          cards: 0,
          highestOverall: 0,
          playerOfDayWins: 0,
        },
        overallRange: formatOverallRange(request.minOverall, request.maxOverall),
        buildHint: request.buildHint || 'Custom drawing',
      }));
    const standardDrawings = ARCHETYPE_CHARACTER_RULES.map((drawing, index) => {
      const stats = drawingStats?.[drawing.id] ?? {
        cards: 0,
        highestOverall: 0,
        playerOfDayWins: 0,
      };
      const marketUnlocked = ownedMarketDrawingSet.has(drawing.id);
      const prizeUnlocked = drawing.id === PLAYER_OF_DAY_PRIZE_CHARACTER_ID && stats.playerOfDayWins > 0;
      return {
        id: drawing.id,
        src: drawing.src,
        name: drawing.name,
        number: index + 1,
        custom: false,
        collected: stats.cards > 0,
        marketUnlocked,
        prizeUnlocked,
        rewardPrize: rewardDrawingSet.has(drawing.id),
        unlocked: stats.cards > 0 || marketUnlocked || prizeUnlocked,
        collectionStats: stats,
        overallRange: 'Any overall',
        buildHint: drawing.minOverall === 99 && drawing.maxOverall === 99
          ? '?'
          : DRAWING_BUILD_HINTS[drawing.id] ?? 'A matching all-around build',
      };
    });
    return [...customDrawings, ...standardDrawings];
  }, [customRequests, drawingStats, ownedMarketDrawingIds, rewardDrawingIds]);

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

  const collectedCount = drawings.filter(drawing => drawing.unlocked).length;
  const unfinishedCustomRequests = customRequests.filter(
    request => request.status !== 'fulfilled' || !request.finalDrawingSrc,
  );
  const fulfilledCustomDrawings = drawings.filter(drawing => drawing.custom);
  const standardDrawings = drawings.filter(drawing => !drawing.custom);

  const deleteRejectedRequest = async (request: MarketDrawingRequest) => {
    if (request.status !== 'rejected') return;
    if (!window.confirm('Delete this rejected drawing placeholder?')) return;
    setDeletingRequestId(request.id);
    setDeleteError(null);
    try {
      await api.deleteDrawingRequest(request.id);
      setCustomRequests(current => current?.filter(item => item.id !== request.id) ?? current);
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeletingRequestId(null);
    }
  };

  return (
    <div className="drawing-collection">
      <div className="collection-subpage-head">
        <Link className="link" to="/collection">Back to Collection</Link>
        <h2 className="results-title">Player Drawings</h2>
        <p>{collectedCount}/{drawings.length} collected</p>
      </div>
      <div className="drawing-collection-grid">
        {fulfilledCustomDrawings.map(drawing => {
          const drawingLabel = drawing.custom
            ? drawing.name
            : `player drawing ${drawing.number}`;

          return (
            <button
              aria-label={drawing.collected
                ? `See collection stats for ${drawingLabel}`
                : drawing.marketUnlocked || drawing.prizeUnlocked
                  ? `See unlock details for ${drawingLabel}`
                  : `See how to collect ${drawingLabel}`}
              className={drawingCollectionItemClass(drawing)}
              key={drawing.id}
              onClick={() => setSelectedDrawingId(drawing.id)}
              type="button"
            >
              <img src={drawing.src} alt={drawing.custom ? drawing.name : `Player drawing ${drawing.number}`} />
            </button>
          );
        })}
        {unfinishedCustomRequests.map(request => (
          <div className="drawing-collection-item custom-drawing-placeholder" key={request.id}>
            <div className="custom-drawing-placeholder-art">
              <span>?</span>
            </div>
            <b>{request.finalName || request.subject}</b>
            <small>{request.statusLabel}</small>
            {request.status === 'rejected' && (
              <button
                className="custom-drawing-delete"
                disabled={deletingRequestId === request.id}
                onClick={() => deleteRejectedRequest(request)}
                type="button"
              >
                {deletingRequestId === request.id ? 'deleting...' : 'delete'}
              </button>
            )}
          </div>
        ))}
        {standardDrawings.map(drawing => {
          const drawingLabel = `player drawing ${drawing.number}`;

          return (
            <button
              aria-label={drawing.collected
                ? `See collection stats for ${drawingLabel}`
                : drawing.marketUnlocked || drawing.prizeUnlocked
                  ? `See unlock details for ${drawingLabel}`
                  : `See how to collect ${drawingLabel}`}
              className={drawingCollectionItemClass(drawing)}
              key={drawing.id}
              onClick={() => setSelectedDrawingId(drawing.id)}
              type="button"
            >
              <img src={drawing.src} alt={`Player drawing ${drawing.number}`} />
            </button>
          );
        })}
      </div>
      {deleteError && <div className="form-error drawing-delete-error">{deleteError}</div>}

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
            {selectedDrawing.collected ? (
              <>
                <p className="drawing-hint-label is-collected">COLLECTED DRAWING</p>
                <h3 className="drawing-hint-name">{selectedDrawing.name}</h3>
                <h4 id="drawing-hint-title">Your stats</h4>
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
            ) : selectedDrawing.marketUnlocked || selectedDrawing.prizeUnlocked ? (
              <>
                <p className="drawing-hint-label is-collected">UNLOCKED DRAWING</p>
                <h3 className="drawing-hint-name">{selectedDrawing.name}</h3>
                <h4 id="drawing-hint-title">Ready to use</h4>
                <dl className="drawing-hint-details">
                  <div>
                    <dt>{isPrizeDrawing(selectedDrawing) ? 'Prize' : 'Source'}</dt>
                    <dd>{isPrizeDrawing(selectedDrawing)
                        ? drawingPrizeName(selectedDrawing)
                      : selectedDrawing.custom
                        ? 'Custom Drawing'
                      : selectedDrawing.prizeUnlocked
                        ? 'Player of the Day Prize'
                        : 'Golden State Bundle'}</dd>
                  </div>
                  <div>
                    <dt>Use it</dt>
                    <dd>Eligible saved cards</dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <p className="drawing-hint-label">LOCKED DRAWING</p>
                <h3 className="drawing-hint-name">{selectedDrawing.name}</h3>
                <h4 id="drawing-hint-title">How to collect</h4>
                <dl className="drawing-hint-details">
                  {isPrizeDrawing(selectedDrawing) ? (
                    <>
                      <div>
                        <dt>Prize</dt>
                        <dd>Complete the {drawingPrizeName(selectedDrawing)}</dd>
                      </div>
                      <div>
                        <dt>Use it</dt>
                        <dd>Any saved card</dd>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <dt>Overall</dt>
                        <dd>{selectedDrawing.overallRange}</dd>
                      </div>
                      <div>
                        <dt>Build type</dt>
                        <dd>{selectedDrawing.buildHint}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
