// WLED Peek: read-only LED output, not realtime input/control.
export function decodeLiveFrame(buffer, count) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 76 || bytes[1] !== 1 || bytes.length !== 2 + count * 3) return null;
  return bytes.slice(2);
}

export function subscribeLivePreview(address, count, onFrame, onStatus) {
  let socket, stopped = false, lastFrame = 0, started = 0, status;
  const report = next => { if (status !== next) { status = next; onStatus(next); } };
  function open() {
    if (stopped || document.hidden) return;
    report('waiting'); started = Date.now(); lastFrame = 0;
    const url = new URL('/ws', address); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(url); socket.binaryType = 'arraybuffer';
    const current = socket;
    socket.onopen = () => { if (!stopped && socket === current) current.send(JSON.stringify({ lv: true })); };
    socket.onmessage = event => {
      if (stopped || socket !== current || !(event.data instanceof ArrayBuffer)) return;
      const pixels = decodeLiveFrame(event.data, count);
      if (!pixels) { onFrame(null); report('unsupported'); return; }
      lastFrame = Date.now(); onFrame({ pixels, received: lastFrame }); report('live');
    };
    socket.onerror = socket.onclose = () => { if (!stopped && socket === current) { onFrame(null); report('offline'); } };
  }
  function close() { const current = socket; socket = null; current?.close(); onFrame(null); }
  const watch = setInterval(() => {
    if (!document.hidden && (status === 'live' || status === 'waiting') && Date.now() - (lastFrame || started) > 2500) {
      onFrame(null); report('stale');
    }
  }, 500);
  const visibility = () => { close(); if (document.hidden) report('paused'); else open(); };
  document.addEventListener('visibilitychange', visibility);
  open();
  return () => { stopped = true; clearInterval(watch); document.removeEventListener('visibilitychange', visibility); close(); };
}
