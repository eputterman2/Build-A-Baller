import { buildArchetype, type PlayerOfDay as PlayerOfDayData } from '@shared/index';
import { SportsCard } from './SportsCard';

interface PlayerOfDayProps {
  data: PlayerOfDayData | null;
  loading?: boolean;
  compact?: boolean;
}

export function PlayerOfDay({ data, loading = false, compact = false }: PlayerOfDayProps) {
  const build = data?.build ?? null;
  const className = `player-of-day${compact ? ' player-of-day-compact' : ''}`;

  if (loading) {
    return (
      <section className={className}>
        <div className="pod-copy">
          <span className="pod-kicker">Player of the Day</span>
          <h2>Loading today’s crown…</h2>
        </div>
      </section>
    );
  }

  if (!build) {
    return (
      <section className={className}>
        <div className="pod-copy">
          <span className="pod-kicker">Player of the Day</span>
          <h2>No winner yet today</h2>
          <p>Save a build to the leaderboard and your card could be the first one up.</p>
        </div>
      </section>
    );
  }

  const archetype = buildArchetype(build.result);

  return (
    <section className={className}>
      <div className="pod-copy">
        <span className="pod-kicker">Player of the Day</span>
        <h2 className="pod-winner-title">
          {build.overall} OVR {archetype}
        </h2>
        <p className="pod-winner-copy">
          <strong>Owned by @{build.username}</strong>
          <span>Today’s top saved card. Build higher before midnight to take the spot.</span>
        </p>
      </div>
      <div className="pod-card">
        <SportsCard build={build} viewLabel="view" />
      </div>
    </section>
  );
}
