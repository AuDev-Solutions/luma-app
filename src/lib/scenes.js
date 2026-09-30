import { segmentError } from './segments.js';
import { palettes, paletteById } from './palettes.js';
// Curated for one-dimensional poles. IDs retain compatibility with saved scenes.
// `intensity` is WLED's raw ix default (from each effect's fxdata); `palette` is a key of palettes.js.
// `intensityLabel: null` hides the slider for effects that ignore ix.
export const effects = [
  { id: 'fireworks', name: 'Fireworks 1D', description: 'Cohetes y explosiones de color', wled: 'Fireworks 1D', category: 'Destellos', colors: ['#ffb347', '#000000'], speed: 50, brightness: 60, spectrum: true, darkBackground: true, featured: true, speedLabel: 'Gravedad', intensityLabel: 'Lado de disparo' },
  { id: 'aurora', name: 'Aurora', description: 'Velos de menta y turquesa', wled: 'Gradient', category: 'Calma', colors: ['#a4ffc2', '#208cff'], speed: 28, brightness: 65, featured: true, intensity: 16, intensityLabel: 'Amplitud' },
  { id: 'solid', name: 'Color fijo', description: 'Una luz limpia y constante', wled: 'Solid', category: 'Calma', colors: ['#ffcf8a', '#ffcf8a'], speed: 0, brightness: 50, static: true, singleColor: true, intensityLabel: null },
  { id: 'rise', name: 'Ascenso', description: 'Una estela que sube al cielo', wled: 'Comet', aliases: ['Meteor'], category: 'Movimiento', colors: ['#63f5ff', '#2650ff'], speed: 45, brightness: 65, featured: true, intensityLabel: 'Estela' },
  { id: 'breathe', name: 'Respiración', description: 'Un pulso lento en lavanda', wled: 'Breathe', category: 'Calma', colors: ['#c3a0ff', '#080314'], speed: 22, brightness: 55, intensityLabel: null },
  { id: 'sparkle', name: 'Destellos', description: 'Puntos de luz sobre azul noche', wled: 'Sparkle', category: 'Destellos', colors: ['#e5f6ff', '#07122b'], speed: 35, brightness: 60, intensityLabel: null },
  { id: 'festive', name: 'Festiva', description: 'Rosa y oro en persecución', wled: 'Chase', category: 'Fiesta', colors: ['#ff3b96', '#ffc34d'], speed: 52, brightness: 65, intensityLabel: 'Ancho' },
  { id: 'ocean', name: 'Océano', description: 'Olas profundas de azul y agua', wled: 'Pacifica', category: 'Calma', colors: ['#0759bc', '#2cf0c8'], speed: 26, brightness: 60, featured: true, palette: 'original', ownPalette: true, intensityLabel: 'Ángulo' },
  { id: 'fire', name: 'Fuego ámbar', description: 'Llamas cálidas desde la base', wled: 'Fire 2012', category: 'Movimiento', colors: ['#ff2909', '#ffcf50'], speed: 28, brightness: 60, intensity: 160, palette: 'fire', featured: true, speedLabel: 'Enfriamiento', intensityLabel: 'Chispas' },
  { id: 'rainbow', name: 'Prisma', description: 'Todo el espectro en una onda', wled: 'Rainbow', category: 'Fiesta', colors: ['#ff457f', '#42dfff'], speed: 35, brightness: 60, spectrum: true, featured: true, intensityLabel: 'Tamaño' },
  { id: 'sunset', name: 'Atardecer', description: 'Un horizonte coral y violeta', wled: 'Gradient', category: 'Calma', colors: ['#ff8e42', '#9524d6'], speed: 12, brightness: 55, intensity: 16, intensityLabel: 'Amplitud' },
  { id: 'rain', name: 'Lluvia estelar', description: 'Gotas de luz que descienden', wled: 'Rain', category: 'Movimiento', colors: ['#b6f3ff', '#000000'], darkBackground: true, singleColor: true, palette: 'color1', speed: 38, brightness: 60, featured: true, intensityLabel: 'Frecuencia' },
  { id: 'fireflies', name: 'Luciérnagas', description: 'Pequeños brillos entre verdes', wled: 'Twinklefox', category: 'Destellos', colors: ['#e1ff68', '#063d28'], speed: 27, brightness: 50, intensityLabel: 'Cantidad' },
  { id: 'galaxy', name: 'Nebulosa', description: 'Estrellas de violeta y rosa', wled: 'Twinklecat', category: 'Destellos', colors: ['#be65ff', '#ff4aaf'], speed: 32, brightness: 60, intensityLabel: 'Cantidad' },
  { id: 'neon', name: 'Neón nocturno', description: 'Ondas eléctricas rosa y cian', wled: 'Colorwaves', category: 'Fiesta', colors: ['#ff24b5', '#00e5ff'], speed: 50, brightness: 65, intensityLabel: 'Tono' },
  { id: 'wave', name: 'Onda esmeralda', description: 'Crestas verdes en movimiento', wled: 'Running', category: 'Movimiento', colors: ['#2dffc0', '#062d45'], speed: 35, brightness: 55, intensityLabel: 'Ancho de onda' },
  { id: 'scanner', name: 'Vaivén', description: 'Un haz que recorre el poste', wled: 'Sinelon', category: 'Movimiento', colors: ['#ff9940', '#4b0b48'], speed: 38, brightness: 60, intensityLabel: 'Estela' },
  { id: 'ripple', name: 'Ondas de luz', description: 'Anillos que nacen y se expanden', wled: 'Ripple', category: 'Movimiento', colors: ['#8ae9ff', '#4840b7'], speed: 34, brightness: 60, intensityLabel: 'Ondas' },
  { id: 'candy', name: 'Caramelo', description: 'Bandas dulces de rosa y crema', wled: 'Chase 2', category: 'Fiesta', colors: ['#ff4f95', '#ffe3a6'], speed: 30, brightness: 55, intensityLabel: 'Ancho' },
  // WLED has no Candy Cane effect: Chase 2 alternates hard bands of colour 1 and 2; palette 0 keeps them pure red/white.
  { id: 'candycane', name: 'Bastón de caramelo', description: 'Franjas rojas y blancas que suben girando', wled: 'Chase 2', category: 'Fiesta', colors: ['#ff0a0a', '#ffffff'], palette: 'original', speed: 35, brightness: 55, intensity: 64, featured: true, intensityLabel: 'Ancho de franja' },
  { id: 'candle', name: 'Luz de vela', description: 'Calidez dorada que titila', wled: 'Candle Multi', category: 'Calma', colors: ['#ffc471', '#792710'], speed: 25, brightness: 45, intensity: 224, intensityLabel: 'Parpadeo' },
  { id: 'snow', name: 'Nieve', description: 'Cristales blancos sobre hielo', wled: 'Twinkle', category: 'Destellos', colors: ['#e5faff', '#164c81'], speed: 25, brightness: 55, intensityLabel: 'Cantidad' },
  // Colección 2026-09-30: efectos 1D nativos de WLED que aprovechan la verticalidad del poste.
  { id: 'drip', name: 'Goteo', description: 'Gotas que se forman y caen', wled: 'Drip', category: 'Movimiento', colors: ['#4fd8ff', '#000000'], darkBackground: true, singleColor: true, speed: 45, brightness: 65, featured: true, speedLabel: 'Gravedad', intensityLabel: 'Gotas' },
  { id: 'starburst', name: 'Estallido', description: 'Estrellas que revientan en chispas', wled: 'Fireworks Starburst', category: 'Destellos', colors: ['#ffffff', '#000000'], spectrum: true, darkBackground: true, speed: 55, brightness: 65, speedLabel: 'Frecuencia', intensityLabel: 'Fragmentos' },
  { id: 'borealis', name: 'Aurora boreal', description: 'Cortinas verdes que ondulan', wled: 'Aurora', category: 'Calma', colors: ['#35ff9a', '#1b3bff'], palette: 'aurora', darkBackground: true, speed: 10, brightness: 65, featured: true, intensityLabel: 'Ondas' },
  { id: 'heartbeat', name: 'Latido', description: 'Doble pulso de corazón', wled: 'Heartbeat', category: 'Calma', colors: ['#ff2d55', '#000000'], darkBackground: true, singleColor: true, speed: 30, brightness: 60, intensityLabel: 'Pulso' },
  { id: 'lightning', name: 'Tormenta', description: 'Relámpagos que cruzan el poste', wled: 'Lightning', category: 'Destellos', colors: ['#e4ecff', '#000000'], darkBackground: true, singleColor: true, speed: 50, brightness: 70, speedLabel: 'Frecuencia', intensityLabel: 'Descargas' },
  { id: 'radar', name: 'Radar', description: 'Un ojo rojo que barre de lado a lado', wled: 'Scanner', category: 'Movimiento', colors: ['#ff2020', '#000000'], darkBackground: true, singleColor: true, speed: 55, brightness: 65, intensityLabel: 'Estela' },
  { id: 'plasma', name: 'Plasma', description: 'Energía líquida en colores vivos', wled: 'Plasma', category: 'Fiesta', colors: ['#ff3d9a', '#3d7bff'], palette: 'party', speed: 30, brightness: 60, intensityLabel: 'Contraste' },
  { id: 'juggle', name: 'Malabares', description: 'Luces que se cruzan en el aire', wled: 'Juggle', category: 'Fiesta', colors: ['#ffffff', '#000000'], spectrum: true, darkBackground: true, speed: 25, brightness: 65, intensityLabel: 'Estela' },
  { id: 'tetrix', name: 'Bloques', description: 'Piezas de color que se apilan', wled: 'Tetrix', category: 'Fiesta', colors: ['#ffffff', '#000000'], spectrum: true, darkBackground: true, speed: 0, brightness: 60, intensity: 0, intensityLabel: 'Tamaño' },
  { id: 'bounce', name: 'Rebotes', description: 'Pelotas de colores con gravedad', wled: 'Bouncing Balls', category: 'Movimiento', colors: ['#ffffff', '#000000'], spectrum: true, darkBackground: true, speed: 50, brightness: 65, speedLabel: 'Gravedad', intensityLabel: 'Pelotas' },
];
export const categories = ['Selección', 'Todos', 'Calma', 'Movimiento', 'Destellos', 'Fiesta', 'Favoritos'];
const percent = raw => Math.round(raw / 255 * 100);
export function presetFace(effect) { return { effect: effect.id, colors: [...effect.colors], brightness: effect.brightness, speed: effect.speed, intensity: percent(effect.intensity ?? 128), palette: 'auto' }; }
export const initialFace = presetFace(effects.find(effect => effect.id === 'aurora'));
export const initialScene = { on: true, faces: [{ ...initialFace }, { ...initialFace }] };
export const effectById = (id) => effects.find((effect) => effect.id === id) ?? effects[0];
export const hexToRgb = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
export const faceIntensity = face => face.intensity ?? percent(effectById(face.effect).intensity ?? 128);
// The palette WLED receives: the user's choice, or the design's curated palette.
export function paletteKey(face) {
  if (face.palette && face.palette !== 'auto') return face.palette;
  const effect = effectById(face.effect);
  return effect.palette ?? (effect.spectrum ? 'rainbow' : effect.singleColor ? 'original' : 'colors');
}
// Colour pickers only matter when WLED builds the palette from them.
export function usesColors(face) {
  const key = paletteKey(face);
  return !!paletteById(key)?.usesColors && !(key === 'original' && effectById(face.effect).ownPalette);
}
const mix = (a, b, amount) => a.map((value, index) => Math.round(value + (b[index] - value) * amount));
const wrap = value => ((value % 1) + 1) % 1;
const hash = value => wrap(Math.sin(value * 127.1 + 311.7) * 43758.5453);
export function previewStops(face, preparedColors) {
  const named = paletteById(paletteKey(face))?.stops;
  if (named) return named;
  const colors = preparedColors ?? face.colors.map(hexToRgb);
  if (paletteById(paletteKey(face))?.threeColors) return paletteKey(face) === 'bands3' ? [colors[0], colors[0], colors[1], colors[1], colors[2] ?? colors[0], colors[2] ?? colors[0]] : [colors[0], colors[1], colors[2] ?? colors[0]];
  return paletteKey(face) === 'color1' || effectById(face.effect).singleColor ? [colors[0], colors[0]] : colors;
}
export function paletteColor(face, amount, preparedColors) {
  const colors = previewStops(face, preparedColors);
  const position = Math.max(0, Math.min(1, amount)) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(position));
  return mix(colors[index], colors[index + 1], position - index);
}
const glow = (distance, width) => Math.max(0, 1 - distance * width);

// Deterministic preview only: WLED owns physical timing and its own effect algorithms.
export function pixelColor(face, position, time, index, preparedColors) {
  const phase = time * (0.08 + face.speed / 160);
  const amount = faceIntensity(face) / 100;
  let palettePosition = 0;
  let intensity = 1;
  switch (face.effect) {
    case 'fireworks': { const cycle = wrap(phase * 0.35); const center = cycle < 0.5 ? cycle * 1.4 : 0.7; const distance = Math.abs(position - center); intensity = cycle < 0.5 ? Math.max(0, 1 - distance * 30) : Math.max(0, 1 - Math.abs(distance - (cycle - 0.5)) * 22) * (1 - cycle) * 2; palettePosition = wrap(position + Math.floor(phase * 0.35) * 0.17); break; }
    case 'aurora': palettePosition = (Math.sin(position * 3.6 - phase) + 1) / 2; break;
    case 'sunset': palettePosition = (Math.sin(position * 2.5 - phase * 0.4) + 1) / 2; break;
    case 'rise': intensity = 0.03 + 0.97 * Math.max(0, 1 - wrap(phase - position) * (12 - amount * 9)); palettePosition = position; break;
    case 'breathe': palettePosition = (Math.sin(phase * 3) + 1) / 2; break;
    case 'sparkle': palettePosition = Math.sin(index * 127.1 + Math.floor(phase * 6) * 311.7) > 0.85 ? 0 : 1; break;
    case 'festive': palettePosition = wrap(position - phase) < 0.06 + amount * 0.12 ? 0 : 1; break;
    case 'ocean': palettePosition = (Math.sin(position * 11 - phase * 2) + Math.sin(position * 19 + phase) + 2) / 4; intensity = 0.3 + palettePosition * 0.7; break;
    case 'fire': { const heat = Math.max(0, 1 - position * (1.4 - amount * 0.6) + Math.sin(index * 1.7 - phase * 16) * 0.18); palettePosition = Math.min(1, heat); intensity = Math.min(1, heat * heat); break; }
    case 'rainbow': palettePosition = wrap(position * (0.5 + amount) - phase * 0.35); break;
    case 'rain': intensity = Math.max(0, 1 - wrap(position * 3 + phase) * 9); palettePosition = 0; break;
    case 'fireflies': intensity = 0.03 + Math.pow((Math.sin(index * 13.1 + phase * 3) + 1) / 2, 14) * 0.97; palettePosition = index % 5 === 0 ? 1 : 0; break;
    case 'galaxy': intensity = 0.06 + Math.pow((Math.sin(index * 9.7 - phase * 4) + 1) / 2, 8) * 0.94; palettePosition = (Math.sin(index * 3.2) + 1) / 2; break;
    case 'neon': palettePosition = (Math.sin(position * 13 - phase * 4) + 1) / 2; intensity = 0.3 + Math.pow(palettePosition, 2) * 0.7; break;
    case 'wave': palettePosition = (Math.sin(position * 23 - phase * 5) + 1) / 2; break;
    case 'scanner': intensity = 0.03 + 0.97 * Math.max(0, 1 - Math.abs(position - (Math.sin(phase * 2) + 1) / 2) * 9); palettePosition = position; break;
    case 'ripple': { const distance = Math.abs(position - (Math.sin(Math.floor(phase) * 17) + 1) / 2); intensity = 0.06 + 0.94 * Math.max(0, 1 - Math.abs(distance - wrap(phase)) * 15); palettePosition = position; break; }
    case 'candy': palettePosition = Math.floor(position * 10 - phase * 2) % 2 === 0 ? 0 : 1; break;
    case 'candycane': { const width = 1 + Math.floor(amount * 255 / 16); palettePosition = Math.floor(index / width - phase * 3) % 2 === 0 ? 0 : 1; break; }
    case 'candle': palettePosition = 0.18 + 0.15 * Math.sin(phase * 13 + index * 2) + 0.03 * Math.sin(phase * 29); intensity = 0.7 + 0.3 * Math.sin(index + phase * 8) ** 2; break;
    case 'snow': palettePosition = Math.sin(index * 97.2 + Math.floor(phase * 4) * 77) > 0.5 ? 0 : 1; break;
    case 'drip': {
      // Drop swells at the top, then accelerates down and splashes at the base.
      const cycle = wrap(phase * 0.45), fall = Math.max(0, (cycle - 0.35) / 0.65);
      const drop = 1 - fall * fall;
      intensity = cycle < 0.35 ? glow(1 - position, 30) * (0.3 + cycle * 2) : Math.max(glow(Math.abs(position - drop), 30), glow(1 - position, 40) * 0.35);
      if (cycle > 0.94) intensity = Math.max(intensity, glow(position, 12) * (1 - cycle) * 16);
      break;
    }
    case 'starburst': {
      const burst = Math.floor(phase * 0.8), age = wrap(phase * 0.8), center = 0.15 + hash(burst) * 0.7;
      intensity = glow(Math.abs(Math.abs(position - center) - age * 0.25), 18) * (1 - age);
      palettePosition = wrap(hash(burst + 3) + Math.abs(position - center) * 2);
      break;
    }
    case 'borealis':
      palettePosition = (Math.sin(position * 5 + phase * 0.7) + Math.sin(position * 9 - phase * 1.1) + 2) / 4;
      intensity = 0.15 + 0.85 * ((Math.sin(position * (3 + amount * 5) - phase * 0.5) + 1) / 2) ** 2;
      break;
    case 'heartbeat': {
      const beat = wrap(phase * 1.2), pulse = value => value >= 0 ? Math.exp(-value * 14) : 0;
      intensity = 0.05 + 0.95 * Math.max(pulse(beat), pulse(beat - 0.28) * 0.7);
      break;
    }
    case 'lightning': {
      const strike = Math.floor(phase * 0.6), cycle = wrap(phase * 0.6), start = hash(strike) * 0.6, length = 0.25 + hash(strike + 1) * 0.4;
      intensity = cycle < 0.14 && Math.sin(cycle * 220) > -0.2 && position >= start && position <= start + length ? 1 - cycle * 4 : 0;
      break;
    }
    case 'radar': {
      const eye = 1 - Math.abs(wrap(phase * 0.6) * 2 - 1);
      intensity = glow(Math.abs(position - eye), 30 - amount * 20);
      break;
    }
    case 'plasma':
      palettePosition = wrap((Math.sin(position * 6 + phase) + Math.cos(position * 9 - phase * 1.3) + 2) / 4);
      intensity = Math.max(0, 1 - (1 - palettePosition) * amount * 0.9);
      break;
    case 'juggle': {
      intensity = 0;
      for (let dot = 0; dot < 8; dot++) {
        const level = glow(Math.abs(position - (Math.sin(phase * (0.6 + dot * 0.13) + dot) + 1) / 2), 26 - amount * 14);
        if (level > intensity) { intensity = level; palettePosition = dot / 8; }
      }
      break;
    }
    case 'tetrix': {
      const stack = wrap(phase * 0.12), falling = 1 - wrap(phase * 0.84);
      const brick = Math.floor(position * (8 - amount * 5));
      intensity = position < stack || Math.abs(position - falling) < 0.05 ? 1 : 0;
      palettePosition = hash(position < stack ? brick : Math.floor(phase * 0.84) + 40);
      break;
    }
    case 'bounce': {
      intensity = 0;
      const balls = 1 + Math.round(amount * 4);
      for (let ball = 0; ball < balls; ball++) {
        const level = glow(Math.abs(position - Math.abs(Math.sin(phase * (0.9 + ball * 0.23) + ball * 1.7))), 30);
        if (level > intensity) { intensity = level; palettePosition = ball / balls; }
      }
      break;
    }
    default: break;
  }
  return { color: paletteColor(face, palettePosition, preparedColors), palettePosition, intensity: intensity * face.brightness / 100 };
}

const paletteKeys = new Set(palettes.map(item => item.id));
export function validScene(scene) {
  return scene && typeof scene.on === 'boolean' && Array.isArray(scene.faces) && (scene.segments ? scene.faces.length >= 1 && scene.faces.length <= 16 && !segmentError(scene, scene.total) : scene.faces.length === 2) && (scene.transition === undefined || Number.isFinite(scene.transition) && scene.transition >= 0 && scene.transition <= 65) && (scene.bri === undefined || Number.isFinite(scene.bri) && scene.bri >= 1 && scene.bri <= 100) && scene.faces.every(face =>
    effects.some(effect => effect.id === face.effect) && Array.isArray(face.colors) && (face.colors.length === 2 || face.colors.length === 3) &&
    face.colors.every(color => /^#[0-9a-f]{6}$/i.test(color)) &&
    Number.isFinite(face.brightness) && face.brightness >= 0 && face.brightness <= 100 &&
    Number.isFinite(face.speed) && face.speed >= 0 && face.speed <= 100 &&
    (face.intensity === undefined || Number.isFinite(face.intensity) && face.intensity >= 0 && face.intensity <= 100) &&
    (face.palette === undefined || paletteKeys.has(face.palette)) &&
    ['reverse', 'mirror'].every(key => face[key] === undefined || typeof face[key] === 'boolean'));
}

export function readSavedScenes() {
  try { return JSON.parse(localStorage.getItem('luma-scenes') || '[]').filter(item => typeof item.name === 'string' && typeof item.id === 'string' && validScene(item.scene)).slice(0, 12); }
  catch { return []; }
}
