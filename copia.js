// Copia — Mesa de trabajo · v1.0 (D-249)
// «Exportar todo» (menú ⇅): the whole mesa at its original size, in one file per client and one «general» (what is no monthly
// client's: the locations' catalog, tasks and sessions without one, the sporadic clients and their invoices, the list of
// material). Each file is a .tar (ustar, nothing compressed, any Mac opens it): first «manifiesto.json» (what the part holds,
// each file with its size and its SHA-256), in part 1 «datos.json» (every record of every store of the mesa's data as it is,
// its blobs replaced by a reference to their hash), then the files themselves («archivos/<sha256>.<ext>»). Over 2 GB, in parts.
// No base64 nor giant strings: a part is a Blob made of the stored blobs. Each file downloads from its own click (the Claude
// app's browser only downloads, a save dialog per file) and the list says how each one is.
// «Importar…» (mesa.js) hands the .tar here: they are read in parts (File.slice), every hash is checked and an incomplete or
// damaged set is refused without touching anything; then mesa.js merges as the import of always (M.importData).
// If this file doesn't load, «Exportar todo» says so and the mesa works as the 4.29.
(function copiaBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const VERSION = '1.1';
  const I = () => M._in, X = () => M._in.xfer;
  if (M.copia && M.copia._off) { try { M.copia._off(); } catch (e) { /* */ } }
  const FORMATO = 'mesa-copia', V = 1;
  // a part never passes 2 GB (in bytes, as the Finder counts them): the browser's downloads and Blobs stay well below their limits
  let PARTE_MAX = 2e9;
  const MANIFIESTO = 'manifiesto.json', DATOS = 'datos.json';
  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif', 'application/pdf': 'pdf' };
  const enc = new TextEncoder(), dec = new TextDecoder();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const peso = n => I().pesoTxt(n);
  const n_ = n => Number(n).toLocaleString('es-ES');
  const OFF = [];

  // ---------- hashes and the tar (ustar) ----------
  const hex = b => { const u = new Uint8Array(b); let s = ''; for (let i = 0; i < u.length; i++) s += u[i].toString(16).padStart(2, '0'); return s; };
  const huellaDe = async ab => hex(await crypto.subtle.digest('SHA-256', ab));
  const huella = async blob => huellaDe(await blob.arrayBuffer());
  const bloques = n => Math.ceil(n / 512) * 512;
  const relleno = n => new Uint8Array(bloques(n) - n);
  const octal = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0';
  // a 512-byte ustar header: name ≤ 100 ASCII bytes, size up to 8 GB (11 octal digits)
  function cabecera(nombre, tam, mtime) {
    const h = new Uint8Array(512), put = (t, o) => h.set(enc.encode(t), o);
    put(nombre, 0); put('0000644\0', 100); put('0000000\0', 108); put('0000000\0', 116);
    put(octal(tam, 12), 124); put(octal(Math.max(0, Math.floor(mtime)), 12), 136); put('        ', 148); put('0', 156); put('ustar\0', 257); put('00', 263);
    let s = 0; for (let i = 0; i < 512; i++) s += h[i];
    put(s.toString(8).padStart(6, '0') + '\0 ', 148);
    return h;
  }
  // the header at `off`: {nombre, tam, datos (where its bytes start), sig (the next header)} | {fin} (the two zero blocks) | {mal}
  async function leerCab(f, off) {
    if (off + 512 > f.size) return { mal: 'cortado' };
    const h = new Uint8Array(await f.slice(off, off + 512).arrayBuffer());
    if (h.every(b => b === 0)) return { fin: true };
    const txt = (a, b) => { let e = a; while (e < b && h[e]) e++; return dec.decode(h.subarray(a, e)); };
    if (txt(257, 262) !== 'ustar') return { mal: 'cabecera' };
    let s = 0; for (let i = 0; i < 512; i++) s += i >= 148 && i < 156 ? 32 : h[i];
    if (parseInt(txt(148, 156).trim(), 8) !== s) return { mal: 'cabecera' };
    const pre = txt(345, 500), tam = parseInt(txt(124, 136).trim(), 8);
    if (!(tam >= 0)) return { mal: 'cabecera' };
    const r = { nombre: (pre ? pre + '/' : '') + txt(0, 100), tam, datos: off + 512, sig: off + 512 + bloques(tam) };
    return r.datos + tam > f.size ? { mal: 'cortado' } : r;
  }

  // ---------- records as text: a blob is its hash (and the data a File keeps: its name and date) ----------
  function codificar(v, sha) {
    if (v instanceof Blob) {
      const o = { $copia: 'blob', sha: sha.get(v), tipo: v.type, tam: v.size };
      if (typeof File !== 'undefined' && v instanceof File) { o.nombre = v.name; o.lm = v.lastModified; }
      return o;
    }
    if (v instanceof Date) return { $copia: 'fecha', v: v.toISOString() };
    if (Array.isArray(v)) return v.map(x => codificar(x, sha));
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = codificar(v[k], sha); return o; }
    return v;
  }
  function decodificar(v, blobDe) {
    if (Array.isArray(v)) return v.map(x => decodificar(x, blobDe));
    if (v && typeof v === 'object') {
      if (v.$copia === 'blob') return blobDe(v);
      if (v.$copia === 'fecha') return new Date(v.v);
      const o = {}; for (const k of Object.keys(v)) o[k] = decodificar(v[k], blobDe); return o;
    }
    return v;
  }
  function blobsEn(v, out) {
    if (v instanceof Blob) out.add(v);
    else if (Array.isArray(v)) v.forEach(x => blobsEn(x, out));
    else if (v && typeof v === 'object' && !(v instanceof Date)) for (const k of Object.keys(v)) blobsEn(v[k], out);
    return out;
  }
  // a blob that can't be read: a photo whose image can't be read stays out (its thumbnail alone: the photo is its own, as a
  // reduced one's); in any other record the blob is left empty (and counted)
  function sinMalos(n, v, malos) {
    if (!malos.size) return v;
    if (n === 'files' || n === 'tfotos' || n === 'cfacturas') {
      if (v && v.blob instanceof Blob && !malos.has(v.blob) && [v.thumb, v.mini].some(b => malos.has(b))) { const o = { ...v }; if (malos.has(o.thumb)) o.thumb = o.blob; if (malos.has(o.mini)) o.mini = o.blob; return [...blobsEn(o, new Set())].some(b => malos.has(b)) ? undefined : o; }
      return [...blobsEn(v, new Set())].some(b => malos.has(b)) ? undefined : v;
    }
    const lim = x => x instanceof Blob ? (malos.has(x) ? null : x) : Array.isArray(x) ? x.map(lim) : x && typeof x === 'object' && !(x instanceof Date) ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, lim(y)])) : x;
    return lim(v);
  }

  // ---------- what goes in each file ----------
  // a snapshot of every store in one read (what a later change does is not in the copy)
  async function instantanea() {
    const A = X().ALMACENES, out = {};
    await X().tx(A, 'readonly', o => A.forEach(n => {
      const k = o[n].getAllKeys(), v = o[n].getAll();
      k.onsuccess = () => { (out[n] = out[n] || {}).k = k.result; };
      v.onsuccess = () => { (out[n] = out[n] || {}).v = v.result; };
    }));
    const R = {};
    for (const n of A) { const { k = [], v = [] } = out[n] || {}; R[n] = k.map((key, i) => [key, v[i]]); }
    R.boards = R.boards.map(([k, b]) => [k, b && X().newest(String(k), b)]);
    return R;
  }
  // a session has several clients (D-217); a task or a note, one (as personal.js)
  const clis = k => !k ? [] : k.tipo === 'sesion' && Array.isArray(k.clientes) ? k.clientes.filter(c => typeof c === 'string' && c) : typeof k.cliente === 'string' && k.cliente ? [k.cliente] : [];
  // each record to the monthly clients it belongs to; none: to the general file. A photo two clients use (a collab) goes in both
  function repartir(R) {
    const x = X(), CL = (I().CL || []);
    const clientes = R.clients.map(([, c]) => c).filter(c => c && typeof c.id === 'string' && c.id);
    const orden = [...CL.map(c => c.id), ...clientes.map(c => c.id), ...R.boards.map(([, b]) => b && x.boardClient(b))].filter(Boolean);
    const ids = [...new Set(orden)], es = new Set(ids), nombre = id => ((clientes.find(c => c.id === id) || CL.find(c => c.id === id) || {}).name) || id;
    const A = x.ALMACENES, amb = new Map([...ids.map(id => [id, { id, tipo: 'cliente', nombre: nombre(id), recs: {} }]), ['', { id: '', tipo: 'general', nombre: 'General', recs: {} }]]);
    amb.forEach(a => A.forEach(n => { a.recs[n] = []; }));
    const poner = (n, par, quien) => { const l = [...(quien || [])].filter(c => es.has(c)); (l.length ? l : ['']).forEach(c => amb.get(c).recs[n].push(par)); };
    // the files each client uses: its boards (posts, designs, editor, stories, the month before's thumbnails), its tray and its
    // folders, its kit's final photo, its profile photo and the editor's logos
    const usos = new Map(), usa = (f, c) => { if (!f || !c) return; if (!usos.has(f)) usos.set(f, new Set()); usos.get(f).add(c); };
    for (const [, b] of R.boards) { const c = b && x.boardClient(b); if (!c) continue; x.refsTodo(b).forEach(f => usa(f, c)); (b.past || []).forEach(p => p && p.id && usa('past:' + p.id, c)); }
    for (const [k, r] of R.bandejas) { const c = (r && r.client) || String(k); ((r && r.tray) || []).forEach(f => usa(f, c)); x.enCarpetas(r && r.carpetas).forEach(f => usa(f, c)); }
    for (const c of clientes) { usa(x.kitRef(c), c.id); usa(c.foto, c.id); ((c.libre && c.libre.logos) || []).forEach(f => usa(f, c.id)); }
    const deFijo = k => ids.find(id => k.startsWith('kit-' + id + '-') || k.startsWith('perfil-' + id + '-'));
    for (const par of R.files) { const k = String(par[0]), v = par[1]; poner('files', par, usos.get(k) || [(v && v.de) || deFijo(k)]); }
    for (const par of R.clients) poner('clients', par, [String(par[0])]);
    for (const par of R.boards) poner('boards', par, [par[1] && x.boardClient(par[1])]);
    for (const par of R.bandejas) poner('bandejas', par, [(par[1] && par[1].client) || String(par[0])]);
    // the locations: the whole catalog in the general file, and each client's those its list or its posts use
    const ubDe = new Map(), ubUsa = (u, c) => { if (!u) return; if (!ubDe.has(u)) ubDe.set(u, new Set()); ubDe.get(u).add(c); };
    clientes.forEach(c => (Array.isArray(c.ubicaciones) ? c.ubicaciones : []).forEach(u => ubUsa(u, c.id)));
    R.boards.forEach(([, b]) => { const c = b && x.boardClient(b); ((b && b.slots) || []).forEach(s => s && typeof s.ubicacion === 'string' && ubUsa(s.ubicacion, c)); });
    for (const par of R.ubicaciones) { amb.get('').recs.ubicaciones.push(par); [...(ubDe.get(String(par[0])) || [])].filter(c => es.has(c)).forEach(c => amb.get(c).recs.ubicaciones.push(par)); }
    const deTarea = new Map();
    for (const par of R.tareas) { const q = clis(par[1]).filter(c => es.has(c)); deTarea.set(String(par[0]), q); poner('tareas', par, q); }
    for (const par of R.tfotos) poner('tfotos', par, deTarea.get(String((par[1] && par[1].sesion) || '')) || []);
    const dePdf = new Map();
    for (const par of R.cobros) { const r = par[1] || {}; poner('cobros', par, [r.cliente]); if (r.pdf) { if (!dePdf.has(r.pdf)) dePdf.set(r.pdf, new Set()); dePdf.get(r.pdf).add(r.cliente); } }
    for (const par of R.cfacturas) poner('cfacturas', par, dePdf.get(String(par[0])) || []);
    for (const par of R.meses) poner('meses', par, [par[1] && par[1].cliente]);
    return [...amb.values()].filter(a => a.tipo === 'general' || A.some(n => a.recs[n].length));
  }

  // ---------- «Exportar todo» ----------
  let EXP = null;                      // the dialog's state while it is open
  // a browser's error said in words (its message is in English)
  const errTxt = err => { const n = err && err.name; return n === 'NotReadableError' || n === 'NotFoundError' ? 'un archivo guardado no se pudo leer' : n === 'QuotaExceededError' ? 'el navegador se quedó sin sitio' : 'el navegador dio un error'; };
  async function exportar() {
    if (EXP) return { error: '«Exportar todo» ya está abierto.' };
    const e = X().empezar('export'); if (e) { I().toast(e, { ms: 7000 }); return { error: e }; }
    if (X().edPendiente && X().edPendiente()) I().toast('El editor tiene cambios sin aplicar: no van en la copia. Aplícalos y vuelve a exportar si los quieres.', { ms: 9000 });
    // lot 4 (D-259): in a computer that only has working copies (or not even them), this copy can't carry those originals: it says so
    if (I().NUBE && I().NUBE.activa) { try { const l = await I().idbAll('files'), n = l.filter(v => v && (v.copia || (I().esRefNube && I().esRefNube(v.blob)))).length; if (n) I().toast(`En este ordenador ${n === 1 ? 'una foto solo tiene' : n.toLocaleString('es-ES') + ' fotos solo tienen'} su copia de 2560 px o aún no ha${n === 1 ? '' : 'n'} llegado: esta copia no lleva ${n === 1 ? 'su original' : 'sus originales'}. La copia completa se hace en el Mac que los tiene.`, { ms: 12000 }); } catch (e) { /* */ } }
    const st = EXP = { parar: false, urls: [], copia: (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)), at: new Date(), suelto: false, cache: new WeakMap() };
    const soltar = () => { if (!st.suelto) { st.suelto = true; X().acabar(); } };
    try {
      dibujar(st);
      await X().pendientes();
      const R = await instantanea();
      if (st.parar) return { cancelled: true };
      st.ambitos = repartir(R);
      // clients first, in the tabs' order, the general file last
      st.ambitos.sort((a, b) => (a.tipo === 'general') - (b.tipo === 'general'));
      st.ambitos.forEach(a => { a.estado = 'cola'; a.bytes = 0; const vistos = new Set(); for (const n of Object.keys(a.recs)) for (const [, v] of a.recs[n]) blobsEn(v, vistos); vistos.forEach(b => { a.bytes += b.size; }); });
      if (st.cerrado) return { cancelled: true };
      lista(st);
      for (const a of st.ambitos) { if (st.parar) break; await prepararUno(st, a); }
      return st.parar ? { cancelled: true } : { ok: !st.ambitos.some(a => a.estado === 'fallo'), archivos: st.ambitos.flatMap(a => a.partes || []).length };
    } catch (err) {
      const m = `No se pudo preparar la copia: ${errTxt(err)}.`;
      if (EXP === st) { cerrarExp(st, true); I().closeDetail(); } I().toast(m, { ms: 9000 }); return { error: m };
    } finally { soltar(); }
  }
  async function prepararUno(st, a) {
    a.estado = 'prep'; a.pct = 0; a.error = null; pintarFila(st, a);
    try { await preparar(st, a, st.cache); a.estado = 'listo'; }
    catch (err) { if (st.parar) return; a.estado = 'fallo'; a.error = errTxt(err); }
    pintarFila(st, a);
  }
  // a client (or the general file): its blobs hashed, its records as text, its parts made
  async function preparar(st, a, cache) {
    const A = Object.keys(a.recs), todos = new Set();
    for (const n of A) for (const [, v] of a.recs[n]) blobsEn(v, todos);
    const total = [...todos].reduce((s, b) => s + b.size, 0) || 1, malos = new Set();
    let hecho = 0, ult = 0;
    for (const b of todos) {
      if (st.parar) throw new Error('parada');
      if (!cache.has(b)) { try { cache.set(b, await huella(b)); } catch (err) { malos.add(b); } }
      hecho += b.size;
      if (Date.now() - ult > 120) { ult = Date.now(); a.pct = Math.min(99, Math.floor(hecho / total * 100)); pintarFila(st, a); }
    }
    const sha = new Map([...todos].filter(b => !malos.has(b)).map(b => [b, cache.get(b)]));
    const almacenes = {}, porSha = new Map();
    let fuera = 0; const sinNombre = [];
    for (const n of A) {
      almacenes[n] = [];
      for (const [k, v0] of a.recs[n]) {
        const v = sinMalos(n, v0, malos); if (v === undefined) { fuera++; sinNombre.push(String((v0 && (v0.name || v0.nombre)) || k)); continue; }
        if (v !== v0 && !(v && v0 && v.blob === v0.blob)) fuera++;
        blobsEn(v, new Set()).forEach(b => { const h = sha.get(b); if (h && !porSha.has(h)) porSha.set(h, b); });
        almacenes[n].push([codificar(k, sha), codificar(v, sha)]);
      }
    }
    a.fuera = fuera; a.fueraN = sinNombre;
    const datos = enc.encode(JSON.stringify({ format: FORMATO + '-datos', v: V, almacenes }));
    const hDatos = await huellaDe(datos);
    const entradas = [...porSha].map(([h, b]) => ({ nombre: `archivos/${h}.${EXT[b.type] || 'bin'}`, sha256: h, tam: b.size, blob: b }));
    // the parts: part 1 starts with the records; then the files, in order, a new part when the next one wouldn't fit
    const partes = [], nueva = () => { const p = { entradas: [], tam: 512 + 8192 + 1024 }; partes.push(p); return p; };
    let p = nueva(); p.tam += 512 + bloques(datos.length);
    for (const e of entradas) { const t = 512 + bloques(e.tam) + 256; if (p.entradas.length && p.tam + t > PARTE_MAX) p = nueva(); p.entradas.push(e); p.tam += t; }
    const mt = st.at.getTime() / 1000, regs = Object.fromEntries(A.map(n => [n, almacenes[n].length]).filter(([, c]) => c));
    a.partes = partes.map((q, i) => {
      const man = enc.encode(JSON.stringify({ format: FORMATO, v: V, app: M.version, idb: X().IDB, copia: st.copia, exportadaEl: st.at.toISOString(),
        ambito: a.tipo === 'general' ? { tipo: 'general', nombre: 'General' } : { tipo: 'cliente', id: a.id, nombre: a.nombre },
        parte: i + 1, partes: partes.length, ...(i === 0 ? { datos: { nombre: DATOS, tam: datos.length, sha256: hDatos }, registros: regs } : {}),
        archivos: q.entradas.map(e => ({ nombre: e.nombre, tam: e.tam, sha256: e.sha256 })), total: { archivos: entradas.length, bytes: entradas.reduce((s, e) => s + e.tam, 0) } }));
      const trozos = [cabecera(MANIFIESTO, man.length, mt), man, relleno(man.length)];
      if (i === 0) trozos.push(cabecera(DATOS, datos.length, mt), datos, relleno(datos.length));
      q.entradas.forEach(e => trozos.push(cabecera(e.nombre, e.tam, mt), e.blob, relleno(e.tam)));
      trozos.push(new Uint8Array(1024));
      const blob = new Blob(trozos, { type: 'application/x-tar' });
      return { i: i + 1, n: partes.length, blob, nombre: nombreArchivo(st, a, i + 1, partes.length), hecho: 0, ult: 0 };
    });
  }
  const dos = n => String(n).padStart(2, '0');
  function nombreArchivo(st, a, i, n) {
    const d = st.at, slug = a.tipo === 'general' ? 'general' : String(a.id).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'cliente';
    return `mesa-copia-${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}-${slug}${n > 1 ? `-parte-${i}-de-${n}` : ''}.tar`;
  }
  // each file from its own click (never several downloads at once). The browser only says it took it: whether the save dialog
  // saved it, the page can't know, so the row says «Descarga lanzada» and the foot asks to check the SSD
  function descargar(st, a, p) {
    if (!p || !p.blob || Date.now() - p.ult < 1500) return;   // a double click is one download (lesson 57)
    if (!p.url) { p.url = URL.createObjectURL(p.blob); st.urls.push(p.url); }
    const el = document.createElement('a'); el.href = p.url; el.download = p.nombre; el.hidden = true; document.body.append(el); el.click(); el.remove();
    p.hecho++; p.ult = Date.now(); pintarFila(st, a); pie(st);
  }

  // ---------- the dialog ----------
  function estadoDe(a, p) {
    if (a.estado === 'fallo') return { t: `No se pudo preparar: ${a.error}.`, k: 'mal' };
    if (p && p.hecho) return { t: `${peso(p.blob.size)} · Descarga lanzada${p.hecho > 1 ? ` (${n_(p.hecho)} veces)` : ''}`, k: 'ok' };
    if (p) return { t: `${peso(p.blob.size)} · Listo${a.fuera ? ` · sin ${n_(a.fuera)} ${a.fuera === 1 ? 'archivo que no se pudo leer' : 'archivos que no se pudieron leer'}${(a.fueraN || []).length ? ` (${a.fueraN.slice(0, 3).join(', ')}${a.fueraN.length > 3 ? '…' : ''})` : ''}` : ''}`, k: a.fuera ? 'aviso' : '' };
    if (a.estado === 'prep') return { t: `${peso(a.bytes)} · Preparando${a.pct ? ` ${a.pct} %` : '…'}`, k: '' };
    return { t: `${peso(a.bytes)} · En cola`, k: '' };
  }
  const nombreFila = (a, p) => a.nombre + (p && p.n > 1 ? `, parte ${p.i} de ${p.n}` : '');
  const boton = (a, p) => a.estado === 'fallo' ? { t: 'Reintentar', l: 'Preparar otra vez ' + a.nombre, on: true } : { t: p && p.hecho ? 'Otra vez' : 'Descargar', l: (p && p.hecho ? 'Descargar otra vez ' : 'Descargar ') + nombreFila(a, p), on: !!p };
  function filaHTML(a, p, j) {
    const e = estadoDe(a, p), b = boton(a, p);
    return `<li class="cp-f" data-a="${j}"${p ? ` data-p="${p.i}"` : ''}><span class="cp-q"><span class="cp-n"><span class="cp-nm">${esc(a.nombre)}</span>${p && p.n > 1 ? `<span class="cp-pt">· parte ${p.i} de ${p.n}</span>` : ''}</span><span class="cp-s ${e.k}">${esc(e.t)}</span></span>`
      + `<button type="button" class="btn2" data-cp="bajar"${b.on ? '' : ' disabled'} aria-label="${esc(b.l)}">${b.t}</button></li>`;
  }
  const filasDe = (a, j) => (a.partes ? a.partes.map(p => filaHTML(a, p, j)) : [filaHTML(a, null, j)]).join('');
  function pie(st) {
    const el = vivo(st) && st.dlg.querySelector('.cp-pie'); if (!el) return;
    const ps = (st.ambitos || []).flatMap(a => a.partes || []), hechos = ps.filter(p => p.hecho).length;
    const prep = (st.ambitos || []).filter(a => a.estado === 'cola' || a.estado === 'prep').length, filas = ps.length + prep;
    const t = !st.ambitos ? '' : prep ? `Preparando: ${n_(ps.length)} de ${n_(filas)} listos · ${n_(hechos)} ${hechos === 1 ? 'lanzado' : 'lanzados'}`
      : !hechos ? `${n_(ps.length)} ${ps.length === 1 ? 'archivo' : 'archivos'}`
      : `${n_(hechos)} de ${n_(ps.length)} ${ps.length === 1 ? 'archivo lanzado' : 'archivos lanzados'}: comprueba en el SSD que están${hechos > 1 ? ' todos' : ''} y con su tamaño.`;
    if (el.textContent !== t) el.textContent = t;
  }
  const vivo = st => !st.cerrado && st.dlg && st.dlg.isConnected && st.dlg.dataset.dlg === 'copia' && !!st.dlg.querySelector('.cp-l');
  function dibujar(st) {
    I().showDialog('copia', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Exportar todo</h3>`
      + '<p>Guarda todos los archivos juntos en el SSD: «Importar…» los lee a la vez.</p>'
      + '<ul class="cp-l"><li class="cp-f"><span class="cp-q"><span class="cp-s">Leyendo la mesa…</span></span></li></ul><p class="cp-pie" aria-live="polite"></p>');
    const d = I().root().querySelector('.detail'); st.dlg = d;
    // on this dialog's card: the .detail stays for the next dialogs
    d.querySelector('.card').addEventListener('click', ev => {
      const b = ev.target.closest('[data-cp="bajar"]'); if (!b || b.disabled || ev.detail > 1) return;
      const li = b.closest('.cp-f'), a = st.ambitos && st.ambitos[+li.dataset.a]; if (!a) return;
      if (a.estado === 'fallo') { prepararUno(st, a); return; }
      descargar(st, a, (a.partes || []).find(p => p.i === +li.dataset.p));
    });
    st.mo = new MutationObserver(() => { if (d.hidden || d.dataset.dlg !== 'copia') cerrarExp(st); });
    st.mo.observe(d, { attributes: true, attributeFilter: ['hidden', 'data-dlg'] });
    const x = d.querySelector('.card > .x'); if (x) x.focus();
  }
  function lista(st) {
    if (!vivo(st)) return;
    st.dlg.querySelector('.cp-l').innerHTML = st.ambitos.map(filasDe).join('');
    pie(st);
  }
  // only what changed: a row's line of state and its button; a client that split in parts, only its rows (nothing else moves)
  function pintarFila(st, a) {
    if (!vivo(st) || !st.ambitos) return;
    const j = st.ambitos.indexOf(a), filas = [...st.dlg.querySelectorAll(`.cp-f[data-a="${j}"]`)];
    if (!filas.length) return;
    if ((a.partes ? a.partes.length : 1) !== filas.length || (!!a.partes !== !!filas[0].dataset.p)) {   // its parts made (or another number of them): its rows anew
      const foco = filas.some(li => li.contains(document.activeElement));
      filas[0].insertAdjacentHTML('beforebegin', filasDe(a, j)); filas.forEach(li => li.remove());
      if (foco) { const b = st.dlg.querySelector(`.cp-f[data-a="${j}"] button`); if (b) b.focus(); }
    } else filas.forEach(li => {
      const p = a.partes && a.partes.find(x => x.i === +li.dataset.p), e = estadoDe(a, p), s = li.querySelector('.cp-s'), bt = li.querySelector('button'), b = boton(a, p);
      if (s.textContent !== e.t) s.textContent = e.t; if (s.className !== 'cp-s ' + e.k) s.className = 'cp-s ' + e.k;
      bt.disabled = !b.on; if (bt.textContent !== b.t) bt.textContent = b.t; bt.setAttribute('aria-label', b.l);
    });
    pie(st);
  }
  function cerrarExp(st, sinAviso) {
    if (st.cerrado) return; st.cerrado = true; st.parar = true;
    if (st.mo) st.mo.disconnect();
    if (EXP === st) EXP = null;
    const urls = st.urls.slice(); setTimeout(() => urls.forEach(u => URL.revokeObjectURL(u)), 30 * 60000);   // a download the app's dialog still holds keeps its file
    if (!st.suelto) { st.suelto = true; X().acabar(); }
    // closed with files ready that never went: said, not lost in silence (they are made again in a moment)
    const faltan = (st.ambitos || []).flatMap(a => a.partes || []).filter(p => !p.hecho).length;
    if (!sinAviso && faltan) I().toast(`${faltan === 1 ? 'Ha quedado 1 archivo' : `Han quedado ${n_(faltan)} archivos`} de la copia sin descargar: «Exportar todo» los vuelve a preparar.`, { ms: 9000 });
  }

  // ---------- «Importar…» of a copy ----------
  async function leerManifiesto(f) {
    if (f.size < 1536 || (await f.slice(257, 262).text()) !== 'ustar') return { mal: 'no' };   // not a tar (a .json, a photo…)
    const h = await leerCab(f, 0);
    if (h.mal || h.fin || h.nombre !== MANIFIESTO || h.tam > 64 * 1048576) return { mal: h.mal === 'cortado' ? 'cortado' : 'no' };
    let m; try { m = JSON.parse(dec.decode(await f.slice(h.datos, h.datos + h.tam).arrayBuffer())); } catch (e) { return { mal: 'danado' }; }
    if (!m || m.format !== FORMATO) return { mal: m && typeof m.format === 'string' && m.format.startsWith(FORMATO) ? 'danado' : 'no' };
    if (!(m.v >= 1) || m.v > V || !(m.idb >= 1) || m.idb > X().IDB) return { mal: 'nueva', m };
    if (typeof m.copia !== 'string' || !m.copia || !(m.parte >= 1) || !(m.partes >= m.parte) || !m.ambito || !Array.isArray(m.archivos) || (m.parte === 1 && !(m.datos && m.datos.sha256))) return { mal: 'danado' };
    return { m, sig: h.sig };
  }
  const nomAmb = m => m.ambito && m.ambito.tipo === 'general' ? 'General' : (m.ambito && (m.ambito.nombre || m.ambito.id)) || 'un cliente';
  let IMP = null;
  async function importar(files, opts = {}) {
    if (IMP) return { error: 'Espera: ya se está importando una copia.' };
    const e = X().empezar('import'); if (e) { avisoImp(null, e); return { error: e }; }
    const st = IMP = { parar: false, suelto: false };
    const soltar = () => { if (!st.suelto) { st.suelto = true; X().acabar(); } };
    const fallo = m => { avisoImp(st, m); return { error: m }; };
    try {
      if (!(window.crypto && crypto.subtle)) return fallo('Este navegador no puede comprobar las huellas de la copia.');
      dibujarImp(st);
      // 1. what each file is
      const leidos = [];
      for (const f of files) {
        const r = await leerManifiesto(f);
        if (r.mal === 'nueva') return fallo(`«${f.name || 'archivo'}» viene de una versión más nueva de la Mesa: recarga la página para tener la última y vuelve a importarla.`);
        if (r.mal === 'cortado') return fallo(`«${f.name || 'archivo'}» está cortado: ¿terminó de copiarse?`);
        if (r.mal === 'danado') return fallo(`«${f.name || 'archivo'}» está dañado: no se puede leer su manifiesto.`);
        if (r.mal) return fallo(`«${f.name || 'archivo'}» no es una copia de «Exportar todo».${/\.json$/i.test(f.name || '') ? ' Un archivo .json se importa solo, sin los .tar.' : ''}`);
        leidos.push({ f, ...r });
      }
      // 2. every part of each file: none missing, none twice with something else
      const grupos = new Map(), deAmbito = new Map();
      for (const x of leidos) {
        const ka = x.m.ambito.tipo === 'general' ? '' : 'c:' + x.m.ambito.id, otra = deAmbito.get(ka);
        if (otra && otra !== x.m.copia) return fallo(`Has elegido dos copias distintas de «${nomAmb(x.m)}»: impórtalas de una en una (la segunda se une con lo que trajo la primera, con las reglas de siempre).`);
        deAmbito.set(ka, x.m.copia);
        const k = x.m.copia + '|' + (x.m.ambito.tipo === 'general' ? '' : 'c:' + x.m.ambito.id);
        if (!grupos.has(k)) grupos.set(k, { m: x.m, partes: new Map() });
        const g = grupos.get(k), ya = g.partes.get(x.m.parte);
        if (x.m.partes !== g.m.partes) return fallo(`Las partes de «${nomAmb(x.m)}» no son de la misma copia.`);
        if (ya && ya.f.size !== x.f.size) return fallo(`Has elegido dos veces la parte ${x.m.parte} de «${nomAmb(x.m)}» y no son iguales.`);
        if (!ya) g.partes.set(x.m.parte, x);
      }
      for (const g of grupos.values()) {
        const faltan = []; for (let i = 1; i <= g.m.partes; i++) if (!g.partes.has(i)) faltan.push(i);
        if (faltan.length) return fallo(`Falta${faltan.length > 1 ? 'n las partes' : ' la parte'} ${faltan.join(', ').replace(/, (\d+)$/, ' y $1')} de ${g.m.partes} de «${nomAmb(g.m)}»: elígela${faltan.length > 1 ? 's' : ''} junto a las demás.`);
      }
      // 3. every file inside, as the manifest says: its size and its hash
      const partes = [...grupos.values()].flatMap(g => [...g.partes.values()]);
      const total = partes.reduce((s, x) => s + x.f.size, 0) || 1, donde = new Map();
      let hecho = 0, ult = 0;
      for (const x of partes) {
        const lista = new Map(x.m.archivos.map(a => [a.nombre, a])); if (x.m.parte === 1) lista.set(DATOS, { nombre: DATOS, tam: x.m.datos.tam, sha256: x.m.datos.sha256 });
        const vistos = new Set(); let off = x.sig;
        for (;;) {
          if (st.parar) return parada(st);
          const h = await leerCab(x.f, off);
          if (h.mal) return fallo(h.mal === 'cortado' ? `«${x.f.name}» está cortado: ¿terminó de copiarse?` : `«${x.f.name}» está dañado.`);
          if (h.fin) break;
          const a = lista.get(h.nombre);
          if (!a || a.tam !== h.tam || vistos.has(h.nombre)) return fallo(`«${x.f.name}» está dañado: no coincide con su manifiesto.`);
          const ab = await x.f.slice(h.datos, h.datos + h.tam).arrayBuffer();
          if (await huellaDe(ab) !== a.sha256) return fallo(`«${x.f.name}» está dañado: un archivo no coincide con su huella.`);
          vistos.add(h.nombre);
          if (h.nombre === DATOS) x.datos = ab; else donde.set(a.sha256, { f: x.f, off: h.datos, tam: h.tam });
          hecho += 512 + bloques(h.tam); off = h.sig;
          if (Date.now() - ult > 150) { ult = Date.now(); progresoImp(st, `Comprobando la copia: ${peso(hecho)} de ${peso(total)}…`); }
        }
        if (vistos.size !== lista.size) return fallo(`«${x.f.name}» está incompleto: le faltan archivos de su manifiesto.`);
      }
      if (st.parar) return parada(st);
      progresoImp(st, 'Preparando la copia…');
      // 4. the records of every file; one key in several files (a collab's photo, a location): the newest copy's (the order the
      // files were chosen in changes nothing)
      const elegido = new Map();
      for (const g of grupos.values()) {
        const x = g.partes.get(1); let d;
        try { d = JSON.parse(dec.decode(x.datos)); } catch (err) { return fallo(`«${x.f.name}» está dañado: no se pueden leer sus datos.`); }
        if (!d || d.format !== FORMATO + '-datos' || !d.almacenes || typeof d.almacenes !== 'object') return fallo(`«${x.f.name}» está dañado: no se pueden leer sus datos.`);
        const orden = [String(g.m.exportadaEl || ''), g.m.copia, g.m.ambito.tipo === 'general' ? '' : String(g.m.ambito.id || '')];
        for (const [n, l] of Object.entries(d.almacenes)) {
          if (!X().ALMACENES.includes(n)) continue;   // a store this mesa doesn't know (only from a newer one, refused above)
          if (!Array.isArray(l)) return fallo(`«${x.f.name}» está dañado: no se pueden leer sus datos.`);
          for (const par of l) {
            if (!Array.isArray(par) || par.length !== 2 || typeof par[0] !== 'string') return fallo(`«${x.f.name}» está dañado: no se pueden leer sus datos.`);
            const k = n + '\u0000' + par[0], ya = elegido.get(k), nu = { n, k: par[0], v: par[1], orden };
            if (!ya || gana(nu, ya)) elegido.set(k, nu);
          }
        }
      }
      // 5. the blobs, slices of the files (nothing read into memory); every reference has its file
      let falta = null;
      const blobDe = r => {
        const w = donde.get(r.sha); if (!w || w.tam !== r.tam) { falta = r; return null; }
        const b = w.f.slice(w.off, w.off + w.tam, r.tipo || '');
        return typeof r.nombre === 'string' && typeof File !== 'undefined' ? new File([b], r.nombre, { type: r.tipo || '', lastModified: +r.lm || 0 }) : b;
      };
      const raw = Object.fromEntries(X().ALMACENES.map(n => [n, new Map()]));
      for (const e2 of elegido.values()) { const mismo = new Map(); raw[e2.n].set(e2.k, decodificar(e2.v, r => { const k = r.sha + '|' + (r.nombre || '') + '|' + (r.tipo || ''); if (!mismo.has(k)) mismo.set(k, blobDe(r)); return mismo.get(k); })); }
      if (falta) return fallo('La copia está incompleta: le falta uno de sus archivos.');
      const vals = n => [...raw[n].values()];
      const ambitos = [...grupos.values()].map(g => g.m), nc = ambitos.filter(m => m.ambito.tipo !== 'general').length, gen = ambitos.some(m => m.ambito.tipo === 'general');
      const bytes = [...donde.values()].reduce((s, w) => s + w.tam, 0), fecha = ambitos.map(m => String(m.exportadaEl || '')).sort().pop();
      const info = [nc && `${n_(nc)} ${nc === 1 ? 'cliente' : 'clientes'}`, gen && 'general'].filter(Boolean).join(' y ') + ` · ${n_(donde.size)} ${donde.size === 1 ? 'archivo' : 'archivos'} a tamaño original (${peso(bytes)})`;
      // what the import of always merges with what is here (each record as «Importar» checks it in a .json; anything else only
      // goes in where nothing is, as it was)
      const fechaOk = v => typeof v === 'string' && !isNaN(Date.parse(v)), txt = v => typeof v === 'string' && !!v;
      const d = {
        format: 'mesa-feed', exportedAt: fecha, clients: vals('clients').filter(c => c && txt(c.id)), boards: vals('boards').filter(b => b && txt(b.key) && /^.+-\d{4}-\d{2}$/.test(b.key) && Array.isArray(b.slots)),
        bandejas: vals('bandejas').filter(r => r && txt(r.client) && Array.isArray(r.tray)),
        ubicaciones: vals('ubicaciones').filter(u => u && txt(u.id) && typeof u.nombre === 'string' && typeof u.locationId === 'string'),
        tareas: vals('tareas').filter(t => t && txt(t.id) && typeof t.tipo === 'string' && typeof t.txt === 'string'),
        cobros: vals('cobros').filter(r => r && txt(r.id) && txt(r.cliente) && fechaOk(r.at)), meses: vals('meses').filter(r => r && txt(r.cliente) && /^\d{4}-\d{2}$/.test(r.mes || '') && fechaOk(r.at)),
        cfacturas: vals('cfacturas').map(f => ({ ...f, data: f.blob })),
        files: Object.fromEntries([...raw.files].filter(([k]) => !k.startsWith('past:')).map(([k, v]) => [k, { ...v, data: v && v.blob }])), past: {},
        copia: { raw, info }
      };
      if (st.parar) return parada(st);
      // 6. mesa.js merges it (its confirmation, its writing with «Cancelar», its notices)
      st.cerrado = true; if (st.mo) st.mo.disconnect(); soltar(); IMP = null;
      return await M.importData(d, opts);
    } catch (err) {
      const q = err && (err.name === 'NotReadableError' || err.name === 'NotFoundError');
      return fallo(q ? 'No se pudo leer un archivo de la copia: ¿sigue donde estaba (el SSD conectado)?' : `No se pudo leer la copia: ${errTxt(err)}.`);
    } finally { soltar(); if (IMP === st) IMP = null; }
  }
  const mayor = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] > b[i]) return true; if (a[i] < b[i]) return false; } return false; };
  // two files of different copies with the same record: a full photo over a reduced one (D-017), the newer `at` (as «Importar»),
  // then the newest copy; never the order the files were chosen in
  function gana(a, b) {
    if (a.n === 'files') { const ra = !!(a.v && (a.v.reduced || a.v.copia)), rb = !!(b.v && (b.v.reduced || b.v.copia)); if (ra !== rb) return rb; }   // a working copy (lot 4) loses as a reduced one
    const at = x => (x.v && typeof x.v.at === 'string' ? x.v.at : '');
    if (at(a) !== at(b)) return at(a) > at(b);
    return mayor(a.orden, b.orden);
  }
  function parada(st) { cerrarImp(st); I().toast('Importación cancelada mientras se comprobaba la copia: no se ha importado nada.', { ms: 7000 }); return { cancelled: true }; }
  function dibujarImp(st) {
    I().showDialog('copia-leer', '<h3>Importar la copia</h3><p class="cp-prog" aria-live="polite">Leyendo los archivos…</p><div class="form"><div class="row"><button type="button" class="btn2" data-cp="parar">Cancelar</button></div></div>');
    const d = I().root().querySelector('.detail'); st.dlg = d;
    const bp = d.querySelector('[data-cp="parar"]');
    bp.addEventListener('click', () => { st.parar = true; bp.disabled = true; bp.textContent = 'Parando…'; });
    st.mo = new MutationObserver(() => { if (d.hidden || d.dataset.dlg !== 'copia-leer') { st.parar = true; if (st.mo) st.mo.disconnect(); } });
    st.mo.observe(d, { attributes: true, attributeFilter: ['hidden', 'data-dlg'] });
    d.querySelector('[data-cp="parar"]').focus();
  }
  function progresoImp(st, t) { const p = st.dlg && st.dlg.isConnected && st.dlg.dataset.dlg === 'copia-leer' && st.dlg.querySelector('.cp-prog'); if (p && p.textContent !== t) p.textContent = t; }
  function cerrarImp(st) { if (st.mo) st.mo.disconnect(); st.cerrado = true; if (st.dlg && st.dlg.isConnected && st.dlg.dataset.dlg === 'copia-leer') I().closeDetail(); }
  // why nothing was imported, in the dialog that was open (or a notice)
  function avisoImp(st, m) {
    if (st && st.mo) st.mo.disconnect();
    const d = st && st.dlg;
    if (d && d.isConnected && !d.hidden && d.dataset.dlg === 'copia-leer') {
      I().showDialog('copia-leer', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3 id="cp-err-t">No se ha importado la copia</h3><p class="cp-err" role="alert">${esc(m)}</p>`);
      const c = I().root().querySelector('.detail .card'); if (c) c.setAttribute('aria-labelledby', 'cp-err-t');
      const x = c && c.querySelector('.x'); if (x) x.focus();
    } else I().toast(m + ' No se ha importado nada.', { ms: 9000 });
  }

  // ---------- its look (the mesa's tokens, D-131 to D-174) ----------
  I().estilo('copia-css', `
#mesa .detail[data-dlg="copia"]{align-items:flex-start;padding-top:clamp(16px,10vh,96px)}
#mesa .detail[data-dlg="copia"] .card.dlg{max-width:520px;width:min(520px,100%)}
#mesa .cp-l{list-style:none;margin:6px -4px 10px;padding:0 4px;max-height:min(52vh,440px);overflow:auto}
#mesa .cp-f{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid var(--line)}
#mesa .cp-f:last-child{border-bottom:1px solid var(--line)}
#mesa .cp-q{flex:1;min-width:0}
#mesa .cp-n{display:flex;gap:4px;min-width:0;font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap}
#mesa .cp-nm{min-width:0;overflow:hidden;text-overflow:ellipsis}
#mesa .cp-pt{flex:none;font-weight:400;color:var(--mute)}
#mesa .cp-s{display:flex;align-items:center;gap:5px;margin-top:2px;font-size:12px;color:var(--mute);font-variant-numeric:tabular-nums}
#mesa .cp-s.ok{color:var(--ink-2)}
#mesa .cp-s.ok::before{content:'';flex:none;width:13px;height:13px;background:var(--ok);-webkit-mask:var(--i-check) center/contain no-repeat;mask:var(--i-check) center/contain no-repeat}
#mesa .cp-s.aviso{color:var(--chg)}#mesa .cp-s.mal{color:var(--red)}
#mesa .cp-f .btn2{flex:none;min-width:96px}
#mesa .card>p.cp-pie{margin:0;font-size:12px;color:var(--mute)}#mesa .card>p.cp-pie:empty{display:none}
#mesa .card>p.cp-prog{font-variant-numeric:tabular-nums}
#mesa .card>p.cp-err{color:var(--ink-2)}
`);

  M.copia = {
    exportar, importar,
    _test: { parteMax: n => { PARTE_MAX = n > 0 ? n : 2e9; }, leerCab, huella, repartir: async () => repartir(await instantanea()) },
    _off: () => { OFF.forEach(f => f()); }
  };
  (window.MESA_CARGA = window.MESA_CARGA || {}).copia = 'ok';
})();
