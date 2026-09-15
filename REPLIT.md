# Publishing on Replit

This app publishes as one Node service: the client is built with Vite, then the
Express server serves both `/api/*` and the built React app.

## Import

1. Push this folder to GitHub, or upload it to Replit as a zip.
2. Open the project in Replit.
3. Press Run once. The `.replit` file installs the root, server, and client
   packages, then starts the local dev servers.

## Production secrets

Before publishing, add these secrets in Replit:

- `DATABASE_URL`: a Postgres connection string. Replit's managed Neon Postgres
  database is the best fit.
- `JWT_SECRET`: a long random string for login tokens.
- `ADMIN_SECRET`: a private code for the hidden `/admin/market` request queue.
- `RESEND_API_KEY`: required for production password-recovery emails. Feedback
  submissions are stored in the admin page only and are not emailed.
- `FEEDBACK_FROM`: required sender address for Resend. Use an address on a
  verified Resend domain in production.

The app creates its tables automatically on startup.

## Publish

Use Replit's Publishing tool and choose an Autoscale deployment. The deployment
commands are already configured in `.replit`:

- Build: `npm run install:all && npm run build`
- Run: `npm start`

After publishing, test account creation and leaderboard sharing on the public
`.replit.app` URL.
