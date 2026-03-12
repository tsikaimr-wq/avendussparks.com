
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
