import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ALLOWED_INTERVALS = new Set([
    "1m", "2m", "5m", "15m", "30m", "60m", "90m", "1d", "1wk", "1mo", "3mo"
])

function normalizeSymbol(raw: string): string {
    const s = String(raw || "").trim().toUpperCase()
    if (!s) return ""
    if (s.startsWith("^")) return s
    if (s.includes(":")) {
        const [exchange, ...rest] = s.split(":")
        const code = rest.join(":").trim().replace(/\.(NS|BO)$/i, "")
        if (!code) return ""
        return exchange === "BSE" ? `${code}.BO` : `${code}.NS`
    }
    if (s.endsWith(".NS") || s.endsWith(".BO")) return s
    return `${s}.NS`
}

function toRange(period: string): string {
    const p = String(period || "1d").toLowerCase()
    if (["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"].includes(p)) return p
    return "1d"
}

function toInterval(interval: string): string {
    const i = String(interval || "5m").toLowerCase()
    return ALLOWED_INTERVALS.has(i) ? i : "5m"
}

function intervalStepSeconds(interval: string): number {
    const i = toInterval(interval)
    if (i === "1m") return 60
    if (i === "2m") return 120
    if (i === "5m") return 300
    if (i === "15m") return 900
    if (i === "30m") return 1800
    if (i === "60m") return 3600
    if (i === "90m") return 5400
    if (i === "1d") return 86400
    if (i === "1wk") return 604800
    if (i === "1mo") return 2592000
    if (i === "3mo") return 7776000
    return 300
}

type Candle = {
    t: string
    o: number
    h: number
    l: number
    c: number
    v: number
}

async function fetchYahooKline(symbol: string, range: string, interval: string): Promise<Candle[]> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false&events=div%2Csplit`
    const response = await fetch(url, { headers: { "User-Agent": "avendus-edge-kline/1.0" } })
    if (!response.ok) {
        const text = await response.text()
        throw new Error(`Yahoo chart error ${response.status}: ${text}`)
    }

    const json = await response.json()
    const result = json?.chart?.result?.[0]
    const tsList = Array.isArray(result?.timestamp) ? result.timestamp : []
    const quote = result?.indicators?.quote?.[0] || {}
    const opens = Array.isArray(quote?.open) ? quote.open : []
    const highs = Array.isArray(quote?.high) ? quote.high : []
    const lows = Array.isArray(quote?.low) ? quote.low : []
    const closes = Array.isArray(quote?.close) ? quote.close : []
    const volumes = Array.isArray(quote?.volume) ? quote.volume : []

    const candles: Candle[] = []
    for (let i = 0; i < tsList.length; i++) {
        const ts = Number(tsList[i])
        const c = Number(closes[i])
        if (!Number.isFinite(ts) || !Number.isFinite(c)) continue

        const oRaw = Number(opens[i])
        const hRaw = Number(highs[i])
        const lRaw = Number(lows[i])
        const o = Number.isFinite(oRaw) ? oRaw : c
        const h = Number.isFinite(hRaw) ? hRaw : Math.max(o, c)
        const l = Number.isFinite(lRaw) ? lRaw : Math.min(o, c)
        const vRaw = Number(volumes[i])
        const v = Number.isFinite(vRaw) ? vRaw : 0

        candles.push({
            t: new Date(ts * 1000).toISOString(),
            o,
            h,
            l,
            c,
            v,
        })
    }

    return candles
}

function buildSyntheticBars(price: number, interval: string, points = 120): Candle[] {
    const seed = Number.isFinite(price) && price > 0 ? price : 100
    const step = intervalStepSeconds(interval)
    const now = Math.floor(Date.now() / 1000)
    const start = now - (points - 1) * step

    const out: Candle[] = []
    let lastClose = seed
    for (let i = 0; i < points; i++) {
        const t = start + i * step
        const drift = (Math.random() - 0.5) * 0.004
        const o = lastClose
        const c = Math.max(0.01, o * (1 + drift))
        const high = Math.max(o, c) * (1 + Math.random() * 0.0015)
        const low = Math.min(o, c) * (1 - Math.random() * 0.0015)
        out.push({
            t: new Date(t * 1000).toISOString(),
            o,
            h: high,
            l: low,
            c,
            v: Math.floor(1000 + Math.random() * 3000),
        })
        lastClose = c
    }
    return out
}

async function fetchFallbackPrice(symbol: string, supabaseUrl?: string, serviceRoleKey?: string): Promise<number | null> {
    if (supabaseUrl && serviceRoleKey) {
        try {
            const response = await fetch(`${supabaseUrl}/functions/v1/get-market-price`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${serviceRoleKey}`,
                    "apikey": serviceRoleKey,
                },
                body: JSON.stringify({ symbol }),
            })
            if (response.ok) {
                const json = await response.json()
                const price = Number(json?.price)
                if (Number.isFinite(price) && price > 0) return price
            }
        } catch (_) { }
    }

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
        const response = await fetch(url, { headers: { "User-Agent": "avendus-edge-kline/1.0" } })
        if (response.ok) {
            const json = await response.json()
            const price = Number(json?.chart?.result?.[0]?.meta?.regularMarketPrice)
            if (Number.isFinite(price) && price > 0) return price
        }
    } catch (_) { }

    return null
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    try {
        const reqUrl = new URL(req.url)
        let symbol = reqUrl.searchParams.get("symbol") || ""
        let period = reqUrl.searchParams.get("period") || "1d"
        let interval = reqUrl.searchParams.get("interval") || "5m"

        if (req.method === "POST") {
            const body = await req.json().catch(() => ({}))
            symbol = body?.symbol || symbol
            period = body?.period || period
            interval = body?.interval || interval
        }

        const normalized = normalizeSymbol(symbol)
        if (!normalized) {
            return new Response(JSON.stringify({ success: false, message: "symbol is required" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            })
        }

        const range = toRange(period)
        const safeInterval = toInterval(interval)

        try {
            const candles = await fetchYahooKline(normalized, range, safeInterval)
            if (candles.length > 0) {
                return new Response(JSON.stringify({
                    success: true,
                    symbol: normalized,
                    period: range,
                    interval: safeInterval,
                    source: "yahoo",
                    data: candles,
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                })
            }
        } catch (e: any) {
            console.warn(`get-market-kline yahoo error for ${normalized}:`, e?.message ?? String(e))
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        const fallbackPrice = await fetchFallbackPrice(normalized, supabaseUrl ?? undefined, serviceRoleKey ?? undefined)

        if (Number.isFinite(fallbackPrice) && (fallbackPrice as number) > 0) {
            const synthetic = buildSyntheticBars(fallbackPrice as number, safeInterval)
            return new Response(JSON.stringify({
                success: true,
                symbol: normalized,
                period: range,
                interval: safeInterval,
                source: "synthetic_fallback",
                delayed: true,
                data: synthetic,
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            })
        }

        // Final fallback from market_cache (if available).
        if (supabaseUrl && serviceRoleKey) {
            const supabase = createClient(supabaseUrl, serviceRoleKey)
            const { data } = await supabase
                .from("market_cache")
                .select("price")
                .eq("symbol", normalized)
                .maybeSingle()
            const cachePrice = Number(data?.price)
            if (Number.isFinite(cachePrice) && cachePrice > 0) {
                const synthetic = buildSyntheticBars(cachePrice, safeInterval)
                return new Response(JSON.stringify({
                    success: true,
                    symbol: normalized,
                    period: range,
                    interval: safeInterval,
                    source: "market_cache_fallback",
                    delayed: true,
                    data: synthetic,
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                })
            }
        }

        return new Response(JSON.stringify({
            success: false,
            symbol: normalized,
            message: "kline unavailable",
            data: [],
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        })
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            message: error?.message ?? String(error),
            data: [],
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        })
    }
})

