import type {
  Accessory, AuthUser, BuildAccessories, BuildDetail, BuildSummary, CollectionBuild, DrawingCollectionStats,
  DrawingCollectionLeader, DrawingOption, MarketBundle, PickMap, Player, PlayerDrawingPoll, PlayerIdentity, PlayerOfDay, PlayerOfDayLeader, PlayerOfDayWin,
} from '@shared/index';

const TOKEN_KEY = 'baller_token';
let authToken: string | null = localStorage.getItem(TOKEN_KEY);

export function setToken(token: string | null): void {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return authToken;
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: 'Bearer ' + authToken } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

interface AuthResponse { token: string; user: AuthUser; }
interface ForgotPasswordResponse { ok: true; message: string; resetUrl?: string; }
interface MarketBundlesResponse { bundles: MarketBundle[]; ownedBundleIds: string[]; }
interface AccessoriesResponse { accessories: Accessory[]; ownedBundleIds: string[]; ownedAccessoryIds: string[]; }
interface MarketDrawingRequestInput {
  type: 'pro-player' | 'photo-player';
  subject: string;
  photoDataUrl?: string;
}
export interface MarketDrawingRequest {
  id: string;
  characterId: string;
  userId?: string;
  username?: string;
  type: 'pro-player' | 'photo-player';
  subject: string;
  photoDataUrl?: string;
  hasPhoto?: boolean;
  priceCents: number;
  stripeSessionId?: string;
  status: string;
  statusLabel: string;
  paidAt?: string | null;
  adminNote?: string;
  finalName: string;
  finalDrawingSrc: string;
  visibility: 'public' | 'private';
  minOverall: number;
  maxOverall: number;
  buildHint: string;
  fulfilledAt?: string | null;
  createdAt: string;
}
interface AdminDrawingFulfillment {
  finalName: string;
  finalDrawingDataUrl: string;
  visibility: 'public' | 'private';
  minOverall: number;
  maxOverall: number;
  buildHint?: string;
  adminNote?: string;
}
interface CheckoutResponse {
  checkoutUrl?: string;
}

function adminHeaders(secret: string): HeadersInit {
  return { 'X-Admin-Secret': secret };
}

export const api = {
  register: (username: string, email: string, password: string) =>
    req<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  login: (email: string, password: string) =>
    req<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  requestPasswordReset: (email: string) =>
    req<ForgotPasswordResponse>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    req<{ ok: true }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  me: () => req<{ user: AuthUser }>('/auth/me').then(d => d.user),
  players: () => req<{ players: Player[] }>('/players').then(d => d.players),
  submitBuild: (picks: PickMap, identity?: Partial<PlayerIdentity>, accessories?: Partial<BuildAccessories>, characterId?: string) =>
    req<{ build: BuildDetail }>('/builds', {
      method: 'POST',
      body: JSON.stringify({ picks, identity, accessories, characterId }),
    }).then(d => d.build),
  leaderboard: (options?: { limit?: number; minOverall?: number; maxOverall?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.minOverall != null) params.set('minOverall', String(options.minOverall));
    if (options?.maxOverall != null) params.set('maxOverall', String(options.maxOverall));
    const query = params.toString();
    return req<{ builds: BuildDetail[] }>(`/builds/leaderboard${query ? `?${query}` : ''}`).then(d => d.builds);
  },
  playerOfDay: () => req<PlayerOfDay>('/builds/player-of-day'),
  playerOfDayLeaderboard: () =>
    req<{ leaders: PlayerOfDayLeader[] }>('/builds/player-of-day-leaderboard').then(d => d.leaders),
  drawingCollectionLeaderboard: () =>
    req<{ leaders: DrawingCollectionLeader[] }>('/builds/drawing-collection-leaderboard').then(d => d.leaders),
  playerDrawingPoll: (voterId: string) =>
    req<PlayerDrawingPoll>('/polls/current?voterId=' + encodeURIComponent(voterId)),
  votePlayerDrawingPoll: (optionId: string, voterId: string) =>
    req<PlayerDrawingPoll>('/polls/current/vote', {
      method: 'POST',
      body: JSON.stringify({ optionId, voterId }),
    }),
  submitFeedback: (message: string) =>
    req<{ ok: true }>('/feedback', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }).then(d => d.ok),
  myBuilds: () => req<{ builds: BuildSummary[] }>('/builds/mine').then(d => d.builds),
  collection: () => req<{ builds: CollectionBuild[] }>('/builds/collection').then(d => d.builds),
  drawingStats: () =>
    req<{ stats: DrawingCollectionStats }>('/builds/drawing-stats').then(d => d.stats),
  drawingOptions: (overall: number, currentCharacterId?: string, archetype?: string) =>
    req<{ options: DrawingOption[] }>(
      `/builds/drawing-options?overall=${encodeURIComponent(String(overall))}`
      + `&current=${encodeURIComponent(currentCharacterId ?? '')}`
      + `&archetype=${encodeURIComponent(archetype ?? '')}`,
    ).then(d => d.options),
  playerOfDayWins: () =>
    req<{ wins: PlayerOfDayWin[]; totalWins: number }>('/builds/player-of-day-wins'),
  updateBuildIdentity: (id: string, identity: PlayerIdentity) =>
    req<{ identity: PlayerIdentity }>('/builds/' + id + '/identity', {
      method: 'PATCH',
      body: JSON.stringify({ identity }),
    }).then(d => d.identity),
  updateBuildAccessories: (id: string, accessories: BuildAccessories) =>
    req<{ accessories: BuildAccessories }>('/builds/' + id + '/accessories', {
      method: 'PATCH',
      body: JSON.stringify({ accessories }),
    }).then(d => d.accessories),
  updateBuildCharacter: (id: string, characterId: string) =>
    req<{ characterId: string; originalOwnerDrawing: boolean }>('/builds/' + id + '/character', {
      method: 'PATCH',
      body: JSON.stringify({ characterId }),
    }),
  marketBundles: () => req<MarketBundlesResponse>('/market/bundles', { cache: 'no-store' }),
  purchaseBundle: (id: string) =>
    req<{ bundle: MarketBundle; ownedBundleIds: string[] } & CheckoutResponse>('/market/bundles/' + id + '/purchase', { method: 'POST' }),
  submitDrawingRequest: (request: MarketDrawingRequestInput) =>
    req<{ request: { id: string; type: string; subject: string; priceCents: number; status: string } } & CheckoutResponse>('/market/drawing-requests', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
  drawingRequests: () =>
    req<{ requests: MarketDrawingRequest[] }>('/market/drawing-requests', { cache: 'no-store' }).then(d => d.requests),
  deleteDrawingRequest: (id: string) =>
    req<{ ok: true }>('/market/drawing-requests/' + id, { method: 'DELETE' }).then(d => d.ok),
  adminDrawingRequests: (secret: string) =>
    req<{ requests: MarketDrawingRequest[] }>('/market/admin/drawing-requests', {
      headers: adminHeaders(secret),
    }).then(d => d.requests),
  adminUpdateDrawingRequestStatus: (secret: string, id: string, status: string, adminNote: string) =>
    req<{ request: MarketDrawingRequest }>('/market/admin/drawing-requests/' + id + '/status', {
      method: 'PATCH',
      headers: adminHeaders(secret),
      body: JSON.stringify({ status, adminNote }),
    }).then(d => d.request),
  adminFulfillDrawingRequest: (secret: string, id: string, fulfillment: AdminDrawingFulfillment) =>
    req<{ request: MarketDrawingRequest }>('/market/admin/drawing-requests/' + id + '/fulfill', {
      method: 'POST',
      headers: adminHeaders(secret),
      body: JSON.stringify(fulfillment),
    }).then(d => d.request),
  adminDeleteDrawingRequest: (secret: string, id: string) =>
    req<{ ok: true }>('/market/admin/drawing-requests/' + id, {
      method: 'DELETE',
      headers: adminHeaders(secret),
    }).then(d => d.ok),
  accessories: () => req<AccessoriesResponse>('/market/accessories'),
  deleteBuild: (id: string) =>
    req<{ ok: true }>('/builds/' + id, { method: 'DELETE' }).then(d => d.ok),
  build: (id: string) => req<{ build: BuildDetail }>('/builds/' + id).then(d => d.build),
};
