// movil.js · 1.0 · la cara de la Mesa en el iPhone (D-267 a D-270). movil.html (<html data-movil>) carga el mismo núcleo que la
// Mesa del Mac y esta cara, hecha para el dedo: Hoy, Clientes y Tareas; el mes de cada cliente (lista, calendario e historias); la
// publicación (fotos, fecha y hora, estado, caption, contexto y nota plegados, lo que dijo el cliente). Aquí no hay ninguna regla de
// la Mesa: estados, avisos, captions, vencidas, pasos y fechas de Madrid salen del núcleo (M._in.movil, M.personal, M.web, M.nube).
// Mirar nunca coge la Mesa; cambiar (fecha, hora, estado, un caption, tareas y notas) es una operación que el núcleo aplica con la
// Mesa cogida un momento (lote 4, más abajo).
(function () {
  'use strict';
  const VERSION = '1.3';   // 1.3: la hoja sigue al teclado (resize y scroll del visualViewport), el campo del ordenador en notas, «Detalles» y textos de una sesión (D-286) y las marcas de estado del Mac (D-287). 1.2: las listas se leen como en el Mac: viñeta y número en terracota y el separador «⸻» como una línea (D-283). 1.1: los ajustes tras probarla en el iPhone (D-271), editar tareas (D-272) y la sesión entera (D-275)
  const M = window.MESA, D = document, W = window;
  const fallo = t => { (W.MESA_CARGA = W.MESA_CARGA || {}).movil = 'fallo'; const p = D.getElementById('arranque'); if (p) p.textContent = t; };
  if (!M || !M._in || !M._in.movil || !M._in.movil.activo) { fallo('No se pudo cargar la Mesa. Cierra la app y vuelve a abrirla.'); return; }
  const X = () => M._in, MV = () => M._in.movil;

  // ---------- el tema: el elegido en este iPhone («Apariencia», D-271 punto 11) o, sin elegir, el del iPhone; tema.js lo pinta antes ----------
  const MQ = W.matchMedia ? W.matchMedia('(prefers-color-scheme: dark)') : null, K_TEMA = 'mesa-movil-tema';
  const temaElegido = () => { try { const v = W.localStorage.getItem(K_TEMA); return v === 'claro' || v === 'oscuro' ? v : null; } catch (e) { return null; } };
  const oscuro = () => { const t = temaElegido(); return t ? t === 'oscuro' : !!(MQ && MQ.matches); };
  const tema = () => {
    const t = temaElegido(), o = oscuro(), r = D.documentElement;
    if (o) r.dataset.theme = 'dark'; else if (t) r.dataset.theme = 'light'; else delete r.dataset.theme;
    D.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', (t ? o : /dark/.test(m.getAttribute('media') || '')) ? '#15110E' : '#F4EFE8'));
  };
  const alCambiarTema = () => { tema(); pintarPildora(); };   // el iPhone cambió de modo (la cara ya existe)
  tema(); if (MQ) { if (MQ.addEventListener) MQ.addEventListener('change', alCambiarTema); else if (MQ.addListener) MQ.addListener(alCambiarTema); }
  const POCO = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- iconos (Lucide, ISC; un trazo) ----------
  const P = {
    casa: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    gente: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    tareas: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
    abajo: '<path d="m6 9 6 6 6-6"/>', arriba: '<path d="m18 15-6-6-6 6"/>', izq: '<path d="m15 18-6-6 6-6"/>', der: '<path d="m9 18 6-6-6-6"/>',
    reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    euro: '<path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
    ojo: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    nubeok: '<path d="m17 15-5.5 5.5L9 18"/><path d="M5 17.743A7 7 0 1 1 15.71 10h1.79a4.5 4.5 0 0 1 1.5 8.742"/>',
    nubeoff: '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
    nube: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>', subir: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    cliente: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    nota: '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>',
    msg: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    claqueta: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    gira: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    mac: '<path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z"/><path d="M20.054 15.987H3.946"/>',
    movil: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    chispa: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', mas: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    historias: '<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>',
    hijo: '<path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>',
    ojoNo: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    luna: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    recarga: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'
  };
  const ic = (n, sw = 1.75) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[n] || ''}</svg>`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsG = k => { try { return W.localStorage.getItem(k); } catch (e) { return null; } };
  const lsS = (k, v) => { try { if (v == null) W.localStorage.removeItem(k); else W.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

  // ---------- fechas: el día y la hora de Madrid salen del núcleo; aquí solo se escriben ----------
  const DS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], DL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MES = () => X().MONTHS;
  const cap1 = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  const dow = d => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))).getUTCDay();
  const addD = (d, n) => { const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)); return t.toISOString().slice(0, 10); };
  const hoy = () => X().hoy();
  const corto = d => d ? `${+d.slice(8, 10)} ${MES()[+d.slice(5, 7) - 1].slice(0, 3)}` : '';
  const diaCab = d => `${cap1(DS[dow(d)])} ${+d.slice(8, 10)}`;
  const fechaLarga = d => `${cap1(DL[dow(d)])} ${+d.slice(8, 10)} de ${MES()[+d.slice(5, 7) - 1]}`;
  const relativo = d => { const h = hoy(); return d === h ? 'Hoy' : d === addD(h, 1) ? 'Mañana' : d === addD(h, -1) ? 'Ayer' : ''; };
  const diaCorto = d => relativo(d) || corto(d);
  const campoFecha = f => !f || !f.dia ? 'Sin fecha' : `${relativo(f.dia) || cap1(DS[dow(f.dia)]) + ' ' + corto(f.dia)}${f.hora ? ' · ' + f.hora : ''}`;
  const horaDe = ms => { try { return X().localTime(new Date(ms).toISOString()); } catch (e) { return ''; } };
  const mesNombre = m => cap1(MES()[+m.slice(5, 7) - 1]);
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const ordinal = n => n.toLocaleString('es-ES');

  // ---------- el estilo: los tokens de la Mesa (una sola fuente, M._in.movil.tokens) y el dibujo de la v3 ----------
  const CSS_V3 = `:root[data-theme="dark"] #movil{--sep:var(--line)}
#movil *{box-sizing:border-box}
#movil{--sep:var(--line2);
  --sa-t:env(safe-area-inset-top,0px);--sa-b:env(safe-area-inset-bottom,0px);
  --tap:44px;--pad:16px;
  --st-aprobado:var(--ok);--st-programado:var(--ok);--st-publicado:var(--mute);--st-noaprobado:var(--red);--st-cancelado:var(--faint);
  position:relative;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;
  background:var(--bg);color:var(--ink);font:15px/1.42 var(--font);
  -webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;font-kerning:normal;}
:where(#movil) button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
#movil b,#movil strong{font-weight:600}
#movil .top{position:sticky;top:0;z-index:20;padding-top:var(--sa-t);background:color-mix(in srgb,var(--bg) 88%,transparent);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);border-bottom:1px solid transparent}
#movil .top.linea{border-bottom-color:var(--line2)}
#movil .top-in{height:48px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 8px}
#movil .top-t{font-weight:600;font-size:17px;letter-spacing:-.01em;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:56vw}
#movil .top-l{justify-self:start;display:flex;align-items:center}
#movil .top-r{justify-self:end;display:flex;align-items:center;gap:4px}
#movil .back{display:flex;align-items:center;gap:2px;height:var(--tap);padding:0 8px 0 2px;color:var(--acc-ink);font-size:17px}
#movil .back svg{width:26px;height:26px}
#movil .mono{width:30px;height:30px;border-radius:8px;display:block;margin-left:8px}
#movil .ib{width:var(--tap);height:var(--tap);display:grid;place-items:center;border-radius:12px;color:var(--ink-2)}
#movil .ib svg{width:23px;height:23px}
#movil .nube{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px 0 9px;border-radius:999px;font-size:13px;font-weight:500;color:var(--ink-2);background:var(--bg-2);margin-right:8px;white-space:nowrap}
#movil .nube svg{width:16px;height:16px}
#movil .nube.ok{color:var(--ok);background:var(--ok-soft)}
#movil .nube.off{color:var(--chg);background:var(--chg-soft)}
#movil .main{flex:1;padding:0 0 calc(76px + var(--sa-b))}
#movil .main.sin-tabs{padding-bottom:calc(24px + var(--sa-b))}
#movil .titulo{padding:6px var(--pad) 2px}
#movil .titulo h1{margin:0;font-weight:800;font-size:32px;line-height:1.08;letter-spacing:-.025em}
#movil .titulo p{margin:6px 0 0;color:var(--mute);font-size:15px}
#movil .titulo p .acc{color:var(--acc-ink);font-weight:600}
#movil .sec{margin:26px 0 0}
#movil .sec-h{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:0 var(--pad) 10px}
#movil .sec-h h2{margin:0;font-size:19px;font-weight:800;letter-spacing:-.015em}
#movil .sec-h .n{color:var(--mute);font-weight:500;margin-left:6px}
#movil .sec-h .lnk{color:var(--acc-ink);font-size:15px;font-weight:500;min-height:var(--tap);display:flex;align-items:center}
#movil .sec-h.roja h2{color:var(--red)}
#movil .cifras{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:18px var(--pad) 0}
#movil .cifra{position:relative;text-align:left;min-height:84px;padding:12px 14px 12px;border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2)}
#movil .cifra .v{display:block;font-weight:800;font-size:30px;line-height:1;letter-spacing:-.03em}
#movil .cifra .k{display:block;margin-top:8px;font-size:14px;line-height:1.25;color:var(--ink-2)}
#movil .cifra.roja .v{color:var(--red)}
#movil .cifra.on{background:var(--ink);color:var(--on-ink);box-shadow:none}
#movil .cifra.on .k{color:color-mix(in srgb,var(--on-ink) 78%,transparent)}
#movil .cifra.on.roja .v{color:var(--rojo-tinta)}
#movil .lista{margin:0 var(--pad);border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);overflow:hidden}
#movil .fila{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:64px;padding:10px 12px 10px 12px;text-align:left}
#movil .fila+.fila::before{content:'';position:absolute;left:84px;right:0;top:0;height:1px;background:var(--sep)}
#movil .lista.chica .fila+.fila::before{left:52px}
#movil .fila .ft{flex:none;width:60px;height:60px;border-radius:10px;overflow:hidden;position:relative;background:var(--cell-ph)}
#movil .fila .ft.r{height:60px;width:60px}
#movil .fila .tx{flex:1;min-width:0}
#movil .fila .t1{display:block;font-weight:600;font-size:16px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#movil .fila .t2{margin-top:3px;font-size:14px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#movil .fila .t2 .acc{color:var(--acc-ink);font-weight:600}
#movil .fila .t2 .roja{color:var(--red);font-weight:600}
#movil .fila .chev{flex:none;width:20px;height:20px;color:var(--faint)}
#movil .fila .hr{flex:none;font-size:15px;font-weight:600;color:var(--ink-2);text-align:right;min-width:44px}
#movil .av{flex:none;width:22px;height:22px;border-radius:50%;display:inline-grid;place-items:center;font-size:11px;font-weight:800;color:#fff}
#movil .av.g{width:40px;height:40px;font-size:17px}
#movil .ty{display:inline-flex;align-items:center;vertical-align:2px;margin-left:4px;height:22px;padding:0 8px;border-radius:6px;font-size:12px;font-weight:600;flex:none}
#movil .ty.foto{background:var(--ty-foto);color:var(--ty-foto-ink)}
#movil .ty.carr{background:var(--ty-carr);color:var(--ty-carr-ink)}
#movil .ty.reel{background:var(--ty-reel);color:var(--ty-reel-ink)}
#movil .ty.collab{background:var(--ty-collab);color:var(--ty-collab-ink)}
#movil .ty.hist{background:color-mix(in srgb,var(--story) 14%,var(--panel-2));color:color-mix(in srgb,var(--story) 70%,var(--ink))}
#movil .es{display:inline-flex;align-items:center;gap:6px;font-size:14px;color:var(--ink-2);white-space:nowrap}
/* las marcas de estado del Mac (D-081), salidas del núcleo (estIco, D-287): ✓ Programado, ✓✓ Publicado, ✕ Cancelado y un punto del color de
   su estado para el resto; al tamaño del iPhone. Solo .edot y .eico: un icono nuevo en <i> dentro de .es no se pinta (lección 244) */
#movil .es>.edot{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none}
#movil :is(.es,.hh)>.e-empezar{background:var(--st-empezar-aro)}#movil :is(.es,.hh)>.e-captions{background:var(--st-captions)}#movil :is(.es,.hh)>.e-aprobar{background:var(--st-aprobar)}
#movil :is(.es,.hh)>.e-noaprobado{background:var(--red)}#movil :is(.es,.hh)>.e-aprobado{background:var(--ok)}
#movil .es>.eico{display:inline-flex;flex:none;width:14px;height:13px;color:var(--ok)}
#movil .es>.eico.e-publicado{width:17px}#movil .es>.eico.e-cancelado{width:12px;color:var(--red)}
#movil .es>.eico svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
#movil .es>.eico .h{display:none}
#movil .fila .t2 .es{display:inline}#movil .fila .t2 .es>i{vertical-align:middle;margin:-2px 6px 0 0}   /* en una fila, si no cabe, se acorta el nombre del estado, nunca la marca entera (lección 216) */
#movil .pill{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px 0 10px;border-radius:999px;background:var(--bg-2);font-size:14px;font-weight:600}
#movil .cli{display:block;width:100%;text-align:left;padding:14px 14px 14px;border-radius:18px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2)}
#movil .clis{display:grid;gap:10px;padding:0 var(--pad)}
#movil .cli-h{display:flex;align-items:center;gap:12px}
#movil .cli-h .nm{flex:1;min-width:0}
#movil .cli-h .nm b{display:block;font-size:17px;font-weight:800;letter-spacing:-.01em}
#movil .cli-h .nm span{display:block;font-size:14px;color:var(--mute)}
#movil .cli-h .chev{width:20px;height:20px;color:var(--faint)}
#movil .tramos{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin:14px 0 8px}
#movil .tramos i{height:6px;border-radius:3px;background:var(--bg-3)}
#movil .tramos i.h{background:var(--ink-2)}
#movil .tramos i.a{background:var(--acc)}
#movil .cli-p{display:flex;justify-content:space-between;gap:10px;font-size:14px;color:var(--mute)}
#movil .cli-p b{color:var(--ink);font-weight:600}
#movil .cli-p .acc{color:var(--acc-ink);font-weight:600}
#movil .seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;margin:14px var(--pad) 0;padding:3px;border-radius:12px;background:var(--bg-2)}
#movil .seg button{height:36px;border-radius:9px;font-size:15px;font-weight:500;color:var(--ink-2)}
#movil .seg button.on{background:var(--panel-2);color:var(--ink);font-weight:600;box-shadow:var(--shadow-sm)}
#movil .mesnav{display:flex;align-items:center;justify-content:space-between;padding:4px 6px 0 var(--pad)}
#movil .mesnav h1{margin:0;font-weight:800;font-size:32px;line-height:1.08;letter-spacing:-.025em}
#movil .mesnav .flechas{display:flex}
#movil .pasos{margin:12px var(--pad) 0}
#movil .pasos .tramos{margin:0 0 8px}
#movil .pasos p{margin:0;font-size:14px;color:var(--mute)}
#movil .pasos p .acc{color:var(--acc-ink);font-weight:600}
#movil .dia{padding:20px var(--pad) 8px;display:flex;align-items:baseline;gap:8px}
#movil .dia b{font-size:16px;font-weight:800}
#movil .dia span{font-size:14px;color:var(--mute)}
#movil .dia.hoy b{color:var(--acc-ink)}
#movil .dia .hs{margin-left:auto;font-size:14px;color:var(--mute);display:inline-flex;align-items:center;gap:6px}
#movil .dia .hs i{width:8px;height:8px;border-radius:50%;background:var(--story)}
#movil .cal{margin:14px var(--pad) 0;border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);padding:8px 6px 10px}
#movil .cal-s{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:12px;font-weight:600;color:var(--mute);padding:4px 0 6px}
#movil .cal-g{display:grid;grid-template-columns:repeat(7,1fr);row-gap:2px}
#movil .cd{height:52px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:5px;padding-top:6px;border-radius:12px;font-size:15px;font-weight:500}
#movil .cd.otro{color:var(--faint)}
#movil .cd.hoy .n{background:var(--acc);color:var(--on-acc);font-weight:800}
#movil .cd.sel{background:var(--bg-2)}
#movil .cd .n{width:28px;height:28px;display:grid;place-items:center;border-radius:50%}
#movil .cd .p{display:flex;gap:3px}
#movil .cd .p i{width:6px;height:6px;border-radius:50%}
#movil .cd .p i.foto{background:#D9876F}
#movil .cd .p i.carr{background:#9A7BAA}
#movil .cd .p i.reel{background:#6E9A76}
#movil .cd .p i.collab{background:#3F7A4C}
#movil .cd .p i.hist{background:var(--story)}
#movil .leyenda{display:flex;flex-wrap:wrap;gap:6px 14px;padding:10px var(--pad) 0;font-size:13px;color:var(--mute)}
#movil .leyenda span{display:inline-flex;align-items:center;gap:6px}
#movil .leyenda i{width:8px;height:8px;border-radius:50%}
#movil .hgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 var(--pad)}
#movil .hc{position:relative;aspect-ratio:9/16;border-radius:12px;overflow:hidden;background:var(--cell-ph)}
#movil .hc .ph{position:absolute;inset:0}
#movil .hc .hh{position:absolute;left:8px;bottom:8px;right:8px;display:flex;align-items:center;justify-content:space-between;color:#fff;font-size:13px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.4)}
#movil .hc .hh>.edot{width:9px;height:9px;border-radius:50%;box-shadow:0 0 0 1.5px rgba(255,255,255,.9)}   /* las marcas del Mac sobre la foto (D-287): el punto con su aro, ✓ ✓✓ ✕ con su trazo blanco */
#movil .hc .hh>.eico{display:inline-flex;width:14px;height:13px;color:var(--ok)}#movil .hc .hh>.eico.e-publicado{width:17px}#movil .hc .hh>.eico.e-cancelado{width:12px;color:var(--red)}
#movil .hc .hh>.eico svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;overflow:visible}#movil .hc .hh>.eico .h{stroke:#fff;stroke-width:5}
#movil .hc .tit{position:absolute;left:10px;right:10px;top:42%;color:#fff;font-weight:800;font-size:15px;line-height:1.1;letter-spacing:-.01em;text-shadow:0 1px 8px rgba(0,0,0,.25)}
#movil .car{position:relative;margin:4px 0 0;background:var(--stage)}
#movil .car .ph{aspect-ratio:4/5;width:100%}
#movil .car .cnt{position:absolute;right:12px;top:12px;height:26px;padding:0 10px;border-radius:999px;background:var(--photo-chip);color:#fff;font-size:13px;font-weight:600;display:flex;align-items:center}
#movil .puntos{display:flex;justify-content:center;gap:6px;padding:10px 0 0}
#movil .puntos i{width:6px;height:6px;border-radius:50%;background:var(--line-strong)}
#movil .puntos i.on{background:var(--ink);width:18px;border-radius:3px}
#movil .pub-h{padding:14px var(--pad) 0}
#movil .pub-h h1{margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
#movil .pub-h .sub{display:flex;align-items:center;gap:8px;margin-top:8px;color:var(--mute);font-size:15px}
#movil .grupo{margin:18px var(--pad) 0;border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);overflow:hidden}
#movil .campo{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:54px;padding:0 12px 0 14px;text-align:left}
#movil .campo+.campo::before{content:'';position:absolute;left:14px;right:0;top:0;height:1px;background:var(--sep)}
#movil .campo .k{flex:none;width:104px;color:var(--mute);font-size:15px}
#movil .campo .v{flex:1;min-width:0;font-size:16px;font-weight:500;display:flex;align-items:center;gap:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#movil .campo .chev{flex:none;width:20px;height:20px;color:var(--faint)}
#movil .campo.solo .v{color:var(--ink-2);font-weight:400}
#movil .aviso{display:flex;gap:10px;margin:12px var(--pad) 0;padding:12px 14px;border-radius:14px;background:var(--chg-soft);color:var(--chg);font-size:14px;line-height:1.4}
#movil .aviso svg{flex:none;width:18px;height:18px;margin-top:1px}
#movil .aviso.rojo{background:var(--red-soft);color:var(--red)}
#movil .cap{margin:18px var(--pad) 0}
#movil .cap-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
#movil .cap-h h2{margin:0;font-size:19px;font-weight:800;letter-spacing:-.015em}
#movil .cap-h .lnk{color:var(--acc-ink);font-weight:500;min-height:var(--tap);display:flex;align-items:center}
#movil .cap-b{padding:14px 16px;border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);font-size:16px;line-height:1.5;white-space:pre-line}
#movil .cap-b .tono{display:block;margin-top:12px;font-size:14px;color:var(--mute)}
#movil .cap-b .tono b{color:var(--acc-ink)}
#movil .hilo{display:grid;gap:10px;margin:0 var(--pad)}
#movil .msg{max-width:88%;padding:10px 14px 11px;border-radius:18px;font-size:15px;line-height:1.42}
#movil .msg .q{display:block;font-size:13px;color:var(--mute);margin-bottom:3px}
#movil .msg.cli{justify-self:start;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);border-bottom-left-radius:6px}
#movil .msg.yo{justify-self:end;background:var(--ink);color:var(--on-ink);border-bottom-right-radius:6px}
#movil .msg.yo .q{color:color-mix(in srgb,var(--on-ink) 70%,transparent)}
#movil .resp{display:flex;align-items:flex-end;gap:8px;margin:12px var(--pad) 0}
#movil .resp textarea{flex:1;min-height:46px;max-height:140px;resize:none;padding:12px 14px;border-radius:22px;border:1px solid var(--line);background:var(--panel-2);color:var(--ink);font:16px/1.35 var(--font);outline:none}
#movil .resp textarea::placeholder{color:var(--faint)}
#movil .enviar{flex:none;width:46px;height:46px;border-radius:50%;background:var(--acc);color:var(--on-acc);display:grid;place-items:center}
#movil .enviar svg{width:22px;height:22px}
#movil .velo{position:fixed;inset:0;background:var(--scrim);z-index:50}
#movil .hoja{position:fixed;left:0;right:0;bottom:0;z-index:60;background:var(--panel);border-radius:22px 22px 0 0;padding:8px var(--pad) calc(16px + var(--sa-b));box-shadow:var(--shadow-lg)}
#movil .hoja .asa{width:38px;height:5px;border-radius:3px;background:var(--line-strong);margin:0 auto 12px}
#movil .hoja h2{margin:0 0 4px;font-size:22px;font-weight:800;letter-spacing:-.02em}
#movil .hoja .ex{margin:0 0 14px;color:var(--mute);font-size:15px}
#movil .hoja .grupo{margin:0}
#movil .botones{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
#movil .btn{height:52px;border-radius:14px;font-size:17px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px}
#movil .btn.pri{background:var(--acc);color:var(--on-acc)}
#movil .btn.sua{background:var(--bg-2);color:var(--ink)}
#movil .btn.ancho{grid-column:1/-1}
#movil .prog{display:grid;gap:14px;margin:6px 0 4px}
#movil .paso{display:flex;align-items:center;gap:12px;font-size:16px}
#movil .paso .ic{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--bg-2);color:var(--mute)}
#movil .paso .ic svg{width:16px;height:16px}
#movil .paso.hecho .ic{background:var(--ok);color:#fff}
#movil .paso.ahora .ic{background:var(--acc-soft);color:var(--acc-ink)}
#movil .paso.ahora{font-weight:600}
#movil .paso .t{flex:1}
#movil .paso .s{color:var(--mute);font-size:14px}
#movil .gira{animation:mv-gira 1s linear infinite}
@keyframes mv-gira{to{transform:rotate(360deg)}}
#movil .estados{display:grid;gap:8px}
#movil .estado-op{display:flex;align-items:center;gap:12px;min-height:54px;padding:0 14px;border-radius:14px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);font-size:16px;font-weight:500;text-align:left;width:100%}
#movil .estado-op .es{font-size:16px;color:var(--ink);font-weight:500;flex:1}
#movil .estado-op .es>.edot{width:11px;height:11px;margin:0 3px}#movil .estado-op .es>.eico{width:17px;justify-content:center}#movil .estado-op .es>.eico svg{width:14px}#movil .estado-op .es>.eico.e-publicado svg{width:17px}#movil .estado-op .es>.eico.e-cancelado svg{width:12px}   /* en la hoja, cada marca en una caja de 17 px: el texto de las opciones, alineado */
#movil .estado-op.on{box-shadow:inset 0 0 0 2px var(--ink)}
#movil .estado-op .ck{width:22px;height:22px;color:var(--ink)}
#movil .estado-op .sub{font-size:13px;color:var(--mute);font-weight:400}
#movil .op{margin:12px var(--pad) 0;padding:14px 16px 12px;border-radius:18px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2)}
#movil .op.on{box-shadow:inset 0 0 0 2px var(--acc)}
#movil .op-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
#movil .op-h b{font-size:15px}
#movil .op-h .elegido{display:inline-flex;align-items:center;gap:6px;color:var(--acc-ink);font-size:14px;font-weight:600}
#movil .op-h .elegido svg{width:18px;height:18px}
#movil .op p{margin:0;font-size:16px;line-height:1.5;white-space:pre-line}
#movil .op-a{display:flex;gap:8px;margin-top:12px}
#movil .op-a .btn{height:44px;font-size:15px;padding:0 16px;flex:1}
#movil .editor textarea{width:100%;min-height:220px;padding:14px 16px;border-radius:16px;border:1.5px solid var(--acc);background:var(--panel-2);color:var(--ink);font:16px/1.5 var(--font);outline:none;resize:none;box-shadow:0 0 0 4px var(--ring)}
#movil .editor{margin:12px var(--pad) 0}
#movil .cuenta{display:flex;justify-content:space-between;margin-top:8px;color:var(--mute);font-size:14px}
#movil .nueva{display:flex;align-items:center;gap:8px;margin:16px var(--pad) 0;padding:0 6px 0 14px;height:52px;border-radius:14px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2)}
#movil .nueva input{flex:1;min-width:0;border:0;background:none;font:16px var(--font);color:var(--ink);outline:none}
#movil .nueva input::placeholder{color:var(--faint)}
#movil .nueva .ib{width:40px;height:40px;color:var(--mute)}
#movil .nueva .ib svg{width:21px;height:21px}
#movil .filtro{display:flex;gap:8px;overflow-x:auto;padding:14px var(--pad) 2px;scrollbar-width:none}
#movil .filtro::-webkit-scrollbar{display:none}
#movil .chip{flex:none;display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px 0 10px;border-radius:999px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);font-size:14px;font-weight:500;white-space:nowrap}
#movil .chip.on{background:var(--ink);color:var(--on-ink);box-shadow:none}
#movil .chip.solo{padding:0 14px}
#movil .tarea{display:flex;align-items:flex-start;gap:12px;width:100%;min-height:56px;padding:13px 14px 12px;text-align:left;position:relative}
#movil .tarea+.tarea::before{content:'';position:absolute;left:52px;right:0;top:0;height:1px;background:var(--sep)}
#movil .casilla{flex:none;width:26px;height:26px;border-radius:8px;box-shadow:inset 0 0 0 1.75px var(--line-strong);display:grid;place-items:center;margin-top:-2px}
#movil .casilla svg{width:18px;height:18px;opacity:0}
#movil .tarea.hecha .casilla{background:var(--ink);box-shadow:none;color:var(--on-ink)}
#movil .tarea.hecha .casilla svg{opacity:1}
#movil .tarea.hecha .tt{text-decoration:line-through;color:var(--faint)}
#movil .tarea .tx{flex:1;min-width:0}
#movil .tarea .tt{font-size:16px;line-height:1.35}
#movil .tarea .tm{display:flex;align-items:center;gap:8px;margin-top:5px;font-size:14px;color:var(--mute)}
#movil .tarea .tm .roja{color:var(--red);font-weight:600}
#movil .tarea .tm .acc{color:var(--acc-ink);font-weight:600}
#movil .tarea .tm svg{width:15px;height:15px}
#movil .nota-ic{flex:none;width:26px;height:26px;display:grid;place-items:center;color:var(--brass);margin-top:-2px}
#movil .nota-ic svg{width:22px;height:22px}
#movil .tabs{position:fixed;left:0;right:0;bottom:0;z-index:25;padding-bottom:var(--sa-b);background:color-mix(in srgb,var(--panel) 86%,transparent);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);border-top:1px solid var(--line2)}
#movil .tabs-in{height:56px;display:grid;grid-template-columns:repeat(3,1fr)}
#movil .tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:11px;font-weight:500;color:var(--mute)}
#movil .tab svg{width:25px;height:25px}
#movil .tab.on{color:var(--ink);font-weight:600}
#movil .tab .badge{position:absolute;margin:-18px 0 0 22px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--red);color:#fff;font-size:11px;font-weight:800;display:grid;place-items:center}
#movil .tab{position:relative}
#movil .entrar{flex:1;display:flex;flex-direction:column;justify-content:center;padding:calc(var(--sa-t) + 24px) 24px calc(var(--sa-b) + 24px)}
#movil .entrar .logo{width:64px;height:64px;border-radius:16px;margin:0 0 22px}
#movil .entrar h1{margin:0;font-size:30px;font-weight:800;letter-spacing:-.025em}
#movil .entrar .ex{margin:8px 0 26px;color:var(--mute);font-size:16px}
#movil .fld{display:block;margin:0 0 12px}
#movil .fld span{display:block;font-size:14px;font-weight:500;color:var(--ink-2);margin:0 0 6px}
#movil .fld input{width:100%;height:52px;padding:0 14px;border-radius:14px;border:1px solid var(--line);background:var(--panel-2);color:var(--ink);font:16px var(--font);outline:none}
#movil .fld input:focus{border-color:var(--acc);box-shadow:0 0 0 4px var(--ring)}
#movil .llave{display:flex;align-items:center;gap:10px;margin:14px 0 0;padding:12px 14px;border-radius:14px;background:var(--bg-2);font-size:14px;color:var(--ink-2)}
#movil .llave svg{width:22px;height:22px;flex:none}
#movil .pie{margin-top:18px;text-align:center;font-size:14px;color:var(--mute)}
#movil .toast{position:fixed;left:var(--pad);right:var(--pad);bottom:calc(76px + var(--sa-b));z-index:45;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:var(--tip);color:var(--bg);font-size:15px;box-shadow:var(--shadow-md)}
#movil .toast svg{width:20px;height:20px;flex:none;color:#86C795}
:root[data-theme="dark"] #movil .toast svg{color:var(--ok-on-ink)}
#movil .ph{background:var(--g)}
#movil .ft .ph,#movil .hc .ph{position:absolute;inset:0}
#movil .car .ph{display:block}
#movil .pub-h .ty{margin-left:0}
#movil .campo.pl .v.vista{font-weight:400;color:var(--mute);font-size:15px}
#movil .selcal{border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);padding:4px 6px 8px}
#movil .selcal-h{display:flex;align-items:center;justify-content:space-between;padding:0 0 0 10px}
#movil .selcal-h b{font-size:17px;font-weight:800}
#movil .selcal-h span{display:flex}
#movil .selcal .cal-s{padding:0 0 2px}
#movil .selcal-g{display:grid;grid-template-columns:repeat(7,1fr);row-gap:2px}
#movil .sd{height:40px;display:grid;place-items:center;font-size:17px;font-weight:500;border-radius:50%;width:40px;margin:0 auto}
#movil .sd.otro{color:var(--faint)}
#movil .sd.sel{background:var(--acc);color:var(--on-acc);font-weight:800}
#movil .ruedas{position:relative;display:flex;align-items:center;justify-content:center;gap:4px;margin-top:10px;height:170px;border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);overflow:hidden}
#movil .ruedas .banda{position:absolute;left:12px;right:12px;top:50%;height:38px;margin-top:-19px;border-radius:10px;background:var(--bg-2)}
#movil .rueda{position:relative;display:flex;flex-direction:column;align-items:center;width:84px}
#movil .rueda span{height:32px;display:grid;place-items:center;font-size:21px;font-weight:500;color:var(--ink);opacity:calc(1 - var(--d) * .32);transform:scale(calc(1 - var(--d) * .08))}
#movil .rueda span.sel{font-weight:800;font-size:23px}
#movil .ruedas .dos{position:relative;font-size:23px;font-weight:800}
#movil .hoja{max-height:calc(100dvh - var(--sa-t) - 8px);overflow-y:auto;overscroll-behavior:contain}
#movil .cifras.c5{grid-template-columns:repeat(6,1fr)}
#movil .cifras.c5 .cifra{grid-column:span 2;min-height:78px;padding:11px 12px}
#movil .cifras.c5 .cifra:nth-child(n+4){grid-column:span 3}
#movil .cifras.c5 .cifra .v{font-size:28px}
#movil .sub-h{padding:14px var(--pad) 8px;font-size:16px;font-weight:600;color:var(--ink-2)}
#movil .sub-h .num{color:var(--mute);font-weight:500;margin-left:4px}
#movil .top-l,#movil .top-r{display:grid;align-items:center}
#movil .top-l>*,#movil .top-r>*{grid-area:1/1}
#movil .top-l>*{justify-self:start}#movil .top-r>*{justify-self:end}
#movil .top-g{visibility:hidden;pointer-events:none;max-width:34vw;overflow:hidden}
#movil .top.ajusta .top-in{grid-template-columns:auto minmax(0,1fr) auto}
#movil .top.ajusta .top-g{display:none}
#movil .mv-tit{display:flex;align-items:center;justify-content:space-between;gap:12px}
#movil .mv-tit h1{min-width:0}
#movil .mv-sw{flex:none;display:inline-flex;align-items:center;gap:10px;min-height:var(--tap);padding:0 0 0 8px;font-size:15px;color:var(--ink-2)}
#movil .mv-sw i{position:relative;flex:none;width:51px;height:31px;border-radius:16px;background:var(--line-strong);transition:background var(--d2) var(--ease)}
#movil .mv-sw i::after{content:'';position:absolute;left:2px;top:2px;width:27px;height:27px;border-radius:50%;background:var(--knob);box-shadow:var(--shadow-xs),0 2px 6px rgba(0,0,0,.16);transition:transform var(--d2) var(--ease-m)}
#movil .mv-sw[aria-checked="true"] i{background:var(--sw-on)}
#movil .mv-sw[aria-checked="true"] i::after{transform:translateX(20px)}
/* las marcas de una nota o unos detalles al leer (escritura.js, D-202–D-204, D-283): su hoja de estilo va bajo #mesa */
#movil .pp-el{display:flex;min-width:0}
#movil .pp-ei,#movil .pp-em{flex:none;white-space:pre}
#movil .pp-em.vi,#movil .pp-em.ca{color:transparent}
#movil .pp-emk{position:relative;display:inline-block;color:transparent}
#movil .pp-em.vi .pp-emk::before{content:'';position:absolute;left:50%;top:50%;width:.3em;height:.3em;margin:-.15em 0 0 -.15em;border-radius:50%;background:var(--acc-ink)}
#movil .pp-el.se{position:relative;height:1.1em;margin:.25em 0}#movil .pp-el.se::before{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:var(--line-strong)}
#movil .pp-em.ca .pp-emk::before{content:'';position:absolute;right:-.02em;top:50%;width:.8em;height:.8em;margin:-.4em 0 0;box-sizing:border-box;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--ink-2)}
#movil .pp-em.ca.on .pp-emk::before{background:var(--acc);box-shadow:none}
#movil .pp-em.ca.on .pp-emk::after{content:'';position:absolute;right:.1em;top:50%;width:.56em;height:.56em;margin:-.28em 0 0;background:var(--on-acc);-webkit-mask:var(--i-check) center/100% no-repeat;mask:var(--i-check) center/100% no-repeat}
#movil .pp-el.ca .pp-et{padding-left:.22em}
#movil .pp-em.ca{display:inline-block;width:1.3em;overflow:hidden}
#movil .pp-em.ca .pp-emk::before{left:0;right:auto}
#movil .pp-em.ca.on .pp-emk::after{left:.12em;right:auto}
#movil .pp-em.nu{color:var(--acc-ink);font-weight:600}   /* las listas como en el Mac (D-283) */
#movil .pp-et{flex:1;min-width:0}
#movil .pp-el.hecha .pp-et{text-decoration:line-through;color:var(--mute)}
#movil .pp-ea{color:var(--acc-ink);text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
#movil .hoja .txt .pp-el{white-space:normal}
#movil .mv-tema{position:relative;flex:none;width:60px;height:var(--tap);display:grid;place-items:center;border-radius:12px}
#movil .mv-tema .tr{position:relative;width:52px;height:30px;border-radius:999px;background:var(--tg-track);box-shadow:inset 0 0 0 1px var(--tg-line);overflow:hidden;transition:background-color var(--d-m) var(--ease-m)}
#movil .mv-tema .k{position:absolute;top:4px;left:4px;width:22px;height:22px;border-radius:999px;background:var(--tg-sun);box-shadow:0 0 0 3px var(--tg-sun-ring),var(--shadow-xs);transform:translateX(22px);transition:transform var(--d-m) var(--ease-m),background-color var(--d-m) var(--ease-m),box-shadow var(--d-m) var(--ease-m)}
#movil .mv-tema .k::before,#movil .mv-tema .k::after{content:'';position:absolute;border-radius:50%;background:var(--tg-crater);opacity:0;transform:scale(.3);transition:opacity var(--d2) ease-out,transform var(--d-m) var(--ease-m)}
#movil .mv-tema .k::before{width:7px;height:7px;left:4px;top:10px}#movil .mv-tema .k::after{width:4px;height:4px;left:11px;top:5px}
#movil .mv-tema.osc .k{transform:none;background:var(--tg-moon);box-shadow:var(--shadow-xs)}
#movil .mv-tema.osc .k::before,#movil .mv-tema.osc .k::after{opacity:1;transform:none}
#movil .estado-op .mv-ico{flex:none;width:24px;height:24px;display:grid;place-items:center;color:var(--ink-2)}
#movil .estado-op .mv-ico svg{width:22px;height:22px}
#movil .estado-op .mv-tt{flex:1;min-width:0}
#movil .estado-op .mv-tt .sub{display:block}
#movil .mv-pubs{display:flex;align-items:center;gap:6px;width:calc(100% - 2 * var(--pad));min-height:var(--tap);margin:16px var(--pad) 0;padding:0 2px;text-align:left;font-size:16px}
#movil .mv-pubs b{font-weight:800}
#movil .mv-pubs .n{color:var(--mute)}
#movil .mv-pubs .r{margin-left:auto;color:var(--mute);font-size:14px}
#movil .mv-pubs .chev{flex:none;width:20px;height:20px;color:var(--faint);transition:transform var(--d2) var(--ease)}
#movil .mv-pubs[aria-expanded="true"] .chev{transform:rotate(180deg)}
#movil .hoja .mv-ttxt{font-size:17px;font-weight:600;line-height:1.35}
#movil .mv-desp{padding:4px 6px 10px}
#movil .mv-desp.estados{padding:8px 8px 10px}
#movil .mv-desp .lbl{margin:8px 4px 2px}
#movil .campo .v .av{width:24px;height:24px;font-size:11px}
#movil .mv-subh{display:flex;gap:6px;align-items:baseline}
#movil .mv-subh .num{color:var(--mute);font-weight:500}
#movil .mv-barra{height:4px;border-radius:2px;background:var(--bg-3);overflow:hidden;margin:0 0 8px}
#movil .mv-barra i{display:block;height:100%;background:var(--acc);border-radius:2px}
#movil .mv-subs{display:grid}
#movil .mv-sub{display:flex;align-items:center;gap:10px;min-height:var(--tap);border-bottom:1px solid var(--sep)}
#movil .mv-sub .casilla{margin:0}
#movil .mv-sub input{flex:1;min-width:0;min-height:var(--tap) !important;border:0 !important;background:none !important;padding:0 !important;box-shadow:none !important;font:16px/1.35 var(--font);color:var(--ink)}
#movil .mv-sub.hecha .casilla{background:var(--ink);box-shadow:none;color:var(--on-ink)}
#movil .mv-sub.hecha .casilla svg{opacity:1}
#movil .mv-sub.hecha input{color:var(--mute);text-decoration:line-through}
#movil .mv-subx{flex:none;width:var(--tap);height:var(--tap);color:var(--faint)}
#movil .hoja [data-ed-mas]{display:inline-flex;align-items:center;gap:6px;margin:4px 0 0 -12px}
#movil .hoja [data-ed-mas] svg{width:18px;height:18px}
#movil .mv-ses-h{display:flex;align-items:flex-start;gap:8px;padding:14px 6px 0 var(--pad)}
#movil .mv-ses-h h1{flex:1;min-width:0;margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.12;overflow-wrap:anywhere}
#movil .mv-ses-h .lnk,#movil .mv-sap-h .lnk{min-height:var(--tap);padding:0 10px;color:var(--acc-ink);font-weight:500;flex:none}
#movil .mv-ses-sub{display:flex;align-items:center;gap:8px;padding:8px var(--pad) 0;color:var(--mute);font-size:15px}
#movil .mv-ses-sub .ty svg{width:14px;height:14px;margin-right:4px}
#movil .mv-scl{display:flex !important;flex-direction:column;align-items:flex-start;gap:6px;white-space:normal !important;padding:12px 0}
#movil .mv-scl>span{display:inline-flex;align-items:center;gap:8px;min-width:0}
#movil .mv-sap{margin:18px 0 0;border-top:1px solid var(--line2)}
#movil .mv-sap-h{display:flex;align-items:center;gap:4px;padding:0 6px 0 var(--pad)}
#movil .mv-sap-b{flex:1;min-width:0;display:flex;align-items:center;gap:8px;min-height:52px;text-align:left}
#movil .mv-sap-b h2{margin:0;font-size:19px;font-weight:800;letter-spacing:-.015em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#movil .mv-sap-b .n{color:var(--mute);font-weight:500;font-size:16px}
#movil .mv-sap-b .oj{display:inline-grid;color:var(--faint)}#movil .mv-sap-b .oj svg{width:17px;height:17px}
#movil .mv-sap-b .chev{margin-left:auto;flex:none;width:20px;height:20px;color:var(--faint);transition:transform var(--d2) var(--ease)}
#movil .mv-sap.abierto .mv-sap-b .chev{transform:rotate(180deg)}
#movil .mv-stx{margin:0 var(--pad) 6px}
#movil .mv-spl{margin:6px var(--pad) 10px}
#movil .mv-spl h3,#movil .mv-mat h3{margin:10px 0 8px;font-size:16px;font-weight:600}#movil .mv-spl h3 .num,#movil .mv-mat h3 .num{color:var(--mute);font-weight:500}
#movil .mv-spl .lista{margin:0}
#movil .mv-spl .tarea .casilla{margin-top:-2px}
#movil .mv-sref{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
#movil .mv-sf{position:relative;display:inline-block;flex:none;height:56px;aspect-ratio:var(--r);border-radius:8px;overflow:hidden;background:var(--cell-ph)}
#movil .mv-sf img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
#movil .mv-mood{columns:2;column-gap:6px}#movil .mv-mood .mv-sf{display:block;width:100%;height:auto;margin:0 0 6px;break-inside:avoid}
#movil .mv-sref .hueco>span,#movil .mv-srej .hueco>span{display:none}#movil .mv-sref .hueco svg{width:16px;height:16px}
#movil .mv-srej{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin:0 var(--pad) 10px}#movil .mv-srej .mv-sf{width:100%;height:auto;aspect-ratio:1}
#movil .mv-mat{margin:0 var(--pad) 10px}
#movil .mv-matb{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:600;color:var(--ink-2)}#movil .mv-matb .mv-barra{flex:1;margin:0;height:5px}
#movil .mv-fichas{display:flex;flex-wrap:wrap;gap:8px}
#movil .mv-ficha{position:relative;display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:999px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);font-size:15px;font-weight:500;color:var(--ink)}
#movil .mv-ficha::after{content:'';position:absolute;inset:-4px -2px}
#movil .mv-ficha svg{width:16px;height:16px}
#movil .mv-ficha.on{background:var(--ink);color:var(--on-ink);box-shadow:none;padding-left:10px}
#movil .mv-ficha.hijo{padding-left:10px}#movil .mv-ficha.hijo .hj{color:var(--mute);display:inline-grid}#movil .mv-ficha.hijo.on .hj{color:color-mix(in srgb,var(--on-ink) 70%,transparent)}
#movil .mono-w{position:relative;flex:none;display:inline-block;width:30px;height:30px;margin-left:8px}
#movil .mono-w .mono{position:absolute;inset:0;margin:0}
#movil .mono-w .mono-ll{clip-path:inset(var(--vacio,0%) 0 0 0);transition:clip-path .35s var(--ease)}
#movil .mono-w.trabaja>.mono:not(.mono-ll){filter:grayscale(1);opacity:.3}
#movil .mono-w.mini{width:22px;height:22px;margin:0 8px 0 0}
#movil .mono-w.mini .mono{width:22px;height:22px;border-radius:6px}
#movil .mono-w[hidden]{display:none}
#movil .top-fila{display:inline-flex;align-items:center}
#movil .mv-gira{flex:none;display:inline-block;width:18px;height:18px;border-radius:50%;border:2px solid var(--line-strong);border-top-color:var(--acc);animation:mv-gira .9s linear infinite;vertical-align:-3px}
#movil .cap-h h2 .mv-gira{margin-left:6px}
#movil .tarea.mv-nueva .mv-gira{margin:2px 4px 0}
#movil .campo[aria-busy="true"]:disabled .v{color:var(--ink)}
#movil .mv-tira{display:flex;gap:8px;overflow-x:auto;margin:0 calc(-1 * var(--pad));padding:0 var(--pad);scrollbar-width:none;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
#movil .mv-tira::-webkit-scrollbar{display:none}
#movil .mv-tira{scroll-snap-type:x proximity;scroll-padding-inline:var(--pad)}
#movil .mv-tf{scroll-snap-align:start;position:relative;flex:none;height:140px;aspect-ratio:var(--r);border-radius:12px;overflow:hidden;background:var(--cell-ph)}
#movil .mv-tf img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}`;
  const CSS_MAS = `
@font-face{font-family:"Mesa Grotesk";src:url("kits/fonts/SchibstedGrotesk-Medium.woff2") format("woff2");font-weight:500;font-display:swap}
#movil{--sa-l:env(safe-area-inset-left,0px);--sa-r:env(safe-area-inset-right,0px);--rojo-tinta:#FF9AA0}
:root[data-theme="dark"] #movil{--rojo-tinta:#B3263A}
#movil[hidden]{display:none}
#movil :where(button,a,[role=button]){touch-action:manipulation}
#movil :where(button,[tabindex]):focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:12px}
#movil :where(button):disabled{cursor:default}
#movil .main,#movil .top-in,#movil .tabs-in{width:100%}
#movil .main{min-width:0}
#movil .mono{width:30px;height:30px}
#movil .top-r{min-width:0}
#movil .nube{max-width:min(44vw,240px);min-width:0;overflow:hidden}#movil .nube .num{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}#movil .nube .q{white-space:nowrap}#movil .nube svg{flex:none}
#movil .nube.err{color:var(--red);background:var(--red-soft)}
#movil .nube .q{color:var(--red);font-weight:600}
#movil button.nube{cursor:pointer}
#movil .ft img,#movil .hc img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
#movil .ft.ico{display:grid;place-items:center;color:var(--mute);background:var(--bg-2)}
#movil .ft.ico.roja{background:var(--red-soft);color:var(--red)}
#movil .ft.ico span{width:26px;height:26px;display:block}
#movil .ft .tyi{position:absolute;right:4px;top:4px;width:18px;height:18px;padding:2px;border-radius:5px;background:var(--photo-chip);color:#fff;display:grid}
#movil .ft .tyi svg{width:14px;height:14px}
#movil .mi.cargando,#movil .mi:not([src]){opacity:0}
#movil .mi{transition:opacity var(--d2) var(--ease)}
#movil .hueco{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--mute);font-size:13px;background:var(--cell-ph)}
#movil .hueco svg{width:22px;height:22px}
#movil .hueco[hidden]{display:none}
#movil .fila .t2{display:block}
#movil .tarea .tm{flex-wrap:wrap;row-gap:4px;column-gap:10px}
#movil .tarea .tm>*{white-space:nowrap}
#movil .tarea .tm .cn{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis}
#movil .top-in{grid-template-columns:minmax(max-content,1fr) minmax(0,auto) minmax(max-content,1fr);column-gap:6px}#movil .top-r{justify-self:end}#movil .top-t{max-width:none;min-width:0}#movil .back{min-width:0;max-width:34vw}#movil .back>span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#movil .fila{touch-action:manipulation}
#movil .fila:active{background:var(--bg-2)}
#movil .fila .hr.roja{color:var(--red)}
#movil .t1 .ty{vertical-align:1px}
#movil .vacio{margin:18px var(--pad) 0;padding:22px 18px;border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2);color:var(--mute);font-size:15px;text-align:center}
#movil .vacio b{display:block;color:var(--ink);font-size:16px;margin-bottom:4px}
#movil .mal{margin:18px var(--pad) 0;padding:16px;border-radius:16px;background:var(--red-soft);color:var(--red);font-size:15px;display:flex;align-items:center;gap:12px}
#movil .mal span{flex:1}
#movil .mal button{flex:none;height:var(--tap);padding:0 14px;border-radius:12px;background:var(--panel-2);color:var(--ink);font-weight:600}
#movil .cifra:disabled{opacity:1}
#movil .cifra:disabled .v,#movil .cifra:disabled .k{color:var(--faint)}
#movil .cifra:active:not(:disabled){transform:scale(.97)}
#movil .cifra{transition:transform var(--d1) var(--ease),background var(--d1) var(--ease)}
#movil .mas{display:block;width:100%;min-height:var(--tap);color:var(--acc-ink);font-weight:500;font-size:15px}
#movil .cli:disabled{opacity:.6}
#movil .av{background:var(--ink-2);color:var(--bg);overflow:hidden}
#movil .av[style]{color:#fff}
#movil .av img{width:100%;height:100%;object-fit:cover;display:block}
#movil .av.claro{color:var(--ink)}
#movil .mesnav h1{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#movil .ib:disabled{color:var(--faint)}
#movil .seg button{min-height:var(--tap)}
#movil .cd{position:relative;height:52px}
#movil .cd.vacio-d{color:var(--faint)}
#movil .cd.otro{pointer-events:none}
#movil .hc{display:block;width:100%;padding:0;text-align:left}
#movil .hc .hh{text-shadow:0 1px 2px rgba(0,0,0,.45)}
#movil .hc.cancelada{opacity:.45}
#movil .car{overflow:hidden}
#movil .car .tira{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;overscroll-behavior-x:contain}
#movil .car .tira::-webkit-scrollbar{display:none}
#movil .car .lam{position:relative;flex:none;width:100%;scroll-snap-align:center;scroll-snap-stop:always;background:var(--stage)}
#movil .car .lam img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
#movil .car .cnt{z-index:2;pointer-events:none}
#movil .puntos i{transition:width var(--d2) var(--ease),background var(--d2) var(--ease)}
#movil .pub-h .es.toca{color:var(--mute)}
#movil .campo:disabled .v{color:var(--mute)}
#movil .campo:disabled .chev{opacity:0}
#movil .campo .por{display:block;font-size:13px;color:var(--mute);font-weight:400}
#movil .campo.pl .v.vista{white-space:nowrap}
#movil .campo.pl.abierto{align-items:flex-start;padding-top:15px;padding-bottom:15px}
#movil .campo.pl.abierto .v.vista{white-space:pre-line;overflow:visible;text-overflow:clip;color:var(--ink-2);display:block}
#movil .campo.pl.abierto .chev{transform:rotate(180deg)}
#movil .campo .chev{transition:transform var(--d2) var(--ease)}
#movil .cap-b.vacia{color:var(--mute);font-size:15px}
#movil .cap-b .marcas b{color:var(--ink)}
#movil .aviso.gris{background:var(--bg-2);color:var(--ink-2)}
#movil .sec-h .n.acc{color:var(--acc-ink);font-weight:600}
#movil .decision{margin:0 var(--pad) 10px;font-size:15px;color:var(--ink-2)}
#movil .decision b{color:var(--ink)}
#movil .resp .enviar:disabled{opacity:.45}
#movil .resp .nota-r{flex-basis:100%;color:var(--mute);font-size:14px}
#movil .resp{flex-wrap:wrap}
#movil .resp-err{margin:8px var(--pad) 0;color:var(--red);font-size:14px}
#movil .solo-mac{margin:10px var(--pad) 0;font-size:14px;color:var(--mute)}
#movil .op-a .btn:disabled{opacity:.5}
#movil .op .vacia{color:var(--mute)}
#movil .tarea .casilla{touch-action:manipulation;position:relative}
#movil .tarea .casilla::after,#movil .chip::after,#movil .nube::after,#movil .nueva-meta .chip::after{content:'';position:absolute;inset:-9px}
#movil .chip,#movil .nube{position:relative}
#movil .chip::after{inset:-4px -2px}#movil .nube::after{inset:-7px -2px}
#movil .nueva .ib{position:relative}#movil .nueva .ib::after{content:'';position:absolute;inset:-2px}
#movil .tarea .tx{cursor:pointer}
#movil .tarea .tm .av{width:20px;height:20px;font-size:10px}
#movil .tarea.nota .tt{font-weight:500}
#movil .nueva .ib.puesta{color:var(--acc-ink)}
#movil .nueva-meta{display:flex;flex-wrap:wrap;gap:8px;margin:8px var(--pad) 0}
#movil .nueva-meta .chip{height:32px;font-size:13px}
#movil .nueva-meta .chip svg{width:14px;height:14px}
#movil .chip .av{width:20px;height:20px;font-size:10px}
#movil .tabs .tab{min-height:56px}
#movil .tabs .tab:active svg{transform:scale(.92)}
#movil .tabs .tab svg{transition:transform var(--d1) var(--ease)}
#movil .velo{opacity:0;transition:opacity .28s var(--ease)}
#movil .velo.on{opacity:1}
#movil .hoja{transform:translateY(105%);transition:transform .34s var(--ease-m);will-change:transform;touch-action:pan-y}
#movil .hoja.on{transform:none}
#movil .hoja .asa{touch-action:none;padding:8px 0;margin:-8px auto 4px;width:60px;height:21px;background:none;position:relative}
#movil .hoja .asa::after{content:'';position:absolute;left:11px;right:11px;top:8px;height:5px;border-radius:3px;background:var(--line-strong)}
#movil .hoja .pie{position:sticky;bottom:calc(-16px - var(--sa-b));margin:16px calc(-1 * var(--pad)) calc(-16px - var(--sa-b));padding:12px var(--pad) calc(16px + var(--sa-b));background:var(--panel);border-top:1px solid var(--line2)}
#movil .hoja .pie .botones{margin-top:0}
#movil .hoja textarea,#movil .hoja input[type=text]{width:100%;min-height:52px;padding:13px 14px;border-radius:14px;border:1px solid var(--line);background:var(--panel-2);color:var(--ink);font:16px/1.4 var(--font);outline:none;resize:none}
#movil .hoja textarea:focus,#movil .hoja input:focus{border-color:var(--acc);box-shadow:0 0 0 4px var(--ring)}
#movil .hoja .lbl{display:block;font-size:14px;font-weight:500;color:var(--ink-2);margin:14px 0 6px}
#movil .hoja .txt{font-size:16px;line-height:1.5;white-space:pre-line;color:var(--ink)}
#movil .hoja .txt .marca-x{color:var(--mute);text-decoration:line-through}
#movil .btn:disabled{opacity:.5}
#movil .btn:active:not(:disabled){transform:scale(.97)}
#movil .btn{transition:transform var(--d1) var(--ease),opacity var(--d1) var(--ease)}
#movil .estado-op:disabled{opacity:.55}
#movil .estado-op .porque{display:block;font-size:13px;color:var(--red);font-weight:400}
#movil .toast{transform:translateY(12px);opacity:0;transition:transform .3s var(--ease),opacity .3s var(--ease);pointer-events:none}
#movil .toast.on{transform:none;opacity:1}
#movil .toast.error svg,:root[data-theme="dark"] #movil .toast.error svg{color:var(--rojo-tinta)}
#movil .toast.sin-tabs{bottom:calc(20px + var(--sa-b))}
#movil .ver{position:fixed;inset:0;z-index:70;background:#000;display:flex;flex-direction:column;touch-action:pan-y}
#movil .ver .lam{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
#movil .ver img{max-width:100%;max-height:100%;object-fit:contain}
#movil .ver .vtop{position:absolute;left:0;right:0;top:0;z-index:2;padding:calc(var(--sa-t) + 8px) 8px 8px 16px;display:flex;align-items:center;gap:10px;color:#fff;background:linear-gradient(rgba(0,0,0,.55),transparent)}
#movil .ver .vtop .t{flex:1;font-size:15px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.4)}
#movil .ver .vtop .t span{display:block;font-weight:400;font-size:13px;opacity:.85}
#movil .ver .vtop .ib{color:#fff}
#movil .ver .barras{display:flex;gap:4px;padding:0 16px 8px;position:absolute;left:0;right:0;top:calc(var(--sa-t) + 4px);z-index:3}
#movil .ver .barras i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.35)}
#movil .ver .barras i.on{background:#fff}
#movil .ver .lado{position:absolute;top:20%;bottom:20%;width:34%;z-index:1}
#movil .ver .lado.i{left:0}#movil .ver .lado.d{right:0}
#movil .ver .vpie{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:16px 16px calc(var(--sa-b) + 16px);color:#fff;font-size:14px;background:linear-gradient(transparent,rgba(0,0,0,.55))}
#movil .lugar{min-height:40vh;display:grid;place-items:center;color:var(--mute);font-size:15px}
#movil .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#movil .rueda{height:170px;width:84px;overflow:hidden;position:relative;outline:none}
#movil .rueda:focus-visible{box-shadow:0 0 0 2px var(--focus);border-radius:10px}
#movil .rueda-in{height:100%;overflow-y:auto;scroll-snap-type:y mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:69px 0;overscroll-behavior:contain}
#movil .rueda-in::-webkit-scrollbar{display:none}
#movil .rueda-in span{height:32px;display:grid;place-items:center;font-size:21px;font-weight:500;color:var(--ink);scroll-snap-align:center;opacity:calc(1 - var(--d,0) * .32);transform:scale(calc(1 - var(--d,0) * .08));font-variant-numeric:tabular-nums}
#movil .rueda-in span.sel{font-weight:800;font-size:23px}
#movil .ruedas .banda{pointer-events:none}
#movil .sd{touch-action:manipulation;position:relative}
#movil .sd::after{content:'';position:absolute;inset:-2px}
#movil .sd:disabled{color:var(--line-strong);cursor:default}
#movil .sd.otro{visibility:visible;color:var(--faint)}
#movil .cd .p i.f,#movil .leyenda i.f{background:#D9876F}#movil .cd .p i.c,#movil .leyenda i.c{background:#9A7BAA}#movil .cd .p i.r,#movil .leyenda i.r{background:#6E9A76}#movil .cd .p i.co,#movil .leyenda i.co{background:#3F7A4C}#movil .cd .p i.h,#movil .leyenda i.h{background:var(--story)}   /* los colores de la v3 por tipo */
#movil .hoja .lnk{min-height:var(--tap);padding:0 12px;display:inline-flex;align-items:center;color:var(--acc-ink);font-weight:500}
@media (max-height:700px){#movil .sd{height:36px;width:36px}#movil .ruedas,#movil .rueda{height:130px}#movil .rueda-in{padding:52px 0}#movil .rueda-in span{height:26px;font-size:19px}#movil .rueda-in span.sel{font-size:21px}#movil .ruedas .banda{height:30px;margin-top:-15px}}
#movil .hoja{bottom:var(--kb,0px);max-height:calc(100dvh - var(--kb,0px) - var(--sa-t) - 8px)}
#movil .hoja:has(.pie){scroll-padding-bottom:110px}
#movil.teclado .hoja{padding-bottom:16px}#movil.teclado .hoja .pie{bottom:-16px;margin-bottom:-16px;padding-bottom:16px}
#movil .tarea .tm .cn>span:last-child,#movil .campo .v.vista{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#movil .tarea .tm .cn{display:inline-flex}
#movil .sd.hoyd:not(.sel){box-shadow:inset 0 0 0 1.5px var(--line-strong)}
#movil .selcal-pie{display:flex;justify-content:space-between;padding:4px 6px 0}
#movil .estado-op .av{flex:none}
#movil .cuenta .sobra{color:var(--red);font-weight:600}
#movil .estado-op.on .es{font-weight:600}
/* revisiones del lote B */
#movil .top.sin-t .top-in{grid-template-columns:auto 1fr auto}#movil .top.sin-t .nube{max-width:none}
#movil .mv-tema{place-items:center end;padding-right:8px}
#movil .top:has(.back) .nube:has(.q) :is(.num,.qp){display:none}#movil .top:has(.back) .nube{gap:4px;min-width:44px;justify-content:center}
#movil .hoja .lbl.mv-subh{display:flex;justify-content:space-between;align-items:baseline}
#movil .mv-subs{background:var(--panel-2);border-radius:16px;box-shadow:inset 0 0 0 1px var(--line2);padding:0 4px 0 14px}
#movil .mv-sub{align-items:flex-start}#movil .mv-sub:last-child{border-bottom:0}
#movil .mv-sub .casilla{position:relative;margin-top:9px}#movil .mv-sub .casilla::after{content:'';position:absolute;inset:-9px}
#movil .mv-sub .mv-subx{margin-top:0}
#movil .hoja .mv-sub textarea{flex:1;min-width:0;min-height:var(--tap) !important;height:auto;border:0 !important;border-radius:0;background:none !important;padding:11px 0 !important;box-shadow:none !important;font:16px/1.35 var(--font);color:var(--ink);overflow:hidden;resize:none}
#movil .hoja .mv-sub.hecha :is(input,textarea){color:var(--mute);text-decoration:line-through}
#movil .hoja textarea[data-ed="detalles"]{max-height:40vh;overflow-y:auto}
#movil .ty.ses{background:var(--ty-ses);color:var(--ty-ses-ink)}
#movil .mv-sap-b .oj{color:var(--mute)}
#movil .mv-sap-ed{display:flex;justify-content:flex-end;padding:0 6px 0 var(--pad);margin:-8px 0 0}
#movil .mv-sap-ed .lnk{min-height:var(--tap);padding:0 10px;color:var(--acc-ink);font-weight:500}
#movil .mv-mk{flex:none;display:inline-grid;place-items:center;width:18px;height:18px;margin:3px 2px 0 4px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--line);color:var(--on-acc)}
#movil .mv-mk.on{background:var(--acc);box-shadow:none}#movil .mv-mk svg{width:11px;height:11px}
#movil .mv-scl>span{max-width:100%}#movil .mv-scl .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#movil .campo:has(.mv-scl){align-items:flex-start}#movil .campo:has(.mv-scl) .k{padding-top:15px}#movil .campo:has(.mv-scl) .chev{margin-top:12px}
#movil .mv-mat h3{margin:20px 0 8px}#movil .mv-mat h3:first-of-type{margin-top:12px}
#movil .mv-ficha .hj svg{width:15px;height:15px}
#movil .hoja [data-ed-abre="cliente"] .v>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#movil .mv-pubs b{font-weight:600;color:var(--ink-2)}
#movil .mv-desp .selcal{background:none;box-shadow:none;padding:0 2px 6px}
#movil .hoja .pie .mv-desc-t{margin:0 0 10px;font-size:15px;font-weight:600;color:var(--ink);text-align:center}
#movil .btn.mv-desc{background:var(--red-soft);color:var(--red)}
@media (prefers-reduced-motion:reduce){#movil .mv-tema .tr,#movil .mv-tema .k,#movil .mv-tema .k::before,#movil .mv-tema .k::after{transition:none}#movil .mono-w .mono-ll{transition:none}#movil .mv-gira{animation:none;border-color:var(--acc)}#movil .mv-sw i,#movil .mv-sw i::after{transition:none}#movil .hoja,#movil .velo,#movil .toast,#movil .mi,#movil .puntos i,#movil .campo .chev{transition:opacity .2s linear}#movil .hoja{transform:none;opacity:0}#movil .hoja.on{opacity:1}#movil .gira{animation:none}}
#movil .car .lam{aspect-ratio:var(--r,.8)}
@media (orientation:landscape) and (max-height:500px){#movil .car .lam{aspect-ratio:auto;height:70vh}#movil .car .lam img{object-fit:contain}#movil .hoja{max-height:calc(100dvh - 8px)}
  #movil .car,#movil .car .lam{background:var(--bg)}#movil .car{margin-left:calc(-1 * var(--sa-l));margin-right:calc(-1 * var(--sa-r))}#movil .car .cnt{right:max(12px,calc(50% - 35vh * var(--r,.8) + 12px))}
  #movil .tabs-in{height:44px}#movil .tabs .tab{min-height:44px;flex-direction:row;gap:6px;font-size:13px}#movil .tabs .tab .badge{position:static;margin:-12px 0 0 -2px}#movil .tab svg{width:21px;height:21px}#movil .main{padding-bottom:calc(60px + var(--sa-b))}
  #movil .titulo h1,#movil .mesnav h1{font-size:24px}#movil .toast{bottom:calc(56px + var(--sa-b))}}
#movil .main{padding-left:var(--sa-l);padding-right:var(--sa-r)}
#movil .top-in{padding-left:calc(8px + var(--sa-l));padding-right:calc(8px + var(--sa-r))}
#movil .tabs-in{padding-left:var(--sa-l);padding-right:var(--sa-r)}
#movil .hoja{padding-left:calc(var(--pad) + var(--sa-l));padding-right:calc(var(--pad) + var(--sa-r))}
#movil .hoja .pie{margin-left:calc(-1 * (var(--pad) + var(--sa-l)));margin-right:calc(-1 * (var(--pad) + var(--sa-r)));padding-left:calc(var(--pad) + var(--sa-l));padding-right:calc(var(--pad) + var(--sa-r))}
#movil .hoja .selcal,#movil .hoja .ruedas{max-width:560px;margin-left:auto;margin-right:auto}
#movil .toast{left:calc(var(--pad) + var(--sa-l));right:calc(var(--pad) + var(--sa-r))}
#movil .ver .vtop{padding-left:calc(16px + var(--sa-l));padding-right:calc(8px + var(--sa-r))}
#movil .ver .barras,#movil .ver .vpie{padding-left:calc(16px + var(--sa-l));padding-right:calc(16px + var(--sa-r))}
#movil .cap-t,#movil .op p,#movil .hoja .txt,#movil .decision{max-width:68ch}
#movil .msg{max-width:min(88%,68ch)}
#movil .editor{max-width:calc(68ch + 2 * var(--pad))}
/* el teclado (D-286): la hoja sigue al visualViewport (--vvh su alto, --kb lo que tapa el teclado, con lo que iOS desplazó la vista); las hojas donde se
   escribe (una nota, una tarea, el texto de una sesión) van de arriba abajo, así el teclado no las mueve: con él, de arriba a encima */
#movil .hoja{max-height:calc(var(--vvh,100dvh) - var(--sa-t) - 8px)}
#movil .hoja.mv-grande{display:flex;flex-direction:column;height:calc(var(--vvh,100dvh) - var(--sa-t) - 8px)}
#movil .hoja.mv-grande>*{flex-shrink:0}
#movil .hoja.mv-grande>.pie{margin-top:auto}
#movil .hoja.mv-grande>:has(+ .pie){margin-bottom:16px}
@media (orientation:landscape) and (max-height:500px){#movil .hoja{max-height:calc(var(--vvh,100dvh) - 8px)}#movil .hoja.mv-grande{height:calc(var(--vvh,100dvh) - 8px)}}
#movil .velo{touch-action:none}
/* escribir con el campo del ordenador (escritura.js; su hoja de estilo va bajo #mesa: lección 244) */
#movil .mv-cedw{position:relative}
#movil .mv-ced{display:block;width:100%;min-height:52px;padding:13px 14px;border-radius:14px;border:1px solid var(--line);background:var(--panel-2);color:var(--ink);font:16px/1.5 var(--font);white-space:pre-wrap;overflow-wrap:anywhere;outline:none;caret-color:var(--acc);-webkit-user-select:text;user-select:text;cursor:text}
#movil .mv-ced:focus{border-color:var(--acc);box-shadow:0 0 0 4px var(--ring)}
#movil .mv-ced[data-ed="txt"]{min-height:160px}
#movil .mv-ced[data-sc]{min-height:200px}
#movil .mv-ced:empty::before{content:attr(data-ph);color:var(--mute);pointer-events:none}
#movil .mv-ced[aria-disabled="true"]{color:var(--mute);cursor:default}
#movil ::highlight(pp-em){color:transparent}
#movil ::highlight(pp-en){color:var(--acc-ink)}
#movil ::highlight(pp-es){color:transparent}
#movil ::highlight(pp-eh){color:var(--mute);text-decoration:line-through}
#movil ::highlight(pp-ea){color:var(--acc-ink);text-decoration:underline}
#movil .pp-ecapa{position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:1}
#movil .pp-ecm{position:absolute;pointer-events:none}
#movil .pp-ecm.gris{background:var(--pp-efondo,var(--panel-2));opacity:.45}
#movil .pp-ecm.vi::before{content:'';position:absolute;left:50%;top:50%;width:.3em;height:.3em;margin:-.15em 0 0 -.15em;border-radius:50%;background:var(--acc-ink)}
#movil .pp-ecm.se::before{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:var(--line-strong)}
#movil .pp-ecm.ca{pointer-events:auto;cursor:pointer}
#movil .pp-ecm.ca::before{content:'';position:absolute;right:-.02em;top:50%;width:.8em;height:.8em;margin:-.4em 0 0;box-sizing:border-box;border-radius:50%;box-shadow:inset 0 0 0 1.5px currentColor;opacity:.75}
#movil .pp-ecm.ca.on::before{background:var(--acc);box-shadow:none;opacity:1}
#movil .pp-ecm.ca.on::after{content:'';position:absolute;right:.1em;top:50%;width:.56em;height:.56em;margin:-.28em 0 0;background:var(--on-acc);-webkit-mask:var(--i-check) center/100% no-repeat;mask:var(--i-check) center/100% no-repeat}
/* el menú «/» del iPhone: lo que se puede tocar, de 48 px, sin las teclas del ordenador */
#movil .pp-sm{position:fixed;z-index:70;display:flex;flex-direction:column;width:288px;max-width:calc(100vw - 16px);padding:6px;background:var(--panel-2);border:1px solid var(--line2);border-radius:16px;box-shadow:var(--shadow-lg);animation:mv-smin .18s var(--ease)}
#movil .pp-sm.arriba{animation-name:mv-smup}
@keyframes mv-smin{from{opacity:0;transform:translateY(-3px)}}@keyframes mv-smup{from{opacity:0;transform:translateY(3px)}}
#movil .pp-sm[hidden]{display:none}
#movil .pp-smg{display:flex;flex-direction:column;gap:1px}
#movil .pp-sm hr{margin:5px 8px;border:0;border-top:1px solid var(--line)}
#movil .pp-sm .pp-smo{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:6px 8px;border-radius:12px;text-align:left}
#movil .pp-sm .pp-smo.act,#movil .pp-sm .pp-smo:active{background:var(--bg-2)}
#movil .pp-smi{flex:none;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:var(--bg-2);color:var(--ink-2)}
#movil .pp-smo.act .pp-smi{background:var(--panel)}
#movil .pp-smi svg{width:18px;height:18px;stroke-width:1.75}
#movil .pp-smt{display:flex;flex-direction:column;min-width:0;line-height:1.3}
#movil .pp-smt b{font-size:16px;font-weight:600;color:var(--ink)}
#movil .pp-smm{font-weight:400;color:var(--mute)}
#movil .pp-smt>span{font-size:14px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#movil .pp-smp{display:none}
@media (prefers-reduced-motion:reduce){#movil .pp-sm{animation:none}}
`;
  const estilo = (id, css) => { let s = D.getElementById(id); if (!s) { s = D.createElement('style'); s.id = id; D.head.appendChild(s); } s.textContent = css; };
  estilo('movil-css', MV().tokens('#movil') + '\n' + CSS_V3 + CSS_MAS);

  // ---------- la raíz ----------
  const raiz = D.createElement('div'); raiz.id = 'movil'; raiz.hidden = true; raiz.setAttribute('aria-live', 'off');
  const capas = D.createElement('div'); capas.className = 'capas';
  capas.addEventListener('touchstart', () => {}, { passive: true });   // sin un oyente de toque, iOS no pinta :active (el menú «/» va aquí)
  D.body.appendChild(raiz);

  // ---------- el estado de la nube, siempre a la vista (D-255, D-268) ----------
  const ST = { fase: 'apagada', vistoA: null, sinSubir: 0, opsN: 0, red: navigator.onLine !== false };
  const sinRed = () => !ST.red || ST.fase === 'sin_conexion';
  function chip() {
    const e = ST, q = e.sinSubir + (e.guardando ? 0 : e.opsN), cola = q ? ` <span class="q"><span class="qp">· </span>${q}<span class="qt"> sin subir</span></span>` : '', h = e.vistoA ? horaDe(e.vistoA) : '';
    const b = (k, ico, t, a, lbl) => `<button type="button" class="nube${k ? ' ' + k : ''}" data-a="${a || (q ? 'sinsubir' : 'nube')}" aria-label="${esc(lbl || t.replace(/<[^>]+>/g, '') + (q ? `, ${q} sin subir` : ''))}">${ic(ico)}<span class="num">${t}</span>${cola}</button>`;
    // si todo va bien, nada (D-271, punto 8): ni «Al día» ni «Guardado» (basta el aviso breve al guardar); lo que baja o se guarda
    // lo enseña el monograma (punto 10)
    switch (e.fase) {
      case 'sin_conexion': return b('off', 'nubeoff', q ? 'Sin red' : 'Sin conexión');   // la hora, en la hoja «La nube»
      case 'sin_sesion': return b('off', 'nubeoff', 'Entra otra vez', 'entrar');
      case 'sin_codigo': return b('off', 'alerta', 'Falta el código', 'codigo');
      case 'otra_cuenta': return b('err', 'alerta', 'Otra cuenta', 'otracuenta');
      case 'vieja': return b('off', 'recarga', 'Versión nueva', 'version');
      case 'apagada': return b('off', 'nubeoff', 'Sin nube');
      default: if (!e.red) return b('off', 'nubeoff', q ? 'Sin red' : 'Sin conexión');   // el iPhone sin red, antes de que la nube lo note
        return q ? `<button type="button" class="nube err" data-a="sinsubir" aria-label="${esc(plural(q, 'cambio sin subir', 'cambios sin subir'))}">${ic('alerta')}<span class="num">${q} sin subir</span></button>` : '';
    }
  }
  const pintarChip = () => { raiz.querySelectorAll('.top-r [data-chip],.top-l [data-chip-g]').forEach(x => { x.innerHTML = chip(); }); ajustarTitulo(); };
  // el título de la barra va centrado si cabe así; si no, ocupa el hueco que dejan los lados (como iOS)
  function ajustarTitulo() { raiz.querySelectorAll('.top').forEach(t => { const x = t.querySelector('.top-t'); if (!x || !x.textContent) return; t.classList.remove('ajusta'); if (x.scrollWidth > x.clientWidth + 1) t.classList.add('ajusta'); }); }

  // ---------- el monograma que se llena (D-271, punto 10) ----------
  // Fuentes: guardar (sus pasos: coger, aplicar, subir y soltar), las fotos que bajan (el pegamento las cuenta) y las filas que trae
  // una mirada larga (una página tras otra). Solo se vacía si el trabajo dura más de 0,4 s: una mirada corta no lo toca.
  const TRAB = { guardar: null, fotos: { pend: 0, hechas: 0 }, filasHasta: 0, filasP: 0, visible: false, p: 1, que: '', t0: 0, tim: 0 };
  function pintarMono() {
    const on = TRAB.visible, p = Math.max(0, Math.min(1, TRAB.p));
    raiz.querySelectorAll('[data-mono]').forEach(w => {
      w.classList.toggle('trabaja', on); w.style.setProperty('--vacio', on ? ((1 - p) * 100).toFixed(1) + '%' : '0%');
      if (w.classList.contains('mini')) w.hidden = !on;
      if (!w.closest('.top-g')) { if (on) { w.setAttribute('role', 'img'); w.setAttribute('aria-label', `${TRAB.que} · ${Math.round(p * 100)} %`); } else if (w.classList.contains('mini')) w.removeAttribute('aria-label'); else { w.removeAttribute('role'); w.removeAttribute('aria-label'); } }
    });
  }
  function trabajo() {
    const g = TRAB.guardar, f = TRAB.fotos, filas = Date.now() < TRAB.filasHasta, activo = g != null || f.pend > 0 || filas;
    if (activo) {
      TRAB.p = g != null ? g : f.pend > 0 ? f.hechas / (f.hechas + f.pend) : TRAB.filasP; TRAB.que = g != null ? 'Guardando' : 'Bajando la Mesa';
      if (!TRAB.t0) { TRAB.t0 = Date.now(); clearTimeout(TRAB.tim); TRAB.tim = setTimeout(() => { if (TRAB.t0) { TRAB.visible = true; pintarMono(); ajustarTitulo(); } }, 400); }
      if (TRAB.visible) pintarMono();
    } else if (TRAB.t0) {
      TRAB.t0 = 0; clearTimeout(TRAB.tim);
      if (TRAB.visible) { TRAB.p = 1; pintarMono(); TRAB.tim = setTimeout(() => { TRAB.visible = false; pintarMono(); ajustarTitulo(); }, 450); }
    }
  }
  D.addEventListener('mesa-bajan-fotos', e => { const d = e.detail || {}; TRAB.fotos = { pend: +d.pend || 0, hechas: +d.hechas || 0 }; trabajo(); });

  // la píldora del modo en uso (como la del Mac, D-134 y D-143: sol en claro, luna con dos cráteres en oscuro); abre «Apariencia»
  const pildora = () => { const o = oscuro(), t = temaElegido(); return `<button type="button" class="mv-tema${o ? ' osc' : ''}" data-a="tema" aria-haspopup="dialog" aria-label="Apariencia: ${o ? 'oscuro' : 'claro'}${t ? '' : ', como el iPhone'}"><span class="tr"><span class="k"></span></span></button>`; };
  function pintarPildora() { raiz.querySelectorAll('.mv-tema').forEach(b => { const o = oscuro(), t = temaElegido(); b.classList.toggle('osc', o); b.setAttribute('aria-label', `Apariencia: ${o ? 'oscuro' : 'claro'}${t ? '' : ', como el iPhone'}`); }); }

  // ---------- las fotos: cada una a su tamaño en pantalla, 3 como mucho a la vez (nunca el original) ----------
  // La miniatura de la Mesa (1.600 px) es la foto: se decodifica una a una, se dibuja al tamaño que se ve (por la densidad del iPhone)
  // y se suelta. El recorte es el de la publicación (vista.recortes, del núcleo). Una que aún no ha llegado (D-256) lo dice.
  const MINIS = new Map(), COLA = [], DPR = Math.min(3, W.devicePixelRatio || 1); let decodificando = 0;
  const claveMini = (id, px, r) => id + '|' + px + '|' + (r ? [r.x, r.y, r.w, r.h].map(v => v.toFixed(4)).join(',') : '');
  // sin miniatura = el hueco (D-271, punto 1): `pendiente` de M.files dice que el original sigue arriba, no que falte la miniatura
  const pendiente = id => { const b = M.thumbBlobs && M.thumbBlobs[id]; return !b || b === X().hueco(); };
  function miniDe(id, px, r, blob) {
    const k = claveMini(id, px, r); if (MINIS.has(k)) return MINIS.get(k);
    const p = new Promise((res, rej) => { COLA.push({ id, px, r, blob, res, rej }); correrMinis(); });
    MINIS.set(k, p); p.catch(() => MINIS.delete(k));
    return p;
  }
  // la foto de una tarea o de una sesión (D-271, punto 1): la nube la baja al verse, una a una; aquí se dibuja como las demás
  async function miniArch(a, k, ruta, px) {
    const id = a + '|' + k + '|' + ruta, c = claveMini(id, px, null); if (MINIS.has(c)) return MINIS.get(c);
    const b = M.nube && M.nube.archivo ? await M.nube.archivo(a, k, ruta) : null;
    return b ? miniDe(id, px, null, b) : null;   // sin ella todavía: nada guardado, se pide otra vez cuando llegue
  }
  function correrMinis() {
    while (decodificando < 3 && COLA.length) {
      const t = COLA.shift(); decodificando++;
      hacerMini(t).then(t.res, t.rej).finally(() => { decodificando--; correrMinis(); });
    }
  }
  async function hacerMini({ id, px, r, blob }) {
    const b = blob || (M.thumbBlobs && M.thumbBlobs[id]); if (!b) throw new Error('sin foto');
    const bm = await createImageBitmap(b);
    try {
      const sx = r ? r.x * bm.width : 0, sy = r ? r.y * bm.height : 0, sw = r ? r.w * bm.width : bm.width, sh = r ? r.h * bm.height : bm.height;
      const k = Math.min(1, (px * DPR) / Math.max(1, sw)), cw = Math.max(1, Math.round(sw * k)), ch = Math.max(1, Math.round(sh * k));
      const c = D.createElement('canvas'); c.width = cw; c.height = ch;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bm, sx, sy, sw, sh, 0, 0, cw, ch);
      const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.86)); c.width = c.height = 0;
      if (!blob) throw new Error('no se pudo dibujar');
      return URL.createObjectURL(blob);
    } finally { if (bm.close) bm.close(); }
  }
  const olvidarMini = id => { for (const [k, p] of [...MINIS]) if (k.startsWith(id + '|')) { MINIS.delete(k); p.then(u => setTimeout(() => URL.revokeObjectURL(u), 3000), () => {}); } };
  // un <img class="mi" data-id data-px data-r> se llena al acercarse a la vista
  const vigia = 'IntersectionObserver' in W ? new IntersectionObserver(l => l.forEach(e => { if (e.isIntersecting) { vigia.unobserve(e.target); llenar(e.target); } }), { rootMargin: '300px 0px' }) : null;
  function llenar(img) {
    const id = img.dataset.id, px = +img.dataset.px || 120, r = img.dataset.r ? JSON.parse(img.dataset.r) : null, hue = img.parentNode && img.parentNode.querySelector('.hueco');
    if (img.dataset.alm) { miniArch(img.dataset.alm, img.dataset.k, img.dataset.ruta, px).then(u => { if (!u) { if (hue) hue.hidden = false; return; } if (hue) hue.hidden = true; if (img.isConnected) { img.src = u; img.classList.remove('cargando'); } }, () => { if (hue) hue.hidden = false; }); return; }
    if (pendiente(id)) { if (hue) hue.hidden = false; return; }
    if (hue) hue.hidden = true;
    miniDe(id, px, r).then(u => { if (img.isConnected) { img.src = u; img.classList.remove('cargando'); } }, () => { if (hue) hue.hidden = false; });
  }
  function vigilarFotos(el) { el.querySelectorAll('img.mi:not([src])').forEach(i => { if (vigia) vigia.observe(i); else llenar(i); }); }
  D.addEventListener('mesa-foto-llego', e => {   // una miniatura bajó (lote 4 del traspaso): se vuelve a dibujar donde se ve
    const id = e.detail && e.detail.id; if (!id) return;
    olvidarMini(id); raiz.querySelectorAll(`img.mi[data-id="${CSS.escape(id)}"]`).forEach(i => { i.removeAttribute('src'); llenar(i); });
  });
  D.addEventListener('mesa-archivo-llego', e => {   // una foto de una tarea o de una sesión bajó: donde se ve, se rellena en su sitio
    const d = e.detail || {}; if (!d.a) return;
    raiz.querySelectorAll(`img.mi[data-alm="${CSS.escape(d.a)}"][data-k="${CSS.escape(String(d.k))}"][data-ruta="${CSS.escape(d.ruta)}"]:not([src])`).forEach(llenar);
  });
  const HUECO = `<span class="hueco" hidden>${ic('nube')}<span>Llega en un momento</span></span>`;
  const foto = (id, px, r) => id ? `<img class="mi cargando" data-id="${esc(id)}" data-px="${px}"${r ? ` data-r='${esc(JSON.stringify(r))}'` : ''} alt="">${HUECO}` : '';
  const fotoArch = (a, k, ruta, px) => `<img class="mi cargando" data-alm="${esc(a)}" data-k="${esc(k)}" data-ruta="${esc(ruta)}" data-px="${Math.round(px)}" alt="">${HUECO}`;
  const cargarMinis = ids => { const l = [...new Set(ids.filter(Boolean))]; return l.length ? X().loadThumbs(l).catch(() => []) : Promise.resolve([]); };

  // ---------- piezas comunes ----------
  const TY = { Foto: 'foto', Carrusel: 'carr', Reel: 'reel', 'Collab Reel': 'collab', 'Trial Reel': 'reel' };
  const ty = t => `<span class="ty ${TY[t.k] || (t.reel ? 'reel' : 'foto')}">${esc(t.txt)}</span>`;
  const marcaEst = k => X().estIco(k, ' aria-hidden="true"');   // la del Mac, del núcleo (D-287): también para lo que arma el iPhone (lo que tocaría, un cambio que se guarda)
  const est = e => `<span class="es ${esc(e.k)}">${marcaEst(e.k)}${esc(e.txt)}</span>`;
  // el monograma: su capa de color se llena de abajo arriba mientras el iPhone baja algo o guarda (D-271, punto 10); en las pantallas
  // con «‹ atrás», uno pequeño a la derecha de la barra que solo sale entonces (variante B)
  const mono = mini => `<span class="mono-w${mini ? ' mini' : ''}" data-mono${mini ? ' hidden' : ''}><img class="mono" src="portal/marca/monograma.svg" alt="${mini ? '' : 'Uribe Visuals'}" width="30" height="30"><img class="mono mono-ll" src="portal/marca/monograma.svg" alt="" aria-hidden="true" width="30" height="30"></span>`;
  function top(o = {}) {
    const izq = o.atras ? `<button type="button" class="back" data-a="atras" data-destino="${esc(o.destino || prevDe() || 'clientes')}" aria-label="Volver a ${esc(o.atras)}">${ic('izq', 2)}<span>${esc(o.atras)}</span></button>` : mono(false);
    const mini = o.atras ? mono(true) : '';
    // cada lado reserva, sin verse, lo que ocupa el otro: el título va centrado con estado o sin él y no salta (D-271, punto 8)
    const fant = h => `<span class="top-g" aria-hidden="true" inert>${h}</span>`;
    const ext = o.extra || '';
    const g = o.t || o.atras ? fant : () => '';   // sin título no hay nada que centrar: sin lados fantasma (la píldora de Hoy no se sale, revisión del lote B)
    return `<header class="top${o.linea ? ' linea' : ''}${o.t || o.atras ? '' : ' sin-t'}"><div class="top-in"><div class="top-l">${izq}${g(`<span class="top-fila">${mini}${o.r || `<span data-chip-g>${chip()}</span>`}${ext}</span>`)}</div><div class="top-t">${esc(o.t || '')}</div><div class="top-r"><span class="top-fila">${mini}${o.r || `<span data-chip>${chip()}</span>`}${ext}</span>${g(izq)}</div></div></header>`;
  }
  function tabs(on) {
    const n = TAREAS_PASADO;
    const t = (k, i, txt) => `<button type="button" class="tab${on === k ? ' on' : ''}" data-ir="${k}"${on === k ? ' aria-current="page"' : ''}>${ic(i, on === k ? 2 : 1.75)}${txt}${k === 'tareas' && n ? `<span class="badge num" aria-label="${plural(n, 'tarea se ha pasado', 'tareas se han pasado')}">${n}</span>` : ''}</button>`;
    return `<nav class="tabs" aria-label="Secciones"><div class="tabs-in">${t('hoy', 'casa', 'Hoy')}${t('clientes', 'gente', 'Clientes')}${t('tareas', 'tareas', 'Tareas')}</div></nav>`;
  }
  const fila = o => `<button type="button" class="fila" ${o.a}>${o.izq || ''}<span class="tx"><span class="t1">${o.t1}</span><span class="t2">${o.t2}</span></span>${o.hr ? `<span class="hr num${o.hrRoja ? ' roja' : ''}">${esc(o.hr)}</span>` : ''}<span class="chev">${ic('der')}</span></button>`;
  const miniFila = (id, ico) => `<span class="ft">${foto(id, 60)}${ico ? `<span class="tyi">${ico}</span>` : ''}</span>`;
  const icoFila = (n, roja) => `<span class="ft ico${roja ? ' roja' : ''}"><span>${ic(n)}</span></span>`;
  const iniciales = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
  const KIT = new Map();
  function av(cid, g) {
    const c = (X().CL || []).find(x => x.id === cid) || (M.personal && M.personal._p && M.personal._p.cliDe(cid)) || { name: '?' };
    const f = c.foto && M.files && M.files[c.foto], col = KIT.get(cid);
    const fondo = col ? ` style="background:${esc(col)}"` : '';
    return `<span class="av${g ? ' g' : ''}" aria-hidden="true"${fondo}>${f && f.thumbUrl ? `<img src="${f.thumbUrl}" alt="">` : esc(iniciales(c.name).slice(0, 1))}</span>`;
  }
  const nombreCli = cid => { const c = (X().CL || []).find(x => x.id === cid) || (M.personal && M.personal._p && M.personal._p.cliDe(cid)); return c ? c.name || c.txt || cid : cid; };
  const tramos = k => { const L = X().PASOS, i = Math.max(0, L.findIndex(x => x[0] === k)); return `<div class="tramos" role="img" aria-label="${esc((L[i] || [k, k])[1])}">${L.map((_, j) => `<i class="${j < i ? 'h' : j === i ? 'a' : ''}"></i>`).join('')}</div>`; };
  const pasoTxt = k => (X().PASOS.find(x => x[0] === k) || [k, k])[1];
  const vacio = (t, s) => `<div class="vacio"><b>${esc(t)}</b>${s ? esc(s) : ''}</div>`;
  const mal = (t, a) => `<div class="mal" role="alert">${ic('alerta')}<span>${esc(t)}</span><button type="button" data-a="${a || 'reintentar'}">Reintentar</button></div>`;

  // ---------- la navegación: #hoy, #clientes, #tareas, #mes/<tablero>/<vista>[/<mes>], #pub/<tablero>/<id>, #cap/…, #ret/…/<k>, #his/<tablero>/<id> ----------
  const leerRuta = () => { const p = decodeURIComponent((location.hash || '#hoy').slice(1)).split('/'); return { p: p[0] || 'hoy', a: p[1] || '', b: p[2] || '', c: p[3] || '' }; };
  let RUTA = leerRuta();
  // atrás (D-271, punto 3): cada entrada guarda de dónde se vino (history.state.prev). Abrir algo apila; cambiar de vista o de mes
  // dentro de un cliente sustituye la entrada (conserva su prev); las pestañas empiezan de cero. «‹ X» vuelve con history.back()
  // solo si la entrada anterior es X; si no, va a X sin apilar: así el botón y el gesto de Safari hacen lo mismo.
  const rutaAhora = () => decodeURIComponent((location.hash || '#hoy').slice(1));
  const prevDe = () => (history.state && typeof history.state.prev === 'string' ? history.state.prev : null);
  const ir = (h, modo) => {   // modo: nada = apilar; 'sustituir' = la misma entrada con su prev; 'raiz' = la misma entrada, sin prev
    const u = '#' + h.split('/').map(encodeURIComponent).join('/');
    if (modo === 'sustituir') history.replaceState({ prev: prevDe() }, '', u); else if (modo === 'raiz') history.replaceState({ prev: null }, '', u); else history.pushState({ prev: rutaAhora() }, '', u);
    RUTA = leerRuta(); W.scrollTo(0, 0); pintar();
  };
  W.addEventListener('popstate', () => { cerrarHojas(true); RUTA = leerRuta(); pintar(); });
  const atras = dest => { dest = dest || 'hoy'; if (prevDe() === dest) history.back(); else ir(dest, 'raiz'); };
  const avanzar = h => ir(h);
  // a dónde vuelve cada pantalla y cómo se llama ese sitio
  const volverMes = () => { const pv = prevDe(); return pv === 'hoy' ? { atras: 'Hoy', destino: 'hoy' } : { atras: 'Clientes', destino: 'clientes' }; };
  function volverPub(v, p) {
    const pv = prevDe();
    if (pv === 'hoy') return { atras: 'Hoy', destino: 'hoy' };
    if (pv && pv.startsWith(`mes/${v.key}/`)) { const m = pv.split('/')[3]; return { atras: mesNombre(/^\d{4}-\d{2}$/.test(m || '') ? m : p.mes), destino: pv }; }
    return { atras: mesNombre(p.mes), destino: `mes/${v.key}/lista/${p.mes}` };
  }

  // ---------- lo leído (todo del núcleo); lo que falla se dice, nunca se enseña como vacío ----------
  const L = { hoy: null, clientes: null, tareas: null, vista: null, conv: null, error: {} };
  let TAREAS_PASADO = 0;
  async function leerHoy() {
    try {
      const a0 = AVT, R = await M.personal.datos({ modo: 'semana', desp: 0, avTareas: a0 });
      await cargarMinis(R.items.filter(x => x.tipo === 'post').map(x => x.s.photos && x.s.photos[0]));
      try { if (M.web && M.web.leerRespuestas) await M.web.leerRespuestas(); } catch (e) { /* sin web: sin «ha contestado» */ }
      if (a0 !== AVT) return;   // el interruptor cambió mientras se leía: vale la lectura del valor nuevo
      L.hoy = R; L.error.hoy = '';
    } catch (e) { L.error.hoy = 'No se pudo leer Hoy.'; }
  }
  async function leerClientes() {
    try {
      const R = await M.personal.datos({ modo: 'mes', desp: 0, avTareas: false }), boards = (await X().idbAll('boards')) || [];
      await cargarMinis((X().CL || []).map(c => c.foto));
      for (const c of X().CL || []) if (!KIT.has(c.id) && M.personal._p && M.personal._p.kitColor) { KIT.set(c.id, null); M.personal._p.kitColor(c.id, { boards }).then(v => { if (v) { KIT.set(c.id, v); if (RUTA.p === 'clientes') pintar(); } }, () => {}); }
      L.clientes = { R, boards }; L.error.clientes = '';
    } catch (e) { L.error.clientes = 'No se pudo leer los clientes.'; }
  }
  async function leerTareas() {
    try { L.tareas = await M.personal.lista(); TAREAS_PASADO = L.tareas.filter(x => x.grupo === 'pasado' && !x.hecha).length; L.error.tareas = ''; }
    catch (e) { L.error.tareas = 'No se pudo leer las tareas.'; }
  }
  async function leerMes(key) {
    try {
      const v = await MV().mirar(key);
      if (!v || v.error) throw new Error((v && v.error) || 'sin tablero');
      L.vista = v; L.error.mes = '';
      leerConv(v.key);
    } catch (e) { L.vista = null; L.error.mes = 'No se pudo abrir este mes.'; }
  }
  async function leerSes(id) {   // una sesión entera (D-275): la vista sale de sesiones.js
    if (!(M.sesiones && M.sesiones.movil)) { L.ses = null; L.error.ses = 'No se pudo leer la sesión: recarga la Mesa.'; return; }
    try { const v = await M.sesiones.movil.vista(id); L.ses = v || { id, falta: true }; L.error.ses = ''; }
    catch (e) { L.ses = null; L.error.ses = 'No se pudo leer la sesión.'; }
  }
  let convDe = '';
  async function leerConv(key) {   // lo que dijo el cliente (D-244, R2): solo leer
    convDe = key;
    try { const c = M.web && M.web.conversacion ? await M.web.conversacion(X().S) : null; if (convDe === key) { L.conv = c; if (RUTA.p === 'pub' || RUTA.p === 'mes') pintarSiQuieto(); } }
    catch (e) { if (convDe === key) L.conv = { error: 'No se pudo leer lo que dijo el cliente.' }; }
  }

  // ---------- Hoy (D-180, D-212, D-236) ----------
  const GRUPOS = [['pasado', 'Se ha pasado'], ['hoy', 'Hoy'], ['espera', 'Esperando al cliente'], ['falta', 'Falta programar']];
  const CIFRAS = [['pasado', 'Se ha pasado'], ['hoy', 'Hoy'], ['man', 'Mañana'], ['espera', 'Esperando al cliente'], ['falta', 'Falta programar']];
  let FILTRO = null, VER_TODO = {}, AVT = false;   // AVT: el interruptor «Tareas» de Hoy, apagado al abrir la app (D-271, punto 2; D-180)
  function lineaAviso(x) {
    const quien = x.clientes.map(nombreCli).join(x.tipo === 'sesion' ? ' · ' : ' × ');
    if (x.tipo === 'cobro') {
      const C = X().cob, r = x.r, nf = r.factura ? 'Factura ' + r.factura : 'Factura de ' + C.nombre(r).toLowerCase();
      return fila({ a: `data-a="cobro"`, izq: icoFila('euro', true), t1: `${esc(nf)} · ${esc(C.eur(r.importe))}`, t2: `${esc(quien)} · <span class="roja">${esc(x.dias === 1 ? 'retrasada 1 día' : `retrasada ${x.dias} días`)}</span>` });
    }
    if (x.tipo === 'tarea' || x.tipo === 'sesion') {
      const pas = x.cat === 'pasado';
      return fila({ a: `data-a="tver" data-id="${esc(x.k.id)}"`, izq: icoFila(x.tipo === 'sesion' ? 'claqueta' : 'tareas', pas), t1: esc(x.k.txt), t2: `${x.tipo === 'sesion' ? 'Sesión' : 'Tarea'}${quien ? ' · ' + esc(quien) : ''}${pas ? ` · <span class="roja">${esc(corto(x.dia))}</span>` : x.hora ? ' · ' + esc(x.hora) : ''}` });
    }
    if (x.tipo === 'historias') return fila({ a: `data-ir="mes/${esc(x.B.key)}/hist"`, izq: icoFila('historias'), t1: esc(plural(x.n, 'historia', 'historias')), t2: `${esc(quien)} · ${esc(plural(x.sin, 'sin programar', 'sin programar'))}` });
    const s = x.s, tp = X().tipoPost(s), esOtro = tp.txt === 'Foto' ? '' : tp.ico;
    const estado = x.e === 'publicado' || !x.e ? '' : est({ k: x.e, txt: (X().ESTADOS.find(z => z[0] === x.e) || [x.e, x.e])[1] });
    let t2;
    if (x.cat === 'pasado') t2 = `${esc(diaCorto(x.dia))}${x.hora ? ' ' + esc(x.hora) : ''} · ${x.mano ? '<span class="roja">publicar a mano</span>' : x.e !== 'programado' ? '<span class="roja">sin programar</span>' : '<span class="roja">vencida</span>'}`;
    else if (x.cat === 'espera') { const w = M.web && M.web.contestado ? M.web.contestado(x.B.client, s.id) : ''; t2 = `${w ? `<span class="acc">${esc(cap1(w))} en su web</span>` : x.e === 'noaprobado' ? '<span class="roja">Pidió cambios</span>' : estado} · ${esc(corto(x.dia))}${x.lleva ? ` · lleva ${x.lleva} días` : ''}`; }
    else if (x.cat === 'falta') t2 = `${esc(corto(x.dia))} · ${estado}${x.aMano ? ' · se programa a mano' : ''}`;
    else t2 = x.mano ? '<span class="acc">publicar a mano</span>' : estado;
    const tyTxt = isReelTxt(s.type) ? s.type : tp.txt;
    return fila({ a: `data-ir="pub/${esc(x.B.key)}/${esc(s.id)}"`, izq: miniFila(s.photos && s.photos[0], esOtro), t1: `${esc(s.name)} <span class="ty ${TY[tyTxt] || 'foto'}">${esc(tyTxt)}</span>`, t2, hr: x.cat === 'hoy' || x.cat === 'man' ? x.hora : '' });
  }
  const isReelTxt = t => /reel/i.test(String(t || ''));
  function pantHoy() {
    const R = L.hoy, h = hoy();
    const sw = `<button type="button" class="mv-sw" role="switch" aria-checked="${AVT}" data-a="avt"><span>Tareas</span><i aria-hidden="true"></i></button>`;   // como en la página del Mac (D-180)
    let html = top({ extra: pildora() }) + `<main class="main" id="contenido"><div class="titulo"><div class="mv-tit"><h1>Hoy</h1>${sw}</div><p>${esc(fechaLarga(h))}</p></div>`;
    if (!R) return html + (L.error.hoy ? mal(L.error.hoy) : `<div class="lugar">Leyendo…</div>`) + '</main>' + tabs('hoy');
    html += `<div class="cifras c5" role="group" aria-label="Avisos">${CIFRAS.map(([k, t]) => { const n = R.cifras[k] || 0; return `<button type="button" class="cifra${k === 'pasado' && n ? ' roja' : ''}${FILTRO === k ? ' on' : ''}" data-a="filtro" data-k="${k}" aria-pressed="${FILTRO === k}"${n || FILTRO === k ? '' : ' disabled'}><span class="v num">${n}</span><span class="k">${t}</span></button>`; }).join('')}</div>`;
    const por = c => R.items.filter(x => x.cat === c);
    let alguno = false;
    for (const [k, t] of GRUPOS) {
      if (FILTRO && FILTRO !== k && !(k === 'hoy' && FILTRO === 'man')) continue;
      const l = k === 'hoy' ? (FILTRO === 'man' ? [] : por('hoy')) : por(k), lm = k === 'hoy' && FILTRO !== 'hoy' ? por('man') : [];
      if (!l.length && !lm.length) continue;
      alguno = true;
      const tope = VER_TODO[k] || FILTRO ? Infinity : k === 'falta' ? 3 : 8;
      if (k === 'hoy') {
        html += `<section class="sec"><div class="sec-h"><h2>${FILTRO === 'man' ? 'Mañana' : 'Hoy'} <span class="n num">${FILTRO === 'man' ? lm.length : l.length || ''}</span></h2></div>`;
        if (FILTRO !== 'man') html += l.length ? `<div class="lista">${l.map(lineaAviso).join('')}</div>` : `<p class="solo-mac" style="margin-top:0">Nada para hoy</p>`;
        if (lm.length) html += `${FILTRO === 'man' ? '' : `<div class="sub-h">Mañana <span class="num">${lm.length}</span></div>`}<div class="lista">${lm.map(lineaAviso).join('')}</div>`;
        html += `</section>`; continue;
      }
      html += `<section class="sec"><div class="sec-h${k === 'pasado' ? ' roja' : ''}"><h2>${t} <span class="n num">${l.length}</span></h2>${l.length > tope ? `<button type="button" class="lnk" data-a="vertodo" data-k="${k}">Ver las ${l.length}</button>` : ''}</div><div class="lista">${l.slice(0, tope).map(lineaAviso).join('')}</div></section>`;
    }
    if (!alguno) html += vacio('Nada pendiente', FILTRO ? 'Con este filtro no hay avisos.' : 'Todo está al día.');
    return html + '</main>' + tabs('hoy');
  }

  // ---------- Clientes ----------
  function pantClientes() {
    const C = L.clientes;
    let html = top() + `<main class="main" id="contenido">`;
    if (!C) return html + `<div class="titulo"><h1>Clientes</h1></div>` + (L.error.clientes ? mal(L.error.clientes) : `<div class="lugar">Leyendo…</div>`) + '</main>' + tabs('clientes');
    const filas = C.R.filas, m0 = C.R.V.w0.slice(0, 7);
    html += `<div class="titulo"><h1>Clientes</h1><p>${esc(plural(filas.length, 'mensual', 'mensuales'))} · ${esc(MES()[+m0.slice(5, 7) - 1])}</p></div>`;
    if (!filas.length) return html + vacio('Sin clientes todavía', 'Se dan de alta en el escritorio.') + '</main>' + tabs('clientes');
    html += `<div class="clis" style="margin-top:18px">${filas.map(f => {
      const m = f.meses[0], B = m && m.B, key = B ? B.key : ((C.boards.filter(b => b.client === f.c.id).sort((a, b) => String(b.month).localeCompare(String(a.month)))[0]) || {}).key;
      return `<button type="button" class="cli"${key ? ` data-ir="mes/${esc(key)}/lista/${esc(m && B ? m.m : '')}"` : ' disabled'}>
      <span class="cli-h" style="display:flex">${av(f.c.id, true)}<span class="nm"><b>${esc(f.c.name)}</b><span>${esc(plural(f.pubs, 'publicación', 'publicaciones'))} · ${esc(plural(f.hs, 'historia', 'historias'))}</span></span><span class="chev">${ic('der')}</span></span>
      ${B ? tramos(m.paso) : `<div class="tramos" aria-hidden="true">${'<i></i>'.repeat(6)}</div>`}
      <span class="cli-p" style="display:flex"><span>${B ? `<b>${esc(pasoTxt(m.paso))}</b>` : 'Sin tablero este mes'}</span>${f.pubSin ? `<span class="acc num">${esc(plural(f.pubSin, 'sin programar', 'sin programar'))}</span>` : B ? '<span>Todo programado</span>' : ''}</span>
    </button>`; }).join('')}</div>`;
    return html + '</main>' + tabs('clientes');
  }

  // ---------- el mes de un cliente: lista, calendario e historias ----------
  const VISTAS = [['lista', 'Lista'], ['cal', 'Calendario'], ['hist', 'Historias']];
  function mesDeRuta(v) { const m = RUTA.c && v.meses.some(x => x.m === RUTA.c) ? RUTA.c : (v.meses.find(x => X().cycleStart(x.m, 1) <= v.hoy && v.hoy.slice(0, 7) === x.m) || v.meses[0]).m; return m; }
  function cabMes(v, m, vista) {
    const i = v.meses.findIndex(x => x.m === m), mx = v.meses[i], posts = v.posts.filter(p => p.mes === m && p.estado.k !== 'cancelado');
    const sin = posts.filter(p => !['programado', 'publicado'].includes(p.estado.k)).length, hs = v.historias.filter(h => !h.cancelada && h.fecha.dia && h.fecha.dia.slice(0, 7) === m).length;
    const otro = (d) => { const j = i + d; return j >= 0 && j < v.meses.length ? `data-ir="mes/${esc(v.key)}/${vista}/${esc(v.meses[j].m)}"` : ''; };
    const ant = otro(-1), sig = otro(1), sigB = !sig && MESES_CLI.sig ? `data-ir="mes/${esc(MESES_CLI.sig)}/${vista}"` : '', antB = !ant && MESES_CLI.ant ? `data-ir="mes/${esc(MESES_CLI.ant)}/${vista}"` : '';
    return top({ ...volverMes(), t: nombreCli(v.client) }) + `<main class="main" id="contenido">`
      + `<div class="mesnav"><h1>${esc(mesNombre(m))}</h1><div class="flechas"><button type="button" class="ib" ${ant || antB} ${ant || antB ? '' : 'disabled'} aria-label="Mes anterior">${ic('izq')}</button><button type="button" class="ib" ${sig || sigB} ${sig || sigB ? '' : 'disabled'} aria-label="Mes siguiente">${ic('der')}</button></div></div>`
      + `<div class="pasos">${tramos(mx.paso.k)}<p><span class="acc">${esc(mx.paso.txt)}</span> · ${esc(plural(sin, 'sin programar', 'sin programar'))} · ${esc(plural(hs, 'historia', 'historias'))}</p></div>`
      + `<div class="seg" role="tablist" aria-label="Vista del mes">${VISTAS.map(([k, t]) => `<button type="button" role="tab" class="${k === vista ? 'on' : ''}" aria-selected="${k === vista}" data-ir="mes/${esc(v.key)}/${k}/${esc(m)}">${t}</button>`).join('')}</div>`;
  }
  let MESES_CLI = { ant: null, sig: null };   // los tableros vecinos del cliente (otro tablero, otro mes)
  async function vecinos(v) {
    const l = ((await X().idbAll('boards')) || []).filter(b => b.client === v.client && b.month).sort((a, b) => String(a.month).localeCompare(String(b.month)));
    const i = l.findIndex(b => b.key === v.key);
    MESES_CLI = { ant: i > 0 ? l[i - 1].key : null, sig: i >= 0 && i < l.length - 1 ? l[i + 1].key : null };
  }
  function comentariosDe(id) { const c = L.conv && L.conv.porSlot && L.conv.porSlot[id]; return c ? c : null; }
  function filaPost(v, p) {
    const c = comentariosDe(p.id), n = c ? c.sinLeer : 0;
    const e = p.tocaria ? { k: 'publicado', txt: 'Publicado' } : p.estado;
    const extra = n ? ` · <span class="acc">${esc(plural(n, 'comentario', 'comentarios'))}</span>` : '';
    const tp = X().tipoPost({ type: p.tipo.k, photos: p.fotos }), ico = p.tipo.txt === 'Foto' ? '' : tp.ico;
    return fila({ a: `data-ir="pub/${esc(v.key)}/${esc(p.id)}"`, izq: `<span class="ft">${foto(p.portada, 60, p.recortes[0])}${ico ? `<span class="tyi">${ico}</span>` : ''}</span>`, t1: `${esc(p.nombre)} ${ty(p.tipo)}`, t2: `${p.vencida && !n ? '<span class="roja">vencida</span> · ' : ''}${est(e)}${extra}`, hr: p.fecha.hora || (p.fecha.sinHora ? 'Sin hora' : ''), hrRoja: p.vencida });
  }
  function diaFila(v, d, n) {
    const r = relativo(d), hs = v.historias.filter(h => !h.cancelada && h.fecha.dia === d).length;
    return `<div class="dia${d === v.hoy ? ' hoy' : ''}"><b>${esc(diaCab(d))}</b>${r && r !== 'Ayer' ? `<span>${r}</span>` : ''}${hs ? `<span class="hs"><i></i>${esc(plural(hs, 'historia', 'historias'))}</span>` : ''}</div>`;
  }
  function pantMes() {
    const v = L.vista, vista = RUTA.b || 'lista';
    if (!v || v.key !== RUTA.a) return top(volverMes()) + `<main class="main" id="contenido">${L.error.mes ? mal(L.error.mes) : `<div class="lugar">Abriendo el mes…</div>`}</main>` + tabs('clientes');
    const m = mesDeRuta(v);
    let html = cabMes(v, m, vista);   // la barra va fuera de <main>, como en las demás
    const posts = v.posts.filter(p => p.mes === m).sort((a, b) => String(a.fecha.dia || '9').localeCompare(String(b.fecha.dia || '9')) || String(a.fecha.hora).localeCompare(String(b.fecha.hora)));
    if (vista === 'lista') {
      if (!posts.length) html += vacio('Este mes no tiene publicaciones', 'Se preparan en el escritorio.');
      // lo ya publicado antes de hoy, plegado en «Publicadas · N» (D-271, punto 12): así hoy queda arriba; lo vencido o sin publicar
      // del pasado sigue a la vista. Se pliega otra vez al entrar en otro mes
      const pas = posts.filter(p => p.fecha.dia && p.fecha.dia < v.hoy && (p.publicada || p.tocaria || p.estado.k === 'publicado')), resto = posts.filter(p => !pas.includes(p));
      if (PUBS.de !== v.key + '|' + m) PUBS.de = v.key + '|' + m, PUBS.abierta = false;   // (y al entrar desde fuera del mes: pintar)
      if (pas.length) {
        const a = pas[0].fecha.dia, z = pas[pas.length - 1].fecha.dia, rango = a === z ? corto(a) : a.slice(0, 7) === z.slice(0, 7) ? `${+a.slice(8, 10)}–${corto(z)}` : `${corto(a)}–${corto(z)}`;
        html += `<button type="button" class="mv-pubs" data-a="pubs" aria-expanded="${PUBS.abierta}"><b>Publicadas</b><span class="n num">· ${pas.length}</span><span class="r num">${esc(rango)}</span><span class="chev">${ic('abajo')}</span></button>`;
        if (PUBS.abierta) html += listaDias(v, pas);
      }
      html += listaDias(v, resto);
    } else if (vista === 'cal') html += calMes(v, m, posts);
    else html += histMes(v, m);
    return html + '</main>' + tabs('clientes');
  }
  const PUBS = { de: '', abierta: false };
  function listaDias(v, posts) {   // las publicaciones por día, cada día con su cabecera
    let h = '', dia = null;
    for (const p of posts) {
      if (p.fecha.dia !== dia) { if (dia !== null) h += '</div>'; dia = p.fecha.dia; h += (dia ? diaFila(v, dia) : `<div class="dia"><b>Sin fecha</b></div>`) + '<div class="lista">'; }
      h += filaPost(v, p);
    }
    return dia !== null ? h + '</div>' : h;
  }
  let DIA_CAL = null;
  function calMes(v, m, posts) {
    const d1 = m + '-01', pre = (dow(d1) + 6) % 7, ini = addD(d1, -pre), dias = Array.from({ length: 42 }, (_, i) => addD(ini, i));
    const enMes = d => d.slice(0, 7) === m, deDia = d => posts.filter(p => p.fecha.dia === d && p.estado.k !== 'cancelado');
    const sel = DIA_CAL && enMes(DIA_CAL) ? DIA_CAL : enMes(v.hoy) ? v.hoy : (posts[0] && posts[0].fecha.dia) || d1;
    const punto = p => /collab/i.test(p.tipo.k) ? 'co' : p.tipo.reel ? 'r' : p.tipo.txt === 'Carrusel' ? 'c' : 'f';
    let h = `<div class="cal"><div class="cal-s" aria-hidden="true">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div><div class="cal-g" role="grid" aria-label="${esc(mesNombre(m))}">`;
    for (const d of dias) {
      const n = enMes(d) ? deDia(d) : [], hs = enMes(d) && v.historias.some(x => !x.cancelada && x.fecha.dia === d);
      const lbl = `${diaCab(d)}${n.length ? ', ' + plural(n.length, 'publicación', 'publicaciones') : ''}${hs ? ', con historias' : ''}`;
      h += `<button type="button" class="cd${enMes(d) ? '' : ' otro'}${d === v.hoy ? ' hoy' : ''}${d === sel ? ' sel' : ''}" data-a="dia" data-d="${d}" aria-label="${esc(lbl)}"${d === sel ? ' aria-pressed="true"' : ''}${enMes(d) ? '' : ' tabindex="-1" aria-hidden="true"'}><span class="n num">${+d.slice(8, 10)}</span><span class="p">${n.slice(0, 3).map(p => `<i class="${punto(p)}"></i>`).join('')}${hs ? '<i class="h"></i>' : ''}</span></button>`;
    }
    h += `</div></div><div class="leyenda"><span><i class="f"></i>Foto</span><span><i class="c"></i>Carrusel</span><span><i class="r"></i>Reel</span><span><i class="co"></i>Collab</span><span><i class="h"></i>Historias</span></div>`;
    const l = deDia(sel);
    h += diaFila(v, sel) + (l.length ? `<div class="lista">${l.map(p => filaPost(v, p)).join('')}</div>` : `<p class="solo-mac" style="margin-top:0">Nada ese día.</p>`);
    return h;
  }
  function histMes(v, m) {
    const l = v.historias.filter(h => h.fecha.dia && h.fecha.dia.slice(0, 7) === m).sort((a, b) => String(a.fecha.dia + a.fecha.hora).localeCompare(String(b.fecha.dia + b.fecha.hora)));
    if (!l.length) return vacio('Sin historias este mes', 'Se preparan en el escritorio.');
    let h = '', dia = null;
    for (const x of l) {
      if (x.fecha.dia !== dia) {
        if (dia !== null) h += '</div>';
        dia = x.fecha.dia; const n = l.filter(y => y.fecha.dia === dia).length, r = relativo(dia);
        h += `<div class="dia${dia === v.hoy ? ' hoy' : ''}"><b>${esc(diaCab(dia))}</b><span>${r && r !== 'Ayer' ? r + ' · ' : ''}${n}</span></div><div class="hgrid">`;
      }
      const pas = x.fecha.dia < v.hoy || (x.fecha.dia === v.hoy && x.fecha.hora && x.fecha.hora <= horaDe(Date.now()));
      const k = x.cancelada ? 'cancelado' : x.programada ? (pas ? 'publicado' : 'programado') : 'empezar';
      h += `<button type="button" class="hc${x.cancelada ? ' cancelada' : ''}" data-ir="his/${esc(v.key)}/${esc(x.id)}" aria-label="Historia de las ${esc(x.fecha.hora || '')}${x.programada ? ', programada' : ', sin programar'}">${foto(x.img, 130)}<span class="hh"><span class="num">${esc(x.fecha.hora || '')}</span>${marcaEst(k)}</span></button>`;
    }
    return h + '</div>';
  }

  // ---------- la publicación ----------
  let ABIERTO = {};   // contexto y nota desplegados
  function pantPub() {
    const v = L.vista, p = v && v.key === RUTA.a && v.posts.find(x => x.id === RUTA.b);
    if (!p) return top({ atras: 'Volver' }) + `<main class="main sin-tabs" id="contenido">${L.error.mes ? mal(L.error.mes) : v && v.key === RUTA.a ? vacio('Esta publicación ya no está', 'Se quitó en el escritorio.') : `<div class="lugar">Abriendo…</div>`}</main>`;
    const r0 = p.recortes[0], ratio = p.tipo.reel ? 9 / 16 : r0 && r0.ratio ? Math.max(0.6, Math.min(1.91, r0.ratio)) : 4 / 5;
    const n = p.fotos.length, e = p.tocaria ? { k: 'publicado', txt: 'Publicado' } : p.estado;
    let html = top({ ...volverPub(v, p), t: nombreCli(v.client) }) + `<main class="main sin-tabs" id="contenido">`;
    html += `<div class="car" style="--r:${ratio}" aria-roledescription="carrusel" aria-label="Fotos de ${esc(p.nombre)}">` + (n ? `<div class="tira" data-car>${p.fotos.map((f, i) => `<div class="lam" style="--r:${ratio}" role="group" aria-label="Foto ${i + 1} de ${n}">${foto(f, Math.min(600, W.innerWidth || 440), p.recortes[i])}</div>`).join('')}</div>${n > 1 ? `<span class="cnt num" data-cnt>1 / ${n}</span>` : ''}` : `<div class="lam" style="--r:${ratio};position:relative"><span class="hueco">${ic('nube')}<span>Sin foto todavía</span></span></div>`) + `</div>`;
    if (n > 1) html += `<div class="puntos" aria-hidden="true">${p.fotos.map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div>`;
    html += `<div class="pub-h"><h1>${esc(p.nombre)}</h1><div class="sub">${ty(p.tipo)}${est(e)}${p.tocaria ? '<span class="es toca">· se marca en el escritorio</span>' : ''}</div></div>`;
    if (p.estado.k === 'cancelado') html += `<div class="aviso gris">${ic('x')}<span>${p.motivo ? 'Cancelada: ' + esc(p.motivo) : 'Cancelada, sin motivo.'}</span></div>`;
    else if (p.vencida) html += `<div class="aviso rojo">${ic('reloj')}<span>Su hora ya pasó sin publicarse.</span></div>`;
    const offline = sinRed() ? ' disabled' : '';
    const fop = enCurso(v.key, p.id, 'fecha'), eop = enCurso(v.key, p.id, 'estado');   // lo que se guarda de fondo, ya a la vista (D-271, punto 9)
    const fVer = fop ? { dia: fop.valor.dia, hora: fop.valor.hora || '' } : p.fecha, eVer = eop ? (eop.valor.v ? { k: eop.valor.v, txt: (X().ESTADOS.find(x => x[0] === eop.valor.v) || [eop.valor.v, eop.valor.v])[1] } : { k: e.k, txt: 'Según sus datos' }) : e;
    html += `<div class="grupo">
      <button type="button" class="campo" data-a="fecha"${p.publicada || offline || fop ? ' disabled' : ''}${fop ? ' aria-busy="true"' : ''}><span class="k">Fecha y hora</span><span class="v num">${esc(campoFecha(fVer))}${p.publicada ? '<span class="por">Ya está publicada: no se mueve.</span>' : ''}</span>${fop ? GIRA : `<span class="chev">${ic('der')}</span>`}</button>
      <button type="button" class="campo" data-a="estado"${offline || eop ? ' disabled' : ''}${eop ? ' aria-busy="true"' : ''}><span class="k">Estado</span><span class="v">${est(eVer)}</span>${eop ? GIRA : `<span class="chev">${ic('der')}</span>`}</button>
    </div>`;
    if (offline) html += `<p class="solo-mac">Sin conexión: no se puede cambiar. Lo que ves es de las ${esc(ST.vistoA ? horaDe(ST.vistoA) : '')}.</p>`;
    const c = p.captions, cop = c && enCurso(v.key, p.id, 'capElegir'), kPick = cop ? cop.valor : c && c.pick, k0 = c && kPick != null ? c.opciones.find(o => o.k === kPick) : null, top0 = k0 && enCurso(v.key, p.id, 'capTexto', k0.k), k = top0 ? { ...k0, texto: top0.valor.texto, editada: true } : k0;
    html += `<div class="cap"><div class="cap-h"><h2>Caption${cop || top0 ? ' ' + GIRA : ''}</h2>${c ? `<button type="button" class="lnk" data-ir="cap/${esc(v.key)}/${esc(p.id)}">${c.opciones.length} opciones</button>` : ''}</div>`
      + (k ? `<div class="cap-b"><div class="cap-t">${esc(k.texto)}</div><span class="tono">Tono <b>${esc(k.tono)}</b>${k.editada ? ' · retocado' : ''}</span></div>`   // entero, sin plegar (D-271, punto 4)
        : c ? `<button type="button" class="cap-b vacia" style="display:block;width:100%;text-align:left" data-ir="cap/${esc(v.key)}/${esc(p.id)}">Sin elegir todavía: ${c.opciones.length} opciones para elegir.</button>`
          : `<div class="cap-b vacia">Sin opciones: pídeselas a Claude.</div>`) + `</div>`;
    const pl = (key, t, txt) => `<button type="button" class="campo pl${ABIERTO[key] ? ' abierto' : ''}" data-a="plegar" data-k="${key}" aria-expanded="${!!ABIERTO[key]}"${txt ? '' : ' disabled'}><span class="k">${t}</span><span class="v vista">${txt ? esc(txt) : 'Sin ' + t.toLowerCase()}</span><span class="chev">${ic('abajo')}</span></button>`;
    html += `<div class="grupo">${pl('ctx', 'Contexto', p.contexto)}${pl('nota', 'Nota', p.nota)}</div>`;
    html += delCliente(v, p);
    return html + '</main>';
  }
  function delCliente(v, p) {
    if (!L.conv) return '';
    if (L.conv.error) return `<section class="sec"><div class="sec-h"><h2>Del cliente</h2></div>${mal(L.conv.error, 'reconv')}</section>`;
    const c = comentariosDe(p.id); if (!c) return '';
    if (c.ultima && M.web && M.web.leido) setTimeout(() => M.web.leido(c.pid, c.ultima), 1500);   // leído en este aparato (su marca, nunca la del Mac)
    const d = c.decision, quien = d && d.autor ? esc(d.autor) : 'El cliente';
    const dec = d && d.tipo !== 'cambios' ? `<p class="decision"><b>${quien}</b> ${d.tipo === 'aprobada' ? 'la aprobó' : 'retiró su decisión'} · ${esc(diaCorto(X().localDay(d.hora)))} ${esc(X().localTime(d.hora))}${d.vieja ? ' · era de una versión anterior' : ''}</p>` : '';
    const items = c.items.map(m => `<div class="msg ${m.de === 'tu' ? 'yo' : 'cli'}"><span class="q">${esc(m.autor || 'Cliente')} · ${esc(diaCorto(X().localDay(m.hora)).toLowerCase())} ${esc(X().localTime(m.hora))}${m.diapositiva ? ' · foto ' + esc(m.diapositiva) : ''}${m.pidioCambios ? ' · pidió cambios' : ''}${m.vieja ? ' · de una versión anterior' : ''}${m.resuelto ? ' · resuelto' : ''}</span>${esc(m.texto)}</div>`).join('');
    const autor = (c.items.filter(m => m.de === 'cliente').pop() || {}).autor || '';
    const borr = lsG('mesa-movil-resp:' + c.pid) || '';
    const resp = c.puedeEscribir ? `<div class="resp"><textarea rows="1" data-resp="${esc(p.id)}" aria-label="${autor ? 'Contestar a ' + esc(autor) : 'Escribir al cliente'}" placeholder="${autor ? 'Contestar a ' + esc(autor) : 'Escribir al cliente'}" maxlength="2000"${sinRed() ? ' disabled' : ''}>${esc(borr)}</textarea><button type="button" class="enviar" data-a="contestar" aria-label="Enviar"${sinRed() || !borr.trim() ? ' disabled' : ''}>${ic('subir', 2.25)}</button></div>` : `<p class="solo-mac">Envía esta publicación a la web desde el escritorio para poder escribir aquí.</p>`;
    if (!items && !dec && !c.puedeEscribir) return '';
    return `<section class="sec"><div class="sec-h"><h2>Del cliente${c.sinLeer ? ` <span class="n acc">${c.sinLeer} sin leer</span>` : ''}</h2></div>${dec}${items ? `<div class="hilo">${items}</div>` : ''}${resp}<p class="resp-err" data-resp-err hidden></p></section>`;
  }

  // ---------- captions (para leer; elegir y retocar, lote 4) ----------
  function pantCaptions() {
    const v = L.vista, p = v && v.key === RUTA.a && v.posts.find(x => x.id === RUTA.b);
    if (!p) return top({ atras: 'Volver' }) + `<main class="main sin-tabs">${L.error.mes ? mal(L.error.mes) : `<div class="lugar">Abriendo…</div>`}</main>`;
    const c = p.captions, off = sinRed();
    let html = top({ atras: p.nombre, destino: `pub/${v.key}/${p.id}` }) + `<main class="main sin-tabs" id="contenido"><div class="titulo"><h1>Captions</h1><p>${esc(p.nombre)} · ${esc(p.tipo.txt)}${p.fecha.dia ? ' · ' + esc(DS[dow(p.fecha.dia)] + ' ' + corto(p.fecha.dia)) : ''}</p></div>`;
    if (!c) html += vacio('Sin opciones todavía', 'Pídeselas a Claude.');   // (abajo, la elegida mientras se guarda, D-271 punto 9)
    const cop = c && enCurso(v.key, p.id, 'capElegir'), pick = cop ? cop.valor : c && c.pick;
    if (c) html += c.opciones.map(o => { const on = o.k === pick; return `<div class="op${on ? ' on' : ''}"><div class="op-h"><b>${esc(o.tono)}</b>${on ? `<span class="elegido">${cop ? GIRA : ic('check', 2.25)}Elegido</span>` : ''}</div><p>${o.texto ? esc(o.texto) : '<span class="vacia">Vacío</span>'}</p>${o.editada ? '<p class="solo-mac" style="margin:8px 0 0">Retocado</p>' : ''}
      <div class="op-a">${on ? `<button type="button" class="btn sua" data-ir="ret/${esc(v.key)}/${esc(p.id)}/${o.k}"${off ? ' disabled' : ''}>Retocar</button>` : `<button type="button" class="btn sua" data-a="elegir" data-k="${o.k}"${off ? ' disabled' : ''}>Elegir esta</button>`}</div></div>`; }).join('');
    if (off) html += `<p class="solo-mac">Sin conexión: no se puede cambiar.</p>`;
    html += `<div class="llave" style="margin:16px var(--pad) 0">${ic('chispa')}<span>¿Otras? Pídeselas a Claude: «genera los captions de ${esc(nombreCli(v.client))}».</span></div>`;
    return html + '</main>';
  }

  // ---------- Tareas ----------
  let FILTRO_T = '';
  function pantTareas() {
    let html = top() + `<main class="main" id="contenido">`;
    const l0 = L.tareas;
    if (!l0) return html + `<div class="titulo"><h1>Tareas</h1></div>` + (L.error.tareas ? mal(L.error.tareas) : `<div class="lugar">Leyendo…</div>`) + '</main>' + tabs('tareas');
    const l = l0.filter(x => !FILTRO_T || x.clientes.includes(FILTRO_T)), nHoy = l.filter(x => x.grupo === 'hoy' && !x.hecha).length, nPas = l.filter(x => x.grupo === 'pasado').length;
    html += `<div class="titulo"><h1>Tareas</h1><p>${esc(plural(nHoy, 'para hoy', 'para hoy'))}${nPas ? ` · <span class="acc">${esc(plural(nPas, 'se ha pasado', 'se han pasado'))}</span>` : ''}</p></div>`;
    html += nuevaHTML();
    const nuevas = opsLeer().filter(o => o.estado === 'nueva' && o.campo === 'tareaNueva');   // las que se están creando, ya a la vista
    if (nuevas.length) html += `<div class="lista" style="margin-top:14px">${nuevas.map(o => `<div class="tarea mv-nueva">${GIRA}<span class="tx"><span class="tt">${esc(String(o.valor.txt).split('\n')[0])}</span><span class="tm">${o.valor.tipo === 'nota' ? 'Nota' : 'Tarea'} · guardando</span></span></div>`).join('')}</div>`;
    const clis = [...new Set(l0.flatMap(x => x.clientes))];
    if (clis.length) html += `<div class="filtro" role="group" aria-label="Ver las tareas de"><button type="button" class="chip solo${FILTRO_T ? '' : ' on'}" data-a="tcli" data-c="" aria-pressed="${!FILTRO_T}">Todos</button>${clis.map(c => `<button type="button" class="chip${FILTRO_T === c ? ' on' : ''}" data-a="tcli" data-c="${esc(c)}" aria-pressed="${FILTRO_T === c}">${av(c)}${esc(String(nombreCli(c)).split(' ')[0])}</button>`).join('')}</div>`;
    const G = [['pasado', 'Se ha pasado'], ['hoy', 'Hoy'], ['man', 'Mañana'], ['despues', 'Más adelante'], ['sinfecha', 'Sin fecha']];
    let alguno = false;
    G.forEach(([k, t], i) => { const g = l.filter(x => x.grupo === k); if (!g.length) return; alguno = true; html += `<section class="sec"${i === 0 || !alguno ? ' style="margin-top:18px"' : ''}><div class="sec-h${k === 'pasado' ? ' roja' : ''}"><h2>${t}</h2></div><div class="lista">${g.map(tareaHTML).join('')}</div></section>`; });
    if (!alguno) html += vacio('Nada en tareas', FILTRO_T ? 'Este cliente no tiene tareas.' : 'Escribe una arriba.');
    return html + '</main>' + tabs('tareas');
  }
  function tareaHTML(x) {
    const hop = enCurso(null, x.id, 'tarea'); if (hop) x = { ...x, hecha: hop.valor.hecha ? x.hecha || new Date().toISOString() : null };   // marcada, mientras se guarda (D-271, punto 9)
    const tex = enCurso(null, x.id, 'tareaTexto'), fop = enCurso(null, x.id, 'tareaFecha'), edita = !!(tex || fop || opsLeer().some(o => o.estado === 'nueva' && o.slot === x.id && NUEVOS.test(o.campo)));
    if (tex) x = { ...x, txt: tex.valor }; if (fop) x = { ...x, fecha: fop.valor || null };   // lo editado, ya a la vista (D-272)
    const nota = x.tipo === 'nota', ses = x.tipo === 'sesion';
    const meta = [];
    if (nota) meta.push(`Nota · ${esc(plural(String(x.txt).split('\n').length, 'línea', 'líneas'))}`);
    if (x.hecha && !nota) meta.push(`Hecha a las ${esc(X().localTime(x.hecha))}`);
    else if (x.grupo === 'pasado' && x.fecha) meta.push(`<span class="roja">${esc(corto(x.fecha))}</span>`);
    else if (x.grupo === 'despues' && x.fecha) meta.push(esc(cap1(DS[dow(x.fecha)]) + ' ' + corto(x.fecha)));
    if (ses) meta.push(`<span style="display:inline-flex">${ic('claqueta')}</span>${x.hora ? `<span class="num">${esc(x.hora)}</span>` : ''}`);
    if (!x.hecha || nota) x.clientes.slice(0, 2).forEach(c => meta.push(`<span class="cn">${av(c)}<span>${esc(nombreCli(c))}</span></span>`));
    if (x.subtareas) meta.push(`${x.subtareas.hechas}/${x.subtareas.n}`);
    const titulo = nota ? String(x.txt).split('\n')[0] : x.txt;
    const casilla = nota ? `<span class="nota-ic">${ic('nota')}</span>` : `<button type="button" class="casilla" data-a="hecha" data-id="${esc(x.id)}" role="checkbox" aria-checked="${!!x.hecha}" aria-label="${esc(x.hecha ? 'Hecha: ' + titulo : 'Marcar como hecha: ' + titulo)}"${sinRed() || hop ? ' disabled' : ''}${hop ? ' aria-busy="true"' : ''}>${ic('check', 2.5)}</button>`;
    return `<div class="tarea${x.hecha && !nota ? ' hecha' : ''}${nota ? ' nota' : ''}">${casilla}<span class="tx" data-a="tver" data-id="${esc(x.id)}" role="button" tabindex="0"><span class="tt">${esc(titulo)}${edita ? ' ' + GIRA : ''}</span><span class="tm">${meta.join('')}</span></span></div>`;
  }
  const NUEVA = { txt: '', fecha: '', cliente: '' };
  function nuevaHTML() {
    const off = sinRed();
    return `<div class="nueva"><input type="text" data-nueva placeholder="${off ? 'Sin conexión: no se puede crear' : 'Nueva tarea'}" aria-label="Nueva tarea" enterkeyhint="done" autocomplete="off" value="${esc(NUEVA.txt)}"${off ? ' disabled' : ''}><button type="button" class="ib${NUEVA.fecha ? ' puesta' : ''}" data-a="nfecha" aria-label="Fecha de la tarea"${off ? ' disabled' : ''}>${ic('cal')}</button><button type="button" class="ib${NUEVA.cliente ? ' puesta' : ''}" data-a="ncliente" aria-label="Cliente de la tarea"${off ? ' disabled' : ''}>${ic('cliente')}</button><button type="button" class="ib" data-a="nnota" aria-label="Guardar como nota"${off ? ' disabled' : ''}>${ic('nota')}</button></div>`
      + (NUEVA.fecha || NUEVA.cliente ? `<div class="nueva-meta">${NUEVA.fecha ? `<button type="button" class="chip" data-a="nfecha">${ic('cal')}${esc(cap1(DS[dow(NUEVA.fecha)]) + ' ' + corto(NUEVA.fecha))}</button>` : ''}${NUEVA.cliente ? `<button type="button" class="chip" data-a="ncliente">${av(NUEVA.cliente)}${esc(nombreCli(NUEVA.cliente))}</button>` : ''}</div>` : '');
  }

  // ---------- las historias a pantalla completa (se pasan con el dedo o tocando a los lados) ----------
  function pantHistoria() {
    const v = L.vista; if (!v || v.key !== RUTA.a) return `<div class="ver"><div class="lugar" style="color:#fff">Abriendo…</div></div>`;
    const l = v.historias.filter(h => !h.cancelada).sort((a, b) => String(a.fecha.dia + a.fecha.hora).localeCompare(String(b.fecha.dia + b.fecha.hora)));
    const i = Math.max(0, l.findIndex(h => h.id === RUTA.b)), h = l[i];
    const dH = prevDe() || `mes/${v.key}/hist${h ? '/' + h.fecha.dia.slice(0, 7) : ''}`;
    if (!h) return `<div class="ver"><div class="vtop"><span class="t">Sin historias</span><button type="button" class="ib" data-a="atras" data-destino="${esc(dH)}" aria-label="Cerrar">${ic('x', 2)}</button></div></div>`;
    const deDia = l.filter(x => x.fecha.dia === h.fecha.dia), j = deDia.indexOf(h);
    return `<div class="ver" role="dialog" aria-label="Historia ${i + 1} de ${l.length}" data-hist="${i}" data-total="${l.length}"><div class="barras" aria-hidden="true">${deDia.map((_, k) => `<i${k <= j ? ' class="on"' : ''}></i>`).join('')}</div>
      <div class="vtop"><span class="t">${esc(diaCab(h.fecha.dia))} · ${esc(h.fecha.hora || '')}<span>${esc(nombreCli(v.client))} · ${h.programada ? 'programada' : 'sin programar'}</span></span><button type="button" class="ib" data-a="atras" data-destino="${esc(dH)}" aria-label="Cerrar">${ic('x', 2)}</button></div>
      <div class="lam">${h.img ? `<span style="position:relative;display:block;height:100%;aspect-ratio:9/16;max-width:100%">${foto(h.img, Math.min(500, W.innerWidth || 440))}</span>` : `<span class="hueco" style="position:static;background:none;color:#fff">Sin imagen todavía</span>`}</div>
      <button type="button" class="lado i" data-a="hmov" data-d="-1" aria-label="Historia anterior"${i ? '' : ' disabled'}></button><button type="button" class="lado d" data-a="hmov" data-d="1" aria-label="Historia siguiente"${i < l.length - 1 ? '' : ' disabled'}></button>
      ${h.post ? `<div class="vpie">De la publicación ${esc((v.posts.find(p => p.id === h.post) || {}).nombre || '')}</div>` : ''}</div>`;
  }

  // ---------- pintar ----------
  const PANT = { hoy: pantHoy, clientes: pantClientes, tareas: pantTareas, mes: pantMes, pub: pantPub, cap: pantCaptions, his: pantHistoria, ses: r => C.pantSes(r) };
  let pintando = 0, PEND_PINTAR = false;
  const esCampo = a => !!a && (/^(TEXTAREA|INPUT)$/.test(a.tagName) || a.isContentEditable);   // también el campo del ordenador (D-286)
  const enUso = () => { const a = D.activeElement; return !!(a && raiz.contains(a) && esCampo(a)) || !!raiz.querySelector('.hoja'); };
  function pintarSiQuieto() { if (enUso()) { PEND_PINTAR = true; return; } pintar(); }   // un campo en uso no se rehace desde fuera (D-112)
  let ULT_P = '', ULT_A = '';
  async function pintar() {
    const n = ++pintando, r = RUTA;
    if (r.p === 'mes' && !['mes', 'pub', 'cap', 'ret', 'his'].includes(ULT_P)) PUBS.abierta = false;   // «Publicadas» se pliega al entrar en el mes; volver de una publicación la deja como estaba
    const entra = r.p === 'ses' && (ULT_P !== 'ses' || ULT_A !== r.a);   // una sesión, al entrar en ella: plegada y leída otra vez (D-275)
    if (entra) SES.abiertos = new Set();
    ULT_P = r.p; ULT_A = r.a;
    if (r.p === 'mes' || r.p === 'pub' || r.p === 'cap' || r.p === 'ret' || r.p === 'his') {
      if (!L.vista || L.vista.key !== r.a) { raiz.querySelector('.pant') ? 0 : 0; dibujar((PANT[r.p] || pantMes)()); await leerMes(r.a); if (n !== pintando) return; if (L.vista) await vecinos(L.vista); if (n !== pintando) return; }
    } else if (r.p === 'hoy' && !L.hoy && !L.error.hoy) { dibujar(pantHoy()); await leerHoy(); if (n !== pintando) return; }
    else if (r.p === 'clientes' && !L.clientes && !L.error.clientes) { dibujar(pantClientes()); await leerClientes(); if (n !== pintando) return; }
    else if (r.p === 'tareas' && !L.tareas && !L.error.tareas) { dibujar(pantTareas()); await leerTareas(); if (n !== pintando) return; }
    else if (r.p === 'ses' && (entra || !L.ses || L.ses.id !== r.a)) { dibujar(C.pantSes()); await leerSes(r.a); if (n !== pintando) return; }
    if (r.p === 'ret') { if (C.pantRetocar) return dibujar(C.pantRetocar()); }
    dibujar((PANT[r.p] || pantHoy)());
  }
  // lo mismo que ya se ve no se toca (las fotos, el carrusel y su inercia siguen); otro dibujo de la misma pantalla conserva la foto
  // del carrusel en la que estaba (D-271, punto 5)
  let ULT = '', ULT_H = '';
  function dibujar(html) {
    PEND_PINTAR = false;
    if (html === ULT && location.hash === ULT_H && raiz.firstChild) return;
    const y = W.scrollY, t0 = location.hash === ULT_H && raiz.querySelector('[data-car]'), x0 = t0 ? t0.scrollLeft : 0;
    raiz.innerHTML = html; raiz.appendChild(capas); ULT = html; ULT_H = location.hash;
    vigilarFotos(raiz); carrusel(); pintarMono(); ajustarTitulo(); W.scrollTo(0, y);
    const t1 = x0 && raiz.querySelector('[data-car]'); if (t1) t1.scrollLeft = x0;
  }
  // el carrusel: deslizar con el dedo (desplazamiento nativo con imán, la inercia del iPhone), el contador y los puntos al día
  function carrusel() {
    const t = raiz.querySelector('[data-car]'); if (!t) return;
    const cnt = raiz.querySelector('[data-cnt]'), pts = raiz.querySelectorAll('.puntos i'), n = t.children.length;
    let raf = 0;
    t.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth)); if (cnt) cnt.textContent = `${i + 1} / ${n}`; pts.forEach((p, k) => p.classList.toggle('on', k === i)); }); }, { passive: true });
  }
  // releer lo bajado (la nube avisa: «releido»): lo de la pantalla se vuelve a leer, sin parpadear ni pisar un campo en uso
  // (D-271, punto 5: con mirar cada 10 s pasa a menudo) lo de la pantalla se lee antes de cambiarlo (nunca «Leyendo…» entre medias);
  // lo que no se ve se lee al volver
  async function releer() {
    const r = RUTA;
    try {
      if (r.p === 'hoy') await leerHoy(); else if (r.p === 'clientes') await leerClientes();
      await leerTareas();
    } catch (e) { /* cada lectura dice lo suyo */ }
    if (r.p === 'ses' && L.ses && L.ses.id) await leerSes(L.ses.id);   // la sesión abierta, también al día (solo si se está en ella)
    const vv = MV().vista(); if (L.vista && vv && vv.key === L.vista.key) { L.vista = vv; if (['mes', 'pub', 'cap', 'his'].includes(r.p) && r.a === vv.key) leerConv(vv.key); }   // el tablero abierto, aunque no se vea
    if (r.p !== 'hoy') { L.hoy = null; L.error.hoy = ''; }
    if (r.p !== 'clientes') { L.clientes = null; L.error.clientes = ''; }
    pintarSiQuieto();
  }

  // ---------- hojas (abajo), avisos y lo que se abre en el Mac ----------
  // una hoja se cierra con «Cancelar», tocando el velo o arrastrando el asa hacia abajo; «Guardar» queda fijo abajo en un iPhone pequeño
  // (los oyentes de cada hoja no hacen nada si ya se cerró: el segundo toque de un doble toque no cierra la hoja siguiente)
  let Y_HOJA = null;   // dónde estaba la página al abrirse la hoja: detrás de una hoja, la página no se mueve (D-286)
  function hoja(html, o = {}) {
    if (!o.permanente && capas.querySelector('.hoja[data-permanente]')) {   // la pestaña está parada: nada encima de su aviso, y su pregunta se contesta ya («Ahora no»)
      if (o.alCerrar) queueMicrotask(() => { try { o.alCerrar(); } catch (e) { /* */ } });
      return D.createElement('div');
    }
    if (o.permanente) capas.querySelectorAll('[data-permanente]').forEach(x => x.remove());   // un aviso permanente a la vez: el último
    const y0 = Y_HOJA != null ? Y_HOJA : W.scrollY;   // dónde estaba la página al abrir la primera hoja (otra hoja encima no lo cambia)
    cerrarHojas(true);
    if (!o.permanente) Y_HOJA = y0;
    const velo = D.createElement('div'); velo.className = 'velo'; velo.dataset.a = o.fija || o.pregunta ? '' : 'cerrarhoja';   // una pregunta no la contesta un toque perdido
    velo.addEventListener('pointerdown', e => { velo._teclado = conTeclado() ? e.timeStamp || performance.now() : 0; });   // con un toque de verdad el campo pierde el foco antes del click (revisión del lote B)
    const h = D.createElement('div'); h.className = 'hoja' + (o.grande ? ' mv-grande' : ''); h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); if (o.etiqueta) h.setAttribute('aria-label', o.etiqueta);   // grande: donde se escribe, de arriba abajo (D-286)
    h.innerHTML = `<div class="asa" aria-hidden="true"></div>${html}`;
    if (o.alCerrar) h._alCerrar = o.alCerrar;
    if (o.cambios) {   // una hoja donde se escribe: cerrarla a mano con cambios sin guardar pregunta antes (D-271, decisión de Kevin)
      h._cambios = o.cambios;
      h.addEventListener('click', e => { const b = e.target.closest('[data-desc]'); if (!b) return; e.stopPropagation(); e.preventDefault();
        if (b.dataset.desc === 'si') { h._cambios = null; return cerrarHojas(); }
        const pie = h.querySelector('.pie'); if (pie && pie._antes != null) { pie.innerHTML = pie._antes; pie._antes = null; delete pie.dataset.desc; } }, true);
    }
    if (o.permanente) { h.dataset.permanente = ''; velo.dataset.permanente = ''; }
    const a0 = D.activeElement; h._antes = a0 && a0 !== D.body && raiz.contains(a0) && !capas.contains(a0) ? a0 : null;   // el foco vuelve aquí al cerrarla
    h._velo = velo;   // una pregunta abierta se contesta también si la hoja se cierra de otro modo (atrás, Esc)
    capas.append(velo, h);
    requestAnimationFrame(() => { velo.classList.add('on'); h.classList.add('on'); const f = h.querySelector('[data-foco]') || h.querySelector('h2'); if (f) { f.setAttribute('tabindex', f.tabIndex >= 0 ? f.tabIndex : '-1'); f.focus({ preventScroll: true }); } });
    if (!o.fija) arrastrable(h);   // las de pregunta también: cerrarla arrastrando es «Ahora no» (D-271, punto 7)
    return h;
  }
  // cerrar a mano (tocar fuera, arrastrar, Esc, «Cancelar»): con cambios sin guardar, la hoja se queda y abajo pregunta
  // «¿Descartar los cambios?» con «Seguir editando» y «Descartar», como en iOS. Cerrar por otra cosa (otra hoja, atrás) no pregunta.
  const conCambios = h => !!(h && h._cambios && (() => { try { return h._cambios(); } catch (e) { return false; } })());
  function confirmarDescartar(h) {
    const pie = h.querySelector('.pie'); if (!pie) return;
    if (!pie.dataset.desc) { pie.dataset.desc = '1'; pie._antes = pie.innerHTML; pie.innerHTML = `<p class="mv-desc-t" role="alert">¿Descartar los cambios?</p><div class="botones"><button type="button" class="btn sua" data-desc="seguir">Seguir editando</button><button type="button" class="btn mv-desc" data-desc="si">Descartar</button></div>`; }
    const s = pie.querySelector('[data-desc="seguir"]'); if (s) s.focus({ preventScroll: true });
  }
  function pedirCerrar(h) {
    h = h || capas.querySelector('.hoja.on:not([data-permanente])');
    if (conCambios(h)) { confirmarDescartar(h); return false; }
    cerrarHojas(); return true;
  }
  const devolverFoco = h => { const a = h && h._antes; if (a && a.isConnected && !capas.querySelector('.hoja.on:not([data-permanente])')) { try { a.focus({ preventScroll: true }); } catch (e) { /* */ } } };
  // al cerrarse una hoja, sus campos del ordenador se apagan (escritura.js: su menú «/» y sus marcas) y, sin otra abierta, la página
  // vuelve a donde estaba al abrir la primera (iOS la desliza para enseñar un campo; D-286)
  const apagarCampos = h => { if (!h) return; h.querySelectorAll('[contenteditable]').forEach(c => { if (c._esc && c._esc.apagar) c._esc.apagar(); }); };
  function pagina() {
    if (Y_HOJA == null || capas.querySelector('.hoja.on:not([data-permanente])')) return;
    const y = Y_HOJA; Y_HOJA = null; if (Math.abs(W.scrollY - y) > 1) W.scrollTo(0, y);
  }
  function cerrarEsta(h) {   // solo esa hoja (y su velo), si sigue abierta: nunca otra que se abrió entretanto
    if (!h || !h.isConnected) return;
    apagarCampos(h);
    setTimeout(() => devolverFoco(h), 0);
    for (const x of [h, h._velo]) { if (!x) continue; if (POCO.matches) x.remove(); else { x.classList.remove('on'); setTimeout(() => x.remove(), 340); } }
    pagina();
  }
  function cerrarHojas(ya) {
    const antes = [...capas.querySelectorAll('.hoja:not([data-permanente])')];
    antes.forEach(apagarCampos);
    if (!ya) setTimeout(() => antes.forEach(devolverFoco), 0);
    capas.querySelectorAll('.hoja:not([data-permanente]),.velo:not([data-permanente])').forEach(x => { if (x._alCerrar) { const f = x._alCerrar; x._alCerrar = null; try { f(); } catch (e) { /* */ } } if (ya || POCO.matches) x.remove(); else { x.classList.remove('on'); setTimeout(() => x.remove(), 340); } });
    pagina();
    if (PEND_PINTAR) setTimeout(pintarSiQuieto, ya ? 0 : 360);
  }
  // tocar fuera con el teclado a la vista solo lo baja (como en iOS): «¿Descartar los cambios?» sale al cerrar de verdad (D-286)
  const conTeclado = () => { const a = D.activeElement; return raiz.classList.contains('teclado') && esCampo(a) && capas.contains(a); };
  function bajarTeclado(velo) {
    const ya = !!(velo && velo._teclado && performance.now() - velo._teclado < 1000); if (velo) velo._teclado = 0;   // solo el clic de ese toque
    if (!ya && !conTeclado()) return false;
    const a = D.activeElement; if (esCampo(a) && capas.contains(a)) a.blur();
    return true;
  }
  // arrastrar una hoja hacia abajo la cierra (D-271, punto 7; apple-design): desde su cabecera (el asa, su título y su texto) o desde
  // cualquier punto con la hoja arriba del todo, nunca desde las ruedas ni un campo; se decide en el primer movimiento (después el
  // navegador ya desplaza y no deja cancelarlo); la hoja sigue al dedo y, al soltar, se cierra si lo arrastrado más lo que proyecta su
  // velocidad pasa de la mitad, o si se lanza deprisa; si no, vuelve. Con el ratón, solo el asa. Cerrar así es cerrar (su pregunta,
  // «Ahora no»; el foco vuelve). Se puede llamar otra vez tras redibujar la hoja: sus oyentes van en la hoja, una vez.
  const decidirArrastre = o => o.dy > 0 && o.dy >= Math.abs(o.dx) && !o.enControl && !!(o.enCabecera || o.arriba);
  const cierraArrastre = o => o.dy + Math.max(0, o.v) * 160 > o.alto / 2 || (o.v > 0.5 && o.dy > 24);
  function arrastrable(h) {
    if (h._arrastre) return; h._arrastre = true;
    let g = null;   // el gesto: {y0, x0, cab, ctl, arriba, tira: null|true|false, dy, m: [[t, y]]}
    const viva = () => h.isConnected && h.classList.contains('on');
    const empezar = (x, y, t, el) => { const c = el.closest && el.closest('h2,.ex'); g = { x0: x, y0: y, cab: !!(el.closest && el.closest('.asa')) || !!(c && c.parentNode === h), ctl: !!(el.closest && el.closest('.ruedas,textarea,input,select,[contenteditable],.pp-ecapa')), arriba: h.scrollTop <= 0, tira: null, dy: 0, m: [[t, y]] }; };
    const seguir = (x, y, t) => {
      if (!g || g.tira === false) return false;
      const dx = x - g.x0, dy = y - g.y0;
      if (g.tira === null) { if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return false; g.tira = decidirArrastre({ dx, dy, enControl: g.ctl, enCabecera: g.cab, arriba: g.arriba }); if (!g.tira) return false; h.style.transition = 'none'; if (h._velo) h._velo.style.transition = 'none'; }
      g.dy = dy; g.m.push([t, y]); while (g.m.length > 2 && t - g.m[0][0] > 100) g.m.shift();
      h.style.transform = `translateY(${dy > 0 ? dy : dy / 6}px)`;   // hacia arriba, con resistencia
      if (h._velo) h._velo.style.opacity = String(1 - Math.min(1, Math.max(0, dy) / Math.max(1, h.offsetHeight)) * 0.7);
      return true;
    };
    const soltar = t => {
      if (!g || !g.tira) { g = null; return; }
      const a = g.m[0], b = g.m[g.m.length - 1], alto = h.offsetHeight, dy = Math.max(0, g.dy); let v = (b[1] - a[1]) / Math.max(1, b[0] - a[0]); g = null;
      if (t - b[0] > 150) v = 0;   // el dedo se paró antes de soltar: sin lanzamiento (150 ms: con menos, el retraso normal entre toques ya lo quitaba)
      const pide = cierraArrastre({ dy, v, alto }) && conCambios(h);   // con cambios sin guardar: vuelve arriba y pregunta
      if (pide) confirmarDescartar(h);
      if (!pide && cierraArrastre({ dy, v, alto })) {
        const resto = Math.max(1, alto * 1.05 - dy), ms = POCO.matches ? 0 : Math.round(Math.max(140, Math.min(340, resto / Math.max(0.9, v)))), p1 = Math.min(1, 0.25 * Math.max(0, v) * ms / resto).toFixed(3);
        h.style.transition = ms ? `transform ${ms}ms cubic-bezier(.25,${p1},.5,1)` : 'none'; h.style.transform = 'translateY(105%)';   // sigue desde donde lo dejó el dedo, a su velocidad (sin tirón)
        if (h._velo) { h._velo.style.transition = ''; h._velo.style.opacity = ''; }
        cerrarHojas();
      } else {
        h.style.transition = POCO.matches ? 'none' : 'transform .34s var(--ease-m)'; h.style.transform = '';
        if (h._velo) { h._velo.style.transition = ''; h._velo.style.opacity = ''; }
        setTimeout(() => { if (h.isConnected) h.style.transition = ''; }, 360);
      }
    };
    h.addEventListener('touchstart', e => { if (!viva() || e.touches.length !== 1) { g = null; return; } const p = e.touches[0]; empezar(p.clientX, p.clientY, e.timeStamp, e.target); }, { passive: true });
    h.addEventListener('touchmove', e => { if (!viva() || e.touches.length !== 1) return; const p = e.touches[0]; if (seguir(p.clientX, p.clientY, e.timeStamp) && e.cancelable) e.preventDefault(); }, { passive: false });
    h.addEventListener('touchend', e => { if (viva()) soltar(e.timeStamp); else g = null; });
    h.addEventListener('touchcancel', () => { if (g && g.tira) { g.dy = 0; g.m = [[0, 0]]; soltar(0); } g = null; });
    // con el ratón, solo el asa (en el iPhone, el dedo va por los toques: nunca dos veces)
    h.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || !viva() || !e.target.closest('.asa')) return; empezar(e.clientX, e.clientY, e.timeStamp, e.target); g.cab = true; try { h.setPointerCapture(e.pointerId); } catch (x) { /* */ } });
    h.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && g) seguir(e.clientX, e.clientY, e.timeStamp); }, { passive: true });
    h.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && g) soltar(e.timeStamp); });
  }
  let toastT = 0;
  function aviso(msg, o = {}) {
    let t = capas.querySelector('.toast'); if (!t) { t = D.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); capas.appendChild(t); }
    t.className = 'toast' + (o.error ? ' error' : '') + (raiz.querySelector('.tabs') ? '' : ' sin-tabs');
    t.innerHTML = `${ic(o.error ? 'alerta' : o.ok ? 'nubeok' : 'chispa', 2)}<span>${esc(msg)}</span>`;
    requestAnimationFrame(() => t.classList.add('on'));
    clearTimeout(toastT); toastT = setTimeout(() => { t.classList.remove('on'); }, o.ms || 4200);
  }
  MV().alAviso = (m, o) => aviso(m, o || {});
  MV().alVersion = () => { ST.fase = 'vieja'; pintarChip(); hojaVersion(); };
  MV().alPestana = () => hoja(`<h2>La Mesa está abierta en otra pestaña</h2><p class="ex">Esta se ha parado para no pisar cambios.</p><div class="botones"><button type="button" class="btn pri ancho" data-a="recargar">Usar aquí</button></div>`, { fija: true, permanente: true, etiqueta: 'La Mesa está abierta en otra pestaña' });
  const hojaVersion = () => hoja(`<h2>Hay una versión nueva de la Mesa</h2><p class="ex">Esta se ha pausado para no pisar los datos. Lo guardado no se pierde.</p><div class="botones"><button type="button" class="btn pri ancho" data-a="recargar" data-foco>Recargar</button></div>`, { fija: true, permanente: true, etiqueta: 'Hay una versión nueva de la Mesa' });
  async function verTarea(id) {
    const x = (L.tareas || []).find(t => t.id === id); if (!x) return;
    const r0 = RUTA, rec = x.fotos ? await M.personal.valor(id).catch(() => null) : null, fotos = (rec && rec.fotos) || [];   // sus fotos se ven (D-271, punto 1)
    if (RUTA !== r0) return;   // se fue a otra pantalla mientras se leía
    if (x.tipo === 'tarea' || x.tipo === 'nota') { const r = rec || (await M.personal.valor(id).catch(() => null)); if (r && RUTA === r0) return hojaTarea(x, r, fotos); return; }   // editable (D-272)
    const tira = fotos.length ? `<span class="lbl">Fotos</span><div class="mv-tira" role="list">${fotos.map((f, i) => { const r = f.w > 0 && f.h > 0 ? f.w / f.h : 4 / 5; return `<span class="mv-tf" role="listitem" aria-label="Foto ${i + 1} de ${fotos.length}" style="--r:${r.toFixed(4)}">${fotoArch('tareas', id, `el valor.fotos[${i}].blob`, 140 * r)}</span>`; }).join('')}</div>` : '';
    const E = M.escritura && M.escritura.html ? M.escritura : null, txt = E ? E.html(x.txt, { leer: true }) : esc(x.txt);
    const t = x.tipo === 'nota' ? 'Nota' : x.tipo === 'sesion' ? 'Sesión' : 'Tarea';
    const meta = [x.fecha ? cap1(DS[dow(x.fecha)]) + ' ' + corto(x.fecha) + (x.hora ? ' · ' + x.hora : '') : '', x.clientes.map(nombreCli).join(' · ')].filter(Boolean).join(' · ');
    hoja(`<h2>${esc(t)}</h2>${meta ? `<p class="ex">${esc(meta)}</p>` : ''}<div class="txt">${txt}</div>${x.detalles ? `<span class="lbl">Detalles</span><div class="txt">${E ? E.html(x.detalles, { leer: true }) : esc(x.detalles)}</div>` : ''}${x.subtareas ? `<p class="ex" style="margin-top:12px">${x.subtareas.hechas} de ${x.subtareas.n} subtareas hechas</p>` : ''}${tira}<p class="ex" style="margin-top:14px">Se edita en el escritorio.</p><div class="botones"><button type="button" class="btn sua ancho" data-a="cerrarhoja">Cerrar</button></div>`, { etiqueta: t });
    vigilarFotos(capas);
  }

  // ---------- el campo del ordenador para escribir (escritura.js, D-286): el texto de una nota, «Detalles» y los textos de una sesión (nunca
  // el título de una tarea), con sus marcas dibujadas (en gris sin el resaltado de iOS 17.2) y el menú «/» con lo que vale en el iPhone; lo que
  // se guarda es el mismo texto plano con sus marcas. Sin red, solo se lee.
  const CMD_MOVIL = () => ['lista', 'numerada', 'casilla', 'separador'];
  const valorDe = i => (i.isContentEditable || i.classList.contains('mv-ced') ? i.textContent : i.value);
  const campoEd = (k, v, etq, ph, off, attr = 'data-ed') => `<div class="mv-cedw" data-k="${esc(k)}"><div class="mv-ced${off ? ' txt' : ''}" ${attr}="${esc(k)}" contenteditable="${off ? 'false' : 'plaintext-only'}" role="textbox" aria-multiline="true" aria-label="${esc(etq)}" spellcheck="true"${ph ? ` data-ph="${esc(ph)}" aria-placeholder="${esc(ph)}"` : ''}${off ? ' aria-disabled="true"' : ''}>${off ? E_HTML(v) : esc(v)}</div></div>`;   // sin red, se lee con sus marcas
  function encenderEd(el, o) {
    const E = M.escritura; if (!el || !E || !E.activar || el._esc || el.getAttribute('contenteditable') !== 'plaintext-only') return;
    E.activar(el, { comandos: CMD_MOVIL, ...o });
  }
  // la hoja otra vez sin mover sus campos del ordenador (.mv-cedw[data-k], hijos de la hoja): moverlos los desenfocaría y bajaría el
  // teclado, y perderían su cursor y su ⌘Z; lo demás se dibuja de nuevo alrededor
  function rehacerHoja(h, html) {
    const t = D.createElement('template'); t.innerHTML = html;
    const vivos = new Map([...h.children].filter(x => x.matches('.mv-cedw[data-k]')).map(x => [x.dataset.k, x]));
    [...h.childNodes].forEach(x => { if (!(x.nodeType === 1 && vivos.get(x.dataset.k) === x)) x.remove(); });
    let ref = h.firstChild;
    for (const n of [...t.content.childNodes]) {
      const v = n.nodeType === 1 && n.matches('.mv-cedw[data-k]') ? vivos.get(n.dataset.k) : null;
      if (v && v === ref) { vivos.delete(n.dataset.k); ref = v.nextSibling; continue; }
      h.insertBefore(n, ref);
    }
    vivos.forEach(v => { apagarCampos(v); v.remove(); });   // un campo que ya no está (o cambió de sitio: se dibuja el nuevo)
  }

  // ---------- editar una tarea o una nota ya creada (D-272): como Recordatorios, con «Guardar» abajo ----------
  // Cada campo cambiado es su operación (cada subtarea, la suya); una nota, solo su texto. La fecha y el cliente se despliegan dentro de
  // la misma hoja (nunca una hoja encima de otra). Sus fotos se ven (D-271, punto 1), no se añaden ni se quitan aquí.
  async function hojaTarea(x, r, fotos) {
    const nota = r.tipo === 'nota', o0 = { txt: String(r.txt || ''), fecha: r.fecha || '', cliente: r.cliente || '', detalles: String(r.detalles || ''), subs: (r.subtareas || []).map(y => ({ sid: y.id, txt: String(y.txt || ''), hecha: !!y.hecha })) };
    // o1: lo que se ve, lo guardado con lo que se está guardando encima (guardar de fondo: reabrirla mientras sube es normal; revisión del lote B)
    const o1 = JSON.parse(JSON.stringify(o0));
    for (const p of opsLeer().filter(q => q.estado === 'nueva' && q.slot === x.id)) {
      const v = p.valor;
      if (p.campo === 'tareaTexto') o1.txt = String(v ?? ''); else if (p.campo === 'tareaFecha') o1.fecha = v || ''; else if (p.campo === 'tareaCliente') o1.cliente = v || ''; else if (p.campo === 'tareaDetalles') o1.detalles = String(v ?? '');
      else if (p.campo === 'subtarea' && v) { const y = o1.subs.find(z => z.sid === v.sid); if (v.accion === 'nueva' && !y) o1.subs.push({ sid: v.sid, txt: String(v.txt || ''), hecha: !!v.hecha, pend: p.id }); else if (y && v.accion === 'quitar') y.quitada = true; else if (y && v.accion === 'texto') y.txt = String(v.txt || ''); else if (y && v.accion === 'hecha') y.hecha = !!v.hecha; }
    }
    const ed = JSON.parse(JSON.stringify(o1)), off = sinRed();
    let abre = '', mes = (ed.fecha || hoy()).slice(0, 7), err = '';
    const esp = !nota && M.personal._p && M.personal._p.esps ? M.personal._p.esps() : [];   // ya leídos con la tarea (sin leer todos los tableros)
    const tira = fotos.length ? `<span class="lbl">Fotos</span><div class="mv-tira" role="list">${fotos.map((f, i) => { const q = f.w > 0 && f.h > 0 ? f.w / f.h : 4 / 5; return `<span class="mv-tf" role="listitem" aria-label="Foto ${i + 1} de ${fotos.length}" style="--r:${q.toFixed(4)}">${fotoArch('tareas', x.id, `el valor.fotos[${i}].blob`, 140 * q)}</span>`; }).join('')}</div>` : '';
    const pinta = () => {
      const vivas = ed.subs.filter(y => !y.quitada), h = vivas.filter(y => y.hecha).length;
      const cliTxt = ed.cliente ? `${av(ed.cliente)}<span>${esc(nombreCli(ed.cliente))}</span>` : 'Sin cliente';
      const fila = (k, t, v) => `<button type="button" class="campo" data-ed-abre="${k}" aria-expanded="${abre === k}"${off ? ' disabled' : ''}><span class="k">${t}</span><span class="v">${v}</span><span class="chev">${ic(abre === k ? 'arriba' : 'abajo')}</span></button>`;
      const cli = c => `<button type="button" class="estado-op${ed.cliente === c.id ? ' on' : ''}" data-ed-cli="${esc(c.id)}"${ed.cliente === c.id ? ' aria-current="true"' : ''}>${c.id ? av(c.id) : ''}<span style="flex:1">${esc(c.name)}</span>${ed.cliente === c.id ? `<span class="ck">${ic('check', 2.25)}</span>` : ''}</button>`;
      return `<h2>${nota ? 'Nota' : 'Tarea'}</h2>
        ${nota ? campoEd('txt', ed.txt, 'Texto de la nota', '', off) : `<textarea class="mv-ttxt" data-ed="txt" rows="2" aria-label="Texto de la tarea"${off ? ' disabled' : ''}>${esc(ed.txt)}</textarea>`}
        ${nota ? '' : `<div class="grupo" style="margin-top:12px">${fila('fecha', 'Fecha', esc(ed.fecha ? cap1(DS[dow(ed.fecha)]) + ' ' + corto(ed.fecha) : 'Sin fecha'))}${abre === 'fecha' ? `<div class="mv-desp">${calendarioHTML(ed.fecha, mes, null, { pie: `<button type="button" class="lnk" data-ed-dia=""${ed.fecha ? '' : ' disabled'}>Sin fecha</button><button type="button" class="lnk" data-ed-dia="${hoy()}">Hoy</button>` })}</div>` : ''}${fila('cliente', 'Cliente', cliTxt)}${abre === 'cliente' ? `<div class="mv-desp estados">${cli({ id: '', name: 'Sin cliente' })}${(X().CL || []).map(cli).join('')}${esp.length ? `<span class="lbl">Esporádicos</span>${esp.map(e => cli({ id: e.id, name: e.txt })).join('')}` : ''}</div>` : ''}</div>
        <span class="lbl">Detalles</span>${campoEd('detalles', ed.detalles, 'Detalles', 'Detalles', off)}
        <span class="lbl mv-subh"><span>Subtareas</span>${vivas.length ? `<span class="num">${h}/${vivas.length}</span>` : ''}</span>${vivas.length ? `<div class="mv-barra" aria-hidden="true"><i style="width:${(h / vivas.length * 100).toFixed(1)}%"></i></div>` : ''}
        <div class="mv-subs">${vivas.map(y => `<div class="mv-sub${y.hecha ? ' hecha' : ''}"><button type="button" class="casilla" data-ed-ck="${esc(y.sid)}" role="checkbox" aria-checked="${y.hecha}" aria-label="${esc((y.hecha ? 'Hecha: ' : 'Marcar como hecha: ') + y.txt)}"${off ? ' disabled' : ''}>${ic('check', 2.5)}</button><textarea rows="1" data-ed-st="${esc(y.sid)}" aria-label="Subtarea" enterkeyhint="next"${off ? ' disabled' : ''}>${esc(y.txt)}</textarea><button type="button" class="ib mv-subx" data-ed-x="${esc(y.sid)}" aria-label="${esc('Quitar: ' + y.txt)}"${off ? ' disabled' : ''}>${ic('x')}</button></div>`).join('')}</div>
        <button type="button" class="lnk" data-ed-mas${off ? ' disabled' : ''}>${ic('mas')}Subtarea</button>`}
        ${tira}${err ? `<p class="resp-err" style="margin:10px 0 0">${esc(err)}</p>` : ''}${off ? '<p class="ex" style="margin-top:12px">Sin conexión: no se puede cambiar.</p>' : ''}
        <div class="pie"><div class="botones"><button type="button" class="btn sua" data-ed-a="cancelar">Cancelar</button><button type="button" class="btn pri" data-ed-a="guardar"${off ? ' disabled' : ''}>Guardar</button></div></div>`;
    };
    const firmaEd = e => JSON.stringify([e.txt.trim(), e.fecha, e.cliente, e.detalles.trim(), e.subs.filter(y => !(y.nueva && !y.txt.trim())).map(y => [y.sid, y.txt.trim(), !!y.hecha, !!y.quitada])]), f1 = firmaEd(o1);
    const h = hoja(pinta(), { etiqueta: nota ? 'Nota' : 'Tarea', cambios: () => firmaEd(ed) !== f1, grande: true });
    vigilarFotos(capas);
    const crece = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };   // las subtareas ocupan las líneas que necesiten
    const CRECE = nota ? 'textarea[data-ed-st]' : 'textarea[data-ed-st],textarea[data-ed="txt"]';   // el título de una tarea también (el texto de una nota y «Detalles» crecen solos)
    const crecer = () => h.querySelectorAll(CRECE).forEach(crece);
    // el texto de una nota y «Detalles», con las marcas y el menú «/» del ordenador (D-286); en «Detalles», una casilla es una subtarea (D-183),
    // cada una su operación al guardar (D-272); el campo nunca se rehace al redibujar la hoja (lo escrito, su cursor y su ⌘Z siguen)
    const nuevaSub = (txt, hecha) => { const sid = M.personal.nuevoId('sub'); ed.subs.push({ sid, txt: String(txt || '').replace(/\n/g, ' '), hecha: !!hecha, nueva: true }); return sid; };
    const encender = () => {
      encenderEd(h.querySelector('.mv-ced[data-ed="txt"]'), {});
      encenderEd(h.querySelector('.mv-ced[data-ed="detalles"]'), { subtareas: true, desc: { casilla: 'Una subtarea' },
        alCasilla: o => { if (!h.isConnected) return; const sid = nuevaSub(o.txt, o.hecha); repinta(`[data-ed-st="${sid}"]`); },
        alPegarCasillas: l => { if (!h.isConnected) return; for (const y of l) if (String(y.txt).trim()) nuevaSub(y.txt, y.hecha); repinta(); } });
    };
    const repinta = foco => { const y = h.scrollTop; rehacerHoja(h, '<div class="asa" aria-hidden="true"></div>' + pinta()); encender(); crecer(); h.scrollTop = y; vigilarFotos(capas); if (foco) { const f = h.querySelector(foco); if (f) { f.focus({ preventScroll: true }); if (f.setSelectionRange) f.setSelectionRange(f.value.length, f.value.length); } } };
    encender();
    requestAnimationFrame(crecer);
    h.addEventListener('input', e => { const t = e.target; if (t.matches(CRECE)) crece(t); if (t.dataset.ed) ed[t.dataset.ed] = t.isContentEditable ? t.textContent : t.value; else if (t.dataset.edSt) { const y = ed.subs.find(z => z.sid === t.dataset.edSt); if (y) y.txt = t.value.replace(/\n/g, ' '); } });
    h.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.target.dataset.edSt) { e.preventDefault(); masSub(); } });
    const masSub = () => { const sid = nuevaSub('', false); repinta(`[data-ed-st="${sid}"]`); };
    h.addEventListener('click', e => {
      if (!h.isConnected || !h.classList.contains('on')) return;
      const t = e.target;
      const ab = t.closest('[data-ed-abre]'); if (ab && !ab.disabled) { abre = abre === ab.dataset.edAbre ? '' : ab.dataset.edAbre; return repinta(); }
      const d = t.closest('[data-dia]'); if (d && !d.disabled) { ed.fecha = d.dataset.dia; abre = ''; return repinta(); }
      const dd = t.closest('[data-ed-dia]'); if (dd && !dd.disabled) { ed.fecha = dd.dataset.edDia; abre = ''; return repinta(); }
      const c = t.closest('[data-cal]'); if (c && !c.disabled) { mes = c.dataset.cal; return repinta(); }
      const cl = t.closest('[data-ed-cli]'); if (cl) { ed.cliente = cl.dataset.edCli; abre = ''; return repinta(); }
      const ck = t.closest('[data-ed-ck]'); if (ck && !ck.disabled) { const y = ed.subs.find(z => z.sid === ck.dataset.edCk); if (y) { y.hecha = !y.hecha; repinta(); } return; }
      const qx = t.closest('[data-ed-x]'); if (qx && !qx.disabled) { const y = ed.subs.find(z => z.sid === qx.dataset.edX); if (y) { if (y.nueva) ed.subs = ed.subs.filter(z => z !== y); else y.quitada = true; repinta(); } return; }
      if (t.closest('[data-ed-mas]')) return masSub();
      const a = t.closest('[data-ed-a]'); if (!a) return;
      if (a.dataset.edA === 'cancelar') return pedirCerrar(h);
      // «Guardar»: cada campo cambiado, su operación (D-272)
      const txtN = nota ? ed.txt.replace(/\s+$/, '') : ed.txt.replace(/\s*\n\s*/g, ' ').trim();
      if (!txtN.trim()) { err = nota ? 'Una nota necesita un texto.' : 'Una tarea necesita un texto.'; return repinta('[data-ed="txt"]'); }
      const base = { slot: x.id, nombre: String(o1.txt).split('\n')[0] }, ops = [];   // cambiado frente a lo que se veía (o1); lo visto, lo guardado (o0)
      if (txtN !== o1.txt) ops.push({ ...base, campo: 'tareaTexto', valor: txtN, visto: o0.txt });
      if (!nota) {
        if (ed.fecha !== o1.fecha) ops.push({ ...base, campo: 'tareaFecha', valor: ed.fecha, visto: o0.fecha });
        if (ed.cliente !== o1.cliente) ops.push({ ...base, campo: 'tareaCliente', valor: ed.cliente, visto: o0.cliente });
        const det = ed.detalles.replace(/^\s*\n|\s+$/g, ''); if (det !== o1.detalles.replace(/^\s*\n|\s+$/g, '')) ops.push({ ...base, campo: 'tareaDetalles', valor: det, visto: o0.detalles });
        for (const y of ed.subs) {
          const o = o1.subs.find(z => z.sid === y.sid), g = o0.subs.find(z => z.sid === y.sid), t2 = y.txt.trim(), etq = (t2 || (o && o.txt) || '').slice(0, 60);
          // nueva aquí, o nueva que sigue en la cola sin salir: otra vez «nueva» con su id (sustituye a la pendiente) o se quita de la cola.
          // Si mientras la hoja estaba abierta ya se aplicó o está saliendo, se trata como una que existe (lo visto: lo que se veía)
          const enCola = o && o.pend && o.pend !== ENVUELO && opsLeer().some(q => q.id === o.pend);
          if (!o || enCola) {
            if (!y.quitada && t2) { if (!o || t2 !== o.txt || y.hecha !== o.hecha) ops.push({ ...base, campo: 'subtarea', valor: { sid: y.sid, accion: 'nueva', txt: t2, hecha: y.hecha }, visto: null, etq }); }
            else if (o) opsQuitar(o.pend);
            continue;
          }
          if (y.quitada || !t2) { if (!o.quitada) ops.push({ ...base, campo: 'subtarea', valor: { sid: y.sid, accion: 'quitar' }, visto: { existe: true }, etq }); continue; }   // vacía al guardar: se quita, como en el Mac
          if (t2 !== o.txt) ops.push({ ...base, campo: 'subtarea', valor: { sid: y.sid, accion: 'texto', txt: t2 }, visto: { txt: g ? g.txt : o.txt }, etq });
          if (y.hecha !== o.hecha) ops.push({ ...base, campo: 'subtarea', valor: { sid: y.sid, accion: 'hecha', hecha: y.hecha }, visto: { hecha: g ? g.hecha : o.hecha }, etq });
        }
      }
      cerrarHojas(true);
      if (ops.length) guardar(ops);
    });
  }

  // ---------- el toque: un solo oyente para toda la cara ----------
  raiz.addEventListener('click', e => {
    const b = e.target.closest('[data-ir],[data-a]'); if (!b || b.disabled || !raiz.contains(b)) return;
    if (b.dataset.ir != null && !b.dataset.a) { const r = b.dataset.ir; if (['hoy', 'clientes', 'tareas'].includes(r)) { FILTRO = null; if (prevDe() === r) history.back(); else ir(r, 'raiz'); } else if (RUTA.p === 'mes' && /^mes\//.test(r)) ir(r, 'sustituir'); else avanzar(r); return; }
    accion(b.dataset.a, b, e);
  });
  raiz.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-a]')) { e.preventDefault(); e.target.click(); } if (e.key === 'Escape' && capas.querySelector('.hoja')) pedirCerrar(); });
  const C = {};   // cambiar (lote 4): se llena más abajo
  // ---------- una sesión entera (D-275): en una columna, como en el Mac; cada apartado plegable (todos plegados al entrar, varios abiertos
  // a la vez, como pidió Kevin); se cambian la fecha y la hora de inicio, los clientes, el material, el nombre y el texto de cada apartado
  const SES = { abiertos: new Set() };
  const E_HTML = t => (M.escritura && M.escritura.html ? M.escritura.html(t, { leer: true }) : esc(t));
  const volverSes = () => { const pv = prevDe(); return pv === 'hoy' ? { atras: 'Hoy', destino: 'hoy' } : { atras: 'Tareas', destino: 'tareas' }; };
  const sesCurso = (campo, f) => opsLeer().filter(o => o.estado === 'nueva' && o.slot === (L.ses || {}).id && o.campo === campo && (!f || f(o.valor || {}))).pop();
  const conocido = c => !!((X().CL || []).find(x => x.id === c) || (M.personal && M.personal._p && M.personal._p.cliDe(c)));
  const fotoSes = (fid, px, q) => `<span class="mv-sf" style="--r:${(q || 1).toFixed(4)}">${fotoArch('tfotos', fid, 'el valor.blob', px)}</span>`;
  C.pantSes = () => {
    const v = L.ses, r0 = RUTA;
    if (!v || v.id !== r0.a) return top(volverSes()) + `<main class="main sin-tabs" id="contenido">${L.error.ses ? mal(L.error.ses) : '<div class="lugar">Abriendo la sesión…</div>'}</main>`;
    if (v.falta) return top(volverSes()) + `<main class="main sin-tabs" id="contenido">${vacio('Esta sesión ya no está', 'Se quitó en otro aparato.')}</main>`;
    const off = sinRed(), dis = off ? ' disabled' : '', iop = sesCurso('sesInicio'), cop = sesCurso('sesClientes'), nop = sesCurso('sesNombre');
    const ini = iop ? { fecha: iop.valor.fecha, hora: iop.valor.hora } : { fecha: v.fecha, hora: v.hora }, clis = cop ? cop.valor : v.clientes, nombre = nop ? nop.valor : v.nombre;
    const cuando = ini.fecha ? `${campoFecha({ dia: ini.fecha, hora: ini.hora })}${!iop && v.fin && v.fin.hora && v.fin.fecha === v.fecha ? '\u00a0–\u00a0' + v.fin.hora : ''}` : 'Sin fecha';
    const fin = !iop && v.fin && v.fin.fecha && v.fin.fecha !== v.fecha ? `<span class="por">Termina el ${esc(corto(v.fin.fecha))}${v.fin.hora ? ' a las ' + esc(v.fin.hora) : ''}</span>` : '';
    const fotoMap = new Map(v.fotos.map(f => [f.id, f]));
    const q = id => { const f = fotoMap.get(id); return f && f.w && f.h ? f.w / f.h : 1; };
    const apHTML = a => {
      const ab = SES.abiertos.has(a.id), n = a.cuenta ? (a.cuenta.hechas == null ? a.cuenta.n : `${a.cuenta.hechas}/${a.cuenta.n}`) : '';
      const tx = a.tipo === 'texto', top = sesCurso('sesTexto', o => o.ap === a.id);
      let cuerpo = '';
      if (ab && tx) { const t = top ? top.valor.texto : a.texto; cuerpo = t.trim() ? `<div class="txt mv-stx">${E_HTML(t)}</div>` : `<p class="solo-mac" style="margin:0 var(--pad)">Vacío.</p>`; }
      if (ab && a.tipo === 'planos') cuerpo = a.pestanas.map(p => `<div class="mv-spl"><h3>${esc(p.nombre)} <span class="num">${p.items.length}</span></h3>${p.items.length ? `<div class="lista">${p.items.map(i => `<div class="tarea${i.hecho ? ' hecha' : ''}"><span class="mv-mk${i.hecho ? ' on' : ''}" role="img" aria-label="${i.hecho ? 'Hecho' : 'Sin hacer'}">${i.hecho ? ic('check', 3) : ''}</span><span class="tx"><span class="tt">${esc(i.titulo)}</span>${i.texto ? `<span class="tm">${esc(i.texto)}</span>` : ''}${i.fotos.length ? `<span class="mv-sref">${i.fotos.map(fid => fotoSes(fid, 56 * q(fid), q(fid))).join('')}</span>` : ''}</span></div>`).join('')}</div>` : '<p class="solo-mac" style="margin:0">Sin planos.</p>'}</div>`).join('');
      if (ab && a.tipo === 'mood') cuerpo = a.grupos.map(g => `<div class="mv-spl"><h3>${esc(g.nombre || 'Sin nombre')} <span class="num">${g.fotos.length}</span></h3><div class="mv-mood">${g.fotos.map(fid => fotoSes(fid, 180, q(fid))).join('')}</div></div>`).join('') || '<p class="solo-mac" style="margin:0 var(--pad)">Sin fotos.</p>';
      if (ab && a.tipo === 'material') { const m = a.material; cuerpo = `<div class="mv-mat"><div class="mv-matb"><div class="mv-barra" aria-hidden="true"><i style="width:${m.n ? (m.hechas / m.n * 100).toFixed(1) : 0}%"></i></div></div>${m.familias.map(f => `<h3>${esc(f.nombre)} <span class="num">${f.hechas}/${f.cosas.length}</span></h3><div class="mv-fichas">${f.cosas.map(c => { const pend = sesCurso('sesMaterial', o => o.ap === a.id && o.m === c.id), on = pend ? pend.valor.hecho : c.hecha; return `<button type="button" class="mv-ficha${on ? ' on' : ''}${c.de ? ' hijo' : ''}" data-a="sesmat" data-ap="${esc(a.id)}" data-m="${esc(c.id)}" aria-pressed="${on}"${dis}${pend ? ' aria-busy="true"' : ''}>${c.de ? `<span class="hj">${ic('hijo')}</span>` : ''}${on ? ic('check', 2.25) : ''}${esc(c.nombre)}</button>`; }).join('')}</div>`).join('')}</div>`; }
      const ed = ab && tx ? `<div class="mv-sap-ed"><button type="button" class="lnk" data-a="sested" data-ap="${esc(a.id)}"${dis || (top ? ' disabled' : '')}>Editar</button></div>` : '';
      return `<section class="mv-sap${ab ? ' abierto' : ''}"><div class="mv-sap-h"><button type="button" class="mv-sap-b" data-a="sesap" data-ap="${esc(a.id)}" aria-expanded="${ab}"><h2>${esc(a.nombre)}</h2>${n ? `<span class="n num">${n}</span>` : ''}${a.visible ? '' : `<span class="oj" role="img" aria-label="No lo ve el cliente">${ic('ojoNo')}</span>`}${top ? GIRA : ''}<span class="chev">${ic('abajo')}</span></button></div>${ed}${cuerpo}</section>`;
    };
    return top(volverSes()) + `<main class="main sin-tabs mv-ses" id="contenido">
      <div class="mv-ses-h"><h1>${esc(nombre)}${nop ? ' ' + GIRA : ''}</h1><button type="button" class="lnk" data-a="sesnom"${dis || (nop ? ' disabled' : '')}>Editar</button></div>
      <div class="mv-ses-sub"><span class="ty ses">${ic('claqueta')}Sesión</span><span>${esc(v.clase)}</span></div>
      <div class="grupo">
        <button type="button" class="campo" data-a="sesfecha"${dis || (iop ? ' disabled' : '')}${iop ? ' aria-busy="true"' : ''}><span class="k">Fecha y hora</span><span class="v num" style="display:block;white-space:normal">${esc(cuando)}${fin}</span>${iop ? GIRA : `<span class="chev">${ic('der')}</span>`}</button>
        <button type="button" class="campo" data-a="sesclis"${dis || (cop ? ' disabled' : '')}${cop ? ' aria-busy="true"' : ''}><span class="k">${clis.filter(conocido).length > 1 ? 'Clientes' : 'Cliente'}</span><span class="v mv-scl">${clis.filter(conocido).length ? clis.filter(conocido).map(c => `<span>${av(c)}<span class="nm">${esc(nombreCli(c))}</span></span>`).join('') : 'Sin cliente'}</span>${cop ? GIRA : `<span class="chev">${ic('der')}</span>`}</button>
      </div>${off ? '<p class="solo-mac">Sin conexión: no se puede cambiar.</p>' : ''}
      ${v.apartados.map(apHTML).join('')}
      ${v.fotos.length ? `<section class="mv-sap${SES.abiertos.has('__fotos') ? ' abierto' : ''}"><div class="mv-sap-h"><button type="button" class="mv-sap-b" data-a="sesap" data-ap="__fotos" aria-expanded="${SES.abiertos.has('__fotos')}"><h2>Fotos de la sesión</h2><span class="n num">${v.fotos.length}</span><span class="chev">${ic('abajo')}</span></button></div>${SES.abiertos.has('__fotos') ? `<div class="mv-srej">${v.fotos.map(f => fotoSes(f.id, 130, 1)).join('')}</div>` : ''}</section>` : ''}
    </main>`;
  };
  C.sesap = b => { const k = b.dataset.ap; if (SES.abiertos.has(k)) SES.abiertos.delete(k); else SES.abiertos.add(k); pintar(); };
  C.sesmat = b => { const v = L.ses; if (!v) return; const a = v.apartados.find(x => x.id === b.dataset.ap), c = a && a.material.familias.flatMap(f => f.cosas).find(x => x.id === b.dataset.m); if (!c) return; const pend = sesCurso('sesMaterial', o => o.ap === a.id && o.m === c.id), ahora = pend ? pend.valor.hecho : c.hecha; guardar({ slot: v.id, campo: 'sesMaterial', valor: { ap: a.id, m: c.id, hecho: !ahora }, visto: { hecho: c.hecha }, nombre: v.nombre, etq: c.nombre }); };
  // una hoja con un campo y «Guardar» (el nombre o el texto de un apartado)
  function hojaCampo(t, valor, multi, alGuardar) {
    const h = hoja(`<h2>${esc(t)}</h2><p class="ex">${esc((L.ses || {}).nombre || '')}</p>${multi ? `${campoEd('sc', valor, t, '', false, 'data-sc')}<p class="ex" style="margin-top:8px">Escribe «/» para una lista, una casilla o un separador.</p>` : `<input type="text" data-sc aria-label="${esc(t)}" value="${esc(valor)}">`}<p class="resp-err" data-sc-err hidden></p><div class="pie"><div class="botones"><button type="button" class="btn sua" data-sc-a="no">Cancelar</button><button type="button" class="btn pri" data-sc-a="si">Guardar</button></div></div>`, { etiqueta: t, grande: multi, cambios: () => { const i = h.querySelector('[data-sc]'); return !!i && valorDe(i) !== valor; } });
    if (multi) encenderEd(h.querySelector('.mv-ced[data-sc]'), {});   // con las marcas y el menú «/» del ordenador (D-286)
    h.addEventListener('click', e => { if (!h.isConnected || !h.classList.contains('on')) return; const b = e.target.closest('[data-sc-a]'); if (!b) return; if (b.dataset.scA === 'no') return pedirCerrar(h); const err = alGuardar(valorDe(h.querySelector('[data-sc]'))); if (err) { const p = h.querySelector('[data-sc-err]'); p.hidden = false; p.textContent = err; } });
  }
  C.sesnom = () => { const v = L.ses; if (!v) return; hojaCampo('Nombre de la sesión', v.nombre, false, t => { const n = t.replace(/\s*\n\s*/g, ' ').trim(); if (!n) return 'Una sesión necesita un nombre.'; cerrarHojas(true); if (n !== v.nombre) guardar({ slot: v.id, campo: 'sesNombre', valor: n, visto: v.nombre, nombre: v.nombre }); return ''; }); };
  C.sested = b => { const v = L.ses, a = v && v.apartados.find(x => x.id === b.dataset.ap); if (!a) return; hojaCampo(a.nombre, a.texto, true, t => { cerrarHojas(true); if (t !== a.texto) guardar({ slot: v.id, campo: 'sesTexto', valor: { ap: a.id, texto: t }, visto: a.texto, nombre: v.nombre, etq: a.nombre }); return ''; }); };
  C.sesclis = () => {
    const v = L.ses; if (!v) return; const sel = new Set(v.clientes);
    const pinta = esp => { const fila = (id, n) => `<button type="button" class="estado-op${sel.has(id) ? ' on' : ''}" data-scl="${esc(id)}" aria-pressed="${sel.has(id)}">${av(id)}<span style="flex:1;min-width:0">${esc(n)}</span>${sel.has(id) ? `<span class="ck">${ic('check', 2.25)}</span>` : ''}</button>`;
      return `<h2>Clientes de la sesión</h2><p class="ex">Uno o varios. Los nuevos se crean en el escritorio.</p><span class="lbl">Mensuales</span><div class="estados">${(X().CL || []).map(c => fila(c.id, c.name)).join('')}</div>${esp.length ? `<span class="lbl">Esporádicos</span><div class="estados">${esp.map(e => fila(e.id, e.txt)).join('')}</div>` : ''}<div class="pie"><div class="botones"><button type="button" class="btn sua" data-scl-a="no">Cancelar</button><button type="button" class="btn pri" data-scl-a="si">Guardar</button></div></div>`; };
    {   // los esporádicos ya leídos con la sesión (sin leer todos los tableros; la hoja sale en el acto, sobre esta pantalla)
      const esp = M.personal._p && M.personal._p.esps ? M.personal._p.esps() : [], h = hoja(pinta(esp), { etiqueta: 'Clientes de la sesión' });
      h.addEventListener('click', e => { if (!h.isConnected || !h.classList.contains('on')) return; const f = e.target.closest('[data-scl]'); if (f) { const id = f.dataset.scl; if (sel.has(id)) sel.delete(id); else sel.add(id); const y = h.scrollTop; h.innerHTML = '<div class="asa" aria-hidden="true"></div>' + pinta(esp); h.scrollTop = y; return; }
        const b = e.target.closest('[data-scl-a]'); if (!b) return; if (b.dataset.sclA !== 'si') return cerrarHojas(); cerrarHojas(true);
        const nuevo = [...sel], ant = [...v.clientes].sort(); if (JSON.stringify([...nuevo].sort()) !== JSON.stringify(ant)) guardar({ slot: v.id, campo: 'sesClientes', valor: nuevo, visto: ant, nombre: v.nombre }); });
    }
  };
  C.sesfecha = () => {
    const v = L.ses; if (!v) return;
    let dia = v.fecha || '', conHora = !!v.hora, hh = (v.hora || '10:00').slice(0, 2), mm = (v.hora || '10:00').slice(3, 5), mes = (v.fecha || hoy()).slice(0, 7);   // sin fecha: ningún día elegido (guardar sin tocar no pone hoy)
    const mins = MINS.includes(mm) ? MINS : [...MINS, mm].sort();
    const dur = () => { if (!v.fin || !v.fin.fecha || !v.fecha) return ''; if (v.fin.hora && v.hora && v.fin.fecha === v.fecha) { const a = +v.hora.slice(0, 2) * 60 + +v.hora.slice(3, 5), b = +v.fin.hora.slice(0, 2) * 60 + +v.fin.hora.slice(3, 5), c = (+hh * 60 + +mm) + (b - a); return c < 1440 ? `Termina a las ${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}.` : 'El fin se mueve con el inicio.'; } return 'El fin se mueve con el inicio.'; };
    const pinta = () => `<h2>Fecha y hora</h2><p class="ex">${esc(v.nombre)}</p>${calendarioHTML(dia, mes, null, { pie: `<button type="button" class="lnk" data-a2="sinfecha"${v.fecha ? '' : ' disabled'}>Sin fecha</button>` })}${conHora ? `<div class="ruedas"><span class="banda"></span>${ruedaHTML('h', HORAS, hh)}<b class="dos">:</b>${ruedaHTML('m', mins, mm)}</div><button type="button" class="lnk" data-a2="sinhora" style="margin:4px auto 0;display:flex">Sin hora</button>` : `<button type="button" class="campo" data-a2="ponhora" style="margin-top:10px;border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2)"><span class="k">Hora</span><span class="v">Sin hora</span><span class="chev">${ic('der')}</span></button>`}${v.fin && v.fin.fecha ? `<p class="ex" style="margin:10px 0 0" data-dur>${esc(dur())}</p>` : ''}<div class="pie"><div class="botones"><button type="button" class="btn sua" data-a2="cancelar">Cancelar</button><button type="button" class="btn pri" data-a2="guardar">Guardar</button></div></div>`;
    const h = hoja(pinta(), { etiqueta: 'Fecha y hora' });
    const armar = () => h.querySelectorAll('[data-rueda]').forEach(rr => armarRueda(rr, x => { if (rr.dataset.rueda === 'h') hh = x; else mm = x; const d = h.querySelector('[data-dur]'); if (d) d.textContent = dur(); }));
    const leer = () => { if (!conHora) return; const rh = h.querySelector('[data-rueda="h"]'), rm = h.querySelector('[data-rueda="m"]'); if (rh) hh = rh.getAttribute('aria-valuetext') || hh; if (rm) mm = rm.getAttribute('aria-valuetext') || mm; };
    const repinta = () => { leer(); const y = h.scrollTop; h.innerHTML = '<div class="asa" aria-hidden="true"></div>' + pinta(); armar(); h.scrollTop = y; };
    armar();
    h.addEventListener('click', e => { if (!h.isConnected || !h.classList.contains('on')) return;
      const d = e.target.closest('[data-dia]'); if (d && !d.disabled) { dia = d.dataset.dia; return repinta(); }
      const c = e.target.closest('[data-cal]'); if (c && !c.disabled) { mes = c.dataset.cal; return repinta(); }
      const b = e.target.closest('[data-a2]'); if (!b) return;
      if (b.dataset.a2 === 'cancelar') return cerrarHojas();
      if (b.dataset.a2 === 'sinhora') { leer(); conHora = false; return repinta(); }
      if (b.dataset.a2 === 'ponhora') { conHora = true; return repinta(); }
      if (b.dataset.a2 === 'sinfecha' && !b.disabled) { cerrarHojas(true); return guardar({ slot: v.id, campo: 'sesInicio', valor: { fecha: '' }, visto: { fecha: v.fecha, hora: v.hora }, nombre: v.nombre }); }   // la hora se queda, como en el Mac
      if (b.dataset.a2 === 'guardar' && !dia) { if (!conHora) return cerrarHojas(); return aviso('Elige un día para la sesión.'); }
      if (b.dataset.a2 === 'guardar') { leer(); const valor = { fecha: dia, hora: conHora ? `${hh}:${mm}` : '' }; cerrarHojas(true); if (valor.fecha !== v.fecha || valor.hora !== v.hora) guardar({ slot: v.id, campo: 'sesInicio', valor, visto: { fecha: v.fecha, hora: v.hora }, nombre: v.nombre }); }
    });
  };

  function accion(a, b, e) {
    switch (a) {
      case 'atras': return atras(b.dataset.destino);
      case 'avt': AVT = !AVT; b.setAttribute('aria-checked', String(AVT)); return leerHoy().then(() => { if (RUTA.p !== 'hoy') return; pintar(); const s = raiz.querySelector('[data-a="avt"]'); if (s) s.focus({ preventScroll: true }); });   // se relee sin pasar por «Leyendo…»
      case 'filtro': FILTRO = FILTRO === b.dataset.k ? null : b.dataset.k; return pintar();
      case 'vertodo': VER_TODO[b.dataset.k] = true; return pintar();
      case 'reintentar': L.error = {}; L.hoy = L.clientes = L.tareas = null; return pintar();
      case 'reconv': if (L.vista) leerConv(L.vista.key); return;
      case 'dia': DIA_CAL = b.dataset.d; return pintar();
      case 'pubs': PUBS.abierta = !PUBS.abierta; return pintar();
      case 'plegar': ABIERTO[b.dataset.k] = !ABIERTO[b.dataset.k]; return pintar();
      case 'tcli': FILTRO_T = b.dataset.c || ''; return pintar();
      case 'tver': {   // una sesión abre su pantalla (D-275); una tarea o una nota, su hoja
        const id = b.dataset.id, x = (L.tareas || []).find(t => t.id === id), hi = L.hoy && (L.hoy.items || []).find(i => i.k && i.k.id === id);
        if ((x && x.tipo === 'sesion') || (hi && (hi.tipo === 'sesion' || hi.k.tipo === 'sesion'))) return avanzar('ses/' + id);
        return verTarea(id);
      }
      case 'cobro': return aviso('Las facturas se abren en el escritorio.');
      case 'hmov': { const v = L.vista, l = v.historias.filter(h => !h.cancelada).sort((x, y) => String(x.fecha.dia + x.fecha.hora).localeCompare(String(y.fecha.dia + y.fecha.hora))), i = l.findIndex(h => h.id === RUTA.b) + (+b.dataset.d); if (l[i]) ir(`his/${v.key}/${l[i].id}`, 'sustituir'); return; }
      case 'cerrarhoja': if (b && b.classList.contains('velo') && bajarTeclado(b)) return; return pedirCerrar();
      case 'recargar': try { location.reload(); } catch (x) { /* */ } return;
      case 'entrar': try { location.reload(); } catch (x) { /* */ } return;
      case 'codigo': if (M.entrada && M.entrada.pedirCodigo) M.entrada.pedirCodigo(); return;
      case 'version': return hojaVersion();
      case 'otracuenta': return hoja(`<h2>Esta cuenta no es la de la Mesa</h2><p class="ex">Sal y entra con la tuya.</p><div class="botones"><button type="button" class="btn sua" data-a="cerrarhoja">Cerrar</button><button type="button" class="btn pri" data-a="salir">Salir</button></div>`);
      case 'salir': if (M.entrada && M.entrada.salir) M.entrada.salir().then(() => location.reload()); return;
      case 'nube': return hojaNube();
      default: if (C[a]) return C[a](b, e);
    }
  }
  function hojaNube() {
    const e = ST, t = e.vistoA ? horaDe(e.vistoA) : '';
    const quien = e.tiene && e.tiene.dispositivo && M.nube.nombreDe ? M.nube.nombreDe(e.tiene.dispositivo) : '';
    const txt = e.fase === 'sin_conexion' ? `Sin conexión. Lo que ves es de las ${t}: al volver la red, baja lo nuevo.` : `Lo que ves está al día a las ${t}.${quien ? ` La Mesa está abierta en ${quien}; mirar no la coge.` : ' Mirar no coge la Mesa.'}`;
    hoja(`<h2>La nube</h2><p class="ex">${esc(txt)}</p><div class="botones"><button type="button" class="btn sua ancho" data-a="cerrarhoja">Cerrar</button></div>`, { etiqueta: 'La nube' });   // sin «Bajar ahora»: mira cada 10 s (D-271, punto 8)
  }

  // «Apariencia» (D-271, punto 11, variante A): como el iPhone, claro u oscuro; cambia al momento, se recuerda en este aparato y la hoja
  // se queda abierta para ver el cambio
  C.tema = () => {
    const pinta = () => { const t = temaElegido() || 'auto', fila = (k, ico, txt, sub) => { const on = t === k; return `<button type="button" class="estado-op${on ? ' on' : ''}" data-tema="${k}"${on ? ' aria-current="true"' : ''}><span class="mv-ico">${ic(ico)}</span><span class="mv-tt">${txt}${sub ? `<span class="sub">${sub}</span>` : ''}</span>${on ? `<span class="ck">${ic('check', 2.25)}</span>` : ''}</button>`; };
      return `<h2>Apariencia</h2><p class="ex">Solo en este iPhone.</p><div class="estados">${fila('auto', 'movil', 'Como el iPhone', 'Ahora ' + (MQ && MQ.matches ? 'oscuro' : 'claro'))}${fila('claro', 'sol', 'Claro')}${fila('oscuro', 'luna', 'Oscuro')}</div><div class="pie"><div class="botones"><button type="button" class="btn sua ancho" data-a2="cerrar">Cerrar</button></div></div>`; };
    const h = hoja(pinta(), { etiqueta: 'Apariencia' });
    h.addEventListener('click', e => {
      if (!h.isConnected) return;
      const b = e.target.closest('[data-tema]');
      if (b) { lsS(K_TEMA, b.dataset.tema === 'auto' ? null : b.dataset.tema); tema(); pintarPildora(); const y = h.scrollTop; h.innerHTML = '<div class="asa" aria-hidden="true"></div>' + pinta(); h.scrollTop = y; const f = h.querySelector(`[data-tema="${b.dataset.tema}"]`); if (f) f.focus({ preventScroll: true }); return; }
      if (e.target.closest('[data-a2="cerrar"]')) cerrarHojas();
    });
  };
  // la respuesta al cliente: su borrador sobrevive a que iOS cierre la app
  raiz.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('[data-resp]')) { const c = comentariosDe(t.dataset.resp); if (c) lsS('mesa-movil-resp:' + c.pid, t.value || null); const env = t.parentNode.querySelector('.enviar'); if (env) env.disabled = !t.value.trim() || sinRed(); t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }
    if (t.matches('[data-nueva]')) NUEVA.txt = t.value;
    if (C.alEscribir) C.alEscribir(e);
  });
  raiz.addEventListener('focusout', () => { setTimeout(() => { if (PEND_PINTAR && !enUso()) pintar(); }, 0); });

  // ---------- el teclado del iPhone: lo que se escribe queda a la vista (visualViewport, como el portal) ----------
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => ajustarTitulo(), () => {});   // con la letra cargada, el título se vuelve a medir
  W.addEventListener('orientationchange', () => setTimeout(ajustarTitulo, 120));
  // La hoja sigue al visualViewport cuando cambia de tamaño (sale o se va el teclado) y también cuando iOS lo desplaza sin cambiarlo (al
  // enfocar un campo: antes la hoja quedaba cortada y sus botones a media pantalla; D-286): --vvh su alto y --kb lo que tapa el teclado
  // (con lo desplazado). El cursor queda a la vista entre la cabecera de la hoja y su pie, sin animar (un desplazamiento suave en cada cambio lo
  // hacía saltar); la página de detrás vuelve a donde estaba. Pellizcando (zoom), nada: no es el teclado.
  let VV = { kb: -1, t: -1, h: -1 };
  function cursorALaVista(h, a) {
    let r = null;
    if (a.isContentEditable) {   // la caja del cursor; al final del campo (fuera de un texto), la del final de su último texto
      const s = W.getSelection();
      if (s && s.rangeCount && a.contains(s.getRangeAt(0).endContainer)) {
        const g = s.getRangeAt(0).cloneRange(); g.collapse(false);
        if (g.endContainer.nodeType === 1) { let n = g.endContainer.childNodes[g.endOffset - 1]; while (n && n.nodeType === 1) n = n.lastChild; if (n && n.nodeType === 3) g.setStart(n, n.data.length); }
        r = g.getClientRects()[0] || null;
        if (!r || !(r.height || r.top)) {   // una línea vacía: la caja del carácter de al lado (un campo vacío, la del campo)
          const n = g.endContainer, o = g.endOffset;
          if (n.nodeType === 3 && (o < n.data.length || o > 0)) { const q = D.createRange(); const ade = o < n.data.length; if (ade) q.setStart(n, o), q.setEnd(n, o + 1); else q.setStart(n, o - 1), q.setEnd(n, o); const c = q.getClientRects(); r = (ade ? c[0] : c[c.length - 1]) || null; }
        }
      }
    }
    if (!r || !(r.height || r.top)) { const e = a.getBoundingClientRect(); r = a.isContentEditable ? { top: Math.max(e.top, e.bottom - 32), bottom: e.bottom } : e; }
    const hb = h.getBoundingClientRect(), pie = h.querySelector(':scope > .pie'), abajo = (pie ? pie.getBoundingClientRect().top : hb.bottom) - 8, arriba = hb.top + 8;
    if (r.bottom > abajo) h.scrollTop += Math.ceil(r.bottom - abajo); else if (r.top < arriba) h.scrollTop -= Math.ceil(arriba - r.top);
  }
  function alTeclado() {
    const vv = W.visualViewport; if (!vv || vv.scale > 1.05) return;
    const alto = Math.round(vv.height), t = Math.max(0, Math.round(vv.offsetTop)), kb = Math.max(0, Math.round(W.innerHeight - vv.height - vv.offsetTop));
    const cambia = kb !== VV.kb || t !== VV.t || alto !== VV.h;
    const otroAlto = alto !== VV.h;
    if (cambia) { VV = { kb, t, h: alto }; raiz.style.setProperty('--kb', kb + 'px'); raiz.style.setProperty('--vvh', alto + 'px'); raiz.classList.toggle('teclado', W.innerHeight - vv.height > 60); }   // una hoja sube encima del teclado, sin la zona segura de abajo; el teclado sigue ahí aunque iOS desplace la vista (revisión del lote B)
    if (Y_HOJA != null && capas.querySelector('.hoja.on:not([data-permanente])') && Math.abs(W.scrollY - Y_HOJA) > 1) W.scrollTo(0, Y_HOJA);
    if (!cambia) return;
    ajustarTitulo();
    const a = D.activeElement; if (!esCampo(a) || !raiz.contains(a)) return;
    const h = a.closest('.hoja'); if (h) { cursorALaVista(h, a); return; }
    if (!otroAlto) return;   // un campo de la página: solo cuando sale o se va el teclado (desplazar para releer no lo devuelve al campo)
    const r = a.getBoundingClientRect(), fondo = vv.height + vv.offsetTop;
    if (r.bottom > fondo - 12) W.scrollBy({ top: r.bottom - fondo + 24, behavior: POCO.matches ? 'auto' : 'smooth' });
  }
  if (W.visualViewport) { W.visualViewport.addEventListener('resize', alTeclado, { passive: true }); W.visualViewport.addEventListener('scroll', alTeclado, { passive: true }); alTeclado(); }

  // ---------- la nube: su estado, lo bajado y la red ----------
  function alNube(t, d) {
    if (t === 'estado') { ST.fase = d.fase; ST.vistoA = d.vistoA || ST.vistoA; ST.sinSubir = d.sinSubir || 0; ST.tiene = d.tiene || null; pintarChip(); if (d.fase === 'sin_codigo' && M.entrada && M.entrada.pedirCodigo && !raiz.querySelector('.hoja')) M.entrada.pedirCodigo(); return; }
    if (t === 'releido') { releer(); return; }
    if (t === 'bajando') { if (d && d.h > 0) { TRAB.filasHasta = Date.now() + 300; TRAB.filasP = d.h / (d.h + 500); trabajo(); setTimeout(trabajo, 320); } return; }   // una página tras otra; una sola no llega a verse
    if (C.alNube) C.alNube(t, d);
  }
  const red = v => { ST.red = v; pintarChip(); pintarSiQuieto(); };
  W.addEventListener('online', () => red(true)); W.addEventListener('offline', () => red(false));

  // ---------- arrancar: la entrada (contraseña, código), la Mesa (mirando) y Hoy ----------
  async function arrancar() {
    const E = M.entrada;
    try { if (E) await E.abrir(); } catch (e) { /* la entrada dice lo suyo */ }
    if (E) E.cargaDurante();
    let r;
    try { r = await MV().abrir(); } catch (e) { if (E) E.cargaFin(); fallo('No se pudo abrir la Mesa en este iPhone: ' + ((e && e.message) || e)); return; }
    if (E) E.cargaFin();
    if (M.nube && M.nube.alEstado) { M.nube.alEstado(alNube); const e0 = M.nube.estadoYa ? M.nube.estadoYa() : null; if (e0) alNube('estado', e0); }
    else ST.fase = 'apagada';
    if (r && r.modo === 'vieja') hojaVersion();
    const p = D.getElementById('arranque'); if (p) p.remove();
    raiz.hidden = false;
    if (!location.hash) history.replaceState(null, '', '#hoy');
    RUTA = leerRuta();
    leerTareas().then(() => { if (RUTA.p !== 'tareas') raiz.querySelectorAll('.tabs').forEach(n => { n.outerHTML = tabs(RUTA.p === 'mes' ? 'clientes' : RUTA.p); }); });
    await pintar();
    (W.MESA_CARGA = W.MESA_CARGA || {}).movil = 'ok';
  }
  M.movil = { version: VERSION, pintar, releer, ir, _L: L, _ST: ST, _C: C, _t: { decidirArrastre, cierraArrastre } };

  // ===== lote 4: cambiar (D-267, D-268, D-270) =====
  // Cada cambio es una operación {key, slot, campo, valor, visto}: se apunta (localStorage, sobrevive a que iOS cierre la app), se
  // coge la Mesa (el Mac sube lo suyo y la suelta), el núcleo la aplica comparando con lo que se vio y se suelta la Mesa en cuanto ha
  // subido. Un doble toque en «Guardar» guarda una vez. Nada de esto corre solo: solo al tocarlo.
  // La cola: cada operación con su estado. «nueva»: se aplica en este «Guardar». «quedo»: no llegó (sin conexión, «Ahora no», la
  // Mesa en otro aparato, un choque sin decidir) y espera en «sin subir» a que Kevin la suba encima o la descarte: nunca se aplica
  // sola (R4). Al abrir la app, lo que quedó a medias es «quedo».
  const K_OPS = 'mesa-movil-ops';
  // los campos nuevos de la 4.38 (D-272, D-275) van en otra clave: una 4.37 que leyera la cola los quitaría como «campo no válido»
  // (fallo definitivo); así no los ve y esperan a una 4.38 (lección 228). La cola es la unión de las dos, en su orden
  const K_OPS2 = 'mesa-movil-ops2', NUEVOS = /^(tarea(Texto|Fecha|Cliente|Detalles)|subtarea|ses[A-Z]\w*)$/;
  const leerK = k => { try { const l = JSON.parse(lsG(k) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
  const opsLeer = () => [...leerK(K_OPS), ...leerK(K_OPS2)].sort((a, b) => (a.at || 0) - (b.at || 0));
  const opsGuardar = l => { const v = l.filter(x => !NUEVOS.test(x.campo)), n = l.filter(x => NUEVOS.test(x.campo)); lsS(K_OPS, v.length ? JSON.stringify(v) : null); lsS(K_OPS2, n.length ? JSON.stringify(n) : null); ST.opsN = l.filter(x => x.estado !== 'nueva').length; pintarChip(); };
  const opsQuitar = id => opsGuardar(opsLeer().filter(o => o.id !== id));
  const opsMarcar = (ids, estado) => opsGuardar(opsLeer().map(x => (ids.includes(x.id) ? { ...x, estado } : x)));
  opsGuardar(opsLeer().map(x => ({ ...x, estado: 'quedo' })));
  const nuevoOp = () => 'op' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const miles = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');   // 2.200 como en la v3 (es-ES no agrupa 4 cifras)
  const corto2 = id => (M.nube && M.nube.nombreDe ? M.nube.nombreDe(id) : 'otro aparato').replace(/ \([0-9a-f]{4}\)$/, '');
  // la misma operación (un doble toque) y otra del mismo campo (la nueva sustituye a la que aún no se aplicó)
  const firma = op => { const v = op.valor || {}; return op.campo === 'tareaNueva' ? ['tn', v.tipo, v.txt, v.fecha || '', v.cliente || ''].join('|') : [op.key, op.slot, op.campo, JSON.stringify(op.valor)].join('|'); };
  const mismoCampo = (a, b) => a.campo !== 'tareaNueva' && a.campo === b.campo && a.key === b.key && a.slot === b.slot && (a.campo !== 'capTexto' || (a.valor || {}).k === (b.valor || {}).k) && (a.campo !== 'subtarea' || ((a.valor || {}).sid === (b.valor || {}).sid && (a.valor || {}).accion === (b.valor || {}).accion)) && (a.campo !== 'sesMaterial' || ((a.valor || {}).ap === (b.valor || {}).ap && (a.valor || {}).m === (b.valor || {}).m)) && (a.campo !== 'sesTexto' || (a.valor || {}).ap === (b.valor || {}).ap);   // cada subtarea, su campo (D-272); cada cosa del material y cada texto de una sesión, el suyo (D-275)
  let RUN = null, OTRA = false, ENVUELO = null;
  const ESCRITOS = new Map();   // lo que escribió este iPhone en cada campo, como quedó guardado: un choque contra eso no es un choque
  // un fallo pasajero deja la operación en «sin subir»; uno definitivo (publicada, fuera del mes, ya no está…) la quita y lo dice
  const pasajero = e => /^(sin turno|sin decidir|otro tablero|sin tareas|sin sesiones)$/.test(String(e)) || /^no se pudo/.test(String(e));
  // lo que dice una operación, para la hoja del choque y la de «sin subir»
  function opTexto(op, v) {
    if (op.campo === 'fecha') { const iso = v && typeof v === 'object' ? (v.hora ? X().madridISO(v.dia, v.hora) : v.dia) : v; return iso ? campoFecha({ dia: X().localDay(iso), hora: X().dOnly(iso) ? '' : X().localTime(iso) }) : 'Sin fecha'; }
    if (op.campo === 'estado') { const k = v && v.v; return k ? (X().ESTADOS.find(x => x[0] === k) || [k, k])[1] + (v.motivo ? ' · ' + v.motivo : '') : 'Según sus datos'; }
    if (op.campo === 'capElegir') return v == null ? 'Sin elegir' : typeof v === 'object' ? (v.pick == null ? 'Sin elegir' : `Caption ${v.pick + 1}`) : `Caption ${v + 1}`;
    if (op.campo === 'capTexto') { const t = v && typeof v === 'object' ? v.texto : v; return String(t || '').slice(0, 140) + (String(t || '').length > 140 ? '…' : ''); }
    if (op.campo === 'tarea') return v && v.hecha ? 'Hecha' : 'Sin hacer';
    if (op.campo === 'tareaNueva') return (v && v.tipo === 'nota' ? 'Nota: ' : 'Tarea: ') + ((v && v.txt) || '');
    if (op.campo === 'tareaTexto' || op.campo === 'tareaDetalles') return String(v || '').slice(0, 140) || 'Vacío';
    if (op.campo === 'tareaFecha') return v ? cap1(DS[dow(v)]) + ' ' + corto(v) : 'Sin fecha';
    if (op.campo === 'tareaCliente') return v ? nombreCli(v) : 'Sin cliente';
    if (op.campo === 'sesNombre') return String(v || '');
    if (op.campo === 'sesInicio') { const o = v || {}; return o.fecha ? campoFecha({ dia: o.fecha, hora: o.hora || '' }) : 'Sin fecha'; }
    if (op.campo === 'sesClientes') return (v || []).length ? v.map(nombreCli).join(' · ') : 'Sin cliente';
    if (op.campo === 'sesMaterial') return v && v.hecho ? 'Marcado' : 'Sin marcar';
    if (op.campo === 'sesTexto') { const t = v && typeof v === 'object' ? v.texto : v; return String(t || '').slice(0, 140) || 'Vacío'; }
    if (op.campo === 'subtarea') { const o = op.valor || {}; if (v === op.valor) return o.accion === 'quitar' ? 'Quitarla' : o.accion === 'hecha' ? (o.hecha ? 'Hecha' : 'Sin hacer') : String(o.txt || ''); return v == null ? 'No está' : v.txt != null ? v.txt : v.hecha != null ? (v.hecha ? 'Hecha' : 'Sin hacer') : 'Está'; }
    return '';
  }
  const opQue = op => (({ fecha: 'Fecha y hora', estado: 'Estado', capElegir: 'Caption elegido', capTexto: 'Caption retocado', tarea: 'Tarea', tareaNueva: 'Nueva', tareaTexto: 'Texto', tareaFecha: 'Fecha', tareaCliente: 'Cliente', tareaDetalles: 'Detalles', subtarea: 'Subtarea', sesNombre: 'Nombre', sesInicio: 'Fecha y hora', sesClientes: 'Clientes', sesMaterial: 'Material', sesTexto: 'Texto' })[op.campo] || op.campo) + (op.etq ? ' · ' + op.etq : '');   // op.etq: la subtarea, la cosa del material o el apartado (revisión del lote B)
  // guardar de fondo (D-271, punto 9): sin hoja que tape la pantalla; sus pasos (coger, aplicar, subir, soltar) llenan el monograma
  const alPaso = n => { TRAB.guardar = [0, 0.25, 0.5, 1][n] ?? 1; trabajo(); };   // el monograma, un cuarto por paso
  // lo que se está guardando: la pantalla enseña ya el valor nuevo, con un aro en el sitio de su flecha
  const enCurso = (key, slot, campo, k) => { const l = opsLeer().filter(x => x.estado === 'nueva' && x.slot === slot && x.campo === campo && (key == null || x.key === key) && (k == null || (x.valor || {}).k === k)); return l.length ? l[l.length - 1] : null; };
  const GIRA = '<span class="mv-gira" role="img" aria-label="Guardando"></span>';
  // una pregunta de un guardado de fondo sale cuando Kevin no tiene otra hoja abierta (nunca le cierra la que está usando)
  async function sinHoja() { for (let i = 0; i < 2400 && capas.querySelector('.hoja.on:not([data-permanente])'); i++) await new Promise(r => setTimeout(r, 250)); }
  // «<aparato> no contesta»: esperar más, usarla aquí o dejarlo (D-254, D-268); cerrada de otro modo (atrás, Esc) es «Ahora no»
  function hojaNoContesta(e, que) {
    return new Promise(res => {
      const quien = corto2(e.dispositivo), h = e.latido ? X().localTime(e.latido) : '', n = +e.cola || 0;
      const el = hoja(`<h2>${esc(quien)} no contesta</h2>${que ? `<p class="ex">Para guardar ${que}.</p>` : ''}<p class="ex">${h ? `Está dormido o cerrado desde las ${esc(h)}. ` : ''}${n ? `Tenía ${esc(plural(n, 'cambio', 'cambios'))} sin subir: se quedan allí, en «quedó sin subir».` : 'No tenía cambios sin subir.'}</p><div class="llave" style="margin:0">${ic('mac')}<span>Al volver a abrirla en ${esc(quien)}, verá lo que cambies aquí.</span></div><div class="botones"><button type="button" class="btn sua" data-r="esperar">Esperar</button><button type="button" class="btn pri" data-r="forzar" data-foco>Usarla aquí</button></div><div class="botones" style="grid-template-columns:1fr;margin-top:8px"><button type="button" class="btn sua" data-r="no">Ahora no</button></div>`, { pregunta: true, etiqueta: quien + ' no contesta', alCerrar: () => res('no') });
      el.addEventListener('click', ev => { if (!el.isConnected) return; const b = ev.target.closest('[data-r]'); if (b) { res(b.dataset.r); cerrarEsta(el); } });
    });
  }
  // el choque: el Mac cambió lo mismo mientras tanto; los dos valores y Kevin decide (R3). Cerrada sin decidir, el cambio espera en
  // «sin subir». Elegir un caption de una tanda que Kevin no vio no se ofrece: vuelve a elegir
  function hojaChoque(op, ch) {
    return new Promise(res => {
      const otraTanda = op.campo === 'capElegir' && (ch.visto || {}).at !== (ch.ahora || {}).at;
      const fila = (k, v) => `<div class="campo" style="cursor:default"><span class="k">${k}</span><span class="v" style="white-space:normal">${esc(v)}</span></div>`;
      const cuerpo = otraTanda
        ? `<p class="ex">Llegó otra tanda de captions desde que la viste: lo que elegiste era de la anterior. Vuelve a elegir en «Captions».</p><div class="botones" style="grid-template-columns:1fr"><button type="button" class="btn pri" data-r="mesa" data-foco>Entendido</button></div>`
        : `<p class="ex">${esc(opQue(op))}${op.nombre ? ` de <b>${esc(op.nombre)}</b>` : ''}: ${esc(porQueChoque(op, ch))}</p><div class="grupo">${fila('Lo tuyo', opTexto(op, op.valor))}${fila('En la Mesa', opTexto(op, ch.ahora))}</div><div class="botones"><button type="button" class="btn sua" data-r="mesa">Dejar lo de la Mesa</button><button type="button" class="btn pri" data-r="mio" data-foco>Usar lo mío</button></div>`;
      const el = hoja(`<h2>${otraTanda ? 'Otra tanda de captions' : 'Cambió en la Mesa'}</h2>${cuerpo}`, { pregunta: true, etiqueta: 'Cambió en la Mesa', alCerrar: () => res('cerrar') });
      el.addEventListener('click', ev => { if (!el.isConnected) return; const b = ev.target.closest('[data-r]'); if (b) { res(b.dataset.r); cerrarEsta(el); } });
    });
  }
  function porQueChoque(op, ch) {   // lo que cambió en la Mesa desde que lo viste, cuando los dos valores se leen igual
    const v = ch.visto || {}, a = ch.ahora || {};
    if (op.campo === 'estado' && v.v === a.v && v.sig !== a.sig) return 'desde que la viste cambió su caption, foto o contexto. Mírala antes de decidir.';
    if (op.campo === 'capTexto' && v.at !== a.at) return 'llegó otra tanda de captions desde que empezaste a retocarlo.';
    return 'mientras lo cambiabas, se cambió en otro aparato.';
  }
  // coger la Mesa (con «no contesta» si toca); true si la tiene, false si Kevin dijo «Ahora no»
  async function cogerMesa(prog) {
    try { await MV().reclamar(); } catch (e) { /* esta pestaña */ }
    let t = await M.nube.tomar();
    for (;;) {
      if (t && t.hecho) return true;
      if (t && t.espera) {
        await sinHoja();
        const r = await hojaNoContesta(t.espera, prog && prog.que);
        if (r === 'no') return false;
        if (prog) prog.paso(0);
        t = r === 'forzar' ? await M.nube.forzarAqui(t.espera.turno) : await M.nube.tomar({ esperar: true });
        if (t && t.otraVez) t = await M.nube.tomar();
        continue;
      }
      if (t && /^(parada|dormida)$/.test(t.error)) throw new Error('La Mesa sigue en otra pestaña de este iPhone: tu cambio espera en «sin subir».');
      if (t && t.error === 'apagada') throw new Error('Sin nube en este iPhone: tu cambio espera en «sin subir».');
      throw new Error(t && t.error === 'sin_conexion' ? 'Sin conexión: tu cambio espera en «sin subir».' : t && t.error === 'sin_sesion' ? 'Tu sesión se cerró: entra otra vez.' : t && t.error === 'verificacion' ? 'Falta el código de tu app.' : 'No se pudo coger la Mesa' + (t && t.error ? ` (${t.error})` : '') + '.');
    }
  }
  // apuntar: la operación entra en la cola (un doble toque, una vez; otra del mismo campo que aún no se aplicó, sustituida)
  function apuntar(ops, estado) {
    const l = opsLeer(), nuevas = [];
    for (const op0 of [].concat(ops || [])) {
      const f = firma(op0);
      if (l.some(x => x.estado === 'nueva' && firma(x) === f) || nuevas.some(x => firma(x) === f)) continue;
      const op = { ...op0, id: op0.id || nuevoOp(), at: Date.now(), estado };
      for (let i = l.length - 1; i >= 0; i--) if (l[i].id !== ENVUELO && mismoCampo(l[i], op)) l.splice(i, 1);
      nuevas.push(op);
    }
    if (nuevas.length) opsGuardar([...l, ...nuevas]);
    return nuevas.map(x => x.id);
  }
  // guardar: apunta y aplica lo nuevo con la Mesa cogida un momento. Lo que llega mientras se guarda se aplica en la misma vuelta
  // (o en la siguiente): nunca se descarta. true si sus operaciones se aplicaron
  async function guardar(ops, o = {}) {
    const red = !sinRed(), nube = !!(M.nube && M.nube.tomar) && ST.fase !== 'apagada';
    const ids = apuntar(ops, red && nube ? 'nueva' : 'quedo');
    pintarSiQuieto();   // lo que se ve al tocar sale en el acto: el valor nuevo con su aro (D-271, punto 9)
    if (!red) { aviso('Sin conexión: tu cambio espera en «sin subir».', { error: true, ms: 7000 }); return false; }
    if (!nube) { aviso('Sin nube en este iPhone: tu cambio espera en «sin subir».', { error: true, ms: 7000 }); return false; }
    for (let i = 0; RUN && !RUN.g && i < 50; i++) { const r0 = RUN; await r0.catch(() => null); if (RUN === r0) break; }   // «Subir encima» o «Descartar» de la nube en marcha: primero acaba (nunca en bucle)
    if (!RUN) {
      ST.guardando = true; pintarChip();
      const p = (async () => { let oo = o; do { OTRA = false; await correr(oo, ESCRITOS); oo = {}; } while (OTRA && opsLeer().some(x => x.estado === 'nueva')); })();
      RUN = p; RUN.g = true;
      p.catch(() => null).then(() => { if (RUN === p) RUN = null; ST.guardando = false; TRAB.guardar = null; trabajo(); pintarChip(); });   // se limpia desde fuera: aunque algo fallara antes de su primer await
    } else OTRA = true;
    await RUN;
    return !ids.length || !opsLeer().some(x => ids.includes(x.id));
  }
  async function correr(o, escritos = new Map()) {
    const quien = ST.tiene && ST.tiene.dispositivo ? corto2(ST.tiene.dispositivo) : '';
    const prim = opsLeer().find(x => (o.solo ? o.solo.includes(x.id) : x.estado === 'nueva'));
    const prog = { paso: n => alPaso(n), h: null, que: prim ? esc(`«${opQue(prim).toLowerCase()}»${prim.nombre ? ' de ' + prim.nombre : ''}`) : '' };
    const toca = x => (o.solo ? o.solo.includes(x.id) : x.estado === 'nueva');
    const res = { ok: 0, dejados: 0, quedan: 0, por: {}, fallos: [], avisos: [] }, hechos = new Set();
    const campoDe = op => [op.key, op.slot, op.campo, op.campo === 'capTexto' ? (op.valor || {}).k : op.campo === 'subtarea' ? (op.valor || {}).sid + ':' + (op.valor || {}).accion : op.campo === 'sesMaterial' ? (op.valor || {}).ap + ':' + (op.valor || {}).m : op.campo === 'sesTexto' ? (op.valor || {}).ap : ''].join('|');
    const queda = (ids, motivo) => { if (!ids.length) return; opsMarcar(ids, 'quedo'); res.quedan += ids.length; res.por[motivo] = (res.por[motivo] || 0) + ids.length; };
    const motivoDe = e => (e === 'sin turno' ? 'turno' : e === 'sin decidir' ? 'decidir' : 'fallo');
    let s = null;
    try {
      prog.paso(0);
      if (!(await cogerMesa(prog))) { opsMarcar(opsLeer().filter(toca).map(x => x.id), 'quedo'); aviso('Tu cambio espera en «sin subir».', { ms: 6000 }); pintarSiQuieto(); return; }   // vuelve lo de la Mesa
      prog.paso(1);
      vuelta: for (;;) {
        const lista = opsLeer().filter(x => toca(x) && !hechos.has(x.id));
        if (!lista.length) break;
        for (const op of lista) {
          hechos.add(op.id);
          if (!opsLeer().some(x => x.id === op.id)) continue;   // sustituida por otra del mismo campo mientras tanto
          ENVUELO = op.id;
          // «Subir encima»: lo tuyo encima (R4), salvo un caption elegido de otra tanda, que nunca se elige a ciegas
          const ciego = o.solo && op.campo === 'capElegir';
          let r = await MV().aplicar(o.solo && !ciego ? { ...op, forzar: true } : op);
          if (r && r.choque && ciego) r = (r.choque.visto || {}).at !== (r.choque.ahora || {}).at ? { error: 'Llegó otra tanda de captions: vuelve a elegir' } : await MV().aplicar({ ...op, forzar: true });
          if (r && r.choque && escritos.has(campoDe(op)) && mismoEscrito(op, r.choque.ahora, escritos.get(campoDe(op)))) r = await MV().aplicar({ ...op, forzar: true });   // lo que «cambió» lo escribió esta misma vuelta
          if (r && r.choque) {
            await sinHoja();
            const a = await hojaChoque(op, r.choque);
            prog.paso(1);
            r = a === 'mio' ? await MV().aplicar({ ...op, forzar: true }) : a === 'mesa' ? { ok: true, dejado: true } : { error: 'sin decidir' };
          }
          ENVUELO = null;
          if (r && r.ok) { opsQuitar(op.id); if (r.dejado) res.dejados++; else { res.ok++; const vv = op.campo === 'tareaNueva' ? null : await MV().valor(op).catch(() => null); escritos.set(campoDe(op), vv && !vv.error ? { guardado: vv.v } : op.valor); } res.avisos.push(...(r.avisos || [])); if (op.campo === 'capTexto') lsS(K_BORR(op.key, op.slot, op.valor.k), null); }
          else if (r && pasajero(r.error)) {
            queda([op.id], motivoDe(r.error));
            if (r.error === 'sin turno') { queda(opsLeer().filter(x => toca(x) && x.estado === 'nueva' && !hechos.has(x.id)).map(x => x.id), 'turno'); break vuelta; }
          }
          else { opsQuitar(op.id); res.fallos.push(errorTexto(r && r.error)); }
        }
        if (o.solo) break;
      }
      prog.paso(2);
      M.nube.retener(false);
      s = await M.nube.soltar();
      prog.paso(3);
    } catch (e) {
      opsMarcar(opsLeer().filter(x => toca(x) && x.estado === 'nueva').map(x => x.id), 'quedo');
      try { M.nube.retener(false); if (M.nube.conTurno && M.nube.conTurno()) M.nube.soltar(); } catch (x) { /* */ }
      ENVUELO = null;
      aviso((e && e.message) || 'No se pudo guardar: tu cambio espera en «sin subir».', { error: true, ms: 8000 });
      await releerTodo();
      return;
    }
    // un solo aviso, el que más importa: lo que no se pudo, lo que se perdió al soltar, lo que espera, y si no, «Guardado»
    const mas = n => (n > 1 ? ` (y ${n - 1} más)` : '');
    if (res.fallos.length) aviso(res.fallos[0] + mas(res.fallos.length), { error: true, ms: 8000 });
    else if (s && s.error === 'perdida') aviso('La Mesa pasó a otro aparato antes de subir: tu cambio está en «sin subir».', { error: true, ms: 8000 });
    else if (res.quedan) { const n = plural(res.quedan, 'cambio espera', 'cambios esperan'); aviso(res.por.turno ? `La Mesa se soltó a mitad: ${n} en «sin subir».` : res.por.fallo ? `No se pudo guardar en este iPhone: ${n} en «sin subir».` : `Sin decidir: ${n} en «sin subir».`, { error: true, ms: 8000 }); }
    else if (s && s.error === 'sin_conexion') aviso('Guardado en este iPhone; sube en cuanto vuelva la red.', { ms: 8000 });
    else if (s && s.error) aviso('Guardado en este iPhone; aún no ha subido: lo intenta otra vez solo.', { ms: 8000 });
    else if (res.ok) { aviso(res.avisos.length ? res.avisos[0] : 'Guardado.', { ok: true, ms: res.avisos.length ? 8000 : 4200 }); }
    else if (res.dejados) aviso('Se queda lo de la Mesa.', { ms: 4200 });
    await releerTodo();
  }
  function mismoEscrito(op, ahora, v) {
    if (v && typeof v === 'object' && 'guardado' in v) return JSON.stringify(ahora ?? null) === JSON.stringify(v.guardado ?? null);   // como quedó escrito
    if (op.campo === 'fecha') { const iso = v && typeof v === 'object' ? (v.hora ? X().madridISO(v.dia, v.hora) : v.dia) : v; return !!iso && !!ahora && X().sameDate(iso, ahora); }
    if (op.campo === 'estado') return !!ahora && (ahora.v || null) === ((v && v.v) || null) && String(ahora.motivo || '') === String((v && v.v === 'cancelado' && v.motivo) || '');
    if (op.campo === 'capElegir') return !!ahora && ahora.pick === v;
    if (op.campo === 'capTexto') return !!ahora && ahora.texto === (v && v.texto);
    if (op.campo === 'tarea') return !!ahora && !!ahora.hecha === !!(v && v.hecha);
    return false;
  }
  // lo que necesita la Mesa sin ser una operación («Subir encima» y «Descartar» de lo que apartó la nube): el mismo freno y la misma hoja
  async function conLaMesa(fn) {
    if (RUN) { aviso('Espera: se está guardando.'); return null; }
    let r = null;
    ST.guardando = true; pintarChip();
    const p = (async () => {
      const prog = { paso: n => alPaso(n), h: null, que: '' };
      try {
        prog.paso(0);
        if (!(await cogerMesa(prog))) return;
        prog.paso(1); r = await fn(); prog.paso(2);
      } catch (e) { r = { error: (e && e.message) || String(e) }; }
      finally {
        try { M.nube.retener(false); if (M.nube.conTurno && M.nube.conTurno()) await M.nube.soltar(); } catch (x) { /* */ }
      }
    })();
    RUN = p;
    await p.catch(() => null).then(() => { if (RUN === p) RUN = null; ST.guardando = false; TRAB.guardar = null; trabajo(); pintarChip(); });
    await releerTodo();
    return r;
  }
  const ERR = { publicada: 'Ya está publicada: no se mueve.', 'fuera de la mesa': 'Esa fecha cae fuera de este mes.', 'no existe': 'Ya no está: se quitó en otro aparato.', 'fecha no válida': 'Esa fecha no vale.', 'sin captions': 'Sin captions todavía.', 'una tarea necesita un texto': 'Una tarea necesita un texto.', 'una nota necesita un texto': 'Una nota necesita un texto.', 'una subtarea necesita un texto': 'Una subtarea necesita un texto.', 'cliente no válido': 'Ese cliente ya no está.', 'una sesión necesita un nombre': 'Una sesión necesita un nombre.', perdida: 'La Mesa se soltó antes de subir: sigue en «sin subir».', sin_conexion: 'Sin conexión: sube en cuanto vuelva la red.', no_subio: 'Aún no ha subido: lo intenta otra vez solo.' };
  const errorTexto = e => (e ? ERR[e] || cap1(String(e)) + '.' : 'No se pudo.');
  async function releerTodo() {
    L.hoy = null; L.clientes = null; L.error = {};
    if (L.vista) { const v = await MV().mirar(L.vista.key).catch(() => null); L.vista = v && !v.error ? v : null; }
    await leerTareas();
    if (RUTA.p === 'ses' && L.ses && L.ses.id) await leerSes(L.ses.id);   // tras guardar, la sesión con lo guardado (revisión del lote B)
    pintar();
  }
  const pAhora = () => { const v = L.vista; return v && v.key === RUTA.a ? v.posts.find(x => x.id === RUTA.b) : null; };
  async function aqui() { if (!L.vista || L.vista.key !== RUTA.a) return null; const S0 = X().S; if (!S0 || S0.key !== RUTA.a) { const v = await MV().mirar(RUTA.a); if (v && !v.error) L.vista = v; } return X().S; }

  // ---------- fecha y hora: un calendario y ruedas que se usan como las del iPhone, dibujados por la Mesa (D-270) ----------
  const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), MINS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
  function calendarioHTML(sel, mesVisto, lim, o = {}) {
    const d1 = mesVisto + '-01', pre = (dow(d1) + 6) % 7, ini = addD(d1, -pre), dias = Array.from({ length: 42 }, (_, i) => addD(ini, i));
    const puede = d => (!lim || (d >= lim.desde && d <= lim.hasta));
    const mAnt = X().addMonths(mesVisto, -1), mSig = X().addMonths(mesVisto, 1), hay = m => !lim || (m + '-31' >= lim.desde && m + '-01' <= lim.hasta);
    return `<div class="selcal"><div class="selcal-h"><b>${esc(mesNombre(mesVisto))} ${mesVisto.slice(0, 4)}</b><span><button type="button" class="ib" data-cal="${mAnt}" aria-label="Mes anterior"${hay(mAnt) ? '' : ' disabled'}>${ic('izq')}</button><button type="button" class="ib" data-cal="${mSig}" aria-label="Mes siguiente"${hay(mSig) ? '' : ' disabled'}>${ic('der')}</button></span></div>
      <div class="cal-s" aria-hidden="true">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="selcal-g" role="grid" aria-label="${esc(mesNombre(mesVisto))}">${dias.map(d => { const en = d.slice(0, 7) === mesVisto, ok = en && puede(d); return `<button type="button" class="sd${en ? '' : ' otro'}${d === sel ? ' sel' : ''}${d === hoy() ? ' hoyd' : ''}" data-dia="${d}" aria-label="${esc(cap1(DL[dow(d)]) + ' ' + corto(d))}"${d === sel ? ' aria-pressed="true"' : ''}${ok ? '' : ' disabled'}${en ? '' : ' tabindex="-1" aria-hidden="true"'}>${+d.slice(8, 10)}</button>`; }).join('')}</div>
      ${o.pie ? `<div class="selcal-pie">${o.pie}</div>` : ''}</div>`;
  }
  // una rueda: desplazamiento nativo con imán (la inercia del iPhone), de 5 en 5, con la hora exacta en su sitio
  function ruedaHTML(nombre, vals, sel) {
    return `<div class="rueda" role="spinbutton" tabindex="0" data-rueda="${nombre}" aria-label="${nombre === 'h' ? 'Hora' : 'Minutos'}" aria-valuenow="${+sel}" aria-valuetext="${esc(sel)}" aria-valuemin="${+vals[0]}" aria-valuemax="${+vals[vals.length - 1]}"><div class="rueda-in">${vals.map(v => `<span data-v="${v}"${v === sel ? ' class="sel"' : ''}>${v}</span>`).join('')}</div></div>`;
  }
  function armarRueda(el, alCambiar) {
    const inn = el.querySelector('.rueda-in'), items = [...inn.children], H = items[0] ? items[0].getBoundingClientRect().height || 32 : 32;
    const idx = () => Math.max(0, Math.min(items.length - 1, Math.round(inn.scrollTop / H)));
    const marcar = () => { const i = idx(); items.forEach((s, j) => { const d = Math.abs(j - i); s.style.setProperty('--d', Math.min(d, 3)); s.classList.toggle('sel', j === i); }); const v = items[i].dataset.v; el.setAttribute('aria-valuenow', +v); el.setAttribute('aria-valuetext', v); return v; };
    const ir = (i, suave) => { inn.scrollTo({ top: i * H, behavior: suave && !POCO.matches ? 'smooth' : 'auto' }); };
    const i0 = Math.max(0, items.findIndex(s => s.classList.contains('sel'))); requestAnimationFrame(() => { ir(i0); marcar(); });
    let raf = 0, t = 0;
    inn.addEventListener('scroll', () => { if (!el.isConnected) return; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (el.isConnected) marcar(); }); clearTimeout(t); t = setTimeout(() => { if (el.isConnected) alCambiar(marcar()); }, 140); }, { passive: true });   // una rueda ya quitada (la hoja se redibujó) no cambia nada
    el.addEventListener('keydown', e => { const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0; if (!d) return; e.preventDefault(); ir(Math.max(0, Math.min(items.length - 1, idx() + d)), true); });
    inn.addEventListener('click', e => { const s = e.target.closest('[data-v]'); if (s) ir(items.indexOf(s), true); });
  }
  async function hojaFecha(p, v) {
    if (p.publicada || p.tocaria === 'publicado') return aviso('Ya está publicada: no se mueve.');
    await aqui();
    const lim = MV().dias(v.key) || null;
    let dia = p.fecha.dia || (lim && lim.desde) || hoy(), conHora = !p.fecha.sinHora && !!p.fecha.hora, hh = (p.fecha.hora || '13:00').slice(0, 2), mm = (p.fecha.hora || '13:00').slice(3, 5), mes = dia.slice(0, 7);
    const mins = MINS.includes(mm) ? MINS : [...MINS, mm].sort();
    const pinta = () => {
      const avisoZ = p.programada ? `<div class="aviso" style="margin:12px 0 0">${ic('alerta')}<span>Ya está programada en Instagram. Zernio seguirá con ${p.fecha.hora ? 'las ' + esc(p.fecha.hora) : 'su fecha'} hasta que se lo pidas a Claude.</span></div>` : '';
      return `<h2>Fecha y hora</h2><p class="ex">${esc(p.nombre)} · ${esc(p.tipo.txt)}</p>${calendarioHTML(dia, mes, lim)}
        ${conHora ? `<div class="ruedas"><span class="banda"></span>${ruedaHTML('h', HORAS, hh)}<b class="dos">:</b>${ruedaHTML('m', mins, mm)}</div><button type="button" class="lnk" data-a2="sinhora" style="margin:4px auto 0;display:flex">Sin hora</button>` : `<button type="button" class="campo" data-a2="ponhora" style="margin-top:10px;border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line2)"><span class="k">Hora</span><span class="v">Sin hora</span><span class="chev">${ic('der')}</span></button>`}
        ${avisoZ}<div class="pie"><div class="botones"><button type="button" class="btn sua" data-a2="cancelar">Cancelar</button><button type="button" class="btn pri" data-a2="guardar">Guardar</button></div></div>`;
    };
    const h = hoja(pinta(), { etiqueta: 'Fecha y hora' });
    const armar = () => { h.querySelectorAll('[data-rueda]').forEach(r => armarRueda(r, x => { if (r.dataset.rueda === 'h') hh = x; else mm = x; })); };
    const leerRuedas = () => { if (!conHora) return; const rh = h.querySelector('[data-rueda="h"]'), rm = h.querySelector('[data-rueda="m"]'); if (rh) hh = rh.getAttribute('aria-valuetext') || hh; if (rm) mm = rm.getAttribute('aria-valuetext') || mm; };
    const repinta = () => { leerRuedas(); const y = h.scrollTop; h.innerHTML = `<div class="asa" aria-hidden="true"></div>` + pinta(); arrastrable(h); armar(); h.scrollTop = y; };
    armar();
    h.addEventListener('click', async e => { if (!h.isConnected) return;
      const d = e.target.closest('[data-dia]'); if (d && !d.disabled) { dia = d.dataset.dia; return repinta(); }
      const c = e.target.closest('[data-cal]'); if (c && !c.disabled) { mes = c.dataset.cal; return repinta(); }
      const b = e.target.closest('[data-a2]'); if (!b) return;
      if (b.dataset.a2 === 'cancelar') return cerrarHojas();
      if (b.dataset.a2 === 'sinhora') { leerRuedas(); conHora = false; return repinta(); }
      if (b.dataset.a2 === 'ponhora') { conHora = true; return repinta(); }
      if (b.dataset.a2 === 'guardar') {
        leerRuedas();   // lo que se ve, aunque el dedo acabe de soltarla
        const valor = conHora ? { dia, hora: `${hh}:${mm}` } : { dia };
        const igual = p.fecha.dia === dia && (conHora ? p.fecha.hora === valor.hora : !p.fecha.hora);
        cerrarHojas(true); if (igual) return;
        guardar({ key: v.key, slot: p.id, campo: 'fecha', valor, visto: p.fecha.iso, nombre: p.nombre });
      }
    });
  }
  C.fecha = () => { const p = pAhora(); if (p) hojaFecha(p, L.vista); };

  // ---------- el estado (la hoja de la v3; el porqué de cada uno, del núcleo) ----------
  const SUB = { aprobado: 'Aprobada: lista para programar', noaprobado: 'El cliente pidió cambios', programado: 'Ya está en Zernio', publicado: 'Ya salió en Instagram', cancelado: 'Sale del mes; no se borra nada' };
  C.estado = async () => {
    const p = pAhora(), v = L.vista; if (!p) return;
    await aqui();
    const l = MV().estadosPosibles(v.key, p.id), visto = (await MV().valor({ key: v.key, slot: p.id, campo: 'estado' })).v;
    const h = hoja(`<h2>Estado</h2><p class="ex">${esc(p.nombre)} · ahora ${esc(p.estado.txt)}</p><div class="estados">${l.map(x => `<button type="button" class="estado-op${x.actual ? ' on' : ''}" data-v="${x.v || ''}"${x.ok ? '' : ' disabled'}${x.actual ? ' aria-current="true"' : ''}><span class="es ${esc(x.k)}">${marcaEst(x.k)}<span>${esc(x.txt)}<br><span class="sub">${esc(x.v ? SUB[x.v] : 'Lo que dicen sus datos')}</span>${x.ok ? '' : `<span class="porque">${esc(cap1(x.porque))}</span>`}</span></span>${x.actual ? `<span class="ck">${ic('check', 2.25)}</span>` : ''}</button>`).join('')}</div><div data-motivo hidden><span class="lbl">Motivo (opcional)</span><textarea rows="2" maxlength="500" data-mot>${esc(p.motivo || '')}</textarea></div><div class="pie"><div class="botones"><button type="button" class="btn sua ancho" data-a2="cancelar">Cancelar</button></div></div>`, { etiqueta: 'Estado' });
    h.addEventListener('click', e => { if (!h.isConnected) return;
      const b = e.target.closest('.estado-op'), c = e.target.closest('[data-a2]');
      if (c && c.dataset.a2 === 'cancelar') return cerrarHojas();
      if (c && c.dataset.a2 === 'cancelarpub') { const mot = h.querySelector('[data-mot]').value; cerrarHojas(true); return guardar({ key: v.key, slot: p.id, campo: 'estado', valor: { v: 'cancelado', motivo: mot }, visto, nombre: p.nombre }); }
      if (!b || b.disabled) return;
      const nv = b.dataset.v || null, x = l.find(y => (y.v || null) === nv);
      if (x && x.actual && nv !== 'cancelado') return cerrarHojas();
      if (nv === 'cancelado') {   // D-082: el motivo, opcional
        h.querySelectorAll('.estado-op').forEach(x => { const on = x === b; x.classList.toggle('on', on); if (on) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current'); const ck = x.querySelector('.ck'); if (ck && !on) ck.remove(); if (on && !ck) x.insertAdjacentHTML('beforeend', `<span class="ck">${ic('check', 2.25)}</span>`); });
        h.querySelector('[data-motivo]').hidden = false; h.querySelector('.pie .botones').innerHTML = `<button type="button" class="btn sua" data-a2="cancelar">Volver</button><button type="button" class="btn pri" data-a2="cancelarpub">Cancelarla</button>`;
        const t = h.querySelector('[data-mot]'); t.focus(); return;
      }
      cerrarHojas(true); guardar({ key: v.key, slot: p.id, campo: 'estado', valor: { v: nv }, visto, nombre: p.nombre });
    });
  };

  // ---------- captions: elegir y retocar (su borrador sobrevive a que iOS cierre la app) ----------
  C.elegir = b => { const p = pAhora(), v = L.vista; if (!p || !p.captions) return; guardar({ key: v.key, slot: p.id, campo: 'capElegir', valor: +b.dataset.k, visto: { at: p.captions.at, pick: p.captions.pick }, nombre: p.nombre }); };
  const K_BORR = (key, slot, k) => `mesa-movil-borrador:${key}|${slot}|${k}`;
  let RET0 = null;
  const baseDe = (key, slot, k) => (RET0 && RET0.key === key && RET0.slot === slot && RET0.k === k ? RET0.base : null);
  // el borrador guarda la versión de la que salió (su tanda y su texto): «Listo» compara con esa, nunca con lo que bajó entretanto
  const borrLeer = (key, slot, k) => { const t = lsG(K_BORR(key, slot, k)); if (t == null) return null; try { const o = JSON.parse(t); if (o && typeof o.texto === 'string') return o; } catch (e) { /* uno de antes, solo texto */ } return { texto: t, base: null }; };
  const borrPoner = (key, slot, k, texto, base) => lsS(K_BORR(key, slot, k), JSON.stringify({ texto, base }));
  C.pantRetocar = () => {
    const v = L.vista, p = v && v.key === RUTA.a && v.posts.find(x => x.id === RUTA.b), k = +RUTA.c, o = p && p.captions && p.captions.opciones.find(x => x.k === k);
    if (!o) return top({ atras: 'Captions', destino: `cap/${RUTA.a}/${RUTA.b}` }) + `<main class="main sin-tabs">${vacio('Este caption ya no está', 'Vuelve a los captions.')}</main>`;
    const b = borrLeer(v.key, p.id, k), borr = b ? b.texto : null, txt = borr != null ? borr : o.texto;
    RET0 = { key: v.key, slot: p.id, k, base: { at: p.captions.at, texto: o.texto } };   // lo que enseña esta pantalla: la base si aún no hay borrador
    const cambio = b && b.base && (b.base.at !== p.captions.at || b.base.texto !== o.texto);   // cambió en la Mesa desde que empezaste
    return top({ atras: 'Captions', destino: `cap/${v.key}/${p.id}`, t: 'Retocar', r: `<button type="button" class="back" style="padding:0 12px;font-weight:600" data-a="listo"${sinRed() ? ' disabled' : ''}>Listo</button>` }) + `<main class="main sin-tabs" id="contenido">
      <div class="editor"><textarea data-ret aria-label="Caption ${k + 1}, tono ${esc(o.tono)}" maxlength="2200">${esc(txt)}</textarea>
      <div class="cuenta"><span>Tono ${esc(o.tono)}${o.editada || txt !== o.original ? ' · retocado' : ''}${borr != null && borr !== o.texto ? ' · borrador sin guardar' : ''}</span><span class="num${txt.length > 2200 ? ' sobra' : ''}" data-cuenta>${miles(txt.length)} / 2.200</span></div></div>${cambio ? '<p class="solo-mac">Este caption cambió en la Mesa desde que empezaste a retocarlo: si guardas tu retoque, verás los dos.</p>' : ''}${sinRed() ? '<p class="solo-mac">Sin conexión: no se puede guardar ahora (el borrador se queda).</p>' : ''}</main>`;
  };
  C.alEscribir = e => {
    const t = e.target;
    if (t.matches('[data-ret]')) {
      const k = +RUTA.c, b = borrLeer(RUTA.a, RUTA.b, k), p = pAhora(), o = p && p.captions && p.captions.opciones.find(x => x.k === k);
      borrPoner(RUTA.a, RUTA.b, k, t.value, b && b.base ? b.base : baseDe(RUTA.a, RUTA.b, k) || (o ? { at: p.captions.at, texto: o.texto } : null));   // la base: lo que se veía al dibujar
      const c = raiz.querySelector('[data-cuenta]'); if (c) { c.textContent = `${miles(t.value.length)} / 2.200`; c.classList.toggle('sobra', t.value.length > 2200); } }
  };
  C.listo = async () => {
    const v = L.vista, p = pAhora(), k = +RUTA.c, o = p && p.captions && p.captions.opciones.find(x => x.k === k), t = raiz.querySelector('[data-ret]'); if (!o || !t) return;
    const b = borrLeer(v.key, p.id, k), base = b && b.base ? b.base : baseDe(v.key, p.id, k) || { at: p.captions.at, texto: o.texto };
    if (t.value === base.texto) {   // nada que guardar: lo de la Mesa se queda (aunque cambiara) y un retoque pendiente de ese caption, deshecho, se va
      lsS(K_BORR(v.key, p.id, k), null);
      opsGuardar(opsLeer().filter(x => !(x.campo === 'capTexto' && x.key === v.key && x.slot === p.id && (x.valor || {}).k === k && x.id !== ENVUELO)));
      return atras(`cap/${v.key}/${p.id}`);
    }
    const ok = await guardar({ key: v.key, slot: p.id, campo: 'capTexto', valor: { k, texto: t.value }, visto: base, nombre: p.nombre });
    if (ok) atras(`cap/${v.key}/${p.id}`);
  };

  // ---------- contestar al cliente (va a su web con tu sesión, sin coger la Mesa: D-244, R2) ----------
  C.contestar = async b => {
    const p = pAhora(), t = raiz.querySelector('[data-resp]'); if (!p || !t || !t.value.trim()) return;
    b.disabled = true; const err = raiz.querySelector('[data-resp-err]');
    const B = await aqui(); const r = B ? await M.web.contestar(B, p.id, t.value) : { error: 'Abre la publicación otra vez.' };
    if (r && r.ok) { const c = comentariosDe(p.id); if (c) lsS('mesa-movil-resp:' + c.pid, null); t.value = ''; await leerConv(L.vista.key); pintar(); aviso('Enviado a su web.', { ok: true }); }
    else { b.disabled = false; if (err) { err.hidden = false; err.textContent = (r && r.error) || 'No se pudo enviar.'; } }
  };

  // ---------- tareas y notas ----------
  C.hecha = b => { const x = (L.tareas || []).find(t => t.id === b.dataset.id); if (!x) return; guardar({ slot: x.id, campo: 'tarea', valor: { hecha: !x.hecha }, visto: { hecha: !!x.hecha }, nombre: String(x.txt).split('\n')[0] }); };
  async function crearTarea(tipo) {
    const txt = NUEVA.txt.trim(); if (!txt) { const i = raiz.querySelector('[data-nueva]'); if (i) i.focus(); return; }
    const valor = { id: M.personal.nuevoId(tipo), txt, tipo, ...(tipo === 'tarea' && NUEVA.fecha ? { fecha: NUEVA.fecha } : {}), ...(NUEVA.cliente ? { cliente: NUEVA.cliente } : {}) };
    const g = guardar({ campo: 'tareaNueva', valor, nombre: txt });   // ya apuntada: el campo se vacía al momento y se guarda de fondo
    NUEVA.txt = ''; NUEVA.fecha = ''; NUEVA.cliente = ''; pintar();
    await g;
  }
  C.nnota = () => crearTarea('nota');
  raiz.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.target.matches('[data-nueva]')) { e.preventDefault(); crearTarea('tarea'); } });
  C.nfecha = () => {
    let mes = (NUEVA.fecha || hoy()).slice(0, 7), sel = NUEVA.fecha || '';
    const pinta = () => `<h2>Fecha de la tarea</h2>${calendarioHTML(sel, mes, null, { pie: `<button type="button" class="lnk" data-a2="sin"${sel ? '' : ' disabled'}>Sin fecha</button><button type="button" class="lnk" data-a2="hoy">Hoy</button>` })}<div class="pie"><div class="botones"><button type="button" class="btn sua ancho" data-a2="cancelar">Cerrar</button></div></div>`;
    const h = hoja(pinta(), { etiqueta: 'Fecha de la tarea' });
    h.addEventListener('click', e => { if (!h.isConnected) return;
      const d = e.target.closest('[data-dia]'), c = e.target.closest('[data-cal]'), b = e.target.closest('[data-a2]');
      if (d && !d.disabled) { NUEVA.fecha = d.dataset.dia; cerrarHojas(); return pintar(); }
      if (c && !c.disabled) { mes = c.dataset.cal; h.innerHTML = `<div class="asa" aria-hidden="true"></div>` + pinta(); arrastrable(h); return; }
      if (!b) return;
      if (b.dataset.a2 === 'sin') NUEVA.fecha = ''; else if (b.dataset.a2 === 'hoy') NUEVA.fecha = hoy();
      cerrarHojas(); pintar();
    });
  };
  C.ncliente = () => {
    const l = (X().CL || []);
    const h = hoja(`<h2>Cliente de la tarea</h2><div class="estados"><button type="button" class="estado-op${NUEVA.cliente ? '' : ' on'}" data-c=""${NUEVA.cliente ? '' : ' aria-current="true"'}><span style="flex:1">Sin cliente</span>${NUEVA.cliente ? '' : `<span class="ck">${ic('check', 2.25)}</span>`}</button>${l.map(c => `<button type="button" class="estado-op${NUEVA.cliente === c.id ? ' on' : ''}" data-c="${esc(c.id)}"${NUEVA.cliente === c.id ? ' aria-current="true"' : ''}>${av(c.id)}<span style="flex:1">${esc(c.name)}</span>${NUEVA.cliente === c.id ? `<span class="ck">${ic('check', 2.25)}</span>` : ''}</button>`).join('')}</div><div class="pie"><div class="botones"><button type="button" class="btn sua ancho" data-a2="cancelar">Cerrar</button></div></div>`, { etiqueta: 'Cliente de la tarea' });
    h.addEventListener('click', e => { if (!h.isConnected) return; const b = e.target.closest('[data-c]'); if (b) { NUEVA.cliente = b.dataset.c; cerrarHojas(); pintar(); } else if (e.target.closest('[data-a2]')) cerrarHojas(); });
  };

  // ---------- «sin subir»: lo que no llegó (de la cola o de la nube), con «Subir encima» o «Descartar» (D-255) ----------
  C.sinsubir = async () => {
    if (RUN) return aviso('Espera: se está guardando.');
    const ops = opsLeer().filter(x => x.estado !== 'nueva'), nube = M.nube && M.nube.sinSubir ? await M.nube.sinSubir().catch(() => []) : [];
    const ALM = { boards: 'Tablero', tareas: 'Tarea o nota', clients: 'Cliente', files: 'Foto' };
    const fila2 = (t, s, d) => `<div class="campo" style="cursor:default;align-items:flex-start;padding-top:12px;padding-bottom:12px"><span class="v" style="display:block;white-space:normal"><b>${esc(t)}</b><span class="por">${esc(s)}</span></span></div><div class="botones" style="margin:0 0 12px;padding:0 12px">${d}</div>`;
    const h = hoja(`<h2>Sin subir</h2><p class="ex">${esc(plural(ops.length + nube.length, 'cambio no llegó', 'cambios no llegaron'))} a la Mesa.</p>`
      + (ops.length ? `<div class="grupo">${ops.map(op => fila2(opQue(op) + (op.nombre ? ' · ' + op.nombre : ''), opTexto(op, op.valor), `<button type="button" class="btn sua" data-des="${esc(op.id)}">Descartar</button><button type="button" class="btn pri" data-sub="${esc(op.id)}">Subir encima</button>`)).join('')}</div>` : '')
      + (nube.length ? `<div class="grupo" style="margin-top:12px">${nube.map((x, i) => fila2(`${ALM[x.a] || x.a}`, x.mensaje || x.motivo || '', `<button type="button" class="btn sua" data-ndes="${i}">Descartar</button><button type="button" class="btn pri" data-nsub="${i}">Subir encima</button>`)).join('')}</div>` : '')
      + `<div class="pie"><div class="botones"><button type="button" class="btn sua ancho" data-a2="cancelar">Cerrar</button></div></div>`, { etiqueta: 'Sin subir' });
    h.addEventListener('click', async e => { if (!h.isConnected) return;
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a2) return cerrarHojas();
      if (b.dataset.des) { const op = opsLeer().find(x => x.id === b.dataset.des); if (op && op.campo === 'capTexto') lsS(K_BORR(op.key, op.slot, op.valor.k), null); opsQuitar(b.dataset.des); cerrarHojas(); return pintar(); }
      if (b.dataset.sub) { cerrarHojas(true); if (RUN) return aviso('Espera: se está guardando.'); return guardar([], { solo: [b.dataset.sub] }); }
      const i = b.dataset.nsub ?? b.dataset.ndes; if (i == null) return;
      const x = nube[+i], encima = b.dataset.nsub != null; cerrarHojas(true);
      const r = await conLaMesa(() => (encima ? M.nube.subirEncima([[x.a, x.k]]) : M.nube.descartar([[x.a, x.k]])));
      if (r) aviso(r.error ? errorTexto(r.error) : encima ? 'Subido encima.' : 'Descartado.', { ok: !r.error, error: !!r.error });
    });
  };
  C.alNube = (t, d) => {
    if (t === 'pausa' && d && d.motivo === 'perdido') aviso(`La Mesa la cogió ${corto2(d.dispositivo)}: lo que no subió está en «sin subir».`, { error: true, ms: 8000 });
  };

  arrancar();
})();
