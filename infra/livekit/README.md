# LiveKit Self-Hosted Baseline (CCOS Live)

This folder contains the easiest production baseline to run CCOS Live under Mahsumaah-owned infrastructure.

## 1) Provisioning baseline

- Ubuntu 22.04 VM (8 vCPU / 16 GB RAM)
- Public IP and DNS records:
  - `live.mahsumaah.sa` -> LiveKit
  - `turn.live.mahsumaah.sa` -> Coturn (optional dedicated host)
- Docker + Docker Compose
- TLS certificates (LetsEncrypt or corporate CA)

## 2) Configure env

1. Copy `.env.example` to `.env`
2. Fill API keys, TURN shared secret, S3-compatible recording storage values

## 3) Start stack

```bash
cd infra/livekit
cp .env.example .env
# edit .env

docker compose --env-file .env up -d
```

## 4) Open firewall

- TCP 443/80 for TLS + certs
- TCP 7880, 7881
- UDP 50000-50100
- UDP/TCP 3478, 5349 (TURN)

## 5) Webhook wiring

Set `LIVEKIT_WEBHOOK_URL` to CCOS route:
- `/api/livekit/webhook`

CCOS will consume participant/session/track events and write audit logs and participant sessions.

## 6) Branding and ownership

- End-user UI remains CCOS-only.
- No vendor logo exposed to users.
- Live artifacts (recordings/transcripts) stored in Mahsumaah storage.

## 7) Suggested production hardening

- Add Redis HA and Postgres read replica later
- Put LiveKit behind managed reverse proxy
- Add metrics and alerts for room join failures, egress failures, webhook errors
- Rotate API/secret keys every 90 days
