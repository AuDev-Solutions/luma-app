import test from 'node:test';
import assert from 'node:assert/strict';
import { mountFor, mountById, supportedTotals, copiedOutputs, selectableMounts } from '../src/lib/mounts.js';
import { prepareScene, segmentError } from '../src/lib/segments.js';
import { buildPayload, setLedCount, copyFaceB } from '../src/lib/wled.js';
import { initialScene, effects } from '../src/lib/scenes.js';

const names = effects.map(effect => effect.wled);

test('100 LEDs default to one face of 100; the saved choice wins only for the same total', () => {
  assert.equal(mountFor(100).id, 'face-100');
  assert.equal(mountFor(100, 'test-2x50').id, 'test-2x50');
  assert.equal(mountFor(200, 'test-2x50').id, 'strip-200');
  assert.equal(mountFor(200, 'faces-200').id, 'faces-200');
  assert.equal(mountFor(200, 'strip-200', 2).id, 'faces-200', 'two data pins mean two faces');
  assert.equal(mountFor(300), undefined);
  assert.deepEqual(supportedTotals, [50, 100, 200, 400]);
});

test('One face of 100 and two faces of 100 send native ranges', () => {
  const one = prepareScene(initialScene, 100, 1);
  assert.equal(segmentError(one, 100), '');
  const device = { count: 100, effects: names, state: { seg: [{ id: 0, start: 0, stop: 100 }] } };
  assert.deepEqual(buildPayload(one, device, 100, 1).seg.map(({ start, stop }) => [start, stop]), [[0, 100]]);
  const differing = prepareScene({ on: true, faces: [initialScene.faces[0], { ...initialScene.faces[0], effect: 'solid' }] }, 100, 1);
  assert.equal(differing.segments.length, 1, 'a single physical face never splits into Cara A/B');
  const two = prepareScene({ on: true, faces: [initialScene.faces[0], { ...initialScene.faces[0], effect: 'solid' }] }, 200, 2);
  const payload = buildPayload(two, { ...device, count: 200 }, 100, 2);
  assert.deepEqual(payload.seg.filter(s => s.stop).map(({ start, stop }) => [start, stop]), [[0, 100], [100, 200]]);
});

test('Second face: only the LED count changes; pin, type, order and current limit are preserved', async () => {
  const bus = { start: 0, len: 100, pin: [17], order: 0, rev: false, skip: 0, type: 22, ref: false, rgbwm: 0, freq: 0, maxpwr: 850, ledma: 55, drv: 0, text: '' };
  let count = 100; const posts = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') { const body = JSON.parse(options.body); posts.push(body); count = body.hw.led.ins[0].len; return { ok: true, json: async () => ({ success: true }) }; }
    return { ok: true, json: async () => url.endsWith('/json/cfg') ? { hw: { led: { ins: [bus] } } } : { leds: { count } } };
  };
  try {
    await setLedCount('http://pole.test', 200);
    assert.deepEqual(posts, [{ hw: { led: { ins: [{ ...bus, len: 200 }] } } }]);
    bus.start = 0;
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ hw: { led: { ins: [bus, { ...bus, start: 100 }, { ...bus, start: 200 }] } } }) });
    await assert.rejects(setLedCount('http://pole.test', 300), /más de dos salidas/);
  } finally { globalThis.fetch = original; }
});

test('Two data pins (GPIO 17 and 18): changing the count splits it evenly between the faces', async () => {
  const bus = { start: 0, len: 100, pin: [17], type: 22, maxpwr: 0, ledma: 55 };
  const posts = []; let count = 200;
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST' && url.endsWith('/json/state')) return { ok: true, json: async () => ({ success: true }) };
    if (options.method === 'POST') { const body = JSON.parse(options.body); posts.push(body); count = body.hw.led.ins.reduce((sum, item) => sum + item.len, 0); return { ok: true, json: async () => ({ success: true }) }; }
    return { ok: true, json: async () => url.endsWith('/json/cfg') ? { hw: { led: { ins: [bus, { ...bus, start: 100, pin: [18] }] } } } : { leds: { count }, uptime: 3 } };
  };
  try {
    await setLedCount('http://pole.test', 400);
    assert.deepEqual(posts[0].hw.led.ins.map(item => [item.pin[0], item.start, item.len]), [[17, 0, 200], [18, 200, 200]]);
  } finally { globalThis.fetch = original; }
});

test('Outputs that both start at LED 1 are two faces copied by the controller', () => {
  const bus = { start: 0, len: 100, pin: [17] };
  assert.equal(copiedOutputs({ hw: { led: { ins: [bus, { ...bus, pin: [3] }] } } }), true);
  assert.equal(copiedOutputs({ hw: { led: { ins: [bus, { ...bus, start: 100, pin: [3] }] } } }), false);
  assert.equal(copiedOutputs({ hw: { led: { ins: [bus] } } }), false);
  assert.equal(mountFor(100, 'face-100', 2, true).id, 'faces-copy-100');
  assert.equal(mountFor(200, 'strip-200', 2, true).id, 'faces-copy-200');
  assert.equal(mountFor(100, 'faces-copy-100').id, 'faces-copy-100', 'without the outputs the saved choice is kept');
  assert.equal(mountFor(100, 'faces-copy-100', 1, false).id, 'face-100', 'outputs that do not overlap are not copied faces');
  assert.equal(mountById('faces-copy-100').faceCount, 1, 'the editor and the preview work on one face');
  assert.deepEqual(selectableMounts('face-100').filter(item => item.copiedFaces), [], 'copied faces are detected, never picked by hand');
});

test('Copying face B: its output moves to LED 1 keeping pin, driver and limits; the pole then reports one face', async () => {
  const a = { start: 0, len: 100, pin: [17], type: 22, maxpwr: 0, ledma: 30, drv: 0 };
  const b = { ...a, start: 100, pin: [3], drv: 1 };
  let ins = [a, b]; const posts = []; let restarts = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST' && url.endsWith('/json/state')) { restarts++; return { ok: true, json: async () => ({ success: true }) }; }
    if (options.method === 'POST') { const body = JSON.parse(options.body); posts.push(body); ins = body.hw.led.ins; return { ok: true, json: async () => ({ success: true }) }; }
    const count = Math.max(...ins.map(bus => bus.start + bus.len));
    return { ok: true, json: async () => url.endsWith('/json/cfg') ? { hw: { led: { ins } } } : { leds: { count }, uptime: 3 } };
  };
  try {
    assert.equal(await copyFaceB('http://pole.test'), true);
    assert.deepEqual(posts, [{ hw: { led: { ins: [a, { ...b, start: 0 }] } } }]);
    assert.equal(restarts, 1, 'the pole restarts so the I2S output of face B lights again');
    assert.equal(await copyFaceB('http://pole.test'), false, 'already copied: nothing is written');
    await setLedCount('http://pole.test', 200);
    assert.deepEqual(posts[1].hw.led.ins.map(bus => [bus.pin[0], bus.start, bus.len]), [[17, 0, 200], [3, 0, 200]], 'both faces grow together');
    ins = [a, { ...b, len: 50 }];
    await assert.rejects(copyFaceB('http://pole.test'), /dos caras iguales/);
  } finally { globalThis.fetch = original; }
});
