// Attribute configuration for the whole game.
// Each spin corresponds to one attribute. Spins run in this array order.
//
//   key      - property name on the player object
//   label    - display name
//   category - 'physical' | 'skill' | 'mental'
//   type     - 'measure' (real-world unit, needs conversion to a 1-100 score)
//              'rating'  (already on a 1-100 scale)
//   format   - how to display the raw value the wheel landed on

const ATTRIBUTES = [
  // --- Physical ---
  { key: 'height',       label: 'Height',        category: 'physical', type: 'measure', format: 'height' },
  { key: 'weight',       label: 'Weight',        category: 'physical', type: 'measure', format: 'weight' },
  { key: 'wingspan',     label: 'Wingspan',      category: 'physical', type: 'measure', format: 'height' },
  { key: 'athleticism',  label: 'Athleticism',   category: 'physical', type: 'rating',  format: 'rating' },
  { key: 'speed',        label: 'Speed',         category: 'physical', type: 'rating',  format: 'rating' },
  // --- Skill ---
  { key: 'ballHandling', label: 'Ball Handling', category: 'skill',    type: 'rating',  format: 'rating' },
  { key: 'shooting',     label: 'Shooting',      category: 'skill',    type: 'rating',  format: 'rating' },
  { key: 'postScoring',  label: 'Post Scoring',  category: 'skill',    type: 'rating',  format: 'rating' },
  { key: 'defense',      label: 'Defense',       category: 'skill',    type: 'rating',  format: 'rating' },
  { key: 'passing',      label: 'Passing',       category: 'skill',    type: 'rating',  format: 'rating' },
  // --- Mental ---
  { key: 'iq',           label: 'Basketball IQ', category: 'mental',   type: 'rating',  format: 'rating' },
  { key: 'attitude',     label: 'Attitude',      category: 'mental',   type: 'rating',  format: 'rating' },
  { key: 'clutch',       label: 'Clutch',        category: 'mental',   type: 'rating',  format: 'rating' },
  { key: 'durability',   label: 'Durability',    category: 'mental',   type: 'rating',  format: 'rating' },
];

const CATEGORIES = {
  physical: { label: 'Physical', color: '#ff7a45' },
  skill:    { label: 'Skill',    color: '#4dabf7' },
  mental:   { label: 'Mental',   color: '#9775fa' },
};

// Format a raw attribute value for display (e.g. 84 -> 7'0", 250 -> 250 lbs).
function formatValue(format, value) {
  if (format === 'height') {
    const ft = Math.floor(value / 12);
    const inch = value % 12;
    return `${ft}'${inch}"`;
  }
  if (format === 'weight') return `${value} lbs`;
  return `${value}`;
}
