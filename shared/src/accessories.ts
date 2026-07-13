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

const MARKET_ASSET_VERSION = 'v=11';

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

export const MARKET_BUNDLES_BY_ID: Record<string, MarketBundle> = Object.fromEntries(
  MARKET_BUNDLES.map(bundle => [bundle.id, bundle]),
);

export function accessoriesForBundle(bundleId: string): Accessory[] {
  return ACCESSORIES.filter(accessory => accessory.bundleId === bundleId);
}
