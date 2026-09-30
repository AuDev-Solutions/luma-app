// Uploads the packed app (dist-poste/) to the pole's filesystem through its /upload endpoint.
// Usage: npm run instalar:poste -- 192.168.1.50 [PIN]
// Afterwards LUMA opens at http://<pole>/luma.htm on any phone connected to the pole, no PC needed.
import { readFileSync } from 'node:fs';

const [host, pin] = process.argv.slice(2);
if (!host) { console.error('Indica la dirección del poste: npm run instalar:poste -- 192.168.1.50'); process.exit(1); }
const base = host.includes('://') ? host.replace(/\/$/, '') : `http://${host}`;
const files = ['luma.htm.gz', 'luma.webmanifest', 'luma-192.png', 'luma-512.png'];

const info = await fetch(`${base}/json/info`, { signal: AbortSignal.timeout(6000) }).then(response => response.json());
const free = (info.fs?.t ?? 0) - (info.fs?.u ?? 0);
const size = files.reduce((sum, file) => sum + readFileSync(new URL(`../dist-poste/${file}`, import.meta.url)).length, 0) / 1024;
if (free && size > free) throw new Error(`El poste tiene ${free} KB libres y LUMA necesita ${size.toFixed(0)} KB.`);
// /upload checks the settings PIN per session.
if (pin) await fetch(`${base}/json/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });

for (const file of files) {
  const form = new FormData();
  form.append('data', new Blob([readFileSync(new URL(`../dist-poste/${file}`, import.meta.url))]), `/${file}`);
  const response = await fetch(`${base}/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  if (response.status === 401) throw new Error('El poste pide PIN de ajustes: npm run instalar:poste -- <ip> <PIN>');
  if (!response.ok) throw new Error(`No se pudo subir ${file} (${response.status}).`);
  console.log(`✓ ${file}`);
}

const check = await fetch(`${base}/luma.htm`, { signal: AbortSignal.timeout(10000) });
const body = await check.text();
if (!check.ok || !body.includes('LUMA')) throw new Error(`El poste no sirve LUMA correctamente (${check.status}).`);
console.log(`LUMA instalada en ${info.name || 'el poste'}. Ábrela en ${base}/luma.htm (y en el Wi-Fi propio del poste: http://4.3.2.1/luma.htm).`);
