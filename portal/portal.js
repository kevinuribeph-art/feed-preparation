// Portal de clientes · Uribe Visuals (D-241, D-242). Sin dependencias ni compilación; habla con el servidor por `supa.js`.
// Todo texto que llega del servidor o del cliente se pinta con `textContent` (nunca innerHTML) y la página no tiene código en
// línea (CSP). Lo que ve: su feed, su calendario, por qué este calendario, sus pagos y cómo fue el mes anterior; lo que
// hace: aprobar, pedir cambios con motivo y comentar.
(function portal() {
  'use strict';
  const V = '1.2';
  const app = document.getElementById('app');
  const CFG = window.PORTAL_CONFIG || {};
  const TZ = 'Europe/Madrid';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const C_PUB = 'cliente_id,pid,mes,orden,tipo,nombre,fecha,sin_hora,caption,imagenes,estado,version,visible,enviada';
  const C_APR = 'id,cliente_id,pid,version,decision,motivo,diapositiva,autor_nombre,hora';
  const C_COM = 'id,cliente_id,pid,version,diapositiva,texto,autor_nombre,de_kevin,hora,resuelto';
  const ESTADO = { preparando: ['En preparación', 'pr'], por_aprobar: ['Por aprobar', 'ap'], aprobada: ['Aprobada', 'ok'], cambios: ['Pediste cambios', 'cb'], programada: ['Programada', 'ok'], publicada: ['Publicada', 'ok'] };
  const visto = p => (p.estado === 'programada' && p.fecha && Date.parse(p.fecha) <= Date.now() ? { ...p, estado: 'publicada' } : p);
  const TIPO = { foto: 'Foto', carrusel: 'Carrusel', reel: 'Reel', collab_reel: 'Collab', trial_reel: 'Reel' };

  // ---------- pequeñas herramientas ----------
  function h(tag, at, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(at || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  function ico(n, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-' + n); s.append(u); return s;
  }
  const partes = (t, o) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...o }).formatToParts(t).map(p => [p.type, p.value]));
  const hoy = () => { const p = partes(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' }); return `${p.year}-${p.month}-${p.day}`; };
  const diaDe = iso => { const p = partes(new Date(iso), { year: 'numeric', month: '2-digit', day: '2-digit' }); return `${p.year}-${p.month}-${p.day}`; };
  const horaDe = iso => { const p = partes(new Date(iso), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); return `${p.hour}:${p.minute}`; };
  const dsem = dia => DIAS[new Date(dia + 'T12:00:00Z').getUTCDay()];
  const may = t => t ? t[0].toUpperCase() + t.slice(1) : t;
  const mesCorto = m => may(MESES[+m.slice(5, 7) - 1].slice(0, 3)) + ' ' + m.slice(0, 4);
  const mesNom = m => MESES[+m.slice(5, 7) - 1] + (m.slice(0, 4) !== hoy().slice(0, 4) ? ' ' + m.slice(0, 4) : '');
  const mesAntes = m => { let [y, mo] = m.split('-').map(Number); mo--; if (!mo) { mo = 12; y--; } return `${y}-${String(mo).padStart(2, '0')}`; };
  const diaCorto = d => +d.slice(8, 10) + ' ' + MESES[+d.slice(5, 7) - 1].slice(0, 3);
  const fechaPub = p => { if (!p.fecha) return 'Sin fecha'; const d = diaDe(p.fecha); return may(dsem(d)) + ' ' + diaCorto(d) + (p.sin_hora ? '' : ' · ' + horaDe(p.fecha)); };
  const cuando = iso => { const d = diaDe(iso), t = horaDe(iso); if (d === hoy()) return 'hoy, ' + t; const ay = diaDe(Date.now() - 864e5); return d === ay ? 'ayer, ' + t : diaCorto(d) + ', ' + t; };
  const num = (n, o) => Number(n).toLocaleString('es-ES', o);
  const cifra = n => n >= 999950 ? num(n / 1e6, { maximumFractionDigits: 1 }) + ' mill.' : n >= 1000 ? num(n / 1000, { maximumFractionDigits: 1 }) + ' mil' : num(n);
  const eur = c => { const v = Math.round(c) / 100; return (Number.isInteger(v) ? num(v) : num(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €'; };
  function cambio(v, a, mAnt) {
    if (a == null) return { t: 'sin datos de ' + MESES[+mAnt.slice(5, 7) - 1], k: '' };
    if (a === 0) return v ? { t: 'frente a 0', k: '' } : { t: 'igual', k: '' };
    const p = Math.round((v - a) / a * 100);
    return p ? { t: (p > 0 ? '+' : '−') + num(Math.abs(p)) + ' %', k: p > 0 ? 'sube' : 'baja' } : { t: 'igual', k: '' };
  }
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  let toastT = 0;
  function toast(t) { clearTimeout(toastT); document.querySelectorAll('.toast').forEach(x => x.remove()); const el = h('div', { class: 'toast', role: 'status', text: t }); document.body.append(el); toastT = setTimeout(() => el.remove(), 4000); }
  const frase = t => { t = String(t || '').trim(); if (!t) return 'No se pudo.'; t = t[0].toUpperCase() + t.slice(1); return /[.!?]$/.test(t) ? t : t + '.'; };
  const msgError = e => !e ? 'No se pudo.' : e.codigo === 'red' ? 'Sin conexión: inténtalo otra vez.' : e.codigo === 'codigo' ? 'Ese código no vale o ha caducado. Pide otro.' : e.status === 409 ? frase(e.message || 'Ha cambiado: vuelve a mirarla') : e.status === 429 ? frase(e.message || 'Demasiados intentos: espera un minuto') : e.status === 401 ? 'Tu sesión ha caducado: vuelve a entrar.' : frase(e.message);

  // ---------- servidor ----------
  let S = null;
  try { S = window.Supa.crear({ url: CFG.url, publica: CFG.publica, clave: 'portal-sesion' }); } catch (e) { S = null; }
  const st = { clientes: [], cli: null, d: null, mes: null, tab: 'cal', verAnt: null, urls: new Map(), cargando: false, error: '', abierta: null, gen: 0, carga: 0, sucio: false, codigoEn: 0 };

  async function cargarClientes() {
    const mios = await S.leer('miembros?select=cliente_id,nombre');
    const ids = [...new Set((mios || []).map(m => m.cliente_id))];
    if (!ids.length) return [];
    const l = await S.leer(`clientes?select=id,nombre,handle,foto,cuota_cent,proxima_emision&id=in.(${ids.map(encodeURIComponent).join(',')})`);
    return (l || []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  async function cargarDatos(cli, antes) {
    const c = encodeURIComponent(cli), prev = antes || {};
    const pide = [
      S.leer(`publicaciones?select=${C_PUB}&cliente_id=eq.${c}&order=mes.desc,orden.asc`),
      S.leer(`aprobaciones?select=${C_APR}&cliente_id=eq.${c}&order=hora.asc`),
      S.leer(`comentarios?select=${C_COM}&cliente_id=eq.${c}&order=hora.asc`),
      S.leer(`sesiones?select=id,mes,nombre,inicio,fin,sin_hora&cliente_id=eq.${c}`),
      S.leer(`meses?select=mes,porque,resumen&cliente_id=eq.${c}`),
      S.leer(`pagos?select=id,periodo,concepto,importe_cent,factura,emitida,vence,cobrada,pdf&cliente_id=eq.${c}`),
    ];
    const r = await Promise.allSettled(pide);
    const mal = r.find(x => x.status === 'rejected');
    if (mal && (mal.reason.status === 401 || mal.reason.codigo === 'sesion')) throw mal.reason;
    if (r.slice(0, 3).some(x => x.status === 'rejected')) throw r.slice(0, 3).find(x => x.status === 'rejected').reason;   // sin publicaciones ni conversación, no se pinta
    const v = (i, k) => (r[i].status === 'fulfilled' ? r[i].value || [] : prev[k] || []);   // un panel que falla se queda como estaba
    return { pubs: v(0, 'pubs').map(visto), aprs: v(1, 'aprs'), coms: v(2, 'coms'), ses: v(3, 'ses'), meses: v(4, 'meses'), pagos: v(5, 'pagos') };
  }
  // URL firmadas (10 minutos): se piden juntas y se guardan hasta un minuto antes de caducar.
  async function urls(rutas, bucket = 'fotos') {
    const ahora = Date.now(), faltan = [...new Set(rutas.filter(r => r && !((st.urls.get(r) || {}).hasta > ahora)))];
    for (let i = 0; i < faltan.length; i += 100) {
      const m = await S.firmar(bucket, faltan.slice(i, i + 100));
      for (const [r, u] of Object.entries(m)) st.urls.set(r, { url: u, hasta: ahora + (bucket === 'fotos' ? 9 : 0.75) * 60000 });
    }
    return Object.fromEntries(rutas.map(r => [r, (st.urls.get(r) || {}).url]));
  }

  // ---------- entrada ----------
  // tu logo (tinta en claro, papel en oscuro), el contenido centrado y «Privacidad · Aviso legal» abajo del todo (D-248)
  const logo = () => h('div', { class: 'ent-m' }, h('picture', {}, h('source', { srcset: 'marca/logo-paper.svg', media: '(prefers-color-scheme: dark)' }),
    h('img', { src: 'marca/logo-ink.svg', alt: 'Uribe Visuals', width: '163', height: '64' })));
  const legal = () => h('footer', { class: 'legal' }, h('a', { href: 'privacidad.html', text: 'Privacidad' }), h('a', { href: 'aviso-legal.html', text: 'Aviso legal' }));
  const entrada = c => h('div', { class: 'ent' }, c, legal());
  function pintarEntrada(paso, correo, error, tecleado) {
    st.d = null; st.urls.clear(); cerrar(true);
    document.querySelectorAll('.dlg,.velo,.toast').forEach(x => x.remove());
    const err = error ? h('p', { class: 'err', id: 'ent-err' }, ico('alert'), error) : null;
    if (paso !== 'codigo') {
      const inp = h('input', { id: 'e-correo', type: 'email', autocomplete: 'email', inputmode: 'email', required: true, value: correo || '' });
      const form = h('form', { class: 'ent-c', novalidate: true, onsubmit: async e => {
        e.preventDefault(); const v = inp.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return pintarEntrada('correo', v, 'Ese correo no parece bien escrito.');
        const b = form.querySelector('button'); b.disabled = true;
        try { await S.pedirCodigo(v); st.codigoEn = Date.now(); lsSet('portal-correo', v); pintarEntrada('codigo', v); } catch (x) { pintarEntrada('correo', v, msgError(x)); }
      } },
        logo(), h('h1', { text: 'Tu calendario de Instagram' }),
        h('p', { text: 'Escribe el correo con el que trabajamos y te mandamos un código para entrar.' }),
        h('label', { for: 'e-correo', text: 'Correo' }), inp, err, h('button', { class: 'btn p', type: 'submit', text: 'Enviarme el código' }));
      app.replaceChildren(entrada(form)); inp.focus();
      return;
    }
    const cod = h('input', { id: 'e-cod', class: 'cod' + (error ? ' mal' : ''), inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', required: true, 'aria-describedby': error ? 'ent-err' : null, value: tecleado || '' });
    let quedan = Math.max(0, 60 - Math.floor((Date.now() - st.codigoEn) / 1000));
    const reenviar = h('button', { class: 'lnk', type: 'button', disabled: quedan > 0, text: quedan > 0 ? `Reenviar en ${Math.floor(quedan / 60)}:${String(quedan % 60).padStart(2, '0')}` : 'Reenviar código', onclick: async () => { try { await S.pedirCodigo(correo); st.codigoEn = Date.now(); pintarEntrada('codigo', correo); } catch (x) { pintarEntrada('codigo', correo, msgError(x)); } } });
    const t = setInterval(() => { if (!reenviar.isConnected) return clearInterval(t); quedan = Math.max(0, 60 - Math.floor((Date.now() - st.codigoEn) / 1000)); if (quedan <= 0) { clearInterval(t); reenviar.disabled = false; reenviar.textContent = 'Reenviar código'; } else reenviar.textContent = `Reenviar en ${Math.floor(quedan / 60)}:${String(quedan % 60).padStart(2, '0')}`; }, 1000);
    const form = h('form', { class: 'ent-c', novalidate: true, onsubmit: async e => {
      e.preventDefault(); const b = form.querySelector('button[type=submit]'); b.disabled = true;
      try { await S.verificarCodigo(correo, cod.value); await arrancar(); } catch (x) { pintarEntrada('codigo', correo, msgError(x), cod.value); }
    } },
      logo(), h('h1', { text: 'Mira tu correo' }),
      h('p', { text: `Si ${correo} está dado de alta, te llega un código de 6 cifras. Vale 10 minutos.` }),
      h('label', { for: 'e-cod', text: 'Código' }), cod, err, h('button', { class: 'btn p', type: 'submit', text: 'Entrar' }),
      h('div', { class: 'otros' }, reenviar, h('button', { class: 'lnk', type: 'button', text: 'Usar otro correo', onclick: () => pintarEntrada('correo', correo) })));
    app.replaceChildren(entrada(form)); cod.focus();
  }

  // ---------- su vista ----------
  const visibles = () => (st.d ? st.d.pubs.filter(p => p.visible) : []);
  const delMes = m => visibles().filter(p => p.mes === m).sort((a, b) => a.orden - b.orden);
  const pendientes = () => visibles().filter(p => p.estado === 'por_aprobar').sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  function mesesDisponibles() {
    const s = new Set([...visibles().map(p => p.mes), ...st.d.ses.map(x => x.mes)]);
    return [...s].sort().reverse();
  }
  function mesInicial() {
    const ms = mesesDisponibles(), p = pendientes()[0], h0 = hoy().slice(0, 7);
    if (p) return p.mes;
    return ms.find(m => m <= h0) || ms[ms.length - 1] || h0;
  }
  async function arrancar() {
    if (!S) { app.replaceChildren(h('p', { class: 'cargando', text: 'El portal aún no está configurado.' })); return; }
    if (!S.usuario()) return pintarEntrada('correo', lsGet('portal-correo') || '');
    app.replaceChildren(h('p', { class: 'cargando', text: 'Cargando tu calendario…' }));
    try {
      st.clientes = await cargarClientes();
      if (!st.clientes.length) { pintarSinCliente(); return; }
      const pref = lsGet('portal-cliente');
      st.cli = (st.clientes.find(c => c.id === pref) || st.clientes[0]).id;
      const n = ++st.carga, d = await cargarDatos(st.cli); if (n !== st.carga) return;
      st.d = d; st.mes = mesInicial(); st.error = '';
      pintar();
    } catch (e) {
      if (e.status === 401 || e.codigo === 'sesion') return pintarEntrada('correo', lsGet('portal-correo') || '', 'Tu sesión ha caducado: vuelve a entrar.');
      pintarError(msgError(e));
    }
  }
  function pintarSinCliente() {
    app.replaceChildren(entrada(h('div', { class: 'ent-c' }, logo(), h('h1', { text: 'Aún no hay nada que enseñarte' }),
      h('p', { text: 'Tu acceso todavía no tiene ningún calendario. Escríbele a Kevin.' }), h('button', { class: 'btn s', type: 'button', text: 'Salir', onclick: salir }))));
  }
  function pintarError(t) {
    app.replaceChildren(h('div', { class: 'pv' }, h('div', { class: 'aviso mal', role: 'alert' }, h('div', { class: 't' }, h('b', { text: 'No se pudo cargar tu calendario' }), h('span', { text: t })),
      h('button', { class: 'btn s', type: 'button', text: 'Reintentar', onclick: arrancar }))));
  }
  async function salir() {
    try { Object.keys(localStorage).filter(k => /^portal-(borrador|motivo)-/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) { /* sin almacenamiento */ }
    await S.salir(); st.urls.clear(); st.d = null; lsSet('portal-cliente', null); pintarEntrada('correo', lsGet('portal-correo') || '');
  }

  function pintar() {
    const cli = st.clientes.find(c => c.id === st.cli), meses = mesesDisponibles();
    const top = h('header', { class: 'pv-top' },
      h('nav', { class: 'pv-clis', 'aria-label': 'Tus cuentas' }, st.clientes.map(c => h('button', { type: 'button', class: 'pv-cli' + (c.id === st.cli ? ' on' : ''), 'aria-current': c.id === st.cli ? 'page' : null, text: c.nombre,
        onclick: async () => { if (c.id === st.cli) return; st.cli = c.id; lsSet('portal-cliente', c.id); const n = ++st.carga; cerrar(true); const d = await cargarDatos(c.id).catch(e => { if (n === st.carga) pintarError(msgError(e)); return null; }); if (d && n === st.carga) { st.d = d; st.mes = mesInicial(); pintar(); } } }))),
      h('button', { type: 'button', class: 'pv-salir', onclick: salir, 'aria-label': 'Salir' }, ico('out'), h('span', { class: 'tx', text: 'Salir' })),
      meses.length > 1 ? h('nav', { class: 'pv-meses', 'aria-label': 'Meses' }, meses.map(m => h('button', { type: 'button', class: 'pv-mes' + (m === st.mes ? ' on' : ''), 'aria-pressed': String(m === st.mes), text: mesCorto(m), onclick: () => { st.mes = m; pintar(); } }))) : null);
    const pend = pendientes();
    const aviso = pend.length ? h('section', { class: 'aviso', 'aria-label': 'Por aprobar' }, h('span', { class: 'dot', 'aria-hidden': 'true' }),
      h('div', { class: 't' }, h('b', { text: pend.length === 1 ? 'Una publicación espera tu visto bueno' : `${pend.length} publicaciones esperan tu visto bueno` }),
        h('span', { text: 'Ábrelas una a una: puedes aprobar o pedir cambios.' })),
      h('button', { type: 'button', class: 'btn p', text: pend.length === 1 ? 'Revisarla' : 'Revisarlas', onclick: () => abrir(pend[0].pid) })) : null;
    // la columna derecha solo si tiene algo; sin ella, el calendario ocupa su sitio (como la «Vista cliente» de la Mesa, D-230, D-246)
    const lado = [seguro(() => pintarPagos(cli)), seguro(pintarComoFue)].filter(Boolean);
    const cols = h('div', { class: 'cols' + (lado.length ? ' con-lado' : '') }, pintarFeed(), seguro(pintarCentro), lado.length ? h('div', { class: 'lado' }, lado) : null);
    const pie = h('footer', { class: 'pie' }, h('a', { href: 'privacidad.html', text: 'Privacidad' }), h('a', { href: 'aviso-legal.html', text: 'Aviso legal' }), h('span', { text: 'Uribe Visuals' }));
    const y = window.scrollY;
    app.replaceChildren(h('div', { class: 'pv' }, top, aviso, cols, pie));
    window.scrollTo(0, y);
    pintarMinis();
  }

  function seguro(f) { try { return f(); } catch (e) { if (window.console) console.error(e); return null; } }
  function pintarFeed() {
    const ahora = delMes(st.mes), antes = delMes(mesAntes(st.mes)).filter(p => p.estado === 'publicada' || p.estado === 'programada');
    const celda = (p, rotulo) => {
      const n = st.d.coms.filter(c => c.pid === p.pid).length, im = p.imagenes[0];
      return h('button', { type: 'button', class: 'cel' + (im ? '' : ' vacia'), 'data-pid': p.pid, 'aria-label': `${TIPO[p.tipo] || 'Publicación'} · ${fechaPub(p)} · ${ESTADO[p.estado][0]}`, onclick: () => abrir(p.pid) },
        im ? h('img', { alt: '', 'data-ruta': im.mini, loading: 'lazy', decoding: 'async' }) : h('span', { class: 'pre', text: p.estado === 'preparando' ? 'En preparación' : 'Sin imagen aún' }),
        p.tipo === 'carrusel' ? h('span', { class: 'ty' }, ico('copy')) : /reel/.test(p.tipo) ? h('span', { class: 'ty' }, ico('clap')) : null,
        rotulo ? h('span', { class: 'pub' }, h('span', { class: 'l', text: rotulo[0] }), h('span', { class: 'c', text: rotulo[1] })) : null,
        n ? h('span', { class: 'nc' }, ico('msg'), String(n), h('span', { class: 'sr', text: n === 1 ? ' comentario' : ' comentarios' })) : null);
    };
    const mA = MESES[+mesAntes(st.mes).slice(5, 7) - 1];
    const celdas = [...ahora.map(p => celda(p)), ...antes.map((p, i) => celda(p, i === 0 ? [may(mA.slice(0, 3)) + '. · publicado', may(mA.slice(0, 3)) + '.'] : null))];
    return h('section', { class: 'feedw', 'aria-label': 'Tu feed' },
      celdas.length ? h('div', { class: 'feed' }, celdas) : h('p', { class: 'vacio', text: 'Este mes aún no tiene publicaciones.' }));
  }
  async function otraVez(e) {   // una URL firmada que caducó antes de verse (perezosa): se pide de nuevo, una vez
    const i = e.currentTarget, r = i.dataset.ruta || i.dataset.grande; if (!r || i.dataset.otra) return;
    i.dataset.otra = '1'; st.urls.delete(r);
    try { const m = await urls([r]); if (m[r] && i.isConnected) i.src = m[r]; } catch (x) { /* se queda el hueco */ }
  }
  async function pintarMinis() {
    const imgs = [...app.querySelectorAll('img[data-ruta]')], rutas = imgs.map(i => i.dataset.ruta);
    if (!rutas.length) return;
    try {
      const m = await urls(rutas);
      for (const i of imgs) if (m[i.dataset.ruta] && i.isConnected) { i.src = m[i.dataset.ruta]; i.addEventListener('error', otraVez, { once: true }); }
    } catch (e) { /* sin fotos: los huecos se quedan; el siguiente repaso lo vuelve a intentar */ }
  }

  // como la casilla del calendario de la «Vista cliente» de la Mesa (calendario.js): el nombre a la izquierda y la hora a la
  // derecha, en una línea si caben, sin marca de estado (la llevan el feed y la lista del móvil; aquí, en su aria-label) (D-246)
  function chip(p) {
    return h('button', { type: 'button', class: 'chip ' + p.tipo, 'data-pid': p.pid, onclick: () => abrir(p.pid), 'aria-label': `${p.nombre} · ${fechaPub(p)} · ${ESTADO[p.estado][0]}` },
      h('span', { class: 'cl' }, h('span', { class: 'cn', text: p.nombre })), p.sin_hora || !p.fecha ? null : h('span', { class: 'ct', text: horaDe(p.fecha) }));
  }
  const chipSes = x => h('span', { class: 'chip ses' }, h('span', { class: 'cl' }, ico('clap', 'cses'), h('span', { class: 'cn', text: x.nombre })), x.sin_hora ? null : h('span', { class: 'ct', text: horaDe(x.inicio) }));
  function pintarCalendario() {
    const m = st.mes, [y, mo] = m.split('-').map(Number), d0 = new Date(Date.UTC(y, mo - 1, 1)), dias = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const lun = (d0.getUTCDay() + 6) % 7, H = hoy(), pubs = delMes(m).filter(p => p.fecha), ses = st.d.ses.filter(x => x.mes === m);
    const deDia = d => [...pubs.filter(p => diaDe(p.fecha) === d).map(p => [p.fecha, chip(p)]), ...ses.filter(x => diaDe(x.inicio) === d).map(x => [x.inicio, chipSes(x)])].sort((a, b) => a[0].localeCompare(b[0])).map(x => x[1]);
    const celdas = [];
    const diasAntes = new Date(Date.UTC(y, mo - 1, 0)).getUTCDate();
    for (let i = 0; i < lun; i++) celdas.push(h('div', { class: 'dia fuera', 'aria-hidden': 'true' }, h('span', { class: 'n', text: String(diasAntes - lun + 1 + i) })));
    for (let d = 1; d <= dias; d++) { const dia = `${m}-${String(d).padStart(2, '0')}`; celdas.push(h('div', { class: 'dia' + (dia === H ? ' hoy' : '') }, h('span', { class: 'n', text: d === 1 ? `1 ${MESES[mo - 1].slice(0, 3)}` : String(d) }), deDia(dia))); }
    for (let d = 1; celdas.length % 7; d++) celdas.push(h('div', { class: 'dia fuera', 'aria-hidden': 'true' }, h('span', { class: 'n', text: d === 1 ? `1 ${MESES[mo % 12].slice(0, 3)}` : String(d) })));
    const grid = h('div', { class: 'cal', role: 'grid', 'aria-label': 'Calendario de ' + MESES[mo - 1] }, ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => h('span', { class: 'dn', 'aria-hidden': 'true', text: x })), celdas);
    // lista por semanas (a 390): de lunes a domingo
    const items = [...pubs.map(p => ({ t: p.fecha, p })), ...ses.map(x => ({ t: x.inicio, x }))].sort((a, b) => a.t.localeCompare(b.t));
    const lista = h('ol', { class: 'agenda' }); let semAnt = null;
    for (const it of items) {
      const dia = diaDe(it.t), dd = new Date(dia + 'T12:00:00Z'), w = (dd.getUTCDay() + 6) % 7, lunes = new Date(dd - w * 864e5).toISOString().slice(0, 10), dom = new Date(dd.getTime() + (6 - w) * 864e5).toISOString().slice(0, 10);
      if (lunes !== semAnt) { semAnt = lunes; const n = Math.floor((+dia.slice(8) + lun - 1) / 7) + 1, mismo = lunes.slice(5, 7) === dom.slice(5, 7);
        lista.append(h('li', { class: 'sem', text: `Semana ${n} · ${mismo ? +lunes.slice(8) : diaCorto(lunes)} – ${diaCorto(dom)}` })); }
      const est = it.p ? (it.p.estado === 'por_aprobar' ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : ['aprobada', 'programada', 'publicada'].includes(it.p.estado) ? ico('check', 'ok') : it.p.estado === 'cambios' ? ico('pen', 'cb') : null) : null;
      const hora = it.p ? (it.p.sin_hora ? '' : horaDe(it.p.fecha)) : (it.x.sin_hora ? '' : horaDe(it.x.inicio));
      const cont = [h('span', { class: 'd' }, h('b', { text: String(+dia.slice(8)) }), h('span', { text: dsem(dia).slice(0, 3) })), h('span', { class: 'c ' + (it.p ? it.p.tipo : 'ses'), text: it.p ? it.p.nombre : it.x.nombre }), h('span', { class: 'h', text: hora }), h('span', { class: 's' }, est)];
      lista.append(h('li', {}, it.p ? h('button', { type: 'button', class: 'ag', 'data-pid': it.p.pid, onclick: () => abrir(it.p.pid), 'aria-label': `${it.p.nombre} · ${fechaPub(it.p)} · ${ESTADO[it.p.estado][0]}` }, cont) : h('div', { class: 'ag' }, cont)));
    }
    if (!items.length) lista.append(h('li', {}, h('p', { class: 'vacio', text: 'Este mes aún no tiene nada en el calendario.' })));
    return [h('div', { class: 'cal-h', text: may(MESES[mo - 1]) + ' ' + y }), grid, lista];
  }
  function pintarPorque() {
    const r = st.d.meses.find(x => x.mes === st.mes && x.porque);
    if (r) return h('div', { class: 'pq' }, r.porque.partes.map(p => h('p', {}, h('b', { text: p.t + (/[.:?!]$/.test(p.t) ? '' : '.') }), ' ' + p.x)));
    return camino(`El porqué de ${MESES[+st.mes.slice(5, 7) - 1]} llega con su calendario.`);
  }
  const camino = t => h('div', { class: 'camino' }, ico('hourglass'), h('p', { style: null }, h('b', { text: 'En camino' }), t));
  function pintarCentro() {
    const ultimoPq = st.d.meses.filter(x => x.porque).map(x => x.mes).sort().pop() || '';
    const hayPq = st.d.meses.some(x => x.mes === st.mes && x.porque) || (ultimoPq && st.mes > ultimoPq);
    if (!hayPq && st.tab === 'pq') st.tab = 'cal';
    const tabs = hayPq ? h('div', { class: 'tabs', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', class: 'tab' + (st.tab === 'cal' ? ' on' : ''), 'aria-selected': String(st.tab === 'cal'), text: 'Calendario', onclick: () => { st.tab = 'cal'; pintar(); } }),
      h('button', { type: 'button', role: 'tab', class: 'tab' + (st.tab === 'pq' ? ' on' : ''), 'aria-selected': String(st.tab === 'pq'), text: 'Por qué este calendario', onclick: () => { st.tab = 'pq'; pintar(); } })) : null;
    return h('section', { class: 'card cent', 'aria-label': st.tab === 'pq' ? 'Por qué este calendario' : 'Calendario' }, tabs, st.tab === 'pq' ? h('div', { class: 'pq-w' }, pintarPorque()) : pintarCalendario());
  }
  function estadoPago(r, H) {
    if (r.cobrada) return ['Pagada', 'ok', 'check', 'pagada el ' + diaCorto(r.cobrada)];
    if (!r.emitida || r.emitida > H) return ['Sin emitir', 'sin', 'clock', r.emitida ? 'se emite el ' + diaCorto(r.emitida) : ''];
    if (r.vence && r.vence < H) return ['Pendiente', 'ven', 'alert', 'venció el ' + diaCorto(r.vence)];
    return ['Pendiente', 'pen', 'clock', r.vence ? 'vence el ' + diaCorto(r.vence) : ''];
  }
  function pintarPagos(cli) {
    const P = st.d.pagos, H = hoy(), clave = r => r.emitida || (/^\d{4}-\d{2}$/.test(r.periodo || '') ? r.periodo + '-01' : '') || r.vence || '';
    const orden = (a, b) => clave(b).localeCompare(clave(a)) || String(b.id).localeCompare(String(a.id));
    const deber = P.filter(r => !r.cobrada && r.emitida && r.emitida <= H).sort((a, b) => clave(a).localeCompare(clave(b)));
    const pagadas = P.filter(r => r.cobrada).sort(orden), N = Math.max(0, pagadas.length - 3), ver = st.verAnt === st.cli;
    const prox = cli && cli.proxima_emision && cli.proxima_emision >= H ? cli.proxima_emision : '';
    if (!(cli && cli.cuota_cent) && !deber.length && !pagadas.length && !prox) return null;
    const filas = [...deber, ...pagadas.slice(0, 3), ...(ver ? pagadas.slice(3) : [])], venc = deber.filter(r => r.vence && r.vence < H).length;
    const fila = r => {
      const [t, k, i, cuando] = estadoPago(r, H), titulo = (r.periodo ? may(MESES[+r.periodo.slice(5, 7) - 1]) : (r.concepto || 'Factura')) + ' · ' + eur(r.importe_cent);
      return h('button', { type: 'button', class: 'fac', disabled: !r.pdf, 'aria-label': r.pdf ? `${titulo}: abrir la factura en PDF` : null, onclick: r.pdf ? () => abrirPdf(r.pdf) : null },
        h('div', {}, h('b', { text: titulo }), r.factura ? h('span', { class: 'm' }, r.pdf ? ico('file') : null, 'Factura ' + r.factura) : null, cuando ? h('span', { class: r.factura ? 'm2' : 'm', text: cuando }) : null),
        h('span', { class: 'est ' + k }, ico(i), t));
    };
    const emite = prox ? h('p', { class: 'emite' }, ico('file'), `La de ${MESES[+prox.slice(5, 7) - 1]} se emite el ${diaCorto(prox)}`) : null;
    const mas = N ? h('button', { type: 'button', class: 'lnk ver-ant', 'aria-expanded': String(ver), text: ver ? 'Ocultar las anteriores' : `Ver las anteriores (${N})`, onclick: () => { st.verAnt = ver ? null : st.cli; pintar(); } }) : null;
    return h('section', { class: 'card', 'aria-labelledby': 'h-pagos' },
      h('div', { class: 'ti' }, h('h2', { id: 'h-pagos', text: 'Tus pagos' }), cli && cli.cuota_cent ? h('span', { text: eur(cli.cuota_cent) + ' al mes' }) : null),
      deber.length ? h('p', { class: 'pend-pago' }, 'Pendiente de pago ', h('b', { text: eur(deber.reduce((s, r) => s + r.importe_cent, 0)) }), venc ? h('em', { text: `· ${venc === 1 ? '1 vencida' : venc + ' vencidas'}` }) : null) : null,
      filas.map(fila), mas, emite);
  }
  async function abrirPdf(ruta) {
    const w = window.open('', '_blank');   // abierta ya con el toque: si no, el móvil la bloquea («noopener» la devuelve nula)
    if (w) { try { w.opener = null; } catch (e) { /* ya sin opener */ } }
    try { const m = await urls([ruta], 'facturas'); if (!m[ruta]) throw new Error('no se pudo abrir la factura'); if (w) w.location.replace(m[ruta]); else location.href = m[ruta]; }
    catch (e) { if (w) w.close(); toast(msgError(e)); }
  }
  function pintarComoFue() {
    const p = mesAntes(st.mes), r = st.d.meses.find(x => x.mes === p && x.resumen), ultimo = st.d.meses.filter(x => x.resumen).map(x => x.mes).sort().pop();
    if (!ultimo) return null;
    const cab = x => h('div', { class: 'ti' }, h('h2', { text: 'Cómo fue ' + mesNom(p) }), x ? h('span', { text: x }) : null);
    if (!r) {
      if (p >= hoy().slice(0, 7)) return h('section', { class: 'card' }, cab(''), camino(`${may(MESES[+p.slice(5, 7) - 1])} aún no ha terminado: el resumen llega los primeros días de ${MESES[+st.mes.slice(5, 7) - 1]}.`));
      if (p > ultimo) return h('section', { class: 'card' }, cab(''), camino(`El resumen de ${MESES[+p.slice(5, 7) - 1]} llega en unos días.`));
      return null;
    }
    const res = r.resumen, c = res.cifras, ant = mesAntes(p), n = c.publicaciones.valor;
    const fichas = [['alcance', 'Alcance'], ['interacciones', 'Interacciones'], ['guardados', 'Guardados'], ['publicaciones', 'Publicaciones']].map(([k, t]) => {
      const v = c[k].valor, d = cambio(v, c[k].anterior, ant);
      return h('div', {}, h('span', { text: t }), h('b', { text: cifra(v) }), h('em', { class: d.k, text: d.t }));
    });
    const P = res.posts || [], max = Math.max(1, ...P.map(x => x.alcance)), best = P.reduce((a, x, i) => x.alcance > P[a].alcance ? i : a, 0);
    const dato = h('p', { class: 'dato ayuda', 'aria-live': 'polite', text: 'Toca una barra para ver su dato.' });
    const ver = i => { const x = P[i]; dato.classList.remove('ayuda'); dato.textContent = `${x.nombre} · ${x.tipo} · ${diaCorto(x.fecha)} · ${num(x.alcance)} de alcance`; barras.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))); };
    const barras = h('div', { class: 'barras', role: 'group', 'aria-label': `Alcance de cada publicación de ${MESES[+p.slice(5, 7) - 1]}: toca una para ver su dato` });
    barras.style.setProperty('--g', P.length > 40 ? '0.5px' : P.length > 24 ? '1px' : '2px');
    barras.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !e.buttons) return; const r = barras.getBoundingClientRect(); ver(Math.min(P.length - 1, Math.max(0, Math.floor((e.clientX - r.left) / Math.max(1, r.width) * P.length)))); });
    P.forEach((x, i) => {
      const bar = h('i'); bar.style.height = (x.alcance ? Math.max(2, x.alcance / max * 100) : 0).toFixed(1) + '%';
      if (i === best) { const lado = P.length === 1 ? 'medio' : i < P.length / 3 ? 'ini' : i > P.length * 2 / 3 ? 'fin' : 'medio'; bar.append(h('em', { class: 'lb ' + lado, text: (x.nombre.length > 26 ? x.nombre.slice(0, 25).trimEnd() + '…' : x.nombre) + ' · ' + cifra(x.alcance) })); }
      barras.append(h('button', { type: 'button', class: i === best ? 'top' : null, 'aria-pressed': 'false', 'aria-label': `${x.nombre}: ${num(x.alcance)} de alcance`, onclick: () => ver(i) }, bar));
    });
    const T = res.tipos || [], maxT = Math.max(1, ...T.map(t => t.alcance));
    return h('section', { class: 'card', 'aria-labelledby': 'h-comofue' },
      h('div', { class: 'ti' }, h('h2', { id: 'h-comofue', text: 'Cómo fue ' + mesNom(p) }), h('span', { text: n === 1 ? '1 publicación' : num(n) + ' publicaciones' })),
      h('div', { class: 'cif' }, fichas), h('p', { class: 'sub', text: 'Frente a ' + MESES[+ant.slice(5, 7) - 1] }),
      P.length ? [h('p', { class: 'h3', text: 'Alcance de cada publicación' }), barras, h('div', { class: 'fechas' }, h('span', { text: diaCorto(P[0].fecha) }), P.length > 1 ? h('span', { text: diaCorto(P[P.length - 1].fecha) }) : null), dato] : null,
      T.length ? [h('p', { class: 'h3', text: 'Alcance medio por tipo' }), h('div', { class: 'tp' }, T.map(t => { const b = h('i'); b.style.width = Math.max(t.alcance ? 1 : 0, t.alcance / maxT * 100).toFixed(1) + '%'; return [h('span', { text: t.tipo }), h('span', {}, b), h('em', { text: cifra(t.alcance) })]; }))] : null,
      res.frase ? h('p', { class: 'frase', text: res.frase }) : null);
  }

  // ---------- una publicación ----------
  const borrador = pid => lsGet('portal-borrador-' + pid) || '';
  function abrir(pid) {
    const p = st.d.pubs.find(x => x.pid === pid && x.visible); if (!p) return;
    cerrar(true);
    st.abierta = { pid, slide: 1, origen: document.activeElement, version: null, tog: null };
    const velo = h('div', { class: 'velo', onclick: () => cerrar() });
    const hoja = h('section', { class: 'hoja', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'h-pub', tabindex: '-1' });
    document.body.append(velo, hoja); document.body.style.overflow = 'hidden'; document.body.classList.add('con-hoja');
    pintarHoja(true);
    hoja.focus();
  }
  function cerrar(sinFoco) {
    document.querySelectorAll('.velo,.hoja,.dlg').forEach(x => x.remove()); document.body.style.overflow = ''; document.body.classList.remove('con-hoja');
    const A = st.abierta; st.abierta = null; if (!A || sinFoco) return;
    // la casilla de origen pudo rehacerse mientras estaba abierta: se busca la de esa publicación que se vea
    const o = A.origen && A.origen.isConnected ? A.origen : [...document.querySelectorAll(`[data-pid="${A.pid}"]`)].find(x => x.offsetParent);
    if (o) o.focus();
  }
  function pintarHoja(nueva) {
    const A = st.abierta, hoja = document.querySelector('.hoja'); if (!A || !hoja) return;
    const p = st.d.pubs.find(x => x.pid === A.pid); if (!p || !p.visible) return cerrar();
    const cli = st.clientes.find(c => c.id === st.cli) || {}, coms = st.d.coms.filter(c => c.pid === p.pid), aprs = st.d.aprs.filter(a => a.pid === p.pid);
    const ultimaMia = [...aprs].reverse().find(a => a.decision !== 'retirada');
    // si ya existe, solo se rehacen las partes (el campo de escribir no se toca mientras se escribe: lección 92)
    let escr = hoja.querySelector('.escr');
    const otraVersion = !nueva && A.version && A.version !== p.version;
    if (otraVersion) { A.slide = 1; A.tog = null; }
    const ig = nueva || otraVersion || !hoja.querySelector('.ig') ? pintarIg(p, cli) : hoja.querySelector('.ig');
    const hilo = h('ol', {}, [
      ...coms.map(c => ({ t: c.hora, el: h('li', { class: 'cm' + (c.de_kevin ? ' kv' : '') }, h('span', { class: 'q' }, h('b', { text: c.autor_nombre }), cuando(c.hora), c.version !== p.version ? ' · de una versión anterior' : ''),
        c.diapositiva ? h('span', { class: 'sl', text: 'Diapositiva ' + c.diapositiva }) : null, h('p', { text: c.texto })) })),
      ...aprs.filter(a => a.decision === 'cambios').map(a => ({ t: a.hora, el: h('li', { class: 'cm dec' }, h('span', { class: 'q' }, h('b', { text: a.autor_nombre }), cuando(a.hora) + ' · pidió cambios' + (a.version !== p.version ? ' · de una versión anterior' : '')),
        a.diapositiva ? h('span', { class: 'sl', text: 'Diapositiva ' + a.diapositiva }) : null, h('p', { text: a.motivo })) })),
    ].sort((x, y) => x.t.localeCompare(y.t)).map(x => x.el));
    if (!escr) {
      const ta = h('textarea', { rows: '1', placeholder: 'Escribe un comentario…', 'aria-label': 'Comentario', maxlength: '2000' });
      ta.value = borrador(p.pid);
      const env = h('button', { type: 'button', class: 'env', 'aria-label': 'Enviar comentario', disabled: !ta.value.trim() }, ico('send'));
      const tog = h('button', { type: 'button', class: 'tog', 'aria-pressed': 'false', hidden: true }, ico('check'), h('span'));
      const err = h('p', { class: 'err-p', role: 'alert', hidden: true });
      ta.addEventListener('input', () => { lsSet('portal-borrador-' + p.pid, ta.value); env.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; });
      tog.addEventListener('click', () => { const v = tog.getAttribute('aria-pressed') !== 'true'; tog.setAttribute('aria-pressed', String(v)); if (st.abierta) st.abierta.tog = v; });
      env.addEventListener('click', async () => {
        const t = ta.value.trim(); if (!t) return; env.disabled = true; err.hidden = true;
        try {
          const dia = tog.hidden || tog.getAttribute('aria-pressed') !== 'true' ? null : st.abierta.slide;
          st.gen++;
          const fila = await S.insertar(`comentarios?select=${C_COM}`, [{ cliente_id: st.cli, pid: p.pid, version: (st.abierta && st.abierta.version) || p.version, diapositiva: dia, texto: t }], { devolver: true });
          st.gen++; st.d.coms.push(...(fila || [])); ta.value = ''; lsSet('portal-borrador-' + p.pid, null); ta.style.height = '';
          pintarHoja(); pintar();
        } catch (e) { err.textContent = msgError(e); err.hidden = false; env.disabled = false; if (e.status === 409) await refrescar(true); }
      });
      escr = h('div', { class: 'escr' }, tog, h('div', { class: 'fila' }, ta, env), err);
    }
    const tog = escr.querySelector('.tog'), nImg = p.imagenes.length;
    tog.hidden = nImg < 2; tog.lastChild.textContent = 'Sobre la diapositiva ' + A.slide;
    if (nueva || otraVersion) tog.setAttribute('aria-pressed', 'false');
    const cambiado = ultimaMia && ultimaMia.version !== p.version;
    const cab = h('div', { class: 'dl-h' }, h('h2', { id: 'h-pub', text: p.nombre }), h('p', { text: fechaPub(p) }), pildora(p, ultimaMia));
    const aviso = otraVersion ? h('p', { class: 'cambio', role: 'status' }, ico('hist'), 'Kevin acaba de cambiarla: esto es lo nuevo.')
      : cambiado ? h('p', { class: 'cambio' }, ico('hist'), 'Ha cambiado después de tu última decisión: míralo otra vez.') : null;
    const lista = coms.length || aprs.some(a => a.decision === 'cambios') ? hilo : h('p', { class: 'vacio', text: 'Aún no hay comentarios. Si algo no te encaja, dilo aquí.' });
    const acc = acciones(p, ultimaMia), dl0 = hoja.querySelector('.dl');
    A.version = p.version;
    if (nueva || !dl0) {
      const x = h('button', { type: 'button', class: 'hoja-x', 'aria-label': 'Cerrar', onclick: () => cerrar() }, ico('x'));
      hoja.replaceChildren(x, ig, h('div', { class: 'dl' }, cab, h('div', { class: 'dl-b' }, aviso, h('div', { class: 'hilo' }, h('h3', { text: 'Comentarios' }), lista, escr)), acc));
    } else {   // solo cambia lo que cambió; el campo de escribir se queda donde está, con su foco
      if (otraVersion) hoja.querySelector('.ig').replaceWith(ig);
      dl0.querySelector('.dl-h').replaceWith(cab);
      const b = dl0.querySelector('.dl-b'); b.querySelector(':scope > .cambio')?.remove(); if (aviso) b.prepend(aviso);
      b.querySelector('.hilo > ol, .hilo > p.vacio').replaceWith(lista);
      dl0.querySelector('.acc').replaceWith(acc);
    }
    if (nueva || otraVersion) mostrarImagenes(p);
  }
  function pildora(p, ultima) {
    const [t, k] = ESTADO[p.estado];
    const extra = ultima && ['aprobada', 'cambios'].includes(p.estado) && ultima.version === p.version ? ` · ${ultima.autor_nombre}, ${cuando(ultima.hora)}` : '';
    return h('span', { class: 'est ' + k }, k === 'ap' ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : k === 'cb' ? ico('pen') : k === 'ok' ? ico('check') : null, t + extra);
  }
  function siguientePendiente(pid) { const l = pendientes().filter(x => x.pid !== pid); return l[0] || null; }
  function acciones(p, ultima) {
    const sig = siguientePendiente(p.pid), sigBtn = sig ? h('button', { type: 'button', class: 'lnk sig', onclick: () => abrir(sig.pid) }, 'Siguiente por aprobar', ico('right')) : null;
    if (p.estado === 'por_aprobar') return h('div', { class: 'acc' },
      h('button', { type: 'button', class: 'btn s', onclick: () => pedirCambios(p) }, ico('pen'), 'Pedir cambios'),
      h('button', { type: 'button', class: 'btn p', onclick: e => decidir(p, 'aprobada', null, null, e.currentTarget) }, ico('check'), 'Aprobar'));
    if (p.estado === 'aprobada' || p.estado === 'cambios') return h('div', { class: 'acc' },
      h('div', { class: 'hecho' + (p.estado === 'cambios' ? ' cb' : '') }, ico(p.estado === 'cambios' ? 'pen' : 'check'), h('b', { text: p.estado === 'cambios' ? 'Pediste cambios' : 'Aprobada' })),
      p.estado === 'cambios' ? h('button', { type: 'button', class: 'btn p', onclick: e => decidir(p, 'aprobada', null, null, e.currentTarget) }, ico('check'), 'Aprobar') : null,
      h('button', { type: 'button', class: 'btn s', onclick: e => decidir(p, 'retirada', null, null, e.currentTarget) }, ico('undo'), 'Deshacer'), sigBtn);
    const txt = { preparando: 'Aún la estamos preparando: te avisaremos para que la apruebes.', programada: 'Ya está programada.', publicada: 'Ya está publicada.' }[p.estado];
    return h('div', { class: 'acc' }, h('p', { class: 'vacio', text: txt }), sigBtn);
  }
  async function decidir(p0, decision, motivo, diapositiva, boton) {
    if (boton) boton.disabled = true;
    const pid = p0.pid, A = st.abierta, version = A && A.pid === pid && A.version ? A.version : p0.version;   // lo que tiene delante
    try {
      st.gen++;
      const fila = await S.insertar(`aprobaciones?select=${C_APR}`, [{ cliente_id: st.cli, pid, version, decision, motivo, diapositiva }], { devolver: true });
      st.gen++;
      st.d.aprs.push(...(fila || []));
      const p = st.d.pubs.find(x => x.pid === pid);   // un repaso pudo traer otra lista mientras tanto (lección 97)
      if (p) p.estado = decision === 'aprobada' ? 'aprobada' : decision === 'cambios' ? 'cambios' : 'por_aprobar';
      toast(decision === 'aprobada' ? 'Aprobada. Queda lista para programar.' : decision === 'cambios' ? 'Enviado: Kevin verá lo que cambiarías.' : 'Hecho: vuelve a esperar tu decisión.');
      pintar(); pintarHoja();
      return true;
    } catch (e) {
      toast(msgError(e)); if (boton && boton.isConnected) boton.disabled = false;
      if (e.status === 409) { document.querySelectorAll('.dlg,.velo.alto').forEach(x => x.remove()); await refrescar(true); }
      return false;
    }
  }
  function pedirCambios(p) {
    const clave = 'portal-motivo-' + p.pid, origen = document.activeElement;
    const ta = h('textarea', { 'aria-label': 'Qué cambiarías', maxlength: '2000' }), enviar = h('button', { type: 'button', class: 'btn p', text: 'Enviar' });
    ta.value = lsGet(clave) || ''; enviar.disabled = !ta.value.trim();
    const tog = p.imagenes.length > 1 ? h('button', { type: 'button', class: 'tog', 'aria-pressed': String(st.abierta.slide > 1) }, ico('check'), 'Sobre la diapositiva ' + st.abierta.slide) : null;
    if (tog) tog.addEventListener('click', () => tog.setAttribute('aria-pressed', String(tog.getAttribute('aria-pressed') !== 'true')));
    ta.addEventListener('input', () => { enviar.disabled = !ta.value.trim(); lsSet(clave, ta.value); });
    const velo = h('div', { class: 'velo alto' });
    const quitar = () => {
      velo.remove(); dlg.remove();
      if (st.sucio) { st.sucio = false; pintar(); pintarHoja(); }   // lo que llegó mientras estaba abierto
      const o = origen && origen.isConnected ? origen : document.querySelector('.hoja .acc .btn.s') || document.querySelector('.hoja');
      if (o) o.focus();
    };
    const dlg = h('section', { class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'h-camb' },
      h('h2', { id: 'h-camb', text: '¿Qué cambiarías?' }), h('p', { text: `${p.nombre} · ${fechaPub(p)}. Kevin lo verá en su Mesa.` }), tog, ta,
      h('div', { class: 'fila' }, h('button', { type: 'button', class: 'btn q', text: 'Cancelar', onclick: quitar }), enviar));
    dlg._quitar = quitar;
    velo.addEventListener('click', quitar);
    enviar.addEventListener('click', async () => { const ok = await decidir(p, 'cambios', ta.value.trim(), tog && tog.getAttribute('aria-pressed') === 'true' ? st.abierta.slide : null, enviar); if (ok) { lsSet(clave, null); quitar(); } });
    document.body.append(velo, dlg); ta.focus();
  }
  function pintarIg(p, cli) {
    const av = h('span', { class: 'ig-av', 'aria-hidden': 'true', text: (cli.nombre || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() });
    if (cli.foto) urls([cli.foto]).then(m => { if (m[cli.foto]) av.replaceChildren(h('img', { src: m[cli.foto], alt: '' })); }).catch(() => {});
    const lista = h('div', { class: 'car-l', tabindex: '0', 'aria-label': p.imagenes.length > 1 ? `${p.imagenes.length} imágenes: desliza para verlas` : 'Imagen de la publicación' },
      p.imagenes.length ? p.imagenes.map((im, i) => h('div', {}, h('img', { alt: `Imagen ${i + 1} de ${p.imagenes.length}`, 'data-grande': im.ruta, width: String(im.an), height: String(im.al) }))) : h('div', {}, h('div', { class: 'ph', text: 'En preparación' })));
    const n = h('span', { class: 'ig-n', text: p.imagenes.length > 1 ? `1 / ${p.imagenes.length}` : '' }); if (p.imagenes.length < 2) n.hidden = true;
    const dots = h('div', { class: 'ig-dots', 'aria-hidden': 'true', hidden: p.imagenes.length < 2 }, p.imagenes.length > 1 ? p.imagenes.map((_, i) => h('i', { class: i ? null : 'on' })) : null);
    const ant = h('button', { type: 'button', class: 'car-b ant', 'aria-label': 'Imagen anterior', hidden: true }, ico('left'));
    const sig = h('button', { type: 'button', class: 'car-b sig', 'aria-label': 'Imagen siguiente', hidden: p.imagenes.length < 2 }, ico('right'));
    const ir = d => lista.scrollTo({ left: lista.clientWidth * (st.abierta.slide - 1 + d), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    ant.addEventListener('click', () => ir(-1)); sig.addEventListener('click', () => ir(1));
    lista.addEventListener('scroll', () => {
      const i = Math.round(lista.scrollLeft / Math.max(1, lista.clientWidth)) + 1; if (!st.abierta || i === st.abierta.slide) return;
      st.abierta.slide = i; n.textContent = `${i} / ${p.imagenes.length}`; [...dots.children].forEach((d, j) => d.className = j === i - 1 ? 'on' : '');
      ant.hidden = i <= 1; sig.hidden = i >= p.imagenes.length;
      const tog = document.querySelector('.hoja .escr .tog'); if (tog) { tog.lastChild.textContent = 'Sobre la diapositiva ' + i; if (st.abierta.tog == null) tog.setAttribute('aria-pressed', String(i > 1)); }
    }, { passive: true });
    lista.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); ir(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); } });
    return h('div', { class: 'ig' },
      h('div', { class: 'ig-h' }, h('button', { type: 'button', class: 'bk', onclick: () => cerrar() }, ico('left'), 'Volver'), av, h('span', { text: cli.handle || cli.nombre || '' })),
      h('div', { class: 'car' }, lista, n, ant, sig), dots,
      p.caption ? h('p', { class: 'ig-cap' }, h('b', { text: (cli.handle || cli.nombre || '') + ' ' }), p.caption) : null);
  }
  async function mostrarImagenes(p) {
    const imgs = [...document.querySelectorAll('.hoja img[data-grande]')]; if (!imgs.length) return;
    try { const m = await urls(imgs.map(i => i.dataset.grande)); for (const i of imgs) if (m[i.dataset.grande] && i.isConnected) { i.src = m[i.dataset.grande]; i.addEventListener('error', otraVez, { once: true }); } }
    catch (e) { toast('No se pudieron cargar las imágenes: ' + msgError(e)); }
  }

  // ---------- repaso: lo nuevo, sin cerrar ni borrar lo que se escribe ----------
  async function refrescar(forzar) {
    if (!S || !S.usuario() || !st.cli || (document.hidden && !forzar)) return;
    const gen = st.gen, n = st.carga, cli = st.cli;
    try {
      const d = await cargarDatos(cli, st.d);
      if (gen !== st.gen || n !== st.carga || cli !== st.cli) return;   // algo se escribió o se cambió de cuenta mientras se leía: lo leído ya es viejo
      if (!forzar && JSON.stringify(d) === JSON.stringify(st.d)) return;
      st.d = d; if (!mesesDisponibles().includes(st.mes)) st.mes = mesInicial();
      if (document.querySelector('.dlg')) { st.sucio = true; return; }   // se repinta al cerrar el diálogo
      st.sucio = false; pintar(); pintarHoja();
    } catch (e) { if (e.status === 401 || e.codigo === 'sesion') pintarEntrada('correo', lsGet('portal-correo') || '', 'Tu sesión ha caducado: vuelve a entrar.'); }
  }
  setInterval(() => refrescar(), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescar(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Tab') {   // el foco no sale del diálogo de encima
      const top = document.querySelector('.dlg') || document.querySelector('.hoja'); if (!top) return;
      const f = [...top.querySelectorAll('button,textarea,input,[tabindex="0"]')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      return;
    }
    if (e.key !== 'Escape') return;
    const d = document.querySelector('.dlg'); if (d) { if (d._quitar) d._quitar(); else { d.remove(); document.querySelector('.velo.alto')?.remove(); } return; }
    if (st.abierta) cerrar();
  });
  if (S) S.alCambiar(u => { if (!u && st.d) pintarEntrada('correo', lsGet('portal-correo') || ''); });
  if (window.visualViewport) { const vv = window.visualViewport, kb = () => document.documentElement.style.setProperty('--kb', Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)) + 'px'); vv.addEventListener('resize', kb); vv.addEventListener('scroll', kb); }
  window.PORTAL = { version: V, _st: st, refrescar };
  arrancar();
})();
