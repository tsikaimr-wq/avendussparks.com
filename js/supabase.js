console.log("🔥 supabase.js LOADED");
/**
 * Supabase Client Initialization
 * Hardened for production stability.
 */
const SUPABASE_URL = "https://xizuwvmepfcfodwfwqce.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gj30etPyQjlvfH062VUeSw_F83Eii85";

console.log("ACTIVE SUPABASE URL:", SUPABASE_URL);

// Expose project settings for static pages that call edge functions directly.
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
if (!window.INDIA_MARKET_API_BASE) {
    window.INDIA_MARKET_API_BASE = `${SUPABASE_URL}/functions/v1`;
}

// Force initialization as requested
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("🔥 Supabase Client Ready:", window.supabaseClient);

console.log("Client Project URL:", window.supabaseClient?.supabaseUrl);
console.log("Supabase Client Hardened & Initialized.");
