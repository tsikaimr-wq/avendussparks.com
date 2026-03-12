const fs = require('fs');
const https = require('https');

const supabaseKeyRegex = /const\s+supabaseKey\s*=\s*'([^']+)'/;
const fileContent = fs.readFileSync('js/supabase.js', 'utf8');
const match = fileContent.match(supabaseKeyRegex);

if (match && match[1]) {
    const supabaseKey = match[1];
    const supabaseUrl = 'gipxxcfydceahzmqdoks.supabase.co';

    const options = {
        hostname: supabaseUrl,
        path: '/rest/v1/trades?user_id=eq.66&select=id,status,outstanding_amount,paid_amount,symbol,total_amount&order=created_at.desc',
        method: 'GET',
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                console.log(JSON.stringify(JSON.parse(data), null, 2));
            } catch (e) { console.log("Not JSON:", data); }
        });
    });
    req.on('error', console.error);
    req.end();
} else {
    console.error("Could not find key in js/supabase.js");
}
