/**
 * Admin RBAC Guard & Sidebar Control
 * Handles authentication checks and role-based UI modifications.
 */

(function () {
    const adminAuth = sessionStorage.getItem('admin_auth');
    const path = window.location.pathname;

    // Step 1 — GLOBAL AUTH GUARD
    if (!adminAuth) {
        if (!path.includes('admin_login.html')) {
            window.location.href = 'admin_login.html';
        }
        return;
    }

    let auth;
    try {
        auth = JSON.parse(adminAuth);
    } catch (e) {
        sessionStorage.removeItem('admin_auth');
        window.location.href = 'admin_login.html';
        return;
    }

    if (!auth || !auth.id || !auth.role) {
        sessionStorage.removeItem('admin_auth');
        window.location.href = 'admin_login.html';
        return;
    }

    // Export verify access helper
    window.AdminRole = auth.role;
    window.AdminUser = auth.username;

    // Step 2 — PAGE-LEVEL PROTECTION (CSR ONLY)
    if (auth.role === 'csr') {
        const restrictedFiles = [
            'admin_management.html',
            'financial_management.html',
            'role_management.html',
            'system_settings.html',
            'admin_notification_center.html',
            'admin_customer_service.html',
            'admin_account_settings.html'
        ];
        const currentPage = path.split('/').pop();

        if (restrictedFiles.includes(currentPage)) {
            console.warn("CSR Access Denied: Redirecting to Dashboard.");
            window.location.href = 'admin_customer_management.html';
            return;
        }
    }

    // Step 3 — STRUCTURAL SIDEBAR & UI CONTROL
    document.addEventListener('DOMContentLoaded', () => {
        // Debug confirmation (Instruction 5)
        console.log("Logged in role:", auth.role);

        if (auth.role === 'csr') {
            applyStructuralRestrictions();
        } else if (auth.role === 'super_admin') {
            const adminBtn = document.getElementById('btn_admin_mgmt');
            if (adminBtn) adminBtn.style.display = 'flex';
        }
    });

    function applyStructuralRestrictions() {
        console.log("Applying CSR Structural Restrictions...");

        // Modules to REMOVE from DOM completely for CSR
        const restrictedIds = [
            'btn_admin_mgmt',
            'btn_bank_accounts',
            'btn_stock057',
            'btn_messages',        // Notification Center
            'btn_livechat',        // Customer Service Support
            'btn_account_settings', // Account Settings
            'btn_products'         // Product Management
        ];

        restrictedIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove(); // STRUCTURAL REMOVAL (Instruction 2)
        });

        const groupComm = document.querySelector('[data-i18n="group_communication"]');
        if (groupComm) groupComm.remove();

        // Under Transaction Records: Remove Stock, Bulk. Keep IPO and OTC.
        const restrictedSubItems = ['btn_stock', 'btn_bulk'];
        restrictedSubItems.forEach(sid => {
            const el = document.getElementById(sid);
            if (el) el.remove();
        });

        // Transaction Records removal is now handled by restrictedIds

        // --- NEW: CSR TOP DROPDOWN LOCK (Instruction 3) ---
        const dropdown = document.querySelector('.admin-dropdown');
        if (dropdown) {
            // Find all links and buttons in the dropdown
            const items = dropdown.querySelectorAll('a, button');
            items.forEach(item => {
                const text = item.innerText.trim().toLowerCase();
                // If it's NOT logout, remove it from DOM
                if (!text.includes('logout')) {
                    item.remove();
                }
            });
        }

        // Re-run lucide to fix icons if needed
        if (window.lucide) window.lucide.createIcons();

        // Global removal of specific action buttons/admin tools for CSR
        const restrictedSelectors = [
            '.btn-delete',
            '.btn-red',
            'button[onclick*="toggleAdminStatus"]',
            'button[onclick*="deleteAdmin"]',
            'button[onclick*="openAddAdminModal"]',
            'button[onclick*="createAdmin"]',
            'button[onclick*="changeRole"]',
            'div[onclick*="switchPage(\'products\')"]'
        ];
        restrictedSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.remove());
        });
    }

    // Step 4 — ACTION-LEVEL PERMISSION CHECK (LOGICAL)
    window.checkPermission = function (action) {
        if (auth.role === 'super_admin') return true;

        const csrBlacklist = [
            'create_admin', 'delete_admin', 'change_admin_role',
            'system_config', 'financial_report', 'db_modification',
            'delete_user',
            // 'add_product', // Removed (Instruction 2)
            'approve_financial', 'edit_financial',
            'admin_mgmt_access', 'role_management', 'createAdmin', 'deleteAdmin', 'changeRole'
        ];

        if (csrBlacklist.includes(action)) {
            alert("ACCESS DENIED: Your account (CSR) does not have permission for this action.");
            return false;
        }
        return true;
    };

    // Defensive hooks for CSR (Instruction 3)
    if (auth.role === 'csr') {
        const sensitiveFuncs = [
            'deleteUser', 'deleteProduct', 'deleteDeposit',
            'deleteNotification', 'deleteBankAccount', 'deleteLoanRecord',
            'toggleAdminStatus', 'deleteAdmin', 'openAddAdminModal',
            'createAdmin', 'deleteAdmin', 'changeRole'
        ];
        sensitiveFuncs.forEach(fn => {
            const original = window[fn];
            if (original && typeof original === 'function') {
                window[fn] = function (...args) {
                    if (window.checkPermission('restricted_logic_action')) {
                        return original.apply(this, args);
                    }
                };
            }
        });
    }

})();
