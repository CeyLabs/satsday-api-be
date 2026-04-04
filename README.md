# satsday-api-be

Backend API for [sats.day](https://sats.day) — Cloudflare Workers + D1 + Queues.

## Stack

| Layer      | Tech                          |
|------------|-------------------------------|
| Runtime    | Cloudflare Workers (TypeScript) |
| Database   | Cloudflare D1 (SQLite)        |
| Queue      | Cloudflare Queues             |
| KV store   | Cloudflare KV (keys, signals) |
| Lightning  | LNbits (self-hosted)          |

## Endpoints

| Method | Path            | Auth         | Description              |
|--------|-----------------|--------------|--------------------------|
| POST   | /register       | —            | Create account + invoice |
| POST   | /deposit        | X-API-Key    | Top up balance           |
| POST   | /submit         | X-API-Key    | Submit CAPTCHA task      |
| GET    | /result/:id     | X-API-Key    | Poll for solution        |
| GET    | /balance        | X-API-Key    | Check sats balance       |

## Setup

```bash
npm install

# 1. Create D1 database
wrangler d1 create satsday
# Paste the database_id into wrangler.toml

# 2. Run migrations
npm run db:migrate

# 3. Create KV namespace
wrangler kv:namespace create satsday-kv
# Paste the id into wrangler.toml

# 4. Create queue
wrangler queues create satsday-tasks

# 5. Set secrets
wrangler secret put LNBITS_BASE_URL
wrangler secret put LNBITS_API_KEY

# 6. Deploy
npm run deploy
```

## Local dev

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your LNbits instance details
npm run dev
```

## Related

- Frontend: [satsday-web-fe](https://github.com/CeyLabs/satsday-web-fe)
- Telegram bot: [@bitcoindeepabot](https://t.me/bitcoindeepabot)
