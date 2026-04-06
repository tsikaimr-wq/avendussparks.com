console.log("馃敟 js/db.js EXECUTION START");
/**
 * User Database Utility (Supabase Backend)
 */

// --- SUPABASE CONFIGURATION (Handled in supabase.js) ---
if (!window.DB) window.DB = {};
const MARKET_CACHE_DISABLED_STORAGE_KEY = 'avendus_market_cache_disabled_until';
const MARKET_CACHE_DISABLED_TTL_MS = 60 * 60 * 1000;
const PRODUCT_PRICE_LOCKS_KEY = 'product_price_locks';
const WITHDRAWAL_CONTROL_KEY = 'withdrawal_control';

try {
    const disabledUntil = Number(window.localStorage?.getItem(MARKET_CACHE_DISABLED_STORAGE_KEY) || 0);
    if (Number.isFinite(disabledUntil) && disabledUntil > Date.now()) {
        window.DISABLE_MARKET_DB = true;
    } else if (disabledUntil) {
        window.localStorage?.removeItem(MARKET_CACHE_DISABLED_STORAGE_KEY);
    }
} catch (_) { }

window.APP_CURRENCY_CODE = 'INR';
window.APP_CURRENCY_SYMBOL = '\u20B9';
window.APP_CURRENCY_LOCALE = 'en-IN';
window.formatAppCurrency = window.formatAppCurrency || function formatAppCurrency(value, digits = 2, fallback = '-') {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return fallback;
    const sign = amount < 0 ? '-' : '';
    return `${sign}${window.APP_CURRENCY_SYMBOL}${Math.abs(amount).toLocaleString(window.APP_CURRENCY_LOCALE, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    })}`;
};
window.DB = {
    // Local Storage Keys
    CURRENT_USER_KEY: 'avendus_current_user',
    PENDING_REGISTRATION_KEY: 'avendus_pending_registration',
    USER_PROFILE_SELECT_FIELDS: 'id, mobile, email, username, auth_id, kyc, credit_score, vip, balance, invested, frozen, outstanding, full_name, id_number, address, dob, gender, withdrawal_pin, loan_enabled, created_at, csr_id, invitation_code',
    APP_CURRENCY_CODE: window.APP_CURRENCY_CODE,
    APP_CURRENCY_SYMBOL: window.APP_CURRENCY_SYMBOL,
    APP_CURRENCY_LOCALE: window.APP_CURRENCY_LOCALE,
    client: null,
    marketPriceCache: {},
    marketPriceFailUntil: {},
    marketPricePending: {},
    marketCacheDisabledLogged: false,
    MARKET_PRICE_CACHE_TTL_MS: 10000,
    MARKET_PRICE_FAIL_COOLDOWN_MS: 15000,
    MARKET_CACHE_DISABLED_STORAGE_KEY: MARKET_CACHE_DISABLED_STORAGE_KEY,
    MARKET_CACHE_DISABLED_TTL_MS: MARKET_CACHE_DISABLED_TTL_MS,
    PRODUCT_PRICE_LOCKS_KEY: PRODUCT_PRICE_LOCKS_KEY,
    WITHDRAWAL_CONTROL_KEY: WITHDRAWAL_CONTROL_KEY,
    PRODUCT_PRICE_LOCK_CACHE_TTL_MS: 10000,
    productPriceLockCache: null,
    productPriceLockCacheTs: 0,
    MARKET_SYMBOL_ALIAS: {
        KCEIL: 'KCEIL-SM.NS',
        KRISHFLRE: 'KRISHIVAL.NS',
        ZOMATO: 'ETERNAL.NS',
        NSEP: 'NSEP',
        INNOVATORGROWTH100POWERBUFFER: 'NSEP',
        INNOVATORGROWTH100POWERBUFFERETF: 'NSEP',
    },
    MARKET_SEARCH_ALIAS_RESULTS: {
        KCEIL: [{ symbol: 'KCEIL-SM.NS', name: 'KAY CEE ENERGY & INFRA L', exch: 'NSE', type: 'stock', score: 250000 }],
        KCEILNS: [{ symbol: 'KCEIL-SM.NS', name: 'KAY CEE ENERGY & INFRA L', exch: 'NSE', type: 'stock', score: 250000 }],
        KRISHFLRE: [{ symbol: 'KRISHIVAL.NS', name: 'KRISHIVAL FOODS LIMITED', exch: 'NSE', type: 'stock', score: 250000 }],
        KRISHIVALFOODSLIMITED: [{ symbol: 'KRISHIVAL.NS', name: 'KRISHIVAL FOODS LIMITED', exch: 'NSE', type: 'stock', score: 250000 }],
        ZOMATO: [{ symbol: 'ETERNAL.NS', name: 'Eternal Limited', exch: 'NSE', type: 'stock', score: 250000 }],
        ZOMATONS: [{ symbol: 'ETERNAL.NS', name: 'Eternal Limited', exch: 'NSE', type: 'stock', score: 250000 }],
        ZOMATOLIMITED: [{ symbol: 'ETERNAL.NS', name: 'Eternal Limited', exch: 'NSE', type: 'stock', score: 250000 }],
        NSEP: [{ symbol: 'NSEP', name: 'Innovator Growth-100 Power Buffer ETF', exch: 'NYSE ARCA', type: 'stock', score: 250000 }],
        INNOVATORGROWTH100POWERBUFFER: [{ symbol: 'NSEP', name: 'Innovator Growth-100 Power Buffer ETF', exch: 'NYSE ARCA', type: 'stock', score: 250000 }],
        INNOVATORGROWTH100POWERBUFFERETF: [{ symbol: 'NSEP', name: 'Innovator Growth-100 Power Buffer ETF', exch: 'NYSE ARCA', type: 'stock', score: 250000 }],
    },
    formatCurrency(value, digits = 2, fallback = '-') {
        return window.formatAppCurrency(value, digits, fallback);
    },

    isMarketCacheSchemaMissing(error) {
        const message = String(error?.message || '');
        return error?.code === 'PGRST205'
            || message.includes("Could not find the table 'public.market_cache'");
    },

    getSchemaMissingColumn(error, tableName) {
        const message = String(error?.message || '');
        const match = message.match(new RegExp(`Could not find the '([^']+)' column of '${tableName}'`, 'i'));
        return match ? match[1] : '';
    },

    sanitizeWithdrawalInsertData(withdrawalData, missingColumns = []) {
        const nextData = { ...withdrawalData };
        const missingSet = new Set(
            Array.isArray(missingColumns)
                ? missingColumns.filter(Boolean).map(column => String(column).trim())
                : []
        );

        if (!missingSet.size) return nextData;

        const bankLabel = String(withdrawalData?.bank_name || 'Bank Withdrawal').trim() || 'Bank Withdrawal';
        const fallbackMeta = [];
        const rawAccountNumber = String(withdrawalData?.account_number || '').trim();
        const accountSuffix = rawAccountNumber ? rawAccountNumber.slice(-4) : '';
        const ifsc = String(withdrawalData?.ifsc || '').trim();
        const fullName = String(withdrawalData?.full_name || '').trim();

        if (missingSet.has('account_number')) {
            delete nextData.account_number;
            if (accountSuffix) fallbackMeta.push(`A/C ****${accountSuffix}`);
        }

        if (missingSet.has('ifsc')) {
            delete nextData.ifsc;
            if (ifsc) fallbackMeta.push(`IFSC ${ifsc}`);
        }

        if (missingSet.has('full_name')) {
            delete nextData.full_name;
            if (fullName) fallbackMeta.push(fullName);
        }

        if (missingSet.has('bank_name')) {
            delete nextData.bank_name;
        } else if (fallbackMeta.length) {
            nextData.bank_name = `${bankLabel} | ${fallbackMeta.join(' | ')}`.slice(0, 240);
        }

        return nextData;
    },

    sanitizeTradeInsertData(tradeData, missingColumns = []) {
        const nextData = { ...(tradeData || {}) };
        const missingSet = new Set(
            Array.isArray(missingColumns)
                ? missingColumns.filter(Boolean).map(column => String(column).trim())
                : []
        );

        [
            'base_total_amount',
            'base_total',
            'baseAmount'
        ].forEach((column) => {
            delete nextData[column];
        });

        missingSet.forEach((column) => {
            if (column && column in nextData) {
                delete nextData[column];
            }
        });

        return nextData;
    },

    disableMarketCache(reason = '') {
        window.DISABLE_MARKET_DB = true;
        try {
            window.localStorage?.setItem(
                this.MARKET_CACHE_DISABLED_STORAGE_KEY,
                String(Date.now() + (Number(this.MARKET_CACHE_DISABLED_TTL_MS) || MARKET_CACHE_DISABLED_TTL_MS))
            );
        } catch (_) { }
        if (this.marketCacheDisabledLogged) return;
        this.marketCacheDisabledLogged = true;
        console.warn(`Market cache disabled${reason ? `: ${reason}` : ''}`);
    },

    clearMarketPriceCaches(target = null) {
        const clearAll = !target;
        const aliases = clearAll ? null : this.buildPriceLockAliases(target);

        Object.keys(this.marketPriceCache || {}).forEach((key) => {
            if (clearAll || aliases?.has(String(key || '').trim().toUpperCase())) {
                delete this.marketPriceCache[key];
            }
        });

        Object.keys(this.marketPriceFailUntil || {}).forEach((key) => {
            if (clearAll || aliases?.has(String(key || '').trim().toUpperCase())) {
                delete this.marketPriceFailUntil[key];
            }
        });

        Object.keys(this.marketPricePending || {}).forEach((key) => {
            if (clearAll || aliases?.has(String(key || '').trim().toUpperCase())) {
                delete this.marketPricePending[key];
            }
        });
    },

    getClient() {
        if (this.client) return this.client;
        if (!window.supabaseClient) {
            console.error("Supabase client not initialized.");
            return null;
        }
        this.client = window.supabaseClient;
        return this.client;
    },

    async update(table, data, match) {
        const client = this.getClient();
        if (!client) return { error: 'No client' };
        const { error } = await client.from(table).update(data).match(match);
        return { success: !error, error };
    },

    getLocalMarketApiBases() {
        const supabaseBase = (window.supabaseClient?.supabaseUrl || window.SUPABASE_URL || '').trim();
        const functionBase = supabaseBase ? `${supabaseBase.replace(/\/$/, '')}/functions/v1` : '';
        const upstreamBase = (typeof window.STOCKTV_UPSTREAM_BASE === 'string' && window.STOCKTV_UPSTREAM_BASE.trim())
            ? window.STOCKTV_UPSTREAM_BASE.trim()
            : 'https://api.avendussparks.com';
        const allowLocal = window.ALLOW_LOCAL_MARKET_API !== false;
        const configuredLocalBase = (typeof window.INDIA_MARKET_API_BASE === 'string' && window.INDIA_MARKET_API_BASE.trim())
            ? window.INDIA_MARKET_API_BASE.trim()
            : '';
        const localBase = allowLocal ? (configuredLocalBase || upstreamBase) : '';
        const preferExternal = window.PREFER_INDIA_MARKET_API_BASE !== false;
        const useEdgeFallback = window.ENABLE_SUPABASE_EDGE_FALLBACK === true;

        const ordered = [];
        if (localBase && preferExternal) ordered.push(localBase);
        if (functionBase && (!localBase || useEdgeFallback)) ordered.push(functionBase);
        if (localBase && !preferExternal) ordered.push(localBase);
        return [...new Set(ordered.filter(Boolean))];
    },

    normalizeMarketQuote(payload, symbol) {
        if (!payload || typeof payload !== 'object') return null;
        const price = Number(payload.price ?? payload.currentPrice ?? payload.lastPrice);
        if (!Number.isFinite(price)) return null;

        const prevCloseRaw = payload.previousClose ?? payload.prevClose;
        const prevClose = Number.isFinite(Number(prevCloseRaw)) ? Number(prevCloseRaw) : null;
        let change = Number(payload.change);
        if (!Number.isFinite(change) && Number.isFinite(prevClose)) {
            change = price - prevClose;
        }
        if (!Number.isFinite(change)) change = null;

        let changePercent = Number(payload.changePercent ?? payload.pChange);
        if (!Number.isFinite(changePercent) && Number.isFinite(prevClose) && prevClose !== 0 && Number.isFinite(change)) {
            changePercent = (change / prevClose) * 100;
        }
        if (Number.isFinite(changePercent) && changePercent > 20) changePercent = 20;
        if (!Number.isFinite(changePercent)) changePercent = null;

        return {
            status: 'success',
            symbol: payload.symbol || symbol,
            price,
            previousClose: prevClose,
            prevClose,
            change,
            changePercent,
            source: payload.source || 'local_market_api',
        };
    },

    doesQuoteExchangeMatchRequest(requestedSymbol, exchangeHint = '', resolvedSymbol = '') {
        const requestedExchange = this.inferMarketExchange(requestedSymbol, exchangeHint);
        const resolvedExchange = this.inferMarketExchange(resolvedSymbol || requestedSymbol, exchangeHint);
        if (!requestedExchange || !resolvedExchange) return true;
        return requestedExchange === resolvedExchange;
    },

    normalizeMarketSymbolKey(symbol) {
        const raw = String(symbol || '').trim().toUpperCase();
        if (!raw) return '';
        if (raw.startsWith('^')) return raw;

        let normalized = raw;
        if (normalized.includes(':')) {
            const parts = normalized.split(':');
            normalized = parts[parts.length - 1] || normalized;
        }

        normalized = normalized
            .replace(/\.(NS|BO|NSE|BSE|BOM)$/i, '')
            .replace(/[^A-Z0-9]/g, '');

        return normalized;
    },

    buildMarketQuoteCacheKey(symbol, exchangeHint = '') {
        const raw = String(symbol || '').trim().toUpperCase();
        if (!raw) return '';
        if (raw.startsWith('^')) return raw;

        const preferred = this.getPreferredMarketApiSymbol(raw, exchangeHint) || raw;
        const inferred = this.inferMarketExchange(preferred, exchangeHint);
        const compact = this.normalizeMarketSymbolKey(preferred) || this.normalizeMarketSymbolKey(raw) || raw;
        return inferred ? `${inferred}:${compact}` : compact;
    },

    normalizeMarketExchangeLabel(exchangeHint = '') {
        const raw = String(exchangeHint || '').trim();
        const upper = raw.toUpperCase();
        if (!upper) return '';
        if (upper === 'NSI' || upper === 'NS' || /\bNSE\b/.test(upper)) return 'NSE';
        if (upper === 'BSE' || upper === 'BOM' || /\bBSE\b/.test(upper) || upper.includes('BOMBAY')) return 'BSE';
        if (upper.includes('NYSE ARCA') || upper.includes('NYSEARCA') || upper === 'ARCA' || upper === 'PCX') return 'NYSE ARCA';
        if (upper.includes('NASDAQ')) return 'NASDAQ';
        if (upper.includes('NYSE')) return 'NYSE';
        if (upper.includes('AMEX') || upper === 'ASE') return 'AMEX';
        if (upper.includes('CBOE') || upper.includes('BATS')) return 'CBOE';
        if (upper === 'US' || upper === 'USA' || upper.includes('UNITED STATES')) return 'US';
        if (upper === 'KRX' || upper.startsWith('KRX:') || upper.includes('KOREA EXCHANGE')) return 'KRX';
        return '';
    },

    inferMarketExchange(symbol, exchangeHint = '') {
        const raw = String(symbol || '').trim().toUpperCase();
        const hint = this.normalizeMarketExchangeLabel(exchangeHint);
        if (!raw) return hint;
        if (raw.startsWith('^')) return hint;
        if (raw.startsWith('BSE:') || raw.endsWith('.BO') || raw.includes('.BSE') || raw.includes('.BOM')) return 'BSE';
        if (raw.startsWith('NSE:') || raw.endsWith('.NS') || raw.includes('.NSE') || raw.includes('.NSI')) return 'NSE';
        if (raw.startsWith('NYSEARCA:') || raw.startsWith('ARCA:') || raw.startsWith('PCX:')) return 'NYSE ARCA';
        if (raw.startsWith('NASDAQ:')) return 'NASDAQ';
        if (raw.startsWith('NYSE:')) return 'NYSE';
        if (raw.startsWith('AMEX:')) return 'AMEX';
        if (raw.startsWith('BATS:') || raw.startsWith('CBOE:')) return 'CBOE';
        if (raw.startsWith('KRX:')) return 'KRX';
        return hint;
    },

    isIndiaMarketExchange(symbol, exchangeHint = '') {
        const inferred = this.inferMarketExchange(symbol, exchangeHint);
        return inferred === 'NSE' || inferred === 'BSE';
    },

    formatMarketExchangeLabel(symbol, exchangeHint = '') {
        const inferred = this.inferMarketExchange(symbol, exchangeHint);
        if (!inferred) return '';
        if (inferred === 'NSE' || inferred === 'BSE') return `${inferred}  - IN`;
        return inferred;
    },

    getMarketApiSymbolCandidates(symbol, exchangeHint = '') {
        const raw = String(symbol || '').trim().toUpperCase();
        if (!raw) return [];

        const hint = this.normalizeMarketExchangeLabel(exchangeHint);
        const candidates = [];
        const push = (value) => {
            const normalized = String(value || '').trim().toUpperCase();
            if (normalized && !candidates.includes(normalized)) {
                candidates.push(normalized);
            }
        };

        const addVariants = (value, variantHint = '') => {
            let input = String(value || '').trim().toUpperCase();
            if (!input) return;
            if (input.startsWith('^')) {
                push(input);
                return;
            }

            let ticker = input;
            let explicitExchange = '';

            if (input.includes(':')) {
                const parts = input.split(':');
                explicitExchange = this.normalizeMarketExchangeLabel(parts[0]);
                ticker = parts[parts.length - 1] || input;
            }

            if (ticker.endsWith('.NS')) {
                explicitExchange = explicitExchange || 'NSE';
                ticker = ticker.slice(0, -3);
                push(`${ticker}.NS`);
            } else if (ticker.endsWith('.BO')) {
                explicitExchange = explicitExchange || 'BSE';
                ticker = ticker.slice(0, -3);
                push(`${ticker}.BO`);
            } else if (ticker.endsWith('.NSE')) {
                explicitExchange = explicitExchange || 'NSE';
                ticker = ticker.slice(0, -4);
                push(`${ticker}.NS`);
            } else if (ticker.endsWith('.BSE') || ticker.endsWith('.BOM')) {
                explicitExchange = explicitExchange || 'BSE';
                ticker = ticker.split('.')[0];
                push(`${ticker}.BO`);
            } else if (ticker.includes('.')) {
                ticker = ticker.split('.')[0];
                push(input);
            }

            const compact = ticker.replace(/[^A-Z0-9]/g, '');
            if (!compact) return;

            const preferredExchange = explicitExchange || this.inferMarketExchange(input, variantHint);

            if (preferredExchange === 'BSE') {
                push(`${compact}.BO`);
                push(`${compact}.NS`);
                push(`BSE:${compact}`);
                push(`NSE:${compact}`);
                push(compact);
                return;
            }

            if (preferredExchange === 'NYSE ARCA') {
                push(compact);
                push(input);
                push(`ARCA:${compact}`);
                push(`NYSEARCA:${compact}`);
                return;
            }

            if (preferredExchange) {
                push(compact);
                push(input);
                if (preferredExchange !== 'US') {
                    push(`${preferredExchange.replace(/\s+/g, '')}:${compact}`);
                }
                return;
            }

            push(compact);
            push(`${compact}.NS`);
            push(`${compact}.BO`);
            push(`NSE:${compact}`);
            push(`BSE:${compact}`);
        };

        const alias = this.MARKET_SYMBOL_ALIAS[this.normalizeMarketSymbolKey(raw)];
        if (alias) addVariants(alias, hint);
        addVariants(raw, hint);

        return candidates;
    },

    getPreferredMarketApiSymbol(symbol, exchangeHint = '') {
        const candidates = this.getMarketApiSymbolCandidates(symbol, exchangeHint);
        if (!Array.isArray(candidates) || candidates.length === 0) return '';

        const inferred = this.inferMarketExchange(symbol, exchangeHint);
        if (inferred === 'BSE') {
            const bse = candidates.find((value) => /\.BO$/i.test(String(value || '')));
            if (bse) return bse;
        }

        if (inferred === 'NSE') {
            const nse = candidates.find((value) => /\.NS$/i.test(String(value || '')));
            if (nse) return nse;
        }

        return candidates[0] || '';
    },

    getYahooSymbolCandidates(symbol) {
        return this.getMarketApiSymbolCandidates(symbol);
    },

    normalizeSearchLoose(value) {
        return String(value || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
    },

    buildMarketSearchQueries(query) {
        const raw = String(query || '').trim();
        if (!raw) return [];

        const queries = [];
        const push = (value) => {
            const normalized = String(value || '').trim();
            if (normalized && !queries.includes(normalized)) {
                queries.push(normalized);
            }
        };

        push(raw);

        const upper = raw.toUpperCase();
        if (upper.startsWith('NSE:') || upper.startsWith('BSE:')) {
            push(upper.split(':').pop());
        }
        if (upper.endsWith('.NS') || upper.endsWith('.BO')) {
            push(upper.slice(0, -3));
        }

        const alias = this.MARKET_SYMBOL_ALIAS[this.normalizeMarketSymbolKey(raw)];
        if (alias) {
            push(alias);
            push(alias.replace(/\.(NS|BO)$/i, ''));
        }

        return queries;
    },

    parseEmbeddedJson(text) {
        const payloadText = String(text || '').trim();
        if (!payloadText) return null;

        const candidates = [payloadText];
        const firstBrace = payloadText.indexOf('{');
        const lastBrace = payloadText.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            candidates.push(payloadText.slice(firstBrace, lastBrace + 1));
        }

        const markdownMarker = 'Markdown Content:';
        const markerIndex = payloadText.indexOf(markdownMarker);
        if (markerIndex >= 0) {
            const markdownBody = payloadText.slice(markerIndex + markdownMarker.length).trim();
            candidates.push(markdownBody);
            const mdFirstBrace = markdownBody.indexOf('{');
            const mdLastBrace = markdownBody.lastIndexOf('}');
            if (mdFirstBrace >= 0 && mdLastBrace > mdFirstBrace) {
                candidates.push(markdownBody.slice(mdFirstBrace, mdLastBrace + 1));
            }
        }

        for (const candidate of candidates) {
            try {
                return JSON.parse(candidate);
            } catch (_) { }
        }
        return null;
    },

    normalizeYahooSearchExchange(quote) {
        const raw = String(quote?.exchDisp || quote?.exchange || '').trim();
        return this.normalizeMarketExchangeLabel(raw) || raw;
    },

    normalizeYahooSearchRows(payload, limit = 20) {
        const quotes = Array.isArray(payload?.quotes) ? payload.quotes : [];
        const rows = [];
        const seen = new Set();

        for (const quote of quotes) {
            const symbol = String(quote?.symbol || '').trim().toUpperCase();
            if (!symbol) continue;

            const quoteType = String(quote?.quoteType || quote?.typeDisp || '').trim().toUpperCase();
            if (quoteType && !['EQUITY', 'ETF', 'INDEX', 'MUTUALFUND'].includes(quoteType)) continue;

            const key = `${symbol}|${quoteType || 'UNKNOWN'}`;
            if (seen.has(key)) continue;
            seen.add(key);

            rows.push({
                symbol,
                name: quote?.longname || quote?.shortname || symbol,
                exch: this.normalizeYahooSearchExchange(quote),
                type: quoteType === 'INDEX' ? 'index' : (quoteType === 'MUTUALFUND' ? 'fund' : 'stock'),
                score: Number(quote?.score) || 0,
            });

            if (rows.length >= limit) break;
        }

        return rows;
    },

    async searchStocksViaJina(query, broad = false) {
        const rawQuery = String(query || '').trim();
        if (!rawQuery) return [];

        const limit = broad ? 40 : 20;
        const rows = [];
        const seen = new Set();
        const append = (items) => {
            for (const item of (items || [])) {
                const symbol = String(item?.symbol || '').trim().toUpperCase();
                if (!symbol || seen.has(symbol)) continue;
                seen.add(symbol);
                rows.push(item);
                if (rows.length >= limit) return true;
            }
            return false;
        };

        const aliasKey = this.normalizeSearchLoose(rawQuery);
        if (append(this.MARKET_SEARCH_ALIAS_RESULTS[aliasKey] || [])) {
            return rows;
        }

        const queries = this.buildMarketSearchQueries(rawQuery);
        for (const currentQuery of queries) {
            try {
                const url = new URL('https://r.jina.ai/http://query1.finance.yahoo.com/v1/finance/search');
                url.searchParams.set('q', currentQuery);
                url.searchParams.set('quotesCount', String(Math.max(limit * 2, 10)));
                url.searchParams.set('newsCount', '0');
                url.searchParams.set('listsCount', '0');
                url.searchParams.set('enableFuzzyQuery', 'false');

                const response = await fetch(url.toString(), {
                    cache: 'no-store',
                    headers: {
                        Accept: 'text/plain, text/markdown, */*'
                    }
                });
                if (!response.ok) continue;

                const payload = this.parseEmbeddedJson(await response.text());
                if (append(this.normalizeYahooSearchRows(payload, limit))) {
                    return rows;
                }
            } catch (e) {
                console.error("Jina stock search failed:", e);
            }
        }

        return rows;
    },

    async fetchYahooDirectQuote(symbol) {
        // Browser-side direct Yahoo requests frequently fail due to CORS.
        // Keep this function for compatibility but always rely on worker/cache fallbacks.
        return null;
    },

    async fetchMarketCacheQuote(symbol) {
        if (window.DISABLE_MARKET_DB === true) return null;
        const client = this.getClient();
        if (!client) return null;
        const candidates = this.getMarketApiSymbolCandidates(symbol);
        for (const sym of candidates) {
            try {
                const { data, error } = await client
                    .from("market_cache")
                    .select("price, symbol")
                    .eq("symbol", sym)
                    .maybeSingle();
                if (error) {
                    if (this.isMarketCacheSchemaMissing(error)) {
                        this.disableMarketCache(error.message);
                        return null;
                    }
                    continue;
                }
                if (!data) continue;
                const price = Number(data.price);
                if (!Number.isFinite(price) || price <= 0) continue;
                return {
                    status: 'success',
                    symbol: data.symbol || sym,
                    price,
                    previousClose: null,
                    prevClose: null,
                    change: null,
                    changePercent: null,
                    source: 'market_cache',
                    delayed: true
                };
            } catch (_) { }
        }
        return null;
    },

    async fetchLocalMarketQuote(symbol, name = '') {
        const sym = String(symbol || '').trim();
        const nm = String(name || '').trim();
        if (!sym) return null;
        const anonKey = window.SUPABASE_ANON_KEY || '';
        const candidates = this.getMarketApiSymbolCandidates(sym, nm);
        for (const candidate of candidates) {
            for (const base of this.getLocalMarketApiBases()) {
                try {
                    const baseUrl = String(base || '').replace(/\/$/, '');
                    const isFnBase = /\/functions\/v1$/i.test(baseUrl);

                    if (isFnBase) {
                        const headers = { 'Content-Type': 'application/json' };
                        if (anonKey) {
                            headers['apikey'] = anonKey;
                            headers['Authorization'] = `Bearer ${anonKey}`;
                        }
                        const response = await fetch(`${baseUrl}/get-market-price`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ symbol: candidate, name: nm || undefined }),
                            cache: 'no-store'
                        });
                        if (!response.ok) continue;
                        const payload = await response.json();
                        const normalized = this.normalizeMarketQuote(payload, candidate);
                        if (normalized && this.doesQuoteExchangeMatchRequest(sym, nm, normalized.symbol || candidate)) {
                            return normalized;
                        }
                        continue;
                    }

                    const url = `${baseUrl}/quote?symbol=${encodeURIComponent(candidate)}${nm ? `&name=${encodeURIComponent(nm)}` : ''}`;
                    const response = await fetch(url, { cache: 'no-store' });
                    if (!response.ok) continue;
                    const payload = await response.json();
                    const normalized = this.normalizeMarketQuote(payload, candidate);
                    if (normalized && this.doesQuoteExchangeMatchRequest(sym, nm, normalized.symbol || candidate)) {
                        return normalized;
                    }
                } catch (_) { }
            }
        }
        return null;
    },

    parsePlatformSettingObject(value) {
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
    },

    normalizeWithdrawalControl(value) {
        if (typeof value === 'boolean') {
            return { enabled: value };
        }

        const parsed = this.parsePlatformSettingObject(value);
        if (!parsed || !Object.keys(parsed).length) {
            return { enabled: true };
        }

        const rawStatus = String(parsed.status || '').trim().toLowerCase();
        const explicitEnabled = parsed.enabled;
        const explicitLocked = parsed.locked;
        let enabled = true;

        if (typeof explicitEnabled === 'boolean') {
            enabled = explicitEnabled;
        } else if (typeof explicitLocked === 'boolean') {
            enabled = !explicitLocked;
        } else if (rawStatus) {
            enabled = rawStatus !== 'disabled' && rawStatus !== 'locked' && rawStatus !== 'off';
        }

        return {
            enabled,
            updated_at: parsed.updated_at || null
        };
    },

    async getWithdrawalControl() {
        const rawValue = await this.getPlatformSettings(this.WITHDRAWAL_CONTROL_KEY);
        return this.normalizeWithdrawalControl(rawValue);
    },

    async isWithdrawalEnabled() {
        const control = await this.getWithdrawalControl();
        return control.enabled !== false;
    },

    async getProductPriceLockMap(force = false) {
        const now = Date.now();
        if (!force && this.productPriceLockCache && (now - this.productPriceLockCacheTs) < this.PRODUCT_PRICE_LOCK_CACHE_TTL_MS) {
            return this.productPriceLockCache;
        }

        const rawValue = await this.getPlatformSettings(this.PRODUCT_PRICE_LOCKS_KEY);
        this.productPriceLockCache = this.parsePlatformSettingObject(rawValue);
        this.productPriceLockCacheTs = now;
        return this.productPriceLockCache;
    },

    buildPriceLockAliases(target) {
        const aliases = new Set();
        const addAlias = (value) => {
            const raw = String(value || '').trim();
            if (!raw) return;
            aliases.add(raw.toUpperCase());
            const normalized = this.normalizeMarketSymbolKey(raw);
            if (normalized) aliases.add(normalized);
            const candidates = this.getMarketApiSymbolCandidates(raw);
            candidates.forEach((candidate) => {
                const upper = String(candidate || '').trim().toUpperCase();
                if (upper) aliases.add(upper);
                const compact = this.normalizeMarketSymbolKey(candidate);
                if (compact) aliases.add(compact);
            });
        };

        if (typeof target === 'string' || typeof target === 'number') {
            addAlias(target);
        } else if (target && typeof target === 'object') {
            [target.id, target.product_id, target.symbol, target.market_symbol].forEach(addAlias);
        }

        return aliases;
    },

    findProductPriceLockEntry(target, lockMap = null) {
        const resolvedMap = lockMap || this.productPriceLockCache || {};
        const aliases = this.buildPriceLockAliases(target);
        if (!aliases.size) return null;

        for (const [key, entry] of Object.entries(resolvedMap || {})) {
            if (!entry?.locked) continue;
            const entryAliases = this.buildPriceLockAliases({ ...entry, id: entry.id || key });
            if ([...entryAliases].some(alias => aliases.has(alias))) {
                return entry;
            }
        }

        return null;
    },

    buildLockedMarketQuote(target, lockMap = null) {
        const entry = this.findProductPriceLockEntry(target, lockMap);
        const lockedPrice = Number(entry?.locked_price ?? entry?.price);
        if (!entry?.locked || !Number.isFinite(lockedPrice) || lockedPrice <= 0) return null;

        const symbol = typeof target === 'object'
            ? String(target?.market_symbol || target?.symbol || entry?.market_symbol || entry?.symbol || '').trim()
            : String(target || entry?.market_symbol || entry?.symbol || '').trim();

        return {
            status: 'success',
            symbol: symbol || String(entry?.market_symbol || entry?.symbol || '').trim(),
            price: lockedPrice,
            previousClose: lockedPrice,
            prevClose: lockedPrice,
            change: null,
            changePercent: null,
            source: 'manual_price_lock',
            delayed: true,
            locked: true,
            priceLocked: true,
            locked_price: lockedPrice
        };
    },

    async getMarketPrice(symbol, name = '', options = {}) {
        const client = this.getClient();
        const sym = String(symbol || '').trim();
        if (!sym) return { status: 'error', message: 'Invalid symbol' };
        const ignorePriceLock = options?.ignorePriceLock === true;

        if (!ignorePriceLock) {
            const priceLockMap = await this.getProductPriceLockMap();
            const lockedQuote = this.buildLockedMarketQuote(sym, priceLockMap);
            if (lockedQuote) {
                const lockedCacheKey = this.buildMarketQuoteCacheKey(sym, name) || sym.toUpperCase();
                this.marketPriceCache[lockedCacheKey] = { ts: Date.now(), data: lockedQuote };
                return lockedQuote;
            }
        }

        const now = Date.now();
        const cacheKey = this.buildMarketQuoteCacheKey(sym, name) || sym.toUpperCase();
        const cached = this.marketPriceCache[cacheKey];
        if (cached && (now - cached.ts) < this.MARKET_PRICE_CACHE_TTL_MS) {
            const isLockedCachedQuote = !!(cached.data?.priceLocked || cached.data?.locked || String(cached.data?.source || '').trim().toLowerCase() === 'manual_price_lock');
            if (!(ignorePriceLock && isLockedCachedQuote)) {
                return cached.data;
            }
        }
        if (ignorePriceLock && cached) {
            delete this.marketPriceCache[cacheKey];
        }
        const blockedUntil = this.marketPriceFailUntil[cacheKey] || 0;
        if (blockedUntil > now) {
            return { status: 'error', message: 'Market price cooldown' };
        }

        if (this.marketPricePending[cacheKey]) {
            const pendingResult = await this.marketPricePending[cacheKey];
            const isLockedPendingQuote = !!(pendingResult?.priceLocked || pendingResult?.locked || String(pendingResult?.source || '').trim().toLowerCase() === 'manual_price_lock');
            if (!(ignorePriceLock && isLockedPendingQuote)) {
                return pendingResult;
            }
        }

        const fetchPromise = (async () => {
            const [localQuote, cacheQuote] = await Promise.all([
                this.fetchLocalMarketQuote(sym, name),
                this.fetchMarketCacheQuote(sym)
            ]);

            if (localQuote && cacheQuote) {
                const localPrice = Number(localQuote.price);
                const cachePrice = Number(cacheQuote.price);
                if (Number.isFinite(localPrice) && localPrice > 0 && Number.isFinite(cachePrice) && cachePrice > 0) {
                    const deviation = Math.abs(localPrice - cachePrice) / cachePrice;
                    if (deviation > 0.6) {
                        return { ...cacheQuote, source: 'market_cache_override' };
                    }
                }
            }

            if (localQuote) return localQuote;
            if (cacheQuote) return cacheQuote;

            return { status: 'error', message: 'Market price unavailable' };
        })();

        this.marketPricePending[cacheKey] = fetchPromise;
        try {
            const result = await fetchPromise;
            if (result && result.status !== 'error') {
                this.marketPriceCache[cacheKey] = { ts: Date.now(), data: result };
                return result;
            }
            this.marketPriceFailUntil[cacheKey] = Date.now() + this.MARKET_PRICE_FAIL_COOLDOWN_MS;
            console.warn("Market price fetch failed for symbol:", sym);
            return result || { status: 'error', message: 'Market price unavailable' };
        } finally {
            delete this.marketPricePending[cacheKey];
        }
    },

    async searchStocks(query, broad = false) {
        const client = this.getClient();
        const normalizedQuery = String(query || '').trim();
        if (!normalizedQuery) return [];
        let lastError = null;

        if (client) {
            try {
                const { data, error } = await client.functions.invoke('search-stocks', {
                    body: { query: normalizedQuery },
                    headers: { 'x-broad-search': broad ? 'true' : 'false' }
                });

                if (error) throw error;
                if (Array.isArray(data) && data.length > 0) {
                    return data;
                }
            } catch (e) {
                lastError = e;
                console.error("Supabase stock search failed, falling back to market API:", e);
            }
        }

        const bases = this.getLocalMarketApiBases();
        for (const baseUrl of bases) {
            try {
                const limit = broad ? 40 : 20;
                const response = await fetch(
                    `${baseUrl}/search?query=${encodeURIComponent(normalizedQuery)}&limit=${limit}`,
                    { cache: 'no-store' }
                );
                if (!response.ok) continue;
                const payload = await response.json();
                const rows = Array.isArray(payload)
                    ? payload
                    : (payload.results || payload.matches || payload.data || []);
                if (Array.isArray(rows) && rows.length > 0) {
                    return rows;
                }
            } catch (e) {
                lastError = e;
                console.error("Market API stock search failed:", e);
            }
        }

        try {
            const jinaRows = await this.searchStocksViaJina(normalizedQuery, broad);
            if (Array.isArray(jinaRows) && jinaRows.length > 0) {
                return jinaRows;
            }
        } catch (e) {
            lastError = e;
            console.error("Jina fallback stock search failed:", e);
        }

        if (lastError) {
            console.error("Error searching stocks:", lastError);
        }
        return [];
    },

    // --- AUTHENTICATION ---
    normalizeMobile(value) {
        const digits = String(value || '').replace(/\D/g, '');
        if (!digits) return '';
        return digits.length > 10 ? digits.slice(-10) : digits;
    },

    buildMobileCandidates(value) {
        const raw = String(value || '').trim();
        const digits = String(value || '').replace(/\D/g, '');
        const normalized = this.normalizeMobile(value);
        const candidates = new Set();

        const addCandidate = (candidate) => {
            const text = String(candidate || '').trim();
            if (text) candidates.add(text);
        };

        addCandidate(raw);
        addCandidate(digits);
        addCandidate(normalized);

        if (normalized) {
            addCandidate(`+91${normalized}`);
            addCandidate(`91${normalized}`);
        }

        if (raw.startsWith('+')) addCandidate(raw.slice(1));
        if (digits && !digits.startsWith('91')) addCandidate(`91${digits}`);
        if (digits.startsWith('91') && digits.length > 10) addCandidate(digits.slice(2));
        if (digits.length > 10) addCandidate(digits.slice(-10));

        return [...candidates];
    },

    normalizeKycStatus(status) {
        return String(status || '').trim().toLowerCase();
    },

    isKycApproved(status) {
        return this.normalizeKycStatus(status) === 'approved';
    },

    async login(identifier, password) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        const rawIdentifier = String(identifier || '').trim();
        const isEmail = rawIdentifier.includes('@');
        let data = null;
        let error = null;

        if (isEmail) {
            ({ data, error } = await client
                .from('users')
                .select('*')
                .eq('email', rawIdentifier)
                .eq('password', password)
                .maybeSingle());
        } else {
            const candidates = this.buildMobileCandidates(rawIdentifier);
            if (candidates.length === 0) {
                return { success: false, message: 'Invalid credentials.' };
            }

            ({ data, error } = await client
                .from('users')
                .select('*')
                .in('mobile', candidates)
                .eq('password', password)
                .maybeSingle());
        }

        if (error || !data) {
            return { success: false, message: 'Invalid credentials.' };
        }

        const normalizedKyc = this.normalizeKycStatus(data?.kyc);
        const requiresKycResubmission = normalizedKyc === 'rejected';
        if (!this.isKycApproved(normalizedKyc) && !requiresKycResubmission) {
            return {
                success: false,
                code: 'KYC_PENDING',
                message: 'KYC verification is under review. Please wait while it is being reviewed before logging in.',
                user: data
            };
        }

        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(data));

        // --- AUTOMATIC CREDIT ALERT (Instruction 4) ---
        if (data.credit_score < 90 && !sessionStorage.getItem('credit_alert_shown')) {
            try {
                // Check if already notified in this session to avoid duplicates
                const { data: notices } = await client
                    .from('messages')
                    .select('id')
                    .eq('user_id', data.id)
                    .eq('sender', 'System')
                    .ilike('message', '%credit score is below%')
                    .limit(1);

                if (!notices || notices.length === 0) {
                    await this.sendNotice(data.id, "Credit Score Alert",
                        JSON.stringify({
                            title: "Credit Score Alert",
                            message: "Your credit score is below the recommended level. Please maintain at least 90 credit points.",
                            is_notification: true
                        })
                    );
                }
                sessionStorage.setItem('credit_alert_shown', 'true');
            } catch (e) { console.error("Credit alert error:", e); }
        }

        return {
            success: true,
            user: data,
            requiresKycResubmission,
            kycStatus: normalizedKyc,
            message: requiresKycResubmission
                ? 'Your previous KYC submission was rejected. Please resubmit your documents.'
                : undefined
        };
    },

    normalizeInvitationCode(invitationCode) {
        let value = String(invitationCode || '');
        try {
            value = value.normalize('NFKC');
        } catch (_) { }

        return value
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .trim()
            .replace(/\s+/g, '')
            .replace(/[^0-9a-z]/gi, '')
            .toUpperCase();
    },

    buildInvitationCodeCandidates(invitationCode) {
        let raw = String(invitationCode || '');
        try {
            raw = raw.normalize('NFKC');
        } catch (_) { }

        const trimmed = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        const compact = trimmed.replace(/\s+/g, '');
        const alphaNumeric = compact.replace(/[^0-9a-z]/gi, '');
        const digitsOnly = compact.replace(/\D/g, '');

        return [...new Set([
            this.normalizeInvitationCode(raw),
            this.normalizeInvitationCode(trimmed),
            this.normalizeInvitationCode(compact),
            this.normalizeInvitationCode(alphaNumeric),
            digitsOnly
        ].filter(Boolean))];
    },

    isCsrRole(role) {
        return String(role || '').trim().toLowerCase() === 'csr';
    },

    isActiveAdminStatus(status) {
        const raw = String(status ?? '').trim();
        if (!raw) return true;
        const normalized = raw.toLowerCase();
        const activeSet = new Set([
            'active', 'enabled', 'enable', 'normal', 'ok', 'valid', 'online',
            '1', 'true', 'yes',
            'ACTIVE', 'ENABLED',
            '姝ｅ父', '鍚敤', '鍟熺敤', '娲昏穬', '娲昏簫'
        ]);
        return activeSet.has(raw) || activeSet.has(normalized);
    },

    async validateInvitationCode(invitationCode) {
        const client = this.getClient();
        if (!client) return { success: false, message: "Database connecting..." };

        const normalizedCode = this.normalizeInvitationCode(invitationCode);
        if (!normalizedCode) {
            return { success: false, message: "Invitation code is required." };
        }

        try {
            const candidates = this.buildInvitationCodeCandidates(invitationCode);
            const selectColumns = 'id, status, role, invitation_code';
            const matchesCandidate = (value) => candidates.includes(this.normalizeInvitationCode(value));

            const { data: rows, error } = await client
                .from('admins')
                .select(selectColumns)
                .in('invitation_code', candidates)
                .limit(20);

            if (error) throw error;

            let csr = (rows || []).find(row =>
                this.isCsrRole(row.role) &&
                this.isActiveAdminStatus(row.status) &&
                matchesCandidate(row.invitation_code)
            );

            if (!csr) {
                const { data: allAdmins, error: allAdminsError } = await client
                    .from('admins')
                    .select(selectColumns)
                    .not('invitation_code', 'is', null)
                    .limit(500);

                if (allAdminsError) throw allAdminsError;

                csr = (allAdmins || []).find(row =>
                    this.isCsrRole(row.role) &&
                    this.isActiveAdminStatus(row.status) &&
                    matchesCandidate(row.invitation_code)
                );
            }

            if (!csr) {
                const { data: linkedUsers, error: linkedUsersError } = await client
                    .from('users')
                    .select('csr_id, invitation_code')
                    .in('invitation_code', candidates)
                    .not('csr_id', 'is', null)
                    .limit(50);

                if (linkedUsersError) throw linkedUsersError;

                const matchedUser = (linkedUsers || []).find(row => matchesCandidate(row.invitation_code));
                if (matchedUser?.csr_id) {
                    const { data: adminById, error: adminByIdError } = await client
                        .from('admins')
                        .select(selectColumns)
                        .eq('id', matchedUser.csr_id)
                        .maybeSingle();

                    if (adminByIdError) throw adminByIdError;

                    if (adminById && this.isCsrRole(adminById.role) && this.isActiveAdminStatus(adminById.status)) {
                        csr = {
                            ...adminById,
                            invitation_code: adminById.invitation_code || matchedUser.invitation_code
                        };
                    }
                }
            }

            if (!csr) {
                return { success: false, message: "Invalid or inactive invitation code." };
            }

            return {
                success: true,
                csr,
                normalizedCode: this.normalizeInvitationCode(csr.invitation_code || normalizedCode)
            };
        } catch (e) {
            console.error("DB: Error during invitation validation:", e);
            return { success: false, message: "System error during invitation validation." };
        }
    },

    async register(mobile, password, email = null, authId = null, invitationCode = null) {
        const client = this.getClient();
        const normalizedMobile = this.normalizeMobile(mobile);
        const insertData = {
            password,
            balance: 0,
            frozen: 0,
            invested: 0,
            outstanding: 0,
            kyc: 'NotSubmitted'
        };

        if (mobile && !normalizedMobile) {
            return { success: false, message: "Please enter a valid mobile number." };
        }

        if (mobile) insertData.mobile = normalizedMobile;
        if (email) insertData.email = email;
        if (authId) insertData.auth_id = authId;

        // CSR Linkage Logic (STRICT ENFORCEMENT)
        if (!invitationCode) {
            return { success: false, message: "Invitation code is strictly required for registration." };
        }

        const invitationCheck = await this.validateInvitationCode(invitationCode);
        if (!invitationCheck.success || !invitationCheck.csr) {
            return { success: false, message: invitationCheck.message || "Invalid or inactive invitation code." };
        }
        insertData.csr_id = invitationCheck.csr.id;
        insertData.invitation_code = invitationCheck.normalizedCode;
        console.log("DB: CSR validated and linked:", invitationCheck.csr.id);

        // If the auth user already has an app profile, reuse/update it instead of inserting a duplicate row.
        if (authId) {
            const { data: existingByAuth, error: existingByAuthErr } = await client
                .from('users')
                .select('*')
                .eq('auth_id', authId)
                .maybeSingle();

            if (!existingByAuthErr && existingByAuth) {
                const patch = {};
                if (email && !existingByAuth.email) patch.email = email;
                if (normalizedMobile && !existingByAuth.mobile) patch.mobile = normalizedMobile;
                if (!existingByAuth.password) patch.password = password;
                if (!existingByAuth.csr_id) patch.csr_id = invitationCheck.csr.id;
                if (!existingByAuth.invitation_code) patch.invitation_code = invitationCheck.normalizedCode;
                if (!existingByAuth.kyc) patch.kyc = 'NotSubmitted';

                let finalUser = existingByAuth;
                if (Object.keys(patch).length > 0) {
                    const { data: updatedByAuth, error: updateByAuthErr } = await client
                        .from('users')
                        .update(patch)
                        .eq('id', existingByAuth.id)
                        .select()
                        .single();
                    if (updateByAuthErr) {
                        return { success: false, message: updateByAuthErr.message };
                    }
                    finalUser = updatedByAuth || existingByAuth;
                }

                localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(finalUser));
                return { success: true, user: finalUser };
            }
        }

        // STRICT PRE-REGISTRATION DUPLICATE CHECK (SEPARATE)
        if (email) {
            const { data: existingEmail } = await client
                .from('users')
                .select('id')
                .eq('email', email)
                .limit(1);
            if (existingEmail && existingEmail.length > 0) {
                showAlert("warning", "This email is already registered.");
                return { success: false, message: "This email is already registered." };
            }
        }

        if (mobile) {
            const mobileCandidates = this.buildMobileCandidates(mobile);
            const { data: existingPhone } = await client
                .from('users')
                .select('id')
                .in('mobile', mobileCandidates)
                .limit(1);
            if (existingPhone && existingPhone.length > 0) {
                showAlert("warning", "This mobile number is already registered.");
                return { success: false, message: "This mobile number is already registered." };
            }
        }

        const { data, error } = await client
            .from('users')
            .insert([insertData])
            .select()
            .maybeSingle();

        if (error) {
            console.error("Registration Error:", error);
            return { success: false, message: error.message };
        }

        // Auto-login after registration
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(data));

        return { success: true, user: data };
    },

    // --- SUPABASE OTP AUTH ---
    async sendEmailOtp(email, registrationData = null, shouldCreateUser = true) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        const authRedirectBase = (() => {
            const origin = String(window?.location?.origin || '').trim().replace(/\/$/, '');
            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
            return 'https://avendussparks.com';
        })();
        const emailRedirectTo = `${authRedirectBase}/login.html`;
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedMobile = this.normalizeMobile(registrationData?.mobile || '');
        const normalizedInviteCode = this.normalizeInvitationCode(registrationData?.inviteCode || '');
        const regPassword = String(registrationData?.password || '').trim();

        const metadata = {};
        if (normalizedEmail) metadata.reg_email = normalizedEmail;
        if (normalizedMobile) metadata.reg_mobile = normalizedMobile;
        if (normalizedInviteCode) metadata.reg_invite_code = normalizedInviteCode;
        if (regPassword) metadata.reg_password = regPassword;

        const otpOptions = {
            shouldCreateUser: shouldCreateUser !== false,
            emailRedirectTo
        };
        if (Object.keys(metadata).length > 0) {
            otpOptions.data = metadata;
        }

        console.log("Supabase sendEmailOtp for:", email, "redirect:", emailRedirectTo);
        const { error } = await client.auth.signInWithOtp({
            email: email,
            options: otpOptions
        });

        if (error) {
            console.error("Supabase OTP Send Error:", error);
            return { success: false, message: error.message };
        }

        return { success: true };
    },

    async verifyEmailOtp(email, token) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        console.log("Supabase verifyEmailOtp for:", email);
        const { data, error } = await client.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });

        if (error) {
            console.error("Supabase OTP Verify Error:", error);
            return { success: false, message: error.message };
        }

        return { success: true, authId: data?.user?.id };
    },

    getAuthRedirectBase() {
        const origin = String(window?.location?.origin || '').trim().replace(/\/$/, '');
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
        return 'https://avendussparks.com';
    },

    async sendPasswordResetEmail(email) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (!normalizedEmail) {
            return { success: false, message: 'Please enter a valid email address.' };
        }

        const { error } = await client.auth.signInWithOtp({
            email: normalizedEmail,
            options: {
                shouldCreateUser: false,
                emailRedirectTo: `${this.getAuthRedirectBase()}/login.html`,
                data: {
                    password_reset: true,
                    reg_email: normalizedEmail
                }
            }
        });

        if (error) {
            console.error('Supabase password reset OTP error:', error);
            return { success: false, message: error.message };
        }

        return { success: true };
    },

    async verifyPasswordResetOtp(email, token) {
        return this.verifyEmailOtp(email, token);
    },

    async completeEmailPasswordReset(newPassword) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        const normalizedPassword = String(newPassword || '').trim();
        if (normalizedPassword.length < 6) {
            return { success: false, message: 'Password must be at least 6 characters.' };
        }

        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        const sessionUser = sessionData?.session?.user || null;
        if (sessionError || !sessionUser) {
            return { success: false, message: 'Password reset session has expired. Please use the latest email link again.' };
        }

        const { error: authError } = await client.auth.updateUser({ password: normalizedPassword });
        if (authError) {
            console.error('Supabase password update error:', authError);
            return { success: false, message: authError.message };
        }

        let profile = null;
        let updateError = null;
        const normalizedEmail = String(sessionUser.email || '').trim().toLowerCase();

        if (sessionUser.id) {
            const response = await client
                .from('users')
                .update({ password: normalizedPassword })
                .eq('auth_id', sessionUser.id)
                .select('*')
                .maybeSingle();
            if (!response.error && response.data) profile = response.data;
            else updateError = response.error || updateError;
        }

        if (!profile && normalizedEmail) {
            const response = await client
                .from('users')
                .update({ password: normalizedPassword })
                .eq('email', normalizedEmail)
                .select('*')
                .maybeSingle();
            if (!response.error && response.data) profile = response.data;
            else updateError = response.error || updateError;
        }

        if (!profile) {
            console.error('Profile password sync failed after email reset:', updateError);
            return { success: false, message: 'Password email verified, but profile sync failed. Please contact support.' };
        }

        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(profile));
        return { success: true, user: profile };
    },

    // --- MOBILE OTP (Real Supabase Auth) ---
    async sendMobileOtp(mobile) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        // Format mobile number: Ensure it has + prefix. Assuming input is strict or handling it here.
        // User input often excludes +91 if hardcoded in UI. 
        // We'll rely on the UI passing the full number with country code OR prepend it if needed.
        // For now, assume UI passes full number with +, or we handle it in UI.

        console.log("Supabase sendMobileOtp for:", mobile);
        const { error } = await client.auth.signInWithOtp({
            phone: mobile
        });

        if (error) {
            console.error("Supabase OTP Send Error:", error);
            return { success: false, message: error.message };
        }

        return { success: true };
    },

    async verifyMobileOtp(mobile, token) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        console.log("Supabase verifyMobileOtp for:", mobile);
        const { data, error } = await client.auth.verifyOtp({
            phone: mobile,
            token: token,
            type: 'sms'
        });

        if (error) {
            console.error("Supabase OTP Verify Error:", error);
            return { success: false, message: error.message };
        }

        return { success: true, authId: data?.user?.id };
    },

    async resetPassword(mobile, newPassword) {
        const client = this.getClient();
        const { data, error } = await client
            .from('users')
            .update({ password: newPassword })
            .eq('mobile', mobile);

        if (error) return { success: false, message: error.message };
        return { success: true };
    },

    getCurrentUser() {
        const user = localStorage.getItem(this.CURRENT_USER_KEY);
        return user ? JSON.parse(user) : null;
    },

    getPendingRegistrationData() {
        try {
            const raw = localStorage.getItem(this.PENDING_REGISTRATION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn("DB: Failed to parse pending registration data:", error);
            return null;
        }
    },

    getUserAvatarSettingKey(userId) {
        const normalizedId = parseInt(userId, 10);
        return Number.isFinite(normalizedId) && normalizedId > 0 ? `user_avatar_${normalizedId}` : '';
    },

    extractAvatarSource(value) {
        if (!value) return '';
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'object') {
            return String(value.src || value.avatar_url || value.profile_image || value.url || '').trim();
        }
        return '';
    },

    async getUserAvatar(userId) {
        const key = this.getUserAvatarSettingKey(userId);
        if (!key) return '';
        const value = await this.getPlatformSettings(key);
        return this.extractAvatarSource(value);
    },

    async saveUserAvatar(userId, avatarSrc) {
        const key = this.getUserAvatarSettingKey(userId);
        const src = this.extractAvatarSource(avatarSrc);
        if (!key || !src) {
            return { success: false, error: { message: 'Invalid avatar payload.' } };
        }
        return this.updatePlatformSettings(key, {
            src,
            updated_at: new Date().toISOString()
        });
    },

    async attachUserAvatar(user) {
        if (!user || typeof user !== 'object') return user;
        const existingAvatar = this.extractAvatarSource(user.avatar_url || user.profile_image || user.avatar);
        if (existingAvatar) {
            return {
                ...user,
                avatar_url: existingAvatar,
                profile_image: existingAvatar
            };
        }

        const storedAvatar = await this.getUserAvatar(user.id);
        if (!storedAvatar) return user;

        return {
            ...user,
            avatar_url: storedAvatar,
            profile_image: storedAvatar
        };
    },

    getUserProfileIdentity(profile = {}) {
        const currentUser = this.getCurrentUser() || {};
        const pending = this.getPendingRegistrationData() || {};
        const mobileRaw = profile.mobile ?? currentUser.mobile ?? pending.mobile ?? '';
        const fullName = String(profile.full_name ?? profile.fullName ?? profile.name ?? currentUser.full_name ?? pending.name ?? '').trim();

        return {
            currentUser,
            pending,
            userId: profile.userId ?? profile.user_id ?? profile.id ?? currentUser.id ?? pending.userId ?? null,
            authId: String(profile.auth_id ?? profile.authId ?? currentUser.auth_id ?? pending.authId ?? '').trim(),
            email: String(profile.email ?? currentUser.email ?? pending.email ?? '').trim().toLowerCase(),
            mobileRaw: String(mobileRaw || '').trim(),
            mobile: this.normalizeMobile(mobileRaw),
            fullName,
            username: String(profile.username ?? currentUser.username ?? pending.username ?? fullName ?? '').trim(),
            invitationCode: this.normalizeInvitationCode(profile.invitation_code ?? profile.inviteCode ?? currentUser.invitation_code ?? pending.inviteCode ?? ''),
            password: String(profile.password ?? pending.password ?? currentUser.password ?? '').trim(),
            dob: profile.dob ?? currentUser.dob ?? pending.dob,
            gender: profile.gender ?? currentUser.gender ?? pending.gender,
            address: profile.address ?? currentUser.address ?? pending.address,
            idNumber: String(profile.id_number ?? profile.idNumber ?? currentUser.id_number ?? pending.idNumber ?? '').trim(),
            csrId: profile.csr_id ?? currentUser.csr_id ?? pending.csrId ?? null
        };
    },

    doesUserMatchIdentity(user, identity = {}) {
        if (!user) return false;

        const authMatch = identity.authId && String(user.auth_id || '').trim() === identity.authId;
        const emailMatch = identity.email && String(user.email || '').trim().toLowerCase() === identity.email;
        const mobileMatch = identity.mobile && this.normalizeMobile(user.mobile) === identity.mobile;
        const hasStrongIdentity = Boolean(identity.authId || identity.email || identity.mobile);

        return hasStrongIdentity ? (authMatch || emailMatch || mobileMatch) : true;
    },

    async findUserProfileByIdentity(identity = {}) {
        const client = this.getClient();
        if (!client) return null;

        const selectFields = this.USER_PROFILE_SELECT_FIELDS;
        const readSingle = async (query, arrayMode = false) => {
            const { data, error } = await query;
            if (error) return null;
            if (arrayMode) return Array.isArray(data) ? (data[0] || null) : null;
            return data || null;
        };

        const hasStrongIdentity = Boolean(identity.authId || identity.email || identity.mobile);
        const idCandidates = [];
        const pushId = (value) => {
            if (value === null || value === undefined || value === '') return;
            if (!idCandidates.includes(value)) idCandidates.push(value);
        };

        pushId(identity.userId);
        pushId(identity.currentUser?.id);
        pushId(identity.pending?.userId);

        for (const candidateId of idCandidates) {
            const row = await readSingle(
                client.from('users').select(selectFields).eq('id', candidateId).maybeSingle()
            );
            if (!row) continue;
            if (!hasStrongIdentity || this.doesUserMatchIdentity(row, identity)) {
                return await this.attachUserAvatar(row);
            }
        }

        if (identity.authId) {
            const row = await readSingle(
                client.from('users').select(selectFields).eq('auth_id', identity.authId).maybeSingle()
            );
            if (row) return await this.attachUserAvatar(row);
        }

        if (identity.email) {
            const row = await readSingle(
                client.from('users').select(selectFields).eq('email', identity.email).maybeSingle()
            );
            if (row) return await this.attachUserAvatar(row);
        }

        const mobileCandidates = this.buildMobileCandidates(identity.mobileRaw || identity.mobile);
        if (mobileCandidates.length > 0) {
            const row = await readSingle(
                client.from('users').select(selectFields).in('mobile', mobileCandidates).limit(1),
                true
            );
            if (row) return await this.attachUserAvatar(row);
        }

        return null;
    },

    async resolveUserProfileForKyc(userId, profile = {}) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        const identity = this.getUserProfileIdentity({ ...profile, userId });
        let user = await this.findUserProfileByIdentity(identity);

        const resolveInvitation = async () => {
            if (!identity.invitationCode) return null;
            const invitationCheck = await this.validateInvitationCode(identity.invitationCode);
            return invitationCheck.success && invitationCheck.csr ? invitationCheck : null;
        };

        if (user) {
            const patch = {};
            const currentMobile = this.normalizeMobile(user.mobile);
            const currentEmail = String(user.email || '').trim().toLowerCase();
            const currentAuthId = String(user.auth_id || '').trim();

            if (identity.authId && identity.authId !== currentAuthId) patch.auth_id = identity.authId;
            if (identity.email && identity.email !== currentEmail) patch.email = identity.email;
            if (identity.mobile && identity.mobile !== currentMobile) patch.mobile = identity.mobile;
            if (identity.fullName && !String(user.full_name || '').trim()) patch.full_name = identity.fullName;
            if (identity.username && !String(user.username || '').trim()) patch.username = identity.username;
            if (identity.idNumber && !String(user.id_number || '').trim()) patch.id_number = identity.idNumber;
            if (identity.dob && !user.dob) patch.dob = identity.dob;
            if (identity.gender && !user.gender) patch.gender = identity.gender;
            if (identity.address && !String(user.address || '').trim()) patch.address = identity.address;
            if (!String(user.kyc || '').trim()) patch.kyc = 'Pending';

            if (!user.csr_id || !user.invitation_code) {
                const invitationCheck = await resolveInvitation();
                if (invitationCheck?.csr) {
                    if (!user.csr_id) patch.csr_id = invitationCheck.csr.id;
                    if (!user.invitation_code) patch.invitation_code = invitationCheck.normalizedCode;
                } else {
                    if (!user.csr_id && identity.csrId) patch.csr_id = identity.csrId;
                    if (!user.invitation_code && identity.invitationCode) patch.invitation_code = identity.invitationCode;
                }
            }

            if (Object.keys(patch).length > 0) {
                const { data, error } = await client
                    .from('users')
                    .update(patch)
                    .eq('id', user.id)
                    .select(this.USER_PROFILE_SELECT_FIELDS)
                    .single();

                if (error) {
                    console.error("KYC PIPELINE: Failed to sync user profile before KYC:", error);
                    return { success: false, message: error.message, error, stage: 'resolve_user_profile' };
                }

                user = data || user;
            }

            return { success: true, user, userId: user.id, created: false };
        }

        const invitationCheck = await resolveInvitation();
        const insertData = {
            password: identity.password || 'OTP_AUTH_PENDING',
            balance: 0,
            frozen: 0,
            invested: 0,
            outstanding: 0,
            kyc: 'Pending'
        };

        if (identity.mobile) insertData.mobile = identity.mobile;
        if (identity.email) insertData.email = identity.email;
        if (identity.authId) insertData.auth_id = identity.authId;
        if (identity.fullName) insertData.full_name = identity.fullName;
        if (identity.username) insertData.username = identity.username;
        if (identity.idNumber) insertData.id_number = identity.idNumber;
        if (identity.dob) insertData.dob = identity.dob;
        if (identity.gender) insertData.gender = identity.gender;
        if (identity.address) insertData.address = identity.address;

        if (invitationCheck?.csr) {
            insertData.csr_id = invitationCheck.csr.id;
            insertData.invitation_code = invitationCheck.normalizedCode;
        } else {
            if (identity.csrId) insertData.csr_id = identity.csrId;
            if (identity.invitationCode) insertData.invitation_code = identity.invitationCode;
        }

        const { data, error } = await client
            .from('users')
            .insert([insertData])
            .select(this.USER_PROFILE_SELECT_FIELDS)
            .single();

        if (error) {
            console.error("KYC PIPELINE: Failed to create missing user profile:", error);
            return { success: false, message: error.message, error, stage: 'create_user_profile' };
        }

        return { success: true, user: data, userId: data?.id, created: true };
    },

    /**
     * Self-Healing: Restores session from Supabase Auth if localStorage is empty.
     * Prevents "No data" issue after cache clearing.
     */
    async restoreSessionByAuth() {
        console.log("Checking for active Supabase Auth session...");
        const client = this.getClient();
        if (!client) {
            window.DB_READY = true;
            return null;
        }

        const { data: { session }, error } = await client.auth.getSession();
        if (error || !session || !session.user) {
            console.log("No active Supabase Auth session found.");
            window.DB_READY = true;
            return null;
        }

        console.log("Found Supabase session for:", session.user.email);

        const userProfile = await this.findUserProfileByIdentity(this.getUserProfileIdentity({
            auth_id: session.user.id,
            email: session.user.email,
            mobile: session.user.phone || session.user.user_metadata?.reg_mobile || ''
        }));

        if (userProfile) {
            const normalizedKyc = this.normalizeKycStatus(userProfile?.kyc);
            if (!this.isKycApproved(normalizedKyc)) {
                console.warn("Blocked auto-restore for non-approved KYC user:", userProfile?.id || userProfile?.email || userProfile?.mobile);
                localStorage.removeItem(this.CURRENT_USER_KEY);
                try {
                    await client.auth.signOut();
                } catch (signOutError) {
                    console.warn("Failed to sign out restricted Supabase session:", signOutError);
                }
                window.DB_READY = true;
                return null;
            }
            console.log("Restoring avendus_current_user to localStorage...");
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(userProfile));
            window.DB_READY = true;
            return userProfile;
        }

        console.warn("Failed to restore user profile from DB.");
        window.DB_READY = true;
        return null;
    },

    async refreshCurrentUser() {
        const user = this.getCurrentUser();
        if (!user) return null;

        const client = this.getClient();
        if (!client) return user;

        const data = await this.findUserProfileByIdentity(this.getUserProfileIdentity(user));

        if (data) {
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(data));
            return data;
        }
        return user;
    },

    clearCurrentUser() {
        localStorage.removeItem(this.CURRENT_USER_KEY);
    },

    logout() {
        localStorage.removeItem(this.CURRENT_USER_KEY);
        window.location.href = 'login.html';
    },

    forceLogout() {
        console.warn("Forcefully logging out invalid user.");
        localStorage.clear(); // Clear everything
        window.location.href = 'login.html';
    },

    // --- MESSAGES / CHAT / NOTICES ---
    async getMessages(userId) {
        const client = this.getClient();
        const numericId = await this._getNumericUserId(userId);
        if (numericId === null || numericId === undefined || numericId === '') return [];

        const { data, error } = await client
            .from('messages')
            .select('*')
            .eq('user_id', numericId)
            .neq('sender', 'System') // Exclude System Notices from Chat
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Get Messages Error:", error);
            return [];
        }

        return data || [];
    },

    async getUnreadSupportMessages(userId) {
        const client = this.getClient();
        const numericId = await this._getNumericUserId(userId);
        if (numericId === null || numericId === undefined || numericId === '') return [];

        const { data, error } = await client
            .from('messages')
            .select('id, user_id, message, sender, is_read, created_at')
            .eq('user_id', numericId)
            .eq('is_read', false)
            .neq('sender', 'User')
            .neq('sender', 'user')
            .neq('sender', 'System')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Get Unread Support Messages Error:", error);
            return [];
        }

        return (data || []).filter(row => {
            const rawMessage = String(row?.message || '').trim();
            if (!rawMessage.startsWith('{')) return true;
            try {
                const payload = JSON.parse(rawMessage);
                return payload?.is_notification !== true && payload?.title === undefined;
            } catch (_) {
                return true;
            }
        });
    },

    async getUnreadSupportMessageCount(userId) {
        const rows = await this.getUnreadSupportMessages(userId);
        return Array.isArray(rows) ? rows.length : 0;
    },

    async markSupportMessagesRead(userId) {
        const client = this.getClient();
        const unreadRows = await this.getUnreadSupportMessages(userId);
        const ids = (Array.isArray(unreadRows) ? unreadRows : [])
            .map(row => row?.id)
            .filter(id => id !== null && id !== undefined && id !== '');

        if (!ids.length) return { success: true, count: 0, data: [] };

        const { data, error } = await client
            .from('messages')
            .update({ is_read: true })
            .in('id', ids)
            .select('id');

        return { success: !error, error, count: ids.length, data: data || [] };
    },

    // New: Get Notices (System Messages)
    async getNotices(userId) {
        const client = this.getClient();
        const numericId = await this._getNumericUserId(userId);
        if (numericId === null || numericId === undefined || numericId === '') return [];

        const { data, error } = await client
            .from('messages')
            .select('*')
            .eq('user_id', numericId)
            .eq('sender', 'System') // Only System Notices
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Get Notices Error:", error);
            return [];
        }

        return data || [];
    },

    async sendMessage(userId, message, sender = 'User') {
        const client = this.getClient();
        const numericId = await this._getNumericUserId(userId);
        if (numericId === null || numericId === undefined || numericId === '') {
            return { success: false, error: new Error('Unable to resolve chat user id.') };
        }

        const { data, error } = await client
            .from('messages')
            .insert([{ user_id: numericId, message, sender }])
            .select()
            .single();

        return { success: !error, error, data: data || null };
    },

    // New: Send Notice
    async sendNotice(userId, title, message) {
        const client = this.getClient();
        // We pack title and message into the 'message' column or use a convention
        // Let's use sender='System' and put title in the message for now or just message.
        // If we want title, we might need to stringify JSON if 'message' is text.
        // For simplicity: Message is the content. Title we can prepend or assume.

        const content = message;

        const { data, error } = await client
            .from('messages')
            .insert([{
                user_id: userId,
                message: content,
                sender: 'System' // Mark as System Notice
            }]);

        return { success: !error, error };
    },

    async deleteMessage(id) {
        const client = this.getClient();
        const { error } = await client.from('messages').delete().eq('id', id);
        return { success: !error, error };
    },

    async deleteUserConversation(userId) {
        const client = this.getClient();
        const numericId = await this._getNumericUserId(userId);
        if (numericId === null || numericId === undefined || numericId === '') {
            return { success: false, error: new Error('Unable to resolve chat user id.') };
        }

        // Delete all non-system messages (chat history)
        const { error } = await client.from('messages')
            .delete()
            .eq('user_id', numericId)
            .neq('sender', 'System');
        return { success: !error, error };
    },


    // --- NOTIFICATIONS (VIA MESSAGES TABLE) ---

    // Helper to resolve numeric ID if needed
    async _getNumericUserId(paramUserId) {
        const client = this.getClient();
        const rawParam = (paramUserId && typeof paramUserId === 'object')
            ? (paramUserId.id ?? paramUserId.user_id ?? paramUserId.auth_id ?? paramUserId)
            : paramUserId;
        const normalizedParam = typeof rawParam === 'string' ? rawParam.trim() : rawParam;

        if (typeof normalizedParam === 'number' && Number.isFinite(normalizedParam)) {
            return normalizedParam;
        }

        if (typeof normalizedParam === 'string' && /^\d+$/.test(normalizedParam)) {
            return Number(normalizedParam);
        }

        try {
            // User requested strict logic: get numeric ID from users table using auth_id
            const { data: authData } = await client.auth.getUser();
            const authId = authData?.user?.id;

            // If we have an auth session, use it to find the numeric ID
            if (authId) {
                const { data: userData } = await client
                    .from('users')
                    .select('id')
                    .eq('auth_id', authId)
                    .single();
                if (userData) return userData.id;
            }

            // Fallback: Check if paramUserId is already the numeric ID or if we can find it by auth_id=paramUserId
            if (normalizedParam) {
                // Try treating paramUserId as auth_id
                const { data: userData } = await client
                    .from('users')
                    .select('id')
                    .eq('auth_id', normalizedParam)
                    .single();
                if (userData) return userData.id;

                // If not found, maybe paramUserId is ALREADY the numeric ID? 
                // We return it as is if we couldn't resolve via auth_id
                return normalizedParam;
            }
        } catch (e) { console.error("ID Resolution Error:", e); }
        return normalizedParam;
    },

    async getNotifications(userId) {
        const client = this.getClient();
        if (!client) return [];

        const numericId = await this._getNumericUserId(userId);

        const { data, error } = await client
            .from('messages')
            .select('*')
            .eq('user_id', numericId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching notifications:", error);
            return [];
        }

        // FILTER: Only return records that have is_notification: true in their JSON payload
        const filtered = (data || []).filter(m => {
            try {
                if (m.message && m.message.startsWith('{')) {
                    const p = JSON.parse(m.message);
                    return p.is_notification === true || p.title !== undefined;
                }
            } catch (e) { }
            return false;
        });

        return filtered.map(m => {
            let title = 'Notification';
            let body = m.message;
            let type = 'GENERAL';

            try {
                const p = JSON.parse(m.message);
                if (p.title) title = p.title;

                // Priority for body text: message > body > content
                if (p.message) body = p.message;
                else if (p.body) body = p.body;
                else if (p.content) body = p.content;

                if (p.type) type = p.type;
            } catch (e) { }

            return {
                id: m.id,
                user_id: m.user_id,
                title: title,
                message: body,
                type: type,
                is_read: m.is_read || false,
                created_at: m.created_at
            };
        });
    },

    async getUnreadNotificationCount(userId) {
        const client = this.getClient();
        if (!client) return 0;

        const numericId = await this._getNumericUserId(userId);

        // Fetch all potential notifications (messages from Admin/System)
        // Then filter in-memory because is_notification flag is inside JSON
        const { data, error } = await client
            .from('messages')
            .select('*')
            .eq('user_id', numericId)
            .eq('is_read', false);

        if (error || !data) return 0;

        const count = data.filter(m => {
            try {
                if (m.message && m.message.startsWith('{')) {
                    const p = JSON.parse(m.message);
                    return p.is_notification === true || p.title !== undefined;
                }
            } catch (e) { }
            return false;
        }).length;

        return count;
    },

    async markAllNotificationsRead(userId) {
        const client = this.getClient();
        if (!client) return { success: false };

        const numericId = await this._getNumericUserId(userId);

        const { data, error } = await client
            .from('messages')
            .update({ is_read: true })
            .eq('user_id', numericId)
            .eq('is_read', false)
            .select();

        return { success: !error, error, data };
    },

    async sendNotice(userId, title, message, type = 'general') {
        const client = this.getClient();

        const numericId = await this._getNumericUserId(userId);

        // JSON structure for backward compatibility
        const payload = JSON.stringify({
            title: title,
            body: message,
            type: type,
            is_notification: true
        });

        const { error } = await client
            .from('messages')
            .insert([{
                user_id: numericId,
                message: payload,
                sender: 'Admin',
                is_read: false
            }]);
        return { success: !error, error };
    },

    async deleteNotification(id) {
        // Reuse deleteMessage logic
        return this.deleteMessage(id);
    },

    // --- KYC ---
    async fileToDataUrl(file) {
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
            reader.readAsDataURL(file);
        });
    },

    getKycStorageBuckets() {
        const configured = [window.KYC_STORAGE_BUCKET, this.KYC_STORAGE_BUCKET];
        return [...new Set([...configured, 'kyc-documents', 'kyc'].filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
    },

    extractKycStorageRef(value) {
        const raw = String(value || '').trim();
        if (!raw || /^data:|^blob:/i.test(raw)) return null;

        const rawNoOrigin = raw.replace(/^https?:\/\/[^/]+/i, '');
        const storageMatch = rawNoOrigin.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/?#]+)\/([^?#]+)/i);
        if (storageMatch) {
            return {
                bucket: decodeURIComponent(storageMatch[1] || ''),
                path: decodeURIComponent(storageMatch[2] || '').replace(/^\/+/, '')
            };
        }

        if (!/^https?:/i.test(raw) && raw.includes('/')) {
            return {
                bucket: '',
                path: raw.replace(/^\/+/, '')
            };
        }

        return null;
    },

    async resolveKycImageUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^data:|^blob:/i.test(raw)) return raw;

        const client = this.getClient();
        if (!client) return raw;

        const ref = this.extractKycStorageRef(raw);
        if (!ref) return raw;

        const buckets = ref.bucket ? [ref.bucket] : this.getKycStorageBuckets();
        for (const bucket of buckets) {
            const normalizedBucket = String(bucket || '').trim();
            if (!normalizedBucket || !ref.path) continue;
            try {
                const { data, error } = await client.storage
                    .from(normalizedBucket)
                    .createSignedUrl(ref.path, 60 * 60 * 24 * 7);
                if (!error && data?.signedUrl) {
                    return data.signedUrl;
                }
            } catch (_) { }

            try {
                const { data } = client.storage
                    .from(normalizedBucket)
                    .getPublicUrl(ref.path);
                if (data?.publicUrl) {
                    return data.publicUrl;
                }
            } catch (_) { }
        }

        return raw;
    },

    async uploadKycImage(file, userId) {
        const client = this.getClient();
        if (!client) return { error: 'No client' };

        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const bucketErrors = [];

        for (const bucket of this.getKycStorageBuckets()) {
            try {
                const { error } = await client.storage
                    .from(bucket)
                    .upload(fileName, file);

                if (error) {
                    bucketErrors.push(`${bucket}: ${error.message || error}`);
                    continue;
                }

                const { data: publicUrlData } = client.storage
                    .from(bucket)
                    .getPublicUrl(fileName);

                if (publicUrlData?.publicUrl) {
                    return { publicUrl: publicUrlData.publicUrl, bucket, storage: 'bucket' };
                }
            } catch (error) {
                bucketErrors.push(`${bucket}: ${error.message || error}`);
            }
        }

        try {
            const inlineDataUrl = await this.fileToDataUrl(file);
            return {
                publicUrl: inlineDataUrl,
                bucket: null,
                storage: 'inline',
                warning: bucketErrors.join(' | ')
            };
        } catch (inlineError) {
            console.error("Upload Error:", bucketErrors, inlineError);
            return { error: inlineError };
        }
    },

    async submitKYC(userId, fullName, mobile, idNumber, idFront, idBack, selfie, extra = {}) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        if (fullName && typeof fullName === 'object' && !Array.isArray(fullName) && !(fullName instanceof File)) {
            const payload = fullName;
            extra = { ...(payload.extra || {}), ...extra };
            fullName = payload.full_name ?? payload.fullName ?? payload.name ?? '';
            mobile = payload.mobile ?? '';
            idNumber = payload.id_number ?? payload.idNumber ?? '';
            idFront = payload.id_front_url ?? payload.idFront ?? payload.front ?? null;
            idBack = payload.id_back_url ?? payload.idBack ?? payload.back ?? null;
            selfie = payload.selfie_url ?? payload.selfie ?? null;
        }

        const normalizedFullName = String(fullName || '').trim();
        const mobileDigits = String(mobile || '').replace(/\D/g, '');
        const normalizedMobile = mobileDigits ? (mobileDigits.length > 10 ? mobileDigits.slice(-10) : mobileDigits) : String(mobile || '').trim();
        const normalizedIdNumber = String(idNumber || '').trim();

        const resolvedProfile = await this.resolveUserProfileForKyc(userId, {
            full_name: normalizedFullName,
            mobile: normalizedMobile,
            id_number: normalizedIdNumber,
            dob: extra.dob,
            email: extra.email,
            auth_id: extra.auth_id,
            username: extra.username || normalizedFullName,
            gender: extra.gender,
            address: extra.address,
            invitation_code: extra.invitation_code,
            inviteCode: extra.inviteCode,
            csr_id: extra.csr_id,
            password: extra.password
        });

        if (!resolvedProfile.success || !resolvedProfile.userId) {
            return {
                success: false,
                error: resolvedProfile.error || resolvedProfile.message || 'Failed to resolve user profile.',
                stage: resolvedProfile.stage || 'resolve_user_profile'
            };
        }

        const resolvedUserId = resolvedProfile.userId;

        // 1. Process files (upload if they are File objects)
        const uploads = [
            { file: idFront, key: 'id_front_url' },
            { file: idBack, key: 'id_back_url' },
            { file: selfie, key: 'selfie_url' }
        ];

        const urls = {};
        for (const up of uploads) {
            if (up.file) {
                if (typeof up.file === 'string' && /^(https?:|data:|blob:)/i.test(up.file)) {
                    urls[up.key] = up.file;
                } else if (up.file instanceof File || (typeof up.file === 'object' && up.file.name)) {
                    const res = await this.uploadKycImage(up.file, resolvedUserId);
                    if (res.error) {
                        console.error(`KYC PIPELINE: Upload Failed for ${up.key}:`, res.error);
                        return { success: false, error: res.error, stage: `upload_${up.key}` };
                    }
                    if (res.publicUrl) urls[up.key] = res.publicUrl;
                }
            }
        }

        // 2. Prepare User Profile Update (Authoritative Profile Data)
        // Note: The users table uses 'kyc' for the status, not 'status'.
        const userPayload = {
            full_name: normalizedFullName,
            mobile: normalizedMobile || undefined,
            id_number: normalizedIdNumber || undefined,
            dob: extra.dob,
            email: extra.email,
            auth_id: extra.auth_id,
            username: extra.username,
            gender: extra.gender,
            address: extra.address,
            kyc: 'Pending'
        };

        // Remove any undefined fields
        Object.keys(userPayload).forEach(key => userPayload[key] === undefined && delete userPayload[key]);

        const userUpdateRes = await this.updateUser(resolvedUserId, userPayload);
        if (!userUpdateRes.success) {
            console.error("KYC PIPELINE: Profile Update Failed:", userUpdateRes.error);
            return { success: false, error: userUpdateRes.error, stage: 'profile_update' };
        }

        const updatedUser = Array.isArray(userUpdateRes.data) ? userUpdateRes.data[0] : (userUpdateRes.data || null);
        const mergedUser = { ...(resolvedProfile.user || {}), ...(updatedUser || {}) };
        if (mergedUser && mergedUser.id) {
            const currentUser = this.getCurrentUser() || {};
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify({ ...currentUser, ...mergedUser }));
        }

        // 3. Prepare KYC Submission Record
        const kycPayload = {
            user_id: resolvedUserId,
            id_type: extra.id_type || 'Aadhar',
            status: 'Pending',
            submitted_at: new Date().toISOString(),
            admin_note: null,
            reviewed_at: null
        };

        if (urls.id_front_url) kycPayload.id_front_url = urls.id_front_url;
        if (urls.id_back_url) kycPayload.id_back_url = urls.id_back_url;
        if (urls.selfie_url) kycPayload.selfie_url = urls.selfie_url;

        // Remove any undefined fields
        Object.keys(kycPayload).forEach(key => kycPayload[key] === undefined && delete kycPayload[key]);

        const { data: existing } = await client
            .from('kyc_submissions')
            .select('id')
            .eq('user_id', resolvedUserId)
            .order('submitted_at', { ascending: false })
            .limit(1);

        let res;
        if (existing && existing.length > 0) {
            res = await client
                .from('kyc_submissions')
                .update(kycPayload)
                .eq('id', existing[0].id);
        } else {
            res = await client
                .from('kyc_submissions')
                .insert([kycPayload]);
        }

        return {
            success: !res.error,
            error: res.error,
            user: mergedUser,
            userId: resolvedUserId,
            profileUpdate: userUpdateRes,
            kycInsert: res,
            stage: 'kyc_submission'
        };
    },

    async getKycByUserId(userId) {
        const client = this.getClient();
        const { data, error } = await client
            .from('kyc_submissions')
            .select('*')
            .eq('user_id', userId)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .single();

        return data || null;
    },

    // --- BANK ACCOUNTS ---
    // --- BANK ACCOUNTS (ULTIMATE HYBRID MODE) ---
    getOfflineBanks(userId) {
        try {
            const raw = localStorage.getItem('avendus_offline_banks');
            const all = raw ? JSON.parse(raw) : [];
            return all.filter(b => String(b.user_id) === String(userId));
        } catch (e) { return []; }
    },

    normalizeBankAccountData(accountData = {}) {
        const normalized = { ...accountData };
        normalized.bank_name = String(accountData?.bank_name || '').trim();
        normalized.account_number = String(accountData?.account_number || '').replace(/\s+/g, '').trim();
        normalized.ifsc = String(accountData?.ifsc || '').trim().toUpperCase();
        normalized.mobile = String(accountData?.mobile || '').trim();
        normalized.full_name = String(
            accountData?.full_name
            || `${String(accountData?.first_name || '').trim()} ${String(accountData?.last_name || '').trim()}`
        ).trim();

        normalized.first_name = String(accountData?.first_name || '').trim();
        normalized.last_name = String(accountData?.last_name || '').trim();

        if ((!normalized.first_name || !normalized.last_name) && normalized.full_name) {
            const parts = normalized.full_name.split(/\s+/).filter(Boolean);
            if (!normalized.first_name) normalized.first_name = parts.shift() || '';
            if (!normalized.last_name) normalized.last_name = parts.join(' ');
        }

        return normalized;
    },

    getBankAccountSignature(accountData = {}) {
        const normalized = this.normalizeBankAccountData(accountData);
        const bank = String(normalized.bank_name || '').toUpperCase();
        const account = String(normalized.account_number || '');
        const ifsc = String(normalized.ifsc || '').toUpperCase();
        if (!bank && !account && !ifsc) return '';
        return `${bank}|${account}|${ifsc}`;
    },

    mergeUniqueBankAccounts(...lists) {
        const merged = [];
        const seenIds = new Set();
        const seenSignatures = new Set();

        for (const list of lists) {
            for (const item of Array.isArray(list) ? list : []) {
                const normalized = this.normalizeBankAccountData(item);
                const idKey = String(normalized?.id || '').trim();
                const signature = this.getBankAccountSignature(normalized);

                if (idKey && seenIds.has(idKey)) continue;
                if (signature && seenSignatures.has(signature)) continue;

                if (idKey) seenIds.add(idKey);
                if (signature) seenSignatures.add(signature);
                merged.push(normalized);
            }
        }

        return merged;
    },

    saveOfflineBank(userId, accountData) {
        const raw = localStorage.getItem('avendus_offline_banks');
        const all = raw ? JSON.parse(raw) : [];
        const normalizedUserId = String(userId);
        const normalizedAccount = this.normalizeBankAccountData(accountData);
        const signature = this.getBankAccountSignature(normalizedAccount);
        const existingIndex = all.findIndex((bank) =>
            String(bank.user_id) === normalizedUserId
            && signature
            && this.getBankAccountSignature(bank) === signature
        );

        const newBank = {
            id: existingIndex >= 0 ? all[existingIndex].id : 'local_' + Date.now(),
            user_id: userId,
            ...normalizedAccount,
            created_at: existingIndex >= 0 ? (all[existingIndex].created_at || new Date().toISOString()) : new Date().toISOString()
        };

        if (existingIndex >= 0) all[existingIndex] = { ...all[existingIndex], ...newBank };
        else all.push(newBank);
        localStorage.setItem('avendus_offline_banks', JSON.stringify(all));
        return newBank;
    },

    updateOfflineBank(id, data) {
        const raw = localStorage.getItem('avendus_offline_banks');
        let all = raw ? JSON.parse(raw) : [];
        const idx = all.findIndex(b => b.id === id);
        if (idx !== -1) {
            all[idx] = { ...all[idx], ...data };
            localStorage.setItem('avendus_offline_banks', JSON.stringify(all));
            return true;
        }
        return false;
    },

    deleteOfflineBank(id) {
        const raw = localStorage.getItem('avendus_offline_banks');
        let all = raw ? JSON.parse(raw) : [];
        const filtered = all.filter(b => b.id !== id);
        localStorage.setItem('avendus_offline_banks', JSON.stringify(filtered));
    },

    async getHistoricalBankAccounts(userId) {
        const client = this.getClient();
        if (!client) return [];

        const numericId = await this._getNumericUserId(userId);

        try {
            const desiredColumns = ['id', 'bank_name', 'account_number', 'ifsc', 'full_name', 'created_at'];
            const missingColumns = new Set();
            let data = null;
            let error = null;

            for (let attempt = 0; attempt < desiredColumns.length; attempt++) {
                const selectedColumns = desiredColumns.filter((column) => !missingColumns.has(column));
                const result = await client
                    .from('withdrawals')
                    .select(selectedColumns.join(', '))
                    .eq('user_id', numericId)
                    .order('created_at', { ascending: false });

                data = result.data || null;
                error = result.error || null;
                if (!error) break;

                const missingColumn = this.getSchemaMissingColumn(error, 'withdrawals');
                if (!missingColumn || missingColumns.has(missingColumn)) break;
                missingColumns.add(missingColumn);
            }

            if (error || !Array.isArray(data)) return [];

            return data
                .filter((item) => item && (item.account_number || item.bank_name || item.ifsc))
                .map((item) => {
                    const normalized = this.normalizeBankAccountData(item);
                    return {
                        id: `history_${item.id}`,
                        user_id: numericId,
                        bank_name: normalized.bank_name,
                        first_name: normalized.first_name,
                        last_name: normalized.last_name,
                        full_name: normalized.full_name,
                        account_number: normalized.account_number,
                        mobile: normalized.mobile,
                        ifsc: normalized.ifsc,
                        created_at: item.created_at,
                        source: 'withdrawal_history'
                    };
                });
        } catch (error) {
            console.warn('Historical bank account fetch failed:', error);
            return [];
        }
    },

    async getBankAccounts(userId) {
        const client = this.getClient();
        const numericId = await this._getNumericUserId(userId);

        let onlineData = [];
        try {
            const { data, error } = await client
                .from('bank_accounts')
                .select('*')
                .eq('user_id', numericId)
                .or('is_deleted.is.null,is_deleted.eq.false')
                .order('created_at', { ascending: false });

            if (!error && data) onlineData = data;
        } catch (e) { console.warn("Supabase Fetch Failed, using offline."); }

        const offlineData = this.mergeUniqueBankAccounts(
            this.getOfflineBanks(userId),
            String(numericId) === String(userId) ? [] : this.getOfflineBanks(numericId)
        );

        return this.mergeUniqueBankAccounts(onlineData, offlineData);
    },

    async getSelectableBankAccounts(userId) {
        const numericId = await this._getNumericUserId(userId);
        const [managedAccounts, historicalAccounts] = await Promise.all([
            this.getBankAccounts(numericId),
            this.getHistoricalBankAccounts(numericId)
        ]);

        return this.mergeUniqueBankAccounts(managedAccounts, historicalAccounts);
    },

    async addBankAccount(userId, accountData, options = {}) {
        const client = this.getClient();
        const normalizedUserId = await this._getNumericUserId(userId);
        const normalizedAccount = this.normalizeBankAccountData(accountData);
        const packet = { user_id: normalizedUserId, ...normalizedAccount };

        if (!options.skipDedupCheck) {
            const existingAccounts = await this.getSelectableBankAccounts(normalizedUserId);
            const signature = this.getBankAccountSignature(normalizedAccount);
            const matched = existingAccounts.find((item) => this.getBankAccountSignature(item) === signature);
            if (signature && matched) {
                return { success: true, existing: true, data: matched };
            }
        }

        // Since user changed DB column to TEXT, we can accept ANY ID now.
        // No more UUID restriction.

        const { data, error } = await client
            .from('bank_accounts')
            .insert([packet]);

        if (error) {
            console.error("Supabase Error:", error);
            // Fallback to offline IF online actually fails (network/server error)
            console.warn("Online Add Failed, saving offline:", error);
            this.saveOfflineBank(normalizedUserId, normalizedAccount);
            return { success: true, offline: true };
        } else {
            return { success: true };
        }
    },

    async rememberBankAccountUsage(userId, accountData) {
        const normalizedUserId = await this._getNumericUserId(userId);
        const normalizedAccount = this.normalizeBankAccountData(accountData);
        const signature = this.getBankAccountSignature(normalizedAccount);

        if (!signature || !normalizedAccount.account_number) {
            return { success: false, skipped: true };
        }

        return this.addBankAccount(normalizedUserId, normalizedAccount);
    },

    async updateBankAccount(id, accountData) {
        // If it's a local ID
        if (id.toString().startsWith('local_') || id.toString().startsWith('demo_')) {
            this.updateOfflineBank(id, accountData);
            return { success: true };
        }

        const client = this.getClient();
        const { data, error } = await client.from('bank_accounts').update(accountData).eq('id', id);

        if (error) {
            // If online update fails, maybe we can't do much unless we cache edits.
            // For now, return error but user can retry.
            return { success: false, error };
        }
        return { success: true };
    },

    async deleteBankAccount(id) {
        if (id.toString().startsWith('local_') || id.toString().startsWith('demo_')) {
            this.deleteOfflineBank(id);
            return { success: true };
        }

        const client = this.getClient();
        // Soft delete: set is_deleted = true
        const { error } = await client
            .from('bank_accounts')
            .update({ is_deleted: true })
            .eq('id', id);

        if (error) {
            console.error("Soft delete failed:", error);
            return { success: false, error };
        }
        return { success: true };
    },

    // ADMIN: Get ALL bank accounts (Online + Offline)
    async getAllBankAccounts() {
        const client = this.getClient();
        let onlineData = [];
        try {
            const { data, error } = await client
                .from('bank_accounts')
                .select('*')
                .or('is_deleted.is.null,is_deleted.eq.false')
                .order('created_at', { ascending: false });

            if (!error && data) onlineData = data;
        } catch (e) { console.warn("Admin Fetch Failed"); }

        // Also get ALL offline banks (needs a bit of trickery since offline is by user)
        // Since we are admin, we might want to see all local storage? 
        // Actually, local storage is browser specific. So Admin will only see THEIR OWN local storage.
        // But for completeness in this browser session:
        let offlineData = [];
        try {
            const raw = localStorage.getItem('avendus_offline_banks');
            offlineData = raw ? JSON.parse(raw) : [];
        } catch (e) { }

        return [...onlineData, ...offlineData];
    },

    // --- ADMIN METHODS ---
    async getUsers() {
        const client = this.getClient();
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        let query = client.from('users').select('id, mobile, username, kyc, credit_score, vip, balance, invested, frozen, outstanding, full_name, created_at, csr_id, invitation_code').or('is_deleted.is.null,is_deleted.eq.false');

        if (auth.role === 'csr') {
            if (auth.invitation_code) {
                query = query.or(`csr_id.eq.${auth.id},invitation_code.eq.${auth.invitation_code}`);
            } else {
                query = query.eq('csr_id', auth.id);
            }
        }

        const { data } = await query.order('created_at', { ascending: false });
        return data || [];
    },

    async deleteUser(id) {
        const client = this.getClient();
        // Soft delete: set is_deleted = true
        const { error } = await client
            .from('users')
            .update({ is_deleted: true })
            .eq('id', id);

        if (error) {
            console.error("Soft delete user failed:", error);
            return { success: false, error };
        }
        return { success: true };
    },

    async getDeposits() {
        const client = this.getClient();
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        let query = client.from('deposits').select('*');
        if (auth.role === 'csr') {
            query = client.from('deposits').select('*, users!inner(*)');
            if (auth.invitation_code) {
                query = query.or(`users.csr_id.eq.${auth.id},users.invitation_code.eq.${auth.invitation_code}`);
            } else {
                query = query.eq('users.csr_id', auth.id);
            }
        }
        const { data } = await query.order('created_at', { ascending: false });
        return data || [];
    },

    async getWithdrawals() {
        const client = this.getClient();
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        let query = client.from('withdrawals').select('*');
        if (auth.role === 'csr') {
            query = client.from('withdrawals').select('*, users!inner(*)');
            if (auth.invitation_code) {
                query = query.or(`users.csr_id.eq.${auth.id},users.invitation_code.eq.${auth.invitation_code}`);
            } else {
                query = query.eq('users.csr_id', auth.id);
            }
        }
        const { data } = await query.order('created_at', { ascending: false });
        return data || [];
    },

    async getAllMessages() {
        const client = this.getClient();
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        let query = client.from('messages').select('*');
        if (auth.role === 'csr') {
            query = client.from('messages').select('*, users!inner(*)');
            if (auth.invitation_code) {
                query = query.or(`users.csr_id.eq.${auth.id},users.invitation_code.eq.${auth.invitation_code}`);
            } else {
                query = query.eq('users.csr_id', auth.id);
            }
        }
        const { data } = await query.order('created_at', { ascending: false });
        return data || [];
    },

    async getKycs() {
        const client = this.getClient();
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        const fields = 'id,user_id,status,id_type,id_front_url,id_back_url,selfie_url,submitted_at,admin_note,reviewed_at';
        let query = client.from('kyc_submissions').select(fields);
        if (auth.role === 'csr') {
            query = client.from('kyc_submissions').select(`${fields}, users!inner(id,csr_id,invitation_code)`);
            if (auth.invitation_code) {
                query = query.or(`users.csr_id.eq.${auth.id},users.invitation_code.eq.${auth.invitation_code}`);
            } else {
                query = query.eq('users.csr_id', auth.id);
            }
        }
        const { data } = await query.order('submitted_at', { ascending: false });
        return data || [];
    },

    async updateUser(id, updateData) {
        const client = this.getClient();
        // Detect CSR restriction for trading_frozen field (Instruction 1)
        if (updateData.hasOwnProperty('trading_frozen')) {
            const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
            if (auth.role === 'csr') {
                const { data: target } = await client.from('users').select('csr_id, invitation_code').eq('id', id).single();
                const hasCsrIdMatch = target && target.csr_id == auth.id;
                const hasInvCodeMatch = target && auth.invitation_code && target.invitation_code === auth.invitation_code;

                if (!hasCsrIdMatch && !hasInvCodeMatch) {
                    return { success: false, error: "Unauthorized Scope Violation" };
                }
            } else if (auth.role !== 'super_admin') {
                // Only CSR and Super Admin can manage this if logged in as admin
                if (sessionStorage.getItem('admin_auth')) {
                    return { success: false, error: "Unauthorized action." };
                }
            }
        }

        let query = client.from('users').update(updateData);

        // Safety: Detect if id is UUID (Supabase auth_id) or Numeric (internal id)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        if (isUuid) {
            query = query.eq('auth_id', id);
        } else {
            query = query.eq('id', id);
        }

        // Force selection with count to detect RLS blocks or missing rows
        const res = await query.select('*', { count: 'exact' });

        if (res.error) {
            console.error("Update error:", res.error);
            return { success: false, error: res.error };
        }

        if (res.count === 0) {
            console.error("No rows updated. RLS likely blocking or ID wrong. ID used:", id);
            return { success: false, error: "No rows updated", count: 0 };
        }

        return { success: true, data: res.data, count: res.count };
    },

    async updateKycStatus(id, status) {
        const client = this.getClient();
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        if (auth.role === 'csr') {
            const { data: kyc } = await client.from('kyc_submissions').select('*, users!inner(*)').eq('id', id).single();
            const hasCsrIdMatch = kyc?.users?.csr_id == auth.id;
            const hasInvCodeMatch = auth.invitation_code && kyc?.users?.invitation_code === auth.invitation_code;
            if (!hasCsrIdMatch && !hasInvCodeMatch) {
                return { success: false, error: { message: "Unauthorized Scope Violation" } };
            }
        }
        const { data: submission, error: submissionFetchError } = await client
            .from('kyc_submissions')
            .select('id,user_id,status')
            .eq('id', id)
            .maybeSingle();

        if (submissionFetchError || !submission) {
            return { success: false, error: submissionFetchError || { message: 'KYC submission not found.' } };
        }

        const reviewedAt = String(status || '').trim() === 'Pending' ? null : new Date().toISOString();
        const { error, data } = await client
            .from('kyc_submissions')
            .update({ status, reviewed_at: reviewedAt })
            .eq('id', id)
            .select('id,user_id,status,reviewed_at');

        if (error || !Array.isArray(data) || data.length === 0) {
            return { success: false, error: error || { message: 'No KYC submission row was updated.' } };
        }

        const userUpdate = await this.updateUser(submission.user_id, { kyc: status });
        if (!userUpdate?.success) {
            return { success: false, error: userUpdate?.error || { message: 'Failed to sync user KYC status.' }, data };
        }

        return { success: true, error: null, data, user: userUpdate.data };
    },

    async updateDepositStatus(id, status) {
        const client = this.getClient();
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        if (auth.role === 'csr') {
            return { success: false, error: { message: "Unauthorized Role Action: CSR accounts are view-only for deposits." } };
        }

        try {
            // 1. Fetch the existing deposit and its current status
            const { data: existing, error: getErr } = await client.from('deposits').select('*').eq('id', id).single();
            if (getErr || !existing) throw new Error("Deposit record not found.");

            const oldStatus = existing.status;
            const parseNum = (v) => parseFloat((v || "0").toString().replace(/,/g, '')) || 0;
            const amount = parseNum(existing.amount);
            const uid = existing.user_id;

            // 2. Handle Balance Transition Logic
            if (status === 'Approved' && oldStatus !== 'Approved') {
                const { data: user, error: uErr } = await client.from('users').select('*').eq('id', uid).single();
                if (uErr) throw uErr;

                const currentBalance = parseNum(user.balance);
                const currentOutstanding = parseNum(user.outstanding);

                // Automatic Offset Logic:
                // New balance simply adds the deposit (can be still negative or become positive)
                const newBalance = currentBalance + amount;
                // If there was outstanding debt, reduce it by the deposit amount
                const newOutstanding = Math.max(0, currentOutstanding - amount);

                const updates = {
                    balance: newBalance,
                    outstanding: newOutstanding,
                    negative_balance: newBalance < 0
                };

                const { error: upErr } = await client.from('users').update(updates).eq('id', uid);
                if (upErr) throw upErr;

                // --- NEW LOGIC: AUTO-SETTLE LOCKED_UNPAID TRADES ---
                try {
                    // Fetch trades chronologically that match the criteria
                    const { data: lockedTrades, error: lockedErr } = await client.from('trades')
                        .select('id, outstanding_amount, paid_amount')
                        .eq('user_id', uid)
                        .eq('status', 'LOCKED_UNPAID')
                        .order('created_at', { ascending: true });

                    if (!lockedErr && lockedTrades && lockedTrades.length > 0) {
                        // The deposit itself acts as the budget to pay off debts
                        let settlementBudget = amount;

                        for (const trade of lockedTrades) {
                            const outAmt = parseFloat(trade.outstanding_amount) || 0;

                            if (outAmt <= 0) {
                                // Already paid off, just unlock it unconditionally
                                const tradeUpdates = {
                                    status: 'Holding',
                                    order_status: 'FILLED'
                                };
                                const { error: trUpErr } = await client.from('trades').update(tradeUpdates).eq('id', trade.id);
                                if (!trUpErr) {
                                    console.log(`Auto-unlocked fully paid trade ${trade.id} for user ${uid}.`);
                                } else {
                                    console.error(`Failed to auto-unlock trade ${trade.id}:`, trUpErr);
                                }
                            } else if (settlementBudget > 0) {
                                // Calculate how much of the debt we can pay with remaining budget
                                const payAmount = Math.min(outAmt, settlementBudget);
                                settlementBudget -= payAmount;

                                const newOut = outAmt - payAmount;
                                const originalPaid = parseFloat(trade.paid_amount) || 0;

                                const tradeUpdates = {
                                    outstanding_amount: newOut,
                                    paid_amount: originalPaid + payAmount
                                };

                                // If the trade is fully paid off, transition the status
                                if (newOut <= 0) {
                                    tradeUpdates.status = 'Holding';
                                    tradeUpdates.order_status = 'FILLED';
                                }

                                const { error: trUpErr } = await client.from('trades')
                                    .update(tradeUpdates)
                                    .eq('id', trade.id);

                                if (!trUpErr) {
                                    console.log(`Auto-settled trade ${trade.id} for user ${uid}. Paid: ${payAmount}, Remaining: ${newOut}`);
                                } else {
                                    console.error(`Failed to auto-settle trade ${trade.id}:`, trUpErr);
                                }
                            }
                        }
                    }
                } catch (autoErr) {
                    console.error("Error during auto-settlement of locked trades:", autoErr);
                }

                // --- GLOBAL SWEEP: Unconditionally unlock any fully paid locked trades ---
                try {
                    await client.from('trades')
                        .update({ status: 'Holding', order_status: 'FILLED' })
                        .eq('user_id', uid)
                        .eq('status', 'LOCKED_UNPAID')
                        .lte('outstanding_amount', 0);
                } catch (sweepErr) {
                    console.error("Global sweep error in updateDepositStatus:", sweepErr);
                }
                // --- END AUTO-SETTLE ---
            }
            else if (status !== 'Approved' && oldStatus === 'Approved') {
                // Reverse an approval (Correction)
                const { data: user, error: uErr } = await client.from('users').select('*').eq('id', uid).single();
                if (uErr) throw uErr;

                const currentBalance = parseFloat(user.balance) || 0;
                const newBalance = currentBalance - amount;

                const updates = {
                    balance: newBalance,
                    negative_balance: newBalance < 0
                };

                const { error: upErr } = await client.from('users').update(updates).eq('id', uid);
                if (upErr) throw upErr;
            }

            // 3. Update the deposit status
            const { error: finalErr } = await client.from('deposits').update({
                status,
                processed_at: new Date().toISOString()
            }).eq('id', id);

            if (finalErr) throw finalErr;

            return { success: true };
        } catch (err) {
            console.error("updateDepositStatus error:", err);
            return { success: false, error: err };
        }
    },

    async updateWithdrawalStatus(id, status) {
        const client = this.getClient();
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        if (auth.role === 'csr') {
            return { success: false, error: { message: "Unauthorized Role Action: CSR accounts are view-only for withdrawals." } };
        }
        const { error } = await client.from('withdrawals').update({ status, processed_at: new Date().toISOString() }).eq('id', id);
        return { success: !error, error };
    },

    async submitWithdrawal(withdrawalData) {
        const client = this.getClient();
        const missingColumns = new Set();
        let payload = { ...withdrawalData };
        let data = null;
        let error = null;

        for (let attempt = 0; attempt < 4; attempt++) {
            const result = await client
                .from('withdrawals')
                .insert([payload])
                .select()
                .single();

            data = result.data || null;
            error = result.error || null;

            if (!error) {
                try {
                    await this.rememberBankAccountUsage(withdrawalData?.user_id, withdrawalData);
                } catch (rememberError) {
                    console.warn('Failed to remember withdrawal bank account:', rememberError);
                }
                return { success: true, data, error: null };
            }

            const missingColumn = this.getSchemaMissingColumn(error, 'withdrawals');
            if (!missingColumn || missingColumns.has(missingColumn)) {
                break;
            }

            missingColumns.add(missingColumn);
            payload = this.sanitizeWithdrawalInsertData(withdrawalData, Array.from(missingColumns));
            console.warn(`Retrying withdrawal insert without unsupported column: ${missingColumn}`);
        }

        return { success: false, data, error };
    },

    // --- TRADING ---
    async submitTrade(tradeData) {
        const client = this.getClient();
        if (!client) return { success: false, error: { message: 'Database client not initialized' } };

        let insertData = this.sanitizeTradeInsertData(tradeData);
        const removedColumns = new Set();

        for (let attempt = 0; attempt < 6; attempt++) {
            const { data, error } = await client
                .from('trades')
                .insert([insertData])
                .select()
                .single();

            if (!error) {
                if (removedColumns.size) {
                    console.warn('submitTrade schema fallback removed columns:', Array.from(removedColumns));
                }
                return { success: true, data, error: null };
            }

            const missingColumn = this.getSchemaMissingColumn(error, 'trades');
            if (!missingColumn || removedColumns.has(missingColumn) || !(missingColumn in insertData)) {
                return { success: false, data, error };
            }

            removedColumns.add(missingColumn);
            insertData = this.sanitizeTradeInsertData(tradeData, Array.from(removedColumns));
            console.warn(`submitTrade retrying without missing column: ${missingColumn}`);
        }

        return { success: false, error: { message: 'Trade submission failed after schema fallback retries.' } };
    },

    async getTradesByUserId(userId) {
        const client = this.getClient();
        // Ensure userId is a number if the DB expect bigint/int8
        const numericId = parseInt(userId);

        const { data, error } = await client
            .from('trades')
            .select('*, products(*)')
            .eq('user_id', numericId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('getTradesByUserId error:', error);
            return [];
        }

        return (data || []).map(trade => ({
            ...trade,
            est_profit_percent: trade.products ? (trade.products.est_profit_percent || trade.products.profit) : null
        }));
    },

    async getAllTrades() {
        const client = this.getClient();
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        let query = client.from('trades').select('*, products(*)');
        if (auth.role === 'csr') {
            query = client.from('trades').select('*, users!inner(*), products(*)');
            if (auth.invitation_code) {
                query = query.or(`users.csr_id.eq.${auth.id},users.invitation_code.eq.${auth.invitation_code}`);
            } else {
                query = query.eq('users.csr_id', auth.id);
            }
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
            console.error('getAllTrades error:', error);
            return [];
        }

        return (data || []).map(trade => ({
            ...trade,
            est_profit_percent: trade.products ? (trade.products.est_profit_percent || trade.products.profit) : null
        }));
    },

    async updateTradeStatus(id, status, adminNote = '') {
        const client = this.getClient();
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');

        if (auth.role === 'csr') {
            const { data: trade } = await client.from('trades').select('*, users!inner(*)').eq('id', id).single();
            const hasCsrIdMatch = trade?.users?.csr_id == auth.id;
            const hasInvCodeMatch = auth.invitation_code && trade?.users?.invitation_code === auth.invitation_code;
            if (!hasCsrIdMatch && !hasInvCodeMatch) {
                return { success: false, error: { message: "Unauthorized Scope Violation" } };
            }
        }

        const updateData = {
            status,
            admin_note: adminNote,
            processed_at: new Date().toISOString()
        };
        const { data, error } = await client
            .from('trades')
            .update(updateData)
            .eq('id', id);

        return { success: !error, error };
    },

    async updateUserFinancials(userId, updates) {
        const client = this.getClient();
        // Fallback for old calls if they pass positional args
        if (typeof updates !== 'object') {
            const newBalance = arguments[1];
            const newInvested = arguments[2];
            const newOutstanding = arguments[3];
            const newFrozen = arguments[4];
            updates = { balance: newBalance };
            if (newInvested !== undefined) updates.invested = newInvested;
            if (newOutstanding !== undefined) updates.outstanding = newOutstanding;
            if (newFrozen !== undefined) updates.frozen = newFrozen;
        }

        const { data, error } = await client
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select();

        if (!error && (!data || data.length === 0)) {
            return { success: false, error: { message: "User not found or update failed (RLS?)" } };
        }

        // --- PROPORTIONAL DEBT DISTRIBUTION & SWEEP ---
        try {
            // Wait for DB to settle new balance
            const { data: updatedUser } = await client.from('users').select('balance').eq('id', userId).single();
            const actualBalance = updatedUser ? parseFloat(updatedUser.balance) || 0 : (parseFloat(updates.balance) || 0);

            // Fetch locked trades to distribute capital across them
            const { data: lockedTrades } = await client.from('trades')
                .select('id, outstanding_amount, paid_amount')
                .eq('user_id', userId)
                .eq('status', 'LOCKED_UNPAID')
                .order('created_at', { ascending: true });

            if (lockedTrades && lockedTrades.length > 0) {
                // If they explicitly wiped outstanding to 0, or if they have plenty of cash to cover
                let availableCapital = 0;

                if (updates.outstanding === 0 || updates.outstanding === '0') {
                    // Admin specifically ordered to wipe debt
                    availableCapital = Infinity;
                } else if (actualBalance >= 0) {
                    // User is no longer in debt overall, so whatever total trade debt exists is fully covered
                    availableCapital = Infinity;
                } else {
                    // They are still in debt, but we must use whatever paid capital they have
                    // To compute paid capital: (Total Outstanding Debt of Trades) - ABS(Actual Balance)
                    const totalTradeDebt = lockedTrades.reduce((sum, t) => sum + (parseFloat(t.outstanding_amount) || 0), 0);
                    availableCapital = totalTradeDebt - Math.abs(actualBalance);
                }

                // Distribute
                if (availableCapital > 0) {
                    for (const trade of lockedTrades) {
                        const outAmt = parseFloat(trade.outstanding_amount) || 0;
                        if (outAmt > 0 && availableCapital > 0) {
                            const payAmt = Math.min(availableCapital, outAmt);
                            const newOut = outAmt - payAmt;
                            const originalPaid = parseFloat(trade.paid_amount) || 0;

                            const tradeUpdates = {
                                outstanding_amount: newOut,
                                paid_amount: originalPaid + payAmt
                            };

                            // Unlock if paid off
                            if (newOut <= 0.01) {  // Margin of precision float error safety
                                tradeUpdates.status = 'Holding';
                                tradeUpdates.order_status = 'FILLED';
                            }

                            await client.from('trades').update(tradeUpdates).eq('id', trade.id);
                            availableCapital -= payAmt;
                        } else if (outAmt <= 0.01) {
                            // Already paid off
                            await client.from('trades').update({ status: 'Holding', order_status: 'FILLED' }).eq('id', trade.id);
                        }
                    }
                }
            }

            // Absolute global sweep backup
            await client.from('trades')
                .update({ status: 'Holding', order_status: 'FILLED' })
                .eq('user_id', userId)
                .eq('status', 'LOCKED_UNPAID')
                .lte('outstanding_amount', 0);

        } catch (sweepErr) {
            console.error("Global sweep error in updateUserFinancials:", sweepErr);
        }

        return { success: !error, data, error };
    },

    computeTradeFeeAmounts(baseAmount) {
        const base = Number(baseAmount) || 0;
        const taxAmount = Math.round(base * 0.0012 * 100) / 100;
        const txnCharge = Math.round(base * 0.0003 * 100) / 100;
        return {
            baseAmount: Math.round(base * 100) / 100,
            taxAmount,
            txnCharge,
            totalFees: Math.round((taxAmount + txnCharge) * 100) / 100,
            totalDebit: Math.round((base + taxAmount + txnCharge) * 100) / 100
        };
    },

    async syncTradePricingFields(tradeId, updates = {}) {
        const client = this.getClient();
        if (!client) return { success: false, error: { message: 'Database client not initialized' } };
        const numericTradeId = parseInt(tradeId, 10);
        if (!Number.isFinite(numericTradeId) || numericTradeId <= 0) {
            return { success: false, error: { message: 'Invalid trade id' } };
        }

        const payload = {};
        [
            'price',
            'quantity',
            'requested_quantity',
            'approved_quantity',
            'total_amount',
            'final_total_amount',
            'tax_amount',
            'txn_charge',
            'paid_amount',
            'outstanding_amount',
            'status',
            'order_status'
        ].forEach((key) => {
            if (updates[key] !== undefined) payload[key] = updates[key];
        });

        if (!Object.keys(payload).length) return { success: true };

        let updatePayload = { ...payload };
        const removedColumns = new Set();

        for (let attempt = 0; attempt < 6; attempt++) {
            const { error } = await client
                .from('trades')
                .update(updatePayload)
                .eq('id', numericTradeId);

            if (!error) {
                if (removedColumns.size) {
                    console.warn('syncTradePricingFields schema fallback removed columns:', Array.from(removedColumns));
                }
                return { success: true, error: null };
            }

            const missingColumn = this.getSchemaMissingColumn(error, 'trades');
            if (!missingColumn || removedColumns.has(missingColumn) || !(missingColumn in updatePayload)) {
                return { success: false, error };
            }

            removedColumns.add(missingColumn);
            delete updatePayload[missingColumn];
            if (!Object.keys(updatePayload).length) {
                return { success: true, error: null };
            }
            console.warn(`syncTradePricingFields retrying without missing column: ${missingColumn}`);
        }

        return { success: false, error: { message: 'Trade pricing sync failed after schema fallback retries.' } };
    },

    async applyTradeFeeCharge({ userId, tradeId = null, feeAmount, lockOnShortfall = true }) {
        const client = this.getClient();
        if (!client) return { success: false, error: { message: 'Database client not initialized' } };

        const numericUserId = parseInt(userId, 10);
        const numericTradeId = tradeId != null ? parseInt(tradeId, 10) : null;
        const chargeAmount = Math.round((Number(feeAmount) || 0) * 100) / 100;
        if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
            return { success: false, error: { message: 'Invalid user id' } };
        }
        if (!(chargeAmount > 0)) {
            return { success: true, charged: 0, debtDelta: 0 };
        }

        const { data: user, error: userErr } = await client
            .from('users')
            .select('balance, outstanding')
            .eq('id', numericUserId)
            .single();
        if (userErr || !user) return { success: false, error: userErr || { message: 'User not found' } };

        const currentBalance = parseFloat(user.balance) || 0;
        const currentOutstanding = parseFloat(user.outstanding) || 0;
        const nextBalance = currentBalance - chargeAmount;
        const previousNegative = Math.max(0, -currentBalance);
        const nextNegative = Math.max(0, -nextBalance);
        const debtDelta = Math.max(0, nextNegative - previousNegative);

        const { error: updateUserErr } = await client
            .from('users')
            .update({
                balance: nextBalance,
                outstanding: Math.max(0, currentOutstanding + debtDelta),
                negative_balance: nextBalance < 0
            })
            .eq('id', numericUserId);
        if (updateUserErr) return { success: false, error: updateUserErr };

        if (numericTradeId && Number.isFinite(numericTradeId) && numericTradeId > 0 && debtDelta > 0 && lockOnShortfall) {
            const { data: trade } = await client
                .from('trades')
                .select('outstanding_amount')
                .eq('id', numericTradeId)
                .single();
            const currentTradeOutstanding = parseFloat(trade?.outstanding_amount) || 0;
            await client
                .from('trades')
                .update({
                    outstanding_amount: Math.max(0, currentTradeOutstanding + debtDelta),
                    status: 'LOCKED_UNPAID',
                    order_status: 'LOCKED'
                })
                .eq('id', numericTradeId);
        }

        return {
            success: true,
            charged: chargeAmount,
            debtDelta,
            newBalance: nextBalance
        };
    },

    // --- SUBSCRIPTION WALLET TRANSITIONS ---

    // --- SUBSCRIPTION WALLET TRANSITIONS (ATOMIC RPC DEPLOYMENT) ---

    // STAGE 1: Submit Subscription (Deduct Balance, Increase Frozen, Create Trade ATOMICALLY)
    async submitSubscriptionAtomic(tradeData) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database client not initialized' };

        const { data, error } = await client.rpc('submit_subscription_atomic', {
            p_user_id: tradeData.user_id,
            p_trade_data: tradeData
        });

        if (error) {
            console.error("RPC submit_subscription_atomic Error:", error);
            return { success: false, error: error.message || error };
        }
        if (data && data.success === false) {
            return { success: false, error: data.error };
        }
        return data;
    },

    // STAGE 2: Admin Approve (Deduct Frozen, Increase Invested, Mark Settled ATOMICALLY)
    async approveSubscriptionAtomic(tradeId, approvedQty, authId, authRole) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database client not initialized' };

        const tradeIdNum = parseInt(tradeId, 10);
        const approvedQtyNum = parseFloat(approvedQty) || 0;

        let preTrade = null;
        let preBalance = 0;
        let hasPreBalance = false;
        try {
            const { data: t0 } = await client
                .from('trades')
                .select('id, user_id, type, status, order_status, price, total_amount, paid_amount, tax_amount, txn_charge')
                .eq('id', tradeIdNum)
                .single();
            preTrade = t0 || null;
            if (preTrade?.user_id) {
                const { data: u0 } = await client
                    .from('users')
                    .select('balance')
                    .eq('id', preTrade.user_id)
                    .single();
                preBalance = parseFloat(u0?.balance) || 0;
                hasPreBalance = true;
            }
        } catch (preErr) {
            console.warn('approveSubscriptionAtomic prefetch warning:', preErr);
        }

        const { data, error } = await client.rpc('approve_subscription_atomic', {
            p_trade_id: tradeIdNum,
            p_approved_qty: approvedQtyNum,
            p_auth_id: parseInt(authId, 10),
            p_auth_role: authRole
        });

        if (error) {
            console.error("RPC approve_subscription_atomic Error:", error);
            return { success: false, error: error.message || error };
        }
        if (data && data.success === false) {
            return { success: false, error: data.error };
        }

        // Defensive fallback: old RPCs can approve IPO without deducting balance.
        const reconciled = await this._ensureSubscriptionApprovalDeduction({
            tradeId: tradeIdNum,
            approvedQty: approvedQtyNum,
            rpcData: data,
            preTrade,
            preBalance,
            hasPreBalance
        });
        if (reconciled && reconciled.success === false) return reconciled;
        return reconciled || data;
    },

    async _ensureSubscriptionApprovalDeduction({ tradeId, approvedQty, rpcData, preTrade, preBalance, hasPreBalance }) {
        const client = this.getClient();
        if (!client || !preTrade) return rpcData;
        if (!hasPreBalance) return rpcData;

        const typeLower = String(preTrade.type || '').toLowerCase();
        if (!typeLower.includes('ipo') && !typeLower.includes('otc')) return rpcData;

        const { data: postTrade, error: tradeErr } = await client
            .from('trades')
            .select('id, user_id, price, quantity, approved_quantity, paid_amount, outstanding_amount, status, order_status, tax_amount, txn_charge, total_amount')
            .eq('id', tradeId)
            .single();
        if (tradeErr || !postTrade) return rpcData;

        const { data: postUser, error: userErr } = await client
            .from('users')
            .select('balance, outstanding')
            .eq('id', postTrade.user_id)
            .single();
        if (userErr || !postUser) return rpcData;

        const tradePrice = parseFloat(postTrade.price ?? preTrade.price) || 0;
        const effectiveApprovedQty = Math.max(0, parseFloat(postTrade.approved_quantity ?? postTrade.quantity ?? approvedQty) || 0);
        const approvedValue = Math.max(0, effectiveApprovedQty * tradePrice);
        const paidAmount = parseFloat(postTrade.paid_amount) || 0;
        const expectedDeduction = Math.max(0, approvedValue - paidAmount);
        const postBalance = parseFloat(postUser.balance) || 0;
        const actualDeduction = Math.max(0, (parseFloat(preBalance) || 0) - postBalance);
        const missingDeduction = expectedDeduction - actualDeduction;

        let debtDelta = 0;
        let newBalance = postBalance;
        let nextRpcData = {
            ...(rpcData || {}),
            success: true,
            to_deduct: missingDeduction > 0.01 ? missingDeduction : (rpcData?.to_deduct || 0),
            new_balance: postBalance,
            status: postTrade.status || 'Holding',
            fallback_applied: false
        };
        if (missingDeduction > 0.01) {
            newBalance = postBalance - missingDeduction;
            const prevNeg = Math.max(0, -postBalance);
            const newNeg = Math.max(0, -newBalance);
            debtDelta = Math.max(0, newNeg - prevNeg);
            const paidIncrement = Math.max(0, missingDeduction - debtDelta);
            const currentOutstanding = parseFloat(postUser.outstanding) || 0;
            const tradeOutstanding = (parseFloat(postTrade.outstanding_amount) || 0) + debtDelta;
            const tradePaid = (parseFloat(postTrade.paid_amount) || 0) + paidIncrement;

            const { error: uErr } = await client.from('users').update({
                balance: newBalance,
                outstanding: Math.max(0, currentOutstanding + debtDelta),
                negative_balance: newBalance < 0
            }).eq('id', postTrade.user_id);
            if (uErr) {
                console.error('Subscription deduction fallback user update failed:', uErr);
                return { success: false, error: uErr.message || uErr };
            }

            const tradeUpdates = {
                paid_amount: tradePaid,
                outstanding_amount: tradeOutstanding
            };
            if (debtDelta > 0.01) {
                tradeUpdates.status = 'LOCKED_UNPAID';
                tradeUpdates.order_status = 'LOCKED';
            }

            const { error: tErr } = await client.from('trades').update(tradeUpdates).eq('id', tradeId);
            if (tErr) {
                console.error('Subscription deduction fallback trade update failed:', tErr);
                return { success: false, error: tErr.message || tErr };
            }

            nextRpcData = {
                ...nextRpcData,
                new_balance: newBalance,
                status: debtDelta > 0.01 ? 'LOCKED_UNPAID' : nextRpcData.status
            };
        }

        const feeMetrics = this.computeTradeFeeAmounts(approvedValue);
        const storedTax = parseFloat(postTrade.tax_amount) || 0;
        const storedTxn = parseFloat(postTrade.txn_charge) || 0;
        const feeCharge = typeLower.includes('ipo')
            ? Math.max(0, storedTax + storedTxn || feeMetrics.totalFees)
            : 0;

        if (feeCharge > 0) {
            const { data: feeUser } = await client
                .from('users')
                .select('balance')
                .eq('id', postTrade.user_id)
                .single();
            const balanceAfterBase = parseFloat(feeUser?.balance) || 0;
            const actualTotalDeduction = Math.max(0, (parseFloat(preBalance) || 0) - balanceAfterBase);
            const expectedTotalDeduction = Math.max(0, approvedValue + feeCharge);

            if ((expectedTotalDeduction - actualTotalDeduction) > 0.01) {
                const feeResult = await this.applyTradeFeeCharge({
                    userId: postTrade.user_id,
                    tradeId,
                    feeAmount: expectedTotalDeduction - actualTotalDeduction,
                    lockOnShortfall: true
                });
                if (!feeResult.success) return feeResult;

                nextRpcData = {
                    ...nextRpcData,
                    fee_charged: feeResult.charged,
                    fee_debt_delta: feeResult.debtDelta,
                    new_balance: feeResult.newBalance,
                    status: feeResult.debtDelta > 0.01 ? 'LOCKED_UNPAID' : nextRpcData.status
                };
            }
        }

        const finalSync = await this.syncTradePricingFields(tradeId, {
            approved_quantity: effectiveApprovedQty,
            quantity: effectiveApprovedQty,
            total_amount: approvedValue,
            final_total_amount: approvedValue,
            tax_amount: storedTax > 0 ? storedTax : feeMetrics.taxAmount,
            txn_charge: storedTxn > 0 ? storedTxn : feeMetrics.txnCharge
        });
        if (!finalSync.success) return finalSync;

        return nextRpcData;
    },

    // STAGE 3: Admin Reject (Deduct Frozen, Return to Balance, Mark Rejected ATOMICALLY)
    async rejectSubscriptionAtomic(tradeId, authId, authRole) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database client not initialized' };

        const { data, error } = await client.rpc('reject_subscription_atomic', {
            p_trade_id: parseInt(tradeId),
            p_auth_id: parseInt(authId),
            p_auth_role: authRole
        });

        if (error) {
            console.error("RPC reject_subscription_atomic Error:", error);
            return { success: false, error: error.message || error };
        }
        if (data && data.success === false) {
            return { success: false, error: data.error };
        }
        return data;
    },

    // Fallback legacy methods (Modified to handle direct errors better)
    async submitSubscriptionStage1(userId, amount) {
        const client = this.getClient();
        if (!client) return { success: false };
        const { data, error } = await client.from('users').select('balance, frozen').eq('id', userId).single();
        if (!user) return { success: false, message: 'User not found' };
        const currentBalance = parseFloat(user.balance) || 0;
        const currentFrozen = parseFloat(user.frozen) || 0;
        if (currentBalance < amount) return { success: false, message: 'Insufficient balance' };
        const { error: upErr } = await client.from('users').update({
            balance: currentBalance - amount,
            frozen: currentFrozen + amount
        }).eq('id', userId);
        return { success: !upErr, error: upErr };
    },
    async approveSubscriptionStage2(userId, amount) {
        const client = this.getClient();
        if (!client) return { success: false };
        const { data: user } = await client.from('users').select('frozen, invested').eq('id', userId).single();
        if (!user) return { success: false };
        const { error } = await client.from('users').update({
            frozen: Math.max(0, (parseFloat(user.frozen) || 0) - amount),
            invested: (parseFloat(user.invested) || 0) + amount
        }).eq('id', userId);
        return { success: !error, error };
    },
    async rejectSubscriptionStage3(userId, amount) {
        const client = this.getClient();
        if (!client) return { success: false };
        const { data: user } = await client.from('users').select('balance, frozen').eq('id', userId).single();
        if (!user) return { success: false };
        const { error } = await client.from('users').update({
            balance: (parseFloat(user.balance) || 0) + amount,
            frozen: Math.max(0, (parseFloat(user.frozen) || 0) - amount)
        }).eq('id', userId);
        return { success: !error, error };
    },

    // --- PRODUCT MANAGEMENT ---
    async getProducts(createdBy = null) {
        const client = this.getClient();
        if (!client) return [];

        let query = client
            .from('products')
            .select('*')
            .or('is_deleted.is.null,is_deleted.eq.false');

        if (createdBy) {
            query = query.eq('created_by', createdBy);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching products:", error);
            return [];
        }
        return data || [];
    },

    async getActiveProductsByType(type) {
        const client = this.getClient();
        if (!client) return [];

        let query = client
            .from('products')
            .select('*')
            .or('is_deleted.is.null,is_deleted.eq.false')
            .eq('status', 'Active');

        if (type === 'IPO') {
            // For IPO, match explicit 'IPO' or catch legacy nulls/empties
            query = query.or('product_type.eq.IPO,product_type.is.null');
        } else if (type === 'OTC') {
            query = query.eq('product_type', 'OTC');
        } else if (type === 'Ins.stocks') {
            query = query.eq('product_type', 'Ins.stocks');
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error(`Error fetching ${type} products:`, error);
            return [];
        }
        return data || [];
    },

    async getCachedMarketPrice(symbol, name = '') {
        const live = await this.getMarketPrice(symbol, name);
        const livePrice = Number(live?.price);
        if (live && live.status !== 'error' && Number.isFinite(livePrice) && livePrice > 0) {
            return livePrice;
        }

        if (window.DISABLE_MARKET_DB === true) return null;
        const client = this.getClient();
        if (!client) return null;

        const candidates = this.getYahooSymbolCandidates(symbol);
        for (const sym of candidates) {
            const { data, error } = await client
                .from("market_cache")
                .select("price")
                .eq("symbol", sym)
                .maybeSingle();

            if (error) {
                if (this.isMarketCacheSchemaMissing(error)) {
                    this.disableMarketCache(error.message);
                    return null;
                }
                continue;
            }
            if (!data) continue;
            const price = Number(data.price);
            if (Number.isFinite(price) && price > 0) {
                return price;
            }
        }
        return null;
    },

    async saveProduct(productData) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database not connected' };
        const adminAuth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        const normalizedProductData = { ...productData };
        const profitPercent = Number(normalizedProductData.est_profit_percent ?? normalizedProductData.est_profit ?? normalizedProductData.profit);
        if (Number.isFinite(profitPercent) && profitPercent > 20) {
            normalizedProductData.est_profit_percent = 20;
            if (normalizedProductData.est_profit !== undefined) normalizedProductData.est_profit = 20;
            if (normalizedProductData.profit !== undefined) normalizedProductData.profit = 20;
        }
        const isNewProduct = !normalizedProductData.id || normalizedProductData.id.toString().startsWith('local_');
        const adminId = Number(adminAuth?.id);

        if (isNewProduct && !Number.isNaN(adminId) && Number.isFinite(adminId) && !normalizedProductData.created_by) {
            normalizedProductData.created_by = adminId;
        }

        const performSave = async (data) => {
            if (data.id && !data.id.toString().startsWith('local_')) {
                return await client
                    .from('products')
                    .update(data)
                    .eq('id', data.id)
                    .select()
                    .maybeSingle();
            } else {
                const { id, ...saveData } = data;
                return await client
                    .from('products')
                    .insert([saveData])
                    .select()
                    .maybeSingle();
            }
        };

        let workingProductData = { ...normalizedProductData };
        let result = await performSave(workingProductData);

        if (result.error && result.error.message && result.error.message.includes('created_by')) {
            console.log('Detected missing created_by column, falling back without owner column...');
            const fallbackData = { ...workingProductData };
            delete fallbackData.created_by;
            workingProductData = fallbackData;
            result = await performSave(fallbackData);
        }

        // Fallback for missing est_profit_percent column
        if (result.error && (result.error.message.includes('est_profit_percent') || result.error.code === 'PGRST204')) {
            console.log('Detected missing est_profit_percent, falling back to profit column...');
            const fallbackData = { ...workingProductData };
            if (fallbackData.est_profit_percent !== undefined) {
                fallbackData.profit = fallbackData.est_profit_percent;
                delete fallbackData.est_profit_percent;
            }
            workingProductData = fallbackData;
            result = await performSave(fallbackData);
        }

        if (result.error && result.error.message && result.error.message.includes('created_by')) {
            console.log('Detected missing created_by column after est_profit fallback, retrying without owner column...');
            const fallbackData = { ...workingProductData };
            delete fallbackData.created_by;
            workingProductData = fallbackData;
            result = await performSave(fallbackData);
        }

        // Fallback for environments where products.allotment_date is not added yet.
        if (result.error && result.error.message && result.error.message.includes('allotment_date')) {
            console.log('Detected missing allotment_date, falling back without allocation date column...');
            const fallbackData = { ...workingProductData };
            delete fallbackData.allotment_date;
            workingProductData = fallbackData;
            result = await performSave(fallbackData);
        }

        return { success: !result.error, data: result.data || null, error: result.error };
    },

    async deleteProduct(id) {
        const client = this.getClient();
        if (!client) return { success: false, error: { message: 'Database not connected' } };

        const normalizedId = Number.isFinite(Number(id)) ? Number(id) : id;
        const adminAuth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        const adminId = Number(adminAuth?.id);

        const hardDeleteResult = await client
            .from('products')
            .delete()
            .eq('id', normalizedId)
            .select('id')
            .maybeSingle();

        if (!hardDeleteResult.error && hardDeleteResult.data) {
            return { success: true, data: hardDeleteResult.data, mode: 'hard_delete' };
        }

        if (hardDeleteResult.error) {
            console.error("Hard delete product failed:", hardDeleteResult.error);
        }

        const trySoftDelete = async (payload) => {
            return await client
                .from('products')
                .update(payload)
                .eq('id', normalizedId)
                .select('id')
                .maybeSingle();
        };

        let softPayload = { is_deleted: true, status: 'Deleted' };
        if (!Number.isNaN(adminId) && Number.isFinite(adminId)) {
            softPayload.created_by = adminId;
        }

        let softDeleteResult = await trySoftDelete(softPayload);

        if (softDeleteResult.error && softDeleteResult.error.message && softDeleteResult.error.message.includes('created_by')) {
            const fallbackPayload = { ...softPayload };
            delete fallbackPayload.created_by;
            softDeleteResult = await trySoftDelete(fallbackPayload);
        }

        if (softDeleteResult.error && softDeleteResult.error.message && softDeleteResult.error.message.includes('is_deleted')) {
            softDeleteResult = await trySoftDelete({ status: 'Deleted' });
        }

        if (!softDeleteResult.error && softDeleteResult.data) {
            return { success: true, data: softDeleteResult.data, mode: 'soft_delete' };
        }

        return {
            success: false,
            error: softDeleteResult.error || hardDeleteResult.error || { message: 'No matching product was deleted.' }
        };
    },

    async updateProductStatus(id, newStatus) {
        const client = this.getClient();
        if (!client) return { success: false };
        const { error } = await client.from('products').update({ status: newStatus }).eq('id', id);
        return { success: !error, error };
    },

    // --- PLATFORM SETTINGS ---
    async getPlatformSettings(key) {
        const client = this.getClient();
        if (!client) return null;
        const { data, error } = await client
            .from('platform_settings')
            .select('value')
            .eq('key', key)
            .maybeSingle();

        if (error) {
            const message = String(error.message || '');
            if (error.code === 'PGRST116' || message.includes('0 rows')) {
                return null;
            }
            console.error(`Error fetching setting ${key}:`, error);
            return null;
        }
        return data ? data.value : null;
    },

    async updatePlatformSettings(key, value) {
        const client = this.getClient();
        if (!client) return { success: false };
        const { error } = await client
            .from('platform_settings')
            .upsert({ key, value, updated_at: new Date().toISOString() });

        if (!error && key === this.PRODUCT_PRICE_LOCKS_KEY) {
            this.productPriceLockCache = this.parsePlatformSettingObject(value);
            this.productPriceLockCacheTs = Date.now();
            this.clearMarketPriceCaches();
        }

        return { success: !error, error };
    },

    // --- LOANS ---
    async getLoans(userId) {
        const client = this.getClient();
        if (!client) return [];
        const query = client
            .from('loans')
            .select('*')
            .eq('user_id', parseInt(userId))
            .or('is_deleted.is.null,is_deleted.eq.false')
            .order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) {
            console.error("Error fetching loans:", error);
            if (error.code === 'PGRST204') {
                const { data: fallbackData } = await client.from('loans').select('*').eq('user_id', userId).order('created_at', { ascending: false });
                return fallbackData || [];
            }
        }
        return data || [];
    },

    async getAllLoans() {
        const client = this.getClient();
        if (!client) return [];
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        const isCsr = auth.role === 'csr';

        // 1. Fetch loans independently (Resilient against join/scoping errors)
        const { data: loans, error: loanErr } = await client
            .from('loans')
            .select('*')
            .or('is_deleted.is.null,is_deleted.eq.false')
            .order('created_at', { ascending: false });

        if (loanErr) {
            console.error('DB: getAllLoans Fetch Error:', loanErr);
        }

        if (loanErr || !loans) {
            const { data: fb } = await client.from('loans').select('*').limit(200);
            return fb || [];
        }

        // 2. Fetch users separately for manual mapping
        const { data: users } = await client.from('users').select('id, username, full_name, mobile, csr_id, invitation_code');

        // Manual mapping (Fail-safe Join)
        const finalData = (loans || []).map(loan => {
            loan.users = (users || []).find(u => String(u.id) === String(loan.user_id)) || null;
            return loan;
        });

        // 3. Apply CSR scope validation in-memory
        if (isCsr && finalData) {
            return finalData.filter(loan => {
                const u = loan.users;
                if (!u) return false;
                const hasIdMatch = String(u.csr_id) === String(auth.id);
                const hasInvMatch = auth.invitation_code && u.invitation_code === auth.invitation_code;
                return hasIdMatch || hasInvMatch;
            });
        }

        return finalData;
    },

    async submitLoan(loanData) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database disconnected' };

        // 1. Log Input for deep debugging
        console.log("DB: submitLoan called with:", loanData);

        // 2. Normalize Data (Ensuring types match requested schema)
        // STRICT: cast user_id to integer to match users table id
        const insertPacket = {
            user_id: parseInt(loanData.user_id),
            amount: parseFloat(loanData.amount),
            purpose: loanData.purpose || loanData.reason || 'Not specified',
            reason: loanData.purpose || loanData.reason || 'Not specified',
            status: 'Pending',
            created_at: new Date().toISOString(),
            is_deleted: false
        };

        console.log("DB: Normalized Insert Packet:", insertPacket);

        // 3. Execute Pure INSERT (No eligibility guard, no .single() which adds 400 overhead on fail)
        const { data, error } = await client
            .from('loans')
            .insert([insertPacket])
            .select();

        if (error) {
            console.error("DB: LOAN_INSERT_ERROR_DETECTED!");
            console.error("Error Message:", error.message);
            console.error("Error Details:", error.details);
            console.error("Error Hint:", error.hint);
            console.error("Full Error Object:", error);

            return {
                success: false,
                message: error.message || "Database Insertion Failed",
                details: error.details,
                hint: error.hint
            };
        }

        console.log("DB: Loan Insert Success:", data);
        return { success: true, data: data ? data[0] : null };
    },

    async updateLoanStatus(id, status, payload = {}) {
        const client = this.getClient();
        if (!client) return { success: false, error: { message: "Database client not available" } };

        const adminAuth = sessionStorage.getItem('admin_auth');
        if (!adminAuth) return { success: false, error: { message: "Admin session not found" } };

        const auth = JSON.parse(adminAuth);
        const adminId = parseInt(auth.id);
        const loanId = parseInt(id);

        if (isNaN(adminId)) return { success: false, error: { message: "Invalid Admin ID in session" } };
        if (isNaN(loanId)) return { success: false, error: { message: "Invalid Loan ID" } };

        console.log("DB: Executing secure loan operation:", { loanId, status, adminId, role: auth.role });

        // Call the secure RPC to handle ownership check and updates in the backend
        const { data, error } = await client.rpc('operate_loan_secure', {
            p_loan_id: loanId,
            p_status: status,
            p_admin_note: payload.admin_note || '',
            p_approved_amount: parseFloat(payload.amount) || 0,
            p_repayment_terms: payload.repayment_terms || '',
            p_eligibility: payload.loan_enabled !== undefined ? payload.loan_enabled : true,
            p_admin_id: adminId,
            p_admin_role: auth.role
        });

        if (error) {
            console.error("RPC operate_loan_secure Error:", error);
            return { success: false, error: error };
        }

        if (!data) return { success: false, error: { message: "No response from server" } };

        // Handle string errors from backend to ensure res.error.message works in UI
        if (data.success === false && typeof data.error === 'string') {
            return { success: false, error: { message: data.error }, data };
        }

        return { success: data.success, error: data.error, data: data };
    },

    async markLoanAsRepaid(id) {
        const client = this.getClient();
        if (!client) return { success: false, error: { message: "Database client not available" } };

        const adminAuth = sessionStorage.getItem('admin_auth');
        if (!adminAuth) return { success: false, error: { message: "Admin session not found" } };

        const auth = JSON.parse(adminAuth);
        const adminId = parseInt(auth.id);
        const loanId = parseInt(id);

        if (isNaN(adminId)) return { success: false, error: { message: "Invalid Admin ID in session" } };
        if (isNaN(loanId)) return { success: false, error: { message: "Invalid Loan ID" } };

        console.log("DB: Marking loan as fully repaid:", { loanId, adminId, role: auth.role });

        const { data, error } = await client.rpc('repay_loan_secure', {
            p_loan_id: loanId,
            p_admin_id: adminId,
            p_admin_role: auth.role
        });

        if (error) {
            console.error("RPC repay_loan_secure Error:", error);
            return { success: false, error: error };
        }

        if (!data) return { success: false, error: { message: "No response from server" } };

        if (data.success === false && typeof data.error === 'string') {
            return { success: false, error: { message: data.error }, data };
        }

        return { success: data.success, error: data.error, data: data };
    },

    async update_user_loan_eligibility(userId, enabled) {
        // Since we now have a secure RPC for loan operations that can also toggle eligibility,
        // we could call it if this was related to a loan. 
        // For general eligibility toggle, we can use a separate RPC or just keep the client-side check if RLS allows it on 'users' table.
        // However, the user asked to enforce scope in backend.

        const client = this.getClient();
        const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
        const isCsr = auth.role === 'csr';

        if (isCsr) {
            const { data: u } = await client.from('users').select('csr_id, invitation_code').eq('id', userId).single();
            const hasCsrIdMatch = u?.csr_id == auth.id;
            const hasInvCodeMatch = auth.invitation_code && u?.invitation_code === auth.invitation_code;
            if (!hasCsrIdMatch && !hasInvCodeMatch) {
                return { success: false, error: "Unauthorized Scope Violation" };
            }
        }

        const { error } = await client
            .from('users')
            .update({ loan_enabled: enabled })
            .eq('id', userId);

        return { success: !error, error };
    },

    async deleteLoanRecord(id) {
        // Soft delete using the update helper on 'loans' table
        return await this.update('loans', { is_deleted: true }, { id });
    },

    async deleteStockTrade(id) {
        return await this.update('trades', { is_deleted: true }, { id });
    },

    async deleteLargeTransaction(id) {
        return await this.update('trades', { is_deleted: true }, { id });
    },

    async deleteIPORecord(id) {
        return await this.update('trades', { is_deleted: true }, { id });
    },

    async deleteDeposit(id) {
        const client = this.getClient();
        if (!client) return { success: false };
        const { error } = await client.from('deposits').delete().eq('id', id);
        return { success: !error, error };
    },

    /**
     * Turbo Auto-Fetch Data Source (Categorized)
     */
    async getTurboMarketData(type = 'IPO') {
        const data = {
            'IPO': [],
            'OTC': [],
            'Ins.stocks': [
                {
                    name: "Reliance Industries Limited",
                    symbol: "RELIANCE",
                    market_symbol: "RELIANCE.NS",
                    exchange: "NSE",
                    price: 1348.3,
                    description: "India's largest listed company by market capitalization.",
                    min_invest: 50000,
                    est_profit: 0
                },
                {
                    name: "HDFC Bank Limited",
                    symbol: "HDFCBANK",
                    market_symbol: "HDFCBANK.NS",
                    exchange: "NSE",
                    price: 735,
                    description: "India's leading private sector bank and blue-chip financial stock.",
                    min_invest: 50000,
                    est_profit: 0
                },
                {
                    name: "Bharti Airtel Limited",
                    symbol: "BHARTIARTL",
                    market_symbol: "BHARTIARTL.NS",
                    exchange: "NSE",
                    price: 1789.2,
                    description: "Top telecom blue chip with large domestic and international operations.",
                    min_invest: 50000,
                    est_profit: 0
                },
                {
                    name: "State Bank of India",
                    symbol: "SBIN",
                    market_symbol: "SBIN.NS",
                    exchange: "NSE",
                    price: 980.8,
                    description: "India's largest public sector bank and a core market heavyweight.",
                    min_invest: 50000,
                    est_profit: 0
                },
                {
                    name: "ICICI Bank Limited",
                    symbol: "ICICIBANK",
                    market_symbol: "ICICIBANK.NS",
                    exchange: "NSE",
                    price: 1211.8,
                    description: "Major Indian banking blue chip with strong retail and corporate franchises.",
                    min_invest: 50000,
                    est_profit: 0
                },
                {
                    name: "Tata Consultancy Services Limited",
                    symbol: "TCS",
                    market_symbol: "TCS.NS",
                    exchange: "NSE",
                    price: 2365,
                    description: "Flagship Tata IT services company and one of India's top market-cap stocks.",
                    min_invest: 50000,
                    est_profit: 0
                },
                {
                    name: "Bajaj Finance Limited",
                    symbol: "BAJFINANCE",
                    market_symbol: "BAJFINANCE.NS",
                    exchange: "NSE",
                    price: 802,
                    description: "Blue-chip non-banking financial company with broad consumer finance reach.",
                    min_invest: 50000,
                    est_profit: 0
                },
                {
                    name: "Infosys Limited",
                    symbol: "INFY",
                    market_symbol: "INFY.NS",
                    exchange: "NSE",
                    price: 1247.8,
                    description: "Global IT services leader and one of India's most recognized large caps.",
                    min_invest: 50000,
                    est_profit: 0
                },
                {
                    name: "Hindustan Unilever Limited",
                    symbol: "HINDUNILVR",
                    market_symbol: "HINDUNILVR.NS",
                    exchange: "NSE",
                    price: 2057,
                    description: "Consumer staples blue chip with strong household brand leadership.",
                    min_invest: 50000,
                    est_profit: 0
                },
                {
                    name: "Larsen & Toubro Limited",
                    symbol: "LT",
                    market_symbol: "LT.NS",
                    exchange: "NSE",
                    price: 3505,
                    description: "Large-cap engineering and infrastructure leader in India.",
                    min_invest: 50000,
                    est_profit: 0
                },
                {
                    name: "Bluestone Jewellery and Lifestyle Limited",
                    symbol: "BLUESTONE",
                    market_symbol: "BLUESTONE.NS",
                    exchange: "NSE",
                    price: 521.8,
                    description: "Indian jewellery retail stock available for institutional-style product seeding.",
                    min_invest: 50000,
                    est_profit: 0
                }
            ]
        };

        const parseTurboDate = (value) => {
            const raw = String(value || '').trim();
            if (!raw) return null;
            const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
            const parsed = new Date(normalized);
            if (Number.isNaN(parsed.getTime())) return null;
            parsed.setHours(0, 0, 0, 0);
            return parsed;
        };

        const normalizeTurboExchange = (value) => {
            const upper = String(value || '').trim().toUpperCase();
            if (!upper) return '';
            if (upper.includes('NSE')) return 'NSE';
            if (upper.includes('BSE')) return 'BSE';
            return upper;
        };

        const normalizeTurboSymbol = (value) => String(value || '')
            .trim()
            .toUpperCase()
            .replace(/^NSE:|^BSE:/, '')
            .replace(/\.(NS|BO|NSE|BSE|BOM)$/i, '');

        const normalizeTurboItem = (row) => {
            const exchange = normalizeTurboExchange(row?.exchange || row?.market);
            const rawSymbol = row?.symbol || row?.market_symbol || '';
            const symbol = normalizeTurboSymbol(rawSymbol);
            const subscriptionPrice = Number(row?.subscription_price);
            const livePrice = Number(row?.price);
            const minInvest = Number(row?.min_invest ?? row?.minInvest ?? row?.minimum_investment);
            const profitRaw = row?.est_profit_percent
                ?? row?.est_profit
                ?? row?.profit
                ?? row?.estimated_profit
                ?? row?.ipo_yield
                ?? row?.yield
                ?? '';

            return {
                ...row,
                name: row?.name || row?.title || symbol || '',
                symbol,
                market_symbol: row?.market_symbol || rawSymbol || symbol,
                exchange: exchange || 'NSE',
                price: Number.isFinite(subscriptionPrice) && subscriptionPrice > 0
                    ? subscriptionPrice
                    : (Number.isFinite(livePrice) && livePrice > 0 ? livePrice : 0),
                live_price: Number.isFinite(livePrice) && livePrice > 0 ? livePrice : null,
                listing_date: row?.listing_date || '',
                start_date: row?.start_date || '',
                end_date: row?.end_date || '',
                allotment_date: row?.allotment_date || row?.allocation_date || '',
                description: row?.description || '',
                min_invest: Number.isFinite(minInvest) && minInvest > 0 ? minInvest : 0,
                est_profit_percent: profitRaw,
                est_profit: profitRaw,
                profit: profitRaw
            };
        };

        const isTurboIpoCandidate = (row) => {
            const explicitType = String(row?.product_type || row?.type || '').trim().toUpperCase();
            if (explicitType) return explicitType === 'IPO';
            return !!(row?.listing_date || row?.start_date || row?.end_date || row?.allotment_date || row?.allocation_date);
        };

        const ipoCutoff = new Date();
        ipoCutoff.setHours(0, 0, 0, 0);
        ipoCutoff.setDate(ipoCutoff.getDate() - 45);

        const isCurrentTurboIpo = (row) => {
            const dates = [
                row?.start_date,
                row?.end_date,
                row?.allotment_date,
                row?.allocation_date,
                row?.listing_date
            ]
                .map(parseTurboDate)
                .filter(Boolean);

            if (!dates.length) return true;
            return dates.some((date) => date >= ipoCutoff);
        };

        const sortTurboIpo = (left, right) => {
            const getSortDate = (row) => (
                parseTurboDate(row?.start_date)
                || parseTurboDate(row?.end_date)
                || parseTurboDate(row?.listing_date)
                || parseTurboDate(row?.allotment_date)
                || parseTurboDate(row?.allocation_date)
            );
            const leftDate = getSortDate(left);
            const rightDate = getSortDate(right);
            if (leftDate && rightDate) return leftDate - rightDate;
            if (leftDate) return -1;
            if (rightDate) return 1;
            return String(left?.name || '').localeCompare(String(right?.name || ''));
        };

        if (type === 'IPO') {
            try {
                const activeIpos = await this.getActiveProductsByType('IPO');
                const normalizedIpos = (activeIpos || [])
                    .filter(isTurboIpoCandidate)
                    .map(normalizeTurboItem)
                    .filter(isCurrentTurboIpo)
                    .sort(sortTurboIpo);

                if (normalizedIpos.length > 0) {
                    return normalizedIpos;
                }
            } catch (error) {
                console.error('Failed to load IPO products from DB:', error);
            }

            return (data.IPO || [])
                .map(normalizeTurboItem)
                .filter(isCurrentTurboIpo)
                .sort(sortTurboIpo);
        }

        return data[type] || [];
    },

    // --- ATOMIC SUBSCRIPTION & SETTLEMENT ---
    async submitSubscriptionAtomic(tradeData) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database client not initialized' };
        const normalizedTradeData = this.sanitizeTradeInsertData(tradeData);
        const { data, error } = await client.rpc('submit_subscription_atomic', {
            p_user_id: normalizedTradeData.user_id,
            p_trade_data: normalizedTradeData
        });
        if (error) {
            console.error("RPC submit_subscription_atomic Error:", error);
            return { success: false, error: error.message || error };
        }
        if (data && data.success === false) return { success: false, error: data.error };

        const tradeId = data?.trade_id || data?.id;
        const normalizedType = String(tradeData?.type || '').trim().toLowerCase();
        const baseTotalAmount = Number(
            tradeData?.base_total_amount
            ?? tradeData?.baseAmount
            ?? tradeData?.base_total
            ?? tradeData?.total_amount
        ) || 0;

        if (tradeId && ['ipo', 'otc'].includes(normalizedType)) {
            const syncResult = await this.syncTradePricingFields(tradeId, {
                price: tradeData?.price,
                quantity: tradeData?.quantity,
                requested_quantity: tradeData?.requested_quantity ?? tradeData?.quantity,
                total_amount: baseTotalAmount,
                tax_amount: tradeData?.tax_amount ?? 0,
                txn_charge: tradeData?.txn_charge ?? 0
            });
            if (!syncResult.success) {
                console.warn('submitSubscriptionAtomic pricing sync warning:', syncResult.error);
            }
        }

        return data;
    },

    async settleTradeBalance(tradeId, amount) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database client not initialized' };
        const user = this.getCurrentUser();
        if (!user) return { success: false, message: 'User not logged in' };
        const { data, error } = await client.rpc('settle_trade_balance_atomic', {
            p_user_id: user.id,
            p_trade_id: parseInt(tradeId),
            p_amount: parseFloat(amount)
        });
        if (error) {
            console.error("RPC settle_trade_balance_atomic Error:", error);
            return { success: false, error: error.message || error };
        }
        return data;
    },


    async rejectSubscriptionAtomic(tradeId, authId, authRole) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database client not initialized' };
        const { data, error } = await client.rpc('reject_subscription_atomic', {
            p_trade_id: parseInt(tradeId),
            p_auth_id: parseInt(authId),
            p_auth_role: authRole
        });
        if (error) {
            console.error("RPC reject_subscription_atomic Error:", error);
            return { success: false, error: error.message || error };
        }
        if (data && data.success === false) return { success: false, error: data.error };
        return data;
    }
};

console.log("window.DB INITIALIZED", window.DB);

// Automatically attempt session recovery on load AT THE VERY END
(async () => {
    console.log("[js/db.js] Auto-Init Triggered");
    if (window.DB && typeof window.DB.getCurrentUser === 'function' && typeof window.DB.restoreSessionByAuth === 'function') {
        if (!window.DB.getCurrentUser()) {
            await window.DB.restoreSessionByAuth();
        } else {
            console.log("User already in localStorage, setting DB_READY");
            window.DB_READY = true;
        }
    } else {
        console.error("DB Object not fully ready during auto-init!");
    }
})();


