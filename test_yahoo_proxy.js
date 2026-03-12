
const fetch = require('node-fetch');

async function testYahoo() {
    const symbols = ['ICICIBANK.NS', 'ICICIBANK.BO', 'ICICIBANK'];
    const configs = [
        { range: '1d', interval: '5m' },
        { range: '5d', interval: '15m' },
        { range: '1mo', interval: '1d' }
    ];
    const proxyUrl = 'https://api.allorigins.win/get?url=';

    for (const sym of symbols) {
        console.log(`\nTesting symbol: ${sym}`);
        for (const config of configs) {
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${config.interval}&range=${config.range}`;
            try {
                process.stdout.write(`  Trying ${config.range}/${config.interval}... `);
                const response = await fetch(proxyUrl + encodeURIComponent(yahooUrl));
                const proxyData = await response.json();
                if (!proxyData || !proxyData.contents) {
                    console.log("Empty proxy response");
                    continue;
                }
                const data = JSON.parse(proxyData.contents);
                if (data.chart && data.chart.result && data.chart.result[0].timestamp) {
                    console.log(`SUCCESS! Found ${data.chart.result[0].timestamp.length} points.`);
                } else if (data.chart && data.chart.error) {
                    console.log(`FAILED: ${data.chart.error.description}`);
                } else {
                    console.log("FAILED: Unknown response format");
                }
            } catch (e) {
                console.log(`ERROR: ${e.message}`);
            }
        }
    }
}

testYahoo();
