// content/fen_ws.js
// Nhận FEN_RAW từ ws_hook → parse → gửi FEN_WS cho aggregator

console.log("[WS] init");

// Inject ws_hook.js vào page context
const s = document.createElement("script");
s.src = chrome.runtime.getURL("inject/ws_hook.js");
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

// ─── Nhận data từ hook ────────────────────────────────────

window.addEventListener("message", (e) => {
  if (e.data?.type !== "FEN_RAW") return;

  try {
    const json = JSON.parse(e.data.payload);
    handleWsData(json);
  } catch (err) {
    // Bỏ qua parse error - hook đã filter rồi
  }
});

// ─── Parse data và gửi cho aggregator ────────────────────

function handleWsData(json) {
  // --- FEN ---
  const fen = json.fen || json.position || null;

  // --- Move list ---
  // Chess.com gửi moves dưới dạng string: "e2e4 e7e5 g1f3"
  // hoặc array of strings/objects
  let moveList = [];
  if (json.moves !== undefined) {
    if (typeof json.moves === "string" && json.moves.trim()) {
      moveList = json.moves.trim().split(/\s+/).filter(Boolean);
    } else if (Array.isArray(json.moves)) {
      moveList = json.moves.map(m => {
        if (typeof m === "string") return m;
        if (m?.from && m?.to) return m.from + m.to + (m.promotion || "");
        return null;
      }).filter(Boolean);
    }
  }

  // --- Current move (nước đi mới nhất) ---
  let move = "";
  if (moveList.length > 0) {
    move = moveList[moveList.length - 1]; // UCI: "e2e4"
  } else if (json.move) {
    if (typeof json.move === "string") move = json.move;
    else if (json.move?.from && json.move?.to)
      move = json.move.from + json.move.to + (json.move.promotion || "");
  }

  // --- Times (ms → seconds) ---
  let times = null;
  if (json.wtime !== undefined && json.btime !== undefined) {
    times = {
      white: json.wtime >= 1000 ? Math.floor(json.wtime / 1000) : json.wtime,
      black: json.btime >= 1000 ? Math.floor(json.btime / 1000) : json.btime,
    };
  }

  // Chỉ emit nếu có ít nhất FEN hoặc moves
  if (!fen && moveList.length === 0) return;

  console.log("[WS] parsed →", {
    fen: fen?.substring(0, 30),
    moves: moveList.length,
    move,
    times,
  });

  // Gửi cho aggregator (dùng đúng type "FEN_WS" mà aggregator expects)
  window.postMessage({
    type: "FEN_WS",
    fen,
    move,
    moveList,
    times,
  }, "*");
}

console.log("[WS] ready");