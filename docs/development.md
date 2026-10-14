# Development

## Quick start (development)

```bash
cp .env.example .env.dev
npm install
npm run infra:up
npm run db:deploy
npm run dev:backend
npm run dev:downloader
npm run dev:scheduler
npm run dev:frontend
```

Run the two Python services from their own folders:

```bash
cd services/recommender && pip install -r requirements.txt && uvicorn app.main:create_app --factory --port 8000
cd services/scraper && pip install -r requirements.txt && uvicorn app.main:create_app --factory --port 8100
```

Open `https://localhost:8443`, where the dev nginx proxies to the Vite and API dev servers. The certificate is self-signed. The first account registered becomes admin; register it before exposing the site. Promote others from **Admin → Users**.

## Testing

```bash
npm test
cd services/recommender && pytest
cd services/scraper && pytest
```

The Node suites run against a real Postgres: PGlite running in-process behind its wire-protocol server, migrated with the real migrations. Only the brokers, storage and HTTP dependencies are faked. The downloader tests run the real `spawn` wrapper against a fake `yt-dlp` executable.

## Browsing the database

Run `npm run db:studio` from the repo root and open http://localhost:5555. With the dev stack, Postgres listens on `localhost:5432`. With the full Docker stack, start the tunnel first:

```bash
docker compose --profile tools up -d db-tunnel
DATABASE_URL="postgresql://<user>:<password>@localhost:5433/<db>" npm run db:studio
```

URL-encode any special characters in the password.
