// Small helpers shared across components.
export function lastName(name: string): string {
  const parts = name.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
}

export function scoreColor(v: number): string {
  if (v >= 85) return '#1f9d63'; // green
  if (v >= 70) return '#5a9e3e'; // olive
  if (v >= 55) return '#c8930f'; // gold
  if (v >= 40) return '#e0701d'; // orange
  return '#d23b30';              // red
}

export function overallTier(overall: number): string {
  if (overall <= 75) return 'bronze';
  if (overall <= 81) return 'silver';
  if (overall <= 87) return 'gold';
  if (overall <= 91) return 'amethyst';
  if (overall <= 95) return 'diamond';
  if (overall <= 98) return 'pink-diamond';
  return 'kryptonite';
}
