// floating-button.js - Draggable floating button for Chess.com monitor
(function() {
  'use strict';
  
  console.log('[FLOAT] Initializing floating button...');
  
  // Prevent multiple instances
  if (window.chessMonitorFloatInit) {
    console.log('[FLOAT] Already initialized, skipping');
    return;
  }
  window.chessMonitorFloatInit = true;
  
  // Configuration
  const STORAGE_KEY = 'chess_monitor_float_position';
  const DEFAULT_POSITION = { bottom: 20, right: 20 };
  
  // State
  let button = null;
  let isDragging = false;
  let currentPos = { ...DEFAULT_POSITION };
  let dragStart = { x: 0, y: 0 };
  let moveCount = 0;
  
  /**
   * Create the floating button element
   */
  function createButton() {
    const btn = document.createElement('div');
    btn.id = 'chess-monitor-float-btn';
    btn.innerHTML = '♟️';
    btn.setAttribute('data-tooltip', 'Chess Monitor');
    btn.setAttribute('draggable', 'false');
    
    // Apply saved position or default
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (result[STORAGE_KEY]) {
        currentPos = result[STORAGE_KEY];
      }
      applyPosition(btn);
    });
    
    return btn;
  }
  
  /**
   * Apply position to button
   */
  function applyPosition(btn) {
    btn.style.bottom = currentPos.bottom + 'px';
    btn.style.right = currentPos.right + 'px';
    btn.style.top = 'auto';
    btn.style.left = 'auto';
  }
  
  /**
   * Save position to storage
   */
  function savePosition() {
    chrome.storage.local.set({ [STORAGE_KEY]: currentPos }, () => {
      console.log('[FLOAT] Position saved:', currentPos);
    });
  }
  
  /**
   * Handle mouse down - start dragging
   */
  function onMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    
    isDragging = true;
    button.classList.add('dragging');
    
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      startBottom: currentPos.bottom,
      startRight: currentPos.right
    };
    
    console.log('[FLOAT] Drag started');
  }
  
  /**
   * Handle mouse move - drag button
   */
  function onMouseMove(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    
    const deltaX = dragStart.x - e.clientX;
    const deltaY = e.clientY - dragStart.y;
    
    // Update position (inverted because we use bottom/right)
    currentPos.right = Math.max(0, Math.min(window.innerWidth - 56, dragStart.startRight + deltaX));
    currentPos.bottom = Math.max(0, Math.min(window.innerHeight - 56, dragStart.startBottom + deltaY));
    
    applyPosition(button);
  }
  
  /**
   * Handle mouse up - stop dragging
   */
  function onMouseUp(e) {
    if (!isDragging) return;
    
    isDragging = false;
    button.classList.remove('dragging');
    
    // Calculate distance moved
    const distance = Math.sqrt(
      Math.pow(e.clientX - dragStart.x, 2) + 
      Math.pow(e.clientY - dragStart.y, 2)
    );
    
    // If moved less than 5px, treat as click
    if (distance < 5) {
      onClick(e);
    } else {
      savePosition();
    }
    
    console.log('[FLOAT] Drag ended, distance:', distance);
  }
  
  /**
   * Handle click - open detached window
   */
  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[FLOAT] Button clicked, opening detached window');
    
    // Send message to background to open detached window
    chrome.runtime.sendMessage({
      action: 'OPEN_DETACHED_WINDOW'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[FLOAT] Error opening window:', chrome.runtime.lastError);
      } else {
        console.log('[FLOAT] Detached window opened:', response);
      }
    });
    
    // Visual feedback
    button.classList.add('active');
    setTimeout(() => button.classList.remove('active'), 300);
  }
  
  /**
   * Update button badge with move count
   */
  function updateBadge(count) {
    if (count !== moveCount) {
      moveCount = count;
      button.setAttribute('data-tooltip', `Chess Monitor (${count} moves)`);
    }
  }
  
  /**
   * Listen for move updates
   */
  function setupListeners() {
    // Listen for messages from aggregator
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'CHESS_FEN_UPDATE') {
        const data = event.data.payload;
        if (data.move_count !== undefined) {
          updateBadge(data.move_count);
        }
      }
    });
    
    // Listen for storage changes (from popup)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[STORAGE_KEY]) {
        currentPos = changes[STORAGE_KEY].newValue;
        applyPosition(button);
      }
    });
  }
  
  /**
   * Initialize the floating button
   */
  function init() {
    try {
      // Wait for page to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
        return;
      }
      
      // Check if we're on a game page
      const isGamePage = 
        window.location.href.includes('/game/live') || 
        window.location.href.includes('/play/online');
      
      if (!isGamePage) {
        console.log('[FLOAT] Not on game page, skipping');
        return;
      }
      
      // Remove existing button if any
      const existing = document.getElementById('chess-monitor-float-btn');
      if (existing) {
        existing.remove();
      }
      
      // Create and insert button
      button = createButton();
      document.body.appendChild(button);
      
      // Setup event listeners
      button.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      
      // Setup message listeners
      setupListeners();
      
      console.log('[FLOAT] Floating button initialized successfully');
      
    } catch (error) {
      console.error('[FLOAT] Initialization error:', error);
    }
  }
  
  // Start initialization
  init();
  
})();