$SUPABASE_URL = "https://xizuwvmepfcfodwfwqce.supabase.co"
$SUPABASE_KEY = "sb_publishable_gj30etPyQjlvfH062VUeSw_F83Eii85"
$SYMBOL = "RELIANCE.NS"

Write-Host "--- FORCE TEST: get-market-price logic ---" -ForegroundColor Cyan

# 1. Fetch from Yahoo
$yahooUrl = "https://query1.finance.yahoo.com/v8/finance/chart/$SYMBOL"
Write-Host "1. Fetching from Yahoo: $yahooUrl"
try {
    $yahooRes = Invoke-RestMethod -Uri $yahooUrl
    Write-Host "FULL Yahoo Response (first result meta):" -ForegroundColor DarkGray
    $yahooRes.chart.result[0].meta | ConvertTo-Json
    
    $price = $yahooRes.chart.result[0].meta.regularMarketPrice
    Write-Host "`nExtracted Price: $price" -ForegroundColor Green
}
catch {
    Write-Host "Yahoo Fetch FAILED: $_" -ForegroundColor Red
    exit
}

# 2. Upsert into Supabase (market_cache)
if ($null -ne $price) {
    Write-Host "`n2. Attempting Upsert into market_cache..."
    $headers = @{
        "apikey"        = $SUPABASE_KEY
        "Authorization" = "Bearer $SUPABASE_KEY"
        "Content-Type"  = "application/json"
        "Prefer"        = "return=representation"
    }
    
    $body = @{
        symbol     = $SYMBOL
        price      = $price
        source     = "yahoo"
        updated_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    } | ConvertTo-Json

    try {
        $upsertUrl = "$SUPABASE_URL/rest/v1/market_cache"
        $upsertRes = Invoke-WebRequest -Uri $upsertUrl -Method Post -Headers $headers -Body $body
        Write-Host "Upsert SUCCESSFUL!" -ForegroundColor Green
        Write-Host "Upsert Result (JSON):"
        $upsertRes.Content
    }
    catch {
        Write-Host "Upsert FAILED." -ForegroundColor Red
        Write-Host "Error Details: $_"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host "Error Body: $errorBody" -ForegroundColor Yellow
        }
    }
}

# 3. Verify Insertion
Write-Host "`n3. Verifying Insertion (GET market_cache)..."
try {
    $verifyUrl = "$SUPABASE_URL/rest/v1/market_cache?symbol=eq.$SYMBOL"
    $verifyHeaders = @{
        "apikey"        = $SUPABASE_KEY
        "Authorization" = "Bearer $SUPABASE_KEY"
    }
    $verifyRes = Invoke-RestMethod -Uri $verifyUrl -Method Get -Headers $verifyHeaders
    if ($verifyRes.Count -gt 0) {
        Write-Host "CONFIRMED: Row is present in market_cache." -ForegroundColor Green
        $verifyRes | ConvertTo-Json
    }
    else {
        Write-Host "NOT FOUND: Row is missing from market_cache." -ForegroundColor Red
    }
}
catch {
    Write-Host "Verification GET FAILED: $_" -ForegroundColor Red
}
