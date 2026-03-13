const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://xizuwvmepfcfodwfwqce.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gj30etPyQjlvfH062VUeSw_F83Eii85";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkCache() {
    console.log("Checking market_cache...");
    const { data, error } = await supabase
        .from('market_cache')
        .select('*');

    if (error) {
        console.error("Error fetching market_cache:", error);
    } else {
        console.log("Market Cache Data:");
        console.table(data);
    }

    console.log("\nChecking products with types:");
    const { data: products, error: prodError } = await supabase
        .from('products')
        .select('name, market_symbol, price, product_type');

    if (prodError) {
        console.error("Error fetching products:", prodError);
    } else {
        console.log("Products Data:");
        console.table(products);
    }
}

checkCache();
