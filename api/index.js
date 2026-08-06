const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // DITAMBAHKAN: Pustaka untuk menangani form-data & file upload
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
// Parsing payload JSON dari request body (Tidak akan memblokir Multer)
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

// ============================================================================
// KONFIGURASI MULTER & SUPABASE STORAGE (UNTUK PPDB)
// ============================================================================
const storage = multer.memoryStorage(); // Simpan di RAM sementara (cocok untuk Vercel)
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 } // Batas 2MB per file
});

// Fungsi pembantu untuk mengunggah file ke Supabase Storage
async function uploadToSupabaseStorage(file, folderName, identifier) {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folderName}/${Date.now()}_${identifier}.${fileExtension}`;
    
    const { data, error } = await supabase.storage
        .from('dokumen-ppdb') // Pastikan bucket ini sudah dibuat dan di-set Public di Supabase
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
        .from('dokumen-ppdb')
        .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
}

// --- Endpoint API (Submit Form PPDB dengan File Upload) ---
app.post('/api/ppdb', upload.fields([
    { name: 'berkas_kk', maxCount: 1 },
    { name: 'berkas_akta', maxCount: 1 }
]), async (req, res) => {
    try {
        // 1. Menangkap Data Teks
        const { jenjang, nama, nik_siswa, jenis_kelamin, tempat_lahir, tanggal_lahir, ortu, wa, alamat } = req.body;

        // 2. Validasi File
        const fileKK = req.files && req.files['berkas_kk'] ? req.files['berkas_kk'][0] : null;
        const fileAkta = req.files && req.files['berkas_akta'] ? req.files['berkas_akta'][0] : null;

        if (!fileKK || !fileAkta) {
            return res.status(400).json({ 
                success: false, 
                pesan: "Berkas Kartu Keluarga dan Akta Kelahiran wajib diunggah." 
            });
        }

        // 3. Upload File ke Supabase Storage
        const urlKK = await uploadToSupabaseStorage(fileKK, 'kk', nik_siswa);
        const urlAkta = await uploadToSupabaseStorage(fileAkta, 'akta', nik_siswa);

        // 4. Masukkan ke Database Supabase (Tabel: ppdb)
        const { data, error: dbError } = await supabase
            .from('ppdb') // Pastikan tabel ini sudah ada di database Anda
            .insert([
                {
                    jenjang: jenjang,
                    nama: nama,
                    nik_siswa: nik_siswa,
                    jenis_kelamin: jenis_kelamin,
                    tempat_lahir: tempat_lahir,
                    tanggal_lahir: tanggal_lahir,
                    ortu: ortu,
                    wa: wa,
                    alamat: alamat,
                    berkas_kk: urlKK,       
                    berkas_akta: urlAkta,   
                    status: 'Pending'       
                }
            ]);

        if (dbError) throw dbError;

        // 5. Kirim Respon Sukses
        res.status(201).json({
            success: true,
            pesan: `Pendaftaran atas nama ${nama} berhasil kami terima!`
        });

    } catch (err) {
        console.error("Error Sistem PPDB:", err);
        res.status(500).json({ 
            success: false, 
            pesan: 'Terjadi kesalahan pada server backend: ' + err.message 
        });
    }
});


// ============================================================================
// MIDDLEWARE KEAMANAN (VERIFIKASI JWT)
// ============================================================================
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ success: false, pesan: 'Akses ditolak. Token tidak ditemukan.' });

    try {
        const tokenString = token.split(' ')[1];
        const decoded = jwt.verify(tokenString, JWT_SECRET);
        req.user = decoded; 
        next(); 
    } catch (err) {
        return res.status(401).json({ success: false, pesan: 'Sesi berakhir atau token tidak valid.' });
    }
};


// ============================================================================
// ENDPOINT ADMIN CMS (CRUD DATA PPDB)
// ============================================================================

// Mengambil seluruh data PPDB dari Supabase
app.get('/api/admin/ppdb', verifyToken, async (req, res) => {
    try {
        // Ambil data dari tabel 'ppdb', urutkan dari yang paling baru mendaftar
        const { data, error } = await supabase
            .from('ppdb')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: data
        });
    } catch (err) {
        console.error("Error Get PPDB:", err);
        res.status(500).json({ success: false, pesan: 'Gagal mengambil data dari database.' });
    }
});

// Mengubah Status Pendaftar PPDB (Diterima / Ditolak / Pending)
app.put('/api/admin/ppdb/:id/status', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validasi
        if (!status) {
            return res.status(400).json({ success: false, pesan: 'Status baru wajib diisi.' });
        }

        // Update data di Supabase
        const { data, error } = await supabase
            .from('ppdb')
            .update({ status: status })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({ 
            success: true, 
            pesan: `Status pendaftaran berhasil diubah menjadi ${status}.`,
            data: data
        });
    } catch (err) {
        console.error("Error Update Status PPDB:", err);
        res.status(500).json({ success: false, pesan: 'Gagal mengubah status di database.' });
    }
});

// ============================================================================
// ENDPOINT SUPERADMIN (AUTENTIKASI & SETUP)
// ============================================================================

// 1. Endpoint Login Admin
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: user, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ success: false, pesan: 'Email tidak terdaftar.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, pesan: 'Password salah.' });
        }

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
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

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
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ 
            success: false, 
            pesan: '404 - Endpoint API tidak ditemukan.' 
        });
    }
    
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
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server berjalan lokal di http://localhost:${PORT}`);
        require('./config/db'); 
    });
}

// 1. Menghapus satu data PPDB berdasarkan ID
app.delete('/api/admin/ppdb/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('ppdb')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, pesan: 'Data pendaftar berhasil dihapus.' });
    } catch (err) {
        console.error("Error Delete PPDB:", err);
        res.status(500).json({ success: false, pesan: 'Gagal menghapus data dari database.' });
    }
});

// 2. Menghapus seluruh data PPDB (Reset untuk Tahun Ajaran Baru)
app.delete('/api/admin/ppdb-reset', verifyToken, async (req, res) => {
    try {
        // Menghapus semua baris di tabel ppdb
        const { error } = await supabase
            .from('ppdb')
            .delete()
            .neq('id', 0); // Kondisi agar Supabase mengizinkan hapus massal

        if (error) throw error;

        res.json({ success: true, pesan: 'Semua data PPDB berhasil dikosongkan untuk tahun ajaran baru.' });
    } catch (err) {
        console.error("Error Reset PPDB:", err);
        res.status(500).json({ success: false, pesan: 'Gagal mengosongkan data database.' });
    }
});

module.exports = app;
