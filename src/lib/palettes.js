// WLED built-in palettes (FX_fcn.cpp JSON_palette_names, v17). IDs are resolved by name from
// the connected controller; `fallback` is the v17 index. `stops` only approximate the preview.
const hex = value => [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16));
const stops = (...values) => values.map(hex);

export const palettes = [
  { id: 'auto', name: 'Del diseño' },
  { id: 'colors', name: 'Tus dos colores', wled: '* Colors 1&2', fallback: 3, usesColors: true },
  { id: 'color1', name: 'Color principal', wled: '* Color 1', fallback: 2, usesColors: true },
  { id: 'original', name: 'Original', wled: 'Default', fallback: 0, usesColors: true },
  { id: 'rainbow', name: 'Arcoíris', wled: 'Rainbow', fallback: 11, stops: stops('#ff345f', '#ffae32', '#e6ff48', '#36ed9f', '#23cbff', '#6655ff', '#ed48e8', '#ff345f') },
  { id: 'party', name: 'Fiesta', wled: 'Party', fallback: 6, stops: stops('#5500ab', '#b5004b', '#e81700', '#abab00', '#dd2200', '#8f0071', '#2f00d0', '#5500ab') },
  { id: 'fire', name: 'Fuego', wled: 'Fire', fallback: 35, stops: stops('#000000', '#6b0000', '#ff2200', '#ff8800', '#ffdd33', '#fff6d8') },
  { id: 'lava', name: 'Lava', wled: 'Lava', fallback: 8, stops: stops('#000000', '#800000', '#ff0000', '#ffa500', '#fff2c0', '#ff0000', '#800000') },
  { id: 'ocean', name: 'Océano', wled: 'Ocean', fallback: 9, stops: stops('#191970', '#0000ff', '#008b8b', '#7fffd4', '#87ceeb', '#0000cd') },
  { id: 'atlantica', name: 'Atlántico', wled: 'Atlantica', fallback: 51, stops: stops('#001c70', '#206080', '#0091b5', '#00ffa1', '#007bb5', '#001c70') },
  { id: 'forest', name: 'Bosque', wled: 'Forest', fallback: 10, stops: stops('#006400', '#556b2f', '#2e8b57', '#9acd32', '#32cd32', '#006400') },
  { id: 'sunset', name: 'Ocaso', wled: 'Sunset', fallback: 13, stops: stops('#780000', '#b31600', '#ff6800', '#a7160f', '#640067', '#10002d') },
  { id: 'aurora', name: 'Aurora', wled: 'Aurora', fallback: 50, stops: stops('#010516', '#00c817', '#00ff00', '#00f32d', '#008707', '#010516') },
  { id: 'icefire', name: 'Hielo y fuego', wled: 'Icefire', fallback: 36, stops: stops('#000000', '#003351', '#0066ff', '#99ccff', '#ffffff', '#ff9900', '#ff3300') },
  { id: 'pastel', name: 'Pastel', wled: 'Pastel', fallback: 20, stops: stops('#3dad94', '#99f5e4', '#fff4ad', '#ffae6d', '#ff7a8c', '#c5a6ff') },
  { id: 'candy', name: 'Dulce', wled: 'Candy', fallback: 57, stops: stops('#f3f218', '#dd4b2e', '#9c1f89', '#2c0467', '#9c1f89', '#dd4b2e') },
];

export const paletteById = id => palettes.find(item => item.id === id);

export function resolvePalette(id, names) {
  const palette = paletteById(id);
  if (!palette?.wled) return 0;
  const index = Array.isArray(names) ? names.findIndex(name => name === palette.wled) : -1;
  return index >= 0 ? index : palette.fallback;
}

export function paletteFromIndex(index, names) {
  return palettes.find(item => item.wled && resolvePalette(item.id, names) === index)?.id;
}
