// content/fen_dom.js
// Extract FEN từ DOM board Chess.com mỗi 400ms

console.log("[DOM] init");

const FILES = ["a","b","c","d","e","f","g","h"];

// ─── Thu thập vị trí quân cờ ─────────────────────────────

function collectPieces() {
  // Chess.com dùng class:  "piece wp square-52"
  // wp = white pawn, bn = black knight, etc.
  // square-XY: X = file (1=a … 8=h), Y = rank (1…8)
  const pieces = document.querySelectorAll("piece, .piece");
  if (!pieces.length) return null;

  const board = {};

  pieces.forEach((p) => {
    const cls = [...p.classList];

    // Tìm class quân cờ: wb + prnbqk
    const pieceCls = cls.find((c) => /^[wb][prnbqk]$/i.test(c));
    // Tìm class ô: square-XY (X,Y đều là 1 chữ số)
    const squareCls = cls.find((c) => /^square-\d\d$/.test(c));
    if (!pieceCls || !squareCls) return;

    // squareCls = "square-52"  → index 7 = '5' (file), index 8 = '2' (rank)
    const fileIdx = parseInt(squareCls[7], 10) - 1; // 0-7
    const rank    = squareCls[8];                    // '1'-'8'
    if (fileIdx < 0 || fileIdx > 7) return;

    const file    = FILES[fileIdx];
    const fenChar = pieceCls[0] === "w"
      ? pieceCls[1].toUpperCase()
      : pieceCls[1].toLowerCase();

    board[file + rank] = fenChar;
  });

  return Object.keys(board).length > 0 ? board : null;
}

// ─── Build FEN từ board object ───────────────────────────

function buildFen(board, turnChar) {
  let fen = "";
  for (let r = 8; r >= 1; r--) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const sq = FILES[f] + r;
      if (board[sq]) {
        if (empty) { fen += empty; empty = 0; }
        fen += board[sq];
      } else {
        empty++;
      }
    }
    if (empty) fen += empty;
    if (r !== 1) fen += "/";
  }
  // Luôn append turn, castling, en passant, counters
  return `${fen} ${turnChar} - - 0 1`;
}

// ─── Extract time từ DOM ─────────────────────────────────

function extractTimes() {
  const times = { white: null, black: null };

  // Chess.com clock: .clock-component  hoặc  .clock-time-monospace
  // Trong mỗi clock có text kiểu "9:52" hoặc "0:05"
  const clocks = document.querySelectorAll(".clock-component, .clock-time-monospace");
  if (clocks.length < 2) return times;

  clocks.forEach((el) => {
    const text = el.textContent.trim();
    const m = text.match(/^(\d+):(\d{2})$/);
    if (!m) return;
    const secs = parseInt(m[1]) * 60 + parseInt(m[2]);

    // Xác định white/black dựa vào vị trí trong DOM
    // player-top = đối thủ,  player-bottom = mình
    // Nếu board flipped → đảo lại
    const flipped = !!document.querySelector(".board.flipped, chess-board[flipped='true']");
    const isBottom = !!el.closest(
      ".player-bottom, .board-player-bottom, [class*='player-bottom']"
    );

    if (isBottom) {
      times[flipped ? "black" : "white"] = secs;
    } else {
      times[flipped ? "white" : "black"] = secs;
    }
  });

  return times;
}

// ─── Detect turn từ DOM (highlight nước đi cuối) ─────────
// Chess.com highlight 2 ô (from/to) của nước vừa đi.
// Số nước đã đi (chẵn/lẻ) quyết định lượt tiếp theo.

let lastMoveCount = -1;

function detectTurnChar() {
  // Đếm số nước đã đi qua move-list panel
  const moveCells = document.querySelectorAll(
    ".move-list-wrapper .move-text-component, " +
    "vertical-move-list move-text, " +
    ".moves-wrapper .move"
  );
  const count = moveCells.length;
  // count nước đã đi: sau nước 1 (trắng) → đến lượt đen → 'b'
  return count % 2 === 0 ? "w" : "b";
}

// ─── Main loop ────────────────────────────────────────────

let lastFenStr = "";

setInterval(() => {
  const board = collectPieces();
  if (!board) return;

  const turnChar = detectTurnChar();
  const fen      = buildFen(board, turnChar);
  const times    = extractTimes();

  // Chỉ emit khi FEN thay đổi
  if (fen === lastFenStr) return;
  lastFenStr = fen;

  window.postMessage({
    type: "FEN_DOM",
    fen,
    times,
  }, "*");

}, 400);

console.log("[DOM] loop started");