ATIGA AC MOBIL — EDISI DATABASE ONLINE
=====================================

Fitur teknis
------------
- React + Vite.
- Supabase Auth untuk login email/kata sandi.
- Profil pengguna dengan peran Admin dan Pegawai.
- Supabase PostgreSQL sebagai database bersama.
- Supabase Realtime untuk memperbarui data antarperangkat.
- Row Level Security (RLS) pada tabel profiles dan app_records.
- Data operasional disimpan per-record agar perubahan tidak mengganti seluruh daftar sekaligus.
- Cadangan dan pemulihan JSON dari menu Pengaturan (Admin).

PENTING: proyek ini belum dapat terhubung ke database sampai pemilik membuat proyek Supabase, menjalankan supabase/schema.sql, dan mengisi file .env dengan URL serta kunci publik proyek miliknya.

LANGKAH SETUP SUPABASE
----------------------
1. Buat proyek baru di https://supabase.com/.
2. Setelah proyek siap, buka SQL Editor.
3. Buka file supabase/schema.sql, salin seluruh isinya, lalu jalankan di SQL Editor.
4. Buka Authentication > Users > Add user, buat akun Admin pertama menggunakan email dan kata sandi yang dikehendaki.
5. Setelah akun dibuat, kembali ke SQL Editor dan jalankan perintah berikut dengan email Admin yang benar:

   update public.profiles
   set role = 'admin'
   where email = 'email-admin-anda@example.com';

6. Buat akun pegawai melalui Authentication > Users > Invite user. Trigger database otomatis membuat profil baru dengan role 'pegawai'. Pegawai menggunakan tautan undangan untuk mengatur kata sandi.
7. Buka Project Settings > API. Salin Project URL dan publishable/anon public key. JANGAN gunakan service_role key di aplikasi browser.

LANGKAH SETUP DI WINDOWS / VS CODE
----------------------------------
1. Ekstrak ZIP.
2. Buka folder ATIGA-AC-MOBIL-CLOUD di VS Code.
3. Salin file .env.example menjadi file baru bernama .env di folder utama proyek.
4. Isi .env seperti ini:

   VITE_SUPABASE_URL=https://PROJECT-ID.supabase.co
   VITE_SUPABASE_ANON_KEY=KUNCI_PUBLISHABLE_ATAU_ANON_PUBLIC

5. Buka terminal pada folder yang berisi package.json.
6. Jalankan:

   npm.cmd install
   npm.cmd run dev

7. Buka alamat Local yang tampil di terminal.
8. Login memakai akun Admin atau Pegawai.

PENGATURAN AKUN
---------------
- Admin pertama ditetapkan melalui SQL update role.
- Admin dapat melihat daftar akun, mengubah peran, dan menonaktifkan akun di menu Pengaturan.
- Untuk membuat akun pegawai baru, Admin mengundang pengguna melalui Supabase Dashboard > Authentication > Users > Invite user.
- Jangan membagikan password atau service_role key.

HAK AKSES
---------
Admin:
- Akses seluruh menu dan data.
- Kelola layanan, produk, transaksi, pengeluaran, laporan, pengaturan, akun pegawai, backup dan restore.

Pegawai:
- Dashboard operasional, pelanggan, kendaraan, uraian pekerjaan.
- Dapat melihat daftar layanan dan produk.
- Dapat menambah dan mengubah pelanggan, kendaraan, dan uraian pekerjaan.
- Tidak dapat membuka data transaksi, pengeluaran, laporan keuangan, atau pengaturan Admin.
- Tidak dapat menghapus data.

DATA LAMA
---------
Jika aplikasi lama pernah dijalankan di browser yang sama pada alamat lokal yang sama, data localStorage akan dimigrasikan otomatis ke cloud pada login Admin pertama selama database cloud masih kosong. Jika aplikasi lama dijalankan pada alamat/domain berbeda, ekspor cadangan JSON dari aplikasi lama lalu gunakan fitur Pulihkan Cadangan setelah login Admin pada versi cloud.

PUBLISH ONLINE
--------------
Untuk memakai Android, iPhone, dan komputer lain melalui internet, deploy proyek ini ke layanan hosting seperti Vercel. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di Environment Variables hosting, lalu deploy ulang. Semua perangkat harus membuka URL hosting yang sama.

BATASAN / CATATAN
-----------------
- Aplikasi memerlukan koneksi internet untuk membaca dan menyimpan database cloud. Belum ada mode offline dengan antrean sinkronisasi.
- Perubahan pada record yang sama dari dua perangkat secara bersamaan menggunakan prinsip perubahan terakhir yang tersimpan (last write wins). Hindari mengedit satu catatan yang sama secara bersamaan.
- Printer thermal USB harus terhubung ke komputer yang membuka aplikasi; ponsel tidak dapat menggunakan printer USB komputer dari jarak jauh tanpa perangkat/driver tambahan.
- Jalankan npm.cmd run build untuk memeriksa build sebelum deployment.

PENGATURAN LINK UNDANGAN
------------------------
Di Supabase Dashboard > Authentication > URL Configuration, atur Site URL ke URL aplikasi yang dipublikasikan. Tambahkan juga alamat lokal saat pengembangan, misalnya http://localhost:5173, ke Redirect URLs. Jika Vite menggunakan port lain, masukkan port yang tampil di terminal. Ini diperlukan agar tautan undangan kembali ke aplikasi ATIGA AC MOBIL.
