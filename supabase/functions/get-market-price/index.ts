import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_CACHE_TTL_SECONDS = 60

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { symbol } = await req.json()
        console.log(`[Diagnostic] Incoming request for symbol: ${symbol}`)

        if (!symbol) {
            console.error(`[Diagnostic] Missing symbol in request body`)
            return new Response(JSON.stringify({ status: "error", message: "Symbol is required" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseKey) {
            console.error(`[Diagnostic] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`)
        }

        const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '')

        // 1. Check market_cache
        console.log(`[Diagnostic] Checking market_cache for ${symbol}`)
        const { data: cachedData, error: cacheLookupError } = await supabase
            .from('market_cache')
            .select('*')
            .eq('symbol', symbol)
            .maybeSingle()

        if (cacheLookupError) {
            console.error(`[Diagnostic] Cache lookup error:`, cacheLookupError)
        }

        const now = new Date()

        // 2. Logic: If cache exists AND is fresh, return cached price
        const cacheTtlSecondsRaw = Deno.env.get('MARKET_CACHE_TTL_SECONDS')
        const cacheTtlSeconds = Number.parseInt(cacheTtlSecondsRaw ?? `${DEFAULT_CACHE_TTL_SECONDS}`, 10)
        const effectiveTtl = Number.isFinite(cacheTtlSeconds) && cacheTtlSeconds > 0
            ? cacheTtlSeconds
            : DEFAULT_CACHE_TTL_SECONDS

        if (cachedData) {
            const updatedAt = new Date(cachedData.updated_at)
            const diffSeconds = (now.getTime() - updatedAt.getTime()) / 1000
            console.log(`[Diagnostic] Found cache for ${symbol}. Age: ${diffSeconds.toFixed(2)}s`)

            if (diffSeconds < effectiveTtl) {
                console.log(`[Diagnostic] Returning fresh cached price for ${symbol}: ${cachedData.price}`)
                return new Response(JSON.stringify({
                    success: true,
                    symbol,
                    price: cachedData.price,
                    source: cachedData.source,
                    isDelayed: false,
                    previousClose: null,
                    change: null,
                    changePercent: null,
                    timestamp: now.toISOString()
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                })
            }
        }

        // 3. Stale or None -> Try configured provider chain
        try {
            console.log(`[Diagnostic] Resolving provider chain for ${symbol}`)
            const quote = await fetchFromProviders(symbol)
            const newPrice = quote.price
            console.log(`[Diagnostic] ${quote.source} returned price for ${symbol}: ${newPrice}`)

            // 4. Update cache (upsert)
            console.log(`[Diagnostic] Attempting upsert into market_cache for ${symbol}`)
            const { data: upsertData, error: upsertError } = await supabase
                .from('market_cache')
                .upsert({
                    symbol: symbol,
                    price: newPrice,
                    source: quote.source,
                    updated_at: now.toISOString()
                })
                .select()

            if (upsertError) {
                console.error(`[Diagnostic] Upsert FAILED for ${symbol}:`, upsertError)
            } else {
                console.log(`[Diagnostic] Upsert SUCCESSFUL for ${symbol}. Data:`, upsertData)
            }

            return new Response(JSON.stringify({
                success: true,
                symbol,
                price: newPrice,
                source: quote.source,
                isDelayed: false,
                previousClose: quote.previousClose,
                change: quote.change,
                changePercent: quote.changePercent,
                timestamp: now.toISOString()
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            })
        } catch (providerError) {
            console.error(`[Diagnostic] Provider Flow Error for ${symbol}:`, providerError.message)

            // 5. Providers fail -> Return stale cache if exists
            if (cachedData) {
                console.log(`[Diagnostic] Falling back to stale cache for ${symbol}`)
                return new Response(JSON.stringify({
                    success: true,
                    symbol,
                    price: cachedData.price,
                    source: "cache",
                    isDelayed: true,
                    previousClose: null,
                    change: null,
                    changePercent: null,
                    timestamp: now.toISOString()
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                })
            }

            // 6. No cache AND providers fail
            console.warn(`[Diagnostic] No data available for ${symbol}. Returning market_delayed.`)
            return new Response(JSON.stringify({
                success: false,
                symbol,
                status: "market_delayed",
                message: providerError.message,
                timestamp: now.toISOString()
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            })
        }

    } catch (error) {
        console.error(`[Diagnostic] Global Error:`, error.message)
        return new Response(JSON.stringify({ status: "error", message: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200, // Returning 200 with error status as per request
        })
    }
})

type YahooQuote = {
    price: number
    previousClose: number | null
    change: number | null
    changePercent: number | null
    source: "yahoo" | "kite"
}

function getProviderOrder(symbol: string): Array<"kite" | "yahoo"> {
    // Index symbols (e.g. ^NSEI, ^BSESN) stay on Yahoo path.
    if (String(symbol || '').trim().startsWith('^')) {
        return ['yahoo']
    }

    const provider = (Deno.env.get('INDIA_API_PROVIDER') ?? 'yahoo').trim().toLowerCase()
    if (provider === 'kite') return ['kite', 'yahoo']
    if (provider === 'auto') return ['kite', 'yahoo']
    if (provider === 'yahoo') return ['yahoo']
    return ['yahoo']
}

async function fetchFromProviders(symbol: string): Promise<YahooQuote> {
    const order = getProviderOrder(symbol)
    const errors: string[] = []

    for (const provider of order) {
        try {
            if (provider === 'kite') {
                return await fetchKite(symbol)
            }
            if (provider === 'yahoo') {
                return await fetchYahoo(symbol)
            }
        } catch (error: any) {
            const message = error?.message ?? String(error)
            errors.push(`${provider}: ${message}`)
            console.warn(`[Diagnostic] Provider ${provider} failed for ${symbol}: ${message}`)
        }
    }

    throw new Error(errors.length ? errors.join(' | ') : `No provider configured for ${symbol}`)
}

function toKiteInstrument(symbol: string): string | null {
    const raw = String(symbol || '').trim().toUpperCase()
    if (!raw) return null
    if (raw.startsWith('^')) return null

    if (raw.includes(':')) {
        const [exchange, ...rest] = raw.split(':')
        const tradingSymbol = rest.join(':').trim()
        if (!tradingSymbol) return null
        if (exchange === 'NSE' || exchange === 'BSE') {
            return `${exchange}:${tradingSymbol}`
        }
        return null
    }

    if (raw.endsWith('.NS')) {
        const base = raw.slice(0, -3)
        return base ? `NSE:${base}` : null
    }

    if (raw.endsWith('.BO')) {
        const base = raw.slice(0, -3)
        return base ? `BSE:${base}` : null
    }

    if (/^[A-Z0-9.&_-]+$/.test(raw)) {
        return `NSE:${raw}`
    }

    return null
}

async function fetchKite(symbol: string): Promise<YahooQuote> {
    const apiKey = Deno.env.get('KITE_API_KEY')
    const accessToken = Deno.env.get('KITE_ACCESS_TOKEN')
    if (!apiKey || !accessToken) {
        throw new Error('Missing KITE_API_KEY or KITE_ACCESS_TOKEN')
    }

    const instrument = toKiteInstrument(symbol)
    if (!instrument) {
        throw new Error(`Symbol is not a Kite-compatible NSE/BSE instrument: ${symbol}`)
    }

    const params = new URLSearchParams()
    params.append('i', instrument)
    const url = `https://api.kite.trade/quote?${params.toString()}`
    const response = await fetch(url, {
        headers: {
            'X-Kite-Version': '3',
            'Authorization': `token ${apiKey}:${accessToken}`,
            'User-Agent': 'avendus-market-edge/1.0',
        }
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Kite API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const json = await response.json()
    const entry = json?.data?.[instrument]
    const price = entry?.last_price

    if (typeof price !== 'number') {
        throw new Error(`Invalid price data in Kite response for ${symbol}`)
    }

    const previousCloseRaw = entry?.ohlc?.close
    const previousClose = (typeof previousCloseRaw === 'number' && previousCloseRaw > 0) ? previousCloseRaw : null
    const change = previousClose ? (price - previousClose) : null
    const changePercent = previousClose ? ((change! / previousClose) * 100) : null

    return {
        price,
        previousClose,
        change,
        changePercent,
        source: 'kite'
    }
}

async function fetchYahoo(symbol: string): Promise<YahooQuote> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
        }
    })

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Yahoo API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const json = await response.json()
    const meta = json?.chart?.result?.[0]?.meta
    const price = meta?.regularMarketPrice

    if (price === undefined || price === null) {
        throw new Error(`Invalid price data in Yahoo response for ${symbol}`)
    }

    const previousCloseRaw = meta?.previousClose
    const previousClose = (typeof previousCloseRaw === 'number' && previousCloseRaw > 0) ? previousCloseRaw : null
    const change = previousClose ? (price - previousClose) : null
    const changePercent = previousClose ? ((change! / previousClose) * 100) : null

    return {
        price,
        previousClose,
        change,
        changePercent,
        source: 'yahoo'
    }
}
