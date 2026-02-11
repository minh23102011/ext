console.log("[AGG] FEN Aggregator V3 - Robust UCI Conversion");

let lastFen = null;
let moveList = [];
let moveCount = 0;

const SOURCES = {
  dom: null,
  ws: null
};

const STATE = {
  fenBefore: null,
  fenAfter: null,
  currentMove: null,
  turnToMove: null,
  yourColor: null,
  whiteTime: null,
  blackTime: null,
  mode: null,
  moveList: []
};

// ============ CHESS LOGIC ============

function parseFEN(fen) {
  const parts = fen.split(' ');
  const position = parts[0];
  const turn = parts[1];
  
  const board = {};
  const ranks = position.split('/');
  
  for (let r = 0; r < 8; r++) {
    let file = 0;
    const rank = ranks[r];
    
    for (const char of rank) {
      if (/\d/.test(char)) {
        file += parseInt(char);
      } else {
        const square = String.fromCharCode(97 + file) + (8 - r);
        board[square] = char;
        file++;
      }
    }
  }
  
  return { board, turn };
}

function findUCIFromFENDiff(fenBefore, fenAfter) {
  if (!fenBefore || !fenAfter) return null;
  
  try {
    const before = parseFEN(fenBefore);
    const after = parseFEN(fenAfter);
    
    let fromSquares = [];
    let toSquares = [];
    let movedPiece = null;
    let promotion = '';
    
    // Find all differences
    for (let file = 0; file < 8; file++) {
      for (let rank = 1; rank <= 8; rank++) {
        const square = String.fromCharCode(97 + file) + rank;
        const beforePiece = before.board[square];
        const afterPiece = after.board[square];
        
        if (beforePiece && !afterPiece) {
          fromSquares.push({ square, piece: beforePiece });
        } else if (!beforePiece && afterPiece) {
          toSquares.push({ square, piece: afterPiece });
        } else if (beforePiece && afterPiece && beforePiece !== afterPiece) {
          // Piece changed - this is the destination in case of capture
          toSquares.push({ square, piece: afterPiece, captured: beforePiece });
        }
      }
    }
    
    // Normal move or capture
    if (fromSquares.length >= 1 && toSquares.length >= 1) {
      const from = fromSquares[0].square;
      const to = toSquares[0].square;
      movedPiece = fromSquares[0].piece;
      
      // Check for promotion
      if (movedPiece.toLowerCase() === 'p' && 
          toSquares[0].piece.toLowerCase() !== 'p' &&
          (to[1] === '8' || to[1] === '1')) {
        promotion = toSquares[0].piece.toLowerCase();
      }
      
      // Handle castling special case
      if (movedPiece.toLowerCase() === 'k') {
        const fileFrom = from.charCodeAt(0);
        const fileTo = to.charCodeAt(0);
        const diff = Math.abs(fileTo - fileFrom);
        
        if (diff === 2) {
          // Castling detected
          const uci = from + to;
          console.log("[AGG] 🏰 Castling detected:", uci);
          return uci;
        }
      }
      
      const uci = from + to + promotion;
      console.log("[AGG] ✅ UCI from FEN diff:", uci);
      return uci;
    }
    
    console.log("[AGG] ⚠️ Could not determine UCI from FEN diff");
    return null;
  } catch (err) {
    console.error("[AGG] Error parsing FEN for UCI:", err);
    return null;
  }
}

// ============ UTILITY FUNCTIONS ============

function isValidFen(fen) {
  return typeof fen === "string" && fen.includes("/");
}

function parseTurnFromFen(fen) {
  if (!fen) return null;
  const parts = fen.split(" ");
  if (parts.length < 2) return null;
  return parts[1] === "w" ? "WHITE" : "BLACK";
}

function detectPlayerColor() {
  console.log("[AGG] 🔍 Detecting player color...");
  
  // Method 1: Check coordinate ORDER (most reliable!)
  const coords = document.querySelectorAll('[class*="coordinate"]');
  if (coords.length >= 8) {
    // Get text from coordinates
    const coordTexts = Array.from(coords).map(c => c.textContent.trim());
    console.log("[AGG] Coordinate texts:", coordTexts.join(', '));
    
    // Find file coordinates (a-h)
    const files = coordTexts.filter(t => /^[a-h]$/.test(t));
    
    if (files.length >= 3) {
      // Check if they go a->h (normal) or h->a (flipped)
      const firstFile = files[0];
      const lastFile = files[files.length - 1];
      
      console.log("[AGG] Files order:", firstFile, "→", lastFile);
      
      // If starts with 'a' → WHITE (normal orientation)
      // If starts with 'h' or 'e' or higher letters → BLACK (flipped)
      if (firstFile === 'a' || firstFile === 'b') {
        console.log("[AGG] ✅ Coordinates a→h - You are WHITE");
        return "WHITE";
      } else if (firstFile === 'h' || firstFile === 'g' || firstFile >= 'e') {
        console.log("[AGG] ✅ Coordinates h→a (reversed) - You are BLACK");
        return "BLACK";
      }
    }
  }
  
  // Method 2: Check board classes
  const boardElement = document.querySelector('.board, [class*="board-layout"]');
  
  if (boardElement) {
    const boardClasses = boardElement.className;
    console.log("[AGG] Board classes:", boardClasses);
    
    const isFlipped = boardClasses.includes('flipped') || 
                     boardClasses.includes('board-flipped') ||
                     boardElement.hasAttribute('data-flipped');
    
    if (isFlipped) {
      console.log("[AGG] ✅ Board FLIPPED class - You are BLACK");
      return "BLACK";
    }
  }
  
  // Method 3: Check game controls
  const gameControls = document.querySelector(
    '[data-cy="resign-button"], .resign-button-component, button[aria-label*="Resign"]'
  );
  
  if (gameControls) {
    console.log("[AGG] ✅ Playing mode detected");
    
    // Default to WHITE if no other indicators
    if (boardElement && !boardElement.className.includes('flipped')) {
      console.log("[AGG] ✅ Playing + Normal board - You are WHITE");
      return "WHITE";
    }
  }
  
  console.log("[AGG] ⚠️ Spectating or unknown");
  return null;
}

function detectMode() {
  const gameControls = document.querySelector(
    '[data-cy="resign-button"], .resign-button-component, button[aria-label*="Resign"]'
  );
  
  if (gameControls) {
    return "playing";
  }
  
  return "spectating";
}

function extractCurrentMove(fenBefore, fenAfter) {
  if (!fenBefore || !fenAfter) return null;
  
  // PRIMARY METHOD: Compare FENs directly (most reliable!)
  const uciFromFEN = findUCIFromFENDiff(fenBefore, fenAfter);
  if (uciFromFEN) {
    console.log("[AGG] 🎯 UCI from FEN comparison:", uciFromFEN);
    return uciFromFEN;
  }
  
  // FALLBACK: Get move text from DOM
  const moveElements = document.querySelectorAll(
    '.move-text-component, .node, [class*="move-text"], [class*="vertical-move-list"] .move'
  );
  
  if (moveElements.length > 0) {
    const lastMove = moveElements[moveElements.length - 1];
    const moveText = lastMove.textContent.trim().replace(/^\d+\.+\s*/, '');
    console.log("[AGG] ⚠️ Fallback to algebraic:", moveText);
    return moveText;
  }
  
  return null;
}

function extractTime() {
  const times = { white: null, black: null };
  
  const clockSelectors = [
    '.clock-component',
    '[class*="clock-player"]',
    '.player-component .clock'
  ];
  
  for (const selector of clockSelectors) {
    const clocks = document.querySelectorAll(selector);
    if (clocks.length === 0) continue;
    
    clocks.forEach((clock, index) => {
      const timeText = clock.textContent.trim();
      const timeMatch = timeText.match(/(\d+):(\d+)(?::(\d+))?/);
      if (!timeMatch) return;
      
      let totalSeconds;
      if (timeMatch[3]) {
        totalSeconds = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
      } else {
        totalSeconds = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      }
      
      const isBottom = clock.closest('[class*="bottom"]') || index === 1;
      const boardFlipped = document.querySelector('.board.flipped, [class*="board-flipped"]');
      
      if (isBottom) {
        times[boardFlipped ? 'black' : 'white'] = totalSeconds;
      } else {
        times[boardFlipped ? 'white' : 'black'] = totalSeconds;
      }
    });
    
    if (times.white !== null || times.black !== null) break;
  }
  
  return times;
}

function saveToStorage(payload) {
  chrome.storage.local.get(['logs'], (result) => {
    const logs = result.logs || [];
    logs.push(payload);
    
    if (logs.length > 100) {
      logs.splice(0, logs.length - 100);
    }
    
    chrome.storage.local.set({ logs });
  });
}

function tryEmit() {
  const fen =
    (isValidFen(SOURCES.dom) && SOURCES.dom) ||
    (isValidFen(SOURCES.ws) && SOURCES.ws);

  if (!fen || fen === lastFen) return;

  STATE.fenBefore = lastFen;
  STATE.fenAfter = fen;
  STATE.turnToMove = parseTurnFromFen(fen);
  STATE.yourColor = detectPlayerColor();
  STATE.mode = detectMode();
  
  const times = extractTime();
  STATE.whiteTime = times.white;
  STATE.blackTime = times.black;
  
  STATE.currentMove = extractCurrentMove(lastFen, fen);
  
  const payload = {
    fen_before: STATE.fenBefore,
    fen_after: STATE.fenAfter,
    move: STATE.currentMove,
    move_list: [...STATE.moveList],
    turn_to_move: STATE.turnToMove,
    your_color: STATE.yourColor,
    white_time: STATE.whiteTime,
    black_time: STATE.blackTime,
    source: SOURCES.dom ? "DOM" : "WS",
    mode: STATE.mode,
    move_count: ++moveCount,
    ts: Date.now()
  };

  console.log("[AGG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[AGG] 📦 PAYLOAD #" + moveCount);
  console.log("[AGG] 🎯 Move (UCI):", payload.move);
  console.log("[AGG] 🎨 Your Color:", payload.your_color);
  console.log("[AGG] ⏱️  Turn:", payload.turn_to_move);
  console.log("[AGG] 🎮 Mode:", payload.mode);
  console.log("[AGG] ⏰ Times: ⚪", payload.white_time, "⚫", payload.black_time);
  console.log("[AGG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  saveToStorage(payload);

  try {
    chrome.runtime.sendMessage({ type: "FEN", payload });
  } catch (err) {
    console.warn("[AGG] ⚠️ Background unreachable:", err.message);
  }

  lastFen = fen;
}

window.addEventListener("message", (e) => {
  if (e.data?.type === "FEN_DOM") {
    SOURCES.dom = e.data.fen;
    if (e.data.times) {
      STATE.whiteTime = e.data.times.white;
      STATE.blackTime = e.data.times.black;
    }
    tryEmit();
  }

  if (e.data?.type === "FEN_WS") {
    SOURCES.ws = e.data.fen;
    if (e.data.moveList) STATE.moveList = e.data.moveList;
    if (e.data.move) STATE.currentMove = e.data.move;
    if (e.data.times) {
      STATE.whiteTime = e.data.times.white;
      STATE.blackTime = e.data.times.black;
    }
    tryEmit();
  }
});

console.log("[AGG] ✅ V3 Ready - FEN-based UCI conversion");