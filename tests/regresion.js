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
  const CLIENTE2 = 'prueba-regresion-b', NOMBRE2 = 'Otro cliente de prueba';   // el segundo cliente (bandeja por cliente, D-041)
  const DE_PRUEBA = c => c === CLIENTE || c === CLIENTE2;
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
    if (M.revisar && M.revisar._reset) M.revisar._reset();   // una revisión de «sube» pendiente no llega a la prueba siguiente
    await M.flush();                               // el guardado va con retraso: purge borra las fotos que nombra el tablero guardado
    for (const b of await M.boards()) if (DE_PRUEBA(b.client)) await M.purge(b.key);   // con su último mes se va la bandeja del cliente (D-041)
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

  // ---------- «Revisar» (revisar.js, D-040) ----------
  const revisarUI = async () => { await pulsar('.bar [data-act="revisar"]'); return hasta(() => q('.detail:not([hidden])[data-dlg="revisar"]'), 8000, 'el diálogo de la revisión'); };
  const puntos = r => r.puntos.map(x => [x.slotId, x.diapositiva, x.tipo, x.bloquea, x.donde]);

  prueba('M12', '«Revisar»: lista por publicación y diapositiva; un hueco vacío bloquea y un clic abre esa diapositiva en el editor (D-040, D-035)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel')]);
    await poner('r1', [await foto('rv-a.jpg'), await foto('rv-b.jpg')]);
    await poner('r2', [await foto('rv-c.jpg'), await foto('rv-d.jpg')]);
    await abrirEditor('r1');
    accion('sl-add'); const p = ed().i;
    compDe(p).els.push(huecoEl('hx', 0.1, 0.1, 0.8, 0.8));
    await aplicarEditor();
    const r = await M.revisar();
    igual(puntos(r), [['r1', p + 1, 'hueco', true, 'editor']], 'la revisión por la API');
    ok(!r.ok && r.bloquean === 1 && r.avisos === 0, 'el resumen: ' + json(r));
    const d = await revisarUI(), txt = d.textContent;
    ok(txt.includes('Carrusel 1.1') && txt.includes(`Diapositiva ${p + 1}: hueco de foto vacío`) && /\(bloquea\)/.test(txt) && !txt.includes('Carrusel 1.2'), 'la lista: ' + txt);
    ok(txt.includes(NOMBRE) && /noviembre 2026/i.test(txt), 'no dice de qué cliente y mes es: ' + txt);
    d.querySelector('[data-act="rv-ir"]').click();
    await hasta(() => M.libre.abierto() && ed() && ed().i === p, 6000, 'el editor abierto en esa diapositiva');
    ok(!q('.detail:not([hidden])[data-dlg="revisar"]'), 'el diálogo sigue abierto');
  });

  prueba('M13', '«Revisar»: la numeración que no cuadra con su sitio o con el total, a mano («02 / 11») o automática y desfasada; la que cuadra no sale y nada de eso bloquea (D-040, D-038)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('rn-a.jpg'), await foto('rn-b.jpg'), await foto('rn-c.jpg')]);
    await abrirEditor('r1', 1);
    accion('add-txt'); compDe(1).els.find(e => e.t === 'texto').txt = '02 / 11';
    accion('sl', { i: 2 }); accion('add-txt'); compDe(2).els.find(e => e.t === 'texto').txt = '03 / 3';   // a mano y bien
    accion('add-txt'); const t = compDe(2).els.filter(e => e.t === 'texto')[1]; elegir(t); accion('num', { v: 'a' });
    await aplicarEditor();
    let r = await M.revisar();
    igual(r.puntos.map(x => [x.diapositiva, x.tipo, x.texto]), [[2, 'numeración', '«02 / 11» no cuadra: es la 2 de 3']], 'la numeración a mano');
    const s1 = M._in.S.slots.find(x => x.id === 'r1'), n = s1.libre.slides[s1.photos[2]].els.find(e => e.num);   // el tablero de verdad (M.board() es una copia)
    igual(n && n.txt, '03 / 3', 'la numeración automática');
    n.txt = '04 / 4';                              // una automática que se quedó atrás
    try {
      r = await M.revisar();
      ok(r.puntos.some(x => x.diapositiva === 3 && x.tipo === 'numeración' && x.texto === 'la numeración dice «04 / 4» y le toca «03 / 3»'), 'la automática desfasada: ' + json(r.puntos));
      ok(r.ok && !r.bloquean && r.avisos === 2, 'la numeración bloquea o falta un aviso: ' + json(r));
    } finally { n.txt = '03 / 3'; }
  });

  prueba('M14', '«Revisar»: fotos de menos de 1080 px, encuadradas en la mesa o dibujadas en una diapositiva; un clic abre la publicación (D-040)', async () => {
    await tablero([pub(1), pub(2), pub(3, 'Carrusel'), pub(4)]);
    await poner('r1', [await foto('rr-a.jpg', 800, 1000)]);             // pequeña
    await poner('r4', [await foto('rr-e.jpg', 700, 900)]); M.setEstado(['r4'], 'cancelado');   // cancelada: no se mira
    const [f2] = await poner('r2', [await foto('rr-b.jpg')]);            // 1200 de ancho: bien…
    await poner('r3', [await foto('rr-c.jpg'), await foto('rr-d.jpg')]);
    let r = await M.revisar();
    igual(puntos(r), [['r1', 1, 'resolución', false, 'post']], 'solo la pequeña');
    ok(/800 px/.test(r.puntos[0].texto), r.puntos[0].texto);
    M._test.setCrop(f2, 'r2', { z: 2 });                                  // …hasta que se amplía al doble: 600 px
    await abrirEditor('r3', 1); accion('add-txt');                         // la 2.ª diapositiva, dibujada, con su foto al doble en el marco
    compDe(1).els.find(e => e.t === 'foto').z = 2;
    await aplicarEditor();
    r = await M.revisar();
    igual(puntos(r), [['r1', 1, 'resolución', false, 'post'], ['r2', 1, 'resolución', false, 'post'], ['r3', 2, 'resolución', false, 'editor']], 'las tres');
    ok(/600 px/.test(r.puntos[1].texto) && /equivale a \d+ px/.test(r.puntos[2].texto) && r.ok, json(r.puntos.map(x => x.texto)));
    const d = await revisarUI();
    d.querySelector('[data-act="rv-ir"][data-slot="r1"]').click();
    await hasta(() => q('.detail:not([hidden])') && q('.detail').dataset.slot === 'r1' && !q('.detail').dataset.dlg, 4000, 'la ventana de la publicación');
  });

  prueba('M15', '«Revisar»: textos fuera del margen del kit, por su tinta y no por su caja, también girados; sin kit no se mira (D-040)', async () => {
    const kit0 = M.diseno.kit;
    const conKit = async k => { M.diseno.kit = async () => k; try { return await M.revisar(); } finally { M.diseno.kit = kit0; } };   // solo durante la revisión
    const KIT = { lienzo: { ancho: 1080, margen: 80 } };                   // margen de 80 (de 1080)
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('rm-a.jpg'), await foto('rm-b.jpg')]);
    let r = await conKit(KIT);
    ok(!r.puntos.length, 'sin textos ya hay avisos: ' + json(r.puntos));
    await abrirEditor('r1', 1);
    const texto = (txt, o) => { accion('add-txt'); const t = compDe(1).els.filter(e => e.t === 'texto').pop(); Object.assign(t, { txt, al: 'izq', rot: 0 }, o); };
    texto('Fuera', { x: 0.02, y: 0.3, w: 0.5 });                         // empieza antes del margen (80 / 1080 = 0,074)
    texto('Dentro', { x: 0.1, y: 0.45, w: 0.8 });
    texto('Corta', { x: 0.1, y: 0.6, w: 0.89 });                         // su caja pasa el margen derecho; su tinta, no
    texto('Una línea bastante larga que gira con la diapositiva', { x: 0.08, y: 0.1, w: 0.84, al: 'cen', rot: 30 });   // girada, se sale por arriba
    texto('Aire', { x: 0.5, y: (80 / 1080 * 1440 - 20) / 1800, w: 0.3, size: 0.06, lh: 2 });   // su caja pasa el margen de arriba; sus letras, no
    await aplicarEditor();
    r = await conKit(KIT);
    igual(puntos(r), [['r1', 2, 'margen', false, 'editor']], 'un aviso de margen, en la 2.ª diapositiva');
    const x = r.puntos[0].texto;
    ok(/^2 textos fuera del margen del kit/.test(x) && x.includes('«Fuera»') && x.includes('«Una línea bastante larga') && !x.includes('Dentro') && !x.includes('Corta') && !x.includes('Aire'), x);
    r = await conKit({ error: 'Este cliente aún no tiene kit de diseño.' });
    ok(!r.puntos.length, 'sin kit avisa del margen: ' + json(r.puntos));
  });

  prueba('M16', '«Revisar»: un carrusel en 3:4 se avisa (Instagram por API admite de 4:5 a 1,91:1); 4:5, Horizontal y la portada 9:16 de un reel, no (D-040)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel'), pub(3, 'Reel'), pub(4)]);
    await poner('r1', [await foto('rf-a.jpg'), await foto('rf-b.jpg')]);
    await poner('r2', [await foto('rf-c.jpg'), await foto('rf-d.jpg')]);
    await poner('r3', [await foto('rf-e.jpg', 1080, 1920)]);
    await poner('r4', [await foto('rf-f.jpg', 2000, 1200)]);              // horizontal
    M._test.setFmt('r1', 'v34');
    const r = await M.revisar();
    igual(puntos(r), [['r1', null, 'formato', false, 'post']], 'solo el 3:4');
    ok(/formato 3:4/.test(r.puntos[0].texto) && /4:5 a 1,91:1/.test(r.puntos[0].texto) && r.ok, r.puntos[0].texto);
  });

  prueba('M17', '«sube» pasa la revisión sola sobre lo enviado (dos llamadas seguidas, una revisión): el hueco vacío no se sube y el resto sí (D-040, D-035)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2), pub(3)]);
    await poner('r1', [await foto('ra-a.jpg'), await foto('ra-b.jpg')]);
    const [f2] = await poner('r2', [await foto('ra-c.jpg', 800, 1000)]);
    await poner('r3', [await foto('ra-d.jpg', 700, 900)]);               // no se sube ahora: no sale
    await abrirEditor('r1'); accion('sl-add'); compDe(ed().i).els.push(huecoEl('hx', 0.1, 0.1, 0.8, 0.8)); await aplicarEditor();
    const f0 = W.fetch; W.fetch = async () => { throw new TypeError('sin red (prueba)'); };   // ninguna subida sale de aquí
    try {
      const it = (fileId, slotId) => ({ fileId, slotId, url: 'http://127.0.0.1:9/subir', auth: 'prueba' });
      const r1 = slot('r1').photos;
      ok(q('.detail:not([hidden])[data-slot="r1"]'), 'tras «Aplicar» no quedó abierta la publicación');   // con algo abierto, no se lo cierra: una nota
      M.startUpload(r1.map(f => it(f, 'r1')));
      await hasta(() => qa('.toast').some(t => /antes de subir a Notion: 1 punto bloquea\. Pulsa «Revisar»/.test(t.textContent)), 8000, 'la nota de la revisión');
      ok(q('.detail:not([hidden])[data-slot="r1"]') && !q('.detail[data-dlg="revisar"]'), 'la revisión cerró la publicación abierta');
      M._in.closeDetail();
      const raiz = q('#mesa'); raiz.classList.add('client');   // «Vista cliente»: ni diálogo ni nota
      try {
        M.startUpload([it(f2, 'r2')]); await espera(1700); await M.revisar.ultima;
        ok(!dialogo() && !qa('.toast').some(t => /Revisión antes/.test(t.textContent) && /1 aviso\./.test(t.textContent)), 'la revisión salió en la vista cliente');
      } finally { raiz.classList.remove('client'); }
      M.startUpload(r1.map(f => it(f, 'r1'))); M.startUpload([it(f2, 'r2')]);
      const d = await hasta(() => q('.detail:not([hidden])[data-dlg="revisar"]'), 8000, 'la revisión al subir'), txt = d.textContent;
      ok(/antes de subir a Notion/.test(txt) && txt.includes('Carrusel 1.1') && /hueco de foto vacío/.test(txt) && txt.includes('Foto 1.2') && /800 px/.test(txt) && !txt.includes('Foto 1.3'), 'el diálogo: ' + txt);
      ok(r1.every(f => M.uploads[f] && M.uploads[f].state === 'error' && /hueco/.test(M.uploads[f].err)), 'la publicación con hueco no se rechazó: ' + json(r1.map(f => M.uploads[f])));
      await M.waitUpload([f2], 15000);
      ok(M.uploads[f2] && !/hueco/.test(M.uploads[f2].err || ''), 'la foto pequeña no se intentó subir: ' + json(M.uploads[f2]));
    } finally { W.fetch = f0; }
  });

  // ---------- la bandeja del cliente (D-041) ----------
  const vista = todas => M._in.bandejaVista({ todas }).map(x => M.files[x.f].name + (x.u ? ' ✓' : ''));
  const enBandejaUI = () => qa('.tray .titem').map(t => M.files[t.dataset.file].name + (t.classList.contains('uso') ? ' ✓' : ''));
  const abrirMes = (slots, mes, cliente = CLIENTE, nombre = NOMBRE) => M.init({ client: cliente, clientName: nombre, month: mes, slots, past: [], force: true });
  const filtro = async v => { await pulsar(`.tray [data-act="tfil"][data-v="${v}"]`); };

  prueba('M18', 'Bandeja por cliente: la misma en todos sus meses; una foto usada en cualquier mes lleva ✓ y solo sale en «Todas»; la de un cliente nunca sale en otro (D-041)', async () => {
    await tablero([pub(1), pub(2)]);
    const [a] = await poner('r1', [await foto('m18-a.jpg')]);
    await M.addFiles([await foto('m18-b.jpg'), await foto('m18-c.jpg')]);
    await filtro('sin');
    igual(vista(false), ['m18-b.jpg', 'm18-c.jpg'], '«Sin usar» en noviembre');
    igual(enBandejaUI(), ['m18-b.jpg', 'm18-c.jpg'], 'la bandeja de la mesa con «Sin usar»');
    await filtro('todas');
    igual(enBandejaUI(), ['m18-b.jpg', 'm18-c.jpg', 'm18-a.jpg ✓'], 'la bandeja de la mesa con «Todas»');
    ok(!q(`.tray .titem[data-file="${a}"] [data-act="del"]`), 'una foto usada se puede quitar de la mesa desde la bandeja');
    await M.flush();
    // diciembre, el mismo cliente: la misma bandeja, y la usada en noviembre con ✓
    await abrirMes([pub(5, 'Foto', 3, '2026-12')], '2026-12');
    await hasta(() => vista(true).includes('m18-a.jpg ✓'), 6000, 'la foto usada en noviembre, con ✓, en diciembre');
    igual(vista(false), ['m18-b.jpg', 'm18-c.jpg'], '«Sin usar» en diciembre');
    const b = M.board().tray.find(f => M.files[f].name === 'm18-b.jpg');
    M._test.place('r5-2026-12', b);
    igual(vista(false), ['m18-c.jpg'], 'tras usarla en diciembre sigue en «Sin usar»');
    ok(q('.tray .tcount').textContent.includes('1 sin usar'), 'la cuenta de la bandeja: ' + q('.tray .tcount').textContent);
    await M.flush();
    await M.open(`${CLIENTE}-${MES}`);
    await hasta(() => vista(true).includes('m18-b.jpg ✓'), 6000, 'en noviembre, la usada en diciembre con ✓');
    igual(vista(false), ['m18-c.jpg'], '«Sin usar» en noviembre tras usar otra en diciembre');
    // otro cliente: su bandeja, sin nada del primero
    await abrirMes([pub(9)], MES, CLIENTE2, NOMBRE2);
    await espera(300);
    igual([M.board().tray.length, vista(true)], [0, []], 'la bandeja del otro cliente');
    await M.addFiles([await foto('m18-otra.jpg')]);
    await M.flush();
    await M.open(`${CLIENTE}-${MES}`);
    ok(!vista(true).includes('m18-otra.jpg'), 'la foto del otro cliente salió en este');
    await filtro('sin');
  });

  prueba('M19', 'Colab: una foto que sale de una publicación compartida vuelve a la bandeja del cliente que la trajo, nunca a la del otro; una suya con el mismo nombre se queda (D-041, D-008)', async () => {
    const col = { id: 'c19', name: 'COLLAB Noviembre 1', type: 'Foto', date: `${MES}-20T12:00:00.000+01:00` };
    await tablero([pub(1), col]);
    const [a] = await poner('c19', [await foto('m19.jpg')]);
    await M.flush();
    await abrirMes([pub(2), col], MES, CLIENTE2, NOMBRE2);
    igual(slot('c19').photos, [a], 'la colab no tiene la foto en el otro cliente');
    igual(vista(true), [], 'la foto de la colab salió en la bandeja del otro cliente');
    const [mia] = await M.addFiles([await foto('m19.jpg')]);              // la misma foto (nombre y tamaño), del otro cliente
    ok(mia && mia !== a, 'el otro cliente reutilizó la foto del primero');
    M._test.unassign('c19');
    await M.flush();
    await hasta(() => qa('.toast').some(t => t.textContent.includes(`vuelve a la bandeja de ${NOMBRE}`)), 4000, 'el aviso de que vuelve a su cliente');
    igual(M.board().tray, [mia], 'la bandeja del otro cliente tras quitar la foto de la colab');
    await M.open(`${CLIENTE}-${MES}`);
    ok(M.board().tray.includes(a), 'la foto no volvió a la bandeja de su cliente');
    ok(await M._test.fileRec(mia), 'la foto del otro cliente se borró');
  });

  prueba('M20', 'Migración: las bandejas de cada mes de antes de la 3.44 se juntan en la del cliente sin repetir fotos (mismo id o mismo nombre y tamaño) y salen de los tableros (D-041)', async () => {
    await tablero([pub(1)]);
    const [x, y] = await M.addFiles([await foto('m20-x.jpg'), await foto('m20-y.jpg')]);
    await abrirMes([pub(5, 'Foto', 3, '2026-12')], '2026-12');
    const [z] = await M.addFiles([await foto('m20-z.jpg')]);
    await abrirMes([pub(9)], MES, CLIENTE2, NOMBRE2);                     // con otro cliente abierto: nada en memoria pisa lo de abajo
    // como lo dejaba la 3.43: cada mes con su bandeja y ninguna del cliente; diciembre, el más reciente, tiene otra copia de x
    const x2 = M._in.newId(); await M._in.idbPut('files', x2, await M._in.idbGet('files', x));
    const nov = await M._in.idbGet('boards', `${CLIENTE}-${MES}`), dic = await M._in.idbGet('boards', `${CLIENTE}-2026-12`);
    nov.tray = [x, y]; nov.savedAt = '2026-10-01T10:00:00.000Z'; dic.tray = [z, x2, y]; dic.savedAt = '2026-10-02T10:00:00.000Z';
    await M._in.idbPut('boards', nov.key, nov); await M._in.idbPut('boards', dic.key, dic); await M._in.idbDel('bandejas', CLIENTE);
    await M.open(`${CLIENTE}-${MES}`);
    const t = M.board().tray;
    igual(t, [z, x2, y], 'la bandeja juntada (la del mes más reciente primero, una vez cada foto)');
    for (const k of [nov.key, dic.key]) ok(!('tray' in (await M._in.idbGet('boards', k))), `el tablero ${k} sigue con su bandeja`);
    igual(((await M._in.idbGet('bandejas', CLIENTE)) || {}).tray, t, 'la bandeja guardada del cliente');
    await M.open(`${CLIENTE}-2026-12`);
    igual(M.board().tray, t, 'diciembre no tiene la misma bandeja');
    await hasta(async () => !(await M._test.fileRec(x)), 6000, 'que se borre la copia repetida');
  });

  prueba('M21', '«⇅ Exportar» lleva la bandeja de cada cliente (archivo v3) e «Importar» la devuelve; un archivo de antes (v2, la bandeja en el tablero) se junta al importar (D-041, D-017)', async () => {
    await tablero([pub(1)]);
    await poner('r1', [await foto('m21-a.jpg')]);
    await M.addFiles([await foto('m21-b.jpg'), await foto('m21-c.jpg')]);
    await M.flush();
    const antes = M.board().tray.slice(), key = `${CLIENTE}-${MES}`;
    const d = JSON.parse(await (await M.exportAll({ returnBlob: true })).text());
    ok(d.v === 3, 'versión del archivo: ' + d.v);
    igual((d.bandejas.find(r => r.client === CLIENTE) || {}).tray, antes, 'la bandeja en el archivo');
    ok(d.boards.every(b => !('tray' in b)), 'un tablero del archivo lleva bandeja');
    ok(antes.every(f => d.files[f]), 'faltan fotos de la bandeja en el archivo');
    await M.purge(key);
    ok(!(await M._in.idbGet('bandejas', CLIENTE)), 'la bandeja no se fue con el último mes');
    let r = await M.importData(d, { confirm: false });
    ok(r && !r.error, 'importar falló: ' + json(r));
    await M.open(key);
    igual(M.board().tray, antes, 'la bandeja importada');
    // un archivo de antes de la 3.44: v2, sin bandejas, con la bandeja en el tablero
    const v2 = JSON.parse(JSON.stringify(d)); v2.v = 2; delete v2.bandejas; v2.boards.find(b => b.key === key).tray = antes.slice();
    await M.purge(key);
    r = await M.importData(v2, { confirm: false });
    ok(r && !r.error, 'importar el archivo v2 falló: ' + json(r));
    await M.open(key);
    igual(M.board().tray, antes, 'la bandeja del archivo v2');
    ok(!('tray' in (await M._in.idbGet('boards', key))), 'el tablero importado del archivo v2 sigue con su bandeja');
  });

  prueba('M22', 'Una foto con ✓ puesta en otra casilla del mismo mes avisa y entra como copia: las dos casillas la tienen y la bandeja la enseña una vez; si se cancela, la copia no se queda (D-041, D-022)', async () => {
    await tablero([pub(1), pub(2), pub(3)]);
    const [a] = await poner('r1', [await foto('m22.jpg')]);
    await poner('r2', [await foto('m22-b.jpg')]);
    await poner('r3', [await foto('m22-c.jpg')]);
    await filtro('todas');
    const aCasilla = async (nombre, id) => {                             // pulsar la foto (una vez en la bandeja, sea cual sea su copia), «Colocar en una casilla» y la casilla
      const ti = await hasta(() => qa('.tray .titem').find(t => M.files[t.dataset.file].name === nombre), 4000, 'la foto en la bandeja');
      ti.click(); await pulsar('[data-act="tvsel"]'); celda(id).click();
      return hasta(() => { const d = dialogo(); return d && d.querySelector('[data-act="repe"][data-m="usar"]') && d; }, 4000, 'el aviso de foto ya usada');
    };
    (await aCasilla('m22.jpg', 'r2')).querySelector('[data-act="repe"][data-m="usar"]').click();
    await pulsar('[data-act="addmode"][data-m="replace"]');
    await hasta(() => M.files[slot('r2').photos[0]] && M.files[slot('r2').photos[0]].name === 'm22.jpg', 4000, 'la foto en la segunda casilla');
    const copia = slot('r2').photos[0];
    ok(copia !== a && slot('r1').photos[0] === a, 'no entró como copia: ' + json([slot('r1').photos, slot('r2').photos]));
    igual(vista(true).filter(x => x.startsWith('m22.jpg')), ['m22.jpg ✓'], 'la bandeja enseña la foto más de una vez');
    // cancelar en «Sustituir / Añadir»: la copia hecha no se queda
    const antes = new Set(M._in.delList());
    (await aCasilla('m22.jpg', 'r3')).querySelector('[data-act="repe"][data-m="usar"]').click();
    await hasta(() => q('.detail:not([hidden])[data-dlg="addmode"]'), 4000, 'el diálogo Sustituir / Añadir');
    await pulsar('.detail:not([hidden]) .x[data-act="close"]');
    const nueva = M._in.delList().find(f => !antes.has(f));
    ok(nueva && nueva !== copia && M.files[slot('r3').photos[0]].name === 'm22-c.jpg', 'tras cancelar cambió la casilla o no hay copia que borrar');
    await M.flush();
    await M.open(`${CLIENTE}-${MES}`);
    await hasta(async () => !(await M._test.fileRec(nueva)), 6000, 'que se borre la copia sin usar');
    ok(await M._test.fileRec(copia), 'se borró la copia que sí se usa');
    await filtro('sin');
  });

  prueba('M23', '«Importar» trae los logos del editor que ningún post usa: los de un cliente nuevo y el que una importación de antes de la 3.45 dejó sin su archivo (D-042, D-017)', async () => {
    await tablero([pub(1)]);
    const c = D.createElement('canvas'); c.width = 80; c.height = 40; c.getContext('2d').fillRect(0, 0, 80, 40);
    const png = await new Promise(r => c.toBlob(r, 'image/png')), id = `kit-${CLIENTE}-logo-m23`;
    await M._in.idbPut('files', id, { name: 'm23-logo.png', size: png.size, type: 'image/png', w: 80, h: 40, lastModified: Date.now(), blob: png, thumb: png, logo: true });   // como lo guarda el editor, sin ponerlo en ninguna diapositiva
    const c0 = await M._in.idbGet('clients', CLIENTE); ok(c0, 'no está el cliente de prueba');
    await M._in.idbPut('clients', CLIENTE, { ...c0, libre: { ...(c0.libre || {}), logos: [id] }, libreAt: new Date().toISOString() });
    const d = JSON.parse(await (await M.exportAll({ returnBlob: true })).text());
    ok(d.files[id], 'el logo sin usar no va en el archivo');
    // el cliente ya está, sin el archivo de su logo (lo que dejaba importar hasta la 3.44)
    await M._in.idbDel('files', id); delete M.files[id];
    let r = await M.importData(d, { confirm: false });
    ok(r && !r.error, 'importar falló: ' + json(r));
    ok(await M._test.fileRec(id), 'importar no devolvió el logo que le faltaba al cliente');
    // un cliente nuevo: su logo sin usar llega con él
    const id2 = `kit-${CLIENTE2}-logo-m23`, c1 = d.clients.find(x => x.id === CLIENTE);
    if ((await M.clients()).some(x => x.id === CLIENTE2)) { const r2 = await M.removeClient(CLIENTE2); ok(r2 === true, 'no se pudo borrar el segundo cliente de prueba: ' + r2); }   // lo dejan las pruebas de la bandeja (sin meses)
    r = await M.importData({ ...d, clients: [{ ...c1, id: CLIENTE2, name: NOMBRE2, libre: { ...c1.libre, logos: [id2] } }], boards: [], bandejas: [], past: {}, files: { [id2]: d.files[id] } }, { confirm: false });
    ok(r && !r.error, 'importar el cliente nuevo falló: ' + json(r));
    ok(await M._test.fileRec(id2), 'el logo sin usar del cliente nuevo no llegó');
    for (const f of [id, id2]) await M._in.idbDel('files', f);
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
    await ver('foto a toda la diapositiva', '4:5', null);       // un formato de la lista, sin recortar: su botón marcado (D-044)
    ok(ed().el.querySelector('.lb-panel [data-lb="t-rat"][data-v="4:5"].on'), 'foto a toda la diapositiva: el botón 4:5 no sale marcado');
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

  // ---------- mesa 3.41: exportar con huecos vacíos ----------

  prueba('E31', '«⇅ Exportar» con un hueco de foto vacío no se para: exporta todo y luego la revisión dice dónde está (cliente, mes, publicación y diapositiva) (D-037, D-040)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel')]);
    await poner('r1', [await foto('ex-a.jpg'), await foto('ex-b.jpg')]);
    await poner('r2', [await foto('ex-c.jpg'), await foto('ex-d.jpg')]);
    await abrirEditor('r1');
    accion('sl-add'); const p = ed().i;
    compDe(p).els.push(huecoEl('hx', 0.1, 0.1, 0.8, 0.8));
    await aplicarEditor();
    await hasta(() => celda('r1') && celda('r1').querySelector('.dot.hv'), 4000, 'la marca «Hueco vacío» en la casilla');
    // la descarga, interceptada; todo se restaura
    const LS = 'mesa-export-descarga', antes = W.localStorage.getItem(LS), A = W.HTMLAnchorElement.prototype, click = A.click;
    let cap = null;
    A.click = function () { if (this.download) cap = { name: this.download, href: this.href }; else click.call(this); };
    try {
      W.localStorage.setItem(LS, '1');             // este navegador descarga: sin diálogo de guardar
      await pulsar('[data-act="xfer"]'); await pulsar('[data-act="xfer-export"]');
      const dl = await hasta(() => q('.detail:not([hidden])[data-dlg="revisar"]'), 15000, 'la revisión con el hueco vacío tras exportar');   // D-040: el aviso de D-037 va en la revisión
      ok(cap, 'con un hueco vacío no se exportó (no hubo descarga)');
      const d = JSON.parse(await (await (await W.fetch(cap.href)).blob()).text());
      const b = d.boards.find(x => x.key === `${CLIENTE}-${MES}`), s1 = b && b.slots.find(x => x.id === 'r1');
      ok(s1 && s1.photos.length === 3 && Object.values(s1.libre.slides).some(c => c.els.some(e => e.t === 'hueco')), 'el archivo no lleva la publicación con su hueco tal cual');
      const txt = dl.textContent;
      ok(txt.includes('Carrusel 1.1') && new RegExp(`diapositiva ${p + 1}: hueco de foto vacío`, 'i').test(txt) && txt.includes(NOMBRE) && /noviembre 2026/i.test(txt), 'el aviso no dice dónde está el hueco: ' + txt);
      ok(!txt.includes('Carrusel 1.2'), 'el aviso nombra una publicación sin hueco vacío');
      ok(/Exportada: 1 mes/.test(txt), 'el aviso no dice que se exportó: ' + txt);
      await pulsar('.detail[data-dlg="revisar"] .btn[data-act="close"]');
      ok(!dialogo(), '«Entendido» no cerró el aviso');
      const r = await M.exportAll();               // también por la API: dónde está, y sin huecos no hay aviso
      igual(json(r.huecos), json([{ client: CLIENTE, month: MES, slotId: 'r1', post: 'Carrusel 1.1', diapositivas: [p + 1] }]), 'exportAll() no dice dónde está el hueco');
      await pulsar('.detail[data-dlg="revisar"] .btn[data-act="close"]');
      await abrirEditor('r1'); accion('sl-del', { i: p });          // quitar la diapositiva del hueco: sin huecos, sin aviso
      if (ed().ask) ed().ask.querySelector('[data-ask="borrar"]').click();
      await aplicarEditor();
      const r2 = await M.exportAll();
      await M.revisar.ultima;                       // la revisión de esa exportación, ya terminada
      ok(r2 && r2.ok && r2.huecos.length === 0 && !q('.detail:not([hidden])[data-dlg="revisar"]'), 'sin huecos vacíos ni otros avisos salió la revisión: ' + json(r2 && r2.huecos));
    } finally {
      A.click = click;
      if (antes == null) W.localStorage.removeItem(LS); else W.localStorage.setItem(LS, antes);
    }
  });

  // ---------- numeración automática y formas nuevas (lote 4) ----------
  const numeros = () => ed().sl.map((x, i) => { const e = compDe(i).els.find(q => q.num); return e ? e.txt : null; });   // el texto numerado de cada diapositiva
  const numerosDe = s => s.photos.map(f => { const c = s.libre && s.libre.slides[f], e = c && c.els.find(q => q.num); return e ? e.txt : null; });
  async function pixeles(fid) {                    // la imagen aplicada, para leer sus píxeles: px(x, y) = gris medio 0–255
    const bm = await W.createImageBitmap(await M._in.getBlob(fid)), c = D.createElement('canvas'); c.width = bm.width; c.height = bm.height;
    const x = c.getContext('2d'); x.drawImage(bm, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    return { w: c.width, h: c.height, px: (a, b) => { const k = (Math.round(b) * c.width + Math.round(a)) * 4; return (d[k] + d[k + 1] + d[k + 2]) / 3; } };
  }
  const oscuro = (img, x, y, que) => ok(img.px(x, y) < 90, `${que}: en (${Math.round(x)}, ${Math.round(y)}) no hay trazo (${Math.round(img.px(x, y))})`);
  const claro = (img, x, y, que) => ok(img.px(x, y) > 180, `${que}: en (${Math.round(x)}, ${Math.round(y)}) hay trazo (${Math.round(img.px(x, y))})`);
  function deslizar(lb, v) { const i = q(`.lb-panel input[data-lb="${lb}"]`); ok(i, `no está el control ${lb}`); i.value = v; i.dispatchEvent(new W.Event('input', { bubbles: true })); }

  prueba('E32', 'Numeración: posición real y total, portada incluida; la portada nunca la lleva; se pone al día al añadir, borrar, mover o duplicar (D-038)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    const fs = []; for (let k = 0; k < 7; k++) fs.push(await foto(`nu-${k}.jpg`));
    await poner('r1', fs);
    await abrirEditor('r1');
    accion('add-txt');                             // en la portada la opción no existe
    ok(!q('.lb-panel [data-lb="num"]'), 'en la portada sale «Numeración»');
    accion('num', { v: 'a' }); ok(!compDe(0).els.some(e => e.num), 'la portada se numeró');
    accion('sl', { i: 1 }); accion('add-txt');
    await pulsar('.lb-panel [data-lb="num"][data-v="a"]');
    igual(numeros(), [null, '02 / 7', null, null, null, null, null], 'la 2.ª de 7');
    ok(!q('.lb-panel textarea[data-lb="txt"]'), 'un texto numerado se puede escribir');
    igual(qa('.lb-panel [data-lb="num-f"]').map(b => b.textContent), ['02 / 7', '2/7', '02'], 'los formatos que ofrece');
    accion('num-f', { v: 'b' }); igual(numeros()[1], '2/7', 'formato 2/7');
    accion('num-f', { v: 'c' }); igual(numeros()[1], '02', 'formato 02');
    accion('num-f', { v: 'a' });
    ed().sel = null; ed().mas = []; tecla('d', { meta: true });          // ⌘D: duplica la diapositiva, numerada
    igual(numeros(), [null, '02 / 8', '03 / 8', null, null, null, null, null], 'tras duplicar');
    accion('sl', { i: 7 }); accion('sl-add');      // una nueva no la lleva y cambia el total
    igual(numeros(), [null, '02 / 9', '03 / 9', null, null, null, null, null, null], 'tras añadir una diapositiva');
    accion('sl', { i: 2 }); tecla('d', { meta: true }); accion('sl-dn', { i: 3 }); accion('sl-dn', { i: 4 }); accion('sl-dn', { i: 5 }); accion('sl-dn', { i: 6 }); accion('sl-dn', { i: 7 }); accion('sl-dn', { i: 8 });
    igual(numeros(), [null, '02 / 10', '03 / 10', null, null, null, null, null, null, '10 / 10'], 'la última, tras moverla al final');
    accion('sl-up', { i: 1 });                     // pasa a ser la portada: su número se oculta
    igual(numeros(), ['', null, '03 / 10', null, null, null, null, null, null, '10 / 10'], 'la numerada que pasa a ser la primera');
    ok(compDe(0).els.find(e => e.num).num.f === 'a', 'en la portada perdió su numeración');
    accion('sl-up', { i: 1 });                     // y vuelve a verse si deja de serlo
    igual(numeros()[1], '02 / 10', 'al dejar de ser la portada');
    accion('sl-del', { i: 8 });                    // vacía: se borra sin preguntar
    igual(numeros(), [null, '02 / 9', '03 / 9', null, null, null, null, null, '09 / 9'], 'tras borrar una diapositiva');
    accion('undo'); igual(numeros().length, 10, '⌘Z no devolvió la diapositiva'); igual(numeros()[9], '10 / 10', '⌘Z no devolvió los números');
    // quitar la numeración: queda el número de ahora como texto normal
    accion('sl', { i: 9 }); elegir(compDe(9).els.find(e => e.num)); accion('num', { v: '' });
    const t9 = compDe(9).els.find(e => e.t === 'texto'); ok(!t9.num && t9.txt === '10 / 10', 'al quitar la numeración: ' + json(t9.txt));
    accion('undo');
    await aplicarEditor();
    const s = slot('r1'); igual(s.photos.length, 10, 'las diapositivas aplicadas');
    igual(numerosDe(s), [null, '02 / 10', '03 / 10', null, null, null, null, null, null, '10 / 10'], 'los números de lo aplicado');
  });

  prueba('E33', 'Numeración desde la mesa: mover, quitar o poner de portada una diapositiva redibuja sus números; ⌘Z lo deshace todo junto (D-038)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    const fs = []; for (let k = 0; k < 4; k++) fs.push(await foto(`nm-${k}.jpg`));
    await poner('r1', fs);
    await abrirEditor('r1', 1);
    accion('add-txt'); elegir(compDe(1).els.find(e => e.t === 'texto')); accion('num', { v: 'a' });
    accion('copy'); accion('sl', { i: 2 }); accion('paste');                 // pegar un texto numerado: numerado en su diapositiva
    igual(numeros(), [null, '02 / 4', '03 / 4', null], 'el texto numerado pegado');
    await aplicarEditor();
    const s = slot('r1'), antes = s.photos.slice();
    igual(numerosDe(s), [null, '02 / 4', '03 / 4', null], 'lo aplicado');
    M._test.movePhoto('r1', 1, 3);                 // la 2.ª al final
    await hasta(() => M.libre.aplicando(), 8000, 'que la mesa empiece a redibujar');   // 8 s: con el panel oculto los temporizadores van más lentos (falló con 3 s en la 3.43)
    const r0 = await M.libre.abrir('r1');          // mientras redibuja, el editor no abre (sus imágenes cambiarían debajo)
    ok(r0 && r0.error && /redibujando/.test(r0.error) && !M.libre.abierto(), 'el editor abrió mientras se redibujaba: ' + json(r0));
    await hasta(() => json(numerosDe(slot('r1'))) === json([null, '02 / 4', null, '04 / 4']), 8000, 'los números redibujados tras mover en la mesa');
    const tras = slot('r1').photos.slice(); await espera(400);
    igual(slot('r1').photos, tras, 'se sigue redibujando sin cambios');
    M._test.undo();                                 // ⌘Z: el orden y las imágenes de antes, a la vez
    await espera(300);
    igual(slot('r1').photos, antes, '⌘Z no devolvió las imágenes de antes'); igual(numerosDe(slot('r1')), [null, '02 / 4', '03 / 4', null], '⌘Z: los números');
    M._test.setCover('r1', 2);                      // la 3.ª de portada: su número se oculta
    await hasta(() => json(numerosDe(slot('r1'))) === json(['', null, '03 / 4', null]), 8000, 'los números tras cambiar la portada');
    M._test.unassign('r1', 3);                      // una menos: cambia el total
    await hasta(() => json(numerosDe(slot('r1'))) === json(['', null, '03 / 3']), 8000, 'los números tras quitar una diapositiva');
  });

  prueba('E34', 'Al abrir un post con textos como «02 / 11», ofrece convertirlos todos; «Ahora no» no vuelve a preguntar (D-038)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('nc-a.jpg'), await foto('nc-b.jpg'), await foto('nc-c.jpg')]);
    await abrirEditor('r1');
    accion('add-txt'); compDe(0).els.find(e => e.t === 'texto').txt = '01 / 11';
    accion('sl', { i: 1 }); accion('add-txt'); compDe(1).els.find(e => e.t === 'texto').txt = '02 / 11';
    accion('sl', { i: 2 }); accion('add-txt'); compDe(2).els.find(e => e.t === 'texto').txt = '3/11';
    accion('sl-add'); accion('add-txt'); compDe(3).els.find(e => e.t === 'texto').txt = '28/10';   // una fecha: no se ofrece
    await aplicarEditor();
    await abrirEditor('r1');
    const a = await hasta(() => q('.lb-ask'), 4000, 'la pregunta de numerar');
    ok(/3 textos/.test(a.textContent) && /portada/.test(a.textContent), 'la pregunta: ' + a.textContent);
    a.querySelector('[data-ask="num"]').click();
    igual(numeros(), ['', '02 / 4', '3/4', null], 'convertidos, con su formato');
    M.libre.cerrar();
    await abrirEditor('r1');                       // sin aplicar: sigue preguntando; «Ahora no» ya no
    (await hasta(() => q('.lb-ask [data-ask="seguir"]'), 4000, 'la pregunta otra vez')).click();
    igual(numeros(), [null, null, null, null], '«Ahora no» convirtió algo');
    M.libre.cerrar(); await abrirEditor('r1'); await espera(150);
    ok(!q('.lb-ask'), 'tras «Ahora no» volvió a preguntar');
  });

  prueba('E35', 'Numeración: una diapositiva nueva no la lleva; copiar o pegar una numerada, sí; una plantilla «Solo textos» no la pasa (D-038)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel')]);
    await poner('r1', [await foto('np-a.jpg'), await foto('np-b.jpg')]);
    await poner('r2', [await foto('np-c.jpg'), await foto('np-d.jpg'), await foto('np-e.jpg')]);
    await abrirEditor('r1', 1);
    accion('add-txt'); elegir(compDe(1).els.find(e => e.t === 'texto')); accion('num', { v: 'b' }); accion('pil', { v: '1' });
    accion('sl-add'); ok(!compDe(2).els.length, 'la diapositiva nueva lleva algo');
    igual(numeros(), [null, '2/3', null], 'con una nueva');
    accion('sl', { i: 1 }); const t = await guardarPlant();
    accion('sl', { i: 2 }); aplicarPlant(t, 'textos');
    ok(compDe(2).els.some(e => e.t === 'texto') && !compDe(2).els.some(e => e.num || e.pil), '«Solo textos» pasó la numeración o la píldora');
    accion('undo'); aplicarPlant(t, 'todo');
    igual(numeros(), [null, '2/3', '3/3'], '«Todo» con la plantilla numerada');
    accion('tpl-quitar'); ok(!q('.lb-ask'), '«Quitar plantilla» preguntó sin cambios (su número se puso al día)');
    igual(numeros(), [null, '2/3', null], '«Quitar plantilla»'); accion('undo');
    accion('sl', { i: 1 }); ed().sel = null; ed().mas = []; accion('sl-copy');
    await aplicarEditor();
    await abrirEditor('r2', 1); accion('paste');   // en otro post: detrás de la 2.ª
    igual(numeros(), [null, null, '3/4', null], 'la diapositiva numerada pegada en otro post');
  });

  prueba('E36', 'Flecha (una punta o dos) y línea con grosor en px de 1080 y trazo continuo, discontinuo o punteado; colores solo del kit (D-039, D-016)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('fl-a.jpg')]);
    await abrirEditor('r1');
    const { H } = tam(), PXK = 1080 / 1440;
    const nueva = (forma) => { accion('sl-add'); accion('add-forma', { v: forma }); const e = compDe(ed().i).els.find(x => x.t === 'forma'); elegir(e); accion('fc', { c: '#000000' }); return ed().i; };
    const f1 = nueva('flecha'), a = compDe(f1).els[0];
    ok(a.forma === 'flecha' && a.puntas === 'der', 'la flecha nueva: ' + json(a));
    cerca(a.h * H * PXK / 4, 4.5, 0.06, 'el grosor de la flecha nueva (px de 1080)');
    deslizar('gr', 10);
    cerca(compDe(f1).els[0].h * H * PXK / 4, 10, 0.06, 'el grosor de 10 px'); deslizar('gr', 4.5);
    ok(q('.lb-panel [data-lb="puntas"][data-v="dos"]') && q('.lb-panel [data-lb="trazo"][data-v="punt"]'), 'faltan «Puntas» o «Trazo» en el panel');
    const kit = new Set([...(ed().kit ? ed().kit.grupos.flatMap(g => g.cols.map(k => k.c.toLowerCase())) : []), '#000000', '#ffffff']);
    ok(qa('.lb-panel .lb-sw[data-lb="fc"]').every(b => kit.has(b.dataset.c.toLowerCase())), 'un color fuera del kit en la flecha');
    const f2 = nueva('flecha'); accion('puntas', { v: 'dos' });
    const l1 = nueva('linea'); cerca(compDe(l1).els[0].h * H * PXK, 4.5, 0.06, 'el grosor de la línea nueva');
    const l2 = nueva('linea'); accion('trazo', { v: 'disc' });
    const l3 = nueva('linea'); accion('trazo', { v: 'punt' });
    accion('sl', { i: l1 }); accion('cap', { id: compDe(l1).els[0].id }); deslizar('gr', 12);
    cerca(compDe(l1).els[0].h * H * PXK, 12, 0.06, 'el grosor de 12 px de la línea'); cerca(compDe(l1).els[0].y + compDe(l1).els[0].h / 2, 0.5, 0.001, 'la línea no siguió centrada');
    await aplicarEditor();
    const s = slot('r1'), [A1, A2, L1, L2, L3] = await Promise.all([f1, f2, l1, l2, l3].map(i => pixeles(s.photos[i])));
    const x0 = 0.15 * 1440, x1 = 0.85 * 1440, y = A1.h / 2;   // 1440 × 1800: la flecha de 216 a 1224, 24 px de alto (puntas), 6 de trazo
    oscuro(A1, x1 - 5, y, 'la punta de la flecha'); oscuro(A1, x1 - 19, y - 9, 'la base de la punta'); claro(A1, x1 - 5, y - 9, 'fuera de la punta');
    oscuro(A1, x0 + 4, y, 'el arranque de la flecha'); claro(A1, x0 + 16, y - 7, 'una punta en el arranque de la flecha de una punta');
    oscuro(A2, x0 + 16, y - 7, 'la punta del arranque, con dos'); oscuro(A2, x1 - 19, y - 9, 'la punta del final, con dos');
    oscuro(L1, 700, y + 5, 'la línea de 12 px'); claro(L1, 700, y + 9, 'fuera de la línea de 12 px');
    oscuro(L2, x0 + 9, y, 'el 1.er trazo del discontinuo'); claro(L2, x0 + 24, y, 'el 1.er hueco del discontinuo'); oscuro(L2, x0 + 39, y, 'el 2.º trazo del discontinuo'); oscuro(L2, x1 - 3, y, 'el final del discontinuo');
    oscuro(L3, x0 + 3, y, 'el 1.er punto'); claro(L3, x0 + 9, y, 'entre puntos'); oscuro(L3, x1 - 3, y, 'el último punto');
  });

  prueba('E37', 'Píldora: un texto con una píldora detrás, del ancho del texto, con su color del kit; «Sin píldora» la quita (D-039, D-016)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('pi-a.jpg')]);
    await abrirEditor('r1');
    accion('sl-add'); accion('add-pil');
    const e = compDe(1).els.find(x => x.t === 'texto');
    ok(e && e.pil && e.pil.c === '#000000' && e.color === '#ffffff' && e.txt === 'Etiqueta', 'la píldora nueva (fondo claro: negra, texto blanco): ' + json(e));
    ok(q('.lb-panel [data-lb="pil"][data-v="1"].on'), '«Con píldora» no sale marcado');
    const kit = new Set([...(ed().kit ? ed().kit.grupos.flatMap(g => g.cols.map(k => k.c.toLowerCase())) : []), '#000000', '#ffffff']);
    ok(qa('.lb-panel .lb-sw[data-lb="pc"]').length && qa('.lb-panel .lb-sw[data-lb="pc"]').every(b => kit.has(b.dataset.c.toLowerCase())), 'los colores de la píldora no son los del kit');
    const h1 = e.h; accion('pil', { v: '' });
    const e2 = compDe(1).els.find(x => x.t === 'texto'); ok(!e2.pil && e2.h < h1, '«Sin píldora» no la quitó o no ajustó el alto');
    accion('pil', { v: '1' }); ok(compDe(1).els.find(x => x.t === 'texto').pil, '«Con píldora» no la puso');
    const p = compDe(1).els.find(x => x.t === 'texto'), { H } = tam(), cx = (p.x + p.w / 2) * 1440, top = p.y * H, bot = (p.y + p.h) * H;
    accion('add-pil'); const v = compDe(1).els[compDe(1).els.length - 1]; v.txt = ''; v.y = 0.15;   // una píldora vacía: no sale en la imagen
    await aplicarEditor();
    const img = await pixeles(slot('r1').photos[1]);
    claro(img, cx, (0.15 + v.h / 2) * H, 'una píldora vacía salió en la imagen');
    oscuro(img, cx, top + 4, 'la píldora encima del texto'); oscuro(img, cx, bot - 4, 'la píldora debajo del texto');
    claro(img, cx, top - 4, 'fuera de la píldora'); claro(img, p.x * 1440 + 3, (top + bot) / 2, 'la píldora no se ciñe al texto');
  });

  prueba('E38', 'La bandeja del editor es la de la mesa: las mismas fotos, ✓ y el mismo filtro «Sin usar / Todas»; lo que entra en una sale en la otra (D-041)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2)]);
    await poner('r1', [await foto('e38-p.jpg')]);
    await poner('r2', [await foto('e38-u.jpg')]);
    const [t1, t2] = await M.addFiles([await foto('e38-t1.jpg'), await foto('e38-t2.jpg')]);
    M._in.trayFiltro('sin');
    await abrirEditor('r1');
    if (!ed().trOpen) accion('bandeja');
    const enEd = () => qa('.lb-tray .lb-tph').map(b => M.files[b.dataset.f].name + (b.classList.contains('uso') ? ' ✓' : ''));
    igual(enEd(), ['e38-t1.jpg', 'e38-t2.jpg'], 'la bandeja del editor con «Sin usar»');
    accion('tr-fil', { v: 'todas' });
    ok(M._in.trayTodas(), 'el filtro del editor no es el de la mesa');
    igual(enEd(), ['e38-t1.jpg', 'e38-t2.jpg', 'e38-p.jpg ✓', 'e38-u.jpg ✓'], 'la bandeja del editor con «Todas»');
    accion('tr-add', { f: t1 });                                          // a la diapositiva: en uso aquí
    await hasta(() => enEd().includes('e38-t1.jpg ✓'), 4000, 'la foto puesta en la diapositiva, con ✓');
    accion('tr-fil', { v: 'sin' });
    igual(enEd(), ['e38-t2.jpg'], '«Sin usar» con una foto puesta en la diapositiva');
    await M.addFiles([await foto('e38-n.jpg')], null, { tray: true });   // suelta en la bandeja del editor
    accion('bandeja'); accion('bandeja');
    igual(enEd(), ['e38-n.jpg', 'e38-t2.jpg'], 'la foto soltada en la bandeja del editor');
    ok(M.board().tray.includes(t2) && M.board().tray.some(f => M.files[f].name === 'e38-n.jpg'), 'la foto del editor no está en la bandeja de la mesa');
    M.libre.cerrar();
    await espera(100);
    igual(vista(false), ['e38-n.jpg', 'e38-t1.jpg', 'e38-t2.jpg'], 'la bandeja de la mesa al cerrar sin aplicar');
    igual(enBandejaUI(), ['e38-n.jpg', 'e38-t1.jpg', 'e38-t2.jpg'], 'la bandeja de la mesa en pantalla');
  });

  prueba('E39', 'Desde la bandeja del editor, una foto con ✓ de otra publicación del mes entra como copia; las de este post, no; el panel de fotos solo da las sin usar de la bandeja (D-041)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2)]);
    const [p] = await poner('r1', [await foto('e39-p.jpg')]);
    const [u] = await poner('r2', [await foto('e39-u.jpg')]);
    const [t] = await M.addFiles([await foto('e39-t.jpg')]);
    M._in.trayFiltro('todas');
    await abrirEditor('r1');
    const usar = () => { const b = ed().el.querySelector('.lb-ask [data-ask="usar"]'); if (b) b.click(); return b; };   // el aviso del editor (D-022)
    accion('tr-add', { f: u });
    await hasta(usar, 4000, 'el aviso de foto ya usada');
    const e = await hasta(() => compDe(0).els.find(x => x.t === 'foto' && x.src !== p), 4000, 'la foto de la otra publicación en la diapositiva');
    ok(e.src !== u && M.files[e.src].name === 'e39-u.jpg', 'no entró como copia: ' + e.src);
    accion('sl-add'); accion('tr-add', { f: p });                         // una de este post: la misma, sin copia
    const e2 = await hasta(() => { usar(); return compDe(1).els.find(x => x.t === 'foto'); }, 4000, 'la foto de este post en la diapositiva 2');
    ok(e2.src === p, 'una foto de este post entró como copia');
    const D0 = M._in.bandejaVista({ todas: false, sin: 'r1' }).map(x => x.f);
    ok(D0.includes(t) && !D0.includes(u), 'las sin usar de la bandeja: ' + json(D0));
    M.libre.cerrar();
    M._in.trayFiltro('sin');
  });

  // ---------- mesa 3.46 (libre 1.20): la caja de un texto, sus líneas; el botón de una proporción exacta ----------
  prueba('E40', 'La caja de un texto se ciñe a sus líneas: un clic en lo que sobra elige lo de debajo; ampliar por un lado o una esquina no rompe sus líneas ni lo mueve (D-043)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); accion('add-forma', { v: 'rect' }); accion('add-txt');
    const [r, t] = compDe(0).els;
    Object.assign(r, { x: 0.02, y: 0.3, w: 0.96, h: 0.4 });   // lejos de sus tiradores
    Object.assign(t, { x: 0.1, y: 0.45, w: 0.85, txt: 'Hola mundo', al: 'izq', rot: 0 });
    ed().sel = null; ed().mas = []; await dibujado();
    const { W: w, H: h } = tam(), cy = (t.y + t.h / 2) * h, h0 = t.h, m = await M.libre.rev.medida(t, w, h);
    ok(m && m.x1 < (t.x + t.w * 0.6) * w, 'el texto de prueba no deja media caja vacía: ' + json(m));
    const clic = (x, y) => { const [a, b] = aVentana(x, y); puntero('pointerdown', ed().cv, a, b); puntero('pointerup', ed().cv, a, b); };
    clic((t.x + t.w * 0.9) * w, cy);
    igual(ed().sel, r.id, 'un clic en lo que sobra de la caja del texto no eligió la forma de debajo');
    await espera(650);
    clic(m.x0 + 6, cy);
    igual(ed().sel, t.id, 'un clic sobre las letras no eligió el texto');
    await espera(650); await dibujado();
    const arrastra = (x0, y0, x1, y1) => { const [a, b] = aVentana(x0, y0), [c, d] = aVentana(x1, y1); puntero('pointerdown', ed().cv, a, b, { ctrl: true }); puntero('pointermove', ed().cv, (a + c) / 2, (b + d) / 2, { ctrl: true }); puntero('pointermove', ed().cv, c, d, { ctrl: true }); puntero('pointerup', ed().cv, c, d, { ctrl: true }); };
    arrastra(m.x1, cy, m.x1 + 40, cy);   // el tirador del lado está en el borde de las letras, no en el de la caja
    const t1 = compDe(0).els.find(e => e.id === t.id);
    cerca(t1.x, 0.1, 0.0001, 'ampliar por el lado movió el texto');
    cerca(t1.w * w, m.x1 - m.x0 + 40, 2, 'el lado no fija el ancho de las líneas en el borde de las letras más lo arrastrado');
    igual(t1.h, h0, 'ampliar por el lado cambió sus líneas');
    await dibujado();
    const m1 = await M.libre.rev.medida(t1, w, h), s0 = t1.size;
    arrastra(m1.x1, (t1.y + t1.h) * h, m1.x1 + 60, (t1.y + t1.h) * h + 60 * t1.h * h / (m1.x1 - m1.x0));   // la esquina de abajo a la derecha
    const t2 = compDe(0).els.find(e => e.id === t.id), k = t2.size / s0;
    ok(k > 1.05, 'la esquina no amplió el texto: ' + json({ s0, s: t2.size }));
    cerca(t2.h / h0, k, 0.01, 'la esquina rompió sus líneas (el alto no crece como la letra)');
    cerca(t2.x, 0.1, 0.0001, 'la esquina de abajo a la derecha movió el lado izquierdo');
    cerca(t2.y, t.y, 0.0001, 'la esquina de abajo a la derecha movió el borde de arriba');
    // centrado: el clic en un lado de la caja, fuera de las letras, tampoco lo elige; la caja guardada no cambia
    Object.assign(t2, { al: 'cen', x: 0.1, w: 0.85, size: s0 }); ed().sel = null; await dibujado();
    const mc = await M.libre.rev.medida(t2, w, h), cyc = (t2.y + t2.h / 2) * h;
    await espera(650); clic((t2.x + 0.02) * w, cyc);
    igual(ed().sel, r.id, 'centrado: un clic en el borde izquierdo de la caja, lejos de las letras, eligió el texto');
    await espera(650); clic((mc.x0 + mc.x1) / 2, cyc);
    igual(ed().sel, t.id, 'centrado: un clic en el centro de las letras no eligió el texto');
    igual([t2.x, t2.w], [0.1, 0.85], 'elegirlo cambió su caja guardada');
    M.libre.cerrar();
  });

  prueba('E41', '«Proporción del marco»: un marco con un formato exacto de la lista, sin recortar la foto, marca su botón y no lo escribe debajo; recortado o libre, como antes (D-044)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('tres-dos.jpg', 1500, 1000)]);   // 3:2
    await abrirEditor('r1');
    const { W: w, H: h } = tam(), el = compDe(0).els[0], rp = () => ed().el.querySelector('.lb-panel .lb-ratp'), on = () => qa('.lb-panel [data-lb="t-rat"].on').map(b => b.dataset.v);
    const ver = async () => { delete ed().tOri; tecla('a', { meta: true }); await dibujado(); };
    Object.assign(el, { x: 0, y: 0.1, w: 1, h: (w / 1.5) / h }); delete el.rat;
    await ver();
    igual(on(), ['3:2'], 'un marco 3:2 sin recortar no marca su botón');
    igual(rp(), null, 'un marco 3:2 sin recortar sigue escribiendo la proporción debajo');
    ok(q('.lb-panel [data-lb="t-ori"][data-v="h"].on'), 'un marco 3:2 no abre «Horizontal»');
    Object.assign(el, { h: (w / 1.5 + 0.6) / h });                   // medio píxel fuera de 3:2: dentro del margen
    await ver(); igual(on(), ['3:2'], 'casi 3:2 (medio píxel) no marca su botón');
    Object.assign(el, { x: 0.25, w: 0.5, h: (0.5 * w / 0.8) / h }); delete el.fit;   // un marco 4:5: la foto 3:2, recortada
    await ver();
    igual(on(), [], 'un recorte personalizado marca un botón');
    ok(rp() && /^Foto 3:2 · marco /.test(rp().textContent), 'un recorte personalizado no dice el formato de la foto y el del marco: ' + (rp() && rp().textContent));
    Object.assign(el, { x: 0, w: 1, h: (w / 1.37) / h });
    await ver();
    igual(on(), [], 'un marco libre marca un botón');
    Object.assign(el, { w: 1, h: (w / 1.2) / h }); await ver();   // escrito a mano hasta un formato de la lista, sin recortar: se marca al escribir
    const al = ed().el.querySelector('.lb-panel input[data-lb="mal"]');
    ok(al && rp() && on().length === 0, 'no está el campo del alto, o un marco 1,20:1 marca un botón');
    al.value = '720'; al.dispatchEvent(new W.Event('input', { bubbles: true })); await dibujado();   // 1080 × 720: 3:2
    igual(on(), ['3:2'], 'al escribir el alto hasta 3:2 no se marca su botón');
    igual(rp(), null, 'al escribir el alto hasta 3:2 sigue escrito debajo');
    M.libre.cerrar();
  });

  prueba('E42', 'F: la foto elegida, original y entera, o la diapositiva, en toda la ventana; Esc, F o un clic la cierran; ningún otro atajo actúa; escribiendo, nada (D-045)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('grande.jpg', 1500, 1000)]);   // 3:2 en un marco 4:5: recortada
    await abrirEditor('r1');
    const el = compDe(0).els[0], f0 = json(el), fv = () => ed().fv, vw = D.documentElement.clientWidth, vh = D.documentElement.clientHeight;
    elegir(el); await dibujado();
    tecla('f');
    ok(fv() && fv().isConnected, 'F con una foto elegida no abrió la vista');
    const img = await hasta(() => { const i = fv().querySelector('img'); return i && i.complete && i.naturalWidth ? i : null; }, 4000, 'la foto en grande');
    igual([img.naturalWidth, img.naturalHeight], [1500, 1000], 'F no enseña la foto original entera');
    const r = fv().getBoundingClientRect();
    igual([r.left, r.top, Math.round(r.width), Math.round(r.height)], [0, 0, vw, vh], 'la vista no ocupa toda la ventana');
    ok(/grande\.jpg · 1500 × 1000 px/.test(fv().textContent), 'no dice el nombre y los px de la foto: ' + fv().textContent);
    tecla('Backspace'); tecla('z', { meta: true }); tecla('t');
    igual(compDe(0).els.map(e => e.id), [el.id], 'con la vista abierta, otro atajo cambió la diapositiva');
    tecla('f'); ok(!fv(), 'F otra vez no la cerró');
    igual(ed().sel, el.id, 'cerrar la vista soltó la foto');
    ed().sel = null; ed().mas = []; await dibujado();             // sin nada elegido: la diapositiva, en su proporción
    tecla('f');
    const cv = fv() && fv().querySelector('canvas'); ok(cv, 'F sin nada elegido no enseña la diapositiva');
    const { W: w, H: h } = tam(), cw = parseFloat(cv.style.width), ch = parseFloat(cv.style.height);
    cerca(cw / ch, w / h, 0.01, 'la diapositiva no sale en su proporción');
    ok(Math.abs(ch - vh) < 1 || Math.abs(cw - vw) < 1, 'la diapositiva no llena la ventana: ' + json({ cw, ch, vw, vh }));
    tecla('Escape'); ok(!fv(), 'Esc no cerró la vista');
    ok(M.libre.abierto(), 'Esc cerró también el editor');
    accion('add-txt'); await dibujado();                          // un texto elegido: la diapositiva; un clic la cierra
    tecla('f'); ok(fv() && fv().querySelector('canvas'), 'F con un texto elegido no enseña la diapositiva');
    fv().click(); ok(!fv(), 'un clic no cerró la vista');
    const ta = q('.lb-panel textarea[data-lb="txt"]'); ok(ta, 'no está el campo del texto');
    ta.focus(); const ev = teclaEv('f', { en: ta });
    ok(!fv() && !ev.defaultPrevented, 'F actuó mientras se escribía en un texto');
    ta.blur();
    igual(json(compDe(0).els[0]), f0, 'ver en grande cambió la foto');
    M.libre.cerrar();
  });

  prueba('E43', 'Color de un logo o pegatina: todo pasa a un color plano (solo kit y básicos), con su forma y transparencia; «Original» lo devuelve; ⌘Z; sin color, como antes (D-046, D-016)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    const c = D.createElement('canvas'); c.width = 200; c.height = 100; const x = c.getContext('2d');
    x.fillStyle = '#ff0000'; x.fillRect(0, 0, 100, 100); x.fillStyle = '#00ff00'; x.fillRect(100, 0, 100, 100); x.clearRect(80, 30, 40, 40);   // dos colores y un agujero
    const png = await new Promise(r => c.toBlob(r, 'image/png')), id = `kit-${CLIENTE}-logo-e43`;
    await M._in.idbPut('files', id, { name: 'e43-logo.png', size: png.size, type: 'image/png', w: 200, h: 100, lastModified: Date.now(), blob: png, thumb: png, logo: true });
    const c0 = await M._in.idbGet('clients', CLIENTE); ok(c0, 'no está el cliente de prueba');
    await M._in.idbPut('clients', CLIENTE, { ...c0, libre: { ...(c0.libre || {}), logos: [id] }, libreAt: new Date().toISOString() });
    await abrirEditor('r1');
    accion('sl-add'); await hasta(() => M.files[id], 4000, 'el logo del cliente en el editor');
    compDe(0).bg = '#0000ff';
    accion('logo', { f: id });
    const lg = compDe(0).els.find(e => e.t === 'logo'); ok(lg, 'no entró el logo');
    const { W: w, H: h } = tam(); Object.assign(lg, { x: 0.1, y: 0.2, w: 0.8, h: 0.4 * w / h });
    const x0 = 0.1 * w, y0 = 0.2 * h, lw = 0.8 * w, cy = y0 + 0.4 * w / 2;
    const roj = [x0 + lw * 0.2, cy], ver = [x0 + lw * 0.8, cy], agu = [x0 + lw * 0.5, cy];
    const es = (p, rgb, tol = 24) => { const v = pixel(...p); return rgb.every((c, k) => Math.abs(v[k] - c) <= tol); };
    const ve = async (r, v, a, que) => { await hasta(async () => { await dibujado(); return es(roj, r) && es(ver, v) && es(agu, a); }, 4000, que); };
    await ve([255, 0, 0], [0, 255, 0], [0, 0, 255], 'el logo sin color no se ve con sus colores y su agujero');
    ok(q('.lb-panel [data-lb="lc"][data-c=""].on'), '«Original» no sale marcado en un logo sin color');
    igual(qa('.lb-panel [data-lb="lc"][data-c^="#"]').map(b => b.dataset.c), ['#000000', '#ffffff'], 'sin kit, el selector no da solo negro y blanco');
    q('.lb-panel [data-lb="lc"][data-c="#000000"]').click();
    igual(compDe(0).els.find(e => e.t === 'logo').tint, '#000000', 'el color no quedó en el logo');
    await ve([0, 0, 0], [0, 0, 0], [0, 0, 255], 'con un color, el logo no pasa entero a ese color con su agujero');
    ok(q('.lb-panel [data-lb="lc"][data-c="#000000"].on') && !q('.lb-panel [data-lb="lc"][data-c=""].on'), 'el selector no marca el color elegido');
    tecla('z', { meta: true });
    ok(!compDe(0).els.find(e => e.t === 'logo').tint, '⌘Z no quitó el color');
    await ve([255, 0, 0], [0, 255, 0], [0, 0, 255], 'tras ⌘Z el logo no vuelve a sus colores');
    elegir(compDe(0).els.find(e => e.t === 'logo')); accion('lc', { c: '#ffffff' }); accion('lc', { c: '' });
    ok(!('tint' in compDe(0).els.find(e => e.t === 'logo')), '«Original» no devolvió el logo a sus colores');
    M.libre.cerrar();
  });

  prueba('E44', 'Borde «Fuera»: rodea el marco sin tapar la foto; la caja, el clic y los tiradores van por fuera y una esquina no deforma la foto; a sangre, el borde en el canto y la foto dentro; «Dentro», como antes (D-047)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('borde.jpg', 1200, 1500)]);
    await abrirEditor('r1');
    const { W: w, H: h } = tam(), el = compDe(0).els[0];
    compDe(0).bg = '#0000ff';
    Object.assign(el, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 * w / 0.8 / h, b: 0.02, bc: '#ff0000' }); delete el.fit;
    const bw = 0.02 * w, x0 = 0.25 * w, cy = (el.y + el.h / 2) * h, x1 = x0 + 0.5 * w, y1 = (el.y + el.h) * h;
    const rojo = p => { const v = pixel(...p); return v[0] > 200 && v[1] < 60 && v[2] < 60; }, azul = p => { const v = pixel(...p); return v[2] > 200 && v[0] < 60 && v[1] < 60; };
    const nada = async () => { ed().sel = null; ed().mas = []; await dibujado(); };
    await nada();
    await hasta(async () => { await dibujado(); return rojo([x0 + bw / 2, cy]) && azul([x0 - bw / 2, cy]); }, 4000, '«Dentro» (sin elegir) tapa el borde de la foto como antes');
    elegir(el); accion('bo', { v: 'fuera' });
    igual(compDe(0).els[0].bo, 'fuera', '«Fuera» no quedó en la foto');
    igual([el.x, el.w, el.b], [0.25, 0.5, 0.02], '«Fuera» movió o cambió la foto');
    await nada();
    ok(rojo([x0 - bw / 2, cy]) && !rojo([x0 + bw / 2, cy]) && !azul([x0 + bw / 2, cy]), '«Fuera» no deja el borde fuera del marco y la foto entera dentro');
    const clic = (x, y) => { const [a, b] = aVentana(x, y); puntero('pointerdown', ed().cv, a, b); puntero('pointerup', ed().cv, a, b); };
    clic(x0 - bw / 2, cy); igual(ed().sel, el.id, 'un clic en el borde de fuera no elige la foto');
    await dibujado();
    const r0 = (el.w * w) / (el.h * h), [a, b] = aVentana(x1 + bw, y1 + bw), [c, d] = aVentana(x1 + bw + 80, y1 + bw + 80);   // el tirador de abajo a la derecha, en la esquina de fuera
    puntero('pointerdown', ed().cv, a, b, { ctrl: true }); puntero('pointermove', ed().cv, (a + c) / 2, (b + d) / 2, { ctrl: true }); puntero('pointermove', ed().cv, c, d, { ctrl: true }); puntero('pointerup', ed().cv, c, d, { ctrl: true });
    const e1 = compDe(0).els[0];
    ok(e1.w > 0.5 + 0.02, 'la esquina de fuera no amplió la foto: ' + e1.w);
    cerca((e1.w * w) / (e1.h * h), r0, 0.004, 'la esquina deformó la foto');
    cerca(e1.x * w, x0, 1, 'la esquina de abajo movió el lado izquierdo de la foto');
    igual(e1.b, 0.02, 'ampliar cambió el borde');
    Object.assign(e1, { x: 0, y: 0, w: 1, h: 1 }); delete e1.fit;   // a sangre: el borde en el canto, la foto dentro
    await nada();
    ok(rojo([bw / 2, h / 2]) && rojo([w - bw / 2, h / 2]) && rojo([w / 2, bw / 2]) && rojo([w / 2, h - bw / 2]), 'a sangre, el borde no está en el canto de la diapositiva');
    ok(!rojo([bw * 1.5, h / 2]) && !azul([bw * 1.5, h / 2]), 'a sangre, la foto no llega hasta el borde');
    elegir(e1); accion('bo', { v: '' });
    ok(!('bo' in compDe(0).els[0]), '«Dentro» no volvió al borde de siempre');
    M.libre.cerrar();
  });

  prueba('E45', 'Edición múltiple: «Lo que comparten» de fotos, textos o mezclados; «Varios» si difieren, sin cambiar nada; se aplica a todos y se deshace con un ⌘Z (D-048)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    const [, fb] = await poner('r1', [await foto('multi-a.jpg', 1200, 1500), await foto('multi-b.jpg', 1500, 1000)]);
    await abrirEditor('r1');
    accion('bg', { c: '#000000' });                                 // la diapositiva pasa a ser una composición
    const { W: w, H: h } = tam(), c = compDe(0), f1 = c.els.find(e => e.t === 'foto');
    Object.assign(f1, { x: 0.05, y: 0.1, w: 0.4, h: 0.4 * w / 0.8 / h, b: 0.01, r: 0.2 }); delete f1.fit;
    c.els.push({ ...JSON.parse(json(f1)), id: 'f2', src: fb, x: 0.55, w: 0.3, h: 0.3 * w / 1.5 / h, b: 0.02, r: 0.2 });
    accion('add-txt'); accion('add-txt');
    const [t1, t2] = compDe(0).els.filter(e => e.t === 'texto');
    Object.assign(t1, { size: 0.05, color: '#ffffff', al: 'izq', y: 0.6 }); Object.assign(t2, { size: 0.08, color: '#ffffff', al: 'cen', y: 0.75 });
    const dos = (a, b) => { accion('cap', { id: a }); q(`.lb-panel .lb-cap[data-id="${b}"]`).dispatchEvent(new W.MouseEvent('click', { bubbles: true, shiftKey: true })); igual([ed().sel, ...ed().mas].sort(), [a, b].sort(), 'no quedaron elegidos los dos'); };
    const sec = () => qa('.lb-panel .lb-sec').find(s => /Lo que comparten/.test(s.textContent));
    const fotos = () => compDe(0).els.filter(e => e.t === 'foto').map(e => [e.w, e.h, e.b, e.bo || '', e.r]);
    // dos fotos: el tamaño y el borde difieren, las esquinas no
    dos(f1.id, 'f2');
    const antes = json(compDe(0)), s1 = sec(); ok(s1, 'con dos fotos no sale «Lo que comparten»');
    const an = s1.querySelector('input[data-lb="fan"]'); ok(an && an.value === '' && an.placeholder === 'Varios', 'el tamaño distinto no sale como «Varios»');
    ok(s1.querySelector('input[data-lb="b"]').closest('.lb-mix') && /Varios/.test(s1.querySelector('input[data-lb="b"]').closest('label').textContent), 'el borde distinto no dice «Varios»');
    ok(!s1.querySelector('input[data-lb="r"]').closest('.lb-mix'), 'las esquinas iguales salen como «Varios»');
    ok(!s1.querySelector('[data-lb="font"], [data-lb="size"], [data-lb="tc"]'), 'con dos fotos salen ajustes de texto');
    igual(json(compDe(0)), antes, 'enseñar «Varios» cambió algo');
    const r1 = (f1.w * w) / (f1.h * h), r2 = (0.3 * w) / (0.3 * w / 1.5);
    an.value = '540'; an.dispatchEvent(new W.Event('input', { bubbles: true }));
    const [g1, g2] = compDe(0).els.filter(e => e.t === 'foto');
    igual([g1.w, g2.w], [0.5, 0.5], 'el ancho no cambió las dos fotos');
    cerca((g1.w * w) / (g1.h * h), r1, 0.003, 'el ancho deformó la primera foto'); cerca((g2.w * w) / (g2.h * h), r2, 0.003, 'el ancho deformó la segunda foto');
    igual([g1.x, g2.x], [0.05, 0.55], 'el ancho movió la esquina de una foto');
    tecla('z', { meta: true });
    igual(compDe(0).els.filter(e => e.t === 'foto').map(e => e.w), [0.4, 0.3], 'un ⌘Z no devolvió las dos fotos');
    accion('bo', { v: 'fuera' });
    igual(fotos().map(f => f[3]), ['fuera', 'fuera'], '«Fuera» no se aplicó a las dos');
    tecla('z', { meta: true });
    igual(fotos().map(f => f[3]), ['', ''], 'un ⌘Z no quitó «Fuera» de las dos');
    // dos textos: el tamaño y la alineación difieren
    dos(t1.id, t2.id);
    const s2 = sec(); ok(s2, 'con dos textos no sale «Lo que comparten»');
    ok(s2.querySelector('input[data-lb="size"]').closest('.lb-mix'), 'el tamaño distinto no dice «Varios»');
    igual(s2.querySelectorAll('[data-lb="tal"].on').length, 0, 'la alineación distinta marca un botón');
    ok(s2.querySelector('select[data-lb="font"]') && !s2.querySelector('[data-lb="fan"], [data-lb="b"]'), 'con dos textos faltan la fuente o salen ajustes de foto');
    s2.querySelector('[data-lb="tal"][data-v="der"]').click();
    igual(compDe(0).els.filter(e => e.t === 'texto').map(e => e.al), ['der', 'der'], 'la alineación no se aplicó a los dos');
    sec().querySelector('[data-lb="tc"][data-c="#000000"]').click();
    igual(compDe(0).els.filter(e => e.t === 'texto').map(e => e.color), ['#000000', '#000000'], 'el color no se aplicó a los dos');
    tecla('z', { meta: true });
    igual(compDe(0).els.filter(e => e.t === 'texto').map(e => e.color), ['#ffffff', '#ffffff'], 'un ⌘Z no devolvió el color de los dos');
    // mezclados: solo la sombra
    dos(f1.id, t1.id);
    const s3 = sec(); ok(s3, 'con una foto y un texto no sale «Lo que comparten»');
    igual([...s3.querySelectorAll('[data-lb]')].map(e => e.dataset.lb).filter((v, i, a) => a.indexOf(v) === i), ['sh'], 'con tipos mezclados sale algo más que la sombra');
    M.libre.cerrar();
  });

  prueba('E46', 'Un texto solo: «Izquierda / Centro / Derecha» de su panel cambian su alineación (no hacían nada desde la 3.25)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await abrirEditor('r1');
    accion('sl-add'); accion('add-txt');
    const t = compDe(0).els.find(e => e.t === 'texto'); t.al = 'cen';
    accion('cap', { id: t.id });
    q('.lb-panel [data-lb="tal"][data-v="der"]').click();
    igual(compDe(0).els[0].al, 'der', '«Derecha» no alineó el texto');
    ok(q('.lb-panel [data-lb="tal"][data-v="der"].on'), 'el panel no marca «Derecha»');
    q('.lb-panel [data-lb="tal"][data-v="izq"]').click();
    igual(compDe(0).els[0].al, 'izq', '«Izquierda» no alineó el texto');
    M.libre.cerrar();
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
    await hasta(() => W.MESA && W.MESA.status && W.MESA.libre && W.MESA.libre.version && W.MESA._in && W.MESA.revisar && W.MESA.diseno, 15000, 'que carguen mesa.js, libre.js, revisar.js y diseno.js');
    M = W.MESA;
    // index.html lanza MESA.boot() sin esperarlo: termina cuando la mesa tiene su armazón y no está cambiando de tablero
    await hasta(() => M._in.shellReady() && !M._in.switching(), 15000, 'que la mesa termine de arrancar');
    ok(!M._in.locked, 'la mesa está abierta en otra pestaña de este puerto: ciérrala');
    const ajenos = [...(await M.boards()).filter(b => !DE_PRUEBA(b.client)).map(b => b.key), ...(await M.clients()).filter(c => !DE_PRUEBA(c.id)).map(c => c.id)];
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
        if ((await M.clients()).some(c => c.id === CLIENTE2)) { const r2 = await M.removeClient(CLIENTE2); ok(r2 === true, 'no se pudo borrar el segundo cliente de prueba: ' + r2); }
        ok(!(await M._in.idbAll('bandejas')).some(x => DE_PRUEBA(x.client)), 'quedó la bandeja de un cliente de prueba');
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
