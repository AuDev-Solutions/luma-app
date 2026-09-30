// WS2811 strips give no electrical feedback: the LED count always comes from WLED's configuration.
// The same total can mean different physical layouts (100 = one face of 100 or two test strips of 50),
// so each mount has its own id and the first one listed for a total is the default.
export const mounts = [
  { id: 'face-100', total: 100, count: 100, faceCount: 1, name: 'Una cara · 100 LEDs', description: 'Montaje actual · un pin de datos · 3,96 m entre extremos' },
  { id: 'faces-200', total: 200, count: 100, faceCount: 2, name: 'Dos caras · 200 LEDs', description: '100 por cara · 3,96 m entre extremos' },
  { id: 'test-50', total: 50, count: 50, faceCount: 1, name: 'Una tira de prueba', description: '50 píxeles · una cara · 1,96 m entre extremos' },
  { id: 'test-2x50', total: 100, count: 50, faceCount: 2, name: 'Dos tiras de prueba', description: '100 píxeles · 50 por cara · 1,96 m entre extremos' },
  { id: 'full-400', total: 400, count: 200, faceCount: 2, name: 'Poste completo', description: '400 píxeles · 200 por cara · 7,96 m entre extremos' },
];
export const supportedTotals = [...new Set(mounts.map(item => item.total))].sort((a, b) => a - b);
export const mountById = id => mounts.find(item => item.id === id);
export function mountFor(total, preferred) {
  const saved = mountById(preferred);
  return saved?.total === total ? saved : mounts.find(item => item.total === total);
}
