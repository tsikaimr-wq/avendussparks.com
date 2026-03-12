console.log("馃敟 trading.js LOADED");
/**
 * Trading Logic - Close Order / Sell Trade
 */

let sellingTimer = null;
let isExecutingSell = false; // Flag to prevent double execution

// Attach to window for global access
window.openCloseOrderModal = function (tradeOrId) {
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
        const listingDate = new Date(trade.products.listing_date);
        if (listingDate > new Date()) {
            alert(`You cannot sell this asset before its official listing date (${listingDate.toLocaleDateString('en-IN')}).`);
            return;
        }
    }

    const tradeId = trade.id;
    let lastOtcFetchTs = 0;

    const updateSellingData = () => {
        const me = window.MarketEngine || {};

        // --- OTC PRICE FETCHING LOGIC ---
        let currentPrice = trade.price;
        const isOTC = trade.type?.trim().toLowerCase() === 'otc';

        if (isOTC && trade.products?.market_symbol) {
            // Priority: Live cache from Yahoo
            if (me.livePrices && me.livePrices[trade.products.market_symbol]) {
                currentPrice = me.livePrices[trade.products.market_symbol];
            } else if (me.getProduct) {
                // Fallback: Engine product price
                const p = me.getProduct(trade.products.market_symbol) || me.getProduct(trade.symbol);
                if (p) currentPrice = p.price;
            }

            // Trigger background fetch if missing
            if (me.fetchMarketPrice && (!me.livePrices || !me.livePrices[trade.products.market_symbol])) {
                const nowTs = Date.now();
                if (nowTs - lastOtcFetchTs >= 2500) {
                    lastOtcFetchTs = nowTs;
                    me.fetchMarketPrice(trade.products.market_symbol);
                }
            }
        } else {
            // Standard Stock / IPO logic
            const livePriceData = me.getProduct ? me.getProduct(trade.symbol) : null;
            currentPrice = livePriceData ? livePriceData.price : trade.price;
        }

        const totalOrderValue = parseFloat(trade.total_amount);
        const currentSaleValue = currentPrice * trade.quantity;

        // Stat Fees for Premium Modal
        const sellTax = currentSaleValue * 0.0012;
        const sellTxn = currentSaleValue * 0.0003;
        const netProceeds = currentSaleValue - sellTax - sellTxn;

        const priceEl = document.getElementById('coCurrPrice');
        const qtyEl = document.getElementById('coQty');
        const valEl = document.getElementById('coOrderVal');
        const taxEl = document.getElementById('coTaxAmt');
        const txnEl = document.getElementById('coTxnCharge');
        const netEl = document.getElementById('coNetReturn');

        if (priceEl) priceEl.innerText = '₹' + currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        if (qtyEl) qtyEl.innerText = trade.quantity;
        if (valEl) valEl.innerText = '₹' + currentSaleValue.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        if (taxEl) taxEl.innerText = '-₹' + sellTax.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        if (txnEl) txnEl.innerText = '-₹' + sellTxn.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        if (netEl) netEl.innerText = '₹' + netProceeds.toLocaleString('en-IN', { minimumFractionDigits: 2 });

        // Update confirm button properties
        const confirmBtn = document.getElementById('coConfirmBtn');
        if (confirmBtn) {
            confirmBtn.dataset.tradeId = tradeId;
            confirmBtn.dataset.sellPrice = currentPrice;
            confirmBtn.dataset.netReturn = netProceeds;
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

    updateSellingData();

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
            updateSellingData();

            if (currentSeconds <= 0) {
                clearInterval(sellingTimer);
                window.closeSellingModal();
            }
        }, 1000);
    }

    // Refresh button
    const refreshBtn = document.getElementById('coRefreshBtn');
    if (refreshBtn) refreshBtn.onclick = updateSellingData;

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
            const listingDate = new Date(listingDateRaw);
            if (listingDate > new Date()) {
                throw new Error(`You cannot sell this asset before its official listing date (${listingDate.toLocaleDateString('en-IN')}).`);
            }
        }

        // 2. Re-fetch real-time price
        const me = window.MarketEngine || {};
        let finalSellPrice = sellPrice;
        const isOTC = trade.type?.trim().toLowerCase() === 'otc';

        if (isOTC && trade.products?.market_symbol) {
            const live = me.livePrices ? me.livePrices[trade.products.market_symbol] : null;
            if (live) finalSellPrice = live;
        } else {
            const livePriceData = me.getProduct ? me.getProduct(trade.symbol) : null;
            if (livePriceData) finalSellPrice = livePriceData.price;
        }

        // Calculations
        const qty = parseFloat(trade.quantity || 0);
        const grossValue = qty * finalSellPrice;
        const tax = grossValue * 0.0012;
        const txn = grossValue * 0.0003;
        const finalNetReturn = grossValue - tax - txn;
        const buyAmount = parseFloat(trade.total_amount) || 0;

        // 3. Update the original trade to 'Sold' with historical data
        const realisedProfit = finalNetReturn - buyAmount;
        const finalisedNote = `Sold at Market 鈧?{finalSellPrice.toLocaleString('en-IN')} @ ${new Date().toLocaleTimeString('en-IN')}`;
        const { error: tradeUpdateErr } = await client.from('trades').update({
            status: 'Sold',
            order_status: 'CLOSED',
            processed_at: new Date().toISOString(),
            sell_price: finalSellPrice,
            total_sale_value: finalNetReturn,
            realised_profit: realisedProfit,
            sell_timestamp: new Date().toISOString(),
            sell_tax: tax,
            sell_fees: txn,
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
            tax_amount: tax,
            txn_charge: txn,
            status: 'Sold',
            order_status: 'CLOSED',
            processed_at: new Date().toISOString(),
            admin_note: `Proceeds from selling ${qty} shares of ${trade.symbol}`
        }]).then(({ error: sellRecordErr }) => {
            if (sellRecordErr) console.warn("Sell ledger insert warning:", sellRecordErr);
        }).catch((ledgerErr) => {
            console.warn("Sell ledger insert exception:", ledgerErr);
        });

        if (window.showModal) {
            window.showModal('success', 'Trade Executed', `Sold ${qty} shares of ${trade.name} at 鈧?{finalSellPrice.toLocaleString('en-IN')}. 鈧?{finalNetReturn.toLocaleString('en-IN', { minimumFractionDigits: 2 })} has been credited to your wallet.`, () => {
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
window.openOTCSubscribeModal = function (productId) {
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

        window.openStockDetail(product.market_symbol || product.symbol, product.name, exchange, priceStr, changeStr, color, displayType, true, product.id, product.minInvest);
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
