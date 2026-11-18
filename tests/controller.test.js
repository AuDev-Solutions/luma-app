import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, normalizeAddress, connectWled, applyWled } from '../src/lib/wled.js';
import { initialScene, effects, validScene, pixelColor, presetFace, paletteKey } from '../src/lib/scenes.js';
import { resolvePalette } from '../src/lib/palettes.js';

const device = {
  address: 'http://192.168.4.1',
  count: 100,
  effects: effects.map(effect => effect.wled),
  state: {
    seg: [
      { id: 0, start: 0, stop: 50 },
      { id: 1, start: 50, stop: 100 },
    ],
  },
};
test('Maps each face independently to the device effect list and RGB values', () => {
  const scene = structuredClone(initialScene);
  scene.faces[1] = { effect: 'solid', colors: ['#ff0000', '#0000ff'], brightness: 30, speed: 0 };
  const payload = buildPayload(scene, device, 50);
  assert.equal(payload.seg[0].fx, device.effects.indexOf('Gradient'));
  assert.equal(payload.seg[1].fx, device.effects.indexOf('Solid'));
  assert.deepEqual(payload.seg[1].col[0], [255, 0, 0]);
  assert.equal(payload.seg[1].bri, 77);
  assert.equal(payload.seg[0].bri, 166);
});
test('Refuses overlapping custom segments and unsupported effects', () => {
  assert.throws(
    () =>
      buildPayload(
        initialScene,
        {
          ...device,
          state: {
            seg: [
              { id: 0, start: 0, stop: 75 },
              { id: 1, start: 50, stop: 100 },
            ],
          },
        },
        50,
      ),
    /Configura primero/,
  );
  assert.throws(() => buildPayload(initialScene, { ...device, effects: ['Solid'] }, 50), /no incluye/);
  assert.throws(() => buildPayload(initialScene, { ...device, count: 400 }, 50), /Configura primero/);
});
test('First apply splits the default 100-pixel strip into two faces without changing hardware', () => {
  const payload = buildPayload(initialScene, { ...device, state: { seg: [{ id: 0, start: 0, stop: 100 }] } }, 50);
  assert.deepEqual(
    payload.seg.map(({ start, stop }) => [start, stop]),
    [
      [0, 50],
      [50, 100],
    ],
  );
  assert.equal(payload.hw, undefined);
  assert.throws(
    () => buildPayload(initialScene, { ...device, state: { seg: [{ id: 0, start: 0, stop: 100, rev: true }] } }, 50),
    /Configura primero/,
  );
});
test('Ascenso supports Meteor in WLED 17 builds without Comet', () => {
  const scene = structuredClone(initialScene);
  scene.faces[0].effect = 'rise';
  assert.equal(buildPayload(scene, { ...device, effects: ['Solid', 'Gradient', 'Meteor'] }, 50).seg[0].fx, 2);
});
test('Single 50-pixel strip uses all pixels on segment 0 and never sends face B', () => {
  const single = { ...device, count: 50, state: { seg: [{ id: 0, start: 0, stop: 50 }] } };
  const scene = structuredClone(initialScene);
  scene.faces[1].effect = 'rise';
  const payload = buildPayload(scene, { ...single, effects: ['Gradient'] }, 50, 1);
  assert.equal(payload.seg.length, 1);
  assert.equal(payload.seg[0].start, 0);
  assert.equal(payload.seg[0].stop, 50);
  assert.throws(() => buildPayload(scene, device, 50, 1), /Configura 50/);
  assert.throws(
    () =>
      buildPayload(scene, { ...single, state: { seg: [...single.state.seg, { id: 1, start: 0, stop: 50 }] } }, 50, 1),
    /adicionales/,
  );
});
test('Zero brightness switches a face off and never wraps brightness', () => {
  const scene = structuredClone(initialScene);
  scene.faces[0].brightness = 0;
  assert.equal(buildPayload(scene, device, 50).seg[0].on, false);
});
test('Validates saved data and controller addresses', () => {
  assert.ok(validScene(initialScene));
  assert.equal(validScene({ ...initialScene, faces: [{ colors: ['bad'] }] }), false);
  assert.equal(normalizeAddress('192.168.4.1'), 'http://192.168.4.1');
  assert.throws(() => normalizeAddress('https://user:pass@host/'));
  assert.throws(() => normalizeAddress('http://host/other'));
});
test('Preview produces bounded colors for every effect at 400 pixels', () => {
  for (const effect of effects)
    for (let i = 0; i < 200; i++) {
      const output = pixelColor({ ...initialScene.faces[0], effect: effect.id }, i / 199, 14.2, i);
      assert.ok(output.color.every(channel => channel >= 0 && channel <= 255));
      assert.ok(output.intensity >= 0 && output.intensity <= 1);
    }
});
test('Controller adapter reads actual metadata and posts only after layout validation', async () => {
  const original = globalThis.fetch;
  const calls = [];
  let state = structuredClone(device.state);
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'POST') {
      const payload = JSON.parse(options.body);
      state = {
        ...state,
        ...payload,
        seg: payload.seg.map(segment => ({ ...state.seg.find(previous => previous.id === segment.id), ...segment })),
      };
    }
    return {
      ok: true,
      json: async () =>
        url.endsWith('/json')
          ? { info: { name: 'Banco de prueba', leds: { count: 100 } }, effects: device.effects, state }
          : state,
    };
  };
  try {
    const connected = await connectWled('192.168.4.1');
    assert.equal(connected.name, 'Banco de prueba');
    await applyWled(initialScene, connected, 50);
    const posts = calls.filter(call => call.options.method === 'POST');
    assert.equal(posts.length, 1);
    assert.equal(JSON.parse(posts[0].options.body).seg.length, 2);
    const before = calls.length;
    await assert.rejects(applyWled(initialScene, connected, 200), /Configura primero/);
    assert.equal(calls.length, before + 1);
  } finally {
    globalThis.fetch = original;
  }
});
test('Does not report success when the controller silently ignores the update', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => ({
    ok: true,
    json: async () =>
      url.endsWith('/json')
        ? { info: { leds: { count: 100 } }, effects: device.effects, state: device.state }
        : device.state,
  });
  try {
    await assert.rejects(applyWled(initialScene, device, 50), /no confirmó/);
  } finally {
    globalThis.fetch = original;
  }
});

test('All 32 curated presets have distinct IDs, valid settings and resolvable device effects', () => {
  assert.equal(effects.length, 32);
  assert.equal(new Set(effects.map(effect => effect.id)).size, 32);
  for (const effect of effects) {
    const face = presetFace(effect);
    const scene = { on: true, faces: [face, structuredClone(face)] };
    assert.ok(validScene(scene), effect.name);
    const payload = buildPayload(scene, device, 50);
    assert.equal(device.effects[payload.seg[0].fx], effect.wled);
    assert.equal(payload.seg[0].pal, resolvePalette(paletteKey(face)));
    for (const time of [0, 0.1, 4.7, 100])
      for (let i = 0; i < 200; i++) {
        const pixel = pixelColor(face, i / 199, time, i);
        assert.ok(
          pixel.color.every(value => Number.isFinite(value) && value >= 0 && value <= 255),
          effect.id,
        );
        assert.ok(pixel.intensity >= 0 && pixel.intensity <= 1, effect.id);
        assert.ok(pixel.palettePosition >= 0 && pixel.palettePosition <= 1, effect.id);
      }
  }
});

test('Rejects an acknowledgement that ignores the palette or secondary color', async () => {
  const original = globalThis.fetch;
  let state;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') {
      state = JSON.parse(options.body);
      state.seg[0].pal = 0;
    }
    return {
      ok: true,
      json: async () =>
        url.endsWith('/json')
          ? { info: { leds: { count: 100 } }, effects: device.effects, state: device.state }
          : state,
    };
  };
  try {
    await assert.rejects(applyWled(initialScene, device, 50), /no confirmó/);
  } finally {
    globalThis.fetch = original;
  }
});
