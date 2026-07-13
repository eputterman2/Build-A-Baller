import { PLAYERS } from '../shared/src/players.ts';
import { PLAYER_ESPN_IDS } from '../shared/src/playerImages.ts';
import { writeFileSync } from 'node:fs';
const norm = (s:string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[.'`’]/g,'').replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const H = { 'User-Agent':'Mozilla/5.0','Referer':'https://www.nba.com/','Accept':'application/json','x-nba-stats-origin':'stats','x-nba-stats-token':'true' };
const r = await fetch('https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=2024-25&IsOnlyCurrentSeason=0',{headers:H,signal:AbortSignal.timeout(15000)});
const rows = (await r.json() as any).resultSets[0].rowSet;
const nameToId: Record<string,string> = {};
for (const row of rows){ const k=norm(row[2]); if(!(k in nameToId)) nameToId[k]=String(row[0]); }
const ALIAS: Record<string,string> = { 'penny-hardaway':'anfernee hardaway','cliff-robinson':'clifford robinson','world-b-free':'world b free' };
// candidates = every pooled player without an ESPN photo (22 current + all legends)
const cands = PLAYERS.filter(p => !PLAYER_ESPN_IDS[p.id]).map(p=>({slug:p.id, nbaId: nameToId[norm(p.name)] || nameToId[ALIAS[p.id]||''] || null})).filter(c=>c.nbaId) as {slug:string;nbaId:string}[];
console.log('candidates without ESPN:', PLAYERS.filter(p=>!PLAYER_ESPN_IDS[p.id]).length, '| resolved NBA id:', cands.length);
async function bytes(id:string){ try{ const r=await fetch(`https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`,{signal:AbortSignal.timeout(8000)}); if(r.status!==200) return 0; return (await r.arrayBuffer()).byteLength;}catch{return -1;} }
const map: Record<string,string> = {}; let real=0;
for (let i=0;i<cands.length;i+=15){
  const res = await Promise.all(cands.slice(i,i+15).map(async c=>({c,b:await bytes(c.nbaId)})));
  for (const {c,b} of res){ if(b>6000){ map[c.slug]=c.nbaId; real++; } }
}
console.log('NBA headshots (current-missing + legends):', real);
writeFileSync('shared/src/playerImagesLegends.ts',
  '// AUTO-GENERATED — NBA.com headshot ids for players without an ESPN photo (legends + a few current).\n'
  + 'export const PLAYER_NBA_IDS: Record<string, string> = ' + JSON.stringify(map) + ';\n');
console.log('wrote playerImagesLegends.ts with', Object.keys(map).length, 'entries');
