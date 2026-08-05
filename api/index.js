const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares Utama ---
// Mengizinkan request dari origin lain
app.use(cors()); 
// Parsing payload JSON dari request body (penting untuk API & Form PPDB)
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// --- Setup Frontend (Vanilla HTML/CSS/JS) ---
// Mengarahkan Express untuk melayani file statis dari folder 'public' (Bekerja saat di Termux)
app.use(express.static(path.join(__dirname, '../public')));

// --- Endpoint API (Health Check) ---
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'API Yayasan Al-Hidayah Amansari beroperasi secara optimal.',
        version: '1.0.0'
    });
});

// Panggil koneksi database
const supabase = require('./config/db');

// --- Endpoint API (Cek Koneksi Supabase) ---
app.get('/api/cek-db', async (req, res) => {
    try {
        // Kita mencoba memanggil tabel bernama 'cek_jaringan' (meskipun tabel ini belum Anda buat)
        const { data, error } = await supabase.from('cek_jaringan').select('*').limit(1);

        if (error) {
            // Error dengan kode '42P01' (relation does not exist) dari PostgreSQL 
            // justru menandakan KONEKSI SUKSES, karena server Supabase berhasil merespons 
            // bahwa tabel tersebut belum ada.
            if (error.code === '42P01') {
                return res.json({ 
                    koneksi: "Sukses", 
                    pesan: "Berhasil terhubung ke database Supabase! (Namun tabel belum dibuat di Dashboard)" 
                });
            }
            
            // Jika error lain (misal: API key salah / URL salah)
            return res.status(400).json({ 
                koneksi: "Gagal", 
                pesan: error.message 
            });
        }

        res.json({ 
            koneksi: "Sukses", 
            pesan: "Berhasil terhubung ke Supabase dan data ditemukan!", 
            data 
        });

    } catch (err) {
        res.status(500).json({ koneksi: "Error Sistem", pesan: err.message });
    }
});


// --- Fallback Route / 404 Handler ---
// Menggunakan app.use() agar kompatibel dengan standar Express v5
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// --- JALANKAN SERVER (MODIFIKASI UNTUK VERCEL & TERMUX) ---
// Vercel secara otomatis mengatur NODE_ENV menjadi 'production' atau environment lain.
// Kondisi ini memastikan app.listen HANYA berjalan saat Anda jalankan manual di Termux.
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server berjalan lokal di http://localhost:${PORT}`);
        // Panggil config database agar langsung melakukan pengecekan koneksi
        require('./config/db'); 
    });
}

// WAJIB DITAMBAHKAN: Export app agar Vercel bisa menjalankan Express.js ini sebagai Serverless Function
module.exports = app;
