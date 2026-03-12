import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-broad-search',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { query } = await req.json()

        if (!query || query.length < 2) {
            return new Response(JSON.stringify([]), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            })
        }

        const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=0&listsCount=0&quotesCount=10`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        })

        if (!response.ok) {
            throw new Error(`Yahoo Search API error: ${response.status}`)
        }

        const data = await response.json()
        const quotes = data.quotes || []
        const isBroad = req.headers.get('x-broad-search') === 'true'

        // Filter and Format
        const filtered = quotes.filter((q: any) => {
            if (isBroad) return true // Allow global for Admin
            return q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO')
        })

        // Fetch prices in parallel for Institutional Stocks if needed
        const formatted = await Promise.all(filtered.map(async (q: any) => {
            let price = 0
            let change = 0
            let listingDate = ""

            if (isBroad && q.symbol) {
                try {
                    const priceUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${q.symbol}?interval=1m&range=1d`
                    const pResp = await fetch(priceUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
                    const pData = await pResp.json()
                    const meta = pData?.chart?.result?.[0]?.meta
                    if (meta) {
                        price = meta.regularMarketPrice
                        const prevClose = meta.previousClose || price
                        change = ((price - prevClose) / prevClose) * 100

                        // Extract firstTradeDate for Listing Date
                        if (meta.firstTradeDate) {
                            const d = new Date(meta.firstTradeDate * 1000)
                            listingDate = d.toISOString().split('T')[0]
                        }
                    }
                } catch (e) {
                    console.error(`Price fetch failed for ${q.symbol}`, e)
                }
            }

            return {
                symbol: q.symbol,
                name: q.shortname || q.longname || q.symbol,
                exch: q.exchDisp || (q.symbol.endsWith('.NS') ? 'NSE' : (q.symbol.endsWith('.BO') ? 'BSE' : 'Global')),
                type: q.quoteType?.toLowerCase() || 'stock',
                price: price,
                changePercent: change.toFixed(2),
                listingDate: listingDate,
                score: q.score || 0
            }
        }))

        return new Response(JSON.stringify(formatted), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        })

    } catch (error: any) {
        console.error(`Search Error:`, error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        })
    }
})
