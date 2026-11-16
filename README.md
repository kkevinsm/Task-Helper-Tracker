# urtaskhelper

Website tracking status pengerjaan joki tugas, dilengkapi dengan dashboard admin untuk manajemen antrean & pesanan, fitur upload file hasil tugas (PDF/Word/ZIP/Google Drive), dan integrasi WhatsApp.

---

## ✨ Fitur Utama

1. **Halaman Publik (Pelacak Pesanan)**
   - Pencarian berdasarkan kode antrean (format otomatis: `ADA-001`, `ADA-002`, dst).
   - Visual Stepper status progres (*Diterima* ➔ *Dikerjakan* ➔ *Selesai*).
   - Penyamaran nama pemesan untuk menjaga privasi klien (contoh: `B**i S*****o`).
   - Tombol download file hasil (PDF/Word/ZIP) dan link Google Drive (hanya aktif jika status **Selesai**).
   - Tombol shortcut **Hubungi Admin via WhatsApp** langsung dengan pesan otomatis yang menyertakan kode dan judul tugas.

2. **Dashboard & Panel Admin**
   - Autentikasi aman melalui Supabase Auth.
   - Proteksi multi-lapis: Next.js Proxy + Postgres Row Level Security (RLS) + Admin allowlist function.
   - Kartu metrik: *Total Pesanan*, *Di Antrean*, *Dikerjakan*, *Selesai*.
   - Filter status cepat (*Semua*, *Di Antrean*, *Dikerjakan*, *Selesai*, *Dibatalkan*).
   - Form pembuatan & edit pesanan:
     - Generate otomatis kode antrean unik (`ADA-xxx`).
     - Upload file hasil langsung ke Supabase Storage (Private Bucket).
     - Link alternatif (Google Drive).
     - Catatan publik untuk klien & catatan privat untuk admin.
     - Harga (privat untuk admin).
     - Indikator peringatan deadline yang terlewat.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack, TypeScript)
- **Styling:** Tailwind CSS v4 + Lucide React Icons
- **Database, Auth & Storage:** Supabase (PostgreSQL, Supabase Auth, Storage Bucket `results`)
- **Deployment:** Vercel

---

## 🚀 Langkah Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** di dashboard Supabase Anda.
3. Buka file [`supabase/schema.sql`](./supabase/schema.sql), salin seluruh isinya, dan klik **Run**.
4. Di bagian akhir `supabase/schema.sql`, tambahkan email Anda ke tabel `public.admins`:
   ```sql
   insert into public.admins (email) values ('email-anda@gmail.com');
   ```
5. Buat akun admin Anda di menu **Authentication ➔ Users ➔ Add User ➔ Create User** (masukkan email yang sama dan password untuk login admin).

---

## 🔐 Environment Variables

Salin `.env.example` ke `.env.local` dan isi nilainya:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
NEXT_PUBLIC_WHATSAPP_NUMBER=6281234567890
```

---

## 💻 Menjalankan di Lokal

```bash
# Install dependencies
npm install

# Jalankan server development
npm run dev
```

Buka `http://localhost:3000` di browser Anda.

---

## 🌐 Deployment ke Vercel

1. Push repo ini ke GitHub:
   ```bash
   git add .
   git commit -m "feat: complete urtaskhelper app"
   git push origin main
   ```
2. Hubungkan repository ke Vercel atau jalankan `vercel` CLI.
3. Masukkan Environment Variables di Vercel Dashboard (**Settings ➔ Environment Variables**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_WHATSAPP_NUMBER`
4. Deploy! Domain target: `urtaskhelper.vercel.app`.

---

## 🤖 Setup Bot Telegram Admin (Input Pesanan via Chat)

Bot Telegram memungkinkan admin menambahkan pesanan baru langsung dari chat (tanpa AI/API key berbayar) dengan semua kolom yang sama persis seperti form di web:

1. **Buat Bot di Telegram:**
   - Chat [@BotFather](https://t.me/BotFather), jalankan `/newbot`, lalu salin `TELEGRAM_BOT_TOKEN`.
2. **Siapkan Database:**
   - Pastikan bagian `telegram_sessions` di [`supabase/schema.sql`](./supabase/schema.sql) sudah dijalankan di Supabase SQL Editor.
3. **Tambahkan Environment Variables (`.env.local` & Vercel):**
   - `TELEGRAM_BOT_TOKEN`: token dari `@BotFather`
   - `TELEGRAM_ADMIN_IDS`: Telegram User ID Anda (bisa didapatkan dengan mengirim `/id` ke bot setelah webhook aktif, atau cek lewat `@userinfobot`)
   - `TELEGRAM_WEBHOOK_SECRET`: string acak panjang untuk validasi webhook
   - `NEXT_PUBLIC_APP_URL`: URL publik web (misal `https://urtaskhelper.vercel.app`)
4. **Daftarkan Webhook setelah deploy ke Vercel:**
   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://urtaskhelper.vercel.app/api/telegram/webhook",
       "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
     }'
   ```
5. **Perintah Bot:**
   - `/baru` — Input interaktif langkah demi langkah sesuai form web (dengan tombol Kategori, Deadline cepat, & Lewati)
   - `/order` — Input cepat dalam satu pesan menggunakan template
   - `/template` — Salin template kosong `/order`
   - `/list` — Lihat 5 pesanan aktif terbaru
   - `/status ADA-001` — Cek detail pesanan berdasarkan kode antrean
   - `/batal` — Batalkan sesi input yang sedang berjalan
