import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote as urlquote

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
from yfinance.exceptions import YFRateLimitError

app = FastAPI(title="India Market API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Local in-memory cache to reduce upstream request frequency.
QUOTE_CACHE: Dict[str, Dict[str, Any]] = {}
KLINE_CACHE: Dict[str, Dict[str, Any]] = {}
QUOTE_TTL_SECONDS = 20
KLINE_TTL_SECONDS = 60
RATE_LIMIT_BLOCK_SECONDS = 120
HTTP_TIMEOUT_SECONDS = 25
_rate_limited_until: Optional[datetime] = None
INDEX_SYMBOL_TO_NSE_NAME = {
    "^NSESMCP100": "NIFTY SMALLCAP 100",
    "^NSEMDCP100": "NIFTY MIDCAP 100",
    "^NSEI": "NIFTY 50",
    "^NSEBANK": "NIFTY BANK",
    "^INDIAVIX": "INDIA VIX",
}


@app.get("/")
def root():
    return {
        "success": True,
        "message": "India Market API is running",
        "docs": "/docs",
        "quote_example": "/quote?symbol=RELIANCE.NS",
        "kline_example": "/kline?symbol=RELIANCE.NS&period=1d&interval=5m",
    }


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def is_rate_limited() -> bool:
    return _rate_limited_until is not None and now_utc() < _rate_limited_until


def set_rate_limited() -> None:
    global _rate_limited_until
    _rate_limited_until = now_utc() + timedelta(seconds=RATE_LIMIT_BLOCK_SECONDS)


def cache_get(
    store: Dict[str, Dict[str, Any]],
    key: str,
    ttl_seconds: int
) -> Tuple[Optional[Dict[str, Any]], bool]:
    payload = store.get(key)
    if not payload:
        return None, False

    ts = payload.get("_ts")
    if not isinstance(ts, datetime):
        return payload, False

    is_fresh = (now_utc() - ts).total_seconds() <= ttl_seconds
    return payload, is_fresh


def cache_set(store: Dict[str, Dict[str, Any]], key: str, data: Dict[str, Any]) -> None:
    store[key] = {**data, "_ts": now_utc()}


def strip_meta(data: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in data.items() if k != "_ts"}


def norm_symbol(symbol: str) -> str:
    s = symbol.strip().upper()
    if s.lower() == "symbol":
        raise HTTPException(status_code=400, detail="symbol must be a real ticker, e.g. RELIANCE.NS")
    if s.startswith("NSE:"):
        return s.split(":", 1)[1] + ".NS"
    if s.startswith("BSE:"):
        return s.split(":", 1)[1] + ".BO"
    if s.endswith(".NS") or s.endswith(".BO") or s.startswith("^"):
        return s
    return s + ".NS"


def fetch_history_with_retry(ticker: yf.Ticker, period: str, interval: str):
    retries = 2
    for i in range(retries + 1):
        try:
            return ticker.history(period=period, interval=interval, auto_adjust=False, prepost=False)
        except YFRateLimitError:
            if i == retries:
                raise
            time.sleep(1.5 * (i + 1))


def is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def to_float(v: Any) -> Optional[float]:
    if is_number(v):
        return float(v)
    try:
        if isinstance(v, str) and v.strip() != "":
            return float(v.replace(",", ""))
    except Exception:
        pass
    return None


def to_nse_core_symbol(ysym: str) -> Optional[str]:
    s = (ysym or "").upper().strip()
    if s.startswith("^"):
        return None
    if s.endswith(".NS"):
        return s[:-3]
    if s.endswith(".BO"):
        return None
    return s


def fetch_quote_from_nse(ysym: str) -> Dict[str, Any]:
    core = to_nse_core_symbol(ysym)
    if not core:
        raise ValueError(f"NSE quote fallback not applicable for {ysym}")

    session = requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.nseindia.com/",
        "X-Requested-With": "XMLHttpRequest",
    }
    url = f"https://www.nseindia.com/api/quote-equity?symbol={urlquote(core)}"
    resp = session.get(url, headers=headers, timeout=HTTP_TIMEOUT_SECONDS)
    if resp.status_code != 200:
        raise ValueError(f"NSE quote fallback failed: {resp.status_code}")

    obj = resp.json()
    p = obj.get("priceInfo") or {}
    price = to_float(p.get("lastPrice"))
    prev_close = to_float(p.get("previousClose"))
    change = to_float(p.get("change"))
    change_pct = to_float(p.get("pChange"))

    if price is None:
        raise ValueError(f"NSE quote fallback missing price for {ysym}")

    if change is None and prev_close:
        change = price - prev_close
    if change_pct is None and prev_close and change is not None and prev_close != 0:
        change_pct = (change / prev_close) * 100

    return {
        "success": True,
        "symbol": ysym,
        "price": price,
        "previousClose": prev_close,
        "change": change,
        "changePercent": change_pct,
        "source": "nse",
    }


def fetch_index_quote_from_nse(index_name: str, ysym: str) -> Dict[str, Any]:
    session = requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.nseindia.com/",
        "X-Requested-With": "XMLHttpRequest",
    }

    # Warm up cookies for NSE anti-bot checks.
    try:
        session.get("https://www.nseindia.com", headers=headers, timeout=HTTP_TIMEOUT_SECONDS)
    except Exception:
        pass

    url = f"https://www.nseindia.com/api/equity-stockIndices?index={urlquote(index_name)}"
    resp = session.get(url, headers=headers, timeout=HTTP_TIMEOUT_SECONDS)
    if resp.status_code != 200:
        raise ValueError(f"NSE index quote fallback failed: {resp.status_code}")

    obj = resp.json()
    rows = obj.get("data") or []
    if not rows:
        raise ValueError(f"NSE index quote fallback empty data for {index_name}")

    row = rows[0]
    price = to_float(row.get("lastPrice"))
    prev_close = to_float(row.get("previousClose"))
    change = to_float(row.get("change"))
    change_pct = to_float(row.get("pChange"))

    if price is None:
        raise ValueError(f"NSE index quote fallback missing price for {index_name}")

    if change is None and prev_close is not None:
        change = price - prev_close
    if change_pct is None and prev_close and change is not None and prev_close != 0:
        change_pct = (change / prev_close) * 100

    return {
        "success": True,
        "symbol": ysym,
        "price": price,
        "previousClose": prev_close,
        "change": change,
        "changePercent": change_pct,
        "source": "nse_index",
    }


def fetch_yahoo_chart_via_jina(ysym: str, interval: str, range_: str) -> Dict[str, Any]:
    target = (
        f"http://query1.finance.yahoo.com/v8/finance/chart/"
        f"{urlquote(ysym)}?interval={urlquote(interval)}&range={urlquote(range_)}"
    )
    proxy_url = f"https://r.jina.ai/{target}"
    resp = requests.get(
        proxy_url,
        timeout=HTTP_TIMEOUT_SECONDS,
        headers={"User-Agent": "Mozilla/5.0"}
    )
    if resp.status_code != 200:
        raise ValueError(f"jina proxy failed: {resp.status_code}")

    text = resp.text
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("jina proxy response does not contain JSON payload")

    obj = json.loads(text[start:end + 1])
    result = ((obj.get("chart") or {}).get("result") or [None])[0]
    if not result:
        err = (obj.get("chart") or {}).get("error")
        raise ValueError(f"jina proxy chart missing result: {err}")
    return result


def quote_payload_from_chart_result(ysym: str, result: Dict[str, Any]) -> Dict[str, Any]:
    meta = result.get("meta") or {}
    price = to_float(meta.get("regularMarketPrice"))
    prev_close = to_float(meta.get("previousClose")) or to_float(meta.get("chartPreviousClose"))

    q = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    closes = q.get("close") or []
    if price is None:
        non_null = [to_float(v) for v in closes if v is not None]
        non_null = [v for v in non_null if v is not None]
        if non_null:
            price = non_null[-1]

    if price is None:
        raise ValueError(f"jina fallback missing price for {ysym}")

    change = (price - prev_close) if prev_close else None
    change_pct = ((change / prev_close) * 100) if (prev_close and change is not None and prev_close != 0) else None

    return {
        "success": True,
        "symbol": ysym,
        "price": price,
        "previousClose": prev_close,
        "change": change,
        "changePercent": change_pct,
        "source": "yahoo_jina_proxy",
    }


def kline_payload_from_chart_result(
    ysym: str,
    period: str,
    interval: str,
    result: Dict[str, Any]
) -> Dict[str, Any]:
    q = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    ts = result.get("timestamp") or []
    opens = q.get("open") or []
    highs = q.get("high") or []
    lows = q.get("low") or []
    closes = q.get("close") or []
    vols = q.get("volume") or []

    length = min(len(ts), len(opens), len(highs), len(lows), len(closes), len(vols))
    out = []
    for i in range(length):
        tsv = ts[i]
        o = to_float(opens[i])
        h = to_float(highs[i])
        l = to_float(lows[i])
        c = to_float(closes[i])
        v = to_float(vols[i]) or 0.0
        if not is_number(tsv) or o is None or h is None or l is None or c is None:
            continue

        out.append({
            "t": datetime.fromtimestamp(int(tsv), tz=timezone.utc).isoformat(),
            "o": o,
            "h": h,
            "l": l,
            "c": c,
            "v": v,
        })

    if not out:
        raise ValueError(f"jina fallback returned empty kline for {ysym}")

    return {
        "success": True,
        "symbol": ysym,
        "period": period,
        "interval": interval,
        "data": out,
        "source": "yahoo_jina_proxy",
    }


def fetch_quote_from_yfinance(ysym: str) -> Dict[str, Any]:
    t = yf.Ticker(ysym)

    # 1m data gets rate-limited faster. 5m is more stable.
    m1 = fetch_history_with_retry(t, period="2d", interval="5m")
    if m1.empty:
        raise HTTPException(status_code=404, detail=f"No market data for {ysym}")

    close_series = m1["Close"].dropna()
    if close_series.empty:
        raise HTTPException(status_code=404, detail=f"No close price for {ysym}")
    price = float(close_series.iloc[-1])

    prev_close = None
    try:
        fi = getattr(t, "fast_info", {}) or {}
        prev_close = fi.get("previous_close")
        prev_close = float(prev_close) if prev_close else None
    except Exception:
        pass

    if not prev_close:
        d1 = fetch_history_with_retry(t, period="7d", interval="1d")
        dclose = d1["Close"].dropna()
        if len(dclose) >= 2:
            prev_close = float(dclose.iloc[-2])

    change = (price - prev_close) if prev_close else None
    change_pct = ((change / prev_close) * 100) if (prev_close and change is not None and prev_close != 0) else None

    return {
        "success": True,
        "symbol": ysym,
        "price": price,
        "previousClose": prev_close,
        "change": change,
        "changePercent": change_pct,
        "source": "yfinance",
    }


def fetch_kline_from_yfinance(ysym: str, period: str, interval: str) -> Dict[str, Any]:
    df = fetch_history_with_retry(yf.Ticker(ysym), period=period, interval=interval)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No kline for {ysym}")

    out = []
    for idx, row in df.iterrows():
        out.append({
            "t": idx.isoformat(),
            "o": float(row["Open"]),
            "h": float(row["High"]),
            "l": float(row["Low"]),
            "c": float(row["Close"]),
            "v": float(row["Volume"]),
        })

    return {
        "success": True,
        "symbol": ysym,
        "period": period,
        "interval": interval,
        "data": out,
        "source": "yfinance",
    }


@app.get("/quote")
def quote(symbol: str = Query(...)):
    ysym = norm_symbol(symbol)
    cache_key = ysym
    cached_quote, fresh_quote = cache_get(QUOTE_CACHE, cache_key, QUOTE_TTL_SECONDS)

    if cached_quote and fresh_quote:
        out = strip_meta(cached_quote)
        out["cache"] = "hit"
        return out

    errors = []

    # Fast path for index symbols that are unreliable on Yahoo.
    index_name = INDEX_SYMBOL_TO_NSE_NAME.get(ysym.upper())
    if index_name:
        try:
            payload = fetch_index_quote_from_nse(index_name, ysym)
            payload["cache"] = "miss"
            cache_set(QUOTE_CACHE, cache_key, payload)
            return payload
        except Exception as e:
            errors.append(f"nse_index: {e}")

    # Primary: yfinance (unless currently blocked window is active)
    if not is_rate_limited():
        try:
            payload = fetch_quote_from_yfinance(ysym)
            payload["cache"] = "miss"
            cache_set(QUOTE_CACHE, cache_key, payload)
            return payload
        except YFRateLimitError:
            set_rate_limited()
            errors.append("yfinance: rate limited")
        except HTTPException:
            raise
        except Exception as e:
            errors.append(f"yfinance: {e}")
    else:
        errors.append("yfinance: skipped (temporary block window)")

    # Fallback 1: NSE quote API for NSE symbols.
    try:
        payload = fetch_quote_from_nse(ysym)
        payload["cache"] = "miss"
        cache_set(QUOTE_CACHE, cache_key, payload)
        return payload
    except Exception as e:
        errors.append(f"nse: {e}")

    # Fallback 2: Yahoo chart via jina proxy.
    try:
        result = fetch_yahoo_chart_via_jina(ysym, interval="5m", range_="1d")
        payload = quote_payload_from_chart_result(ysym, result)
        payload["cache"] = "miss"
        cache_set(QUOTE_CACHE, cache_key, payload)
        return payload
    except Exception as e:
        errors.append(f"jina: {e}")

    if cached_quote:
        out = strip_meta(cached_quote)
        out["cache"] = "stale_fallback"
        out["isDelayed"] = True
        out["warning"] = "Upstream providers failed; returning stale cached quote."
        out["providerErrors"] = errors
        return out

    raise HTTPException(status_code=429, detail=f"All quote providers failed. {errors}")


@app.get("/kline")
def kline(
    symbol: str = Query(...),
    period: str = Query("1d"),      # 1d,5d,1mo,3mo...
    interval: str = Query("5m")     # 1m,5m,15m,1h,1d...
):
    ysym = norm_symbol(symbol)
    cache_key = f"{ysym}|{period}|{interval}"
    cached_kline, fresh_kline = cache_get(KLINE_CACHE, cache_key, KLINE_TTL_SECONDS)

    if cached_kline and fresh_kline:
        out = strip_meta(cached_kline)
        out["cache"] = "hit"
        return out

    errors = []

    # Primary: yfinance (unless currently blocked window is active)
    if not is_rate_limited():
        try:
            payload = fetch_kline_from_yfinance(ysym, period=period, interval=interval)
            payload["cache"] = "miss"
            cache_set(KLINE_CACHE, cache_key, payload)
            return payload
        except YFRateLimitError:
            set_rate_limited()
            errors.append("yfinance: rate limited")
        except HTTPException:
            raise
        except Exception as e:
            errors.append(f"yfinance: {e}")
    else:
        errors.append("yfinance: skipped (temporary block window)")

    # Fallback: Yahoo chart via jina proxy.
    try:
        result = fetch_yahoo_chart_via_jina(ysym, interval=interval, range_=period)
        payload = kline_payload_from_chart_result(ysym, period=period, interval=interval, result=result)
        payload["cache"] = "miss"
        cache_set(KLINE_CACHE, cache_key, payload)
        return payload
    except Exception as e:
        errors.append(f"jina: {e}")

    if cached_kline:
        out = strip_meta(cached_kline)
        out["cache"] = "stale_fallback"
        out["isDelayed"] = True
        out["warning"] = "Upstream providers failed; returning stale cached kline."
        out["providerErrors"] = errors
        return out

    raise HTTPException(status_code=429, detail=f"All kline providers failed. {errors}")
