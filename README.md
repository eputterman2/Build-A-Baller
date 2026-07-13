# 🏀 Build-A-Baller

It's a slot machine: pull the lever and three reels of NBA players (with real
headshots) blur by and stop one-by-one, then draft one of the three to steal that
attribute — height from one, a jumpshot from another, IQ from a third — and
assemble your own created baller. Hidden **synergies and tradeoffs** (a 7-footer rebounds and posts up but is
slower and more injury-prone; a sub-6-foot guard has an elite handle but can't score
inside) shape a final **OVR rating and letter grade**. Save your build to a **global
leaderboard** and share it.

This is a full-stack app:

- **Frontend** — React + TypeScript + Vite
- **Backend** — Node + Express + TypeScript, JWT auth, PostgreSQL
- **Shared** — one TypeScript source of truth for the player data, attribute config,
  and scoring engine, imported by both sides (so the server can recompute scores
  authoritatively and clients can't forge them).

---

## Project structure

```
shared/        Types, 110-player roster, attribute config, scoring + synergy engine
server/        Express API (auth, players, builds/leaderboard) + Postgres
client/        React app (wheel, game flow, results, leaderboard, auth)
legacy-static/ The original no-build prototype (kept for reference)
Dockerfile     Single production image (serves API + built client)
DEPLOY.md      Google Cloud (Cloud Run + Cloud SQL) deployment guide
```

---

## Running locally

### Prerequisites
- **Node 22+** and npm. (A user-local Node 22 was installed at `~/.local/node` and
  added to your `PATH` via `~/.zprofile` — open a **new** terminal so `node -v` works.)
- **No database setup required.** In dev the server boots a real, throwaway
  PostgreSQL instance via [`embedded-postgres`](https://www.npmjs.com/package/embedded-postgres)
  (binaries live in `node_modules`, data in `server/.pgdata`). The exact same `pg`
  code talks to Cloud SQL in production.

### First time
```bash
npm run install:all     # installs root, server, and client deps
```

### Start both servers
```bash
npm run dev
```
- API → http://localhost:4000
- App → **http://localhost:5173**  ← open this

The Vite dev server proxies `/api/*` to the backend, so you only visit port 5173.

> You can also launch them from the Claude Code preview panel — `server` and
> `client` are defined in `.claude/launch.json`.

### Useful scripts
| Command | What |
|---|---|
| `npm run dev` | Run server + client together (hot reload) |
| `npm run build` | Production build of client and server |
| `npm run typecheck` | Type-check the whole monorepo |

---

## How it works

1. The client fetches the roster from `GET /api/players` (all 30 NBA teams).
2. For each of the **14 attributes** (Physical / Skill / Mental) you **pull a slot
   machine**: three reels of players spin up and stop one-by-one (~3s), then you
   **draft one of the three** to donate that attribute. Headshots come from ESPN's
   CDN (ids generated into `shared/src/playerImages.ts` by
   `scripts/build-player-images.mts`); players without a match get an initials avatar.
3. On finish, the client submits your picks (`attribute → playerId`) to
   `POST /api/builds`. **The server recomputes the score from its own authoritative
   player values**, applies the synergy engine, stores the build, and returns the
   breakdown. Guests can play and see a locally-computed score, but saving to the
   leaderboard requires an account.
4. `GET /api/builds/leaderboard` ranks the top builds; `GET /api/builds/:id` powers
   shareable build pages at `/build/:id`.

### Auth
Username + password, hashed with bcrypt; a 30-day JWT is returned and stored in
`localStorage`. Sent as `Authorization: Bearer <token>`.

---

## Production

```bash
docker build -t build-a-baller .
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/baller" \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  build-a-baller
```
The image builds the React app and serves it from the same Express process that
hosts the API (single container, ideal for Cloud Run).

See **[DEPLOY.md](DEPLOY.md)** for the full Google Cloud (Cloud Run + Cloud SQL) walkthrough.

---

## Environment variables (server)

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | prod | Postgres connection string. Omit in dev to use embedded Postgres. |
| `JWT_SECRET` | prod | Long random string for signing tokens. |
| `ADMIN_SECRET` | admin | Private code for `/admin/market`, where paid custom drawing requests are reviewed and fulfilled. |
| `PORT` | no | Defaults 4000 (dev) / 8080 (container). |
| `CLIENT_DIST` | prod | Path to the built client; set in the Dockerfile. |
| `CLIENT_ORIGIN` | no | Dev CORS origin (default `http://localhost:5173`). |
| `EMBEDDED_PG` | no | `1` forces embedded Postgres (set automatically by `npm run dev`). |
| `STRIPE_SECRET_KEY` | payments | Stripe secret key used to create Checkout sessions. If omitted, market unlocks use the local dev flow. |
| `STRIPE_WEBHOOK_SECRET` | payments | Stripe webhook signing secret for `/api/market/webhook`. Required for paid items to unlock after checkout. |
| `STRIPE_GOLDEN_STATE_PRICE_ID` | no | Optional override for the Golden State Bundle price. Default: `price_1TrQcfK3B9PbooQWAaX0W5e2`. |
| `STRIPE_PRO_PLAYER_PRICE_ID` | no | Optional override for the Pro Player Request price. Default: `price_1TrQlRK3B9PbooQW9OqJJkZH`. |
| `STRIPE_PHOTO_DRAWING_PRICE_ID` | no | Optional override for the Photo Drawing Request price. Default: `price_1TrQkAK3B9PbooQW30n0Tnry`. |

### Stripe Checkout

Add a Stripe webhook endpoint for your published site:

`https://YOUR-REPLIT-SITE/api/market/webhook`

Subscribe it to `checkout.session.completed`, then copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
