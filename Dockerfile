# Single production image: builds the React client and the Node server, then
# serves both from one container (suitable for Cloud Run).

# ---------- Build stage ----------
FROM node:22-slim AS build
WORKDIR /app

# Shared code is consumed by both packages.
COPY shared ./shared

# Client
COPY client/package*.json ./client/
RUN npm --prefix client ci
COPY client ./client
RUN npm --prefix client run build

# Server
COPY server/package*.json ./server/
RUN npm --prefix server ci
COPY server ./server
RUN npm --prefix server run build

# ---------- Runtime stage ----------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production server dependencies only (no embedded-postgres / build tools).
COPY server/package*.json ./server/
RUN npm --prefix server ci --omit=dev

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

ENV CLIENT_DIST=/app/client/dist
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/dist/index.js"]
