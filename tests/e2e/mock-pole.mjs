// Poste simulado (API JSON de WLED) compartido por las pruebas e2e y por scripts/capturas-manual.mjs.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function browserPath() {
  if (process.env.LUMA_CHROME) return process.env.LUMA_CHROME;
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const dir =
    existsSync(base) &&
    readdirSync(base)
      .filter(name => /^chromium-\d+$/.test(name))
      .sort()
      .at(-1);
  const exe = dir && join(base, dir, 'chrome-win64', 'chrome.exe');
  return exe && existsSync(exe) ? exe : undefined;
}

export const effects = ['Solid', 'Gradient', 'Running', 'Chase 2', 'Meteor', 'Fire 2012', 'Drip'];
export function createPole({ twoFaces = false, effects: fxdata = effects } = {}) {
  const pole = {
    state: {
      on: true,
      bri: 255,
      transition: 4,
      seg: [
        {
          id: 0,
          start: 0,
          stop: 100,
          on: true,
          bri: 166,
          fx: 1,
          sx: 71,
          ix: 15,
          pal: 3,
          col: [
            [164, 255, 194],
            [32, 140, 255],
            [0, 0, 0],
          ],
        },
      ],
    },
    presets: { 0: {} },
    cfg: {
      hw: { led: { ins: [{ start: 0, len: 100, pin: [17], type: 22, maxpwr: 0, ledma: 30 }] } },
      ap: { ssid: 'WLED-AP', pskl: 0, behav: 0 },
      nw: { ins: [{ ssid: 'Casa' }] },
      ota: { lock: false },
      if: { ntp: { en: false, tz: 0, offset: 0 } },
      timers: { ins: [] },
      def: { ps: 0 },
    },
    posts: [],
    cfgPosts: [],
    uploads: 0,
  };
  if (twoFaces) {
    // Real pole: face A on GPIO 17, face B on GPIO 3 (I2S), still showing one 200-LED strip.
    pole.state.seg[0].stop = 200;
    pole.cfg.hw.led.ins = [
      { start: 0, len: 100, pin: [17], type: 22, maxpwr: 0, ledma: 30, drv: 0 },
      { start: 100, len: 100, pin: [3], type: 22, maxpwr: 0, ledma: 30, drv: 1 },
    ];
  }
  // Like WLED, the LED count is where the last output ends: outputs that start at LED 1 overlap.
  pole.count = () => Math.max(...pole.cfg.hw.led.ins.map(bus => (bus.start ?? 0) + bus.len));
  pole.info = () => ({
    name: 'Poste de prueba',
    time: '2026-9-30, 20:00:00',
    leds: { count: pole.count(), maxseg: 16, pwr: 1200 },
  });
  pole.route = async route => {
    const request = route.request(),
      path = new URL(request.url()).pathname,
      method = request.method();
    if (path === '/presets.json') return route.fulfill({ json: pole.presets });
    if (path === '/upload') {
      // Multipart body: the JSON file is the only part.
      const body = request.postDataBuffer().toString('utf8');
      pole.presets = JSON.parse(body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1));
      pole.uploads++;
      return route.fulfill({ body: 'File Uploaded!', contentType: 'text/plain' });
    }
    if (path === '/json/cfg') {
      if (method === 'POST') {
        const body = request.postDataJSON();
        pole.cfgPosts.push(body);
        pole.cfg = {
          ...pole.cfg,
          ...body,
          hw: body.hw ? { ...pole.cfg.hw, ...body.hw, led: { ...pole.cfg.hw.led, ...body.hw.led } } : pole.cfg.hw,
        };
        // WLED re-initialises the outputs and trims segments past the new end (fixInvalidSegments).
        const total = pole.count();
        pole.state.seg = pole.state.seg
          .filter(item => item.start < total)
          .map(item => ({ ...item, stop: Math.min(item.stop, total) }));
        return route.fulfill({ json: { success: true } });
      }
      return route.fulfill({ json: pole.cfg });
    }
    if (path === '/json/state' && method === 'POST') {
      const body = request.postDataJSON();
      pole.posts.push(body);
      if (body.seg) pole.state = { ...pole.state, ...body, seg: body.seg.filter(item => item.stop !== 0) };
      else if (body.bri !== undefined || body.on !== undefined) pole.state = { ...pole.state, ...body };
      return route.fulfill({ json: pole.state });
    }
    if (path === '/json/fxdata') return route.fulfill({ json: fxdata });
    if (path === '/json/info') return route.fulfill({ json: pole.info() });
    if (path === '/json') return route.fulfill({ json: { state: pole.state, info: pole.info(), effects: fxdata } });
    return route.fulfill({ json: pole.state });
  };
  return pole;
}
