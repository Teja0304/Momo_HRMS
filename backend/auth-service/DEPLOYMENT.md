# Deployment & Secrets Guide

This covers getting the Auth Service somewhere your Admin Web (React) and
Mobile (React Native) developers can actually reach it, plus how to
handle secrets properly outside your laptop.

## 1. Generate real secrets

Never ship the `.env.example` placeholder secrets anywhere but your own
machine. Generate real ones:

```bash
npm run generate:secrets
```

This prints a fresh `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
(32 random bytes each, hex-encoded). Paste them into your `.env` — or
better, directly into your hosting provider's environment variable /
secrets UI, so they never touch a file on disk in a shared repo.

The service will **refuse to start** (`validate-env.ts`) if these are
missing, left as the example placeholders, too short, or identical to
each other. This is intentional — it's a common way weak secrets end up
in production by accident.

## 2. Where secrets should actually live

| Environment | Where secrets go |
|---|---|
| Your local machine | `.env` file, **never committed** (already in `.gitignore`) |
| CI (GitHub Actions, etc.) | Repo/organization "Secrets" settings, injected as env vars at build/deploy time |
| Hosting provider (Render, Railway, Fly.io, AWS, etc.) | The provider's environment-variable / secrets manager UI — not a file |
| A team sharing credentials | A password manager or secrets tool (1Password, Doppler, Vault) — not Slack/email |

Rotate `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` if they're ever exposed
(committed by accident, leaked in a log, etc.) — doing so immediately
invalidates every existing access and refresh token, so plan it as a
"everyone logs in again" event, not a silent hot-swap.

## 3. Picking somewhere to deploy

You don't need Kubernetes for one small service. Pick based on what you
already have:

### Option A — Render / Railway / Fly.io (simplest, good for a first deploy)
All three can build directly from your Dockerfile or `package.json`.
Rough steps (Render as the example):
1. Push this repo to GitHub.
2. Render dashboard → New → Web Service → connect the repo.
3. It detects the `Dockerfile` automatically, or set build command
   `npm install && npm run build` and start command `node dist/main.js`.
4. Add a managed MySQL database (Render, Railway, and PlanetScale all
   offer one) and copy its connection string into `DATABASE_URL`.
5. Add `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, and the
   rest of your `.env` values in the service's environment variables UI.
6. Deploy. You'll get a public URL like `https://auth-service-xxxx.onrender.com`.
7. Run migrations once against the new database:
   ```bash
   DATABASE_URL="<the production URL>" npx prisma migrate deploy
   DATABASE_URL="<the production URL>" npm run prisma:seed
   ```

### Option B — Your own VPS (DigitalOcean, Linode, a company server)
```bash
git clone <your repo> && cd auth-service
cp .env.example .env   # fill in real values
docker compose up -d --build
```
Then put Nginx (or Caddy, which handles HTTPS automatically) in front of
port 3001 with a real domain and TLS certificate — never expose the raw
Node port directly to the internet.

### Option C — Behind your API Gateway on the same cluster
If the API Gateway is already deployed somewhere, deploy this service
into the same network/cluster and route `/api/v1/auth/*` and
`/api/v1/health` to it internally. The frontend then only ever talks to
the gateway's public URL, never to this service directly.

## 4. Once it's deployed — update these

- `CORS_ORIGINS` → your real Admin Web URL(s), e.g.
  `https://admin.yourcompany.com` (comma-separate multiple environments
  if needed, e.g. staging + prod)
- Give your frontend devs the deployed base URL and the Swagger link:
  `https://<your-domain>/api/v1/docs`
- Confirm `https://<your-domain>/api/v1/health` returns `{"status":"ok"}`
  from outside your machine (not just localhost) before telling anyone
  it's ready

## 5. Production checklist

- [ ] Real, randomly generated `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, stored in the host's secret manager
- [ ] `DATABASE_URL` points at a managed/production MySQL instance, not localhost
- [ ] `CORS_ORIGINS` lists only real frontend origins (no `*`, no localhost in prod)
- [ ] `NODE_ENV=production`
- [ ] HTTPS terminates in front of this service (via the gateway, a load balancer, or Nginx/Caddy) — never serve plain HTTP publicly
- [ ] `npx prisma migrate deploy` run against the production database (not `migrate dev`, which is for local iteration)
- [ ] Seed run once (`npm run prisma:seed`) so roles/permissions exist
- [ ] Bootstrap SUPER_ADMIN env vars removed from the environment after the first admin account is created (they're only needed once)
