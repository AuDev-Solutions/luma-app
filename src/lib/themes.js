import { effects, presetFace } from './scenes.js';

// Ready-made scenes for dates and moods. Each builds a scene for the mounted LED count, so the
// same theme works on 50, 100, 200 or 400 LEDs. Everything stays editable after loading.
const design = (id, patch = {}) => ({ ...presetFace(effects.find(effect => effect.id === id)), ...patch });

// `parts`: [[share of the pole, face, name]] from the base (LED 1) upwards. With two faces the bands are
// repeated on each face (a flag shows complete on both sides); with face B wired from the top its bands
// run in the opposite order so both sides read the same from the ground.
function bands(start, length, parts, prefix = '') {
  let at = start;
  return parts.map(([share, , name], i) => {
    const stop = i === parts.length - 1 ? start + length : Math.max(at + 1, Math.round(at + share * length));
    const segment = { name: parts.length === 1 ? null : `${prefix}${name}`, start: at, stop };
    at = stop;
    return segment;
  });
}
function build(total, parts, { faceCount = 1, faceBFromTop = false } = {}) {
  const whole = total === 50 ? 'Tira completa' : 'Todo el poste';
  if (faceCount !== 2) {
    const segments = bands(0, total, parts).map((segment, id) => ({ id, ...segment, name: segment.name ?? whole }));
    return { on: true, transition: 1, total, segments, faces: parts.map(([, face]) => face) };
  }
  const half = total / 2;
  const partsB = faceBFromTop ? [...parts].reverse() : parts;
  const named = (list, face) => list.map(segment => ({ ...segment, name: segment.name ?? `Cara ${face}` }));
  const segments = [...named(bands(0, half, parts, 'A · '), 'A'), ...named(bands(half, half, partsB, 'B · '), 'B')].map((segment, id) => ({ id, ...segment }));
  return { on: true, transition: 1, total, segments, faces: [...parts, ...partsB].map(([, face]) => structuredClone(face)) };
}

export const themes = [
  { id: 'navidad', name: 'Navidad', description: 'Franjas rojas y verdes que suben', swatch: ['#ff0a0a', '#10c040', '#ffffff'],
    build: (total, layout) => build(total, [[1, design('candycane', { colors: ['#ff0a0a', '#10c040'] })]], layout) },
  { id: 'nieve-navidad', name: 'Noche de invierno', description: 'Nieve azul con copa dorada', swatch: ['#e5faff', '#164c81', '#ffc471'],
    build: (total, layout) => build(total, [[0.8, design('snow'), 'Nieve'], [0.2, design('candle', { brightness: 60 }), 'Copa']], layout) },
  { id: 'ano-nuevo', name: 'Año nuevo', description: 'Fuegos artificiales de colores', swatch: ['#ffb347', '#ff345f', '#23cbff'],
    build: (total, layout) => build(total, [[1, design('fireworks', { brightness: 70 })]], layout) },
  { id: 'halloween', name: 'Halloween', description: 'Ondas naranjas y moradas', swatch: ['#ff6a00', '#7a00ff', '#000000'],
    build: (total, layout) => build(total, [[1, design('neon', { colors: ['#ff6a00', '#7a00ff'] })]], layout) },
  { id: 'amor', name: 'Amor y amistad', description: 'Latido rosa y rojo', swatch: ['#ff2d55', '#ff7ab8', '#000000'],
    build: (total, layout) => build(total, [[0.5, design('heartbeat'), 'Base'], [0.5, design('heartbeat', { colors: ['#ff7ab8', '#000000'] }), 'Copa']], layout) },
  { id: 'tricolor', name: 'Fiestas patrias', description: 'Amarillo arriba, azul y rojo abajo', swatch: ['#ffd400', '#0038a8', '#ce1126'],
    build: (total, layout) => build(total, [[0.25, design('solid', { colors: ['#ce1126', '#ce1126'], brightness: 60 }), 'Rojo'], [0.25, design('solid', { colors: ['#0038a8', '#0038a8'], brightness: 60 }), 'Azul'], [0.5, design('solid', { colors: ['#ffd400', '#ffd400'], brightness: 60 }), 'Amarillo']], layout) },
  { id: 'calido', name: 'Blanco cálido', description: 'Luz tranquila para cada noche', swatch: ['#ffb46b', '#ffd9a8', '#ffb46b'],
    build: (total, layout) => build(total, [[1, design('solid', { colors: ['#ffb46b', '#ffb46b'], brightness: 45 })]], layout) },
  { id: 'fiesta', name: 'Fiesta', description: 'Arcoíris en movimiento', swatch: ['#ff345f', '#36ed9f', '#6655ff'],
    build: (total, layout) => build(total, [[1, design('rainbow', { brightness: 65, speed: 45 })]], layout) },
];
