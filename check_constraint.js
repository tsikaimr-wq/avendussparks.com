
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gipxccfydceahzmqdoks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpcHhjY2Z5ZGNlYWh6bXFkb2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjI2NDQsImV4cCI6MjA4NjAzODY0NH0.evPHM1GdBOufR2v2KYARiG8r81McUtUAPNVovn6P6-s';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkConstraint() {
    console.log("Checking withdrawals.status raw values...");
    const { data: rawData, error: rawError } = await supabase.from('withdrawals').select('status').limit(5);
    if (rawError) {
        console.error("Error fetching raw values:", rawError);
    } else {
        console.log("Raw status values in DB:", rawData.map(d => d.status));
    }

    console.log("\nAttempting to find constraint definition via query...");
    // Public keys usually can't read information_schema, but let's try a custom RPC or a known table
    // Since we can't do that, let's try a trail and error insertion
    const statuses = ['Pending', 'pending', 'PENDING', 'Approved', 'approved', 'APPROVED', 'Success', 'success', 'SUCCESS'];

    for (const s of statuses) {
        console.log(`Testing status: '${s}'`);
        const { error } = await supabase.from('withdrawals').insert([{
            user_id: 1, // Assuming id 1 exists as demo user
            amount: 1,
            bank_name: 'TEST',
            status: s
        }]);

        if (error) {
            console.log(`  Result for '${s}': FAILED - ${error.message}`);
        } else {
            console.log(`  Result for '${s}': SUCCESS!`);
            // Clean up
            await supabase.from('withdrawals').delete().eq('status', s).eq('bank_name', 'TEST');
        }
    }
}

checkConstraint();
