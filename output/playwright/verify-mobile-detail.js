async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', error => errors.push(error.message));
  await p.goto('http://192.168.1.40:5173');
  await p.getByRole('button', { name: 'Seleccionar Prisma' }).click();
  await p.getByRole('button', { name: 'Pausar animación' }).click();
  await p.evaluate(() => window.scrollTo(0, 350));
  await p.screenshot({ path: 'output/playwright/mobile-detail-inline.png' });
  const normal = await p.locator('.preview-lights').evaluate(canvas => ({ width: canvas.width, height: canvas.height, cssHeight: canvas.getBoundingClientRect().height }));
  await p.getByRole('button', { name: 'Ampliar vista previa' }).click();
  const dialog = p.getByRole('dialog', { name: 'Vista ampliada' });
  await dialog.waitFor();
  if (await dialog.getByRole('button', { name: 'Reproducir animación' }).count() !== 1) throw Error('Pause state not shared');
  await dialog.getByRole('button', { name: 'Cara A', exact: true }).click();
  await p.screenshot({ path: 'output/playwright/mobile-detail-expanded.png' });
  const enlarged = await dialog.locator('.preview-lights').evaluate(canvas => ({ width: canvas.width, height: canvas.height, cssHeight: canvas.getBoundingClientRect().height }));
  if (enlarged.cssHeight < 500 || normal.cssHeight < 220) throw Error('Preview too short');
  await dialog.getByRole('button', { name: 'Reproducir animación' }).click();
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  if (await p.getByRole('button', { name: 'Pausar animación' }).count() !== 1) throw Error('Playback not preserved');
  const restoredFocus = await p.getByRole('button', { name: 'Ampliar vista previa' }).evaluate(el => el === document.activeElement);
  await p.getByRole('button', { name: 'Configurar montaje' }).click();
  await p.getByRole('button', { name: /Poste completo/ }).click();
  await p.getByRole('button', { name: 'Listo', exact: true }).click();
  await p.getByRole('button', { name: 'Ampliar vista previa' }).click();
  await dialog.getByRole('button', { name: 'Pausar animación' }).click();
  await p.screenshot({ path: 'output/playwright/mobile-detail-400.png' });
  await p.keyboard.press('Escape');
  if (await p.getByRole('dialog').count()) throw Error('Escape did not close');
  for (const size of [{ width: 320, height: 640 }, { width: 844, height: 390 }]) {
    await p.setViewportSize(size);
    await p.getByRole('button', { name: 'Ampliar vista previa' }).click();
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Horizontal overflow');
    await p.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  }
  if (errors.length || !restoredFocus) throw Error(JSON.stringify({ errors, restoredFocus }));
  await context.close();
  return { normal, enlarged, restoredFocus, errors };
}
