import { WNBA_PLAYERS } from '../shared/src/wnba.ts';
import { writeFileSync } from 'node:fs';
const norm=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[.'`’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function bytes(u:string){try{const r=await fetch(u,{headers:{'User-Agent':'BuildABaller/1.0'},signal:AbortSignal.timeout(8000)});if(r.status!==200)return 0;return (await r.arrayBuffer()).byteLength;}catch{return -1;}}
// WNBA CDN ids
const H={'User-Agent':'Mozilla/5.0','Referer':'https://www.wnba.com/','Accept':'application/json','x-nba-stats-origin':'stats','x-nba-stats-token':'true'};
const wmap:Record<string,string>={};
try{const r=await fetch('https://stats.wnba.com/stats/commonallplayers?LeagueID=10&Season=2024&IsOnlyCurrentSeason=0',{headers:H,signal:AbortSignal.timeout(15000)});const rs=(await r.json() as any).resultSets[0];for(const row of rs.rowSet){const k=norm(row[2]);if(!(k in wmap))wmap[k]=String(row[0]);}}catch(e){console.log('wnba list err');}
async function espnWnba(name:string){try{const r=await fetch('https://site.web.api.espn.com/apis/search/v2?query='+encodeURIComponent(name)+'&limit=12');const j:any=await r.json();for(const g of (j.results||[]))for(const c of (g.contents||[])){if(c.link?.web){const m=c.link.web.match(/\/wnba\/player\/_\/id\/(\d+)\//);if(m&&norm(c.displayName||'')===norm(name))return m[1];}}}catch{}return null;}
async function wiki(name:string){for(const t of [name+' (basketball)',name]){try{const r=await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(t.replace(/ /g,'_')),{headers:{'User-Agent':'BuildABaller/1.0'},signal:AbortSignal.timeout(9000)});if(!r.ok)continue;const j:any=await r.json();if(j.type==='disambiguation'||!j.thumbnail?.source)continue;if(/basketball/i.test((j.description||'')+' '+(j.extract||'')))return j.thumbnail.source;}catch{}await sleep(120);}return null;}

const map:Record<string,string>={};
for(const p of WNBA_PLAYERS){
  let url:string|null=null;
  const wid=wmap[norm(p.name)];
  if(wid){const u=`https://cdn.wnba.com/headshots/wnba/latest/260x190/${wid}.png`; if(await bytes(u)>5000) url=u;}
  if(!url){const eid=await espnWnba(p.name); if(eid){const u=`https://a.espncdn.com/i/headshots/wnba/players/full/${eid}.png`; if(await bytes(u)>5000) url=u;}}
  if(!url){ url = await wiki(p.name); }
  if(url) map[p.id]=url;
  console.log('  '+p.name.padEnd(20)+(url?(url.includes('cdn.wnba')?'WNBA':url.includes('espncdn')?'ESPN':'WIKI'):'— DROP'));
  await sleep(120);
}
console.log('WNBA photos found:', Object.keys(map).length, '/', WNBA_PLAYERS.length);
writeFileSync('shared/src/playerImagesWnba.ts',
  '// AUTO-GENERATED — WNBA headshot URLs (WNBA.com / ESPN / Wikipedia).\n'
  + 'export const PLAYER_WNBA_IMAGES: Record<string, string> = ' + JSON.stringify(map) + ';\n');
console.log('wrote playerImagesWnba.ts');
