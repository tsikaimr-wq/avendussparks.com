const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://gipxccfydceahzmqdoks.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpcHhjY2Z5ZGNlYWh6bXFkb2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjI2NDQsImV4cCI6MjA4NjAzODY0NH0.evPHM1GdBOufR2v2KYARiG8r81McUtUAPNVovn6P6-s";

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
