import test from 'node:test';
import assert from 'node:assert/strict';
import { saveScenePreset, deletePreset, listScenes, saveAutoMode, saveSchedule, scheduleTimers, readSchedule, setCurrentLimit, clockStatus, securityStatus, networkStatus, powerStatus, setStandaloneNetwork, AUTO_PRESET, OFF_PRESET } from '../src/lib/controller.js';
import { setSettingsPin, PinRequiredError, request, presetPayload } from '../src/lib/wled.js';
import { prepareScene, splitEqual } from '../src/lib/segments.js';
import { initialScene, effects } from '../src/lib/scenes.js';
import { themes } from '../src/lib/themes.js';
import { validScene } from '../src/lib/scenes.js';
import { segmentError } from '../src/lib/segments.js';

// Minimal controller: presets.json, /upload, /json/state and /json/cfg.
function fakePole(initial = {}) {
  const pole = { presets: { 0: {}, ...initial }, states: [], configs: [], uploads: 0, cfg: { hw: { led: { ins: [{ start: 0, len: 100, pin: [17], type: 22, maxpwr: 0, ledma: 30 }] } } } };
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    let body = {};
    if (path === '/presets.json') body = structuredClone(pole.presets);
    else if (path === '/upload') { pole.uploads++; pole.presets = JSON.parse(await options.body.get('data').text()); body = null; }
    else if (path === '/json/state' && options.method === 'POST') pole.states.push(JSON.parse(options.body));
    else if (path === '/json/cfg') { if (options.method === 'POST') pole.configs.push(JSON.parse(options.body)); else body = pole.cfg; }
    return { ok: true, status: 200, json: async () => { if (body === null) throw new SyntaxError('text'); return body; } };
  };
  return pole;
}
const original = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = original; setSettingsPin(''); });
const device = { address: 'http://pole.test', count: 100, maxSegments: 16, effects: effects.map(effect => effect.wled), state: { seg: [] } };

test('Saving on the pole writes presets.json without applying anything, and keeps other presets', async () => {
  const pole = fakePole({ 7: { n: 'Hecho en otra app', on: true } });
  const scene = splitEqual(prepareScene(initialScene, 100, 1), 4);
  const id = await saveScenePreset(device.address, { name: 'Cuatro colores', payload: presetPayload(scene, device, 100, 1), scene });
  assert.equal(id, 1);
  assert.equal(pole.states.length, 0, 'nothing is sent to /json/state');
  assert.equal(pole.presets[7].n, 'Hecho en otra app');
  assert.equal(pole.presets[1].seg.filter(item => item.stop).length, 4);
  assert.ok(pole.presets[1].seg.some(item => item.id === 15 && item.stop === 0), 'old segments are cleared when the preset loads');
  assert.ok(validScene(pole.presets[1].luma));
  const listed = listScenes(pole.presets);
  assert.deepEqual(listed.map(item => [item.id, item.name]), [[1, 'Cuatro colores'], [7, 'Hecho en otra app']]);
  await deletePreset(device.address, 1);
  assert.equal(pole.presets[1], undefined);
});

test('Automatic mode is a playlist of pole scenes in tenths of a second, then starts it', async () => {
  const pole = fakePole({ 1: { n: 'A' }, 2: { n: 'B' } });
  await saveAutoMode(device.address, { ids: [1, 2], minutes: 5 });
  assert.deepEqual(pole.presets[AUTO_PRESET].playlist.ps, [1, 2]);
  assert.deepEqual(pole.presets[AUTO_PRESET].playlist.dur, [3000, 3000]);
  assert.deepEqual(pole.states.at(-1), { ps: AUTO_PRESET });
  assert.deepEqual(listScenes(pole.presets).map(item => item.id), [1, 2], 'system presets are hidden');
  await assert.rejects(saveAutoMode(device.address, { ids: [1], minutes: 5 }), /dos escenas/);
});

test('Schedule: sunset on + fixed off time, local offset, clock sync; round-trips for editing', async () => {
  const pole = fakePole({ 3: { n: 'Noche' } });
  const schedule = { onPreset: 3, onMode: 'sunset', onTime: '18:30', sunsetOffset: -15, offEnabled: true, offTime: '23:30', latitude: 4.81, longitude: -75.69, utcOffsetSeconds: -18000 };
  await saveSchedule(device.address, schedule);
  assert.deepEqual(pole.presets[OFF_PRESET], { n: 'Apagar', on: false });
  const cfg = pole.configs.at(-1);
  assert.deepEqual(cfg.timers.ins, [{ en: 1, hour: 254, min: -15, macro: 3, dow: 127 }, { en: 1, hour: 23, min: 30, macro: OFF_PRESET, dow: 127 }]);
  assert.deepEqual(cfg.if.ntp, { en: true, tz: 0, offset: -18000, lt: 4.81, ln: -75.69 });
  assert.ok(Number.isInteger(pole.states.at(-1).time));
  const restored = readSchedule(cfg);
  assert.equal(restored.onMode, 'sunset'); assert.equal(restored.sunsetOffset, -15); assert.equal(restored.offTime, '23:30'); assert.equal(restored.onPreset, 3);
  assert.deepEqual(scheduleTimers({ ...schedule, onMode: 'time', onTime: '19:05', offEnabled: false }), [{ en: 1, hour: 19, min: 5, macro: 3, dow: 127 }]);
});

test('Current limit keeps the output definition; PIN travels with configuration requests', async () => {
  const pole = fakePole();
  await setCurrentLimit(device.address, 8500);
  assert.deepEqual(pole.configs.at(-1), { hw: { led: { maxpwr: 8500, ins: [{ start: 0, len: 100, pin: [17], type: 22, maxpwr: 8500, ledma: 30 }] } } });
  setSettingsPin('1234');
  await setCurrentLimit(device.address, 5000);
  assert.equal(pole.configs.at(-1).pin, '1234');
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(request(device.address, '/json/cfg', {}), PinRequiredError);
});

test('Status helpers: clock at 1970 is invalid; AP and OTA security', () => {
  assert.equal(clockStatus({ time: '1970-1-1, 01:30:32' }).valid, false);
  assert.equal(clockStatus({ time: '2026-9-30, 21:10:00' }).valid, true);
  assert.equal(clockStatus({ time: '2106-2-7, 01:28:53' }).valid, false);
  assert.deepEqual(securityStatus({ ap: { pskl: 8 }, ota: { lock: false } }), { apPassword: true, apDefault: true, otaLocked: false });
});

test('Every theme builds a valid scene for every supported mount', () => {
  for (const total of [50, 100, 200, 400]) for (const theme of themes) {
    const scene = theme.build(total);
    assert.equal(segmentError(scene, total), '', `${theme.id} @ ${total}`);
    assert.ok(validScene(scene), `${theme.id} @ ${total}`);
    if (total >= 100) for (const faceBFromTop of [false, true]) {
      const faces = theme.build(total, { faceCount: 2, faceBFromTop });
      assert.equal(segmentError(faces, total), '', `${theme.id} @ ${total} two faces`);
      assert.ok(validScene(faces), `${theme.id} @ ${total} two faces`);
    }
  }
});

test('Two faces: the Colombian flag shows complete on each side', () => {
  const flag = themes.find(theme => theme.id === 'tricolor');
  const layout = scene => scene.segments.map((segment, i) => [segment.start, segment.stop, scene.faces[i].colors[0]]);
  assert.deepEqual(layout(flag.build(200, { faceCount: 2 })), [[0, 25, '#ce1126'], [25, 50, '#0038a8'], [50, 100, '#ffd400'], [100, 125, '#ce1126'], [125, 150, '#0038a8'], [150, 200, '#ffd400']]);
  // Face B wired from the top: its bands run downwards so yellow is still at the top from the ground.
  assert.deepEqual(layout(flag.build(200, { faceCount: 2, faceBFromTop: true })).slice(3), [[100, 150, '#ffd400'], [150, 175, '#0038a8'], [175, 200, '#ce1126']]);
});

test('Standalone Wi-Fi: own network always on, home network forgotten, pole restarts', async () => {
  assert.deepEqual(networkStatus({ ap: { ssid: 'WLED-AP', behav: 1 }, nw: { ins: [{ ssid: 'Casa' }] } }), { apName: 'WLED-AP', alwaysOn: false, homeNetwork: 'Casa' });
  assert.deepEqual(networkStatus({ ap: { ssid: 'LUMA-Poste1', behav: 2 }, nw: { ins: [{ ssid: 'Your_Network' }] } }), { apName: 'LUMA-Poste1', alwaysOn: true, homeNetwork: '' });
  const pole = fakePole();
  await assert.rejects(setStandaloneNetwork(device.address, { name: 'LUMA-Poste1', password: 'corta', keepHome: false }), /entre 8 y 63/);
  assert.equal(pole.configs.length, 0);
  await setStandaloneNetwork(device.address, { name: ' LUMA-Poste1 ', password: 'poste-seguro-1', keepHome: false });
  assert.deepEqual(pole.configs.at(-1), { ap: { ssid: 'LUMA-Poste1', psk: 'poste-seguro-1', behav: 2 }, nw: { ins: [{ ssid: 'Your_Network' }] }, rb: true });
  await setStandaloneNetwork(device.address, { name: 'Taller', password: '12345678', keepHome: true });
  assert.deepEqual(pole.configs.at(-1), { ap: { ssid: 'Taller', psk: '12345678', behav: 2 }, rb: true });
});

test('Current limit with one output per face: one shared limit for the supply', async () => {
  const pole = fakePole();
  pole.cfg.hw.led.ins = [{ start: 0, len: 100, pin: [17], type: 22, maxpwr: 0, ledma: 30, drv: 0 }, { start: 100, len: 100, pin: [18], type: 22, maxpwr: 0, ledma: 30, drv: 1 }];
  await setCurrentLimit(device.address, 12750);
  const sent = pole.configs.at(-1).hw.led;
  assert.equal(sent.maxpwr, 12750);
  assert.deepEqual(sent.ins.map(bus => [bus.pin[0], bus.maxpwr, bus.drv]), [[17, 0, 0], [18, 0, 1]], 'face B keeps the I2S driver');
  assert.equal(powerStatus({ leds: { pwr: 900 } }, { hw: { led: sent } }).limit, 12750);
});
