export type AccessoryType = 'userIcon' | 'cardFrame' | 'cardBanner';

export interface Accessory {
  id: string;
  name: string;
  type: AccessoryType;
  src: string;
  bundleId: string;
}

export interface MarketBundle {
  id: string;
  name: string;
  theme: string;
  priceCents: number;
  description: string;
  previewSrc: string;
  accessoryIds: string[];
  drawingId: string;
}

export interface BuildAccessories {
  userIconId: string;
  cardFrameId: string;
  cardBannerId: string;
}

export const EMPTY_BUILD_ACCESSORIES: BuildAccessories = {
  userIconId: '',
  cardFrameId: '',
  cardBannerId: '',
};

const MARKET_ASSET_VERSION = 'v=12';
export const GOLDEN_STATE_BUNDLE_ID = 'golden-state';
export const FLAME_BUNDLE_ID = 'flame';
export const SHOE_BUNDLE_ID = 'shoe-bundle';
export const FLAME_BUNDLE_DRAWING_ID = 'flame-fuego-curry';
export const CHRISTMAS_BUNDLE_ID = 'christmas-bundle';
export const CHRISTMAS_BUNDLE_DRAWING_ID = 'christmas-red-jersey';
export const LOGIN_STREAK_BUNDLE_ID = 'login-streak-bundle';
export const SPRITE_BUNDLE_ID = 'sprite-bundle';
export const ONYX_FRAME_BUNDLE_ID = 'onyx-frame-bundle';
export const ONYX_FRAME_ID = 'onyx-frame';
export const HIGH_OVERALL_DRAWING_PRIZE_ID = 'high-overall-drawing-prize';

export const ACCESSORIES: Accessory[] = [
  {
    id: 'gs-icon-s',
    name: 'S Icon',
    type: 'userIcon',
    src: `/accessories/golden-state/icon-s.png?${MARKET_ASSET_VERSION}`,
    bundleId: 'golden-state',
  },
  {
    id: 'gs-icon-oakland',
    name: 'Oakland Icon',
    type: 'userIcon',
    src: `/accessories/golden-state/icon-oakland.png?${MARKET_ASSET_VERSION}`,
    bundleId: 'golden-state',
  },
  {
    id: 'gs-icon-ba',
    name: 'BA Icon',
    type: 'userIcon',
    src: `/accessories/golden-state/icon-ba.png?${MARKET_ASSET_VERSION}`,
    bundleId: 'golden-state',
  },
  {
    id: 'gs-frame-gold',
    name: 'Gold Frame',
    type: 'cardFrame',
    src: `/accessories/golden-state/card-frame.png?${MARKET_ASSET_VERSION}`,
    bundleId: 'golden-state',
  },
  {
    id: 'gs-frame-orange',
    name: 'Construction Frame',
    type: 'cardFrame',
    src: `/accessories/golden-state/card-frame-orange.png?${MARKET_ASSET_VERSION}`,
    bundleId: 'golden-state',
  },
  {
    id: 'gs-banner-hardwood',
    name: '415 Banner',
    type: 'cardBanner',
    src: `/accessories/golden-state/banner-hardwood.png?${MARKET_ASSET_VERSION}`,
    bundleId: 'golden-state',
  },
  {
    id: 'gs-banner-rainbow',
    name: 'Rainbow Banner',
    type: 'cardBanner',
    src: `/accessories/golden-state/banner-rainbow.png?${MARKET_ASSET_VERSION}`,
    bundleId: 'golden-state',
  },
  {
    id: 'flame-icon-ball',
    name: 'Flame Icon',
    type: 'userIcon',
    src: `/accessories/flame/icon-flame-ball.png?${MARKET_ASSET_VERSION}`,
    bundleId: FLAME_BUNDLE_ID,
  },
  {
    id: 'flame-frame-gradient',
    name: 'Flame Frame',
    type: 'cardFrame',
    src: `/accessories/flame/card-frame-gradient.svg?${MARKET_ASSET_VERSION}`,
    bundleId: FLAME_BUNDLE_ID,
  },
  {
    id: 'shoe-cream-high-top',
    name: 'Cream Converse Icon',
    type: 'userIcon',
    src: `/accessories/shoes/shoe-cream-high-top.png?${MARKET_ASSET_VERSION}`,
    bundleId: SHOE_BUNDLE_ID,
  },
  {
    id: 'shoe-blue-high-top',
    name: 'Curry 2 Icon',
    type: 'userIcon',
    src: `/accessories/shoes/shoe-blue-high-top.png?${MARKET_ASSET_VERSION}`,
    bundleId: SHOE_BUNDLE_ID,
  },
  {
    id: 'shoe-ice-high-top',
    name: 'Jordan 11 Icon',
    type: 'userIcon',
    src: `/accessories/shoes/shoe-ice-high-top.png?${MARKET_ASSET_VERSION}`,
    bundleId: SHOE_BUNDLE_ID,
  },
  {
    id: 'shoe-pink-low-top',
    name: 'Sabrina 3 Icon',
    type: 'userIcon',
    src: `/accessories/shoes/shoe-pink-low-top.png?${MARKET_ASSET_VERSION}`,
    bundleId: SHOE_BUNDLE_ID,
  },
  {
    id: 'christmas-banner-striped',
    name: 'Wrapping Paper Banner',
    type: 'cardBanner',
    src: `/accessories/christmas/banner-striped.png?${MARKET_ASSET_VERSION}`,
    bundleId: CHRISTMAS_BUNDLE_ID,
  },
  {
    id: 'login-streak-banner-lebron',
    name: 'LeBron Card Banner',
    type: 'cardBanner',
    src: `/accessories/christmas/banner-lebron.png?${MARKET_ASSET_VERSION}`,
    bundleId: LOGIN_STREAK_BUNDLE_ID,
  },
  {
    id: 'sprite-frame-gradient',
    name: 'Sprite Frame',
    type: 'cardFrame',
    src: `/accessories/sprite/card-frame-gradient.svg?${MARKET_ASSET_VERSION}`,
    bundleId: SPRITE_BUNDLE_ID,
  },
  {
    id: ONYX_FRAME_ID,
    name: 'Onyx Frame',
    type: 'cardFrame',
    src: `/accessories/onyx/card-frame.svg?${MARKET_ASSET_VERSION}`,
    bundleId: ONYX_FRAME_BUNDLE_ID,
  },
];

export const ACCESSORIES_BY_ID: Record<string, Accessory> = Object.fromEntries(
  ACCESSORIES.map(accessory => [accessory.id, accessory]),
);

export const MARKET_BUNDLES: MarketBundle[] = [
  {
    id: 'golden-state',
    name: 'Golden State Bundle',
    theme: 'Golden State',
    priceCents: 100,
    description: '3 username icons, 2 card frames, 2 banners, 1 player drawing',
    previewSrc: `/accessories/golden-state/market-hero.png?${MARKET_ASSET_VERSION}`,
    accessoryIds: ACCESSORIES.filter(accessory => accessory.bundleId === 'golden-state').map(accessory => accessory.id),
    drawingId: 'gs-sharpshooter',
  },
];

export const REWARD_BUNDLES: MarketBundle[] = [
  {
    id: FLAME_BUNDLE_ID,
    name: 'Flame Bundle',
    theme: 'Flame',
    priceCents: 0,
    description: 'Flame icon, Flame Frame, and Fuego Curry player drawing',
    previewSrc: `/accessories/flame/flame-bundle-preview.svg?${MARKET_ASSET_VERSION}`,
    accessoryIds: ACCESSORIES.filter(accessory => accessory.bundleId === FLAME_BUNDLE_ID).map(accessory => accessory.id),
    drawingId: FLAME_BUNDLE_DRAWING_ID,
  },
  {
    id: SHOE_BUNDLE_ID,
    name: 'Shoe Bundle',
    theme: 'Shoes',
    priceCents: 0,
    description: '4 shoe profile icons',
    previewSrc: `/accessories/shoes/shoe-bundle-preview.png?${MARKET_ASSET_VERSION}`,
    accessoryIds: ACCESSORIES.filter(accessory => accessory.bundleId === SHOE_BUNDLE_ID).map(accessory => accessory.id),
    drawingId: '',
  },
  {
    id: CHRISTMAS_BUNDLE_ID,
    name: 'Christmas Bundle',
    theme: 'Christmas',
    priceCents: 0,
    description: 'Red Jersey player drawing and Christmas card banner',
    previewSrc: `/archetype-players/${CHRISTMAS_BUNDLE_DRAWING_ID}.png?${MARKET_ASSET_VERSION}`,
    accessoryIds: ACCESSORIES.filter(accessory => accessory.bundleId === CHRISTMAS_BUNDLE_ID).map(accessory => accessory.id),
    drawingId: CHRISTMAS_BUNDLE_DRAWING_ID,
  },
  {
    id: LOGIN_STREAK_BUNDLE_ID,
    name: 'LeBron Banner',
    theme: 'LeBron',
    priceCents: 0,
    description: 'LeBron card banner',
    previewSrc: `/accessories/christmas/banner-lebron.png?${MARKET_ASSET_VERSION}`,
    accessoryIds: ACCESSORIES.filter(accessory => accessory.bundleId === LOGIN_STREAK_BUNDLE_ID).map(accessory => accessory.id),
    drawingId: '',
  },
  {
    id: SPRITE_BUNDLE_ID,
    name: 'Sprite Bundle',
    theme: 'Sprite',
    priceCents: 0,
    description: 'Sprite banner, Sprite soda can, Sprite player drawing, and Sprite Frame',
    previewSrc: `/accessories/sprite/sprite-soda-can.png?${MARKET_ASSET_VERSION}`,
    accessoryIds: ACCESSORIES.filter(accessory => accessory.bundleId === SPRITE_BUNDLE_ID).map(accessory => accessory.id),
    drawingId: '',
  },
  {
    id: ONYX_FRAME_BUNDLE_ID,
    name: 'Onyx Frame',
    theme: 'Onyx',
    priceCents: 0,
    description: 'Onyx card frame',
    previewSrc: `/accessories/onyx/card-frame.svg?${MARKET_ASSET_VERSION}`,
    accessoryIds: ACCESSORIES.filter(accessory => accessory.bundleId === ONYX_FRAME_BUNDLE_ID).map(accessory => accessory.id),
    drawingId: '',
  },
];

export const MARKET_BUNDLES_BY_ID: Record<string, MarketBundle> = Object.fromEntries(
  MARKET_BUNDLES.map(bundle => [bundle.id, bundle]),
);

export const ALL_BUNDLES: MarketBundle[] = [...MARKET_BUNDLES, ...REWARD_BUNDLES];

export const ALL_BUNDLES_BY_ID: Record<string, MarketBundle> = Object.fromEntries(
  ALL_BUNDLES.map(bundle => [bundle.id, bundle]),
);

export function accessoriesForBundle(bundleId: string): Accessory[] {
  return ACCESSORIES.filter(accessory => accessory.bundleId === bundleId);
}
