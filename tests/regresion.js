// Batería de regresión de la Mesa: una prueba por fallo ya corregido (ver CLAUDE.md, «Probar»).
// Abre ../index.html en un iframe del mismo origen y lo maneja con window.MESA (MESA._test, MESA._in) y el estado del
// editor (MESA.libre._ed()). Tablero sintético de un cliente de prueba, fotos hechas con canvas; al final lo borra todo.
// Solo corre en 127.0.0.1 / localhost: en otro sitio (la web publicada) iría sobre los datos reales de ese navegador.
// ?solo=M3,E2 pasa solo esas pruebas; ?auto la lanza al cargar. window.RESULTADO guarda el último resultado.
(() => {
  'use strict';
  const LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'];
  if (!LOCAL.includes(location.hostname)) {
    document.querySelector('main').innerHTML = '<p class="no"><b>Esta batería solo corre en 127.0.0.1 o localhost</b>, sobre una copia de la mesa. '
      + 'Aquí trabajaría con los datos reales de este navegador. Ver CLAUDE.md, «Probar».</p>';
    return;
  }

  const CLIENTE = 'prueba-regresion', NOMBRE = 'Cliente de prueba', MES = '2026-11';
  const $ = id => document.getElementById(id);
  const T = [];                                    // {id, titulo, fn}
  const prueba = (id, titulo, fn) => T.push({ id, titulo, fn });
  let W, D, M;                                     // la ventana del iframe, su documento y su MESA

  // ---------- utilidades ----------
  const espera = ms => new Promise(r => setTimeout(r, ms));
  async function hasta(fn, ms = 6000, que = 'la condición') {
    const t0 = Date.now();
    for (;;) {
      let v; try { v = await fn(); } catch (e) { v = null; }
      if (v) return v;
      if (Date.now() - t0 > ms) throw new Error(`no se cumplió ${que} en ${ms} ms`);
      await espera(50);
    }
  }
  function ok(c, msg) { if (!c) throw new Error(msg); }
  const json = v => JSON.stringify(v);
  function igual(a, b, msg) { if (json(a) !== json(b)) throw new Error(`${msg}\n  esperado: ${json(b)}\n  obtenido: ${json(a)}`); }
  function cerca(a, b, tol, msg) { if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg}: ${a} frente a ${b} (tolerancia ${tol})`); }
  const q = s => D.querySelector(s), qa = s => [...D.querySelectorAll(s)];
  const slot = id => M.board().slots.find(s => s.id === id);
  const celda = id => q(`.cell[data-slot="${id}"]`);

  // fotos sintéticas: un color, una cuadrícula y su nombre; la misma foto (nombre) siempre da los mismos bytes
  const FOTOS = {};
  async function foto(nombre, w = 1200, h = 1500, color = '#4a7a9c') {
    if (!FOTOS[nombre]) {
      const c = D.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.fillStyle = color; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w / 4, h / 4);                 // una esquina marcada: se ve si se voltea o recorta
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = Math.max(2, w / 300);
      for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo(w * i / 10, 0); x.lineTo(w * i / 10, h); x.moveTo(0, h * i / 10); x.lineTo(w, h * i / 10); x.stroke(); }
      x.fillStyle = '#ffffff'; x.font = `bold ${Math.round(w / 12)}px sans-serif`; x.textAlign = 'center'; x.fillText(nombre, w / 2, h / 2);
      FOTOS[nombre] = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    }
    return new W.File([FOTOS[nombre]], nombre, { type: 'image/jpeg', lastModified: 1767225600000 });
  }

  // publicaciones de prueba: {id:'r1', name:'Foto 1.1', type, date} en noviembre de 2026
  const TIPO_NOMBRE = { Foto: 'Foto', Carrusel: 'Carrusel', Reel: 'Reel' };
  function pub(n, tipo = 'Foto', dia = n + 2, mes = MES) {
    const d = String(dia).padStart(2, '0');
    return { id: `r${n}${mes === MES ? '' : '-' + mes}`, name: `${TIPO_NOMBRE[tipo]} 1.${n}`, type: tipo, date: `${mes}-${d}T12:00:00.000+01:00` };
  }

  async function limpiar() {
    if (M.libre && M.libre.abierto()) M.libre.cerrar();
    await M.flush();                               // el guardado va con retraso: purge borra las fotos que nombra el tablero guardado
    for (const b of await M.boards()) if (b.client === CLIENTE) await M.purge(b.key);
  }
  // un tablero nuevo del cliente de prueba (borra antes los suyos)
  async function tablero(slots, { mes = MES } = {}) {
    await limpiar();
    const r = await M.init({ client: CLIENTE, clientName: NOMBRE, month: mes, slots, past: [], force: true });
    ok(r && r.key === `${CLIENTE}-${mes}`, 'no se abrió el tablero de prueba: ' + json(r));
    return r;
  }
  // fotos a la bandeja y de ahí a una publicación (sin avisos: es la primera vez que se usan)
  async function poner(slotId, files) {
    const ids = await M.addFiles(files);
    ok(ids.length === files.length, `no entraron las fotos: ${json(ids)}`);
    for (const id of ids) M._test.place(slotId, id);
    return ids;
  }
  const dialogo = () => q('.detail:not([hidden])');
  async function pulsar(sel, ms = 4000) { const b = await hasta(() => q(sel), ms, `el botón ${sel}`); b.click(); await espera(30); return b; }

  // ---------- editor ----------
  const ed = () => M.libre._ed();
  async function abrirEditor(slotId, i = 0) {
    const r = await M.libre.abrir(slotId, i);
    ok(r && r.ok, 'no se abrió el editor: ' + json(r));
    await hasta(() => ed() && ed().el && ed().el.isConnected, 4000, 'el editor abierto');
    return ed();
  }
  // pulsa una acción del editor como sus botones (data-lb), aunque ese botón no esté a la vista ahora
  function accion(lb, data = {}) {
    const E = ed(); ok(E, 'el editor no está abierto');
    const b = D.createElement('button'); b.type = 'button'; b.hidden = true; b.dataset.lb = lb;
    Object.entries(data).forEach(([k, v]) => { b.dataset[k] = v; });
    E.el.append(b); b.click(); b.remove();
  }
  function tecla(key, o = {}) {
    const e = new W.KeyboardEvent('keydown', { key, code: o.code ?? '', metaKey: !!o.meta, altKey: !!o.alt, shiftKey: !!o.shift, ctrlKey: !!o.ctrl, bubbles: true, cancelable: true });
    (o.en || D.body).dispatchEvent(e);
  }
  const compDe = i => { const x = ed().sl[i]; return x.comp || x.raw; };
  const elegir = el => { ed().sel = el.id; ed().mas = []; };
  // tamaño de la diapositiva abierta en px de salida (1440 de ancho), por su formato; no se usa E.sz, que es el del último
  // dibujo y no cambia con la pestaña en segundo plano
  const tam = () => { const E = ed(), x = compDe(E.i), p = x.els.find(e => e.t === 'foto' && M.files[e.src]), d = p ? M.files[p.src] : { w: 4, h: 5 }; return { W: 1440, H: Math.round(1440 / M._in.fmtRatio(E.fmt || 'v45', d.w, d.h)) }; };
  // un hueco de foto (elemento 'hueco', libre ≥ 1.9) en x, y, w, h (fracciones de la diapositiva)
  const huecoEl = (id, x, y, w, h) => ({ id, t: 'hueco', x, y, w, h, rot: 0, op: 1, lock: false, sh: 0, color: '#d9d5cd', b: 0, bc: null, r: 0, textos: [] });
  // una foto puesta en un hueco como desde la bandeja del editor (pickf), en la diapositiva abierta
  async function enHueco(i, huecoId, f) {
    ok(ed().i === i, `la diapositiva abierta es la ${ed().i + 1}, no la ${i + 1}`);
    ed().pick = { modo: 'rep', id: huecoId };
    accion('pickf', { f });
    return hasta(() => compDe(i).els.find(e => e.t === 'foto' && e.src === f), 4000, 'la foto en el hueco');
  }
  async function aplicarEditor() {
    accion('aplicar');
    await hasta(() => !M.libre.abierto() && !M.libre.aplicando(), 15000, 'que el editor aplique y se cierre');
    await espera(100);
  }

  // =====================================================================================================
  // Mesa
  // =====================================================================================================

  prueba('M1', 'Exportar: en la app Claude, descarga normal con contenido y nombre mesa-de-trabajo-AAAA-MM-DD-HHMM.json; si el diálogo no deja escribir, aviso sin archivo vacío ni segundo diálogo (3.29, T1)', async () => {
    await tablero([pub(1)]);
    await poner('r1', [await foto('m1.jpg')]);
    // el navegador simulado: su user-agent, un diálogo de guardar espía y las descargas interceptadas; todo se restaura
    const LS = 'mesa-export-descarga', antes = W.localStorage.getItem(LS), nav = W.navigator;
    const tenia = Object.prototype.hasOwnProperty.call(W, 'showSaveFilePicker'), picker0 = W.showSaveFilePicker;
    const A = W.HTMLAnchorElement.prototype, click = A.click;
    let ua = '', dialogos = 0, borrado = 0, cap = null;
    Object.defineProperty(nav, 'userAgent', { get: () => ua, configurable: true });
    W.showSaveFilePicker = async () => {           // otro navegador: el diálogo crea el archivo vacío y luego no deja escribir
      dialogos++;
      return { name: 'mesa.json', getFile: async () => ({ size: 0 }), remove: async () => { borrado++; },
        createWritable: async () => { throw new W.DOMException('sin permiso', 'NotAllowedError'); } };
    };
    A.click = function () { if (this.download) cap = { name: this.download, href: this.href }; else click.call(this); };
    try {
      W.localStorage.removeItem(LS);
      ua = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/152.0 Safari/537.36 Claude/1.0';
      const r = await M.exportAll();
      ok(dialogos === 0, 'en la app Claude se abrió el diálogo de guardar');
      ok(r && r.ok && r.via === 'descarga' && cap, 'en la app Claude no hizo una descarga normal: ' + json(r));
      ok(/^mesa-de-trabajo-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(cap.name), 'nombre de archivo: ' + cap.name);
      const blob = await (await W.fetch(cap.href)).blob();
      ok(blob.size > 1000, `archivo vacío o casi (${blob.size} bytes)`);
      const d = JSON.parse(await blob.text());
      ok(d.format === 'mesa-feed' && d.boards.some(b => b.key === `${CLIENTE}-${MES}`), 'el archivo no trae el tablero de prueba');
      ok(Object.keys(d.files).length >= 1, 'el archivo no trae la foto');
      ua = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/152.0 Safari/537.36'; cap = null;
      const r2 = await M.exportAll();
      ok(r2 && r2.error && r2.name === 'NotAllowedError', 'sin permiso para escribir no avisó con el motivo: ' + json(r2));
      ok(dialogos === 1 && !cap, `diálogos: ${dialogos}, descarga: ${!!cap} (tenía que ser un diálogo y ninguna descarga)`);
      ok(borrado === 1, 'no borró el archivo vacío que creó el diálogo');
      ok(W.localStorage.getItem(LS) === '1', 'no recordó que en este navegador hay que descargar');
      const r3 = await M.exportAll();
      ok(r3 && r3.via === 'descarga' && dialogos === 1, 'la exportación siguiente volvió a abrir el diálogo: ' + json(r3));
    } finally {
      delete nav.userAgent; A.click = click;
      if (tenia) W.showSaveFilePicker = picker0; else delete W.showSaveFilePicker;
      if (antes == null) W.localStorage.removeItem(LS); else W.localStorage.setItem(LS, antes);
    }
  });

  prueba('M2', 'Exportar, borrar e importar devuelve el tablero igual: fotos, Contexto, Nota, captions y huecos (D-017)', async () => {
    await tablero([pub(1), pub(2, 'Carrusel')]);
    await poner('r1', [await foto('m2a.jpg')]);
    await poner('r2', [await foto('m2b.jpg'), await foto('m2c.jpg', 1600, 1000)]);
    M._test.setNote('r1', 'Contexto de prueba');
    M._test.setMemo('r1', 'Nota privada');
    M.loadCaptions([{ slotId: 'r1', options: [{ tone: 'Cercano', text: 'Uno' }, { tone: 'Directo', text: 'Dos' }, { tone: 'Poético', text: 'Tres' }] }]);
    await pulsar('[data-act="addfiller"]');
    await M.flush();
    const corte = b => ({ fillers: b.fillers, tray: b.tray, slots: b.slots.map(s => ({ id: s.id, name: s.name, type: s.type, photos: s.photos, note: s.note, memo: s.memo, caption: s.caption && { orig: s.caption.orig, tones: s.caption.tones } })) });
    const antes = corte(M.board());
    const blob = await M.exportAll({ returnBlob: true });
    ok(blob && blob.size > 1000, 'la exportación salió vacía');
    await M.purge(`${CLIENTE}-${MES}`);
    ok(!(await M.boards()).some(b => b.key === `${CLIENTE}-${MES}`), 'el tablero no se borró');
    const r = await M.importData(blob, { confirm: false });
    ok(r && !r.error, 'importar falló: ' + json(r));
    await M.open(`${CLIENTE}-${MES}`);
    igual(corte(M.board()), antes, 'el tablero importado no es igual al exportado');
    for (const id of antes.slots.flatMap(s => s.photos)) ok(await M._test.fileRec(id), 'falta la foto ' + id);
  });

  prueba('M3', 'Reordenar las fotos de un carrusel no deja los captions desactualizados (M4)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('m3a.jpg'), await foto('m3b.jpg'), await foto('m3c.jpg')]);
    M._test.setNote('r1', 'Contexto');
    M.loadCaptions([{ slotId: 'r1', options: [{ tone: 'a', text: '1' }, { tone: 'b', text: '2' }, { tone: 'c', text: '3' }] }]);
    await M.flush();
    await M.open(`${CLIENTE}-${MES}`);               // como en el uso real: en la misma sesión la base de los captions es la misma lista que las fotos
    const fotos = slot('r1').photos;
    M._test.movePhoto('r1', 0, 2);
    igual([...slot('r1').photos].sort(), [...fotos].sort(), 'mover cambió qué fotos lleva');
    ok(json(slot('r1').photos) !== json(fotos), 'el orden no cambió');
    const c = M.captions('r1')[0];
    ok(!c.outdated, 'los captions salen desactualizados tras reordenar: ' + json(c.outdatedBy));
    M._test.unassign('r1', 2);                     // control: quitar una foto sí los desactualiza
    ok(M.captions('r1')[0].outdated, 'quitar una foto no los marca desactualizados (la prueba no distingue)');
  });

  prueba('M4', 'Un caption subido sin fotos ni Contexto subidos no pone «✓ en Notion» (M4)', async () => {
    await tablero([pub(1), pub(2)]);
    await poner('r1', [await foto('m4a.jpg')]);      // foto y Contexto puestos, pero sin subir
    M._test.setNote('r1', 'Contexto');
    M.loadCaptions([{ slotId: 'r1', options: [{ tone: 'a', text: '1' }, { tone: 'b', text: '2' }, { tone: 'c', text: '3' }] }]);
    M._test.setSlot('r1', { caption: { ...slot('r1').caption, pick: 0 } });
    const r = M.markCaptionsUploaded(['r1']);
    ok(r[0].result === 'subido', 'no se marcó subido: ' + json(r));
    await espera(50);
    ok(!celda('r1').querySelector('.st.ok'), 'la casilla dice «✓ en Notion» solo con el caption');
    const p = M.plan().find(x => x.slotId === 'r1');
    ok(p && p.status === 'nueva', 'plan() no la da como nueva: ' + json(p));
    // control: con su foto y su Contexto subidos sí sale
    const [f] = await poner('r2', [await foto('m4.jpg')]);
    M._test.setNote('r2', 'Contexto');
    M.markUploaded([{ slotId: 'r2', fileIds: [f] }]);
    await espera(50);
    ok(celda('r2').querySelector('.st.ok'), 'una publicación subida de verdad no dice «✓ en Notion» (la prueba no distingue)');
  });

  prueba('M5', 'loadCaptions rechaza un tono o un texto que no sean texto (M5)', async () => {
    await tablero([pub(1), pub(2), pub(3)]);
    const r = M.loadCaptions([
      { slotId: 'r1', options: [{ tone: 5, text: 'a' }, { tone: 'b', text: 'b' }, { tone: 'c', text: 'c' }] },
      { slotId: 'r2', options: [{ tone: 'a', text: { t: 1 } }, { tone: 'b', text: 'b' }, { tone: 'c', text: 'c' }] },
      { slotId: 'r3', options: [{ tone: 'a', text: 'a' }, { tone: 'b', text: 'b' }, { tone: 'c', text: 'c' }] }
    ]);
    igual(r.map(x => x.result), ['error', 'error', 'cargado'], 'resultado de loadCaptions');
    ok(!slot('r1').caption && !slot('r2').caption, 'se guardó un caption no válido');
  });

  prueba('M6', 'Reabrir el tablero conserva un tipo cambiado en la mesa y pendiente para Notion (3.26)', async () => {
    await tablero([pub(1)]);
    M._test.setType('r1', 'Carrusel');
    ok(slot('r1').type === 'Carrusel', 'setType no cambió el tipo');
    await M.flush();
    await M.open(`${CLIENTE}-${MES}`);
    const s = slot('r1');
    ok(s.type === 'Carrusel', 'al reabrir el tipo vuelve a ' + s.type);
    const n = M.notionChanges().find(x => x.slotId === 'r1');
    ok(n && n.typeChanged && n.notionType === 'Foto' && n.type === 'Carrusel', 'notionChanges no lo da como cambio de tipo: ' + json(n));
  });

  // la copia salía de un arrastre nativo de la imagen de la miniatura: el arreglo es que la imagen no recibe el puntero
  // (el arrastre real, en la comprobación manual)
  prueba('M7', 'Las miniaturas de la tira de la publicación no se arrastran como imagen, que añadía una copia de la foto (3.26)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('m7a.jpg'), await foto('m7b.jpg'), await foto('m7c.jpg')]);
    M._in.openDetail('r1', 0);
    const imgs = await hasta(() => { const l = qa('.detail .strip img, .detail .thumbs img, .detail .th img'); return l.length === 3 && l; }, 3000, 'las 3 miniaturas de la tira');
    ok(imgs.every(i => W.getComputedStyle(i).pointerEvents === 'none'), 'una miniatura de la tira se puede arrastrar como imagen (pointer-events)');
    M._in.closeDetail();
  });

  prueba('M8', 'En la cuadrícula una Foto con varias páginas se llama «Foto», no «Carrusel» (3.27)', async () => {
    await tablero([pub(1), pub(2, 'Carrusel')]);
    await poner('r1', [await foto('m8a.jpg'), await foto('m8b.jpg')]);
    await poner('r2', [await foto('m8c.jpg'), await foto('m8d.jpg')]);
    ok(slot('r1').photos.length === 2, 'la Foto no se quedó con sus 2 páginas');
    const t1 = celda('r1').textContent, t2 = celda('r2').textContent;
    ok(/Foto 1\.1/.test(t1) && !/Carrusel/.test(t1), 'la Foto de 2 páginas dice: ' + t1);
    ok(/Carrusel 1\.2/.test(t2), 'el carrusel no dice «Carrusel» (la prueba no distingue): ' + t2);
  });

  prueba('M9', '«+ Hueco»: como mucho 2, detrás de las fijadas, y siguen al reabrir (D-002)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4)]);
    for (let i = 0; i < 3; i++) await pulsar('[data-act="addfiller"]');
    ok(M.status().fillers === 2, 'huecos: ' + M.status().fillers);
    const S = M._in.S; S.pins = ['r1']; M._in.save(); M._in.renderFeed();
    const orden = () => qa('.feed .cell, .grid .cell').filter(c => !c.closest('.past, .prevm')).slice(0, 4).map(c => c.classList.contains('filler') ? 'hueco' : c.dataset.slot);
    igual(orden().slice(0, 3), ['r1', 'hueco', 'hueco'], 'orden de arriba del grid');
    await M.flush();
    await M.open(`${CLIENTE}-${MES}`);
    ok(M.status().fillers === 2, 'al reabrir quedan ' + M.status().fillers + ' huecos');
    igual(orden().slice(0, 3), ['r1', 'hueco', 'hueco'], 'orden de arriba del grid al reabrir');
    q('.cell.filler .hx').click(); await espera(30);
    ok(M.status().fillers === 1, 'quitar un hueco no lo quitó');
  });

  prueba('M10', 'La cuadrícula no muestra puntos de estado (D-004)', async () => {
    await tablero([pub(1), pub(2), pub(3)]);
    await poner('r1', [await foto('m10.jpg')]);
    M._test.setNote('r1', 'Contexto');
    M.loadCaptions([{ slotId: 'r1', options: [{ tone: 'a', text: '1' }, { tone: 'b', text: '2' }, { tone: 'c', text: '3' }] }]);
    M.setEstado('r2', 'cancelado'); M.setEstado('r3', 'programado');
    await espera(50);
    const conEstado = qa('.cell [class]').filter(e => [...e.classList].some(c => /^e-/.test(c)));
    ok(!conEstado.length, 'hay puntos de estado en la cuadrícula: ' + conEstado.map(e => e.className).join(', '));
    M._in.openDetail('r1', 0);                     // control: la ventana de la publicación sí lo muestra
    await hasta(() => qa('.detail [class]').some(e => [...e.classList].some(c => /^e-/.test(c))), 3000, 'el estado en la ventana de la publicación');
    M._in.closeDetail();
  });

  prueba('M11', 'Una foto ya usada avisa y pregunta en vez de bloquearse; la bandeja no la duplica (D-022)', async () => {
    await tablero([pub(1), pub(2), pub(3)]);
    await poner('r1', [await foto('m11.jpg')]);
    // «Usar igualmente»: entra
    const p = M.addFiles([await foto('m11.jpg')], 'r2');
    const h = await hasta(() => { const d = dialogo(); return d && d.querySelector('[data-act="repe"][data-m="usar"]') && d; }, 4000, 'el aviso de foto ya usada');
    ok(/este mes/i.test(h.textContent), 'el aviso no dice su uso más cercano: ' + h.querySelector('h3').textContent);
    h.querySelector('[data-act="repe"][data-m="usar"]').click();
    await p;
    ok(slot('r2').photos.length === 1 && M.files[slot('r2').photos[0]].name === 'm11.jpg', 'con «Usar igualmente» la foto no entró');
    // «Cancelar»: no entra
    const p2 = M.addFiles([await foto('m11.jpg')], 'r3');
    const h2 = await hasta(() => { const d = dialogo(); return d && d.querySelector('[data-act="repe"]') && d; }, 4000, 'el segundo aviso');
    h2.querySelector('.btn2[data-act="close"], [data-act="close"]').click();
    await p2;
    ok(!slot('r3').photos.length, 'con «Cancelar» la foto entró igual');
    // bandeja: una foto que ya está en ella sin usar no se duplica ni avisa
    const n0 = M.status().tray;
    await M.addFiles([await foto('m11b.jpg')]);
    await M.addFiles([await foto('m11b.jpg')]);
    ok(!dialogo() || !dialogo().querySelector('[data-act="repe"]'), 'importar a la bandeja avisó');
    ok(M.status().tray === n0 + 1, `la bandeja tiene ${M.status().tray - n0} copias de la foto`);
  });

  // =====================================================================================================
  // Editor de diapositivas (libre.js)
  // =====================================================================================================

  prueba('E1', 'Editor: un carrusel vacío abre sin diapositivas, y abrir y salir sin cambios no deja paso en el ⌘Z de la mesa (libre 1.1)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel')]);
    await poner('r2', [await foto('e1a.jpg'), await foto('e1b.jpg')]);
    const h0 = M._test.hist(), f0 = slot('r2').photos;
    const E = await abrirEditor('r1');
    ok(E.sl.length === 0, `el carrusel vacío abre con ${E.sl.length} diapositivas`);
    M.libre.cerrar();
    await abrirEditor('r2');
    M.libre.cerrar();
    await espera(50);
    igual(M._test.hist(), h0, 'historial de la mesa');
    igual(slot('r2').photos, f0, 'fotos del carrusel');
    ok(!slot('r2').libre, 'abrir y salir dejó una composición');
  });

  prueba('E2', 'Editor: aplicar es un solo paso del ⌘Z de la mesa, que lo deshace entero, y sus imágenes no van a la bandeja', async () => {
    await tablero([pub(1, 'Carrusel')]);
    const ids = await poner('r1', [await foto('e2a.jpg'), await foto('e2b.jpg')]);
    const u0 = M._test.hist().undo;
    await abrirEditor('r1');
    accion('add-txt');
    accion('sl', { i: '1' }); accion('add-forma', { v: 'rect' });
    await aplicarEditor();
    const s = slot('r1'), hecha = f => !!(M.files[f] && M.files[f].design);
    ok(M._test.hist().undo === u0 + 1, `aplicar dejó ${M._test.hist().undo - u0} pasos en el ⌘Z de la mesa`);
    ok(s.photos.length === 2 && s.photos.every(hecha), 'las diapositivas no son las imágenes del editor');
    ok(s.libre && Object.keys(s.libre.slides).length === 2, 'faltan composiciones');
    ok(!M.board().tray.some(hecha), 'una imagen del editor está en la bandeja');
    M._test.undo();
    await espera(50);
    igual(slot('r1').photos, ids, '⌘Z no devolvió las fotos de antes');
    ok(!slot('r1').libre || !Object.keys(slot('r1').libre.slides || {}).length, '⌘Z dejó composiciones');
    ok(!M.board().tray.some(hecha), 'tras ⌘Z hay una imagen del editor en la bandeja');
  });

  prueba('E3', '«Llenar» lleva el marco a toda la diapositiva sin perder el encuadre: mismo centro y misma zona (3.27)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    const [f] = await poner('r1', [await foto('e3.jpg', 1600, 1000)]);
    M._test.setSlot('r1', { fmt: 'v45' });           // con su primera foto apaisada el carrusel sería Horizontal
    await abrirEditor('r1');
    elegir(compDe(0).els[0]);
    accion('encajar');                               // el marco se ajusta a la foto entera: ya no llena la diapositiva
    const el = () => compDe(0).els.find(e => e.src === f);
    const a = el();
    ok(a.w * a.h < 0.99, 'Encajar no achicó el marco');
    Object.assign(a, { cx: 0.42, cy: 0.55, z: 1.6 }); // un encuadre propio dentro del marco
    const { W: SW, H: SH } = tam(), d = M.files[f];
    const zona = e => M._in.rectFor(d.w, d.h, (e.w * SW) / (e.h * SH), { cx: e.cx, cy: e.cy, z: e.z });
    const z0 = zona(a);
    accion('llenar');
    const b = el(), z1 = zona(b);
    igual([b.x, b.y, b.w, b.h], [0, 0, 1, 1], 'Llenar no llevó el marco a toda la diapositiva');
    cerca(z1.x + z1.w / 2, z0.x + z0.w / 2, d.w * 0.005, 'el centro (x) del encuadre se movió');
    cerca(z1.y + z1.h / 2, z0.y + z0.h / 2, d.h * 0.005, 'el centro (y) del encuadre se movió');
    cerca(z1.w * z1.h, z0.w * z0.h, z0.w * z0.h * 0.02, 'la zona de la foto cambió de tamaño');
  });

  prueba('E4', '«Sustituir» en la portada de un carrusel del editor cambia solo la foto y conserva textos, capas y velo (3.29)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('e4a.jpg'), await foto('e4b.jpg')]);
    await abrirEditor('r1');
    accion('add-txt'); accion('add-forma', { v: 'elipse' }); accion('velo', { v: 'plano' });
    await aplicarEditor();
    const s0 = slot('r1'), c0 = s0.libre.slides[s0.photos[0]];
    ok(c0 && c0.velo && c0.els.length === 3, 'la portada no quedó compuesta: ' + json(c0 && c0.els.map(e => e.t)));
    const [nueva] = await M.addFiles([await foto('e4c.jpg')]);
    M._test.setSel(nueva);
    celda('r1').click();
    await pulsar('[data-act="addmode"][data-m="replace"]');
    const c1 = await hasta(() => { const s = slot('r1'), c = s.libre && s.libre.slides[s.photos[0]]; return c && c.els.some(e => e.src === nueva) && c; }, 15000, 'la portada con la foto nueva');
    igual(c1.els.filter(e => e.t !== 'foto'), c0.els.filter(e => e.t !== 'foto'), 'textos y formas de la portada');
    igual(c1.els.map(e => e.t), c0.els.map(e => e.t), 'orden de las capas');
    igual([c1.velo, c1.bg], [c0.velo, c0.bg], 'velo y fondo');
    ok(slot('r1').photos.length === 2, 'Sustituir cambió el número de diapositivas');
  });

  prueba('E5', '«Añadir» en un carrusel del editor rellena sus huecos en orden y solo crea diapositiva si no queda ninguno (3.29)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('e5a.jpg')]);
    await abrirEditor('r1');
    accion('sl-add'); compDe(1).els.push(huecoEl('h2', 0.1, 0.1, 0.8, 0.6));
    accion('sl-add'); compDe(2).els.push(huecoEl('h3', 0.1, 0.1, 0.8, 0.6));
    await aplicarEditor();
    const libres = () => { const s = slot('r1'); return s.photos.map(k => !!(s.libre.slides[k] && s.libre.slides[k].els.some(e => e.t === 'hueco'))); };
    igual(libres(), [false, true, true], 'huecos libres por diapositiva');
    for (const [n, quedan] of [['e5b.jpg', [false, false, true]], ['e5c.jpg', [false, false, false]]]) {
      const [f] = await M.addFiles([await foto(n)]);
      M._test.setSel(f); celda('r1').click();
      await pulsar('[data-act="addmode"][data-m="add"]');
      await hasta(() => json(libres()) === json(quedan), 15000, `${n} en el siguiente hueco libre (${json(quedan)})`);
      ok(slot('r1').photos.length === 3, '«Añadir» creó una diapositiva habiendo un hueco libre');
    }
    const [f] = await M.addFiles([await foto('e5d.jpg')]);
    M._test.setSel(f); celda('r1').click();
    await pulsar('[data-act="addmode"][data-m="add"]');
    await hasta(() => slot('r1').photos.length === 4, 15000, 'una diapositiva nueva al final cuando ya no quedan huecos');
  });

  prueba('E6', 'Borrar la foto de un hueco devuelve el hueco tal como era (3.33)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('e6a.jpg')]);
    const [f] = await M.addFiles([await foto('e6b.jpg', 1600, 1000)]);
    await abrirEditor('r1');
    accion('sl-add');
    const h = { ...huecoEl('h1', 0.1, 0.15, 0.8, 0.5), textos: [{ t: 'texto', txt: 'Suelta aquí la foto', x: 0.1, y: 0.45, w: 0.8, h: 0.1, size: 0.03, color: '#8e8e8e', al: 'cen' }] };
    compDe(1).els.push(JSON.parse(json(h)));
    const p = await enHueco(1, 'h1', f);
    ok(!compDe(1).els.some(e => e.t === 'hueco'), 'el hueco sigue ahí con la foto puesta');
    elegir(p); accion('del');
    igual(compDe(1).els, [h], 'el hueco que vuelve al borrar la foto');
  });

  prueba('E7', 'Encaje en huecos: a sangre rellena, dentro del margen entra entera y centrada, doble clic alterna, #2B231F → #16110E (D-018)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('e7a.jpg')]);
    const [ancha, alta] = await M.addFiles([await foto('e7b.jpg', 1600, 1000), await foto('e7c.jpg', 1200, 1500)]);
    await abrirEditor('r1');
    const { W: SW, H: SH } = tam();
    // a sangre, sobre el fondo provisional
    accion('sl-add'); compDe(1).bg = '#2b231f'; compDe(1).els.push(huecoEl('hs', 0, 0, 1, 1));
    const a = await enHueco(1, 'hs', ancha);
    ok(a.x <= 0.001 && a.y <= 0.001 && a.x + a.w >= 0.999 && a.y + a.h >= 0.999, 'a sangre no cubre la diapositiva: ' + json([a.x, a.y, a.w, a.h]));
    igual(String(compDe(1).bg).toLowerCase(), '#16110e', 'el fondo provisional no pasó a Ink');
    // dentro del margen: una foto vertical en un hueco apaisado entra entera, lo más alta posible y centrada
    accion('sl-add'); compDe(2).els.push(huecoEl('hm', 0.1, 0.1, 0.8, 0.5));
    const b = await enHueco(2, 'hm', alta), d = M.files[alta];
    cerca((b.w * SW) / (b.h * SH), d.w / d.h, 0.01, 'la foto no conserva su proporción');
    cerca(b.h, 0.5, 0.002, 'no es lo más grande que cabe');
    ok(b.w < 0.8 - 0.01, 'no deja franjas a los lados');
    cerca(b.x + b.w / 2, 0.5, 0.002, 'no está centrada en horizontal');
    cerca(b.y + b.h / 2, 0.35, 0.002, 'no está centrada en vertical');
    // doble clic sobre la foto: pasa a llenar el hueco; otro, vuelve a entera (en las coordenadas del lienzo: E.k y E.sz).
    // El doble clic cambia el elemento en su sitio: se comparan copias de sus medidas
    const entera = [b.x, b.y, b.w, b.h];
    const dbl = el => {
      const E = ed(), r = E.cv.getBoundingClientRect();
      const x = r.left + (el.x + el.w / 2) * E.sz.W * E.k, y = r.top + (el.y + el.h / 2) * E.sz.H * E.k;
      E.cv.dispatchEvent(new W.MouseEvent('dblclick', { clientX: x, clientY: y, bubbles: true, cancelable: true }));
    };
    dbl(b);
    const c = compDe(2).els.find(e => e.src === alta);
    ok(c.x <= 0.101 && c.y <= 0.101 && c.x + c.w >= 0.899 && c.y + c.h >= 0.599, 'el doble clic no la pasó a llenar el hueco: ' + json([c.x, c.y, c.w, c.h]));
    const llena = [c.x, c.y, c.w, c.h];
    ok(json(llena) !== json(entera), 'el doble clic no cambió la foto');
    dbl(c);
    const e = compDe(2).els.find(x => x.src === alta);
    igual([e.x, e.y, e.w, e.h], entera, 'el segundo doble clic no la devolvió a entera');
  });

  prueba('E8', 'Cambiar de formato y volver deja textos y formas exactamente igual, también con ⌘Z (D-019)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('e8a.jpg'), await foto('e8b.jpg')]);
    await abrirEditor('r1');
    accion('add-txt'); accion('add-txt'); accion('add-forma', { v: 'rect' });
    const [t1, t2, fo] = compDe(0).els.filter(e => e.t !== 'foto');
    Object.assign(t1, { txt: 'Titular de prueba', x: 0.08, y: 0.08, w: 0.84 });
    Object.assign(t2, { txt: 'Línea de datos', x: 0.08, y: 0.86, w: 0.5, size: 0.03 });
    Object.assign(fo, { x: 0.7, y: 0.62, w: 0.2, h: 0.1 });
    [t1, t2, fo].forEach(e => delete e.mano);        // como los de una plantilla: no movidos a mano
    const sitios = () => compDe(0).els.filter(e => e.t !== 'foto').map(e => ({ id: e.id, x: e.x, y: e.y, w: e.w, h: e.h, size: e.size }));
    const antes = sitios();
    accion('fmt', { v: 'h' });
    ok(json(sitios()) !== json(antes), 'en Horizontal nada se recolocó (la prueba no distingue)');
    for (const f of ['v34', 'q11', 'v45']) accion('fmt', { v: f });
    ok(ed().fmt === 'v45', 'el formato no volvió a 4:5');
    igual(sitios(), antes, 'tras 4:5 → Horizontal → 3:4 → 1:1 → 4:5');
    for (let i = 0; i < 4; i++) accion('undo');
    ok(ed().fmt === 'v45', 'tras ⌘Z el formato no es 4:5');
    igual(sitios(), antes, 'tras deshacer los cuatro cambios con ⌘Z');
  });

  prueba('E9', 'Pegar en otra proporción conserva el tamaño en px y la distancia a su esquina, sin deformar (3.31)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel')]);
    await poner('r1', [await foto('e9a.jpg')]);
    await poner('r2', [await foto('e9b.jpg')]);
    M._test.setSlot('r2', { fmt: 'q11' });
    await abrirEditor('r1');
    accion('add-forma', { v: 'rect' });
    const a = compDe(0).els.find(e => e.t === 'forma');
    Object.assign(a, { x: 0.05, y: 0.04, w: 0.3, h: 0.1, color: '#000000' });
    const S1 = tam();
    elegir(a); accion('copy');
    M.libre.cerrar();
    await abrirEditor('r2');
    const S2 = tam();
    ok(ed().fmt === 'q11' && S2.W === S2.H, 'el segundo carrusel no está en 1:1');
    accion('paste');
    const b = await hasta(() => compDe(0).els.find(e => e.t === 'forma'), 3000, 'la forma pegada');
    cerca(b.w * S2.W, a.w * S1.W, 1, 'ancho en px');
    cerca(b.h * S2.H, a.h * S1.H, 1, 'alto en px');
    cerca(b.x * S2.W, a.x * S1.W, 1, 'distancia al borde izquierdo');
    cerca(b.y * S2.H, a.y * S1.H, 1, 'distancia al borde de arriba');
  });

  prueba('E10', 'Sin kit, los selectores de color solo dan #000000 y #FFFFFF, y un texto nuevo sin foto sale en #000000 (3.30)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); accion('add-txt');
    const t = compDe(0).els.find(e => e.t === 'texto');
    igual(String(t.color).toLowerCase(), '#000000', 'color de un texto nuevo sin foto');
    const muestras = lb => [...new Set([...ed().el.querySelectorAll(`[data-lb="${lb}"][data-c]`)].map(b => b.dataset.c.toLowerCase()))];
    const tc = await hasta(() => muestras('tc').length && muestras('tc'), 3000, 'las muestras de color del texto');
    ok(tc.every(c => ['#000000', '#ffffff'].includes(c)), 'colores de texto fuera de los básicos: ' + tc);
    tecla('Escape');                                 // sin nada elegido, el panel de la diapositiva: su fondo
    const bg = await hasta(() => muestras('bg').length && muestras('bg'), 3000, 'las muestras del fondo');
    ok(bg.every(c => ['#000000', '#ffffff'].includes(c)), 'colores de fondo fuera de los básicos: ' + bg);
  });

  prueba('E11', '⌥⌘C / ⌥⌘V copian y pegan el estilo de un texto (también sin e.code), no actúan mientras se escribe y ⌘Z lo deshace (D-023)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); accion('add-txt'); accion('add-txt'); accion('add-txt');
    const [a, b, c] = compDe(0).els.filter(e => e.t === 'texto');
    Object.assign(a, { txt: 'A', peso: 700, size: 0.09, color: '#ffffff', ls: 0.05, may: true, al: 'izq', lh: 1 });
    Object.assign(c, { txt: 'C', peso: 300, size: 0.03, color: '#000000', ls: 0, may: false, al: 'der', lh: 1.4 });
    Object.assign(b, { txt: 'B', x: 0.2, y: 0.3, w: 0.6 });
    const estilo = e => ({ font: e.font, peso: e.peso, size: e.size, color: e.color, lh: e.lh, ls: e.ls, al: e.al, may: e.may });
    const sitio = e => ({ txt: e.txt, x: e.x, y: e.y, w: e.w });
    const B = () => compDe(0).els.find(e => e.id === b.id), b0 = sitio(b);
    elegir(a); tecla('c', { meta: true, alt: true });            // sin e.code, como manda las teclas el navegador integrado
    elegir(b); tecla('v', { meta: true, alt: true });
    igual(estilo(B()), estilo(a), 'estilo pegado (tecla sin e.code)');
    igual(sitio(B()), b0, 'pegar el estilo tocó el texto, la posición o el ancho');
    elegir(c); tecla('ç', { meta: true, alt: true, code: 'KeyC' }); // un Mac de verdad: ⌥C escribe «ç»
    elegir(B()); tecla('◊', { meta: true, alt: true, code: 'KeyV' });
    igual(estilo(B()), estilo(c), 'estilo pegado (tecla con e.code)');
    elegir(a); tecla('c', { meta: true, alt: true });
    const ta = D.createElement('textarea'); ed().el.append(ta);
    elegir(B()); tecla('v', { meta: true, alt: true, en: ta });   // escribiendo en un texto: nada
    ta.remove();
    igual(estilo(B()), estilo(c), 'el atajo actuó mientras se escribía');
    accion('undo');
    igual(estilo(B()), estilo(a), '⌘Z no deshizo el último pegado de estilo');
  });

  prueba('E12', 'Las guías se guardan con el post y no salen en la imagen aplicada (D-023)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel')]);
    const hacer = async (id, conGuias) => {
      await abrirEditor(id);
      accion('sl-add'); accion('add-forma', { v: 'rect' });
      Object.assign(compDe(0).els[0], { color: '#000000', x: 0.3, y: 0.3, w: 0.4, h: 0.2 });
      if (conGuias) { accion('guias'); ed().guias.x.push(540); ed().guias.y.push(675); }
      await aplicarEditor();
      return slot(id);
    };
    const a = await hacer('r1', true), b = await hacer('r2', false);
    igual(a.guias, { x: [540], y: [675] }, 'las guías del post');
    ok(!b.guias || !(b.guias.x.length + b.guias.y.length), 'el post sin guías tiene guías');
    const [xa, xb] = await Promise.all([a, b].map(async s => new Uint8Array(await (await M._in.getBlob(s.photos[0])).arrayBuffer())));
    ok(xa.length > 1000 && xa.length === xb.length && xa.every((v, i) => v === xb[i]), 'la imagen aplicada con guías no es igual a la de sin guías');
  });

  // ---------- lote 1 (mesa 3.38, libre 1.14) ----------
  // el editor dibuja ya lo pendiente (con la pestaña en segundo plano no hay fotogramas que esperar)
  const dibujado = async () => { M.libre._dibujar(); await espera(0); };
  // el píxel del lienzo del editor en (x, y), en px de salida de la diapositiva (1440 de ancho)
  function pixel(x, y) {
    const E = ed(), k = E.k * (W.devicePixelRatio || 1), c = E.cv;
    const px = Math.min(c.width - 1, Math.max(0, Math.round(x * k))), py = Math.min(c.height - 1, Math.max(0, Math.round(y * k)));
    return [...E.ctx.getImageData(px, py, 1, 1).data];
  }
  function teclaEv(key, o = {}) {   // como tecla(), pero devuelve el evento (¿lo paró el editor?)
    const e = new W.KeyboardEvent('keydown', { key, code: o.code ?? '', metaKey: !!o.meta, altKey: !!o.alt, shiftKey: !!o.shift, ctrlKey: !!o.ctrl, repeat: !!o.repeat, bubbles: true, cancelable: true });
    (o.en || D.body).dispatchEvent(e); return e;
  }
  const toastDe = key => qa('.toast').find(t => t.dataset.msg === key);

  prueba('E13', 'Bandeja del editor: «H» en las fotos horizontales, misma regla y estilo que la bandeja de la mesa (D-024)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    const [h, v] = await M.addFiles([await foto('horizontal.jpg', 1500, 1000), await foto('vertical.jpg', 1200, 1500)]);
    ok(h && v, 'no entraron las fotos en la bandeja');
    const hbMesa = await hasta(() => q(`.titem[data-file="${h}"] .hb`), 4000, 'la «H» de la bandeja de la mesa');
    ok(!q(`.titem[data-file="${v}"] .hb`), 'la mesa marca con «H» una foto vertical');
    await abrirEditor('r1');
    if (!ed().trOpen) accion('bandeja');
    const it = f => hasta(() => ed().el.querySelector(`.lb-tph[data-f="${f}"]`), 4000, 'la foto en la bandeja del editor');
    const hb = (await it(h)).querySelector('.hb');
    ok(hb && hb.textContent === 'H', 'la foto horizontal no lleva «H» en la bandeja del editor');
    ok(!(await it(v)).querySelector('.hb'), 'la foto vertical lleva «H» en la bandeja del editor');
    const css = e => { const c = W.getComputedStyle(e); return ['position', 'top', 'left', 'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'color', 'backgroundColor', 'borderRadius', 'paddingLeft', 'paddingRight'].map(k => c[k]); };
    igual(css(hb), css(hbMesa), 'el estilo de la «H» no es el de la mesa');
  });

  prueba('E14', 'Imán: las líneas de centro de la diapositiva salen en verde y discontinuas; las demás, en rosa y continuas (D-025)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add');
    const { W: w, H: h } = tam();
    ed().guides = [{ x: w / 2 }, { y: h / 2 }, { x: w * 0.25 }];
    accion('zfit'); await dibujado();
    const verde = p => p[1] > 110 && p[1] - p[0] > 60 && p[1] - p[2] > 30, rosa = p => p[0] > 180 && p[0] - p[1] > 80;
    // en cada fila (o columna) el píxel más verde o más rosa de una franja de ±2 px alrededor de la línea
    const k = 1 / (ed().k * (W.devicePixelRatio || 1));
    const tira = (eje, at, largo) => Array.from({ length: 160 }, (_, n) => { const t = largo * (n + 0.5) / 160; return [-2, -1, 0, 1, 2].map(d => eje === 'x' ? pixel(at + d * k, t) : pixel(t, at + d * k)); });
    const parte = (filas, f) => filas.filter(ps => ps.some(f)).length / filas.length;
    const cx = tira('x', w / 2, h), cy = tira('y', h / 2, w), lx = tira('x', w * 0.25, h);
    for (const [n, t] of [['vertical', cx], ['horizontal', cy]]) {
      const pv = parte(t, verde);
      ok(pv > 0.3 && pv < 0.9, `la línea de centro ${n} no es verde y discontinua (verde en el ${Math.round(pv * 100)} % de su largo)`);
      ok(parte(t, rosa) < 0.05, `la línea de centro ${n} sale en rosa`);
    }
    ok(parte(lx, rosa) > 0.95, `la línea que no es de centro no es rosa y continua (${Math.round(parte(lx, rosa) * 100)} %)`);
    ok(parte(lx, verde) < 0.05, 'la línea que no es de centro sale en verde');
    // una cota que va por la línea de centro (del elemento al borde de arriba) no la tapa de rosa
    ed().cotas = [{ x1: w / 2, y1: 0, x2: w / 2, y2: h * 0.4, v: h * 0.4 / 1440 }];
    accion('zfit'); await dibujado();
    const tramo = Array.from({ length: 60 }, (_, n) => { const t = h * (0.03 + 0.1 * n / 60); return [-2, -1, 0, 1, 2].map(d => pixel(w / 2 + d * k, t)); });
    const pc = parte(tramo, verde);
    ok(pc > 0.3 && pc < 0.9 && parte(tramo, rosa) < 0.05, `una cota tapa de rosa la línea de centro (verde en el ${Math.round(pc * 100)} %)`);
  });

  prueba('E15', 'Borrar una diapositiva: con contenido pregunta; vacía se borra directa; después «Deshacer» (D-026)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('borrar.jpg')]);
    await abrirEditor('r1');
    accion('sl-add');                                              // diapositiva 2, vacía
    igual(ed().sl.length, 2, 'diapositivas al empezar');
    accion('sl-del', { i: 1 });
    ok(!ed().ask, 'una diapositiva vacía pregunta antes de borrarse');
    igual(ed().sl.length, 1, 'la diapositiva vacía no se borró');
    let t = await hasta(() => toastDe('lb-sl-del'), 2000, 'el aviso de diapositiva borrada');
    ok(/Diapositiva 2 borrada/.test(t.textContent), 'el aviso no dice qué diapositiva se borró: ' + t.textContent);
    t.querySelector('button').click();
    igual(ed().sl.length, 2, '«Deshacer» no devolvió la diapositiva');
    accion('sl-del', { i: 0 });                                    // la de la foto: pregunta
    ok(ed().ask && /¿Borrar la diapositiva 1\?/.test(ed().ask.textContent), 'una diapositiva con foto no pregunta');
    igual(ed().sl.length, 2, 'se borró antes de contestar');
    ed().ask.querySelector('[data-ask="seguir"]').click();
    igual(ed().sl.length, 2, '«Cancelar» borró la diapositiva');
    accion('sl', { i: 1 }); accion('add-txt');                    // diapositiva 2 con un texto: también pregunta
    accion('sl-del', { i: 1 });
    ok(ed().ask && /¿Borrar la diapositiva 2\?/.test(ed().ask.textContent), 'una diapositiva con un texto no pregunta');
    ed().ask.querySelector('[data-ask="borrar"]').click();
    igual(ed().sl.length, 1, '«Borrar» no borró la diapositiva');
    t = await hasta(() => toastDe('lb-sl-del'), 2000, 'el aviso de diapositiva borrada');
    accion('add-txt');                                             // otro cambio después: «Deshacer» ya no deshace ese otro
    const n = compDe(0).els.length;
    t.querySelector('button').click();
    igual([ed().sl.length, compDe(0).els.length], [1, n], '«Deshacer» deshizo otro cambio que no era el borrado');
    accion('sl-add');                                              // la diapositiva de la foto, sin nada: vacía, aunque fue de una foto
    const ids = compDe(0).els.map(e => e.id); ed().i = 0; ed().sel = ids[0]; ed().mas = ids.slice(1); accion('del');
    igual(compDe(0).els.length, 0, 'no se vació la diapositiva');
    accion('sl-del', { i: 0 });
    ok(!ed().ask, 'una diapositiva que se ha quedado vacía pregunta antes de borrarse');
    igual(ed().sl.length, 1, 'la diapositiva vacía no se borró');
  });

  prueba('E16', 'Proporción de la foto o el hueco elegido: chip junto a la selección y en «Proporción del marco» (D-027)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('prop.jpg', 1200, 1500)]);       // 4:5
    await abrirEditor('r1');
    const { W: w, H: h } = tam(), chip = () => ed().el.querySelector('.lb-rat'), rp = () => ed().el.querySelector('.lb-ratp');
    const ver = async (que, txt, enPanel) => {
      tecla('a', { meta: true }); await dibujado();
      ok(chip() && !chip().hidden, `${que}: no sale el chip`);
      igual(chip().textContent, txt, `${que}: el chip`);
      igual(rp() ? rp().textContent : null, enPanel, `${que}: «Proporción del marco»`);
    };
    const el = compDe(0).els[0];
    Object.assign(el, { x: 0, y: 0, w: 1, h: 1 }); delete el.rat;
    await ver('foto a toda la diapositiva', '4:5', '4:5');
    Object.assign(el, { h: (w / (16 / 9)) / h, rat: '16:9' }); ed().tOri = 'h';
    await ver('marco 16:9 con su botón', 'Foto 4:5 · marco 16:9', null);
    Object.assign(el, { h: (w / 1.37) / h }); delete el.rat;
    await ver('marco libre', 'Foto 4:5 · marco 1,37:1', 'Foto 4:5 · marco 1,37:1');
    delete ed().tOri;
    const [g] = await M.addFiles([await foto('libre.jpg', 1370, 1000)]);
    Object.assign(el, { src: g, h: (w / 1.37) / h });
    await ver('foto libre sin recortar', 'Libre · 1,37:1', 'Libre · 1,37:1');
    Object.assign(el, { h: (w / (16 / 9)) / h, rat: '16:9' }); ed().tOri = 'h';
    await ver('otra vez 16:9 con su botón', 'Foto 1,37:1 · marco 16:9', null);
    const an = ed().el.querySelector('.lb-panel input[data-lb="man"]');   // el ancho escrito a mano: sin botón, y el dato al día
    ok(an, 'no está el campo del ancho');
    an.value = '540'; an.dispatchEvent(new W.Event('input', { bubbles: true })); await dibujado();
    ok(!ed().el.querySelector('.lb-panel [data-lb="t-rat"].on'), 'con el ancho escrito sigue marcado un botón');
    igual([rp() && rp().textContent, chip().textContent], ['Foto 1,37:1 · marco 0,89:1', 'Foto 1,37:1 · marco 0,89:1'], 'el dato tras escribir el ancho (540 de 1080 × 810)');
    delete ed().tOri;
    accion('sl-add');
    compDe(1).els.push(huecoEl('h1', 0.1, 0.1, 0.5, 0.5));       // 720 × 900: 4:5
    await ver('hueco', '4:5', null);
    tecla('Escape'); await dibujado();
    ok(chip().hidden, 'el chip sigue sin nada elegido');
  });

  prueba('E17', '⌘D: con un elemento lo duplica; sin selección duplica la diapositiva y la pone detrás; no mientras se escribe (D-028)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); accion('add-txt');
    const t0 = compDe(0).els[0]; Object.assign(t0, { txt: 'Original', x: 0.2, y: 0.3 });
    elegir(t0); tecla('d', { meta: true });
    igual([ed().sl.length, compDe(0).els.length], [1, 2], '⌘D con un texto elegido');
    compDe(0).els.pop(); tecla('Escape');
    ok(!ed().sel, 'quedó algo elegido');
    const e = teclaEv('d', { meta: true });
    ok(e.defaultPrevented, '⌘D sin selección no se paró (el navegador lo usaría)');
    igual([ed().sl.length, ed().i], [2, 1], 'la copia no es la diapositiva 2 ni queda abierta');
    const c0 = compDe(0), c1 = compDe(1), sin = c => c.els.map(e => ({ t: e.t, txt: e.txt, x: e.x, y: e.y, w: e.w, size: e.size, color: e.color }));
    igual(sin(c1), sin(c0), 'la copia no es igual a la original');
    igual(c1.bg, c0.bg, 'el fondo de la copia');
    ok(c1.els.every(x => !c0.els.some(y => y.id === x.id)), 'la copia comparte ids con la original');
    accion('undo');
    igual(ed().sl.length, 1, '⌘Z no deshizo la diapositiva duplicada');
    const ta = D.createElement('textarea'); ed().el.append(ta);
    tecla('d', { meta: true, en: ta }); ta.remove();
    igual(ed().sl.length, 1, '⌘D actuó mientras se escribía');
    teclaEv('d', { meta: true, repeat: true });
    igual(ed().sl.length, 1, 'mantener ⌘D duplicó la diapositiva');
    while (ed().sl.length < 19) accion('sl-add');
    ed().sel = null; ed().mas = [];
    tecla('d', { meta: true });
    igual(ed().sl.length, 20, '⌘D en la diapositiva 19');
    tecla('d', { meta: true });
    ok(!ed().ask, 'quedó abierta una pregunta');
    igual(ed().sl.length, 20, 'un carrusel pasó de 20 diapositivas');
  });

  prueba('E18', 'Zona del grid (⌘P): en la portada oscurece lo que el perfil recorta en 3:4, se recuerda, no imprime y no sale en la imagen aplicada (D-029)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel')]);
    W.localStorage.removeItem('mesa-lb-zona');
    const hacer = async (id, conZona) => {
      await abrirEditor(id);
      accion('sl-add'); accion('add-forma', { v: 'rect' });
      Object.assign(compDe(0).els[0], { color: '#000000', x: 0.3, y: 0.3, w: 0.4, h: 0.2 });
      if (conZona !== ed().zona) tecla('p', { meta: true });
      igual(ed().zona, conZona, 'la zona del grid');
      await aplicarEditor();
      return slot(id);
    };
    await abrirEditor('r1');
    accion('sl-add'); accion('sl-add'); ed().i = 0; accion('zfit');
    const e = teclaEv('p', { meta: true });
    ok(e.defaultPrevented, '⌘P no se paró: el navegador imprimiría');
    ok(ed().zona && W.localStorage.getItem('mesa-lb-zona') === '1', '⌘P no enseñó la zona o no se recuerda');
    igual(ed().el.querySelector('[data-lb="zona"]').getAttribute('aria-checked'), 'true', '«Zona del grid» en «⋯»');
    await dibujado();
    const oscuro = p => p[0] < 160, { W: w, H: h } = tam(), lado = (w - h * 0.75) / 2;   // 4:5: 45 px de 1440 a cada lado
    ok(oscuro(pixel(lado - 6, h / 2)) && oscuro(pixel(w - lado + 6, h / 2)), '4:5: no oscurece los lados que recorta el perfil');
    ok(!oscuro(pixel(lado + 6, h / 2)) && !oscuro(pixel(w / 2, 10)), '4:5: oscurece lo que el perfil sí enseña');
    accion('fmt', { v: 'q11' }); await dibujado();
    ok(oscuro(pixel(170, 720)) && !oscuro(pixel(190, 720)), '1:1: la zona no son 180 px de 1440 a cada lado');
    accion('fmt', { v: 'v34' }); await dibujado();
    ok(!oscuro(pixel(4, 960)) && !oscuro(pixel(1436, 960)), '3:4: oscurece algo, y el perfil no recorta nada');
    accion('fmt', { v: 'v45' }); ed().i = 1; accion('zfit'); await dibujado();
    ok(!oscuro(pixel(4, h / 2)), 'la zona sale en una diapositiva que no es la portada');
    const ta = D.createElement('textarea'); ed().el.append(ta);
    const e2 = teclaEv('p', { meta: true, en: ta }); ta.remove();
    ok(e2.defaultPrevented && ed().zona, 'mientras se escribe, ⌘P imprimió o cambió la zona');
    tecla('p', { meta: true });
    ok(!ed().zona && W.localStorage.getItem('mesa-lb-zona') === '0', '⌘P otra vez no ocultó la zona');
    M.libre.cerrar();
    const a = await hacer('r1', true), b = await hacer('r2', false);
    const [xa, xb] = await Promise.all([a, b].map(async s => new Uint8Array(await (await M._in.getBlob(s.photos[0])).arrayBuffer())));
    ok(xa.length > 1000 && xa.length === xb.length && xa.every((v, i) => v === xb[i]), 'la imagen aplicada con la zona no es igual a la de sin zona');
  });

  // ---------- lote 2 (mesa 3.39, libre 1.15): el área gris alrededor de la diapositiva ----------
  // eventos de puntero, ratón y rueda en (x, y) de la ventana de la mesa, sobre el elemento dado
  function puntero(tipo, en, x, y, o = {}) {
    const e = new W.PointerEvent(tipo, { clientX: x, clientY: y, button: o.button ?? 0, buttons: tipo === 'pointerup' || tipo === 'pointercancel' ? 0 : (o.button === 2 ? 2 : 1), pointerId: 1, pointerType: 'mouse', isPrimary: true, shiftKey: !!o.shift, ctrlKey: !!o.ctrl, bubbles: true, cancelable: true });
    en.dispatchEvent(e); return e;
  }
  function raton(tipo, en, x, y, o = {}) {
    const e = new W.MouseEvent(tipo, { clientX: x, clientY: y, button: o.button ?? 0, shiftKey: !!o.shift, bubbles: true, cancelable: true });
    en.dispatchEvent(e); return e;
  }
  function rueda(en, x, y, dy, o = {}) {
    const e = new W.WheelEvent('wheel', { clientX: x, clientY: y, deltaY: dy, ctrlKey: !!o.ctrl, metaKey: !!o.meta, bubbles: true, cancelable: true });
    en.dispatchEvent(e); return e;
  }
  const gris = () => ed().scroll;
  // un punto del área gris, en la esquina de arriba a la izquierda (el relleno: nunca es la diapositiva)
  const enGris = () => { const r = gris().getBoundingClientRect(); return [r.left + 5, r.top + 5]; };
  // un punto de la diapositiva (px de salida) en la ventana, y al revés
  const aVentana = (x, y) => { const E = ed(), r = E.cv.getBoundingClientRect(); return [r.left + x * E.k, r.top + y * E.k]; };
  const aDiapo = (x, y) => { const E = ed(), r = E.cv.getBoundingClientRect(); return [(x - r.left) / E.k, (y - r.top) / E.k]; };
  const elegidos = () => [ed().sel, ...ed().mas].filter(Boolean).sort();
  function clicGris(o) { const [x, y] = enGris(), s = gris(); puntero('pointerdown', s, x, y, o); puntero('pointerup', s, x, y, o); raton('click', s, x, y, o); }
  function arrastrarGris(x0, y0, x1, y1, o = {}) {
    const s = gris();
    puntero('pointerdown', s, x0, y0, o); puntero('pointermove', s, (x0 + x1) / 2, (y0 + y1) / 2, o); puntero('pointermove', s, x1, y1, o);
    const marco = q('.lb-marq'); puntero('pointerup', s, x1, y1, o);
    return marco;
  }
  function escribir() {             // un texto con el foco, como el campo del texto en el panel
    const ta = D.createElement('textarea'); ed().el.append(ta); ta.focus();
    ok(D.activeElement === ta, 'no se pudo poner el foco en el texto de prueba');
    return ta;
  }

  prueba('E19', 'Área gris: un clic fuera de la diapositiva suelta la selección y el encuadre; con ⇧ no; escribiendo, solo termina de escribir (D-030)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); accion('add-txt'); await dibujado();
    const t = compDe(0).els[0];
    elegir(t); clicGris({ shift: true });
    igual(ed().sel, t.id, '⇧ + clic en el área gris soltó la selección');
    const ta = escribir();
    clicGris();
    igual(ed().sel, t.id, 'el clic en el área gris soltó la selección mientras se escribía');
    ok(D.activeElement !== ta, 'el clic en el área gris no terminó de escribir');
    ta.remove();
    clicGris();                                                  // justo después: el segundo clic de un doble clic, no cuenta
    igual(ed().sel, t.id, 'el segundo clic, justo después de terminar de escribir, soltó la selección');
    await espera(650);
    const [cx, cy] = enGris(); puntero('pointerdown', gris(), cx, cy); puntero('pointercancel', gris(), cx, cy);
    igual(ed().sel, t.id, 'un toque cancelado en el área gris soltó la selección');
    clicGris();
    igual(elegidos(), [], 'el clic en el área gris no soltó la selección');
    elegir(t); ed().crop = t.id; ed().pick = { modo: 'add' };
    clicGris();
    ok(!ed().sel && !ed().crop && !ed().pick, 'el clic en el área gris no soltó el encuadre o la elección de foto');
    // en la diapositiva, un clic sobre un elemento sigue eligiéndolo
    await dibujado();
    const { W: w, H: h } = tam(), [x, y] = aVentana(w / 2, (t.y + t.h / 2) * h);
    puntero('pointerdown', ed().cv, x, y); puntero('pointerup', ed().cv, x, y);
    igual(ed().sel, t.id, 'un clic sobre un texto de la diapositiva ya no lo elige');
  });

  prueba('E20', 'Área gris: arrastrar elige lo que queda dentro del rectángulo (⇧ suma); ni ocultos, ni bloqueados, ni medio grupo; escribiendo, nada (D-030)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); for (let n = 0; n < 5; n++) accion('add-forma', { v: 'rect' });
    const [a, b, c, d, g] = compDe(0).els;
    Object.assign(a, { x: 0.05, y: 0.05, w: 0.1, h: 0.1 }); Object.assign(b, { x: 0.2, y: 0.05, w: 0.1, h: 0.1 });
    Object.assign(c, { x: 0.7, y: 0.7, w: 0.1, h: 0.1 });
    Object.assign(d, { x: 0.35, y: 0.05, w: 0.05, h: 0.05, oculto: true }); Object.assign(g, { x: 0.1, y: 0.2, w: 0.05, h: 0.05, lock: true });
    ed().sel = null; ed().mas = []; await dibujado();
    const { W: w, H: h } = tam(), [x0, y0] = enGris(), r = gris().getBoundingClientRect(), [xm, ym] = aVentana(w * 0.5, h * 0.5);
    const marco = arrastrarGris(x0, y0, xm, ym);
    ok(marco && marco.style.width && parseFloat(marco.style.width) > 0, 'no se dibujó el rectángulo');
    ok(!q('.lb-marq'), 'el rectángulo se quedó en pantalla al soltar');
    igual(elegidos(), [a.id, b.id].sort(), 'el rectángulo no eligió justo lo que quedaba dentro (sin el oculto ni el bloqueado)');
    const [xc, yc] = aVentana(w * 0.65, h * 0.65), [xz, yz] = [r.right - 6, r.bottom - 6];
    arrastrarGris(xz, yz, xc, yc, { shift: true });
    igual(elegidos(), [a.id, b.id, c.id].sort(), 'con ⇧ el rectángulo no sumó a la selección');
    arrastrarGris(xz, yz, xc, yc);
    igual(elegidos(), [c.id], 'sin ⇧ el rectángulo no empezó una selección nueva');
    a.g = c.g = d.g = 'grupo-prueba';                           // d, oculto, va en el grupo
    arrastrarGris(x0, y0, xm, ym);
    igual(elegidos(), [b.id], 'entró medio grupo');
    arrastrarGris(x0, y0, xz, yz);
    igual(elegidos(), [a.id, b.id, c.id, d.id].sort(), 'todo: el grupo entero, como con un clic (su oculto también), y nada bloqueado suelto');
    const ta = escribir();
    arrastrarGris(xz, yz, xc, yc);
    ta.remove();
    igual(elegidos(), [a.id, b.id, c.id, d.id].sort(), 'el rectángulo actuó mientras se escribía');
    // empezar sobre un elemento de la diapositiva lo mueve, como antes: no es un rectángulo
    await espera(650); ed().sel = null; ed().mas = [];
    const [xb, yb] = aVentana((b.x + b.w / 2) * w, (b.y + b.h / 2) * h), bx = b.x;
    puntero('pointerdown', ed().cv, xb, yb); puntero('pointermove', ed().cv, xb + 30, yb); puntero('pointerup', ed().cv, xb + 30, yb);
    ok(compDe(0).els.find(e => e.id === b.id).x > bx, 'arrastrar un elemento de la diapositiva ya no lo mueve');
    ok(!q('.lb-marq'), 'arrastrar un elemento dibujó un rectángulo');
  });

  prueba('E21', 'Pellizco y ⌘ + rueda: zoom del editor hacia el puntero, también en el área gris; nunca zoom de la página; escribiendo, nada (D-031)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); accion('zfit'); await dibujado();
    const E = ed(), { W: w, H: h } = tam(), [x, y] = aVentana(w * 0.75, h * 0.7);
    let e = rueda(E.cv, x, y, -200, { ctrl: true }); await dibujado();
    ok(e.defaultPrevented, 'el pellizco sobre la diapositiva no se paró: haría zoom de la página');
    cerca(E.zoom, 4, 0.01, 'el pellizco no acercó');
    const [px, py] = aDiapo(x, y);
    cerca(px, w * 0.75, w * 0.01, 'el punto bajo el puntero se movió en horizontal'); cerca(py, h * 0.7, h * 0.01, 'el punto bajo el puntero se movió en vertical');
    const [gx, gy] = enGris(), z0 = E.zoom;
    e = rueda(gris(), gx, gy, 30, { ctrl: true }); await dibujado();
    ok(e.defaultPrevented && E.zoom < z0, 'el pellizco en el área gris no alejó o dejó hacer zoom de la página');
    const z1 = E.zoom; e = rueda(gris(), gx, gy, -30, { meta: true }); await dibujado();
    ok(e.defaultPrevented && E.zoom > z1, '⌘ + rueda en el área gris no acercó');
    const z2 = E.zoom, pnl = q('.lb-panel'), pr = pnl.getBoundingClientRect();
    e = rueda(pnl, pr.left + 20, pr.top + 20, -30, { ctrl: true });
    ok(e.defaultPrevented && E.zoom === z2, 'el pellizco sobre el panel hizo zoom del editor o de la página');
    e = rueda(gris(), gx, gy, 40);
    ok(!e.defaultPrevented && E.zoom === z2, 'la rueda sola en el área gris no desplaza o hace zoom');
    const ta = escribir();
    e = rueda(gris(), gx, gy, -30, { ctrl: true });
    ta.remove();
    ok(e.defaultPrevented && E.zoom === z2, 'el pellizco hizo zoom mientras se escribía (o dejó el de la página)');
  });

  prueba('E22', 'Espacio + arrastrar mueve la vista con zoom y no elige ni mueve nada; fuera de la diapositiva o escribiendo, el espacio es el de siempre (D-031)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); accion('add-txt');
    const t = compDe(0).els[0], E = ed(), sc = gris(); ed().sel = null; ed().mas = [];
    for (let n = 0; n < 5; n++) accion('zin');
    await dibujado();
    ok(sc.scrollWidth > sc.clientWidth && sc.scrollHeight > sc.clientHeight, 'sin zoom para mover la vista');
    const { W: w, H: h } = tam(), cx = w / 2, cy = (t.y + t.h / 2) * h;
    const rs = sc.getBoundingClientRect(); let [x, y] = aVentana(cx, cy);   // el texto en el centro de la vista
    sc.scrollLeft += x - (rs.left + rs.right) / 2; sc.scrollTop += y - (rs.top + rs.bottom) / 2;
    [x, y] = aVentana(cx, cy);
    puntero('pointermove', E.cv, x, y);
    const e = teclaEv(' ', { code: 'Space' });
    ok(e.defaultPrevented, 'el espacio sobre la diapositiva no se paró');
    igual(E.cv.style.cursor, 'grab', 'con el espacio pulsado no sale la mano');
    const l0 = sc.scrollLeft, t0 = sc.scrollTop, x0 = t.x;
    puntero('pointerdown', E.cv, x, y); puntero('pointermove', sc, x - 40, y - 30); puntero('pointerup', sc, x - 40, y - 30);
    cerca(sc.scrollLeft, l0 + 40, 1, 'espacio + arrastrar no movió la vista en horizontal'); cerca(sc.scrollTop, t0 + 30, 1, 'espacio + arrastrar no movió la vista en vertical');
    ok(!ed().sel && compDe(0).els[0].x === x0, 'espacio + arrastrar eligió o movió el texto');
    const ku = new W.KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true, cancelable: true }); D.body.dispatchEvent(ku);
    ok(E.cv.style.cursor !== 'grab', 'al soltar el espacio sigue la mano');
    teclaEv(' ', { code: 'Space' });                             // en un Mac, el espacio soltado con ⌘ pulsado no manda keyup: vale el de ⌘
    D.body.dispatchEvent(new W.KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft', bubbles: true, cancelable: true }));
    ok(E.cv.style.cursor !== 'grab', 'soltado ⌘, la mano se quedó pegada');
    [x, y] = aVentana(cx, cy);
    puntero('pointerdown', E.cv, x, y); puntero('pointerup', E.cv, x, y);
    igual(ed().sel, t.id, 'soltado el espacio, un clic no elige el texto');
    ed().sel = null;
    const pr = q('.lb-panel').getBoundingClientRect();
    puntero('pointermove', q('.lb-panel'), pr.left + 10, pr.top + 10);
    ok(!teclaEv(' ', { code: 'Space' }).defaultPrevented, 'el espacio fuera de la diapositiva se paró');
    puntero('pointermove', E.cv, x, y);
    const ta = escribir();
    ok(!teclaEv(' ', { code: 'Space', en: ta }).defaultPrevented, 'el espacio no escribe mientras se escribe en un texto');
    ta.remove();
  });

  prueba('E23', 'Doble clic en el área gris: «Ajustar»; en la diapositiva vacía o escribiendo, no (D-030)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); accion('zin'); accion('zin'); await dibujado();
    const [gx, gy] = enGris();
    raton('dblclick', gris(), gx, gy);
    igual(ed().zoom, 1, 'el doble clic en el área gris no ajustó');
    accion('zin'); await dibujado();
    const ta = escribir(); raton('dblclick', gris(), gx, gy); ta.remove();
    ok(ed().zoom > 1, 'el doble clic ajustó mientras se escribía');
    const tb = escribir();                                       // como de verdad: el primer clic termina de escribir, luego llega el doble clic
    puntero('pointerdown', gris(), gx, gy); puntero('pointerup', gris(), gx, gy); raton('click', gris(), gx, gy);
    ok(D.activeElement !== tb, 'el clic no terminó de escribir'); tb.remove();
    puntero('pointerdown', gris(), gx, gy); puntero('pointerup', gris(), gx, gy); raton('dblclick', gris(), gx, gy);
    ok(ed().zoom > 1, 'el doble clic que terminó de escribir ajustó');
    await espera(650);
    puntero('pointermove', gris(), gx, gy); teclaEv(' ', { code: 'Space' });
    raton('dblclick', gris(), gx, gy);
    D.body.dispatchEvent(new W.KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
    ok(ed().zoom > 1, 'el doble clic con el espacio pulsado ajustó');
    const { W: w, H: h } = tam(), [x, y] = aVentana(w / 2, h / 2);
    raton('dblclick', ed().cv, x, y);
    ok(ed().zoom > 1, 'el doble clic en la diapositiva ajustó');
  });

  prueba('E24', 'Clic derecho en el área gris: Pegar, Pegar estilo, Añadir texto y Añadir forma con su atajo; T y R añaden; nada escribiendo (D-032)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); await dibujado();
    const [gx, gy] = enGris(), m = q('.lb-cm');
    const menu = () => raton('contextmenu', gris(), gx, gy, { button: 2 });
    const item = n => qa('.lb-cm button')[n];
    let e = menu();
    ok(e.defaultPrevented && !m.hidden, 'el clic derecho en el área gris no abrió el menú');
    igual(qa('.lb-cm button').map(b => [b.firstChild.textContent, b.querySelector('.lb-kb').textContent]),
      [['Pegar', '⌘V'], ['Pegar estilo', '⌥⌘V'], ['Añadir texto', 'T'], ['Añadir forma', 'R']], 'las opciones del menú');
    igual(qa('.lb-cm button').slice(1).map(b => b.disabled), [true, false, false], 'sin texto elegido, «Pegar estilo» encendido o añadir apagado');   // «Pegar» depende de lo copiado en otras pruebas
    item(2).click();
    ok(m.hidden, 'el menú no se cerró al elegir');
    const els = () => compDe(0).els, ia = els()[0] && els()[0].id, A = () => els().find(x => x.id === ia);
    ok(els().length === 1 && A().t === 'texto', '«Añadir texto» no añadió un texto');
    elegir(A()); tecla('c', { meta: true });
    menu(); ok(!item(0).disabled, '«Pegar» sigue apagado con algo copiado');
    item(0).click();
    igual(els().length, 2, '«Pegar» no pegó');
    const ib = els()[1].id, B = () => els().find(x => x.id === ib);
    Object.assign(A(), { color: '#ff0000', size: 0.09 }); Object.assign(B(), { color: '#000000', size: 0.03 });
    elegir(A()); tecla('c', { meta: true, alt: true }); elegir(B());
    menu(); ok(!item(1).disabled, '«Pegar estilo» sigue apagado con un estilo copiado y un texto elegido');
    item(1).click();
    igual([B().color, B().size], ['#ff0000', 0.09], '«Pegar estilo» no pegó el estilo');
    elegir(B()); puntero('pointerdown', gris(), gx, gy, { ctrl: true }); menu(); puntero('pointerup', gris(), gx, gy);
    ok(!m.hidden && ed().sel === ib && !item(1).disabled, 'ctrl + clic (el clic derecho del Mac) soltó la selección o no abrió el menú');
    rueda(gris(), gx, gy, 20); ok(m.hidden, 'la rueda no cerró el menú');
    menu(); gris().dispatchEvent(new W.Event('scroll')); ok(m.hidden, 'desplazar la vista no cerró el menú');
    menu(); item(3).click();
    ok(els().some(x => x.t === 'forma' && x.forma === 'rect'), '«Añadir forma» no añadió un rectángulo');
    menu(); tecla('Escape');
    ok(m.hidden, 'Esc no cerró el menú');
    menu(); clicGris();
    ok(m.hidden, 'un clic fuera no cerró el menú');
    e = raton('contextmenu', ed().cv, ...aVentana(10, 10), { button: 2 });
    ok(!e.defaultPrevented && m.hidden, 'el clic derecho en la diapositiva abrió el menú del área gris');
    const n0 = els().length;
    tecla('t'); igual(els().length, n0 + 1, 'T no añadió un texto'); ok(els()[n0].t === 'texto', 'T no añadió un texto');
    tecla('r'); ok(els().length === n0 + 2 && els()[n0 + 1].forma === 'rect', 'R no añadió un rectángulo');
    tecla('t', { meta: true }); igual(els().length, n0 + 2, '⌘T añadió un texto');
    const ta = escribir();
    tecla('t', { en: ta }); tecla('r', { en: ta });
    e = menu();
    ok(e.defaultPrevented && m.hidden, 'el clic derecho abrió el menú mientras se escribía');
    ta.remove();
    const tb = escribir();                                       // como de verdad: pointerdown con el botón derecho y luego contextmenu
    puntero('pointerdown', gris(), gx, gy, { button: 2 }); e = menu(); puntero('pointerup', gris(), gx, gy, { button: 2 });
    ok(e.defaultPrevented && m.hidden && D.activeElement !== tb, 'el clic derecho mientras se escribía abrió el menú o no terminó de escribir');
    tb.remove();
    igual(els().length, n0 + 2, 'T o R añadieron algo mientras se escribía');
  });

  prueba('E25', 'Fotos soltadas en el área gris, del ordenador o de la bandeja, van a la diapositiva abierta; escribiendo, no (D-030)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); accion('sl-add'); await dibujado();
    igual(ed().i, 1, 'la diapositiva abierta no es la 2');
    const [gx, gy] = enGris();
    const soltarArchivo = async n => { const dt = new W.DataTransfer(); dt.items.add(await foto(n)); const e = new W.DragEvent('drop', { clientX: gx, clientY: gy, dataTransfer: dt, bubbles: true, cancelable: true }); gris().dispatchEvent(e); return e; };
    const fotosEn = i => compDe(i).els.filter(e => e.t === 'foto' && e.src).length;
    const ta = escribir();
    const e0 = await soltarArchivo('gris-0.jpg'); await espera(300);
    ta.remove();
    ok(e0.defaultPrevented, 'la foto soltada mientras se escribía la abrió el navegador');
    ok(qa('.toast').some(t => /Estás escribiendo/.test(t.textContent)), 'no avisó de que se estaba escribiendo');
    igual(fotosEn(0) + fotosEn(1), 0, 'la foto entró mientras se escribía');
    const tc = escribir(), pr = q('.lb-panel').getBoundingClientRect(), dt = new W.DataTransfer(); dt.items.add(await foto('gris-p.jpg'));
    q('.lb-panel').dispatchEvent(new W.DragEvent('drop', { clientX: pr.left + 20, clientY: pr.top + 20, dataTransfer: dt, bubbles: true, cancelable: true }));
    await hasta(() => fotosEn(1) === 1, 6000, 'la foto soltada en el panel mientras se escribía (no es el área gris)');
    tc.remove();
    accion('undo'); igual(fotosEn(1), 0, '⌘Z no quitó la foto soltada en el panel');
    await soltarArchivo('gris-1.jpg');
    await hasta(() => fotosEn(1) === 1, 6000, 'la foto del ordenador en la diapositiva abierta');
    igual(fotosEn(0), 0, 'la foto fue a otra diapositiva');
    // de la bandeja: una foto que aún no se ha usado
    await M.addFiles([await foto('gris-2.jpg')], null, { tray: true });
    accion('bandeja'); if (!ed().trOpen) accion('bandeja');
    const th = await hasta(() => q('.lb-tph:not(.uso)'), 4000, 'la foto sin usar en la bandeja del editor');
    const r = th.getBoundingClientRect(), [hx, hy] = enGris();
    ok(D.elementFromPoint(hx, hy) === gris(), 'el punto del área gris no es el área gris');
    puntero('pointerdown', th, r.left + 10, r.top + 10);
    puntero('pointermove', D, hx + 20, hy + 20); puntero('pointerup', D, hx, hy);
    await hasta(() => fotosEn(1) === 2, 6000, 'la foto de la bandeja en la diapositiva abierta');
  });

  // ---------- lote 3 (mesa 3.40, libre 1.16): plantillas ----------
  async function guardarPlant() {   // «Guardar como plantilla» en la diapositiva abierta, sin nada elegido: no pregunta; la plantilla nueva
    ed().sel = null; ed().mas = [];
    const ids0 = new Set(ed().plant.map(t => t.id));   // las de pruebas anteriores pueden seguir en la ficha del cliente
    accion('tpl-save');
    ok(!q('.lb-ask'), '«Guardar como plantilla» preguntó algo');
    return hasta(() => { const t = ed().plant[ed().plant.length - 1]; return t && !ids0.has(t.id) && t; }, 4000, 'la plantilla guardada');
  }
  function aplicarPlant(t, modo) {  // pulsar la plantilla y elegir en su diálogo
    accion('tpl', { id: t.id });
    const b = ed().el.querySelector(`.lb-ask [data-ask="${modo}"]`); ok(b, `el diálogo de la plantilla no tiene «${modo}»`);
    b.click();
  }
  const fotoDe = (c, f) => c.els.find(e => e.t === 'foto' && e.src === f);
  const rotulo = (n, de) => ({ t: 'texto', txt: `HUECO DE FOTO · ${n} / ${de}`, x: 0.1, y: 0.45, w: 0.8, h: 0.1, size: 0.04, color: '#ff0000', al: 'cen' });

  prueba('E26', '«Guardar como plantilla»: sin preguntar, la diapositiva entera con su formato (un hueco donde había cada foto); la lista va por formato (D-033)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('pl-a.jpg'), await foto('pl-b.jpg')]);
    await abrirEditor('r1');
    accion('add-txt'); accion('add-forma', { v: 'rect' });
    compDe(0).els.find(e => e.t === 'texto').txt = 'Mi titular';
    const t = await guardarPlant();
    ok(/^Plantilla \d+$/.test(t.nombre), 'el nombre de la plantilla: ' + t.nombre);
    igual(t.fmt, '4:5', 'el formato de la plantilla'); cerca(t.rat, 0.8, 0.001, 'la proporción de la plantilla');
    igual(t.comp.els.map(e => e.t), ['foto', 'texto', 'forma'], 'los elementos de la plantilla');
    ok(t.comp.els[0].src === null, 'la foto se guardó dentro de la plantilla');
    igual(t.comp.els[1].txt, 'Mi titular', 'el texto de la plantilla');
    // una foto que llenaba un hueco se guarda con ese hueco
    const [fc] = await M.addFiles([await foto('pl-c.jpg')], null, { tray: true });
    accion('sl-add'); const i = ed().i; compDe(i).els.push(huecoEl('h1', 0.1, 0.1, 0.8, 0.5));
    await enHueco(i, 'h1', fc);
    const t2 = await guardarPlant(), e2 = t2.comp.els[0];
    ok(e2.t === 'foto' && !e2.src && e2.hueco && e2.hueco.x === 0.1 && e2.hueco.w === 0.8, 'la foto en su hueco no se guardó como hueco: ' + json(e2));
    // la lista: bajo «4:5», con las dos
    const l = await hasta(() => qa('.lb-panel .lb-l').find(e => e.textContent === '4:5'), 4000, 'el grupo «4:5» de la lista');
    ok(l.nextElementSibling.querySelector(`canvas[data-id="${t.id}"]`) && l.nextElementSibling.querySelector(`canvas[data-id="${t2.id}"]`), 'las plantillas no están bajo «4:5»');
  });

  prueba('E27', 'Plantilla «Solo textos»: los textos toman por orden el formato de los de la plantilla y conservan su texto; los que faltan entran como «Titular» / «Texto» (D-034)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('tx-a.jpg'), await foto('tx-b.jpg')]);
    await abrirEditor('r1');
    accion('add-txt'); accion('add-txt'); accion('add-txt');
    const [a, b, c] = compDe(0).els.filter(e => e.t === 'texto');
    Object.assign(a, { txt: 'Uno', x: 0.05, y: 0.1, w: 0.9, size: 0.1, color: '#ff0000', al: 'izq', lh: 1, peso: 700, may: true });
    Object.assign(b, { txt: 'Dos', x: 0.2, y: 0.8, w: 0.6, size: 0.04, color: '#00ff00', al: 'der', lh: 1.5 });
    Object.assign(c, { txt: 'Tres', x: 0.3, y: 0.6, w: 0.4, size: 0.03, color: '#0000ff', al: 'cen' });
    const t = await guardarPlant();
    // diapositiva 2: la foto y un texto propio
    accion('sl', { i: 1 }); accion('add-txt');
    const mio = compDe(1).els.find(e => e.t === 'texto'); mio.txt = 'Mi texto';
    const foto1 = json(compDe(1).els.find(e => e.t === 'foto'));
    aplicarPlant(t, 'textos');
    const ts = compDe(1).els.filter(e => e.t === 'texto');
    igual(ts.map(e => e.txt), ['Mi texto', 'Texto', 'Texto'], 'los textos tras «Solo textos»');
    igual([ts[0].x, ts[0].y, ts[0].w, ts[0].size, ts[0].color, ts[0].al, ts[0].lh, ts[0].peso, ts[0].may], [0.05, 0.1, 0.9, 0.1, '#ff0000', 'izq', 1, 700, true], 'el formato del 1.er texto');
    igual([ts[1].x, ts[1].y, ts[1].color, ts[1].al], [0.2, 0.8, '#00ff00', 'der'], 'el formato del 2.º texto');
    igual(json(compDe(1).els.find(e => e.t === 'foto')), foto1, 'la foto cambió con «Solo textos»');
    // sin textos: el más grande es «Titular»
    accion('sl', { i: 0 }); accion('sl-add'); const j = ed().i;
    aplicarPlant(t, 'textos');
    igual(compDe(j).els.filter(e => e.t === 'texto').map(e => e.txt), ['Titular', 'Texto', 'Texto'], 'los textos de muestra');
    accion('undo'); igual(compDe(j).els.length, 0, '⌘Z no quitó los textos de la plantilla');
  });

  prueba('E28', 'Plantilla «Solo fotos» y «Todo»: las fotos de la diapositiva pasan por orden a los huecos de la plantilla, que sustituyen a los suyos (D-034, D-036)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    const [fa, fb] = await poner('r1', [await foto('fo-a.jpg'), await foto('fo-b.jpg')]);
    await abrirEditor('r1');
    // la plantilla: tres huecos, un texto y su fondo
    accion('sl-add'); const p = ed().i, cp = compDe(p);
    cp.bg = '#123456';
    cp.els.push(huecoEl('t1', 0, 0, 0.5, 0.5), huecoEl('t2', 0.5, 0, 0.5, 0.5), huecoEl('t3', 0, 0.5, 1, 0.5));
    accion('add-txt'); compDe(p).els.find(e => e.t === 'texto').txt = 'De la plantilla';
    const t = await guardarPlant();
    // la diapositiva 1: dos fotos, un hueco libre y una forma encima
    accion('sl', { i: 0 }); accion('add-forma', { v: 'rect' });
    const c = compDe(0), f1 = c.els.find(e => e.t === 'foto');
    c.els.splice(1, 0, { ...JSON.parse(json(f1)), id: 'f2', src: fb, x: 0.5, w: 0.5 }, huecoEl('hv', 0.2, 0.2, 0.3, 0.3));
    const antes = json(compDe(0));
    aplicarPlant(t, 'fotos');
    let d = compDe(0);
    ok(!d.els.some(e => e.id === 'hv'), 'el hueco de la diapositiva sigue ahí: la plantilla se puso encima');
    const a = fotoDe(d, fa), b = fotoDe(d, fb), h3 = d.els.filter(e => e.t === 'hueco');
    ok(a && a.hueco && a.hueco.x === 0 && a.hueco.y === 0, 'la 1.ª foto no está en el 1.er hueco: ' + json(a));
    ok(b && b.hueco && b.hueco.x === 0.5 && b.hueco.y === 0, 'la 2.ª foto no está en el 2.º hueco: ' + json(b));
    ok(h3.length === 1 && h3[0].y === 0.5 && h3[0].w === 1, 'el 3.er hueco no quedó libre: ' + json(h3));
    ok(d.els.findIndex(e => e.t === 'forma') > d.els.indexOf(a), 'la forma ya no está encima de las fotos');
    ok(!d.els.some(e => e.t === 'texto') && d.bg !== '#123456', '«Solo fotos» trajo el texto o el fondo de la plantilla');
    ok(d.previa && json({ ...d.previa, rat: undefined, tras: undefined }) === antes, 'la diapositiva no guardó lo que tenía');
    accion('undo'); igual(json(compDe(0)), antes, '⌘Z no devolvió la diapositiva');
    aplicarPlant(t, 'todo');
    d = compDe(0);
    ok(d.bg === '#123456' && d.els.some(e => e.t === 'texto' && e.txt === 'De la plantilla'), '«Todo» no trajo el fondo y el texto');
    ok(!d.els.some(e => e.t === 'forma' || e.id === 'hv'), '«Todo» dejó la forma o el hueco de antes');
    ok(fotoDe(d, fa).hueco.x === 0 && fotoDe(d, fb).hueco.x === 0.5, '«Todo» no puso las fotos en los huecos por orden');
  });

  prueba('E29', 'Hueco vacío: «Aplicar» guarda y sale; la casilla lo marca; plan(), subir y la imagen del feed lo paran; su rótulo nunca sale en la imagen (D-035)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel'), pub(3, 'Carrusel'), pub(4, 'Carrusel')]);
    await poner('r1', [await foto('hv-a.jpg'), await foto('hv-b.jpg')]);
    await abrirEditor('r1');
    accion('sl-add'); const p = ed().i;
    compDe(p).els.push({ ...huecoEl('t1', 0.1, 0.1, 0.8, 0.35), textos: [rotulo(1, 2)] }, { ...huecoEl('t2', 0.1, 0.55, 0.8, 0.35), textos: [rotulo(2, 2)] });
    accion('add-txt');
    const t = await guardarPlant();
    accion('sl-add'); const j = ed().i;
    aplicarPlant(t, 'todo');
    igual(compDe(j).els.filter(e => e.t === 'hueco').length, 2, 'los huecos vacíos de la plantilla');
    await aplicarEditor();                         // antes: «Diapositiva 4: tiene un hueco sin foto…» y no salía
    const s = slot('r1');
    igual(s.photos.length, 4, 'las diapositivas aplicadas');
    ok(Object.values(s.libre.slides).filter(c => c.els.some(e => e.t === 'hueco')).length === 2, 'los huecos vacíos no se guardaron');
    await hasta(() => celda('r1') && celda('r1').querySelector('.dot.hv'), 4000, 'la marca «Hueco vacío» en la casilla');
    igual(M.plan().find(x => x.slotId === 'r1')['hueco vacío'], [p + 1, j + 1].sort((a, b) => a - b), 'plan() no marca las diapositivas con hueco vacío');
    ok(!celda('r2').querySelector('.dot.hv') && !('hueco vacío' in (M.plan().find(x => x.slotId === 'r2') || {})), 'un post sin hueco vacío salió marcado');
    const fid = s.photos[j];
    M.startUpload([{ fileId: fid, slotId: 'r1', url: 'http://127.0.0.1:9/no', auth: 'x' }]);
    ok(M.uploads[fid] && M.uploads[fid].state === 'error' && /hueco/.test(M.uploads[fid].err), 'la subida no se paró: ' + json(M.uploads[fid]));
    // intercambiar casillas mueve las fotos, no su composición: la marca y el bloqueo van con las fotos
    M._test.swap('r1', 'r4');
    igual((M.plan().find(x => x.slotId === 'r4') || {})['hueco vacío'], [p + 1, j + 1].sort((a, b) => a - b), 'tras intercambiar, plan() no marca el post que tiene las fotos');
    await hasta(() => celda('r4') && celda('r4').querySelector('.dot.hv') && !celda('r1').querySelector('.dot.hv'), 4000, 'la marca tras intercambiar las casillas');
    M.startUpload([{ fileId: fid, slotId: 'r4', url: 'http://127.0.0.1:9/no', auth: 'x' }]);
    ok(M.uploads[fid].state === 'error' && /hueco/.test(M.uploads[fid].err), 'tras intercambiar, la subida no se paró: ' + json(M.uploads[fid]));
    M._test.swap('r1', 'r4');
    // el rótulo no sale en la imagen: un hueco con rótulo y otro igual sin él dan la misma imagen
    const hacer = async (id, conRotulo) => {
      await abrirEditor(id); accion('sl-add');
      compDe(0).els.push({ ...huecoEl('r', 0.1, 0.1, 0.8, 0.8), textos: conRotulo ? [rotulo(1, 1)] : [] });
      await aplicarEditor();
      return slot(id);
    };
    const [x2, x3] = [await hacer('r2', true), await hacer('r3', false)];
    const [b2, b3] = await Promise.all([x2, x3].map(async x => new Uint8Array(await (await M._in.getBlob(x.photos[0])).arrayBuffer())));
    ok(b2.length > 1000 && b2.length === b3.length && b2.every((v, i) => v === b3[i]), 'el rótulo del hueco salió en la imagen aplicada');
    // la imagen del feed: con una portada con hueco vacío, no se sube
    const r = await M.uploadOut('clean', 'http://127.0.0.1:9/no', 'x', 'feed.jpg');
    ok(r.state === 'error' && /hueco/.test(r.err), 'la imagen del feed no se paró: ' + json(r));
  });

  prueba('E30', 'Plantilla sobre una diapositiva con hueco: lo sustituye; «Quitar plantilla» (también tras aplicar y volver) o ⌘Z lo devuelven tal cual (D-036, D-014)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('qp-a.jpg'), await foto('qp-b.jpg')]);
    await abrirEditor('r1');
    accion('sl-add'); const p = ed().i;
    compDe(p).els.push(huecoEl('t1', 0.5, 0.5, 0.4, 0.4)); accion('add-txt');
    const t = await guardarPlant();
    accion('sl-add'); const j = ed().i;
    compDe(j).els.push({ ...huecoEl('hx', 0, 0, 1, 1), color: '#2b231f', textos: [rotulo(1, 1)] });
    const antes = json(compDe(j));
    aplicarPlant(t, 'todo');
    ok(!compDe(j).els.some(e => e.id === 'hx' || (e.t === 'hueco' && e.w === 1)), 'el hueco de la diapositiva sigue debajo de la plantilla');
    accion('tpl-quitar'); igual(json(compDe(j)), antes, '«Quitar plantilla» no devolvió la diapositiva');
    // cambiada después de la plantilla: pregunta antes de quitarla
    aplicarPlant(t, 'todo'); compDe(j).els.find(e => e.t === 'texto').x = 0.3;
    accion('tpl-quitar');
    const b = ed().el.querySelector('.lb-ask [data-ask="quitar"]'); ok(b, '«Quitar plantilla» no preguntó con la diapositiva cambiada');
    ok(!compDe(j).els.some(e => e.id === 'hx'), 'quitó la plantilla antes de contestar'); b.click();
    igual(json(compDe(j)), antes, '«Quitar plantilla», tras preguntar, no devolvió la diapositiva');
    aplicarPlant(t, 'todo'); accion('undo'); igual(json(compDe(j)), antes, '⌘Z no devolvió la diapositiva');
    aplicarPlant(t, 'textos');
    ok(compDe(j).els.some(e => e.id === 'hx'), '«Solo textos» quitó el hueco');
    accion('undo'); aplicarPlant(t, 'todo');
    await aplicarEditor();
    await abrirEditor('r1', j); ed().sel = null; ed().mas = [];
    ok(compDe(j).previa, 'lo que había no se guardó con la diapositiva');
    accion('tpl-quitar'); ok(!q('.lb-ask'), 'sin cambios desde la plantilla, «Quitar plantilla» preguntó');
    igual(json(compDe(j)), antes, '«Quitar plantilla» tras volver a abrir no devolvió el hueco');
    await aplicarEditor();
  });

  // =====================================================================================================
  // ejecución
  // =====================================================================================================
  const filas = $('filas');
  function fila(t) {
    const tr = document.createElement('tr'); tr.id = 'p-' + t.id;
    tr.innerHTML = `<td class="r">·</td><td><b>${t.id}</b> ${t.titulo.replace(/</g, '&lt;')}<div class="err"></div></td><td class="d"></td>`;
    filas.append(tr); return tr;
  }
  const MAX_MS = 120000;                           // una prueba colgada (un aviso que nunca se contesta) falla en vez de parar la batería
  async function preparar() {
    const fr = $('mesa');
    await new Promise(r => { fr.onload = r; fr.src = '../index.html?regresion=' + Date.now(); });
    W = fr.contentWindow; D = W.document;
    await hasta(() => W.MESA && W.MESA.status && W.MESA.libre && W.MESA.libre.version && W.MESA._in, 15000, 'que carguen mesa.js y libre.js');
    M = W.MESA;
    // index.html lanza MESA.boot() sin esperarlo: termina cuando la mesa tiene su armazón y no está cambiando de tablero
    await hasta(() => M._in.shellReady() && !M._in.switching(), 15000, 'que la mesa termine de arrancar');
    ok(!M._in.locked, 'la mesa está abierta en otra pestaña de este puerto: ciérrala');
    const ajenos = [...(await M.boards()).filter(b => b.client !== CLIENTE).map(b => b.key), ...(await M.clients()).filter(c => c.id !== CLIENTE).map(c => c.id)];
    ok(!ajenos.length, `este puerto tiene datos que no son de prueba (${ajenos.slice(0, 4).join(', ')}${ajenos.length > 4 ? '…' : ''}): pasa la batería en una copia con un puerto nuevo`);
  }
  // lo que la mesa deja en localStorage (último tablero, guías…) vuelve a como estaba antes de la batería
  const lsFoto = () => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]));
  function lsVolver(f) {
    Object.keys(localStorage).forEach(k => { if (!(k in f)) localStorage.removeItem(k); });
    Object.entries(f).forEach(([k, v]) => { if (localStorage.getItem(k) !== v) localStorage.setItem(k, v); });
  }
  async function pasar() {
    const go = $('go'); go.disabled = true;
    const solo = (new URLSearchParams(location.search).get('solo') || '').split(',').map(s => s.trim()).filter(Boolean);
    const lista = solo.length ? T.filter(t => solo.includes(t.id)) : T;
    filas.innerHTML = '';
    const res = { ok: false, version: null, pasan: 0, fallan: 0, pruebas: [] };
    const ls0 = lsFoto();
    let listo = false;
    try {
      const raras = solo.filter(id => !T.some(t => t.id === id));
      ok(!raras.length, 'no existen las pruebas ' + raras.join(', '));
      await preparar();
      listo = true;
      res.version = M.version + ' · libre ' + M.libre.version;
      for (const t of lista) {
        const tr = fila(t), t0 = performance.now();
        tr.className = 'corre'; tr.querySelector('.r').textContent = 'corre';
        $('resumen').textContent = `Pasando ${t.id}…`;
        let err = null, reloj;
        try { await Promise.race([t.fn(), new Promise((_, no) => { reloj = setTimeout(() => no(new Error(`sin terminar en ${MAX_MS / 1000} s`)), MAX_MS); })]); }
        catch (e) { err = e; }
        finally { clearTimeout(reloj); }
        try { if (M.libre.abierto()) M.libre.cerrar(); M._in.closeDetail(); } catch (e) { /* */ }
        const ms = Math.round(performance.now() - t0);
        tr.className = err ? 'mal' : 'ok'; tr.querySelector('.r').textContent = err ? 'falla' : 'pasa';
        tr.querySelector('.d').textContent = ms + ' ms';
        if (err) { tr.querySelector('.err').textContent = String((err && err.message) || err); console.error(t.id, err); }
        res.pruebas.push({ id: t.id, ok: !err, ms, error: err ? String(err.message || err) : null });
        res[err ? 'fallan' : 'pasan']++;
      }
    } catch (e) {
      res.error = String((e && e.message) || e);
    }
    if (listo) {                                     // la limpieza, aparte: un fallo suyo no tapa el resultado de las pruebas
      try {
        await limpiar();
        const r = await M.removeClient(CLIENTE);
        ok(r === true && !(await M.boards()).some(b => b.client === CLIENTE), 'no se pudo borrar el cliente de prueba: ' + r);
      } catch (e) { res.limpieza = String((e && e.message) || e); }
    }
    if (listo && !res.fallan && !res.limpieza) {     // sin fallos, la mesa de prueba se cierra (suelta el bloqueo de otras pestañas)
      await new Promise(r => { $('mesa').onload = r; $('mesa').src = 'about:blank'; });
    }
    lsVolver(ls0);
    res.ok = !res.error && !res.limpieza && lista.length > 0 && res.fallan === 0;
    window.RESULTADO = res;
    $('resumen').textContent = (res.error ? 'No se pudo pasar la batería: ' + res.error
      : `Mesa ${res.version}: ${res.pasan} pasan, ${res.fallan} fallan, de ${lista.length}.`)
      + (res.limpieza ? ' Limpieza: ' + res.limpieza : '');
    go.disabled = false;
    return res;
  }
  window.pasarBateria = pasar;
  $('go').disabled = false; $('go').onclick = pasar;
  $('resumen').textContent = `${T.length} pruebas listas.`;
  if (new URLSearchParams(location.search).has('auto')) pasar();
})();
