// fen_aggregator.js - Main data aggregator for Chess.com
(function() {
  'use strict';
  
  console.log('[AGG] FEN Aggregator initialized');
  
  // State management
  let lastFenBefore = '';
  let lastFenAfter = '';
  let moveList = [];
  let currentMove = '';
  let wsTime = { white: null, black: null };
  let domTime = { white: null, black: null };
  let gameMode = 'spectating';
  let yourColor = null;
  let moveCount = 0;
  
  /**
   * Extract turn from FEN string
   * FEN format: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
   * The second field is turn: 'w' = WHITE, 'b' = BLACK
   */
  function getTurnFromFen(fen) {
    if (!fen) return null;
    
    try {
      const parts = fen.trim().split(' ');
      if (parts.length < 2) return null;
      
      const turnChar = parts[1].toLowerCase();
      
      if (turnChar === 'w') return 'WHITE';
      if (turnChar === 'b') return 'BLACK';
      
      console.warn('[AGG] Unknown turn character:', turnChar);
      return null;
    } catch (error) {
      console.error('[AGG] Error extracting turn from FEN:', error);
      return null;
    }
  }
  
  /**
   * Detect game mode (playing vs spectating)
   */
  function detectGameMode() {
    try {
      // Check for resign/draw buttons - indicates playing mode
      const resignButton = document.querySelector('[data-cy="resign-button"], .resign-button-component, button[title*="Resign"]');
      const drawButton = document.querySelector('[data-cy="draw-button"], .draw-button-component, button[title*="Draw"]');
      
      if (resignButton || drawButton) {
        return 'playing';
      }
      
      // Check for player controls
      const playerControls = document.querySelector('.player-controls, .game-controls-component');
      if (playerControls) {
        return 'playing';
      }
      
      return 'spectating';
    } catch (error) {
      console.error('[AGG] Error detecting game mode:', error);
      return 'spectating';
    }
  }
  
  /**
   * Detect player color when in playing mode
   */
  function detectYourColor() {
    try {
      // Method 1: Check bottom player (usually you)
      const bottomPlayer = document.querySelector('.player-bottom, .board-player-bottom');
      if (bottomPlayer) {
        const isWhite = bottomPlayer.classList.contains('white') || 
                       bottomPlayer.querySelector('.player-white');
        if (isWhite) return 'WHITE';
        
        const isBlack = bottomPlayer.classList.contains('black') || 
                       bottomPlayer.querySelector('.player-black');
        if (isBlack) return 'BLACK';
      }
      
      // Method 2: Check board orientation
      const board = document.querySelector('.board');
      if (board) {
        const flipped = board.classList.contains('flipped');
        return flipped ? 'BLACK' : 'WHITE';
      }
      
      // Method 3: Check from FEN and move buttons
      const yourTurn = document.querySelector('.clock-component.clock-player-turn, .player-turn');
      if (yourTurn) {
        const parent = yourTurn.closest('.player-component, .player-bottom, .player-top');
        if (parent) {
          if (parent.classList.contains('white') || parent.querySelector('.player-white')) {
            return 'WHITE';
          }
          if (parent.classList.contains('black') || parent.querySelector('.player-black')) {
            return 'BLACK';
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('[AGG] Error detecting your color:', error);
      return null;
    }
  }
  
  /**
   * Get time from best available source
   */
  function getBestTime() {
    // Prefer WebSocket time (more accurate)
    if (wsTime.white !== null && wsTime.black !== null) {
      return { 
        white: wsTime.white, 
        black: wsTime.black,
        source: 'WS'
      };
    }
    
    // Fallback to DOM time
    if (domTime.white !== null && domTime.black !== null) {
      return { 
        white: domTime.white, 
        black: domTime.black,
        source: 'DOM'
      };
    }
    
    return { 
      white: 0, 
      black: 0,
      source: 'NONE'
    };
  }
  
  /**
   * Build complete data payload
   */
  function buildPayload() {
    // Detect mode and color
    gameMode = detectGameMode();
    yourColor = gameMode === 'playing' ? detectYourColor() : null;
    
    // Get best time
    const timeData = getBestTime();
    
    // CRITICAL: Extract turn from FEN AFTER move (current position)
    const turnToMove = getTurnFromFen(lastFenAfter);
    
    // Build payload
    const payload = {
      fen_before: lastFenBefore,
      fen_after: lastFenAfter,
      move: currentMove,
      move_list: [...moveList],
      current_move: moveList.length > 0 ? moveList[moveList.length - 1] : '',
      turn_to_move: turnToMove, // This should now change properly
      your_color: yourColor,
      white_time: timeData.white,
      black_time: timeData.black,
      source: timeData.source,
      mode: gameMode,
      move_count: moveCount,
      ts: Date.now()
    };
    
    console.log('[AGG] Built payload:', {
      move: currentMove,
      fen_after: lastFenAfter,
      turn_extracted: turnToMove,
      move_count: moveCount
    });
    
    return payload;
  }
  
  /**
   * Emit data to background and popup
   */
  function emitData() {
    const payload = buildPayload();
    
    console.log('[AGG] EMIT Full Payload:', payload);
    
    // Send to background (for backend API)
    chrome.runtime.sendMessage({
      action: 'FEN_UPDATE',
      payload: payload
    }).catch(err => {
      console.error('[AGG] Error sending to background:', err);
    });
    
    // Also emit to window for floating button
    window.postMessage({
      type: 'CHESS_FEN_UPDATE',
      payload: payload
    }, '*');
  }
  
  /**
   * Listen for WebSocket data
   */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    const { type, data } = event.data;
    
    if (type === 'CHESS_WS_FEN') {
      console.log('[AGG] Received WS FEN:', data);
      
      if (data.fen_before) lastFenBefore = data.fen_before;
      if (data.fen_after) lastFenAfter = data.fen_after;
      if (data.move) currentMove = data.move;
      
      if (data.move_list && Array.isArray(data.move_list)) {
        moveList = data.move_list;
        moveCount = moveList.length;
      }
      
      emitData();
    }
    
    if (type === 'CHESS_WS_TIME') {
      console.log('[AGG] Received WS Time:', data);
      
      if (data.white !== undefined) wsTime.white = data.white;
      if (data.black !== undefined) wsTime.black = data.black;
      
      // Time updates don't trigger full emit, just update
    }
    
    if (type === 'CHESS_WS_MOVE_LIST') {
      console.log('[AGG] Received WS Move List:', data);
      
      if (data.moves && Array.isArray(data.moves)) {
        moveList = data.moves;
        moveCount = moveList.length;
      }
    }
  });
  
  /**
   * Listen for DOM data
   */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    const { type, data } = event.data;
    
    if (type === 'CHESS_DOM_FEN') {
      console.log('[AGG] Received DOM FEN:', data);
      
      // Only use DOM FEN if we don't have WS data
      if (!lastFenAfter && data.fen) {
        lastFenAfter = data.fen;
        emitData();
      }
    }
    
    if (type === 'CHESS_DOM_TIME') {
      // Update DOM time (fallback)
      if (data.white !== undefined) domTime.white = data.white;
      if (data.black !== undefined) domTime.black = data.black;
    }
  });
  
  /**
   * Periodic sync - re-detect mode and color
   */
  setInterval(() => {
    const newMode = detectGameMode();
    const newColor = newMode === 'playing' ? detectYourColor() : null;
    
    if (newMode !== gameMode || newColor !== yourColor) {
      console.log('[AGG] Mode/Color changed:', { 
        mode: gameMode + ' → ' + newMode,
        color: yourColor + ' → ' + newColor
      });
      
      gameMode = newMode;
      yourColor = newColor;
    }
  }, 2000);
  
  console.log('[AGG] Aggregator ready, listening for data...');
  
})();