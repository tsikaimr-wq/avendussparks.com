$SUPABASE_URL = "https://gipxccfydceahzmqdoks.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpcHhjY2Z5ZGNlYWh6bXFkb2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjI2NDQsImV4cCI6MjA4NjAzODY0NH0.evPHM1GdBOufR2v2KYARiG8r81McUtUAPNVovn6P6-s"
$SYMBOL = "RELIANCE.NS"

function Test-EdgeFunction($testName) {
    Write-Host "`n--- Running Test: $testName ---" -ForegroundColor Cyan
    $headers = @{
        "Authorization" = "Bearer $SUPABASE_KEY"
        "Content-Type"  = "application/json"
    }
    $body = @{ symbol = $SYMBOL } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/get-market-price" -Method Post -Headers $headers -Body $body
        Write-Host "Response: $($response | ConvertTo-Json -Depth 5)" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
        return $null
    }
}

# 1. Initial Call
$res1 = Test-EdgeFunction "Initial Call (Yahoo Fetch)"

if ($res1) {
    # 2. Sequential Call (Cache)
    Write-Host "Waiting 2 seconds..."
    Start-Sleep -Seconds 2
    $res2 = Test-EdgeFunction "Second Call (Cache check)"

    if ($res2 -and $res2.price -eq $res1.price -and $res2.isDelayed -eq $false) {
        Write-Host "SUCCESS: Fast Cache working." -ForegroundColor DarkGreen
    }
}
