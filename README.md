# Sekelas

**Sekelas: Aplikasi Pencocokan Jadwal Kelas untuk Penyusunan KRS** adalah PWA berbasis HTML, CSS, dan JavaScript dengan web service Node.js/Express.

## Menjalankan proyek

Gunakan Node.js 22.16 atau lebih baru.

```sh
npm ci
cp .env.example .env
npm start
```

Buka [http://localhost:3000](http://localhost:3000). Di PowerShell, gunakan `Copy-Item .env.example .env` saat membuat konfigurasi baru. Konfigurasi contoh memakai `DATABASE_MODE=local` untuk pengembangan dengan SQLite. Jika `.env` sudah terisi, gunakan konfigurasi yang ada.

## Database dan struktur Modul 1

Backend memakai `src/config` untuk koneksi, `src/models` untuk akses data, `src/controllers` untuk permintaan HTTP dan validasi, serta `src/routes` untuk pemetaan endpoint. Tambah, edit, hapus, dan penggantian katalog dari impor melalui API dan tersimpan di database. Kelas dan pertemuan disimpan sebagai JSON dalam satu katalog sehingga penggantian katalog merupakan satu operasi atomik.

**Aktivasi Supabase**

1. Buat proyek Supabase, buka SQL Editor, lalu jalankan [skema Sekelas](supabase/schema.sql).
2. Isi `.env` dengan `DATABASE_MODE=supabase`, `SUPABASE_URL` berupa Project URL, dan `SUPABASE_KEY` berupa secret key atau service_role key untuk server. Kunci disimpan di backend. Skema mengaktifkan RLS dan memberikan akses data kepada role server.
3. Jalankan `npm run db:check`. Perintah ini memeriksa koneksi dan keberadaan tabel tanpa menambah atau menghapus katalog.
4. Jalankan ulang `npm start`, lalu muat ulang halaman. Jika katalog server masih kosong untuk browser tersebut, data browser sebelumnya dipindahkan melalui API.

Mode lokal memakai SQLite di `data/sekelas.sqlite`. File ini diabaikan Git. Untuk Vercel, isi ketiga variabel Supabase pada pengaturan Environment Variables. Mode SQLite hanya tersedia untuk pengembangan lokal. Koneksi Supabase yang belum siap menghasilkan kegagalan yang perlu diperbaiki sebelum deploy.

Setiap browser mempunyai identitas katalog acak, disimpan lokal dan dikirim sebagai header `X-Sekelas-Workspace`. Header tersebut merupakan akses ke katalognya dan perlu dijaga seperti tautan privat. Form masuk menyimpan Nama dan NIM di browser untuk ditampilkan di tab Profil. Penyimpanan lokal ini hanya berlaku di browser yang sama. Browser menyimpan salinan data untuk dibaca saat luring. Penyimpanan perubahan memerlukan koneksi. Versi katalog diperiksa saat menulis agar perubahan dari dua tab tidak saling menimpa.

Jalankan `npm test` untuk menguji pencocokan jadwal, impor, CRUD, konflik penulisan, pemisahan katalog, dan penyimpanan setelah database dibuka ulang.

## Demo

1. Buka **Susun**, klik **Pilih semua contoh**, lalu **Cari jadwal**.
2. Data bawaan menghasilkan **494 alternatif bebas bentrok** dari 1.024 kombinasi. Hasil teratas punya **0 menit** jeda dalam lima hari kuliah.
3. Pilih **Jumat**, lalu klik **Terapkan filter**. Ada **325 alternatif** dengan Jumat kosong. Gunakan **Tambah batas jam per hari** untuk membatasi, misalnya, Senin pada **07.00–17.00**, sementara hari lain bebas.
4. Arahkan kursor ke kartu atau pilih **Pratinjau** untuk melihat kelas dan jam. Klik kartu untuk membuka jadwal lengkap dan opsi **Cetak jadwal**. Gunakan **Tampilkan berikutnya** untuk melihat hasil lain.
5. Dari **Tambah jadwal**, unggah Excel dan lihat pratinjau atau isi mata kuliah dan kelas secara manual. Untuk menambah kelas pada mata kuliah yang sudah ada, buka detailnya dan pilih **Edit kelas**.

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
| `GET /api/katalog` | Katalog aktif, sumber, dan `revision`. Membutuhkan header identitas katalog. |
| `PUT /api/katalog` | Mengganti katalog secara atomik. Body berisi `catalog`, `source`, dan `revision`. Digunakan setelah konfirmasi impor dan saat memuat contoh. |
| `GET /api/mata-kuliah` | Daftar mata kuliah katalog aktif. Tanpa header identitas katalog, mengembalikan data contoh. |
| `GET /api/mata-kuliah/:kode` | Detail mata kuliah katalog aktif atau contoh jika tanpa header. |
| `POST /api/mata-kuliah` | Menambah mata kuliah. Body `{course, revision}`. Respons sukses HTTP 201. |
| `PUT /api/mata-kuliah/:kode` | Mengubah mata kuliah. Body `{course, revision}`. Respons sukses HTTP 200. |
| `DELETE /api/mata-kuliah/:kode` | Menghapus mata kuliah. Sertakan header `X-Catalog-Revision`. Respons sukses HTTP 200. |
| `GET /api/contoh` | Lima mata kuliah bawaan untuk demo. |
| `POST /api/impor` | Berkas `.xlsx` dengan `Content-Type: application/octet-stream`. Mengembalikan katalog, jumlah kelas dan kelas belum terjadwal, serta masalah per baris. |
| `POST /api/jadwal/cari` | JSON berisi `codes` dan filter opsional `freeDay`, serta `dayTimes`, misalnya `{"Senin":{"earliestStart":"07:00","latestEnd":"17:00"}}`. Batas jam inklusif dengan format `HH:MM`, berlaku hanya pada hari terkait. Hari tanpa pengaturan bebas. Format lama dengan `courses` dan batas jam global `earliestStart`/`latestEnd` tetap diterima untuk kompatibilitas. |

Semua operasi tulis membutuhkan `X-Sekelas-Workspace` berupa UUID v4 dan versi katalog terbaru. Dapatkan `revision` dari `GET /api/katalog`. Versi yang sudah berubah menghasilkan HTTP 409, input tidak valid HTTP 400, dan kode yang tidak ditemukan HTTP 404. Objek mata kuliah memiliki `code`, `name`, `credits`, dan `classes`. Setiap kelas memiliki `label` dan `meetings` dengan `day`, `start`, `end`, serta `room` opsional.

API menelusuri kombinasi kelas dengan backtracking dan berhenti menelusuri cabang yang sudah bentrok. Dua pertemuan yang bersambung dianggap valid. Hasil diurutkan dari total jeda terpendek, jumlah hari kuliah, lalu kode kelas. API menghitung cakupan penuh hingga 50.000 kombinasi untuk paling banyak 10 mata kuliah dan mengirim maksimal 50 alternatif teratas per filter.

Aplikasi menyediakan lima tab di navigasi bawah: Mata Kuliah, Susun, Hasil, Tentang, dan Profil. Mata Kuliah dan Hasil membuka halaman detail. Tambah Jadwal dan Edit Mata Kuliah dapat diakses dari alur aplikasi. PWA menyimpan tampilan dasar untuk kunjungan berikutnya dan membutuhkan koneksi untuk impor serta pencarian baru.

## Deploy HTTPS

Unggah source code ke repositori GitHub milikmu. Impor repositori di Vercel (preset **Express**) menggunakan root proyek ini. Berkas `server.js` mengekspor app Express dan aset PWA ada di `public/`. Vercel Hobby menyediakan hosting gratis untuk proyek personal nonkomersial. Setelah deploy, uji URL publik di perangkat lain dan cantumkan tautan GitHub pada formulir TA.

Dokumentasi [Express di Vercel](https://vercel.com/docs/frameworks/backend/express) dan [Vercel Hobby](https://vercel.com/docs/plans/hobby).
