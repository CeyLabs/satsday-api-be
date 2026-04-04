# satsday-api-be

Backend API for [sats.day](https://sats.day) — Cloudflare Workers + D1 + KV.

## Stack

| Layer        | Tech                              |
|--------------|-----------------------------------|
| Runtime      | Cloudflare Workers (TypeScript)   |
| Database     | Cloudflare D1 (SQLite) — APAC/SIN |
| KV           | Cloudflare KV (sessions, signals) |
| Queue        | Cloudflare Queues                 |
| Payments     | BTCPay Server (Lightning)         |
| Auth         | Telegram Login Widget + HMAC      |

## Provisioned resources (Cey Lounge account)

| Resource        | Name       | ID                                   |
|-----------------|------------|--------------------------------------|
| D1 Database     | satsday    | 22b17f35-6fb6-4227-93db-fc89b216635a |
| KV Namespace    | satsday-kv | cb6b1e0095604bdb9324057bc127c964     |
| CF Account      | Cey Lounge | 82c5ee4b5bf756e6658c8d9807d21592     |

## Endpoints

| Method | Path                  | Auth           | Description                        |
|--------|-----------------------|----------------|------------------------------------|
| POST   | /auth/telegram        | —              | TG Login Widget → session token    |
| GET    | /me                   | X-Session-Token| Current user + balance             |
| GET    | /solver/task          | X-Session-Token| Fetch next captcha from queue      |
| POST   | /solver/solve         | X-Session-Token| Submit answer → earn sats          |
| GET    | /solver/history       | X-Session-Token| Recent solved tasks                |
| POST   | /deposit              | X-Session-Token| Create BTCPay Lightning invoice    |
| GET    | /deposit/status       | —              | Poll invoice payment status        |
| POST   | /btcpay/webhook       | BTCPay-Sig     | Payment settled → credit balance   |
| POST   | /register             | —              | Register buyer API key             |
| POST   | /submit               | X-API-Key      | Submit captcha task (buyer)        |
| GET    | /result/:id           | X-API-Key      | Poll captcha result                |
| GET    | /balance              | X-API-Key      | Buyer sats balance                 |
| POST   | /buyer/deposit        | X-API-Key      | Buyer Lightning invoice            |

## Deploy (one-time setup)

```bash
npm install

# 1. Create the Queues (D1 + KV already provisioned above)
wrangler queues create satsday-tasks

# 2. Set secrets
wrangler secret put TG_BOT_TOKEN      # @bitcoindeepabot token from BotFather
wrangler secret put BTCPAY_URL        # https://your.btcpay.server
wrangler secret put BTCPAY_API_KEY    # BTCPay store API key
wrangler secret put BTCPAY_STORE_ID   # BTCPay store ID

# 3. Deploy
npm run deploy

# 4. Add custom domain in CF dashboard:
#    Workers > satsday-api-be > Settings > Domains > Add Custom Domain
#    → api.sats.day
```

## GitHub Actions (auto-deploy on push)

Add these secrets to the repo (Settings → Secrets → Actions):

| Secret                  | Value                              |
|-------------------------|------------------------------------|
| CLOUDFLARE_API_TOKEN    | CF API token with Workers:Edit     |
| CLOUDFLARE_ACCOUNT_ID   | 82c5ee4b5bf756e6658c8d9807d21592  |
| TG_BOT_TOKEN            | @bitcoindeepabot bot token         |
| BTCPAY_URL              | Your BTCPay Server URL             |
| BTCPAY_API_KEY          | BTCPay store API key               |
| BTCPAY_STORE_ID         | BTCPay store ID                    |

## Local dev

```bash
cp .dev.vars.example .dev.vars
# Fill in .dev.vars with your values
npm run dev     # wrangler dev on localhost:8787
```

## BotFather setup (required for Telegram Login Widget)

1. Open @BotFather → `/setdomain`
2. Select @bitcoindeepabot
3. Enter: `sats.day`

This allows the Telegram Login Widget on sats.day to work.

## Related

- Frontend: [satsday-web-fe](https://github.com/CeyLabs/satsday-web-fe)
- Live: [sats.day](https://sats.day) | API: [api.sats.day](https://api.sats.day)
