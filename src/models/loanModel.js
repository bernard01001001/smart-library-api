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

  Berdasarkan skema database terbaru yang Anda berikan, tabel Anda menggunakan tipe data UUID dan nama kolom dalam bahasa Inggris (seperti full_name, book_id, member_id).

Berikut adalah modifikasi file src/models/loanModel.js yang disesuaikan dengan skema database tersebut:

Modifikasi src/models/loanModel.js
JavaScript
import { pool } from "../config/db.js";

export const LoanModel = {
  /**
   * Mengambil Top 3 Peminjam berdasarkan jumlah transaksi di tabel loans.
   * Menggunakan Join ke tabel members untuk data lengkap 
   * dan Subquery ke tabel books untuk mencari judul buku favorit.
   */
  async getTopBorrowers() {
    const query = `
      SELECT 
        m.id, 
        m.full_name, 
        m.email, 
        m.member_type,
        COUNT(l.id) AS total_pinjaman,
        MAX(l.loan_date) AS pinjaman_terakhir,
        (
          SELECT b.title 
          FROM loans l2 
          JOIN books b ON l2.book_id = b.id 
          WHERE l2.member_id = m.id 
          GROUP BY b.title 
          ORDER BY COUNT(*) DESC 
          LIMIT 1
        ) AS buku_favorit
      FROM members m
      JOIN loans l ON m.id = l.member_id
      GROUP BY m.id, m.full_name, m.email, m.member_type
      ORDER BY total_pinjaman DESC
      LIMIT 3;
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

};
