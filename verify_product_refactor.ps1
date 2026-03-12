# Verification script for Admin Product Form refactor
$SUPABASE_URL = 'https://gipxccfydceahzmqdoks.supabase.co'
$SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpcHhjY2Z5ZGNlYWh6bXFkb2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjI2NDQsImV4cCI6MjA4NjAzODY0NH0.evPHM1GdBOufR2v2KYARiG8r81McUtUAPNVovn6P6-s'

$testProduct = @{
    name               = "Test Market Product"
    market_symbol      = "RELIANCE.NS"
    price              = 2500.50
    subscription_price = 2500.50
    status             = "Active"
    product_type       = "IPO"
}

Write-Host "--- Verifying market_symbol persistence ---"
$header = @{ 'apikey' = $SUPABASE_KEY; 'Authorization' = "Bearer $SUPABASE_KEY"; 'Content-Type' = 'application/json'; 'Prefer' = 'return=representation' }
$body = $testProduct | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/products" -Method Post -Headers $header -Body $body
    Write-Host "Success: Product saved with market_symbol: $($response[0].market_symbol)"
    
    # Cleanup
    $id = $response[0].id
    Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/products?id=eq.$id" -Method Delete -Headers $header
    Write-Host "Cleanup: Test product deleted."
}
catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Message -match "404") {
        Write-Host "Warning: Column 'market_symbol' might not exist yet. Please run the SQL migration."
    }
}
