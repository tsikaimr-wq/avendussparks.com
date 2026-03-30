# StockTV Proxy (Cloudflare Worker)

This Worker proxies market-data upstreams so the frontend never exposes vendor keys.

## Setup

```bash
cd d:/work/AvendusCapital-main/stocktv-worker
npm install
npx wrangler secret put STOCKTV_KEY
npx wrangler secret put INFOWAY_API_KEY
```

Optional:
```bash
npx wrangler secret put STOCKTV_COUNTRY_ID   # default 14
npx wrangler secret put STOCKTV_EXCHANGE_ID  # default 46
npx wrangler secret put STOCKTV_MAX_PAGES    # default 5
```

`INFOWAY_API_KEY` is used as a fallback for:

- US stocks / ETFs like `NSEP`
- India stocks via `*.IN` resolution inside the Worker
- fundamentals fallback when Yahoo fails

Deploy:
```bash
npx wrangler deploy
```

## Endpoints

- `/quote?symbol=RELIANCE.NS`
- `/kline?symbol=RELIANCE.NS&interval=P1D`

You can also pass `pid` if you already have it:
- `/quote?pid=12345`
- `/kline?pid=12345&interval=P1D`
