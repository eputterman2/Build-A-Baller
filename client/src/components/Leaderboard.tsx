import { useEffect, useState } from 'react';
import { buildArchetype, type BuildDetail, type DrawingCollectionLeader, type PlayerOfDayLeader } from '@shared/index';
import { api } from '../api';
import { downloadCardImage, shareCardLink } from '../util';
import { SportsCard } from './SportsCard';

const GLOBAL_PAGE_SIZE = 9;
const PLAYER_OF_DAY_PAGE_SIZE = 10;
const DRAWING_LEADERS_PAGE_SIZE = 10;

function pageNumbers(currentPage: number, totalPages: number) {
  const pages = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter(page => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  return pages.flatMap((page, index) => {
    if (index === 0 || page === pages[index - 1] + 1) return [page];
    return [`gap-${page}`, page];
  });
}

function Pagination({
  currentPage,
  totalPages,
  onChange,
  label,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
  label: string;
}) {
  if (totalPages === 0) return null;

  return (
    <nav className="leaderboard-pagination" aria-label={label}>
      <button
        className="pagination-arrow"
        type="button"
        aria-label="Previous page"
        disabled={currentPage === 1}
        onClick={() => onChange(currentPage - 1)}
      >
        &larr;
      </button>
      {pageNumbers(currentPage, totalPages).map(item => (
        typeof item === 'number' ? (
          <button
            className={`pagination-page${item === currentPage ? ' is-current' : ''}`}
            type="button"
            aria-label={`Page ${item}`}
            aria-current={item === currentPage ? 'page' : undefined}
            onClick={() => onChange(item)}
            key={item}
          >
            {item}
          </button>
        ) : (
          <span className="pagination-gap" aria-hidden="true" key={item}>...</span>
        )
      ))}
      <button
        className="pagination-arrow"
        type="button"
        aria-label="Next page"
        disabled={currentPage === totalPages}
        onClick={() => onChange(currentPage + 1)}
      >
        &rarr;
      </button>
    </nav>
  );
}

export function Leaderboard() {
  const [builds, setBuilds] = useState<BuildDetail[] | null>(null);
  const [playerOfDayLeaders, setPlayerOfDayLeaders] = useState<PlayerOfDayLeader[] | null>(null);
  const [drawingLeaders, setDrawingLeaders] = useState<DrawingCollectionLeader[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<{ id: string; label: string } | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<{ id: string; label: string } | null>(null);
  const [cardPage, setCardPage] = useState(1);
  const [leaderPage, setLeaderPage] = useState(1);
  const [drawingLeaderPage, setDrawingLeaderPage] = useState(1);

  useEffect(() => {
    Promise.all([api.leaderboard(), api.playerOfDayLeaderboard(), api.drawingCollectionLeaderboard()])
      .then(([globalBuilds, dailyLeaders, collectionLeaders]) => {
        setBuilds(globalBuilds);
        setPlayerOfDayLeaders(dailyLeaders);
        setDrawingLeaders(collectionLeaders);
      })
      .catch(e => setError((e as Error).message));
  }, []);

  if (error) return <div className="notice error">Couldn’t load leaderboard: {error}</div>;
  if (!builds || !playerOfDayLeaders || !drawingLeaders) return <div className="notice">Loading leaderboard…</div>;

  const shareBuild = async (build: BuildDetail) => {
    const archetype = buildArchetype(build.result);
    const cardName = build.identity?.playerName || archetype;
    const url = `${window.location.origin}/build/${build.id}`;
    try {
      const result = await shareCardLink({
        url,
        title: `${build.overall} OVR ${cardName}`,
        text: `I built a ${build.overall} OVR ${cardName} in Build-A-Baller. Can you beat it?`,
      });
      setShareStatus({ id: build.id, label: result === 'copied' ? 'Copied!' : 'Shared!' });
      setTimeout(() => setShareStatus(null), 1500);
    } catch {
      // Users can cancel the native share sheet; no need to show an error.
    }
  };
  const downloadBuild = async (build: BuildDetail) => {
    const archetype = buildArchetype(build.result);
    const cardName = build.identity?.playerName || archetype;
    try {
      setDownloadStatus({ id: build.id, label: 'Saving...' });
      await downloadCardImage(build.id, `${build.overall} OVR ${cardName}`);
      setDownloadStatus({ id: build.id, label: 'Saved!' });
      setTimeout(() => setDownloadStatus(null), 1500);
    } catch {
      setDownloadStatus({ id: build.id, label: 'Try Again' });
      setTimeout(() => setDownloadStatus(null), 1800);
    }
  };
  const cardPageCount = Math.ceil(builds.length / GLOBAL_PAGE_SIZE);
  const cardPageStart = (cardPage - 1) * GLOBAL_PAGE_SIZE;
  const visibleBuilds = builds.slice(cardPageStart, cardPageStart + GLOBAL_PAGE_SIZE);
  const leaderPageCount = Math.ceil(playerOfDayLeaders.length / PLAYER_OF_DAY_PAGE_SIZE);
  const leaderPageStart = (leaderPage - 1) * PLAYER_OF_DAY_PAGE_SIZE;
  const visiblePlayerOfDayLeaders = playerOfDayLeaders.slice(
    leaderPageStart,
    leaderPageStart + PLAYER_OF_DAY_PAGE_SIZE,
  );
  const drawingLeaderPageCount = Math.ceil(drawingLeaders.length / DRAWING_LEADERS_PAGE_SIZE);
  const drawingLeaderPageStart = (drawingLeaderPage - 1) * DRAWING_LEADERS_PAGE_SIZE;
  const visibleDrawingLeaders = drawingLeaders.slice(
    drawingLeaderPageStart,
    drawingLeaderPageStart + DRAWING_LEADERS_PAGE_SIZE,
  );

  return (
    <div className="leaderboard">
      <h2 className="results-title">Global Leaderboard</h2>
      {builds.length === 0 ? (
        <div className="notice">No builds yet — be the first to save one!</div>
      ) : (
        <div className="sports-card-grid">
          {visibleBuilds.map((b, i) => (
            <div className="leaderboard-card-cell" key={b.id}>
              <SportsCard build={b} rank={cardPageStart + i + 1} />
              <div className="card-export-actions">
                <button className="btn btn-small share-card-btn" onClick={() => shareBuild(b)}>
                  {shareStatus?.id === b.id ? shareStatus.label : 'Share'}
                </button>
                <button className="btn btn-small share-card-btn" onClick={() => downloadBuild(b)}>
                  {downloadStatus?.id === b.id ? downloadStatus.label : 'Download'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination
        currentPage={cardPage}
        totalPages={cardPageCount}
        onChange={setCardPage}
        label="Global leaderboard pages"
      />
      <section className="player-of-day-leaderboard">
        <h2 className="results-title">Player of the Day Leaders</h2>
        {playerOfDayLeaders.length === 0 ? (
          <div className="notice">No Player of the Day winners yet.</div>
        ) : (
          <div className="player-of-day-leader-list">
            <div className="player-of-day-leader-head">
              <span>Username</span>
              <span>Wins</span>
            </div>
            {visiblePlayerOfDayLeaders.map(leader => (
              <div className="player-of-day-leader-row" key={leader.username}>
                <b>@{leader.username}</b>
                <strong>{leader.wins}</strong>
              </div>
            ))}
          </div>
        )}
        <Pagination
          currentPage={leaderPage}
          totalPages={leaderPageCount}
          onChange={setLeaderPage}
          label="Player of the Day leaderboard pages"
        />
      </section>
      <section className="player-of-day-leaderboard">
        <h2 className="results-title">Drawing Collection Leaders</h2>
        {drawingLeaders.length === 0 ? (
          <div className="notice">No collected drawings yet.</div>
        ) : (
          <div className="player-of-day-leader-list">
            <div className="player-of-day-leader-head">
              <span>Username</span>
              <span>Drawings</span>
            </div>
            {visibleDrawingLeaders.map(leader => (
              <div className="player-of-day-leader-row" key={leader.username}>
                <b>@{leader.username}</b>
                <strong>{leader.drawings}</strong>
              </div>
            ))}
          </div>
        )}
        <Pagination
          currentPage={drawingLeaderPage}
          totalPages={drawingLeaderPageCount}
          onChange={setDrawingLeaderPage}
          label="Drawing collection leaderboard pages"
        />
      </section>
    </div>
  );
}
