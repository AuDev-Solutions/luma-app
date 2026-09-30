async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await context.newPage();
  const errors = [], results = [];
  p.on('pageerror', error => errors.push(error.message));
  try {
    await p.goto('http://localhost:5173');
    await p.getByRole('button', { name: /Cara A LED 1–50/ }).click();
    for (const [width, height] of [[390,844],[320,740],[430,932],[740,390]]) {
      await p.setViewportSize({ width, height });
      const field = p.getByRole('spinbutton', { name: 'LED final', exact: true });
      await field.scrollIntoViewIfNeeded();
      await field.click();
      const layout = await field.evaluate(el => {
        const r = el.getBoundingClientRect(), preview = document.querySelector('.workspace > .preview'), dock = document.querySelector('.action-dock').getBoundingClientRect();
        return { position: getComputedStyle(preview).position, previewBottom: preview.getBoundingClientRect().bottom, fieldTop: r.top, fieldBottom: r.bottom, dockTop: dock.top, hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      if (layout.position === 'sticky' || !layout.hit || layout.fieldBottom > layout.dockTop || layout.overflow) throw Error(JSON.stringify(layout));
      await p.getByRole('slider', { name: 'Transición en segundos' }).fill('2');
      const before = await p.evaluate(() => scrollY);
      await p.getByRole('button', { name: 'Ver poste', exact: true }).click();
      const dialog = p.getByRole('dialog', { name: 'Vista ampliada' });
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'Cara B', exact: true }).click();
      await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
      const after = await p.evaluate(() => ({ y: scrollY, focus: document.activeElement.textContent }));
      if (Math.abs(after.y - before) > 3 || !after.focus.includes('Ver poste')) throw Error('Lost editing position: ' + JSON.stringify({before,after}));
      results.push({ width, height, ...layout });
      if (width === 390) await p.screenshot({ path: 'output/playwright/mobile-editor-fixed.png' });
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.getByRole('button', { name: 'Seleccionar Prisma', exact: true }).click();
    await p.getByRole('button', { name: 'Ver poste', exact: true }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await p.getByRole('button', { name: 'Probar escena', exact: true }).click();
    await p.getByText('Escena probada en el simulador. Conecta tu poste para enviarla a las luces.', { exact: true }).waitFor();
    await p.getByRole('button', { name: 'Cerrar notificación' }).click();
    await p.screenshot({ path: 'output/playwright/mobile-gallery-fixed.png' });
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.getByRole('button', { name: 'Ampliar vista previa', exact: true }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    if (errors.length) throw Error(errors.join('\n'));
    return { results, errors };
  } finally { await context.close(); }
}
