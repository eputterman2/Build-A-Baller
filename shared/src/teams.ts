import type { Team } from './types';

// All 30 current NBA teams, keyed by the abbreviation used on each player.
export const TEAMS: Team[] = [
  // ---- Eastern Conference ----
  { abbr: 'ATL', name: 'Atlanta Hawks',          conference: 'East', color: '#e03a3e' },
  { abbr: 'BOS', name: 'Boston Celtics',         conference: 'East', color: '#007a33' },
  { abbr: 'BKN', name: 'Brooklyn Nets',          conference: 'East', color: '#1d1d1d' },
  { abbr: 'CHA', name: 'Charlotte Hornets',      conference: 'East', color: '#1d1160' },
  { abbr: 'CHI', name: 'Chicago Bulls',          conference: 'East', color: '#ce1141' },
  { abbr: 'CLE', name: 'Cleveland Cavaliers',    conference: 'East', color: '#860038' },
  { abbr: 'DET', name: 'Detroit Pistons',        conference: 'East', color: '#1d42ba' },
  { abbr: 'IND', name: 'Indiana Pacers',         conference: 'East', color: '#fdbb30' },
  { abbr: 'MIA', name: 'Miami Heat',             conference: 'East', color: '#98002e' },
  { abbr: 'MIL', name: 'Milwaukee Bucks',        conference: 'East', color: '#00471b' },
  { abbr: 'NYK', name: 'New York Knicks',        conference: 'East', color: '#f58426' },
  { abbr: 'ORL', name: 'Orlando Magic',          conference: 'East', color: '#0077c0' },
  { abbr: 'PHI', name: 'Philadelphia 76ers',     conference: 'East', color: '#006bb6' },
  { abbr: 'TOR', name: 'Toronto Raptors',        conference: 'East', color: '#ce1141' },
  { abbr: 'WAS', name: 'Washington Wizards',     conference: 'East', color: '#002b5c' },
  // ---- Western Conference ----
  { abbr: 'DAL', name: 'Dallas Mavericks',       conference: 'West', color: '#00538c' },
  { abbr: 'DEN', name: 'Denver Nuggets',         conference: 'West', color: '#0e2240' },
  { abbr: 'GSW', name: 'Golden State Warriors',  conference: 'West', color: '#1d428a' },
  { abbr: 'HOU', name: 'Houston Rockets',        conference: 'West', color: '#ce1141' },
  { abbr: 'LAC', name: 'LA Clippers',            conference: 'West', color: '#c8102e' },
  { abbr: 'LAL', name: 'Los Angeles Lakers',     conference: 'West', color: '#552583' },
  { abbr: 'MEM', name: 'Memphis Grizzlies',      conference: 'West', color: '#5d76a9' },
  { abbr: 'MIN', name: 'Minnesota Timberwolves', conference: 'West', color: '#0c2340' },
  { abbr: 'NOP', name: 'New Orleans Pelicans',   conference: 'West', color: '#0c2340' },
  { abbr: 'OKC', name: 'Oklahoma City Thunder',  conference: 'West', color: '#007ac1' },
  { abbr: 'PHX', name: 'Phoenix Suns',           conference: 'West', color: '#1d1160' },
  { abbr: 'POR', name: 'Portland Trail Blazers', conference: 'West', color: '#e03a3e' },
  { abbr: 'SAC', name: 'Sacramento Kings',       conference: 'West', color: '#5a2d81' },
  { abbr: 'SAS', name: 'San Antonio Spurs',      conference: 'West', color: '#8a8d8f' },
  { abbr: 'UTA', name: 'Utah Jazz',              conference: 'West', color: '#002b5c' },
];

export const TEAMS_BY_ABBR: Record<string, Team> =
  Object.fromEntries(TEAMS.map(t => [t.abbr, t]));
