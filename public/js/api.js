/**
 * ============================================================================
 * FILE: public/js/api.js
 * DESKRIPSI: Menangani komunikasi Fetch API dari Frontend ke Backend Vercel
 * ============================================================================
 */

// Menggunakan path relatif karena vercel.json sudah mengatur rewrite
const API_BASE_URL = '/api'; 

/**
 * 1. FUNGSI CEK STATUS API (Health Check)
 * Berguna untuk memastikan backend menyala dan merespons dengan baik.
 */
async function checkApiStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/status`);
        const data = await response.json();
        console.log('✅ Status Server:', data.message);
        return data.success;
    } catch (error) {
        console.error('❌ Koneksi ke API gagal:', error);
        return false;
    }
}

/**
 * 2. FUNGSI SUBMIT PENDAFTARAN PPDB KE DATABASE
 * Mengirim FormData (berisi teks & file) ke Supabase via Express
 */
async function submitPPDBRegistration(formData) {
    try {
        const response = await fetch(`${API_BASE_URL}/ppdb`, {
            method: 'POST',
            // PENTING: Saat mengirim FormData (terutama yang berisi File), 
            // JANGAN atur 'Content-Type' secara manual. 
            // Browser akan otomatis menyetelnya menjadi 'multipart/form-data' beserta boundary-nya.
            headers: {
                'Accept': 'application/json'
            },
            body: formData // Langsung kirim objek FormData mentah, BUKAN JSON.stringify()
        });

        const result = await response.json();
        
        // Tangkap jika status HTTP bukan 200/201 (misal: 400 Bad Request atau 500 Server Error)
        if (!response.ok) {
            throw new Error(result.pesan || 'Terjadi kesalahan pada server saat memproses data.');
        }

        return result; 
        
    } catch (error) {
        console.error('Error saat submit form PPDB:', error);
        return {
            success: false,
            pesan: error.message || 'Gagal terhubung ke server. Silakan coba lagi nanti.'
        };
    }
}

/**
 * 3. FUNGSI INTERAKSI FORM HTML (DOM Manipulation)
 * Mengaitkan fungsi Fetch API ke form pendaftaran di ppdb.html
 */
function initPPDBForm() {
    const formPPDB = document.getElementById('form-ppdb'); 
    
    // Jika tidak berada di halaman PPDB, abaikan fungsi ini
    if (!formPPDB) return;

    formPPDB.addEventListener('submit', async (e) => {
        // Cegah halaman melakukan refresh (perilaku default form)
        e.preventDefault();

        // Ambil elemen tombol submit untuk memberikan efek loading
        const submitBtn = document.getElementById('btn-submit-ppdb');
        const originalBtnText = submitBtn.innerHTML;
        
        // Ubah status tombol agar user tidak melakukan klik ganda (Double Submit)
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengunggah Berkas...';
        submitBtn.style.opacity = '0.7';
        submitBtn.style.cursor = 'not-allowed';

        // Kumpulkan SEMUA input dari form secara otomatis (Termasuk Input Teks & Input File)
        const formData = new FormData(formPPDB);

        // 🚀 Eksekusi pemanggilan API
        const response = await submitPPDBRegistration(formData);

        // Kembalikan status tombol seperti semula
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';

        // Berikan respon visual ke pengguna
        if (response.success) {
            // Jika sukses: Tampilkan alert dan kosongkan form
            alert('✅ Alhamdulillah!\nData dan berkas berhasil diunggah. Kami akan segera menghubungi Anda melalui WhatsApp.');
            formPPDB.reset(); 
        } else {
            // Jika gagal: Tampilkan pesan error dari backend
            alert('❌ Mohon Maaf Pendaftaran Gagal:\n' + response.pesan);
        }
    });
}

/**
 * 4. INISIALISASI SAAT HALAMAN SELESAI DIMUAT
 * Menjalankan fungsi-fungsi di atas hanya setelah struktur HTML dirender sempurna
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cek kesehatan API
    checkApiStatus();
    
    // 2. Siapkan form PPDB jika pengunjung sedang membuka formulir pendaftaran
    initPPDBForm();
});
