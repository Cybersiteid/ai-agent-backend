# Simple AI Agent — Versi Backend

Versi ini punya 2 bagian:
- **`server.js`** — backend yang nyimpen API key Anthropic dengan aman, lalu meneruskan chat ke Claude.
- **`App.jsx`** — frontend chat (tampilan) yang manggil backend, bukan langsung ke Anthropic.

## 1. Ambil API Key Anthropic

1. Buka https://console.anthropic.com/settings/keys
2. Bikin akun kalau belum punya, lalu klik **Create Key**
3. Isi saldo/billing (di menu Billing) — pemakaian dibayar per token, biasanya murah untuk skala testing/UMKM
4. Copy API key-nya (formatnya `sk-ant-...`)

## 2. Setup Backend

Butuh **Node.js** terinstall di komputer (download di https://nodejs.org kalau belum ada).

```bash
# masuk ke folder backend
cd ai-agent-backend

# install dependency
npm install

# copy file environment
cp .env.example .env
```

Buka file `.env`, ganti `ANTHROPIC_API_KEY` dengan API key kamu dari langkah 1.

Jalankan servernya:

```bash
npm start
```

Kalau berhasil, muncul: `✅ Backend jalan di http://localhost:3001`

Cek di browser buka `http://localhost:3001` — kalau muncul `{"status":"ok",...}` berarti backend sudah jalan.

## 3. Setup Frontend

Frontend (`App.jsx`) butuh project React. Cara tercepat pakai Vite:

```bash
# di folder terpisah (bukan di dalam folder backend)
npm create vite@latest simple-ai-agent-frontend -- --template react
cd simple-ai-agent-frontend
npm install lucide-react

# ganti isi src/App.jsx dengan isi App.jsx yang sudah di-download
# (copy-paste seluruh isinya)

npm run dev
```

Buka link yang muncul di terminal (biasanya `http://localhost:5173`).

## 4. Cara Pakai

1. Pastikan backend (`npm start` di folder backend) **tetap jalan** di satu terminal
2. Pastikan frontend (`npm run dev`) jalan di terminal lain
3. Buka browser ke frontend, isi SOP bisnis, klik "Aktifkan AI Agent", lalu coba chat

## 5. Kalau Mau Online (Bukan Cuma di Laptop Sendiri)

Backend bisa di-deploy gratis/murah ke:
- **Railway** (railway.app)
- **Render** (render.com)
- **Fly.io**

Setelah deploy, kamu akan dapat URL publik (misal `https://nama-app.up.railway.app`). Ganti baris `BACKEND_URL` di `App.jsx` dari `http://localhost:3001/api/chat` ke URL itu + `/api/chat`.

Frontend-nya bisa di-deploy gratis ke **Vercel** atau **Netlify**.

**Penting:** jangan pernah upload file `.env` (yang isinya API key asli) ke GitHub atau tempat publik manapun.
