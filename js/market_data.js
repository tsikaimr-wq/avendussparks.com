console.log("market_data.js loaded");
/**
 * Market Data Engine - Simulates Real-time Indian Stock Market Data
 * 
 * Features:
 * - Mock list of top NSE/BSE stocks
 * - Simulated price fluctuation
 * - Search capability
 */

(function () {
    // Top 50 Indian Stocks (Approximate Prices)
    const STOCK_DATA = [];
    console.log("STOCK_DATA count:", STOCK_DATA.length);
    const OTC_DATA = [];

    const IPO_DATA = [];

    const INDICES_DATA = [
        { symbol: 'SENSEX', name: 'BSE SENSEX', price: 83710.26, change: 396.33, changePercent: 0.48, type: 'index' },
        { symbol: 'NIFTY 50', name: 'NSE NIFTY 50', price: 25619.54, change: -156.46, changePercent: -0.61, type: 'index' },
        { symbol: 'NIFTY BANK', name: 'NSE NIFTY BANK', price: 60120.55, change: -563.00, changePercent: -0.93, type: 'index' },
        { symbol: 'NIFSMCP100', name: 'NIFTY SMALLCAP 100', price: 16938.65, change: -45.53, changePercent: -0.27, type: 'index' },
        { symbol: 'NIFMDCP100', name: 'NIFTY MIDCAP 100', price: 59502.70, change: -144.00, changePercent: -0.24, type: 'index' },
        { symbol: 'VIX', name: 'INDIA VIX', price: 15.1, change: 1.46, changePercent: 10.73, type: 'index' }
    ];

    class MarketEngine {
        constructor() {
            console.log("MarketEngine constructor start");
            this.stocks = STOCK_DATA;
            this.otc = OTC_DATA;
            this.ipo = IPO_DATA;
            this.indices = INDICES_DATA.map(idx => {
                const price = parseFloat(idx.price) || 0;
                const change = parseFloat(idx.change) || 0;
                const prevClose = (price - change) > 0 ? (price - change) : price;
                return {
                    ...idx,
                    price,
                    change,
                    prevClose,
                    changePercent: prevClose > 0 ? (change / prevClose) * 100 : 0,
                    hasMarketQuote: false,
                    quoteSource: 'seed',
                    quoteStatus: 'Awaiting API data',
                    delayed: true,
                    updated_at: null
                };
            });
            this.dbProducts = []; // Cache for database products (IPO)
            console.log("MarketEngine stocks set, count:", this.stocks.length);
            window.DEBUG_MARKET = this;
            this.dbOtcProducts = []; // Cache for database products (OTC)
            this.dbInsStocks = []; // Cache for database products (Ins.stocks)
            this.livePrices = {}; // Real-time market prices (Yahoo)
            this.CACHE_TTL_MS = 10 * 60 * 1000;
            this.listeners = [];

            // Yahoo Symbols Mapping for Major Indices
            this.indexYahooSymbols = {
                'SENSEX': '^BSESN',
                'NIFTY 50': '^NSEI',
                'NSE NIFTY 50': '^NSEI',
                'NIFTY BANK': '^NSEBANK',
                'NSE NIFTY BANK': '^NSEBANK',
                'NIFSMCP100': '^NSESMCP100',
                'NIFTY SMALLCAP 100': '^NSESMCP100',
                'NIFMDCP100': '^NSEMDCP100',
                'NIFTY MIDCAP 100': '^NSEMDCP100',
                'VIX': '^INDIAVIX',
                'INDIA VIX': '^INDIAVIX'
            };

            this.startSimulation();
            
            // Initialization flow: sync products first, then overlay cache
            this.syncFromDB().then(() => {
                this.syncMarketCache();
            });

            // Auto-refresh market cache every 10 seconds
            setInterval(() => this.syncMarketCache(), 10 * 1000);
        }

        parseProfitPercent(raw) {
            const rawText = String(raw ?? '').trim();
            if (!rawText) return { value: null, text: 'TBD' };

            const numeric = Number(rawText.replace(/,/g, '').replace('%', '').trim());
            if (Number.isFinite(numeric)) {
                return {
                    value: numeric,
                    text: `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`
                };
            }

            return {
                value: null,
                text: rawText.includes('%') ? rawText : `${rawText}%`
            };
        }

        normalizeSymbol(sym) {
            if (!sym) return '';
            let s = String(sym).trim().toUpperCase();
            if (!s) return '';
            if (s.includes(':')) {
                const parts = s.split(':');
                s = parts[parts.length - 1] || s;
            }
            s = s.replace(/\.(NS|BO|NSE|BSE|BOM)$/i, '');
            return s;
        }

        getSymbolCandidates(sym) {
            if (window.DB && typeof window.DB.getMarketApiSymbolCandidates === 'function') {
                const resolved = window.DB.getMarketApiSymbolCandidates(sym);
                if (Array.isArray(resolved) && resolved.length > 0) return resolved;
            }

            const raw = String(sym || '').trim().toUpperCase();
            if (!raw) return [];
            const norm = this.normalizeSymbol(raw);
            const out = new Set([raw, norm]);

            if (raw.includes(':')) {
                const prefix = raw.split(':')[0];
                if (prefix === 'NSE') out.add(`${norm}.NS`);
                if (prefix === 'BSE') out.add(`${norm}.BO`);
            } else {
                out.add(`${norm}.NS`);
                out.add(`${norm}.BO`);
                out.add(`NSE:${norm}`);
                out.add(`BSE:${norm}`);
            }

            return [...out].filter(Boolean);
        }

        async syncMarketCache() {
            if (window.supabaseClient) {
                try {
                    const { data, error } = await window.supabaseClient
                        .from('market_cache')
                        .select('symbol, price, updated_at');

                    if (error) throw error;

                    if (data && data.length > 0) {
                        const now = new Date();

                        data.forEach(item => {
                            let updatedAt = new Date(item.updated_at);
                            // If invalid, fallback to very old date to trigger sync
                            if (isNaN(updatedAt.getTime())) updatedAt = new Date(0);
                            
                            const isStale = (now - updatedAt) > this.CACHE_TTL_MS;

                            this.livePrices[item.symbol] = parseFloat(item.price);

                            // Update local arrays immediately (symbol-aware matching)
                            const candidates = this.getSymbolCandidates(item.symbol);
                            const stock = [...this.stocks, ...this.dbOtcProducts, ...this.dbProducts, ...this.dbInsStocks]
                                .find(s => {
                                    const own = this.getSymbolCandidates(s.market_symbol || s.symbol);
                                    return own.some(v => candidates.includes(v));
                                });

                            if (stock) {
                                stock.updated_at = item.updated_at; // Track for stale check
                                
                                // Calculate accurate change if possible
                                if (stock.price !== item.price && stock.price > 0) {
                                    stock.change = ((item.price - stock.price) / stock.price) * 100;
                                }
                                
                                stock.price = item.price;
                                stock.isCached = !isStale; // Only mark as cached if data is FRESH
                                stock.cacheStale = isStale;
                            }
                        });
                        this.notifyListeners();

                        // Proactive Fetch for Ins. Stocks: If missing/stale/uncached, fetch now.
                        this.dbInsStocks.forEach(s => {
                            if (s.market_symbol && (s.price === 0 || !s.isCached)) {
                                console.log(`MarketEngine proactive fetch for ${s.market_symbol} (stale or missing)`);
                                this.fetchMarketPrice(s.market_symbol);
                            }
                        });
                    }
                } catch (e) {
                    console.error("Failed to sync market cache: ", e);
                }
            }
        }

        async syncFromDB() {
            let retries = 0;
            const maxRetries = 20; // 5 seconds (250ms * 20)

            while (retries < maxRetries) {
                if (window.DB && typeof window.DB.getActiveProductsByType === 'function') {
                    console.log("Syncing IPO/OTC from DB...");
                    try {
                        // Fetch IPOs
                        const ipoData = await window.DB.getActiveProductsByType('IPO');
                        this.dbProducts = ipoData.map(p => {
                            const profitInfo = this.parseProfitPercent(
                                p.est_profit_percent ?? p.profit ?? p.estimated_profit ?? p.ipo_yield ?? p.yield
                            );
                            return {
                                id: p.id,
                                symbol: p.market_symbol || p.name.split(' ')[0].toUpperCase(),
                                market_symbol: p.market_symbol,
                                name: p.name,
                                price: parseFloat(p.price) || 0,
                                subscription_price: parseFloat(p.subscription_price) || 0,
                                yield: profitInfo.text,
                                estimated_profit: Number.isFinite(profitInfo.value) ? profitInfo.value : 0,
                                est_profit_percent: Number.isFinite(profitInfo.value) ? profitInfo.value : null,
                                subDate: p.start_date || 'TBD',
                                deadline: p.end_date || 'TBD',
                                listingDate: p.listing_date || 'TBD',
                                start_date: p.start_date || '',
                                end_date: p.end_date || '',
                                listing_date: p.listing_date || '',
                                allotment_date: p.allotment_date || p.allocation_date || p.end_date || '',
                                allocation_date: p.allotment_date || p.allocation_date || p.end_date || '',
                                min_invest: parseFloat(p.min_invest) || 0,
                                minInvest: parseFloat(p.min_invest) || 0,
                                level: (parseFloat(p.min_invest) > 100000) ? 'Lv >= 2' : 'Lv >= 1',
                                type: 'IPO',
                                totalShares: p.total_shares || 0,
                                availableShares: p.available_shares || 0,
                                exchange: p.exchange,
                                change: 0
                            };
                        });

                        // Fetch OTCs
                        const otcData = await window.DB.getActiveProductsByType('OTC');
                        this.dbOtcProducts = otcData.map(p => {
                            const profitInfo = this.parseProfitPercent(
                                p.est_profit_percent ?? p.profit ?? p.estimated_profit ?? p.ipo_yield ?? p.yield
                            );
                            return {
                                id: p.id,
                                symbol: p.market_symbol || p.name.split(' ')[0].toUpperCase(),
                                market_symbol: p.market_symbol,
                                name: p.name,
                                price: parseFloat(p.price) || 0,
                                subscription_price: parseFloat(p.subscription_price) || 0,
                                yield: profitInfo.text,
                                estimated_profit: Number.isFinite(profitInfo.value) ? profitInfo.value : 0,
                                est_profit_percent: Number.isFinite(profitInfo.value) ? profitInfo.value : null,
                                subDate: p.start_date || 'TBD',
                                deadline: p.end_date || 'TBD',
                                listingDate: p.listing_date || 'TBD',
                                start_date: p.start_date || '',
                                end_date: p.end_date || '',
                                listing_date: p.listing_date || '',
                                allotment_date: p.allotment_date || p.allocation_date || p.end_date || '',
                                allocation_date: p.allotment_date || p.allocation_date || p.end_date || '',
                                min_invest: parseFloat(p.min_invest) || 0,
                                minInvest: parseFloat(p.min_invest) || 0,
                                level: (parseFloat(p.min_invest) > 100000) ? 'Lv >= 2' : 'Lv >= 1',
                                type: 'OTC',
                                totalShares: p.total_shares || 0,
                                availableShares: p.available_shares || 0,
                                exchange: p.exchange,
                                change: 0
                            };
                        });

                        // Fetch Institutional Stocks
                        const insData = await window.DB.getActiveProductsByType('Ins.stocks');
                        this.dbInsStocks = insData.map(p => ({
                            id: p.id,
                            symbol: p.market_symbol || p.name.split(' ')[0].toUpperCase(),
                            market_symbol: p.market_symbol,
                            name: p.name,
                            // Keep a usable fallback price so holdings never freeze at 0 when cache is stale/missing.
                            price: parseFloat(p.price) || 0,
                            subscription_price: parseFloat(p.subscription_price) || 0,
                            yield: this.parseProfitPercent(
                                p.est_profit_percent ?? p.profit ?? p.estimated_profit ?? p.ipo_yield ?? p.yield
                            ).text,
                            subDate: p.start_date || 'TBD',
                            deadline: p.end_date || 'TBD',
                            listingDate: p.listing_date || 'TBD',
                            start_date: p.start_date || '',
                            end_date: p.end_date || '',
                            listing_date: p.listing_date || '',
                            allotment_date: p.allotment_date || p.allocation_date || p.end_date || '',
                            allocation_date: p.allotment_date || p.allocation_date || p.end_date || '',
                            min_invest: parseFloat(p.min_invest) || 0,
                            minInvest: parseFloat(p.min_invest) || 0,
                            level: (parseFloat(p.min_invest) > 100000) ? 'Lv >= 2' : 'Lv >= 1',
                            type: 'INS.STOCKS', // Standardized product_type
                            totalShares: p.total_shares || 0,
                            availableShares: p.available_shares || 0,
                            exchange: p.exchange,
                            change: 0
                        }));

                        console.log(`Synced ${this.dbProducts.length} IPOs, ${this.dbOtcProducts.length} OTCs, and ${this.dbInsStocks.length} Ins.stocks`);
                        this.notifyListeners();
                        return; // Success, exit loop
                    } catch (e) {
                        console.error("Failed to sync products from DB:", e);
                        return; // Exit on hard error
                    }
                }

                // Wait 250ms before retrying
                await new Promise(resolve => setTimeout(resolve, 250));
                retries++;
            }
            console.warn("MarketEngine DB sync timed out after 5 seconds.");
        }

        startSimulation() {
            setInterval(() => {
                // Fluctuate Hardcoded Stocks
                this.stocks.forEach(stock => {
                    const volatility = 0.005;
                    const changePercent = (Math.random() * volatility * 2) - volatility;
                    stock.price += (stock.price * changePercent);
                    stock.change += (changePercent * 100);
                    if (changePercent > 0) stock.change = Math.abs(stock.change);
                    else stock.change = -Math.abs(stock.change);
                });

                // Fluctuate DB Products (Ins. Stocks, OTC, IPOs)
                // This makes them look "connected" and alive even if fetch is pending
                const dbLists = [this.dbInsStocks, this.dbOtcProducts, this.dbProducts];
                dbLists.forEach(list => {
                    list.forEach(stock => {
                        if (stock.price > 0) {
                            const volatility = 0.0015; 
                            const changePercent = (Math.random() * volatility * 2) - volatility;
                            stock.price += (stock.price * changePercent);
                            
                            // Initialize change if it's 0 to show some activity
                            if (!stock.change || stock.change === 0) {
                                stock.change = (changePercent * 100);
                            } else {
                                stock.change += (changePercent * 100);
                            }

                            // Keep sign consistent with latest movement for visual polish
                            if (changePercent > 0) stock.change = Math.abs(stock.change);
                            else stock.change = -Math.abs(stock.change);
                        }
                    });
                });

                this.notifyListeners();
            }, 5000); // 5 second refresh for simulation
        }

        addListener(callback) {
            if (typeof callback === 'function') {
                this.listeners.push(callback);
            }
        }

        notifyListeners() {
            this.listeners.forEach(cb => {
                try {
                    cb();
                } catch (e) {
                    console.error("MarketEngine listener error:", e);
                }
            });
        }

        search(query) {
            if (!query) return [];
            const q = query.toLowerCase();
            const all = [...this.stocks, ...this.getOTC(), ...this.getIPO(), ...(this.dbInsStocks || []), ...this.indices];
            return all.filter(s =>
                s.symbol.toLowerCase().includes(q) ||
                s.name.toLowerCase().includes(q)
            );
        }

        getIndices() { return this.indices; }

        describeQuoteStatus(payload) {
            if (!payload || payload.status === 'error') {
                return { text: 'API unavailable', color: '#ef4444', delayed: true };
            }

            const source = String(payload.source || '').toLowerCase();
            if (payload.delayed || source.includes('fallback')) {
                return { text: 'Fallback snapshot', color: '#f59e0b', delayed: true };
            }
            if (source.includes('cache')) {
                return { text: 'Delayed cache', color: '#f59e0b', delayed: true };
            }

            return { text: 'Live API', color: '#10b981', delayed: false };
        }

        async syncIndicesWithYahoo() {
            console.log("MarketEngine: syncing indices with market API...");
            for (let idx of this.indices) {
                const yahooSymbol = this.indexYahooSymbols[idx.symbol] || this.indexYahooSymbols[idx.name];
                if (yahooSymbol) {
                    try {
                        const data = await window.DB.getMarketPrice(yahooSymbol);
                        if (data && data.price) {
                            const latestPrice = parseFloat(data.price);
                            if (!Number.isFinite(latestPrice) || latestPrice <= 0) continue;

                            const remotePrevClose = parseFloat(data.previousClose ?? data.prevClose);
                            const baselinePrevClose = Number.isFinite(remotePrevClose) && remotePrevClose > 0
                                ? remotePrevClose
                                : ((idx.prevClose && idx.prevClose > 0) ? idx.prevClose : null);
                            if (baselinePrevClose && idx.symbol !== 'VIX') {
                                const spikePct = Math.abs(((latestPrice - baselinePrevClose) / baselinePrevClose) * 100);
                                if (spikePct > 40) {
                                    console.warn(`Skipping abnormal index quote for ${idx.symbol}: ${latestPrice} vs prevClose ${baselinePrevClose}`);
                                    continue;
                                }
                            }

                            idx.price = latestPrice;

                            // Prefer upstream previous close when available.
                            if (!Number.isNaN(remotePrevClose) && remotePrevClose > 0) {
                                idx.prevClose = remotePrevClose;
                            } else if (!idx.prevClose || idx.prevClose <= 0) {
                                idx.prevClose = idx.price;
                            }

                            // Keep daily change anchored to baseline close (prevents drift).
                            idx.change = idx.price - idx.prevClose;
                            idx.changePercent = idx.prevClose > 0 ? (idx.change / idx.prevClose) * 100 : 0;
                            const status = this.describeQuoteStatus(data);
                            idx.hasMarketQuote = true;
                            idx.quoteSource = data.source || 'market_api';
                            idx.quoteStatus = status.text;
                            idx.quoteStatusColor = status.color;
                            idx.delayed = status.delayed;
                            idx.updated_at = new Date().toISOString();
                            this.notifyListeners();
                        }
                    } catch (e) {
                        console.error(`Failed to sync index ${idx.symbol}:`, e);
                    }
                }
            }
        }

        async fetchMarketPrice(symbol) {
            if (!symbol) return null;
            try {
                const candidates = this.getSymbolCandidates(symbol);
                const stockMatch = [...this.stocks, ...this.dbOtcProducts, ...this.dbProducts, ...this.dbInsStocks]
                    .find(s => {
                        const own = this.getSymbolCandidates(s.market_symbol || s.symbol);
                        return own.some(v => candidates.includes(v));
                    });
                const data = await window.DB.getMarketPrice(symbol, stockMatch?.name || '');
                if (data && data.status !== 'error' && data.price) {
                    const price = parseFloat(data.price);
                    this.livePrices[symbol] = price;

                    // Update local arrays immediately
                    const stock = stockMatch;
                    if (stock) {
                        stock.price = price;
                        stock.isCached = true; // Mark as fresh
                        stock.cacheStale = false;
                        stock.updated_at = new Date().toISOString();
                    }

                    this.notifyListeners();
                    return price;
                }
            } catch (e) {
                console.error(`MarketEngine: Failed to fetch live price for ${symbol}:`, e);
            }
            return null;
        }

        getAllStocks() {
            return [...this.stocks, ...(this.dbInsStocks || [])];
        }
        getOTC() { return [...this.otc, ...(this.dbOtcProducts || [])]; }
        getIPO() {
            return [...this.ipo, ...this.dbProducts];
        }

        getProduct(idOrSymbol) {
            const all = [...this.stocks, ...this.getOTC(), ...this.getIPO(), ...(this.dbInsStocks || []), ...this.indices];
            // 1. Try matching by ID (Reliably unique)
            const byId = all.find(s => s.id === idOrSymbol || String(s.id) === String(idOrSymbol));
            if (byId) return byId;

            // 2. Fallback to Symbol matching with normalized candidates
            const queryCandidates = this.getSymbolCandidates(idOrSymbol);
            if (!queryCandidates.length) return null;

            return all.find(s => {
                const own = this.getSymbolCandidates(s.market_symbol || s.symbol);
                return own.some(v => queryCandidates.includes(v));
            }) || null;
        }
    }

    // Expose Global Instance
    window.MarketEngine = new MarketEngine();
})();
