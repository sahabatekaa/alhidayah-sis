const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ============================================================================
// MODUL KEAMANAN (JWT & BCRYPT)
// ============================================================================
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_yayasan_al_hidayah_amansari_2026';

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

// --- Endpoint API (Submit Form PPDB) ---
app.post('/api/ppdb', async (req, res) => {
    try {
        // Mengambil data yang dikirim dari formulir HTML (Frontend)
        const { unit_id, student_data } = req.body;

        // Validasi dasar: pastikan data tidak kosong
        if (!unit_id || !student_data) {
            return res.status(400).json({
                success: false,
                pesan: 'Data unit_id dan data siswa wajib diisi!'
            });
        }

        // Proses memasukkan data ke Supabase
        const { data, error } = await supabase
            .from('ppdb_registrations')
            .insert([
                { 
                    unit_id: parseInt(unit_id), 
                    student_data: student_data,
                    status: 'PENDING' // Status default
                }
            ])
            .select(); // select() berguna untuk mengembalikan data yang baru saja masuk

        // Jika Supabase menolak atau terjadi error database
        if (error) {
            console.error("Error dari Supabase:", error.message);
            return res.status(500).json({ 
                success: false, 
                pesan: "Gagal menyimpan ke database", 
                error: error.message 
            });
        }

        // Jika berhasil
        res.status(201).json({
            success: true,
            pesan: 'Pendaftaran PPDB berhasil disubmit!',
            data: data
        });

    } catch (err) {
        console.error("Error Sistem:", err);
        res.status(500).json({ 
            success: false, 
            pesan: 'Terjadi kesalahan pada server backend.' 
        });
    }
});


// ============================================================================
// MIDDLEWARE KEAMANAN (VERIFIKASI JWT)
// (Gunakan ini nanti untuk memproteksi rute CRUD CMS)
// ============================================================================
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ success: false, pesan: 'Akses ditolak. Token tidak ditemukan.' });

    try {
        // Format token dari frontend: "Bearer <token>"
        const tokenString = token.split(' ')[1];
        const decoded = jwt.verify(tokenString, JWT_SECRET);
        req.user = decoded; // Menyimpan data user (id, role, unit) ke request
        next(); // Lanjut ke proses berikutnya
    } catch (err) {
        return res.status(401).json({ success: false, pesan: 'Sesi berakhir atau token tidak valid.' });
    }
};

// ============================================================================
// ENDPOINT SUPERADMIN (AUTENTIKASI & SETUP)
// ============================================================================

// 1. Endpoint Login Admin
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Cari user berdasarkan email di Supabase
        const { data: user, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ success: false, pesan: 'Email tidak terdaftar.' });
        }

        // Verifikasi Password menggunakan bcrypt
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, pesan: 'Password salah.' });
        }

        // Buat Token JWT yang berlaku selama 8 jam
        const token = jwt.sign(
            { id: user.id, role: user.role, unit_id: user.unit_id }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            pesan: 'Login berhasil!',
            token: token,
            user: {
                full_name: user.full_name,
                role: user.role,
                unit_id: user.unit_id
            }
        });

    } catch (err) {
        console.error("Error Login:", err);
        res.status(500).json({ success: false, pesan: 'Terjadi kesalahan pada server.' });
    }
});


// 2. Endpoint Setup Awal (Hanya dijalankan 1x untuk generate password)
app.get('/api/admin/setup', async (req, res) => {
    try {
        // Enkripsi password "admin123"
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        // Update akun superadmin default di Supabase
        const { data, error } = await supabase
            .from('user_profiles')
            .update({ password_hash: hashedPassword })
            .eq('email', 'admin@alhidayahamansari.sch.id');

        if (error) throw error;

        res.json({ 
            success: true, 
            pesan: 'Setup Berhasil! Silakan login menggunakan email: admin@alhidayahamansari.sch.id dan password: admin123' 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, pesan: 'Gagal melakukan setup password.' });
    }
});


// --- Fallback Route / 404 Handler (DIPERBAIKI) ---
app.use((req, res) => {
    // 1. Jika URL yang gagal diakses adalah jalur API (/api/...)
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ 
            success: false, 
            pesan: '404 - Endpoint API tidak ditemukan.' 
        });
    }
    
    // 2. Jika URL yang gagal diakses adalah area CMS Admin (/admin/...)
    if (req.originalUrl.startsWith('/admin/')) {
        return res.status(404).send(`
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; text-align: center; padding: 100px 20px; background: #f1f5f9; height: 100vh; box-sizing: border-box;">
                <h1 style="color: #0f172a; font-size: 3rem; margin-bottom: 10px;">404</h1>
                <h2 style="color: #ef4444; margin-top: 0;">Halaman Admin Belum Dibuat</h2>
                <p style="color: #64748b; margin-bottom: 30px;">File HTML untuk tautan yang Anda tuju belum ada di dalam folder <b>public/admin/</b>.</p>
                <a href="/admin/dashboard.html" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">&larr; Kembali ke Dashboard</a>
            </div>
        `);
    }

    // 3. Jika URL yang gagal diakses adalah area publik (Pengunjung umum salah ketik URL)
    res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 100px 20px;">
            <h2 style="color: #0f172a;">404 - Halaman Tidak Ditemukan</h2>
            <p style="color: #64748b;">Halaman Yayasan Al-Hidayah Amansari yang Anda cari tidak tersedia.</p>
            <br>
            <a href="/" style="color: #10b981; text-decoration: none; font-weight: bold;">&larr; Kembali ke Beranda Utama</a>
        </div>
    `);
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
