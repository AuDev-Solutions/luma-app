// Packs the production build into files the ESP32 can serve from its own filesystem:
//   luma.htm.gz        page with JS, CSS, Latin fonts and icon inlined (the pole serves .gz transparently)
//   luma.webmanifest   so the page can be added to the phone's home screen
//   luma-192.png / luma-512.png
// Run `npm run build` first (the `build:poste` script does both).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url);
const out = new URL('../dist-poste/', import.meta.url);
mkdirSync(out, { recursive: true });
const read = file => readFileSync(new URL(file, dist));
const assets = readdirSync(new URL('assets/', dist));

let html = read('index.html').toString();
const css = assets.find(file => file.endsWith('.css'));
const js = assets.find(file => file.endsWith('.js'));
if (!css || !js || assets.filter(file => file.endsWith('.js')).length !== 1) throw new Error('Expected exactly one JS bundle and one stylesheet in dist/assets.');

// Fonts: keep the Latin subsets (Spanish text) as data URIs, drop other scripts' @font-face blocks.
let styles = read(`assets/${css}`).toString();
styles = styles.replace(/@font-face\{[^}]*\}/g, block => {
  const font = block.match(/url\(\.\/([^)]+\.woff2)\)/)?.[1];
  if (!font || !/-latin(-ext)?-/.test(font)) return '';
  return block.replace(/url\(\.\/[^)]+\.woff2\)/, `url(data:font/woff2;base64,${read(`assets/${font}`).toString('base64')})`);
});

const script = read(`assets/${js}`).toString().replace(/<\/script/gi, '<\\/script');
const icon = `data:image/svg+xml;base64,${read('favicon.svg').toString('base64')}`;
html = html
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, () => `<script type="module">${script}</script>`)
  .replace(/<link rel="stylesheet" crossorigin href="[^"]+">/, () => `<style>${styles}</style>`)
  .replace('href="./favicon.svg"', `href="${icon}"`)
  .replace('href="./manifest.webmanifest"', 'href="luma.webmanifest"')
  .replace('href="./icon-192.png"', 'href="luma-192.png"');
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('An asset reference was not inlined.');

const manifest = JSON.parse(read('manifest.webmanifest'));
Object.assign(manifest, { start_url: 'luma.htm', scope: '/', icons: manifest.icons.map(item => ({ ...item, src: item.src.replace('icon-', 'luma-') })) });

const page = gzipSync(html, { level: 9 });
writeFileSync(new URL('luma.htm.gz', out), page);
writeFileSync(new URL('luma.webmanifest', out), JSON.stringify(manifest));
for (const size of [192, 512]) writeFileSync(new URL(`luma-${size}.png`, out), read(`icon-${size}.png`));
console.log(`luma.htm.gz ${(page.length / 1024).toFixed(1)} KB (sin comprimir ${(html.length / 1024).toFixed(1)} KB) → ${join('dist-poste', 'luma.htm.gz')}`);
