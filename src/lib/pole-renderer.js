import { hexToRgb, pixelColor, paletteColor, paletteKey } from './scenes.js';

import { segmentMap, defaultSegments } from './segments.js';

const PALETTE_SIZE = 32;
const SPRITE_SIZE = 64;

// Bake glow and highlight once per palette, never per LED per animation frame.
function makePalette(face, radius, narrow) {
  const colors = face.colors.map(hexToRgb);
  const sprites = Array.from({ length: PALETTE_SIZE }, (_, index) => {
    const color = paletteColor(face, index / (PALETTE_SIZE - 1), colors);
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = SPRITE_SIZE * 2;
    const ctx = sprite.getContext('2d');
    ctx.scale(2, 2);
    const rgb = color.join(',');
    // In a narrow view, keep each color legible horizontally without blurring
    // neighbouring LEDs vertically. Cached at 2x to retain subpixel row detail.
    const radiusX = narrow ? 4 : radius;
    ctx.save(); ctx.translate(32, 32);
    ctx.scale(narrow ? 9 : 24, narrow ? Math.max(1, radius * 2) : 24);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, `rgba(${rgb},${narrow ? 0.24 : 0.42})`); glow.addColorStop(0.3, `rgba(${rgb},${narrow ? 0.08 : 0.16})`); glow.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = glow; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
    ctx.fillStyle = `rgb(${rgb})`; ctx.beginPath(); ctx.ellipse(32, 32, radiusX, radius, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,232,${narrow ? 0.18 : 0.65})`; ctx.beginPath(); ctx.ellipse(32 - radiusX * 0.15, 32 - radius * 0.15, radiusX * 0.46, radius * 0.46, 0, 0, Math.PI * 2); ctx.fill();
    return sprite;
  });
  return { colors, sprites };
}

function drawShell(ctx, x, top, bottom, width, color, compact) {
  const poleWidth = width < 500 ? 19 : 22;
  const metal = ctx.createLinearGradient(x - poleWidth / 2, 0, x + poleWidth / 2, 0);
  [[0, '#30393a'], [0.25, '#939e99'], [0.42, '#d0d4c9'], [0.57, '#5d6764'], [1, '#252c2c']].forEach(([stop, value]) => metal.addColorStop(stop, value));
  ctx.fillStyle = metal; ctx.beginPath(); ctx.roundRect(x - poleWidth / 2, top - 22, poleWidth, bottom - top + 52, [6, 6, 2, 2]); ctx.fill();
  ctx.fillStyle = '#151d1b'; ctx.fillRect(x - poleWidth / 2 + 3, top - 1, poleWidth - 6, bottom - top + 5);
  if (compact) return;
  const baseY = bottom + 30;
  ctx.save(); ctx.translate(x, baseY); ctx.scale(1, 0.28);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
  glow.addColorStop(0, `rgba(${hexToRgb(color).join(',')},0.08)`); glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow; ctx.fillRect(-100, -100, 200, 200); ctx.restore();
  const base = ctx.createLinearGradient(x - 25, 0, x + 25, 0);
  base.addColorStop(0, '#343a39'); base.addColorStop(0.55, '#232928'); base.addColorStop(1, '#111615');
  ctx.fillStyle = base; ctx.fillRect(x - 24, baseY - 4, 48, 30);
  ctx.strokeStyle = '#49514b'; ctx.lineWidth = 0.6; ctx.strokeRect(x - 24, baseY - 4, 48, 30);
}

// Static scenery lives on its own canvas, so animation only repaints the lights.
function drawBackground(ctx, width, height, config, poles, radius) {
  const compact = width < 500 || height < 300;
  const top = compact ? 34 : 58, bottom = height - (compact ? 60 : 102), horizon = height * 0.66;
  const bg = ctx.createRadialGradient(width / 2, height * 0.5, 5, width / 2, height * 0.5, width * 0.8);
  bg.addColorStop(0, '#17201e'); bg.addColorStop(1, '#0d1113'); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 0.6; ctx.strokeStyle = '#26332f';
  for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(width / 2 + i * 20, horizon); ctx.lineTo(width / 2 + i * width / 6, height); ctx.stroke(); }
  for (let i = 0; i < 9; i++) { const y = horizon + (i / 8) ** 2 * (height - horizon); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  const fade = ctx.createLinearGradient(0, horizon - 20, 0, height);
  fade.addColorStop(0, '#101715'); fade.addColorStop(0.45, '#10171533'); fade.addColorStop(1, '#10171500'); ctx.fillStyle = fade; ctx.fillRect(0, horizon - 20, width, height - horizon + 20);
  const dimensionX = width * 0.15;
  ctx.strokeStyle = '#4c5955'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(dimensionX, top); ctx.lineTo(dimensionX, bottom); ctx.moveTo(dimensionX - 5, top); ctx.lineTo(dimensionX + 5, top); ctx.moveTo(dimensionX - 5, bottom); ctx.lineTo(dimensionX + 5, bottom); ctx.stroke();
  ctx.fillStyle = '#131b19'; ctx.fillRect(dimensionX - 23, (top + bottom) / 2 - 14, 46, 28);
  ctx.fillStyle = '#9aa8a0'; ctx.font = '12px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`${((config.count - 1) * 0.04).toFixed(2).replace('.', ',')} m`, dimensionX, (top + bottom) / 2 + 4);
  poles.forEach(({ index, x }) => {
    drawShell(ctx, x, top, bottom, width, (config.scene.faces[index] || config.scene.faces[0]).colors[0], compact);
    ctx.fillStyle = '#39433b'; ctx.beginPath();
    for (let i = 0; i < config.count; i++) { const y = bottom - i * (bottom - top) / (config.count - 1); const radiusX = width < 500 ? 4 : radius; ctx.moveTo(x + radiusX, y); ctx.ellipse(x, y, radiusX, radius, 0, 0, Math.PI * 2); }
    ctx.fill(); ctx.fillStyle = '#afb9b1'; ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText(config.count === 50 && config.faceCount === 1 ? 'TIRA DE PRUEBA' : `CARA ${index ? 'B' : 'A'}`, x, height - 25);
  });
}

export function createPoleRenderer(canvas, background) {
  const ctx = canvas.getContext('2d');
  const backgroundCtx = background.getContext('2d', { alpha: false });
  let config, width = 0, height = 0, frame = 0, previous = 0, time = 0, visible = true, dirty = true, cacheKey = '';
  let poles = [], palettes = [], mapping, segments;
  const canDraw = () => config && width > 0 && height > 0 && visible && !document.hidden;
  // With one continuous cable, face B starts at the top: its first LED sits beside the last of face A.
  const row = (face, i) => face === 1 && config.faceBFromTop ? config.count - 1 - i : i;
  const isAnimated = () => config.playing && (config.live || (config.scene.on && config.scene.faces.some(face => face.effect !== 'solid')));
  function schedule() { if (!frame && canDraw()) frame = requestAnimationFrame(render); }
  function stop() { cancelAnimationFrame(frame); frame = 0; previous = 0; }
  function render(now) {
    frame = 0;
    if (!canDraw()) return;
    const animated = isAnimated();
    // Avoid driving 120/165 Hz screens at their full refresh rate for a light preview.
    if (animated && !dirty && previous && now - previous < 16) { schedule(); return; }
    if (animated && previous) time += Math.min((now - previous) / 1000, 0.1);
    previous = now;
    if (dirty || animated) {
      ctx.clearRect(0, 0, width, height);
      const output = config.liveFrame?.current;
      const pixels = config.live && output && Date.now() - output.received < 2500 ? output.pixels : null;
      if (config.live ? pixels : config.scene.on) poles.forEach(({ index, x }) => {
        for (let i = 0; i < config.count; i++) {
          if (config.live) {
            const offset = (index * config.count + i) * 3;
            const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
            if (!(r || g || b)) continue;
            const compact = width < 500 || height < 300;
            const top = compact ? 34 : 58, bottom = height - (compact ? 60 : 102);
            const radius = Math.min(width < 500 ? 4 : 4.5, (bottom - top) / (config.count - 1) * 0.36);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.beginPath(); ctx.ellipse(x, bottom - row(index, i) * (bottom - top) / (config.count - 1), width < 500 ? 4 : Math.max(2, radius), radius, 0, 0, Math.PI * 2); ctx.fill();
            continue;
          }
          const physical = index * config.count + i;
          const segmentIndex = mapping[physical];
          if (segmentIndex < 0) continue;
          const segment = segments[segmentIndex], face = config.scene.faces[segmentIndex], palette = palettes[segmentIndex];
          if (!face || !palette) continue;
          // Same virtual-index mapping as WLED: mirror halves the segment, reverse flips it.
          let length = segment.stop - segment.start, local = physical - segment.start;
          if (face.mirror) { const half = Math.ceil(length / 2); local = local < half ? local : length - 1 - local; length = half; }
          if (face.reverse) local = length - 1 - local;
          const { palettePosition, intensity } = pixelColor(face, local / Math.max(1, length - 1), time, local, palette.colors);
          if (intensity < 0.005) continue;
          const fraction = palettePosition;
          const sprite = palette.sprites[Math.max(0, Math.min(PALETTE_SIZE - 1, Math.round(fraction * (PALETTE_SIZE - 1))))];
          ctx.globalAlpha = intensity;
          const compact = width < 500 || height < 300;
          const top = compact ? 34 : 58, bottom = height - (compact ? 60 : 102);
          ctx.drawImage(sprite, x - 32, bottom - row(index, i) * (bottom - top) / (config.count - 1) - 32, SPRITE_SIZE, SPRITE_SIZE);
        }
      });
      ctx.globalAlpha = 1; dirty = false;
    }
    if (animated) schedule();
    else previous = 0;
  }
  function rebuild() {
    if (!config || !width || !height) return;
    const key = JSON.stringify([width, height, config.count, config.faceCount, config.faceBFromTop, config.view, config.scene.segments, config.scene.faces.map(face => [face.colors, face.effect, paletteKey(face)])]);
    if (key === cacheKey) return;
    cacheKey = key;
    const radius = Math.min(width < 500 ? 4 : 4.5, (height - (width < 500 || height < 300 ? 94 : 160)) / (config.count - 1) * 0.36);
    const indices = config.faceCount === 1 ? [0] : config.view === 'both' ? [0, 1] : [config.view === 'b' ? 1 : 0];
    poles = indices.map((index, position) => ({ index, x: width * (indices.length === 2 ? position ? 0.69 : 0.38 : 0.55) }));
    palettes = config.scene.faces.map(face => makePalette(face, radius, width < 500));
    segments = config.scene.segments || defaultSegments(config.count * config.faceCount);
    mapping = segmentMap(config.scene, config.count * config.faceCount);
    drawBackground(backgroundCtx, width, height, config, poles, radius);
    dirty = true;
  }
  const resize = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width; height = entry.contentRect.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    [canvas, background].forEach(layer => { layer.width = Math.round(width * ratio); layer.height = Math.round(height * ratio); });
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); backgroundCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    cacheKey = ''; rebuild(); schedule();
  });
  resize.observe(canvas);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { dirty = true; schedule(); } else stop(); });
  intersection.observe(canvas);
  const onVisibility = () => { if (document.hidden) stop(); else { dirty = true; schedule(); } };
  document.addEventListener('visibilitychange', onVisibility);
  return {
    update(next) { config = next; dirty = true; rebuild(); stop(); schedule(); },
    destroy() { stop(); resize.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', onVisibility); poles = []; },
  };
}
