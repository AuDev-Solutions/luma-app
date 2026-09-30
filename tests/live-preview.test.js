import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeLiveFrame } from '../src/lib/live-preview.js';
import { buildPayload, sceneFromDevice } from '../src/lib/wled.js';
import { effects, presetFace, pixelColor } from '../src/lib/scenes.js';

test('Peek preserves physical LED order, RGB and off pixels without downsampling', () => {
  for (const count of [50, 100, 400]) {
    const input = new Uint8Array(2 + count * 3); input.set([76, 1]);
    input.set([255, 0, 0], 2); input.set([0, 0, 255], 2 + (count - 1) * 3);
    const decoded = decodeLiveFrame(input.buffer, count);
    assert.deepEqual([...decoded.slice(0, 6)], [255, 0, 0, 0, 0, 0]);
    assert.deepEqual([...decoded.slice(-3)], [0, 0, 255]);
    assert.equal(decoded.length, count * 3);
    assert.equal(decodeLiveFrame(input.buffer, count + 1), null);
  }
  assert.equal(decodeLiveFrame(new Uint8Array([76, 2, 1, 1, 0, 0, 0]).buffer, 1), null);
});

test('Rain always fades to black, including scenes saved with the old blue background', () => {
  const face = presetFace(effects.find(effect => effect.id === 'rain'));
  face.colors[1] = '#092355';
  const device = { count: 100, effects: ['Rain'], state: { seg: [{ id: 0, start: 0, stop: 100 }] } };
  const payload = buildPayload({ on: true, faces: [face, face] }, device, 50);
  assert.equal(payload.seg[0].pal, 2);
  assert.deepEqual(payload.seg[0].col[1], [0, 0, 0]);
  assert.equal(pixelColor(face, 0.2, 0, 10).intensity, 0);
});

test('Fireworks 1D resolves the native effect and uses its full spectrum', () => {
  const face = presetFace(effects.find(effect => effect.id === 'fireworks'));
  const device = { count: 100, effects: ['Solid', 'Fireworks 1D'], state: { seg: [{ id: 0, start: 0, stop: 100 }] } };
  const payload = buildPayload({ on: true, faces: [face, face] }, device, 50);
  assert.equal(payload.seg[0].fx, 1); assert.equal(payload.seg[0].pal, 11);
  assert.deepEqual(payload.seg[0].col[1], [0, 0, 0]);
  const restored = sceneFromDevice({ ...device, state: payload });
  assert.equal(restored.faces[0].effect, 'fireworks');
  assert.equal(restored.faces[0].brightness, 60);
});
