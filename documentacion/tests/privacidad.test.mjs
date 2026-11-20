import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
// Se revisa todo el repositorio luma-app (app y documentación): lo que está en git es lo que se publica.
const repositorio = execFileSync('git', ['-C', raiz, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
// Este archivo nombra los patrones prohibidos; no se revisa a sí mismo.
const esteArchivo = resolve(fileURLToPath(import.meta.url));
// Palabras privadas propias de cada equipo (redes, usuarios): una por línea en .privado/palabras.txt,
// que no se sube al repositorio. Sin ese archivo solo se revisan los patrones generales.
const archivoLocal = join(raiz, '.privado', 'palabras.txt');
const escapar = texto => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const locales = existsSync(archivoLocal)
  ? readFileSync(archivoLocal, 'utf8').split(/\r?\n/).map(linea => linea.trim()).filter(Boolean).map(escapar)
  : [];
const prohibido = new RegExp(['@gmail\\.com', '"psk"\\s*:', ...locales].join('|'), 'i');

// Archivos versionados y los nuevos que aún no se han añadido (sin los ignorados por .gitignore).
const archivos = execFileSync('git', ['-C', repositorio, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .map(nombre => ({ nombre, ruta: resolve(repositorio, nombre) }));

test('ningún archivo del repositorio contiene datos privados', () => {
  assert.ok(archivos.length > 0);
  for (const { nombre, ruta } of archivos) {
    if (ruta === esteArchivo || !existsSync(ruta) || /\.(png|jpe?g|pdf|zip|bin|exe|woff2?|gz|ico)$/i.test(nombre)) continue;
    assert.doesNotMatch(readFileSync(ruta, 'utf8'), prohibido, `Dato privado en ${nombre}`);
  }
});
