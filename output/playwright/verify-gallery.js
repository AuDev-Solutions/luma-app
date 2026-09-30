async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', error => errors.push(error.message));
  await p.addInitScript(() => {
    window.metrics = { frames: 0, gradients: 0 };
    const proto = CanvasRenderingContext2D.prototype;
    for (const key of ['createRadialGradient', 'createLinearGradient']) { const original = proto[key]; proto[key] = function(...args) { window.metrics.gradients++; return original.apply(this, args); }; }
    const clear = proto.clearRect;
    proto.clearRect = function(...args) { window.metrics.frames++; return clear.apply(this, args); };
  });
  await p.goto('http://192.168.1.40:5173');
  const sample = async ms => p.evaluate(async ms => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.metrics = { frames: 0, gradients: 0 };
    await new Promise(resolve => setTimeout(resolve, ms));
    return window.metrics;
  }, ms);
  const visible100 = await sample(2000);
  await p.getByRole('button', { name: 'Pausar animación', exact: true }).click();
  const paused = await sample(1000);
  await p.getByRole('button', { name: 'Todos', exact: true }).click();
  if (await p.getByRole('button', { name: /^Seleccionar / }).count() !== 21) throw Error('Expected 21 designs');
  const designs = await p.getByRole('button', { name: /^Seleccionar / }).all();
  for (const button of designs) {
    await button.click();
    if (await button.getAttribute('aria-pressed') !== 'true') throw Error('Selection failed');
  }
  await p.getByRole('searchbox', { name: 'Buscar diseños' }).fill('oceano');
  if (await p.getByRole('button', { name: /^Seleccionar / }).count() !== 1) throw Error('Accent search failed');
  await p.getByRole('button', { name: 'Seleccionar Océano', exact: true }).click();
  await p.getByRole('button', { name: 'Añadir Océano a favoritos', exact: true }).click();
  await p.getByRole('button', { name: 'Favoritos', exact: true }).click();
  if (await p.getByRole('button', { name: /^Seleccionar / }).count() !== 1) throw Error('Favorites failed');
  await p.reload();
  await p.getByRole('button', { name: 'Favoritos', exact: true }).click();
  if (await p.getByRole('button', { name: 'Seleccionar Océano' }).count() !== 1) throw Error('Favorite persistence failed');
  await p.getByRole('button', { name: 'Quitar Océano de favoritos' }).click();
  if (!await p.getByText('Tus favoritos, a un toque').isVisible()) throw Error('Empty state failed');
  await p.getByRole('searchbox', { name: 'Buscar diseños' }).fill('zzzz');
  if (!await p.getByText('No encontramos ese diseño').isVisible()) throw Error('Search empty state failed');
  await p.getByRole('button', { name: 'Ver los 21 diseños', exact: true }).click();
  await p.getByRole('button', { name: 'Seleccionar Color fijo', exact: true }).click();
  const solid = await sample(1000);
  if (!await p.getByRole('slider', { name: 'Velocidad', exact: true }).isDisabled()) throw Error('Solid speed should be disabled');
  await p.getByRole('button', { name: 'Seleccionar Prisma', exact: true }).click();
  if (await p.getByRole('textbox', { name: 'Color principal' }).count()) throw Error('Rainbow controls misleading');
  await p.getByRole('button', { name: 'Selección', exact: true }).click();
  await p.getByRole('button', { name: 'Seleccionar Océano', exact: true }).click();
  await p.getByRole('slider', { name: 'Brillo', exact: true }).fill('28');
  await p.getByRole('button', { name: 'Probar escena', exact: true }).click();
  await p.getByRole('button', { name: 'Cerrar notificación' }).click();
  await p.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await p.getByRole('textbox', { name: 'Nombre de la escena' }).fill('Océano prueba');
  await p.getByRole('dialog').getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await p.getByRole('button', { name: 'Cerrar notificación' }).click();
  await p.evaluate(() => window.scrollTo(0, 420));
  await p.screenshot({ path: 'output/playwright/gallery-mobile.png' });
  const mobile = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, preview: document.querySelector('.preview').getBoundingClientRect().toJSON(), action: document.querySelector('.action-dock').getBoundingClientRect().toJSON(), jsBytes: performance.getEntriesByType('resource').filter(r => r.name.endsWith('.js')).reduce((sum, r) => sum + r.decodedBodySize, 0) }));
  await p.getByRole('button', { name: 'Configurar montaje', exact: true }).click();
  await p.getByRole('button', { name: /Poste completo/ }).click();
  await p.getByRole('button', { name: 'Listo', exact: true }).click();
  const visible400 = await sample(2000);
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: 'output/playwright/gallery-desktop.png', fullPage: true });
  for (const width of [320, 360, 768]) {
    await p.setViewportSize({ width, height: 844 });
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Overflow at ' + width);
  }
  if (errors.length || mobile.overflow || paused.frames > 1 || solid.frames > 1) throw Error(JSON.stringify({ errors, mobile, paused, solid }));
  await context.close();
  return { visible100, paused, solid, visible400, mobile, errors, designs: 21 };
}
