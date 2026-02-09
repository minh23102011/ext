// background.js - Service worker for Chess.com Data Extractor
console.log('[BG] Service worker started');

// Configuration
const DEFAULT_CONFIG = {
  backend_url: 'http://127.0.0.1:8765/fen',
  max_logs: 100,
  show_debug: false
};

// Store latest data for popup
let latestData = null;
let backendStatus = 'unknown';

/**
 * Send FEN data to backend
 */
async function sendToBackend(payload) {
  try {
    const config = await chrome.storage.local.get(['backend_url']);
    const url = config.backend_url || DEFAULT_CONFIG.backend_url;
    
    console.log('[BG] Sending to backend:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log('[BG] Backend success');
      backendStatus = 'success';
      return true;
    } else {
      console.error('[BG] Backend error:', response.status);
      backendStatus = 'error';
      return false;
    }
  } catch (error) {
    console.error('[BG] Backend fetch error:', error);
    backendStatus = 'error';
    return false;
  }
}

/**
 * Store log in chrome.storage for popup
 */
async function storeLog(payload) {
  try {
    // Get current logs
    const result = await chrome.storage.local.get(['chess_fen_logs', 'max_logs']);
    let logs = result.chess_fen_logs || [];
    const maxLogs = result.max_logs || DEFAULT_CONFIG.max_logs;
    
    // Add new log with backend status
    const logEntry = {
      ...payload,
      backend_status: backendStatus,
      logged_at: Date.now()
    };
    
    logs.push(logEntry);
    
    // Trim to max logs
    if (logs.length > maxLogs) {
      logs = logs.slice(-maxLogs);
    }
    
    // Save back to storage
    await chrome.storage.local.set({ chess_fen_logs: logs });
    
    console.log('[BG] Log stored, total:', logs.length);
    
    // Notify all popups/tabs about new data
    notifyPopups(logEntry);
    
    return true;
  } catch (error) {
    console.error('[BG] Error storing log:', error);
    return false;
  }
}

/**
 * Notify all popup/detached windows about new data
 */
function notifyPopups(data) {
  // Store latest data
  latestData = data;
  
  // Try to send to all extension views (popup, detached window, etc.)
  chrome.runtime.sendMessage({
    action: 'NEW_LOG',
    payload: data
  }).catch(err => {
    // It's OK if no popup is listening
    console.log('[BG] No popup listening (this is normal)');
  });
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[BG] Message received:', message.action);
  
  // Handle FEN update from content script
  if (message.action === 'FEN_UPDATE') {
    const payload = message.payload;
    
    console.log('[BG] FEN Update received:', {
      move: payload.move,
      turn: payload.turn_to_move,
      move_count: payload.move_count
    });
    
    // Send to backend (async)
    sendToBackend(payload).catch(err => {
      console.error('[BG] Backend send failed:', err);
    });
    
    // Store log for popup
    storeLog(payload).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      console.error('[BG] Store log failed:', err);
      sendResponse({ success: false, error: err.message });
    });
    
    return true; // Will respond asynchronously
  }
  
  // Handle request for latest data from popup
  if (message.action === 'GET_LATEST_DATA') {
    sendResponse({ 
      success: true, 
      data: latestData,
      backend_status: backendStatus 
    });
    return true;
  }
  
  // Handle open detached window request
  if (message.action === 'OPEN_DETACHED_WINDOW') {
    chrome.windows.create({
      url: 'popup/detached.html',
      type: 'popup',
      width: 500,
      height: 700,
      focused: true
    }).then(window => {
      console.log('[BG] Detached window opened:', window.id);
      sendResponse({ success: true, windowId: window.id });
    }).catch(err => {
      console.error('[BG] Failed to open detached window:', err);
      sendResponse({ success: false, error: err.message });
    });
    
    return true;
  }
  
  // Handle clear logs request
  if (message.action === 'CLEAR_LOGS') {
    chrome.storage.local.set({ chess_fen_logs: [] }).then(() => {
      console.log('[BG] Logs cleared');
      sendResponse({ success: true });
    }).catch(err => {
      console.error('[BG] Failed to clear logs:', err);
      sendResponse({ success: false, error: err.message });
    });
    
    return true;
  }
  
  // Unknown action
  console.warn('[BG] Unknown action:', message.action);
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

/**
 * Handle extension installation/update
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[BG] Extension installed/updated:', details.reason);
  
  // Initialize default settings if not exist
  chrome.storage.local.get(Object.keys(DEFAULT_CONFIG)).then(result => {
    const updates = {};
    
    for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
      if (result[key] === undefined) {
        updates[key] = defaultValue;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates).then(() => {
        console.log('[BG] Default settings initialized:', updates);
      });
    }
  });
});

/**
 * Keep service worker alive
 */
let keepAliveInterval;

function startKeepAlive() {
  // Ping every 20 seconds to keep service worker alive
  keepAliveInterval = setInterval(() => {
    console.log('[BG] Keep alive ping');
  }, 20000);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
}

// Start keep alive
startKeepAlive();

// Stop keep alive when suspended (good practice)
chrome.runtime.onSuspend.addListener(() => {
  console.log('[BG] Service worker suspending');
  stopKeepAlive();
});

console.log('[BG] Service worker ready');