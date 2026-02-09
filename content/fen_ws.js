console.log("[WS] FEN WebSocket extractor initialized");

const s = document.createElement("script");
s.src = chrome.runtime.getURL("inject/ws_hook.js");
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

window.addEventListener("message", (e) => {
  if (e.data?.type !== "FEN_RAW") return;

  try {
    const json = JSON.parse(e.data.payload);
    
    const wsData = {};
    
    // Extract FEN
    if (json.fen) {
      wsData.fen = json.fen;
    }
    
    // Extract move list (UCI format)
    if (json.moves) {
      // moves might be array of objects or string
      if (Array.isArray(json.moves)) {
        wsData.moveList = json.moves.map(m => {
          if (typeof m === 'string') return m;
          if (m.move) return m.move;
          if (m.from && m.to) {
            return m.from + m.to + (m.promotion || '');
          }
          return null;
        }).filter(Boolean);
      } else if (typeof json.moves === 'string') {
        // Space-separated UCI moves
        wsData.moveList = json.moves.split(' ').filter(Boolean);
      }
    }
    
    // Extract PGN moves if available
    if (json.pgn) {
      // PGN format: "1. e4 e5 2. Nf3 Nc6"
      const pgnMoves = json.pgn.match(/[a-h]?[1-8]?[NBRQK]?[a-h][1-8](?:=[NBRQ])?[+#]?/g);
      if (pgnMoves && !wsData.moveList) {
        // Convert PGN to UCI if needed (simplified)
        wsData.moveList = pgnMoves;
      }
    }
    
    // Extract current move
    if (json.move) {
      const m = json.move;
      if (typeof m === 'string') {
        wsData.move = m;
      } else if (m.from && m.to) {
        wsData.move = `${m.from}→${m.to}${m.promotion ? '=' + m.promotion.toUpperCase() : ''}`;
      }
    }
    
    // Extract last move if available
    if (!wsData.move && json.lastMove) {
      const lm = json.lastMove;
      if (lm.from && lm.to) {
        wsData.move = `${lm.from}→${lm.to}${lm.promotion ? '=' + lm.promotion.toUpperCase() : ''}`;
      }
    }
    
    // Extract time
    if (json.wtime !== undefined && json.btime !== undefined) {
      wsData.times = {
        white: Math.floor(json.wtime / 1000), // Convert ms to seconds
        black: Math.floor(json.btime / 1000)
      };
    } else if (json.clocks) {
      // Alternative clock format
      wsData.times = {
        white: json.clocks.white || json.clocks.w,
        black: json.clocks.black || json.clocks.b
      };
    }
    
    // Extract game metadata
    if (json.game) {
      const game = json.game;
      
      // Get move list from game object
      if (game.moves && !wsData.moveList) {
        wsData.moveList = Array.isArray(game.moves) 
          ? game.moves 
          : game.moves.split(' ');
      }
      
      // Get FEN from game object
      if (game.fen && !wsData.fen) {
        wsData.fen = game.fen;
      }
    }
    
    // Send to aggregator
    if (wsData.fen || wsData.moveList || wsData.move) {
      window.postMessage({
        type: "FEN_WS",
        ...wsData
      }, "*");
    }
    
  } catch (err) {
    console.error("[WS] Parse error:", err);
  }
});

console.log("[WS] WebSocket message listener ready");