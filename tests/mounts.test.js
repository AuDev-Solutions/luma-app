import test from 'node:test';
import assert from 'node:assert/strict';
import { mountFor, supportedTotals } from '../src/lib/mounts.js';
import { prepareScene, segmentError } from '../src/lib/segments.js';
import { buildPayload, setLedCount } from '../src/lib/wled.js';
import { initialScene, effects } from '../src/lib/scenes.js';

const names = effects.map(effect => effect.wled);

test('100 LEDs default to one face of 100; the saved choice wins only for the same total', () => {
  assert.equal(mountFor(100).id, 'face-100');
  assert.equal(mountFor(100, 'test-2x50').id, 'test-2x50');
  assert.equal(mountFor(200, 'test-2x50').id, 'faces-200');
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
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ hw: { led: { ins: [bus, { ...bus, start: 100 }] } } }) });
    await assert.rejects(setLedCount('http://pole.test', 200), /varias salidas/);
  } finally { globalThis.fetch = original; }
});
