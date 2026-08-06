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
 * Mengirim payload JSON berisi unit_id dan student_data ke Supabase via Express
 */
async function submitPPDBRegistration(unitId, studentData) {
    try {
        const response = await fetch(`${API_BASE_URL}/ppdb`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                unit_id: parseInt(unitId), // Backend meminta format Integer
                student_data: studentData  // Objek berisi Nama, Alamat, NISN, dll
            })
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
            pesan: error.message || 'Gagal terhubung ke server database. Silakan coba lagi nanti.'
        };
    }
}

/**
 * 3. FUNGSI INTERAKSI FORM HTML (DOM Manipulation)
 * Mengaitkan fungsi Fetch API ke form pendaftaran di ppdb.html
 */
function initPPDBForm() {
    const formPPDB = document.getElementById('form-ppdb'); // Pastikan tag <form id="form-ppdb"> ada di ppdb.html
    
    // Jika tidak berada di halaman PPDB, abaikan fungsi ini
    if (!formPPDB) return;

    formPPDB.addEventListener('submit', async (e) => {
        // Cegah halaman melakukan refresh (perilaku default form)
        e.preventDefault();

        // Ambil elemen tombol submit untuk memberikan efek loading
        const submitBtn = formPPDB.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        
        // Ubah status tombol agar user tidak melakukan klik ganda (Double Submit)
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Memproses Pendaftaran...';
        submitBtn.style.opacity = '0.7';
        submitBtn.style.cursor = 'not-allowed';

        // Kumpulkan semua input dari form secara otomatis
        const formData = new FormData(formPPDB);
        
        // Ekstrak unit_id (Pastikan di HTML ada <select name="unit_id"> atau <input type="radio" name="unit_id">)
        const unitId = formData.get('unit_id'); 
        
        // Buat objek untuk menampung sisa data siswa
        const studentData = {};
        formData.forEach((value, key) => {
            if (key !== 'unit_id') {
                studentData[key] = value; // Masukkan Nama, TTL, Alamat, dsb ke objek
            }
        });

        // 🚀 Eksekusi pemanggilan API
        const response = await submitPPDBRegistration(unitId, studentData);

        // Kembalikan status tombol seperti semula
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';

        // Berikan respon visual ke pengguna
        if (response.success) {
            // Jika sukses: Tampilkan alert, kosongkan form, bisa diarahkan ke halaman sukses
            alert('✅ Alhamdulillah!\n' + response.pesan);
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
    // 1. Cek kesehatan API (hasilnya bisa dilihat di Console / Inspect Element)
    checkApiStatus();
    
    // 2. Siapkan form PPDB jika pengunjung sedang membuka ppdb.html
    initPPDBForm();
});
