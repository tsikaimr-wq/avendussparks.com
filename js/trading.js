console.log("馃敟 trading.js LOADED");
/**
 * Trading Logic - Close Order / Sell Trade
 */

let sellingTimer = null;
let isExecutingSell = false; // Flag to prevent double execution
const BUY_TAX_RATE = 0.0012;
const BUY_TXN_RATE = 0.0003;
const SELL_TAX_RATE = 0.0012;
const SELL_TXN_RATE = 0.0003;
const tradePriceRefreshAt = {};
const TRADE_PRICE_REFRESH_COOLDOWN_MS = 4000;
const PRODUCT_SELL_LOCKS_KEY = 'product_sell_locks';
const USER_SELL_LOCKS_KEY = 'user_sell_locks';
const PRODUCT_SELL_LOCK_CACHE_TTL_MS = 5000;
const USER_SELL_LOCK_CACHE_TTL_MS = 5000;
const USER_LOAN_LOCK_CACHE_TTL_MS = 5000;
let productSellLockCache = { ts: 0, data: {} };
let userSellLockCache = { ts: 0, data: {} };
const userLoanRestrictionCache = {};

const tradeToFiniteNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const roundTradeMoney = (value) => {
    const numeric = tradeToFiniteNumber(value) || 0;
    return Math.round(numeric * 100) / 100;
};

const normalizeTradeType = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/_/g, '.');
    if (!raw) return '';
    if (raw === 'ins.stock' || raw === 'ins stocks' || raw === 'insstocks') return 'ins.stocks';
    return raw;
};

const INDIA_TRADING_TIME_ZONE = 'Asia/Kolkata';
const INDIA_TRADE_START_MINUTES = (9 * 60) + 15;
const INDIA_TRADE_END_MINUTES = (15 * 60) + 30;

const getIndiaTradingClockParts = (date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: INDIA_TRADING_TIME_ZONE,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(date);
    const pick = (type) => parts.find(part => part.type === type)?.value || '';
    const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
    return {
        weekday: weekdayMap[pick('weekday')] ?? -1,
        hour: Number(pick('hour')) || 0,
        minute: Number(pick('minute')) || 0
    };
};

const getIndiaTradingWindowState = (date = new Date()) => {
    const clock = getIndiaTradingClockParts(date);
    const minutes = (clock.hour * 60) + clock.minute;
    const isWeekday = clock.weekday >= 1 && clock.weekday <= 5;
    const isOpen = isWeekday && minutes >= INDIA_TRADE_START_MINUTES && minutes < INDIA_TRADE_END_MINUTES;
    return { ...clock, minutes, isWeekday, isOpen };
};

const isSubscriptionOrderType = (value) => ['ipo', 'otc'].includes(normalizeTradeType(value));

const canExecuteTradeByWindow = (type, action = 'buy', date = new Date()) => {
    const normalizedType = normalizeTradeType(type);
    const state = getIndiaTradingWindowState(date);
    if (action === 'buy' && isSubscriptionOrderType(normalizedType)) {
        return {
            allowed: true,
            normalizedType,
            state
        };
    }
    return {
        allowed: state.isOpen,
        normalizedType,
        state
    };
};

const getTradeWindowClosedMessage = (type, action = 'buy') => {
    const normalizedType = normalizeTradeType(type);
    if (action === 'buy' && isSubscriptionOrderType(normalizedType)) return '';
    if (action === 'sell') {
        return 'Trading is only available Monday to Friday, 09:15-15:30 India time. Outside these hours, selling is unavailable.';
    }
    return 'Regular stock trading is only available Monday to Friday, 09:15-15:30 India time. Outside these hours, stock trading is unavailable, but IPO/OTC subscriptions can still be submitted.';
};

window.TradeExecutionWindow = window.TradeExecutionWindow || {
    getState: getIndiaTradingWindowState,
    canExecute: canExecuteTradeByWindow,
    getClosedMessage: getTradeWindowClosedMessage,
    isSubscriptionOrderType
};

const parseListingGateDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const dateOnly = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    const normalized = dateOnly ? `${dateOnly}T00:00:00` : raw;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
};

const hasListingStarted = (value) => {
    const listingDate = parseListingGateDate(value);
    if (!listingDate) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return listingDate <= today;
};

const isMarketTrackedTrade = (trade) => ['stock', 'ins.stocks', 'otc', 'ipo'].includes(normalizeTradeType(trade?.type));

const getTradeMarketSymbol = (trade) => String(
    trade?.products?.market_symbol
    || trade?.market_symbol
    || trade?.symbol
    || ''
).trim();

const getTradeCacheKey = (trade) => {
    const symbol = getTradeMarketSymbol(trade) || String(trade?.symbol || '').trim();
    return symbol.toUpperCase();
};

const getTradeProduct = (trade) => {
    const me = window.MarketEngine || {};
    if (typeof me.getProduct !== 'function') return trade?.products || null;
    return me.getProduct(getTradeMarketSymbol(trade))
        || me.getProduct(trade?.symbol)
        || me.getProduct(trade?.product_id)
        || trade?.products
        || null;
};

const getCachedTradeMarketPrice = (trade) => {
    const me = window.MarketEngine || {};
    const marketSymbol = getTradeMarketSymbol(trade);
    const livePrice = tradeToFiniteNumber(
        me.livePrices?.[marketSymbol]
        ?? me.livePrices?.[String(trade?.symbol || '').trim()]
    );
    if (livePrice !== null && livePrice > 0) return livePrice;

    const product = getTradeProduct(trade);
    const productPrice = tradeToFiniteNumber(product?.price ?? product?.subscription_price);
    if (productPrice !== null && productPrice > 0) return productPrice;

    const sellPrice = tradeToFiniteNumber(trade?.sell_price);
    if (sellPrice !== null && sellPrice > 0) return sellPrice;

    const buyPrice = tradeToFiniteNumber(trade?.price);
    return (buyPrice !== null && buyPrice > 0) ? buyPrice : 0;
};

const getTradeQuantity = (trade) => {
    const quantity = tradeToFiniteNumber(trade?.quantity);
    if (quantity !== null && quantity > 0) return quantity;
    const requestedQuantity = tradeToFiniteNumber(trade?.requested_quantity);
    if (requestedQuantity !== null && requestedQuantity > 0) return requestedQuantity;
    const approvedQuantity = tradeToFiniteNumber(trade?.approved_quantity);
    if (approvedQuantity !== null && approvedQuantity > 0) return approvedQuantity;
    return 0;
};

const getTradeEntryPrice = (trade) => {
    const price = tradeToFiniteNumber(trade?.price);
    return (price !== null && price > 0) ? price : 0;
};

const computeTradeFeeAmounts = (baseAmount) => {
    const base = tradeToFiniteNumber(baseAmount) || 0;
    const buyTax = roundTradeMoney(base * BUY_TAX_RATE);
    const buyTxnCharge = roundTradeMoney(base * BUY_TXN_RATE);
    return {
        baseAmount: base,
        buyTax,
        buyTxnCharge,
        totalBuyFees: roundTradeMoney(buyTax + buyTxnCharge)
    };
};

const getTradeBuyFeeMetrics = (trade) => {
    const qty = getTradeQuantity(trade);
    const buyPrice = getTradeEntryPrice(trade);
    const baseOrderValue = roundTradeMoney(qty * buyPrice);
    const computed = computeTradeFeeAmounts(baseOrderValue);

    const storedBuyTax = tradeToFiniteNumber(trade?.tax_amount);
    const storedBuyTxnCharge = tradeToFiniteNumber(trade?.txn_charge);
    const buyTax = (storedBuyTax !== null && storedBuyTax > 0) ? storedBuyTax : computed.buyTax;
    const buyTxnCharge = (storedBuyTxnCharge !== null && storedBuyTxnCharge > 0) ? storedBuyTxnCharge : computed.buyTxnCharge;
    const totalBuyFees = roundTradeMoney(buyTax + buyTxnCharge);

    return {
        qty,
        buyPrice,
        baseOrderValue,
        buyTax,
        buyTxnCharge,
        totalBuyFees
    };
};

const getTradeActualDebitValue = (trade) => {
    const { baseOrderValue, totalBuyFees } = getTradeBuyFeeMetrics(trade);
    const storedTotal = tradeToFiniteNumber(trade?.total_amount);
    const totalWithFees = roundTradeMoney(baseOrderValue + totalBuyFees);

    if (storedTotal !== null && storedTotal > 0) {
        if (Math.abs(storedTotal - baseOrderValue) <= 0.05) return totalWithFees;
        return storedTotal;
    }

    return totalWithFees;
};

const computeTradeProfitAmount = (entryPrice, marketPrice, quantity) =>
    roundTradeMoney(((tradeToFiniteNumber(marketPrice) || 0) - (tradeToFiniteNumber(entryPrice) || 0)) * (tradeToFiniteNumber(quantity) || 0));

const computeTradeProfitPercent = (entryPrice, marketPrice) => {
    const entry = tradeToFiniteNumber(entryPrice) || 0;
    if (entry <= 0) return 0;
    return (((tradeToFiniteNumber(marketPrice) || 0) - entry) / entry) * 100;
};

const cacheTradeMarketPrice = (trade, price) => {
    const numericPrice = tradeToFiniteNumber(price);
    if (numericPrice === null || numericPrice <= 0) return;

    const me = window.MarketEngine || {};
    const marketSymbol = getTradeMarketSymbol(trade);
    if (marketSymbol) {
        me.livePrices = me.livePrices || {};
        me.livePrices[marketSymbol] = numericPrice;
    }

    const product = getTradeProduct(trade);
    if (product) {
        product.price = numericPrice;
        product.isCached = true;
        product.cacheStale = false;
        product.updated_at = new Date().toISOString();
    }
};

const getTradeCostBasis = (trade) => {
    return getTradeActualDebitValue(trade);
};

const computeExitFees = (grossSaleValue) => {
    const gross = tradeToFiniteNumber(grossSaleValue) || 0;
    const sellTax = gross * SELL_TAX_RATE;
    const sellFees = gross * SELL_TXN_RATE;
    return {
        grossSaleValue: gross,
        sellTax,
        sellFees,
        netSaleValue: gross - sellTax - sellFees
    };
};

const computeUnrealizedTradeMetrics = (trade, currentPrice = null) => {
    const { qty, buyPrice, baseOrderValue, buyTax, buyTxnCharge, totalBuyFees } = getTradeBuyFeeMetrics(trade);
    const livePrice = tradeToFiniteNumber(currentPrice);
    const effectivePrice = (livePrice !== null && livePrice > 0)
        ? livePrice
        : getCachedTradeMarketPrice(trade);
    const costBasis = getTradeCostBasis(trade);
    const exitFees = computeExitFees(effectivePrice * qty);
    const profit = computeTradeProfitAmount(buyPrice, effectivePrice, qty);
    const profitPct = computeTradeProfitPercent(buyPrice, effectivePrice);

    return {
        qty,
        buyPrice,
        baseOrderValue,
        buyTax,
        buyTxnCharge,
        totalBuyFees,
        currentPrice: effectivePrice,
        costBasis,
        grossSaleValue: exitFees.grossSaleValue,
        sellTax: exitFees.sellTax,
        sellFees: exitFees.sellFees,
        netSaleValue: exitFees.netSaleValue,
        profit,
        profitPct
    };
};

const computeRealizedTradeMetrics = (trade) => {
    const { qty, buyPrice, baseOrderValue, buyTax, buyTxnCharge, totalBuyFees } = getTradeBuyFeeMetrics(trade);
    const costBasis = getTradeCostBasis(trade);
    const sellPrice = tradeToFiniteNumber(trade?.sell_price) || getCachedTradeMarketPrice(trade);

    const storedNet = tradeToFiniteNumber(trade?.total_sale_value);
    const fallbackExit = computeExitFees(sellPrice * qty);
    const netSaleValue = storedNet !== null ? storedNet : fallbackExit.netSaleValue;
    const sellTax = tradeToFiniteNumber(trade?.sell_tax);
    const sellFees = tradeToFiniteNumber(trade?.sell_fees);
    const profit = computeTradeProfitAmount(buyPrice, sellPrice, qty);
    const profitPct = computeTradeProfitPercent(buyPrice, sellPrice);

    return {
        qty,
        buyPrice,
        baseOrderValue,
        buyTax,
        buyTxnCharge,
        totalBuyFees,
        currentPrice: sellPrice,
        costBasis,
        grossSaleValue: storedNet !== null ? (netSaleValue + (sellTax || 0) + (sellFees || 0)) : fallbackExit.grossSaleValue,
        sellTax: sellTax ?? fallbackExit.sellTax,
        sellFees: sellFees ?? fallbackExit.sellFees,
        netSaleValue,
        profit,
        profitPct
    };
};

const refreshTradeMarketPrice = async (trade, options = {}) => {
    if (!trade || !isMarketTrackedTrade(trade)) return getCachedTradeMarketPrice(trade);

    const force = options.force === true;
    const marketSymbol = getTradeMarketSymbol(trade);
    if (!marketSymbol) return getCachedTradeMarketPrice(trade);

    const cacheKey = getTradeCacheKey(trade);
    const now = Date.now();
    if (!force && tradePriceRefreshAt[cacheKey] && (now - tradePriceRefreshAt[cacheKey]) < TRADE_PRICE_REFRESH_COOLDOWN_MS) {
        return getCachedTradeMarketPrice(trade);
    }
    tradePriceRefreshAt[cacheKey] = now;

    const product = getTradeProduct(trade);
    const productName = String(trade?.name || product?.name || '').trim();

    try {
        if (window.DB && typeof window.DB.getMarketPrice === 'function') {
            const payload = await window.DB.getMarketPrice(marketSymbol, productName);
            const price = tradeToFiniteNumber(payload?.price);
            if (price !== null && price > 0) {
                cacheTradeMarketPrice(trade, price);
                return price;
            }
        }
    } catch (error) {
        console.warn("DB market price refresh failed:", error);
    }

    try {
        if (window.MarketEngine && typeof window.MarketEngine.fetchMarketPrice === 'function') {
            const price = await window.MarketEngine.fetchMarketPrice(marketSymbol);
            const numericPrice = tradeToFiniteNumber(price);
            if (numericPrice !== null && numericPrice > 0) {
                cacheTradeMarketPrice(trade, numericPrice);
                return numericPrice;
            }
        }
    } catch (error) {
        console.warn("MarketEngine live price refresh failed:", error);
    }

    return getCachedTradeMarketPrice(trade);
};

const parsePlatformSettingObject = (value) => {
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
};

const normalizeProductSellLockMap = (rawValue) => {
    const parsed = parsePlatformSettingObject(rawValue);
    const normalized = {};
    Object.entries(parsed).forEach(([key, value]) => {
        if (!key) return;
        if (typeof value === 'boolean') {
            normalized[String(key)] = { locked: value };
            return;
        }
        if (typeof value === 'string') {
            normalized[String(key)] = { locked: value.toLowerCase() !== 'false', reason: value };
            return;
        }
        if (value && typeof value === 'object') {
            normalized[String(key)] = {
                ...value,
                locked: value.locked !== false
            };
        }
    });
    return normalized;
};

const normalizeTradeKeyValue = (value) => String(value || '').trim().toUpperCase();

const getTradeIdentifierSet = (trade) => {
    const identifiers = new Set();
    [
        trade?.product_id,
        trade?.products?.id,
        trade?.symbol,
        trade?.products?.symbol,
        trade?.market_symbol,
        trade?.products?.market_symbol
    ].forEach((value) => {
        const normalized = normalizeTradeKeyValue(value);
        if (normalized) identifiers.add(normalized);
    });
    return identifiers;
};

const loadProductSellLockMap = async (options = {}) => {
    const force = options.force === true;
    const now = Date.now();
    if (!force && productSellLockCache.ts && (now - productSellLockCache.ts) < PRODUCT_SELL_LOCK_CACHE_TTL_MS) {
        return productSellLockCache.data || {};
    }

    try {
        const rawValue = await window.DB?.getPlatformSettings?.(PRODUCT_SELL_LOCKS_KEY);
        productSellLockCache = {
            ts: now,
            data: normalizeProductSellLockMap(rawValue)
        };
        return productSellLockCache.data;
    } catch (error) {
        console.warn("Failed to load product sell locks:", error);
        return productSellLockCache.data || {};
    }
};

const loadUserSellLockMap = async (options = {}) => {
    const force = options.force === true;
    const now = Date.now();
    if (!force && userSellLockCache.ts && (now - userSellLockCache.ts) < USER_SELL_LOCK_CACHE_TTL_MS) {
        return userSellLockCache.data || {};
    }

    try {
        const rawValue = await window.DB?.getPlatformSettings?.(USER_SELL_LOCKS_KEY);
        userSellLockCache = {
            ts: now,
            data: normalizeProductSellLockMap(rawValue)
        };
        return userSellLockCache.data;
    } catch (error) {
        console.warn("Failed to load user sell locks:", error);
        return userSellLockCache.data || {};
    }
};

const getUserSellLock = async (user, options = {}) => {
    const userId = String(user?.id || '').trim();
    if (!userId) return null;
    const lockMap = await loadUserSellLockMap(options);
    const directEntry = lockMap[userId];
    if (directEntry?.locked) return directEntry;
    return null;
};

const getTradeSellLock = async (trade, options = {}) => {
    if (!trade || !['ipo', 'otc'].includes(normalizeTradeType(trade?.type))) return null;
    const sellLocks = await loadProductSellLockMap(options);
    const identifiers = getTradeIdentifierSet(trade);

    for (const identifier of identifiers) {
        if (sellLocks[identifier]?.locked) {
            return sellLocks[identifier];
        }
    }

    for (const entry of Object.values(sellLocks)) {
        if (!entry?.locked) continue;
        const aliases = new Set();
        [
            entry.product_id,
            entry.id,
            entry.symbol,
            entry.market_symbol
        ].forEach((value) => {
            const normalized = normalizeTradeKeyValue(value);
            if (normalized) aliases.add(normalized);
        });
        for (const identifier of identifiers) {
            if (aliases.has(identifier)) return entry;
        }
    }

    return null;
};

const fetchUserLoanRestriction = async (userId, options = {}) => {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) return null;

    const force = options.force === true;
    const cached = userLoanRestrictionCache[numericUserId];
    const now = Date.now();
    if (!force && cached && (now - cached.ts) < USER_LOAN_LOCK_CACHE_TTL_MS) {
        return cached.data;
    }

    const client = window.DB?.getClient?.();
    if (!client) return null;

    const buildLoanRestriction = (rows) => {
        const activeLoan = (rows || []).find((loan) => {
            const status = String(loan?.status || '').trim().toUpperCase();
            if (!status || ['REJECTED', 'REPAID', 'FULLY_REPAID'].includes(status)) return false;
            const remainingBalance = tradeToFiniteNumber(loan?.remaining_balance);
            if (remainingBalance !== null) return remainingBalance > 0;
            if (loan?.loan_disbursed === true) return true;
            return ['APPROVED', 'ACTIVE', 'DISBURSED', 'OVERDUE'].includes(status);
        });

        if (!activeLoan) return null;

        const remainingBalance = tradeToFiniteNumber(activeLoan.remaining_balance);
        const amountText = remainingBalance !== null && remainingBalance > 0
            ? ` Outstanding loan balance: ₹${remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
            : '';
        return {
            loanId: activeLoan.id,
            message: `This IPO position cannot be sold until all active loans are fully repaid.${amountText}`
        };
    };

    let restriction = null;
    try {
        const { data, error } = await client
            .from('loans')
            .select('id, status, remaining_balance, loan_disbursed')
            .eq('user_id', numericUserId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        restriction = buildLoanRestriction(data);
    } catch (error) {
        try {
            const { data, error: fallbackError } = await client
                .from('loans')
                .select('id, status, amount')
                .eq('user_id', numericUserId)
                .order('created_at', { ascending: false });
            if (fallbackError) throw fallbackError;
            restriction = buildLoanRestriction(data);
        } catch (fallbackErr) {
            console.warn("Failed to load active loan restriction:", fallbackErr);
            restriction = null;
        }
    }

    userLoanRestrictionCache[numericUserId] = { ts: now, data: restriction };
    return restriction;
};

const getTradeSellRestrictionMessage = async (trade, user, options = {}) => {
    const userSellLock = await getUserSellLock(user, options);
    if (userSellLock) {
        return userSellLock.reason || 'Selling is locked for this customer.';
    }

    const sellLock = await getTradeSellLock(trade, options);
    if (sellLock) {
        return sellLock.reason || 'Selling is locked for this product.';
    }

    if (normalizeTradeType(trade?.type) === 'ipo') {
        const loanRestriction = await fetchUserLoanRestriction(user?.id, options);
        if (loanRestriction?.message) {
            return loanRestriction.message;
        }
    }

    return null;
};

window.TradePricing = {
    BUY_TAX_RATE,
    BUY_TXN_RATE,
    SELL_TAX_RATE,
    SELL_TXN_RATE,
    normalizeTradeType,
    isMarketTrackedTrade,
    getTradeMarketSymbol,
    getTradeProduct,
    getCachedTradeMarketPrice,
    refreshTradeMarketPrice,
    computeTradeFeeAmounts,
    getTradeBuyFeeMetrics,
    getTradeActualDebitValue,
    getTradeCostBasis,
    computeUnrealizedTradeMetrics,
    computeRealizedTradeMetrics,
    getTradeSellLock,
    getTradeSellRestrictionMessage
};

// Attach to window for global access
window.openCloseOrderModal = async function (tradeOrId) {
    const user = window.DB ? window.DB.getCurrentUser() : null;
    if (user && parseFloat(user.balance) < 0) {
        alert("Selling is disabled because your account has a negative balance. Please repay the outstanding amount to resume selling.");
        return;
    }

    let trade;
    if (typeof tradeOrId === 'object') {
        trade = tradeOrId;
    } else {
        // Fallback to searching in global transactionData if available
        const dataSource = window.transactionData || (typeof transactionData !== 'undefined' ? transactionData : null);
        trade = (dataSource && dataSource.all) ?
            dataSource.all.find(t => t.id == tradeOrId) : null;
    }

    if (!trade) {
        console.error("Trade not found for selling:", tradeOrId);
        alert("Trade details could not be found. Please try again.");
        return;
    }

    // LISTING DATE GUARD (UI Layer)
    if (trade.products && trade.products.listing_date) {
        const listingDate = parseListingGateDate(trade.products.listing_date);
        if (listingDate && !hasListingStarted(trade.products.listing_date)) {
            alert(`You cannot sell this asset before its official listing date (${listingDate.toLocaleDateString('en-IN')}).`);
            return;
        }
    }

    const sellRestrictionMessage = await getTradeSellRestrictionMessage(trade, user);
    if (sellRestrictionMessage) {
        alert(sellRestrictionMessage);
        return;
    }

    const tradeId = trade.id;
    let sellQuoteBusy = false;

    const updateSellingData = async (force = false) => {
        if (sellQuoteBusy) return;
        sellQuoteBusy = true;
        try {
            let currentPrice = getCachedTradeMarketPrice(trade);
            if (isMarketTrackedTrade(trade)) {
                const refreshedPrice = await refreshTradeMarketPrice(trade, { force });
                const numericPrice = tradeToFiniteNumber(refreshedPrice);
                if (numericPrice !== null && numericPrice > 0) {
                    currentPrice = numericPrice;
                }
            }

            const exitMetrics = computeUnrealizedTradeMetrics(trade, currentPrice);

            const priceEl = document.getElementById('coCurrPrice');
            const qtyEl = document.getElementById('coQty');
            const valEl = document.getElementById('coOrderVal');
            const taxEl = document.getElementById('coTaxAmt');
            const txnEl = document.getElementById('coTxnCharge');
            const netEl = document.getElementById('coNetReturn');

            if (priceEl) priceEl.innerText = '₹' + exitMetrics.currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            if (qtyEl) qtyEl.innerText = trade.quantity;
            if (valEl) valEl.innerText = '₹' + exitMetrics.grossSaleValue.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            if (taxEl) taxEl.innerText = '-₹' + exitMetrics.sellTax.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            if (txnEl) txnEl.innerText = '-₹' + exitMetrics.sellFees.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            if (netEl) netEl.innerText = '₹' + exitMetrics.netSaleValue.toLocaleString('en-IN', { minimumFractionDigits: 2 });

            const confirmBtn = document.getElementById('coConfirmBtn');
            if (confirmBtn) {
                confirmBtn.dataset.tradeId = tradeId;
                confirmBtn.dataset.sellPrice = exitMetrics.currentPrice;
                confirmBtn.dataset.netReturn = exitMetrics.netSaleValue;
            }
        } finally {
            sellQuoteBusy = false;
        }
    };

    const stockTitleEl = document.getElementById('coStockTitle');
    const symbolEl = document.getElementById('coSymbol');
    const buyPriceEl = document.getElementById('coBuyPrice');
    const qtyEl = document.getElementById('coQty');
    const orderValEl = document.getElementById('coOrderVal');

    if (stockTitleEl) stockTitleEl.innerText = trade.name;
    if (symbolEl) symbolEl.innerText = trade.symbol;
    if (buyPriceEl) buyPriceEl.innerText = '₹' + parseFloat(trade.price).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    if (qtyEl) qtyEl.innerText = trade.quantity;
    if (orderValEl) orderValEl.innerText = '₹' + parseFloat(trade.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    void updateSellingData(true);

    const modal = document.getElementById('closeOrderModal');
    if (modal) modal.style.display = 'flex';

    // Timer logic
    let totalSeconds = 20;
    let currentSeconds = totalSeconds;
    const bar = document.getElementById('coProgressBar');
    const txt = document.getElementById('coTimerText');

    if (bar && txt) {
        // Initial bar state
        bar.style.width = '100%';
        bar.style.transition = 'none'; // reset transition
        void bar.offsetWidth; // trigger reflow
        bar.style.transition = 'width 1s linear';
        txt.innerText = `Quotation expires in ${currentSeconds}s`;

        if (sellingTimer) clearInterval(sellingTimer);
        sellingTimer = setInterval(() => {
            currentSeconds--;
            txt.innerText = `Quotation expires in ${currentSeconds}s`;
            bar.style.width = (currentSeconds / totalSeconds * 100) + '%';

            // Real-time price update during quotation
            void updateSellingData();

            if (currentSeconds <= 0) {
                clearInterval(sellingTimer);
                window.closeSellingModal();
            }
        }, 1000);
    }

    // Refresh button
    const refreshBtn = document.getElementById('coRefreshBtn');
    if (refreshBtn) refreshBtn.onclick = () => void updateSellingData(true);

    // Redundant onclick binding removed to avoid double execution with HTML onclick="executeCloseOrder()"
    if (window.lucide) window.lucide.createIcons();
};

window.closeSellingModal = function () {
    const modal = document.getElementById('closeOrderModal');
    if (modal) modal.style.display = 'none';
    if (sellingTimer) clearInterval(sellingTimer);
    isExecutingSell = false;
};

window.handleSellTrade = async function (tradeId, sellPrice, netReturn) {
    if (!tradeId || isExecutingSell) return;

    const btn = document.getElementById('coConfirmBtn');
    if (!btn) return;

    isExecutingSell = true;
    const originalText = btn.innerText;
    btn.innerText = "EXECUTING...";
    btn.disabled = true;

    const client = window.DB ? window.DB.getClient() : null;
    const user = window.DB ? window.DB.getCurrentUser() : null;

    if (!client || !user) {
        btn.innerText = originalText;
        btn.disabled = false;
        isExecutingSell = false;
        return;
    }

    try {
        // 1. Fetch the latest trade data to ensure it hasn't been sold already
        const { data: trade, error: fetchErr } = await client.from('trades').select('*, products(*)').eq('id', tradeId).single();
        if (fetchErr || !trade) throw new Error("Could not find the original trade record.");
        if (trade.status === 'Sold') throw new Error("This position is already closed.");

        const tradeWindowCheck = canExecuteTradeByWindow(trade?.type || 'stock', 'sell');
        if (!tradeWindowCheck.allowed) {
            throw new Error(getTradeWindowClosedMessage(trade?.type || 'stock', 'sell'));
        }

        // IPO LOCKUP GUARD
        const lockupUntil = trade.lockup_until ? new Date(trade.lockup_until) : null;
        if (lockupUntil && lockupUntil > new Date()) {
            throw new Error(`This position is under lock-up until ${lockupUntil.toLocaleDateString('en-IN')}. Selling is disabled until then.`);
        }

        // --- TRADING FREEZE GUARD ---
        if (user.trading_frozen) {
            throw new Error("Trading functions are temporarily unavailable. Please check your account status or try again later.");
        }

        // --- LISTING DATE GUARD (fast path: use joined product first, query only if missing) ---
        let listingDateRaw = trade.products?.listing_date || null;
        if (!listingDateRaw) {
            const { data: product, error: prodErr } = await client
                .from('products')
                .select('listing_date')
                .eq('symbol', trade.symbol)
                .maybeSingle();
            if (!prodErr && product) listingDateRaw = product.listing_date || null;
        }
        if (listingDateRaw) {
            const listingDate = parseListingGateDate(listingDateRaw);
            if (listingDate && !hasListingStarted(listingDateRaw)) {
                throw new Error(`You cannot sell this asset before its official listing date (${listingDate.toLocaleDateString('en-IN')}).`);
            }
        }

        const sellRestrictionMessage = await getTradeSellRestrictionMessage(trade, user, { force: true });
        if (sellRestrictionMessage) {
            throw new Error(sellRestrictionMessage);
        }

        const finalSellPrice = await refreshTradeMarketPrice(trade, { force: true }) || getCachedTradeMarketPrice(trade) || sellPrice;
        const sellMetrics = computeUnrealizedTradeMetrics(trade, finalSellPrice);
        const qty = sellMetrics.qty;
        const buyAmount = sellMetrics.costBasis;
        const finalNetReturn = sellMetrics.netSaleValue;
        const realisedProfit = sellMetrics.profit;
        const sellTimeIso = new Date().toISOString();
        const finalisedNote = `Sold at Market ₹${Number(finalSellPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} @ ${new Date().toLocaleTimeString('en-IN')}`;

        const { error: tradeUpdateErr } = await client.from('trades').update({
            status: 'Sold',
            order_status: 'CLOSED',
            processed_at: sellTimeIso,
            sell_price: finalSellPrice,
            total_sale_value: finalNetReturn,
            realised_profit: realisedProfit,
            sell_timestamp: sellTimeIso,
            sell_tax: sellMetrics.sellTax,
            sell_fees: sellMetrics.sellFees,
            admin_note: finalisedNote
        }).eq('id', tradeId);
        if (tradeUpdateErr) throw tradeUpdateErr;

        // 4. Update user wallet (fast path: lightweight read+write, avoids heavy sweep logic)
        const { data: userFunds, error: userFundsErr } = await client
            .from('users')
            .select('balance, invested')
            .eq('id', user.id)
            .single();
        if (userFundsErr) throw userFundsErr;

        const currentBalance = parseFloat(userFunds.balance) || 0;
        const currentInvested = parseFloat(userFunds.invested) || 0;
        const newBalance = currentBalance + finalNetReturn;
        const newInvested = Math.max(0, currentInvested - buyAmount);

        const { error: finErr } = await client.from('users').update({
            balance: newBalance,
            invested: newInvested,
            negative_balance: newBalance < 0
        }).eq('id', user.id);
        if (finErr) throw finErr;

        // 5. Record proceeds history asynchronously (should not block sell completion)
        client.from('trades').insert([{
            user_id: user.id,
            symbol: trade.symbol,
            name: trade.name,
            type: trade.type, // Keep original type to satisfy type constraints.
            quantity: qty,
            price: finalSellPrice,
            total_amount: finalNetReturn,
            tax_amount: sellMetrics.sellTax,
            txn_charge: sellMetrics.sellFees,
            status: 'Sold',
            order_status: 'CLOSED',
            processed_at: sellTimeIso,
            admin_note: `Proceeds from selling ${qty} shares of ${trade.symbol}`
        }]).then(({ error: sellRecordErr }) => {
            if (sellRecordErr) console.warn("Sell ledger insert warning:", sellRecordErr);
        }).catch((ledgerErr) => {
            console.warn("Sell ledger insert exception:", ledgerErr);
        });

        if (window.showModal) {
            window.showModal('success', 'Trade Executed', `Sold ${qty} shares of ${trade.name} at ₹${Number(finalSellPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. ₹${finalNetReturn.toLocaleString('en-IN', { minimumFractionDigits: 2 })} has been credited to your wallet.`, () => {
                window.closeSellingModal();
                if (window.fetchUserTransactions) {
                    window.fetchUserTransactions().then(() => {
                        if (window.syncUserData) window.syncUserData();
                        if (window.renderDetailHoldings) window.renderDetailHoldings();
                        // Force refresh the specific holding list tab to remove the sold item
                        if (window.switchTransactionTab) window.switchTransactionTab(null, 'holding');
                    });
                }
            });
        } else {
            alert("Trade Successful!");
            window.closeSellingModal();
            location.reload();
        }

    } catch (e) {
        console.error("Sell Error:", e);
        alert("Execution failed: " + e.message);
        isExecutingSell = false;
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.executeCloseOrder = async function () {
    if (isExecutingSell) return;
    const btn = document.getElementById('coConfirmBtn');
    if (!btn) return;
    const tradeId = btn.dataset.tradeId;
    const sellPrice = parseFloat(btn.dataset.sellPrice);
    const netReturn = parseFloat(btn.dataset.netReturn);
    await window.handleSellTrade(tradeId, sellPrice, netReturn);
};

// --- Delegated Event Handler ---
document.addEventListener("click", function (e) {
    // 1. Close Order / Sell Trade
    const closeBtn = e.target.closest(".close-order-btn");
    if (closeBtn) {
        const tradeId = closeBtn.dataset.id;
        console.log("Close Order Clicked:", tradeId);
        if (typeof window.openCloseOrderModal === "function") {
            window.openCloseOrderModal(tradeId);
        } else {
            console.error("openCloseOrderModal is not defined");
        }
        return;
    }

    // 2. OTC / IPO Subscribe
    const subBtn = e.target.closest(".subscribe-btn");
    if (subBtn) {
        const productId = subBtn.dataset.id;
        const pName = subBtn.dataset.name;
        const pPrice = parseFloat(subBtn.dataset.price);
        const pYield = parseFloat(subBtn.dataset.yield);
        const pType = subBtn.dataset.type;

        console.log("Subscribe Clicked:", productId, pName, pType);

        if (typeof window.openOTCSubscribeModal === "function") {
            window.openOTCSubscribeModal(productId, {
                name: pName,
                price: pPrice,
                yield: pYield,
                type: pType
            });
        } else {
            console.error("openOTCSubscribeModal is not defined");
        }
        return;
    }
});

window.openStockTrade = function (product) {
    const productId = typeof product === 'string' ? product : (product.symbol || product.id);
    if (typeof window.openOTCSubscribeModal === "function") {
        window.openOTCSubscribeModal(productId);
    }
};

window.openOTCSubscribe = function (product) {
    const productId = typeof product === 'string' ? product : (product.symbol || product.id);
    if (typeof window.openOTCSubscribeModal === "function") {
        window.openOTCSubscribeModal(productId);
    }
};

window.openIPOSubscribe = function (product) {
    const productId = typeof product === 'string' ? product : (product.symbol || product.id);
    if (typeof window.openOTCSubscribeModal === "function") {
        window.openOTCSubscribeModal(productId);
    }
};

/**
 * Opens the subscription/detail view for OTC/IPO products
 */
window.openOTCSubscribeModal = function (productId, extraData = {}) {
    if (!productId) return;
    console.log("Opening Subscription/Trade for:", productId);

    const me = window.MarketEngine;
    if (!me) {
        console.error("MarketEngine not found");
        return;
    }

    const product = me.getProduct(productId) || (extraData ? { id: productId, ...extraData } : null);
    if (!product) {
        console.error("Product not found:", productId);
        return;
    }

    // NEW: Handle IPO directly if on discover page to prevent redirection
    const pType = (product.type || 'stock').trim().toUpperCase();
    const isDirectTradeOnly = pType === 'OTC' || pType === 'INS.STOCKS' || pType === 'INS_STOCKS';
    if (pType === 'IPO') {
        if (typeof window.openIpoConfirmation === "function") {
            window.openIpoConfirmation(product);
            return;
        }
    }

    if (typeof window.openStockDetail === "function") {
        const exchange = product.exchange || (product.symbol.includes('.NS') ? 'NSE' : 'BSE');
        const priceStr = '₹' + product.price.toLocaleString('en-IN', { minimumFractionDigits: 2 });

        // Normalize type for consistent UI behavior
        let displayType = (product.type || 'stock').trim().toUpperCase();
        if (displayType.includes('INS') && displayType.includes('STOCKS')) displayType = 'INS.STOCKS';
        if (displayType === 'INS_STOCKS') displayType = 'INS.STOCKS';

        let changeStr = '';
        if (displayType === 'IPO' || displayType === 'OTC') {
            changeStr = product.yield || 'Live';
        } else {
            changeStr = (product.change >= 0 ? '+' : '') + (product.change || 0).toFixed(2) + '%';
        }

        const color = (product.change >= 0 || (displayType !== 'INS.STOCKS' && displayType !== 'STOCK')) ? '#10b981' : '#ef4444';

        window.openStockDetail(
            product.market_symbol || product.symbol,
            product.name,
            exchange,
            priceStr,
            changeStr,
            color,
            displayType,
            true,
            product.id,
            product.minInvest,
            { quickTradeOnly: isDirectTradeOnly }
        );
    } else {
        console.error("openStockDetail not defined on this page");
    }
};

// Alias for backward compatibility
window.openSellingModal = window.openCloseOrderModal;

/**
 * loadTrades: Fetches and debugs trade data.
 * Requested by user for troubleshooting.
 */
window.loadTrades = async function () {
    console.log("馃敟 loadTrades EXECUTED");
    console.log("loadTrades() EXECUTED");
    console.log("Current User Auth Status:", await window.supabaseClient.auth.getUser());
    console.log("Fetching trades from DB...");

    const user = window.DB ? window.DB.getCurrentUser() : null;
    if (!user) {
        console.warn("No user found in localStorage, cannot fetch trades.");
        return;
    }

    if (typeof window.fetchUserTransactions === 'function') {
        console.log("Calling fetchUserTransactions()...");
        await window.fetchUserTransactions();
    } else {
        console.warn("fetchUserTransactions not defined on this page.");
    }
};
