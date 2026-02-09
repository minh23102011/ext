// ==============================
// fen_aggregator.js
// ==============================
console.log("[AGG] init");

let lastFen = null;

// Ưu tiên: DOM > WS
const SOURCES = {
  dom: null,
  ws: null
};

function isValidFen(fen) {
  return typeof fen === "string" && fen.includes("/");
}

function tryEmit() {
  const fen =
    (isValidFen(SOURCES.dom) && SOURCES.dom) ||
    (isValidFen(SOURCES.ws) && SOURCES.ws);

  if (!fen || fen === lastFen) return;

  const payload = {
    fen_before: lastFen,
    fen_after: fen,
    source: SOURCES.dom ? "DOM" : "WS"
  };

  console.log("[AGG] EMIT", payload);

  chrome.runtime.sendMessage({
    type: "FEN",
    payload
  });

  lastFen = fen;
}

// nhận từ DOM
window.addEventListener("message", (e) => {
  if (e.data?.type === "FEN_DOM") {
    SOURCES.dom = e.data.fen;
    tryEmit();
  }

  if (e.data?.type === "FEN_WS") {
    SOURCES.ws = e.data.fen;
    tryEmit();
  }
});
