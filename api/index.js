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
// Mengarahkan Express untuk melayani file statis dari folder 'public'
app.use(express.static(path.join(__dirname, '../public')));

// --- Endpoint API (Health Check) ---
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'API Yayasan Al-Hidayah Amansari beroperasi secara optimal.',
        version: '1.0.0'
    });
});

// --- Fallback Route / 404 Handler ---
// Menggunakan app.use() agar kompatibel dengan standar Express v5
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});


// --- Jalankan Server ---
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan lokal di http://localhost:${PORT}`);
    // Panggil config database agar langsung melakukan pengecekan koneksi
    require('./config/db'); 
});
