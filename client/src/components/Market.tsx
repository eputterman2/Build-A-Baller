import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ACCESSORIES_BY_ID,
  ALL_BUNDLES_BY_ID,
  ARCHETYPE_CHARACTER_RULES,
  CHRISTMAS_BUNDLE_DRAWING_ID,
  CHRISTMAS_BUNDLE_ID,
  FLAME_BUNDLE_DRAWING_ID,
  FLAME_BUNDLE_ID,
  GOLDEN_STATE_BUNDLE_ID,
  LOGIN_STREAK_BUNDLE_ID,
  MARKET_BUNDLES,
  ONYX_FRAME_BUNDLE_ID,
  ONYX_FRAME_ID,
  PLAYER_OF_DAY_PRIZE_CHARACTER_ID,
  REWARD_BUNDLES,
  SHOE_BUNDLE_ID,
  SPRITE_BUNDLE_ID,
  accessoriesForBundle,
  type Accessory,
  type DrawingCollectionStats,
  type MarketBundle,
} from '@shared/index';
import { api } from '../api';
import { useAuth } from '../auth';

const DAILY_LEGEND_SRC = '/archetype-players/player-of-day-prize.png';
const FLAME_DRAWING_SRC = '/archetype-players/flame-fuego-curry.png?v=2';
const FLAME_ICON_SRC = '/accessories/flame/icon-flame-ball.png?v=2';
const NBA2K_PRIZE_SRC = '/prizes/nba2k26-prize.png';
const DRAWN_INTO_GAME_PRIZE_SRC = '/prizes/drawn-into-game-prize.png';
const RANDOM_PLAYER_DRAWING_PRIZE_SRC = '/prizes/random-player-drawing.png';
const RANDOM_PLAYER_DRAWING_PREVIEW_SRC = '/prizes/random-player-drawing-preview.png';
const FLAME_FRAME_ID = 'flame-frame-gradient';
const SHOE_BUNDLE_FEATURED_ICON_ID = 'shoe-cream-high-top';
const SPRITE_GREEN_BANNER_SRC = '/accessories/sprite/sprite-green-banner.png';
const SPRITE_SODA_CAN_SRC = '/accessories/sprite/sprite-soda-can.png';
const SPRITE_PLAYER_SRC = '/accessories/sprite/sprite-player.png';
const SHOE_BUNDLE_PREVIEW_ORDER = [
  'shoe-cream-high-top',
  'shoe-ice-high-top',
  'shoe-blue-high-top',
  'shoe-pink-low-top',
];
const CHRISTMAS_BUNDLE_PREVIEW_ORDER = [CHRISTMAS_BUNDLE_DRAWING_ID, 'christmas-banner-striped'];
const PRIZE_COMPLETION_STORAGE_KEY = 'build-a-baller-seen-prize-completions';
const ONYX_FRAME_STYLE = {
  '--frame-fill': '#261d32',
  '--frame-line': '#ecc668',
  '--frame-pattern': 'radial-gradient(circle at 76% 18%, rgba(60,211,190,.26), transparent 28%), linear-gradient(145deg, #4b3d57 0%, #261d32 54%, #0d0913 100%)',
  borderColor: '#ecc668',
} as CSSProperties & Record<string, string>;
const RANDOM_DRAWING_PRIZE_EXCLUDED_IDS = new Set([
  PLAYER_OF_DAY_PRIZE_CHARACTER_ID,
  ...Object.values(ALL_BUNDLES_BY_ID).map(bundle => bundle.drawingId).filter(Boolean),
]);
const marketItemOrder = { userIcon: 0, cardBanner: 1, cardFrame: 2 };

type PrizeStatusTone = 'complete' | 'incomplete' | 'info';

type ImagePrizePreview = {
  title: string;
  kind: 'image';
  src: string;
  alt: string;
  statusLabel?: string;
  statusTone: PrizeStatusTone;
};

type FramePrizePreview = {
  title: string;
  kind: 'frame';
  frameId: string;
  statusLabel?: string;
  statusTone: PrizeStatusTone;
};

type BundlePreviewItem = {
  id: string;
  name: string;
  kind: 'image' | 'frame';
  src?: string;
  frameId?: string;
  alt: string;
};

type BundlePrizePreview = {
  title: string;
  kind: 'bundle';
  items: BundlePreviewItem[];
  statusLabel?: string;
  statusTone: PrizeStatusTone;
};

type PrizePreview = ImagePrizePreview | FramePrizePreview | BundlePrizePreview | null;

type PrizeCompletionNotice = {
  id: string;
  title: string;
  message: string;
};

type LowerTierPrizeId =
  | 'shoe-bundle'
  | 'build-97'
  | 'build-45'
  | 'login-3'
  | 'build-93'
  | 'collect-25';

type LowerTierPrize = {
  id: LowerTierPrizeId;
  title: string;
  requirement: string;
  reward: string;
  tone: 'blue' | 'green' | 'red' | 'gold' | 'purple' | 'ice';
  bundleId?: string;
};

type LowerTierPrizeSection = {
  title: string;
  prizes: LowerTierPrize[];
};

type DailyLoginRewardStatus = {
  currentStreak: number;
  requiredDays: number;
  checkedDays: boolean[];
  complete: boolean;
};

const DEFAULT_DAILY_LOGIN_REWARD: DailyLoginRewardStatus = {
  currentStreak: 0,
  requiredDays: 7,
  checkedDays: [false, false, false, false, false, false, false],
  complete: false,
};

const LOWER_TIER_PRIZE_SECTIONS: LowerTierPrizeSection[] = [
  {
    title: 'Tier 2',
    prizes: [
      {
        id: 'build-97',
        title: 'Onix Card Frame',
        requirement: 'Build a 97+ OVR card',
        reward: 'Onyx card frame',
        tone: 'red',
        bundleId: ONYX_FRAME_BUNDLE_ID,
      },
      {
        id: 'shoe-bundle',
        title: 'Shoe Bundle',
        requirement: 'Collect 40 player drawings',
        reward: '4 shoe profile icons',
        tone: 'green',
        bundleId: SHOE_BUNDLE_ID,
      },
      {
        id: 'build-45',
        title: 'Sprite Bundle',
        requirement: 'Build a 45 OVR or lower card',
        reward: 'All player drawing sprites',
        tone: 'blue',
        bundleId: SPRITE_BUNDLE_ID,
      },
    ],
  },
  {
    title: 'Tier 3',
    prizes: [
      {
        id: 'login-3',
        title: 'LeBron Banner',
        requirement: 'Log in 3 days in a row',
        reward: 'LeBron card banner',
        tone: 'gold',
        bundleId: LOGIN_STREAK_BUNDLE_ID,
      },
      {
        id: 'build-93',
        title: 'Random Player Drawing',
        requirement: 'Build a 93+ OVR card',
        reward: 'Random player drawing',
        tone: 'purple',
      },
      {
        id: 'collect-25',
        title: 'Christmas Bundle',
        requirement: 'Collect 20 player drawings',
        reward: 'Red jersey drawing + card banner',
        tone: 'ice',
        bundleId: CHRISTMAS_BUNDLE_ID,
      },
    ],
  },
];

function PrizeStatus({ label, tone }: { label: string; tone: PrizeStatusTone }) {
  return <span className={`prize-status is-${tone}`}>{label}</span>;
}

function LoginStreakBoxes({ reward, requiredDays = reward.requiredDays }: { reward: DailyLoginRewardStatus; requiredDays?: number }) {
  const checkedDays = reward.checkedDays.slice(0, requiredDays);
  return (
    <div
      className="prize-login-streak"
      aria-label={`${checkedDays.filter(Boolean).length} of ${requiredDays} daily logins complete`}
    >
      {Array.from({ length: requiredDays }, (_, index) => (
        <span
          aria-hidden="true"
          className={`prize-login-box${checkedDays[index] ? ' is-checked' : ''}`}
          key={index}
        />
      ))}
    </div>
  );
}

function BundleItemArt({ item }: { item: BundlePreviewItem }) {
  if (item.kind === 'frame') {
    return (
      <span className="frame-preview prize-frame-preview-small" aria-hidden="true">
        <span
          className={`frame-preview-card sports-card-front has-card-frame card-frame-${item.frameId}`}
          style={item.frameId === ONYX_FRAME_ID ? ONYX_FRAME_STYLE : undefined}
        />
      </span>
    );
  }
  return <img src={item.src} alt={item.alt} />;
}

function accessoryPreviewItem(accessory: Accessory): BundlePreviewItem {
  const name = ACCESSORIES_BY_ID[accessory.id]?.name ?? accessory.name;
  return {
    id: accessory.id,
    name,
    kind: accessory.type === 'cardFrame' ? 'frame' : 'image',
    src: accessory.src,
    frameId: accessory.id,
    alt: name,
  };
}

function seenCompletionStorageKey(userId: string) {
  return `${PRIZE_COMPLETION_STORAGE_KEY}:${userId}`;
}

function readSeenPrizeCompletions(userId: string): Set<string> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(seenCompletionStorageKey(userId)) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveSeenPrizeCompletion(userId: string, prizeId: string) {
  try {
    const seen = readSeenPrizeCompletions(userId);
    seen.add(prizeId);
    window.localStorage.setItem(seenCompletionStorageKey(userId), JSON.stringify([...seen]));
  } catch {
    // Browser storage is best-effort; the prize stays unlocked either way.
  }
}

export function Market() {
  const { user } = useAuth();
  const [marketBundles, setMarketBundles] = useState<MarketBundle[]>(MARKET_BUNDLES);
  const [rewardBundles, setRewardBundles] = useState<MarketBundle[]>(REWARD_BUNDLES);
  const [ownedBundleIds, setOwnedBundleIds] = useState<string[]>([]);
  const [dailyLoginReward, setDailyLoginReward] = useState<DailyLoginRewardStatus>(DEFAULT_DAILY_LOGIN_REWARD);
  const [dailyLegendComplete, setDailyLegendComplete] = useState(false);
  const [flameBundleComplete, setFlameBundleComplete] = useState(false);
  const [collectedDrawingCount, setCollectedDrawingCount] = useState(0);
  const [availableDrawingCount, setAvailableDrawingCount] = useState(ARCHETYPE_CHARACTER_RULES.length);
  const [rewardDrawingIds, setRewardDrawingIds] = useState<string[]>([]);
  const [repeatableRandomDrawingTestAccount, setRepeatableRandomDrawingTestAccount] = useState(false);
  const [bestBuildOverall, setBestBuildOverall] = useState<number | null>(null);
  const [worstBuildOverall, setWorstBuildOverall] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewPrize, setPreviewPrize] = useState<PrizePreview>(null);
  const [completionNotice, setCompletionNotice] = useState<PrizeCompletionNotice | null>(null);
  const [randomDrawingPrizeOpen, setRandomDrawingPrizeOpen] = useState(false);
  const [randomDrawingPrizeStatus, setRandomDrawingPrizeStatus] = useState<'ready' | 'spinning' | 'result' | 'error'>('ready');
  const [randomDrawingPrize, setRandomDrawingPrize] = useState<{ id: string; name: string; src: string } | null>(null);
  const [randomDrawingSpinPreview, setRandomDrawingSpinPreview] = useState<{ id: string; name: string; src: string } | null>(null);
  const [randomDrawingPrizeError, setRandomDrawingPrizeError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      api.marketBundles(),
      user ? api.drawingStats() : Promise.resolve({} as DrawingCollectionStats),
    ])
      .then(([market, stats]) => {
        if (!alive) return;
        setMarketBundles(market.bundles);
        setRewardBundles(market.rewardBundles ?? []);
        setOwnedBundleIds(market.ownedBundleIds);
        setDailyLoginReward(market.dailyLoginReward ?? DEFAULT_DAILY_LOGIN_REWARD);
        setAvailableDrawingCount(market.availableDrawingCount ?? ARCHETYPE_CHARACTER_RULES.length);
        setRewardDrawingIds(market.rewardDrawingIds ?? []);
        setRepeatableRandomDrawingTestAccount(Boolean(market.repeatableRandomDrawingTestAccount));
        setBestBuildOverall(market.prizeProgress?.bestOverall ?? null);
        setWorstBuildOverall(market.prizeProgress?.worstOverall ?? null);
        const hasDailyLegend = (stats[PLAYER_OF_DAY_PRIZE_CHARACTER_ID]?.playerOfDayWins ?? 0) > 0;
        const collectedDrawingIds = new Set(
          Object.entries(stats)
            .filter(([, stat]) => (stat?.cards ?? 0) > 0 || (stat?.playerOfDayWins ?? 0) > 0)
            .map(([drawingId]) => drawingId),
        );
        for (const bundleId of market.ownedBundleIds) {
          const drawingId = ALL_BUNDLES_BY_ID[bundleId]?.drawingId;
          if (drawingId) collectedDrawingIds.add(drawingId);
        }
        if (hasDailyLegend) collectedDrawingIds.add(PLAYER_OF_DAY_PRIZE_CHARACTER_ID);
        for (const drawingId of market.rewardDrawingIds ?? []) collectedDrawingIds.add(drawingId);
        setDailyLegendComplete(hasDailyLegend);
        setCollectedDrawingCount(collectedDrawingIds.size);
        setFlameBundleComplete(
          market.ownedBundleIds.includes(FLAME_BUNDLE_ID)
            || (stats[FLAME_BUNDLE_DRAWING_ID]?.cards ?? 0) > 0,
        );
      })
      .catch(err => {
        if (!alive) return;
        console.warn('Could not load live prize status:', err);
        setMarketBundles(MARKET_BUNDLES);
        setRewardBundles(REWARD_BUNDLES);
        setOwnedBundleIds([]);
        setDailyLoginReward(DEFAULT_DAILY_LOGIN_REWARD);
        setDailyLegendComplete(false);
        setFlameBundleComplete(false);
        setCollectedDrawingCount(0);
        setAvailableDrawingCount(ARCHETYPE_CHARACTER_RULES.length);
        setRewardDrawingIds([]);
        setRepeatableRandomDrawingTestAccount(false);
        setBestBuildOverall(null);
        setWorstBuildOverall(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    let alive = true;
    const refreshAvailableDrawingCount = () => {
      api.marketBundles()
        .then(data => {
          if (alive) setAvailableDrawingCount(data.availableDrawingCount ?? ARCHETYPE_CHARACTER_RULES.length);
        })
        .catch(() => {
          // Keep the last known total if a background refresh is unavailable.
        });
    };
    const timer = window.setInterval(refreshAvailableDrawingCount, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const bayBundle = useMemo(
    () => marketBundles.find(bundle => bundle.id === GOLDEN_STATE_BUNDLE_ID),
    [marketBundles],
  );

  const flameBundle = useMemo(
    () => rewardBundles.find(bundle => bundle.id === FLAME_BUNDLE_ID),
    [rewardBundles],
  );

  const bayBundleItems = useMemo<BundlePreviewItem[]>(() => {
    if (!bayBundle) return [];
    const accessories = accessoriesForBundle(bayBundle.id)
      .slice()
      .sort((a, b) => marketItemOrder[a.type] - marketItemOrder[b.type])
      .map(accessoryPreviewItem);
    const drawing = ARCHETYPE_CHARACTER_RULES.find(rule => rule.id === bayBundle.drawingId);
    if (drawing) {
      accessories.push({
        id: drawing.id,
        name: `${drawing.name} Drawing`,
        kind: 'image',
        src: drawing.src,
        alt: `${drawing.name} drawing`,
      });
    }
    return accessories;
  }, [bayBundle]);

  const flameBundleItems = useMemo<BundlePreviewItem[]>(() => {
    const items: BundlePreviewItem[] = [
      {
        id: 'flame-icon-ball',
        name: 'Flame Icon',
        kind: 'image',
        src: FLAME_ICON_SRC,
        alt: 'Flame basketball user icon',
      },
      {
        id: FLAME_FRAME_ID,
        name: 'Flame Frame',
        kind: 'frame',
        frameId: FLAME_FRAME_ID,
        alt: 'Flame card frame',
      },
      {
        id: FLAME_BUNDLE_DRAWING_ID,
        name: 'Fuego Curry',
        kind: 'image',
        src: FLAME_DRAWING_SRC,
        alt: 'Fuego Curry player drawing',
      },
    ];
    if (!flameBundle) return items;
    return items.filter(item => item.id !== FLAME_FRAME_ID || flameBundle.accessoryIds.includes(FLAME_FRAME_ID));
  }, [flameBundle]);

  const shoeBundleItems = useMemo<BundlePreviewItem[]>(
    () => accessoriesForBundle(SHOE_BUNDLE_ID)
      .map(accessoryPreviewItem)
      .sort((a, b) => SHOE_BUNDLE_PREVIEW_ORDER.indexOf(a.id) - SHOE_BUNDLE_PREVIEW_ORDER.indexOf(b.id)),
    [],
  );
  const shoeBundleFeaturedItem = shoeBundleItems.find(item => item.id === SHOE_BUNDLE_FEATURED_ICON_ID);
  const spriteBundleItems = useMemo<BundlePreviewItem[]>(
    () => [
      {
        id: 'sprite-soda-can',
        name: 'Soda Can Icon',
        kind: 'image',
        src: SPRITE_SODA_CAN_SRC,
        alt: 'Soda can icon',
      },
      {
        id: 'sprite-green-banner',
        name: 'Sprite Banner',
        kind: 'image',
        src: SPRITE_GREEN_BANNER_SRC,
        alt: 'Sprite banner',
      },
      {
        id: 'sprite-frame-gradient',
        name: 'Sprite Frame',
        kind: 'frame',
        frameId: 'sprite-frame-gradient',
        alt: 'Sprite card frame',
      },
      {
        id: 'sprite-player',
        name: 'Green Lavine',
        kind: 'image',
        src: SPRITE_PLAYER_SRC,
        alt: 'Green Lavine player drawing',
      },
    ],
    [],
  );
  const spriteBundleFeaturedItem = spriteBundleItems[0];
  const christmasBundleItems = useMemo<BundlePreviewItem[]>(
    () => [
      {
        id: CHRISTMAS_BUNDLE_DRAWING_ID,
        name: 'Jolly Kyrie',
        kind: 'image',
        src: `/archetype-players/${CHRISTMAS_BUNDLE_DRAWING_ID}.png?v=1`,
        alt: 'Jolly Kyrie player drawing',
      },
      ...accessoriesForBundle(CHRISTMAS_BUNDLE_ID)
        .map(accessoryPreviewItem)
        .sort((a, b) => CHRISTMAS_BUNDLE_PREVIEW_ORDER.indexOf(a.id) - CHRISTMAS_BUNDLE_PREVIEW_ORDER.indexOf(b.id)),
    ],
    [],
  );
  const christmasBundleFeaturedItem = christmasBundleItems.find(item => item.id === CHRISTMAS_BUNDLE_DRAWING_ID);
  const loginStreakBannerItem = accessoriesForBundle(LOGIN_STREAK_BUNDLE_ID).map(accessoryPreviewItem)[0] ?? null;

  const bayOwned = bayBundle ? ownedBundleIds.includes(bayBundle.id) : false;
  const bayComplete = bayOwned || dailyLoginReward.complete;
  const bayStatusLabel = bayComplete ? 'Completed' : 'Incomplete';
  const bayStatusTone: PrizeStatusTone = bayComplete ? 'complete' : 'incomplete';
  const dailyStatusLabel = dailyLegendComplete ? 'Completed' : 'Incomplete';
  const dailyStatusTone: PrizeStatusTone = dailyLegendComplete ? 'complete' : 'incomplete';
  const flameStatusLabel = flameBundleComplete ? 'Completed' : 'Incomplete';
  const flameStatusTone: PrizeStatusTone = flameBundleComplete ? 'complete' : 'incomplete';
  const drawnIntoGameComplete = availableDrawingCount > 0 && collectedDrawingCount >= availableDrawingCount;
  const drawnIntoGameStatusLabel = drawnIntoGameComplete ? 'Completed' : 'Incomplete';
  const drawnIntoGameStatusTone: PrizeStatusTone = drawnIntoGameComplete ? 'complete' : 'incomplete';
  const shoeBundleComplete = ownedBundleIds.includes(SHOE_BUNDLE_ID) || collectedDrawingCount >= 50;
  const lowerPrizeComplete = (id: LowerTierPrizeId) => {
    switch (id) {
      case 'shoe-bundle':
        return shoeBundleComplete;
      case 'build-97':
        return ownedBundleIds.includes(ONYX_FRAME_BUNDLE_ID) || (bestBuildOverall != null && bestBuildOverall >= 97);
      case 'build-45':
        return worstBuildOverall != null && worstBuildOverall <= 45;
      case 'login-3':
        return dailyLoginReward.complete || dailyLoginReward.currentStreak >= 3;
      case 'build-93':
        return bestBuildOverall != null && bestBuildOverall >= 93;
      case 'collect-25':
        return collectedDrawingCount >= 25;
      default:
        return false;
    }
  };
  const lowerPrizeStatus = (id: LowerTierPrizeId): { label: string; tone: PrizeStatusTone } => {
    const complete = lowerPrizeComplete(id);
    return {
      label: complete ? 'Completed' : 'Incomplete',
      tone: complete ? 'complete' : 'incomplete',
    };
  };
  const nba2kPrizePreview: ImagePrizePreview = {
    title: 'NBA 2K27',
    kind: 'image',
    src: NBA2K_PRIZE_SRC,
    alt: 'NBA 2K27 prize drawing',
    statusTone: 'info',
  };
  const bayPrizePreview: BundlePrizePreview | null = bayBundle
    ? {
        title: 'Bay Bundle',
        kind: 'bundle',
        items: bayBundleItems,
        statusLabel: bayStatusLabel,
        statusTone: bayStatusTone,
      }
    : null;
  const flamePrizePreview: BundlePrizePreview = {
    title: 'Flame Bundle',
    kind: 'bundle',
    items: flameBundleItems,
    statusLabel: flameStatusLabel,
    statusTone: flameStatusTone,
  };
  const shoePrizePreview: BundlePrizePreview = {
    title: 'Shoe Bundle',
    kind: 'bundle',
    items: shoeBundleItems,
    statusLabel: shoeBundleComplete ? 'Completed' : 'Incomplete',
    statusTone: shoeBundleComplete ? 'complete' : 'incomplete',
  };
  const christmasPrizePreview: BundlePrizePreview = {
    title: 'Christmas Bundle',
    kind: 'bundle',
    items: christmasBundleItems,
    statusLabel: lowerPrizeComplete('collect-25') ? 'Completed' : 'Incomplete',
    statusTone: lowerPrizeComplete('collect-25') ? 'complete' : 'incomplete',
  };
  const onyxFramePrizePreview: FramePrizePreview = {
    title: 'Onix Card Frame',
    kind: 'frame',
    frameId: ONYX_FRAME_ID,
    statusLabel: lowerPrizeStatus('build-97').label,
    statusTone: lowerPrizeStatus('build-97').tone,
  };
  const loginStreakPrizePreview: ImagePrizePreview = {
    title: 'LeBron Card Banner',
    kind: 'image',
    src: loginStreakBannerItem?.src ?? '',
    alt: 'LeBron card banner',
    statusLabel: lowerPrizeStatus('login-3').label,
    statusTone: lowerPrizeStatus('login-3').tone,
  };
  const durantPrizePreview: ImagePrizePreview = {
    title: 'Robo Durant',
    kind: 'image',
    src: DAILY_LEGEND_SRC,
    alt: 'Robo Durant player drawing prize',
    statusLabel: dailyStatusLabel,
    statusTone: dailyStatusTone,
  };
  const drawnIntoGamePrizePreview: ImagePrizePreview = {
    title: 'Get Drawn Into the Game',
    kind: 'image',
    src: DRAWN_INTO_GAME_PRIZE_SRC,
    alt: 'Drawn into the game prize',
    statusLabel: drawnIntoGameStatusLabel,
    statusTone: drawnIntoGameStatusTone,
  };
  const randomDrawingPrizePreview: ImagePrizePreview = {
    title: 'Random Player Drawing',
    kind: 'image',
    src: RANDOM_PLAYER_DRAWING_PREVIEW_SRC,
    alt: 'Random player drawing prize preview',
    statusLabel: lowerPrizeStatus('build-93').label,
    statusTone: lowerPrizeStatus('build-93').tone,
  };

  const openPrizeWithKeyboard = (event: KeyboardEvent<HTMLElement>, prize: NonNullable<PrizePreview>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setPreviewPrize(prize);
  };

  const completedPrizeNotices = useMemo(
    () => [
      {
        id: 'bay-bundle',
        complete: bayComplete,
        title: 'Congratulations!',
        message: 'You received the Bay Bundle.',
      },
      {
        id: 'flame-bundle',
        complete: flameBundleComplete,
        title: 'Congratulations!',
        message: 'You received the Flame Bundle.',
      },
      {
        id: 'daily-legend',
        complete: dailyLegendComplete,
        title: 'Congratulations!',
        message: 'You received the Durant Player Drawing.',
      },
      {
        id: 'drawn-into-game',
        complete: drawnIntoGameComplete,
        title: 'Congratulations!',
        message: 'You received the Get Drawn In prize. You will be contacted via email with next steps.',
      },
      {
        id: 'tier-2-build-97',
        complete: lowerPrizeComplete('build-97'),
        title: 'Congratulations!',
        message: 'You received the Onix Card Frame.',
      },
      {
        id: 'tier-2-shoe-bundle',
        complete: lowerPrizeComplete('shoe-bundle'),
        title: 'Congratulations!',
        message: 'You received the Shoe Bundle.',
      },
      {
        id: 'tier-2-sprite-bundle',
        complete: lowerPrizeComplete('build-45'),
        title: 'Congratulations!',
        message: 'You received the Sprite Bundle.',
      },
      {
        id: 'tier-3-login-3',
        complete: lowerPrizeComplete('login-3'),
        title: 'Congratulations!',
        message: 'You received the LeBron Card Banner.',
      },
      {
        id: 'tier-3-build-93',
        complete: lowerPrizeComplete('build-93'),
        title: 'Congratulations!',
        message: 'You unlocked a random player drawing. Spin to claim it.',
      },
      {
        id: 'tier-3-collect-25',
        complete: lowerPrizeComplete('collect-25'),
        title: 'Congratulations!',
        message: 'You received the Christmas Bundle.',
      },
    ],
    [
      bayComplete,
      bestBuildOverall,
      collectedDrawingCount,
      dailyLegendComplete,
      dailyLoginReward.complete,
      dailyLoginReward.currentStreak,
      drawnIntoGameComplete,
      flameBundleComplete,
      ownedBundleIds,
      shoeBundleComplete,
      rewardDrawingIds,
    ],
  );

  useEffect(() => {
    if (loading || error || !user || completionNotice) return;
    const seen = readSeenPrizeCompletions(user.id);
    const nextPrize = completedPrizeNotices.find(prize => prize.complete && !seen.has(prize.id));
    if (!nextPrize) return;
    setCompletionNotice({
      id: nextPrize.id,
      title: nextPrize.title,
      message: nextPrize.message,
    });
  }, [completedPrizeNotices, completionNotice, error, loading, user]);

  const dismissCompletionNotice = () => {
    if (completionNotice && user) {
      saveSeenPrizeCompletion(user.id, completionNotice.id);
    }
    setCompletionNotice(null);
  };

  const repeatableRandomDrawingTestAccountActive = repeatableRandomDrawingTestAccount || user?.username === 'jiww';
  const highOverallDrawingClaimed = rewardDrawingIds.length > 0 && !repeatableRandomDrawingTestAccountActive;
  const openRandomDrawingPrize = () => {
    if (!user || !lowerPrizeComplete('build-93') || highOverallDrawingClaimed) return;
    setRandomDrawingPrize(null);
    setRandomDrawingSpinPreview(null);
    setRandomDrawingPrizeError(null);
    setRandomDrawingPrizeStatus('ready');
    setRandomDrawingPrizeOpen(true);
  };

  const spinRandomDrawingPrize = async () => {
    if (randomDrawingPrizeStatus !== 'ready') return;
    setRandomDrawingPrizeStatus('spinning');
    setRandomDrawingPrizeError(null);
    const spinOptions = ARCHETYPE_CHARACTER_RULES
      .filter(rule => !RANDOM_DRAWING_PRIZE_EXCLUDED_IDS.has(rule.id))
      .map(({ id, name, src }) => ({ id, name, src }));
    const spinAnimation = async () => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < 1100) {
        const option = spinOptions[Math.floor(Math.random() * spinOptions.length)];
        if (option) setRandomDrawingSpinPreview(option);
        await new Promise(resolve => window.setTimeout(resolve, 85));
      }
    };
    try {
      const [result] = await Promise.all([
        api.claimHighOverallDrawing(),
        spinAnimation(),
      ]);
      setRandomDrawingPrize(result.drawing);
      setRandomDrawingSpinPreview(result.drawing);
      setRewardDrawingIds(current => {
        if (current.includes(result.drawing.id)) return current;
        setCollectedDrawingCount(count => count + 1);
        return [...current, result.drawing.id];
      });
      setRandomDrawingPrizeStatus('result');
    } catch (err) {
      setRandomDrawingPrizeError((err as Error).message);
      setRandomDrawingPrizeStatus('error');
    }
  };

  if (loading) return <div className="notice">Loading prizes...</div>;
  if (error) return <div className="notice error">Could not load prizes: {error}</div>;

  return (
    <section className="prizes-page">
      <h2 className="results-title prizes-main-title">Prizes</h2>

      <div className="prizes-page-grid" aria-label="Build-A-Baller prizes">
        <h3 className="prize-tier-title">Tier 1</h3>
        <article
          aria-label="Preview NBA 2K27 prize"
          className="prize-summary-card prize-featured prize-grand-card"
          onClick={() => setPreviewPrize(nba2kPrizePreview)}
          onKeyDown={event => openPrizeWithKeyboard(event, nba2kPrizePreview)}
          role="button"
          tabIndex={0}
        >
          <div className="prize-card-top">
            <div className="prize-title-stack prize-rules-title-stack">
              <h3>NBA 2K27</h3>
              <p>Custom Drawing Contest</p>
              <Link
                className="btn btn-primary prize-link prize-featured-link"
                onClick={event => event.stopPropagation()}
                onKeyDown={event => event.stopPropagation()}
                to="/prizes/2k-contest"
              >
                Enter
              </Link>
            </div>
            <div className="prize-media-stack">
              <span className="prize-art prize-2k-art prize-grand-art">
                <img src={NBA2K_PRIZE_SRC} alt="NBA 2K27 prize drawing" />
              </span>
            </div>
          </div>
        </article>

        {bayBundle && (
          <article
            aria-label="Preview Bay Bundle"
            className="prize-summary-card prize-bay-card"
            onClick={() => bayPrizePreview && setPreviewPrize(bayPrizePreview)}
            onKeyDown={event => bayPrizePreview && openPrizeWithKeyboard(event, bayPrizePreview)}
            role="button"
            tabIndex={0}
          >
            <div className="prize-card-top">
              <div className="prize-title-stack">
                <h3>Bay Bundle</h3>
                <p>Log in 7 days in a row</p>
                <PrizeStatus label={bayStatusLabel} tone={bayStatusTone} />
                <LoginStreakBoxes reward={dailyLoginReward} />
              </div>
              <div className="prize-media-stack">
                <span className="prize-art prize-bay-bundle-art">
                  <img src={bayBundle.previewSrc} alt="Bay Bundle preview" />
                </span>
              </div>
            </div>
          </article>
        )}

        <article
          aria-label="Preview Flame Bundle"
          className="prize-summary-card prize-flame-card"
          onClick={() => setPreviewPrize(flamePrizePreview)}
          onKeyDown={event => openPrizeWithKeyboard(event, flamePrizePreview)}
          role="button"
          tabIndex={0}
        >
          <div className="prize-card-top">
            <div className="prize-title-stack">
              <h3>Flame Bundle</h3>
              <p>Reach #1 in any leaderboard tier</p>
              <PrizeStatus label={flameStatusLabel} tone={flameStatusTone} />
            </div>
            <div className="prize-media-stack">
              <span className="prize-art prize-flame-bundle-art">
                <img src={FLAME_ICON_SRC} alt="Flame basketball user icon" />
              </span>
            </div>
          </div>
        </article>

        <article
          aria-label="Preview Durant player drawing prize"
          className="prize-summary-card prize-daily-card"
          onClick={() => setPreviewPrize(durantPrizePreview)}
          onKeyDown={event => openPrizeWithKeyboard(event, durantPrizePreview)}
          role="button"
          tabIndex={0}
        >
          <div className="prize-card-top">
            <div className="prize-title-stack">
              <h3>Durant Player Drawing</h3>
              <p>Win Player of the Day</p>
              <PrizeStatus label={dailyStatusLabel} tone={dailyStatusTone} />
            </div>
            <div className="prize-media-stack">
              <span className="prize-art prize-daily-art">
                <img src={DAILY_LEGEND_SRC} alt="Durant player drawing prize" />
              </span>
            </div>
          </div>
        </article>

        <article
          aria-label="Preview get drawn into the game prize"
          className="prize-summary-card prize-coming-card"
          onClick={() => setPreviewPrize(drawnIntoGamePrizePreview)}
          onKeyDown={event => openPrizeWithKeyboard(event, drawnIntoGamePrizePreview)}
          role="button"
          tabIndex={0}
        >
          <div className="prize-card-top">
            <div className="prize-title-stack">
              <h3>Get Drawn In</h3>
              <p>Collect all available player drawings</p>
              <PrizeStatus label={drawnIntoGameStatusLabel} tone={drawnIntoGameStatusTone} />
              <small className="prize-drawing-progress">
                {collectedDrawingCount}/{availableDrawingCount}
              </small>
            </div>
            <div className="prize-media-stack">
              <span className="prize-art prize-drawn-in-art">
                <img src={DRAWN_INTO_GAME_PRIZE_SRC} alt="Drawn into the game prize" />
              </span>
            </div>
          </div>
        </article>
      </div>

      <div className="lower-prize-sections" aria-label="Lower tier prizes">
        {LOWER_TIER_PRIZE_SECTIONS.map(section => (
          <section className="lower-prize-section" key={section.title}>
            <h3>{section.title}</h3>
            <div className="lower-prize-grid">
              {section.prizes.map(prize => {
                const status = lowerPrizeStatus(prize.id);
                const prizePreview = prize.bundleId === LOGIN_STREAK_BUNDLE_ID
                  ? loginStreakPrizePreview
                  : prize.bundleId === ONYX_FRAME_BUNDLE_ID
                  ? onyxFramePrizePreview
                  : prize.bundleId === SHOE_BUNDLE_ID
                  ? shoePrizePreview
                  : prize.bundleId === SPRITE_BUNDLE_ID
                  ? {
                      title: 'Sprite Bundle',
                      kind: 'bundle' as const,
                      items: spriteBundleItems,
                      statusLabel: status.label,
                      statusTone: status.tone,
                    }
                  : prize.bundleId === CHRISTMAS_BUNDLE_ID
                    ? christmasPrizePreview
                    : prize.id === 'build-93'
                      ? randomDrawingPrizePreview
                    : null;
                const featuredItem = prize.id === 'build-93'
                  ? { src: RANDOM_PLAYER_DRAWING_PRIZE_SRC }
                  : prize.bundleId === LOGIN_STREAK_BUNDLE_ID
                  ? loginStreakBannerItem
                  : prize.bundleId === SPRITE_BUNDLE_ID
                  ? spriteBundleFeaturedItem
                  : prize.bundleId === CHRISTMAS_BUNDLE_ID
                  ? christmasBundleFeaturedItem
                  : shoeBundleFeaturedItem;
                const featuredFrameId = prize.bundleId === ONYX_FRAME_BUNDLE_ID ? ONYX_FRAME_ID : null;
                const randomDrawingPrizeReady = prize.id === 'build-93'
                  && !!user
                  && status.label === 'Completed'
                  && !highOverallDrawingClaimed;
                const prizeClickHandler = prizePreview
                    ? () => setPreviewPrize(prizePreview)
                    : undefined;
                const prizeKeyboardHandler = prizePreview
                    ? (event: KeyboardEvent<HTMLElement>) => openPrizeWithKeyboard(event, prizePreview)
                    : undefined;
                return (
                  <article
                    aria-label={prizePreview ? `Preview ${prize.title}` : undefined}
                    className={`prize-summary-card lower-prize-card is-${prize.tone}${prize.id === 'build-93' ? ' is-random-drawing-card' : ''}${prizePreview || randomDrawingPrizeReady ? ' has-preview' : ''}`}
                    key={prize.title}
                    onClick={prizeClickHandler}
                    onKeyDown={prizeKeyboardHandler}
                    role={prizePreview ? 'button' : undefined}
                    tabIndex={prizePreview ? 0 : undefined}
                  >
                    {prizePreview ? (
                      <div className="prize-card-top lower-prize-card-top">
                        <div className="prize-title-stack">
                          <h3>{prize.title}</h3>
                          <p>{prize.requirement}</p>
                          {prize.id === 'login-3' ? (
                            <div className="prize-inline-status">
                              <LoginStreakBoxes reward={dailyLoginReward} requiredDays={3} />
                              <PrizeStatus label={status.label} tone={status.tone} />
                            </div>
                          ) : (
                            <>
                              <PrizeStatus label={status.label} tone={status.tone} />
                              {prize.id === 'build-93' && randomDrawingPrizeReady && (
                                <button
                                  className="prize-spin-link"
                                  onClick={event => {
                                    event.stopPropagation();
                                    openRandomDrawingPrize();
                                  }}
                                  type="button"
                                >
                                  spin
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        <div className="prize-media-stack">
                          <span className={`prize-art lower-prize-shoe-bundle-art${prize.bundleId === SHOE_BUNDLE_ID ? ' is-shoe-bundle' : ''}${prize.bundleId === SPRITE_BUNDLE_ID ? ' is-sprite-bundle' : ''}${prize.bundleId === CHRISTMAS_BUNDLE_ID ? ' is-christmas-bundle' : ''}${prize.bundleId === LOGIN_STREAK_BUNDLE_ID ? ' is-login-streak-banner' : ''}${prize.id === 'build-93' ? ' is-random-drawing' : ''}${featuredFrameId ? ' is-onyx-frame' : ''}`}>
                            {featuredFrameId ? (
                              <span className="frame-preview lower-prize-frame-preview" aria-hidden="true">
                                <span
                                  className={`frame-preview-card sports-card-front has-card-frame card-frame-${featuredFrameId}`}
                                  style={featuredFrameId === ONYX_FRAME_ID ? ONYX_FRAME_STYLE : undefined}
                                />
                              </span>
                            ) : featuredItem ? <img alt="" src={featuredItem.src} /> : null}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="prize-title-stack">
                        <h3>{prize.title}</h3>
                        <p>{prize.requirement}</p>
                        <PrizeStatus label={status.label} tone={status.tone} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {previewPrize && (
        <div className="modal-backdrop" onClick={() => setPreviewPrize(null)} role="presentation">
          <div
            className={`modal prize-preview-modal${previewPrize.kind === 'bundle' ? ' prize-preview-modal-bundle' : ''}${previewPrize.kind === 'bundle' && previewPrize.items.length <= 3 ? ' is-compact-bundle-modal' : ''}${previewPrize.title === 'LeBron Card Banner' ? ' lebron-banner-preview-modal' : ''}${previewPrize.title === 'Sprite Bundle' ? ' sprite-bundle-preview-modal' : ''}`}
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="prize-preview-title"
          >
            <h2 id="prize-preview-title">{previewPrize.title}</h2>
            <div className="prize-preview-art">
              {previewPrize.kind === 'bundle' ? (
                <div
                  className={`prize-bundle-preview-grid${previewPrize.items.length <= 3 ? ' is-compact-bundle' : ''}${previewPrize.items.length === 2 ? ' is-two-item-bundle' : ''}`}
                  aria-label={`${previewPrize.title} prizes`}
                >
                  {previewPrize.items.map(item => (
                    <div
                      className="prize-bundle-preview-item"
                      key={item.id}
                    >
                      <BundleItemArt item={item} />
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              ) : previewPrize.kind === 'frame' ? (
                <span className="frame-preview prize-frame-preview-large" aria-hidden="true">
                  <span
                    className={`frame-preview-card sports-card-front has-card-frame card-frame-${previewPrize.frameId}`}
                    style={previewPrize.frameId === ONYX_FRAME_ID ? ONYX_FRAME_STYLE : undefined}
                  />
                </span>
              ) : (
                <img
                  className={previewPrize.title === 'LeBron Card Banner' ? 'lebron-banner-preview-image' : undefined}
                  src={previewPrize.src}
                  alt={previewPrize.alt}
                />
              )}
            </div>
            {previewPrize.statusLabel && <PrizeStatus label={previewPrize.statusLabel} tone={previewPrize.statusTone} />}
          </div>
        </div>
      )}

      {completionNotice && (
        <div className="modal-backdrop" onClick={dismissCompletionNotice} role="presentation">
          <div
            className="modal prize-completion-modal"
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="prize-completion-title"
          >
            <h2 id="prize-completion-title">{completionNotice.title}</h2>
            <p>{completionNotice.message}</p>
            <button className="btn btn-primary" onClick={dismissCompletionNotice} type="button">
              Nice
            </button>
          </div>
        </div>
      )}
      {randomDrawingPrizeOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (randomDrawingPrizeStatus !== 'spinning') setRandomDrawingPrizeOpen(false);
          }}
          role="presentation"
        >
          <div
            className="modal prize-preview-modal random-drawing-prize-modal"
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="random-drawing-prize-title"
          >
            <h2 id="random-drawing-prize-title">Random Player Drawing</h2>
            <div className="prize-preview-art random-drawing-prize-art">
              {randomDrawingPrizeStatus === 'result' && randomDrawingPrize ? (
                <img src={randomDrawingPrize.src} alt={randomDrawingPrize.name} />
              ) : (
                <div
                  aria-hidden="true"
                  className={`random-drawing-prize-spinner${randomDrawingPrizeStatus === 'spinning' ? ' spinning' : ''}${randomDrawingSpinPreview ? ' has-preview' : ' is-idle'}`}
                >
                  <span className="avatar placeholder">
                    {randomDrawingSpinPreview ? (
                      <img src={randomDrawingSpinPreview.src} alt="" />
                    ) : (
                      <span className="slot-icon">?</span>
                    )}
                  </span>
                </div>
              )}
            </div>
            <div className="random-drawing-prize-actions">
              {randomDrawingPrizeStatus === 'result' && randomDrawingPrize ? (
                <strong className="random-drawing-prize-name">{randomDrawingPrize.name}</strong>
              ) : (
                <>
                  <button
                    aria-label={randomDrawingPrizeStatus === 'error' ? 'Try spinning again' : 'Spin for a random player drawing'}
                    className={`random-drawing-prize-trigger${randomDrawingPrizeStatus === 'spinning' ? ' is-spinning' : ''}`}
                    disabled={randomDrawingPrizeStatus === 'spinning'}
                    onClick={spinRandomDrawingPrize}
                    type="button"
                  >
                    {randomDrawingPrizeStatus === 'spinning' ? 'spinning...' : randomDrawingPrizeStatus === 'error' ? 'Try again' : 'Tap to spin'}
                  </button>
                  {randomDrawingPrizeError && <p className="form-error">{randomDrawingPrizeError}</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
