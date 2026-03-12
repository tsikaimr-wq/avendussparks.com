import urllib.request
import json
import re

with open('js/supabase.js', 'r') as f:
    content = f.read()
    match = re.search(r"const\s+supabaseKey\s*=\s*'([^']+)'", content)
    if match:
        key = match.group(1)
        url = "https://gipxxcfydceahzmqdoks.supabase.co/rest/v1/trades?user_id=eq.66&select=id,status,outstanding_amount,paid_amount,symbol,total_amount&order=created_at.desc"
        req = urllib.request.Request(url, headers={
            'apikey': key,
            'Authorization': f'Bearer {key}'
        })
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                print(json.dumps(data, indent=2))
        except Exception as e:
            print("Error:", e)
    else:
        print("Key not found")
