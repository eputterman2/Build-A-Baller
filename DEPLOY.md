# Deploying to Google Cloud (Cloud Run + Cloud SQL)

This app is a single container that serves both the API and the built React app,
which makes **Cloud Run** a natural fit, backed by a managed **Cloud SQL for
PostgreSQL** database.

> Prerequisites: a Google Cloud project with billing enabled, and the `gcloud`
> CLI installed and authenticated (`gcloud init`).

Set some shell variables to reuse below:

```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export DB_INSTANCE="baller-db"
export DB_NAME="baller"
export DB_USER="baller"
export DB_PASS="$(openssl rand -hex 16)"      # save this somewhere safe
export JWT_SECRET="$(openssl rand -hex 32)"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

## 1. Create the Cloud SQL Postgres instance

```bash
gcloud sql instances create "$DB_INSTANCE" \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="$REGION"

gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
gcloud sql users create "$DB_USER" --instance="$DB_INSTANCE" --password="$DB_PASS"

# The instance connection name, e.g. your-project:us-central1:baller-db
export INSTANCE_CONN="$(gcloud sql instances describe "$DB_INSTANCE" \
  --format='value(connectionName)')"
echo "$INSTANCE_CONN"
```

The schema is created automatically by the app on first boot (idempotent
`CREATE TABLE IF NOT EXISTS`), so there's no migration step to run.

## 2. Store secrets

```bash
printf "%s" "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-
printf "%s" "$DB_PASS"    | gcloud secrets create db-pass    --data-file=-
```

## 3. Deploy to Cloud Run

Cloud Run builds the image from the `Dockerfile` (`--source .`), attaches the
Cloud SQL instance, and connects over a Unix socket at `/cloudsql/<INSTANCE_CONN>`.
The `pg` driver reads that socket path from the `host` query param in `DATABASE_URL`.

```bash
gcloud run deploy build-a-baller \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --add-cloudsql-instances "$INSTANCE_CONN" \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "^@@^DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=/cloudsql/${INSTANCE_CONN}" \
  --update-secrets "JWT_SECRET=jwt-secret:latest"
```

> The `^@@^` prefix changes the delimiter so the `/` and `:` in the connection
> string aren't misparsed. Alternatively store the whole `DATABASE_URL` in Secret
> Manager and pass it via `--update-secrets`.

When the command finishes it prints a service URL like
`https://build-a-baller-xxxx.run.app` — that's your live app.

## 4. (Optional) custom domain

```bash
gcloud run domain-mappings create --service build-a-baller \
  --domain yourdomain.com --region "$REGION"
```
Then add the DNS records it prints.

---

## Notes & cost control

- **Scales to zero.** With no traffic, Cloud Run costs nothing for compute; you
  pay only for the Cloud SQL instance. `db-f1-micro` is the cheapest tier — fine
  for this app. Stop it when unused: `gcloud sql instances patch "$DB_INSTANCE" --activation-policy=NEVER`.
- **Connections.** The server uses a small `pg` pool (max 10). For higher
  concurrency, raise Cloud Run's min/max instances thoughtfully so total DB
  connections stay under the instance limit.
- **Redeploy** after code changes: rerun the `gcloud run deploy --source .`
  command (env vars/secrets persist unless you change them).
- **Logs**: `gcloud run services logs read build-a-baller --region "$REGION"`.
