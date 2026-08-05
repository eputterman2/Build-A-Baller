import { ATTRIBUTES } from './attributes';
import { PLAYERS_BY_ID } from './players';
import { scoreBuild } from './scoring';
import type { PickMap, RawValues, ScoreResult } from './types';

const ALL_STAR_OVERALL = 78;
const HALL_OF_FAME_OVERALL = 90;

const playerSoloOveralls = Object.values(PLAYERS_BY_ID).map(player => {
  const values = Object.fromEntries(
    ATTRIBUTES.map(attribute => [attribute.key, player[attribute.key]]),
  ) as RawValues;
  return { id: player.id, overall: scoreBuild(values).overall };
});

const allStarPlayerIds = new Set(
  playerSoloOveralls
    .filter(player => player.overall >= ALL_STAR_OVERALL)
    .map(player => player.id),
);

const hallOfFamePlayerIds = new Set(
  playerSoloOveralls
    .filter(player => player.overall >= HALL_OF_FAME_OVERALL)
    .map(player => player.id),
);

export interface BuildRankMetrics {
  totalStats: number;
  hallOfFameCount: number;
  allStarCount: number;
}

export function buildRankMetrics(result: ScoreResult, picks: PickMap): BuildRankMetrics {
  return {
    totalStats: ATTRIBUTES.filter(attribute => attribute.type === 'rating').reduce(
      (total, attribute) => total + (result.subScores[attribute.key] ?? 0),
      0,
    ),
    hallOfFameCount: Object.values(picks).filter(playerId => hallOfFamePlayerIds.has(playerId)).length,
    allStarCount: Object.values(picks).filter(playerId => allStarPlayerIds.has(playerId)).length,
  };
}
