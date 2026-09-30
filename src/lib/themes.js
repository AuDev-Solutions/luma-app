import { effects, presetFace } from './scenes.js';

// Ready-made scenes for dates and moods. Each builds a scene for the mounted LED count, so the
// same theme works on 50, 100, 200 or 400 LEDs. Everything stays editable after loading.
const design = (id, patch = {}) => ({ ...presetFace(effects.find(effect => effect.id === id)), ...patch });

// `parts`: [[share of the pole, face, name]] from the base (LED 1) upwards.
function build(total, parts) {
  let start = 0;
  const segments = parts.map(([share, , name], id) => {
    const stop = id === parts.length - 1 ? total : Math.max(start + 1, Math.round(start + share * total));
    const segment = { id, name: parts.length === 1 ? (total === 50 ? 'Tira completa' : 'Todo el poste') : name, start, stop };
    start = stop;
    return segment;
  });
  return { on: true, transition: 1, total, segments, faces: parts.map(([, face]) => face) };
}

export const themes = [
  { id: 'navidad', name: 'Navidad', description: 'Franjas rojas y verdes que suben', swatch: ['#ff0a0a', '#10c040', '#ffffff'],
    build: total => build(total, [[1, design('candycane', { colors: ['#ff0a0a', '#10c040'] })]]) },
  { id: 'nieve-navidad', name: 'Noche de invierno', description: 'Nieve azul con copa dorada', swatch: ['#e5faff', '#164c81', '#ffc471'],
    build: total => build(total, [[0.8, design('snow'), 'Nieve'], [0.2, design('candle', { brightness: 60 }), 'Copa']]) },
  { id: 'ano-nuevo', name: 'Año nuevo', description: 'Fuegos artificiales de colores', swatch: ['#ffb347', '#ff345f', '#23cbff'],
    build: total => build(total, [[1, design('fireworks', { brightness: 70 })]]) },
  { id: 'halloween', name: 'Halloween', description: 'Ondas naranjas y moradas', swatch: ['#ff6a00', '#7a00ff', '#000000'],
    build: total => build(total, [[1, design('neon', { colors: ['#ff6a00', '#7a00ff'] })]]) },
  { id: 'amor', name: 'Amor y amistad', description: 'Latido rosa y rojo', swatch: ['#ff2d55', '#ff7ab8', '#000000'],
    build: total => build(total, [[0.5, design('heartbeat'), 'Base'], [0.5, design('heartbeat', { colors: ['#ff7ab8', '#000000'] }), 'Copa']]) },
  { id: 'tricolor', name: 'Fiestas patrias', description: 'Amarillo arriba, azul y rojo abajo', swatch: ['#ffd400', '#0038a8', '#ce1126'],
    build: total => build(total, [[0.25, design('solid', { colors: ['#ce1126', '#ce1126'], brightness: 60 }), 'Rojo'], [0.25, design('solid', { colors: ['#0038a8', '#0038a8'], brightness: 60 }), 'Azul'], [0.5, design('solid', { colors: ['#ffd400', '#ffd400'], brightness: 60 }), 'Amarillo']]) },
  { id: 'calido', name: 'Blanco cálido', description: 'Luz tranquila para cada noche', swatch: ['#ffb46b', '#ffd9a8', '#ffb46b'],
    build: total => build(total, [[1, design('solid', { colors: ['#ffb46b', '#ffb46b'], brightness: 45 })]]) },
  { id: 'fiesta', name: 'Fiesta', description: 'Arcoíris en movimiento', swatch: ['#ff345f', '#36ed9f', '#6655ff'],
    build: total => build(total, [[1, design('rainbow', { brightness: 65, speed: 45 })]]) },
];
