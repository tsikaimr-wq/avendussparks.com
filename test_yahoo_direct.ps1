$SYMBOL = "RELIANCE.NS"
$url = "https://query1.finance.yahoo.com/v8/finance/chart/$SYMBOL"
Write-Host "Fetching from Yahoo: $url"

try {
    $res = Invoke-RestMethod -Uri $url
    $price = $res.chart.result[0].meta.regularMarketPrice
    $currency = $res.chart.result[0].meta.currency
    
    if ($null -eq $price) {
        Write-Host "FAILURE: Price not found in response." -ForegroundColor Red
    }
    else {
        Write-Host "SUCCESS: Price found!" -ForegroundColor Green
        Write-Host "Price: $price $currency"
        
        $output = @{
            price     = $price
            source    = "yahoo"
            isDelayed = $false
        }
        Write-Host "`nResponse Format Check:"
        $output | ConvertTo-Json
    }
}
catch {
    Write-Host "FAILURE: API call failed. Error: $_" -ForegroundColor Red
}
