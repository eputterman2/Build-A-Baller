import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ATTRIBUTES, ATTRIBUTE_GROUPS, PLAYERS, PLAYERS_BY_ID,
  attributeScore, buildArchetypeTitle, computeBuild, formatValue, idealWeightForHeight,
  playerImageUrl, scoreBuild, selectArchetypeCharacter,
  type Attribute, type AttributeKey, type BuildAccessories, type PickMap, type Player, type PlayerIdentity, type PlayerOfDay as PlayerOfDayData, type RawValues, type ScoreResult,
} from '@shared/index';
import { api } from '../api';
import { useAuth } from '../auth';
import { Results } from './Results';
import { AuthModal } from './AuthModal';
import { SaveIdentityModal } from './SaveIdentityModal';
import { PlayerAvatar } from './PlayerAvatar';
import { BuildPanel } from './BuildPanel';
import { PlayerOfDay } from './PlayerOfDay';
import { PlayerDrawingPoll } from './PlayerDrawingPoll';
import { FeedbackSection } from './FeedbackSection';
import { lastName, scoreColor } from '../util';

type Phase = 'intro' | 'pick' | 'gamble' | 'results';
type ReelStatus = 'ready' | 'spinning' | 'stopped';
type TutorialStep = 'spin' | 'wait' | 'select' | 'assign' | 'continue';

const ATTR_BY_KEY: Record<AttributeKey, Attribute> =
  Object.fromEntries(ATTRIBUTES.map(a => [a.key, a])) as Record<AttributeKey, Attribute>;
const TUTORIAL_STORAGE_KEY = 'build-a-baller-hide-tutorial';
const TOTAL_ROUNDS = ATTRIBUTE_GROUPS.length + 1;
const SPIN_DURATION_MS = 2000;
const SPIN_POOL_KEEP_RATE = 0.80;

const RATED_ATTRIBUTES = ATTRIBUTES.filter(attr => attr.type === 'rating');
const playerQuality = (player: Player) =>
  RATED_ATTRIBUTES.reduce((sum, attr) =>
    sum + attributeScore(attr, player[attr.key] as number), 0) / RATED_ATTRIBUTES.length;

const SPECIALTY_PLAYERS = PLAYERS.filter(player => player.team === 'STAR');
const REGULAR_SPIN_POOL = PLAYERS.filter(player => player.team !== 'STAR')
  .sort((a, b) => playerQuality(a) - playerQuality(b))
  .slice(Math.floor(PLAYERS.filter(player => player.team !== 'STAR').length * (1 - SPIN_POOL_KEEP_RATE)));
const SPIN_POOL = [...REGULAR_SPIN_POOL, ...SPECIALTY_PLAYERS];

function loadTutorialPreference() {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveTutorialPreference() {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
  } catch {
    // The close button still works for the current game if storage is unavailable.
  }
}

interface Reel { player: Player; status: ReelStatus; }
interface FinalBuild {
  overall: number;
  result: ScoreResult;
  picks: PickMap;
  buildId: string | null;
  characterId: string;
}

function randomPlayer(excludedIds: Set<string> = new Set()): Player {
  const available = excludedIds.size
    ? SPIN_POOL.filter(player => !excludedIds.has(player.id))
    : SPIN_POOL;
  return available[Math.floor(Math.random() * available.length)];
}
function distinctPlayers(n: number, excludedIds: Set<string> = new Set()): Player[] {
  const out: Player[] = [];
  const seen = new Set(excludedIds);
  while (out.length < n) {
    const p = randomPlayer(excludedIds);
    if (!seen.has(p.id)) { seen.add(p.id); out.push(p); }
  }
  return out;
}
const reelsForGroup = (gi: number): Reel[] =>
  Array.from({ length: ATTRIBUTE_GROUPS[gi].keys.length },
    () => ({ player: randomPlayer(), status: 'ready' as const }));
const freshGambleReel = (): Reel => ({ player: randomPlayer(), status: 'ready' });

function valuesForPicks(map: Partial<PickMap>): Partial<RawValues> {
  const values: Partial<RawValues> = {};
  for (const attr of ATTRIBUTES) {
    const id = map[attr.key];
    if (id) values[attr.key] = PLAYERS_BY_ID[id][attr.key] as number;
  }
  return values;
}

function bodyMeasurementDescriptor(
  key: AttributeKey,
  value: number,
  referenceHeight: number,
): { text: string; warning: boolean } {
  if (key === 'height') {
    if (value <= 71) return { text: 'Compact guard', warning: false };
    if (value <= 77) return { text: 'Guard-sized', warning: false };
    if (value <= 80) return { text: 'Wing-sized', warning: false };
    if (value <= 84) return { text: 'Big-sized', warning: false };
    return { text: 'Towering', warning: false };
  }

  if (key === 'weight') {
    const idealWeight = idealWeightForHeight(referenceHeight);
    const difference = value - idealWeight;
    if (difference >= 35) return { text: 'Too heavy for this height', warning: true };
    if (referenceHeight >= 79 && difference <= -25) {
      return { text: 'Too light for this height', warning: true };
    }
    if (difference < -5) return { text: 'Lean for this height', warning: false };
    if (difference < 12) return { text: 'Balanced for height', warning: false };
    return { text: 'Heavy for this height', warning: false };
  }

  const difference = value - referenceHeight;
  if (difference >= 10) return { text: 'Elite length', warning: false };
  if (difference >= 6) return { text: 'Long reach', warning: false };
  if (difference >= 3) return { text: 'Balanced reach', warning: false };
  if (difference >= 0) return { text: 'Compact reach', warning: false };
  return { text: 'Too short for this height', warning: true };
}

const tutorialCopy: Record<TutorialStep, { title: string; body: string }> = {
  spin: {
    title: 'Spin your choices',
    body: 'Tap Spin All to reveal every player, or spin the mystery cards one at a time.',
  },
  wait: {
    title: 'Let the reels finish',
    body: 'When every card stops, you will choose which player belongs in which stat.',
  },
  select: {
    title: 'Choose a player',
    body: 'Tap one revealed player. The stat slots will light up so you can place them.',
  },
  assign: {
    title: 'Place the pick',
    body: 'Tap a stat for this player, or move them to the bench and re-spin their card.',
  },
  continue: {
    title: 'Round one is set',
    body: 'You can continue, or select a player for your bench and re-spin that card first.',
  },
};

export function Game() {
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('intro');
  const [group, setGroup] = useState(0);
  const [reels, setReels] = useState<Reel[]>(() => reelsForGroup(0));
  const [assign, setAssign] = useState<Partial<Record<AttributeKey, string>>>({});
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [picks, setPicks] = useState<PickMap>({} as PickMap);   // committed (prior rounds)
  const [lastApplied, setLastApplied] = useState<AttributeKey | null>(null);

  const finalsRef = useRef<Player[]>([]);
  const intervalsRef = useRef<number[]>([]);
  const timeoutsRef = useRef<number[]>([]);

  const [final, setFinal] = useState<FinalBuild | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playerOfDay, setPlayerOfDay] = useState<PlayerOfDayData | null>(null);
  const [playerOfDayLoading, setPlayerOfDayLoading] = useState(true);
  const [gambleKey, setGambleKey] = useState<AttributeKey | null>(null);
  const [gambleReel, setGambleReel] = useState<Reel>(freshGambleReel);
  const [gambleReplaced, setGambleReplaced] = useState<{
    key: AttributeKey;
    oldPlayerId: string;
    newPlayerId: string;
  } | null>(null);
  const [benchPlayer, setBenchPlayer] = useState<Player | null>(null);
  const [benchUsed, setBenchUsed] = useState(false);
  const [hideTutorialForever, setHideTutorialForever] = useState(loadTutorialPreference);
  const [tutorialClosed, setTutorialClosed] = useState(false);
  const [ownedMarketDrawingIds, setOwnedMarketDrawingIds] = useState<string[]>([]);

  const clearTimers = useCallback(() => {
    intervalsRef.current.forEach(clearInterval);
    timeoutsRef.current.forEach(clearTimeout);
    intervalsRef.current = [];
    timeoutsRef.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    let alive = true;
    api.playerOfDay()
      .then(data => { if (alive) setPlayerOfDay(data); })
      .catch(() => { if (alive) setPlayerOfDay(null); })
      .finally(() => { if (alive) setPlayerOfDayLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user) {
      setOwnedMarketDrawingIds([]);
      return;
    }

    let alive = true;
    api.marketBundles()
      .then(data => {
        if (!alive) return;
        setOwnedMarketDrawingIds(data.bundles
          .filter(bundle => data.ownedBundleIds.includes(bundle.id))
          .map(bundle => bundle.drawingId));
      })
      .catch(() => {
        if (alive) setOwnedMarketDrawingIds([]);
      });
    return () => { alive = false; };
  }, [user]);

  // Clicking the nav logo / Play returns to the home screen, even mid-game.
  const location = useLocation();
  useEffect(() => {
    if ((location.state as { home?: number } | null)?.home) {
      clearTimers();
      setPhase('intro');
    }
  }, [location, clearTimers]);

  const loadRound = useCallback((gi: number, excludedPlayerId?: string) => {
    clearTimers();
    const excludedIds = new Set(excludedPlayerId ? [excludedPlayerId] : []);
    finalsRef.current = distinctPlayers(ATTRIBUTE_GROUPS[gi].keys.length, excludedIds);
    setReels(reelsForGroup(gi));
    setAssign({});
    setSelectedPlayerId(null);
    setLastApplied(null);
  }, [clearTimers]);

  const start = () => {
    setPicks({} as PickMap);
    setFinal(null);
    setSaveError(null);
    setTutorialClosed(false);
    setGambleKey(null);
    setGambleReel(freshGambleReel());
    setGambleReplaced(null);
    setBenchPlayer(null);
    setBenchUsed(false);
    setGroup(0);
    setPhase('pick');
    loadRound(0);
  };

  const closeTutorial = () => setTutorialClosed(true);
  const neverShowTutorial = () => {
    saveTutorialPreference();
    setHideTutorialForever(true);
  };

  // Spin one reel to reveal a player for this round's pool (distinct per reel).
  const spinReel = (i: number) => {
    clearInterval(intervalsRef.current[i]);
    clearTimeout(timeoutsRef.current[i]);
    setReels(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'spinning' } : r));

    const finalP = finalsRef.current[i] ?? randomPlayer();
    const pool = [...distinctPlayers(10), finalP];
    pool.forEach(p => { const u = playerImageUrl(p.id); if (u) { const im = new Image(); im.src = u; } });

    intervalsRef.current[i] = window.setInterval(() => {
      const p = pool[Math.floor(Math.random() * pool.length)];
      setReels(prev => prev.map((r, idx) => idx === i ? { ...r, player: p } : r));
    }, 75);

    timeoutsRef.current[i] = window.setTimeout(() => {
      clearInterval(intervalsRef.current[i]);
      setReels(prev => prev.map((r, idx) => idx === i ? { ...r, player: finalP, status: 'stopped' } : r));
    }, SPIN_DURATION_MS);
  };

  const spinAllReels = () => {
    reels.forEach((reel, index) => {
      if (reel.status === 'ready') spinReel(index);
    });
  };

  // Assign a player to a stat (each player ends up in at most one stat).
  const assignCell = (playerId: string, key: AttributeKey) => {
    setAssign(prev => {
      const na = { ...prev };
      for (const k of Object.keys(na) as AttributeKey[]) if (na[k] === playerId) delete na[k];
      na[key] = playerId;
      return na;
    });
    setLastApplied(key);
  };

  // Step 1: tap a spun player to select it (tap again to deselect).
  const onPlayerClick = (reelIndex: number) => {
    const r = reels[reelIndex];
    if (r.status === 'ready') { spinReel(reelIndex); return; }
    if (r.status === 'stopped') {
      setSelectedPlayerId(id => id === r.player.id ? null : r.player.id);
    }
  };

  // Step 2: tap a stat to drop the selected player into it.
  const onStatClick = (key: AttributeKey) => {
    if (!selectedPlayerId) return;
    assignCell(selectedPlayerId, key);
    setSelectedPlayerId(null);
  };

  const storeSelectedOnBench = () => {
    if (benchPlayer || benchUsed || !selectedPlayerId) return;
    const reelIndex = reels.findIndex(reel =>
      reel.status === 'stopped' && reel.player.id === selectedPlayerId);
    if (reelIndex < 0) return;

    const player = reels[reelIndex].player;
    const excludedIds = new Set(reels.map(reel => reel.player.id));
    const replacementFinal = randomPlayer(excludedIds);
    finalsRef.current[reelIndex] = replacementFinal;

    setAssign(current => {
      const updated = { ...current };
      for (const key of Object.keys(updated) as AttributeKey[]) {
        if (updated[key] === player.id) delete updated[key];
      }
      return updated;
    });
    setBenchPlayer(player);
    setReels(current => current.map((reel, index) =>
      index === reelIndex
        ? { player: randomPlayer(excludedIds), status: 'ready' }
        : reel));
    setSelectedPlayerId(null);
  };

  const finish = (allPicks: PickMap) => {
    const values = valuesForPicks(allPicks) as RawValues;
    const result = scoreBuild(values);
    setFinal({
      overall: result.overall,
      result,
      picks: allPicks,
      buildId: null,
      characterId: selectArchetypeCharacter(result, allPicks, ownedMarketDrawingIds).id,
    });
    setPhase('results');
  };

  const enterGamble = (allPicks: PickMap) => {
    clearTimers();
    setPicks(allPicks);
    setGambleKey(null);
    setGambleReel(freshGambleReel());
    setGambleReplaced(null);
    setLastApplied(null);
    setPhase('gamble');
  };

  const next = () => {
    if (!reels.every(reel => reel.status === 'stopped')
        || !ATTRIBUTE_GROUPS[group].keys.every(key => assign[key])) return;
    const merged = { ...picks, ...assign } as PickMap;
    setPicks(merged);
    const usedBenchThisRound = !!benchPlayer
      && Object.values(assign).includes(benchPlayer.id);
    const nextBenchPlayer = usedBenchThisRound ? null : benchPlayer;
    if (usedBenchThisRound) {
      setBenchPlayer(null);
      setBenchUsed(true);
    }
    if (group === ATTRIBUTE_GROUPS.length - 1) {
      enterGamble(merged);
    } else {
      const gi = group + 1;
      setGroup(gi);
      loadRound(gi, nextBenchPlayer?.id);
    }
  };

  const spinGamble = () => {
    if (!gambleKey || gambleReel.status !== 'ready' || gambleReplaced) return;
    const key = gambleKey;
    const oldPlayerId = picks[key];
    const finalP = randomPlayer();
    const pool = [...distinctPlayers(12), finalP];
    pool.forEach(p => { const u = playerImageUrl(p.id); if (u) { const im = new Image(); im.src = u; } });

    clearTimers();
    setGambleReel(prev => ({ ...prev, status: 'spinning' }));

    intervalsRef.current[0] = window.setInterval(() => {
      const p = pool[Math.floor(Math.random() * pool.length)];
      setGambleReel({ player: p, status: 'spinning' });
    }, 75);

    timeoutsRef.current[0] = window.setTimeout(() => {
      clearInterval(intervalsRef.current[0]);
      setGambleReel({ player: finalP, status: 'stopped' });
      setPicks(prev => ({ ...prev, [key]: finalP.id } as PickMap));
      setGambleReplaced({ key, oldPlayerId, newPlayerId: finalP.id });
      setLastApplied(key);
    }, SPIN_DURATION_MS);
  };

  const submitSave = useCallback(async (identity: PlayerIdentity, accessories?: BuildAccessories) => {
    if (!final) return;
    setSaving(true);
    setSaveError(null);
    try {
      const build = await api.submitBuild(final.picks, identity, accessories, final.characterId);
      setFinal({
        overall: build.overall,
        result: build.result,
        picks: build.picks,
        buildId: build.id,
        characterId: build.characterId,
      });
      setShowIdentity(false);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [final]);

  const openSaveFlow = () => {
    if (!final) return;
    if (!user) { setPendingSave(true); setShowAuth(true); return; }
    setSaveError(null);
    setShowIdentity(true);
  };

  useEffect(() => {
    if (user && pendingSave && final && !final.buildId) {
      setPendingSave(false);
      setShowIdentity(true);
    }
  }, [user, pendingSave, final]);

  const changeFinalCharacter = useCallback((characterId: string) => {
    setFinal(current => current ? { ...current, characterId } : current);
  }, []);

  // ---- Intro ----
  if (phase === 'intro') {
    return (
      <div className="hero">
        <img className="hero-logo" src="/logo.png" alt="Build-A-Baller" />
        <img className="hero-players" src="/hero-players.png" alt="" />
        <p className="tagline">Build your dream baller one stat at a time.</p>
        <button className="btn btn-primary" onClick={start}>Start Building</button>
        <PlayerOfDay data={playerOfDay} loading={playerOfDayLoading} />
        <PlayerDrawingPoll />
        <FeedbackSection />
        <p className="home-disclaimer">
          Build-A-Baller is an independent project and is not affiliated with, endorsed by, or sponsored by the National Basketball Association.
        </p>
      </div>
    );
  }

  // ---- Results ----
  if (phase === 'results' && final) {
    return (
      <div className="results">
        <h2 className="results-title">{buildArchetypeTitle(final.result)}</h2>
        <Results
          overall={final.overall}
          result={final.result}
          picks={final.picks}
          selectedCharacterId={final.characterId}
          onCharacterChange={changeFinalCharacter}
        />

        <div className="save-bar">
          {final.buildId ? (
            <>
              <div className="saved-msg">Saved to the leaderboard!</div>
              <div className="save-actions">
                <Link className="btn btn-small" to="/leaderboard">View Leaderboard</Link>
                <button className="btn btn-small" onClick={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/build/${final.buildId}`);
                  setCopied(true); setTimeout(() => setCopied(false), 1500);
                }}>{copied ? 'Copied!' : 'Copy Share Link'}</button>
              </div>
            </>
          ) : (
            <>
              <div className="save-prompt">
                {user ? 'Save this build to the global leaderboard.'
                      : 'Log in to save this build to the global leaderboard.'}
              </div>
              {saveError && <div className="form-error">{saveError}</div>}
              <button className="btn btn-primary" onClick={openSaveFlow} disabled={saving}>
                {saving ? 'Saving…' : 'Save to Leaderboard'}
              </button>
            </>
          )}
          <button className="btn btn-ghost" onClick={start}>Build Another</button>
        </div>

        {showAuth && (
          <AuthModal onClose={() => { setShowAuth(false); if (!user) setPendingSave(false); }}
            intro="Create an account to put your baller on the leaderboard." />
        )}
        {showIdentity && (
          <SaveIdentityModal
            onClose={() => setShowIdentity(false)}
            onSave={submitSave}
            saving={saving}
            showAccessories
          />
        )}
      </div>
    );
  }

  // ---- Gamble ----
  if (phase === 'gamble') {
    const preview = computeBuild(valuesForPicks(picks));
    const selectedAttr = gambleKey ? ATTR_BY_KEY[gambleKey] : null;
    const locked = gambleReel.status !== 'ready' || !!gambleReplaced;
    const canSpin = !!gambleKey && gambleReel.status === 'ready' && !gambleReplaced;
    const landedPlayer = gambleReplaced ? PLAYERS_BY_ID[gambleReplaced.newPlayerId] : null;
    const oldPlayer = gambleReplaced
      ? PLAYERS_BY_ID[gambleReplaced.oldPlayerId]
      : gambleKey ? PLAYERS_BY_ID[picks[gambleKey]] : null;

    return (
      <div className="gamble-screen">
        <div className="spin-head">
          <div className="progress">
            <span>Round {TOTAL_ROUNDS} of {TOTAL_ROUNDS}</span>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: '100%' }} />
            </div>
          </div>
          <div className="spin-title">
            One last risk
            <h2>Wild Card</h2>
          </div>
        </div>

        <div className="pick-layout">
          <BuildPanel preview={preview} justPicked={lastApplied} />
          <div className="pick-main">
            <div className="gamble-panel">
              <div className="gamble-copy">
                <h3>Replace one stat?</h3>
                <p>Pick a stat, spin once, and whatever player lands becomes the new source for that stat.</p>
              </div>

              <div className="gamble-grid">
                {ATTRIBUTES.map(attr => {
                  const currentPlayer = PLAYERS_BY_ID[picks[attr.key]];
                  const currentScore = attributeScore(attr, currentPlayer[attr.key] as number);
                  const currentDisplay = attr.type === 'measure'
                    ? formatValue(attr.format, currentPlayer[attr.key] as number)
                    : currentScore;
                  return (
                    <button
                      key={attr.key}
                      className={`gamble-stat${gambleKey === attr.key ? ' selected' : ''}${gambleReplaced?.key === attr.key ? ' replaced' : ''}`}
                      disabled={locked}
                      onClick={() => setGambleKey(attr.key)}
                    >
                      <span className="gamble-stat-name">{attr.label}</span>
                      <span className="gamble-stat-player">{lastName(currentPlayer.name)}</span>
                      <b
                        className={attr.type === 'measure' ? 'gamble-measurement' : undefined}
                        style={attr.type === 'rating' ? { color: scoreColor(currentScore) } : undefined}
                      >
                        {currentDisplay}
                      </b>
                    </button>
                  );
                })}
              </div>

              <div className="gamble-spin">
                <button
                  className={`pcard gamble-card ${gambleReel.status}${canSpin ? ' clickable' : ''}`}
                  disabled={!canSpin}
                  onClick={spinGamble}
                >
                  {gambleReel.status === 'ready'
                    ? <div className="avatar placeholder"><span className="slot-icon">?</span></div>
                    : <PlayerAvatar player={gambleReel.player} />}
                  <div className="pcard-name">
                    {gambleReel.status === 'ready'
                      ? gambleKey ? 'Tap to spin' : 'Choose a stat'
                      : gambleReel.status === 'spinning' ? ' ' : gambleReel.player.name}
                  </div>
                </button>

                <div className="gamble-status">
                  {gambleReplaced && selectedAttr && landedPlayer && oldPlayer ? (
                    <>
                      <h3>{selectedAttr.label} replaced</h3>
                      <p>
                        {lastName(oldPlayer.name)} is gone. {lastName(landedPlayer.name)} now owns this stat.
                      </p>
                      <div className="gamble-swap">
                        <span>{formatValue(selectedAttr.format, oldPlayer[selectedAttr.key] as number)}</span>
                        <b>→</b>
                        <span>{formatValue(selectedAttr.format, landedPlayer[selectedAttr.key] as number)}</span>
                      </div>
                    </>
                  ) : selectedAttr && oldPlayer ? (
                    <>
                      <h3>{selectedAttr.label}</h3>
                      <p>
                        Current source: {lastName(oldPlayer.name)} · {formatValue(selectedAttr.format, oldPlayer[selectedAttr.key] as number)}
                      </p>
                      <p className="gamble-warning">Once you spin, this stat is locked to the new player.</p>
                    </>
                  ) : (
                    <>
                      <h3>Choose your risk</h3>
                      <p>Select any completed stat, or skip this round and keep your build as-is.</p>
                    </>
                  )}
                </div>
              </div>

              <div className="spin-actions gamble-actions">
                {gambleReplaced ? (
                  <button className="btn btn-primary" onClick={() => finish(picks)}>See Your Player →</button>
                ) : (
                  <>
                    <button className="btn btn-ghost" onClick={() => finish(picks)} disabled={gambleReel.status === 'spinning'}>
                      Skip Wild Card
                    </button>
                    <button className="btn btn-primary" onClick={spinGamble} disabled={!canSpin}>
                      {gambleReel.status === 'spinning' ? 'Spinning…' : 'Spin Replacement'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Pick (spin a pool, then assign players to stats) ----
  const g = ATTRIBUTE_GROUPS[group];
  const isLast = group === ATTRIBUTE_GROUPS.length - 1;
  const allStopped = reels.every(r => r.status === 'stopped');
  const readyReelCount = reels.filter(r => r.status === 'ready').length;
  const reelsSpinning = reels.some(r => r.status === 'spinning');
  const assignComplete = g.keys.every(k => assign[k]);
  const tutorialVisible = group === 0 && !hideTutorialForever && !tutorialClosed;

  const merged = { ...picks, ...assign };
  const partialValues: Partial<RawValues> = {};
  for (const a of ATTRIBUTES) {
    const id = merged[a.key];
    if (id) partialValues[a.key] = PLAYERS_BY_ID[id][a.key] as number;
  }
  const preview = computeBuild(partialValues);

  // which stat each player is currently assigned to, and the selected player
  const playerToStat: Record<string, AttributeKey> = {};
  for (const k of g.keys) { const id = assign[k]; if (id) playerToStat[id] = k; }
  const selectedPlayer = selectedPlayerId
    ? reels.find(r => r.player.id === selectedPlayerId)?.player
      ?? (benchPlayer?.id === selectedPlayerId ? benchPlayer : null)
    : null;
  const selectedReel = selectedPlayerId
    ? reels.find(reel => reel.status === 'stopped' && reel.player.id === selectedPlayerId) ?? null
    : null;
  const canBenchSelected = !!selectedReel && !benchPlayer && !benchUsed;
  const replacementWaiting = !!benchPlayer && reels.some(reel => reel.status === 'ready');
  const tutorialStep: TutorialStep = assignComplete && allStopped
    ? 'continue'
    : selectedPlayer
      ? 'assign'
      : reels.some(r => r.status === 'spinning')
        ? 'wait'
        : allStopped
          ? 'select'
          : 'spin';
  const tutorial = tutorialCopy[tutorialStep];

  return (
    <div className={`spin-screen${tutorialVisible ? ' tutorial-running' : ''}`}>
      <div className="spin-head">
        <div className="progress">
          <span>Round {group + 1} of {TOTAL_ROUNDS}</span>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${(group / TOTAL_ROUNDS) * 100}%` }} />
          </div>
        </div>
        <div className="spin-title">
          {g.blurb}
          <h2>{g.name}</h2>
        </div>
      </div>

      {tutorialVisible && (
        <div className="tutorial-panel" role="status" aria-live="polite">
          <div>
            <div className="tutorial-kicker">First round guide</div>
            <h3>{tutorial.title}</h3>
            <p>{tutorial.body}</p>
          </div>
          <div className="tutorial-actions">
            <button className="link" type="button" onClick={closeTutorial}>Close</button>
            <button className="link" type="button" onClick={neverShowTutorial}>Never show again</button>
          </div>
        </div>
      )}

      <div className="pick-layout">
        <BuildPanel preview={preview} justPicked={lastApplied} />
        <div className="pick-main">
          {/* Step 1: the three players (tap to spin, then tap to select) */}
          <div className="player-pool">
            {reels.map((r, ri) => {
              const ready = r.status === 'ready';
              const stopped = r.status === 'stopped';
              const isSelected = stopped && selectedPlayerId === r.player.id;
              const placedIn = playerToStat[r.player.id];
              return (
                <button
                  key={ri}
                  className={`pcard ${r.status}${ready || stopped ? ' clickable' : ''}${isSelected ? ' selected' : ''}${placedIn ? ' placed' : ''}${tutorialVisible && ((tutorialStep === 'select' && stopped) || isSelected) ? ' tutorial-target' : ''}`}
                  disabled={r.status === 'spinning'}
                  onClick={() => onPlayerClick(ri)}
                >
                  {ready
                    ? <div className="avatar placeholder"><span className="slot-icon">?</span></div>
                    : <PlayerAvatar player={r.player} />}
                  <div className="pcard-name">{stopped ? r.player.name : ready ? 'Tap to spin' : ' '}</div>
                  {placedIn && <div className="pcard-badge">→ {ATTR_BY_KEY[placedIn].label}</div>}
                </button>
              );
            })}
          </div>
          <div className="spin-all-row">
            <button
              className={`btn btn-small spin-all-btn${tutorialVisible && tutorialStep === 'spin' ? ' tutorial-target' : ''}`}
              type="button"
              onClick={spinAllReels}
              disabled={readyReelCount === 0 || reelsSpinning}
            >
              {reelsSpinning ? 'Spinning...' : readyReelCount === 0 ? 'All Spun' : 'Spin All'}
            </button>
          </div>

          <div className="bench-slot">
            <div>
              <span className="bench-slot-title">Bench Slot</span>
              <p>
                {benchPlayer
                  ? replacementWaiting
                    ? `${lastName(benchPlayer.name)} is saved. Re-spin the empty player card.`
                    : `${lastName(benchPlayer.name)} can be used now or saved for a later round.`
                  : benchUsed
                    ? 'Your bench substitution has been used.'
                    : 'Select any revealed player to save them, then re-spin their card.'}
              </p>
            </div>
            {benchPlayer ? (
              <button
                className={`bench-player-option${selectedPlayerId === benchPlayer.id ? ' selected' : ''}${playerToStat[benchPlayer.id] ? ' placed' : ''}`}
                onClick={() => setSelectedPlayerId(id => id === benchPlayer.id ? null : benchPlayer.id)}
              >
                <PlayerAvatar player={benchPlayer} />
                <span>
                  <b>{lastName(benchPlayer.name)}</b>
                  <small>
                    {playerToStat[benchPlayer.id]
                      ? `→ ${ATTR_BY_KEY[playerToStat[benchPlayer.id]].label}`
                      : 'Available'}
                  </small>
                </span>
              </button>
            ) : canBenchSelected && selectedPlayer ? (
              <button
                className="btn btn-small"
                onClick={storeSelectedOnBench}
              >
                Bench {lastName(selectedPlayer.name)}
              </button>
            ) : null}
          </div>

          {/* Step 2: the stats (tap one to drop the selected player into it) */}
          <div className="stat-slots">
            {g.keys.map(k => {
              const attr = ATTR_BY_KEY[k];
              const assignedId = assign[k];
              const assignedPlayer = assignedId ? PLAYERS_BY_ID[assignedId] : null;
              const assignedHeightPlayer = assign.height ? PLAYERS_BY_ID[assign.height] : null;
              const selectedRawValue = selectedPlayer ? selectedPlayer[k] as number : null;
              const filledRawValue = assignedPlayer ? assignedPlayer[k] as number : null;
              const targeting = !!selectedPlayer;
              const previewBase = selectedRawValue != null ? attributeScore(attr, selectedRawValue) : null;
              const previewSub = selectedRawValue != null
                ? computeBuild({ ...partialValues, [k]: selectedRawValue }).sub[k] ?? previewBase
                : null;
              const filledBase = preview.base[k] ?? null;
              const filledSub = preview.sub[k] ?? null;
              const previewRaw = selectedRawValue != null && attr.type === 'measure'
                ? formatValue(attr.format, selectedRawValue)
                : null;
              const filledRaw = filledRawValue != null && attr.type === 'measure'
                ? formatValue(attr.format, filledRawValue)
                : null;
              const previewMeasureNote = selectedPlayer && selectedRawValue != null && attr.type === 'measure'
                ? bodyMeasurementDescriptor(
                    k,
                    selectedRawValue,
                    assignedHeightPlayer?.height ?? selectedPlayer.height,
                  )
                : null;
              const filledMeasureNote = assignedPlayer && filledRawValue != null && attr.type === 'measure'
                ? bodyMeasurementDescriptor(
                    k,
                    filledRawValue,
                    assignedHeightPlayer?.height ?? assignedPlayer.height,
                  )
                : null;
              return (
                <button
                  key={k}
                  className={`slot${assignedPlayer ? ' filled' : ''}${targeting ? ' targeting' : ''}${tutorialVisible && tutorialStep === 'assign' ? ' tutorial-target' : ''}`}
                  disabled={!targeting}
                  onClick={() => onStatClick(k)}
                >
                  <div className="slot-label">{attr.label}</div>
                  {targeting ? (
                    attr.type === 'measure' ? (
                      <div className="slot-preview slot-measure">
                        <b>{previewRaw}</b>
                        <span className={`measurement-note${previewMeasureNote?.warning ? ' warning' : ''}`}>
                          {previewMeasureNote?.text}
                        </span>
                      </div>
                    ) : (
                      <div className="slot-preview">
                        <b style={{ color: scoreColor(previewSub!) }}>{previewSub}</b>
                        {previewBase !== previewSub && (
                          <span className="slot-base">{previewBase} base</span>
                        )}
                      </div>
                    )
                  ) : assignedPlayer ? (
                    attr.type === 'measure' ? (
                      <div className="slot-filled slot-measure">
                        <b>{filledRaw}</b>
                        <span>{lastName(assignedPlayer.name)}</span>
                        <span className={`measurement-note${filledMeasureNote?.warning ? ' warning' : ''}`}>
                          {filledMeasureNote?.text}
                        </span>
                      </div>
                    ) : (
                      <div className="slot-filled">
                        <b style={{ color: scoreColor(filledSub!) }}>{filledSub}</b>
                        <span>{lastName(assignedPlayer.name)}</span>
                        {filledBase !== filledSub && (
                          <span className="slot-base">{filledBase} base</span>
                        )}
                      </div>
                    )
                  ) : <div className="slot-empty">—</div>}
                </button>
              );
            })}
          </div>

          <p className="choose-hint">
            {assignComplete && allStopped
              ? 'All assigned! Review your player, then continue.'
              : replacementWaiting
                ? 'Tap the empty player card to spin a replacement.'
              : selectedPlayer
                ? canBenchSelected
                  ? `Place ${lastName(selectedPlayer.name)} in a stat, or move them to the bench.`
                  : `Now tap a stat for ${lastName(selectedPlayer.name)}.`
              : allStopped ? 'Tap a player, then tap the stat to put them in.'
              : 'Tap each player to spin them up.'}
          </p>

          <div className="spin-actions">
            <button className={`btn btn-primary${tutorialVisible && tutorialStep === 'continue' ? ' tutorial-target' : ''}`} onClick={next} disabled={!assignComplete || !allStopped}>
              {isLast ? 'Wild Card Round →' : 'Next Round →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
