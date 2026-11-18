// Capturas de LUMA para el manual técnico, contra el poste simulado de las pruebas e2e.
// Uso: npm run capturas:manual [-- carpetaSalida]   (por defecto ../documentacion/img/app/)
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { browserPath, createPole } from '../tests/e2e/mock-pole.mjs';
import { effects as disenos } from '../src/lib/scenes.js';

const salida = resolve(process.argv[2] ?? fileURLToPath(new URL('../../documentacion/img/app/', import.meta.url)));
mkdirSync(salida, { recursive: true });
// Todos los efectos que usa LUMA existen en el poste simulado, para que la galería se vea como en un poste real.
const efectosWled = [...new Set(disenos.flatMap(diseno => [diseno.wled, ...(diseno.aliases ?? [])]))];
const POSTE = '4.3.2.1';

const server = await preview({ preview: { port: 0, strictPort: false, host: '127.0.0.1' }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: browserPath(), channel: browserPath() ? undefined : 'chrome' });
const errores = [];

async function abrir({ escritorio = false, conectar = true } = {}) {
  const context = await browser.newContext(
    escritorio
      ? { viewport: { width: 1440, height: 1000 } }
      : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  );
  const page = await context.newPage();
  page.on('pageerror', error => errores.push(error.message));
  const pole = createPole({ twoFaces: true, effects: ['Solid', ...efectosWled.filter(nombre => nombre !== 'Solid')] });
  const info = pole.info;
  pole.info = () => ({ ...info(), name: 'LUMA' });
  await page.route(`http://${POSTE}/**`, pole.route);
  // Vista en vivo (Peek de WLED): cuadros [76, 1, R, G, B, …] con los colores de cada segmento, en movimiento.
  await page.routeWebSocket(`ws://${POSTE}/ws`, ws => {
    let fase = 0;
    const enviar = () => {
      const leds = pole.info().leds.count,
        cuadro = new Uint8Array(2 + leds * 3);
      cuadro.set([76, 1]);
      for (let i = 0; i < leds; i++) {
        const seg = pole.state.seg.find(item => i >= item.start && i < item.stop) ?? pole.state.seg[0];
        const [a, b] = seg.col,
          mezcla = (Math.sin((i + fase) / 3) + 1) / 2;
        for (let c = 0; c < 3; c++) cuadro[2 + i * 3 + c] = Math.round(a[c] * mezcla + (b?.[c] ?? 0) * (1 - mezcla));
      }
      fase++;
      ws.send(Buffer.from(cuadro));
    };
    const reloj = setInterval(enviar, 120);
    ws.onMessage(() => enviar());
    ws.onClose(() => clearInterval(reloj));
  });
  await page.goto(url);
  if (conectar) {
    await page.getByRole('button', { name: 'Conectar poste', exact: true }).click();
    await page.getByRole('textbox', { name: 'Dirección del poste' }).fill(POSTE);
    await page.getByRole('button', { name: 'Conectar', exact: true }).click();
    await page.getByText('Conectado a LUMA.').waitFor();
    await page.getByRole('button', { name: 'Cerrar notificación' }).click();
  }
  return { page, pole, close: () => context.close() };
}

// La barra inferior es fija: se oculta en las capturas de un elemento para que no tape su contenido.
const tomar = async (objetivo, nombre) => {
  const esPagina = typeof objetivo.goto === 'function';
  await objetivo.screenshot({
    path: join(salida, `${nombre}.png`),
    animations: 'disabled',
    style: esPagina ? '' : '.action-dock{visibility:hidden}',
  });
  console.log(`  ${nombre}.png`);
};
const seccion = (page, id) => page.locator(`section[aria-labelledby="${id}"]`);
const pausa = page => page.waitForTimeout(400);

async function guardarEnPoste(page, nombre) {
  await page.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nombre de la escena' }).fill(nombre);
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar escena' }).click();
  await page.getByText(`“${nombre}” guardada en el poste y en este teléfono.`).waitFor();
  await page.getByRole('button', { name: 'Cerrar notificación' }).click();
}

try {
  // Inicio y conexión
  {
    const { page, close } = await abrir({ conectar: false });
    await pausa(page);
    await tomar(page, 'inicio-desconectado');
    await page.getByRole('button', { name: 'Conectar poste', exact: true }).click();
    await page.getByRole('textbox', { name: 'Dirección del poste' }).fill(POSTE);
    await pausa(page);
    await tomar(page.getByRole('dialog'), 'conectar-dialogo');
    await close();
  }
  // Editor por pestañas (móvil)
  {
    const { page, close } = await abrir();
    const editor = page.locator('section[aria-label="Editor de escenas"]');
    await pausa(page);
    await tomar(page, 'conectado');
    await page.locator('label.master-brightness').scrollIntoViewIfNeeded();
    await tomar(page.locator('label.master-brightness'), 'brillo');
    await page.getByRole('tab', { name: 'Colores' }).click();
    await pausa(page);
    await tomar(editor, 'colores');
    await page.getByRole('tab', { name: 'Efectos' }).click();
    await page.getByRole('button', { name: 'Seleccionar Fuego ámbar', exact: true }).click();
    await pausa(page);
    await tomar(page.locator('.effect-settings'), 'efecto-detalle');
    await page.getByLabel('Buscar diseños').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => scrollBy(0, -150));
    await pausa(page);
    await tomar(page, 'efectos-galeria');
    await page.getByRole('tab', { name: 'Segmentos' }).click();
    await page.getByRole('button', { name: 'Partir en 2', exact: true }).click();
    await pausa(page);
    await tomar(editor, 'segmentos');
    await page.getByRole('button', { name: 'Ampliar vista previa' }).first().click();
    await pausa(page);
    await tomar(page.getByRole('dialog'), 'vista-poste-ampliada');
    await page.keyboard.press('Escape');
    await close();
  }
  // Escenas, temas, modo automático y horario
  {
    const { page, close } = await abrir();
    await page.getByRole('tab', { name: 'Escenas' }).click();
    await pausa(page);
    await tomar(seccion(page, 'themes-title'), 'temas');
    await page.getByRole('button', { name: /Navidad/ }).click();
    await page.getByRole('button', { name: 'Guardar escena', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nombre de la escena' }).fill('Navidad');
    await pausa(page);
    await tomar(page.getByRole('dialog'), 'escenas-guardar');
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar escena' }).click();
    await page.getByText('“Navidad” guardada en el poste y en este teléfono.').waitFor();
    await page.getByRole('button', { name: 'Cerrar notificación' }).click();
    await page.getByRole('button', { name: /Halloween/ }).click();
    await guardarEnPoste(page, 'Halloween');
    await page.getByRole('button', { name: 'Usar Navidad al encender' }).click();
    await page.getByText('El poste mostrará esa escena al encender.').waitFor();
    await pausa(page);
    await tomar(seccion(page, 'pole-title'), 'escenas-lista');
    await page.getByRole('checkbox', { name: 'Navidad' }).check();
    await page.getByRole('checkbox', { name: 'Halloween' }).check();
    await pausa(page);
    await tomar(seccion(page, 'auto-title'), 'modo-automatico');
    await page.getByRole('radio', { name: 'Al anochecer' }).click();
    await page.getByRole('spinbutton', { name: 'Latitud' }).fill('4.71');
    await page.getByRole('spinbutton', { name: 'Longitud' }).fill('-74.07');
    await page.getByRole('checkbox', { name: 'Apagar a una hora' }).check();
    await pausa(page);
    await tomar(seccion(page, 'schedule-title'), 'horario');
    await close();
  }
  // Mi montaje
  {
    const { page, close } = await abrir();
    await page.getByRole('button', { name: 'Mi montaje' }).click();
    await pausa(page);
    await tomar(page.getByRole('dialog'), 'mi-montaje');
    await tomar(seccion(page, 'power-title'), 'consumo');
    await tomar(seccion(page, 'wifi-title'), 'wifi-propio');
    await tomar(seccion(page, 'security-title'), 'seguridad');
    await close();
  }
  // Escritorio
  {
    const { page, close } = await abrir({ escritorio: true });
    await pausa(page);
    await tomar(page, 'escritorio-general');
    await page.getByRole('tab', { name: 'Segmentos' }).click();
    await page.getByRole('button', { name: 'Partir en 4', exact: true }).click();
    await pausa(page);
    await tomar(page, 'escritorio-segmentos');
    await close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
if (errores.length) {
  console.error('Errores de la página:', errores);
  process.exit(1);
}
console.log(`Listo: capturas en ${salida}`);
