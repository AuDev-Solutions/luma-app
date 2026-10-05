// Uploads the packed app (dist-poste/) to the pole's filesystem through its /upload endpoint.
// Usage: npm run instalar:poste -- 192.168.1.50 [PIN]
// Afterwards LUMA opens at http://<pole>/luma.htm on any phone connected to the pole, no PC needed.
import { readFileSync } from 'node:fs';

const [host, pin] = process.argv.slice(2);
if (!host) { console.error('Indica la dirección del poste: npm run instalar:poste -- 192.168.1.50'); process.exit(1); }
const base = host.includes('://') ? host.replace(/\/$/, '') : `http://${host}`;
const files = ['luma.htm.gz', 'luma.webmanifest', 'luma-192.png', 'luma-512.png'];
// The same page as the pole's home page: http://4.3.2.1 opens LUMA (WLED serves /index.htm from its
// filesystem before its built-in UI, wled_server.cpp handleStaticContent). Settings stay at /settings.
const uploads = [...files.map(file => [file, file]), ['luma.htm.gz', 'index.htm.gz']];

const info = await fetch(`${base}/json/info`, { signal: AbortSignal.timeout(6000) }).then(response => response.json());
const free = (info.fs?.t ?? 0) - (info.fs?.u ?? 0);
const size = uploads.reduce((sum, [file]) => sum + readFileSync(new URL(`../dist-poste/${file}`, import.meta.url)).length, 0) / 1024;
if (free && size > free) throw new Error(`El poste tiene ${free} KB libres y LUMA necesita ${size.toFixed(0)} KB.`);
// /upload checks the settings PIN per session.
if (pin) await fetch(`${base}/json/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });

for (const [file, target] of uploads) {
  const form = new FormData();
  form.append('data', new Blob([readFileSync(new URL(`../dist-poste/${file}`, import.meta.url))]), `/${target}`);
  const response = await fetch(`${base}/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  if (response.status === 401) throw new Error('El poste pide PIN de ajustes: npm run instalar:poste -- <ip> <PIN>');
  if (!response.ok) throw new Error(`No se pudo subir ${file} (${response.status}).`);
  console.log(`✓ ${target}`);
}

for (const path of ['/luma.htm', '/']) {
  const check = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10000) });
  const body = await check.text();
  if (!check.ok || !body.includes('LUMA')) throw new Error(`El poste no sirve LUMA en ${path} (${check.status}).`);
}
console.log(`LUMA instalada en el poste. Ábrela en ${base} (y en el Wi-Fi propio del poste: http://4.3.2.1).`);
