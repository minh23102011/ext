// ==============================
// fen_dom.js (LIVE)
// ==============================
const FILES = ["a","b","c","d","e","f","g","h"];

function collectPieces() {
  const pieces = document.querySelectorAll("piece, .piece");
  if (!pieces.length) return null;

  const board = {};

  pieces.forEach(p => {
    const cls = [...p.classList];
    const pieceCls = cls.find(c => /^[wb][prnbqk]$/i.test(c));
    const squareCls = cls.find(c => /^square-\d\d$/.test(c));
    if (!pieceCls || !squareCls) return;

    const file = FILES[parseInt(squareCls[7], 10) - 1];
    const rank = squareCls[8];
    const fenChar =
      pieceCls[0] === "w"
        ? pieceCls[1].toUpperCase()
        : pieceCls[1].toLowerCase();

    board[file + rank] = fenChar;
  });

  return board;
}

function buildFen(board) {
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
  return fen + " w - - 0 1";
}

setInterval(() => {
  const board = collectPieces();
  if (!board) return;

  const fen = buildFen(board);

  window.postMessage({
    type: "FEN_DOM",
    fen
  }, "*");
}, 400);
