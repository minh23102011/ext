(() => {
  console.log("[HOOK] WebSocket hook injected");
  
  const NativeWS = window.WebSocket;

  window.WebSocket = function (...args) {
    const ws = new NativeWS(...args);
    
    console.log("[HOOK] WebSocket created:", args[0]);

    // Hook incoming messages
    ws.addEventListener("message", (ev) => {
      try {
        let text = null;
        
        // Handle different data types
        if (typeof ev.data === "string") {
          text = ev.data;
        } else if (ev.data instanceof ArrayBuffer) {
          text = new TextDecoder().decode(ev.data);
        } else if (ev.data instanceof Blob) {
          // Handle Blob data
          const reader = new FileReader();
          reader.onload = () => {
            const blobText = reader.result;
            if (blobText && blobText.includes('"fen"')) {
              window.postMessage({
                type: "FEN_RAW",
                payload: blobText
              }, "*");
            }
          };
          reader.readAsText(ev.data);
          return;
        }

        // Check if message contains chess data
        if (text && (
          text.includes('"fen"') || 
          text.includes('"move"') || 
          text.includes('"moves"') ||
          text.includes('"pgn"') ||
          text.includes('"game"') ||
          text.includes('"wtime"') ||
          text.includes('"btime"')
        )) {
          window.postMessage({
            type: "FEN_RAW",
            payload: text
          }, "*");
        }
      } catch (err) {
        console.error("[HOOK] Message processing error:", err);
      }
    });
    
    // Hook outgoing messages (optional - for debugging)
    const originalSend = ws.send;
    ws.send = function(data) {
      try {
        if (typeof data === 'string' && data.includes('move')) {
          console.log("[HOOK] Outgoing:", data.substring(0, 100));
        }
      } catch (e) {}
      return originalSend.call(this, data);
    };

    return ws;
  };
  
  // Copy properties from native WebSocket
  Object.setPrototypeOf(window.WebSocket, NativeWS);
  window.WebSocket.prototype = NativeWS.prototype;
  
  console.log("[HOOK] WebSocket interception ready");
})();