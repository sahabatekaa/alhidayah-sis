const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); 
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
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// --- Endpoint API (Health Check) ---
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'API Yayasan Al-Hidayah Amansari beroperasi secara optimal.',
        version: '1.0.0'
    });
});

const supabase = require('./config/db');

// ============================================================================
// KONFIGURASI MULTER & SUPABASE STORAGE (UNTUK PPDB)
// ============================================================================
const storage = multer.memoryStorage(); 
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 } 
});

async function uploadToSupabaseStorage(file, folderName, identifier) {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folderName}/${Date.now()}_${identifier}.${fileExtension}`;
    
    const { data, error } = await supabase.storage
        .from('dokumen-ppdb') 
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
        const { jenjang, nama, nik_siswa, jenis_kelamin, tempat_lahir, tanggal_lahir, ortu, wa, alamat } = req.body;
        const fileKK = req.files && req.files['berkas_kk'] ? req.files['berkas_kk'][0] : null;
        const fileAkta = req.files && req.files['berkas_akta'] ? req.files['berkas_akta'][0] : null;

        if (!fileKK || !fileAkta) {
            return res.status(400).json({ success: false, pesan: "Berkas Kartu Keluarga dan Akta Kelahiran wajib diunggah." });
        }

        const urlKK = await uploadToSupabaseStorage(fileKK, 'kk', nik_siswa);
        const urlAkta = await uploadToSupabaseStorage(fileAkta, 'akta', nik_siswa);

        const { data, error: dbError } = await supabase
            .from('ppdb') 
            .insert([{
                jenjang: jenjang, nama: nama, nik_siswa: nik_siswa, jenis_kelamin: jenis_kelamin,
                tempat_lahir: tempat_lahir, tanggal_lahir: tanggal_lahir, ortu: ortu, wa: wa,
                alamat: alamat, berkas_kk: urlKK, berkas_akta: urlAkta, status: 'Pending'       
            }]);

        if (dbError) throw dbError;

        res.status(201).json({ success: true, pesan: `Pendaftaran atas nama ${nama} berhasil kami terima!` });
    } catch (err) {
        console.error("Error Sistem PPDB:", err);
        res.status(500).json({ success: false, pesan: 'Terjadi kesalahan pada server backend: ' + err.message });
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

// 1. Mengambil seluruh data PPDB dari Supabase
app.get('/api/admin/ppdb', verifyToken, async (req, res) => {
    try {
        const { data, error } = await supabase.from('ppdb').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: data });
    } catch (err) {
        console.error("Error Get PPDB:", err);
        res.status(500).json({ success: false, pesan: 'Gagal mengambil data dari database.' });
    }
});

// 2. Mengubah Status Pendaftar PPDB
app.put('/api/admin/ppdb/:id/status', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) return res.status(400).json({ success: false, pesan: 'Status baru wajib diisi.' });

        const { data, error } = await supabase.from('ppdb').update({ status: status }).eq('id', id).select();
        if (error) throw error;
        res.json({ success: true, pesan: `Status pendaftaran berhasil diubah menjadi ${status}.`, data: data });
    } catch (err) {
        console.error("Error Update Status PPDB:", err);
        res.status(500).json({ success: false, pesan: 'Gagal mengubah status di database.' });
    }
});

// 3. Menghapus SELURUH data PPDB (Reset) -> POSISI WAJIB DI SINI
app.delete('/api/admin/ppdb-reset', verifyToken, async (req, res) => {
    try {
        const { error } = await supabase.from('ppdb').delete().neq('id', 0); 
        if (error) throw error;
        res.json({ success: true, pesan: 'Semua data PPDB berhasil dikosongkan untuk tahun ajaran baru.' });
    } catch (err) {
        console.error("Error Reset PPDB:", err);
        res.status(500).json({ success: false, pesan: 'Gagal mengosongkan data database.' });
    }
});

// 4. Menghapus SATU data PPDB -> POSISI WAJIB DI BAWAH RESET
app.delete('/api/admin/ppdb/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('ppdb').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, pesan: 'Data pendaftar berhasil dihapus.' });
    } catch (err) {
        console.error("Error Delete PPDB:", err);
        res.status(500).json({ success: false, pesan: 'Gagal menghapus data dari database.' });
    }
});


// ============================================================================
// ENDPOINT SUPERADMIN (AUTENTIKASI & SETUP)
// ============================================================================

app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const { data: user, error } = await supabase.from('user_profiles').select('*').eq('email', email).single();
        
        if (error || !user) return res.status(401).json({ success: false, pesan: 'Email tidak terdaftar.' });
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ success: false, pesan: 'Password salah.' });

        const token = jwt.sign({ id: user.id, role: user.role, unit_id: user.unit_id }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ success: true, pesan: 'Login berhasil!', token: token, user: { full_name: user.full_name, role: user.role, unit_id: user.unit_id } });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Terjadi kesalahan pada server.' });
    }
});

app.get('/api/admin/setup', async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        const { error } = await supabase.from('user_profiles').update({ password_hash: hashedPassword }).eq('email', 'admin@alhidayahamansari.sch.id');
        if (error) throw error;
        res.json({ success: true, pesan: 'Setup Berhasil! Silakan login menggunakan email: admin@alhidayahamansari.sch.id dan password: admin123' });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal melakukan setup password.' });
    }
});

// ============================================================================
// ENDPOINT DASHBOARD UTAMA
// ============================================================================
app.get('/api/admin/dashboard-stats', verifyToken, async (req, res) => {
    try {
        // Mengambil semua status dari tabel PPDB untuk dihitung
        const { data: ppdbData, error: ppdbError } = await supabase
            .from('ppdb')
            .select('status');

        if (ppdbError) throw ppdbError;

        // Menghitung statistik
        const totalPPDB = ppdbData.length;
        const pendingPPDB = ppdbData.filter(item => item.status === 'Pending').length;
        const diterimaPPDB = ppdbData.filter(item => item.status === 'Diterima').length;
        const ditolakPPDB = ppdbData.filter(item => item.status === 'Ditolak').length;

        // Kirim data ke frontend
        res.json({
            success: true,
            data: {
                ppdb: {
                    total: totalPPDB,
                    pending: pendingPPDB,
                    diterima: diterimaPPDB,
                    ditolak: ditolakPPDB
                }
            }
        });
    } catch (err) {
        console.error("Error Get Stats:", err);
        res.status(500).json({ success: false, pesan: 'Gagal mengambil data statistik dashboard.' });
    }
});

// ============================================================================
// ENDPOINT PENGATURAN WEB (DIUPGRADE DENGAN FOTO & PROFIL LENGKAP)
// ============================================================================

app.get('/api/settings', async (req, res) => {
    try {
        const { data, error } = await supabase.from('web_settings').select('*').eq('id', 1).single();
        if (error) throw error;
        res.json({ success: true, data: data });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal mengambil pengaturan web.' });
    }
});

// Menggunakan multer (upload.fields) agar bisa menerima file gambar
app.put('/api/admin/settings', verifyToken, upload.fields([
    { name: 'foto_kepsek_sd', maxCount: 1 },
    { name: 'foto_kepsek_paud', maxCount: 1 }
]), async (req, res) => {
    try {
        const body = req.body;
        
        let updateData = {
            nama_yayasan: body.nama_yayasan, npsn: body.npsn,
            telepon_resmi: body.telepon_resmi, email_resmi: body.email_resmi,
            alamat_lengkap: body.alamat_lengkap, google_maps: body.google_maps,
            facebook: body.facebook, instagram: body.instagram, youtube: body.youtube,
            nama_kepsek_sd: body.nama_kepsek_sd, sambutan_kepsek_sd: body.sambutan_kepsek_sd,
            nama_kepsek_paud: body.nama_kepsek_paud, sambutan_kepsek_paud: body.sambutan_kepsek_paud,
            sejarah_singkat: body.sejarah_singkat, visi: body.visi, misi: body.misi,
            is_ppdb_open: body.is_ppdb_open === 'true', teks_pengumuman: body.teks_pengumuman,
            tahun_ajaran: body.tahun_ajaran, updated_at: new Date()
        };

        // Jika ada file foto yang diunggah, proses ke Supabase Storage
        if (req.files) {
            if (req.files['foto_kepsek_sd']) {
                updateData.foto_kepsek_sd = await uploadToSupabaseStorage(req.files['foto_kepsek_sd'][0], 'profil', 'kepsek_sd');
            }
            if (req.files['foto_kepsek_paud']) {
                updateData.foto_kepsek_paud = await uploadToSupabaseStorage(req.files['foto_kepsek_paud'][0], 'profil', 'kepsek_paud');
            }
        }

        const { data, error } = await supabase.from('web_settings').update(updateData).eq('id', 1).select();
        if (error) throw error;
        
        res.json({ success: true, pesan: 'Pengaturan sistem berhasil diperbarui!', data: data[0] });
    } catch (err) {
        console.error("Error Update Settings:", err);
        res.status(500).json({ success: false, pesan: 'Gagal menyimpan pengaturan web.' });
    }
});

// ============================================================================
// ENDPOINT BANNER & PENGUMUMAN DIGITAL
// ============================================================================

// 1. [PUBLIK] Mengambil Banner yang Sedang Aktif Sesuai Waktu (Auto-Timer)
app.get('/api/banners', async (req, res) => {
    try {
        const now = new Date().toISOString();
        
        const { data, error } = await supabase
            .from('banners')
            .select('*')
            .eq('is_active', true)
            .lte('waktu_mulai', now)      // Waktu mulai sudah terlewati (sudah masuk jadwal)
            .gte('waktu_selesai', now)    // Waktu selesai belum terlewati (belum kedaluwarsa)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data: data });
    } catch (err) {
        console.error("Error Get Banners:", err);
        res.status(500).json({ success: false, pesan: 'Gagal memuat banner.' });
    }
});

// 2. [ADMIN] Mengambil Semua Banner (Termasuk yang sudah kedaluwarsa)
app.get('/api/admin/banners', verifyToken, async (req, res) => {
    try {
        const { data, error } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: data });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal mengambil data banner.' });
    }
});

// 3. [ADMIN] Upload & Simpan Banner Baru
app.post('/api/admin/banners', verifyToken, upload.single('gambar_banner'), async (req, res) => {
    try {
        const { judul, posisi, link_url, waktu_mulai, waktu_selesai } = req.body;
        const fileGambar = req.file;

        if (!fileGambar) {
            return res.status(400).json({ success: false, pesan: "Gambar banner wajib diunggah." });
        }

        // Upload ke Supabase Storage (Buat bucket 'banner-web' di Supabase Anda)
        const gambarUrl = await uploadToSupabaseStorage(fileGambar, 'pengumuman', `banner_${Date.now()}`);

        const { data, error } = await supabase
            .from('banners')
            .insert([{
                judul, 
                posisi, 
                link_url: link_url || '#', 
                waktu_mulai, 
                waktu_selesai, 
                gambar_url: gambarUrl
            }]);

        if (error) throw error;
        res.status(201).json({ success: true, pesan: 'Banner berhasil dijadwalkan!' });
    } catch (err) {
        console.error("Error Upload Banner:", err);
        res.status(500).json({ success: false, pesan: 'Gagal menyimpan banner: ' + err.message });
    }
});

// 4. [ADMIN] Hapus Banner
app.delete('/api/admin/banners/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('banners').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, pesan: 'Banner berhasil dihapus.' });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal menghapus banner.' });
    }
});

// ============================================================================
// ENDPOINT BERITA & INFORMASI (BLOG SYSTEM)
// ============================================================================

// 1. [PUBLIK] Mengambil Berita (HANYA YANG STATUSNYA 'Publish')
app.get('/api/berita', async (req, res) => {
    try {
        const { kategori } = req.query;
        let query = supabase.from('berita')
            .select('id, judul, slug, kategori, foto_cover, penulis, created_at, konten')
            .eq('status', 'Publish') // <-- Filter wajib Publish
            .order('created_at', { ascending: false });
        
        if (kategori) query = query.eq('kategori', kategori);

        const { data, error } = await query;
        if (error) throw error;
        res.json({ success: true, data: data });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal memuat berita.' });
    }
});

// 2. [PUBLIK] Mengambil Detail Berita (Hanya jika Publish)
app.get('/api/berita/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { data, error } = await supabase.from('berita').select('*').eq('slug', slug).eq('status', 'Publish').single();
        
        if (error || !data) return res.status(404).json({ success: false, pesan: 'Berita tidak ditemukan atau belum dipublish.' });
        res.json({ success: true, data: data });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Terjadi kesalahan pada server.' });
    }
});

// 3. [ADMIN] Mengambil Semua Berita (Termasuk Pending)
app.get('/api/admin/berita', verifyToken, async (req, res) => {
    try {
        const { data, error } = await supabase.from('berita').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: data });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal mengambil data berita.' });
    }
});

// 4. [ADMIN] Upload Berita Baru (Otomatis masuk 'Pending')
app.post('/api/admin/berita', verifyToken, upload.single('foto_cover'), async (req, res) => {
    try {
        const { judul, kategori, konten, penulis } = req.body;
        const fileGambar = req.file;

        if (!fileGambar) return res.status(400).json({ success: false, pesan: "Foto cover wajib diunggah." });

        const slug = judul.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);
        const fotoUrl = await uploadToSupabaseStorage(fileGambar, 'berita', `cover_${Date.now()}`);

        const { error } = await supabase.from('berita').insert([{
            judul, slug, kategori, konten, penulis, foto_cover: fotoUrl, status: 'Pending'
        }]);

        if (error) throw error;
        res.status(201).json({ success: true, pesan: 'Draft Berita berhasil disimpan (Pending)!' });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal menyimpan berita: ' + err.message });
    }
});

// 5. [ADMIN] Update Berita Penuh (Edit Form)
app.put('/api/admin/berita/:id', verifyToken, upload.single('foto_cover'), async (req, res) => {
    try {
        const { id } = req.params;
        const { judul, kategori, konten } = req.body;
        
        let updateData = { judul, kategori, konten, updated_at: new Date() };

        // Jika ada foto baru yang diunggah, perbarui link gambarnya
        if (req.file) {
            updateData.foto_cover = await uploadToSupabaseStorage(req.file, 'berita', `cover_${Date.now()}`);
        }

        const { error } = await supabase.from('berita').update(updateData).eq('id', id);
        if (error) throw error;
        res.json({ success: true, pesan: 'Berita berhasil diperbarui!' });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal mengupdate berita.' });
    }
});

// 6. [ADMIN] Ubah Status Berita (Publish / Pending)
app.put('/api/admin/berita/:id/status', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { error } = await supabase.from('berita').update({ status }).eq('id', id);
        if (error) throw error;
        res.json({ success: true, pesan: `Status berita berhasil diubah menjadi ${status}!` });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal mengubah status.' });
    }
});

// 7. [ADMIN] Hapus Berita
app.delete('/api/admin/berita/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('berita').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, pesan: 'Berita berhasil dihapus.' });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal menghapus berita.' });
    }
});

// ============================================================================
// ENDPOINT GALERI KEGIATAN & FASILITAS
// ============================================================================

// 1. [PUBLIK & ADMIN] Mengambil Semua Foto (Dengan opsi filter kategori)
app.get('/api/galeri', async (req, res) => {
    try {
        const { kategori } = req.query;
        let query = supabase.from('galeri').select('*').order('created_at', { ascending: false });
        
        if (kategori && kategori !== 'Semua') {
            query = query.eq('kategori', kategori);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json({ success: true, data: data });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal memuat galeri foto.' });
    }
});

// 2. [ADMIN] Upload Foto ke Galeri
app.post('/api/admin/galeri', verifyToken, upload.single('file_gambar'), async (req, res) => {
    try {
        const { judul, kategori } = req.body;
        const fileGambar = req.file;

        if (!fileGambar) return res.status(400).json({ success: false, pesan: "File foto wajib diunggah." });

        // Upload ke Supabase Storage (Menggunakan folder 'galeri')
        const gambarUrl = await uploadToSupabaseStorage(fileGambar, 'galeri', `foto_${Date.now()}`);

        const { error } = await supabase.from('galeri').insert([{
            judul, kategori, gambar_url: gambarUrl
        }]);

        if (error) throw error;
        res.status(201).json({ success: true, pesan: 'Foto berhasil ditambahkan ke Galeri!' });
    } catch (err) {
        console.error("Error Upload Galeri:", err);
        res.status(500).json({ success: false, pesan: 'Gagal mengunggah foto.' });
    }
});

// 3. [ADMIN] Hapus Foto dari Galeri
app.delete('/api/admin/galeri/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('galeri').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, pesan: 'Foto berhasil dihapus.' });
    } catch (err) {
        res.status(500).json({ success: false, pesan: 'Gagal menghapus foto.' });
    }
});

//   ============================================================================
// FALLBACK ROUTE / 404 HANDLER -> POSISI WAJIB PALING BAWAH
// ============================================================================
app.use((req, res) => {
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ success: false, pesan: '404 - Endpoint API tidak ditemukan.' });
    }
    
    if (req.originalUrl.startsWith('/admin/')) {
        return res.status(404).send(`
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; text-align: center; padding: 100px 20px; background: #f1f5f9; height: 100vh; box-sizing: border-box;">
                <h1 style="color: #0f172a; font-size: 3rem; margin-bottom: 10px;">404</h1>
                <h2 style="color: #ef4444; margin-top: 0;">Halaman Admin Belum Dibuat</h2>
                <a href="/admin/dashboard.html" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">&larr; Kembali ke Dashboard</a>
            </div>
        `);
    }

    res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 100px 20px;">
            <h2 style="color: #0f172a;">404 - Halaman Tidak Ditemukan</h2>
            <a href="/" style="color: #10b981; text-decoration: none; font-weight: bold;">&larr; Kembali ke Beranda Utama</a>
        </div>
    `);
});


// --- JALANKAN SERVER ---
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server berjalan lokal di http://localhost:${PORT}`);
        require('./config/db'); 
    });
}

module.exports = app;
