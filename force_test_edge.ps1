$SUPABASE_URL = "https://xizuwvmepfcfodwfwqce.supabase.co"
$SUPABASE_KEY = "sb_publishable_gj30etPyQjlvfH062VUeSw_F83Eii85"
$SYMBOL = "RELIANCE.NS"

Write-Host "Invoking Edge Function: get-market-price for $SYMBOL" -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type"  = "application/json"
}

$body = @{ symbol = $SYMBOL } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/get-market-price" -Method Post -Headers $headers -Body $body
    Write-Host "`nResponse Received:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "`nExecution FAILED." -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Error Details: $_"
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error Body: $errorBody" -ForegroundColor Yellow
    }
}
