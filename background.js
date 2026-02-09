console.log("[BG] Chess Monitor Service Worker Started");

// Track backend status
let lastBackendStatus = null;

// Listen for FEN data from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "FEN") return;

  const payload = {
    ...msg.payload,
    ts: Date.now()
  };

  console.log("[BG] Sending FEN to backend:", payload);

  // Send to backend
  fetch("http://127.0.0.1:8765/fen", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
  .then(response => {
    const success = response.ok;
    lastBackendStatus = {
      success,
      timestamp: Date.now(),
      status: response.status
    };

    console.log("[BG] Backend response:", lastBackendStatus);

    // Send to popup with backend status
    const popupPayload = {
      ...payload,
      backend_status: success ? "success" : "failed"
    };

    chrome.runtime.sendMessage({
      type: "FEN_LOG",
      payload: popupPayload
    }).catch(() => {
      // Popup might not be open, that's okay
    });
  })
  .catch(err => {
    console.error("[BG] Backend send failed:", err);
    lastBackendStatus = {
      success: false,
      timestamp: Date.now(),
      error: err.message
    };

    // Send to popup with error status
    const popupPayload = {
      ...payload,
      backend_status: "failed"
    };

    chrome.runtime.sendMessage({
      type: "FEN_LOG",
      payload: popupPayload
    }).catch(() => {});
  });
});

// Handle popup requests for backend status
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_BACKEND_STATUS") {
    sendResponse({ status: lastBackendStatus });
    return true;
  }
});

// Handle settings update
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "UPDATE_SETTINGS") {
    console.log("[BG] Settings updated:", msg.settings);
    sendResponse({ success: true });
    return true;
  }
});

// Handle always-on-top requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SET_ALWAYS_ON_TOP") {
    chrome.windows.update(msg.windowId, {
      focused: true,
      drawAttention: true
    }).then(() => {
      console.log("[BG] Window updated:", msg.windowId);
      sendResponse({ success: true });
    }).catch(err => {
      console.error("[BG] Window update failed:", err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});

// Handle opening monitor window
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "OPEN_MONITOR_WINDOW") {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/detached.html'),
      type: 'popup',
      width: 500,
      height: 700,
      focused: true
    }).then((window) => {
      console.log("[BG] Monitor window opened:", window.id);
      sendResponse({ success: true, windowId: window.id });
    }).catch(err => {
      console.error("[BG] Failed to open window:", err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});