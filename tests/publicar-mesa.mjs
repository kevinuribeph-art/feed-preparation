#!/usr/bin/env node
// node tests/publicar-mesa.mjs — prueba de tools/publicar-mesa.sh (D-260), sin red: la copia que publica Cloudflare Pages en
// https://mesa.uribevisuals.studio lleva cada archivo que pide la página y el worker de las fotos, nada que no sea de la Mesa
// (herramientas, pruebas, servidor, notas, .env) y sus cabeceras con la misma CSP que el <meta> de index.html más
// frame-ancestors; y se para si a la página le falta algo.
// PM1 la copia · PM2 nada de más · PM3 las cabeceras · PM4 se para si falta un archivo
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync, cpSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
let fallos = 0, n = 0;
const ok = (c, t, x) => { n++; console.log((c ? '  ok    ' : '  FALLO ') + t + (c || x == null ? '' : ' · ' + x)); if (!c) fallos++; };
const tmp = mkdtempSync(join(tmpdir(), 'publicar-mesa-'));
const todos = d => { const out = []; for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) out.push(...todos(p).map(x => f + '/' + x)); else out.push(f); } return out; };
try {
  const D = join(tmp, 'salida');
  execFileSync('sh', [join(RAIZ, 'tools', 'publicar-mesa.sh'), D], { stdio: 'pipe' });
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
  const pide = [...html.matchAll(/src="([^"?]+)/g)].map(m => m[1]).concat('nube-fotos.js');
  const faltan = pide.filter(f => !existsSync(join(D, f)));
  ok(!faltan.length && existsSync(join(D, 'index.html')) && existsSync(join(D, 'kits', 'motor.js')), 'PM1 la copia lleva index.html, cada script que pide, el worker de las fotos y los kits', faltan.join(', '));
  const iguales = pide.filter(f => existsSync(join(D, f)) && readFileSync(join(D, f), 'utf8') === readFileSync(join(RAIZ, f), 'utf8'));
  ok(iguales.length === pide.length, 'PM1 los archivos van tal cual (los mismos bytes)', `${iguales.length} de ${pide.length}`);
  const lista = todos(D), malos = lista.filter(f => /^(tools|tests|servidor|\.claude|\.git)\//.test(f) || /\.md$/.test(f) || /(^|\/)\.env/.test(f) || /^portal\/(?!supa\.js$)/.test(f));
  ok(!malos.length, 'PM2 nada que no sea de la Mesa (herramientas, pruebas, servidor, notas, .env, el resto del portal)', malos.slice(0, 5).join(', '));
  const cab = readFileSync(join(D, '_headers'), 'utf8'), csp = (/Content-Security-Policy" content="([^"]*)/.exec(html) || [])[1];
  const linea = (/^\s*Content-Security-Policy: (.*)$/m.exec(cab) || [])[1];
  ok(csp && linea === csp + "; frame-ancestors 'none'", 'PM3 la CSP de las cabeceras es la del <meta> más frame-ancestors', linea);
  const quiere = ['X-Frame-Options: DENY', 'X-Content-Type-Options: nosniff', 'Referrer-Policy: no-referrer', 'Strict-Transport-Security: max-age=31536000', 'X-Robots-Tag: noindex'];
  const sin = quiere.filter(h => !cab.includes(h));
  ok(/^\/\*$/m.test(cab) && !sin.length, 'PM3 las cabeceras de seguridad para todo (/*)', sin.join(', '));
  // un repo al que le falta un script que pide la página: la copia se para
  const R2 = join(tmp, 'repo');
  for (const f of readdirSync(RAIZ)) if (/\.(js|html)$/.test(f)) cpSync(join(RAIZ, f), join(R2, f));
  cpSync(join(RAIZ, 'kits'), join(R2, 'kits'), { recursive: true }); cpSync(join(RAIZ, 'tools'), join(R2, 'tools'), { recursive: true });
  cpSync(join(RAIZ, 'portal', 'supa.js'), join(R2, 'portal', 'supa.js'));
  unlinkSync(join(R2, 'nube-fotos.js'));
  let paro = false, msg = '';
  try { execFileSync('sh', [join(R2, 'tools', 'publicar-mesa.sh'), join(tmp, 'salida2')], { stdio: 'pipe' }); } catch (e) { paro = e.status !== 0; msg = String(e.stderr || ''); }
  ok(paro && /falta nube-fotos\.js/.test(msg), 'PM4 si falta un archivo, la copia se para y lo dice (no publica una Mesa rota)', msg.trim());
} catch (e) { ok(false, 'la prueba se cortó', (e && (e.stderr ? String(e.stderr) : e.stack)) || e); }
finally { rmSync(tmp, { recursive: true, force: true }); }
console.log(fallos ? `${fallos} fallos de ${n}` : `todo bien (${n})`);
process.exit(fallos ? 1 : 0);
