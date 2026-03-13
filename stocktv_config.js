(function () {
  const upstreamBase = 'https://api.avendussparks.com';
  const configuredBase = typeof window.STOCKTV_WORKER_BASE === 'string'
    ? window.STOCKTV_WORKER_BASE.trim()
    : '';
  const base = (configuredBase || upstreamBase).replace(/\/$/, '');

  if (!base) return;

  window.STOCKTV_UPSTREAM_BASE = upstreamBase;
  window.STOCKTV_WORKER_BASE = base;
  window.INDIA_MARKET_API_BASE = base;
  window.ALLOW_LOCAL_MARKET_API = true;
  window.PREFER_INDIA_MARKET_API_BASE = true;
  window.ENABLE_SUPABASE_EDGE_FALLBACK = false;
  window.DISABLE_MARKET_DB = false;
})();
