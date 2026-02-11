// inject/ws_hook.js
// Patch WebSocket để intercept Chess.com data
// Chess.com gửi format: B({"game":{"fen":"...","moves":"..."},...})

(function () {
  if (window.__chessHooked) return;
  window.__chessHooked = true;

  const _WS = window.WebSocket;

  function PatchedWS(url, protocols) {
    const ws = protocols ? new _WS(url, protocols) : new _WS(url);
    ws.addEventListener("message", (e) => {
      try { processRaw(e.data); } catch (_) {}
    });
    return ws;
  }

  // Giữ nguyên prototype để Chess.com không bị break
  PatchedWS.prototype  = _WS.prototype;
  PatchedWS.CONNECTING = _WS.CONNECTING;
  PatchedWS.OPEN       = _WS.OPEN;
  PatchedWS.CLOSING    = _WS.CLOSING;
  PatchedWS.CLOSED     = _WS.CLOSED;
  Object.setPrototypeOf(PatchedWS, _WS);
  window.WebSocket = PatchedWS;

  // ─── Main processor ──────────────────────────────────────

  function processRaw(data) {
    // ArrayBuffer → string
    if (data instanceof ArrayBuffer) {
      data = new TextDecoder().decode(data);
    }
    // Blob → async
    if (data instanceof Blob) {
      data.text().then(processRaw).catch(() => {});
      return;
    }
    if (typeof data !== "string" || data.length < 5) return;

    // Thử parse từng format Chess.com dùng
    parseAllFormats(data).forEach((obj) => {
      if (obj && hasChessData(obj)) {
        dispatch(flatten(obj));
      }
    });
  }

  // ─── Format parsers ───────────────────────────────────────

  function parseAllFormats(raw) {
    const results = [];

    // Format 1: Pure JSON  {"fen":"..."}
    if (raw[0] === "{" || raw[0] === "[") {
      tryJson(raw, results);
      return results;
    }

    // Format 2: Chess.com JSONP  B({...})  /  C([...])
    //           đây là format hay gặp nhất: B({"game":...})
    const jsonp = raw.match(/^[A-Za-z]\((.+)\)\s*$/s);
    if (jsonp) {
      tryJson(jsonp[1], results);
      return results;
    }

    // Format 3: Socket.IO  42["eventName",{...}]
    const sio = raw.match(/^42(.+)$/);
    if (sio) {
      tryJson(sio[1], results, true); // isArray=true
      return results;
    }

    // Format 4: nuke - scan tìm mọi {...} trong chuỗi
    const chunks = [...raw.matchAll(/\{(?:[^{}]|\{[^{}]*\})*\}/g)];
    chunks.forEach((m) => tryJson(m[0], results));

    return results;
  }

  function tryJson(str, out, isArray = false) {
    try {
      const parsed = JSON.parse(str);
      if (isArray && Array.isArray(parsed)) {
        parsed.forEach((item) => { if (item && typeof item === "object") out.push(item); });
      } else {
        out.push(parsed);
      }
    } catch (_) {}
  }

  // ─── Kiểm tra có chứa dữ liệu cờ không ──────────────────

  function hasChessData(obj) {
    if (!obj || typeof obj !== "object") return false;
    const keys = ["fen", "moves", "move", "pgn", "wtime", "btime", "game", "position"];
    return keys.some((k) => obj[k] !== undefined);
  }

  // ─── Flatten nested game object ───────────────────────────
  // Chess.com thường bọc trong: { game: { fen, moves, ... } }

  function flatten(obj) {
    // Nếu có obj.game chứa fen/moves → hoist lên
    if (obj.game && typeof obj.game === "object") {
      return { ...obj, ...obj.game };
    }
    return obj;
  }

  // ─── Dispatch về content script ──────────────────────────

  function dispatch(obj) {
    // Gửi raw JSON string (giữ nguyên format để fen_ws.js parse)
    window.postMessage({
      type: "FEN_RAW",
      payload: JSON.stringify(obj)
    }, "*");
  }

  console.log("[HOOK] WebSocket patched ✓");
})();