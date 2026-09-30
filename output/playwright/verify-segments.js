async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await context.newPage();
  const errors = [], posts = [];
  p.on('pageerror', error => errors.push(error.message));
  let state = { on: true, bri: 255, transition: 4, seg: [0, 1].map(id => ({ id, n: `Cara ${id ? 'B' : 'A'}`, start: id * 50, stop: (id + 1) * 50, on: true, bri: 153, fx: 0, sx: 128, ix: 128, pal: 11, col: [[255,179,71],[0,0,0],[0,0,0]] })) };
  await p.route('http://pole.test/**', async route => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON(); posts.push(payload);
      state = { ...state, ...payload, seg: payload.seg.filter(item => item.stop > 0) };
    }
    await route.fulfill({ json: route.request().url().endsWith('/json') ? { state, info: { name: 'Poste de prueba', maxseg: 16, leds: { count: 100 } }, effects: ['Fireworks 1D', 'Solid', 'Gradient'] } : state });
  });
  try {
    await p.goto('http://localhost:5173');
    await p.getByRole('button', { name: 'Conectar poste', exact: true }).click();
    await p.getByRole('textbox', { name: 'Dirección del poste' }).fill('pole.test');
    await p.getByRole('button', { name: 'Conectar', exact: true }).click();
    await p.getByRole('button', { name: 'Borrador', exact: true }).click();
    await p.getByRole('button', { name: 'Cara A LED 1–50 · Fireworks 1D', exact: true }).click();
    await p.getByRole('button', { name: 'Dividir segmento', exact: true }).click();
    await p.getByRole('textbox', { name: 'Nombre del segmento' }).fill('Destellos');
    await p.getByRole('button', { name: '2 s', exact: true }).click();
    await p.getByRole('button', { name: 'Todos', exact: true }).click();
    await p.getByRole('button', { name: 'Seleccionar Color fijo', exact: true }).click();
    await p.getByLabel('Color principal', { exact: true }).fill('#ff0000');
    await p.getByRole('button', { name: 'Aplicar al poste', exact: true }).click();
    await p.getByText('Escena aplicada y confirmada por WLED.', { exact: true }).waitFor();
    if (posts.length !== 1 || posts[0].transition !== 20) throw Error('Transition not sent');
    const ranges = posts[0].seg.map(item => [item.id, item.start, item.stop]);
    if (JSON.stringify(ranges) !== JSON.stringify([[0,0,25],[1,25,50],[2,50,100]])) throw Error('Wrong segment ranges: ' + JSON.stringify(ranges));
    if (posts[0].seg[0].fx !== 0 || posts[0].seg[1].fx !== 1 || posts[0].seg[2].fx !== 0) throw Error('Effect selection changed other segments');
    await p.getByRole('button', { name: 'Borrador', exact: true }).click();
    await p.getByRole('spinbutton', { name: 'LED inicial', exact: true }).fill('25');
    if (!await p.getByRole('button', { name: 'Aplicar al poste', exact: true }).isDisabled()) throw Error('Overlap allowed');
    await p.getByRole('spinbutton', { name: 'LED inicial', exact: true }).fill('26');
    await p.getByRole('button', { name: 'Guardar escena', exact: true }).click();
    await p.getByRole('textbox', { name: 'Nombre de la escena' }).fill('Tres segmentos');
    await p.getByRole('dialog').getByRole('button', { name: 'Guardar escena', exact: true }).click();
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('luma-scenes'))[0].scene);
    if (saved.transition !== 2 || saved.segments.length !== 3) throw Error('Segments not saved');
    await p.getByRole('button', { name: 'Eliminar segmento', exact: true }).click();
    await p.getByRole('button', { name: 'Aplicar al poste', exact: true }).click();
    await p.getByText('Escena aplicada y confirmada por WLED.', { exact: true }).waitFor();
    if (!posts[1].seg.some(item => item.id === 2 && item.stop === 0)) throw Error('Segment not removed');
    await p.getByRole('button', { name: 'Tres segmentos', exact: true }).click();
    await p.getByRole('button', { name: 'Destellos LED 26–50 · Color fijo', exact: true }).click();
    await p.getByRole('button', { name: 'Cerrar notificación' }).click();
    await p.getByRole('spinbutton', { name: 'LED final', exact: true }).scrollIntoViewIfNeeded();
    await p.screenshot({ path: 'output/playwright/segments-mobile.png' });
    for (const width of [320, 390, 1440]) {
      await p.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw Error('Horizontal overflow at ' + width);
      if (width === 1440) { await p.evaluate(() => scrollTo(0,0)); await p.screenshot({ path: 'output/playwright/segments-desktop.png' }); }
    }
    if (errors.length) throw Error(errors.join('\n'));
    console.log(JSON.stringify({ posts: posts.length, ranges, transition: saved.transition, savedSegments: saved.segments.length, errors }));
  } finally { await context.close(); }
}
