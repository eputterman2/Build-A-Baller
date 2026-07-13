import type { Attribute, AttributeKey, CategoryName, CategoryMeta, ValueFormat } from './types';

// Each spin corresponds to one attribute. Spins run in this array order.
export const ATTRIBUTES: Attribute[] = [
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

// Draft rounds: each round spins one player per attribute in the group, so a
// round fills several stats at once. Every attribute appears in exactly one group.
export interface AttributeGroup { name: string; blurb: string; keys: AttributeKey[]; }
export const ATTRIBUTE_GROUPS: AttributeGroup[] = [
  { name: 'Body',                 blurb: 'Frame & measurements', keys: ['height', 'weight', 'wingspan'] },
  { name: 'Athleticism',          blurb: 'Tools & motor',        keys: ['athleticism', 'speed', 'durability'] },
  { name: 'Scoring',              blurb: 'Putting it in the hoop', keys: ['ballHandling', 'shooting', 'postScoring'] },
  { name: 'Playmaking & Defense', blurb: 'The two-way game',     keys: ['passing', 'defense', 'iq'] },
  { name: 'Intangibles',          blurb: 'Heart & head',         keys: ['attitude', 'clutch'] },
];

export const CATEGORIES: Record<CategoryName, CategoryMeta> = {
  physical: { label: 'Physical', color: '#e23b30' }, // red
  skill:    { label: 'Skill',    color: '#2f59a6' }, // blue
  mental:   { label: 'Mental',   color: '#ef8a2b' }, // ball orange
};

// Format a raw attribute value for display (e.g. 84 -> 7'0", 250 -> 250 lbs).
export function formatValue(format: ValueFormat, value: number): string {
  if (format === 'height') {
    const ft = Math.floor(value / 12);
    const inch = value % 12;
    return `${ft}'${inch}"`;
  }
  if (format === 'weight') return `${value} lbs`;
  return `${value}`;
}
