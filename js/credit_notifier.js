// CREDIT THRESHOLD NOTIFICATION PATCH
//STRICT ISOLATED IMPLEMENTATION
//Objective: Periodically check user credit and generate a system notification if below thresholds.

(function () {
    console.log("AVENDUS PATCH: Credit Notifier Initialized.");

    window.checkAndNotifyCredit = async function () {
        const user = window.DB && window.DB.getCurrentUser ? window.DB.getCurrentUser() : null;
        if (!user) return;

        // Requirement: Trigger if credit < 90
        const credit = parseInt(user.credit_score || 0);
        if (credit >= 90) return;

        // Logic check: "DO NOT duplicate warning if already unread exists."
        // We check for unread notifications of type 'credit_warning'
        const client = window.DB.getClient();
        if (!client) return;

        try {
            // Check for existing unread credit_warning notification in 'messages' table
            // Note: We use the 'messages' table as the primary notification storage for the drawer UI.
            const { data: existingNotices, error: checkError } = await client
                .from('messages')
                .select('id, message')
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (checkError) {
                console.error("[Credit Warning Patch] Fetch error:", checkError);
                return;
            }

            const hasActiveWarning = (existingNotices || []).some(m => {
                try {
                    const p = JSON.parse(m.message);
                    return p.type === 'credit_warning' || p.is_credit_alert === true;
                } catch (e) {
                    // Fallback for legacy plain text notices if any
                    return m.message.includes("Credit Score Alert") || m.message.includes("credit score is below");
                }
            });

            if (hasActiveWarning) {
                console.log("[Credit Warning Patch] Unread warning already exists. Skipping insertion.");
                return;
            }

            // Prepare Notification Payload
            let warningMessage = "Your credit score is below 90. Some platform features may be restricted.";
            if (credit < 70) {
                warningMessage = "High Risk Credit Level";
            }

            console.log(`[Credit Warning Patch] Score ${credit} triggered warning: "${warningMessage}"`);

            // Requirement: INSERT new notification { user_id, title, message, type, created_at, status }
            // Mapped to existing 'messages' schema for UI compatibility
            const payload = JSON.stringify({
                title: "Credit Warning",
                message: warningMessage,
                type: "credit_warning",
                is_notification: true,
                is_credit_alert: true // Internal flag for easier checking
            });

            const { error: insertError } = await client
                .from('messages')
                .insert([{
                    user_id: user.id,
                    message: payload,
                    sender: 'System',
                    is_read: false,
                    created_at: new Date().toISOString()
                }]);

            if (!insertError) {
                console.log("[Credit Warning Patch] Notification inserted successfully.");
                // Bell refresh is handled by the existing Supabase realtime listener in script.js,
                // but we can force a badge update for immediate feedback.
                if (window.DB.getUnreadNotificationCount) {
                    const count = await window.DB.getUnreadNotificationCount(user.id);
                    const badges = document.querySelectorAll('.notif-badge, #msgBadge');
                    if (count > 0) {
                        badges.forEach(b => {
                            b.textContent = count > 99 ? '99+' : count;
                            b.style.display = 'block';
                        });
                    }
                }
            } else {
                console.error("[Credit Warning Patch] Insert failed:", insertError);
            }

        } catch (err) {
            console.error("[Credit Warning Patch] Execution error:", err);
        }
    };

    // Hook into syncUserData to ensure it runs after every data fetch
    // Requirement: "On user session load (after user data fetch)"
    const originalSync = window.syncUserData;
    window.syncUserData = async function () {
        if (typeof originalSync === 'function') {
            await originalSync();
        }
        // Run check after sync completes (local storage is fresh)
        setTimeout(() => window.checkAndNotifyCredit(), 500);
    };

    console.log("AVENDUS PATCH: syncUserData hooked for credit checks.");
})();
