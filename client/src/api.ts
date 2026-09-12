import type {
  Accessory, AdminDrawingPrizeCompletion, AuthUser, BuildAccessories, BuildDetail, BuildSummary, CollectionBuild, ContestState, DrawingCollectionStats,
  AdminPlayerDrawingPoll, DrawingCollectionLeader, DrawingOption, MarketBundle, PickMap, Player, PlayerDrawingPoll, PlayerIdentity, PlayerOfDay, PlayerOfDayLeader, PlayerOfDayWin,
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
interface DailyLoginRewardStatus {
  currentStreak: number;
  requiredDays: number;
  checkedDays: boolean[];
  complete: boolean;
}
interface BuildPrizeProgress {
  bestOverall: number | null;
  worstOverall: number | null;
}
interface MarketBundlesResponse {
  bundles: MarketBundle[];
  rewardBundles?: MarketBundle[];
  ownedBundleIds: string[];
  dailyLoginReward?: DailyLoginRewardStatus | null;
  prizeProgress?: BuildPrizeProgress | null;
  rewardDrawingIds?: string[];
  repeatableRandomDrawingTestAccount?: boolean;
  availableDrawingCount?: number;
}
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
export interface RecentPlayerDrawing {
  id: string;
  name: string;
  src: string;
  obtainText: string;
  addedAt: string | null;
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
interface AdminDrawingSubmit {
  finalName: string;
  finalDrawingDataUrl?: string;
  minOverall: number;
  maxOverall: number;
  buildHint?: string;
}
interface CheckoutResponse {
  checkoutUrl?: string;
}
export interface AdminAnalytics {
  visitors: {
    day: { total: number; returning: number };
    week: { total: number; returning: number };
    month: { total: number; returning: number };
  };
  totalAccounts: number;
  issues: Array<{
    type: string;
    message: string;
    path: string;
    occurrences: number;
    lastSeenAt: string;
  }>;
  issuesWindow: string;
  feedback: Array<{
    id: string;
    username: string;
    message: string;
    wordCount: number;
    createdAt: string;
  }>;
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
  adminPlayerDrawingPoll: (secret: string) =>
    req<{ poll: AdminPlayerDrawingPoll }>('/polls/admin/current', {
      headers: adminHeaders(secret),
      cache: 'no-store',
    }).then(d => d.poll),
  adminUpdatePlayerDrawingPoll: (secret: string, options: string[], resetVotes = false) =>
    req<{ poll: AdminPlayerDrawingPoll }>('/polls/admin/current', {
      method: 'PATCH',
      headers: adminHeaders(secret),
      body: JSON.stringify({ options, resetVotes }),
    }).then(d => d.poll),
  contest: (viewerId: string) =>
    req<ContestState>('/contest?viewerId=' + encodeURIComponent(viewerId), { cache: 'no-store' }),
  submitContestEntry: (drawingDataUrl: string) =>
    req<ContestState>('/contest/entry', {
      method: 'POST',
      body: JSON.stringify({ drawingDataUrl }),
    }),
  deleteContestEntry: () =>
    req<ContestState>('/contest/entry', { method: 'DELETE' }),
  voteContestEntry: (entryId: string) =>
    req<ContestState>('/contest/vote', {
      method: 'POST',
      body: JSON.stringify({ entryId }),
    }),
  recordContestImpressions: (entryIds: string[], viewerId: string) =>
    req<{ ok: true }>('/contest/impressions', {
      method: 'POST',
      body: JSON.stringify({ entryIds, viewerId }),
    }).then(d => d.ok),
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
  updateUsernameIcon: (userIconId: string) =>
    req<{ userIconId: string }>('/builds/username-icon', {
      method: 'PATCH',
      body: JSON.stringify({ userIconId }),
    }).then(d => d.userIconId),
  updateBuildCharacter: (id: string, characterId: string) =>
    req<{ characterId: string; originalOwnerDrawing: boolean }>('/builds/' + id + '/character', {
      method: 'PATCH',
      body: JSON.stringify({ characterId }),
    }),
  marketBundles: () => req<MarketBundlesResponse>('/market/bundles', { cache: 'no-store' }),
  trackSiteVisit: (visitorId: string, path: string) =>
    req<{ ok: true }>('/analytics/visit', {
      method: 'POST',
      body: JSON.stringify({ visitorId, path }),
    }),
  reportSiteIssue: (issue: { visitorId?: string; type: 'error' | 'unhandled-rejection'; message: string; path: string }) =>
    req<{ ok: true }>('/analytics/issue', {
      method: 'POST',
      body: JSON.stringify(issue),
    }),
  adminAnalytics: (secret: string) =>
    req<AdminAnalytics>('/analytics/admin', {
      headers: adminHeaders(secret),
      cache: 'no-store',
    }),
  claimHighOverallDrawing: () => req<{ drawing: { id: string; name: string; src: string } }>('/market/prizes/high-overall-drawing/claim', { method: 'POST' }),
  purchaseBundle: (id: string) =>
    req<{ bundle: MarketBundle; ownedBundleIds: string[] } & CheckoutResponse>('/market/bundles/' + id + '/purchase', { method: 'POST' }),
  submitDrawingRequest: (request: MarketDrawingRequestInput) =>
    req<{ request: { id: string; type: string; subject: string; priceCents: number; status: string } } & CheckoutResponse>('/market/drawing-requests', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
  drawingRequests: () =>
    req<{ requests: MarketDrawingRequest[] }>('/market/drawing-requests', { cache: 'no-store' }).then(d => d.requests),
  recentPlayerDrawings: () =>
    req<{ drawings: RecentPlayerDrawing[] }>('/market/drawings/recent', { cache: 'no-store' }).then(d => d.drawings),
  deleteDrawingRequest: (id: string) =>
    req<{ ok: true }>('/market/drawing-requests/' + id, { method: 'DELETE' }).then(d => d.ok),
  adminDrawingRequests: (secret: string) =>
    req<{ requests: MarketDrawingRequest[] }>('/market/admin/drawing-requests', {
      headers: adminHeaders(secret),
    }).then(d => d.requests),
  adminDrawingPrizeCompletions: (secret: string) =>
    req<{ completions: AdminDrawingPrizeCompletion[] }>('/market/admin/drawing-prize-completions', {
      headers: adminHeaders(secret),
    }).then(d => d.completions),
  adminPublishedDrawings: (secret: string) =>
    req<{ drawings: MarketDrawingRequest[] }>('/market/admin/drawings', {
      headers: adminHeaders(secret),
    }).then(d => d.drawings),
  adminCreateDrawing: (secret: string, drawing: AdminDrawingSubmit) =>
    req<{ drawing: MarketDrawingRequest }>('/market/admin/drawings', {
      method: 'POST',
      headers: adminHeaders(secret),
      body: JSON.stringify(drawing),
    }).then(d => d.drawing),
  adminUpdateDrawing: (secret: string, id: string, drawing: AdminDrawingSubmit) =>
    req<{ drawing: MarketDrawingRequest }>('/market/admin/drawings/' + id, {
      method: 'PATCH',
      headers: adminHeaders(secret),
      body: JSON.stringify(drawing),
    }).then(d => d.drawing),
  adminRemoveDrawing: (secret: string, id: string) =>
    req<{ ok: true }>('/market/admin/drawings/' + id, {
      method: 'DELETE',
      headers: adminHeaders(secret),
    }).then(d => d.ok),
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
