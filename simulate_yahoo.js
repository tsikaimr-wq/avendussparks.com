const https = require('https');

async function fetchYahoo(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    console.log(`Fetching from Yahoo: ${url}`);

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
                    if (price === undefined || price === null) {
                        reject(new Error(`Invalid price data for ${symbol}`));
                    } else {
                        resolve(price);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function runLocalSimulation() {
    const SYMBOL = "RELIANCE.NS";
    try {
        const price = await fetchYahoo(SYMBOL);
        console.log(`\nSUCCESS: Fetched price for ${SYMBOL}`);
        console.log(`Price: ${price}`);
        console.log(`Format Check: { price: ${price}, source: 'yahoo', isDelayed: false }`);
    } catch (e) {
        console.error(`FAILURE: ${e.message}`);
    }
}

runLocalSimulation();
