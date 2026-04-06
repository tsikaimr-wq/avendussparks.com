/**
 * Market Data Engine - Simulates Real-time Indian Stock Market Data
 * 
 * Features:
 * - Mock list of top NSE/BSE stocks
 * - Simulated price fluctuation
 * - Search capability
 */

(function () {
    const BEIJING_TIME_ZONE = 'Asia/Shanghai';
    const PRICE_WINDOW_START_MINUTES = (11 * 60) + 45;
    const PRICE_WINDOW_END_MINUTES = 18 * 60;

    function getBeijingClockParts() {
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: BEIJING_TIME_ZONE,
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const parts = formatter.formatToParts(new Date());
        const pick = (type) => parts.find(part => part.type === type)?.value || '';
        const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
        return {
            weekday: weekdayMap[pick('weekday')] ?? -1,
            hour: Number(pick('hour')) || 0,
            minute: Number(pick('minute')) || 0
        };
    }

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
                    changePercent: prevClose > 0 ? (change / prevClose) * 100 : 0,
                    hasMarketQuote: false,
                    quoteSource: 'seed',
                    quoteStatus: '',
                    quoteStatusColor: '#94a3b8',
                    delayed: true,
                    updated_at: null
                };
            });
            this.dbProducts = []; // Cache for database products (IPO)
            this.dbOtcProducts = []; // Cache for database products (OTC)
            this.dbInsStocks = []; // Cache for database products (Ins.stocks)
            this.cachedPrices = {}; // Store raw cached data { symbol: { price, updated_at } }
            this.livePrices = {}; // Keep latest known live/cache prices by symbol
            this.productPriceLocks = {};
            this.productPriceLocksLoadedAt = 0;
            this.PRODUCT_PRICE_LOCKS_KEY = 'product_price_locks';
            this.PRODUCT_PRICE_LOCKS_TTL_MS = 10 * 1000;
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
            this.isReady = false;
            this.ready = this.syncFromDB()
                .then(() => this.syncMarketCache())
                .catch((e) => {
                    console.error("MarketEngine initialization failed:", e);
                })
                .finally(() => {
                    this.isReady = true;
                    this.notifyListeners();
                });
            window.MARKET_ENGINE_READY = this.ready;

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

        getPriceWindowState() {
            const clock = getBeijingClockParts();
            const minutes = (clock.hour * 60) + clock.minute;
            const isWeekday = clock.weekday >= 1 && clock.weekday <= 5;
            const isOpen = isWeekday && minutes >= PRICE_WINDOW_START_MINUTES && minutes < PRICE_WINDOW_END_MINUTES;
            return { ...clock, minutes, isWeekday, isOpen };
        }

        isWithinPriceUpdateWindow() {
            return this.getPriceWindowState().isOpen;
        }

        getFrozenKnownPrice(symbol, stock = null) {
            const candidates = this.getSymbolCandidates(symbol);
            const resolvedStock = stock || [...this.stocks, ...this.dbOtcProducts, ...this.dbProducts, ...this.dbInsStocks, ...this.indices]
                .find(item => {
                    const own = this.getSymbolCandidates(item.market_symbol || item.symbol);
                    return own.some(candidate => candidates.includes(candidate));
                });

            const lockedPrice = this.getLockedPriceValue(resolvedStock || symbol);
            if (lockedPrice !== null) return lockedPrice;

            for (const candidate of candidates) {
                const livePrice = this.toFiniteValue(this.livePrices?.[candidate]);
                if (livePrice !== null && livePrice > 0) return livePrice;
                const cachedPrice = this.toFiniteValue(this.cachedPrices?.[candidate]?.price);
                if (cachedPrice !== null && cachedPrice > 0) return cachedPrice;
            }

            const stockPrice = this.toFiniteValue(resolvedStock?.price);
            if (stockPrice !== null && stockPrice > 0) return stockPrice;

            const subPrice = this.toFiniteValue(resolvedStock?.subscription_price);
            if (subPrice !== null && subPrice > 0) return subPrice;

            return null;
        }

        parsePriceLockMap(value) {
            if (!value) return {};
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (_) {
                    return {};
                }
            }
            return (typeof value === 'object' && !Array.isArray(value)) ? value : {};
        }

        async loadProductPriceLocks(force = false) {
            const now = Date.now();
            if (!force && this.productPriceLocks && (now - this.productPriceLocksLoadedAt) < this.PRODUCT_PRICE_LOCKS_TTL_MS) {
                return this.productPriceLocks;
            }
            if (!(window.DB && typeof window.DB.getPlatformSettings === 'function')) {
                this.productPriceLocks = {};
                this.productPriceLocksLoadedAt = now;
                return this.productPriceLocks;
            }
            const rawValue = await window.DB.getPlatformSettings(this.PRODUCT_PRICE_LOCKS_KEY);
            this.productPriceLocks = this.parsePriceLockMap(rawValue);
            this.productPriceLocksLoadedAt = now;
            return this.productPriceLocks;
        }

        buildPriceLockAliases(target) {
            const aliases = new Set();
            const addAlias = (value) => {
                const raw = String(value || '').trim();
                if (!raw) return;
                aliases.add(raw.toUpperCase());
                this.getSymbolCandidates(raw).forEach(candidate => aliases.add(String(candidate || '').trim().toUpperCase()));
            };

            if (typeof target === 'string' || typeof target === 'number') {
                addAlias(target);
            } else if (target && typeof target === 'object') {
                [target.id, target.product_id, target.symbol, target.market_symbol].forEach(addAlias);
            }

            return aliases;
        }

        getPriceLockExchangeHint(target) {
            if (!target) return '';
            const values = [];
            if (typeof target === 'string' || typeof target === 'number') {
                values.push(target);
            } else if (typeof target === 'object') {
                values.push(target.exchange, target.exch, target.market, target.symbol, target.market_symbol);
            }

            for (const value of values) {
                const upper = String(value || '').trim().toUpperCase();
                if (!upper) continue;
                if (upper === 'NSE' || upper.includes(' N S E') || upper.includes('NSE') || upper.startsWith('NSE:') || upper.endsWith('.NS') || upper.endsWith('.NSE')) {
                    return 'NSE';
                }
                if (upper === 'BSE' || upper.includes(' B S E') || upper.includes('BSE') || upper.startsWith('BSE:') || upper.endsWith('.BO') || upper.endsWith('.BSE') || upper.endsWith('.BOM')) {
                    return 'BSE';
                }
            }
            return '';
        }

        getProductPriceLockEntry(target, lockMap = this.productPriceLocks || {}) {
            const aliases = this.buildPriceLockAliases(target);
            if (!aliases.size) return null;
            const targetExchange = this.getPriceLockExchangeHint(target);

            for (const [key, entry] of Object.entries(lockMap || {})) {
                if (!entry?.locked) continue;
                const entryExchange = this.getPriceLockExchangeHint({ ...entry, id: entry.id || key });
                if (targetExchange && entryExchange && targetExchange !== entryExchange) {
                    continue;
                }
                const entryAliases = this.buildPriceLockAliases({ ...entry, id: entry.id || key });
                if ([...entryAliases].some(alias => aliases.has(alias))) {
                    return entry;
                }
            }

            return null;
        }

        getLockedPriceValue(target, lockMap = this.productPriceLocks || {}) {
            const entry = this.getProductPriceLockEntry(target, lockMap);
            const lockedPrice = this.toFiniteValue(entry?.locked_price ?? entry?.price);
            return (entry?.locked && lockedPrice !== null && lockedPrice > 0) ? lockedPrice : null;
        }

        applyLockedPrice(target, lockMap = this.productPriceLocks || {}) {
            if (!target || String(target.type || '').trim().toLowerCase() === 'index') return false;
            const lockedPrice = this.getLockedPriceValue(target, lockMap);
            if (lockedPrice === null) {
                const candidates = this.getSymbolCandidates(target.market_symbol || target.symbol || target.id);
                if (target) {
                    const unlockedPrice = this.toFiniteValue(
                        target.__preLockPrice ??
                        target.configured_price ??
                        target.subscription_price ??
                        target.price
                    );
                    const unlockedSubscriptionPrice = this.toFiniteValue(
                        target.__preLockSubscriptionPrice ??
                        target.configured_price ??
                        target.subscription_price ??
                        target.price
                    );
                    const unlockedPrevClose = this.toFiniteValue(
                        target.__preLockPrevClose ??
                        target.prevClose ??
                        unlockedPrice
                    );

                    if (unlockedPrice !== null && unlockedPrice > 0) {
                        target.price = unlockedPrice;
                    }
                    if (('subscription_price' in target || target.type !== 'stock')
                        && unlockedSubscriptionPrice !== null
                        && unlockedSubscriptionPrice > 0) {
                        target.subscription_price = unlockedSubscriptionPrice;
                    }
                    if (unlockedPrevClose !== null && unlockedPrevClose > 0) {
                        target.prevClose = unlockedPrevClose;
                    }
                    target.priceLocked = false;
                    target.locked = false;
                    target.locked_price = null;
                    if (String(target.quoteSource || '').trim().toLowerCase() === 'manual_price_lock') {
                        target.quoteSource = String(target.__preLockQuoteSource || '').trim();
                    }
                    delete target.__preLockPrice;
                    delete target.__preLockSubscriptionPrice;
                    delete target.__preLockPrevClose;
                    delete target.__preLockQuoteSource;
                }
                candidates.forEach((candidate) => {
                    if (this.livePrices && Object.prototype.hasOwnProperty.call(this.livePrices, candidate)) {
                        delete this.livePrices[candidate];
                    }
                    if (this.cachedPrices && Object.prototype.hasOwnProperty.call(this.cachedPrices, candidate)) {
                        delete this.cachedPrices[candidate];
                    }
                });
                return false;
            }

            if (!target.priceLocked && !target.locked) {
                target.__preLockPrice = this.toFiniteValue(target.price);
                target.__preLockSubscriptionPrice = this.toFiniteValue(target.subscription_price);
                target.__preLockPrevClose = this.toFiniteValue(target.prevClose);
                target.__preLockQuoteSource = String(target.quoteSource || '').trim();
            }

            target.price = lockedPrice;
            if ('subscription_price' in target || target.type !== 'stock') {
                target.subscription_price = lockedPrice;
            }
            target.prevClose = lockedPrice;
            target.change = null;
            target.changePercent = null;
            target.quoteSource = 'manual_price_lock';
            target.delayed = true;
            target.isSimulated = false;
            target.isCached = true;
            target.cacheStale = false;
            target.updated_at = new Date().toISOString();
            target.priceLocked = true;
            target.locked = true;
            target.locked_price = lockedPrice;

            this.getSymbolCandidates(target.market_symbol || target.symbol || target.id).forEach(candidate => {
                this.livePrices[candidate] = lockedPrice;
                this.cachedPrices[candidate] = { price: lockedPrice, updated_at: target.updated_at };
            });
            return true;
        }

        applyPriceLocksToCollections(lockMap = this.productPriceLocks || {}) {
            [this.stocks, this.otc, this.ipo, this.dbInsStocks, this.dbOtcProducts, this.dbProducts].forEach((list) => {
                (Array.isArray(list) ? list : []).forEach(item => this.applyLockedPrice(item, lockMap));
            });
        }

        describeQuoteStatus(payload) {
            if (!payload || payload.status === 'error') {
                return { text: '', color: '#94a3b8', delayed: true };
            }

            const source = String(payload.source || '').toLowerCase();
            if (payload.delayed || source.includes('fallback') || source.includes('cache')) {
                return { text: '', color: '#f59e0b', delayed: true };
            }

            return { text: '', color: '#10b981', delayed: false };
        }

        isLowConfidenceIndexQuote(payload, status = null) {
            const resolvedStatus = status || this.describeQuoteStatus(payload);
            const source = String(payload?.source || '').toLowerCase();
            return resolvedStatus.delayed === true || source.includes('fallback') || source.includes('cache');
        }

        shouldRejectIndexQuote(idx, payload, latestPrice, status = null) {
            if (!idx || !payload) return false;

            const resolvedStatus = status || this.describeQuoteStatus(payload);
            if (!this.isLowConfidenceIndexQuote(payload, resolvedStatus)) return false;
            if (!idx.hasMarketQuote || idx.delayed !== false) return false;

            const currentPrice = Number(idx.price);
            if (!Number.isFinite(currentPrice) || currentPrice <= 0) return false;

            const deviation = Math.abs(latestPrice - currentPrice) / currentPrice;
            return deviation > 0.03;
        }

        parseProfitPercent(raw) {
            const rawText = String(raw ?? '').trim();
            if (!rawText) return { value: null, text: 'TBD' };

            const numeric = Number(rawText.replace(/,/g, '').replace('%', '').trim());
            if (Number.isFinite(numeric)) {
                const capped = numeric > 20 ? 20 : numeric;
                return {
                    value: capped,
                    text: `${capped >= 0 ? '+' : ''}${capped.toFixed(2)}%`
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

        toFiniteValue(value) {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : null;
        }

        getInsStockSeedPrice(item) {
            if (!item) return null;
            const symbolCandidates = this.getSymbolCandidates(item.market_symbol || item.symbol || item.id);
            for (const symbol of symbolCandidates) {
                const livePrice = this.toFiniteValue(this.livePrices?.[symbol]);
                if (livePrice !== null && livePrice > 0) return livePrice;
                const cachedPrice = this.toFiniteValue(this.cachedPrices?.[symbol]?.price);
                if (cachedPrice !== null && cachedPrice > 0) return cachedPrice;
            }

            const candidates = [
                item.price,
                item.configured_price,
                item.subscription_price,
                item.prevClose
            ];

            for (const candidate of candidates) {
                const numeric = this.toFiniteValue(candidate);
                if (numeric !== null && numeric > 0) return numeric;
            }

            return null;
        }

        applyInsStockFallbackQuote(item, options = {}) {
            if (!this.isInsStockProduct(item)) return null;
            if (this.applyLockedPrice(item)) {
                return {
                    price: item.price,
                    previousClose: item.prevClose,
                    prevClose: item.prevClose,
                    changePercent: null,
                    change: null,
                    source: 'manual_price_lock',
                    delayed: true,
                    locked: true,
                    priceLocked: true,
                    locked_price: item.locked_price ?? item.price
                };
            }

            const seedPrice = this.getInsStockSeedPrice(item);
            if (seedPrice === null || seedPrice <= 0) return null;

            const volatility = Number(options.volatility);
            const maxDeviation = Number(options.maxDeviation);
            const tickVolatility = Number.isFinite(volatility) && volatility > 0 ? volatility : 0.0008;
            const deviationCap = Number.isFinite(maxDeviation) && maxDeviation > 0 ? maxDeviation : 0.025;

            if (!Number.isFinite(item.simulatedBasePrice) || item.simulatedBasePrice <= 0) {
                item.simulatedBasePrice = seedPrice;
            }

            const anchorPrice = Number.isFinite(item.simulatedBasePrice) && item.simulatedBasePrice > 0
                ? item.simulatedBasePrice
                : seedPrice;

            if (!Number.isFinite(item.price) || item.price <= 0) {
                item.price = anchorPrice;
            }

            const randomPct = (Math.random() * tickVolatility * 2) - tickVolatility;
            let nextPrice = item.price * (1 + randomPct);
            const upperBound = anchorPrice * (1 + deviationCap);
            const lowerBound = Math.max(0.01, anchorPrice * (1 - deviationCap));
            nextPrice = Math.min(upperBound, Math.max(lowerBound, nextPrice));

            item.price = Math.max(0.01, nextPrice);
            if (!Number.isFinite(item.prevClose) || item.prevClose <= 0) {
                item.prevClose = anchorPrice;
            }

            const pctChange = item.prevClose > 0
                ? ((item.price - item.prevClose) / item.prevClose) * 100
                : 0;

            item.change = pctChange;
            item.changePercent = pctChange;
            item.quoteSource = 'simulated_fallback';
            item.delayed = true;
            item.isSimulated = true;
            item.updated_at = new Date().toISOString();

            const resolvedPrice = item.price;
            const symbolCandidates = this.getSymbolCandidates(item.market_symbol || item.symbol || item.id);
            for (const symbol of symbolCandidates) {
                this.livePrices[symbol] = resolvedPrice;
            }

            return {
                price: resolvedPrice,
                previousClose: item.prevClose,
                prevClose: item.prevClose,
                changePercent: pctChange,
                source: 'simulated_fallback',
                delayed: true
            };
        }

        isInsStockProduct(item) {
            const normalizedType = String(item?.type || '').trim().toUpperCase();
            return normalizedType === 'INS.STOCKS' || normalizedType === 'INS_STOCKS';
        }

        async syncMarketCache() {
            if (window.DISABLE_MARKET_DB === true) return;
            const priceLockMap = await this.loadProductPriceLocks();
            const client = window.supabaseClient || (window.DB && typeof window.DB.getClient === 'function' ? window.DB.getClient() : null);
            if (client && typeof client.from === 'function') {
                try {
                    const allowVisualUpdate = this.isWithinPriceUpdateWindow();
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
                                if (this.applyLockedPrice(stock, priceLockMap)) {
                                    return;
                                }
                                const updatedAt = new Date(item.updated_at);
                                const stale = Number.isNaN(updatedAt.getTime()) || ((now - updatedAt.getTime()) > this.CACHE_TTL_MS);
                                const shouldSeedOnly = !allowVisualUpdate && Number.isFinite(stock.price) && stock.price > 0;

                                if (shouldSeedOnly) {
                                    stock.isCached = !stale;
                                    stock.cacheStale = stale;
                                    if (!stock.updated_at) stock.updated_at = item.updated_at;
                                    return;
                                }

                                if (stock.type === 'index') {
                                    stock.price = nextPrice;
                                    const prevClose = (stock.prevClose && stock.prevClose > 0) ? stock.prevClose : stock.price;
                                    stock.change = stock.price - prevClose;
                                    stock.changePercent = prevClose > 0 ? (stock.change / prevClose) * 100 : 0;
                                } else if (this.isInsStockProduct(stock)) {
                                    stock.price = nextPrice;
                                    if (Number.isFinite(stock.prevClose) && stock.prevClose > 0) {
                                        const pctChange = ((nextPrice - stock.prevClose) / stock.prevClose) * 100;
                                        stock.change = pctChange;
                                        stock.changePercent = pctChange;
                                    } else {
                                        stock.change = 0;
                                        stock.changePercent = null;
                                    }
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
                        this.applyPriceLocksToCollections(priceLockMap);
                        this.notifyListeners();
                    }
                } catch (e) {
                    if (window.DB && typeof window.DB.isMarketCacheSchemaMissing === 'function' && window.DB.isMarketCacheSchemaMissing(e)) {
                        if (typeof window.DB.disableMarketCache === 'function') {
                            window.DB.disableMarketCache(e.message);
                        } else {
                            window.DISABLE_MARKET_DB = true;
                        }
                        return;
                    }
                    console.error("Failed to sync market cache: ", e);
                }
            }
        }

        async syncFromDBLegacy() {
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

        async syncFromDB() {
            let retries = 0;
            const maxRetries = 20;

            while (retries < maxRetries) {
                if (window.DB && typeof window.DB.getActiveProductsByType === 'function') {
                    try {
                        const loadProductRows = async (type) => {
                            let rows = [];
                            try {
                                rows = await window.DB.getActiveProductsByType(type);
                            } catch (error) {
                                console.error(`Failed to load ${type} rows from DB, using fallback if available:`, error);
                            }

                            if (Array.isArray(rows) && rows.length > 0) return rows;
                            if (typeof window.DB.getTurboMarketData !== 'function') return Array.isArray(rows) ? rows : [];

                            const turboRows = await window.DB.getTurboMarketData(type);
                            if (!Array.isArray(turboRows) || turboRows.length === 0) {
                                return Array.isArray(rows) ? rows : [];
                            }

                            console.log(`MarketEngine fallback loaded ${turboRows.length} ${type} items from Turbo data.`);
                            return turboRows.map((item, index) => ({
                                id: item.id || `${String(type).toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${item.symbol || item.market_symbol || index}`,
                                name: item.name || '',
                                symbol: item.symbol || item.market_symbol || '',
                                market_symbol: item.market_symbol || item.symbol || '',
                                price: parseFloat(item.live_price ?? item.price) || 0,
                                subscription_price: parseFloat(item.subscription_price ?? item.price) || 0,
                                est_profit_percent: item.est_profit_percent ?? item.est_profit ?? item.profit ?? item.estimated_profit ?? item.ipo_yield ?? item.yield ?? null,
                                estimated_profit: item.estimated_profit ?? item.est_profit_percent ?? item.est_profit ?? item.profit ?? item.ipo_yield ?? item.yield ?? null,
                                profit: item.profit ?? item.est_profit_percent ?? item.est_profit ?? item.estimated_profit ?? item.ipo_yield ?? item.yield ?? null,
                                ipo_yield: item.ipo_yield ?? item.est_profit_percent ?? item.est_profit ?? item.profit ?? item.estimated_profit ?? item.yield ?? null,
                                yield: item.yield ?? item.est_profit_percent ?? item.est_profit ?? item.profit ?? item.estimated_profit ?? item.ipo_yield ?? null,
                                start_date: item.start_date || '',
                                end_date: item.end_date || '',
                                listing_date: item.listing_date || '',
                                allotment_date: item.allotment_date || item.allocation_date || item.end_date || '',
                                allocation_date: item.allotment_date || item.allocation_date || item.end_date || '',
                                min_invest: parseFloat(item.min_invest ?? item.minInvest) || 0,
                                max_invest: parseFloat(item.max_invest ?? item.maxInvest) || 0,
                                total_shares: item.total_shares || 0,
                                available_shares: item.available_shares || 0,
                                exchange: item.exchange || '',
                                product_type: type,
                                status: 'Active'
                            }));
                        };

                        const buildDisplaySymbol = (row) => row.market_symbol || (row.name ? row.name.split(' ')[0].toUpperCase() : '');

                        const ipoData = await loadProductRows('IPO');
                        this.dbProducts = ipoData.map(p => {
                            const profitInfo = this.parseProfitPercent(
                                p.est_profit_percent ?? p.profit ?? p.estimated_profit ?? p.ipo_yield ?? p.yield
                            );
                            return {
                                id: p.id,
                                symbol: buildDisplaySymbol(p),
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
                                level: (parseFloat(p.min_invest) > 100000) ? 'Lv >= 2' : 'Lv >= 1',
                                minInvest: parseFloat(p.min_invest) || 0,
                                maxInvest: parseFloat(p.max_invest) || 0,
                                type: 'IPO',
                                totalShares: p.total_shares || 0,
                                availableShares: p.available_shares || 0,
                                exchange: p.exchange,
                                change: 0
                            };
                        });

                        const otcData = await loadProductRows('OTC');
                        this.dbOtcProducts = otcData.map(p => {
                            const profitInfo = this.parseProfitPercent(
                                p.est_profit_percent ?? p.profit ?? p.estimated_profit ?? p.ipo_yield ?? p.yield
                            );
                            return {
                                id: p.id,
                                symbol: buildDisplaySymbol(p),
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
                                level: (parseFloat(p.min_invest) > 100000) ? 'Lv >= 2' : 'Lv >= 1',
                                minInvest: parseFloat(p.min_invest) || 0,
                                maxInvest: parseFloat(p.max_invest) || 0,
                                type: 'OTC',
                                totalShares: p.total_shares || 0,
                                availableShares: p.available_shares || 0,
                                exchange: p.exchange,
                                change: 0
                            };
                        });

                        const priceLockMap = await this.loadProductPriceLocks(true);
                        const insData = await loadProductRows('Ins.stocks');
                        this.dbInsStocks = insData.map(p => ({
                            id: p.id,
                            symbol: buildDisplaySymbol(p),
                            market_symbol: p.market_symbol,
                            name: p.name,
                            configured_price: parseFloat(p.price) || 0,
                            price: parseFloat(p.price) || parseFloat(p.subscription_price) || 0,
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
                            type: 'INS.STOCKS',
                            totalShares: p.total_shares || 0,
                            availableShares: p.available_shares || 0,
                            exchange: p.exchange,
                            prevClose: null,
                            change: 0,
                            changePercent: null
                        }));
                        this.dbInsStocks.forEach(stock => {
                            if (this.applyLockedPrice(stock, priceLockMap)) return;
                            this.applyInsStockFallbackQuote(stock);
                        });
                        this.applyPriceLocksToCollections(priceLockMap);

                        console.log(`Synced ${this.dbProducts.length} IPOs, ${this.dbOtcProducts.length} OTCs, and ${this.dbInsStocks.length} Ins.stocks`);
                        this.notifyListeners();
                        return;
                    } catch (e) {
                        console.error("Failed to sync products from DB:", e);
                        return;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 250));
                retries++;
            }

            console.warn("MarketEngine DB sync timed out after 5 seconds.");
        }

        startSimulation() {
            setInterval(() => {
                if (!this.isWithinPriceUpdateWindow()) return;
                // Fluctuate Stocks
                this.stocks.forEach(stock => {
                    if (this.applyLockedPrice(stock)) return;
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
                    if (this.applyLockedPrice(stock)) return;
                    if (stock.isCached && !stock.cacheStale) return;

                    const volatility = 0.003;
                    const changePercent = (Math.random() * volatility * 2) - volatility;
                    stock.price += (stock.price * changePercent);
                });

                // Fluctuate IPO
                this.ipo.forEach(stock => {
                    if (this.applyLockedPrice(stock)) return;
                    if (stock.isCached && !stock.cacheStale) return;

                    const volatility = 0.002;
                    const changePercent = (Math.random() * volatility * 2) - volatility;
                    stock.price += (stock.price * changePercent);
                });

                // Fluctuate DB-driven products (especially Ins.stocks) when feed is stale/closed.
                [this.dbInsStocks, this.dbOtcProducts, this.dbProducts].forEach(list => {
                    list.forEach(stock => {
                        if (!stock) return;
                        if (this.applyLockedPrice(stock)) return;
                        if (this.isInsStockProduct(stock)) {
                            const hasReliableLiveQuote = stock.quoteSource !== 'simulated_fallback'
                                && stock.isCached
                                && !stock.cacheStale
                                && !this.isQuoteStale(stock)
                                && Number.isFinite(stock.price)
                                && stock.price > 0;
                            if (!hasReliableLiveQuote) {
                                this.applyInsStockFallbackQuote(stock, { volatility: 0.0009, maxDeviation: 0.03 });
                            }
                            return;
                        }
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

                this.applyPriceLocksToCollections();
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
            const all = [...this.stocks, ...this.getOTC(), ...this.getIPO(), ...(this.dbInsStocks || []), ...this.indices];
            return all.filter(s =>
                s.symbol.toLowerCase().includes(q) ||
                s.name.toLowerCase().includes(q)
            );
        }

        getIndices() { return this.indices; }

        async syncIndicesWithYahoo() {
            if (!this.isWithinPriceUpdateWindow()) return;
            const db = window.DB;
            if (!db || typeof db.getMarketPrice !== 'function') return;

            for (const idx of this.indices) {
                const yahooSymbol = this.indexYahooSymbols[idx.symbol] || this.indexYahooSymbols[idx.name];
                if (!yahooSymbol) continue;

                try {
                    const data = await db.getMarketPrice(yahooSymbol);
                    const latestPrice = parseFloat(data?.price);
                    if (!Number.isFinite(latestPrice) || latestPrice <= 0) continue;
                    const status = this.describeQuoteStatus(data);

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

                    if (this.shouldRejectIndexQuote(idx, data, latestPrice, status)) {
                        console.warn(`Skipping low-confidence index quote for ${idx.symbol}: ${latestPrice} vs current ${idx.price}`);
                        continue;
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
                    idx.hasMarketQuote = true;
                    idx.quoteSource = data?.source || 'market_api';
                    idx.quoteStatus = status.text;
                    idx.quoteStatusColor = status.color;
                    idx.delayed = status.delayed;
                    idx.updated_at = new Date().toISOString();
                } catch (e) {
                    console.error(`Failed to sync index ${idx.symbol}:`, e);
                }
            }

            this.notifyListeners();
        }

        async fetchMarketPrice(symbol) {
            const sym = String(symbol || '').trim();
            if (!sym) return null;
            await this.loadProductPriceLocks();

            const db = window.DB;
            if (!db || typeof db.getMarketPrice !== 'function') return null;

            try {
                const candidates = this.getSymbolCandidates(sym);
                const stockMatch = [...this.stocks, ...this.dbOtcProducts, ...this.dbProducts, ...this.dbInsStocks]
                    .find(s => {
                        const own = this.getSymbolCandidates(s.market_symbol || s.symbol);
                        return own.some(v => candidates.includes(v));
                    });
                if (this.applyLockedPrice(stockMatch || sym)) {
                    return this.getLockedPriceValue(stockMatch || sym);
                }
                if (!this.isWithinPriceUpdateWindow()) {
                    return this.getFrozenKnownPrice(sym, stockMatch);
                }
                const data = await db.getMarketPrice(sym, stockMatch?.name || '');
                const latestPrice = parseFloat(data?.price);
                if (!Number.isFinite(latestPrice) || latestPrice <= 0) return null;

                this.livePrices[sym] = latestPrice;
                const stock = stockMatch;

                if (stock) {
                    stock.price = latestPrice;
                    if (this.isInsStockProduct(stock)) {
                        const prevClose = parseFloat(data?.previousClose ?? data?.prevClose);
                        if (Number.isFinite(prevClose) && prevClose > 0) {
                            stock.prevClose = prevClose;
                            const pctChange = ((latestPrice - prevClose) / prevClose) * 100;
                            stock.change = pctChange;
                            stock.changePercent = pctChange;
                        } else if (!Number.isFinite(stock.prevClose) || stock.prevClose <= 0) {
                            stock.change = 0;
                            stock.changePercent = null;
                        }
                        stock.quoteSource = data?.source || 'market_api';
                        stock.delayed = !!data?.delayed;
                        stock.isSimulated = false;
                    }
                    stock.isCached = true;
                    stock.cacheStale = false;
                    stock.updated_at = new Date().toISOString();
                }

                this.notifyListeners();
                return latestPrice;
            } catch (e) {
                console.error(`MarketEngine: Failed to fetch live price for ${sym}:`, e);
                const candidates = this.getSymbolCandidates(sym);
                const stock = [...this.stocks, ...this.dbOtcProducts, ...this.dbProducts, ...this.dbInsStocks]
                    .find(s => {
                        const own = this.getSymbolCandidates(s.market_symbol || s.symbol);
                        return own.some(v => candidates.includes(v));
                    });
                if (this.isInsStockProduct(stock)) {
                    const fallback = this.applyInsStockFallbackQuote(stock, { volatility: 0.0010, maxDeviation: 0.03 });
                    this.notifyListeners();
                    return fallback?.price ?? null;
                }
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
