const API_BASE = 'https://api.stocktv.top';

const json = async (url) => {
  const res = await fetch(url);
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

const normalizeMatch = (v) =>
  String(v || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

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
    '1month': 'P1M'
  };
  return table[lower] || 'P1D';
};

const normalizeSymbol = (s = '') =>
  String(s).toUpperCase().replace(/^NSE:|^BSE:/, '').replace(/\.(NS|BO)$/, '');

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

const bestMatch = (rows, symbol, opts = {}) => {
  if (!rows || !rows.length) return null;
  if (!symbol) return rows[0] || null;
  const allowName = opts.allowName === true;
  const target = normalizeSymbol(symbol);
  const targetLoose = normalizeMatch(target);
  const getSymbol = (x) =>
    normalizeSymbol(x.symbol || x.code || x.ticker || x.stockCode || x.shortCode || '');
  const getLoose = (x) =>
    normalizeMatch(x.symbol || x.code || x.ticker || x.stockCode || x.shortCode || x.name || '');
  const getNameLoose = (x) => normalizeMatch(x.name || '');

  // Prefer exact symbol match
  let found = rows.find((x) => getSymbol(x) === target);
  if (found) return found;

  // Strict: if input looks like a ticker, avoid fuzzy name matching
  const looksLikeTicker = /^[A-Z0-9.:-]+$/.test(String(symbol || '').toUpperCase());
  if (looksLikeTicker) {
    found = rows.find((x) => getLoose(x) === targetLoose);
    if (found) return found;
    if (!allowName) return null;
  }

  // Fallback to name match (both directions to handle "Ltd" etc.)
  found = rows.find((x) => getNameLoose(x) === targetLoose);
  if (found) return found;
  found = rows.find((x) => getNameLoose(x).includes(targetLoose) || targetLoose.includes(getNameLoose(x)));
  if (found) return found;
  return null;
};

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
    const allowName = /[.:]/.test(String(symbol)) || String(symbol).includes(' ') || normalized.length > 6;
    const bySymbol = await queryStock(env, { symbol: normalized });
    const err = getError(bySymbol);
    if (err) lastError = err;
    const list = extractList(bySymbol);
    const item = bestMatch(list, symbol, { allowName }) || extractFirst(bySymbol);
    if (item) return item;
    const bySymbolRaw = await queryStock(env, { symbol });
    const errRaw = getError(bySymbolRaw);
    if (errRaw) lastError = errRaw;
    const listRaw = extractList(bySymbolRaw);
    const itemRaw = bestMatch(listRaw, symbol, { allowName }) || extractFirst(bySymbolRaw);
    if (itemRaw) return itemRaw;
    const byName = await queryStock(env, { name: normalized });
    const errName = getError(byName);
    if (errName) lastError = errName;
    const listName = extractList(byName);
    const itemName = bestMatch(listName, symbol, { allowName: true }) || extractFirst(byName);
    if (itemName) return itemName;
    const byNameRaw = await queryStock(env, { name: symbol });
    const errNameRaw = getError(byNameRaw);
    if (errNameRaw) lastError = errNameRaw;
    const listNameRaw = extractList(byNameRaw);
    const itemNameRaw = bestMatch(listNameRaw, symbol, { allowName: true }) || extractFirst(byNameRaw);
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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

    if (!env.STOCKTV_KEY) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing STOCKTV_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (path === '/quote') {
      const item = await resolveStock(env, { symbol, pid, name });
      if (!item || item.__error) {
        return new Response(
          JSON.stringify({ success: false, message: item?.__error || 'symbol/pid not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const price = toNum(pick(item, ['price', 'lastPrice', 'last', 'close', 'currentPrice']));
      const prev = toNum(pick(item, ['previousClose', 'prevClose', 'preClose']));
      const change = price != null && prev != null ? price - prev : toNum(pick(item, ['change']));
      const changePercent =
        change != null && prev ? (change / prev) * 100 : toNum(pick(item, ['changePercent', 'pChange']));

      return new Response(
        JSON.stringify({
          success: true,
          symbol: item.symbol || item.code || symbol || pid,
          pid: item.pid || item.id || null,
          name: item.name || null,
          price,
          previousClose: prev,
          change,
          changePercent,
          source: 'stocktv',
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (path === '/debug/list') {
      const exchangeId = url.searchParams.get('exchangeId') || env.STOCKTV_EXCHANGE_ID || '46';
      const page = Number(url.searchParams.get('page') || '1');
      const pageSize = Number(url.searchParams.get('pageSize') || '10');
      const list = await listStocks(env, page, pageSize, { exchangeId });
      const rows = extractList(list).map((x) => ({
        pid: x.pid || x.id,
        symbol: x.symbol || x.code || x.ticker || x.stockCode || x.shortCode,
        name: x.name,
      }));
      return new Response(
        JSON.stringify({
          success: true,
          exchangeId,
          count: rows.length,
          sample: rows,
          upstreamCode: list?.code ?? list?.status ?? null,
          upstreamMessage: list?.message ?? null,
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (path === '/debug/query') {
      const symbol = url.searchParams.get('symbol') || '';
      const name = url.searchParams.get('name') || '';
      const bySymbol = symbol ? await queryStock(env, { symbol }) : null;
      const byName = name ? await queryStock(env, { name }) : null;
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
      return new Response(
        JSON.stringify({
          success: true,
          symbol,
          name,
          symbolRows,
          nameRows,
          symbolUpstreamCode: bySymbol?.code ?? bySymbol?.status ?? null,
          symbolUpstreamMessage: bySymbol?.message ?? null,
          nameUpstreamCode: byName?.code ?? byName?.status ?? null,
          nameUpstreamMessage: byName?.message ?? null,
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (path === '/debug/search') {
      const query = (url.searchParams.get('query') || '').trim();
      const exchangeId = url.searchParams.get('exchangeId') || env.STOCKTV_EXCHANGE_ID || '46';
      const limit = Number(url.searchParams.get('limit') || '20');
      const maxPages = Number(env.STOCKTV_MAX_PAGES || 12);
      if (!query) {
        return new Response(
          JSON.stringify({ success: false, message: 'query required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
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
      return new Response(
        JSON.stringify({
          success: true,
          query,
          exchangeId,
          count: matches.length,
          matches,
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (path === '/kline') {
      const interval = mapInterval(url.searchParams.get('interval'));
      const item = pid ? { pid } : await resolveStock(env, { symbol, name });
      const usePid = item?.pid || item?.id;
      if (!usePid) {
        return new Response(
          JSON.stringify({ success: false, message: item?.__error || 'symbol/pid not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

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

      return new Response(
        JSON.stringify({
          success: true,
          symbol: k?.symbol || symbol || usePid,
          source: 'stocktv',
          data,
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
