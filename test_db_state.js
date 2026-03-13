const fs = require('fs');
const https = require('https');

const supabaseKey = fs.readFileSync('js/supabase.js', 'utf8').match(/const supabaseKey = '(.*?)'/)[1];
const supabaseUrl = 'https://xizuwvmepfcfodwfwqce.supabase.co';

const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
};

const req = https.request(`${supabaseUrl}/rest/v1/trades?user_id=eq.66&select=id,status,outstanding_amount,paid_amount,symbol,total_amount&order=created_at.desc`, { headers }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(JSON.parse(data)));
});
req.on('error', console.error);
req.end();
