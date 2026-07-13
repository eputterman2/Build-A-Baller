// Game flow: intro -> 14 attribute spins -> scored results.

const SEGMENTS_PER_WHEEL = 12;

const state = { picks: {}, index: 0 };
let wheel;

// --- tiny DOM helpers ---
const $ = (id) => document.getElementById(id);
function show(screenId) {
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
  $(screenId).classList.add('active');
}
function gradeFor(score) {
  if (score >= 92) return { g: 'S', label: 'Generational' };
  if (score >= 85) return { g: 'A', label: 'Superstar' };
  if (score >= 78) return { g: 'B', label: 'All-Star' };
  if (score >= 68) return { g: 'C', label: 'Starter' };
  if (score >= 55) return { g: 'D', label: 'Rotation Player' };
  return { g: 'F', label: 'Benchwarmer' };
}

function init() {
  wheel = new Wheel($('wheel-canvas'));
  $('btn-start').addEventListener('click', startGame);
  $('btn-spin').addEventListener('click', doSpin);
  $('btn-next').addEventListener('click', nextAttribute);
  $('btn-restart').addEventListener('click', startGame);
}

function startGame() {
  state.picks = {};
  state.index = 0;
  show('screen-spin');
  loadAttribute();
}

function loadAttribute() {
  const attr = ATTRIBUTES[state.index];
  const cat = CATEGORIES[attr.category];

  $('spin-progress').textContent = `Attribute ${state.index + 1} of ${ATTRIBUTES.length}`;
  $('spin-progress-bar').style.width =
    `${(state.index / ATTRIBUTES.length) * 100}%`;
  $('spin-category').textContent = cat.label;
  $('spin-category').style.background = cat.color;
  $('spin-attr-label').textContent = attr.label;

  $('spin-result').classList.add('hidden');
  $('btn-next').classList.add('hidden');
  $('btn-spin').classList.remove('hidden');
  $('btn-spin').disabled = false;

  wheel.setSegments(randomSegments(PLAYERS, SEGMENTS_PER_WHEEL, attr.key));
}

async function doSpin() {
  $('btn-spin').disabled = true;
  const attr = ATTRIBUTES[state.index];
  const segment = await wheel.spin();

  state.picks[attr.key] = { player: segment.player, value: segment.value };

  const subScore = attributeScore(attr, segment.value);
  const rawText = formatValue(attr.format, segment.value);
  $('spin-result').innerHTML =
    `<div class="result-player">${segment.player.name}</div>` +
    `<div class="result-detail">${attr.label}: <b>${rawText}</b>` +
    ` &rarr; <span class="result-score">${subScore}</span>/100</div>`;
  $('spin-result').classList.remove('hidden');

  $('btn-spin').classList.add('hidden');
  const last = state.index === ATTRIBUTES.length - 1;
  $('btn-next').textContent = last ? 'See Your Player ➜' : 'Next Spin ➜';
  $('btn-next').classList.remove('hidden');
}

function nextAttribute() {
  state.index++;
  if (state.index >= ATTRIBUTES.length) {
    showResults();
  } else {
    loadAttribute();
  }
}

function showResults() {
  const r = scoreBuild(state.picks);
  show('screen-results');

  const grade = gradeFor(r.overall);
  $('result-overall').textContent = r.overall;
  $('result-grade').textContent = grade.g;
  $('result-grade-label').textContent = grade.label;

  // Category bars.
  $('result-categories').innerHTML = Object.keys(CATEGORIES).map(name => {
    const c = CATEGORIES[name];
    const v = r.categoryScores[name];
    return bar(c.label, v, c.color);
  }).join('');

  // Injury risk meter.
  const riskColor = r.injuryRisk >= 55 ? '#e63946'
    : r.injuryRisk >= 30 ? '#f4a261' : '#2a9d8f';
  $('result-injury').innerHTML = bar('Injury Risk', r.injuryRisk, riskColor, '%');

  // Every attribute, grouped by category.
  $('result-attrs').innerHTML = ATTRIBUTES.map(attr => {
    const v = r.subScores[attr.key];
    const pick = state.picks[attr.key];
    const raw = formatValue(attr.format, pick.value);
    return `<div class="attr-row">
        <span class="attr-name">${attr.label}</span>
        <span class="attr-from">${lastName(pick.player.name)} · ${raw}</span>
        <span class="attr-val" style="color:${scoreColor(v)}">${v}</span>
      </div>`;
  }).join('');

  // Synergies / tradeoffs.
  $('result-synergies').innerHTML = r.modifiers.length
    ? r.modifiers.map(m => `<div class="synergy">
        <span class="synergy-icon">${m.icon}</span>
        <div><b>${m.name}</b><br><span class="synergy-text">${m.text}</span></div>
      </div>`).join('')
    : '<div class="synergy-empty">No notable synergies — a well-balanced build.</div>';
}

function bar(label, value, color, unit = '') {
  return `<div class="bar-row">
      <div class="bar-label">${label}<span>${value}${unit}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${value}%;background:${color}"></div></div>
    </div>`;
}

function scoreColor(v) {
  if (v >= 85) return '#2a9d8f';
  if (v >= 70) return '#8ab17d';
  if (v >= 55) return '#e9c46a';
  if (v >= 40) return '#f4a261';
  return '#e63946';
}

document.addEventListener('DOMContentLoaded', init);
