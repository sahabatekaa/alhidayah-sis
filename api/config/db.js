require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;

// 👇 Ini yang diubah: Menyesuaikan dengan nama di dalam file .env Anda
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

// Peringatan jika .env kosong atau belum terbaca
if (!supabaseUrl || !supabaseKey) {
    console.error("❌ GAGAL: SUPABASE_URL atau SUPABASE_PUBLISHABLE_KEY tidak ditemukan. Cek file .env Anda.");
} else {
    console.log("✅ Kredensial Supabase berhasil dimuat dari .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
