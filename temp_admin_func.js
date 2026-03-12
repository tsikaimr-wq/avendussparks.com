
async function updateTradeStatus(id, newStatus) {
    const client = DB.getClient();
    showLoader(true);
    try {
        // 1. Fetch current trade details
        const { data: trade, error: tErr } = await client.from('trades').select('*').eq('id', id).single();
        if (tErr || !trade) throw new Error("Trade not found");

        if (newStatus === 'Settled' && trade.status !== 'Settled') {
            // Approve Logic: Deduct Balance, Add Invested
            const uid = trade.user_id;
            const amount = parseFloat(trade.total_amount);

            // 2. Fetch User
            const { data: user, error: uErr } = await client.from('users').select('*').eq('id', uid).single();
            if (uErr || !user) throw new Error("User not found");

            const currentBalance = parseFloat(user.balance) || 0;

            if (currentBalance < amount) {
                alert(`Cannot approve: User (ID: ${uid}) has insufficient balance (₹${currentBalance.toFixed(2)}) for this trade (₹${amount.toFixed(2)}).`);
                showLoader(false);
                return;
            }

            // 3. Process Transaction
            const newBalance = currentBalance - amount;
            const newInvested = (parseFloat(user.invested) || 0) + amount;

            const { error: upUserErr } = await client.from('users').update({
                balance: newBalance,
                invested: newInvested
            }).eq('id', uid);

            if (upUserErr) throw upUserErr;
        }

        // 4. Update Trade Status
        const { error: upTradeErr } = await client.from('trades').update({
            status: newStatus,
            processed_at: new Date().toISOString() // Assuming schema has this or we ignore it
        }).eq('id', id);

        if (upTradeErr) throw upTradeErr;

        alert(`Trade #${id} marked as ${newStatus}.`);
        init(); // Refresh data

    } catch (e) {
        console.error(e);
        alert("Error updating trade: " + e.message);
    } finally {
        showLoader(false);
    }
}
