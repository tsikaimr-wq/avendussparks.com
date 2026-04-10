const API_BASE = 'https://api.stocktv.top';
const INFOWAY_BASE = 'https://data.infoway.io';
const YAHOO_BASES = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const BROWSER_LIKE_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://finance.yahoo.com/',
  'X-Requested-With': 'XMLHttpRequest',
};

const STOCK_SYMBOL_ALIAS = {
  RELIANCE: 'RELI',
  RELIANCENS: 'RELI',
  ONE97COMMUNICATIONS: 'PAYTM',
  PAYTM: 'PAYTM',
  PAYTMNS: 'PAYTM',
  FSNECOMMERCEVENTURES: 'NYKAA',
  NYKAA: 'NYKAA',
  NYKAANS: 'NYKAA',
  KCEIL: 'KAYR',
  KCEILNS: 'KAYR',
  KCEILBO: 'KAYR',
  ALPABO: '532878',
};

const YAHOO_SYMBOL_ALIAS = {
  ALPABO: ['532878.BO', 'ALPA.BO', 'ALPA'],
  KCEIL: ['KCEIL-SM.NS', 'KCEIL-SM'],
  KCEILNS: ['KCEIL-SM.NS', 'KCEIL-SM'],
  KCEILBO: ['KCEIL-SM.NS', 'KCEIL-SM'],
  KAYCEEENERGYINFRAL: ['KCEIL-SM.NS', 'KCEIL-SM'],
  KAYCEEENERGYINFRALIMITED: ['KCEIL-SM.NS', 'KCEIL-SM'],
  ZOMATO: ['ETERNAL.NS', 'ETERNAL.BO', 'ETERNAL'],
  ZOMATONS: ['ETERNAL.NS', 'ETERNAL.BO', 'ETERNAL'],
  ZOMATOBO: ['ETERNAL.NS', 'ETERNAL.BO', 'ETERNAL'],
  ZOMATOLIMITED: ['ETERNAL.NS', 'ETERNAL.BO', 'ETERNAL'],
  ETERNAL: ['ETERNAL.NS', 'ETERNAL.BO', 'ETERNAL'],
  ETERNALNS: ['ETERNAL.NS', 'ETERNAL.BO', 'ETERNAL'],
  ETERNALBO: ['ETERNAL.NS', 'ETERNAL.BO', 'ETERNAL'],
  ETERNALLIMITED: ['ETERNAL.NS', 'ETERNAL.BO', 'ETERNAL'],
  NSEP: ['NSEP'],
  INNOVATORGROWTH100POWERBUFFER: ['NSEP'],
  INNOVATORGROWTH100POWERBUFFERETF: ['NSEP'],
};

const YAHOO_SEARCH_ALIAS_QUOTES = {
  KCEIL: [{ symbol: 'KCEIL-SM.NS', longname: 'KAY CEE ENERGY & INFRA L', exchDisp: 'NSE', quoteType: 'EQUITY', score: 250000 }],
  KCEILNS: [{ symbol: 'KCEIL-SM.NS', longname: 'KAY CEE ENERGY & INFRA L', exchDisp: 'NSE', quoteType: 'EQUITY', score: 250000 }],
  ZOMATO: [{ symbol: 'ETERNAL.NS', longname: 'Eternal Limited', exchDisp: 'NSE', quoteType: 'EQUITY', score: 250000 }],
  ZOMATONS: [{ symbol: 'ETERNAL.NS', longname: 'Eternal Limited', exchDisp: 'NSE', quoteType: 'EQUITY', score: 250000 }],
  ZOMATOLIMITED: [{ symbol: 'ETERNAL.NS', longname: 'Eternal Limited', exchDisp: 'NSE', quoteType: 'EQUITY', score: 250000 }],
  NSEP: [{ symbol: 'NSEP', longname: 'Innovator Growth-100 Power Buffer ETF', exchDisp: 'NYSE ARCA', quoteType: 'ETF', score: 250000 }],
  INNOVATORGROWTH100POWERBUFFER: [{ symbol: 'NSEP', longname: 'Innovator Growth-100 Power Buffer ETF', exchDisp: 'NYSE ARCA', quoteType: 'ETF', score: 250000 }],
  INNOVATORGROWTH100POWERBUFFERETF: [{ symbol: 'NSEP', longname: 'Innovator Growth-100 Power Buffer ETF', exchDisp: 'NYSE ARCA', quoteType: 'ETF', score: 250000 }],
};

const INDIA_SEARCH_FALLBACKS = [
  ['RELIANCE.NS', 'Reliance Industries Limited'],
  ['TCS.NS', 'Tata Consultancy Services Limited'],
  ['INFY.NS', 'Infosys Limited'],
  ['HDFCBANK.NS', 'HDFC Bank Limited'],
  ['ICICIBANK.NS', 'ICICI Bank Limited'],
  ['SBIN.NS', 'State Bank of India'],
  ['BHARTIARTL.NS', 'Bharti Airtel Limited'],
  ['LT.NS', 'Larsen & Toubro Limited'],
  ['ITC.NS', 'ITC Limited'],
  ['HINDUNILVR.NS', 'Hindustan Unilever Limited'],
  ['KOTAKBANK.NS', 'Kotak Mahindra Bank Limited'],
  ['AXISBANK.NS', 'Axis Bank Limited'],
  ['MARUTI.NS', 'Maruti Suzuki India Limited'],
  ['BAJFINANCE.NS', 'Bajaj Finance Limited'],
  ['BAJAJFINSV.NS', 'Bajaj Finserv Limited'],
  ['ASIANPAINT.NS', 'Asian Paints Limited'],
  ['SUNPHARMA.NS', 'Sun Pharmaceutical Industries Limited'],
  ['HCLTECH.NS', 'HCL Technologies Limited'],
  ['WIPRO.NS', 'Wipro Limited'],
  ['ULTRACEMCO.NS', 'UltraTech Cement Limited'],
  ['M&M.NS', 'Mahindra & Mahindra Limited'],
  ['TATAMOTORS.NS', 'Tata Motors Limited'],
  ['TATASTEEL.NS', 'Tata Steel Limited'],
  ['TATAPOWER.NS', 'Tata Power Company Limited'],
  ['TATACONSUM.NS', 'Tata Consumer Products Limited'],
  ['TITAN.NS', 'Titan Company Limited'],
  ['POWERGRID.NS', 'Power Grid Corporation of India Limited'],
  ['NTPC.NS', 'NTPC Limited'],
  ['ONGC.NS', 'Oil & Natural Gas Corporation Limited'],
  ['COALINDIA.NS', 'Coal India Limited'],
  ['JSWSTEEL.NS', 'JSW Steel Limited'],
  ['TECHM.NS', 'Tech Mahindra Limited'],
  ['ADANIENT.NS', 'Adani Enterprises Limited'],
  ['ADANIPORTS.NS', 'Adani Ports and Special Economic Zone Limited'],
  ['INDUSINDBK.NS', 'IndusInd Bank Limited'],
  ['NESTLEIND.NS', 'Nestle India Limited'],
  ['DRREDDY.NS', 'Dr. Reddys Laboratories Limited'],
  ['CIPLA.NS', 'Cipla Limited'],
  ['DIVISLAB.NS', 'Divis Laboratories Limited'],
  ['EICHERMOT.NS', 'Eicher Motors Limited'],
  ['HEROMOTOCO.NS', 'Hero MotoCorp Limited'],
  ['GRASIM.NS', 'Grasim Industries Limited'],
  ['SHRIRAMFIN.NS', 'Shriram Finance Limited'],
  ['HDFCLIFE.NS', 'HDFC Life Insurance Company Limited'],
  ['SBILIFE.NS', 'SBI Life Insurance Company Limited'],
  ['BRITANNIA.NS', 'Britannia Industries Limited'],
  ['APOLLOHOSP.NS', 'Apollo Hospitals Enterprise Limited'],
  ['BEL.NS', 'Bharat Electronics Limited'],
  ['HAL.NS', 'Hindustan Aeronautics Limited'],
  ['ZOMATO.NS', 'Eternal Limited'],
  ['NYKAA.NS', 'FSN E-Commerce Ventures Limited'],
  ['PAYTM.NS', 'One 97 Communications Limited'],
].map(([symbol, name], index) => ({
  symbol,
  name,
  exch: 'NSE',
  type: 'stock',
  score: 180000 - index,
}));

const INDEX_ALIAS_GROUPS = {
  '^BSESN': ['^BSESN', 'BSESN', 'SENSEX', 'BSE:SENSEX', 'BSE SENSEX'],
  '^NSEI': ['^NSEI', 'NSEI', 'NIFTY', 'NIFTY50', 'NIFTY 50', 'NSE:NIFTY'],
  '^NSEBANK': ['^NSEBANK', 'NSEBANK', 'NIFTYBANK', 'BANKNIFTY', 'NSE:NIFTYBANK', 'NSE:BANKNIFTY'],
  '^NSESMCP100': ['^NSESMCP100', 'NSESMCP100', 'NIFSMCP100', 'NIFTY SMALLCAP 100', 'NSE:NIFSMCP100'],
  '^NSEMDCP100': ['^NSEMDCP100', 'NSEMDCP100', 'NIFMDCP100', 'NIFTY MIDCAP 100', 'NSE:NIFMDCP100'],
  '^INDIAVIX': ['^INDIAVIX', 'INDIAVIX', 'INDIA VIX', 'VIX', 'NSE:INDIAVIX'],
};

const INDEX_FALLBACK_QUOTES = {
  '^BSESN': { name: 'BSE SENSEX', price: 83710.26, previousClose: 83313.93 },
  '^NSEI': { name: 'NSE NIFTY 50', price: 25619.54, previousClose: 25775.99 },
  '^NSEBANK': { name: 'NSE NIFTY BANK', price: 60120.55, previousClose: 60683.55 },
  '^NSESMCP100': { name: 'NIFTY SMALLCAP 100', price: 16938.65, previousClose: 16984.18 },
  '^NSEMDCP100': { name: 'NIFTY MIDCAP 100', price: 59502.70, previousClose: 59646.70 },
  '^INDIAVIX': { name: 'INDIA VIX', price: 15.1, previousClose: 13.64 },
};

const NSE_INDEX_NAMES = {
  '^NSEI': 'NIFTY 50',
  '^NSEBANK': 'NIFTY BANK',
  '^NSESMCP100': 'NIFTY SMALLCAP 100',
  '^NSEMDCP100': 'NIFTY MIDCAP 100',
  '^INDIAVIX': 'INDIA VIX',
};

const buildIndexLookup = () => {
  const lookup = {};
  for (const [yahooSymbol, aliases] of Object.entries(INDEX_ALIAS_GROUPS)) {
    for (const alias of aliases) {
      const key = normalizeMatch(alias);
      if (key) lookup[key] = yahooSymbol;
    }
  }
  return lookup;
};

const INDEX_ALIAS_LOOKUP = buildIndexLookup();
const LAST_GOOD_INDEX_QUOTES = new Map();
const LAST_GOOD_INDEX_TTL_MS = 12 * 60 * 60 * 1000;
const INFOWAY_CACHE = new Map();
const INFOWAY_MIN_INTERVAL_MS = 1100;
let infowayNextRequestAt = 0;

const withTimeout = async (url, init = undefined, timeoutMs = 4500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...(init || {}), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getCachedValue = (cache, key, ttlMs, allowStale = false) => {
  const entry = cache.get(key);
  if (!entry) return null;
  const expired = ttlMs > 0 && (Date.now() - entry.ts) > ttlMs;
  if (expired && !allowStale) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const setCachedValue = (cache, key, value) => {
  if (!key || value == null) return value;
  cache.set(key, { ts: Date.now(), value });
  return value;
};

const waitForInfowaySlot = async () => {
  const waitMs = infowayNextRequestAt - Date.now();
  if (waitMs > 0) await sleep(waitMs);
  infowayNextRequestAt = Date.now() + INFOWAY_MIN_INTERVAL_MS;
};

const json = async (url, init = undefined, retries = 1) => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await withTimeout(url, init);
      const payloadText = await res.text();
      try {
        return JSON.parse(payloadText);
      } catch (_) {}
    } catch (_) {}
  }
  return null;
};

const textResponse = async (url, init = undefined, retries = 1) => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await withTimeout(url, init);
      if (!res.ok) continue;
      const payloadText = await res.text();
      if (payloadText) return payloadText;
    } catch (_) {}
  }
  return null;
};

const pick = (obj, keys) => {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return null;
};

const toNum = (v) => {
  const normalized = typeof v === 'string' ? v.replace(/,/g, '').trim() : v;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const toPercentNum = (value) => {
  if (typeof value === 'string') {
    return toNum(value.replace(/%/g, ''));
  }
  return toNum(value);
};

function normalizeMatch(v) {
  return String(v || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

const mapInterval = (raw) => {
  const v = String(raw || '').trim();
  if (!v) return 'P1D';
  if (v.startsWith('PT') || v.startsWith('P')) return v;
  const lower = v.toLowerCase();
  const table = {
    '1m': 'PT1M',
    '2m': 'PT2M',
    '3m': 'PT3M',
    '5m': 'PT5M',
    '15m': 'PT15M',
    '30m': 'PT30M',
    '45m': 'PT45M',
    '60m': 'PT1H',
    '1h': 'PT1H',
    '2h': 'PT2H',
    '4h': 'PT4H',
    '1d': 'P1D',
    '1w': 'P1W',
    '1mo': 'P1M',
    '1mth': 'P1M',
    '1month': 'P1M',
  };
  return table[lower] || 'P1D';
};

const mapYahooRange = (raw) => {
  const v = String(raw || '').trim().toLowerCase();
  const table = {
    '1d': '1d',
    '5d': '5d',
    '1w': '5d',
    '1mo': '1mo',
    '3mo': '3mo',
    '6mo': '6mo',
    '1y': '1y',
    '2y': '2y',
    '5y': '5y',
    '10y': '10y',
    ytd: 'ytd',
    max: 'max',
  };
  return table[v] || '1d';
};

const mapYahooInterval = (raw) => {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '5m';
  if (v.startsWith('pt') || v.startsWith('p')) {
    const isoTable = {
      pt1m: '1m',
      pt2m: '2m',
      pt5m: '5m',
      pt15m: '15m',
      pt30m: '30m',
      pt45m: '1h',
      pt1h: '1h',
      pt2h: '1h',
      pt4h: '1h',
      p1d: '1d',
      p1w: '1wk',
      p1m: '1mo',
    };
    return isoTable[v] || '5m';
  }
  const table = {
    '1m': '1m',
    '2m': '2m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '45m': '1h',
    '60m': '1h',
    '90m': '90m',
    '1h': '1h',
    '1d': '1d',
    '1w': '1wk',
    '1wk': '1wk',
    '1mo': '1mo',
    '3mo': '3mo',
  };
  return table[v] || '5m';
};

const normalizeSymbol = (s = '') =>
  String(s).toUpperCase().replace(/^NSE:|^BSE:/, '').replace(/\.(NS|BO)$/, '');

const normalizeTickerBase = (value = '') =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^(NSE|BSE|NASDAQ|NYSEARCA|NYSE|AMEX|ARCA):/, '')
    .replace(/\.(NS|BO|IN|US|NSE|BSE|NASDAQ|NYSEARCA|NYSE|AMEX|ARCA)$/, '')
    .replace(/[^A-Z0-9-]/g, '');

const listStocks = async (env, page = 1, pageSize = 500, { exchangeId, symbol } = {}) => {
  const url = new URL(`${API_BASE}/stock/stocks`);
  url.searchParams.set('countryId', env.STOCKTV_COUNTRY_ID || '14');
  if (exchangeId) url.searchParams.set('exchangeId', exchangeId);
  if (symbol) url.searchParams.set('symbol', symbol);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('key', env.STOCKTV_KEY);
  return json(url);
};

const queryStock = async (env, { id, symbol, name }) => {
  const url = new URL(`${API_BASE}/stock/queryStocks`);
  url.searchParams.set('key', env.STOCKTV_KEY);
  if (id) url.searchParams.set('id', String(id));
  if (symbol) url.searchParams.set('symbol', String(symbol));
  if (name) url.searchParams.set('name', String(name));
  return json(url);
};

const extractList = (payload) => {
  if (!payload) return [];
  return (
    payload.data?.records ||
    payload.data?.list ||
    payload.data?.rows ||
    payload.data ||
    payload.records ||
    payload.list ||
    payload.rows ||
    []
  );
};

const getError = (payload) => {
  if (!payload) return null;
  if (payload.success === false) return payload.message || 'upstream error';
  if (payload.code && payload.code !== 200) return payload.message || 'upstream error';
  if (payload.status === false) return payload.message || 'upstream error';
  return null;
};

const extractFirst = (payload) => {
  if (!payload) return null;
  if (Array.isArray(payload.data)) return payload.data[0] || null;
  if (Array.isArray(payload.data?.records)) return payload.data.records[0] || null;
  if (Array.isArray(payload.data?.list)) return payload.data.list[0] || null;
  if (Array.isArray(payload.records)) return payload.records[0] || null;
  if (Array.isArray(payload.list)) return payload.list[0] || null;
  if (payload.data && typeof payload.data === 'object') return payload.data;
  return null;
};

const getRowSymbolValues = (row) =>
  [row?.symbol, row?.code, row?.ticker, row?.stockCode, row?.shortCode].filter(Boolean);

const bestMatch = (rows, symbol, opts = {}) => {
  if (!rows || !rows.length) return null;
  if (!symbol) return rows[0] || null;
  const allowName = opts.allowName === true;
  const rawInput = String(symbol || '').trim().toUpperCase();
  const target = normalizeSymbol(symbol);
  const targetLoose = normalizeMatch(target);
  const aliasKey = normalizeMatch(rawInput) || targetLoose;
  const preferredTicker = STOCK_SYMBOL_ALIAS[aliasKey] || STOCK_SYMBOL_ALIAS[targetLoose] || null;
  const symbolValues = (x) => getRowSymbolValues(x).map((v) => normalizeSymbol(v));
  const looseSymbolValues = (x) => getRowSymbolValues(x).map((v) => normalizeMatch(v));
  const getNameLoose = (x) => normalizeMatch(x.name || '');

  if (preferredTicker) {
    const preferredSymbol = normalizeSymbol(preferredTicker);
    const preferredLoose = normalizeMatch(preferredSymbol);
    const aliasMatch = rows.find((x) =>
      symbolValues(x).includes(preferredSymbol) || looseSymbolValues(x).includes(preferredLoose)
    );
    if (aliasMatch) return aliasMatch;
  }

  let found = rows.find((x) => symbolValues(x).includes(target));
  if (found) return found;

  const looksLikeTicker = /^[A-Z0-9.:-]+$/.test(rawInput) && !/\s/.test(rawInput);
  found = rows.find((x) => looseSymbolValues(x).includes(targetLoose));
  if (found) return found;
  if (looksLikeTicker) {
    if (!allowName) return null;
  }

  found = rows.find((x) => getNameLoose(x) === targetLoose);
  if (found) return found;

  const scored = rows
    .map((x) => {
      const nameLoose = getNameLoose(x);
      if (!nameLoose) return { x, score: -Infinity };
      let score = -Infinity;
      if (nameLoose === targetLoose) score = 100;
      else if (nameLoose.startsWith(targetLoose)) score = 40;
      else if (nameLoose.includes(targetLoose)) score = 20;
      else if (targetLoose.includes(nameLoose)) score = 10;
      if (score > -Infinity) score -= Math.abs(nameLoose.length - targetLoose.length) / 10;
      return { x, score };
    })
    .filter((r) => Number.isFinite(r.score))
    .sort((a, b) => b.score - a.score);
  if (scored.length) return scored[0].x;
  return null;
};

const findByPid = (rows, pid) =>
  rows.find((x) => String(x.pid || x.id) === String(pid));

const findBySymbol = (rows, symbol) => {
  const target = normalizeSymbol(symbol);
  const targetLoose = normalizeMatch(target);
  return rows.find((x) => {
    const candidates = [
      x.symbol,
      x.code,
      x.ticker,
      x.stockCode,
      x.shortCode,
      x.name,
    ].map((v) => normalizeSymbol(v || ''));
    if (candidates.includes(target)) return true;
    const loose = [
      x.symbol,
      x.code,
      x.ticker,
      x.stockCode,
      x.shortCode,
      x.name,
    ].map((v) => normalizeMatch(v));
    return loose.includes(targetLoose);
  });
};

const resolveStock = async (env, { symbol, pid, name }) => {
  let lastError = null;
  if (pid) {
    const byId = await queryStock(env, { id: pid });
    const err = getError(byId);
    if (err) lastError = err;
    const item = extractFirst(byId);
    if (item) return item;
  }
  if (name) {
    const byName = await queryStock(env, { name });
    const errName = getError(byName);
    if (errName) lastError = errName;
    const listName = extractList(byName);
    const itemName = bestMatch(listName, name) || extractFirst(byName);
    if (itemName) return itemName;
  }
  if (symbol) {
    const normalized = normalizeSymbol(symbol);
    const inputUpper = String(symbol || '').trim().toUpperCase();
    const looksLikeTicker = /^[A-Z0-9.:-]+$/.test(inputUpper) && !/\s/.test(inputUpper);
    const allowName = !looksLikeTicker;
    const bySymbol = await queryStock(env, { symbol: normalized });
    const err = getError(bySymbol);
    if (err) lastError = err;
    const list = extractList(bySymbol);
    const item = bestMatch(list, symbol, { allowName });
    if (item) return item;

    const bySymbolRaw = await queryStock(env, { symbol });
    const errRaw = getError(bySymbolRaw);
    if (errRaw) lastError = errRaw;
    const listRaw = extractList(bySymbolRaw);
    const itemRaw = bestMatch(listRaw, symbol, { allowName });
    if (itemRaw) return itemRaw;

    const byName = await queryStock(env, { name: normalized });
    const errName = getError(byName);
    if (errName) lastError = errName;
    const listName = extractList(byName);
    const itemName = bestMatch(listName, symbol, { allowName });
    if (itemName) return itemName;

    const byNameRaw = await queryStock(env, { name: symbol });
    const errNameRaw = getError(byNameRaw);
    if (errNameRaw) lastError = errNameRaw;
    const listNameRaw = extractList(byNameRaw);
    const itemNameRaw = bestMatch(listNameRaw, symbol, { allowName });
    if (itemNameRaw) return itemNameRaw;
  }
  const maxPages = Number(env.STOCKTV_MAX_PAGES || 5);
  for (let page = 1; page <= maxPages; page += 1) {
    const list = await listStocks(env, page, 500, {
      exchangeId: env.STOCKTV_EXCHANGE_ID || '46',
      symbol: symbol ? normalizeSymbol(symbol) : undefined,
    });
    const listErr = getError(list);
    if (listErr) lastError = listErr;
    const rows = extractList(list);
    if (!rows.length) return null;
    const match = pid
      ? findByPid(rows, pid)
      : bestMatch(rows, symbol, { allowName: true }) || findBySymbol(rows, symbol);
    if (match) return match;
  }
  for (let page = 1; page <= maxPages; page += 1) {
    const list = await listStocks(env, page, 500, {
      exchangeId: undefined,
      symbol: symbol ? normalizeSymbol(symbol) : undefined,
    });
    const listErr = getError(list);
    if (listErr) lastError = listErr;
    const rows = extractList(list);
    if (!rows.length) return null;
    const match = pid
      ? findByPid(rows, pid)
      : bestMatch(rows, symbol, { allowName: true }) || findBySymbol(rows, symbol);
    if (match) return match;
  }
  return lastError ? { __error: lastError } : null;
};

const parseEmbeddedJson = (payloadText) => {
  if (!payloadText) return null;
  const start = payloadText.indexOf('{');
  const end = payloadText.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(payloadText.slice(start, end + 1));
  } catch (_) {
    return null;
  }
};

const resolveIndexYahooSymbol = ({ symbol, name }) => {
  const probes = [symbol, name, normalizeSymbol(symbol), normalizeSymbol(name)];
  for (const probe of probes) {
    const key = normalizeMatch(probe);
    if (key && INDEX_ALIAS_LOOKUP[key]) return INDEX_ALIAS_LOOKUP[key];
  }
  return null;
};

const addYahooCandidates = (set, raw) => {
  const push = (value) => {
    const v = String(value || '').trim().toUpperCase();
    if (!v) return;
    set.add(v);
  };

  const input = String(raw || '').trim().toUpperCase();
  if (!input) return;

  if (input.startsWith('^')) {
    push(input);
    return;
  }

  if (input.includes(':')) {
    const parts = input.split(':');
    const prefix = parts[0];
    const rhs = (parts.slice(1).join(':') || '').replace(/\.(NS|BO|NSE|BSE)$/i, '');
    if (!rhs) return;
    push(rhs);
    if (prefix === 'BSE') push(`${rhs}.BO`);
    else push(`${rhs}.NS`);
    return;
  }

  if (input.endsWith('.NS') || input.endsWith('.BO')) {
    push(input);
    push(input.slice(0, -3));
    return;
  }

  if (input.endsWith('.NSE')) {
    const ticker = input.slice(0, -4);
    push(ticker);
    push(`${ticker}.NS`);
    return;
  }

  if (input.endsWith('.BSE') || input.endsWith('.BOM')) {
    const ticker = input.split('.')[0];
    push(ticker);
    push(`${ticker}.BO`);
    return;
  }

  const normalized = normalizeSymbol(input);
  push(input);
  if (normalized && normalized !== input) push(normalized);
  if (/^[A-Z0-9-]+$/.test(normalized || input)) {
    const base = normalized || input;
    push(`${base}.NS`);
    push(`${base}.BO`);
  }
};

const addYahooAliasCandidates = (set, raw) => {
  const key = normalizeMatch(raw);
  if (!key) return;
  const aliases = YAHOO_SYMBOL_ALIAS[key];
  if (!Array.isArray(aliases) || !aliases.length) return;
  for (const alias of aliases) addYahooCandidates(set, alias);
};

const getYahooCandidates = ({ symbol, name, indexOnly = false }) => {
  const set = new Set();
  const indexSymbol = resolveIndexYahooSymbol({ symbol, name });
  if (indexSymbol) {
    set.add(indexSymbol);
    if (indexOnly) return [...set];
  }
  addYahooAliasCandidates(set, symbol);
  addYahooAliasCandidates(set, name);
  addYahooCandidates(set, symbol);
  addYahooCandidates(set, name);
  return [...set];
};

const buildYahooSearchQueries = (raw) => {
  const queries = new Set();
  const add = (value) => {
    const input = String(value || '').trim().toUpperCase();
    if (!input) return;
    queries.add(input);
    const normalized = normalizeSymbol(input);
    if (normalized && normalized !== input) queries.add(normalized);
    if (input.endsWith('.NS') || input.endsWith('.BO')) {
      queries.add(input.slice(0, -3));
    }
  };

  add(raw);
  const aliases = YAHOO_SYMBOL_ALIAS[normalizeMatch(raw)] || [];
  for (const alias of aliases) add(alias);

  return [...queries].map((value) => value.replace(/\.(NS|BO)$/i, ''));
};

const normalizeYahooExchange = (quote) => {
  const raw = String(quote?.exchDisp || quote?.exchange || '').trim();
  const upper = raw.toUpperCase();
  if (upper === 'NSI' || upper.includes('NSE')) return 'NSE';
  if (upper === 'BSE' || upper === 'BOM' || upper.includes('BOMBAY') || upper.includes('BSE')) return 'BSE';
  if (upper.includes('NYSE ARCA') || upper.includes('NYSEARCA') || upper === 'ARCA' || upper === 'PCX') return 'NYSE ARCA';
  if (upper.includes('NASDAQ')) return 'NASDAQ';
  if (upper.includes('NYSE')) return 'NYSE';
  if (upper.includes('AMEX')) return 'AMEX';
  if (upper.includes('CBOE') || upper.includes('BATS')) return 'CBOE';
  return raw;
};

const resolveRequestedExchange = ({ symbol, name } = {}) => {
  const probes = [symbol, name];
  for (const probe of probes) {
    const upper = String(probe || '').trim().toUpperCase();
    if (!upper) continue;
    if (upper.startsWith('BSE:') || upper.endsWith('.BO') || upper.endsWith('.BSE') || upper.endsWith('.BOM')) return 'BSE';
    if (upper.startsWith('NSE:') || upper.endsWith('.NS') || upper.endsWith('.NSE')) return 'NSE';
  }
  return null;
};

const resolveQuoteExchange = (quote = {}) => {
  const explicit = normalizeYahooExchange(quote);
  if (explicit === 'BSE' || explicit === 'NSE') return explicit;

  const symbolUpper = String(quote?.symbol || '').trim().toUpperCase();
  if (symbolUpper.startsWith('BSE:') || symbolUpper.endsWith('.BO') || symbolUpper.endsWith('.BSE') || symbolUpper.endsWith('.BOM')) return 'BSE';
  if (symbolUpper.startsWith('NSE:') || symbolUpper.endsWith('.NS') || symbolUpper.endsWith('.NSE')) return 'NSE';

  return null;
};

const quoteMatchesRequestedExchange = (requestedExchange, quote) => {
  if (!requestedExchange || !quote) return true;
  const resolvedExchange = resolveQuoteExchange(quote);
  if (!resolvedExchange) return true;
  return resolvedExchange === requestedExchange;
};

const looksLikeExplicitTicker = (value) => /^[A-Z0-9^.-]{1,24}$/.test(String(value || '').trim().toUpperCase());
const isExplicitIndiaMarketSymbol = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  if (!upper) return false;
  return upper.startsWith('NSE:') || upper.startsWith('BSE:') || upper.endsWith('.NS') || upper.endsWith('.BO');
};

const isExplicitUsMarketSymbol = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  if (!upper) return false;
  return (
    upper.startsWith('NASDAQ:') ||
    upper.startsWith('NYSE:') ||
    upper.startsWith('AMEX:') ||
    upper.startsWith('ARCA:') ||
    upper.startsWith('NYSEARCA:') ||
    upper.endsWith('.US')
  );
};

const INDIA_SYMBOL_LOOKUP = new Set(
  INDIA_SEARCH_FALLBACKS.flatMap((item) => [
    normalizeMatch(item.symbol),
    normalizeMatch(String(item.symbol || '').replace(/\.(NS|BO)$/i, '')),
    normalizeMatch(item.name),
  ])
);

const isLikelyIndiaSymbol = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  const key = normalizeMatch(upper);
  if (!key) return false;
  if (upper.endsWith('.IN') || isExplicitIndiaMarketSymbol(upper)) return true;
  if (INDIA_SYMBOL_LOOKUP.has(key)) return true;
  const aliases = YAHOO_SYMBOL_ALIAS[key] || [];
  return aliases.some((alias) => /\.NS$|\.BO$/i.test(String(alias || '')));
};

const pushUnique = (arr, value) => {
  if (!value || arr.includes(value)) return;
  arr.push(value);
};

const getInfowayCandidates = ({ symbol, name } = {}) => {
  const indiaCodes = [];
  const usCodes = [];
  const rawCandidates = [];
  const addRaw = (value) => {
    const raw = String(value || '').trim();
    if (!raw || rawCandidates.includes(raw)) return;
    rawCandidates.push(raw);
  };
  addRaw(symbol);
  addRaw(resolvePreferredYahooSymbol({ symbol, name }));
  addRaw(name);
  for (const probe of [symbol, name]) {
    const aliases = YAHOO_SYMBOL_ALIAS[normalizeMatch(probe)] || [];
    for (const alias of aliases) addRaw(alias);
  }

  for (const raw of rawCandidates) {
    const upper = String(raw || '').trim().toUpperCase();
    if (!upper || upper.startsWith('^')) continue;
    const explicit = looksLikeExplicitTicker(upper) || isExplicitIndiaMarketSymbol(upper) || isExplicitUsMarketSymbol(upper) || upper.endsWith('.IN');
    if (!explicit) continue;
    const base = normalizeTickerBase(upper);
    if (!base) continue;

    if (upper.endsWith('.IN') || isExplicitIndiaMarketSymbol(upper)) {
      pushUnique(indiaCodes, `${base}.IN`);
      continue;
    }
    if (isExplicitUsMarketSymbol(upper)) {
      pushUnique(usCodes, `${base}.US`);
      continue;
    }

    if (isLikelyIndiaSymbol(upper)) {
      pushUnique(indiaCodes, `${base}.IN`);
      pushUnique(usCodes, `${base}.US`);
    } else {
      pushUnique(usCodes, `${base}.US`);
      pushUnique(indiaCodes, `${base}.IN`);
    }
  }

  return { indiaCodes, usCodes };
};

const getInfowayAppSymbol = (code, info = null) => {
  const upper = String(code || '').trim().toUpperCase();
  const base = upper.replace(/\.(IN|US)$/i, '');
  if (upper.endsWith('.IN')) {
    const exchange = String(info?.exchange || '').trim().toUpperCase();
    return `${base}.${exchange === 'BSE' ? 'BO' : 'NS'}`;
  }
  return base;
};

const getInfowayExchangeLabel = (market, info = null) => {
  const exchange = String(info?.exchange || '').trim();
  if (exchange) return exchange;
  return market === 'IN' ? 'NSE' : 'US';
};

const mapInfowayKlineType = (raw) => {
  const value = String(raw || '').trim().toLowerCase();
  const table = {
    '1m': 1,
    '2m': 1,
    '3m': 1,
    '5m': 2,
    '15m': 3,
    '30m': 4,
    '45m': 5,
    '60m': 5,
    '1h': 5,
    '2h': 6,
    '4h': 7,
    '1d': 8,
    '5d': 8,
    '1w': 9,
    '1wk': 9,
    '1mo': 10,
    '3mo': 11,
    '1y': 12,
  };
  return table[value] || 8;
};

const estimateInfowayKlineNum = (period, intervalRaw) => {
  const range = String(period || '').trim().toLowerCase();
  const klineType = mapInfowayKlineType(intervalRaw);
  const intraday = klineType <= 7;
  if (intraday) {
    const table = {
      '1d': 80,
      '5d': 220,
      '1mo': 320,
      '3mo': 480,
      '6mo': 500,
      '1y': 500,
    };
    return Math.max(2, Math.min(500, table[range] || 120));
  }
  const table = {
    '1d': 2,
    '5d': 5,
    '1mo': 30,
    '3mo': 66,
    '6mo': 132,
    '1y': 260,
    '2y': 500,
    '5y': 500,
    '10y': 500,
    ytd: 260,
    max: 500,
  };
  return Math.max(2, Math.min(500, table[range] || 60));
};

const infowayErrorMessage = (payload) => {
  if (!payload) return null;
  if (payload.ret != null && Number(payload.ret) !== 200) return payload.msg || payload.message || 'upstream error';
  if (payload.code != null && Number(payload.code) !== 200) return payload.message || payload.msg || 'upstream error';
  return null;
};

const infowayJson = async (env, url, init = undefined, { cacheKey = '', ttlMs = 0 } = {}) => {
  if (!env.INFOWAY_API_KEY) return null;
  const fresh = cacheKey ? getCachedValue(INFOWAY_CACHE, cacheKey, ttlMs) : null;
  if (fresh) return fresh;

  await waitForInfowaySlot();
  let payload = null;
  let status = 0;
  try {
    const res = await withTimeout(url, {
      ...(init || {}),
      headers: {
        Accept: 'application/json, text/plain, */*',
        ...(init?.headers || {}),
        apiKey: env.INFOWAY_API_KEY,
      },
    }, 8000);
    status = Number(res?.status || 0);
    const payloadText = await res.text();
    payload = payloadText ? JSON.parse(payloadText) : null;
  } catch (_) {
    payload = null;
  }

  if (!payload || infowayErrorMessage(payload)) {
    if (status === 429 && cacheKey) {
      return getCachedValue(INFOWAY_CACHE, cacheKey, ttlMs, true);
    }
    return null;
  }

  if (cacheKey) setCachedValue(INFOWAY_CACHE, cacheKey, payload);
  return payload;
};

const sortInfowayRows = (rows) =>
  [...(Array.isArray(rows) ? rows : [])].sort((left, right) => Number(left?.t || 0) - Number(right?.t || 0));

const buildKlineFromInfowayRows = ({ market, code, rows, info = null }) => {
  const sorted = sortInfowayRows(rows);
  const data = sorted
    .map((row) => {
      const ts = Number(row?.t || 0);
      const c = toNum(row?.c);
      if (!Number.isFinite(ts) || c == null) return null;
      const o = toNum(row?.o) ?? c;
      const h = toNum(row?.h) ?? c;
      const l = toNum(row?.l) ?? c;
      return {
        t: new Date(ts * 1000).toISOString(),
        o,
        h,
        l,
        c,
        v: toNum(row?.v) ?? 0,
      };
    })
    .filter(Boolean);
  if (!data.length) return null;
  return {
    success: true,
    symbol: getInfowayAppSymbol(code, info),
    source: market === 'IN' ? 'infoway_india' : 'infoway_stock',
    data,
  };
};

const buildQuoteFromInfowayRows = ({ market, code, rows, info = null, fallbackName = '' }) => {
  const sorted = sortInfowayRows(rows);
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  const price = toNum(latest.c);
  if (price == null) return null;
  const previousRow = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  let change = toNum(latest.pca);
  let changePercent = toPercentNum(latest.pc);
  let previousClose = change != null
    ? price - change
    : (changePercent != null ? (price / (1 + (changePercent / 100))) : null);
  const previousRowClose = toNum(previousRow?.c);
  if (previousClose == null && previousRowClose != null) previousClose = previousRowClose;
  if (change == null && previousClose != null) change = price - previousClose;
  if (changePercent == null && previousClose) changePercent = (change / previousClose) * 100;
  return {
    success: true,
    symbol: getInfowayAppSymbol(code, info),
    pid: null,
    name: fallbackName || info?.name_en || info?.name || getInfowayAppSymbol(code, info),
    price,
    previousClose,
    change,
    changePercent,
    open: toNum(latest.o),
    high: toNum(latest.h),
    low: toNum(latest.l),
    exchange: getInfowayExchangeLabel(market, info),
    currency: info?.currency || (market === 'IN' ? 'INR' : 'USD'),
    source: market === 'IN' ? 'infoway_india' : 'infoway_stock',
  };
};

const adaptInfowayFundamentals = (market, row) => {
  if (!row) return null;
  return {
    success: true,
    symbol: getInfowayAppSymbol(row.symbol, row),
    source: market === 'IN' ? 'infoway_india' : 'infoway_stock',
    data: {
      summaryDetail: {
        dividendYield: toNum(row.dividend_yield),
        currency: row.currency || (market === 'IN' ? 'INR' : 'USD'),
      },
      defaultKeyStatistics: {
        sharesOutstanding: toNum(row.total_shares),
        floatShares: toNum(row.circulating_shares),
        trailingEps: toNum(row.eps_ttm ?? row.eps),
      },
      financialData: {
        currentPrice: toNum(row.price),
      },
      assetProfile: {
        sector: row.board || '',
      },
      price: {
        exchangeName: row.exchange || getInfowayExchangeLabel(market, row),
        currency: row.currency || (market === 'IN' ? 'INR' : 'USD'),
        longName: row.name_en || row.name || getInfowayAppSymbol(row.symbol, row),
        shortName: row.name_en || row.name || getInfowayAppSymbol(row.symbol, row),
      },
    },
  };
};

const fetchInfowaySymbolRows = async (env, market, codes, { detailed = false } = {}) => {
  const normalizedCodes = [...new Set((codes || []).filter(Boolean).map((code) => String(code).trim().toUpperCase()))];
  if (!normalizedCodes.length) return [];
  const type = market === 'IN' ? 'STOCK_IN' : 'STOCK_US';
  const endpoint = detailed ? '/common/basic/symbols/info' : '/common/basic/symbols';
  const url = new URL(`${INFOWAY_BASE}${endpoint}`);
  url.searchParams.set('type', type);
  url.searchParams.set('symbols', normalizedCodes.join(','));
  const cacheKey = `infoway:${detailed ? 'info' : 'symbols'}:${market}:${normalizedCodes.join(',')}`;
  const payload = await infowayJson(env, url, undefined, { cacheKey, ttlMs: detailed ? 6 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 });
  return Array.isArray(payload?.data) ? payload.data : [];
};

const fetchInfowayKlineByCode = async (env, market, code, { period = '1d', interval = '5m' } = {}) => {
  const endpoint = market === 'IN' ? '/india/v2/batch_kline' : '/stock/v2/batch_kline';
  const klineType = mapInfowayKlineType(interval);
  const body = JSON.stringify({
    klineType,
    klineNum: estimateInfowayKlineNum(period, interval),
    codes: String(code || '').trim().toUpperCase(),
  });
  const cacheTtlMs = klineType <= 7 ? 15 * 1000 : 5 * 60 * 1000;
  const cacheKey = `infoway:kline:${market}:${code}:${period}:${interval}`;
  const payload = await infowayJson(env, `${INFOWAY_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  }, { cacheKey, ttlMs: cacheTtlMs });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const target = rows.find((item) => normalizeMatch(item?.s) === normalizeMatch(code)) || rows[0];
  return Array.isArray(target?.respList) ? target.respList : [];
};

const fetchInfowayTradeByCode = async (env, market, code) => {
  const upperCode = String(code || '').trim().toUpperCase();
  if (!upperCode) return null;
  const endpoint = market === 'IN' ? `/india/batch_trade/${encodeURIComponent(upperCode)}` : `/stock/batch_trade/${encodeURIComponent(upperCode)}`;
  const cacheKey = `infoway:trade:${market}:${upperCode}`;
  const payload = await infowayJson(env, `${INFOWAY_BASE}${endpoint}`, undefined, {
    cacheKey,
    ttlMs: 8 * 1000,
  });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.find((item) => normalizeMatch(item?.s) === normalizeMatch(upperCode)) || rows[0] || null;
};

const fetchInfowayKline = async (env, { symbol, name, period = '1d', interval = '5m', withInfo = false } = {}) => {
  const { indiaCodes, usCodes } = getInfowayCandidates({ symbol, name });
  const marketPlans = [
    { market: 'IN', codes: indiaCodes },
    { market: 'US', codes: usCodes },
  ];
  for (const plan of marketPlans) {
    for (const code of plan.codes) {
      const rows = await fetchInfowayKlineByCode(env, plan.market, code, { period, interval });
      if (!rows.length) continue;
      let info = null;
      if (withInfo) {
        info = (await fetchInfowaySymbolRows(env, plan.market, [code], { detailed: true }))[0] || null;
      }
      return {
        market: plan.market,
        code,
        rows,
        info,
      };
    }
  }
  return null;
};

const fetchInfowayQuote = async (env, { symbol, name }) => {
  const { indiaCodes, usCodes } = getInfowayCandidates({ symbol, name });
  const plans = [
    { market: 'IN', codes: indiaCodes },
    { market: 'US', codes: usCodes },
  ];

  for (const plan of plans) {
    for (const code of plan.codes) {
      const trade = await fetchInfowayTradeByCode(env, plan.market, code);
      if (!trade) continue;

      const rows = [];
      const tradePrice = toNum(trade?.p);
      if (tradePrice != null) {
        rows.push({
          t: Math.floor((Number(trade?.t || Date.now())) / 1000),
          o: tradePrice,
          h: tradePrice,
          l: tradePrice,
          c: tradePrice,
          v: toNum(trade?.v) ?? 0,
        });
      }

      const dailyRows = await fetchInfowayKlineByCode(env, plan.market, code, { period: '5d', interval: '1d' });
      if (Array.isArray(dailyRows) && dailyRows.length) {
        rows.push(...dailyRows);
      }

      let info = null;
      if (!name || plan.market === 'IN') {
        info = (await fetchInfowaySymbolRows(env, plan.market, [code], { detailed: true }))[0] || null;
      }

      const quote = buildQuoteFromInfowayRows({
        market: plan.market,
        code,
        rows,
        info,
        fallbackName: name,
      });
      if (quote) return quote;
    }
  }

  return null;
};

const fetchInfowayFundamentals = async (env, { symbol, name }) => {
  const { indiaCodes, usCodes } = getInfowayCandidates({ symbol, name });
  const plans = [
    { market: 'IN', codes: indiaCodes },
    { market: 'US', codes: usCodes },
  ];
  for (const plan of plans) {
    if (!plan.codes.length) continue;
    const rows = await fetchInfowaySymbolRows(env, plan.market, plan.codes, { detailed: true });
    const found = rows.find((row) => plan.codes.some((code) => normalizeMatch(code) === normalizeMatch(row?.symbol)));
    if (found) return adaptInfowayFundamentals(plan.market, found);
  }
  return null;
};

const searchInfowayExact = async (env, query, limit = 20) => {
  if (!looksLikeExplicitTicker(query)) return [];
  const { indiaCodes, usCodes } = getInfowayCandidates({ symbol: query, name: query });
  const rows = [];
  const plans = [
    { market: 'IN', codes: indiaCodes },
    { market: 'US', codes: usCodes },
  ];
  for (const plan of plans) {
    if (!plan.codes.length) continue;
    const items = await fetchInfowaySymbolRows(env, plan.market, plan.codes, { detailed: false });
    for (const item of items) {
      const symbol = getInfowayAppSymbol(item.symbol, item);
      rows.push({
        symbol,
        name: item.name_en || item.name || symbol,
        exch: getInfowayExchangeLabel(plan.market, item),
        type: 'stock',
        score: 1150000,
      });
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
};

const buildSearchRowFromQuote = (quote, score = 900000) => ({
  symbol: String(quote?.symbol || '').trim().toUpperCase(),
  name: String(quote?.name || quote?.symbol || '').trim(),
  exch: normalizeYahooExchange({ exchDisp: quote?.exchange || quote?.exch || quote?.source || 'NSE' }) || 'NSE',
  type: 'stock',
  price: toNum(quote?.price),
  changePercent: toNum(quote?.changePercent),
  score,
});

const mergeSearchRows = (items, limit = 20) => {
  const seen = new Map();
  for (const item of (items || [])) {
    const symbol = String(item?.symbol || '').trim().toUpperCase();
    if (!symbol) continue;
    const exch = String(item?.exch || item?.exchange || '').trim().toUpperCase();
    const key = `${symbol}|${exch}`;
    const prev = seen.get(key);
    if (!prev || Number(item?.score || 0) > Number(prev?.score || 0)) {
      seen.set(key, item);
    }
  }
  return [...seen.values()]
    .sort((left, right) => Number(right?.score || 0) - Number(left?.score || 0))
    .slice(0, limit);
};

const searchIndiaCatalog = (query, limit = 20) => {
  const qRaw = String(query || '').trim();
  const q = normalizeMatch(qRaw);
  if (!q) return [];
  const rows = [];
  for (const item of INDIA_SEARCH_FALLBACKS) {
    const symbol = String(item.symbol || '').trim().toUpperCase();
    const symbolBase = symbol.replace(/\.(NS|BO)$/i, '');
    const symbolLoose = normalizeMatch(symbol);
    const baseLoose = normalizeMatch(symbolBase);
    const nameLoose = normalizeMatch(item.name);
    if (!symbolLoose.includes(q) && !baseLoose.includes(q) && !nameLoose.includes(q)) continue;

    let score = Number(item.score || 0);
    if (baseLoose === q || symbolLoose === q) score += 1000000;
    else if (baseLoose.startsWith(q) || symbolLoose.startsWith(q)) score += 500000;
    else if (nameLoose.startsWith(q)) score += 250000;

    rows.push({ ...item, score });
  }
  return rows
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
    .slice(0, limit);
};

const appendYahooSearchRows = (rows, seen, quotes, limit) => {
  for (const quote of quotes) {
    const symbol = String(quote?.symbol || '').trim().toUpperCase();
    if (!symbol) continue;
    const quoteType = String(quote?.quoteType || quote?.typeDisp || '').trim().toUpperCase();
    if (quoteType && !['EQUITY', 'ETF', 'INDEX', 'MUTUALFUND'].includes(quoteType)) continue;
    const key = `${symbol}|${quoteType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      symbol,
      name: quote?.longname || quote?.shortname || symbol,
      exch: normalizeYahooExchange(quote),
      type: quoteType === 'INDEX' ? 'index' : 'stock',
      score: Number(quote?.score) || 0,
    });
    if (rows.length >= limit) return true;
  }
  return false;
};

const searchYahooViaJina = async (query, { limit = 20 } = {}) => {
  const target = new URL('http://query1.finance.yahoo.com/v1/finance/search');
  target.searchParams.set('q', query);
  target.searchParams.set('quotesCount', String(Math.max(limit * 2, 10)));
  target.searchParams.set('newsCount', '0');
  target.searchParams.set('listsCount', '0');
  target.searchParams.set('enableFuzzyQuery', 'false');
  const payloadText = await textResponse(`https://r.jina.ai/${target.toString()}`, {
    headers: {
      Accept: 'text/plain, text/markdown, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://r.jina.ai/',
    },
  });
  const payload = parseEmbeddedJson(payloadText);
  return Array.isArray(payload?.quotes) ? payload.quotes : [];
};

const searchYahoo = async (query, { limit = 20 } = {}) => {
  const seen = new Set();
  const rows = [];
  const queries = buildYahooSearchQueries(query);
  const aliasQuotes = YAHOO_SEARCH_ALIAS_QUOTES[normalizeMatch(query)] || [];
  if (appendYahooSearchRows(rows, seen, aliasQuotes, limit)) return rows;

  for (const currentQuery of queries) {
    const beforeCount = rows.length;
    const url = new URL('https://query1.finance.yahoo.com/v1/finance/search');
    url.searchParams.set('q', currentQuery);
    url.searchParams.set('quotesCount', String(Math.max(limit * 2, 10)));
    url.searchParams.set('newsCount', '0');
    url.searchParams.set('listsCount', '0');
    url.searchParams.set('enableFuzzyQuery', 'false');

    const payload = await json(url, { headers: BROWSER_LIKE_HEADERS });
    const quotes = Array.isArray(payload?.quotes) ? payload.quotes : [];
    if (appendYahooSearchRows(rows, seen, quotes, limit)) return rows;

    if (rows.length === beforeCount) {
      const jinaQuotes = await searchYahooViaJina(currentQuery, { limit });
      if (appendYahooSearchRows(rows, seen, jinaQuotes, limit)) return rows;
    }
  }

  return rows;
};

const searchYahooSymbols = async ({ symbol, name, limit = 6 } = {}) => {
  const seen = new Set();
  const matches = [];
  const probes = [symbol, name].filter(Boolean);

  for (const probe of probes) {
    const rows = await searchYahoo(probe, { limit });
    for (const row of rows) {
      const candidate = String(row?.symbol || '').trim().toUpperCase();
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      matches.push(candidate);
      if (matches.length >= limit) return matches;
    }
  }

  return matches;
};

const resolvePreferredYahooSymbol = ({ symbol, name } = {}) => {
  const symbolAliases = YAHOO_SYMBOL_ALIAS[normalizeMatch(symbol)];
  if (Array.isArray(symbolAliases) && symbolAliases.length) return symbolAliases[0];
  const nameAliases = YAHOO_SYMBOL_ALIAS[normalizeMatch(name)];
  if (Array.isArray(nameAliases) && nameAliases.length) return nameAliases[0];
  return symbol || name || null;
};

const fetchYahooChart = async (symbol, { interval, range }) => {
  for (const base of YAHOO_BASES) {
    const url = new URL(`${base}/v8/finance/chart/${encodeURIComponent(symbol)}`);
    url.searchParams.set('interval', interval);
    url.searchParams.set('range', range);
    url.searchParams.set('includePrePost', 'false');
    const payload = await json(url, { headers: BROWSER_LIKE_HEADERS });
    const result = payload?.chart?.result?.[0];
    if (!result) continue;
    return {
      symbol: result?.meta?.symbol || symbol,
      result,
    };
  }
  return null;
};

const fetchYahooChartViaJina = async (symbol, { interval, range }) => {
  const target = new URL(`http://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  target.searchParams.set('interval', interval);
  target.searchParams.set('range', range);
  target.searchParams.set('includePrePost', 'false');
  const proxyUrl = `https://r.jina.ai/${target.toString()}`;
  const payloadText = await textResponse(proxyUrl, {
    headers: {
      Accept: 'text/plain, text/markdown, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://r.jina.ai/',
    },
  });
  if (!payloadText) return null;
  const payload = parseEmbeddedJson(payloadText);
  const result = payload?.chart?.result?.[0];
  if (!result) return null;
  return {
    symbol: result?.meta?.symbol || symbol,
    result,
  };
};

const extractLastFinite = (arr) => {
  if (!Array.isArray(arr)) return null;
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const num = toNum(arr[i]);
    if (num != null) return num;
  }
  return null;
};

const buildQuoteFromYahooResult = ({ symbol, result }) => {
  const meta = result?.meta || {};
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const price = toNum(meta.regularMarketPrice ?? extractLastFinite(closes));
  if (price == null) return null;
  const previousClose = toNum(
    meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPreviousClose
  );
  const change = previousClose != null ? (price - previousClose) : toNum(meta.regularMarketChange);
  const changePercent = previousClose
    ? (change != null ? (change / previousClose) * 100 : toNum(meta.regularMarketChangePercent))
    : toNum(meta.regularMarketChangePercent);
  return {
    success: true,
    symbol,
    pid: null,
    name: meta.longName || meta.shortName || INDEX_FALLBACK_QUOTES[symbol]?.name || null,
    price,
    previousClose,
    change,
    changePercent,
    exchange: normalizeYahooExchange({ exchDisp: meta.exchangeName || meta.fullExchangeName || meta.exchange || symbol }),
    source: 'yahoo_worker',
  };
};

const buildKlineFromYahooResult = ({ symbol, result }) => {
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};
  const rows = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const tsNum = Number(timestamps[i]);
    const c = toNum(quote.close?.[i]);
    if (!Number.isFinite(tsNum) || c == null) continue;
    const o = toNum(quote.open?.[i]) ?? c;
    const h = toNum(quote.high?.[i]) ?? c;
    const l = toNum(quote.low?.[i]) ?? c;
    const v = toNum(quote.volume?.[i]) ?? 0;
    rows.push({
      t: new Date(tsNum * 1000).toISOString(),
      o,
      h,
      l,
      c,
      v,
    });
  }
  if (!rows.length) return null;
  return {
    success: true,
    symbol,
    source: 'yahoo_worker',
    data: rows,
  };
};

const fetchYahooQuote = async ({ symbol, name, indexOnly = false }) => {
  const candidates = getYahooCandidates({ symbol, name, indexOnly });
  if (!candidates.length) return null;
  const plans = [
    { interval: '1m', range: '1d' },
    { interval: '5m', range: '1d' },
    { interval: '15m', range: '1d' },
    { interval: '1d', range: '5d' },
  ];
  for (const candidate of candidates) {
    for (const plan of plans) {
      const chart = await fetchYahooChart(candidate, plan);
      if (!chart) continue;
      const quote = buildQuoteFromYahooResult(chart);
      if (quote) return quote;
    }
  }
  return null;
};

const fetchYahooQuoteViaJina = async ({ symbol, name, indexOnly = false }) => {
  const candidates = getYahooCandidates({ symbol, name, indexOnly });
  if (!candidates.length) return null;
  const plans = [
    { interval: '1m', range: '1d' },
    { interval: '5m', range: '1d' },
    { interval: '15m', range: '1d' },
    { interval: '1d', range: '5d' },
  ];
  for (const candidate of candidates) {
    for (const plan of plans) {
      const chart = await fetchYahooChartViaJina(candidate, plan);
      if (!chart) continue;
      const quote = buildQuoteFromYahooResult(chart);
      if (quote) {
        return {
          ...quote,
          source: 'yahoo_jina_proxy',
        };
      }
    }
  }
  return null;
};

const fetchYahooKline = async ({ symbol, name, period, interval, indexOnly = false }) => {
  const candidates = getYahooCandidates({ symbol, name, indexOnly });
  if (!candidates.length) return null;
  const range = mapYahooRange(period);
  const desired = mapYahooInterval(interval);
  const intervals = [...new Set([desired, '5m', '15m', '1d'])];
  for (const candidate of candidates) {
    for (const iv of intervals) {
      const chart = await fetchYahooChart(candidate, { interval: iv, range });
      if (!chart) continue;
      const kline = buildKlineFromYahooResult(chart);
      if (kline) return kline;
    }
  }
  return null;
};

const fetchYahooKlineViaJina = async ({ symbol, name, period, interval, indexOnly = false }) => {
  const candidates = getYahooCandidates({ symbol, name, indexOnly });
  if (!candidates.length) return null;
  const range = mapYahooRange(period);
  const desired = mapYahooInterval(interval);
  const intervals = [...new Set([desired, '5m', '15m', '1d'])];
  for (const candidate of candidates) {
    for (const iv of intervals) {
      const chart = await fetchYahooChartViaJina(candidate, { interval: iv, range });
      if (!chart) continue;
      const kline = buildKlineFromYahooResult(chart);
      if (kline) {
        return {
          ...kline,
          source: 'yahoo_jina_proxy',
        };
      }
    }
  }
  return null;
};

const fetchNseIndexQuote = async (indexSymbol) => {
  const indexName = NSE_INDEX_NAMES[indexSymbol];
  if (!indexName) return null;
  const url = new URL('https://www.nseindia.com/api/equity-stockIndices');
  url.searchParams.set('index', indexName);
  const payload = await json(url, {
    headers: {
      ...BROWSER_LIKE_HEADERS,
      Referer: 'https://www.nseindia.com/',
    },
  });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const row = rows.find((item) => normalizeMatch(item?.symbol) === normalizeMatch(indexName)) || rows[0];
  if (!row) return null;
  const price = toNum(row.lastPrice);
  const previousClose = toNum(row.previousClose);
  let change = toNum(row.change);
  let changePercent = toNum(row.pChange);
  if (price == null) return null;
  if (change == null && previousClose != null) change = price - previousClose;
  if (changePercent == null && previousClose && change != null) {
    changePercent = (change / previousClose) * 100;
  }
  return {
    success: true,
    symbol: indexSymbol,
    pid: null,
    name: payload?.name || indexName,
    price,
    previousClose,
    change,
    changePercent,
    source: 'nse_index',
  };
};

const isLowConfidenceIndexQuote = (quote) => {
  const source = String(quote?.source || '').toLowerCase();
  return quote?.delayed === true || source.includes('fallback') || source.includes('cache');
};

const rememberLiveIndexQuote = (indexSymbol, quote) => {
  if (!indexSymbol || !quote || isLowConfidenceIndexQuote(quote)) return;
  LAST_GOOD_INDEX_QUOTES.set(indexSymbol, {
    ts: Date.now(),
    quote: {
      ...quote,
      symbol: indexSymbol,
    },
  });
};

const getRememberedIndexQuote = (indexSymbol) => {
  const cached = LAST_GOOD_INDEX_QUOTES.get(indexSymbol);
  if (!cached) return null;
  if ((Date.now() - cached.ts) > LAST_GOOD_INDEX_TTL_MS) {
    LAST_GOOD_INDEX_QUOTES.delete(indexSymbol);
    return null;
  }

  return {
    ...cached.quote,
    symbol: indexSymbol,
    source: 'index_live_cache',
    delayed: true,
    cached: true,
  };
};

const fetchIndexQuote = async ({ symbol, name }) => {
  const indexSymbol = resolveIndexYahooSymbol({ symbol, name });
  if (!indexSymbol) return null;

  const yahooQuote = await fetchYahooQuote({ symbol: indexSymbol, indexOnly: true });
  if (yahooQuote) {
    rememberLiveIndexQuote(indexSymbol, yahooQuote);
    return yahooQuote;
  }

  const nseQuote = await fetchNseIndexQuote(indexSymbol);
  if (nseQuote) {
    rememberLiveIndexQuote(indexSymbol, nseQuote);
    return nseQuote;
  }

  const jinaQuote = await fetchYahooQuoteViaJina({ symbol: indexSymbol, indexOnly: true });
  if (jinaQuote) {
    rememberLiveIndexQuote(indexSymbol, jinaQuote);
    return jinaQuote;
  }

  if (indexSymbol === '^BSESN') {
    const bseQuote = await fetchBseSensexQuote();
    if (bseQuote) {
      rememberLiveIndexQuote(indexSymbol, bseQuote);
      return bseQuote;
    }
  }

  const rememberedQuote = getRememberedIndexQuote(indexSymbol);
  if (rememberedQuote) return rememberedQuote;

  return getIndexFallbackQuote(indexSymbol);
};

const resolveNseEquitySymbol = ({ symbol, name } = {}) => {
  const preferred = resolvePreferredYahooSymbol({ symbol, name }) || symbol || name || '';
  let normalized = normalizeSymbol(preferred);
  if (!normalized) return null;
  normalized = normalized.replace(/-SM$/i, '');
  normalized = normalized.replace(/[^A-Z0-9]/g, '');
  return normalized || null;
};

const fetchNseEquityQuote = async ({ symbol, name }) => {
  const nseSymbol = resolveNseEquitySymbol({ symbol, name });
  if (!nseSymbol) return null;

  const url = new URL('https://www.nseindia.com/api/quote-equity');
  url.searchParams.set('symbol', nseSymbol);
  const payload = await json(url, {
    headers: {
      ...BROWSER_LIKE_HEADERS,
      Referer: 'https://www.nseindia.com/',
    },
  });
  const info = payload?.info || {};
  const priceInfo = payload?.priceInfo || {};
  const price = toNum(priceInfo.lastPrice ?? priceInfo.close);
  if (price == null) return null;
  const previousClose = toNum(priceInfo.previousClose ?? priceInfo.basePrice);
  let change = toNum(priceInfo.change);
  let changePercent = toNum(priceInfo.pChange);
  if (change == null && previousClose != null) change = price - previousClose;
  if (changePercent == null && previousClose && change != null) {
    changePercent = (change / previousClose) * 100;
  }
  return {
    success: true,
    symbol: `${info.symbol || nseSymbol}.NS`,
    pid: null,
    name: info.companyName || info.symbol || nseSymbol,
    price,
    previousClose,
    change,
    changePercent,
    open: toNum(priceInfo.open),
    high: toNum(priceInfo.intraDayHighLow?.max),
    low: toNum(priceInfo.intraDayHighLow?.min),
    source: 'nse_equity',
  };
};

const buildSingleCandleKline = ({ symbol, open, high, low, close }) => {
  const c = toNum(close);
  if (c == null) return null;
  const o = toNum(open) ?? c;
  const h = toNum(high) ?? Math.max(o, c);
  const l = toNum(low) ?? Math.min(o, c);
  return {
    success: true,
    symbol,
    source: 'nse_equity_snapshot',
    data: [{
      t: new Date().toISOString(),
      o,
      h,
      l,
      c,
      v: 0,
    }],
  };
};

const fetchIndexKline = async ({ symbol, name, period, interval }) => {
  const indexSymbol = resolveIndexYahooSymbol({ symbol, name });
  if (!indexSymbol) return null;

  const yahooKline = await fetchYahooKline({
    symbol: indexSymbol,
    period,
    interval,
    indexOnly: true,
  });
  if (yahooKline) return yahooKline;

  const jinaKline = await fetchYahooKlineViaJina({
    symbol: indexSymbol,
    period,
    interval,
    indexOnly: true,
  });
  if (jinaKline) return jinaKline;

  const liveQuote = await fetchNseIndexQuote(indexSymbol);
  const synthetic = buildSyntheticKline({
    symbol: indexSymbol,
    seedPrice: liveQuote?.price ?? getIndexFallbackQuote(indexSymbol)?.price,
    period,
    interval,
  });
  if (!synthetic) return null;
  if (liveQuote?.price != null) {
    return {
      ...synthetic,
      source: 'nse_index_seeded',
    };
  }
  return synthetic;
};

const fetchYahooFundamentals = async ({ symbol, name }) => {
  const candidates = getYahooCandidates({ symbol, name, indexOnly: false });
  if (!candidates.length) return null;
  const modules = 'summaryDetail,defaultKeyStatistics,financialData,assetProfile,price';
  for (const candidate of candidates) {
    for (const base of YAHOO_BASES) {
      const url = new URL(`${base}/v10/finance/quoteSummary/${encodeURIComponent(candidate)}`);
      url.searchParams.set('modules', modules);
      const payload = await json(url);
      const result = payload?.quoteSummary?.result?.[0];
      if (!result) continue;
      return {
        success: true,
        symbol: candidate,
        source: 'yahoo_worker',
        data: result,
      };
    }
  }
  return null;
};

const fetchStocktvQuote = async (env, { symbol, pid, name }) => {
  let stocktvError = null;
  if (!env?.STOCKTV_KEY) {
    return { quote: null, stocktvError };
  }

  const item = await resolveStock(env, { symbol, pid, name });
  if (item && !item.__error) {
    const price = toNum(pick(item, ['price', 'lastPrice', 'last', 'close', 'currentPrice']));
    const prev = toNum(pick(item, ['previousClose', 'prevClose', 'preClose']));
    const change = price != null && prev != null ? price - prev : toNum(pick(item, ['change']));
    const changePercent =
      change != null && prev ? (change / prev) * 100 : toNum(pick(item, ['changePercent', 'pChange']));
    if (price != null) {
      return {
        quote: {
          success: true,
          symbol: item.symbol || item.code || symbol || pid,
          pid: item.pid || item.id || null,
          name: item.name || null,
          price,
          previousClose: prev,
          change,
          changePercent,
          exchange: normalizeYahooExchange({ exchDisp: item?.exchDisp || item?.exchange || item?.market || item?.symbol }),
          source: 'stocktv',
        },
        stocktvError,
      };
    }
  } else if (item?.__error) {
    stocktvError = item.__error;
  }

  return { quote: null, stocktvError };
};

const fetchStocktvKline = async (env, { symbol, pid, name, intervalRaw }) => {
  if (!env?.STOCKTV_KEY) return null;

  const interval = mapInterval(intervalRaw);
  const item = pid ? { pid } : await resolveStock(env, { symbol, name });
  const usePid = item?.pid || item?.id;
  if (!usePid) return null;

  const kUrl = new URL(`${API_BASE}/stock/kline`);
  kUrl.searchParams.set('pid', usePid);
  kUrl.searchParams.set('interval', interval);
  kUrl.searchParams.set('key', env.STOCKTV_KEY);

  const k = await json(kUrl);
  const rows = extractList(k);
  const data = rows
    .map((r) => ({
      t: r.t || r.time || r.timestamp || r.date,
      o: toNum(r.o ?? r.open),
      h: toNum(r.h ?? r.high),
      l: toNum(r.l ?? r.low),
      c: toNum(r.c ?? r.close),
      v: toNum(r.v ?? r.volume) || 0,
    }))
    .filter((x) => x.t && x.c != null);

  if (!data.length) return null;

  return {
    success: true,
    symbol: k?.symbol || symbol || usePid,
    source: 'stocktv',
    data,
  };
};

const buildSyntheticKline = ({ symbol, seedPrice, period = '1d', interval = '5m' }) => {
  const price = toNum(seedPrice);
  if (price == null || price <= 0) return null;
  const intervalMap = {
    '1m': 60,
    '2m': 120,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '45m': 2700,
    '60m': 3600,
    '1h': 3600,
    '90m': 5400,
    '1d': 86400,
    p1d: 86400,
  };
  const step = intervalMap[String(interval || '').toLowerCase()] || 300;
  const periodLower = String(period || '').toLowerCase();
  const points = periodLower === '1d' ? 96 : (periodLower === '5d' ? 120 : 180);
  const now = Math.floor(Date.now() / 1000);
  const start = now - ((points - 1) * step);
  let lastClose = price;
  const rows = [];
  for (let i = 0; i < points; i += 1) {
    const ts = start + (i * step);
    const drift = (Math.random() - 0.5) * 0.0022;
    const o = lastClose;
    const c = Math.max(0.01, o * (1 + drift));
    const h = Math.max(o, c) * (1 + Math.random() * 0.0010);
    const l = Math.min(o, c) * (1 - Math.random() * 0.0010);
    rows.push({
      t: new Date(ts * 1000).toISOString(),
      o,
      h,
      l,
      c,
      v: Math.floor(500 + Math.random() * 1500),
    });
    lastClose = c;
  }
  return {
    success: true,
    symbol,
    source: 'index_synthetic',
    delayed: true,
    data: rows,
  };
};

const getIndexFallbackQuote = (indexSymbol) => {
  const base = INDEX_FALLBACK_QUOTES[indexSymbol];
  if (!base) return null;
  const price = toNum(base.price);
  const previousClose = toNum(base.previousClose);
  if (price == null || previousClose == null || previousClose === 0) return null;
  const change = price - previousClose;
  const changePercent = (change / previousClose) * 100;
  return {
    success: true,
    symbol: indexSymbol,
    pid: null,
    name: base.name,
    price,
    previousClose,
    change,
    changePercent,
    source: 'index_fallback',
    delayed: true,
  };
};

const fetchBseSensexQuote = async () => {
  const html = await textResponse('https://m.bseindia.com/Sensex.aspx?Scripflag=105', {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://m.bseindia.com/',
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!html) return null;

  const capture = (pattern) => {
    const match = html.match(pattern);
    return match?.[1] ? String(match[1]).replace(/,/g, '').trim() : null;
  };

  const price = toNum(capture(/id="UcHeaderMenu1_sensexLtp"[^>]*>([^<]+)</i));
  const change = toNum(capture(/id="UcHeaderMenu1_sensexChange"[^>]*>([^<]+)</i));
  const changePercent = toPercentNum(capture(/id="UcHeaderMenu1_sensexPerChange"[^>]*>([^<]+)</i));
  if (price == null) return null;

  const previousClose = change != null ? (price - change) : null;
  return {
    success: true,
    symbol: '^BSESN',
    pid: null,
    name: 'S&P BSE SENSEX',
    price,
    previousClose,
    change,
    changePercent,
    exchange: 'BSE',
    source: 'bse_mobile',
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

export default {
  async fetch(req, env) {
    try {
      if (req.method === 'OPTIONS') {
        return new Response('', { headers: corsHeaders });
      }

      const url = new URL(req.url);
      const path = url.pathname;
      const symbol = url.searchParams.get('symbol');
      const pid = url.searchParams.get('pid');
      const name = url.searchParams.get('name');
      const requestedExchange = resolveRequestedExchange({ symbol, name });
      const preferredYahooSymbol = resolvePreferredYahooSymbol({ symbol, name });
      const explicitLookupSymbol = String(symbol || '').trim();
      const isExplicitLookup = looksLikeExplicitTicker(explicitLookupSymbol);
      const lookupSymbol = isExplicitLookup ? explicitLookupSymbol : (preferredYahooSymbol || symbol);
      const lookupName = isExplicitLookup ? null : name;
      const canUseSearchDiscovery = !looksLikeExplicitTicker(lookupSymbol) || !!lookupName;
      const preferIndiaFastPath = isExplicitIndiaMarketSymbol(lookupSymbol);
      const preferInfowayFastPath = !preferIndiaFastPath && looksLikeExplicitTicker(lookupSymbol);
      const acceptQuote = (quote) => quote && quoteMatchesRequestedExchange(requestedExchange, quote);

      if (path === '/quote') {
        const indexSymbol = resolveIndexYahooSymbol({ symbol, name });
        if (indexSymbol) {
          const indexQuote = await fetchIndexQuote({ symbol: indexSymbol, name });
          if (indexQuote) return jsonResponse(indexQuote);
          return jsonResponse({ success: false, message: 'index quote unavailable' }, 404);
        }

        if (requestedExchange === 'BSE' || preferInfowayFastPath) {
          const infowayQuoteFast = await fetchInfowayQuote(env, { symbol: lookupSymbol, name: lookupName });
          if (acceptQuote(infowayQuoteFast)) return jsonResponse(infowayQuoteFast);
        }

        const yahooQuote = await fetchYahooQuote({ symbol: lookupSymbol, name: lookupName });
        if (acceptQuote(yahooQuote)) return jsonResponse(yahooQuote);

        const jinaQuote = await fetchYahooQuoteViaJina({ symbol: lookupSymbol, name: lookupName });
        if (acceptQuote(jinaQuote)) return jsonResponse(jinaQuote);

        if (requestedExchange !== 'BSE') {
          const directNseQuote = await fetchNseEquityQuote({ symbol: lookupSymbol, name: lookupName });
          if (acceptQuote(directNseQuote)) return jsonResponse(directNseQuote);
        }

        const infowayQuote = await fetchInfowayQuote(env, { symbol: lookupSymbol, name: lookupName });
        if (acceptQuote(infowayQuote)) return jsonResponse(infowayQuote);

        const { quote: stocktvQuote, stocktvError } = await fetchStocktvQuote(env, { symbol, pid, name });
        if (acceptQuote(stocktvQuote)) return jsonResponse(stocktvQuote);

        if (canUseSearchDiscovery) {
          const discoveredSymbols = await searchYahooSymbols({ symbol: lookupSymbol, name: lookupName });
          for (const discoveredSymbol of discoveredSymbols) {
            const discoveredYahooQuote = await fetchYahooQuote({ symbol: discoveredSymbol });
            if (acceptQuote(discoveredYahooQuote)) {
              return jsonResponse({
                ...discoveredYahooQuote,
                source: `${discoveredYahooQuote.source}_search`,
              });
            }
            const discoveredJinaQuote = await fetchYahooQuoteViaJina({ symbol: discoveredSymbol });
            if (acceptQuote(discoveredJinaQuote)) {
              return jsonResponse({
                ...discoveredJinaQuote,
                source: `${discoveredJinaQuote.source}_search`,
              });
            }
          }
        }

        if (requestedExchange !== 'BSE') {
          const nseQuote = await fetchNseEquityQuote({ symbol: lookupSymbol, name: lookupName });
          if (acceptQuote(nseQuote)) return jsonResponse(nseQuote);
        }

        return jsonResponse(
          { success: false, message: stocktvError || 'symbol/pid not found' },
          404
        );
      }

      if (path === '/fundamentals') {
        const indexSymbol = resolveIndexYahooSymbol({ symbol, name });
        if (indexSymbol) {
          return jsonResponse({ success: false, message: 'fundamentals unavailable for index' }, 404);
        }
        const fundamentals = await fetchYahooFundamentals({ symbol: preferredYahooSymbol || symbol, name });
        if (fundamentals) return jsonResponse(fundamentals);
        const infowayFundamentals = await fetchInfowayFundamentals(env, { symbol: preferredYahooSymbol || symbol, name });
        if (infowayFundamentals) return jsonResponse(infowayFundamentals);
        return jsonResponse({ success: false, message: 'fundamentals not found' }, 404);
      }

      if (path === '/debug/list') {
      if (!env.STOCKTV_KEY) {
        return jsonResponse({ success: false, message: 'Missing STOCKTV_KEY' }, 500);
      }
      const exchangeId = url.searchParams.get('exchangeId') || env.STOCKTV_EXCHANGE_ID || '46';
      const page = Number(url.searchParams.get('page') || '1');
      const pageSize = Number(url.searchParams.get('pageSize') || '10');
      const list = await listStocks(env, page, pageSize, { exchangeId });
      const rows = extractList(list).map((x) => ({
        pid: x.pid || x.id,
        symbol: x.symbol || x.code || x.ticker || x.stockCode || x.shortCode,
        name: x.name,
      }));
      return jsonResponse({
        success: true,
        exchangeId,
        count: rows.length,
        sample: rows,
        upstreamCode: list?.code ?? list?.status ?? null,
        upstreamMessage: list?.message ?? null,
      });
    }

      if (path === '/debug/query') {
      if (!env.STOCKTV_KEY) {
        return jsonResponse({ success: false, message: 'Missing STOCKTV_KEY' }, 500);
      }
      const querySymbol = url.searchParams.get('symbol') || '';
      const queryName = url.searchParams.get('name') || '';
      const bySymbol = querySymbol ? await queryStock(env, { symbol: querySymbol }) : null;
      const byName = queryName ? await queryStock(env, { name: queryName }) : null;
      const symbolRows = extractList(bySymbol).map((x) => ({
        pid: x.pid || x.id,
        symbol: x.symbol || x.code || x.ticker || x.stockCode || x.shortCode,
        name: x.name,
      }));
      const nameRows = extractList(byName).map((x) => ({
        pid: x.pid || x.id,
        symbol: x.symbol || x.code || x.ticker || x.stockCode || x.shortCode,
        name: x.name,
      }));
      return jsonResponse({
        success: true,
        symbol: querySymbol,
        name: queryName,
        symbolRows,
        nameRows,
        symbolUpstreamCode: bySymbol?.code ?? bySymbol?.status ?? null,
        symbolUpstreamMessage: bySymbol?.message ?? null,
        nameUpstreamCode: byName?.code ?? byName?.status ?? null,
        nameUpstreamMessage: byName?.message ?? null,
      });
    }

      if (path === '/debug/search') {
      if (!env.STOCKTV_KEY) {
        return jsonResponse({ success: false, message: 'Missing STOCKTV_KEY' }, 500);
      }
      const query = (url.searchParams.get('query') || '').trim();
      const exchangeId = url.searchParams.get('exchangeId') || env.STOCKTV_EXCHANGE_ID || '46';
      const limit = Number(url.searchParams.get('limit') || '20');
      const maxPages = Number(env.STOCKTV_MAX_PAGES || 12);
      if (!query) {
        return jsonResponse({ success: false, message: 'query required' }, 400);
      }
      const qLoose = normalizeMatch(query);
      const matches = [];
      for (let page = 1; page <= maxPages; page += 1) {
        const list = await listStocks(env, page, 500, { exchangeId });
        const rows = extractList(list);
        if (!rows.length) break;
        for (const x of rows) {
          const symbolVal = x.symbol || x.code || x.ticker || x.stockCode || x.shortCode || '';
          const nameVal = x.name || '';
          const symLoose = normalizeMatch(symbolVal);
          const nameLoose = normalizeMatch(nameVal);
          if (symLoose.includes(qLoose) || nameLoose.includes(qLoose)) {
            matches.push({
              pid: x.pid || x.id,
              symbol: symbolVal,
              name: nameVal,
            });
            if (matches.length >= limit) break;
          }
        }
        if (matches.length >= limit) break;
      }
      return jsonResponse({
        success: true,
        query,
        exchangeId,
        count: matches.length,
        matches,
      });
    }

      if (path === '/search') {
        const query = (url.searchParams.get('query') || '').trim();
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '20') || 20, 1), 50);
        if (!query) {
          return jsonResponse({ success: false, message: 'query required' }, 400);
        }

        const resultSets = [];
        const indiaCatalogResults = searchIndiaCatalog(query, limit);
        if (indiaCatalogResults.length) {
          resultSets.push(indiaCatalogResults);
        }

        if (looksLikeExplicitTicker(query)) {
          const exactRequestedExchange = resolveRequestedExchange({ symbol: query, name: query });
          if (exactRequestedExchange === 'BSE') {
            const exactInfowayQuote = await fetchInfowayQuote(env, { symbol: query, name: query });
            if (exactInfowayQuote && quoteMatchesRequestedExchange(exactRequestedExchange, exactInfowayQuote)) {
              resultSets.push([buildSearchRowFromQuote(exactInfowayQuote, 1200000)]);
            }
          } else {
            const exactYahooQuote = await fetchYahooQuote({ symbol: query, name: query });
            if (exactYahooQuote && quoteMatchesRequestedExchange(exactRequestedExchange, exactYahooQuote)) {
              resultSets.push([buildSearchRowFromQuote(exactYahooQuote, 1200000)]);
            } else {
              const exactJinaQuote = await fetchYahooQuoteViaJina({ symbol: query, name: query });
              if (exactJinaQuote && quoteMatchesRequestedExchange(exactRequestedExchange, exactJinaQuote)) {
                resultSets.push([buildSearchRowFromQuote(exactJinaQuote, 1200000)]);
              } else {
                const exactNseQuote = await fetchNseEquityQuote({ symbol: query, name: query });
                if (exactNseQuote && quoteMatchesRequestedExchange(exactRequestedExchange, exactNseQuote)) {
                  resultSets.push([buildSearchRowFromQuote(exactNseQuote, 1200000)]);
                }
              }
            }
          }
        }

        let results = mergeSearchRows(resultSets.flat(), limit);
        if (!results.length && looksLikeExplicitTicker(query)) {
          const infowayResults = await searchInfowayExact(env, query, limit);
          if (Array.isArray(infowayResults) && infowayResults.length) {
            resultSets.push(infowayResults);
          }
          results = mergeSearchRows(resultSets.flat(), limit);
        }
        if (!results.length) {
          const yahooResults = await searchYahoo(query, { limit });
          if (Array.isArray(yahooResults) && yahooResults.length) {
            resultSets.push(yahooResults);
          }
          results = mergeSearchRows(resultSets.flat(), limit);
        }

        return jsonResponse({
          success: true,
          query,
          count: results.length,
          results,
        });
      }

      if (path === '/kline') {
        const period = url.searchParams.get('period') || '1d';
        const intervalRaw = url.searchParams.get('interval') || '5m';
        const indexSymbol = resolveIndexYahooSymbol({ symbol, name });

        if (indexSymbol) {
          const indexKline = await fetchIndexKline({
            symbol: indexSymbol,
            name,
            period,
            interval: intervalRaw,
          });
          if (indexKline) return jsonResponse(indexKline);
          return jsonResponse({ success: false, message: 'index kline unavailable' }, 404);
        }

        let fastNseKline = null;

        if (preferInfowayFastPath) {
          const infowaySnapshotFast = await fetchInfowayKline(env, {
            symbol: preferredYahooSymbol || symbol,
            name,
            period,
            interval: intervalRaw,
            withInfo: false,
          });
          if (infowaySnapshotFast) {
            const infowayKlineFast = buildKlineFromInfowayRows({
              market: infowaySnapshotFast.market,
              code: infowaySnapshotFast.code,
              rows: infowaySnapshotFast.rows,
              info: infowaySnapshotFast.info,
            });
            if (infowayKlineFast) return jsonResponse(infowayKlineFast);
          }
        }

        const yahooKline = await fetchYahooKline({
          symbol: preferredYahooSymbol || symbol,
          name,
          period,
          interval: intervalRaw,
        });
        if (yahooKline) return jsonResponse(yahooKline);

        const jinaKline = await fetchYahooKlineViaJina({
          symbol: preferredYahooSymbol || symbol,
          name,
          period,
          interval: intervalRaw,
        });
        if (jinaKline) return jsonResponse(jinaKline);

        if (canUseSearchDiscovery) {
          const discoveredSymbols = await searchYahooSymbols({ symbol: preferredYahooSymbol || symbol, name });
          for (const discoveredSymbol of discoveredSymbols) {
            const discoveredYahooKline = await fetchYahooKline({
              symbol: discoveredSymbol,
              period,
              interval: intervalRaw,
            });
            if (discoveredYahooKline) {
              return jsonResponse({
                ...discoveredYahooKline,
                source: `${discoveredYahooKline.source}_search`,
              });
            }

            const discoveredJinaKline = await fetchYahooKlineViaJina({
              symbol: discoveredSymbol,
              period,
              interval: intervalRaw,
            });
            if (discoveredJinaKline) {
              return jsonResponse({
                ...discoveredJinaKline,
                source: `${discoveredJinaKline.source}_search`,
              });
            }
          }
        }

        const infowaySnapshot = await fetchInfowayKline(env, {
          symbol: preferredYahooSymbol || symbol,
          name,
          period,
          interval: intervalRaw,
          withInfo: false,
        });
        if (infowaySnapshot) {
          const infowayKline = buildKlineFromInfowayRows({
            market: infowaySnapshot.market,
            code: infowaySnapshot.code,
            rows: infowaySnapshot.rows,
            info: infowaySnapshot.info,
          });
          if (infowayKline) return jsonResponse(infowayKline);
        }

        if (preferIndiaFastPath) {
          const nseQuote = await fetchNseEquityQuote({ symbol: preferredYahooSymbol || symbol, name });
          fastNseKline = buildSingleCandleKline({
            symbol: nseQuote?.symbol || (preferredYahooSymbol || symbol),
            open: nseQuote?.open,
            high: nseQuote?.high,
            low: nseQuote?.low,
            close: nseQuote?.price,
          });
        }

        if (fastNseKline) return jsonResponse(fastNseKline);

        const stocktvKline = await fetchStocktvKline(env, { symbol, pid, name, intervalRaw });
        if (stocktvKline) return jsonResponse(stocktvKline);

        return jsonResponse({ success: false, message: 'symbol/pid not found' }, 404);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      return jsonResponse({
        success: false,
        message: String(error?.message || 'upstream error'),
      }, 502);
    }
  },
};
