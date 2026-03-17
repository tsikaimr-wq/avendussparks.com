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
    const STOCK_DATA = [
        { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', price: 2985.45, change: 1.25, type: 'stock' },
        { symbol: 'TCS', name: 'Tata Consultancy Services Ltd.', price: 4120.30, change: -0.45, type: 'stock' },
        { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', price: 1650.10, change: 0.80, type: 'stock' },
        { symbol: 'INFY', name: 'Infosys Ltd.', price: 1890.55, change: -1.10, type: 'stock' },
        { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', price: 1245.20, change: 0.55, type: 'stock' },
        { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', price: 1560.75, change: 2.10, type: 'stock' },
        { symbol: 'SBIN', name: 'State Bank of India', price: 820.40, change: 0.30, type: 'stock' },
        { symbol: 'LICI', name: 'Life Insurance Corporation of India', price: 1050.90, change: -0.20, type: 'stock' },
        { symbol: 'ITC', name: 'ITC Ltd.', price: 515.60, change: 0.15, type: 'stock' },
        { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd.', price: 2850.25, change: -0.90, type: 'stock' },
        { symbol: 'LT', name: 'Larsen & Toubro Ltd.', price: 3670.80, change: 1.45, type: 'stock' },
        { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', price: 7230.15, change: -1.50, type: 'stock' },
        { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd.', price: 12450.00, change: 0.75, type: 'stock' },
        { symbol: 'HCLTECH', name: 'HCL Technologies Ltd.', price: 1680.40, change: -0.60, type: 'stock' },
        { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd.', price: 1890.10, change: 1.10, type: 'stock' },
        { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', price: 980.50, change: 2.30, type: 'stock' },
        { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd.', price: 3150.25, change: -2.10, type: 'stock' },
        { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd.', price: 1780.60, change: 0.40, type: 'stock' },
        { symbol: 'AXISBANK', name: 'Axis Bank Ltd.', price: 1290.30, change: 0.90, type: 'stock' },
        { symbol: 'NTPC', name: 'NTPC Ltd.', price: 410.15, change: 1.05, type: 'stock' },
        { symbol: 'WIPRO', name: 'Wipro Ltd.', price: 560.80, change: -0.85, type: 'stock' },
        { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd.', price: 11230.50, change: 0.65, type: 'stock' },
        { symbol: 'TITAN', name: 'Titan Company Ltd.', price: 3450.20, change: -1.20, type: 'stock' },
        { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd.', price: 1620.45, change: -0.75, type: 'stock' },
        { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd.', price: 2980.10, change: -2.50, type: 'stock' },
        { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd.', price: 2890.30, change: 1.80, type: 'stock' },
        { symbol: 'ADANIPORTS', name: 'Adani Ports and SEZ Ltd.', price: 1450.60, change: -1.30, type: 'stock' },
        { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd.', price: 340.25, change: 0.50, type: 'stock' },
        { symbol: 'COALINDIA', name: 'Coal India Ltd.', price: 510.80, change: 1.15, type: 'stock' },
        { symbol: 'ONGC', name: 'Oil and Natural Gas Corporation Ltd.', price: 320.40, change: 0.95, type: 'stock' },
        { symbol: 'NESTLEIND', name: 'Nestle India Ltd.', price: 2560.15, change: -0.40, type: 'stock' },
        { symbol: 'GRASIM', name: 'Grasim Industries Ltd.', price: 2540.90, change: 0.25, type: 'stock' },
        { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd.', price: 980.35, change: 1.60, type: 'stock' },
        { symbol: 'TECHM', name: 'Tech Mahindra Ltd.', price: 1540.20, change: -0.70, type: 'stock' },
        { symbol: 'TATASTEEL', name: 'Tata Steel Ltd.', price: 165.40, change: 1.90, type: 'stock' },
        { symbol: 'CIPLA', name: 'Cipla Ltd.', price: 1520.10, change: 0.35, type: 'stock' },
        { symbol: 'SBILIFE', name: 'SBI Life Insurance Company Ltd.', price: 1680.50, change: -0.15, type: 'stock' },
        { symbol: 'DRREDDY', name: 'Dr. Reddy\'s Laboratories Ltd.', price: 6750.30, change: 0.85, type: 'stock' },
        { symbol: 'BPCL', name: 'Bharat Petroleum Corporation Ltd.', price: 640.20, change: 1.25, type: 'stock' },
        { symbol: 'HDFCLIFE', name: 'HDFC Life Insurance Company Ltd.', price: 690.45, change: -0.55, type: 'stock' },
        { symbol: 'BRITANNIA', name: 'Britannia Industries Ltd.', price: 5890.10, change: 0.60, type: 'stock' },
        { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd.', price: 5640.80, change: 1.35, type: 'stock' },
        { symbol: 'EICHERMOT', name: 'Eicher Motors Ltd.', price: 4890.25, change: -1.10, type: 'stock' },
        { symbol: 'DIVISLAB', name: 'Divi\'s Laboratories Ltd.', price: 4720.60, change: 0.45, type: 'stock' },
        { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals Enterprise Ltd.', price: 6850.40, change: -0.30, type: 'stock' },
        { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd.', price: 1420.30, change: 1.15, type: 'stock' },
        { symbol: 'ADANIGREEN', name: 'Adani Green Energy Ltd.', price: 1980.50, change: -2.80, type: 'stock' },
        { symbol: 'ZOMATO', name: 'Zomato Ltd.', price: 245.60, change: 3.40, type: 'stock' },
        { symbol: 'PAYTM', name: 'One 97 Communications (Paytm)', price: 420.30, change: -4.50, type: 'stock' },
        { symbol: 'JIOFIN', name: 'Jio Financial Services Ltd.', price: 360.75, change: 1.90, type: 'stock' }
    ];
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
            this.stocks = STOCK_DATA;
            this.otc = OTC_DATA;
            this.ipo = IPO_DATA;
            this.indices = INDICES_DATA.map(idx => {
                const price = parseFloat(idx.price) || 0;
                const change = parseFloat(idx.change) || 0;
                const prevClose = (price - change) > 0 ? (price - change) : price;
                return {
                    ...idx,
                    displayName: this.normalizeIndexDisplayName(idx.name || idx.symbol, idx.symbol),
                    price,
                    change,
                    prevClose,
                    changePercent: prevClose > 0 ? (change / prevClose) * 100 : 0
                };
            });
            this.dbProducts = []; // Cache for database products (IPO)
            this.dbOtcProducts = []; // Cache for database products (OTC)
            this.dbInsStocks = []; // Cache for database products (Ins.stocks)
            this.cachedPrices = {}; // Store raw cached data { symbol: { price, updated_at } }
            this.livePrices = {}; // Keep latest known live/cache prices by symbol
            this.CACHE_TTL_MS = 10 * 60 * 1000;
            this.listeners = [];
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
            this.syncFromDB();
            this.syncMarketCache(); // Initial cache sync

            // Auto-refresh market cache every 10 seconds
            setInterval(() => this.syncMarketCache(), 10 * 1000);
        }

        normalizeIndexDisplayName(name, symbol = '') {
            const rawName = String(name || '').trim();
            const rawSymbol = String(symbol || '').trim().toUpperCase();
            const upper = rawName.toUpperCase();

            if (rawSymbol === 'SENSEX' || upper.includes('SENSEX')) return 'S&P BSE SENSEX';
            if (rawSymbol === 'NIFTY 50' || upper.includes('NIFTY 50')) return 'NIFTY 50';
            if (rawSymbol === 'NIFTY BANK' || upper.includes('NIFTY BANK')) return 'NIFTY BANK';
            if (rawSymbol === 'NIFSMCP100' || upper.includes('SMALLCAP 100')) return 'NIFTY SMALLCAP 100';
            if (rawSymbol === 'NIFMDCP100' || upper.includes('MIDCAP 100')) return 'NIFTY MIDCAP 100';
            if (rawSymbol === 'VIX' || upper.includes('VIX')) return 'INDIA VIX';

            return rawName || rawSymbol || 'INDEX';
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
            const raw = String(sym || '').trim().toUpperCase();
            if (!raw) return [];
            const norm = this.normalizeSymbol(raw);
            const out = new Set([raw, norm]);

            if (raw.includes(':')) {
                const suffix = raw.split(':')[0];
                if (suffix === 'NSE') out.add(`${norm}.NS`);
                if (suffix === 'BSE') out.add(`${norm}.BO`);
            } else {
                out.add(`${norm}.NS`);
                out.add(`${norm}.BO`);
                out.add(`NSE:${norm}`);
                out.add(`BSE:${norm}`);
            }

            return [...out].filter(Boolean);
        }

        isQuoteStale(item) {
            if (!item || !item.updated_at) return true;
            const ts = new Date(item.updated_at);
            if (Number.isNaN(ts.getTime())) return true;
            return (Date.now() - ts.getTime()) > this.CACHE_TTL_MS;
        }

        applySyntheticTick(stock, volatility = 0.0012) {
            if (!stock || !Number.isFinite(stock.price) || stock.price <= 0) return;
            const pct = (Math.random() * volatility * 2) - volatility;
            const prev = stock.price;
            stock.price = Math.max(0.01, stock.price * (1 + pct));
            if (!Number.isFinite(stock.change)) stock.change = 0;
            stock.change += pct * 100;
            if (!Number.isFinite(stock.change) || prev <= 0) stock.change = pct * 100;
        }

        async syncMarketCache() {
            const client = window.supabaseClient || (window.DB && typeof window.DB.getClient === 'function' ? window.DB.getClient() : null);
            if (client && typeof client.from === 'function') {
                try {
                    const { data, error } = await client
                        .from('market_cache')
                        .select('symbol, price, updated_at');

                    if (error) throw error;

                    if (data && data.length > 0) {
                        const now = Date.now();
                        data.forEach(item => {
                            const nextPrice = parseFloat(item.price) || 0;
                            this.cachedPrices[item.symbol] = {
                                price: nextPrice,
                                updated_at: item.updated_at
                            };
                            this.livePrices[item.symbol] = nextPrice;

                            const candidates = this.getSymbolCandidates(item.symbol);
                            const stock = [...this.stocks, ...this.otc, ...this.ipo, ...this.indices, ...this.dbOtcProducts, ...this.dbProducts, ...this.dbInsStocks]
                                .find(s => {
                                    const own = this.getSymbolCandidates(s.market_symbol || s.symbol);
                                    return own.some(v => candidates.includes(v));
                                });

                            if (stock) {
                                const updatedAt = new Date(item.updated_at);
                                const stale = Number.isNaN(updatedAt.getTime()) || ((now - updatedAt.getTime()) > this.CACHE_TTL_MS);

                                if (stock.type === 'index') {
                                    stock.price = nextPrice;
                                    const prevClose = (stock.prevClose && stock.prevClose > 0) ? stock.prevClose : stock.price;
                                    stock.change = stock.price - prevClose;
                                    stock.changePercent = prevClose > 0 ? (stock.change / prevClose) * 100 : 0;
                                } else {
                                    if (stock.price !== nextPrice && stock.price > 0) {
                                        stock.change = ((nextPrice - stock.price) / stock.price) * 100;
                                    }
                                    stock.price = nextPrice;
                                }
                                stock.isCached = !stale;
                                stock.cacheStale = stale;
                                stock.updated_at = item.updated_at;
                            }
                        });
                        this.notifyListeners();
                    }
                } catch (e) {
                    console.error("Failed to sync market cache: ", e);
                }
            }
        }

        async syncFromDB() {
            if (window.DB && window.DB.getActiveProductsByType) {
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
                        level: (parseFloat(p.min_invest) > 100000) ? 'Lv ≥ 2' : 'Lv ≥ 1',
                        minInvest: parseFloat(p.min_invest) || 0,
                        maxInvest: parseFloat(p.max_invest) || 0,
                        type: 'IPO',
                        totalShares: p.total_shares || 0,
                        availableShares: p.available_shares || 0,
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
                        level: (parseFloat(p.min_invest) > 100000) ? 'Lv ≥ 2' : 'Lv ≥ 1',
                        minInvest: parseFloat(p.min_invest) || 0,
                        maxInvest: parseFloat(p.max_invest) || 0,
                        type: 'OTC',
                        totalShares: p.total_shares || 0,
                        availableShares: p.available_shares || 0,
                        change: 0
                        };
                    });

                    // Fetch Ins.stocks
                    const insData = await window.DB.getActiveProductsByType('Ins.stocks');
                    this.dbInsStocks = insData.map(p => ({
                        id: p.id,
                        symbol: p.market_symbol || p.name.split(' ')[0].toUpperCase(),
                        market_symbol: p.market_symbol,
                        name: p.name,
                        price: parseFloat(p.price) || 0,
                        subscription_price: parseFloat(p.subscription_price) || 0,
                        start_date: p.start_date || '',
                        end_date: p.end_date || '',
                        listing_date: p.listing_date || '',
                        allotment_date: p.allotment_date || p.allocation_date || p.end_date || '',
                        allocation_date: p.allotment_date || p.allocation_date || p.end_date || '',
                        min_invest: parseFloat(p.min_invest) || 0,
                        minInvest: parseFloat(p.min_invest) || 0,
                        change: 0,
                        type: 'INS.STOCKS'
                    }));

                    this.notifyListeners();
                } catch (e) {
                    console.error("Failed to sync products from DB:", e);
                }
            }
        }

        startSimulation() {
            setInterval(() => {
                // Fluctuate Stocks
                this.stocks.forEach(stock => {
                    if (stock.isCached && !stock.cacheStale) return; // Fresh cache: trust real feed

                    const volatility = 0.005;
                    const changePercent = (Math.random() * volatility * 2) - volatility;
                    const changeAmount = stock.price * changePercent;
                    stock.price += changeAmount;
                    stock.change += (changePercent * 100);
                    if (changeAmount > 0) stock.change = Math.abs(stock.change);
                    else stock.change = -Math.abs(stock.change);
                });

                // Fluctuate OTC
                this.otc.forEach(stock => {
                    if (stock.isCached && !stock.cacheStale) return;

                    const volatility = 0.003;
                    const changePercent = (Math.random() * volatility * 2) - volatility;
                    stock.price += (stock.price * changePercent);
                });

                // Fluctuate IPO
                this.ipo.forEach(stock => {
                    if (stock.isCached && !stock.cacheStale) return;

                    const volatility = 0.002;
                    const changePercent = (Math.random() * volatility * 2) - volatility;
                    stock.price += (stock.price * changePercent);
                });

                // Fluctuate DB-driven products (especially Ins.stocks) when feed is stale/closed.
                [this.dbInsStocks, this.dbOtcProducts, this.dbProducts].forEach(list => {
                    list.forEach(stock => {
                        if (!stock) return;
                        if (stock.isCached && !stock.cacheStale && !this.isQuoteStale(stock)) return;
                        this.applySyntheticTick(stock, stock.type === 'INS.STOCKS' || stock.type === 'stock' ? 0.0016 : 0.0010);
                    });
                });

                // Keep index values anchored to previous close to avoid random drift.
                this.indices.forEach(idx => {
                    if (!idx.prevClose || idx.prevClose <= 0) return;
                    idx.change = idx.price - idx.prevClose;
                    idx.changePercent = (idx.change / idx.prevClose) * 100;
                });

                this.notifyListeners();
            }, 1000);
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
            const all = [...this.stocks, ...this.getOTC(), ...this.getIPO(), ...this.indices];
            return all.filter(s =>
                s.symbol.toLowerCase().includes(q) ||
                s.name.toLowerCase().includes(q)
            );
        }

        getIndices() { return this.indices; }

        async syncIndicesWithYahoo() {
            const db = window.DB;
            if (!db || typeof db.getMarketPrice !== 'function') return;

            for (const idx of this.indices) {
                const yahooSymbol = this.indexYahooSymbols[idx.symbol] || this.indexYahooSymbols[idx.name];
                if (!yahooSymbol) continue;

                try {
                    const data = await db.getMarketPrice(yahooSymbol);
                    const latestPrice = parseFloat(data?.price);
                    if (!Number.isFinite(latestPrice) || latestPrice <= 0) continue;

                    const remotePrevClose = parseFloat(data?.previousClose ?? data?.prevClose);
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
                    this.livePrices[yahooSymbol] = latestPrice;
                    this.livePrices[idx.symbol] = latestPrice;

                    if (Number.isFinite(remotePrevClose) && remotePrevClose > 0) {
                        idx.prevClose = remotePrevClose;
                    } else if (!idx.prevClose || idx.prevClose <= 0) {
                        idx.prevClose = latestPrice;
                    }

                    idx.change = idx.price - idx.prevClose;
                    idx.changePercent = idx.prevClose > 0 ? (idx.change / idx.prevClose) * 100 : 0;
                    if (data?.name) idx.name = data.name;
                    idx.displayName = this.normalizeIndexDisplayName(data?.name || idx.name || idx.symbol, idx.symbol);
                } catch (e) {
                    console.error(`Failed to sync index ${idx.symbol}:`, e);
                }
            }

            this.notifyListeners();
        }

        async fetchMarketPrice(symbol) {
            const sym = String(symbol || '').trim();
            if (!sym) return null;

            const db = window.DB;
            if (!db || typeof db.getMarketPrice !== 'function') return null;

            try {
                const candidates = this.getSymbolCandidates(sym);
                const stockMatch = [...this.stocks, ...this.dbOtcProducts, ...this.dbProducts, ...this.dbInsStocks]
                    .find(s => {
                        const own = this.getSymbolCandidates(s.market_symbol || s.symbol);
                        return own.some(v => candidates.includes(v));
                    });
                const data = await db.getMarketPrice(sym, stockMatch?.name || '');
                const latestPrice = parseFloat(data?.price);
                if (!Number.isFinite(latestPrice) || latestPrice <= 0) return null;

                this.livePrices[sym] = latestPrice;
                const stock = stockMatch;

                if (stock) {
                    stock.price = latestPrice;
                    stock.isCached = true;
                    stock.cacheStale = false;
                    stock.updated_at = new Date().toISOString();
                }

                this.notifyListeners();
                return latestPrice;
            } catch (e) {
                console.error(`MarketEngine: Failed to fetch live price for ${sym}:`, e);
                return null;
            }
        }

        getAllStocks() { return [...this.stocks, ...(this.dbInsStocks || [])]; }
        getOTC() { return [...this.otc, ...(this.dbOtcProducts || [])]; }
        getIPO() {
            return [...this.ipo, ...this.dbProducts];
        }

        getProduct(idOrSymbol) {
            const all = [...this.stocks, ...this.getOTC(), ...this.getIPO(), ...(this.dbInsStocks || []), ...this.indices];

            const byId = all.find(s => s.id === idOrSymbol || String(s.id) === String(idOrSymbol));
            if (byId) return byId;

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
