# satsday-api-be

Backend API for [sats.day](https://sats.day) — Cloudflare Workers + D1 + KV.

## Stack

| Layer        | Tech                            |
|--------------|---------------------------------|
| Runtime      | Cloudflare Workers (TypeScript) |
| Database     | Cloudflare D1 `satsday`         |
| KV store     | Cloudflare KV `satsday-kv`      |
| Queue        | Cloudflare Queues               |
| Payments     | BTCPay Server (Lightning)       |
| Auth         | Telegram Login Widget + HMAC    |

## Endpoints

### Auth (session token)
| Method | Path                  | Description                         |
|--------|-----------------------|-------------------------------------|
| POST   | /auth/telegram        | Verify TG widget data → session token |
| GET    | /me                   | Current user profile + balance      |

### Solver (X-Session-Token)
| Method | Path                  | Description                         |
|--------|-----------------------|-------------------------------------|
| GET    | /solver/task          | Fetch next queued CAPTCHA            |
| POST   | /solver/solve         | Submit answer → earn sats           |
| GET    | /solver/history       | Past task history                   |
| POST   | /deposit              | Create BTCPay Lightning invoice     |
| GET    | /deposit/status       | Poll invoice payment status         |

### Buyer API (X-API-Key)
| Method | Path                  | Description                         |
|--------|-----------------------|-------------------------------------|
| POST   | /register             | Create buyer account + API key      |
| POST   | /submit               | Submit CAPTCHA task                 |
| GET    | /result/:id           | Poll for solution                   |
| GET    | /balance              | Check sats balance + tier           |
| POST   | /buyer/deposit        | Top up balance via Lightning        |

### Webhooks
| Method | Path                  | Description                         |
|--------|-----------------------|-------------------------------------|
| POST   | /btcpay/webhook       | BTCPay payment settled → credit     |

## Cloudflare Resources

| Resource   | Name / ID                                  |
|------------|--------------------------------------------|
| D1         | `satsday` · `22b17f35-6fb6-4227-93db-fc89b216635a` |
| KV         | `satsday-kv` · `cb6b1e0095604bdb9324057bc127c964`  |
| Account    | Cey Lounge · `82c5ee4b5bf756e6658c8d9807d21592`    |

## Setup

```bash
npm install

# Set secrets (run once after first deploy)
wrangler secret put TG_BOT_TOKEN
wrangler secret put BTCPAY_URL
wrangler secret put BTCPAY_API_KEY
wrangler secret put BTCPAY_STORE_ID

# Deploy
npm run deploy
```

## Custom domain

After first deploy, add `api.sats.day` as a custom domain in:
Cloudflare Dashboard → Workers & Pages → satsday-api-be → Settings → Domains & Routes

## BTCPay Webhook

Configure in BTCPay: Store → Webhooks → Add webhook
- URL: `https://api.sats.day/btcpay/webhook`
- Events: `InvoiceSettled`, `InvoicePaymentSettled`

## BotFather setup

```
/setdomain → sats.day
```
Required for Telegram Login Widget to work on the frontend.

## Related

- Frontend: [satsday-web-fe](https://github.com/CeyLabs/satsday-web-fe)
- Telegram bot: [@SatsDayBot](https://t.me/bitcoindeepabot)
