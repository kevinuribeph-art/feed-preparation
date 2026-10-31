// carpetas.js 1.2: folders into the tray (D-074, D-075) and the right-click menus (D-076, D-077), loaded on its own: the mesa never waits for it.
// A folder dragged onto the tray or chosen with «Subir carpeta» becomes a folder of the client's tray with its subfolders; so
// does «+ Carpeta», empty. Before an upload it says how many photos and GB and how much room is left; then a progress bar. The
// photos and their place in the tray are written by mesa.js (entrarFoto), one transaction each: the same bytes as a tray
// photo, never reduced (D-061), and a photo already here is the same file (D-022, D-069).
(function carpetasBoot() {
  'use strict';
  const M = window.MESA = window.MESA || {};
  const I = () => M._in;                       // read on every use: a reloaded mesa replaces the bridge
  const VERSION = '1.2';
  const AVISO_DESDE = 20;                      // loose photos: fewer than this go in as always, without a warning
  const SISTEMA = /^(\.|__MACOSX$|Thumbs\.db$|desktop\.ini$)/i;   // .DS_Store, ._foto.jpg (the disk is exFAT), the system's folders
  const POR_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const num = n => n.toLocaleString('es-ES');
  const ext = n => { const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1).toLowerCase() : ''; };
  const margen = () => (M.cfg && M.cfg.margenSubida != null ? M.cfg.margenSubida : I().MARGEN_SUBIDA);
  let enMarcha = null, pendiente = null;       // the upload under way ({cancelar}), what the warning is asking about

  // ---------- reading what was dropped or chosen: [{path: ['Sesión', 'Sub'], file}] ----------
  const archivoDe = en => new Promise((res, rej) => en.file(res, rej));
  function hijosDe(dir) {                      // readEntries gives them in batches: until one comes empty
    const r = dir.createReader(), out = [];
    return new Promise((res, rej) => { const otra = () => r.readEntries(l => { if (!l.length) return res(out); out.push(...l); otra(); }, rej); otra(); });
  }
  async function recorrer(en, path, out, av) {
    if (en.isFile) {
      try { out.items.push({ path, file: await archivoDe(en) }); } catch (e) { out.fallan++; }
      if (!(++av.n % 100)) barra(`Leyendo la carpeta: ${num(av.n)} archivos…`, null);
      return;
    }
    if (SISTEMA.test(en.name)) return;
    let hijos; try { hijos = await hijosDe(en); } catch (e) { out.fallan++; return; }
    for (const h of hijos) await recorrer(h, [...path, en.name], out, av);
  }

  // what enters and what is left out, and why
  function clasificar(items) {
    const fotos = [], otros = new Map(); let sistema = 0;
    for (const it of items) {
      const f = it.file, n = f.name;
      if (SISTEMA.test(n)) { sistema++; continue; }
      const type = I().OK_TYPES.includes(f.type) ? f.type : !f.type ? POR_EXT[ext(n)] : null;
      if (!type || !f.size) { const k = f.size ? (ext(n) ? '.' + ext(n).toUpperCase() : 'sin extensión') : 'vacíos'; otros.set(k, (otros.get(k) || 0) + 1); continue; }
      fotos.push({ path: it.path, file: f.type ? f : new File([f], n, { type, lastModified: f.lastModified }), type });
    }
    const cmp = (a, b) => a.localeCompare(b, 'es', { numeric: true });
    fotos.sort((a, b) => cmp(a.path.join('/'), b.path.join('/')) || cmp(a.file.name, b.file.name));
    return { fotos, otros, sistema };
  }
  const textoSaltados = (c, extra = 0) => {
    const partes = [...c.otros].map(([k, n]) => `${num(n)} ${k}`);
    if (c.sistema) partes.push(`${num(c.sistema)} del sistema`);
    if (extra) partes.push(`${num(extra)} sin leer`);
    const n = [...c.otros.values()].reduce((a, b) => a + b, 0) + c.sistema + extra;
    return n ? `${num(n)} ${n === 1 ? 'archivo saltado' : 'archivos saltados'} (${partes.join(', ')})` : '';
  };
  const carpetasDe = fotos => { const r = new Set(); fotos.forEach(x => x.path.forEach((_, i) => r.add(x.path.slice(0, i + 1).join('\u0000')))); return [...r].sort((a, b) => a.split('\u0000').length - b.split('\u0000').length); };

  // ---------- the warning ----------
  async function preparar(items, destino, fallan = 0) {
    const c = clasificar(items), { fotos } = c;
    barra(null);
    if (!fotos.length) { I().toast(`No hay fotos que subir.${textoSaltados(c, fallan) ? ' ' + textoSaltados(c, fallan) + '.' : ''}`, { ms: 8000 }); return null; }
    const idx = await I().indiceFotos(), ya = fotos.filter(x => idx.has(x.file.name + '|' + x.file.size));
    const bytes = fotos.reduce((n, x) => n + (idx.has(x.file.name + '|' + x.file.size) ? 0 : x.file.size), 0), carpetas = carpetasDe(fotos), e = await M.espacio();
    const libre = e.cupo != null ? Math.max(0, e.cupo - (e.usado || 0)) : null, m = margen(), pes = I().pesoTxt, esc = I().esc;
    const top = [...new Set(fotos.filter(x => x.path.length).map(x => x.path[0]))], dest = destino && (I().S.carpetas.find(x => x.id === destino) || {}).name;
    const titulo = top.length === 1 ? `Subir «${esc(top[0])}»` : top.length > 1 ? `Subir ${num(top.length)} carpetas` : `Subir ${num(fotos.length)} fotos`;
    pendiente = { c, destino, fallan };
    I().showDialog('subircarpeta', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>${titulo}</h3>`
      + `<p><b>${num(fotos.length)} ${fotos.length === 1 ? 'foto' : 'fotos'} · ${pes(bytes)}</b>${carpetas.length ? ` en ${num(carpetas.length)} ${carpetas.length === 1 ? 'carpeta' : 'carpetas'}` : ''}, a ${dest ? `«${esc(dest)}»` : 'la bandeja'}.</p>`
      + (ya.length ? `<p>${ya.length === 1 ? 'Una ya está' : `${num(ya.length)} ya están`} en la Mesa: se usa el mismo archivo y no ocupan más.</p>` : '')
      + (libre != null ? `<p>Quedan ${pes(libre)} libres para la Mesa, según el navegador.</p>` : '')
      + (libre != null && bytes > libre - m ? `<p><b>No cabe todo:</b> la subida se para cuando queden ${pes(m)} libres, y lo subido se queda en su carpeta.</p>` : '')
      + (e.persistida ? '' : '<p>El navegador no garantiza conservar estas fotos si el disco se llena: deja espacio libre y guarda los originales en el disco.</p>')
      + (textoSaltados(c, fallan) ? `<p>${esc(textoSaltados(c, fallan))}.</p>` : '')
      + '<div class="form"><div class="row"><button type="button" class="btn2" data-act="close">Cancelar</button><button type="button" class="btn" data-act="cp-ir">Subir</button></div></div>');
    return pendiente;
  }

  // ---------- the upload ----------
  function barra(txt, frac) {
    const root = I().root && I().root(), tray = root && root.querySelector('.tray');
    let b = tray && tray.querySelector('.cpprog');
    if (txt == null) { if (b) b.remove(); return; }
    if (!tray) return;
    if (!b) {
      b = document.createElement('div'); b.className = 'cpprog';
      b.innerHTML = '<div class="cpt"><span class="cptx"></span><button type="button" class="btn2" data-act="cp-cancelar">Cancelar</button></div><div class="cpbar"><i></i></div>';
      tray.querySelector('.trayhead').after(b);
    }
    b.querySelector('.cptx').textContent = txt;
    b.querySelector('.btn2').hidden = !enMarcha;
    b.querySelector('.cpbar').hidden = frac == null;
    if (frac != null) b.querySelector('i').style.width = `${Math.round(frac * 1000) / 10}%`;
  }
  const pintar = () => { I().renderTray(); if (M.libre && M.libre.bandeja) M.libre.bandeja(); };
  async function subirYa({ c, destino, fallan = 0 }) {
    if (enMarcha) { I().toast('Ya hay una subida en marcha.'); return null; }
    const sb = await I().empezarSubida();
    if (!sb) { I().toast('Ahora no se puede subir: abre un mes o espera a que termine lo que está en marcha.'); return null; }
    const yo = enMarcha = { cancelar: false }, ids = new Map(), creadas = [], { fotos } = c;
    const r = { total: fotos.length, subidas: 0, yaEstaban: 0, danadas: 0, bytes: 0, parada: null, saltados: textoSaltados(c, fallan), carpetas: 0 };
    try {
      for (const k of carpetasDe(fotos)) {     // all of them first: a sister with the same name is the same folder (D-069)
        const p = k.split('\u0000'), padre = p.length > 1 ? ids.get(p.slice(0, -1).join('\u0000')) : destino || null;
        const h = M.crearCarpeta(p[p.length - 1], padre);
        if (h.error) throw new Error(h.error);
        ids.set(k, h.id); if (!h.ya) creadas.push(h.id);
      }
      r.carpetas = creadas.length;
      await M.flush();
      let t = 0;
      for (let i = 0; i < fotos.length; i++) {
        if (yo.cancelar) { r.parada = 'cancelada'; break; }
        if (!(i % 20) && margen() > 0) {
          const e = await M.espacio();
          if (e.cupo != null && e.cupo - (e.usado || 0) < margen()) { r.parada = 'espacio'; break; }
        }
        const x = fotos[i], cid = x.path.length ? ids.get(x.path.join('\u0000')) : destino || null;
        barra(`Subiendo ${num(i + 1)} de ${num(fotos.length)} · ${x.file.name}`, i / fotos.length);
        try {
          const h = await I().entrarFoto(sb, cid, x.file, x.type);
          if (h.nuevo) { r.subidas++; r.bytes += h.bytes; } else r.yaEstaban++;
        } catch (e) {
          if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)))) { r.parada = 'espacio'; break; }
          if (e && e.name === 'MesaLocked') { r.parada = 'pestaña'; break; }
          r.danadas++;
        }
        if (Date.now() - t > 1500) { t = Date.now(); pintar(); }
      }
    } catch (e) { r.parada = 'error'; r.error = String((e && e.message) || e); }
    enMarcha = null;
    barra(null);
    await I().acabarSubida(sb, creadas);
    pintar();
    informar(r);
    return r;
  }
  function informar(r) {
    const pes = I().pesoTxt, esc = I().esc;
    const hechas = [r.subidas ? `${num(r.subidas)} ${r.subidas === 1 ? 'foto subida' : 'fotos subidas'} (${pes(r.bytes)})` : '', r.yaEstaban ? `${num(r.yaEstaban)} ya ${r.yaEstaban === 1 ? 'estaba' : 'estaban'}` : '', r.danadas ? `${num(r.danadas)} no se ${r.danadas === 1 ? 'pudo leer' : 'pudieron leer'}` : '', r.saltados].filter(Boolean).join(' · ') || 'Nada subido';
    if (r.parada === 'espacio' || r.parada === 'error' || r.parada === 'pestaña') {
      const por = r.parada === 'espacio' ? `No queda espacio: la subida se ha parado para dejar ${pes(margen())} libres.` : r.parada === 'pestaña' ? 'La Mesa se ha abierto en otra pestaña.' : `Ha fallado: ${r.error}.`;
      I().showDialog('subidaparada', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Subida parada</h3><p>${esc(por)}</p><p>${esc(hechas)}, de ${num(r.total)}.</p><p>Lo subido se queda en su carpeta. Para seguir, vuelve a subir la misma carpeta: lo que ya está no se repite.</p><div class="form"><div class="row"><button type="button" class="btn" data-act="close">Entendido</button></div></div>`);
      return;
    }
    I().toast(`${r.parada === 'cancelada' ? 'Subida cancelada: ' : ''}${hechas}.`, { ms: 10000 });
  }

  // ---------- the ways in ----------
  // subir: items [{path, file}], into destino (a folder's id or null). sinAviso: straight away, and it gives what happened.
  function subir(items, destino = null, o = {}) {
    if (o.sinAviso) return subirYa({ c: clasificar(items), destino, fallan: o.fallan || 0 });
    return preparar(items, destino, o.fallan || 0);
  }
  async function desdeEntradas(entradas, destino = null, o = {}) {
    if (enMarcha) { I().toast('Ya hay una subida en marcha.'); return null; }
    barra('Leyendo la carpeta…', null);
    const out = { items: [], fallan: 0 }, av = { n: 0 };
    for (const en of entradas) await recorrer(en, [], out, av);
    barra(null);
    return subir(out.items, destino, { ...o, fallan: out.fallan });
  }
  // photos without a folder: a few go in as always; many, with the warning
  function elegidas(files, destino = null) {
    if (files.length < AVISO_DESDE) return M.addFiles(files, null, destino ? { carpeta: destino } : undefined);
    return subir(files.map(file => ({ path: [], file })), destino);
  }
  // from a drop: entries must be asked for before anything is awaited
  function soltar(dt, destino = null) {
    const en = [...(dt.items || [])].filter(i => i.kind === 'file').map(i => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
    if (en.some(x => x.isDirectory)) return desdeEntradas(en, destino);
    return elegidas([...(dt.files || [])], destino);
  }
  function elegirCarpeta(destino) {            // needs the click: nothing is awaited before it
    const i = document.createElement('input');
    i.type = 'file'; i.hidden = true; i.multiple = true; i.webkitdirectory = true;
    i.addEventListener('change', () => {
      const items = [...i.files].map(file => ({ path: (file.webkitRelativePath || '').split('/').slice(0, -1).filter(Boolean), file }));
      i.remove();
      const buenas = items.filter(x => !x.path.some(p => SISTEMA.test(p)));   // a system folder, as when it is dragged
      if (buenas.length) subir(buenas, destino);
    });
    i.addEventListener('cancel', () => i.remove());
    document.body.append(i);
    i.click();
  }
  function pedirNombre() {
    const padre = I().trayCarpeta, esc = I().esc, dentro = padre && (I().S.carpetas.find(x => x.id === padre) || {}).name;
    I().showDialog('nuevacarpeta', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Nueva carpeta</h3><p>${dentro ? `Dentro de «${esc(dentro)}».` : 'En la bandeja de este cliente.'}</p>`
      + '<form class="form" data-form="cp-nueva" autocomplete="off"><label for="cp-nombre">Nombre</label><input id="cp-nombre" name="nombre" type="text" maxlength="80" required><div class="row"><button type="button" class="btn2" data-act="close">Cancelar</button><button type="submit" class="btn">Crear</button></div></form>');
    const form = I().root().querySelector('.detail form[data-form="cp-nueva"]');
    form.addEventListener('submit', e => {
      e.preventDefault(); e.stopPropagation();
      const r = M.crearCarpeta(form.nombre.value, padre);
      I().closeDetail();
      if (r.error) I().toast(r.error); else if (r.ya) I().toast('Ya hay una carpeta con ese nombre aquí.');
    });
  }
  function accion(act) {
    if (act === 'cp-nueva') pedirNombre();
    else if (act === 'cp-subir') elegirCarpeta(I().trayCarpeta);
    else if (act === 'cp-ir') { const p = pendiente; pendiente = null; I().closeDetail(); if (p) subirYa(p); }
    else if (act === 'cp-cancelar') { if (enMarcha) enMarcha.cancelar = true; }
  }

  // ---------- the right-click menu of a folder, in the mesa's tray and in the editor's (D-076) ----------
  let menuAbierto = null;
  function cerrarMenu() {
    if (!menuAbierto) return;
    const m = menuAbierto; menuAbierto = null;
    m.el.remove();
    document.removeEventListener('pointerdown', m.fuera, true); document.removeEventListener('keydown', m.tecla, true);
    window.removeEventListener('blur', cerrarMenu); window.removeEventListener('resize', cerrarMenu); document.removeEventListener('scroll', cerrarMenu, true);
  }
  // what ⌘C takes from this click: the chosen, if the one clicked is among them; if not, only that one
  function loteDe(t) {
    const en = M.libre && M.libre.abierto() && M.libre.trayLote ? M.libre.trayLote() : I().trayLote();
    if (t.id) return en.carpetas.includes(t.id) ? en : { files: [], carpetas: [t.id] };
    if (t.file) return en.files.includes(t.file) ? en : { files: [t.file], carpetas: [] };
    return en;
  }
  function abrirMenu(x, y, id, t = { id }) {
    cerrarMenu();
    const root = I().root(), c = id && I().S && I().S.carpetas.find(q => q.id === id); if (id && !c) return;
    const it = (a, t, on = true, kb = '', tip = '') => `<button type="button" role="menuitem" data-a="${a}"${on ? '' : ' disabled'}${tip ? ` title="${I().esc(tip)}"` : ''}>${t}${kb ? `<span class="kb">${kb}</span>` : ''}</button>`;
    const el = document.createElement('div'); el.className = 'cpmenu'; el.setAttribute('role', 'menu');
    const copiable = !!(t.id || t.file), pegable = I().trayPuedePegar();
    el.innerHTML = c ? it('abrir', 'Abrir') + it('pestana', 'Abrir en una pestaña nueva') + '<hr>'
      + it('copiar', 'Copiar', true, '⌘C') + it('pegar', 'Pegar', pegable, '⌘V') + '<hr>'
      + it('borrar', 'Borrar carpeta…', !c.fija, '', c.fija ? `«${c.name}» no se puede borrar: sus fotos se quitan una a una` : '')
      : (copiable ? it('copiar', 'Copiar', true, '⌘C') : '') + it('pegar', 'Pegar', pegable, '⌘V');
    el.addEventListener('click', e => {
      const b = e.target.closest('button[data-a]'); if (!b || b.disabled) return;
      cerrarMenu();
      if (b.dataset.a === 'abrir') I().trayAbrir(id);
      else if (b.dataset.a === 'pestana') I().pestNueva(id);
      else if (b.dataset.a === 'borrar') M.pedirBorrarCarpeta(id);
      else if (b.dataset.a === 'copiar') I().trayCopiar(loteDe(t));
      else if (b.dataset.a === 'pegar') { I().trayPegar(id || I().trayCarpeta); if (M.libre && M.libre.bandeja) M.libre.bandeja(); }
    });
    root.append(el);
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
    const m = menuAbierto = { el, fuera: e => { if (!el.contains(e.target)) cerrarMenu(); }, tecla: e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarMenu(); } } };
    document.addEventListener('pointerdown', m.fuera, true); document.addEventListener('keydown', m.tecla, true);
    window.addEventListener('blur', cerrarMenu); window.addEventListener('resize', cerrarMenu); document.addEventListener('scroll', cerrarMenu, true);
    const b0 = el.querySelector('button'); if (b0) b0.focus();
  }
  document.addEventListener('contextmenu', e => {
    if (!I() || !I().root || !e.target.closest) return;
    const t = e.target.closest('.tcarpeta[data-id], .lb-tcarp[data-id]'), ph = !t && e.target.closest('.tray .titem[data-file], .lb-tray .lb-tph[data-f]'), hueco = !t && !ph && e.target.closest('.tray .tbody, .lb-tray');
    if (!t && !ph && !(hueco && I().trayPuedePegar())) return;   // elsewhere, and with nothing to paste on an empty spot: the browser's own
    e.preventDefault(); e.stopImmediatePropagation();
    if (t) abrirMenu(e.clientX, e.clientY, t.dataset.id);
    else abrirMenu(e.clientX, e.clientY, null, ph ? { file: ph.dataset.file || ph.dataset.f } : {});
  }, true);

  M.carpetasUI = { version: VERSION, accion, soltar, elegidas, subir, desdeEntradas, clasificar, abrirMenu, cerrarMenu };
})();
