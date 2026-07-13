import type {
  Attribute, AttributeKey, BuildBonus, BuildPreview, CategoryName, Grade, Modifier,
  RawValues, ScoreResult,
} from './types';
import { ATTRIBUTES, CATEGORIES } from './attributes';

const clamp = (n: number, lo = 1, hi = 100): number =>
  Math.max(lo, Math.min(hi, Math.round(n)));
const lerp = (v: number, inLo: number, inHi: number): number =>
  ((v - inLo) / (inHi - inLo)) * 100;

// Convert a measured attribute (inches / lbs) to a 1-100 sub-score.
function measureScore(key: AttributeKey, value: number): number {
  switch (key) {
    case 'height':   return clamp(lerp(value, 66, 88));
    case 'wingspan': return clamp(lerp(value, 72, 98));
    case 'weight':   return clamp(lerp(value, 150, 320));
    default:         return clamp(value);
  }
}

export function idealWeightForHeight(height: number): number {
  return 180 + (height - 72) * 6;
}

// 1-100 sub-score for a single attribute given its raw value.
export function attributeScore(attr: Attribute, rawValue: number): number {
  return attr.type === 'measure' ? measureScore(attr.key, rawValue) : clamp(rawValue);
}

export function gradeFor(score: number): Grade {
  if (score >= 92) return { g: 'S', label: 'Generational' };
  if (score >= 85) return { g: 'A', label: 'Superstar' };
  if (score >= 78) return { g: 'B', label: 'All-Star' };
  if (score >= 68) return { g: 'C', label: 'Starter' };
  if (score >= 55) return { g: 'D', label: 'Rotation Player' };
  return { g: 'F', label: 'Benchwarmer' };
}

const CATEGORY_WEIGHTS: Record<CategoryName, number> = {
  physical: 0.30, skill: 0.45, mental: 0.25,
};

const MAX_BUILD_BONUS = 2;
const MAX_BODY_ADJUSTMENT = 12;

type StatBoosts = Partial<Record<AttributeKey, number>>;

const PERFECT_STAT_BOOSTS: Partial<Record<AttributeKey, StatBoosts>> = {
  athleticism: { speed: 5, defense: 5, postScoring: 5 },
  speed: { ballHandling: 6, athleticism: 4, defense: 3 },
  ballHandling: { passing: 5, shooting: 4, speed: 3 },
  shooting: { ballHandling: 5, postScoring: 5, passing: 3 },
  postScoring: { shooting: 4, defense: 4, ballHandling: 3 },
  defense: { wingspan: 4, athleticism: 4, iq: 4 },
  passing: { iq: 6, ballHandling: 5, shooting: 3 },
  iq: { passing: 6, defense: 4, ballHandling: 3 },
  attitude: { iq: 4, clutch: 4, durability: 3 },
  clutch: { shooting: 5, ballHandling: 3, attitude: 3 },
  durability: { athleticism: 4, speed: 3, defense: 3 },
};

const PERFECT_STAT_LABELS: Partial<Record<AttributeKey, string>> = {
  athleticism: 'Perfect Athleticism',
  speed: 'Perfect Speed',
  ballHandling: 'Perfect Handle',
  shooting: 'Perfect Jumper',
  postScoring: 'Perfect Post Game',
  defense: 'Perfect Defense',
  passing: 'Perfect Passing',
  iq: 'Perfect IQ',
  attitude: 'Perfect Attitude',
  clutch: 'Perfect Clutch',
  durability: 'Perfect Durability',
};

// Core engine. Works on a PARTIAL set of attribute values, so it powers both the
// live "building" panel (as picks come in) and the final score (all 14 present).
// Synergies activate only when the attributes they read AND write are present, so
// effects reveal themselves naturally as the user drafts.
export function computeBuild(values: Partial<RawValues>): BuildPreview {
  const has = (k: AttributeKey) => values[k] !== undefined;

  // 1. Base sub-scores for picked attributes.
  const base = {} as Partial<Record<AttributeKey, number>>;
  for (const attr of ATTRIBUTES) {
    if (has(attr.key)) base[attr.key] = attributeScore(attr, values[attr.key]!);
  }

  // 2. Synergy & tradeoff engine.
  const modifiers: Modifier[] = [];
  const adj = {} as Partial<Record<AttributeKey, number>>;
  const bodyAdjustments = {} as Partial<Record<AttributeKey, number>>;
  // Only adjust attributes that are actually present (so partial display is right).
  const bump = (k: AttributeKey, amt: number) => {
    if (base[k] !== undefined) adj[k] = (adj[k] || 0) + amt;
  };
  // Body effects are also tracked before their target stats are drafted so the
  // live panel can preview which skills the chosen frame will help or hurt.
  const bodyBump = (k: AttributeKey, amt: number) => {
    const current = bodyAdjustments[k] || 0;
    const next = Math.max(-MAX_BODY_ADJUSTMENT, Math.min(MAX_BODY_ADJUSTMENT, current + amt));
    bodyAdjustments[k] = next;
    bump(k, next - current);
  };

  const injuryRelevant = has('height') || has('weight') || has('durability');
  let risk = 18;

  // --- Frame: height ---
  // 6'6" is the neutral point. Every inch shifts mobility toward size, or vice versa.
  let heightDifference = 0;
  if (has('height')) {
    heightDifference = values.height! - 78;
    if (heightDifference > 0) {
      bodyBump('postScoring', heightDifference * 1.5);
      bodyBump('defense', heightDifference * 1.2);
      bodyBump('ballHandling', -heightDifference);
      bodyBump('speed', -heightDifference * 0.8);
      risk += heightDifference * 1.5;
    } else if (heightDifference < 0) {
      const compact = Math.abs(heightDifference);
      bodyBump('postScoring', -compact * 1.5);
      bodyBump('defense', -compact * 0.5);
      bodyBump('ballHandling', compact * 0.8);
      bodyBump('speed', compact * 0.8);
    }

    if (values.height! >= 82) {
      modifiers.push({ icon: '🗼', name: 'Towering Frame',
        text: 'Extra size strengthens rim defense and interior scoring, but costs mobility.' });
    } else if (
      values.height! <= 74
      && (!has('weight') || values.weight! - idealWeightForHeight(values.height!) < 35)
    ) {
      modifiers.push({ icon: '🐜', name: 'Compact & Shifty',
        text: 'A smaller frame improves quickness and handle, but gives up interior strength.' });
    }
  }

  // --- Height + weight fit ---
  if (has('height') && has('weight')) {
    const weightDifference = values.weight! - idealWeightForHeight(values.height!);

    if (weightDifference > 0) {
      const extraMass = weightDifference / 8;
      bodyBump('postScoring', extraMass * 1.2);
      bodyBump('defense', extraMass * 0.6);
      bodyBump('speed', -extraMass);
      bodyBump('ballHandling', -extraMass * 0.5);
      bodyBump('athleticism', -extraMass * 0.6);
      risk += Math.max(0, weightDifference - 10) * 0.15;
    } else if (weightDifference < 0) {
      const missingMass = Math.abs(weightDifference) / 8;
      bodyBump('speed', missingMass * 0.6);
      bodyBump('athleticism', missingMass * 0.3);
      bodyBump('postScoring', -missingMass * 1.2);
      bodyBump('defense', -missingMass * 0.7);
      bodyBump('durability', -missingMass * 0.3);
      risk += Math.max(0, Math.abs(weightDifference) - 15) * 0.12;
    }

    // A severe mismatch cancels the height benefit that the frame cannot support.
    if (heightDifference < 0 && weightDifference > 15) {
      const mismatch = Math.min(1, (weightDifference - 15) / 20);
      const compact = Math.abs(heightDifference);
      bodyBump('speed', -(compact * 0.8 * mismatch));
      bodyBump('ballHandling', -(compact * 0.8 * mismatch));
    } else if (heightDifference > 0 && weightDifference < -20) {
      const mismatch = Math.min(1, (Math.abs(weightDifference) - 20) / 20);
      bodyBump('postScoring', -(heightDifference * 1.5 * mismatch));
      bodyBump('defense', -(heightDifference * 1.2 * mismatch));
    }

    if (weightDifference >= 35) {
      modifiers.push({ icon: '🪨', name: 'Overloaded Frame',
        text: 'Too much weight for this height cuts into speed, handling, and athleticism.' });
    } else if (weightDifference >= 12) {
      modifiers.push({ icon: '🐂', name: 'Power Frame',
        text: 'Extra strength helps inside, but trims some open-court speed.' });
    } else if (values.height! >= 79 && weightDifference <= -25) {
      modifiers.push({ icon: '🪶', name: 'Undersized Frame',
        text: 'Too little weight for this height makes it harder to hold position and defend the paint.' });
    } else if (weightDifference < -5) {
      modifiers.push({ icon: '🪶', name: 'Lean Frame',
        text: 'Less mass helps mobility, but makes contact and interior defense tougher.' });
    }
  }

  // --- Speed sharpens (or dulls) the handle ---
  if (has('speed') && has('ballHandling')) {
    const effectiveSpeed = clamp(base.speed! + (adj.speed || 0));
    if (effectiveSpeed >= 88) {
      bump('ballHandling', 4);
      modifiers.push({ icon: '⚡', name: 'Quick Hands',
        text: 'Blazing speed makes your handle even tougher to stay in front of.' });
    } else if (effectiveSpeed <= 66) {
      bump('ballHandling', -Math.round((66 - effectiveSpeed) * 0.5));
      modifiers.push({ icon: '🦵', name: 'Heavy Legs',
        text: 'A slow first step makes your handle easier to corral.' });
    }
  }

  // --- Wingspan tradeoffs ---
  // Four inches longer than height is neutral; every inch beyond it changes rated skills.
  if (has('wingspan') && has('height')) {
    const relativeLength = values.wingspan! - values.height!;
    const reachDifference = relativeLength - 4;

    bodyBump('defense', reachDifference * 1.1);
    bodyBump('postScoring', reachDifference * 0.5);
    bodyBump('shooting', -reachDifference * 0.4);
    bodyBump('ballHandling', -reachDifference * 0.35);

    if (relativeLength >= 6) {
      modifiers.push({ icon: '🦅', name: 'Freakish Length',
        text: 'Extra reach boosts defense and interior play, but costs some shooting touch and handle.' });
    } else if (relativeLength <= 2) {
      modifiers.push({ icon: '🎯', name: 'Compact Reach',
        text: 'Shorter arms improve shooting control and handle, but limit defense and interior scoring.' });
    }
  }

  // --- Two-way athlete ---
  if (has('athleticism') && has('speed')
      && clamp(base.athleticism! + (adj.athleticism || 0)) >= 90
      && clamp(base.speed! + (adj.speed || 0)) >= 88) {
    bump('defense', 6);
    bump('postScoring', 4);
    modifiers.push({ icon: '💨', name: 'Athletic Freak',
      text: 'Explosive tools translate to defense and finishing.' });
  }

  // --- Floor general ---
  if (has('iq') && has('passing') && base.iq! >= 90 && base.passing! >= 88) {
    bump('ballHandling', 5);
    bump('shooting', 3);
    bump('defense', 3);
    modifiers.push({ icon: '🧠', name: 'Floor General',
      text: 'Elite IQ and vision make every skill more effective.' });
  }

  // --- Low IQ caps raw talent ---
  if (has('iq') && base.iq! <= 70) {
    const dumbed = (70 - base.iq!) * 0.4;
    for (const k of ['ballHandling','shooting','postScoring','defense','passing'] as AttributeKey[]) {
      bump(k, -dumbed);
    }
    modifiers.push({ icon: '🤯', name: 'Raw & Undisciplined',
      text: 'Low feel for the game holds back your skills.' });
  }

  // --- Perfect stat bonuses ---
  for (const attr of ATTRIBUTES) {
    const key = attr.key;
    if (attr.type === 'measure' || base[key] !== 100) continue;
    const boosts = PERFECT_STAT_BOOSTS[key];
    if (!boosts) continue;

    const targets = (Object.keys(boosts) as AttributeKey[]).filter(k => base[k] !== undefined);
    if (!targets.length) continue;

    for (const target of targets) bump(target, boosts[target]!);
    modifiers.push({
      icon: '💯',
      name: PERFECT_STAT_LABELS[key]!,
      text: 'A 100 stat gives a bonus to related parts of your build.',
    });
  }

  // --- Injury risk ---
  let injuryRisk: number | null = null;
  if (injuryRelevant) {
    if (has('durability')) risk -= (base.durability! - 50) * 0.7;
    injuryRisk = Math.max(2, Math.min(95, Math.round(risk)));
  }

  // 3. Final sub-scores (present attributes only).
  const sub = {} as Partial<Record<AttributeKey, number>>;
  for (const attr of ATTRIBUTES) {
    if (base[attr.key] !== undefined) {
      sub[attr.key] = clamp(base[attr.key]! + (adj[attr.key] || 0));
    }
  }

  // 4. Category scores. Body measurements never receive ratings of their own;
  // they influence the rated athletic and skill attributes through adjustments.
  const categoryScores = {} as Record<CategoryName, number | null>;
  for (const name of Object.keys(CATEGORIES) as CategoryName[]) {
    if (name === 'physical') {
      const physicalParts: Array<{ score: number; weight: number }> = [];
      if (sub.athleticism !== undefined) physicalParts.push({ score: sub.athleticism, weight: 0.50 });
      if (sub.speed !== undefined) physicalParts.push({ score: sub.speed, weight: 0.50 });
      const physicalWeight = physicalParts.reduce((sum, part) => sum + part.weight, 0);
      categoryScores.physical = physicalParts.length
        ? clamp(physicalParts.reduce((sum, part) => sum + part.score * part.weight, 0) / physicalWeight)
        : null;
      continue;
    }

    const members = ATTRIBUTES.filter(a => a.category === name && sub[a.key] !== undefined);
    categoryScores[name] = members.length
      ? clamp(members.reduce((s, a) => s + sub[a.key]!, 0) / members.length)
      : null;
  }

  // 5. Overall = weighted blend over present categories + global modifiers.
  let wsum = 0, acc = 0;
  for (const name of Object.keys(CATEGORIES) as CategoryName[]) {
    if (categoryScores[name] != null) { acc += categoryScores[name]! * CATEGORY_WEIGHTS[name]; wsum += CATEGORY_WEIGHTS[name]; }
  }
  let overall: number | null = wsum > 0 ? acc / wsum : null;
  if (overall != null) {
    if (has('attitude')) overall *= 0.90 + (sub.attitude! / 100) * 0.18;
    if (has('clutch')) overall += (sub.clutch! - 50) * 0.06;
    if (injuryRisk != null) overall *= 1 - (injuryRisk / 100) * 0.20;
    overall = clamp(overall);
  }

  // 6. Named build bonuses reward complementary strengths. Each is worth
  // +1 OVR, with a two-bonus cap so combinations matter without taking over.
  const buildBonuses: BuildBonus[] = [];
  const addBuildBonus = (active: boolean, name: string, text: string) => {
    if (!active || buildBonuses.reduce((sum, bonus) => sum + bonus.points, 0) >= MAX_BUILD_BONUS) return;
    buildBonuses.push({ name, text, points: 1 });
  };

  addBuildBonus(
    has('height') && has('speed') && has('ballHandling')
      && values.height! <= 77
      && sub.speed! >= 84
      && sub.ballHandling! >= 82
      && ((has('shooting') && sub.shooting! >= 80) || (has('passing') && sub.passing! >= 82)),
    'Guard Frame',
    'A compact frame paired with elite creation and speed is built for the perimeter.',
  );
  addBuildBonus(
    has('height') && has('passing') && has('ballHandling') && has('iq')
      && values.height! >= 79
      && sub.passing! >= 86
      && sub.ballHandling! >= 80
      && sub.iq! >= 82,
    'Point Forward',
    'Size, handle, vision, and decision-making create offense from the frontcourt.',
  );
  addBuildBonus(
    has('shooting') && has('ballHandling') && sub.shooting! >= 85 && sub.ballHandling! >= 82,
    'Shot Creator',
    'Elite shooting and ball handling create offense from anywhere.',
  );
  addBuildBonus(
    has('height') && has('wingspan') && has('shooting') && has('defense')
      && values.wingspan! - values.height! >= 4
      && sub.shooting! >= 82
      && sub.defense! >= 86,
    '3-and-D Specialist',
    'Length, shooting, and high-level defense make this build valuable on both ends.',
  );
  addBuildBonus(
    has('height') && has('defense') && has('postScoring')
      && values.height! >= 81 && sub.defense! >= 80 && sub.postScoring! >= 78,
    'Interior Force',
    'Size, defense, and post scoring control both ends of the paint.',
  );
  addBuildBonus(
    has('height') && has('shooting') && has('defense') && has('postScoring')
      && values.height! >= 81
      && sub.shooting! >= 85
      && (sub.defense! >= 78 || sub.postScoring! >= 78),
    'Stretch Big',
    'A big frame with elite shooting forces defenses to guard the entire floor.',
  );
  addBuildBonus(
    has('speed') && has('athleticism') && sub.speed! >= 88 && sub.athleticism! >= 88,
    'Open-Court Threat',
    'Top-end speed and athleticism make this build lethal in transition.',
  );
  addBuildBonus(
    has('passing') && has('iq') && sub.passing! >= 86 && sub.iq! >= 86,
    'Playmaking Engine',
    'Elite passing and basketball IQ elevate the entire offense.',
  );

  if (overall != null && buildBonuses.length) {
    overall = clamp(overall + buildBonuses.reduce((sum, bonus) => sum + bonus.points, 0));
  }
  if (overall != null) overall = Math.min(99, overall);

  if (has('attitude') && sub.attitude! <= 60) {
    modifiers.push({ icon: '🌩️', name: 'Locker Room Risk',
      text: 'A poor attitude drags down the whole team — overall penalized.' });
  } else if (has('attitude') && sub.attitude! >= 90) {
    modifiers.push({ icon: '🤝', name: 'Ultimate Teammate',
      text: 'Elite attitude lifts everyone — overall boosted.' });
  }
  if (has('clutch') && sub.clutch! >= 92) {
    modifiers.push({ icon: '❄️', name: 'Ice in the Veins',
      text: 'Delivers when it matters most.' });
  }

  return {
    base, sub, bodyAdjustments, categoryScores, overall, injuryRisk, modifiers, buildBonuses,
    height: has('height') ? values.height! : null,
    weight: has('weight') ? values.weight! : null,
    wingspan: has('wingspan') ? values.wingspan! : null,
    pickedCount: Object.keys(base).length,
  };
}

// Full-build score (all 14 attributes). Used by the server and the results screen.
export function scoreBuild(values: RawValues): ScoreResult {
  const p = computeBuild(values);
  return {
    subScores: p.sub as Record<AttributeKey, number>,
    rawSubScores: p.base as Record<AttributeKey, number>,
    categoryScores: p.categoryScores as Record<CategoryName, number>,
    overall: p.overall!,
    injuryRisk: p.injuryRisk!,
    modifiers: p.modifiers,
    buildBonuses: p.buildBonuses,
  };
}
