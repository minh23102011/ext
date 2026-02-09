console.log("[AGG] FEN Aggregator initialized");

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
  // Detect from board orientation
  const boardFlipped = document.querySelector('.board.flipped');
  if (boardFlipped) return "BLACK";
  
  // Check if playing (vs spectating)
  const resignButton = document.querySelector('[data-cy="resign-button"], .resign-button-component');
  if (resignButton) {
    // User is playing, board not flipped = WHITE
    return "WHITE";
  }
  
  return null; // Spectating mode
}

function detectMode() {
  // Check for resign/draw buttons (indicates playing)
  const resignButton = document.querySelector('[data-cy="resign-button"], .resign-button-component');
  const drawButton = document.querySelector('[data-cy="draw-button"], .draw-button-component');
  
  if (resignButton || drawButton) {
    return "playing";
  }
  
  return "spectating";
}

function extractCurrentMove(fenBefore, fenAfter) {
  if (!fenBefore || !fenAfter) return null;
  
  // Try to get from DOM move list
  const moves = document.querySelectorAll('.move-text-component, .node');
  if (moves.length > 0) {
    const lastMove = moves[moves.length - 1];
    const moveText = lastMove.textContent.trim();
    
    // Convert algebraic notation to simple format (e.g., "e4" -> "e2→e4")
    // This is simplified - you might want to enhance this
    return moveText;
  }
  
  return null;
}

function extractTime() {
  const times = { white: null, black: null };
  
  // Try multiple selectors for clock elements
  const clocks = document.querySelectorAll('.clock-component, [class*="clock"], .time');
  
  clocks.forEach(clock => {
    const timeText = clock.textContent.trim();
    const isBottom = clock.closest('.clock-bottom, [class*="bottom"]');
    
    // Parse time (format: MM:SS or HH:MM:SS)
    const timeMatch = timeText.match(/(\d+):(\d+)(?::(\d+))?/);
    if (timeMatch) {
      const hours = timeMatch[3] ? parseInt(timeMatch[1]) : 0;
      const minutes = timeMatch[3] ? parseInt(timeMatch[2]) : parseInt(timeMatch[1]);
      const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : parseInt(timeMatch[2]);
      
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      
      // Determine which player's time
      const boardFlipped = document.querySelector('.board.flipped');
      if (isBottom) {
        times[boardFlipped ? 'black' : 'white'] = totalSeconds;
      } else {
        times[boardFlipped ? 'white' : 'black'] = totalSeconds;
      }
    }
  });
  
  return times;
}

function tryEmit() {
  const fen =
    (isValidFen(SOURCES.dom) && SOURCES.dom) ||
    (isValidFen(SOURCES.ws) && SOURCES.ws);

  if (!fen || fen === lastFen) return;

  // Update state
  STATE.fenBefore = lastFen;
  STATE.fenAfter = fen;
  STATE.turnToMove = parseTurnFromFen(fen);
  STATE.yourColor = detectPlayerColor();
  STATE.mode = detectMode();
  
  const times = extractTime();
  STATE.whiteTime = times.white;
  STATE.blackTime = times.black;
  
  STATE.currentMove = extractCurrentMove(lastFen, fen);
  
  // Build payload
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
    move_count: ++moveCount
  };

  console.log("[AGG] EMIT Full Payload:", payload);

  chrome.runtime.sendMessage({
    type: "FEN",
    payload
  });

  lastFen = fen;
}

// Listen for data from DOM and WebSocket extractors
window.addEventListener("message", (e) => {
  if (e.data?.type === "FEN_DOM") {
    SOURCES.dom = e.data.fen;
    
    // Update time if available
    if (e.data.times) {
      STATE.whiteTime = e.data.times.white;
      STATE.blackTime = e.data.times.black;
    }
    
    tryEmit();
  }

  if (e.data?.type === "FEN_WS") {
    SOURCES.ws = e.data.fen;
    
    // Update move list from WebSocket
    if (e.data.moveList) {
      STATE.moveList = e.data.moveList;
    }
    
    // Update current move from WebSocket
    if (e.data.move) {
      STATE.currentMove = e.data.move;
    }
    
    // Update time from WebSocket
    if (e.data.times) {
      STATE.whiteTime = e.data.times.white;
      STATE.blackTime = e.data.times.black;
    }
    
    tryEmit();
  }
});

console.log("[AGG] Ready to aggregate FEN data");