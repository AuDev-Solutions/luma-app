async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', error => errors.push(error.message));
  await p.addInitScript(() => {
    const Original = window.WebSocket;
    window.liveSamples = []; window.liveSockets = [];
    window.WebSocket = class extends Original {
      constructor(...args) {
        super(...args); window.liveSockets.push(this);
        this.addEventListener('message', event => {
          if (event.data instanceof ArrayBuffer) { const bytes = new Uint8Array(event.data); if (bytes[0] === 76) { window.liveSamples.push(Array.from(bytes)); if (window.liveSamples.length > 100) window.liveSamples.shift(); } }
        });
      }
    };
  });
  try {
    await p.goto('http://192.168.1.40:5173');
    await p.getByRole('button', { name: 'Conectar poste', exact: true }).click();
    await p.getByRole('textbox', { name: 'Dirección del poste' }).fill('192.168.1.50');
    await p.getByRole('button', { name: 'Conectar', exact: true }).click();
    await p.getByText('En vivo', { exact: true }).waitFor();
    await p.getByRole('button', { name: 'Cerrar notificación' }).click();
    await p.getByRole('button', { name: 'Seleccionar Fireworks 1D', exact: true }).click();
    if (await p.getByRole('button', { name: 'Borrador', exact: true }).getAttribute('aria-pressed') !== 'true') throw Error('Editing must show draft');
    await p.getByRole('button', { name: 'Aplicar al poste', exact: true }).click();
    await p.getByText('Escena aplicada y confirmada por WLED.', { exact: true }).waitFor();
    if (await p.getByRole('button', { name: 'Poste en vivo', exact: true }).getAttribute('aria-pressed') !== 'true') throw Error('Apply must show actual output');
    await p.evaluate(() => { window.liveSamples = []; });
    await p.waitForFunction(() => window.liveSamples.length >= 40);
    const frames = await p.evaluate(() => ({ frames: window.liveSamples.length, bytes: window.liveSamples[0].length, distinct: new Set(window.liveSamples.map(frame => frame.join(','))).size }));
    await p.getByRole('button', { name: 'Cerrar notificación' }).click();
    await p.evaluate(() => window.scrollTo(0, 180));
    await p.screenshot({ path: 'output/playwright/fireworks-real-live.png' });
    await p.evaluate(() => window.liveSockets.forEach(socket => socket.close()));
    await p.getByText('Sin señal de vista en vivo', { exact: true }).waitFor();
    await p.getByRole('button', { name: 'Reconectar vista', exact: true }).click();
    await p.getByText('En vivo', { exact: true }).waitFor();
    const state = await p.evaluate(async () => { const data = await fetch('http://192.168.1.50/json').then(response => response.json()); return { count: data.info.leds.count, segments: data.state.seg.map(segment => ({ id: segment.id, start: segment.start, stop: segment.stop, effect: data.effects[segment.fx], palette: segment.pal, brightness: segment.bri })) }; });
    if (state.segments.some(segment => segment.effect !== 'Fireworks 1D') || frames.bytes !== 302 || frames.distinct < 2 || errors.length) throw Error(JSON.stringify({ state, frames, errors }));
    return { state, frames, errors, reconnect: true };
  } finally { await context.close(); }
}
