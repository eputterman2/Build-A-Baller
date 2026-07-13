import { LEGENDS } from '../shared/src/legends.ts';
import { PLAYER_NBA_IDS } from '../shared/src/playerImagesLegends.ts';
import { writeFileSync } from 'node:fs';
const UA = { 'User-Agent':'BuildABaller/1.0 (https://example.com; educational hobby project)' };
const sleep = (ms:number) => new Promise(r=>setTimeout(r,ms));
const missing = LEGENDS.filter(l => !PLAYER_NBA_IDS[l.id]);
console.log('Filling', missing.length, 'legends (sequential)...');

async function restSummary(title:string): Promise<any|null> {
  for (let attempt=0; attempt<3; attempt++){
    try {
      const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(title.replace(/ /g,'_')),{headers:UA,signal:AbortSignal.timeout(9000)});
      if (r.status===429){ await sleep(2500); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(800); }
  }
  return null;
}
async function image(name:string): Promise<string|null> {
  for (const [title,guaranteed] of [[name+' (basketball)',true],[name,false]] as [string,boolean][]) {
    const j = await restSummary(title);
    await sleep(140);
    if (!j || j.type==='disambiguation' || !j.thumbnail?.source) continue;
    const ok = guaranteed || /basketball/i.test((j.description||'')+' '+(j.extract||''));
    if (ok) return j.thumbnail.source;
  }
  return null;
}

const map: Record<string,string> = {};
let hit=0, i=0;
for (const m of missing){
  const url = await image(m.name);
  if (url){ map[m.id]=url; hit++; }
  if (++i % 25 === 0) console.log('  ...'+i+'/'+missing.length+' ('+hit+' found)');
}
console.log('Recovered Wikipedia photos:', hit, '/', missing.length, '| still initials:', missing.length-hit);
writeFileSync('shared/src/playerImagesWiki.ts',
  '// AUTO-GENERATED — Wikipedia lead-image URLs for legends with no NBA/ESPN headshot.\n'
  + 'export const PLAYER_WIKI_IMAGES: Record<string, string> = ' + JSON.stringify(map) + ';\n');
console.log('wrote shared/src/playerImagesWiki.ts');
