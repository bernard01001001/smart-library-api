import { pool } from '../config/db.js';

export const LoanModel = {
  async createLoan(book_id, member_id, due_date) {
    const client = await pool.connect(); // Menggunakan client untuk transaksi
    try {
      await client.query('BEGIN'); // Mulai transaksi database

      // 1. Cek ketersediaan buku
      const bookCheck = await client.query('SELECT available_copies FROM books WHERE id = $1', [book_id]);
      if (bookCheck.rows[0].available_copies <= 0) {
        throw new Error('Buku sedang tidak tersedia (stok habis).');
      }

      // 2. Kurangi stok buku
      await client.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = $1', [book_id]);

      // 3. Catat transaksi peminjaman
      const loanQuery = `
        INSERT INTO loans (book_id, member_id, due_date) 
        VALUES ($1, $2, $3) RETURNING *
      `;
      const result = await client.query(loanQuery, [book_id, member_id, due_date]);

      await client.query('COMMIT'); // Simpan semua perubahan
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK'); // Batalkan jika ada error
      throw error;
    } finally {
      client.release();
    }
  },

  async getAllLoans() {
    const query = `
      SELECT l.*, b.title as book_title, m.full_name as member_name 
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN members m ON l.member_id = m.id
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  async getTopBorrowers() {
    const query = `
      SELECT 
        m.id_mahasiswa, 
        m.nama, 
        m.jurusan,
        COUNT(l.id_pinjam) AS total_pinjaman,
        MAX(l.tanggal_pinjam) AS pinjaman_terakhir,
        (SELECT b.judul_buku 
         FROM loans l2 
         JOIN books b ON l2.id_buku = b.id_buku 
         WHERE l2.id_mahasiswa = m.id_mahasiswa 
         GROUP BY b.judul_buku 
         ORDER BY COUNT(*) DESC LIMIT 1) AS buku_favorit
      FROM mahasiswa m
      JOIN loans l ON m.id_mahasiswa = l.id_mahasiswa
      GROUP BY m.id_mahasiswa, m.nama, m.jurusan
      ORDER BY total_pinjaman DESC
      LIMIT 3;
    `;
    const result = await pool.query(query);
    return result.rows;
  }

};
