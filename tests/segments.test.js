import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareScene, segmentError, segmentMap, carveSegment, removeSegment, mergeSegments } from '../src/lib/segments.js';
import { initialScene, validScene } from '../src/lib/scenes.js';
import { buildPayload, sceneFromDevice, applyWled } from '../src/lib/wled.js';

const device = { address: 'http://pole.test', count: 100, maxSegments: 16, effects: ['Gradient', 'Solid'], state: { seg: [{ id: 0, start: 0, stop: 50 }, { id: 1, start: 50, stop: 100 }, { id: 3, start: 20, stop: 40 }] } };
const scene = () => ({ ...prepareScene(initialScene, 100), faces: structuredClone(initialScene.faces), transition: 2.5, segments: [{ id: 0, name: 'Base', start: 0, stop: 25 }, { id: 2, name: 'Copa', start: 25, stop: 100 }] });

test('Arbitrary segment bounds, separate effects, deletions and transition use native WLED units', () => {
  const next = scene(); next.faces[1].effect = 'solid';
  const payload = buildPayload(next, device, 50);
  assert.equal(payload.transition, 25);
  assert.deepEqual(payload.seg.map(({ id, start, stop }) => ({ id, start, stop })), [{ id: 0, start: 0, stop: 25 }, { id: 1, start: 25, stop: 100 }, { id: 3, start: undefined, stop: 0 }]);
  assert.equal(payload.seg[0].fx, 0); assert.equal(payload.seg[1].fx, 1);
  assert.equal(buildPayload({ ...next, transition: 0 }, device, 50).transition, 0);
  assert.equal(payload.hw, undefined);
  const restored = sceneFromDevice({ ...device, state: { ...payload, seg: payload.seg.slice(0, 2) } });
  assert.equal(restored.transition, 2.5); assert.deepEqual(restored.segments, next.segments.map((item, id) => ({ ...item, id })));
  assert.ok(validScene(restored));
});

test('Rejects overlapping, empty, out-of-range, fractional and unsupported segment IDs before sending', () => {
  for (const patch of [{ start: 24 }, { stop: 101 }, { start: 100 }, { start: 25.5 }, { id: 0 }, { id: 16 }]) {
    const next = scene(); next.segments[1] = { ...next.segments[1], ...patch };
    assert.ok(segmentError(next, 100));
    assert.throws(() => buildPayload(next, device, 50));
    assert.equal(validScene(next), false);
  }
  assert.throws(() => buildPayload(scene(), { ...device, maxSegments: 2 }, 50));
  assert.throws(() => buildPayload({ ...scene(), transition: -1 }, device, 50));
  assert.throws(() => buildPayload({ ...scene(), total: 400 }, device, 50));
});

test('Preview maps physical LEDs across faces and leaves gaps dark; legacy scenes migrate to all mounts', () => {
  const next = scene(); next.segments[1].start = 40;
  const map = segmentMap(next, 100);
  assert.equal(map[0], 0); assert.equal(map[24], 0); assert.equal(map[25], -1);
  assert.equal(map[39], -1); assert.equal(map[40], 1); assert.equal(map[99], 1);
  for (const total of [50, 100, 400]) {
    const migrated = prepareScene(initialScene, total);
    assert.equal(segmentError(migrated, total), ''); assert.ok(validScene(migrated));
    assert.equal(migrated.segments.at(-1).stop, total);
  }
});

test('Apply confirms arbitrary ranges, deletion and transition; rejects a controller ignoring transition', async () => {
  const original = globalThis.fetch;
  let ignore = false, state = device.state;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') { const payload = JSON.parse(options.body); state = { ...payload, transition: ignore ? 4 : payload.transition, seg: payload.seg.filter(item => item.stop > 0) }; }
    return { ok: true, json: async () => url.endsWith('/json') ? { state: device.state, info: { maxseg: 16, leds: { count: 100 } }, effects: device.effects } : state };
  };
  try {
    assert.equal((await applyWled(scene(), device, 50)).transition, 25);
    ignore = true; await assert.rejects(applyWled(scene(), device, 50), /no confirmó/);
  } finally { globalThis.fetch = original; }
});

test('One design means one segment; segmenting carves exact ranges without overlaps or gaps', () => {
  const whole = prepareScene(initialScene, 100, 1);
  assert.deepEqual(whole.segments, [{ id: 0, name: 'Todo el poste', start: 0, stop: 100 }]);
  assert.equal(whole.faces.length, 1);
  const legacy = prepareScene({ on: true, faces: [initialScene.faces[0], { ...initialScene.faces[0], effect: 'solid' }] }, 100);
  assert.equal(legacy.segments.length, 2, 'differing two-face scenes keep their faces');

  const { scene: middle, id } = carveSegment(whole, 30, 60);
  assert.deepEqual(middle.segments.map(({ id, start, stop }) => [id, start, stop]), [[0, 0, 30], [1, 30, 60], [2, 60, 100]]);
  assert.equal(id, 1); assert.equal(middle.segments[1].name, 'Segmento 2');
  assert.equal(middle.segments[0].name, 'Segmento 1');
  assert.equal(segmentError(middle, 100), '');
  middle.faces[1].effect = 'solid';
  assert.equal(middle.faces[0].effect, 'aurora'); assert.equal(middle.faces[2].effect, 'aurora');

  const edge = carveSegment(whole, 80, 100).scene;
  assert.deepEqual(edge.segments.map(({ start, stop }) => [start, stop]), [[0, 80], [80, 100]]);
  assert.equal(carveSegment(whole, 50, 40), null);
  assert.equal(carveSegment(whole, 0, 101), null);
  assert.equal(carveSegment(middle, 40, 50, 3), null, 'respects the controller segment limit');

  const removed = removeSegment(middle, 1);
  assert.deepEqual(removed.segments.map(({ start, stop }) => [start, stop]), [[0, 60], [60, 100]], 'LEDs go to the neighbour, not dark');
  const back = removeSegment(removeSegment(middle, 2), 1);
  assert.deepEqual(back.segments.map(({ start, stop, name }) => [start, stop, name]), [[0, 100, 'Todo el poste']]);
  assert.deepEqual(mergeSegments(middle, 1).segments, whole.segments);
  assert.equal(mergeSegments(middle, 1).faces[0].effect, 'solid');
});

test('Identical contiguous controller segments load as one design for the whole pole', () => {
  const seg = [0, 1].map(id => ({ id, start: id * 50, stop: (id + 1) * 50, on: true, bri: 153, fx: 1, sx: 71, ix: 16, pal: 3, col: [[164, 255, 194], [32, 140, 255], [0, 0, 0]] }));
  const restored = sceneFromDevice({ ...device, state: { on: true, bri: 255, seg } });
  assert.deepEqual(restored.segments, [{ id: 0, name: 'Todo el poste', start: 0, stop: 100 }]);
  seg[1].fx = 0;
  assert.equal(sceneFromDevice({ ...device, state: { on: true, bri: 255, seg } }).segments.length, 2);
});

test('Pole split in 4 equal parts: one colour each over black, sharing one design', async () => {
  const { splitEqual } = await import('../src/lib/segments.js');
  const { buildPayload } = await import('../src/lib/wled.js');
  const { effects, presetFace } = await import('../src/lib/scenes.js');
  const four = splitEqual(prepareScene(initialScene, 100, 1), 4);
  assert.deepEqual(four.segments.map(({ start, stop }) => [start, stop]), [[0, 25], [25, 50], [50, 75], [75, 100]]);
  assert.equal(new Set(four.faces.map(face => face.colors[0])).size, 4);
  assert.ok(four.faces.every(face => face.colors[1] === '#000000' && face.effect === 'aurora'));
  assert.equal(segmentError(four, 100), '');
  assert.equal(splitEqual(prepareScene(initialScene, 100, 1), 4, 0, 3), null, 'respects the controller segment limit');

  const cane = presetFace(effects.find(effect => effect.id === 'candycane'));
  const names = effects.map(effect => effect.wled);
  const payload = buildPayload({ ...prepareScene(initialScene, 100, 1), faces: [cane] }, { count: 100, effects: names, state: { seg: [{ id: 0, start: 0, stop: 100 }] } }, 100, 1);
  assert.equal(names[payload.seg[0].fx], 'Chase 2');
  assert.equal(payload.seg[0].pal, 0, 'pure red and white bands, no gradient');
  assert.deepEqual(payload.seg[0].col.slice(0, 2), [[255, 10, 10], [255, 255, 255]]);
});

test('Two faces: one design runs once per face, not as one 200-LED strip', async () => {
  const { perFace } = await import('../src/lib/segments.js');
  const whole = prepareScene(initialScene, 200, 2);
  assert.deepEqual(whole.segments.map(item => [item.name, item.start, item.stop]), [['Cara A', 0, 100], ['Cara B', 100, 200]]);
  assert.deepEqual(whole.faces[0], whole.faces[1]);
  const fromPole = { ...prepareScene(initialScene, 100, 1), total: 200, segments: [{ id: 0, name: 'Todo el poste', start: 0, stop: 200 }] };
  assert.deepEqual(perFace(fromPole, 2).segments.map(item => [item.start, item.stop]), [[0, 100], [100, 200]]);
  assert.equal(perFace(fromPole, 1), fromPole, 'one face keeps a single segment');
});
