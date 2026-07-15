import { useEffect, useMemo, useState } from 'react';
import type { PlayerDrawingPoll as PlayerDrawingPollData } from '@shared/index';
import { api } from '../api';
import { useAuth } from '../auth';

const VOTER_STORAGE_KEY = 'build-a-baller-poll-voter';

function createVoterId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `voter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function loadVoterId(): string {
  try {
    const existing = window.localStorage.getItem(VOTER_STORAGE_KEY);
    if (existing) return existing;
    const next = createVoterId();
    window.localStorage.setItem(VOTER_STORAGE_KEY, next);
    return next;
  } catch {
    return createVoterId();
  }
}

export function PlayerDrawingPoll() {
  const { user } = useAuth();
  const [voterId] = useState(loadVoterId);
  const [poll, setPoll] = useState<PlayerDrawingPollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api.playerDrawingPoll(voterId)
      .then(data => { if (alive) setPoll(data); })
      .catch(err => { if (alive) setError((err as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [voterId, user]);

  const sortedOptions = useMemo(() => {
    const options = poll?.options ?? [];
    if (!poll?.viewerVoteOptionId) return options;
    return [...options].sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label));
  }, [poll]);

  const vote = async (optionId: string) => {
    if (poll?.viewerVoteOptionId) return;
    setVotingId(optionId);
    setError(null);
    try {
      setPoll(await api.votePlayerDrawingPoll(optionId, voterId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setVotingId(null);
    }
  };

  const showingResults = Boolean(poll?.viewerVoteOptionId);
  const leaderVotes = sortedOptions[0]?.votes ?? 0;

  return (
    <section className="drawing-poll">
      <div className="poll-head">
        <span className="pod-kicker">Weekly Vote</span>
        <h2>Who Should We Draw Next?</h2>
      </div>

      {loading ? (
        <div className="poll-loading">Loading the ballot…</div>
      ) : poll ? (
        <div className={`poll-options${showingResults ? ' showing-results' : ''}`}>
          {sortedOptions.map(option => {
            const percent = poll.totalVotes ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
            const isViewerPick = poll.viewerVoteOptionId === option.id;
            const isLeader = showingResults && option.votes === leaderVotes && leaderVotes > 0;
            return showingResults ? (
              <div className={`poll-result${isViewerPick ? ' selected' : ''}`} key={option.id}>
                <div className="poll-result-top">
                  <span>{option.label}</span>
                  <b>{percent}%</b>
                </div>
                <div className="poll-track">
                  <div className="poll-fill" style={{ width: `${percent}%` }} />
                </div>
                <small>
                  {option.votes} vote{option.votes === 1 ? '' : 's'}
                  {isViewerPick ? ' • your pick' : ''}
                  {isLeader ? ' • leading' : ''}
                </small>
              </div>
            ) : (
              <button
                className="poll-vote"
                key={option.id}
                disabled={!!votingId}
                onClick={() => vote(option.id)}
              >
                {votingId === option.id ? 'Voting…' : option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="poll-loading">Couldn’t load this week’s poll.</div>
      )}

      {showingResults && poll && (
        <div className="poll-total">{poll.totalVotes} total vote{poll.totalVotes === 1 ? '' : 's'}</div>
      )}
      {error && <div className="form-error poll-error">{error}</div>}
    </section>
  );
}
