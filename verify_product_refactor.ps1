# Verification script for Admin Product Form refactor
$SUPABASE_URL = 'https://xizuwvmepfcfodwfwqce.supabase.co'
$SUPABASE_KEY = 'sb_publishable_gj30etPyQjlvfH062VUeSw_F83Eii85'

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
