import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, Store, Loader2, Sparkles, RotateCcw, Sun, Moon } from "lucide-react";

const DEFAULT_SOP = `Nama Bisnis: Kedai Kopi Senja
Jam Buka: Setiap hari, 08.00 - 22.00 WIB
Lokasi: Jl. Merdeka No. 12, Bandung

Menu:
- Kopi Susu Gula Aren: Rp 18.000
- Americano: Rp 15.000
- Cappuccino: Rp 20.000
- Croissant: Rp 22.000

Kebijakan:
- Bisa pesan lewat GoFood, GrabFood, atau datang langsung
- Tidak menerima pembayaran cash, hanya QRIS/e-wallet
- Delivery mandiri hanya untuk radius 3km, ongkir Rp 8.000

Nada bicara: ramah, santai, pakai sapaan "kak", boleh emoji secukupnya.`;

// Auto follow-up: kalau pelanggan diam sekian detik setelah AI menjawab,
// AI otomatis kirim pesan susulan (maksimal 2x biar nggak spam).
const FOLLOW_UP_DELAY_MS = 45000; // 45 detik (di real product biasanya 5-15 menit)
const MAX_FOLLOW_UPS = 2;
const FOLLOW_UP_MESSAGES = [
  "Kak, masih di situ? 😊 Kalau ada pertanyaan lain seputar produk atau pemesanan, langsung tanya aja ya.",
  "Halo kak, kalau belum ada keputusan nggak apa-apa — aku standby kalau sewaktu-waktu mau tanya lagi ya 🙏",
];

const THEMES = {
  dark: {
    bg: "#0B1220",
    panel: "#111A2B",
    border: "#1F2A3D",
    input: "#0B1220",
    text: "#E8ECEF",
    textDim: "#D6DCE3",
    muted: "#8B96A5",
    faint: "#556072",
    primary: "#0F766E",
    accent: "#F59E0B",
    green: "#22C55E",
    red: "#F87171",
    white: "#FFFFFF",
    bubbleAssistant: "#1A2438",
  },
  light: {
    bg: "#F4F6F8",
    panel: "#FFFFFF",
    border: "#E2E8F0",
    input: "#F8FAFC",
    text: "#0F172A",
    textDim: "#1E293B",
    muted: "#64748B",
    faint: "#94A3B8",
    primary: "#0F766E",
    accent: "#D97706",
    green: "#16A34A",
    red: "#DC2626",
    white: "#FFFFFF",
    bubbleAssistant: "#EEF2F6",
  },
};

export default function SimpleAIAgent() {
  const [theme, setTheme] = useState("dark");
  const colors = THEMES[theme];

  const [sop, setSop] = useState(DEFAULT_SOP);
  const [locked, setLocked] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rateLimitNotice, setRateLimitNotice] = useState(null);
  const scrollRef = useRef(null);
  const followUpTimerRef = useRef(null);
  const followUpCountRef = useRef(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // ---- Auto follow-up: reset timer tiap ada pesan baru ----
  useEffect(() => {
    clearTimeout(followUpTimerRef.current);

    if (!locked || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    // Hanya jadwalkan follow-up kalau pesan terakhir dari AI (nunggu respons user)
    if (lastMessage.role !== "assistant") return;
    if (followUpCountRef.current >= MAX_FOLLOW_UPS) return;

    followUpTimerRef.current = setTimeout(() => {
      const idx = followUpCountRef.current;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: FOLLOW_UP_MESSAGES[idx] || FOLLOW_UP_MESSAGES[0],
          isFollowUp: true,
        },
      ]);
      followUpCountRef.current += 1;
    }, FOLLOW_UP_DELAY_MS);

    return () => clearTimeout(followUpTimerRef.current);
  }, [messages, locked]);

  const startBot = () => {
    if (!sop.trim()) return;
    setLocked(true);
    followUpCountRef.current = 0;
    setMessages([
      {
        role: "assistant",
        content:
          "Halo kak! 👋 AI agent sudah aktif dan siap jawab pertanyaan seputar bisnis ini. Coba tanya sesuatu di bawah.",
      },
    ]);
  };

  const resetBot = () => {
    clearTimeout(followUpTimerRef.current);
    followUpCountRef.current = 0;
    setLocked(false);
    setMessages([]);
    setInput("");
    setError(null);
    setRateLimitNotice(null);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // User membalas -> reset hitungan follow-up (dianggap aktif lagi)
    followUpCountRef.current = 0;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);
    setRateLimitNotice(null);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: `Kamu adalah AI customer service untuk bisnis berikut. Jawab HANYA berdasarkan informasi di bawah ini. Kalau ditanya hal yang tidak tercakup, akui dengan jujur bahwa kamu tidak punya info itu dan sarankan hubungi admin langsung. Jawab singkat, natural, dan ikuti nada bicara yang diminta.\n\n${sop}`,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      const textBlock = data?.content?.find((c) => c.type === "text");
      const reply = textBlock?.text || "Maaf kak, ada gangguan. Coba lagi ya.";

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError("Gagal menghubungi AI. Coba lagi sebentar lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const canStart = !!sop.trim();

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: colors.bg,
        color: colors.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1000 }}>
        {/* Header */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: colors.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Bot size={20} color={colors.white} />
              </div>
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: colors.accent,
                  border: `2px solid ${colors.bg}`,
                }}
              />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", margin: 0, color: colors.text }}>
                AI Agent Sederhana
              </h1>
              <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>
                Tempel info bisnismu, langsung punya customer service AI.
              </p>
            </div>
          </div>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              color: colors.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>

        <div
          className="agent-grid"
          style={{ display: "grid", gridTemplateColumns: "minmax(280px, 2fr) 3fr", gap: 16 }}
        >
          {/* Setup panel */}
          <div
            style={{
              background: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              height: 520,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                color: colors.muted,
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                flexShrink: 0,
              }}
            >
              <Store size={14} />
              <span>Info &amp; SOP Bisnis</span>
            </div>
            <textarea
              value={sop}
              onChange={(e) => setSop(e.target.value)}
              disabled={locked}
              placeholder="Tulis nama bisnis, jam buka, menu/produk, kebijakan, dan nada bicara yang diinginkan..."
              style={{
                width: "100%",
                flex: 1,
                minHeight: 0,
                resize: "none",
                borderRadius: 12,
                background: colors.input,
                border: `1px solid ${colors.border}`,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.6,
                color: colors.textDim,
                fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                outline: "none",
                opacity: locked ? 0.6 : 1,
                boxSizing: "border-box",
              }}
            />

            {!locked ? (
              <button
                onClick={startBot}
                disabled={!canStart}
                style={{
                  marginTop: 16,
                  flexShrink: 0,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: 12,
                  border: "none",
                  background: canStart ? colors.primary : colors.border,
                  color: canStart ? colors.white : colors.faint,
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "12px 0",
                  cursor: canStart ? "pointer" : "not-allowed",
                }}
              >
                <Sparkles size={16} />
                Aktifkan AI Agent
              </button>
            ) : (
              <button
                onClick={resetBot}
                style={{
                  marginTop: 16,
                  flexShrink: 0,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: 12,
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  color: colors.muted,
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "12px 0",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={14} />
                Edit ulang &amp; reset
              </button>
            )}
          </div>

          {/* Chat panel */}
          <div
            style={{
              background: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              height: 520,
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 20px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: locked ? colors.green : colors.faint,
                }}
              />
              <span style={{ fontSize: 13, color: colors.muted }}>
                {locked ? "AI aktif — coba tanya sesuatu" : "Aktifkan AI di panel kiri dulu"}
              </span>
            </div>

            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {!locked && (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    color: colors.faint,
                    fontSize: 13,
                    padding: "0 32px",
                  }}
                >
                  Chat percobaan akan muncul di sini setelah kamu mengaktifkan AI agent.
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div
                    style={{
                      maxWidth: "80%",
                      borderRadius: 16,
                      borderBottomRightRadius: m.role === "user" ? 4 : 16,
                      borderBottomLeftRadius: m.role === "user" ? 16 : 4,
                      padding: "10px 14px",
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      background: m.role === "user" ? colors.primary : colors.bubbleAssistant,
                      color: m.role === "user" ? colors.white : colors.textDim,
                      border: m.isFollowUp ? `1px dashed ${colors.accent}` : "none",
                    }}
                  >
                    {m.isFollowUp && (
                      <div style={{ fontSize: 10, color: colors.accent, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Follow-up otomatis
                      </div>
                    )}
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div
                    style={{
                      background: colors.bubbleAssistant,
                      borderRadius: 16,
                      borderBottomLeftRadius: 4,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: colors.muted,
                      fontSize: 13.5,
                    }}
                  >
                    <Loader2 size={14} className="spin" />
                    mengetik...
                  </div>
                </div>
              )}
              {rateLimitNotice && (
                <div style={{ textAlign: "center", fontSize: 12, color: colors.accent, padding: "4px 12px" }}>
                  ⏳ {rateLimitNotice}
                </div>
              )}
              {error && (
                <div style={{ textAlign: "center", fontSize: 12, color: colors.red, padding: "4px 0" }}>{error}</div>
              )}
            </div>

            <div
              style={{
                padding: 12,
                borderTop: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!locked || loading}
                placeholder={locked ? "Tulis pertanyaan seperti pelanggan..." : "Aktifkan AI dulu ya"}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  background: colors.input,
                  border: `1px solid ${colors.border}`,
                  padding: "10px 14px",
                  fontSize: 13.5,
                  color: colors.text,
                  outline: "none",
                  opacity: !locked || loading ? 0.5 : 1,
                  boxSizing: "border-box",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!locked || loading || !input.trim()}
                style={{
                  borderRadius: 12,
                  border: "none",
                  background: locked && !loading && input.trim() ? colors.primary : colors.border,
                  color: locked && !loading && input.trim() ? colors.white : colors.faint,
                  padding: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: locked && !loading && input.trim() ? "pointer" : "not-allowed",
                  flexShrink: 0,
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .agent-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
