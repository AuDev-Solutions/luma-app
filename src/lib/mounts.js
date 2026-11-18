// WS2811 strips give no electrical feedback: the LED count always comes from WLED's configuration.
// The same total can mean different physical layouts (100 = one face of 100 or two test strips of 50),
// so each mount has its own id and the first one listed for a total is the default.
// `copiedFaces`: one face per data pin and both outputs start at LED 1, so the controller sends the same
// pixels to both pins. WLED sees one face; face B repeats it LED by LED in every effect, random ones too.
export const mounts = [
  {
    id: 'face-100',
    total: 100,
    count: 100,
    faceCount: 1,
    name: 'Una cara · 100 LEDs',
    description: 'Montaje actual · un pin de datos · 3,96 m entre extremos',
  },
  {
    id: 'faces-copy-100',
    total: 100,
    count: 100,
    faceCount: 1,
    copiedFaces: true,
    name: 'Dos caras · 200 LEDs',
    description: '100 por cara, una por pin · la cara B repite la cara A',
  },
  {
    id: 'strip-200',
    total: 200,
    count: 200,
    faceCount: 1,
    name: 'Dos tiras en fila · 200 LEDs',
    description: 'Prueba actual · 200 LEDs en serie en una sola línea',
  },
  {
    id: 'faces-200',
    total: 200,
    count: 100,
    faceCount: 2,
    name: 'Dos caras · 200 LEDs',
    description: '100 por cara · 3,96 m entre extremos',
  },
  {
    id: 'faces-copy-200',
    total: 200,
    count: 200,
    faceCount: 1,
    copiedFaces: true,
    name: 'Poste completo · 400 LEDs',
    description: '200 por cara, una por pin · la cara B repite la cara A',
  },
  {
    id: 'test-50',
    total: 50,
    count: 50,
    faceCount: 1,
    name: 'Una tira de prueba',
    description: '50 píxeles · una cara · 1,96 m entre extremos',
  },
  {
    id: 'test-2x50',
    total: 100,
    count: 50,
    faceCount: 2,
    name: 'Dos tiras de prueba',
    description: '100 píxeles · 50 por cara · 1,96 m entre extremos',
  },
  {
    id: 'full-400',
    total: 400,
    count: 200,
    faceCount: 2,
    name: 'Poste completo',
    description: '400 píxeles · 200 por cara · 7,96 m entre extremos',
  },
];
export const supportedTotals = [...new Set(mounts.map(item => item.total))].sort((a, b) => a - b);
export const mountById = id => mounts.find(item => item.id === id);
// Copied faces are what the controller's outputs say, never a manual choice.
export const selectableMounts = current => mounts.filter(item => !item.copiedFaces || item.id === current);

// Two outputs that both start at LED 1 with the same length: face B repeats face A in hardware.
export function copiedOutputs(config) {
  const ins = config?.hw?.led?.ins;
  return Array.isArray(ins) && ins.length === 2 && ins.every(bus => (bus.start ?? 0) === 0 && bus.len === ins[0].len);
}

// One face per data pin: with two LED outputs, 200 LEDs are two faces of 100; outputs that overlap are
// one face shown on both sides. Without the outputs (`copied` undefined) the saved choice is trusted.
export function mountFor(total, preferred, outputs = 1, copied) {
  const plain = mounts.find(item => item.total === total && !item.copiedFaces);
  if (copied) return mounts.find(item => item.copiedFaces && item.total === total) ?? plain;
  if (outputs === 2 && total === 200 && preferred !== 'faces-200') return mountById('faces-200');
  const saved = mountById(preferred);
  return saved?.total === total && !(saved.copiedFaces && copied === false) ? saved : plain;
}
