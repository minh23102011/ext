console.log("[MOVE] UCI Move Converter initialized");

// Simple chess logic to convert algebraic notation to UCI
class UCIMoveConverter {
  constructor() {
    this.pieceMap = {
      'K': 'king', 'Q': 'queen', 'R': 'rook',
      'B': 'bishop', 'N': 'knight', 'P': 'pawn'
    };
  }

  // Parse FEN to get board state
  parseFEN(fen) {
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

  // Find move by comparing two FEN positions
  findMoveBetweenFENs(fenBefore, fenAfter) {
    if (!fenBefore || !fenAfter) return null;
    
    const before = this.parseFEN(fenBefore);
    const after = this.parseFEN(fenAfter);
    
    // Find square that lost a piece
    let fromSquare = null;
    let toSquare = null;
    let movedPiece = null;
    let promotion = '';
    
    // Find differences
    for (let file = 0; file < 8; file++) {
      for (let rank = 1; rank <= 8; rank++) {
        const square = String.fromCharCode(97 + file) + rank;
        const beforePiece = before.board[square];
        const afterPiece = after.board[square];
        
        if (beforePiece && !afterPiece) {
          // Piece moved from here
          fromSquare = square;
          movedPiece = beforePiece;
        } else if (!beforePiece && afterPiece) {
          // Piece moved to here or promoted
          toSquare = square;
          
          // Check for promotion
          if (movedPiece && movedPiece.toLowerCase() === 'p' && 
              afterPiece.toLowerCase() !== 'p') {
            promotion = afterPiece.toLowerCase();
          }
        } else if (beforePiece !== afterPiece) {
          // Piece changed (capture or promotion)
          if (!toSquare) {
            toSquare = square;
          }
        }
      }
    }
    
    if (fromSquare && toSquare) {
      const uci = fromSquare + toSquare + promotion;
      console.log("[MOVE] ✅ Found UCI from FEN diff:", uci);
      return uci;
    }
    
    return null;
  }

  // Convert algebraic notation to UCI using FEN context
  algebraicToUCI(algebraic, fenBefore, fenAfter) {
    if (!algebraic) return null;
    
    // Clean notation
    const clean = algebraic.replace(/[+#!?]/g, '').trim();
    
    // Already UCI format?
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(clean)) {
      console.log("[MOVE] Already UCI:", clean);
      return clean;
    }
    
    // Try FEN comparison (most reliable)
    if (fenBefore && fenAfter) {
      const uci = this.findMoveBetweenFENs(fenBefore, fenAfter);
      if (uci) return uci;
    }
    
    // Fallback: Try to parse algebraic notation
    return this.parseAlgebraic(clean, fenBefore);
  }

  parseAlgebraic(notation, fen) {
    // Handle castling
    if (notation === 'O-O' || notation === '0-0') {
      const turn = fen ? fen.split(' ')[1] : 'w';
      return turn === 'w' ? 'e1g1' : 'e8g8';
    }
    if (notation === 'O-O-O' || notation === '0-0-0') {
      const turn = fen ? fen.split(' ')[1] : 'w';
      return turn === 'w' ? 'e1c1' : 'e8c8';
    }
    
    // Extract destination square (always last 2 chars for normal moves)
    const dest = notation.match(/[a-h][1-8]/);
    if (!dest) return notation; // Can't parse, return as is
    
    const toSquare = dest[0];
    
    // For pawn moves (no piece letter)
    if (/^[a-h]/.test(notation)) {
      const file = notation[0];
      const isCapture = notation.includes('x');
      
      if (isCapture) {
        // Pawn capture like "exd5"
        const rank = parseInt(toSquare[1]);
        const fromRank = toSquare[1] === '6' || toSquare[1] === '3' 
          ? rank + (toSquare[1] === '6' ? -1 : 1) 
          : rank + (parseInt(toSquare[1]) > 4 ? -1 : 1);
        return file + fromRank + toSquare;
      } else {
        // Pawn push like "e4"
        const rank = parseInt(toSquare[1]);
        const fromRank = rank - 1; // Assume single push
        return toSquare[0] + fromRank + toSquare;
      }
    }
    
    // For piece moves, we need board state - return algebraic for now
    console.log("[MOVE] ⚠️ Complex move, needs board state:", notation);
    return notation;
  }
}

// Global converter instance
window.uciConverter = new UCIMoveConverter();

// Export for use in aggregator
window.convertToUCI = function(algebraic, fenBefore, fenAfter) {
  return window.uciConverter.algebraicToUCI(algebraic, fenBefore, fenAfter);
};

console.log("[MOVE] ✅ UCI converter ready");
console.log("[MOVE] Usage: window.convertToUCI(move, fenBefore, fenAfter)");