// Memuat Header
fetch('/components/header.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('header-placeholder').innerHTML = data;
        
        // Logika Tombol Hamburger (Hanya berjalan setelah Header terpasang)
        const mobileBtn = document.getElementById('mobile-menu-btn');
        const navMenu = document.getElementById('nav-menu');
        
        if(mobileBtn) {
            mobileBtn.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        // Jalankan fungsi pendeteksi halaman aktif setelah menu selesai dirender
        updateActiveMenu();
    });

// Memuat Footer
fetch('/components/footer.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('footer-placeholder').innerHTML = data;
    });

// ==========================================
// FUNGSI UNTUK MENANDAI MENU NAVIGASI AKTIF
// ==========================================
function updateActiveMenu() {
    // Ambil URL path saat ini (contoh: '/' atau '/profil' atau '/profil.html')
    const currentPath = window.location.pathname;
    
    // Ambil semua elemen link di dalam menu navigasi
    const navLinks = document.querySelectorAll('.nav-list a');

    navLinks.forEach(link => {
        // Hapus class 'active' bawaan dari semua link terlebih dahulu
        link.classList.remove('active');

        // Ambil atribut href dari masing-masing link
        const linkPath = link.getAttribute('href');

        // Jika tidak ada href, lewati
        if (!linkPath) return;

        // Logika pencocokan URL
        if (currentPath === '/' || currentPath === '/index.html') {
            // Kasus 1: User sedang di halaman Beranda
            if (linkPath === '/' || linkPath === '/index.html') {
                link.classList.add('active');
            }
        } else if (linkPath !== '/' && linkPath !== '/index.html') {
            // Kasus 2: User sedang di halaman selain Beranda (Profil, Galeri, dll)
            // Hilangkan eksistensi .html dari href agar tetap cocok dengan URL bersih
            const cleanLinkPath = linkPath.replace('.html', '');
            
            // Jika path browser mengandung nama link tersebut, berikan aksen aktif
            if (currentPath.includes(cleanLinkPath)) {
                link.classList.add('active');
            }
        }
    });
}
