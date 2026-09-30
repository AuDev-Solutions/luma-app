import { request, hasSettingsPin } from './wled.js';

// Controller-side storage and automation: scenes saved on the pole (WLED presets), automatic mode
// (playlist), on/off schedule (timers), clock, current limit and security status.
//
// Presets are written by uploading presets.json (read → change LUMA's entries → upload) instead of
// `psave`, because `psave` through /json/state also applies the state: saving «Apagar» would switch
// the pole off. The upload invalidates WLED's preset cache (wled_server.cpp handleUpload).

export const OFF_PRESET = 250;
export const AUTO_PRESET = 249;
// «Aplicar al poste» keeps the scene here and makes it the boot scene and the schedule's default.
export const APPLIED_PRESET = 248;
const RESERVED = [OFF_PRESET, AUTO_PRESET, APPLIED_PRESET];

export async function readPresets(address) {
  const data = await request(address, '/presets.json');
  return data && typeof data === 'object' ? data : {};
}

export function listScenes(presets) {
  return Object.entries(presets)
    .filter(([id, preset]) => Number(id) > 0 && !RESERVED.includes(Number(id)) && preset && typeof preset === 'object' && Object.keys(preset).length)
    .map(([id, preset]) => ({ id: Number(id), name: preset.n || `Escena ${id}`, scene: preset.luma || null, playlist: !!preset.playlist }))
    .sort((a, b) => a.id - b.id);
}

export function freePresetId(presets) {
  for (let id = 1; id < APPLIED_PRESET; id++) if (!presets[id] || !Object.keys(presets[id]).length) return id;
  return null;
}

async function writePresets(address, presets) {
  // /upload checks the settings PIN per session: unlock first when the owner configured one.
  if (hasSettingsPin()) await request(address, '/json/state', {});
  const form = new FormData();
  form.append('data', new Blob([JSON.stringify(presets)], { type: 'application/json' }), '/presets.json');
  await request(address, '/upload', form);
}

// A scene preset stores the exact state LUMA would send plus the editable scene under `luma`
// (unknown keys are ignored by WLED when the preset is applied).
export async function saveScenePreset(address, { id, name, payload, scene }) {
  const presets = await readPresets(address);
  const target = id ?? freePresetId(presets);
  if (!target) throw new Error('El poste ya tiene el máximo de escenas guardadas. Elimina una para guardar otra.');
  const { v, ...state } = payload;
  presets[target] = { n: name.slice(0, 32), ...state, luma: scene };
  await writePresets(address, presets);
  return target;
}

export async function deletePreset(address, id) {
  const presets = await readPresets(address);
  delete presets[id];
  await writePresets(address, presets);
}

// Always stored switched on, so the schedule's «encender» really turns the lights on.
export async function rememberAppliedScene(address, { payload, scene }, config) {
  const presets = await readPresets(address);
  const { v, ...state } = payload;
  presets[APPLIED_PRESET] = { n: 'Escena aplicada', ...state, on: true, luma: scene };
  await writePresets(address, presets);
  if (config?.def?.ps !== APPLIED_PRESET) await setBootPreset(address, APPLIED_PRESET);
}

export const applyPreset = (address, id) => request(address, '/json/state', { ps: id });

// Automatic mode: WLED playlist cycling the chosen scenes. Durations are in tenths of a second.
export async function saveAutoMode(address, { ids, minutes, transition = 0.7 }) {
  if (ids.length < 2) throw new Error('Elige al menos dos escenas para el modo automático.');
  const presets = await readPresets(address);
  presets[AUTO_PRESET] = { n: 'Modo automático', on: true, playlist: { ps: ids, dur: ids.map(() => Math.round(minutes * 600)), transition: ids.map(() => Math.round(transition * 10)), repeat: 0, end: 0, r: false } };
  await writePresets(address, presets);
  await applyPreset(address, AUTO_PRESET);
}

// The ESP32 has no battery-backed clock: without internet (NTP) it restarts at 1970.
// WLED accepts the browser's time as a backup source ("time", json.cpp).
// The phone's UTC offset goes with it (fixed offset, tz 0) so the pole shows and schedules local time.
export const localOffsetSeconds = () => -new Date().getTimezoneOffset() * 60;
export async function syncClock(address, config) {
  if (config?.if?.ntp?.offset !== localOffsetSeconds() || (config?.if?.ntp?.tz ?? 0) !== 0) await request(address, '/json/cfg', { if: { ntp: { tz: 0, offset: localOffsetSeconds() } } });
  await request(address, '/json/state', { time: Math.floor(Date.now() / 1000) });
}

export function clockStatus(info) {
  const year = Number(String(info?.time || '').split('-')[0]);
  return { valid: year >= 2024, text: info?.time || 'desconocida' };
}

// hour 254 = sunset in WLED ≥ 16 (fcn_declare.h TH_SUNSET); minute is the offset (−120…120).
export function scheduleTimers({ onPreset, onMode, onTime, sunsetOffset, offEnabled, offTime }) {
  const [onHour, onMinute] = onTime.split(':').map(Number);
  const [offHour, offMinute] = offTime.split(':').map(Number);
  const timers = [{ en: 1, hour: onMode === 'sunset' ? 254 : onHour, min: onMode === 'sunset' ? Math.max(-120, Math.min(120, sunsetOffset)) : onMinute, macro: onPreset, dow: 127 }];
  if (offEnabled) timers.push({ en: 1, hour: offHour, min: offMinute, macro: OFF_PRESET, dow: 127 });
  return timers;
}

export async function saveSchedule(address, schedule) {
  const presets = await readPresets(address);
  if (!presets[OFF_PRESET]) { presets[OFF_PRESET] = { n: 'Apagar', on: false }; await writePresets(address, presets); }
  // Fixed UTC offset (tz 0 + offset) avoids depending on WLED's short list of named time zones.
  await request(address, '/json/cfg', {
    if: { ntp: { en: true, tz: 0, offset: schedule.utcOffsetSeconds, ...(schedule.onMode === 'sunset' ? { lt: schedule.latitude, ln: schedule.longitude } : {}) } },
    timers: { ins: scheduleTimers(schedule) },
  });
  await request(address, '/json/state', { time: Math.floor(Date.now() / 1000) });
}

export const clearSchedule = address => request(address, '/json/cfg', { timers: { ins: [] } });

export function readSchedule(config) {
  const timers = config?.timers?.ins || [];
  const on = timers.find(timer => timer.macro !== OFF_PRESET && timer.en);
  const off = timers.find(timer => timer.macro === OFF_PRESET && timer.en);
  const pad = value => String(value).padStart(2, '0');
  return {
    enabled: !!on,
    onPreset: on?.macro,
    onMode: on?.hour === 254 ? 'sunset' : 'time',
    onTime: on && on.hour < 24 ? `${pad(on.hour)}:${pad(on.min)}` : '18:30',
    sunsetOffset: on?.hour === 254 ? on.min : 0,
    offEnabled: !!off,
    offTime: off ? `${pad(off.hour)}:${pad(off.min)}` : '23:00',
    latitude: config?.if?.ntp?.lt || 0,
    longitude: config?.if?.ntp?.ln || 0,
  };
}

// Boot scene: what the pole shows after a power cut.
export const setBootPreset = (address, id) => request(address, '/json/cfg', { def: { ps: id, on: true } });

// Current limit (WLED ABL). 0 means unlimited; LUMA never guesses the power-supply rating.
export function powerStatus(info, config) {
  const bus = config?.hw?.led?.ins?.[0];
  return { estimate: info?.leds?.pwr ?? 0, limit: bus?.maxpwr ?? info?.leds?.maxpwr ?? 0, perLed: bus?.ledma ?? 55 };
}

export async function setCurrentLimit(address, milliamps) {
  const config = await request(address, '/json/cfg');
  const outputs = config?.hw?.led?.ins;
  if (!Array.isArray(outputs) || outputs.length !== 1) throw new Error('El controlador tiene varias salidas. Ajusta el límite en su configuración de LEDs.');
  await request(address, '/json/cfg', { hw: { led: { maxpwr: milliamps, ins: [{ ...outputs[0], maxpwr: milliamps }] } } });
}

export function securityStatus(config) {
  return { apPassword: (config?.ap?.pskl ?? 0) > 0, apDefault: (config?.ap?.pskl ?? 0) === 8, otaLocked: !!config?.ota?.lock };
}
