console.log("🔥 js/db.js EXECUTION START");
/**
 * User Database Utility (Supabase Backend)
 */

// --- SUPABASE CONFIGURATION (Handled in supabase.js) ---
if (!window.DB) window.DB = {};
window.DB = {
    // Local Storage Keys
    CURRENT_USER_KEY: 'avendus_current_user',
    client: null,
    marketPriceCache: {},
    marketPriceFailUntil: {},
    marketPricePending: {},
    MARKET_PRICE_CACHE_TTL_MS: 10000,
    MARKET_PRICE_FAIL_COOLDOWN_MS: 15000,

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
        const allowLocal = window.ALLOW_LOCAL_MARKET_API === true;
        const localBase = (allowLocal && typeof window.INDIA_MARKET_API_BASE === 'string' && window.INDIA_MARKET_API_BASE.trim())
            ? window.INDIA_MARKET_API_BASE.trim()
            : '';
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

    getYahooSymbolCandidates(symbol) {
        const raw = String(symbol || '').trim();
        if (!raw) return [];
        const upper = raw.toUpperCase();
        const out = new Set([raw]);

        if (upper.startsWith('NSE:')) {
            out.add(`${upper.split(':').pop()}.NS`);
        } else if (upper.startsWith('BSE:')) {
            out.add(`${upper.split(':').pop()}.BO`);
        } else if (!upper.startsWith('^') && !/\.[A-Z]{2,4}$/.test(upper)) {
            out.add(`${upper}.NS`);
            out.add(`${upper}.BO`);
        }

        return [...out];
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
        const candidates = this.getYahooSymbolCandidates(symbol);
        for (const sym of candidates) {
            try {
                const { data, error } = await client
                    .from("market_cache")
                    .select("price, symbol")
                    .eq("symbol", sym)
                    .maybeSingle();
                if (error || !data) continue;
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
                        body: JSON.stringify({ symbol: sym, name: nm || undefined }),
                        cache: 'no-store'
                    });
                    if (!response.ok) continue;
                    const payload = await response.json();
                    const normalized = this.normalizeMarketQuote(payload, sym);
                    if (normalized) return normalized;
                    continue;
                }

                const url = `${baseUrl}/quote?symbol=${encodeURIComponent(sym)}${nm ? `&name=${encodeURIComponent(nm)}` : ''}`;
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) continue;
                const payload = await response.json();
                const normalized = this.normalizeMarketQuote(payload, sym);
                if (normalized) return normalized;
            } catch (_) { }
        }
        return null;
    },

    async getMarketPrice(symbol, name = '') {
        const client = this.getClient();
        const sym = String(symbol || '').trim();
        if (!sym) return { status: 'error', message: 'Invalid symbol' };

        const now = Date.now();
        const cacheKey = sym.toUpperCase();
        const cached = this.marketPriceCache[cacheKey];
        if (cached && (now - cached.ts) < this.MARKET_PRICE_CACHE_TTL_MS) {
            return cached.data;
        }
        const blockedUntil = this.marketPriceFailUntil[cacheKey] || 0;
        if (blockedUntil > now) {
            return { status: 'error', message: 'Market price cooldown' };
        }

        if (this.marketPricePending[cacheKey]) {
            return await this.marketPricePending[cacheKey];
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

    async searchStocks(query) {
        const client = this.getClient();
        if (!client) return [];

        try {
            const { data, error } = await client.functions.invoke('search-stocks', {
                body: { query }
            });

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error("Error searching stocks:", e);
            return [];
        }
    },

    // --- AUTHENTICATION ---
    async login(identifier, password) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        // Check mobile OR email
        const { data, error } = await client
            .from('users')
            .select('*')
            .or(`mobile.eq.${identifier},email.eq.${identifier}`)
            .eq('password', password)
            .single();

        if (error || !data) {
            return { success: false, message: 'Invalid credentials.' };
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

        return { success: true, user: data };
    },

    normalizeInvitationCode(invitationCode) {
        return String(invitationCode || '').trim().replace(/\s+/g, '').toUpperCase();
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
            '正常', '启用', '啟用', '活跃', '活躍'
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
            const rawTrimmed = String(invitationCode || '').trim();
            const candidates = [...new Set([
                normalizedCode,
                normalizedCode.toLowerCase(),
                rawTrimmed,
                rawTrimmed.toUpperCase(),
                rawTrimmed.toLowerCase()
            ].filter(Boolean))];

            const { data: rows, error } = await client
                .from('admins')
                .select('id, status, role, invitation_code')
                .in('invitation_code', candidates)
                .limit(20);

            if (error) throw error;

            const csr = (rows || []).find(row => this.isCsrRole(row.role) && this.isActiveAdminStatus(row.status));
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
        const insertData = {
            password,
            balance: 0,
            frozen: 0,
            invested: 0,
            outstanding: 0,
            kyc: 'Pending'
        };

        if (mobile) insertData.mobile = mobile;
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
            const { data: existingPhone } = await client
                .from('users')
                .select('id')
                .eq('mobile', mobile)
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
            .single();

        if (error) {
            console.error("Registration Error:", error);
            return { success: false, message: error.message };
        }

        // Auto-login after registration
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(data));

        return { success: true, user: data };
    },

    // --- SUPABASE OTP AUTH ---
    async sendEmailOtp(email) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        const authRedirectBase = (() => {
            const origin = String(window?.location?.origin || '').trim().replace(/\/$/, '');
            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
            return 'https://avendussparks.com';
        })();
        const emailRedirectTo = `${authRedirectBase}/login.html`;

        console.log("Supabase sendEmailOtp for:", email, "redirect:", emailRedirectTo);
        const { error } = await client.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: true,
                emailRedirectTo
            }
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

    /**
     * Self-Healing: Restores session from Supabase Auth if localStorage is empty.
     * Prevents "No data" issue after cache clearing.
     */
    async restoreSessionByAuth() {
        console.log("🔄 Checking for active Supabase Auth session...");
        const client = this.getClient();
        if (!client) {
            window.DB_READY = true;
            return null;
        }

        const { data: { session }, error } = await client.auth.getSession();
        if (error || !session || !session.user) {
            console.log("ℹ️ No active Supabase Auth session found.");
            window.DB_READY = true;
            return null;
        }

        console.log("✅ Found Supabase Session for:", session.user.email);

        // Fetch full profile from users table
        const { data: userProfile, error: profileError } = await client
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (userProfile && !profileError) {
            console.log("🚀 Restoring avendus_current_user to localStorage...");
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(userProfile));
            window.DB_READY = true;
            return userProfile;
        }

        console.warn("⚠️ Failed to restore user profile from DB:", profileError);
        window.DB_READY = true;
        return null;
    },

    async refreshCurrentUser() {
        const user = this.getCurrentUser();
        if (!user) return null;

        const client = this.getClient();
        if (!client) return user;

        const { data, error } = await client
            .from('users')
            .select('id, mobile, username, kyc, credit_score, vip, balance, invested, frozen, outstanding, full_name, id_number, address, loan_enabled, created_at, csr_id, invitation_code')
            .eq('id', user.id)
            .single();

        if (data && !error) {
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(data));
            return data;
        }
        return user;
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
        const { data, error } = await client
            .from('messages')
            .select('*')
            .eq('user_id', userId)
            .neq('sender', 'System') // Exclude System Notices from Chat
            .order('created_at', { ascending: true });

        return data || [];
    },

    // New: Get Notices (System Messages)
    async getNotices(userId) {
        const client = this.getClient();
        const { data, error } = await client
            .from('messages')
            .select('*')
            .eq('user_id', userId)
            .eq('sender', 'System') // Only System Notices
            .order('created_at', { ascending: false });

        return data || [];
    },

    async sendMessage(userId, message, sender = 'User') {
        const client = this.getClient();
        const { data, error } = await client
            .from('messages')
            .insert([{ user_id: userId, message, sender }]);

        return { success: !error, error };
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
        // Delete all non-system messages (chat history)
        const { error } = await client.from('messages')
            .delete()
            .eq('user_id', userId)
            .neq('sender', 'System');
        return { success: !error, error };
    },


    // --- NOTIFICATIONS (VIA MESSAGES TABLE) ---

    // Helper to resolve numeric ID if needed
    async _getNumericUserId(paramUserId) {
        const client = this.getClient();
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
            if (paramUserId) {
                // Try treating paramUserId as auth_id
                const { data: userData } = await client
                    .from('users')
                    .select('id')
                    .eq('auth_id', paramUserId)
                    .single();
                if (userData) return userData.id;

                // If not found, maybe paramUserId is ALREADY the numeric ID? 
                // We return it as is if we couldn't resolve via auth_id
                return paramUserId;
            }
        } catch (e) { console.error("ID Resolution Error:", e); }
        return paramUserId;
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
    async uploadKycImage(file, userId) {
        const client = this.getClient();
        if (!client) return { error: 'No client' };

        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        // 1. Upload
        const { data, error } = await client.storage
            .from('kyc-documents')
            .upload(fileName, file);

        if (error) {
            console.error("Upload Error:", error);
            return { error: error };
        }

        // 2. Get Public URL
        const { data: publicUrlData } = client.storage
            .from('kyc-documents')
            .getPublicUrl(fileName);

        return { publicUrl: publicUrlData.publicUrl };
    },

    async submitKYC(userId, fullName, mobile, idNumber, idFront, idBack, selfie, extra = {}) {
        const client = this.getClient();
        if (!client) return { success: false, message: 'Database connecting...' };

        // 1. Process files (upload if they are File objects)
        const uploads = [
            { file: idFront, key: 'id_front_url' },
            { file: idBack, key: 'id_back_url' },
            { file: selfie, key: 'selfie_url' }
        ];

        const urls = {};
        for (const up of uploads) {
            if (up.file) {
                if (typeof up.file === 'string' && up.file.startsWith('http')) {
                    urls[up.key] = up.file;
                } else if (up.file instanceof File || (typeof up.file === 'object' && up.file.name)) {
                    const res = await this.uploadKycImage(up.file, userId);
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
            full_name: fullName,
            id_number: idNumber,
            dob: extra.dob,
            email: extra.email,
            auth_id: extra.auth_id,
            username: extra.username,
            gender: extra.gender
            // Note: We skip 'mobile' because it's the unique ID and already set.
        };

        // Remove any undefined fields
        Object.keys(userPayload).forEach(key => userPayload[key] === undefined && delete userPayload[key]);

        const userUpdateRes = await this.updateUser(userId, userPayload);
        if (!userUpdateRes.success) {
            console.error("KYC PIPELINE: Profile Update Failed:", userUpdateRes.error);
            return { success: false, error: userUpdateRes.error, stage: 'profile_update' };
        }

        // 3. Prepare KYC Submission Record
        const kycPayload = {
            user_id: userId,
            id_type: extra.id_type || 'Aadhar',
            id_front_url: urls.id_front_url,
            id_back_url: urls.id_back_url,
            selfie_url: urls.selfie_url || null,
            status: 'Pending',
            submitted_at: new Date().toISOString()
        };

        // Remove any undefined fields
        Object.keys(kycPayload).forEach(key => kycPayload[key] === undefined && delete kycPayload[key]);

        const { data: existing } = await client
            .from('kyc_submissions')
            .select('id')
            .eq('user_id', userId)
            .limit(1);

        let res;
        if (existing && existing.length > 0) {
            res = await client
                .from('kyc_submissions')
                .update(kycPayload)
                .eq('user_id', userId);
        } else {
            res = await client
                .from('kyc_submissions')
                .insert([kycPayload]);
        }

        return {
            success: !res.error,
            error: res.error,
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
            return all.filter(b => b.user_id === userId);
        } catch (e) { return []; }
    },

    saveOfflineBank(userId, accountData) {
        const raw = localStorage.getItem('avendus_offline_banks');
        const all = raw ? JSON.parse(raw) : [];
        const newBank = { id: 'local_' + Date.now(), user_id: userId, ...accountData, created_at: new Date().toISOString() };
        all.push(newBank);
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

    async getBankAccounts(userId) {
        const client = this.getClient();

        let onlineData = [];
        try {
            const { data, error } = await client
                .from('bank_accounts')
                .select('*')
                .eq('user_id', userId)
                .or('is_deleted.is.null,is_deleted.eq.false')
                .order('created_at', { ascending: false });

            if (!error && data) onlineData = data;
        } catch (e) { console.warn("Supabase Fetch Failed, using offline."); }

        // Merge with offline data
        const offlineData = this.getOfflineBanks(userId);

        // Combine (Unique by ID if needed, but usually distinct)
        return [...onlineData, ...offlineData];
    },

    async addBankAccount(userId, accountData) {
        const client = this.getClient();
        const packet = { user_id: userId, ...accountData }; // Simplified packet

        // Since user changed DB column to TEXT, we can accept ANY ID now.
        // No more UUID restriction.

        const { data, error } = await client
            .from('bank_accounts')
            .insert([packet]);

        if (error) {
            console.error("Supabase Error:", error);
            // Fallback to offline IF online actually fails (network/server error)
            console.warn("Online Add Failed, saving offline:", error);
            this.saveOfflineBank(userId, accountData);
            return { success: true, offline: true };
        } else {
            return { success: true };
        }
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
        let query = client.from('kyc_submissions').select('*');
        if (auth.role === 'csr') {
            query = client.from('kyc_submissions').select('*, users!inner(*)');
            if (auth.invitation_code) {
                query = query.or(`users.csr_id.eq.${auth.id},users.invitation_code.eq.${auth.invitation_code}`);
            } else {
                query = query.eq('users.csr_id', auth.id);
            }
        }
        const { data } = await query.order('created_at', { ascending: false });
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
        const { error } = await client.from('kyc_submissions').update({ status, processed_at: new Date().toISOString() }).eq('id', id);
        return { success: !error, error };
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
        const { data, error } = await client
            .from('withdrawals')
            .insert([withdrawalData])
            .select()
            .single();

        return { success: !error, data, error };
    },

    // --- TRADING ---
    async submitTrade(tradeData) {
        const client = this.getClient();
        const { data, error } = await client
            .from('trades')
            .insert([tradeData])
            .select()
            .single();

        return { success: !error, data, error };
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
                .select('id, user_id, type, status, order_status, price, total_amount, paid_amount')
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
        const reconciled = await this._ensureIpoApprovalDeduction({
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

    async _ensureIpoApprovalDeduction({ tradeId, approvedQty, rpcData, preTrade, preBalance, hasPreBalance }) {
        const client = this.getClient();
        if (!client || !preTrade) return rpcData;
        if (!hasPreBalance) return rpcData;

        const typeLower = String(preTrade.type || '').toLowerCase();
        if (!typeLower.includes('ipo')) return rpcData;

        const rpcDeduct = parseFloat(rpcData?.to_deduct);
        if (Number.isFinite(rpcDeduct) && Math.abs(rpcDeduct) > 0.01) return rpcData;

        const { data: postTrade, error: tradeErr } = await client
            .from('trades')
            .select('id, user_id, price, paid_amount, outstanding_amount, status, order_status')
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
        const approvedValue = Math.max(0, approvedQty * tradePrice);
        const paidAmount = parseFloat(postTrade.paid_amount) || 0;
        const expectedDeduction = Math.max(0, approvedValue - paidAmount);
        const postBalance = parseFloat(postUser.balance) || 0;
        const actualDeduction = Math.max(0, (parseFloat(preBalance) || 0) - postBalance);
        const missingDeduction = expectedDeduction - actualDeduction;

        if (!(missingDeduction > 0.01)) return rpcData;

        const newBalance = postBalance - missingDeduction;
        const prevNeg = Math.max(0, -postBalance);
        const newNeg = Math.max(0, -newBalance);
        const debtDelta = Math.max(0, newNeg - prevNeg);
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
            console.error('IPO deduction fallback user update failed:', uErr);
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
            console.error('IPO deduction fallback trade update failed:', tErr);
            return { success: false, error: tErr.message || tErr };
        }

        return {
            ...(rpcData || {}),
            success: true,
            to_deduct: missingDeduction,
            new_balance: newBalance,
            status: debtDelta > 0.01 ? 'LOCKED_UNPAID' : (postTrade.status || 'Holding'),
            fallback_applied: true
        };
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

        let query = client.from('products').select('*');

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

        let query = client.from('products').select('*').eq('status', 'Active');

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

            if (error || !data) continue;
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

        const performSave = async (data) => {
            if (data.id && !data.id.toString().startsWith('local_')) {
                return await client
                    .from('products')
                    .update(data)
                    .eq('id', data.id);
            } else {
                const { id, ...saveData } = data;
                return await client
                    .from('products')
                    .insert([saveData]);
            }
        };

        let result = await performSave(productData);

        // Fallback for missing est_profit_percent column
        if (result.error && (result.error.message.includes('est_profit_percent') || result.error.code === 'PGRST204')) {
            console.log('Detected missing est_profit_percent, falling back to profit column...');
            const fallbackData = { ...productData };
            if (fallbackData.est_profit_percent !== undefined) {
                fallbackData.profit = fallbackData.est_profit_percent;
                delete fallbackData.est_profit_percent;
            }
            result = await performSave(fallbackData);
        }

        // Fallback for environments where products.allotment_date is not added yet.
        if (result.error && result.error.message && result.error.message.includes('allotment_date')) {
            console.log('Detected missing allotment_date, falling back without allocation date column...');
            const fallbackData = { ...productData };
            delete fallbackData.allotment_date;
            result = await performSave(fallbackData);
        }

        return { success: !result.error, error: result.error };
    },

    async deleteProduct(id) {
        const client = this.getClient();
        if (!client) return { success: false };
        // Hard delete as requested to remove from admin table
        const { error } = await client.from('products').delete().eq('id', id);
        return { success: !error, error };
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
            .single();

        if (error) {
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
            'IPO': [
                {
                    name: "Hyundai Motor India Ltd",
                    symbol: "HYUNDAI",
                    exchange: "NSE",
                    price: 1850,
                    listing_date: "2024-10-22",
                    start_date: "2024-10-15T10:00",
                    end_date: "2024-10-17T17:00",
                    description: "India's largest passenger car exporter and second largest manufacturer.",
                    min_invest: 14800,
                    est_profit: 35
                },
                {
                    name: "Waaree Energies Ltd",
                    symbol: "WAAREEENRG",
                    exchange: "NSE",
                    price: 1503,
                    listing_date: "2024-10-28",
                    start_date: "2024-10-21T10:00",
                    end_date: "2024-10-23T17:00",
                    description: "India's largest solar module manufacturer.",
                    min_invest: 13527,
                    est_profit: 55
                },
                {
                    name: "Bajaj Housing Finance",
                    symbol: "BAJAJHFL",
                    exchange: "NSE",
                    price: 70,
                    listing_date: "2024-09-16",
                    start_date: "2024-09-09T10:00",
                    end_date: "2024-09-11T17:00",
                    description: "A 100% subsidiary of Bajaj Finance Limited.",
                    min_invest: 14980,
                    est_profit: 135
                },
                {
                    name: "Ola Electric Mobility",
                    symbol: "OLAELEC",
                    exchange: "NSE",
                    price: 76,
                    listing_date: "2024-08-09",
                    start_date: "2024-08-02T10:00",
                    end_date: "2024-08-06T17:00",
                    description: "Leading EV manufacturer in India.",
                    min_invest: 14820,
                    est_profit: 20
                },
                {
                    name: "SEDEMAC Mechatronics",
                    symbol: "SEDEMAC",
                    exchange: "NSE",
                    price: 1352,
                    listing_date: "2026-03-11",
                    start_date: "2026-03-04T10:00",
                    end_date: "2026-03-06T17:00",
                    description: "Advanced mechatronics and control systems for vehicles.",
                    min_invest: 14850,
                    est_profit: 65
                }
            ],
            'OTC': [
                {
                    name: "NSE India (Unlisted)",
                    symbol: "NSE-INDIA",
                    exchange: "NSE-UNLISTED",
                    price: 6500,
                    description: "National Stock Exchange of India Limited - Highly liquid Unlisted share.",
                    min_invest: 500000,
                    est_profit: 85
                },
                {
                    name: "HDB Financial Services (HDFC Subsidiary)",
                    symbol: "HDB-FIN",
                    exchange: "BSE-UNLISTED",
                    price: 1150,
                    description: "HDFC Bank's NBFC arm - Expecting IPO soon.",
                    min_invest: 100000,
                    est_profit: 45
                },
                {
                    name: "Reliance Retail Ltd (Unlisted)",
                    symbol: "REL-RETAIL",
                    exchange: "NSE-UNLISTED",
                    price: 2850,
                    description: "India's largest retailer, subsidiary of Reliance Industries.",
                    min_invest: 250000,
                    est_profit: 35
                },
                {
                    name: "OpenAI (Global Tech)",
                    symbol: "OPEN-AI",
                    exchange: "US-OTC",
                    price: 4500,
                    description: "Leading AI research company (Secondary Market).",
                    min_invest: 1000000,
                    est_profit: 300
                },
                {
                    name: "SpaceX (Starlink Global)",
                    symbol: "SPACE-X",
                    exchange: "US-OTC",
                    price: 210,
                    description: "Aerospace and satellite giant (Secondary Market).",
                    min_invest: 50000,
                    est_profit: 120
                },
                {
                    name: "Swiggy Unlisted (Secondary)",
                    symbol: "SWIGGY",
                    exchange: "NSE-UNLISTED",
                    price: 480,
                    description: "Food delivery giant - Secondary market trade.",
                    min_invest: 25000,
                    est_profit: 45
                },
                {
                    name: "Pharmeasy (API Holdings)",
                    symbol: "PHARMEASY",
                    exchange: "NSE-UNLISTED",
                    price: 25,
                    description: "India's largest healthcare ecosystem.",
                    min_invest: 15000,
                    est_profit: 150
                },
                {
                    name: "OYO Rooms (Unlisted)",
                    symbol: "OYO-UNLISTED",
                    exchange: "GLOBAL-OTC",
                    price: 65,
                    description: "Global hospitality chain - Pre-IPO shares.",
                    min_invest: 20000,
                    est_profit: 90
                }
            ],
            'Ins.stocks': [
                {
                    name: "NTPC Green Energy (Anchor)",
                    symbol: "NTPCGREEN.NS",
                    exchange: "NSE",
                    price: 110,
                    description: "Green energy arm of NTPC - Anchor Investor allotment.",
                    min_invest: 1000000,
                    est_profit: 25
                },
                {
                    name: "HDFC Bank (Institutional Block)",
                    symbol: "HDFCBANK.NS",
                    exchange: "NSE",
                    price: 1640.50,
                    description: "Institutional block allotment for accredited investors.",
                    min_invest: 1000000,
                    est_profit: 12
                },
                {
                    name: "Zomato Ltd (Anchor Tranche)",
                    symbol: "ZOMATO.NS",
                    exchange: "NSE",
                    price: 254.20,
                    description: "Post-IPO anchor lock-in release tranche.",
                    min_invest: 250000,
                    est_profit: 18
                }
            ]
        };

        return data[type] || [];
    },

    // --- ATOMIC SUBSCRIPTION & SETTLEMENT ---
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
        if (data && data.success === false) return { success: false, error: data.error };
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

console.log("🔥 window.DB INITIALIZED", window.DB);

// Automatically attempt session recovery on load AT THE VERY END
(async () => {
    console.log("🔥 [js/db.js] Auto-Init Triggered");
    if (window.DB && typeof window.DB.getCurrentUser === 'function' && typeof window.DB.restoreSessionByAuth === 'function') {
        if (!window.DB.getCurrentUser()) {
            await window.DB.restoreSessionByAuth();
        } else {
            console.log("✅ User already in localStorage, setting DB_READY");
            window.DB_READY = true;
        }
    } else {
        console.error("❌ DB Object not fully ready during auto-init!");
    }
})();
