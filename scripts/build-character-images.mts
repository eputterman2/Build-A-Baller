import { CHARACTERS } from '../shared/src/characters.ts';
import { writeFileSync } from 'node:fs';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
// curated Wikipedia titles for disambiguation
const TITLE: Record<string,string[]> = {
  'drake':['Drake (musician)'],
  'justin-bieber':['Justin Bieber'],
  'timothee-chalamet':['Timothée Chalamet'],
  'liangelo-ball':['LiAngelo Ball'],
  'lavar-ball':['LaVar Ball'],
  'lionel-messi':['Lionel Messi'],
  'larry-david':['Larry David'],
  'bernie-sanders':['Bernie Sanders'],
  'serena-williams':['Serena Williams'],
  'alex-morgan':['Alex Morgan (soccer)'],
  'michael-scott':['Michael Scott (The Office)'],
  'jim-halpert':['Jim Halpert'],
  'charlie-kelly':["Charlie Kelly (It's Always Sunny in Philadelphia)"],
  'peter-griffin':['Peter Griffin'],
  'lisa-simpson':['Lisa Simpson'],
  'stuart-little':['Stuart Little'],
  'air-bud':['Air Bud'],
  'spider-man':['Spider-Man'],
  'batman':['Batman'],
  'wonder-woman':['Wonder Woman'],
  'the-hulk':['Hulk'],
  'she-hulk':['She-Hulk'],
  'iron-man':['Iron Man'],
  'the-flash':['Flash (Barry Allen)','The Flash (Barry Allen)'],
  'bullseye':['Bullseye (Marvel Comics)'],
  'bane':['Bane (DC Comics)'],
  'ant-man':['Ant-Man (character)','Scott Lang (character)','Ant-Man'],
  'gamora':['Gamora'],
  'superman':['Superman'],
  'supergirl':['Supergirl'],
  'silver-surfer':['Silver Surfer'],
  'thanos':['Thanos'],
  'venom':['Venom (character)','Venom (Marvel Comics character)'],
  'starfire':['Starfire (Teen Titans)','Starfire (character)'],
  'jean-grey':['Jean Grey'],
};
async function rest(title:string){for(let a=0;a<3;a++){try{const r=await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(title.replace(/ /g,'_')),{headers:{'User-Agent':'BuildABaller/1.0 (hobby)'},signal:AbortSignal.timeout(9000)});if(r.status===429){await sleep(2500);continue;}if(!r.ok)return null;return await r.json();}catch{await sleep(700);}}return null;}
async function img(slug:string,name:string){const titles=[...(TITLE[slug]||[]),name];for(const t of titles){const j:any=await rest(t);await sleep(130);if(j&&j.type!=='disambiguation'&&j.thumbnail?.source)return j.thumbnail.source;}return null;}
const map:Record<string,string>={};
for(const p of CHARACTERS){const u=await img(p.id,p.name);if(u)map[p.id]=u;console.log('  '+p.name.padEnd(22)+(u?'OK':'— (initials)'));}
console.log('Character photos:',Object.keys(map).length,'/',CHARACTERS.length);
writeFileSync('shared/src/playerImagesChars.ts','// AUTO-GENERATED — Wikipedia images for celebrity/fictional characters.\nexport const PLAYER_CHAR_IMAGES: Record<string, string> = '+JSON.stringify(map)+';\n');
console.log('wrote playerImagesChars.ts');
