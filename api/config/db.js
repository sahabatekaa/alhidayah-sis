const mysql = require('mysql2/promise');
require('dotenv').config();

// Membuat koneksi pool ke MariaDB untuk performa yang lebih baik (Multi-tenant ready)
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'alhidayah-sis',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Langsung tes koneksi saat file ini dipanggil
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Berhasil terhubung ke MariaDB (alhidayah-sis)');
        connection.release();
    } catch (err) {
        console.error('❌ Gagal terhubung ke Database:', err.message);
    }
})();

module.exports = pool;

