#!/usr/bin/env node
// El correo de bienvenida del portal y su envío (tools/correo.mjs, D-273), sin red: el SMTP contra un servidor simulado en
// 127.0.0.1. Node 18+, sin dependencias.   node tests/correo.mjs
import net from 'node:net';
import { bienvenida, mensaje, enviarSmtp, cabecera, CORREO_OK } from '../tools/correo.mjs';

let fallos = 0, n = 0;
const ok = (c, txt, extra) => { n++; if (c) console.log('  ok   ' + txt); else { fallos++; console.log('  FALLO ' + txt + (extra ? ' · ' + String(extra).slice(0, 300) : '')); } };
const tira = async (f, re) => { try { await f(); return false; } catch (e) { return re.test(e.message) ? e : false; } };

// Las partes de un mensaje, decodificadas.
function partes(raw) {
  const cab = raw.slice(0, raw.indexOf('\r\n\r\n'));
  const parte = tipo => { const m = raw.match(new RegExp(`Content-Type: ${tipo.replace('/', '\\/')}[^\\r]*\\r\\n(?:[A-Za-z-]+: [^\\r]*\\r\\n)*\\r\\n([A-Za-z0-9+/=\\r\\n]+?)\\r\\n--`)); return m ? Buffer.from(m[1].replace(/\s+/g, ''), 'base64') : null; };
  const t = parte('text/plain'), h = parte('text/html');
  return { cab, texto: t && t.toString('utf8'), html: h && h.toString('utf8'), png: parte('image/png') };
}
const decodifica = h => h.replace(/\r\n /g, '').replace(/=\?UTF-8\?B\?([^?]*)\?=/g, (_, b) => Buffer.from(b, 'base64').toString('utf8'));

console.log('El texto');
let m = bienvenida({ nombre: 'Ana', correo: 'ana@ejemplo.test', clientes: ['Cliente Norte'] });
ok(m.asunto === 'Ya puedes ver tu calendario de Cliente Norte', 'asunto con el cliente', m.asunto);
ok(/Hola, Ana\./.test(m.texto) && /ana@ejemplo\.test y pulsa «Enviarme el código»/.test(m.texto) && /6 cifras/.test(m.texto) && /No hay contraseña/.test(m.texto), 'saludo, su correo, el botón del portal y el código', m.texto);
ok(/clientes\.uribevisuals\.studio/.test(m.texto) && /«Aprobar» o «Pedir cambios»/.test(m.texto) && !/cambias entre/.test(m.texto), 'la dirección, qué puede hacer y, con un cliente, sin «cambias entre»', m.texto);
ok(m.html.includes('href="https://clientes.uribevisuals.studio"') && m.html.includes('Entrar en tu calendario') && m.html.includes('color-scheme" content="light"'), 'el HTML: el botón al portal y siempre en claro');
ok(!/text-transform:\s*uppercase/i.test(m.html), 'sin antetítulos en mayúsculas');
// El manual de marca (D-273): el logo horizontal con monograma como imagen dentro del correo (Content-ID, nunca de fuera), con su
// área de respeto y «Uribe Visuals» si no se ve; Schibsted Grotesk del portal con Arial de reserva (y Arial a la fuerza en Outlook);
// pesos 400 y 800 (700 solo en el enlace de la firma del manual) y la firma de email del manual.
const cab1 = m.html.slice(0, m.html.indexOf('<h1'));
ok(/<img src="cid:logo@uribevisuals\.studio" width="160" height="63" alt="Uribe Visuals"/.test(cab1) && (m.html.match(/<img\b/g) || []).length === 1, 'el logo del manual, una imagen dentro del correo, con «Uribe Visuals» si no se ve', cab1.slice(-500));
ok(/margin:64px auto/.test(cab1), 'con su área de respeto (la altura del cuadrado)');
ok(m.imagenes.length === 1 && m.imagenes[0].cid === 'logo@uribevisuals.studio' && m.imagenes[0].datos.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && m.imagenes[0].datos.readUInt32BE(16) === 480 && m.imagenes[0].datos.readUInt32BE(20) === 190, 'el logo es un PNG de 480 × 190 (a 3× de 160 × 63)');
const familias = [...m.html.matchAll(/style="[^"]*"/g)].flatMap(x => [...x[0].matchAll(/font-family:([^;"]+)/g)].map(y => y[1]));   // en cada style="…"
ok(familias.length > 8 && familias.every(x => x === "'Schibsted Grotesk',Arial,Helvetica,sans-serif"), 'todo en Schibsted Grotesk con Arial de reserva', [...new Set(familias)].join(' | '));
ok(m.html.includes("src:url(https://clientes.uribevisuals.studio/fuentes/SchibstedGrotesk-Regular.woff2) format('woff2')") && m.html.includes("font-weight:800;src:url(https://clientes.uribevisuals.studio/fuentes/SchibstedGrotesk-ExtraBold.woff2)"), 'Schibsted 400 y 800 desde el portal (donde el correo carga tipografías)');
ok(/<!--\[if mso\]><style>[^<]*font-family:Arial,Helvetica,sans-serif !important[^<]*<\/style><!\[endif\]-->/.test(m.html), 'Outlook, en Arial a la fuerza (si no, cae en Times)');
const pesos = [...m.html.matchAll(/font-weight:(\d+)/g)].map(x => x[1]);
ok(pesos.every(w => w === '400' || w === '800' || w === '700') && pesos.filter(w => w === '700').length === 1 && /font-weight:700">uribevisuals\.studio/.test(m.html), 'solo pesos 400 y 800 (el 700, solo en el enlace de la firma)', pesos.join());
ok(/>Kevin Uribe<\/div>/.test(m.html) && /Creative Director · Uribe Visuals/.test(m.html) && /href="https:\/\/uribevisuals\.studio"/.test(m.html) && /Kevin Uribe\nCreative Director · Uribe Visuals\nIbiza · uribevisuals\.studio/.test(m.texto), 'la firma de email del manual, también en el texto');
ok(!/\b(calidad|pasión|creatividad|colaboración|soluciones|elevar|alma|experiencias|alta gama|algo más|apasionados)\b/i.test(m.texto), 'sin el vocabulario prohibido del manual');
{ // un esporádico (D-378): sus sesiones, sin calendario ni feed
  const s = bienvenida({ nombre: 'Eva', correo: 'eva@ejemplo.test', clientes: ['Taller Este'], sesiones: true });
  ok(s.asunto === 'Ya puedes ver tus sesiones con Uribe Visuals', 'el asunto de un esporádico: ' + s.asunto);
  ok(/sesiones de Taller Este/.test(s.texto) && /En cada sesión, tus comentarios/.test(s.texto) && !/calendario de Instagram|feed|Aprobar/.test(s.texto), 'su texto habla de sus sesiones');
  ok(/Tus sesiones y su calendario/.test(s.html) && !/El feed/.test(s.html), 'y su HTML');
}
m = bienvenida({ nombre: 'Bea', correo: 'b@ejemplo.test', clientes: ['Cliente Norte', 'Cliente Sur'] });
ok(m.asunto === 'Ya puedes ver tu calendario de Cliente Norte y Cliente Sur' && /los calendarios de Cliente Norte y Cliente Sur/.test(m.texto) && /cambias entre Cliente Norte y Cliente Sur/.test(m.texto), 'con dos clientes, los dos y cómo cambiar', m.texto);
m = bienvenida({ nombre: '<b>Eva</b> & "co"', correo: 'e@ejemplo.test', clientes: ['A<script>'] });
ok(!m.html.includes('<b>Eva') && !m.html.includes('A<script>') && m.html.includes('&lt;b&gt;Eva&lt;/b&gt; &amp; &quot;co&quot;'), 'nombre y cliente escapados en el HTML');
ok(await tira(() => bienvenida({ nombre: 'X', correo: 'x@y.z', clientes: [] }), /faltan/), 'sin clientes no hay correo');

console.log('El mensaje');
const raw = mensaje({ de: 'acceso@ejemplo.test', para: 'ana@ejemplo.test', responderA: 'kevin@ejemplo.test', ...bienvenida({ nombre: 'Íñigo', correo: 'ana@ejemplo.test', clientes: ['Café Ñandú'] }) });
ok(!/[^\r]\n/.test(raw) && raw.split('\r\n').every(l => l.length <= 998), 'todo con CRLF y líneas de menos de 998');
const p = partes(raw);
ok(/^From: Uribe Visuals <acceso@ejemplo\.test>$/m.test(p.cab) && /^To: <ana@ejemplo\.test>$/m.test(p.cab) && /^Reply-To: <kevin@ejemplo\.test>$/m.test(p.cab), 'De, Para y Responder a', p.cab);
ok(/^Date: .+ \+0000$/m.test(p.cab) && /^Message-ID: <[0-9a-f]{32}@ejemplo\.test>$/m.test(p.cab) && /^MIME-Version: 1\.0$/m.test(p.cab), 'fecha, id y MIME', p.cab);
const asunto = decodifica((p.cab.match(/^Subject: ([\s\S]*?)\r\n(?=[A-Z])/m) || [])[1] || '');
ok(asunto === 'Ya puedes ver tu calendario de Café Ñandú', 'el asunto con tildes vuelve igual', asunto);
ok(p.texto && p.texto.includes('Hola, Íñigo.') && p.html && p.html.includes('Hola, Íñigo.'), 'texto y HTML vuelven igual (UTF-8)');
ok(/^Content-Type: multipart\/related; type="multipart\/alternative"; boundary="uvr-[0-9a-f]+"$/m.test(p.cab) && /\r\nContent-ID: <logo@uribevisuals\.studio>\r\nContent-Disposition: inline; filename="uribe-visuals\.png"\r\n/.test(raw), 'el logo va dentro, con su Content-ID y en línea', p.cab);
ok(p.png && p.png.equals(bienvenida({ nombre: 'X', correo: 'x@y.zz', clientes: ['Z'] }).imagenes[0].datos), 'y llega entero');
ok(await tira(() => mensaje({ de: 'a@b.cd', para: 'c@d.ef', asunto: 'x', texto: 'x', html: 'x', imagenes: [{ cid: 'a>b', tipo: 'image/png', nombre: 'x.png', datos: Buffer.alloc(1) }] }), /imagen rara/), 'una imagen con un Content-ID raro no entra');
ok(!/Reply-To/.test(mensaje({ de: 'a@b.cd', para: 'c@d.ef', asunto: 'x', texto: 'x', html: 'x' })), 'sin «Responder a» si no hay');
ok(await tira(() => mensaje({ de: 'a@b.cd', para: 'c@d.ef\r\nBcc: otro@x.y', asunto: 'x', texto: 'x', html: 'x' }), /raro/), 'un correo con salto de línea no entra (sin inyección de cabeceras)');
ok(await tira(() => cabecera('a\r\nBcc: x@y.z'), /saltos/), 'ni un asunto con salto de línea');
ok(!CORREO_OK.test('a b@c.de') && !CORREO_OK.test('a@b') && CORREO_OK.test('nombre@cliente-norte.test'), 'qué es un correo');

console.log('El envío (SMTP simulado en 127.0.0.1)');
function servidor(guion = {}) {
  const vio = { lineas: [], datos: '' };
  const srv = net.createServer(s => {
    if (guion.mudo) return;
    let buf = '', enDatos = false;
    s.on('error', e => { vio.error = e.code; });
    s.write('220 simulado ESMTP\r\n');
    s.on('data', d => {
      buf += d.toString('utf8');
      if (enDatos) {
        const i = buf.indexOf('\r\n.\r\n'); if (i < 0) return;
        vio.datos = buf.slice(0, i + 2); buf = buf.slice(i + 5); enDatos = false;
        s.write(guion.rechazaDatos ? '554 rechazado\r\n' : '250 2.0.0 Ok: en cola\r\n');
      }
      for (let i; !enDatos && (i = buf.indexOf('\r\n')) >= 0;) {
        const l = buf.slice(0, i); buf = buf.slice(i + 2); vio.lineas.push(l);
        if (/^EHLO /.test(l)) s.write('250-simulado\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        else if (/^AUTH PLAIN /.test(l)) { if (guion.cortaEnAuth) { s.destroy(); return; } s.write(guion.malaClave ? '535 5.7.8 Error: authentication failed\r\n' : '235 2.7.0 Ok\r\n'); }
        else if (/^MAIL FROM/.test(l)) s.write('250 Ok\r\n');
        else if (/^RCPT TO/.test(l)) s.write('250 Ok\r\n');
        else if (l === 'DATA') { s.write('354 Adelante\r\n'); enDatos = true; }
        else if (l === 'QUIT') { if (guion.cortaEnQuit) { s.destroy(); return; } s.write('221 Adiós\r\n'); s.end(); }
      }
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, vio, port: srv.address().port })));
}
const base = { host: '127.0.0.1', seguro: false, usuario: 'acceso@ejemplo.test', clave: 'clave-secreta-de-prueba', de: 'acceso@ejemplo.test', para: 'ana@ejemplo.test' };

let S = await servidor();
let r = await enviarSmtp({ ...base, port: S.port, datos: raw + '.linea que empieza por punto\r\n' }).catch(e => e);
ok(r && r.aceptado && /en cola/.test(r.aceptado), 'lo entrega y dice lo que contesta el servidor', r && (r.message || JSON.stringify(r)));
const auth = (S.vio.lineas.find(l => /^AUTH PLAIN /.test(l)) || '').slice(11);
ok(Buffer.from(auth, 'base64').toString('utf8') === '\0acceso@ejemplo.test\0clave-secreta-de-prueba', 'AUTH PLAIN con usuario y clave');
ok(S.vio.lineas.includes('MAIL FROM:<acceso@ejemplo.test>') && S.vio.lineas.includes('RCPT TO:<ana@ejemplo.test>') && S.vio.lineas.includes('QUIT'), 'remitente, destinatario y QUIT', S.vio.lineas.join(' | '));
ok(S.vio.lineas.some(l => /^EHLO ejemplo\.test$/.test(l)), 'EHLO con el dominio (respuesta de varias líneas leída)');
ok(S.vio.datos.includes('\r\n..linea que empieza por punto\r\n') && partes(S.vio.datos).texto.includes('Hola, Íñigo.'), 'la línea con punto se dobla y el mensaje llega entero');
S.srv.close();

S = await servidor({ malaClave: true });
r = await enviarSmtp({ ...base, port: S.port, datos: raw }).then(() => null, e => e);
ok(r && /usuario o clave del buzón/.test(r.message) && !r.message.includes('clave-secreta-de-prueba') && !r.message.includes(Buffer.from('\0acceso@ejemplo.test\0clave-secreta-de-prueba').toString('base64')), 'una clave mala se dice sin enseñar la clave', r && r.message);
ok(!S.vio.lineas.some(l => /^MAIL FROM/.test(l)), 'y no sigue');
S.srv.close();

S = await servidor({ rechazaDatos: true });
r = await enviarSmtp({ ...base, port: S.port, datos: raw }).then(() => null, e => e);
ok(r && /envío: el servidor contestó 554/.test(r.message), 'un rechazo del mensaje es un error', r && r.message);
S.srv.close();

S = await servidor({ cortaEnQuit: true });
r = await enviarSmtp({ ...base, port: S.port, datos: raw }).catch(e => e);
ok(r && r.aceptado && /en cola/.test(r.aceptado), 'aceptado y cortado al despedirse (sin 221): salió, no es un fallo', r && (r.message || JSON.stringify(r)));
S.srv.close();

S = await servidor({ cortaEnAuth: true });
r = await enviarSmtp({ ...base, port: S.port, datos: raw }).then(() => null, e => e);
ok(r && /cerró la conexión \(en «usuario o clave del buzón»\)/.test(r.message), 'un corte antes de aceptarlo es un fallo y dice en qué paso', r && r.message);
S.srv.close();

S = await servidor({ mudo: true });
r = await enviarSmtp({ ...base, port: S.port, datos: raw, timeout: 300 }).then(() => null, e => e);
ok(r && /no contesta/.test(r.message), 'un servidor mudo se deja a los pocos segundos', r && r.message);
S.srv.close();

ok(await tira(() => enviarSmtp({ ...base, host: 'smtp.ejemplo.test', port: 25, datos: raw }), /solo contra 127\.0\.0\.1/), 'sin TLS, nunca fuera de 127.0.0.1');
ok(await tira(() => enviarSmtp({ ...base, port: 1, clave: '', datos: raw }), /faltan/), 'sin clave no lo intenta');

console.log(fallos ? `\n${fallos} FALLO(S) de ${n}` : `\nTodo en orden: ${n} de ${n}`);
process.exit(fallos ? 1 : 0);
