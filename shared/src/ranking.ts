import { ATTRIBUTES } from './attributes';
import { PLAYERS_BY_ID } from './players';
import { scoreBuild } from './scoring';
import type { PickMap, RawValues, ScoreResult } from './types';

const ALL_STAR_OVERALL = 78;

const allStarPlayerIds = new Set(
  Object.values(PLAYERS_BY_ID)
    .filter(player => {
      const values = Object.fromEntries(
        ATTRIBUTES.map(attribute => [attribute.key, player[attribute.key]]),
      ) as RawValues;
      return scoreBuild(values).overall >= ALL_STAR_OVERALL;
    })
    .map(player => player.id),
);

export interface BuildRankMetrics {
  totalStats: number;
  allStarCount: number;
}

export function buildRankMetrics(result: ScoreResult, picks: PickMap): BuildRankMetrics {
  return {
    totalStats: ATTRIBUTES.filter(attribute => attribute.type === 'rating').reduce(
      (total, attribute) => total + (result.subScores[attribute.key] ?? 0),
      0,
    ),
    allStarCount: Object.values(picks).filter(playerId => allStarPlayerIds.has(playerId)).length,
  };
}
