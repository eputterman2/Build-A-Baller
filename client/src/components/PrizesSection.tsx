import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  FLAME_BUNDLE_DRAWING_ID, FLAME_BUNDLE_ID, PLAYER_OF_DAY_PRIZE_CHARACTER_ID,
  type ContestEntry, type ContestState,
} from '@shared/index';
import { api } from '../api';
import { useAuth } from '../auth';
import { AuthModal } from './AuthModal';

const DAILY_LEGEND_SRC = '/archetype-players/player-of-day-prize.png';
const FLAME_DRAWING_SRC = '/archetype-players/flame-fuego-curry.png?v=2';
const FLAME_ICON_SRC = '/accessories/flame/icon-flame-ball.png?v=2';
const NBA2K_PRIZE_SRC = '/prizes/nba2k26-prize.png';
const FLAME_FRAME_ID = 'flame-frame-gradient';
const CONTEST_CANVAS_WIDTH = 320;
const CONTEST_CANVAS_HEIGHT = 448;
const CONTEST_CANVAS_BG = '#fffefb';
const CONTEST_VIEWER_STORAGE_KEY = 'build-a-baller-contest-viewer';
const CONTEST_DRAFT_STORAGE_KEY = 'build-a-baller-contest-draft';
const CONTEST_WEEKLY_VOTES = 30;
const CONTEST_COLORS = [
  '#16181d',
  '#e23b30',
  '#2f59a6',
  '#1f9d63',
  '#ef8a2b',
  '#ffd848',
  '#8e44ad',
  '#ff5aa5',
  '#8b5a2b',
  '#ffffff',
];
const CONTEST_RULES = [
  'Submit one active drawing at a time.',
  'Delete your entry at any time to submit another.',
  'Voting ends on November 1st.',
  'The winner will receive a digital code for NBA 2K27 Ultra Edition.',
];

type DrawingToolMode = 'draw' | 'erase';
type ContestEntryView = 'draw' | 'review';
type ContestConfirmation = 'submit' | 'delete' | null;

type ContestExpandedPanel = 'rules' | 'draw' | null;

type ContestGalleryEntry = ContestEntry;
type ScrollPosition = { x: number; y: number };

type ImagePrizePreview = {
  title: string;
  kind: 'image';
  src: string;
  alt: string;
  complete: boolean;
};

type FramePrizePreview = {
  title: string;
  kind: 'frame';
  frameId: string;
  complete: boolean;
};

type BundlePrizePreview = {
  title: string;
  kind: 'flameBundle';
  complete: boolean;
};

type PrizePreview = ImagePrizePreview | FramePrizePreview | BundlePrizePreview | null;

function readStoredContestValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredContestValue(key: string, value: string | null) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function createContestViewerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `contest-viewer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readContestViewerId() {
  try {
    const existing = window.localStorage.getItem(CONTEST_VIEWER_STORAGE_KEY);
    if (existing) return existing;
    const next = createContestViewerId();
    window.localStorage.setItem(CONTEST_VIEWER_STORAGE_KEY, next);
    return next;
  } catch {
    return createContestViewerId();
  }
}

function popularSpotTitle(rank: number) {
  if (rank === 1) return 'Top spot open';
  if (rank === 2) return 'Second spot open';
  if (rank === 3) return 'Third spot open';
  if (rank === 4) return 'Fourth spot open';
  return `#${rank} spot open`;
}

function voteCountLabel(votes: number) {
  return `${votes} ${votes === 1 ? 'vote' : 'votes'}`;
}

function emptyContestEntry(id: string, rank?: number): ContestGalleryEntry {
  return {
    id,
    title: rank ? popularSpotTitle(rank) : 'Open slot',
    artist: rank ? 'No entry yet' : 'Waiting for entries',
    votes: 0,
    src: null,
    submittedAt: null,
    rank: rank ?? null,
    isOwnEntry: false,
    viewerHasVoted: false,
  };
}

function fillContestEntries(
  entries: ContestGalleryEntry[],
  minimumCount: number,
  idPrefix: string,
  ranked = false,
): ContestGalleryEntry[] {
  const filled = [...entries];
  while (filled.length < minimumCount) {
    const rank = filled.length + 1;
    filled.push(emptyContestEntry(`${idPrefix}-${rank}`, ranked ? rank : undefined));
  }
  const remainder = filled.length % 4;
  if (remainder) {
    const needed = 4 - remainder;
    for (let index = 0; index < needed; index += 1) {
      const rank = filled.length + 1;
      filled.push(emptyContestEntry(`${idPrefix}-${rank}`, ranked ? rank : undefined));
    }
  }
  return filled;
}

function PrizeStatus({ complete }: { complete: boolean }) {
  return (
    <span className={`prize-status ${complete ? 'is-complete' : 'is-incomplete'}`}>
      {complete ? 'Completed' : 'Incomplete'}
    </span>
  );
}

function ContestDrawingTool({
  brushSize,
  draftSrc,
  entryView,
  entryRank,
  entryVotes,
  isExpanded = false,
  onDeleteEntry,
  onBrushSizeChange,
  onDraftChange,
  onExpand,
  onEntryViewChange,
  onSubmitEntry,
  submittedSrc,
  weeklyVotesLeft,
}: {
  brushSize: number;
  draftSrc: string | null;
  entryView: ContestEntryView;
  entryRank: number | null;
  entryVotes: number;
  isExpanded?: boolean;
  onDeleteEntry: () => void | Promise<void>;
  onBrushSizeChange: (size: number) => void;
  onDraftChange: (src: string | null) => void;
  onExpand?: () => void;
  onEntryViewChange: (view: ContestEntryView) => void;
  onSubmitEntry: (src: string) => boolean | Promise<boolean>;
  submittedSrc: string | null;
  weeklyVotesLeft: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const lastCommittedDraftRef = useRef<string | null>(null);
  const skipDraftSyncRef = useRef(false);
  const [mode, setMode] = useState<DrawingToolMode>('draw');
  const [color, setColor] = useState('#16181d');
  const [canUndo, setCanUndo] = useState(false);
  const [confirmation, setConfirmation] = useState<ContestConfirmation>(null);
  const [pendingSubmitSrc, setPendingSubmitSrc] = useState<string | null>(null);
  const canReviewEntry = Boolean(submittedSrc);
  const isReviewingEntry = entryView === 'review';

  const context = () => canvasRef.current?.getContext('2d') ?? null;

  const snapshot = () => {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;
    historyRef.current = [
      ...historyRef.current.slice(-14),
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    ];
    setCanUndo(true);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;
    ctx.fillStyle = CONTEST_CANVAS_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const commitDraft = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const src = canvas.toDataURL('image/png');
    lastCommittedDraftRef.current = src;
    skipDraftSyncRef.current = true;
    onDraftChange(src);
  };

  const loadDraft = (src: string | null) => {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;
    clearCanvas();
    if (!src) return;
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = src;
  };

  useEffect(() => {
    if (isReviewingEntry) return;
    loadDraft(draftSrc);
    snapshot();
    setCanUndo(false);
  }, [isReviewingEntry]);

  useEffect(() => {
    if (skipDraftSyncRef.current && draftSrc === lastCommittedDraftRef.current) {
      skipDraftSyncRef.current = false;
      return;
    }
    loadDraft(draftSrc);
    historyRef.current = [];
    setCanUndo(false);
  }, [draftSrc]);

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = context();
    if (!ctx) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = mode === 'erase' ? CONTEST_CANVAS_BG : color;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  };

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    snapshot();
    drawingRef.current = true;
    const point = pointFromEvent(event);
    lastPointRef.current = point;
    drawLine(point, point);
  };

  const continueDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPointRef.current) return;
    const point = pointFromEvent(event);
    drawLine(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const stopDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const wasDrawing = drawingRef.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
    lastPointRef.current = null;
    if (wasDrawing) commitDraft();
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = context();
    const previous = historyRef.current.pop();
    if (!canvas || !ctx || !previous) return;
    ctx.putImageData(previous, 0, 0);
    setCanUndo(historyRef.current.length > 0);
    commitDraft();
  };

  const clear = () => {
    snapshot();
    clearCanvas();
    lastCommittedDraftRef.current = null;
    skipDraftSyncRef.current = true;
    onDraftChange(null);
  };

  const resetDraft = () => {
    clearCanvas();
    historyRef.current = [];
    setCanUndo(false);
    lastCommittedDraftRef.current = null;
    skipDraftSyncRef.current = true;
    onDraftChange(null);
  };

  const readCanvasSrc = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  const handleExpandKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!onExpand || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onExpand();
  };

  const closeConfirmation = () => {
    setConfirmation(null);
    setPendingSubmitSrc(null);
  };

  const handleSubmit = () => {
    const src = readCanvasSrc();
    if (!src) return;
    setPendingSubmitSrc(src);
    setConfirmation('submit');
  };

  const handleConfirmSubmit = async () => {
    const src = pendingSubmitSrc;
    if (!src) return;
    setConfirmation(null);
    const submitted = await onSubmitEntry(src);
    if (submitted) resetDraft();
    setPendingSubmitSrc(null);
  };

  const handleDelete = () => {
    if (!canReviewEntry) return;
    setConfirmation('delete');
  };

  const handleConfirmDelete = async () => {
    setConfirmation(null);
    await onDeleteEntry();
    setPendingSubmitSrc(null);
  };

  return (
    <section
      aria-label="Contest drawing tool"
      className={`contest-drawing-tool${onExpand ? ' is-expandable' : ''}${isExpanded ? ' is-expanded' : ''}${confirmation ? ' has-confirmation' : ''}`}
      onClick={onExpand}
      onKeyDown={handleExpandKey}
      role={onExpand ? 'button' : undefined}
      tabIndex={onExpand ? 0 : undefined}
    >
      <div className="contest-tool-head">
        <div>
          <h3>Draw Your Entry</h3>
          <p>Make a player drawing on a blank Build-A-Baller card.</p>
        </div>
        <div className="contest-entry-switch" aria-label="Entry view" onClick={event => event.stopPropagation()}>
          <button
            className={entryView === 'draw' ? 'is-active' : ''}
            onClick={() => onEntryViewChange('draw')}
            type="button"
          >
            Draw
          </button>
          <button
            className={isReviewingEntry ? 'is-active' : ''}
            onClick={() => onEntryViewChange('review')}
            type="button"
          >
            Review
          </button>
        </div>
      </div>

      {isReviewingEntry ? (
        <div className="contest-tool-layout" onClick={event => event.stopPropagation()}>
          <div className={`contest-card-canvas-wrap contest-submitted-card-wrap${submittedSrc ? '' : ' is-empty'}`}>
            {submittedSrc ? (
              <img className="contest-submitted-card-image" src={submittedSrc} alt="Your submitted contest drawing" />
            ) : (
              <span>No entry yet</span>
            )}
          </div>

          <div className="contest-tool-panel contest-review-panel">
            <div className="contest-review-stats" aria-live="polite">
              <div>
                <span>Your Votes</span>
                <strong>{entryVotes}</strong>
              </div>
              <div>
                <span>Weekly Votes Left</span>
                <strong>{weeklyVotesLeft}</strong>
              </div>
              <div>
                <span>Rank</span>
                <strong>{entryRank ? `#${entryRank}` : 'N/A'}</strong>
              </div>
              <button
                className="btn btn-primary contest-review-delete-button"
                disabled={!canReviewEntry}
                onClick={handleDelete}
                type="button"
              >
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="contest-tool-layout" onClick={event => event.stopPropagation()}>
          <div className="contest-card-canvas-wrap" onClick={event => event.stopPropagation()}>
            <canvas
              aria-label="Blank card drawing canvas"
              className="contest-card-canvas"
              height={CONTEST_CANVAS_HEIGHT}
              onPointerCancel={stopDrawing}
              onPointerDown={startDrawing}
              onPointerLeave={stopDrawing}
              onPointerMove={continueDrawing}
              onPointerUp={stopDrawing}
              ref={canvasRef}
              width={CONTEST_CANVAS_WIDTH}
            />
          </div>

          <div className="contest-tool-panel" onClick={event => event.stopPropagation()}>
            <div className="contest-tool-row" aria-label="Drawing mode">
              <button
                className={`contest-tool-button${mode === 'draw' ? ' is-active' : ''}`}
                onClick={() => setMode('draw')}
                type="button"
              >
                Pencil
              </button>
              <button
                className={`contest-tool-button${mode === 'erase' ? ' is-active' : ''}`}
                onClick={() => setMode('erase')}
                type="button"
              >
                Eraser
              </button>
            </div>

            <div className="contest-color-grid" aria-label="Drawing colors">
              {CONTEST_COLORS.map(item => (
                <button
                  aria-label={`Use color ${item}`}
                  className={`contest-color-swatch${color === item && mode === 'draw' ? ' is-active' : ''}`}
                  key={item}
                  onClick={() => {
                    setColor(item);
                    setMode('draw');
                  }}
                  style={{ background: item }}
                  type="button"
                />
              ))}
            </div>

            <label className="contest-slider-label">
              <span>Brush Size</span>
              <input
                max="26"
                min="2"
                onChange={event => onBrushSizeChange(Number(event.target.value))}
                type="range"
                value={brushSize}
              />
            </label>

            <div className="contest-tool-row">
              <button className="contest-tool-button" disabled={!canUndo} onClick={undo} type="button">Undo</button>
              <button className="contest-tool-button" onClick={clear} type="button">Clear</button>
            </div>
            <button className="btn btn-primary contest-submit-drawing-button" type="button" onClick={handleSubmit}>
              Submit Drawing
            </button>
          </div>
        </div>
      )}
      {confirmation && (
        <div
          className="contest-confirm-layer"
          onClick={event => {
            event.stopPropagation();
            closeConfirmation();
          }}
          role="presentation"
        >
          <div
            aria-labelledby="contest-confirm-title"
            className="modal contest-confirm-modal"
            onClick={event => event.stopPropagation()}
            role="dialog"
          >
            <h2 id="contest-confirm-title">
              {confirmation === 'submit' ? 'Submit Drawing?' : 'Delete Entry?'}
            </h2>
            <p className="modal-intro">
              {confirmation === 'submit'
                ? 'Your current drawing will be replaced. Inappropriate drawings will not be eligible for the prize.'
                : 'This will remove your submitted drawing from the contest.'}
            </p>
            <div className="contest-confirm-actions">
              <button className="btn btn-ghost" onClick={closeConfirmation} type="button">Cancel</button>
              <button
                className="btn btn-primary"
                onClick={confirmation === 'submit' ? handleConfirmSubmit : handleConfirmDelete}
                type="button"
              >
                {confirmation === 'submit' ? 'Submit Drawing' : 'Delete Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ContestRulesPanel({
  isExpanded = false,
  onExpand,
  weeklyVotesLimit = CONTEST_WEEKLY_VOTES,
}: {
  isExpanded?: boolean;
  onExpand?: () => void;
  weeklyVotesLimit?: number;
}) {
  const handleExpandKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onExpand || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onExpand();
  };

  return (
    <div
      className={`contest-rules-panel${onExpand ? ' is-expandable' : ''}${isExpanded ? ' is-expanded' : ''}`}
      onClick={onExpand}
      onKeyDown={handleExpandKey}
      role={onExpand ? 'button' : undefined}
      tabIndex={onExpand ? 0 : undefined}
    >
      <h3>Rules</h3>
      <ul>
        <li>Each user gets {weeklyVotesLimit} votes every week.</li>
        {CONTEST_RULES.map(rule => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </div>
  );
}

function ContestCardPreview({
  entry,
  onPreview,
  onVote,
  rank,
  voting,
}: {
  entry: ContestGalleryEntry;
  onPreview: () => void;
  onVote?: (entry: ContestGalleryEntry) => void;
  rank?: number;
  voting?: boolean;
}) {
  const handlePreviewKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onPreview();
  };
  const artistLabel = rank ? `${entry.artist}(#${rank})` : entry.artist;

  return (
    <article
      className={`contest-entry-card is-clickable${entry.src ? '' : ' is-empty'}`}
      onClick={onPreview}
      onKeyDown={handlePreviewKey}
      role="button"
      tabIndex={0}
    >
      <div className="contest-entry-art">
        {entry.src ? (
          <img className="contest-submitted-card-image" src={entry.src} alt={`${entry.title} contest entry`} />
        ) : (
          <span>{rank ? `#${rank}` : '?'}</span>
        )}
      </div>
      <div className="contest-entry-meta">
        <button
          className="contest-vote-button"
          disabled={voting || !entry.src || entry.viewerHasVoted}
          onClick={event => {
            event.stopPropagation();
            if (entry.src) onVote?.(entry);
          }}
          onKeyDown={event => event.stopPropagation()}
          type="button"
        >
          {entry.viewerHasVoted ? 'Voted' : entry.isOwnEntry ? 'Use 1 Vote' : 'Vote'}
        </button>
        <p>{artistLabel}</p>
        <strong>{voteCountLabel(entry.votes)}</strong>
      </div>
    </article>
  );
}

export function PrizesSection() {
  const { user } = useAuth();
  const [dailyLegendComplete, setDailyLegendComplete] = useState(false);
  const [flameBundleComplete, setFlameBundleComplete] = useState(false);
  const [previewPrize, setPreviewPrize] = useState<PrizePreview>(null);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setDailyLegendComplete(false);
      setFlameBundleComplete(false);
      return () => { alive = false; };
    }

    Promise.all([api.drawingStats(), api.marketBundles()])
      .then(([stats, market]) => {
        if (!alive) return;
        setDailyLegendComplete((stats[PLAYER_OF_DAY_PRIZE_CHARACTER_ID]?.playerOfDayWins ?? 0) > 0);
        setFlameBundleComplete(
          market.ownedBundleIds.includes(FLAME_BUNDLE_ID)
            || (stats[FLAME_BUNDLE_DRAWING_ID]?.cards ?? 0) > 0,
        );
      })
      .catch(() => {
        if (!alive) return;
        setDailyLegendComplete(false);
        setFlameBundleComplete(false);
      });

    return () => { alive = false; };
  }, [user]);

  return (
    <section className="prizes-section">
      <div className="prizes-head">
        <span className="pod-kicker">Prizes</span>
      </div>
      <div className="prize-card-grid">
        <article className="prize-summary-card prize-daily-card">
          <div className="prize-card-top">
            <div className="prize-title-stack">
              <h3>Durant Player Drawing</h3>
              <p>Unlock by winning Player of the Day</p>
            </div>
            <div className="prize-media-stack">
              <button
                aria-label="Preview Durant player drawing prize"
                className="prize-art prize-daily-art"
                onClick={() => setPreviewPrize({
                  title: 'Durant Player Drawing',
                  kind: 'image',
                  src: DAILY_LEGEND_SRC,
                  alt: 'Durant player drawing prize',
                  complete: dailyLegendComplete,
                })}
                type="button"
              >
                <img src={DAILY_LEGEND_SRC} alt="Durant player drawing prize" />
              </button>
              <div className="prize-card-meta">
                <PrizeStatus complete={dailyLegendComplete} />
              </div>
            </div>
          </div>
        </article>
        <article className="prize-summary-card prize-flame-card">
          <div className="prize-card-top">
            <div className="prize-title-stack">
              <h3>Flame Bundle</h3>
              <p>Reach #1 in any leaderboard tier</p>
            </div>
            <div className="prize-media-stack">
              <button
                aria-label="Preview Flame Bundle"
                className="prize-art prize-flame-bundle-art"
                onClick={() => setPreviewPrize({
                  title: 'Flame Bundle',
                  kind: 'flameBundle',
                  complete: flameBundleComplete,
                })}
                type="button"
              >
                <img src={FLAME_ICON_SRC} alt="Flame basketball user icon" />
              </button>
              <div className="prize-card-meta">
                <PrizeStatus complete={flameBundleComplete} />
              </div>
            </div>
          </div>
        </article>
        <article className="prize-summary-card prize-featured">
          <div className="prize-card-top">
            <div className="prize-title-stack prize-rules-title-stack">
              <h3>NBA 2K27</h3>
              <p>Custom Drawing Contest</p>
            </div>
            <div className="prize-media-stack">
              <button
                aria-label="Preview NBA 2K27 prize drawing"
                className="prize-art prize-2k-art"
                onClick={() => setPreviewPrize({
                  title: 'Win NBA 2K27',
                  kind: 'image',
                  src: NBA2K_PRIZE_SRC,
                  alt: 'NBA 2K27 prize drawing',
                  complete: false,
                })}
                type="button"
              >
                <img src={NBA2K_PRIZE_SRC} alt="NBA 2K27 prize drawing" />
              </button>
              <div className="prize-card-meta">
                <Link className="btn btn-primary prize-link" to="/prizes/2k-contest">Enter</Link>
              </div>
            </div>
          </div>
        </article>
      </div>

      {previewPrize && (
        <div className="modal-backdrop" onClick={() => setPreviewPrize(null)} role="presentation">
          <div className="modal prize-preview-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="prize-preview-title">
            <h2 id="prize-preview-title">{previewPrize.title}</h2>
            <div className="prize-preview-art">
              {previewPrize.kind === 'flameBundle' ? (
                <div className="prize-bundle-preview-grid" aria-label="Flame Bundle prizes">
                  <button
                    className="prize-bundle-preview-item"
                    onClick={() => setPreviewPrize({
                      title: 'Flame Icon',
                      kind: 'image',
                      src: FLAME_ICON_SRC,
                      alt: 'Flame basketball user icon',
                      complete: flameBundleComplete,
                    })}
                    type="button"
                  >
                    <img src={FLAME_ICON_SRC} alt="Flame basketball user icon" />
                    <span>Flame Icon</span>
                  </button>
                  <button
                    className="prize-bundle-preview-item"
                    onClick={() => setPreviewPrize({
                      title: 'Flame Frame',
                      kind: 'frame',
                      frameId: FLAME_FRAME_ID,
                      complete: flameBundleComplete,
                    })}
                    type="button"
                  >
                    <span className="frame-preview prize-frame-preview-small" aria-hidden="true">
                      <span className={`frame-preview-card sports-card-front has-card-frame card-frame-${FLAME_FRAME_ID}`} />
                    </span>
                    <span>Flame Frame</span>
                  </button>
                  <button
                    className="prize-bundle-preview-item"
                    onClick={() => setPreviewPrize({
                      title: 'Fuego Curry',
                      kind: 'image',
                      src: FLAME_DRAWING_SRC,
                      alt: 'Fuego Curry player drawing',
                      complete: flameBundleComplete,
                    })}
                    type="button"
                  >
                    <img src={FLAME_DRAWING_SRC} alt="Fuego Curry player drawing" />
                    <span>Fuego Curry</span>
                  </button>
                </div>
              ) : previewPrize.kind === 'frame' ? (
                <span className="frame-preview prize-frame-preview-large" aria-hidden="true">
                  <span className={`frame-preview-card sports-card-front has-card-frame card-frame-${previewPrize.frameId}`} />
                </span>
              ) : (
                <img src={previewPrize.src} alt={previewPrize.alt} />
              )}
            </div>
            <PrizeStatus complete={previewPrize.complete} />
          </div>
        </div>
      )}
    </section>
  );
}

export function PrizeDetailsPage() {
  const { user, loading: authLoading } = useAuth();
  const [viewerId] = useState(readContestViewerId);
  const [drawingDraftSrc, setDrawingDraftSrc] = useState<string | null>(() => readStoredContestValue(CONTEST_DRAFT_STORAGE_KEY));
  const [contestBrushSize, setContestBrushSize] = useState(8);
  const [entryView, setEntryView] = useState<ContestEntryView>('draw');
  const initialEntryViewAppliedRef = useRef(false);
  const [expandedPanel, setExpandedPanel] = useState<ContestExpandedPanel>(null);
  const [contest, setContest] = useState<ContestState | null>(null);
  const [contestLoading, setContestLoading] = useState(true);
  const [contestError, setContestError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [votingEntryId, setVotingEntryId] = useState<string | null>(null);
  const [popularPage, setPopularPage] = useState(0);
  const [submissionPage, setSubmissionPage] = useState(0);
  const [previewEntry, setPreviewEntry] = useState<{ entry: ContestGalleryEntry; rank?: number } | null>(null);
  const pendingScrollRestoreRef = useRef<ScrollPosition | null>(null);

  const loadContest = useCallback(async (quiet = false) => {
    if (!quiet) setContestLoading(true);
    setContestError(null);
    try {
      setContest(await api.contest(viewerId));
    } catch (err) {
      setContestError((err as Error).message);
    } finally {
      if (!quiet) setContestLoading(false);
    }
  }, [viewerId]);

  const popularEntries = fillContestEntries(contest?.popularEntries ?? [], 28, 'popular-empty', true);
  const allSubmissionEntries = fillContestEntries(contest?.allSubmissionEntries ?? [], 8, 'gallery-empty');
  const popularPages = Math.ceil(popularEntries.length / 4);
  const submissionPages = Math.ceil(allSubmissionEntries.length / 4);
  const safePopularPage = popularPage % popularPages;
  const safeSubmissionPage = submissionPage % submissionPages;
  const visiblePopularEntries = popularEntries.slice(safePopularPage * 4, safePopularPage * 4 + 4);
  const visibleSubmissionEntries = allSubmissionEntries.slice(safeSubmissionPage * 4, safeSubmissionPage * 4 + 4);
  const submittedEntrySrc = contest?.myEntry?.src ?? null;
  const ownTopRank = contest?.myEntry?.rank ?? null;
  const contestStatusText = contestError
    ? contestError
    : submittingEntry
      ? 'Submitting drawing...'
      : deletingEntry
        ? 'Deleting entry...'
        : contestLoading
          ? 'Loading contest...'
          : '';
  const hasContestStatus = Boolean(contestStatusText);

  const queueScrollRestore = (position: ScrollPosition) => {
    pendingScrollRestoreRef.current = position;
  };

  const handleSubmitEntry = async (src: string) => {
    if (!user) {
      setShowAuth(true);
      return false;
    }
    const scrollPosition = { x: window.scrollX, y: window.scrollY };
    setSubmittingEntry(true);
    setContestError(null);
    try {
      const nextContest = await api.submitContestEntry(src);
      queueScrollRestore(scrollPosition);
      setContest(nextContest);
      return true;
    } catch (err) {
      queueScrollRestore(scrollPosition);
      setContestError((err as Error).message);
      return false;
    } finally {
      setSubmittingEntry(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    const scrollPosition = { x: window.scrollX, y: window.scrollY };
    setDeletingEntry(true);
    setContestError(null);
    try {
      const nextContest = await api.deleteContestEntry();
      queueScrollRestore(scrollPosition);
      setContest(nextContest);
      setEntryView('draw');
    } catch (err) {
      queueScrollRestore(scrollPosition);
      setContestError((err as Error).message);
    } finally {
      setDeletingEntry(false);
    }
  };

  const handleVoteEntry = async (entry: ContestGalleryEntry) => {
    if (!entry.src) return;
    if (!user) {
      setShowAuth(true);
      return;
    }
    setVotingEntryId(entry.id);
    setContestError(null);
    try {
      setContest(await api.voteContestEntry(entry.id));
    } catch (err) {
      setContestError((err as Error).message);
    } finally {
      setVotingEntryId(null);
    }
  };

  useEffect(() => {
    writeStoredContestValue(CONTEST_DRAFT_STORAGE_KEY, drawingDraftSrc);
  }, [drawingDraftSrc]);

  useEffect(() => {
    initialEntryViewAppliedRef.current = false;
    void loadContest();
  }, [loadContest, user?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadContest(true);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [loadContest]);

  useLayoutEffect(() => {
    const position = pendingScrollRestoreRef.current;
    if (!position) return undefined;
    window.scrollTo(position.x, position.y);
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo(position.x, position.y);
      if (pendingScrollRestoreRef.current === position) {
        pendingScrollRestoreRef.current = null;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  });

  useEffect(() => {
    if (authLoading || !contest) return;
    if (!initialEntryViewAppliedRef.current) {
      setEntryView(contest.myEntry ? 'review' : 'draw');
      initialEntryViewAppliedRef.current = true;
    }
  }, [authLoading, contest]);

  useEffect(() => {
    const visibleIds = [...visiblePopularEntries, ...visibleSubmissionEntries]
      .filter(entry => entry.src)
      .map(entry => entry.id);
    const uniqueVisibleIds = [...new Set(visibleIds)];
    if (!uniqueVisibleIds.length) return;
    void api.recordContestImpressions(uniqueVisibleIds, viewerId).catch(() => undefined);
  }, [viewerId, visiblePopularEntries.map(entry => entry.id).join(','), visibleSubmissionEntries.map(entry => entry.id).join(',')]);

  return (
    <section className="legal-page prize-details-page">
      <h2 className="results-title">Custom Drawing Contest</h2>
      <div className="legal-card prize-details-card">
        <section className="contest-submit-band" aria-label="Contest rules and submit entry">
          <ContestRulesPanel
            onExpand={() => setExpandedPanel('rules')}
            weeklyVotesLimit={contest?.weeklyVotesLimit ?? CONTEST_WEEKLY_VOTES}
          />

            <ContestDrawingTool
              brushSize={contestBrushSize}
              draftSrc={drawingDraftSrc}
              entryRank={ownTopRank}
              entryView={entryView}
              entryVotes={contest?.myEntry?.votes ?? 0}
              onBrushSizeChange={setContestBrushSize}
              onDeleteEntry={handleDeleteEntry}
              onDraftChange={setDrawingDraftSrc}
              onEntryViewChange={setEntryView}
              onExpand={() => setExpandedPanel('draw')}
              onSubmitEntry={handleSubmitEntry}
              submittedSrc={submittedEntrySrc}
              weeklyVotesLeft={contest?.weeklyVotesLeft ?? CONTEST_WEEKLY_VOTES}
            />
          </section>

          <p
            aria-live="polite"
            className={`contest-live-status ${contestError ? 'form-error' : 'prize-note'}${hasContestStatus ? '' : ' is-idle'}`}
          >
            {contestStatusText || '\u00a0'}
          </p>

        <section className="contest-submissions" aria-labelledby="contest-submissions-title">
          <div className="contest-section-head">
            <h3 id="contest-submissions-title">Submissions</h3>
            <p>Use your weekly votes to support your favorite drawings.</p>
          </div>

          <div className="contest-submission-board">
            <div className="contest-submission-row" aria-label="Most popular submissions">
              <h4>Most Popular</h4>
              <div className="contest-row-content">
                <button
                  aria-label="Show previous popular submissions"
                  className="contest-page-arrow"
                  onClick={() => setPopularPage((popularPage + popularPages - 1) % popularPages)}
                  type="button"
                >
                  ‹
                </button>
                <div className="contest-gallery-grid">
                  {visiblePopularEntries.map((entry, index) => (
                    <ContestCardPreview
                      entry={entry}
                      key={entry.id}
                      onPreview={() => setPreviewEntry({ entry, rank: entry.rank ?? popularPage * 4 + index + 1 })}
                      onVote={handleVoteEntry}
                      rank={entry.rank ?? popularPage * 4 + index + 1}
                      voting={votingEntryId === entry.id}
                    />
                  ))}
                </div>
                <button
                  aria-label="Show next popular submissions"
                  className="contest-page-arrow"
                  onClick={() => setPopularPage((popularPage + 1) % popularPages)}
                  type="button"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="contest-submission-row" aria-label="All submissions">
              <h4>All Submissions</h4>
              <div className="contest-row-content">
                <button
                  aria-label="Show previous submissions"
                  className="contest-page-arrow"
                  onClick={() => setSubmissionPage((submissionPage + submissionPages - 1) % submissionPages)}
                  type="button"
                >
                  ‹
                </button>
                <div className="contest-gallery-grid">
                  {visibleSubmissionEntries.map(entry => (
                    <ContestCardPreview
                      entry={entry}
                      key={entry.id}
                      onPreview={() => setPreviewEntry({ entry, rank: entry.rank ?? undefined })}
                      onVote={handleVoteEntry}
                      rank={entry.rank ?? undefined}
                      voting={votingEntryId === entry.id}
                    />
                  ))}
                </div>
                <button
                  aria-label="Show next submissions"
                  className="contest-page-arrow"
                  onClick={() => setSubmissionPage((submissionPage + 1) % submissionPages)}
                  type="button"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </section>

        <p className="prize-note">
          Votes refresh in real time. The top-ranked drawing wins the contest.
        </p>
      </div>

      {expandedPanel && (
        <div
          className="modal-backdrop"
          onPointerDown={event => {
            if (event.target === event.currentTarget) setExpandedPanel(null);
          }}
          role="presentation"
        >
          <div
            aria-label={expandedPanel === 'rules' ? 'Expanded contest rules' : 'Expanded drawing tool'}
            aria-modal="true"
            className={`contest-expanded-modal contest-expanded-${expandedPanel}-modal`}
            onClick={event => event.stopPropagation()}
            onPointerDown={event => event.stopPropagation()}
            role="dialog"
          >
            {expandedPanel === 'rules' ? (
              <ContestRulesPanel
                isExpanded
                weeklyVotesLimit={contest?.weeklyVotesLimit ?? CONTEST_WEEKLY_VOTES}
              />
            ) : (
              <ContestDrawingTool
                brushSize={contestBrushSize}
                draftSrc={drawingDraftSrc}
                entryRank={ownTopRank}
                entryView={entryView}
                entryVotes={contest?.myEntry?.votes ?? 0}
                isExpanded
                onBrushSizeChange={setContestBrushSize}
                onDeleteEntry={handleDeleteEntry}
                onDraftChange={setDrawingDraftSrc}
                onEntryViewChange={setEntryView}
                onSubmitEntry={handleSubmitEntry}
                submittedSrc={submittedEntrySrc}
                weeklyVotesLeft={contest?.weeklyVotesLeft ?? CONTEST_WEEKLY_VOTES}
              />
            )}
          </div>
        </div>
      )}

      {previewEntry && (
        <div className="modal-backdrop" onClick={() => setPreviewEntry(null)} role="presentation">
          <div
            aria-label="Expanded contest card"
            aria-modal="true"
            className="contest-card-preview-modal"
            onClick={event => event.stopPropagation()}
            role="dialog"
          >
            <div className={`contest-entry-art contest-expanded-entry-art${previewEntry.entry.src ? '' : ' is-empty-preview'}`}>
              {previewEntry.entry.src ? (
                <img className="contest-submitted-card-image" src={previewEntry.entry.src} alt={`${previewEntry.entry.title} contest entry`} />
              ) : (
                <span className={previewEntry.rank ? undefined : 'contest-expanded-question-marker'}>
                  {previewEntry.rank ? `#${previewEntry.rank}` : '?'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {showAuth && (
        <AuthModal
          intro="Log in or create an account to submit drawings and vote in the contest."
          onClose={() => {
            setShowAuth(false);
            void loadContest(true);
          }}
        />
      )}
    </section>
  );
}
