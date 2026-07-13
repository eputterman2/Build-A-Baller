// Scoring engine: converts the raw attribute values your spins landed on into
// 1-100 sub-scores, then applies cross-attribute synergies and tradeoffs.

const clamp = (n, lo = 1, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const lerp = (v, inLo, inHi) => ((v - inLo) / (inHi - inLo)) * 100;

// Convert a measured attribute (inches / lbs) to a 1-100 sub-score.
function measureScore(key, value) {
  switch (key) {
    case 'height':   return clamp(lerp(value, 66, 88));   // 5'6" -> 7'4"
    case 'wingspan': return clamp(lerp(value, 72, 98));    // 6'0" -> 8'2"
    case 'weight':   return clamp(lerp(value, 150, 320));  // mass / strength proxy
    default:         return clamp(value);
  }
}

// Returns the 1-100 sub-score for a single attribute given its raw value.
function attributeScore(attr, rawValue) {
  return attr.type === 'measure' ? measureScore(attr.key, rawValue) : clamp(rawValue);
}

// picks: { attrKey: { player, value } } — the result of every spin.
// Returns the full scored breakdown including synergy modifiers.
function scoreBuild(picks) {
  // 1. Raw per-attribute sub-scores.
  const sub = {};
  for (const attr of ATTRIBUTES) {
    sub[attr.key] = attributeScore(attr, picks[attr.key].value);
  }

  // Convenience accessors for raw measured values.
  const heightIn = picks.height.value;
  const weightLb = picks.weight.value;
  const durability = sub.durability;

  // 2. Synergy & tradeoff engine. Each entry nudges sub-scores and/or injury risk.
  const modifiers = [];
  const adj = {};                          // additive adjustments per attribute
  const bump = (k, amt) => { adj[k] = (adj[k] || 0) + amt; };
  let injuryRisk = 18;                      // baseline %

  // Towering frame: great rim protection & post, clumsier handle, more wear.
  if (heightIn >= 82) {
    const tall = heightIn - 82;
    bump('postScoring', 6 + tall);
    bump('defense', 4 + tall);
    bump('ballHandling', -(4 + tall * 1.5));
    bump('speed', -(3 + tall));
    injuryRisk += 8 + tall * 2.5;
    modifiers.push({ icon: '🗼', name: 'Towering Frame',
      text: 'Elite rim presence & post game, but slower and more injury-prone.' });
  }

  // Compact & quick: shifty handle and burst, but bullied in the post.
  if (heightIn <= 74) {
    const small = 74 - heightIn;
    bump('ballHandling', 4 + small);
    bump('speed', 4 + small);
    bump('postScoring', -(8 + small * 2));
    modifiers.push({ icon: '🐜', name: 'Compact & Shifty',
      text: 'Lightning handle and quickness, but can\'t score over size.' });
  }

  // Heavy frame: bruising strength, drains speed and the body.
  if (weightLb >= 260) {
    const heavy = (weightLb - 260) / 10;
    bump('postScoring', 4 + heavy);
    bump('defense', 2 + heavy * 0.5);
    bump('speed', -(4 + heavy));
    injuryRisk += 6 + heavy * 1.5;
    modifiers.push({ icon: '🐂', name: 'Bruising Mass',
      text: 'Overpowers defenders down low at the cost of speed and durability.' });
  } else if (weightLb <= 175) {
    bump('postScoring', -6);
    bump('speed', 4);
    modifiers.push({ icon: '🪶', name: 'Featherweight',
      text: 'Quick and nimble, but easily knocked off the ball.' });
  }

  // Long wingspan amplifies defense.
  if (picks.wingspan.value - heightIn >= 6) {
    bump('defense', 7);
    bump('postScoring', 3);
    modifiers.push({ icon: '🦅', name: 'Freakish Length',
      text: 'Wingspan well beyond your height — a defensive menace.' });
  }

  // Two-way athletic freak: elite athleticism + speed lifts defense & finishing.
  if (sub.athleticism >= 90 && sub.speed >= 88) {
    bump('defense', 6);
    bump('postScoring', 4);
    modifiers.push({ icon: '⚡', name: 'Athletic Freak',
      text: 'Explosive tools translate to defense and finishing.' });
  }

  // Floor general: high IQ + passing sharpens the whole skill set.
  if (sub.iq >= 90 && sub.passing >= 88) {
    bump('ballHandling', 5);
    bump('shooting', 3);
    bump('defense', 3);
    modifiers.push({ icon: '🧠', name: 'Floor General',
      text: 'Elite IQ and vision make every skill more effective.' });
  }

  // Low IQ caps raw talent: skills underperform their ceiling.
  if (sub.iq <= 70) {
    const dumbed = (70 - sub.iq) * 0.4;
    for (const k of ['ballHandling','shooting','postScoring','defense','passing']) {
      bump(k, -dumbed);
    }
    modifiers.push({ icon: '🤯', name: 'Raw & Undisciplined',
      text: 'Low feel for the game holds back your skills.' });
  }

  // Durability vs injury risk.
  injuryRisk -= (durability - 50) * 0.7;
  injuryRisk = Math.max(2, Math.min(95, Math.round(injuryRisk)));

  // 3. Apply adjustments to produce final sub-scores.
  const finalSub = {};
  for (const attr of ATTRIBUTES) {
    finalSub[attr.key] = clamp(sub[attr.key] + (adj[attr.key] || 0));
  }

  // 4. Category scores = mean of member final sub-scores.
  const cat = {};
  for (const name of Object.keys(CATEGORIES)) {
    const members = ATTRIBUTES.filter(a => a.category === name);
    const mean = members.reduce((s, a) => s + finalSub[a.key], 0) / members.length;
    cat[name] = clamp(mean);
  }

  // 5. Overall = weighted blend, then attitude/clutch/injury global modifiers.
  let overall = cat.physical * 0.30 + cat.skill * 0.45 + cat.mental * 0.25;
  const attitudeMult = 0.90 + (finalSub.attitude / 100) * 0.18;   // 0.90 - 1.08
  overall *= attitudeMult;
  overall += (finalSub.clutch - 50) * 0.06;                       // clutch swing
  overall *= (1 - (injuryRisk / 100) * 0.20);                     // availability tax

  if (finalSub.attitude <= 60) {
    modifiers.push({ icon: '🌩️', name: 'Locker Room Risk',
      text: 'A poor attitude drags down the whole team — overall penalized.' });
  } else if (finalSub.attitude >= 90) {
    modifiers.push({ icon: '🤝', name: 'Ultimate Teammate',
      text: 'Elite attitude lifts everyone — overall boosted.' });
  }
  if (finalSub.clutch >= 92) {
    modifiers.push({ icon: '❄️', name: 'Ice in the Veins',
      text: 'Delivers when it matters most.' });
  }

  return {
    subScores: finalSub,
    rawSubScores: sub,
    categoryScores: cat,
    overall: clamp(overall),
    injuryRisk,
    modifiers,
  };
}
