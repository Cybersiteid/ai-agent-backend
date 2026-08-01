import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash"; // model stabil di free tier Google AI Studio

if (!API_KEY) {
  console.warn(
    "⚠️  GEMINI_API_KEY belum diset. Buat file .env dan isi API key kamu (lihat .env.example)."
  );
}

// ---- Rate limiting sederhana (per IP, in-memory) ----
// Batasi jumlah request per IP dalam jendela waktu tertentu,
// biar nggak boros kuota API kalau ada spam/abuse.
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 menit
const RATE_LIMIT_MAX_REQUESTS = 15; // maksimal 15 chat per menit per IP
const requestLog = new Map(); // ip -> [timestamp, timestamp, ...]

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const now = Date.now();

  const timestamps = (requestLog.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSec = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (now - timestamps[0])) / 1000
    );
    return res.status(429).json({
      error: `Terlalu banyak pesan dalam waktu singkat. Coba lagi dalam ${retryAfterSec} detik ya.`,
    });
  }

  timestamps.push(now);
  requestLog.set(ip, timestamps);
  next();
}

// Bersihkan entri lama tiap 5 menit biar memory nggak numpuk
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestLog.entries()) {
    const fresh = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) requestLog.delete(ip);
    else requestLog.set(ip, fresh);
  }
}, 5 * 60 * 1000);

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "AI Agent backend (Gemini) jalan 🚀" });
});

// Endpoint utama: frontend kirim { system, messages } ke sini
// messages format: [{ role: "user" | "assistant", content: "..." }]
app.post("/api/chat", rateLimiter, async (req, res) => {
  const { system, messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Field 'messages' wajib diisi." });
  }

  if (!API_KEY) {
    return res
      .status(500)
      .json({ error: "Server belum dikonfigurasi: GEMINI_API_KEY kosong." });
  }

  // Konversi format Anthropic-style ke format Gemini
  // Anthropic: { role: "user"/"assistant", content: "text" }
  // Gemini:    { role: "user"/"model",     parts: [{ text }] }
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY,
      },
      body: JSON.stringify({
        system_instruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "Gagal memanggil AI." });
    }

    const replyText =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      "Maaf kak, AI tidak memberi jawaban. Coba lagi ya.";

    // Bentuk ulang response supaya formatnya SAMA seperti Anthropic,
    // jadi App.jsx di frontend tidak perlu diubah sama sekali.
    res.json({
      content: [{ type: "text", text: replyText }],
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Terjadi kesalahan di server." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend jalan di http://localhost:${PORT}`);
});
