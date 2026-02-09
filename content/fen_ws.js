// ==============================
// fen_ws.js
// ==============================

// inject websocket hook
const s = document.createElement("script");
s.src = chrome.runtime.getURL("inject/ws_hook.js");
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

// nhận FEN raw từ inject
window.addEventListener("message", (e) => {
  if (e.data?.type !== "FEN_RAW") return;

  try {
    const json = JSON.parse(e.data.payload);
    if (json.fen) {
      window.postMessage({
        type: "FEN_WS",
        fen: json.fen
      }, "*");
    }
  } catch {}
});
