// public/js/global-settings.js

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Tarik data publik dari backend (tanpa token karena ini untuk umum)
        const res = await fetch('/api/settings');
        const result = await res.json();

        if (result.success && result.data) {
            const data = result.data;

            // 1. FUNGSI HELPER: Menyuntikkan Teks ke HTML berdasarkan ID atau Class
            const injectText = (selectorName, text) => {
                document.querySelectorAll(`.${selectorName}`).forEach(el => {
                    el.innerText = text && text !== '-' ? text : '';
                });
            };

            // Inject Identitas & Kontak
            injectText('set-nama-yayasan', data.nama_yayasan);
            injectText('set-alamat', data.alamat_lengkap);
            injectText('set-telepon', data.telepon_resmi);
            injectText('set-email', data.email_resmi);
            injectText('set-npsn', data.npsn);
            
            // Inject Profil & Sambutan
            injectText('set-sejarah', data.sejarah_singkat);
            injectText('set-visi', data.visi);
            injectText('set-misi', data.misi);
            injectText('set-nama-kepsek-sd', data.nama_kepsek_sd);
            injectText('set-sambutan-kepsek-sd', data.sambutan_kepsek_sd);
            injectText('set-nama-kepsek-paud', data.nama_kepsek_paud);
            injectText('set-sambutan-kepsek-paud', data.sambutan_kepsek_paud);

            // 2. FUNGSI HELPER: Menyuntikkan URL ke Link & Gambar
            const injectLink = (selectorName, url) => {
                document.querySelectorAll(`.${selectorName}`).forEach(el => {
                    if (url && url !== '-') {
                        el.href = url;
                    } else {
                        el.style.display = 'none'; // Sembunyikan ikon jika link kosong di CMS
                    }
                });
            };

            injectLink('set-link-ig', data.instagram);
            injectLink('set-link-fb', data.facebook);
            injectLink('set-link-yt', data.youtube);
            injectLink('set-link-maps', data.google_maps);

            // Inject Foto Kepala Sekolah
            document.querySelectorAll('.set-foto-kepsek-sd').forEach(img => {
                if (data.foto_kepsek_sd) img.src = data.foto_kepsek_sd;
            });
            document.querySelectorAll('.set-foto-kepsek-paud').forEach(img => {
                if (data.foto_kepsek_paud) img.src = data.foto_kepsek_paud;
            });

            // ====================================================================
            // 3. LOGIKA SAKLAR PPDB (KHUSUS UNTUK HALAMAN ppdb.html)
            // ====================================================================
            const formArea = document.getElementById('area-form-ppdb');
            const alertArea = document.getElementById('area-alert-ppdb');
            const alertText = document.getElementById('teks-alert-ppdb');

            // Jika elemen form ppdb ditemukan di halaman ini...
            if (formArea && alertArea) {
                if (data.is_ppdb_open === true) {
                    // Jika BUKA: Tampilkan Form, Sembunyikan Peringatan
                    formArea.style.display = 'block';
                    alertArea.style.display = 'none';
                } else {
                    // Jika TUTUP: Sembunyikan Form, Tampilkan Peringatan
                    formArea.style.display = 'none';
                    alertArea.style.display = 'block';
                    if(alertText) alertText.innerText = data.teks_pengumuman || "Mohon maaf, pendaftaran sedang ditutup.";
                }
            }
        }
    } catch (err) {
        console.error("Gagal menarik pengaturan web:", err);
    }
});
