async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await context.newPage();
  const requests = [];
  const names = ['Solid', 'Gradient', 'Meteor', 'Rainbow'];
  let state = { on: true, bri: 255, seg: [{ id: 0, start: 0, stop: 100 }] };
  await p.route('http://pole.test/**', async route => {
    const request = route.request();
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (request.method() === 'POST') {
      const body = request.postDataJSON(); requests.push(body);
      state = { ...state, ...body, seg: body.seg.map(segment => ({ ...state.seg.find(old => old.id === segment.id), ...segment })) };
    }
    const response = request.url().endsWith('/json') ? { info: { name: 'Poste simulado', leds: { count: 100 } }, state, effects: names } : state;
    await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(response) });
  });
  await p.goto('http://localhost:5173');
  await p.getByRole('button', { name: 'Conectar poste', exact: true }).click();
  await p.getByRole('textbox', { name: 'Dirección del poste' }).fill('pole.test');
  await p.getByRole('button', { name: 'Conectar', exact: true }).click();
  await p.getByText('Conectado a Poste simulado. Tu escena está lista para aplicar.', { exact: true }).waitFor();
  await p.getByRole('button', { name: 'Cerrar notificación' }).click();
  if (!await p.getByRole('button', { name: 'Seleccionar Océano' }).isDisabled()) throw Error('Unavailable effect should be disabled');
  await p.getByRole('button', { name: 'Seleccionar Prisma' }).click();
  if (requests.length) throw Error('Selection must not write to the controller');
  await p.getByRole('button', { name: 'Aplicar al poste', exact: true }).click();
  await p.getByText('Escena aplicada y confirmada por WLED.', { exact: true }).waitFor();
  if (requests[0].seg.length !== 2 || requests[0].seg[1].stop !== 100 || requests[0].seg[0].pal !== 11 || requests[0].seg[0].fx !== 3) throw Error('Prisma payload incorrect');
  await p.getByRole('button', { name: 'Cerrar notificación' }).click();
  await p.getByRole('button', { name: 'Seleccionar Ascenso' }).click();
  await p.getByRole('button', { name: 'Aplicar al poste', exact: true }).click();
  await p.getByText('Escena aplicada y confirmada por WLED.', { exact: true }).waitFor();
  if (requests[1].seg[0].fx !== 2 || requests[1].seg[0].pal !== 3) throw Error('Meteor fallback incorrect');
  await context.close();
  await page.reload();
  return { supportedFiltering: true, explicitApply: true, confirmedPresets: ['Prisma', 'Ascenso'], hardware: 'simulated' };
}
