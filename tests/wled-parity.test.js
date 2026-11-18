import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, parseFxData, sceneFromDevice, applyWled } from '../src/lib/wled.js';
import { prepareScene, faceSegments } from '../src/lib/segments.js';
import { initialScene, effects, presetFace } from '../src/lib/scenes.js';

const names = effects.map(effect => effect.wled);
const paletteNames = ['Default', '* Random Cycle', '* Color 1', '* Colors 1&2', 'Fire'];
const device = {
  address: 'http://pole.test',
  count: 100,
  maxSegments: 16,
  effects: names,
  palettes: paletteNames,
  state: {
    seg: [
      { id: 0, start: 0, stop: 50 },
      { id: 1, start: 50, stop: 100 },
    ],
  },
};
const scene = () => ({
  ...prepareScene(initialScene, 100),
  segments: faceSegments(100),
  faces: structuredClone(initialScene.faces),
});

test('Only the edited segment stays selected on the controller, like WLED', () => {
  const payload = buildPayload(scene(), device, 50, 2, 1);
  assert.deepEqual(
    payload.seg.map(item => item.sel),
    [false, true],
  );
  assert.equal(payload.mainseg, 1);
  const all = buildPayload(scene(), device, 50, 2, 'all');
  assert.deepEqual(
    all.seg.map(item => item.sel),
    [true, true],
  );
  assert.equal(all.mainseg, 0);
});

test('Effect metadata defaults from /json/fxdata are sent, as WLED does with fxdef', () => {
  const parsed = parseFxData([
    'Solid',
    'Drip@Gravity,# of drips,,,,,Overlay;!,!;!;;m12=1',
    'PS Fire 1D@!,!,Cooling,Blur;,!;!;1;pal=35,sx=100,ix=50,c1=80,c2=100,c3=40,o1=1,o2=0',
  ]);
  assert.deepEqual(parsed[1], {});
  assert.deepEqual(parsed[2], { c1: 80, c2: 100, c3: 31, o1: true, o2: false });
  assert.equal(parseFxData({ not: 'a list' }), null);
  const next = scene();
  next.faces[0] = presetFace(effects.find(effect => effect.id === 'fire'));
  const fx = names.indexOf('Fire 2012');
  const fxDefaults = [];
  fxDefaults[fx] = { c1: 7, o1: true };
  const payload = buildPayload(next, { ...device, fxDefaults }, 50);
  assert.equal(payload.seg[0].c1, 7);
  assert.equal(payload.seg[0].o1, true);
  assert.equal(payload.seg[0].ix, 161);
});

test('Palettes resolve by controller name; each design keeps its tuned palette', () => {
  const next = scene();
  next.faces[0] = presetFace(effects.find(effect => effect.id === 'fire'));
  next.faces[1] = presetFace(effects.find(effect => effect.id === 'ocean'));
  let payload = buildPayload(next, device, 50);
  assert.equal(payload.seg[0].pal, 4, 'Fire resolved by name on this controller');
  assert.equal(payload.seg[1].pal, 0, 'Pacifica keeps its original WLED palettes');
  next.faces[0].palette = 'colors';
  payload = buildPayload(next, device, 50);
  assert.equal(payload.seg[0].pal, 3);
  assert.equal(buildPayload(next, { ...device, palettes: null }, 50).seg[1].pal, 0);
});

test('Reverse, mirror, intensity and palette survive apply and reconnect', async () => {
  const next = scene();
  Object.assign(next.faces[1], { reverse: true, mirror: true, intensity: 80, palette: 'fire' });
  let state = structuredClone(device.state);
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') {
      const payload = JSON.parse(options.body);
      state = { ...payload, seg: payload.seg.filter(item => item.stop > 0) };
    }
    return {
      ok: true,
      json: async () =>
        url.endsWith('/json')
          ? { state, info: { leds: { count: 100 } }, effects: names, palettes: paletteNames }
          : state,
    };
  };
  try {
    const confirmed = await applyWled(next, device, 50, 2, next.segments[1].id);
    assert.equal(confirmed.seg[1].rev, true);
    assert.equal(confirmed.seg[1].mi, true);
    assert.equal(confirmed.seg[1].ix, 204);
    const restored = sceneFromDevice({ ...device, state: confirmed });
    assert.equal(restored.faces[1].reverse, true);
    assert.equal(restored.faces[1].mirror, true);
    assert.equal(restored.faces[1].intensity, 80);
    assert.equal(restored.faces[1].palette, 'fire');
    assert.equal(restored.faces[0].palette, 'auto');
  } finally {
    globalThis.fetch = original;
  }
});
