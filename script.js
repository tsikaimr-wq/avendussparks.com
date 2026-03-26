
// --- Custom UI Alerts & Modals System ---
// --- Custom UI Alerts & Modals System (Premium Style) ---
window.CustomUI = {
    init: function () {
        if (document.getElementById('customAlertOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'customAlertOverlay';
        overlay.className = 'confirm-modal-overlay';
        overlay.innerHTML = `
            <div class="confirm-modal-card">
                <div class="confirm-modal-icon-box" id="customAlertIconBox">
                    <i id="customAlertIcon" data-lucide="info" size="44"></i>
                </div>
                <h3 class="confirm-modal-title" id="customAlertTitle">Notification</h3>
                <p class="confirm-modal-message" id="customAlertMessage">Message content goes here...</p>
                <div class="confirm-modal-footer" id="customAlertActions">
                    <button class="confirm-modal-btn secondary" id="customAlertCancel" style="display:none;">Cancel</button>
                    <button class="confirm-modal-btn primary" id="customAlertOk">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.overlay = overlay;
        this.titleEl = overlay.querySelector('#customAlertTitle');
        this.msgEl = overlay.querySelector('#customAlertMessage');
        this.okBtn = overlay.querySelector('#customAlertOk');
        this.cancelBtn = overlay.querySelector('#customAlertCancel');
        this.iconEl = overlay.querySelector('#customAlertIcon');
        this.iconBox = overlay.querySelector('#customAlertIconBox');
    },
    alert: function (message, title = 'Notification', type = 'info') {
        this.init();
        this.updateStyle(type);
        return new Promise((resolve) => {
            if (this.titleEl) this.titleEl.innerText = title;
            if (this.msgEl) this.msgEl.innerText = message;
            this.okBtn.innerText = 'OK';
            this.cancelBtn.style.display = 'none';
            this.okBtn.onclick = () => { this.hide(); resolve(true); };
            this.show();
        });
    },
    confirm: function (message, title = 'Confirm Action', type = 'warning') {
        this.init();
        this.updateStyle(type);
        return new Promise((resolve) => {
            if (this.titleEl) this.titleEl.innerText = title;
            if (this.msgEl) this.msgEl.innerText = message;
            this.okBtn.innerText = 'Confirm';
            this.cancelBtn.innerText = 'Cancel';
            this.cancelBtn.style.display = 'block';
            this.okBtn.onclick = () => { this.hide(); resolve(true); };
            this.cancelBtn.onclick = () => { this.hide(); resolve(false); };
            this.show();
        });
    },
    updateStyle: function (type) {
        let iconName = 'info';
        let color = '#3b82f6';
        let bgColor = '#eff6ff';

        if (type === 'success') {
            iconName = 'check-circle';
            color = '#10b981';
            bgColor = '#ecfdf5';
        } else if (type === 'error') {
            iconName = 'x-circle';
            color = '#ef4444';
            bgColor = '#fef2f2';
        } else if (type === 'warning') {
            iconName = 'alert-triangle';
            color = '#f59e0b';
            bgColor = '#fffbeb';
        }

        if (this.iconEl) {
            this.iconEl.setAttribute('data-lucide', iconName);
            this.iconEl.style.color = color;
        }
        if (this.iconBox) this.iconBox.style.background = bgColor;
        if (this.okBtn) this.okBtn.style.background = color;

        if (window.lucide) lucide.createIcons();
    },
    show: function () {
        this.overlay.style.display = 'flex';
        setTimeout(() => this.overlay.classList.add('active'), 10);
    },
    hide: function () {
        this.overlay.classList.remove('active');
        setTimeout(() => this.overlay.style.display = 'none', 300);
    }
};

// Global Alert Override to prevent "This page says" browser popups
window.alert = function (message) {
    if (window.CustomUI) {
        window.CustomUI.alert(message);
    } else {
        console.warn("CustomUI not initialized, falling back to console log for alert:", message);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Icons
    if (window.lucide) lucide.createIcons();

    // Check Login & Update UI
    checkLoginStatus();

    // KYC restrictions are disabled by default.
    // Set window.ENFORCE_KYC_RESTRICTIONS = true to enforce pending-user restrictions.
    const enforceKycRestrictions = window.ENFORCE_KYC_RESTRICTIONS === true;

    // --- GLOBAL KYC PAGE GUARD ---
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (enforceKycRestrictions && user && user.kyc === 'Pending') {
        const path = window.location.pathname.toLowerCase();
        const isRestrictedPage = path.includes('market.html') ||
            path.includes('deposit.html') ||
            path.includes('withdraw.html') ||
            path.includes('bank_accounts.html') ||
            path.includes('loan_application.html');

        if (isRestrictedPage) {
            // Check if we already have a flag to prevent infinite loops (though usually home is not restricted)
            window.location.href = 'index.html?kyc_popup=true';
        }
    }

    // Handle KYC Popup from URL
    const urlParams = new URLSearchParams(window.location.search);
    if (enforceKycRestrictions && urlParams.get('kyc_popup') === 'true') {
        setTimeout(() => {
            window.CustomUI.alert("KYC verification in progress.", "Verification Required");
        }, 500);
    }

    // Initialize Carousel
    initCarousel();

    // Search Shortcut
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            document.querySelector('.search-input')?.focus();
        }
    });

    console.log('Premium Market Dashboard Initialized.');

    // --- Brute force fix for browser autofill on search bar ---
    const clearSearchAutofill = () => {
        document.querySelectorAll('.search-input').forEach(input => {
            const val = input.value;
            // Only clear if not in focus and looks like an autofilled number
            if (val && !input.matches(':focus')) {
                if (/^\d{6,}$/.test(val) || val.length > 5) {
                    input.value = '';
                }
            }
        });
    };
    const autofillInterval = setInterval(clearSearchAutofill, 500);
    setTimeout(() => clearInterval(autofillInterval), 5000);

    document.querySelectorAll('.search-input').forEach(input => {
        input.addEventListener('focus', function () {
            if (this.value && this.value.length > 5 && !isNaN(this.value)) {
                this.value = '';
            }
        });
    });

    // --- Universal Search Handler ---
    const globalSearchInput = document.getElementById('globalSearchInput');
    const globalSearchResults = document.getElementById('searchResults');
    let searchTimeout = null;
    const AV_API_KEY = '0AQTPTM1OF8VJQA1';

    if (globalSearchInput && globalSearchResults) {
        globalSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toUpperCase();
            if (query.length < 1) {
                globalSearchResults.style.display = 'none';
                return;
            }

            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                fetchGlobalStockPrice(query);
            }, 800);
        });

        document.addEventListener('click', (e) => {
            if (!globalSearchInput.contains(e.target) && !globalSearchResults.contains(e.target)) {
                globalSearchResults.style.display = 'none';
            }
        });
    }

    function renderIndicesGrid() {
        if (!globalSearchResults) return;
        const indices = window.MarketEngine ? window.MarketEngine.getIndices() : [];

        // Exact card colors matching the screenshot
        // Sensex, Nifty50, Nifty Bank, etc.
        let html = `<div class="search-section-title">Market Overview</div>`;
        html += `<div class="index-grid">`;

        indices.forEach((idx, i) => {
            const isUp = idx.change >= 0;
            // VIX is usually green when it's up, but in the screenshot it's green? 
            // Looking at the screenshot: VIX is +1.46 (+10.73%) and it's GREEN background.
            // SENSEX is +0.48% -> Background is LIGHT RED/PINK.
            // NIFTY 50 -0.61% -> Background is LIGHT YELLOW/CREAM.
            // NIFTY BANK -0.09% -> Background is LIGHT RED/PINK.
            // NIFTY SMLCAP -0.27% -> Background is LIGHT YELLOW/CREAM.
            // NIFTY MIDCAP -0.02% -> Background is LIGHT RED/PINK.
            // VIX +10.73% -> Background is LIGHT GREEN.

            // It seems they are using alternating colors or specific ones. 
            // I'll use subtle alternating backgrounds to match the "feel".
            const bgClass = (i === 5) ? 'bg-green' : (i % 2 === 0 ? 'bg-red' : 'bg-neutral');
            const colorClass = isUp ? 'up' : 'down';

            html += `
                <div class="index-card ${bgClass}" style="display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 1.5rem;">
                    <div class="index-card-header" style="justify-content: center; gap: 10px;">
                        <img src="https://flagcdn.com/w20/in.png" class="index-flag" alt="IN" style="width: 24px; height: 16px;">
                        <span class="index-name" style="font-size: 1.8rem; font-weight: 700;">${idx.symbol}</span>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        globalSearchResults.innerHTML = html;
        globalSearchResults.style.display = 'block';
    }

    async function fetchGlobalStockPrice(query) {
        if (!globalSearchResults) return;

        // 1. Instant local search (Indian Stocks)
        let localResults = [];
        if (window.MarketEngine) {
            localResults = window.MarketEngine.search(query);
        }

        // Initial render with local results
        renderGlobalSearchResults(localResults, true);

        // 2. Fetch Alpha Vantage for global quote (throttled/debounced already)
        try {
            let symbolForApi = query;
            if (!symbolForApi.includes('.')) symbolForApi += '.BSE';

            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbolForApi}&apikey=${AV_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data['Global Quote'] && data['Global Quote']['05. price']) {
                const quote = data['Global Quote'];
                const price = parseFloat(quote['05. price']);
                const sym = quote['01. symbol'];

                const globalItem = {
                    symbol: sym,
                    price: price,
                    name: 'International Market Price',
                    isGlobal: true
                };

                updateSearchResultsWithGlobal(localResults, globalItem);
            }
        } catch (e) {
            console.error("Global Search Error", e);
            renderGlobalSearchResults(localResults, false);
        }
    }

    function renderGlobalSearchResults(localResults, isSearching = false) {
        if (!globalSearchResults) return;

        let html = '';

        // 1. Separate local results by type
        const stocks = localResults.filter(r => r.type === 'stock');
        const otcs = localResults.filter(r => r.type === 'OTC');
        const ipos = localResults.filter(r => r.type === 'IPO');

        if (stocks.length > 0) {
            html += `<div class="search-section-title">Indian Stocks</div>`;
            html += stocks.map(m => createSearchItemHtml(m)).join('');
        }

        if (otcs.length > 0) {
            html += `<div class="search-section-title">OTC Markets</div>`;
            html += otcs.map(m => createSearchItemHtml(m)).join('');
        }

        if (ipos.length > 0) {
            html += `<div class="search-section-title">Active IPOs</div>`;
            html += ipos.map(m => createSearchItemHtml(m)).join('');
        }

        if (isSearching) {
            html += `<div class="search-item" style="color:#94a3b8; padding:1rem; text-align:center; font-size:0.85rem; border-top: 1px solid #f1f5f9;">
                <i data-lucide="loader-2" class="spin" style="width:14px; height:14px; vertical-align:middle; margin-right:6px;"></i> Searching global markets...
            </div>`;
        } else if (localResults.length === 0) {
            html += `<div class="search-item" style="color:#94a3b8; padding:1.5rem; text-align:center;">No stocks found</div>`;
        }

        globalSearchResults.innerHTML = html;
        globalSearchResults.style.display = 'block';
        if (window.lucide) lucide.createIcons();
    }

    function createSearchItemHtml(m) {
        return `
            <div class="search-item" onclick="globalSelectStock('${m.symbol}', '${m.name}', '${m.type || 'stock'}')">
                <div style="flex: 1;">
                    <div class="search-symbol">${m.symbol}</div>
                    <div class="search-name">${m.name}</div>
                </div>
                <div class="search-price-val">₹${m.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
        `;
    }

    function updateSearchResultsWithGlobal(localResults, globalItem) {
        // Just re-run a partial or full render
        renderGlobalSearchResults(localResults, false);

        // Append global result at the bottom
        let extraHtml = `<div class="search-section-title">Global Markets</div>`;
        extraHtml += `
            <div class="search-item" onclick="globalSelectStock('${globalItem.symbol}', '${globalItem.symbol}', 'stock')">
                <div style="flex: 1;">
                    <div class="search-symbol">${globalItem.symbol}</div>
                    <div class="search-name">${globalItem.name}</div>
                </div>
                <div class="search-price-val">₹${globalItem.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
        `;
        globalSearchResults.innerHTML += extraHtml;
    }

    window.globalSelectStock = (symbol, name, type) => {
        console.log("Global Select Stock:", symbol, name, type);

        let cleanType = (type || 'stock').toLowerCase();
        if (cleanType === 'ins.stock') cleanType = 'stock';

        const globalSearchResults = document.getElementById('searchResults');
        if (globalSearchResults) globalSearchResults.style.display = 'none';
        const globalSearchInput = document.getElementById('globalSearchInput');
        if (globalSearchInput) globalSearchInput.value = '';

        // SPA Routing Check
        if (window.location.pathname.endsWith('market.html') && typeof window.openStockDetail === 'function') {
            // We are on market.html, use SPA router
            // Need to fetch price/change/color if possible or use defaults/async fetch in detail
            // For now, pass what we have; detail view will fetch live data.
            const isUp = true; // Placeholder, detail view logic handles fetching
            window.openStockDetail(symbol, name, 'NSE', 'Loading...', '0.00%', '#888', cleanType, true);
        } else {
            // Not on market.html, standard nav
            // User requested routing:
            // INS.STOCK -> DISCOVER BUY & SELL (market.html?view=discover&stock=...)
            const targetUrl = `market.html?view=discover&stock=${encodeURIComponent(symbol)}`;
            window.location.href = targetUrl;
        }
    };
});

// --- UI / Login Logic ---
function checkLoginStatus() {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    // Also check URL param for immediate feedback after login
    const urlParams = new URLSearchParams(window.location.search);
    const isLoggedIn = user || urlParams.get('logged_in') === 'true';

    const promoActions = document.getElementById('promoActions');
    const marketAuthPrompt = document.getElementById('marketAuthPrompt');
    const portfolioBar = document.getElementById('portfolioBar');
    const loggedOutBanner = document.getElementById('loggedOutBanner');

    if (isLoggedIn) {
        // Hide "Login" and "Learn More" buttons in the video banner
        if (promoActions) promoActions.style.display = 'none';

        // Hide "Please log in to view more" prompt
        if (marketAuthPrompt) marketAuthPrompt.style.display = 'none';

        // Show User Portfolio Bar
        if (portfolioBar) portfolioBar.style.display = 'flex';

        if (loggedOutBanner) loggedOutBanner.style.display = 'none';

        // Ensure user data is synced globally on load
        if (window.syncUserData) window.syncUserData();

        // Sync Loan Eligibility (Backend Rule Integration)
        if (typeof syncLoanEligibility === 'function') syncLoanEligibility();
    } else {
        // Show Login Buttons
        if (promoActions) promoActions.style.display = 'flex';

        // Hide Portfolio
        if (portfolioBar) portfolioBar.style.display = 'none';

        if (marketAuthPrompt) marketAuthPrompt.style.display = 'block';
    }
}

// --- Global Functions (Exposed for HTML onclick) ---

window.openSettings = function () {
    const el = document.getElementById('settingsModal');
    if (el) el.style.display = 'flex';
    // Always fetch fresh VIP and Credit when opening settings
    if (typeof window.syncVipCredit === 'function') window.syncVipCredit();
};

window.closeSettings = function () {
    const el = document.getElementById('settingsModal');
    if (el) el.style.display = 'none';
};

window.openResetPassword = function () {
    const el = document.getElementById('resetPasswordModal');
    if (el) el.style.display = 'flex';
};

window.closeResetPassword = function () {
    const el = document.getElementById('resetPasswordModal');
    if (el) el.style.display = 'none';
};

window.toggleInternalPass = function (id, el) {
    const input = document.getElementById(id);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        el.setAttribute('data-lucide', 'eye');
    } else {
        input.type = 'password';
        el.setAttribute('data-lucide', 'eye-off');
    }
    if (window.lucide) lucide.createIcons();
};

window.handleInternalReset = async function () {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (!user) {
        await window.CustomUI.alert("Please login first.", "Authentication Required");
        return;
    }

    const currentPass = document.getElementById('currentPass')?.value;
    const newPass = document.getElementById('newPassInternal')?.value;
    const confirmPass = document.getElementById('confirmPassInternal')?.value;

    if (!currentPass || !newPass || !confirmPass) {
        await window.CustomUI.alert("All fields are required.", "Incomplete Form");
        return;
    }

    if (currentPass !== user.password) {
        await window.CustomUI.alert("Current password is incorrect.", "Security Error");
        return;
    }

    if (newPass !== confirmPass) {
        await window.CustomUI.alert("New passwords do not match.", "Input Error");
        return;
    }

    if (newPass.length < 6) {
        await window.CustomUI.alert("New password must be at least 6 characters.", "Invalid Password");
        return;
    }

    const btn = document.querySelector('#resetPasswordModal .logout-btn');
    const originalText = btn ? btn.textContent : 'Update Password';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Updating...';
    }

    try {
        const result = await window.DB.updateUser(user.id, { password: newPass });
        if (result.success) {
            await window.CustomUI.alert("Password updated successfully! Please login again.", "Success");
            window.DB.logout();
        } else {
            await window.CustomUI.alert("Failed to update password: " + (result.error?.message || "Unknown error"), "Update Failed");
        }
    } catch (e) {
        console.error(e);
        await window.CustomUI.alert("An error occurred. Please try again.", "Error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

window.handleGuestClick = async function (url) {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (user) {
        // --- KYC RESTRICTION RULE ---
        if (window.ENFORCE_KYC_RESTRICTIONS === true && user.kyc === 'Pending') {
            await window.CustomUI.alert("KYC verification in progress.", "Verification Required");
            return;
        }
        if (url && url !== '#') window.location.href = url;
    } else {
        // Show Top Alert
        const alertBox = document.querySelector('.top-alert-container');
        if (alertBox) {
            alertBox.style.display = 'block';
            setTimeout(() => alertBox.style.display = 'none', 3000);
        } else {
            await window.CustomUI.alert("Please login to access this feature.", "Login Required");
        }
    }
};

window.handleGuestTabClick = function (type) {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (!user) {
        window.handleGuestClick('#');
        return;
    }

    // --- KYC RESTRICTION RULE for Protected Tabs ---
    const restrictedTabs = ['portfolio', 'trade', 'deposits', 'withdrawals'];
    if (window.ENFORCE_KYC_RESTRICTIONS === true && user.kyc === 'Pending' && restrictedTabs.includes(type)) {
        window.CustomUI.alert("KYC verification in progress.", "Verification Required");
        return;
    }

    if (type === 'me') {
        if (window.location.pathname.endsWith('market.html') && typeof window.showMeView === 'function') {
            window.showMeView();
        } else {
            window.location.href = 'market.html?view=me';
        }
    } else if (type === 'portfolio') {
        if (window.location.pathname.endsWith('market.html') && typeof window.showPortfolioView === 'function') {
            window.showPortfolioView();
        } else {
            window.location.href = 'market.html?view=portfolio';
        }
    } else if (type === 'market') {
        if (window.location.pathname.endsWith('market.html') && typeof window.showMarketView === 'function') {
            window.showMarketView();
        } else if (!window.location.pathname.endsWith('market.html')) {
            window.location.href = 'market.html?view=market';
        }
    }
};

// function moved to centralized async implementation below

window.closeAlert = function () {
    const alertBox = document.querySelector('.top-alert-container');
    if (alertBox) alertBox.style.display = 'none';
};

window.setActiveNav = function (element) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
};

// --- Carousel Logic ---
let currentSlide = 0;

function initCarousel() {
    // Just ensure first slide is active
    showSlide(0);
}

// Global scope for onclick access
window.changeSlide = function (direction) {
    showSlide(currentSlide + direction);
};

window.goToSlide = function (index) {
    showSlide(index);
};

function showSlide(index) {
    const slides = document.querySelectorAll('.news-slide');
    const dots = document.querySelectorAll('.carousel-dot');

    if (slides.length === 0) return;

    if (index >= slides.length) index = 0;
    if (index < 0) index = slides.length - 1;

    currentSlide = index;

    // Update Slides
    slides.forEach((slide, i) => {
        if (i === currentSlide) {
            slide.classList.add('active');
        } else {
            slide.classList.remove('active');
        }
    });

    // Update Dots
    dots.forEach((dot, i) => {
        if (i === currentSlide) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

// --- New User Profile Logic ---
window.toggleUserProfile = function () {
    const root = document.getElementById('settingsModal');
    if (!root) return;
    const submenu = root.querySelector('#userProfileSubmenu');
    const chevron = root.querySelector('#userProfileChevron');

    if (submenu) {
        submenu.classList.toggle('open');
        if (chevron) {
            chevron.style.transform = submenu.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
};

window.toggleSecurityMenu = function () {
    const root = document.getElementById('settingsModal');
    if (!root) return;
    const submenu = root.querySelector('#securitySubmenu');
    const chevron = root.querySelector('#securityChevron');

    if (submenu) {
        submenu.classList.toggle('open');
        if (chevron) {
            chevron.style.transform = submenu.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
};

window.openEditNameModal = function () {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (!user) return;
    const input = document.getElementById('editNameInput');
    if (input) input.value = user.username || '';
    const modal = document.getElementById('editNameModal');
    if (modal) modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
};

window.closeEditNameModal = function () {
    const modal = document.getElementById('editNameModal');
    if (modal) modal.style.display = 'none';
};

window.saveName = async function () {
    const input = document.getElementById('editNameInput');
    if (!input) return;
    const newName = input.value.trim();
    if (!newName) {
        await window.CustomUI.alert('Please enter a name', 'Incomplete Form');
        return;
    }

    const btn = document.getElementById('saveNameBtn');
    if (btn) {
        btn.innerText = 'Saving...';
        btn.disabled = true;
    }

    try {
        const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
        if (!user) return;
        const result = await window.DB.updateUser(user.id, {
            username: newName
        });
        if (result.success) {
            user.username = newName;
            localStorage.setItem(window.DB.CURRENT_USER_KEY, JSON.stringify(user));

            await window.CustomUI.alert('Name updated successfully!', 'Success');
            if (window.syncUserData) window.syncUserData();
            window.closeEditNameModal();
        } else {
            await window.CustomUI.alert('Error: ' + (result.error?.message || 'Failed to update name'), 'Update Failed');
        }
    } catch (e) {
        console.error(e);
        await window.CustomUI.alert('An error occurred.', 'Error');
    } finally {
        if (btn) {
            btn.innerText = 'Save Name';
            btn.disabled = false;
        }
    }
};

window.openWithdrawalPinModal = function () {
    const modal = document.getElementById('withdrawalPinModal');
    if (!modal) return;

    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    const title = document.getElementById('wpModalTitle');
    const desc = document.getElementById('wpModalDesc');
    const btn = document.getElementById('wpSubmitBtn');

    // Check if user has a PIN (checking if property exists and is not empty)
    const hasPin = user && user.withdrawal_pin && user.withdrawal_pin.length > 0;

    if (hasPin) {
        if (title) title.innerText = 'Update Withdrawal PIN';
        if (desc) desc.innerText = 'Update your existing withdrawal PIN.';
        if (btn) btn.innerText = 'Update Withdrawal PIN';
    } else {
        if (title) title.innerText = 'Create Withdrawal PIN';
        if (desc) desc.innerText = 'Set a new 4-6 digit withdrawal PIN for security.';
        if (btn) btn.innerText = 'Create Withdrawal PIN';
    }

    modal.style.display = 'flex';
};

window.closeWithdrawalPinModal = function () {
    const modal = document.getElementById('withdrawalPinModal');
    if (modal) modal.style.display = 'none';
};

window.handleWithdrawalPinSubmit = async function () {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (!user) { await window.CustomUI.alert("Please login first.", "Authentication Required"); return; }

    const modal = document.getElementById('withdrawalPinModal');
    if (!modal) return;

    const loginPass = modal.querySelector('#wpLoginPass')?.value;
    const newPin = modal.querySelector('#wpNewPin')?.value;
    const confirmPin = modal.querySelector('#wpConfirmPin')?.value;

    if (!loginPass || !newPin || !confirmPin) {
        await window.CustomUI.alert("All fields are required.", "Incomplete Form");
        return;
    }

    if (loginPass !== user.password) {
        await window.CustomUI.alert("Incorrect login password.", "Security Error");
        return;
    }

    if (newPin !== confirmPin) {
        await window.CustomUI.alert("PINs do not match.", "Input Error");
        return;
    }

    if (newPin.length < 4) {
        await window.CustomUI.alert("PIN must be at least 4 digits.", "Invalid PIN");
        return;
    }

    const btn = document.getElementById('wpSubmitBtn');
    const originalText = btn ? btn.textContent : 'Submit';

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Processing...';
    }

    try {
        const result = await window.DB.updateUser(user.id, { withdrawal_pin: newPin });
        if (result.success) {
            await window.CustomUI.alert("Withdrawal PIN updated successfully!", "Success");
            // Update local user object
            user.withdrawal_pin = newPin;
            localStorage.setItem('avendus_current_user', JSON.stringify(user));
            window.closeWithdrawalPinModal();
        } else {
            await window.CustomUI.alert("Failed to update PIN: " + (result.error?.message || "Unknown error"), "Update Failed");
        }
    } catch (e) {
        console.error(e);
        await window.CustomUI.alert("An error occurred.", "Error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Update Withdrawal PIN';
        }
    }
};

window.openAvatarModal = function () {
    const modal = document.getElementById('avatarModal');
    if (modal) modal.style.display = 'flex';

    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    const previewImg = document.getElementById('avatarPreviewImg');
    const placeholderIcon = document.getElementById('avatarPlaceholderIcon');

    if (user && user.avatar_url && previewImg) {
        previewImg.src = user.avatar_url;
        previewImg.style.display = 'block';
        if (placeholderIcon) placeholderIcon.style.display = 'none';
    } else if (placeholderIcon) {
        placeholderIcon.style.display = 'block';
        if (previewImg) previewImg.style.display = 'none';
    }
};

window.closeAvatarModal = function () {
    const modal = document.getElementById('avatarModal');
    if (modal) modal.style.display = 'none';
};

window.previewAvatar = function (input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const previewImg = document.getElementById('avatarPreviewImg');
            const placeholderIcon = document.getElementById('avatarPlaceholderIcon');
            if (previewImg) {
                previewImg.src = e.target.result;
                previewImg.style.display = 'block';
            }
            if (placeholderIcon) {
                placeholderIcon.style.display = 'none';
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.uploadAvatar = async function () {
    const previewImg = document.getElementById('avatarPreviewImg');
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    const saveBtn = document.querySelector('.btn-primary');

    if (!user) { await window.CustomUI.alert('Please login first.', 'Authentication Required'); return; }

    if (previewImg && previewImg.src && previewImg.style.display !== 'none') {
        const newSrc = previewImg.src;

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        try {
            // Try saving to DB
            const result = await window.DB.updateUser(user.id, {
                avatar_url: newSrc
            });

            // Update local state regardless for immediate feedback
            user.avatar_url = newSrc;
            localStorage.setItem('avendus_current_user', JSON.stringify(user));

            document.querySelectorAll('.user-avatar, .avatar-circle, .me-p-avatar').forEach(el => {
                el.innerHTML = `<img src="${newSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                el.style.background = 'none';
            });

            if (result.success) {
                await window.CustomUI.alert('Avatar updated successfully!', 'Success');
            } else {
                await window.CustomUI.alert('Success: Profile updated locally. (Note: Cloud sync may be pending)', 'Partial Success');
                console.warn("Avatar saved locally but failed to sync to cloud. If this persists, run the SQL command provided to add the avatar_url column.", result.error?.message);
            }

            if (window.syncUserData) window.syncUserData();
            window.closeAvatarModal();
        } catch (e) {
            console.error(e);
            await window.CustomUI.alert('An error occurred while saving: ' + e.message, 'Error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            }
        }
    } else {
        await window.CustomUI.alert('Please select an image first.', 'Selection Required');
    }
};

window.openKYCModal = async function () {
    const modal = document.getElementById('kycModal');
    if (modal) modal.style.display = 'flex';

    const refreshedUser = (window.DB && typeof window.DB.refreshCurrentUser === 'function')
        ? await window.DB.refreshCurrentUser()
        : null;
    const user = refreshedUser || (window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null);
    if (!user) return;

    const mobileInput = document.getElementById('kycMobile');
    if (mobileInput) mobileInput.value = user.mobile || '';

    // Pre-fill name from profile if available
    const nameInput = document.getElementById('kycName');
    if (nameInput && user.full_name) nameInput.value = user.full_name;

    try {
        const kyc = await window.DB.getKycByUserId(user.id);
        if (kyc) {
            const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

            if (nameInput) nameInput.value = kyc.full_name || user.full_name || '';
            document.getElementById('kycIdNum').value = kyc.id_number || user.id_number || '';
            document.getElementById('kycSubmitted').value = fmtDate(kyc.submitted_at || kyc.created_at);
            document.getElementById('kycApproved').value = kyc.status === 'Approved' ? `Approved (${fmtDate(kyc.approved_at)})` : (kyc.status || 'Not Submitted');

            if (kyc.id_front_url) {
                const img = document.getElementById('kycFrontPreview');
                img.src = kyc.id_front_url;
                img.style.display = 'block';
                img.parentElement.classList.add('has-image');
            }
            if (kyc.id_back_url) {
                const img = document.getElementById('kycBackPreview');
                img.src = kyc.id_back_url;
                img.style.display = 'block';
                img.parentElement.classList.add('has-image');
            }

            if (kyc.status === 'Pending' || kyc.status === 'Approved') {
                const btn = document.querySelector('.btn-submit');
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = kyc.status === 'Approved' ? 'Already Verified' : 'Under Review';
                }
            }
        }
    } catch (e) {
        console.error("Error loading KYC:", e);
    }
};

window.closeKYCModal = function () {
    const modal = document.getElementById('kycModal');
    if (modal) modal.style.display = 'none';
};

window.previewKYCImage = function (input, previewId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.getElementById(previewId);
            if (img) {
                img.src = e.target.result;
                img.style.display = 'block';
                const parent = img.parentElement;
                const plus = parent.querySelector('.plus-icon');
                if (plus) plus.style.display = 'none';
            }
        }
        reader.readAsDataURL(input.files[0]);
    }
};

window.submitKYC = async function () {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (!user) {
        await window.CustomUI.alert('Please login to submit KYC.', 'Authentication Required');
        return;
    }

    const name = document.getElementById('kycName').value.trim();
    const mobile = document.getElementById('kycMobile').value.trim();
    const idNum = document.getElementById('kycIdNum').value.trim();
    const frontInput = document.getElementById('kycFrontInput');
    const backInput = document.getElementById('kycBackInput');

    // Check for existing previews if no new file is selected
    const frontPreview = document.getElementById('kycFrontPreview')?.getAttribute('src') || '';
    const backPreview = document.getElementById('kycBackPreview')?.getAttribute('src') || '';

    if (!name || !mobile || !idNum || (!frontInput.files[0] && (!frontPreview || frontPreview.includes('placeholder'))) || (!backInput.files[0] && (!backPreview || backPreview.includes('placeholder')))) {
        await window.CustomUI.alert('Please complete all fields (Name, Mobile, ID) and upload both ID images.', 'Incomplete Form');
        return;
    }

    try {
        const submitBtn = document.querySelector('.btn-submit');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        const frontImg = frontInput.files[0] || (frontPreview && !frontPreview.includes('placeholder') ? frontPreview : null);
        const backImg = backInput.files[0] || (backPreview && !backPreview.includes('placeholder') ? backPreview : null);

        const result = await window.DB.submitKYC(
            user.id,
            name,
            mobile,
            idNum,
            frontImg,
            backImg,
            null,
            {
                email: user.email,
                dob: user.dob,
                gender: user.gender,
                address: user.address,
                auth_id: user.auth_id,
                username: user.username || name,
                id_type: user.id_type || 'Aadhar'
            }
        );

        if (result.success) {
            user.full_name = name;
            user.mobile = mobile;
            user.id_number = idNum;
            user.kyc = 'Pending';
            localStorage.setItem('avendus_current_user', JSON.stringify(user));
            if (window.DB && typeof window.DB.refreshCurrentUser === 'function') {
                await window.DB.refreshCurrentUser();
            }
            await window.CustomUI.alert('KYC Verification Submitted Successfully!', 'Submission Success');
            if (window.syncUserData) window.syncUserData(); // Update UI
            window.closeKYCModal();
        } else {
            console.error("KYC files submission error:", result.error);
            throw new Error(result.error?.message || 'KYC submission failed.');
        }

    } catch (e) {
        console.error(e);
        await window.CustomUI.alert('An error occurred: ' + e.message, 'Error');
    } finally {
        const btn = document.querySelector('.btn-submit');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Submit Verification';
        }
    }
};

// --- Data Sync Logic ---
// --- Global Asset Loading Logic ---
window.loadUserAssets = async function (userId) {
    if (!userId) {
        console.error("loadUserAssets: No userId provided.");
        return;
    }
    console.log("User ID:", userId);

    const client = window.DB ? window.DB.getClient() : null;
    if (!client) {
        console.error("Supabase client not initialized.");
        return;
    }

    try {
        const { data: dbUser, error } = await client
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error("Error fetching user assets:", error);
            return;
        }

        // console.log("Assets response:", dbUser); // Security: do not log full user object

        if (!dbUser) {
            console.error("User not found.");
            return;
        }

        // --- Update Local Storage to prevent stale data in other parts of the app ---
        if (window.DB && window.DB.CURRENT_USER_KEY) {
            const localUser = localStorage.getItem(window.DB.CURRENT_USER_KEY);
            if (localUser) {
                const updatedUser = { ...JSON.parse(localUser), ...dbUser };
                localStorage.setItem(window.DB.CURRENT_USER_KEY, JSON.stringify(updatedUser));
                console.log("Local user storage refreshed with fresh asset data.");
            }
        }

        let pendingDepositAmount = 0;
        try {
            const { data: pendingDeposits, error: pendingDepositsError } = await client
                .from('deposits')
                .select('amount')
                .eq('user_id', userId)
                .eq('status', 'Pending');

            if (!pendingDepositsError && pendingDeposits) {
                pendingDepositAmount = pendingDeposits.reduce((sum, item) => {
                    return sum + (parseFloat(item.amount) || 0);
                }, 0);
            }
        } catch (pendingErr) {
            console.warn("Unable to load pending deposits for asset display:", pendingErr);
        }

        // --- Data Extraction & Safe Fallbacks ---
        const rawBalance = parseFloat(dbUser.balance) || 0;
        const inv = parseFloat(dbUser.invested) || 0;
        const frozen = parseFloat(dbUser.frozen) || 0;
        const bonus = parseFloat(dbUser.bonus) || 0;
        const displayPendingFunds = frozen + pendingDepositAmount;
        const portfolioProfit = window.__LATEST_TOTAL_PROFIT__ || 0;
        const totalAssets = rawBalance + frozen + inv + portfolioProfit;

        // borrowed_funds calculation (Live from loans table)
        let loan = 0;
        // Calculation: SELECT COALESCE(SUM(amount), 0) FROM loans WHERE status = 'APPROVED'
        if (window.DB && window.DB.getBorrowedFunds) {
            loan = await window.DB.getBorrowedFunds(userId);
        } else {
            loan = (typeof dbUser.borrowed_funds !== 'undefined') ? (parseFloat(dbUser.borrowed_funds) || 0) : 0;
        }

        // Fetch User Loans List (My Applications) - Live from DB
        if (window.fetchUserLoans) window.fetchUserLoans(userId);

        // Final outstanding value for display straight from the database truth
        let outstanding = (typeof dbUser.outstanding_balance !== 'undefined') ? (parseFloat(dbUser.outstanding_balance) || 0) : (parseFloat(dbUser.outstanding) || 0);

        // --- DOM Helpers ---
        const formatCurrencyLocked = (val) => {
            if (typeof window.formatAppCurrency === 'function') {
                return window.formatAppCurrency(val);
            }
            const num = parseFloat(val) || 0;
            return `${num < 0 ? '-' : ''}${window.APP_CURRENCY_SYMBOL || '\u20B9'}${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };
        const formatCurrency = (val) => {
            return formatCurrencyLocked(val);
        };

        // Safe-fit text (replicated from market.html for consistency)
        const fitText = (el, text) => {
            if (!el) return;
            el.setAttribute('data-val', text);
            el.title = text;

            // --- Automatic Negative Styling ---
            // If the element is a balance display and text contains '-', apply red class
            const isBalanceEl = el.id.toLowerCase().includes('balance') ||
                el.id.toLowerCase().includes('available') ||
                el.classList.contains('asset-amount') ||
                el.classList.contains('p-asset-val') ||
                el.classList.contains('me-as-val') ||
                el.classList.contains('stat-value') ||
                el.classList.contains('portfolio-balance');

            if (isBalanceEl) {
                const isNegative = text.includes('-');
                if (isNegative) {
                    el.classList.add('negative-balance');
                } else {
                    el.classList.remove('negative-balance');
                }

                // Also apply to inner span if it exists (Portfolio/Me views)
                const innerSpan = el.querySelector('.asset-value');
                if (innerSpan) {
                    if (isNegative) innerSpan.classList.add('negative-balance');
                    else innerSpan.classList.remove('negative-balance');
                }
            }

            // Check hidden state (using global vars if defined, else default false)
            let isHidden = false;
            // Market/Global asset-amount
            if (el.classList.contains('asset-amount') && window.mainAssetsHidden) isHidden = true; // Assumes variable is on window or accessible
            // Portfolio
            else if (el.classList.contains('p-asset-val') && window.portfolioAssetsHidden) isHidden = true;
            // Me
            else if (el.classList.contains('me-as-val') && window.meAssetsHidden) isHidden = true;

            const displayValue = isHidden ? '********' : text;

            const valSpan = el.querySelector('.asset-value');
            if (valSpan) {
                valSpan.textContent = displayValue;
            } else {
                el.textContent = displayValue;
            }
            if (!el.getAttribute('data-val')) el.setAttribute('data-val', text);
            el.title = text;

            el.style.fontSize = '';
            el.style.whiteSpace = 'nowrap';
            el.style.overflow = 'hidden';
            el.style.textOverflow = 'ellipsis';
            el.style.display = 'block';

            if (displayValue.length > 28) el.style.fontSize = '0.6rem';
            else if (displayValue.length > 22) el.style.fontSize = '0.7rem';
            else if (displayValue.length > 16) el.style.fontSize = '0.8rem';
        };

        const updateVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                fitText(el, formatCurrencyLocked(val));
            }
        };

        // --- Update Market Page (Sidebar Assets) ---
        // These are usually elements with 'asset-amount' class in order 0-5
        const assetAmounts = document.querySelectorAll('.asset-amount');
        if (assetAmounts.length >= 6) {
            const vals = [rawBalance, inv, bonus, displayPendingFunds, loan, outstanding];
            assetAmounts.forEach((el, idx) => {
                if (vals[idx] !== undefined) {
                    fitText(el, formatCurrencyLocked(vals[idx]));
                }
            });
        }

        // --- Update Me Page (Specific IDs) ---
        updateVal('meTotalAssets', totalAssets);
        updateVal('meAvailableBalance', rawBalance);
        updateVal('meCurrentInvestments', inv);
        updateVal('meBonusCredits', bonus);
        updateVal('meFrozenFunds', displayPendingFunds);
        updateVal('meBorrowedFunds', loan);
        updateVal('mePendingSettlement', outstanding);

        // Update additional UI fields for Outstanding/Pending Settlement
        document.querySelectorAll('.pending-settlement-value, .outstanding-balance-value').forEach(el => {
            fitText(el, formatCurrencyLocked(outstanding));
        });

        // --- Update Portfolio Page (Specific IDs) ---
        updateVal('pTotalAssets', totalAssets);
        updateVal('pAvailableBalance', rawBalance);
        updateVal('pCurrentInvested', inv);
        updateVal('pPromoCredits', bonus);
        updateVal('pPendingFunds', displayPendingFunds);
        updateVal('pBorrowedFunds', loan);
        updateVal('pPendingSettlement', outstanding);

        // Also update portfolio totals/stats
        updateVal('pInvestedMain', inv); // "Current Value" in circle
        updateVal('pPortfolioTotal', inv); // "Total Invested"

        // --- Update Generic Indicators (Header/Script.js elements) ---
        const balanceEls = document.querySelectorAll('.stat-value.green, .portfolio-balance, #mainBalance, #valAvailable');
        balanceEls.forEach(el => {
            fitText(el, formatCurrencyLocked(rawBalance));
        });

        const investedEls = document.querySelectorAll('.stat-value.blue, #valInvested');
        investedEls.forEach(el => fitText(el, formatCurrencyLocked(inv)));

        // Update LocalStorage to keep session fresh
        if (window.DB && window.DB.CURRENT_USER_KEY) {
            const localUser = localStorage.getItem(window.DB.CURRENT_USER_KEY);
            const mergedUser = localUser ? { ...JSON.parse(localUser), ...dbUser } : { ...dbUser };
            localStorage.setItem(window.DB.CURRENT_USER_KEY, JSON.stringify(mergedUser));
        }

        // --- Sync Profile Information (Name & Avatar) ---
        const displayName = dbUser.username || 'User';
        const initials = (displayName.charAt(0) || 'U').toUpperCase();

        // Update Name Displays across pages
        const nameTargets = [
            document.getElementById('meUserDisplayName'),
            document.getElementById('meFullName'),
            document.getElementById('meUsername'),
            document.querySelector('.settings-name'),
            document.querySelector('.user-greeting h3')
        ];

        nameTargets.forEach(el => {
            if (el) {
                if (el.tagName === 'H3' && el.parentElement.classList.contains('user-text')) {
                    el.textContent = displayName;
                } else if (el.id === 'meFullName') {
                    el.textContent = displayName; // Use username even for this field as requested
                } else if (el.id === 'meUsername') {
                    el.textContent = dbUser.username || '-';
                } else {
                    el.textContent = displayName;
                }
            }
        });

        // Hide phone display in settings header
        const sPhone = document.getElementById('settingsPhone');
        if (sPhone) sPhone.style.display = 'none';

        // Update Avatar Displays across pages
        const activeAvatar = dbUser.avatar_url || dbUser.profile_image;
        const avatarEls = document.querySelectorAll('.user-avatar, .avatar-circle, .me-p-avatar, #settingsAvatar');

        avatarEls.forEach(el => {
            if (activeAvatar && activeAvatar.length > 10 && !activeAvatar.includes('placeholder')) {
                el.innerHTML = `<img src="${activeAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                el.style.background = 'none';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
            } else {
                el.innerHTML = initials; // Fallback to initials
            }
        });

        // --- Update Credit Score & VIP Level ---
        const credit = dbUser.credit_score || 0;
        const vip = dbUser.vip || 0;

        // Update display elements
        const creditScoreEl = document.getElementById('meCreditScore');
        if (creditScoreEl) creditScoreEl.textContent = credit;

        const vipLevelEl = document.getElementById('meVipLevel');
        if (vipLevelEl) vipLevelEl.textContent = vip;

        const settingsVipEl = document.getElementById('settingsVip');
        if (settingsVipEl) settingsVipEl.textContent = vip;

        const settingsCreditEl = document.getElementById('settingsCredit');
        if (settingsCreditEl) settingsCreditEl.textContent = credit;

        // --- Update Credit Gauge (Me Page) ---
        const needle = document.getElementById('meGaugeNeedle');
        if (needle) {
            const rotation = (credit / 100) * 180;
            needle.style.transform = `rotate(${rotation}deg)`;
        }

        const gaugeScore = document.getElementById('meGaugeScore');
        const gaugeInfo = document.getElementById('meCreditGaugeInfo');
        if (gaugeInfo) {
            let category = "Poor";
            let color = "#ef4444";

            if (credit >= 95) { category = "Excellent"; color = "#10b981"; }
            else if (credit >= 74) { category = "Good"; color = "#3b82f6"; }
            else if (credit >= 51) { category = "Fair"; color = "#fde047"; }
            else if (credit >= 26) { category = "Average"; color = "#f59e0b"; }

            if (gaugeScore) {
                gaugeScore.textContent = category;
                gaugeScore.style.color = color;
            }
            gaugeInfo.innerHTML = `Based on the latest evaluation, your <b>Credit Score is ${credit}</b>. Your credit profile falls under the <b style="color: ${color};">${category}</b> category.`;
        }

        // Update Credit Profile Text on Me Page (if it exists)
        const creditProfileInfo = document.getElementById('creditProfileInfo');
        if (creditProfileInfo) {
            creditProfileInfo.innerHTML = `Based on the latest evaluation, your <b>Credit Score is ${credit}</b>. Your credit profile falls into the <b>${credit >= 90 ? 'Excellent' : (credit >= 70 ? 'Fair' : 'Low')}</b> category.`;
        }

        // --- Update KYC Status (Me Page) ---
        const kycBadge = document.getElementById('meKycStatusBadge');
        if (kycBadge) {
            const rawKyc = (dbUser.kyc || '').toLowerCase();
            let label = 'Not Verified';
            let badgeClass = 'kyc-not-verified';

            if (rawKyc === 'approved') {
                label = 'Verified';
                badgeClass = 'kyc-approved';
            } else if (rawKyc === 'pending') {
                label = 'Pending';
                badgeClass = 'kyc-pending';
            } else if (rawKyc === 'rejected') {
                label = 'Rejected';
                badgeClass = 'kyc-rejected';
            }

            kycBadge.textContent = label;
            kycBadge.className = badgeClass;
            // Clear inline styles from market.html to allow CSS classes to take over
            kycBadge.style.background = '';
            kycBadge.style.color = '';
        }

        // --- Withdrawal Restrictions logic moved to click event (openWithdrawPage) ---
        if (window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error("loadUserAssets Exception:", e);
    }
};

// --- Targeted VIP & Credit Sync (For immediate UI updates) ---
window.syncVipCredit = async function () {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (!user) return;

    const client = window.DB ? window.DB.getClient() : null;
    if (!client) return;

    try {
        const { data, error } = await client
            .from('users')
            .select('vip, credit_score, kyc')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error("syncVipCredit error:", error);
            return;
        }

        if (data) {
            const vip = data.vip || 0;
            const credit = data.credit_score || 0;
            const rawKyc = data.kyc || '';

            console.log("Fresh VIP/Credit/KYC fetched:", { vip, credit, rawKyc });

            // Update KYC Status mapping
            const kycBadge = document.getElementById('meKycStatusBadge');
            if (kycBadge) {
                const sk = rawKyc.toLowerCase();
                let label = 'Not Verified';
                let bClass = 'kyc-not-verified';

                if (sk === 'approved') {
                    label = 'Verified';
                    bClass = 'kyc-approved';
                } else if (sk === 'pending') {
                    label = 'Pending';
                    bClass = 'kyc-pending';
                } else if (sk === 'rejected') {
                    label = 'Rejected';
                    bClass = 'kyc-rejected';
                }

                kycBadge.textContent = label;
                kycBadge.className = bClass;
                kycBadge.style.background = '';
                kycBadge.style.color = '';
            }

            // Update display elements
            const targets = {
                'meCreditScore': credit,
                'meVipLevel': vip,
                'settingsVip': vip,
                'settingsCredit': credit
            };

            for (const [id, val] of Object.entries(targets)) {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            }

            // --- Credit Gauge Specific Updates ---
            const needle = document.getElementById('meGaugeNeedle');
            if (needle) {
                const rotation = (credit / 100) * 180;
                needle.style.transform = `rotate(${rotation}deg)`;
            }

            const gaugeScore = document.getElementById('meGaugeScore');
            const gaugeInfo = document.getElementById('meCreditGaugeInfo');
            if (gaugeInfo) {
                let category = "Poor";
                let color = "#ef4444";

                if (credit >= 95) { category = "Excellent"; color = "#10b981"; }
                else if (credit >= 74) { category = "Good"; color = "#3b82f6"; }
                else if (credit >= 51) { category = "Fair"; color = "#fde047"; }
                else if (credit >= 26) { category = "Average"; color = "#f59e0b"; }

                if (gaugeScore) {
                    gaugeScore.textContent = category;
                    gaugeScore.style.color = color;
                }

                gaugeInfo.innerHTML = `Based on the latest evaluation, your <b>Credit Score is ${credit}</b>. Your credit profile falls under the <b style="color: ${color};">${category}</b> category.`;
            }

            // Update Credit Profile Text on Me Page (if it exists)
            const creditProfileInfo = document.getElementById('creditProfileInfo');
            if (creditProfileInfo) {
                creditProfileInfo.innerHTML = `Based on the latest evaluation, your <b>Credit Score is ${credit}</b>. Your credit profile falls into the <b>${credit >= 90 ? 'Excellent' : (credit >= 70 ? 'Fair' : 'Low')}</b> category.`;
            }
        }
    } catch (e) {
        console.error("syncVipCredit Exception:", e);
    }
};

// --- Settings UI Helpers (Centralized) ---
window.toggleSettingsAccordion = function (element, id) {
    const subMenu = document.getElementById(id);
    const chevron = element.querySelector('.settings-chevron');
    if (!subMenu) return;
    subMenu.classList.toggle('active');
    if (subMenu.classList.contains('active')) {
        subMenu.style.maxHeight = subMenu.scrollHeight + "px";
    } else {
        subMenu.style.maxHeight = null;
    }
    if (chevron) {
        chevron.classList.toggle('rotated');
    }
};

window.openUpdateAvatar = function () { window.openAvatarModal(); };
window.closeUpdateAvatar = function () { window.closeAvatarModal(); };
window.openInternalResetPassword = function () { window.openResetPassword(); };
window.closeInternalResetPassword = function () { window.closeResetPassword(); };
window.togglePassVisibility = function (id, el) { window.toggleInternalPass(id, el); };
window.submitPasswordChange = function () { window.handleInternalReset(); };
window.openKYC = function () { window.openKYCModal(); };
window.closeKYC = function () { window.closeKYCModal(); };

// Backwards compatibility alias
if (!window.syncUserData) {
    window.syncUserData = async function () {
        const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
        if (user) {
            await window.loadUserAssets(user.id);

            // Keep the profile update stuff here or move it? user just asked for "Assets" consistency.
            // I'll leave the basic profile update logic here for script.js, but minimal.
            const settingsRoot = document.getElementById('settingsModal');
            const setName = settingsRoot ? settingsRoot.querySelector('.settings-name') : null;
            if (setName) setName.textContent = user.username || 'User';
            const sPhone = document.getElementById('settingsPhone');
            if (sPhone) sPhone.style.display = 'none';
        }
    };
}

// --- Loan Application Logic (My Applications) ---
// State for applications filtering
window.userLoansData = [];
window.activeLoanTab = "All";

window.renderUserLoans = function () {
    const list = document.getElementById('myApplicationsList');
    if (!list) return;

    if (!window.userLoansData || window.userLoansData.length === 0) {
        // Reset to "No Data" view
        list.className = "no-data-wrap";
        list.style.display = 'flex';
        list.innerHTML = `
            <i data-lucide="inbox" size="48" stroke-width="1" style="margin-bottom: 1rem;"></i>
            No data.
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    const filteredApplications = window.userLoansData.filter(app => {
        const status = (app.status || 'Pending').toUpperCase().trim();
        const activeTab = window.activeLoanTab;

        if (activeTab === "All") return true;
        if (activeTab === "Approved") return status === "APPROVED";
        if (activeTab === "Pending") return status === "PENDING";
        if (activeTab === "Rejected") return status === "REJECTED";
        if (activeTab === "Awaiting") return status === "AWAITING";
        if (activeTab === "Repayment") return status === "REPAYMENT";

        return false;
    });

    if (filteredApplications.length === 0) {
        list.className = "no-data-wrap";
        list.style.display = 'flex';
        list.innerHTML = `
            <i data-lucide="inbox" size="48" stroke-width="1" style="margin-bottom: 1rem;"></i>
            No applications in this category.
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    // Render List
    list.className = ""; // Remove no-data centering
    list.style.display = 'block';
    list.style.overflowY = 'auto';
    list.style.flex = '1';

    list.innerHTML = filteredApplications.map(loan => {
        const rawStatus = loan.status || 'Pending';
        let statusClass = 'pending';
        const s = rawStatus.toUpperCase();
        if (s === 'APPROVED') statusClass = 'approved';
        else if (s === 'REJECTED') statusClass = 'rejected';

        const bgColor = (statusClass === 'approved') ? '#dcfce7' : ((statusClass === 'rejected') ? '#fee2e2' : '#fef3c7');
        const textColor = (statusClass === 'approved') ? '#166534' : ((statusClass === 'rejected') ? '#991b1b' : '#92400e');

        return `
        <div class="me-app-item" style="padding: 12px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 600; font-size: 0.9rem; color: #1e293b;">Loan Application</div>
                <div style="font-size: 0.75rem; color: #64748b;">${new Date(loan.created_at).toLocaleDateString()}</div>
                <div style="font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-top: 2px;">₹${parseFloat(loan.amount).toLocaleString('en-IN')}</div>
            </div>
            <div style="text-align: right;">
                <span style="
                    padding: 4px 8px; 
                    border-radius: 4px; 
                    font-size: 0.75rem; 
                    font-weight: 700; 
                    text-transform: uppercase;
                    background: ${bgColor};
                    color: ${textColor};
                ">${rawStatus}</span>
            </div>
        </div>
        `;
    }).join('');
};

window.fetchUserLoans = async function (userId) {
    if (!window.DB) return;
    const client = window.DB.getClient();
    if (!client) return;

    // Fetch User My Applications
    const { data: loans, error } = await client
        .from('loans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching user loans:", error);
        const list = document.getElementById('myApplicationsList');
        if (list) list.innerHTML = '<div style="padding:20px; text-align:center; color:#ef4444;">Error loading applications.</div>';
        return;
    }

    window.userLoansData = loans || [];
    window.renderUserLoans();
};


// --- Message Center Logic ---
// --- Message Center Logic (Notices) ---
window.toggleMessageCenter = async function () {
    const modal = document.getElementById('messageCenter');
    const overlay = document.getElementById('messageCenterOverlay');
    const list = document.getElementById('mcList');

    if (modal && overlay) {
        const isActive = modal.classList.contains('active');
        if (isActive) {
            modal.classList.remove('active');
            overlay.classList.remove('active');
            setTimeout(() => overlay.style.display = 'none', 300);

            // Mark all read when closing
            const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
            if (user && window.DB.markAllNotificationsRead) {
                window.DB.markAllNotificationsRead(user.id);
            }
        } else {
            overlay.style.display = 'block';
            setTimeout(() => {
                modal.classList.add('active');
                overlay.classList.add('active');
            }, 10);

            // Hide Badges instantly on open
            const badges = document.querySelectorAll('.notif-badge, #msgBadge');
            badges.forEach(b => b.style.display = 'none');

            // Fetch Notices
            if (window.DB && window.DB.getNotifications) {
                const user = window.DB.getCurrentUser();
                if (user) {
                    list.innerHTML = '<div style="padding:20px;text-align:center;">Loading...</div>';
                    const notices = await window.DB.getNotifications(user.id);
                    renderNotices(notices);

                    // Mark read in DB immediately upon viewing list
                    window.DB.markAllNotificationsRead(user.id);
                }
            } else {
                list.innerHTML = '<div style="padding:20px;text-align:center;">Database Error</div>';
            }
        }
    }
};

function renderNotices(notices) {
    const list = document.getElementById('mcList');
    const count = document.getElementById('msgCount');
    if (!list) return;

    if (!notices || notices.length === 0) {
        list.innerHTML = '<div style="padding:2rem;text-align:center;color:#94a3b8;">No notifications</div>';
        if (count) count.textContent = '0 Messages';
        return;
    }

    if (count) count.textContent = `${notices.length} Messages`;

    list.innerHTML = notices.map(n => {
        let displayTitle = n.title || 'Notification';
        let displayBody = n.message || '';
        let displayTag = n.type || 'GENERAL';

        // Detect if content is a JSON string (safely)
        try {
            if (displayBody && typeof displayBody === 'string' && displayBody.trim().startsWith('{')) {
                const p = JSON.parse(displayBody);
                if (p.title) displayTitle = p.title;
                if (p.message) displayBody = p.message;
                else if (p.body) displayBody = p.body;
                else if (p.content) displayBody = p.content;
                if (p.type) displayTag = p.type;
            }
        } catch (e) {
            // Parsing failed, fallback to plain text (already in displayBody)
        }

        return `
        <div class="notif-card" id="notif-${n.id}" onclick="toggleNotifView('${n.id}', event)">
            <div class="notif-timeline ${n.is_read ? '' : 'unread'}"></div>
            <div class="notif-header">
                <div class="notif-main-info">
                    <div class="notif-title">${displayTitle} <span class="notif-tag" style="font-size:10px; margin-left:5px;">${displayTag}</span></div>
                    <div class="notif-meta">${new Date(n.created_at).toLocaleString()}</div>
                </div>
                <button class="notif-delete-btn" onclick="deleteMessage('${n.id}', this); event.stopPropagation();">Delete</button>
            </div>
            <div class="notif-body">${displayBody}</div>
        </div>
        `;
    }).join('');
}

window.toggleNotifView = function (id, event) {
    // Toggle Card Expansion
    const card = document.getElementById(`notif-${id}`);
    if (card) {
        card.classList.toggle('expanded');

        // Mark as read if expanding
        if (card.classList.contains('expanded')) {
            const timeline = card.querySelector('.notif-timeline');
            if (timeline && timeline.classList.contains('unread')) {
                timeline.classList.remove('unread');
            }
        }
    }
};

// --- Selection Mode Logic ---
window.isSelectMode = false;

window.sysToggleSelect = function () {
    window.isSelectMode = !window.isSelectMode;
    const chks = document.querySelectorAll('.mc-select-box');
    const footer = document.getElementById('mcFooter'); // We need to check if this exists or we inject it

    // Toggle Checkboxes
    chks.forEach(c => c.style.display = window.isSelectMode ? 'block' : 'none');

    // Toggle Footer Buttons
    // Ideally we replace the footer HTML entirely to swap buttons
    const normalBtns = document.getElementById('mcNormalBtns');
    const selectBtns = document.getElementById('mcSelectBtns');

    if (normalBtns && selectBtns) {
        normalBtns.style.display = window.isSelectMode ? 'none' : 'flex';
        selectBtns.style.display = window.isSelectMode ? 'flex' : 'none';
        // Reset selection
        if (!window.isSelectMode) {
            document.querySelectorAll('.mc-chk').forEach(c => c.checked = false);
        }
    }
};

window.updateDeleteBtn = function () {
    const count = document.querySelectorAll('.mc-chk:checked').length;
    const btn = document.getElementById('btnDeleteSelected');
    if (btn) btn.textContent = `Delete Selected (${count})`;
};

window.deleteSelected = async function () {
    const selected = Array.from(document.querySelectorAll('.mc-chk:checked')).map(c => c.value);
    if (selected.length === 0) return;

    if (!await window.CustomUI.confirm(`Delete ${selected.length} notifications?`)) return;

    for (const id of selected) {
        if (window.DB && window.DB.deleteNotification) {
            await window.DB.deleteNotification(id);
            const el = document.getElementById(`notif-${id}`);
            if (el) el.remove();
        }
    }

    // Refresh list logic if empty?
    if (document.querySelectorAll('.mc-item').length === 0) {
        document.getElementById('mcList').innerHTML = '<div style="padding:2rem;text-align:center;color:#94a3b8;">No notifications</div>';
    }

    // Exit select mode
    window.sysToggleSelect();
};

window.makeAllRead = async function () {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (!user) return;

    // 1. Update DB to mark all read
    if (window.DB.markAllNotificationsRead) {
        const result = await window.DB.markAllNotificationsRead(user.id);
        if (result && result.error) {
            console.error("Make all read failed:", result.error);
            alert(result.error.message || "Failed to mark as read");
            return;
        }
    }

    // 2. Re-fetch Notifications
    if (window.DB.getNotifications) {
        const list = document.getElementById('mcList');
        if (list) {
            const notices = await window.DB.getNotifications(user.id);
            renderNotices(notices);
        }
    }

    // 3. Update Bell Unread Count
    if (window.DB.getUnreadNotificationCount) {
        const count = await window.DB.getUnreadNotificationCount(user.id);
        const badges = document.querySelectorAll('.notif-badge, #msgBadge');
        if (count > 0) {
            badges.forEach(b => {
                b.textContent = count > 99 ? '99+' : count;
                b.style.display = 'block';
            });
        } else {
            badges.forEach(b => b.style.display = 'none');
        }
    }

    // 4. Ensure red dot disappears immediately (double safety)
    document.querySelectorAll('.mc-dot.unread').forEach(el => el.classList.remove('unread'));
};

window.deleteAllMessages = async function () {
    if (!await window.CustomUI.confirm("Are you sure you want to delete ALL notifications? This cannot be undone.")) return;

    const cards = document.querySelectorAll('.notif-card');
    if (cards.length === 0) return;

    if (window.DB && window.DB.deleteNotification) {
        // Collect IDs
        const ids = Array.from(cards).map(c => c.id.replace('notif-', ''));

        // Batch delete simulation (since API is single delete)
        const btn = document.querySelector('button[onclick="deleteAllMessages()"]');
        if (btn) btn.textContent = "Deleting...";

        for (const id of ids) {
            await window.DB.deleteNotification(id);
        }

        if (btn) btn.textContent = "Delete All";
    }

    // Clear UI
    document.getElementById('mcList').innerHTML = '<div style="padding:2rem;text-align:center;color:#94a3b8;">No notifications</div>';

    // Reset Badge
    const badge = document.getElementById('msgBadge');
    if (badge) badge.style.display = 'none';
};

window.deleteMessage = async function (id, btn) {
    if (!await window.CustomUI.confirm("Delete this notification?")) return;

    if (window.DB && window.DB.deleteNotification) {
        await window.DB.deleteNotification(id);
    }

    const item = btn.closest('.notif-card');
    if (item) {
        item.style.opacity = '0';
        setTimeout(() => item.remove(), 300);

        // Update Count
        const count = document.getElementById('msgCount');
        if (count && count.textContent) {
            let c = parseInt(count.textContent);
            if (!isNaN(c) && c > 0) count.textContent = `${c - 1} Messages`;
        }
    }
};


// --- Customer Service Logic ---
let isChatSubscribed = false;
let csPollingTimer = null;
let csPollingInFlight = false;
let csKnownMessageIds = new Set();
let csHistorySignature = '';

function isChatNotificationPayload(rawMessage) {
    if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim().startsWith('{')) return false;
    try {
        const payload = JSON.parse(rawMessage);
        return payload?.is_notification === true || payload?.title !== undefined;
    } catch (_) {
        return false;
    }
}

function getRenderableCSMessages(messages = []) {
    return (Array.isArray(messages) ? messages : []).filter(m => {
        if (!m || m.sender === 'System') return false;
        return !isChatNotificationPayload(m.message);
    });
}

function getCSHistorySignature(messages = []) {
    const renderable = Array.isArray(messages) ? messages : [];
    const last = renderable[renderable.length - 1];
    return `${renderable.length}:${last?.id || ''}:${last?.created_at || ''}`;
}

function rememberCSMessages(messages = []) {
    (Array.isArray(messages) ? messages : []).forEach(m => {
        if (m?.id !== null && m?.id !== undefined) {
            csKnownMessageIds.add(String(m.id));
        }
    });
}

function isCSModalOpen() {
    const modal = document.getElementById('csModal');
    if (!modal) return false;
    return getComputedStyle(modal).display !== 'none' && modal.style.display !== 'none';
}

function bumpCSBadges(amount = 1) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const badges = [document.getElementById('csrMsgBadge'), document.getElementById('csrHeaderBadge')];
    badges.forEach(badge => {
        if (!badge) return;
        const current = parseInt(badge.textContent || '0', 10) || 0;
        badge.textContent = String(current + amount);
        badge.style.display = 'block';
    });
}

async function pollCSMessages({ forceRender = false } = {}) {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (!user || csPollingInFlight || !window.DB || typeof window.DB.getMessages !== 'function') return;

    csPollingInFlight = true;
    try {
        const msgs = await window.DB.getMessages(user.id);
        const renderable = getRenderableCSMessages(msgs);
        const signature = getCSHistorySignature(renderable);
        const newMessages = renderable.filter(m => m?.id !== null && m?.id !== undefined && !csKnownMessageIds.has(String(m.id)));
        const modalOpen = isCSModalOpen();

        rememberCSMessages(renderable);

        if (modalOpen || forceRender) {
            const targetBox = document.getElementById('chatBox');
            const shouldStickBottom = !targetBox || (targetBox.scrollHeight - targetBox.scrollTop - targetBox.clientHeight) < 80;
            if (forceRender || signature !== csHistorySignature || newMessages.length > 0) {
                renderMessages(renderable);
                if (targetBox && shouldStickBottom) {
                    targetBox.scrollTop = targetBox.scrollHeight;
                }
            }
        } else {
            const incomingSupportCount = newMessages.filter(m => m.sender !== 'User' && m.sender !== 'user').length;
            if (incomingSupportCount > 0) {
                playNotificationSound();
                bumpCSBadges(incomingSupportCount);
            }
        }

        csHistorySignature = signature;
    } catch (error) {
        console.error("CS polling failed:", error);
    } finally {
        csPollingInFlight = false;
    }
}

function startCSPolling() {
    if (csPollingTimer) return;
    pollCSMessages({ forceRender: isCSModalOpen() });
    csPollingTimer = setInterval(() => {
        if (!(window.DB && window.DB.getCurrentUser && window.DB.getCurrentUser())) return;
        pollCSMessages({ forceRender: isCSModalOpen() });
    }, 2500);
}

window.openCS = function () {
    if (window.closeSettings) window.closeSettings();
    const modal = document.getElementById('csModal');
    if (modal) {
        modal.style.display = 'flex';
        // Ensure it opens maximized
        window.maximizeCS();
    }
    localStorage.setItem('avendus_cs_open', 'true');
    if (window.startChatListener) window.startChatListener();
    startCSPolling();
    loadCSMessages();
};

window.closeCS = function () {
    const modal = document.getElementById('csModal');
    if (modal) modal.style.display = 'none';
    localStorage.setItem('avendus_cs_open', 'false');
};

window.minimizeCS = function () {
    const content = document.querySelector('#csModal .cs-modal-content');
    const minimized = document.getElementById('csMinimizedBar');
    if (content && minimized) {
        content.style.display = 'none';
        minimized.style.display = 'flex';
        // Adjust parent container
        const modal = document.getElementById('csModal');
        modal.style.height = 'auto';
        modal.style.width = '300px';
        modal.style.background = 'transparent';
        modal.style.pointerEvents = 'none';
        minimized.style.pointerEvents = 'auto';
    }
};

window.maximizeCS = function () {
    const content = document.querySelector('#csModal .cs-modal-content');
    const minimized = document.getElementById('csMinimizedBar');
    if (content && minimized) {
        content.style.display = 'flex';
        minimized.style.display = 'none';
        const modal = document.getElementById('csModal');
        modal.style.height = '600px';
        modal.style.width = '500px';
        modal.style.background = 'transparent';
        modal.style.pointerEvents = 'auto';

        // Preserve scroll
        const chatBox = document.getElementById('chatBox');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }
};

async function loadCSMessages() {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    const targetBox = document.getElementById('chatBox');
    if (!user || !targetBox) return;

    if (window.DB && window.DB.getMessages) {
        const msgs = await window.DB.getMessages(user.id);
        const renderable = getRenderableCSMessages(msgs);
        rememberCSMessages(renderable);
        csHistorySignature = getCSHistorySignature(renderable);
        renderMessages(renderable);
    }

    // Clear badges when chat is opened
    const badges = [document.getElementById('csrMsgBadge'), document.getElementById('csrHeaderBadge')];
    badges.forEach(b => {
        if (b) {
            b.style.display = 'none';
            b.textContent = '0';
        }
    });

    targetBox.scrollTop = targetBox.scrollHeight;
}

async function resolveRealtimeUserId(user) {
    if (!user) return null;
    if (!window.DB || typeof window.DB._getNumericUserId !== 'function') return user.id;

    try {
        return await window.DB._getNumericUserId(user.id);
    } catch (error) {
        console.error("Realtime User ID Resolution Error:", error);
        return user.id;
    }
}

window.startChatListener = async function () {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (!user || isChatSubscribed) return;

    const client = window.DB ? window.DB.getClient() : null;
    if (!client) return;

    const realtimeUserId = await resolveRealtimeUserId(user);
    if (realtimeUserId === null || realtimeUserId === undefined || realtimeUserId === '') return;

    client.channel(`public:messages:${realtimeUserId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `user_id=eq.${realtimeUserId}`
        }, payload => {
            const m = payload.new;
            if (m.sender === 'System') return; // Ignore System (if any exist)

            // IGNORE NOTIFICATIONS in Chat (they have is_notification: true)
            try {
                const p = JSON.parse(m.message);
                if (p.is_notification) return;
            } catch (e) { }

            rememberCSMessages([m]);
            csHistorySignature = '';

            const isUser = m.sender === 'User' || m.sender === 'user';

            // Always append if modal is open
            const modal = document.getElementById('csModal');
            if (modal && modal.style.display === 'flex') {
                appendSingleMessage(m);
            }

            // Notify if from Support
            if (!isUser) {
                playNotificationSound();
                const badges = [document.getElementById('csrMsgBadge'), document.getElementById('csrHeaderBadge')];
                badges.forEach(badge => {
                    if (badge && (modal && modal.style.display !== 'flex')) {
                        const count = parseInt(badge.textContent || '0') + 1;
                        badge.textContent = count;
                        badge.style.display = 'block';
                    }
                });
            }
        }).subscribe();

    isChatSubscribed = true;
};

function renderMessages(msgs) {
    const targetBox = document.getElementById('chatBox');
    if (!targetBox) return;
    targetBox.innerHTML = '';
    if (msgs && msgs.forEach) {
        msgs.forEach(m => {
            // Filter out notifications
            try {
                if (m.sender === 'Admin') {
                    const p = JSON.parse(m.message);
                    if (p.is_notification) return;
                }
            } catch (e) { }
            appendSingleMessage(m);
        });
    }
}

function isCSMessageAlreadyRendered(messageId) {
    const targetBox = document.getElementById('chatBox');
    if (!targetBox || !messageId) return false;
    return !!targetBox.querySelector(`[data-message-id="${messageId}"]`);
}

function appendSingleMessage(m) {
    const targetBox = document.getElementById('chatBox');
    if (!targetBox) return;
    if (m && m.id && isCSMessageAlreadyRendered(m.id)) return;
    rememberCSMessages([m]);

    const div = document.createElement('div');
    const isUser = m.sender === 'User' || m.sender === 'user';
    div.className = `chat-bubble ${isUser ? 'user' : 'support'}`;
    if (m && m.id) div.dataset.messageId = m.id;

    let content = m.message || '';
    try {
        if (content.startsWith('{')) {
            const p = JSON.parse(content);
            if (p.type === 'image') {
                content = `<img src="${p.content}" style="max-width: 250px; border-radius: 8px; cursor: pointer; display: block;" onclick="window.open(this.src, '_blank')">`;
                if (p.caption) content += `<div style="margin-top: 5px; font-size: 0.9rem;">${p.caption}</div>`;
            } else {
                content = p.content || p.message || p.body || content;
            }
        }
    } catch (e) {
        // Fallback for non-JSON or weirdly formatted message
    }

    div.innerHTML = `
        <div class="message-text">${content}</div>
        <div class="message-time">${new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;

    targetBox.appendChild(div);
    targetBox.scrollTop = targetBox.scrollHeight;
}

window.sendCSMessage = async () => {
    const input = document.getElementById('csInput');
    const text = input ? input.value.trim() : '';
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    const previewArea = document.getElementById('csImagePreviewArea');
    const hasImage = previewArea && previewArea.dataset.base64;

    if (!text && !hasImage || !user) return;

    if (input) input.value = '';

    let messageData = text;
    if (hasImage) {
        messageData = JSON.stringify({
            type: 'image',
            content: previewArea.dataset.base64,
            caption: text
        });
        // Clear preview
        if (previewArea) {
            previewArea.innerHTML = '';
            delete previewArea.dataset.base64;
            previewArea.style.display = 'none';
        }
    }

    if (window.DB && window.DB.sendMessage) {
        const { success, error, data } = await window.DB.sendMessage(user.id, messageData, 'User');
        if (!success) {
            console.error("Chat Error:", error);
            await window.CustomUI.alert("Message failed to send. Please try again.", "Send Error");
            return;
        }

        if (data) {
            appendSingleMessage(data);
        } else {
            await loadCSMessages();
        }
    }
};

window.toggleEmojiPicker = function () {
    const picker = document.getElementById('emojiPicker');
    if (picker) {
        picker.style.display = picker.style.display === 'none' ? 'grid' : 'none';
    }
};

window.insertEmoji = function (emoji) {
    const input = document.getElementById('csInput');
    if (input) {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const oldText = input.value;
        input.value = oldText.substring(0, start) + emoji + oldText.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
    }
    // Close picker
    const picker = document.getElementById('emojiPicker');
    if (picker) picker.style.display = 'none';
};

window.handleCSImageUpload = async function (input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        // Size check (e.g. 2MB limit)
        if (file.size > 2 * 1024 * 1024) {
            await window.CustomUI.alert("Image file is too large (max 2MB).", "File Too Large");
            input.value = ''; // Reset
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const base64 = e.target.result;
            const previewArea = document.getElementById('csImagePreviewArea');
            if (previewArea) {
                previewArea.dataset.base64 = base64;
                previewArea.innerHTML = `
                    <div style="position: relative; width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 1px solid #d4af37;">
                        <img src="${base64}" style="width: 100%; height: 100%; object-fit: cover;">
                        <button onclick="window.clearCSImagePreview()" style="position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.5); color: white; border: none; padding: 2px; cursor: pointer; border-radius: 0 0 0 8px;">&times;</button>
                    </div>
                `;
                previewArea.style.display = 'flex';
            }
        };
        reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again if needed
    input.value = '';
};

window.clearCSImagePreview = function () {
    const preview = document.getElementById('csImagePreviewArea');
    if (preview) {
        preview.innerHTML = '';
        delete preview.dataset.base64;
        preview.style.display = 'none';
    }
};

function playNotificationSound() {
    try {
        const audio = new Audio('https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3');
        audio.volume = 0.5;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.log("Audio blocked via playNotificationSound"));
        }
    } catch (e) { }
}

window.startNotificationListener = async function () {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (!user) return;

    const client = window.DB ? window.DB.getClient() : null;
    if (!client) return;

    const realtimeUserId = await resolveRealtimeUserId(user);
    if (realtimeUserId === null || realtimeUserId === undefined || realtimeUserId === '') return;

    // Listen for NEW Notifications in 'messages' table
    client.channel(`user-notices-real:${realtimeUserId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages', // Reverted to messages table
            filter: `user_id=eq.${realtimeUserId}`
        }, payload => {
            const m = payload.new;
            // Only trigger if it looks like a notification (Admin/System)
            // Or if we want to show red dot for ALL messages as requested.
            // Request said: "The red dot should count: SELECT COUNT(*) FROM public.messages WHERE user_id = current_user_id AND is_read = false;"
            // So ANY new message should trigger the dot.

            playNotificationSound();

            // Update Bell Badges
            const badges = document.querySelectorAll('.notif-badge, #msgBadge');
            badges.forEach(b => {
                b.style.display = 'block';
            });

            // Trigger Ring Animation on all bell icons
            const icons = document.querySelectorAll('i[data-lucide="bell"]');
            icons.forEach(icon => {
                icon.classList.remove('bell-ring');
                void icon.offsetWidth; // Trigger reflow
                icon.classList.add('bell-ring');
                setTimeout(() => icon.classList.remove('bell-ring'), 1000);
            });
        })
        .subscribe();

    // Initial Check for Unread Notifications on Load
    setTimeout(async () => {
        if (window.DB && window.DB.getUnreadNotificationCount) {
            const count = await window.DB.getUnreadNotificationCount(user.id);
            if (count > 0) {
                const badges = document.querySelectorAll('.notif-badge, #msgBadge');
                badges.forEach(b => b.style.display = 'block');
            } else {
                const badges = document.querySelectorAll('.notif-badge, #msgBadge');
                badges.forEach(b => b.style.display = 'none');
            }
        }
    }, 2000);
};

// Auto-start chat listener and sync if logged in
document.addEventListener('DOMContentLoaded', () => {
    if (window.DB && window.DB.getCurrentUser()) {
        setTimeout(() => {
            if (window.startChatListener) window.startChatListener();
            if (window.startNotificationListener) window.startNotificationListener();
            startCSPolling();
            // Update CSR visibility
            const btn = document.getElementById('floatingCSR');
            if (btn) btn.style.display = 'flex';
            if (window.syncUserData) window.syncUserData();
        }, 1000);
    }
});

async function openWithdrawPage() {
    const user = window.DB ? window.DB.getCurrentUser() : null;
    if (!user) {
        if (window.CustomUI) {
            await window.CustomUI.alert("Please login to proceed with withdrawal.", "Authentication Required");
        } else {
            alert("Please login to proceed.");
        }
        return;
    }

    const credit = parseInt(user.credit_score || 0);
    if (credit < 90) {
        if (window.CustomUI) {
            await window.CustomUI.alert("Withdrawal disabled. Minimum credit score required: 90.", "Eligibility Check");
        } else {
            alert("Withdrawal disabled. Minimum credit score required: 90.");
        }
        return;
    }

    const currentPath = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    if (currentPath.includes("market.html")) {
        const view = params.get("view") || "market";
        window.location.href = `withdraw.html?from=market&view=${view}`;
    } else {
        window.location.href = `withdraw.html?from=homepage`;
    }
}
async function syncLoanEligibility() {
    const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
    if (!user) return;

    try {
        const client = window.DB.getClient();
        if (!client) return;

        const { data, error } = await client
            .from('users')
            .select('loan_enabled')
            .eq('id', user.id)
            .single();

        if (!error && data) {
            // Update local user object cached in session/local storage
            const updatedUser = { ...user, loan_enabled: !!data.loan_enabled };
            localStorage.setItem(window.DB.CURRENT_USER_KEY, JSON.stringify(updatedUser));

            // Ensure the Loan Offer Card is always visible even if loan_enabled = false
            const loanCard = document.getElementById('loanOfferCard');
            if (loanCard) {
                loanCard.style.display = 'flex';
            }
        }
    } catch (e) {
        console.error("Loan Eligibility Sync Error:", e);
    }
}
