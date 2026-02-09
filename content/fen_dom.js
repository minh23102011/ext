console.log("[DOM] FEN DOM extractor initialized");

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

function extractTimeFromDOM() {
  const times = { white: null, black: null };
  
  // Multiple selectors for different Chess.com layouts
  const clockSelectors = [
    '.clock-component',
    '[class*="clock-player-clock"]',
    '.time',
    '[class*="time"]'
  ];
  
  for (const selector of clockSelectors) {
    const clocks = document.querySelectorAll(selector);
    if (clocks.length === 0) continue;
    
    clocks.forEach((clock, index) => {
      const timeText = clock.textContent.trim();
      
      // Parse time formats: MM:SS, HH:MM:SS, M:SS
      const timeMatch = timeText.match(/(\d+):(\d+)(?::(\d+))?/);
      if (!timeMatch) return;
      
      let totalSeconds;
      if (timeMatch[3]) {
        // HH:MM:SS format
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        totalSeconds = hours * 3600 + minutes * 60 + seconds;
      } else {
        // MM:SS or M:SS format
        const minutes = parseInt(timeMatch[1]);
        const seconds = parseInt(timeMatch[2]);
        totalSeconds = minutes * 60 + seconds;
      }
      
      // Detect which player (top = opponent, bottom = player in normal orientation)
      const isBottom = clock.closest('[class*="bottom"]') || 
                       clock.closest('.player-component.player-bottom') ||
                       index === 1; // Often bottom clock is second
      
      const boardFlipped = document.querySelector('.board.flipped');
      
      if (isBottom) {
        times[boardFlipped ? 'black' : 'white'] = totalSeconds;
      } else {
        times[boardFlipped ? 'white' : 'black'] = totalSeconds;
      }
    });
    
    // If we found times, break
    if (times.white !== null || times.black !== null) break;
  }
  
  return times;
}

// Main extraction loop
setInterval(() => {
  const board = collectPieces();
  if (!board) return;

  const fen = buildFen(board);
  const times = extractTimeFromDOM();

  window.postMessage({
    type: "FEN_DOM",
    fen,
    times
  }, "*");
}, 400);

console.log("[DOM] Extraction loop started");