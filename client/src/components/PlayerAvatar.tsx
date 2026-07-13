import { useEffect, useState } from 'react';
import { TEAMS_BY_ABBR, playerImageUrl, type Player } from '@shared/index';

function initials(name: string): string {
  const parts = name.split(' ');
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
}

interface Props {
  player: Player;
}

// Player headshot with a colored initials fallback when no image is available
// or the image fails to load.
export function PlayerAvatar({ player }: Props) {
  const url = playerImageUrl(player.id);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [player.id]);

  // Characters ('STAR') get a wildcard purple; legends/WNBA fallbacks get gold;
  // current teams use their own color.
  const teamColor = player.team === 'STAR'
    ? '#7c3aed'
    : (TEAMS_BY_ABBR[player.team]?.color || '#8a6d2b');

  return (
    <div className="avatar">
      {url && !failed ? (
        <img src={url} alt={player.name} draggable={false} onError={() => setFailed(true)} />
      ) : (
        <div className="avatar-fallback" style={{ background: teamColor }}>
          {initials(player.name)}
        </div>
      )}
    </div>
  );
}
