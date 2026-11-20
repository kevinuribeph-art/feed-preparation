#!/usr/bin/env node
// node tests/mesa-carpeta.mjs — la carpeta mesa/ que publica Cloudflare Pages tal cual en https://mesa.uribevisuals.studio
// (D-276; antes, la copia de tools/publicar-mesa.sh, D-260), sin red:
// MC1 lleva todo lo que piden index.html, el worker de las fotos (lo crea nube.js), el logo de la entrada y el monograma
// MC2 y lo que piden movil.html y su manifiesto (D-269)
// MC3 nada ajeno: solo las dos páginas, el manifiesto, los .js, kits/, las copias del portal y _headers; cada .js de la raíz
//     lo pide una página (o es el worker)
// MC4 sus cabeceras: la CSP del <meta> de index.html con el servidor del proyecto real (el de portal/config.js) en vez de
//     https://*.supabase.co, más frame-ancestors (D-277, S5); la de movil.html, la de index.html; las de seguridad para todo, con la
//     misma Permissions-Policy que el portal (S6); y ni mesa/_headers ni portal/_headers dejan ir a cualquier proyecto de Supabase
// MC5 las copias de lo que comparte con el portal (supa.js y 5 de marca/) son iguales byte a byte a las de portal/
// MC7 cada fallo se ve: falta el worker, un icono, algo de movil.html, entra algo ajeno, otra CSP en movil.html, una cabecera de
//     menos, el comodín de Supabase en una de las dos, sin Permissions-Policy, una copia distinta
import { mkdtempSync, readFileSync, existsSync, rmSync, cpSync, readdirSync, statSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MESA = join(RAIZ, 'mesa');
// Lo que la Mesa comparte con el portal: portal/ manda; mesa/portal/ lleva una copia en las mismas rutas públicas.
export const COMPARTIDOS = ['portal/supa.js', 'portal/marca/logo-ink.svg', 'portal/marca/logo-paper.svg', 'portal/marca/monograma.svg',
  'portal/marca/icono-32.png', 'portal/marca/icono-180.png'];
const SEGURIDAD = ['X-Frame-Options: DENY', 'X-Content-Type-Options: nosniff', 'Referrer-Policy: no-referrer',
  'Strict-Transport-Security: max-age=31536000', 'X-Robots-Tag: noindex, nofollow'];

let fallos = 0, n = 0;
const ok = (c, t, x) => { n++; console.log((c ? '  ok    ' : '  FALLO ') + t + (c || x == null ? '' : ' · ' + x)); if (!c) fallos++; };
const todos = d => { const out = []; for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) out.push(...todos(p).map(x => f + '/' + x)); else out.push(f); } return out; };
const leer = (d, f) => readFileSync(join(d, f), 'utf8');
const csp = h => (/Content-Security-Policy" content="([^"]*)/.exec(h) || [])[1];
const COMODIN = 'https://*.supabase.co';
const linea = (t, n) => (new RegExp('^\\s*' + n + ': (.*)$', 'm').exec(t) || [])[1];

// Los problemas de una carpeta de la Mesa (d) frente a su portal (p): una lista vacía es que está bien.
function revisar(d, p) {
  const mal = { MC1: [], MC2: [], MC3: [], MC4: [], MC5: [] };
  const html = leer(d, 'index.html');
  const iconos = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"?]+)/g)].map(m => m[1]);
  if (iconos.length !== 3) mal.MC1.push('index.html pide ' + iconos.length + ' iconos');
  const pide = [...html.matchAll(/src="([^"?]+)/g)].map(m => m[1]).concat(iconos, 'nube-fotos.js', 'portal/marca/logo-ink.svg',
    'portal/marca/logo-paper.svg', 'portal/marca/monograma.svg', 'kits/motor.js');
  for (const f of pide) if (!existsSync(join(d, f))) mal.MC1.push('falta ' + f);
  const mv = leer(d, 'movil.html');
  const man = (/<link rel="manifest" href="([^"?]+)/.exec(mv) || [])[1];
  if (!man || !existsSync(join(d, man))) mal.MC2.push('movil.html sin su manifiesto');
  const pideM = [...mv.matchAll(/src="([^"?]+)/g)].map(m => m[1])
    .concat([...mv.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"?]+)/g)].map(m => m[1]),
      man && existsSync(join(d, man)) ? JSON.parse(leer(d, man)).icons.map(i => i.src) : []);
  if (pideM.length < 12) mal.MC2.push('movil.html pide solo ' + pideM.length);
  for (const f of pideM) if (!existsSync(join(d, f))) mal.MC2.push('falta ' + f);
  const lista = todos(d), pedidos = new Set([...pide, ...pideM]);
  const permitido = f => /^(index|movil)\.html$/.test(f) || f === 'movil.webmanifest' || f === '_headers' || COMPARTIDOS.includes(f)
    || (/^[a-z-]+\.js$/.test(f) && pedidos.has(f)) || (/^kits\//.test(f) && !/\.md$/.test(f));
  for (const f of lista) if (!permitido(f)) mal.MC3.push('ajeno: ' + f);
  const cab = existsSync(join(d, '_headers')) ? leer(d, '_headers') : '', c = csp(html);
  const pcab = existsSync(join(p, 'portal', '_headers')) ? leer(join(p, 'portal'), '_headers') : '';
  const real = (/url: "(https:\/\/[a-z0-9]{10,40}\.supabase\.co)"/.exec(existsSync(join(p, 'portal', 'config.js')) ? leer(join(p, 'portal'), 'config.js') : '') || [])[1];
  if (!real) mal.MC4.push('portal/config.js sin el servidor del proyecto real');
  if (!c || !c.includes(COMODIN) || linea(cab, 'Content-Security-Policy') !== c.split(COMODIN).join(real) + "; frame-ancestors 'none'") mal.MC4.push('la CSP de _headers no es la del <meta> con el servidor real en vez del comodín, más frame-ancestors');
  if (cab.includes('*.supabase.co')) mal.MC4.push('mesa/_headers deja ir a cualquier proyecto de Supabase');
  if (!pcab || pcab.includes('*.supabase.co') || !['img-src', 'connect-src'].every(k => new RegExp(k + " [^;]*" + (real || '-').replace(/\./g, '\\.')).test(linea(pcab, 'Content-Security-Policy') || ''))) mal.MC4.push('portal/_headers sin el servidor real en img-src y connect-src, o con el comodín');
  if (!linea(cab, 'Permissions-Policy') || linea(cab, 'Permissions-Policy') !== linea(pcab, 'Permissions-Policy')) mal.MC4.push('mesa/_headers sin la Permissions-Policy del portal');
  if (csp(mv) !== c) mal.MC4.push('la CSP de movil.html no es la de index.html');
  if (!/^\/\*$/m.test(cab)) mal.MC4.push('_headers sin /*');
  for (const h of SEGURIDAD) if (!cab.includes(h)) mal.MC4.push('_headers sin ' + h);
  for (const f of COMPARTIDOS) if (!existsSync(join(d, f)) || !existsSync(join(p, f)) || !readFileSync(join(d, f)).equals(readFileSync(join(p, f)))) mal.MC5.push('copia distinta: ' + f);
  return mal;
}

const tmp = mkdtempSync(join(tmpdir(), 'mesa-carpeta-'));
try {
  const m = revisar(MESA, RAIZ);
  ok(!m.MC1.length, 'MC1 mesa/ lleva todo lo que pide index.html, el worker de las fotos, el logo de la entrada, el monograma, los iconos y los kits', m.MC1.join(', '));
  ok(!m.MC2.length, 'MC2 y lo que piden movil.html y su manifiesto', m.MC2.join(', '));
  ok(!m.MC3.length, 'MC3 nada ajeno (herramientas, pruebas, servidor, notas, .env, el resto del portal, un .js que nadie pide)', m.MC3.slice(0, 5).join(', '));
  ok(!m.MC4.length, 'MC4 las cabeceras: la CSP del <meta> más frame-ancestors, la misma en movil.html y las de seguridad para todo', m.MC4.join(', '));
  ok(!m.MC5.length, 'MC5 las copias del portal (supa.js y 5 de marca/) son iguales byte a byte a las de portal/', m.MC5.join(', '));

  // MC7 cada fallo se ve, sobre copias de mesa/ y de portal/
  const copia = nombre => { const d = join(tmp, nombre); cpSync(MESA, d, { recursive: true }); return d; };
  const POR = join(tmp, 'raiz'); for (const f of [...COMPARTIDOS, 'portal/_headers', 'portal/config.js']) { mkdirSync(dirname(join(POR, f)), { recursive: true }); cpSync(join(RAIZ, f), join(POR, f)); }
  let d = copia('sin-worker'); unlinkSync(join(d, 'nube-fotos.js'));
  ok(revisar(d, POR).MC1.includes('falta nube-fotos.js'), 'MC7 sin el worker de las fotos, MC1 lo dice');
  d = copia('sin-icono'); unlinkSync(join(d, 'portal', 'marca', 'icono-180.png'));
  ok(revisar(d, POR).MC1.includes('falta portal/marca/icono-180.png'), 'MC7 sin un icono, MC1 lo dice');
  d = copia('sin-movil'); unlinkSync(join(d, 'movil.js'));
  ok(revisar(d, POR).MC2.includes('falta movil.js'), 'MC7 sin algo que pide movil.html, MC2 lo dice');
  d = copia('ajenos'); mkdirSync(join(d, 'tools')); writeFileSync(join(d, 'tools', 'web.mjs'), '//'); writeFileSync(join(d, 'notas.md'), '#');
  writeFileSync(join(d, '.env'), 'X=1'); writeFileSync(join(d, 'suelto.js'), '//'); cpSync(join(RAIZ, 'portal', 'index.html'), join(d, 'portal', 'index.html'));
  const aj = revisar(d, POR).MC3;
  ok(['tools/web.mjs', 'notas.md', '.env', 'suelto.js', 'portal/index.html'].every(f => aj.includes('ajeno: ' + f)), 'MC7 algo ajeno (herramientas, notas, .env, un .js que nadie pide, otra página del portal), MC3 lo dice', aj.join(', '));
  d = copia('otra-csp'); writeFileSync(join(d, 'movil.html'), leer(d, 'movil.html').replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"));
  ok(revisar(d, POR).MC4.includes('la CSP de movil.html no es la de index.html'), 'MC7 otra CSP en movil.html, MC4 lo dice');
  d = copia('sin-cabecera'); writeFileSync(join(d, '_headers'), leer(d, '_headers').replace('  X-Frame-Options: DENY\n', ''));
  ok(revisar(d, POR).MC4.includes('_headers sin X-Frame-Options: DENY'), 'MC7 una cabecera de menos, MC4 lo dice');
  d = copia('comodin'); writeFileSync(join(d, '_headers'), leer(d, '_headers').replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, COMODIN));
  ok(revisar(d, POR).MC4.includes('mesa/_headers deja ir a cualquier proyecto de Supabase'), 'MC7 el comodín de Supabase en mesa/_headers, MC4 lo dice');
  d = copia('sin-permisos'); writeFileSync(join(d, '_headers'), leer(d, '_headers').replace(/^\s*Permissions-Policy: .*\n/m, ''));
  ok(revisar(d, POR).MC4.includes('mesa/_headers sin la Permissions-Policy del portal'), 'MC7 sin Permissions-Policy en mesa/_headers, MC4 lo dice');
  const POR2 = join(tmp, 'raiz2'); cpSync(POR, POR2, { recursive: true });
  writeFileSync(join(POR2, 'portal', '_headers'), leer(join(POR2, 'portal'), '_headers').replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, COMODIN));
  ok(revisar(MESA, POR2).MC4.some(x => /^portal\/_headers/.test(x)), 'MC7 el comodín de Supabase en portal/_headers, MC4 lo dice');
  for (const f of ['portal/supa.js', 'portal/marca/monograma.svg']) {
    d = copia('copia-' + f.replace(/\W/g, '-')); const x = readFileSync(join(d, f)); x[x.length - 1] ^= 1; writeFileSync(join(d, f), x);
    ok(revisar(d, POR).MC5.includes('copia distinta: ' + f), 'MC7 una copia del portal con un byte cambiado (' + f + '), MC5 lo dice');
  }
} catch (e) { ok(false, 'la prueba se cortó', (e && (e.stderr ? String(e.stderr) : e.stack)) || e); }
finally { rmSync(tmp, { recursive: true, force: true }); }
console.log(fallos ? `${fallos} fallos de ${n}` : `todo bien (${n})`);
process.exit(fallos ? 1 : 0);
