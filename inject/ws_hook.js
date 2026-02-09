(() => {
  const NativeWS = window.WebSocket;

  window.WebSocket = function (...args) {
    const ws = new NativeWS(...args);

    ws.addEventListener("message", (ev) => {
      try {
        let text = null;
        if (typeof ev.data === "string") text = ev.data;
        else if (ev.data instanceof ArrayBuffer)
          text = new TextDecoder().decode(ev.data);

        if (text && text.includes('"fen"')) {
          window.postMessage({
            type: "FEN_RAW",
            payload: text
          }, "*");
        }
      } catch {}
    });

    return ws;
  };
})();
