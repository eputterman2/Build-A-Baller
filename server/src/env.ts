import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  databaseUrl: process.env.DATABASE_URL || '',
  // When '1', the server boots a throwaway embedded Postgres for local dev.
  embeddedPg: process.env.EMBEDDED_PG === '1',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  resendApiKey: process.env.RESEND_API_KEY || '',
  feedbackFrom: process.env.FEEDBACK_FROM || 'Build-A-Baller <onboarding@resend.dev>',
  adminSecret: process.env.ADMIN_SECRET || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePrices: {
    goldenStateBundle: process.env.STRIPE_GOLDEN_STATE_PRICE_ID || 'price_1TrQcfK3B9PbooQWAaX0W5e2',
    proPlayerRequest: process.env.STRIPE_PRO_PLAYER_PRICE_ID || 'price_1TrQlRK3B9PbooQW9OqJJkZH',
    photoDrawingRequest: process.env.STRIPE_PHOTO_DRAWING_PRICE_ID || 'price_1TrQkAK3B9PbooQW30n0Tnry',
  },
  // In production, path to the built React app to serve as static files.
  clientDist: process.env.CLIENT_DIST || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
};
