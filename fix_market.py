import os

file_path = r'c:\Users\Administrator\Downloads\AvendusCapital-main\market.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the duplicate center-col and layout mess
# Look for the junk block and remove it
import re

# Junk starts after the first sector-grid closes and center-col closes
# Find the first occurrence of Specialty Retail and its following tags
pattern = re.compile(r'<div class="sector-name">Specialty Retail</div>\s*<div class="sector-pct up" id="sect-6">\+3\.07%</div>\s*</div>\s*</div>\s*</section>\s*</div>\s*<span class="info-label">Symbol:</span>.*?<div class="news-section"', re.DOTALL)

def fix_layout(match):
    # We want to keep up to </div> (closing center-col) and then continue with whatever comes after the junk
    # Actually, let's just replace the whole mess with a clean version of the sidebar and main content
    return '<div class="sector-name">Specialty Retail</div>\s*<div class="sector-pct up" id="sect-6">+3.07%</div>\s*</div>\s*</div>\s*</section>\s*</div>'

# This is getting complex. Let's just do a simple replacement of the junk block.
junk_block = """                <span class="info-label">Symbol:</span>
                <span class="info-val-text" id="valSymbol">SENSEX</span>
        </div>
        <div class="info-item">
            <span class="info-label">Market:</span>
            <span class="info-val-text">ININ</span>
        </div>
        <div class="info-item">
            <span class="info-label">High:</span>
            <span class="info-val-text" id="gridHigh">83,784.17</span>
        </div>
        <div class="info-item">
            <span class="info-label">Low:</span>
            <span class="info-val-text" id="gridLow">83,250.27</span>
        </div>
        <div class="info-item">
            <span class="info-label">Prev Open:</span>
            <span class="info-val-text" id="gridOpen">83,757.54</span>
        </div>
        <div class="info-item">
            <span class="info-label">Prev Close:</span>
            <span class="info-val-text" id="gridClose">83,817.69</span>
        </div>
        <div class="info-item" style="grid-column: span 3;">
            <div
                style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.5rem; margin-top: 1rem;">
                <span style="color: #10b981;"><i data-lucide="arrow-up" size="14"></i> <span id="valAdvances">18</span>
                    Advances</span>
                <span style="color: #ef4444;"><span id="valDeclines">4</span> Declines <i data-lucide="arrow-down"
                        size="14"></i></span>
            </div>
            <div class="advances-bar"
                style="display: flex; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
                <div id="barAdvances" class="adv-green"
                    style="background: #10b981; transition: flex 0.5s ease; flex: 18;">
                </div>
                <div id="barDeclines" class="adv-red" style="background: #ef4444; transition: flex 0.5s ease; flex: 4;">
                </div>
            </div>
        </div>
        <div class="info-item" style="grid-column: span 3;">
            <span class="info-label">Volume:</span>
            <span class="info-val-text" id="valVol">14,913,178</span>
        </div>
    </div>
    </div>

    <div class="timeframe-btns">
        <button class="tf-btn" onclick="changeInterval('1', this)">1m</button>
        <button class="tf-btn" onclick="changeInterval('30', this)">30m</button>
        <button class="tf-btn" onclick="changeInterval('60', this)">1h</button>
        <button class="tf-btn active" onclick="changeInterval('D', this)">1D</button>
        <button class="tf-btn" onclick="changeInterval('W', this)">1W</button>
        <button class="tf-btn" onclick="changeInterval('M', this)">1M</button>
    </div>

    <div class="chart-container-realtime">
        <div id="tradingview_widget" style="height:100%; width:100%;"></div>
    </div>
    <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
    <script type="text/javascript">
        let currentWidget = null;
        let currentActiveSymbol = 'BSE:SENSEX';
        let currentInterval = '1';

        const indexData = {
            'BSE:SENSEX': {
                price: 83580.40,
                basePrice: 83313.93,
                low: 83250.27,
                high: 83784.17,
                open: 83757.54,
                close: 83817.69,
                vol: "14,913,178",
                sym: "SENSEX",
                cardValId: 'valSensexCard',
                cardChgId: 'chgSensexCard',
                sparkId: 'sparkSensex',
                history: [35, 38, 30, 32, 25, 28, 20, 22, 15, 18, 20]
            },
            'NSE:NIFTY': {
                price: 25641.65,
                basePrice: 25776.00,
                low: 25600.00,
                high: 25800.00,
                open: 25750.00,
                close: 25776.00,
                vol: "22,450,112",
                sym: "NIFTY 50",
                cardValId: 'valNiftyCard',
                cardChgId: 'chgNiftyCard',
                sparkId: 'sparkNifty',
                history: [30, 32, 35, 38, 36, 40, 38, 42, 40, 45, 42]
            },
            'NSE:BANKNIFTY': {
                price: 60045.35,
                basePrice: 60238.15,
                low: 59500.00,
                high: 60500.00,
                open: 60200.00,
                close: 60238.15,
                vol: "8,124,556",
                sym: "NIFTY BANK",
                cardValId: 'valBankNiftyCard',
                cardChgId: 'chgBankNiftyCard',
                sparkId: 'sparkBankNifty',
                history: [20, 22, 25, 22, 28, 25, 30, 28, 35, 32, 38]
            }
        };

        function loadWidget(symbol) {
            currentWidget = new TradingView.widget({
                "autosize": true,
                "symbol": symbol,
                "interval": currentInterval,
                "timezone": "Etc/UTC",
                "theme": "light",
                "style": "1",
                "locale": "en",
                "toolbar_bg": "#f1f3f6",
                "enable_publishing": false,
                "hide_side_toolbar": false,
                "allow_symbol_change": true,
                "container_id": "tradingview_widget"
            });
        }

        function updateChart(symbol, title) {
            currentActiveSymbol = symbol;
            if (title) document.getElementById('chartTitle').innerText = title;
            loadWidget(symbol);
            syncUI();
        }

        function changeInterval(interval, btn) {
            currentInterval = interval;
            document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadWidget(currentActiveSymbol);
        }

        function syncUI() {
            const sym = currentActiveSymbol;
            const d = indexData[sym];
            if (!d) return;

            const diff = d.price - d.basePrice;
            const pct = (diff / d.basePrice) * 100;
            const sign = diff >= 0 ? '+' : '';
            const colorClass = diff >= 0 ? 'green' : 'red';

            const priceEl = document.getElementById('indexPrice');
            const changeEl = document.getElementById('heroChange');

            if (priceEl) priceEl.innerText = d.price.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            if (changeEl) {
                changeEl.innerText = `${sign}${diff.toFixed(2)} (${sign}${pct.toFixed(2)}%)`;
                changeEl.className = `index-chg ${colorClass}`;
            }

            // Update info grid
            const symEl = document.getElementById('valSymbol');
            const highEl = document.getElementById('gridHigh');
            const lowEl = document.getElementById('gridLow');
            const openEl = document.getElementById('gridOpen');
            const closeEl = document.getElementById('gridClose');
            const volEl = document.getElementById('valVol');

            if (symEl) symEl.innerText = d.sym;
            if (highEl) highEl.innerText = d.high.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            if (lowEl) lowEl.innerText = d.low.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            if (openEl) openEl.innerText = d.open.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            if (closeEl) closeEl.innerText = d.close.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            if (volEl) volEl.innerText = d.vol;

            // Update sparkles
            for (const s in indexData) {
                const sd = indexData[s];
                const cardVal = document.getElementById(sd.cardValId);
                const cardChg = document.getElementById(sd.cardChgId);
                if (cardVal) cardVal.innerText = sd.price.toLocaleString('en-IN', { minimumFractionDigits: 2 });
                if (cardChg) {
                    const sDiff = sd.price - sd.basePrice;
                    const sPct = (sDiff / sd.basePrice) * 100;
                    const sSign = sDiff >= 0 ? '+' : '';
                    cardChg.innerText = `${sSign}${sDiff.toFixed(2)} (${sSign}${sPct.toFixed(2)}%)`;
                    cardChg.className = `index-chg ${sDiff >= 0 ? 'green' : 'red'}`;
                }
            }

            // Sync Advances/Declines
            const safeAdv = Math.floor(Math.random() * 10) + 10;
            const safeDec = 30 - safeAdv;
            const advancesEl = document.getElementById('valAdvances');
            const declinesEl = document.getElementById('valDeclines');
            const barAdv = document.getElementById('barAdvances');
            const barDec = document.getElementById('barDeclines');

            if (advancesEl) advancesEl.innerText = safeAdv;
            if (declinesEl) declinesEl.innerText = safeDec;
            if (barAdv) barAdv.style.flex = safeAdv;
            if (barDec) barDec.style.flex = safeDec;
        }

        function startSimulation() {
            setInterval(() => {
                for (const sym in indexData) {
                    const d = indexData[sym];
                    const oldPrice = d.price;
                    const change = (Math.random() - 0.5) * (d.price * 0.0006);
                    d.price += change;

                    // Keep within day range
                    if (d.price < d.low) d.price = d.low + Math.abs(change);
                    if (d.price > d.high) d.price = d.high - Math.abs(change);

                    // Update Sparkline History (Simulated)
                    // Every 3 seconds, shift history
                    if (Date.now() % 3000 < 1000) {
                        const lastVal = d.history[d.history.length - 1];
                        const nextVal = Math.max(5, Math.min(35, lastVal + (Math.random() - 0.5) * 5));
                        d.history.shift();
                        d.history.push(nextVal);
                    }
                }

                // Fluatuate Sectors too
                for (let i = 1; i <= 9; i++) {
                    const sectEl = document.getElementById(`sect-${i}`);
                    if (sectEl) {
                        let curVal = parseFloat(sectEl.innerText);
                        let newVal = curVal + (Math.random() - 0.5) * 0.05;
                        sectEl.innerText = (newVal > 0 ? '+' : '') + newVal.toFixed(2) + '%';
                        sectEl.className = `sector-pct ${newVal >= 0 ? 'up' : 'down'}`;
                    }
                }

                syncUI();
            }, 1000);
        }

        updateChart("BSE:SENSEX", "SENSEX (BSE Index Live)");
        startSimulation();
    </script>
    </div>
    </section>"""

if junk_block in content:
    content = content.replace(junk_block, "")
    print("Found and removed junk block!")
else:
    print("Junk block not found exactly. Trying partial match...")
    if '<span class="info-label">Symbol:</span>' in content:
        print("Found partial match (Symbol label). Removal might be riskier.")
        # We'll use regex for a safer removal of the block between the two center-cols
        content = re.sub(r'<span class="info-label">Symbol:</span>.*?startSimulation\(\);.*?<\/script>\s*<\/div>\s*<\/section>', '', content, flags=re.DOTALL)
        print("Applied regex removal.")

# Fix Customer Service Modal
cs_junk = """    <!-- Customer Service Modal -->
    <div id="csModal" class="cs-modal" onclick="if(event.target == this) closeCS()">
        <div class="cs-content">
            <button class="cs-close" onclick="closeCS()"><i data-lucide="x" size="24"></i></button>
            <div class="cs-header">
                <h2>Customer Service</h2>
            </div>
            <div class="cs-body" id="csBody">
                <!-- Messages will appear here -->
            </div>
            <div class="cs-footer">
                <input type="text" id="csInput" class="cs-input" placeholder="Type a message..."
                    onkeypress="if(event.key === 'Enter') sendCSMessage()">
                <button class="cs-send-btn" onclick="sendCSMessage()">Send</button>
            </div>
        </div>
    </div>"""

cs_premium = """    <!-- Customer Service Modal -->
    <div id="csModal" class="cs-modal" onclick="if(event.target == this) closeCS()">
        <div class="cs-content">
            <div class="cs-header">
                <div class="cs-header-avatar">
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Support" alt="Support">
                </div>
                <div class="cs-header-info">
                    <div class="cs-header-title">VSL Customer Service</div>
                    <div class="cs-header-hours">Service Hours: 8:30 AM - 10:00 PM</div>
                </div>
                <button class="cs-close" onclick="closeCS()">
                    <i data-lucide="x" size="24"></i>
                </button>
            </div>
            <div class="cs-body" id="csBody"></div>
            <div class="cs-footer">
                <div id="csEmojiPicker" class="cs-emoji-picker">
                    <button class="cs-emoji-btn" onclick="addEmoji('😊')">😊</button>
                    <button class="cs-emoji-btn" onclick="addEmoji('😂')">😂</button>
                    <button class="cs-emoji-btn" onclick="addEmoji('🤣')">🤣</button>
                    <button class="cs-emoji-btn" onclick="addEmoji('❤️')">❤️</button>
                    <button class="cs-emoji-btn" onclick="addEmoji('👍')">👍</button>
                    <button class="cs-emoji-btn" onclick="addEmoji('🙏')">🙏</button>
                    <button class="cs-emoji-btn" onclick="addEmoji('🔥')">🔥</button>
                    <button class="cs-emoji-btn" onclick="addEmoji('🚀')">🚀</button>
                </div>
                <div id="csAttachmentPreview" class="cs-attachment-preview">
                    <img id="csPreviewImg" src="" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; display: none;">
                    <span id="csFileName" style="font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                    <i data-lucide="x" style="cursor: pointer;" onclick="clearAttachment()" size="16"></i>
                </div>
                <div class="cs-input-area">
                    <input type="file" id="csFileInput" style="display:none;" onchange="handleCSFile(this)">
                    <div class="cs-input-row">
                        <input type="text" id="csInput" class="cs-input" placeholder="Type a message..."
                            onkeypress="if(event.key === 'Enter') sendCSMessage()">
                    </div>
                    <div class="cs-actions">
                        <div class="cs-tools">
                            <button class="cs-tool-btn" onclick="csTool('emoji')" title="Emoji">
                                <i data-lucide="smile" size="20"></i>
                            </button>
                            <button class="cs-tool-btn" onclick="csTool('image')" title="Send Image">
                                <i data-lucide="camera" size="20"></i>
                            </button>
                            <button class="cs-tool-btn" onclick="csTool('file')" title="Send File">
                                <i data-lucide="paperclip" size="20"></i>
                            </button>
                        </div>
                        <button class="cs-send-btn" onclick="sendCSMessage()">
                            <i data-lucide="send" size="18"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="cs-floating-tab" onclick="openCS()">
        <span class="cs-floating-text">Contact us</span>
        <div class="cs-floating-icon">
            <i data-lucide="messages-square" size="16"></i>
        </div>
    </div>"""

if cs_junk in content:
    content = content.replace(cs_junk, cs_premium)
    print("Found and replaced Customer Service Modal!")
else:
    # Try with alternate whitespace/newlines
    print("CS Junk not found exactly. Trying regex...")
    content = re.sub(r'<!-- Customer Service Modal -->.*?<div id="csModal".*?<\/div>\s*<\/div>\s*<\/div>', cs_premium, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("File updated successfully.")
