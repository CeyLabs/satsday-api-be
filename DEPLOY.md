# sats.day — Deployment Runbook

## Prerequisites confirmed
- [x] sats.day on Cloudflare nameservers (henry.ns + gail.ns)
- [x] D1 database `satsday` provisioned (ID: 22b17f35) — APAC/SIN
- [x] KV namespace `satsday-kv` provisioned (ID: cb6b1e0095604bdb)
- [x] Schema live: users, buyers, tasks, payments, ledger
- [x] Code pushed to CeyLabs/satsday-web-fe and CeyLabs/satsday-api-be

---

## Step 1 — Get a Cloudflare API token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use template: **Edit Cloudflare Workers**
4. Add permissions:
   - `Account > Cloudflare Pages > Edit`
   - `Account > Workers Scripts > Edit`
   - `Zone > DNS > Edit` (select zone: sats.day)
5. Copy the token — you'll need it in Step 2

---

## Step 2 — Add GitHub secrets to both repos

### CeyLabs/satsday-web-fe
https://github.com/CeyLabs/satsday-web-fe/settings/secrets/actions

| Secret                  | Value                               |
|-------------------------|-------------------------------------|
| `CLOUDFLARE_API_TOKEN`  | Token from Step 1                   |
| `CLOUDFLARE_ACCOUNT_ID` | `82c5ee4b5bf756e6658c8d9807d21592`  |

### CeyLabs/satsday-api-be
https://github.com/CeyLabs/satsday-api-be/settings/secrets/actions

| Secret                  | Value                               |
|-------------------------|-------------------------------------|
| `CLOUDFLARE_API_TOKEN`  | Token from Step 1                   |
| `CLOUDFLARE_ACCOUNT_ID` | `82c5ee4b5bf756e6658c8d9807d21592`  |
| `TG_BOT_TOKEN`          | @bitcoindeepabot token from BotFather |
| `BTCPAY_URL`            | https://your.btcpay.server          |
| `BTCPAY_API_KEY`        | BTCPay store API key                |
| `BTCPAY_STORE_ID`       | BTCPay store ID                     |

Once secrets are added → push any commit to `main` → GitHub Actions auto-deploys both.

---

## Step 3 — Create Cloudflare Queues (one-time, run locally)

```bash
cd satsday-api-be
npm install
wrangler login   # or set CLOUDFLARE_API_TOKEN in env
wrangler queues create satsday-tasks
```

---

## Step 4 — Set up custom domain for the Worker API

1. CF Dashboard → Workers & Pages → `satsday-api-be`
2. Settings → Triggers → Custom Domains
3. Add domain: `api.sats.day`
4. CF auto-creates a CNAME in the sats.day zone

---

## Step 5 — Set up sats.day → CF Pages

1. CF Dashboard → Workers & Pages → `satsday-web-fe`
2. Custom Domains → Set up a domain
3. Add: `sats.day`
4. Add: `www.sats.day`
5. CF auto-creates CNAME records — activates in ~1 minute

---

## Step 6 — BTCPay Server webhook

In BTCPay Server:
1. Store Settings → Webhooks → Create Webhook
2. Payload URL: `https://api.sats.day/btcpay/webhook`
3. Secret: same value as `BTCPAY_API_KEY` secret
4. Events: check **Invoice Settled** and **Invoice Payment Settled**
5. Save

---

## Step 7 — BotFather: set domain for Telegram Login Widget

```
/setdomain
→ select @bitcoindeepabot
→ enter: sats.day
```

This allows the Telegram Login Widget on app/index.html to authenticate users.

---

## Step 8 — Verify

```bash
# API health
curl https://api.sats.day/me

# Should return: {"error":"unauthorized"}  (401 — API is live)

# Frontend
curl -I https://sats.day
# Should return: 200 OK
```

---

## Architecture recap

```
sats.day             → CF Pages (satsday-web-fe)
sats.day/app/        → Solver app (TG login + CAPTCHA queue + BTCPay)
api.sats.day         → CF Workers (satsday-api-be)
api.sats.day/btcpay/webhook  → payment settled → credit balance
```
