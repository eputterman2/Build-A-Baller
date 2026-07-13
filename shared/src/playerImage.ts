import { PLAYER_ESPN_IDS } from './playerImages';
import { PLAYER_NBA_IDS } from './playerImagesLegends';
import { PLAYER_WIKI_IMAGES } from './playerImagesWiki';
import { PLAYER_WNBA_IMAGES } from './playerImagesWnba';
import { PLAYER_CHAR_IMAGES } from './playerImagesChars';

// Headshot URL for a player. Current NBA → ESPN; NBA legends → NBA.com CDN;
// WNBA → WNBA.com/ESPN/Wikipedia; characters & older legends → Wikipedia.
// Returns null when we have no photo (the client shows an initials avatar).
export function playerImageUrl(playerId: string): string | null {
  const espn = PLAYER_ESPN_IDS[playerId];
  if (espn) return `https://a.espncdn.com/i/headshots/nba/players/full/${espn}.png`;
  const nba = PLAYER_NBA_IDS[playerId];
  if (nba) return `https://cdn.nba.com/headshots/nba/latest/260x190/${nba}.png`;
  return PLAYER_WNBA_IMAGES[playerId]
    ?? PLAYER_CHAR_IMAGES[playerId]
    ?? PLAYER_WIKI_IMAGES[playerId]
    ?? null;
}
