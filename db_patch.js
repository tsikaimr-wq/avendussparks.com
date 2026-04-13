
// Patch DB.updateLoanStatus to include updated_at/processed_at
if (window.DB) {
    window.DB.updateLoanStatus = async function (id, status, payload = {}) {
        const client = this.getClient();
        if (!client) {
            alert("Database client not initialized");
            return { success: false, error: { message: "Database client not initialized" } };
        }

        const adminAuth = sessionStorage.getItem('admin_auth');
        if (!adminAuth) return { success: false, error: { message: "Admin session not found" } };

        const auth = JSON.parse(adminAuth);
        const adminId = parseInt(auth.id);
        const loanId = parseInt(id);

        if (isNaN(adminId)) return { success: false, error: { message: "Invalid Admin ID in session" } };
        if (isNaN(loanId)) return { success: false, error: { message: "Invalid Loan ID" } };

        // Include eligibility in the payload if it's coming from the modal
        const eligibility = payload.loan_enabled !== undefined ? payload.loan_enabled : true;

        console.log("DB (Patch): Executing secure loan operation:", { loanId, status, adminId });

        const { data, error } = await client.rpc('operate_loan_secure', {
            p_loan_id: loanId,
            p_status: status,
            p_admin_note: payload.admin_note || '',
            p_approved_amount: parseFloat(payload.amount) || 0,
            p_repayment_terms: payload.repayment_terms || '',
            p_eligibility: eligibility,
            p_admin_id: adminId,
            p_admin_role: auth.role
        });

        if (error) {
            console.error('Loan update error (RPC):', error);
            return { success: false, error };
        }

        if (!data) return { success: false, error: { message: "No response from server" } };

        // Handle string errors from backend to ensure res.error.message works in UI
        if (data.success === false && typeof data.error === 'string') {
            return { success: false, error: { message: data.error }, data };
        }

        return { success: data.success, error: data.error, data: data };
    };

    // Add getBorrowedFunds to fetch total approved loans (CALCULATION AS REQUESTED)
    window.DB.getBorrowedFunds = async function (userId) {
        const client = this.getClient();
        if (!client) return 0;

        // 6. Assets Borrowed Funds Calculation: SELECT COALESCE(SUM(amount), 0) ... WHERE status = 'APPROVED'
        const { data, error } = await client
            .from('loans')
            .select('amount')
            .eq('user_id', userId)
            .in('status', ['Approved', 'APPROVED']);

        if (error) {
            console.error("Error fetching borrowed funds:", error);
            return 0;
        }

        // Sum the amounts
        if (!data || data.length === 0) return 0;
        const total = data.reduce((sum, loan) => sum + (parseFloat(loan.amount) || 0), 0);
        return total;
    };

    console.log("Patched DB with updateLoanStatus (timestamps) and getBorrowedFunds (SUM logic)");
}

// Patch admin live chat loading so the backend support list does not perform a full-table
// messages scan that intermittently 500s on production.
(function installAdminLiveChatPatch() {
    function tryPatch() {
        if (!/admin_customer_management\.html/i.test(window.location.pathname || '')) return false;
        if (typeof window.initLiveChat !== 'function') return false;
        if (window.__adminLiveChatPatched) return true;

        const originalInitLiveChat = window.initLiveChat;

        window.initLiveChat = async function patchedInitLiveChat() {
            const client = window.DB?.getClient?.();
            if (!client) return;
            if (typeof startAdminChatPolling === 'function') {
                startAdminChatPolling();
            }

            const auth = JSON.parse(sessionStorage.getItem('admin_auth') || '{}');
            const isCsr = auth.role === 'csr';
            const userIds = (Array.isArray(allUsers) ? allUsers : [])
                .map(user => user && user.id)
                .filter(id => id !== null && id !== undefined && id !== '');

            if (userIds.length === 0) {
                chatUsers = [];
                if (typeof refreshAdminChatBadge === 'function') refreshAdminChatBadge();
                if (typeof renderChatUserList === 'function') renderChatUserList();
                return;
            }

            let msgs = [];
            try {
                const primaryLimit = isCsr ? 300 : 400;
                const { data: primaryMsgs, error: primaryError } = await client
                    .from('messages')
                    .select('id, user_id, message, sender, is_read, created_at')
                    .in('user_id', userIds)
                    .neq('sender', 'System')
                    .order('created_at', { ascending: false })
                    .limit(primaryLimit);

                if (primaryError) {
                    console.warn('Patched admin live chat primary query failed, falling back to batches.', primaryError);
                    const batchSize = 20;
                    for (let start = 0; start < userIds.length; start += batchSize) {
                        const batchUserIds = userIds.slice(start, start + batchSize);
                        if (!batchUserIds.length) continue;
                        try {
                            const { data: batchMsgs, error: batchError } = await client
                                .from('messages')
                                .select('id, user_id, message, sender, is_read, created_at')
                                .in('user_id', batchUserIds)
                                .neq('sender', 'System')
                                .order('created_at', { ascending: false })
                                .limit(80);
                            if (batchError) {
                                console.warn('Patched admin live chat batch query failed:', batchError);
                                continue;
                            }
                            if (Array.isArray(batchMsgs) && batchMsgs.length) {
                                msgs.push(...batchMsgs);
                            }
                        } catch (batchFetchError) {
                            console.warn('Patched admin live chat batch query threw:', batchFetchError);
                        }
                    }
                    if (msgs.length) {
                        msgs.sort((left, right) => new Date(right?.created_at || 0).getTime() - new Date(left?.created_at || 0).getTime());
                    }
                } else {
                    msgs = Array.isArray(primaryMsgs) ? primaryMsgs : [];
                }
            } catch (error) {
                console.warn('Patched admin live chat failed, falling back to original initLiveChat.', error);
                return originalInitLiveChat();
            }

            const uids = [...new Set((msgs || []).map(messageRow => messageRow.user_id))];
            const scopedUsers = (Array.isArray(allUsers) ? allUsers : []).filter(user => uids.includes(user.id));
            if (typeof buildAdminChatUsersFromMessages === 'function') {
                buildAdminChatUsersFromMessages(scopedUsers, msgs || []);
            }
            if (typeof refreshAdminChatBadge === 'function') refreshAdminChatBadge();
            if (typeof renderChatUserList === 'function') renderChatUserList();

            if (!window.isAdminChatSubscribed && client.channel) {
                const chatChannel = client.channel('admin-chat-broadcaster')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                        const newMsg = payload.new;
                        if (isCsr && !userIds.includes(newMsg.user_id)) return;

                        if (typeof isAdminUserChatSender === 'function' && isAdminUserChatSender(newMsg.sender)) {
                            if (typeof playNotificationSound === 'function') playNotificationSound();
                        }

                        if (currentChatUser && String(newMsg.user_id) === String(currentChatUser.id)) {
                            if (typeof appendChatMessage === 'function') appendChatMessage(newMsg);
                            if (typeof isLivechatPageVisible === 'function' && isLivechatPageVisible() && typeof isAdminUserChatSender === 'function' && isAdminUserChatSender(newMsg.sender)) {
                                const openedUser = chatUsers.find(user => String(user.id) === String(newMsg.user_id));
                                if (openedUser) openedUser.unreadCount = 0;
                                if (typeof markAdminConversationRead === 'function') {
                                    markAdminConversationRead(newMsg.user_id);
                                }
                            }
                        }
                        if (typeof updateChatUserList === 'function') updateChatUserList(newMsg);
                    })
                    .subscribe();
                window.isAdminChatSubscribed = true;
                window.__adminLiveChatChannel = chatChannel;
            }
        };

        window.__adminLiveChatPatched = true;
        console.log('Patched admin live chat loader for scoped message queries.');
        return true;
    }

    let attempts = 0;
    const timer = setInterval(() => {
        attempts += 1;
        if (tryPatch() || attempts > 40) {
            clearInterval(timer);
        }
    }, 500);
})();
