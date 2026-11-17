# Sekelas

**Sekelas: Aplikasi Pencocokan Jadwal Kelas untuk Penyusunan KRS** adalah PWA berbasis HTML, CSS, dan JavaScript dengan web service Node.js/Express.

## Menjalankan proyek

Gunakan Node.js 22 atau lebih baru.

```sh
npm ci
npm start
```

Buka [http://localhost:3000](http://localhost:3000). Jalankan `npm test` untuk menguji pencocokan jadwal, impor, dan respons web service.

## Demo

1. Buka **Susun**, klik **Pilih semua contoh**, lalu **Cari jadwal**.
2. Data bawaan menghasilkan **494 alternatif bebas bentrok** dari 1.024 kombinasi. Hasil teratas punya **0 menit** jeda dalam lima hari kuliah.
3. Pilih **Jumat** di hasil. Ada **325 alternatif** dengan Jumat kosong. Hasil teratas punya **10 menit** jeda dalam empat hari kuliah.
4. Buka hasil untuk melihat kelas dan jamnya. Dari **Tambah jadwal**, unggah Excel dan lihat pratinjau atau isi mata kuliah dan kelas secara manual. Untuk menambah kelas pada mata kuliah yang sudah ada, buka detailnya dan pilih **Edit kelas**.

## Format impor Excel

Gunakan lembar pertama berkas `.xlsx` hingga 2 MB. Header dapat berada di bawah judul rekap. Nama dan urutan kolom opsional boleh berbeda. Lima kolom wajib dan contoh nilainya:

| Waktu | Mata Kuliah | Kode MK | Kelas | SKS | Ruang (opsional) |
| --- | --- | --- | --- | --- | --- |
| Senin, 07:30-10:00 | Matematika | MK001 | A | 3 SKS | B.101 |
| Rabu, 13:00-15:30 | Matematika | MK001 | B | 3 | B.102 |

Kode MK mengelompokkan kelas. Beberapa baris dengan kode MK dan kode kelas yang sama menjadi beberapa pertemuan, selama nama dan SKS konsisten. Baris dengan status `TIDAK DI JADWALKAN` dapat diimpor dan perlu dilengkapi sebelum kelas ikut dalam pencarian. Pratinjau mencantumkan baris yang dilewati. Konfirmasi impor mengganti daftar aktif. Berkas asli tidak disimpan oleh aplikasi.

## Web service

| Metode dan rute | Masukan dan hasil |
| --- | --- |
| `GET /api/mata-kuliah` | Daftar mata kuliah demo. |
| `GET /api/mata-kuliah/:kode` | Detail satu mata kuliah demo. |
| `POST /api/impor` | Berkas `.xlsx` dengan `Content-Type: application/octet-stream`. Mengembalikan katalog, jumlah kelas dan kelas belum terjadwal, serta masalah per baris. |
| `POST /api/jadwal/cari` | JSON berisi `courses` (mata kuliah dengan `code`, `name`, dan `classes`) dan `freeDay` opsional. Setiap kelas punya `label` dan `meetings` dengan `day`, `start`, `end`, dan `room` opsional. |

Jadwal aktif disimpan secara lokal di browser. Kode sumber berisi lima mata kuliah contoh. Saat pengguna mencari jadwal, browser mengirimkan data hanya untuk mata kuliah yang dipilih. API menelusuri kombinasi kelas dengan backtracking dan berhenti menelusuri cabang yang sudah bentrok. Dua pertemuan yang bersambung dianggap valid. Hasil diurutkan dari total jeda terpendek, jumlah hari kuliah, lalu kode kelas. API menghitung cakupan penuh hingga 50.000 kombinasi untuk paling banyak 10 mata kuliah dan mengirim maksimal 50 alternatif teratas per filter.

Aplikasi menyediakan navigasi bawah dengan empat tab. Mata Kuliah dan Hasil membuka halaman detail. Tambah Jadwal, Edit Mata Kuliah, dan Tentang dapat diakses dari alur aplikasi. PWA menyimpan tampilan dasar untuk kunjungan berikutnya dan membutuhkan koneksi untuk impor serta pencarian baru.

## Deploy HTTPS

Unggah source code ke repositori GitHub milikmu. Impor repositori di Vercel (preset **Express**) menggunakan root proyek ini. Berkas `server.js` mengekspor app Express dan aset PWA ada di `public/`. Vercel Hobby menyediakan hosting gratis untuk proyek personal nonkomersial. Setelah deploy, uji URL publik di perangkat lain dan cantumkan tautan GitHub pada formulir TA.

Dokumentasi [Express di Vercel](https://vercel.com/docs/frameworks/backend/express) dan [Vercel Hobby](https://vercel.com/docs/plans/hobby).
