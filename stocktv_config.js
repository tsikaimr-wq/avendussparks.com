(function () {
window.STOCKTV_WORKER_BASE = window.STOCKTV_WORKER_BASE || 'https://api.avendussparks.com';
  const base = window.STOCKTV_WORKER_BASE.trim();
  if (!base) return;
  window.INDIA_MARKET_API_BASE = base.replace(/\/$/, '');
  window.ALLOW_LOCAL_MARKET_API = true;
  window.PREFER_INDIA_MARKET_API_BASE = true;
  window.ENABLE_SUPABASE_EDGE_FALLBACK = false;
  window.DISABLE_MARKET_DB = false;
})();
