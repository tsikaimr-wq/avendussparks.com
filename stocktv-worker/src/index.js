const API_BASE = 'https://api.stocktv.top';
const YAHOO_BASES = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

const STOCK_SYMBOL_ALIAS = {
  RELIANCE: 'RELI',
  RELIANCENS: 'RELI',
  ONE97COMMUNICATIONS: 'PAYTM',
  PAYTM: 'PAYTM',
  PAYTMNS: 'PAYTM',
  FSNECOMMERCEVENTURES: 'NYKAA',
  NYKAA: 'NYKAA',
  NYKAANS: 'NYKAA',
};

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

const json = async (url, init = undefined) => {
  const res = await fetch(url, init);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
};

const pick = (obj, keys) => {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return null;
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

const getYahooCandidates = ({ symbol, name, indexOnly = false }) => {
  const set = new Set();
  const indexSymbol = resolveIndexYahooSymbol({ symbol, name });
  if (indexSymbol) {
    set.add(indexSymbol);
    if (indexOnly) return [...set];
  }
  addYahooCandidates(set, symbol);
  addYahooCandidates(set, name);
  return [...set];
};

const fetchYahooChart = async (symbol, { interval, range }) => {
  for (const base of YAHOO_BASES) {
    const url = new URL(`${base}/v8/finance/chart/${encodeURIComponent(symbol)}`);
    url.searchParams.set('interval', interval);
    url.searchParams.set('range', range);
    url.searchParams.set('includePrePost', 'false');
    const payload = await json(url);
    const result = payload?.chart?.result?.[0];
    if (!result) continue;
    return {
      symbol: result?.meta?.symbol || symbol,
      result,
    };
  }
  return null;
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
    name: null,
    price,
    previousClose,
    change,
    changePercent,
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
  const intervals = ['1m', '5m', '15m'];
  for (const candidate of candidates) {
    for (const interval of intervals) {
      const chart = await fetchYahooChart(candidate, { interval, range: '1d' });
      if (!chart) continue;
      const quote = buildQuoteFromYahooResult(chart);
      if (quote) return quote;
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
    if (req.method === 'OPTIONS') {
      return new Response('', { headers: corsHeaders });
    }

    const url = new URL(req.url);
    const path = url.pathname;
    const symbol = url.searchParams.get('symbol');
    const pid = url.searchParams.get('pid');
    const name = url.searchParams.get('name');

    if (path === '/quote') {
      const indexSymbol = resolveIndexYahooSymbol({ symbol, name });
      if (indexSymbol) {
        const indexQuote = await fetchYahooQuote({ symbol: indexSymbol, indexOnly: true });
        if (indexQuote) return jsonResponse(indexQuote);
        const fallbackQuote = getIndexFallbackQuote(indexSymbol);
        if (fallbackQuote) return jsonResponse(fallbackQuote);
        return jsonResponse({ success: false, message: 'index quote unavailable' }, 404);
      }

      let stocktvError = null;
      if (env.STOCKTV_KEY) {
        const item = await resolveStock(env, { symbol, pid, name });
        if (item && !item.__error) {
          const price = toNum(pick(item, ['price', 'lastPrice', 'last', 'close', 'currentPrice']));
          const prev = toNum(pick(item, ['previousClose', 'prevClose', 'preClose']));
          const change = price != null && prev != null ? price - prev : toNum(pick(item, ['change']));
          const changePercent =
            change != null && prev ? (change / prev) * 100 : toNum(pick(item, ['changePercent', 'pChange']));
          if (price != null) {
            return jsonResponse({
              success: true,
              symbol: item.symbol || item.code || symbol || pid,
              pid: item.pid || item.id || null,
              name: item.name || null,
              price,
              previousClose: prev,
              change,
              changePercent,
              source: 'stocktv',
            });
          }
        } else if (item?.__error) {
          stocktvError = item.__error;
        }
      }

      const yahooQuote = await fetchYahooQuote({ symbol, name });
      if (yahooQuote) return jsonResponse(yahooQuote);

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
      const fundamentals = await fetchYahooFundamentals({ symbol, name });
      if (!fundamentals) {
        return jsonResponse({ success: false, message: 'fundamentals not found' }, 404);
      }
      return jsonResponse(fundamentals);
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

    if (path === '/kline') {
      const period = url.searchParams.get('period') || '1d';
      const intervalRaw = url.searchParams.get('interval') || '5m';
      const indexSymbol = resolveIndexYahooSymbol({ symbol, name });

      if (indexSymbol) {
        const indexKline = await fetchYahooKline({
          symbol: indexSymbol,
          period,
          interval: intervalRaw,
          indexOnly: true,
        });
        if (indexKline) return jsonResponse(indexKline);
        const fallbackQuote = getIndexFallbackQuote(indexSymbol);
        const synthetic = buildSyntheticKline({
          symbol: indexSymbol,
          seedPrice: fallbackQuote?.price,
          period,
          interval: intervalRaw,
        });
        if (synthetic) return jsonResponse(synthetic);
        return jsonResponse({ success: false, message: 'index kline unavailable' }, 404);
      }

      if (env.STOCKTV_KEY) {
        const interval = mapInterval(intervalRaw);
        const item = pid ? { pid } : await resolveStock(env, { symbol, name });
        const usePid = item?.pid || item?.id;
        if (usePid) {
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

          if (data.length > 0) {
            return jsonResponse({
              success: true,
              symbol: k?.symbol || symbol || usePid,
              source: 'stocktv',
              data,
            });
          }
        }
      }

      const yahooKline = await fetchYahooKline({
        symbol,
        name,
        period,
        interval: intervalRaw,
      });
      if (yahooKline) return jsonResponse(yahooKline);

      return jsonResponse({ success: false, message: 'symbol/pid not found' }, 404);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
