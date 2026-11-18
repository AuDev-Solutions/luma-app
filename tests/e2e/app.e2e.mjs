// End-to-end tests in a real browser against a simulated pole. Run: npm run test:e2e
// Browser: LUMA_CHROME, else a Playwright Chromium in %LOCALAPPDATA%/ms-playwright, else installed Chrome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { browserPath, createPole, effects } from './mock-pole.mjs';

let server, browser, url;
test.before(async () => {
  server = await preview({ preview: { port: 0, strictPort: false, host: '127.0.0.1' }, logLevel: 'silent' });
  url = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath: browserPath(), channel: browserPath() ? undefined : 'chrome' });
});
test.after(async () => { await browser?.close(); await new Promise(resolve => server?.httpServer.close(resolve)); });

async function open({ mobile = false, connect = true , twoFaces = false } = {}) {
  const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const pole = createPole({ twoFaces });
  await page.route('http://pole.test/**', pole.route);
  await page.goto(url);
  if (connect) {
    await page.getByRole('button', { name: 'Conectar poste', exact: true }).click();
    await page.getByRole('textbox', { name: 'Dirección del poste' }).fill('pole.test');
    await page.getByRole('button', { name: 'Conectar', exact: true }).click();
    await page.getByText('Conectado a Poste de prueba.').waitFor();
    await page.getByRole('button', { name: 'Cerrar notificación' }).click();
  }
  return { page, pole, errors, close: () => context.close() };
}
// Live changes settle, then the pole keeps them as its boot scene (preset 248).
async function settled(pole) {
  for (let i = 0; i < 100; i++) {
    const posts = pole.posts.length;
    await new Promise(resolve => setTimeout(resolve, 150));
    if (pole.presets[248] && pole.posts.length === posts && pole.cfgPosts.some(body => body.def?.ps === 248)) return;
  }
  throw new Error('the pole never kept the scene');
}

test('Pole split in 4: each part keeps its colour when one effect is chosen for all', async () => {
  const { page, pole, errors, close } = await open();
  await page.getByRole('tab', { name: 'Segmentos' }).click();
  await page.getByRole('button', { name: 'Partir en 4', exact: true }).click();
  await page.getByRole('group', { name: 'Segmento que editas' }).getByRole('button', { name: 'Parte 2' }).click();
  await page.getByRole('tab', { name: 'Colores' }).click();
  await page.getByRole('button', { name: 'Rosa', exact: true }).click();
  await page.getByRole('group', { name: 'Segmento que editas' }).getByRole('button', { name: 'Todos' }).click();
  await page.getByRole('tab', { name: 'Efectos' }).click();
  await page.getByRole('button', { name: 'Todos', exact: true }).last().click();
  await page.getByRole('button', { name: 'Seleccionar Onda esmeralda', exact: true }).click();
  await settled(pole);
  const seg = pole.posts.at(-1).seg.filter(item => item.stop);
  assert.deepEqual(seg.map(item => [item.start, item.stop, effects[item.fx]]), [[0, 25, 'Running'], [25, 50, 'Running'], [50, 75, 'Running'], [75, 100, 'Running']]);
  assert.deepEqual(seg[1].col[0], [255, 0, 255]);
  assert.equal(new Set(seg.map(item => item.col[0].join())).size, 4);
  assert.deepEqual(errors, []); await close();
});

test('Undo and redo restore colour changes', async () => {
  const { page, errors, close } = await open({ connect: false });
  const hex = page.getByRole('textbox', { name: 'Código hexadecimal del color' });
  const before = await hex.inputValue();
  await page.getByRole('button', { name: 'Rojo', exact: true }).click();
  assert.equal(await hex.inputValue(), '#ff0000');
  await page.getByRole('button', { name: /Deshacer/ }).click();
  assert.equal(await hex.inputValue(), before);
  await page.getByRole('button', { name: /Rehacer/ }).click();
  assert.equal(await hex.inputValue(), '#ff0000');
  assert.deepEqual(errors, []); await close();
});

test('Themes, master brightness and saving on the pole (without applying it while saving)', async () => {
  const { page, pole, errors, close } = await open();
  await page.getByRole('tab', { name: 'Escenas' }).click();
  await page.getByRole('button', { name: /Navidad/ }).click();
  await page.getByRole('slider', { name: 'Brillo general del poste' }).fill('60');
  await settled(pole);
  const post = pole.posts.at(-1);
  assert.equal(post.bri, 153);
  assert.equal(pole.presets[248].n, 'Escena aplicada'); assert.equal(pole.presets[248].on, true);
  assert.ok(pole.cfgPosts.some(body => body.def?.ps === 248), 'the live scene becomes the boot scene');
  assert.equal(effects[post.seg[0].fx], 'Chase 2');
  const postsBeforeSave = pole.posts.length;
  await page.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nombre de la escena' }).fill('Navidad 60');
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar escena' }).click();
  await page.getByText('“Navidad 60” guardada en el poste y en este teléfono.').waitFor();
  assert.equal(pole.posts.length, postsBeforeSave, 'saving must not change the lights');
  assert.equal(pole.presets[1].n, 'Navidad 60');
  assert.equal(pole.presets[1].luma.bri, 60);
  await page.getByRole('button', { name: 'Usar Navidad 60 al encender' }).click();
  await page.getByText('El poste mostrará esa escena al encender.').waitFor();
  assert.deepEqual(pole.cfgPosts.at(-1), { def: { ps: 1, on: true } });
  await page.getByRole('button', { name: 'Mostrar Navidad 60 en el poste' }).click();
  await page.getByText('«Navidad 60» en el poste.').waitFor();
  assert.deepEqual(pole.posts.at(-1), { ps: 1 });
  assert.deepEqual(errors, []); await close();
});

test('Automatic mode and sunset schedule are written to the pole', async () => {
  const { page, pole, errors, close } = await open();
  pole.presets = { 0: {}, 1: { n: 'Fuego', luma: null }, 2: { n: 'Nieve', luma: null } };
  await page.getByRole('button', { name: 'Mi montaje' }).click();
  await page.getByRole('button', { name: 'Volver a detectar' }).click();
  await page.getByText('Lectura del poste actualizada.').waitFor();
  await page.getByRole('button', { name: 'Listo' }).click();
  await page.getByRole('tab', { name: 'Escenas' }).click();
  await page.getByRole('checkbox', { name: 'Fuego' }).check();
  await page.getByRole('checkbox', { name: 'Nieve' }).check();
  await page.getByRole('spinbutton').filter({ hasText: '' }).first().fill('10');
  await page.getByRole('button', { name: 'Activar', exact: true }).click();
  await page.getByText(/Modo automático: cambia cada/).waitFor();
  assert.deepEqual(pole.presets[249].playlist.ps, [1, 2]);
  assert.deepEqual(pole.posts.at(-1), { ps: 249 });
  await page.getByRole('radio', { name: 'Al anochecer' }).click();
  await page.getByRole('spinbutton', { name: 'Latitud' }).fill('4.81');
  await page.getByRole('spinbutton', { name: 'Longitud' }).fill('-75.69');
  await page.getByRole('checkbox', { name: 'Apagar a una hora' }).check();
  await page.getByRole('button', { name: 'Guardar horario' }).click();
  await page.getByText('Horario guardado en el poste.').waitFor();
  const cfg = pole.cfgPosts.at(-1);
  assert.equal(cfg.timers.ins[0].hour, 254);
  assert.equal(cfg.timers.ins[1].macro, 250);
  assert.deepEqual([cfg.if.ntp.lt, cfg.if.ntp.ln], [4.81, -75.69]);
  assert.deepEqual(pole.presets[250], { n: 'Apagar', on: false });
  assert.deepEqual(errors, []); await close();
});

test('Current limit from the power-supply rating keeps the LED output', async () => {
  const { page, pole, errors, close } = await open();
  await page.getByRole('button', { name: 'Mi montaje' }).click();
  await page.getByText('sin límite', { exact: true }).waitFor();
  await page.getByRole('spinbutton', { name: 'Amperios de la fuente' }).fill('10');
  await page.getByRole('button', { name: 'Limitar a 8,5 A' }).click();
  await page.getByText('Límite de corriente: 8,5 A.').waitFor();
  assert.deepEqual(pole.cfgPosts.at(-1).hw.led.ins[0], { start: 0, len: 100, pin: [17], type: 22, maxpwr: 8500, ledma: 30 });
  assert.deepEqual(errors, []); await close();
});

test('Changes reach the pole without pressing Apply', async () => {
  const { page, pole, errors, close } = await open();
  const count = pole.posts.length;
  await page.getByRole('button', { name: 'Azul', exact: true }).click();
  await page.waitForTimeout(600);
  assert.ok(pole.posts.length > count, 'change sent automatically');
  assert.deepEqual(pole.posts.at(-1).seg[0].col[0], [0, 0, 255]);
  assert.deepEqual(errors, []); await close();
});

test('Standalone Wi-Fi: the pole gets its own network and the app explains how to rejoin it', async () => {
  const { page, pole, errors, close } = await open({ mobile: true });
  await page.getByRole('button', { name: 'Mi montaje' }).click();
  await page.getByText('Además se conecta a la red «Casa». En la calle no la tendrá.').waitFor();
  await page.getByRole('button', { name: 'Configurar para funcionar solo' }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Nombre de la red' }).inputValue(), 'LUMA-Poste1');
  await page.getByRole('textbox', { name: 'Contraseña nueva' }).fill('poste-seguro-1');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Guardar y reiniciar el poste' }).click();
  await page.getByText('El poste se está reiniciando').waitFor();
  assert.deepEqual(pole.cfgPosts.at(-1), { ap: { ssid: 'LUMA-Poste1', psk: 'poste-seguro-1', behav: 2 }, nw: { ins: [{ ssid: 'Your_Network' }] }, rb: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: 'Entendido' }).click();
  assert.ok(await page.locator('.status-dot.off').count(), 'the app shows it is no longer connected');
  assert.deepEqual(errors, []); await close();
});

test('Two faces on their own pins: face B repeats face A in hardware, one pole is shown', async () => {
  const { page, pole, errors, close } = await open({ twoFaces: true });
  await page.getByText('Dos caras iguales · 100 píxeles por cara').waitFor();
  await settled(pole);
  // Both outputs start at LED 1: WLED sends every pixel to both pins, so random effects match too.
  const outputs = pole.cfg.hw.led.ins.map(bus => [bus.pin[0], bus.start, bus.len, bus.drv]);
  assert.deepEqual(outputs, [[17, 0, 100, 0], [3, 0, 100, 1]], 'pins and drivers are kept, face B starts at LED 1');
  const ranges = () => pole.posts.at(-1).seg.filter(item => item.stop).map(item => [item.start, item.stop]);
  assert.deepEqual(ranges(), [[0, 100]], 'one face is sent; the controller copies it to face B');
  assert.equal(await page.getByRole('button', { name: 'Cara A', exact: true }).count(), 0, 'faces cannot be edited separately');
  await page.getByRole('tab', { name: 'Segmentos' }).click();
  await page.getByRole('button', { name: 'Partir en 2', exact: true }).click();
  await page.waitForTimeout(600);
  assert.deepEqual(ranges(), [[0, 50], [50, 100]]);
  await page.getByRole('button', { name: 'Mi montaje' }).click();
  await page.getByText('Dos caras · 200 LEDs').first().waitFor();
  assert.equal(await page.getByRole('button', { name: /usar 200 LEDs/ }).count(), 0, 'no series wiring offer with one face per pin');
  assert.deepEqual(errors, []); await close();
});

test('Mobile: every tab fits the screen', async () => {
  const { page, errors, close } = await open({ mobile: true });
  for (const tab of ['Colores', 'Efectos', 'Segmentos', 'Escenas']) {
    await page.getByRole('tab', { name: tab }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, tab);
  }
  await page.getByRole('button', { name: 'Mi montaje' }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mi montaje');
  assert.deepEqual(errors, []); await close();
});
