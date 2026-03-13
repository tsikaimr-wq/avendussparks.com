$SUPABASE_URL = "https://xizuwvmepfcfodwfwqce.supabase.co"
$SUPABASE_KEY = "sb_publishable_gj30etPyQjlvfH062VUeSw_F83Eii85"
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
