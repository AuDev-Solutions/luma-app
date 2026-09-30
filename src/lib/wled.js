import { segmentError, MAX_SEGMENTS } from './segments.js';
import { effectById, hexToRgb, effects, faceIntensity, paletteKey } from './scenes.js';
import { resolvePalette, paletteFromIndex } from './palettes.js';

export function resolveEffect(effect, names) {
  return [effect.wled, ...(effect.aliases || [])].map(candidate => names.findIndex(name => name.toLowerCase() === candidate.toLowerCase())).find(index => index >= 0) ?? -1;
}

// WLED effect metadata ("Name@sliders;colors;palette;flags;defaults") carries each effect's tuned
// custom sliders and options. Its own UI loads them on every effect change (fxdef); LUMA does the same.
export function parseFxData(list) {
  if (!Array.isArray(list)) return null;
  return list.map(entry => {
    const defaults = {};
    if (typeof entry !== 'string') return defaults;
    const last = entry.slice(entry.lastIndexOf(';') + 1);
    for (const pair of last.split(',')) {
      const [key, value] = pair.split('=');
      if (/^(c[1-3]|o[1-3])$/.test(key) && /^\d+$/.test(value ?? '')) defaults[key] = key[0] === 'o' ? value !== '0' : Math.min(Number(value), key === 'c3' ? 31 : 255);
    }
    return defaults;
  });
}

export function sceneFromDevice(device) {
  const active = device.state.seg.filter(item => item.stop > item.start);
  const faces = active.map(segment => {
    const effect = effects.find(item => resolveEffect(item, device.effects) === segment?.fx);
    if (!effect || !segment.col?.[0] || !segment.col?.[1]) return null;
    const face = { effect: effect.id, colors: segment.col.slice(0, 2).map(color => '#' + color.slice(0, 3).map(channel => channel.toString(16).padStart(2, '0')).join('')), brightness: segment.on === false ? 0 : Math.round((segment.bri ?? 255) * (device.state.bri ?? 255) / 255 / 255 * 100), speed: Math.round((segment.sx ?? 128) / 255 * 100), intensity: Math.round((segment.ix ?? 128) / 255 * 100), palette: 'auto', reverse: !!segment.rev, mirror: !!segment.mi };
    const palette = paletteFromIndex(segment.pal, device.palettes);
    if (palette && resolvePalette(paletteKey(face), device.palettes) !== segment.pal) face.palette = palette;
    return face;
  });
  if (!faces.length || !faces.every(Boolean)) return null;
  // Contiguous segments with identical settings read as one tramo: a single design stays a single segment.
  const segments = [], merged = [];
  active.forEach((item, i) => {
    const last = segments.at(-1);
    if (last && last.stop === item.start && JSON.stringify(merged.at(-1)) === JSON.stringify(faces[i])) { last.stop = item.stop; last.name = ''; return; }
    segments.push({ id: item.id, name: item.n || '', start: item.start, stop: item.stop }); merged.push(faces[i]);
  });
  segments.forEach(item => { item.name ||= segments.length === 1 ? (device.count === 50 ? 'Tira completa' : 'Todo el poste') : `Segmento ${item.id + 1}`; });
  return { on: device.state.on !== false, transition: (device.state.transition ?? 4) / 10, total: device.count, segments, faces: merged };
}

export function normalizeAddress(value) {
  const address = new URL(value.includes('://') ? value : `http://${value}`);
  if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password || address.pathname !== '/' || address.search || address.hash) {
    throw new Error('Introduce solo la IP o el nombre local del poste, por ejemplo 192.168.4.1.');
  }
  return address.origin;
}

async function request(address, path, body) {
  let response;
  try {
    response = await fetch(`${address}${path}`, {
      method: body ? 'POST' : 'GET',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(6000), cache: 'no-store',
    });
  } catch {
    throw new Error('No se pudo comunicar con el poste. Conéctate a su Wi-Fi, revisa la dirección y permite el acceso a la red local si el navegador lo solicita.');
  }
  if (!response.ok) throw new Error(`El poste respondió con un error (${response.status}).`);
  const data = await response.json();
  if (data.error) throw new Error(`El poste rechazó el cambio (código ${data.error}).`);
  return data;
}

export async function connectWled(value, { metadata = true } = {}) {
  const address = normalizeAddress(value);
  const data = await request(address, '/json');
  if (!data.info?.leds || !Array.isArray(data.effects) || !Array.isArray(data.state?.seg)) throw new Error('La dirección no corresponde a un controlador de LED compatible.');
  // Optional: older firmware without /json/fxdata still works with LUMA's own parameters.
  const fxDefaults = metadata ? await request(address, '/json/fxdata').then(parseFxData, () => null) : null;
  return { address, name: data.info.name || 'Poste 01', count: data.info.leds.count, maxSegments: Math.min(MAX_SEGMENTS, data.info.leds.maxseg ?? data.info.maxseg ?? MAX_SEGMENTS), live: !!data.info.live, effects: data.effects, palettes: Array.isArray(data.palettes) ? data.palettes : null, fxDefaults, state: data.state };
}

// Explicit editor layouts replace segment bounds; legacy scenes retain face-layout checks.
// `target` mirrors WLED's segment selection: only the edited segment stays selected on the controller,
// so the native WLED UI and later global commands affect the same segment the user was editing.
export function buildPayload(scene, device, count, faceCount = 2, target = 'all') {
  if (![1, 2].includes(faceCount) || ![50, 100, 200].includes(count)) throw new Error('Montaje no compatible.');
  if (!Number.isFinite(scene.transition ?? 0.4) || (scene.transition ?? 0.4) < 0 || (scene.transition ?? 0.4) > 65) throw new Error('La transición debe estar entre 0 y 65 segundos.');
  if (scene.segments) {
    const error = segmentError(scene, device.count, device.maxSegments ?? MAX_SEGMENTS);
    if (error) throw new Error(error);
    if (device.count !== count * faceCount) throw new Error('El montaje cambió. Vuelve a conectar el poste.');
    // Compact IDs prevent WLED's batch-delete purge from renumbering survivors.
    // Local editor IDs remain stable while the physical ranges carry their effects.
    const selected = scene.segments.map(item => target === 'all' || item.id === target);
    if (!selected.some(Boolean)) selected.fill(true);
    const seg = scene.segments.map((item, index) => ({ ...facePayload(scene.faces[index], index, device), n: item.name, start: item.start, stop: item.stop, grp: 1, spc: 0, of: 0, sel: selected[index] }));
    const removed = device.state.seg.filter(item => item.stop > item.start && item.id >= seg.length).map(item => ({ id: item.id, stop: 0 }));
    return { on: scene.on, bri: 255, transition: Math.round((scene.transition ?? 0.4) * 10), mainseg: selected.indexOf(true), seg: [...seg, ...removed] };
  }
  const active = device.state.seg.filter(segment => segment.stop > segment.start);
  const defaultLayout = active.length === 1 && active[0].id === 0 && active[0].start === 0 &&
    active[0].stop === count * faceCount && (active[0].grp ?? 1) === 1 && (active[0].spc ?? 0) === 0 &&
    (active[0].of ?? 0) === 0 && !active[0].rev && !active[0].mi && !active[0].startY &&
    (active[0].stopY ?? 1) <= 1;
  const segments = Array.from({ length: faceCount }, (_, id) => device.state.seg.find(segment => segment.id === id));
  if ((!defaultLayout && segments.some((segment, id) => !segment || segment.start !== id * count || segment.stop !== (id + 1) * count)) || device.count !== count * faceCount) {
    if (faceCount === 1) throw new Error(`Configura ${count} píxeles y un segmento [0, ${count}) en el controlador. Si acabas de cambiar el montaje, vuelve a conectar LUMA.`);
    throw new Error(`Configura primero dos segmentos en el controlador: cara A [0, ${count}) y cara B [${count}, ${count * 2}), con ${count * 2} píxeles en total.`);
  }
  if (device.state.seg.some(segment => segment.id >= faceCount && segment.stop > segment.start)) throw new Error(`Hay segmentos adicionales activos en el controlador. Deja únicamente ${faceCount === 1 ? 'la tira de prueba' : 'las dos caras'} antes de aplicar.`);
  return {
    on: scene.on, bri: 255, transition: Math.round((scene.transition ?? 0.4) * 10),
    seg: scene.faces.slice(0, faceCount).map((face, id) => ({ ...facePayload(face, id, device), ...(defaultLayout ? { start: id * count, stop: (id + 1) * count, grp: 1, spc: 0, of: 0 } : {}) })),
  };
}

export async function applyWled(scene, device, count, faceCount = 2, target = 'all') {
  const fresh = await connectWled(device.address, { metadata: false });
  if (fresh.live) throw new Error('El poste está recibiendo control en tiempo real. Detén esa transmisión antes de aplicar una escena.');
  const payload = buildPayload(scene, { ...fresh, fxDefaults: device.fxDefaults, palettes: fresh.palettes ?? device.palettes }, count, faceCount, target);
  await request(device.address, '/json/state', { ...payload, v: true });
  const confirmed = await request(device.address, '/json/state');
  const matches = confirmed.on === payload.on && confirmed.bri === payload.bri && confirmed.transition === payload.transition && payload.seg.every(expected => {
    const actual = confirmed.seg?.find(segment => segment.id === expected.id);
    if (expected.stop === 0) return !actual || actual.stop <= actual.start;
    return actual && actual.start === (expected.start ?? expected.id * count) && actual.stop === (expected.stop ?? (expected.id + 1) * count) &&
      actual.fx === expected.fx && (!expected.on || actual.bri === expected.bri) && actual.on === expected.on &&
      actual.sx === expected.sx && actual.pal === expected.pal && actual.ix === expected.ix &&
      !!actual.rev === expected.rev && !!actual.mi === expected.mi &&
      expected.col.every((color, i) => actual.col?.[i]?.slice(0, 3).join(',') === color.join(','));
  });
  if (!matches) throw new Error('El poste recibió la solicitud, pero no confirmó todos los cambios. Revisa si hay una lista de reproducción u otro control activo.');
  return confirmed;
}

function facePayload(face, id, device) {
  const effect = effectById(face.effect);
  const fx = resolveEffect(effect, device.effects);
  if (fx < 0) throw new Error(`El firmware del poste no incluye el efecto ${effect.wled}. Prueba Color fijo.`);
  return {
    id, frz: false, on: face.brightness > 0, bri: Math.max(1, Math.round(face.brightness * 255 / 100)), fx,
    sx: Math.round(face.speed * 255 / 100), ix: Math.round(faceIntensity(face) * 255 / 100),
    ...(device.fxDefaults?.[fx] || {}), ...(effect.params || {}),
    pal: resolvePalette(paletteKey(face), device.palettes), rev: !!face.reverse, mi: !!face.mirror,
    col: [hexToRgb(face.colors[0]), effect.darkBackground ? [0, 0, 0] : hexToRgb(face.colors[1]), [0, 0, 0]],
  };
}

// Changes only the LED count of the single WLED output; pin, type, colour order and current limits
// are sent back exactly as the controller reported them. WLED re-initialises the bus without reboot.
export async function setLedCount(address, total) {
  const config = await request(address, '/json/cfg');
  const outputs = config?.hw?.led?.ins;
  if (!Array.isArray(outputs) || outputs.length !== 1 || !Array.isArray(outputs[0].pin) || !outputs[0].pin.length) {
    throw new Error('El controlador tiene varias salidas o ninguna. Cambia la cantidad en la configuración de LEDs del controlador.');
  }
  if ((outputs[0].start ?? 0) !== 0) throw new Error('La salida de LEDs no empieza en 0. Revísala en la configuración de LEDs del controlador.');
  await request(address, '/json/cfg', { hw: { led: { ins: [{ ...outputs[0], len: total }] } } });
  // Bus re-initialisation happens in WLED's next loop; poll until it reports the new count.
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 400));
    const info = await request(address, '/json/info').catch(() => null);
    if (info?.leds?.count === total) return;
  }
  throw new Error(`El poste recibió el cambio, pero no confirmó ${total} LEDs. Revisa la configuración de LEDs del controlador.`);
}
