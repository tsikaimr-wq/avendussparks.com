$SUPABASE_URL = "https://gipxccfydceahzmqdoks.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpcHhjY2Z5ZGNlYWh6bXFkb2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjI2NDQsImV4cCI6MjA4NjAzODY0NH0.evPHM1GdBOufR2v2KYARiG8r81McUtUAPNVovn6P6-s"
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
