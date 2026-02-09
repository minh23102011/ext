// ==============================
// background.js
// ==============================

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "FEN") return;

  const payload = {
    ...msg.payload,
    ts: Date.now()
  };

  fetch("http://127.0.0.1:8765/fen", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
  .then(() => {
    console.log("[BG] FEN sent");
  })
  .catch(err => {
    console.error("[BG] send failed", err);
  });
});
