import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { buildArchetypeTitle, type BuildDetail } from '@shared/index';
import { api } from '../api';
import { Results } from './Results';
import { SportsCard } from './SportsCard';

export function BuildPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [build, setBuild] = useState<BuildDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.build(id).then(setBuild).catch(e => setError((e as Error).message));
  }, [id]);

  if (error) return <div className="notice error">{error}</div>;
  if (!build) return <div className="notice">Loading build…</div>;

  const source = searchParams.get('from');
  const returnTo = source === 'collection'
    ? '/collection'
    : source === 'player-of-day'
      ? '/collection/player-of-day'
      : '/leaderboard';
  const returnLabel = source === 'player-of-day'
    ? 'Player of the Day'
    : source === 'collection'
      ? 'Collection'
      : 'Leaderboard';

  return (
    <div className="results">
      <h2 className="results-title">@{build.username}: {buildArchetypeTitle(build.result)}</h2>
      <div className="shared-card-stage">
        <SportsCard build={build} viewTo={returnTo} viewLabel={`back to ${returnLabel.toLowerCase()}`} />
      </div>
      <Results overall={build.overall} result={build.result} picks={build.picks} />
      <div className="save-bar">
        <Link className="btn btn-primary" to="/">Build Your Own</Link>
        <Link className="btn btn-ghost" to={returnTo}>{returnLabel}</Link>
      </div>
    </div>
  );
}
