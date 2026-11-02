# Pesan & Kesan OSPRO TI 2026

```
ospro/
├── index.html        # halaman peserta
├── admin.html        # halaman panitia
├── css/style.css
├── js/config.js      # isi API_URL di sini
├── js/public.js
├── js/admin.js
└── backend/Code.gs   # Google Apps Script
```

## 1. Setup database & backend (sekali saja)
1. Buka sheets.new, beri nama bebas (mis. "Pesan Kesan OSPRO 2026").
2. Menu **Extensions → Apps Script**. Hapus isi default, tempel isi `backend/Code.gs`, simpan.
3. **Project Settings (ikon gear) → Script Properties → Add property**:
   `ADMIN_PASSWORD` = password panitia pilihanmu.
4. **Deploy → New deployment → Type: Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik Deploy, izinkan akses, lalu salin **Web app URL** (berakhiran `/exec`).
5. Tempel URL itu ke `js/config.js` pada `API_URL`.

> Setiap kali `Code.gs` diubah, buat **New version** lewat Deploy → Manage deployments → Edit, agar perubahan aktif. URL tetap sama.
> Sheet "Pesan" dibuat otomatis saat pesan pertama masuk. Ganti password cukup lewat Script Properties.

## 2. Jalankan lokal
```
cd ospro
python3 -m http.server 8000
```
Buka `http://localhost:8000` (peserta) dan `http://localhost:8000/admin.html` (panitia).

## 3. Deploy gratis
- **GitHub Pages**: push folder ke repo → Settings → Pages → branch `main`, folder `/ (root)`. Pastikan `index.html` ada di root repo. Folder `backend/` boleh ikut atau tidak, isinya tidak dipakai di web.
- **Netlify**: netlify.com/drop → seret folder project.
- **Vercel**: `vercel` dari folder project (framework: Other, tanpa build command).

Bagikan hanya link utama ke peserta. Link `/admin.html` tidak ditautkan dari mana pun dan dilindungi password.

## Catatan keamanan
- Isi pesan selalu dirender dengan `textContent` (tidak ada `innerHTML`).
- Kolom pesan di Sheet diset teks polos agar input berawalan `=` tidak jadi formula.
- Password hanya dicek di server; tanpa password benar, data tidak dikirim ke browser.
