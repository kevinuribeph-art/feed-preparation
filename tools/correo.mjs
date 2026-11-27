// El correo de bienvenida del portal de clientes y su envío (D-273). Node 18+, sin dependencias.
// Lo usa `node tools/web.mjs alta …`; no se ejecuta solo. Nada de aquí lleva datos de clientes: el nombre, el correo y los
// clientes llegan de la orden y del servidor.
//   bienvenida({ nombre, correo, clientes, sesiones })   el asunto, el texto y el HTML (los clientes, por su nombre en el portal;
//                                              sesiones: todos son esporádicos, D-378: sus sesiones, no un calendario)
//   mensaje({ …, asunto, texto, html })        el correo entero (RFC 5322, MIME texto + HTML, en base64, con CRLF)
//   enviarSmtp({ host, port, usuario, clave, de, para, datos })   lo entrega por SMTP con TLS (465) y AUTH PLAIN
import tls from 'node:tls';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PORTAL = 'https://clientes.uribevisuals.studio';
export const CORREO_OK = /^[^@\s<>"',;()\\]+@[^@\s<>"',;()\\]+\.[^@\s<>"',;()\\]+$/;   // también cierra el paso a saltos de línea
// El logo horizontal con monograma del manual (portal/marca/logo-ink.svg a 480 × 190, fondo transparente), dentro del propio correo
// (Content-ID): no se descarga de fuera, así que ningún cliente de correo lo bloquea como imagen remota.
export const LOGO_CID = 'logo@uribevisuals.studio';
let logoPng = null;
const logo = () => logoPng || (logoPng = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'correo-logo.png')));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lista = ns => ns.length === 1 ? ns[0] : ns.slice(0, -1).join(', ') + ' y ' + ns[ns.length - 1];

// El texto, en español (decisión de Kevin, 20/11/2026), con el manual de marca de Uribe Visuals: el logo horizontal con
// monograma como imagen dentro del correo, con su área de respeto (la altura del cuadrado por los cuatro lados) y «Uribe Visuals»
// como texto alternativo; Schibsted Grotesk (la de la marca, servida desde el portal) donde el correo carga tipografías (Apple Mail,
// iPhone) y Arial donde no (Gmail, Outlook: el manual pide Arial en el correo); pesos 400 y 800 y la firma de email del manual.
// Sin antetítulos.
export function bienvenida({ nombre, correo, clientes, sesiones = false }) {
  if (!nombre || !correo || !Array.isArray(clientes) || !clientes.length) throw new Error('faltan el nombre, el correo o los clientes');
  const varios = clientes.length > 1, de = lista(clientes);
  // un esporádico (D-378): sus sesiones, sin calendario de Instagram ni feed
  const asunto = sesiones ? 'Ya puedes ver tus sesiones con Uribe Visuals' : `Ya puedes ver tu calendario de ${de}`;
  const intro = `Hola, ${nombre}. Ya tienes tu apartado en la web de Uribe Visuals. Ahí ves ` +
    (sesiones ? `cómo preparamos las sesiones de ${de}.` : varios ? `los calendarios de ${de} antes de que se publiquen.` : `el calendario de ${de} antes de que se publique.`);
  const pasos = [
    `Abre ${PORTAL.replace('https://', '')}.`,
    `Escribe ${correo} y pulsa «Enviarme el código».`,
    'Escribe el código de 6 cifras que te llega por correo. Vale 10 minutos. No hay contraseña.',
  ];
  const ves = sesiones ? [
    'Tus sesiones y su calendario, con lo que preparamos para cada una.',
    'En cada sesión, tus comentarios.',
    'Las tareas y notas que compartimos contigo, y tus pagos.',
    ...(varios ? [`Arriba, junto al logo, cambias entre ${de}.`] : []),
  ] : [
    'El feed y el calendario de cada mes, con la foto, el texto y la fecha de cada publicación.',
    'En cada publicación, «Aprobar» o «Pedir cambios», y comentarios.',
    'Por qué este calendario, tus pagos y cómo fue el mes anterior.',
    ...(varios ? [`Arriba, junto al logo, cambias entre ${de}.`] : []),
  ];
  const texto = [
    intro, '',
    'Cómo entrar', ...pasos.map((p, i) => `${i + 1}. ${p}`), '',
    'Qué encontrarás', ...ves.map(v => `- ${v}`), '',
    `Entrar: ${PORTAL}`, '',
    'Si algo no va, responde a este correo.', '',
    'Kevin Uribe', 'Creative Director · Uribe Visuals', 'Ibiza · uribevisuals.studio', '',
    `Privacidad: ${PORTAL}/privacidad · Aviso legal: ${PORTAL}/aviso-legal`,
  ].join('\n');

  // Tablas y estilos en línea: es lo que leen Gmail, Outlook y Apple Mail. Siempre en claro (color-scheme: light).
  const F = "font-family:'Schibsted Grotesk',Arial,Helvetica,sans-serif";
  const p = t => `<p style="margin:0 0 16px;${F};font-size:15px;line-height:23px;font-weight:400;color:#4A4038">${t}</p>`;
  const h2 = t => `<p style="margin:28px 0 10px;${F};font-size:16px;line-height:22px;font-weight:800;letter-spacing:-0.3px;color:#16110E">${t}</p>`;
  const li = (t, marca) => `<tr><td valign="top" style="${F};font-size:15px;line-height:23px;color:#A0472F;font-weight:800;width:24px;padding:0 0 8px">${marca}</td><td style="${F};font-size:15px;line-height:23px;font-weight:400;color:#4A4038;padding:0 0 8px">${t}</td></tr>`;
  const tabla = filas => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">${filas}</table>`;
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(asunto)}</title>
<style>@font-face{font-family:'Schibsted Grotesk';font-style:normal;font-weight:400;src:url(${PORTAL}/fuentes/SchibstedGrotesk-Regular.woff2) format('woff2')}
@font-face{font-family:'Schibsted Grotesk';font-style:normal;font-weight:800;src:url(${PORTAL}/fuentes/SchibstedGrotesk-ExtraBold.woff2) format('woff2')}</style>
<!--[if mso]><style>body,table,td,div,p,a,h1,span{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#EDE6DC">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Entra con tu correo y un código de 6 cifras. Sin contraseña.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE6DC"><tr><td align="center" style="padding:0 16px 40px">
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:64px auto"><tr>
  <td align="center"><img src="cid:${LOGO_CID}" width="160" height="63" alt="Uribe Visuals" style="display:block;border:0;outline:none;width:160px;height:63px;${F};font-size:17px;line-height:63px;font-weight:800;color:#16110E;text-align:center"></td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#F4EFE8;border:1px solid #DDD4C8">
<tr><td style="padding:40px 36px 36px">
  <h1 style="margin:0 0 18px;${F};font-size:26px;line-height:30px;font-weight:800;letter-spacing:-0.8px;color:#16110E">Ya puedes ver tu calendario</h1>
  ${p(esc(intro))}
  ${h2('Cómo entrar')}
  ${tabla(pasos.map((t, i) => li(esc(t), i + 1 + '.')).join(''))}
  ${h2('Qué encontrarás')}
  ${tabla(ves.map(t => li(esc(t), '·')).join(''))}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0"><tr><td style="background:#A0472F">
    <a href="${PORTAL}" style="display:inline-block;padding:14px 24px;${F};font-size:15px;line-height:20px;font-weight:800;color:#F4EFE8;text-decoration:none">Entrar en tu calendario</a>
  </td></tr></table>
  ${p('Si algo no va, responde a este correo.')}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:24px"><tr>
    <td style="padding-right:12px;vertical-align:top"><div style="width:44px;height:44px;background:#B2503A;color:#F4EFE8;${F};font-weight:800;font-size:26px;text-align:center;line-height:44px;letter-spacing:-1px">U</div></td>
    <td style="vertical-align:top;border-left:1px solid #DDD4C8;padding-left:12px">
      <div style="${F};font-weight:800;font-size:13px;letter-spacing:-.3px;color:#16110E">Kevin Uribe</div>
      <div style="${F};font-size:11px;color:#6E635A;margin-top:1px">Creative Director · Uribe Visuals</div>
      <div style="${F};font-size:11px;color:#4A4038;margin-top:6px">Ibiza · <a href="https://uribevisuals.studio" style="color:#A0472F;text-decoration:none;font-weight:700">uribevisuals.studio</a></div>
    </td>
  </tr></table>
</td></tr>
</table>
<p style="margin:20px 0 0;${F};font-size:12px;line-height:18px;color:#6E635A"><a href="${PORTAL}/privacidad" style="color:#6E635A">Privacidad</a> · <a href="${PORTAL}/aviso-legal" style="color:#6E635A">Aviso legal</a></p>
</td></tr></table>
</body></html>`;
  return { asunto, texto, html, imagenes: [{ cid: LOGO_CID, tipo: 'image/png', nombre: 'uribe-visuals.png', datos: logo() }] };
}

// Una cabecera con letras fuera de ASCII va en «encoded-words» de UTF-8 (RFC 2047), en trozos cortos y doblada.
export function cabecera(s) {
  s = String(s);
  if (/[\r\n]/.test(s)) throw new Error('una cabecera no lleva saltos de línea');
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const trozos = []; let t = '';
  for (const c of s) { if (Buffer.byteLength(t + c) > 39) { trozos.push(t); t = ''; } t += c; }
  if (t) trozos.push(t);
  return trozos.map(x => `=?UTF-8?B?${Buffer.from(x, 'utf8').toString('base64')}?=`).join('\r\n ');
}
const b64 = s => Buffer.from(s, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');

// Con imágenes (el logo), multipart/related: el texto y el HTML (multipart/alternative) y cada imagen con su Content-ID.
export function mensaje({ de, nombreDe = 'Uribe Visuals', para, responderA, asunto, texto, html, imagenes = [], ahora = new Date() }) {
  for (const c of [de, para, ...(responderA ? [responderA] : [])]) if (!CORREO_OK.test(c)) throw new Error('un correo raro en el mensaje');
  for (const i of imagenes) if (!/^[a-z0-9.@-]+$/i.test(i.cid) || !/^image\/(png|jpeg)$/.test(i.tipo) || !/^[a-z0-9.-]+$/i.test(i.nombre)) throw new Error('una imagen rara en el mensaje');
  const dominio = de.split('@')[1], corte = 'uv-' + randomBytes(12).toString('hex'), junto = 'uvr-' + randomBytes(12).toString('hex');
  const h = [
    `From: ${cabecera(nombreDe)} <${de}>`,
    `To: <${para}>`,
    ...(responderA ? [`Reply-To: <${responderA}>`] : []),
    `Subject: ${cabecera(asunto)}`,
    `Date: ${ahora.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomBytes(16).toString('hex')}@${dominio}>`,
    'MIME-Version: 1.0',
    'Content-Language: es',
  ];
  const parte = (tipo, cuerpo) => [`--${corte}`, `Content-Type: ${tipo}; charset=utf-8`, 'Content-Transfer-Encoding: base64', '', b64(cuerpo)].join('\r\n');
  const alternativa = [`Content-Type: multipart/alternative; boundary="${corte}"`, '', parte('text/plain', texto), parte('text/html', html), `--${corte}--`];
  if (!imagenes.length) return [...h, ...alternativa, ''].join('\r\n');
  const img = i => [`--${junto}`, `Content-Type: ${i.tipo}; name="${i.nombre}"`, 'Content-Transfer-Encoding: base64', `Content-ID: <${i.cid}>`,
    `Content-Disposition: inline; filename="${i.nombre}"`, '', Buffer.from(i.datos).toString('base64').replace(/.{76}/g, '$&\r\n')].join('\r\n');
  return [...h, `Content-Type: multipart/related; type="multipart/alternative"; boundary="${junto}"`, '', `--${junto}`, ...alternativa,
    ...imagenes.map(img), `--${junto}--`, ''].join('\r\n');
}

// SMTP mínimo: saludo, EHLO, AUTH PLAIN, MAIL FROM, RCPT TO, DATA, QUIT. Con TLS desde el primer byte (puerto 465); sin TLS solo
// contra 127.0.0.1 (la prueba). La clave no sale nunca en un error: los errores llevan solo lo que contesta el servidor.
export function enviarSmtp({ host, port = 465, usuario, clave, de, para, datos, seguro = true, timeout = 30000 }) {
  if (!seguro && host !== '127.0.0.1') return Promise.reject(new Error('sin TLS, solo contra 127.0.0.1'));
  if (!usuario || !clave) return Promise.reject(new Error('faltan el usuario y la clave del buzón'));
  if (!CORREO_OK.test(de) || !CORREO_OK.test(para)) return Promise.reject(new Error('un correo raro'));
  return new Promise((resolve, reject) => {
    const s = seguro ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    let fin = false, buf = '', etapa = 'conexión', aceptado = null;   // aceptado: el servidor ya dijo 250 al mensaje
    const lineas = [], cola = [], esperan = [];
    const terminar = (e, v) => { if (fin) return; fin = true; clearTimeout(reloj); s.destroy(); e ? reject(e) : resolve(v); };
    // Una vez aceptado el mensaje, un corte o un silencio al despedirse no es un fallo: el correo ya salió.
    const reloj = setTimeout(() => aceptado ? terminar(null, aceptado) : terminar(new Error(`el servidor de correo no contesta (en «${etapa}»)`)), timeout);
    s.setEncoding('utf8');
    s.on('data', d => {
      buf += d;
      for (let i; (i = buf.indexOf('\n')) >= 0;) {
        const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
        lineas.push(l);
        if (/^\d{3}(?: |$)/.test(l)) {   // la última línea de una respuesta (las anteriores llevan «250-»)
          const r = { codigo: +l.slice(0, 3), texto: l.slice(4) }; lineas.length = 0;
          esperan.length ? esperan.shift()(r) : cola.push(r);
        }
      }
    });
    s.on('error', e => aceptado ? terminar(null, aceptado) : terminar(new Error(`conexión con el servidor de correo (en «${etapa}»): ` + e.message)));
    s.on('close', () => aceptado ? terminar(null, aceptado) : terminar(new Error(`el servidor de correo cerró la conexión (en «${etapa}»)`)));
    const leer = () => cola.length ? Promise.resolve(cola.shift()) : new Promise(r => esperan.push(r));
    const paso = async (linea, vale, que) => {
      etapa = que;
      if (linea != null) s.write(linea + '\r\n');
      const r = await leer();
      if (!vale.includes(r.codigo)) throw new Error(`${que}: el servidor contestó ${r.codigo} ${r.texto.slice(0, 200)}`);
      return r;
    };
    (async () => {
      await paso(null, [220], 'saludo');
      await paso('EHLO ' + de.split('@')[1], [250], 'EHLO');
      await paso('AUTH PLAIN ' + Buffer.from(`\0${usuario}\0${clave}`, 'utf8').toString('base64'), [235], 'usuario o clave del buzón');
      await paso(`MAIL FROM:<${de}>`, [250], 'remitente');
      await paso(`RCPT TO:<${para}>`, [250, 251], 'destinatario');
      await paso('DATA', [354], 'DATA');
      const cuerpo = String(datos).replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');   // una línea que empieza por «.» se dobla
      const r = await paso(cuerpo + (cuerpo.endsWith('\r\n') ? '' : '\r\n') + '.', [250], 'envío');
      aceptado = { aceptado: r.texto.slice(0, 200) };
      // Ya está aceptado: QUIT y su 221 con un tope corto (sin esperarlo, el servidor ve la conexión cortada).
      s.write('QUIT\r\n');
      await Promise.race([leer(), new Promise(ya => setTimeout(ya, 2000))]);
      terminar(null, aceptado);
    })().catch(e => terminar(e));
  });
}
