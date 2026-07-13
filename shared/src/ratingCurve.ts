// Difficulty curve applied to ratings (not physical measurements). It keeps
// defining all-time skills at the top while creating more separation between
// superstars, starters, role players, and genuinely weak players.
export function spread(v: number): number {
  if (v >= 99) return 100;
  if (v >= 96) return 99;
  if (v >= 90) return v + 3;
  if (v >= 84) return v * 2 - 87;
  if (v >= 80) return v - 10;
  if (v >= 73) return v - 11;
  return Math.max(1, Math.round(62 + (v - 73) * 2.3));
}
