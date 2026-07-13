import { archetypeFamily, buildArchetype } from './analysis';
import { MARKET_BUNDLES } from './accessories';
import type { PickMap, ScoreResult } from './types';

export interface ArchetypeCharacter {
  id: string;
  name: string;
  src: string;
}

export interface ArchetypeCharacterRule extends ArchetypeCharacter {
  archetypes: string[];
  minOverall: number;
  maxOverall: number;
}

const character = (
  id: string,
  name: string,
  archetypes: string[],
  minOverall: number,
  maxOverall: number,
): ArchetypeCharacterRule => ({
  id,
  name,
  archetypes,
  minOverall,
  maxOverall,
  src: `/archetype-players/${id}.png?v=5`,
});

const LOWEST = 0;
const MARKET_DRAWING_IDS = new Set(MARKET_BUNDLES.map(bundle => bundle.drawingId));

export const ARCHETYPE_CHARACTER_RULES: ArchetypeCharacterRule[] = [
  character('b1-top-left', 'Quickstep', [
    'Balanced Starter',
    'Point Forward',
    '3-and-D Wing',
    'Defensive Playmaker',
    'Floor General',
    'Slashing Playmaker',
    'Lockdown Slasher',
    'Glue Guy',
  ], LOWEST, 86),
  character('b1-top-middle', 'Set Shot', [
    'Rec League Experiment',
    'Bench Spark',
    'Talented Headache',
    'Glass Cannon',
    'Pocket Blur',
    'Floor General',
    'Slashing Playmaker',
    'Skilled Shot Maker',
  ], LOWEST, 82),
  character('b1-top-right', 'The Prospect', [
    'Balanced Starter',
    'Glass Cannon',
    'Floor General',
    'Slashing Playmaker',
    'Three-Level Scorer',
    'Skilled Shot Maker',
    'Shot-Creating Sniper',
    'Movement Shooter',
  ], LOWEST, 86),
  character('b1-bottom-left', 'Skywalker', [
    'Shot-Creating Sniper',
    'Movement Shooter',
    'Floor General',
    'Slashing Playmaker',
    'Three-Level Scorer',
    'Skilled Shot Maker',
    'Athletic Finisher',
    'Aerial Playmaker',
    'Complete Star',
  ], 93, 97),
  character('b2-left', 'The Tower', [
    'Lumbering Paint Project',
    'Stretch Big',
    'Interior Hub',
    'Rim-Running Anchor',
    'Bruising Post Scorer',
    'Glue Guy',
  ], 87, 92),
  character('b2-middle', 'Spider Guard', [
    'Pocket Blur',
    'Aerial Playmaker',
    '3-and-D Wing',
    'Defensive Playmaker',
    'Floor General',
    'Slashing Playmaker',
    'Movement Shooter',
    'Athletic Finisher',
    'Three-Level Scorer',
    'Lockdown Slasher',
    'Complete Star',
  ], 92, 96),
  character('b2-right', 'The Floater', [
    'Point Forward',
    'Aerial Playmaker',
    'Defensive Playmaker',
    'Floor General',
    'Slashing Playmaker',
    'Three-Level Scorer',
    'Lockdown Slasher',
    'Athletic Finisher',
    'Glue Guy',
    'Complete Star',
  ], 84, 89),
  character('b3-left', 'The King', [
    'GOAT',
    'Complete Star',
    'Three-Level Scorer',
    'Point Forward',
    '3-and-D Wing',
    'Defensive Playmaker',
    'Floor General',
    'Slashing Playmaker',
    'Lockdown Slasher',
    'Shot-Creating Sniper',
    'Aerial Playmaker',
    'Glue Guy',
  ], 95, 98),
  character('b3-middle', 'Pickup Legend', [
    'Balanced Starter',
    'Bench Spark',
    'Point Forward',
    'Defensive Playmaker',
    'Floor General',
    'Interior Hub',
    'Skilled Shot Maker',
    'Glue Guy',
  ], 82, 87),
  character('b3-right', 'The Monster', [
    'Talented Headache',
    'All-Tools Project',
    'Lumbering Paint Project',
    'Rim-Running Anchor',
    'Bruising Post Scorer',
    'Defensive Playmaker',
    'Lockdown Slasher',
    'Athletic Finisher',
  ], 87, 92),
  character('b4-left', 'Big Body', [
    'Rec League Experiment',
    'All-Tools Project',
    'Lumbering Paint Project',
    'Interior Hub',
    'Bruising Post Scorer',
    'Defensive Playmaker',
    'Glue Guy',
    'Bench Spark',
    'Balanced Starter',
  ], LOWEST, 87),
  character('b4-middle', 'Double Trouble', [
    'Pocket Blur',
    'Shot-Creating Sniper',
    'Movement Shooter',
    'Floor General',
    'Slashing Playmaker',
    'Three-Level Scorer',
    'Skilled Shot Maker',
    'Aerial Playmaker',
  ], 93, 97),
  character('b4-right', 'The Captain', [
    'Shot-Creating Sniper',
    'Movement Shooter',
    '3-and-D Wing',
    'Floor General',
    'Three-Level Scorer',
    'Skilled Shot Maker',
    'Point Forward',
    'Glue Guy',
    'Complete Star',
  ], 90, 95),
  character('b5-left', 'Floor General', [
    'All-Tools Project',
    'Lumbering Paint Project',
    'Interior Hub',
    'Rim-Running Anchor',
    'Bruising Post Scorer',
    'Defensive Playmaker',
    'Lockdown Slasher',
    'Athletic Finisher',
    'Glue Guy',
    'Balanced Starter',
  ], 87, 92),
  character('b5-right', 'High Flyer', [
    'GOAT',
    'Complete Star',
    'Three-Level Scorer',
    'Shot-Creating Sniper',
    'Movement Shooter',
    '3-and-D Wing',
    'Floor General',
    'Slashing Playmaker',
    'Aerial Playmaker',
    'Defensive Playmaker',
    'Lockdown Slasher',
  ], 95, 98),
  character('b6-middle', 'Golden 99', [
    'GOAT',
    '99 Overall',
    'Stretch Big',
    '3-and-D Wing',
    'Defensive Playmaker',
    'Shot-Creating Sniper',
    'Movement Shooter',
    'Three-Level Scorer',
    'Complete Star',
  ], 99, 99),
  character('ball-handler', 'Ball Handler', [
    'Pocket Blur',
    'Shot-Creating Sniper',
    'Movement Shooter',
    'Floor General',
    'Slashing Playmaker',
    'Three-Level Scorer',
    'Skilled Shot Maker',
    'Aerial Playmaker',
    'Balanced Starter',
  ], 84, 89),
  character('brian', 'Brian', [
    '3-and-D Wing',
    'Defensive Playmaker',
    'Skilled Shot Maker',
    'Glue Guy',
    'Balanced Starter',
    'Bench Spark',
  ], 84, 89),
  character('steven', 'Steven', [
    'Rec League Experiment',
    'Talented Headache',
    'Glass Cannon',
    'Skill-Only Specialist',
    'Movement Shooter',
    'Skilled Shot Maker',
    'Bench Spark',
  ], LOWEST, 86),
  character('wonder-woman', 'Wonder Woman', [
    'Point Forward',
    '3-and-D Wing',
    'Interior Hub',
    'Rim-Running Anchor',
    'Bruising Post Scorer',
    'Aerial Playmaker',
    'Defensive Playmaker',
    'Floor General',
    'Slashing Playmaker',
    'Lockdown Slasher',
    'Athletic Finisher',
    'Glue Guy',
    'Complete Star',
  ], 89, 94),
  character('a1-left', 'The Maverick', [
    'Stretch Big',
    'Interior Hub',
    'Shot-Creating Sniper',
    'Movement Shooter',
    'Three-Level Scorer',
    'Skilled Shot Maker',
    'Complete Star',
  ], 93, 97),
  character('a1-right', 'Greek Force', [
    'GOAT',
    'Point Forward',
    'Rim-Running Anchor',
    'Aerial Playmaker',
    'Defensive Playmaker',
    'Slashing Playmaker',
    'Lockdown Slasher',
    'Athletic Finisher',
    'Complete Star',
  ], 94, 98),
  character('a2-middle', 'Taco Titan', [
    '99 Overall',
  ], 99, 99),
  character('a3-left', 'Escalade', [
    'All-Tools Project',
    'Lumbering Paint Project',
    'Interior Hub',
    'Rim-Running Anchor',
    'Bruising Post Scorer',
    'Athletic Finisher',
    'Glue Guy',
    'Balanced Starter',
  ], 88, 93),
  character('a3-middle', 'Dark Knight', [
    'Point Forward',
    '3-and-D Wing',
    'Defensive Playmaker',
    'Floor General',
    'Slashing Playmaker',
    'Lockdown Slasher',
    'Glue Guy',
    'Complete Star',
  ], 90, 95),
  character('a3-right', 'Random Finisher', [
    'Rec League Experiment',
    'All-Tools Project',
    'Slashing Playmaker',
    'Athletic Finisher',
    'Balanced Starter',
    'Bench Spark',
  ], LOWEST, 86),
  character('a4-left', 'Commander', [
    '99 Overall',
  ], 99, 99),
  character('a4-middle', 'Heat Anchor', [
    '99 Overall',
  ], 99, 99),
  character('a4-right', 'Dino Dunker', [
    '99 Overall',
  ], 99, 99),
  character('a5-left', 'Tiny Titan', [
    'Pocket Blur',
    'Shot-Creating Sniper',
    'Movement Shooter',
    'Floor General',
    'Slashing Playmaker',
    'Three-Level Scorer',
    'Skilled Shot Maker',
  ], 88, 92),
  character('a5-right', 'Legacy Guard', [
    '3-and-D Wing',
    'Defensive Playmaker',
    'Skilled Shot Maker',
    'Glue Guy',
    'Balanced Starter',
    'Bench Spark',
  ], 82, 86),
  character('a6-left', 'Superman', [
    'Interior Hub',
    'Rim-Running Anchor',
    'Bruising Post Scorer',
    'Defensive Playmaker',
    'Lockdown Slasher',
    'Athletic Finisher',
  ], 88, 93),
  character('a6-middle', 'Steady Guard', [
    'Pocket Blur',
    'Floor General',
    'Slashing Playmaker',
    'Skilled Shot Maker',
    'Balanced Starter',
    'Bench Spark',
  ], 82, 86),
  character('a6-right', 'Eurostep Wizard', [
    'Shot-Creating Sniper',
    'Movement Shooter',
    'Floor General',
    'Slashing Playmaker',
    'Three-Level Scorer',
    'Skilled Shot Maker',
    'Glue Guy',
  ], 85, 89),
  character('a7-left', 'The Stilt', [
    '99 Overall',
  ], 99, 99),
  character('a8-left', 'Board Hunter', [
    'All-Tools Project',
    'Lumbering Paint Project',
    'Interior Hub',
    'Rim-Running Anchor',
    'Bruising Post Scorer',
    'Defensive Playmaker',
    'Athletic Finisher',
    'Balanced Starter',
    'Bench Spark',
  ], LOWEST, 84),
  character('a8-middle', 'Pull-Up Pocket', [
    'Pocket Blur',
    'Shot-Creating Sniper',
    'Movement Shooter',
    'Floor General',
    'Skilled Shot Maker',
    'Balanced Starter',
    'Bench Spark',
  ], LOWEST, 84),
  character('a8-right', 'Handle Sniper', [
    'Shot-Creating Sniper',
    'Movement Shooter',
    'Floor General',
    'Three-Level Scorer',
    'Skilled Shot Maker',
    'Balanced Starter',
    'Bench Spark',
  ], LOWEST, 84),
  character('gs-sharpshooter', 'Bay Sniper', [
    'Shot-Creating Sniper',
    'Movement Shooter',
    'Pocket Blur',
    'Floor General',
    'Three-Level Scorer',
    'Skilled Shot Maker',
  ], LOWEST, 99),
];

export const ARCHETYPE_CHARACTERS: Record<string, ArchetypeCharacter[]> =
  ARCHETYPE_CHARACTER_RULES.reduce((map, rule) => {
    for (const archetype of rule.archetypes) {
      map[archetype] = [...(map[archetype] ?? []), rule];
    }
    return map;
  }, {} as Record<string, ArchetypeCharacter[]>);

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seedFromBuild(archetype: string, result: ScoreResult, picks?: PickMap): string {
  const pickSeed = picks
    ? Object.entries(picks).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('|')
    : '';
  return `${archetype}|${result.overall}|${result.injuryRisk}|${pickSeed}`;
}

export function inCharacterOverallRange(rule: ArchetypeCharacterRule, overall: number): boolean {
  return overall >= rule.minOverall && overall <= rule.maxOverall;
}

export function getArchetypeCharacterById(id?: string | null): ArchetypeCharacterRule | null {
  if (!id) return null;
  return ARCHETYPE_CHARACTER_RULES.find(rule => rule.id === id) ?? null;
}

export function resolveArchetypeCharacter(
  result: ScoreResult,
  picks?: PickMap,
  characterId?: string | null,
): ArchetypeCharacter {
  const savedCharacter = getArchetypeCharacterById(characterId);
  if (savedCharacter && inCharacterOverallRange(savedCharacter, result.overall)) {
    return {
      id: savedCharacter.id,
      name: savedCharacter.name,
      src: savedCharacter.src,
    };
  }
  return selectArchetypeCharacter(result, picks);
}

function pickOption(
  options: ArchetypeCharacterRule[],
  archetype: string,
  result: ScoreResult,
  picks?: PickMap,
): ArchetypeCharacter {
  const index = options.length === 1 ? 0 : hashString(seedFromBuild(archetype, result, picks)) % options.length;
  const { id, name, src } = options[index];
  return { id, name, src };
}

function defaultSelectableRules(ownedMarketDrawingIds?: Iterable<string>): ArchetypeCharacterRule[] {
  const owned = new Set(ownedMarketDrawingIds ?? []);
  return ARCHETYPE_CHARACTER_RULES.filter(rule =>
    !MARKET_DRAWING_IDS.has(rule.id) || owned.has(rule.id));
}

export function selectArchetypeCharacter(
  result: ScoreResult,
  picks?: PickMap,
  ownedMarketDrawingIds?: Iterable<string>,
): ArchetypeCharacter {
  const archetype = buildArchetype(result);
  const family = archetypeFamily(archetype);
  const selectableRules = defaultSelectableRules(ownedMarketDrawingIds);

  const exactOptions = selectableRules.filter(rule =>
    rule.archetypes.includes(family) && inCharacterOverallRange(rule, result.overall));
  if (exactOptions.length) return pickOption(exactOptions, family, result, picks);

  const scoreFallback = selectableRules.filter(rule => inCharacterOverallRange(rule, result.overall));
  if (scoreFallback.length) return pickOption(scoreFallback, family, result, picks);

  const archetypeFallback = selectableRules.filter(rule => rule.archetypes.includes(family));
  if (archetypeFallback.length) return pickOption(archetypeFallback, family, result, picks);

  return pickOption(selectableRules.length ? selectableRules : ARCHETYPE_CHARACTER_RULES, family, result, picks);
}
