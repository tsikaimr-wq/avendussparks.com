import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PriceQuote = {
    price: number;
    source: "yahoo" | "kite";
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { product } = await req.json();
        const symbol = product?.market_symbol || product?.symbol;

        if (!symbol) {
            return new Response(
                JSON.stringify({ error: "Product symbol is required" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const quote = await fetchFromProviders(symbol);
        const livePrice = quote.price;

        const { error: productError } = await supabase
            .from("products")
            .insert(product);

        if (productError) throw productError;

        const { error: cacheError } = await supabase
            .from("market_cache")
            .upsert({
                symbol,
                price: livePrice,
                source: quote.source,
                updated_at: new Date().toISOString()
            }, { onConflict: 'symbol' });

        if (cacheError) throw cacheError;

        return new Response(
            JSON.stringify({ success: true, price: livePrice, source: quote.source }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: err?.message ?? String(err) }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});

function getProviderOrder(symbol: string): Array<"kite" | "yahoo"> {
    if (String(symbol || '').trim().startsWith('^')) {
        return ['yahoo'];
    }

    const provider = (Deno.env.get('INDIA_API_PROVIDER') ?? 'yahoo').trim().toLowerCase();
    if (provider === 'kite' || provider === 'auto') return ['kite', 'yahoo'];
    return ['yahoo'];
}

async function fetchFromProviders(symbol: string): Promise<PriceQuote> {
    const order = getProviderOrder(symbol);
    const errors: string[] = [];

    for (const provider of order) {
        try {
            if (provider === 'kite') return await fetchKite(symbol);
            if (provider === 'yahoo') return await fetchYahoo(symbol);
        } catch (error: any) {
            errors.push(`${provider}: ${error?.message ?? String(error)}`);
        }
    }

    throw new Error(errors.length ? errors.join(' | ') : `No provider configured for ${symbol}`);
}

function toKiteInstrument(symbol: string): string | null {
    const raw = String(symbol || '').trim().toUpperCase();
    if (!raw || raw.startsWith('^')) return null;

    if (raw.includes(':')) {
        const [exchange, ...rest] = raw.split(':');
        const tradingSymbol = rest.join(':').trim();
        if (!tradingSymbol) return null;
        if (exchange === 'NSE' || exchange === 'BSE') {
            return `${exchange}:${tradingSymbol}`;
        }
        return null;
    }

    if (raw.endsWith('.NS')) return `NSE:${raw.slice(0, -3)}`;
    if (raw.endsWith('.BO')) return `BSE:${raw.slice(0, -3)}`;
    if (/^[A-Z0-9.&_-]+$/.test(raw)) return `NSE:${raw}`;
    return null;
}

async function fetchKite(symbol: string): Promise<PriceQuote> {
    const apiKey = Deno.env.get('KITE_API_KEY');
    const accessToken = Deno.env.get('KITE_ACCESS_TOKEN');
    if (!apiKey || !accessToken) {
        throw new Error('Missing KITE_API_KEY or KITE_ACCESS_TOKEN');
    }

    const instrument = toKiteInstrument(symbol);
    if (!instrument) {
        throw new Error(`Symbol is not a Kite-compatible NSE/BSE instrument: ${symbol}`);
    }

    const params = new URLSearchParams();
    params.append('i', instrument);

    const resp = await fetch(`https://api.kite.trade/quote/ltp?${params.toString()}`, {
        headers: {
            'X-Kite-Version': '3',
            'Authorization': `token ${apiKey}:${accessToken}`,
            'User-Agent': 'avendus-market-edge/1.0',
        }
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Kite API error: ${resp.status} ${resp.statusText} - ${text}`);
    }

    const json = await resp.json();
    const price = json?.data?.[instrument]?.last_price;
    if (typeof price !== 'number') {
        throw new Error(`Invalid Kite price for ${symbol}`);
    }

    return { price, source: 'kite' };
}

async function fetchYahoo(symbol: string): Promise<PriceQuote> {
    const yahooRes = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!yahooRes.ok) {
        const text = await yahooRes.text();
        throw new Error(`Yahoo API error: ${yahooRes.status} ${yahooRes.statusText} - ${text}`);
    }

    const yahooData = await yahooRes.json();
    const result = yahooData?.quoteResponse?.result?.[0];
    const price = result?.regularMarketPrice;

    if (typeof price !== 'number') {
        throw new Error(`Yahoo price not found for ${symbol}`);
    }

    return { price, source: 'yahoo' };
}
