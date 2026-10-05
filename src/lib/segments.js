import { supportedTotals } from './mounts.js';

export const MAX_SEGMENTS = 16;

// A single colour or design covers the whole pole: one segment, as WLED ships by default.
export function defaultSegments(total) {
  return [{ id: 0, name: total === 50 ? 'Tira completa' : 'Todo el poste', start: 0, stop: total }];
}

// Physical faces as separate segments; used only to migrate saved two-face scenes that differ.
export function faceSegments(total, faceCount = 2) {
  if (faceCount === 1) return defaultSegments(total);
  return [0, 1].map(id => ({ id, name: `Cara ${id ? 'B' : 'A'}`, start: id * total / 2, stop: (id + 1) * total / 2 }));
}

export function prepareScene(scene, total, faceCount = 2) {
  if (scene.segments) return { transition: 0.4, ...scene };
  const same = scene.faces.every(face => JSON.stringify(face) === JSON.stringify(scene.faces[0]));
  // Two faces always get a segment each, so one design plays the same sequence on both sides.
  const segments = same && faceCount !== 2 ? defaultSegments(total) : faceSegments(total, faceCount);
  return { ...scene, transition: scene.transition ?? 0.4, total, segments, faces: segments.map((_, i) => structuredClone(scene.faces[i] || scene.faces[0])) };
}

// A design for the whole pole on a two-face mount runs once per face (same sequence on both sides)
// instead of flowing from face A into face B as one 200-LED strip.
export function perFace(scene, faceCount) {
  if (faceCount !== 2 || scene.segments?.length !== 1) return scene;
  const [only] = scene.segments;
  if (only.start !== 0 || only.stop !== scene.total) return scene;
  return { ...scene, segments: faceSegments(scene.total, 2), faces: [structuredClone(scene.faces[0]), structuredClone(scene.faces[0])] };
}

// Distinct, saturated colours read clearly at a distance; black secondary leaves room for movement.
export const bandColors = ['#ff2020', '#20ff60', '#2070ff', '#ffd020', '#ff30d0', '#20e8ff'];

// Equal parts, one colour each, all sharing the design of `index` (e.g. a pole "partido en 4").
export function splitEqual(scene, parts, index = 0, limit = MAX_SEGMENTS) {
  if (!Number.isInteger(parts) || parts < 2 || parts > Math.min(limit, bandColors.length) || parts > scene.total) return null;
  const base = scene.faces[Math.max(0, index)];
  const segments = Array.from({ length: parts }, (_, id) => ({ id, name: `Parte ${id + 1}`, start: Math.round(id * scene.total / parts), stop: Math.round((id + 1) * scene.total / parts) }));
  return { ...scene, segments, faces: segments.map((_, id) => ({ ...structuredClone(base), colors: [bandColors[id], '#000000'], palette: 'auto' })) };
}

const freeId = (segments, limit) => Array.from({ length: limit }, (_, i) => i).find(i => !segments.some(item => item.id === i));

// Creates LEDs [start, stop) as a new segment, keeping the design of whatever covered them.
// Existing segments are trimmed or split around the new range, so no LED ends up in two segments.
export function carveSegment(scene, start, stop, limit = MAX_SEGMENTS) {
  if (!Number.isInteger(start) || !Number.isInteger(stop) || start < 0 || stop > scene.total || start >= stop) return null;
  const covering = Math.max(0, scene.segments.findIndex(item => item.start <= start && item.stop > start));
  const pieces = [];
  scene.segments.forEach((item, i) => {
    const face = scene.faces[i];
    if (item.stop <= start || item.start >= stop) pieces.push({ segment: item, face });
    else {
      if (item.start < start) pieces.push({ segment: { ...item, stop: start }, face });
      if (item.stop > stop) pieces.push({ segment: { ...item, start: stop, id: null }, face: structuredClone(face) });
    }
  });
  const created = { segment: { id: null, name: '', start, stop }, face: structuredClone(scene.faces[covering]) };
  pieces.push(created);
  if (pieces.length > limit) return null;
  // Pieces that kept their original ID stay stable; new pieces take the lowest free IDs.
  const used = new Set(pieces.map(piece => piece.segment.id).filter(id => id !== null));
  for (const piece of [created, ...pieces.filter(item => item !== created && item.segment.id === null)]) {
    const id = freeId([...used].map(value => ({ id: value })), limit);
    if (id === undefined) return null;
    used.add(id); piece.segment.id = id;
  }
  created.segment.name = `Segmento ${created.segment.id + 1}`;
  // «Todo el poste» stops being true once the pole is divided.
  for (const { segment } of pieces) if (['Todo el poste', 'Tira completa'].includes(segment.name)) segment.name = `Segmento ${segment.id + 1}`;
  pieces.sort((x, y) => x.segment.start - y.segment.start);
  return { scene: { ...scene, segments: pieces.map(piece => piece.segment), faces: pieces.map(piece => piece.face) }, id: created.segment.id };
}

// Removing a segment hands its LEDs to the neighbour instead of leaving them dark.
export function removeSegment(scene, index) {
  if (scene.segments.length < 2) return scene;
  const removed = scene.segments[index];
  const segments = scene.segments.filter((_, i) => i !== index);
  const faces = scene.faces.filter((_, i) => i !== index);
  const neighbour = index > 0 ? index - 1 : 0;
  segments[neighbour] = index > 0 ? { ...segments[neighbour], stop: Math.max(segments[neighbour].stop, removed.stop) } : { ...segments[neighbour], start: Math.min(segments[neighbour].start, removed.start) };
  if (segments.length === 1) segments[0] = { ...segments[0], ...defaultSegments(scene.total)[0], id: segments[0].id };
  return { ...scene, segments, faces };
}

// Back to one segment for the whole pole, keeping the design being edited.
export function mergeSegments(scene, index = 0) {
  return { ...scene, segments: defaultSegments(scene.total), faces: [structuredClone(scene.faces[Math.max(0, index)])] };
}

export function segmentError(scene, total, limit = MAX_SEGMENTS) {
  if (!supportedTotals.includes(total)) return `Elige un montaje de ${supportedTotals.join(', ')} LEDs.`;
  const segments = scene.segments;
  if (!Array.isArray(segments) || !segments.length || segments.length > limit || segments.length !== scene.faces?.length) return `Usa entre 1 y ${limit} segmentos.`;
  if (scene.total !== total) return `Esta escena corresponde a ${scene.total} LEDs; el montaje tiene ${total}.`;
  if (new Set(segments.map(item => item?.id)).size !== segments.length) return 'Los identificadores de segmento deben ser únicos.';
  for (const item of segments) {
    if (!item || typeof item.name !== 'string' || item.name.length > 64) return 'Revisa el nombre del segmento.';
    if (!Number.isInteger(item.id) || item.id < 0 || item.id >= limit) return 'El controlador no admite este identificador de segmento.';
    if (!Number.isInteger(item.start) || !Number.isInteger(item.stop) || item.start < 0 || item.stop > total || item.start >= item.stop) return `Revisa el rango de ${item.name || 'este segmento'}: usa LEDs del 1 al ${total}.`;
  }
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  if (sorted.some((item, i) => i > 0 && item.start < sorted[i - 1].stop)) return 'Hay segmentos superpuestos. Ajusta los rangos para que cada LED pertenezca a un solo segmento.';
  return '';
}

// One lookup table per layout, not one range search per LED per animation frame.
export function segmentMap(scene, total) {
  const map = new Int16Array(total).fill(-1);
  (scene.segments || defaultSegments(total)).forEach((segment, index) => {
    for (let led = Math.max(0, segment.start); led < Math.min(total, segment.stop); led++) map[led] = index;
  });
  return map;
}
