# Self-hosting (fork `mortennh/faster-fixes`, branch `self-host`)

Runs on the monh VPS at `/opt/faster-fixes`: https://feedback.monh.dev

## Changes against upstream

| File | Change |
|---|---|
| `packages/database/index.ts` | `DATABASE_DRIVER=pg` → standard Postgres driver (upstream uses Neon's HTTP driver in production) |
| `apps/web/src/server/storage/index.ts` | `MINIO_ENDPOINT` → any S3-compatible store via the `minio()` client (here: SeaweedFS) instead of Cloudflare R2 |
| `apps/web/src/server/auth/config/*` | Without `RESEND_API_KEY`: no verification mail, sign-up not blocked on verification; `DISABLE_SIGN_UP=true` closes registration |
| `Dockerfile.self-host`, `self-host/`, `.github/workflows/self-host.yml` | Image build (GHCR) + compose stack + deploy over SSH |

## Stack (`self-host/docker-compose.yml`)

`app` (this image, runs `prisma migrate deploy` on start) · `db` (Postgres 16) · `storage` (SeaweedFS S3, bucket `feedback`) · `inngest` (self-hosted Inngest server, SQLite + in-memory Redis with snapshots).

## Deploy

Push to `self-host` → GitHub Actions builds `ghcr.io/mortennh/faster-fixes:self-host` → SSH to the VPS → `git reset`, `docker compose pull app && up -d`.
Secrets: `HETZNER_HOST`, `HETZNER_SSH_USER`, `HETZNER_SSH_KEY`. The GHCR pull uses the job's `GITHUB_TOKEN` (logged out afterwards).

## Updating from upstream

```bash
git fetch upstream && git merge upstream/main   # on self-host
git push                                        # builds + deploys
```

No email provider is configured: password resets don't work. Add `RESEND_API_KEY` (+ a verified sender) to enable mails.
