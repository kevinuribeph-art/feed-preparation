#!/usr/bin/env node
// Serves a given list of this Mac's photos to the mesa, so MESA.importarFotos can bring them to the tray untouched (D-061).
// Node 18 or later, no dependencies. Only 127.0.0.1, only GET of the listed files (never a folder), behind a token made for
// this run. It closes when every photo has been downloaded, or after a while with nobody asking.
//
//   node tools/servir-fotos.mjs <foto> [<foto>…]     the paths as arguments
//   node tools/servir-fotos.mjs < lista.txt          or one path per line on stdin
//   node tools/servir-fotos.mjs --minutos 30 …       minutes with no request before it closes (10 by default)
//
// Prints one line of JSON, the list MESA.importarFotos takes: [{url, name, lastModified, size}]. On failure it prints
// {error, ...} and exits 1. Then it stays open: run it in the background. When it closes it prints {cerrado, servidas, faltan}.
// A public page reaches this Mac only with Chrome's local network permission: Chrome asks once; the Claude app's built-in
// browser denies it without asking, so from there MESA.importarFotos gets an error and no photo arrives (D-061).

import { createServer } from 'node:http';
import { createReadStream, statSync, realpathSync, readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { randomBytes } from 'node:crypto';

const MESA_ORIGIN = 'https://kevinuribeph-art.github.io';
const LOCAL_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;   // the mesa's test copies (CLAUDE.md, «Probar»)
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const GRACE_MS = 2000;   // after the last photo: a late retry still gets through

function fail(error, more) { console.log(JSON.stringify({ error, ...more })); process.exit(1); }

const args = process.argv.slice(2);
let minutes = 10;
const at = args.indexOf('--minutos');
if (at >= 0) {
  minutes = Number(args[at + 1]);
  if (!(minutes > 0)) fail('--minutos espera un número de minutos');
  args.splice(at, 2);
}
const paths = args.length ? args : readFileSync(0, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
if (!paths.length) fail('sin fotos: pasa las rutas como argumentos o una por línea por stdin');

const bad = [], photos = [];
for (const p of paths) {
  try {
    const real = realpathSync(p), st = statSync(real), type = TYPES[extname(real).toLowerCase()];
    if (!st.isFile() || !st.size) bad.push({ path: p, error: 'no es un archivo con contenido' });
    else if (!type) bad.push({ path: p, error: 'formato no compatible (usa JPG, PNG o WebP)' });
    else photos.push({ real, name: basename(p), type, size: st.size, lastModified: Math.round(st.mtimeMs), done: false });
  } catch (e) { bad.push({ path: p, error: 'no se puede leer' }); }
}
if (bad.length) fail('hay rutas que no sirven: no se ha servido nada', { rutas: bad });

const token = randomBytes(24).toString('hex');
let idleTimer = null, closing = false;

function finish(reason) {
  if (closing) return;
  closing = true;
  clearTimeout(idleTimer);
  console.log(JSON.stringify({ cerrado: reason, servidas: photos.filter(f => f.done).length, faltan: photos.filter(f => !f.done).length }));
  server.close(() => process.exit(0));
  server.closeAllConnections();
}
const stillIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => finish('sin peticiones'), minutes * 60000); };

const server = createServer((req, res) => {
  stillIdle();
  const port = server.address().port, origin = req.headers.origin;
  // a name that resolves to this Mac from a web page (DNS rebinding) doesn't get in
  if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403); res.end(); return; }
  if (origin) {
    if (origin !== MESA_ORIGIN && !LOCAL_ORIGIN.test(origin)) { res.writeHead(403); res.end(); return; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length');
  }
  if (req.method === 'OPTIONS') {   // what Chrome asks before a public page reaches this Mac
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.headers['access-control-request-local-network'] === 'true') res.setHeader('Access-Control-Allow-Local-Network', 'true');
    res.writeHead(204); res.end(); return;
  }
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET, OPTIONS' }); res.end(); return; }
  const m = /^\/([0-9a-f]+)\/(\d+)$/.exec(new URL(req.url, 'http://x').pathname);
  const photo = m && m[1] === token ? photos[+m[2]] : null;
  if (!photo) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': photo.type, 'Content-Length': photo.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  const stream = createReadStream(photo.real);
  stream.on('error', () => res.destroy());
  res.on('finish', () => {
    photo.done = true;
    if (photos.every(f => f.done)) setTimeout(() => finish('todas servidas'), GRACE_MS);
  });
  stream.pipe(res);
});
process.on('SIGINT', () => finish('interrumpido'));
process.on('SIGTERM', () => finish('interrumpido'));
server.on('error', e => fail('no se puede escuchar en 127.0.0.1', { detalle: e.code }));
server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  stillIdle();
  console.log(JSON.stringify(photos.map((f, i) => ({ url: `http://127.0.0.1:${port}/${token}/${i}`, name: f.name, lastModified: f.lastModified, size: f.size }))));
});
