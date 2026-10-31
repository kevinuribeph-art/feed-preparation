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
    if (M.hs && M.hs.activo()) M.hs.ver(false);
    if (M.revisar && M.revisar._reset) M.revisar._reset();   // una revisión de «sube» pendiente no llega a la prueba siguiente
    await M.flush();                               // el guardado va con retraso: purge borra las fotos que nombra el tablero guardado
    for (const b of await M.boards()) if (DE_PRUEBA(b.client)) await M.purge(b.key);
    for (const c of [CLIENTE, CLIENTE2]) await M._test.borrarBandeja(c);   // la bandeja ya no se va con el último mes (D-072)
    for (const c of [CLIENTE, CLIENTE2]) W.localStorage.removeItem('mesa-pestanas:' + c);
  }
  // borrar el mes y su bandeja: como una mesa que no tiene ese tablero
  const sinMes = async key => { await M.purge(key); await M._test.borrarBandeja(CLIENTE); };
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
  // una foto puesta en un hueco como desde la bandeja del editor (pickf), en la diapositiva abierta; tecla: lo que se contesta
  // si su orientación no coincide con la del hueco (D-050)
  async function enHueco(i, huecoId, f, resp) {
    ok(ed().i === i, `la diapositiva abierta es la ${ed().i + 1}, no la ${i + 1}`);
    ed().pick = { modo: 'rep', id: huecoId };
    accion('pickf', { f });
    if (resp) { await hasta(() => preguntaHueco(), 4000, 'la pregunta 1 / 2'); tecla(resp); }
    return hasta(() => compDe(i).els.find(e => e.t === 'foto' && e.src === f), 4000, 'la foto en el hueco');
  }
  const preguntaHueco = () => { const a = ed() && ed().ask; return a && a.classList.contains('lb-ask12') ? a : null; };
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
    await sinMes(`${CLIENTE}-${MES}`);
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
    ok(d.v === 4, 'versión del archivo: ' + d.v);
    igual((d.bandejas.find(r => r.client === CLIENTE) || {}).tray, antes, 'la bandeja en el archivo');
    ok(d.boards.every(b => !('tray' in b)), 'un tablero del archivo lleva bandeja');
    ok(antes.every(f => d.files[f]), 'faltan fotos de la bandeja en el archivo');
    await sinMes(key);
    let r = await M.importData(d, { confirm: false });
    ok(r && !r.error, 'importar falló: ' + json(r));
    await M.open(key);
    igual(M.board().tray, antes, 'la bandeja importada');
    // un archivo de antes de la 3.44: v2, sin bandejas, con la bandeja en el tablero
    const v2 = JSON.parse(JSON.stringify(d)); v2.v = 2; delete v2.bandejas; v2.boards.find(b => b.key === key).tray = antes.slice();
    await sinMes(key);
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

  // ---------- las historias (D-054 a D-057) ----------
  const DIA = n => `2026-11-${String(n).padStart(2, '0')}`;
  const hDe = id => (M.board().historias || []).find(h => h.id === id);
  const horaH = (id, t) => { const h = hDe(id); ok(h, 'no está la historia'); igual(M._in.localTime(h.date), t, 'hora de la historia'); };
  const sello = async o => (typeof o === 'string' ? o : [...new Uint8Array(await o.arrayBuffer())].join(','));
  const toastCon = re => qa('.toasts .toast').some(t => re.test(t.textContent));
  // una historia diseñada con una foto a sangre, como la deja el editor
  async function historiaConFoto(id, f) {
    await abrirEditor(id);
    accion('tr-add', { f });
    await hasta(() => compDe(0).els.some(e => e.t === 'foto' && e.src === f), 4000, 'la foto en la historia');
    await aplicarEditor();
  }
  const preguntaEditor = () => ed() && ed().ask && ed().ask.querySelector('[data-ask="usar"]');
  // bytes de lo que el feed enseña y sube: lo que no puede cambiar por tener historias
  async function vistaFeed() {
    await M.render('clean');
    await M.flush();
    return json({ celdas: qa('.feed .grid .cell').map(c => [c.dataset.slot || '', c.className]), plan: M.plan(), cambios: M.notionChanges(), captions: M.captions(), slots: M.board().slots.map(s => ({ ...s, at: 0 })), estado: M.status().slots, cal: qa('.cal .chip').length, revisar: (await M.revisar()).puntos, imagen: (await sello(M.out.clean)).length });
  }

  prueba('H1', 'Las historias no se ven en el feed: casillas, imagen, plan, notionChanges, captions, calendario y contadores siguen igual (D-054)', async () => {
    await tablero([pub(1), pub(2)]);
    const [a] = await poner('r1', [await foto('h1a.jpg')]);
    const [b] = await M.addFiles([await foto('h1b.jpg')]);
    await hasta(() => M.libre && M.hs, 4000, 'libre.js e historias.js');
    const antes = await vistaFeed();
    const uno = M.hs.anadir(DIA(10)), dos = M.hs.anadir(DIA(3), { slotId: 'r1' }), tres = M.hs.anadir(DIA(11));
    await historiaConFoto(uno, b); await historiaConFoto(dos, a);
    M.hs.cancelar(tres);
    igual(M.hs.lista().length, 3, 'historias en el tablero');
    igual(await vistaFeed(), antes, 'el feed cambió con historias');
    igual(M.board().tray.includes(b), true, 'la foto de la historia sigue en la bandeja');
    igual(M.board().slots.length, 2, 'las historias entraron en S.slots');
    M.hs.ver(true);
    ok(q('.feed').offsetParent === null && q('.hv').offsetParent !== null, 'con «Historias» sigue viéndose la cuadrícula');
    M.hs.ver(false);
    ok(q('.feed').offsetParent !== null && q('.hv').hidden, 'con «Feed» no vuelve la cuadrícula');
    igual(await vistaFeed(), antes, 'el feed cambió tras pasar por la vista');
  });

  prueba('H2', 'Editar historia: el editor de siempre, 9:16 fijo y una página; se aplica a 1440 × 2560 y la zona segura nunca sale en la imagen (D-055)', async () => {
    await tablero([pub(1)]);
    await hasta(() => M.libre && M.hs, 4000, 'libre.js e historias.js');
    const id = M.hs.anadir(DIA(10), { note: 'Guion de prueba' });
    igual(M.hs.estado(hDe(id)), 'por diseñar', 'estado al crearla');
    const E = await abrirEditor(id);
    ok(E.reel && E.historia && E.sl.length === 1, 'no abrió una sola página de historia');
    ok(!E.el.querySelector('[data-lb="sl-add"]') && !E.el.querySelector('[data-lb="sl-del"]') && !E.el.querySelector('.lb-fmt'), 'se pueden añadir diapositivas o cambiar el formato');
    igual(E.el.querySelector('.lb-ttl textarea.lb-guion').value, 'Guion de prueba', 'la cabecera no enseña la nota');
    accion('sl-add'); igual(E.sl.length, 1, 'se añadió una diapositiva');
    tecla('d', { meta: true, code: 'KeyD' }); igual(ed().sl.length, 1, '⌘D duplicó la diapositiva');
    ok(E.zona, 'la zona segura no sale de entrada');
    tecla('p', { meta: true, code: 'KeyP' }); ok(!ed().zona, '⌘P no la apaga');
    tecla('p', { meta: true, code: 'KeyP' }); ok(ed().zona, '⌘P no la enciende');
    accion('atajos'); accion('atajos');
    // sin tocar nada no hay nada que aplicar: sigue por diseñar
    accion('aplicar');
    await hasta(() => !M.libre.abierto(), 8000, 'que se cierre sin cambios');
    igual(M.hs.estado(hDe(id)), 'por diseñar', 'aplicar sin cambios la dio por diseñada');
    await abrirEditor(id);
    compDe(0).bg = '#112233';
    await aplicarEditor();
    const h = hDe(id), f = M.files[h.photos[0]];
    igual(M.hs.estado(h), 'diseñada', 'estado al aplicar');
    igual([f.w, f.h], [1440, 2560], 'tamaño de la imagen');
    ok(f.design, 'no quedó como imagen dibujada');
    // ni en la zona ni fuera hay rastro del oscurecido: un fondo liso sale liso
    const bm = await W.createImageBitmap(await M._in.getBlob(h.photos[0])), c = D.createElement('canvas'); c.width = 1440; c.height = 2560;
    const x = c.getContext('2d'); x.drawImage(bm, 0, 0); bm.close();
    const px = (a, b) => [...x.getImageData(a, b, 1, 1).data].slice(0, 3);
    for (const [a, b] of [[720, 20], [720, 2500], [20, 1280], [1420, 1280], [720, 1280]]) { const p = px(a, b); cerca(p[0], 0x11, 4, `rojo en ${a},${b}`); cerca(p[1], 0x22, 4, `verde en ${a},${b}`); cerca(p[2], 0x33, 4, `azul en ${a},${b}`); }
    // vuelve a abrirse con su composición
    await abrirEditor(id);
    igual(compDe(0).bg, '#112233', 'no volvió su composición');
    M.libre.cerrar();
    // un reel sigue siendo «Editar portada», con la zona del grid
    await tablero([pub(1, 'Reel')]);
    await poner('r1', [await foto('h2r.jpg', 1080, 1920)]);
    const R = await abrirEditor('r1');
    ok(R.reel && !R.historia && /Editar portada/.test(R.el.querySelector('.lb-ttl p').textContent), 'la portada de un reel cambió');
    M.libre.cerrar();
  });

  prueba('H3', 'No adelantar: en el editor, soltando en la vista y al mover un post avisa; una foto de un post ya salido no; vale cualquier mes cargado (D-056)', async () => {
    await tablero([pub(1, 'Foto', 3), pub(2, 'Foto', 20)]);
    await hasta(() => M.libre && M.hs, 4000, 'libre.js e historias.js');
    const [a] = await poner('r1', [await foto('h3a.jpg')]), [b] = await poner('r2', [await foto('h3b.jpg')]);
    const id = M.hs.anadir(DIA(10), { time: '12:00' });
    // un post posterior: pregunta; con «Cancelar» no entra
    await abrirEditor(id);
    accion('tr-add', { f: b });
    await hasta(preguntaEditor, 4000, 'la pregunta de no adelantar');
    ok(/después de esta historia/.test(ed().ask.textContent), 'la pregunta no lo dice: ' + ed().ask.textContent);
    ed().ask.querySelector('[data-ask="seguir"]').click();
    await espera(100);
    ok(!compDe(0).els.some(e => e.src === b), 'con «Cancelar» la foto entró');
    // un post anterior: entra sin preguntar (D-022 no cuenta en una historia)
    accion('tr-add', { f: a });
    await hasta(() => compDe(0).els.some(e => e.src === a), 4000, 'la foto de un post ya salido');
    ok(!ed().ask, 'una foto de un post ya salido preguntó');
    await aplicarEditor();
    igual(M._in.adelantos(hDe(id)), [], 'cuenta como adelanto una foto de un post anterior');
    ok(slot('r1').photos.includes(a), 'la foto dejó su post');
    // mover el post detrás de la historia: avisa y queda marcada; sin preguntar nada
    M._test.setDate('r1', '2026-11-15T12:00:00.000+01:00');
    await hasta(() => toastCon(/antes de que salga en el feed/), 3000, 'el aviso al mover el post');
    igual(M._in.adelantos(hDe(id)).map(x => x.f), [a], 'la regla al mover el post');
    M.hs.ver(true);
    ok(q(`.hv-card[data-h="${id}"]`).classList.contains('mal'), 'la tarjeta no lo marca');
    M.hs.ver(false);
    // mover la historia detrás del post lo arregla
    M.hs.setFecha(id, DIA(16), '12:00');
    igual(M._in.adelantos(hDe(id)), [], 'al mover la historia');
    // soltar desde la bandeja sobre la tarjeta abre el editor con la misma pregunta
    const [c] = await poner('r2', [await foto('h3c.jpg')]);
    M.hs.setFecha(id, DIA(4), '12:00');   // antes de r1 y de r2
    igual(M._in.adelantos(hDe(id)).map(x => x.f), [a], 'antes de r1');
    M.hs.soltar(id, c);
    await hasta(preguntaEditor, 4000, 'la pregunta al soltar en la vista');
    ed().ask.querySelector('[data-ask="seguir"]').click();
    await espera(100);
    M.libre.cerrar();
    // la foto pasa al feed por un camino que no pregunta (D-022) con una historia ya hecha: avisa igual
    await tablero([pub(1, 'Foto', 20)]);
    const [d] = await M.addFiles([await foto('h3d.jpg')]);
    const hd = M.hs.anadir(DIA(10));
    await historiaConFoto(hd, d);
    ok(!toastCon(/antes de que salga/), 'avisó sin que hubiera adelanto');
    M._test.place('r1', d);
    await hasta(() => toastCon(/antes de que salga en el feed/), 3000, 'el aviso al poner la foto en el feed');
    // otro mes cargado del mismo cliente
    await tablero([pub(1, 'Foto', 5, '2026-12')], { mes: '2026-12' });
    await poner('r1-2026-12', [await foto('h3e.jpg')]);
    await M.flush();
    await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, slots: [pub(1, 'Foto', 3)], past: [], force: true });
    const [e] = await M.addFiles([await foto('h3e.jpg')]);
    const he = M.hs.anadir(DIA(10));
    await abrirEditor(he);
    accion('tr-add', { f: e });
    await hasta(preguntaEditor, 4000, 'la pregunta por un post de otro mes');
    ed().ask.querySelector('[data-ask="seguir"]').click();
    await espera(100);
    M.libre.cerrar();
  });

  prueba('H4', 'Foto usada en una historia: marca propia en la bandeja, sin ✓ ni ×, y al ponerla en una publicación avisa como D-022 (D-056)', async () => {
    await tablero([pub(1, 'Foto', 20)]);
    await hasta(() => M.libre && M.hs, 4000, 'libre.js e historias.js');
    const [f] = await M.addFiles([await foto('h4.jpg')]);
    const id = M.hs.anadir(DIA(10));
    await historiaConFoto(id, f);
    const it = await hasta(() => q(`.tray .titem[data-file="${f}"]`), 3000, 'la foto en la bandeja');
    ok(it.querySelector('.hs') && !it.classList.contains('uso') && !it.querySelector('.x'), 'la bandeja no la marca como usada en historia');
    // en la bandeja del editor también
    await abrirEditor(id);
    await hasta(() => { const b = ed().el.querySelector(`.lb-tph[data-f="${f}"]`); return (b && b.querySelector('.hs')) || !ed().el.querySelector(`.lb-tph[data-f="${f}"]`); }, 3000, 'la bandeja del editor');
    M.libre.cerrar();
    // a una publicación: pregunta
    M._test.addToSlot('r1', [f]);
    const d = await hasta(() => { const x = dialogo(); return x && x.querySelector('[data-act="repe"][data-m="usar"]') && x; }, 4000, 'el aviso al ponerla en una publicación');
    ok(/una historia del/.test(d.textContent), 'el aviso no dice que va en una historia: ' + d.textContent);
    d.querySelector('[data-act="close"]').click();
    await espera(100);
    igual(slot('r1').photos, [], 'con «Cancelar» entró en la publicación');
    // una historia cancelada no cuenta (como D-022)
    M.hs.cancelar(id);
    await hasta(() => !q(`.tray .titem[data-file="${f}"] .hs`), 3000, 'que se quite la marca');
  });

  prueba('H5', 'Enlace con el post: se mueve con él a la misma distancia, también por una collab; se cancela con él y vuelve; la cancelada a mano no (D-057)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.hs, 4000, 'historias.js');
    const a = M.hs.anadir(DIA(5), { slotId: 'r1', time: '13:30' }), b = M.hs.anadir(DIA(6), { slotId: 'r1', time: '09:00' }), suelta = M.hs.anadir(DIA(6), { time: '10:00' }), mano = M.hs.anadir(DIA(7), { slotId: 'r1', time: '11:00' });
    M.hs.cancelar(mano);
    M._test.setDate('r1', '2026-11-08T14:00:00.000+01:00');   // +3 días y 2 h
    const k = id => M._in.localDay(hDe(id).date) + ' ' + M._in.localTime(hDe(id).date);
    igual(k(a), '2026-11-08 15:30', 'la enlazada no conservó la distancia');
    igual(k(b), '2026-11-09 11:00', 'la segunda enlazada no conservó la distancia');
    igual(k(suelta), '2026-11-06 10:00', 'la suelta se movió');
    M.setEstado('r1', 'cancelado');
    await espera(50);
    igual([M.hs.estado(hDe(a)), M.hs.estado(hDe(b)), M.hs.estado(hDe(suelta))], ['cancelada', 'cancelada', 'por diseñar'], 'al cancelar el post');
    M.setEstado('r1', null);
    await espera(50);
    igual([M.hs.estado(hDe(a)), M.hs.estado(hDe(mano))], ['por diseñar', 'cancelada'], 'al reactivar el post');
    // desenlazada ya no lo sigue
    M.hs.enlazar(a, null);
    M._test.setDate('r1', '2026-11-09T14:00:00.000+01:00');
    igual(k(a), '2026-11-08 15:30', 'la desenlazada lo siguió');
    // una collab: el post cambia en el tablero de otro cliente y su historia lo sigue en el suyo
    await limpiar();
    const col = { id: 'colab1', name: 'COLLAB Foto 1', type: 'Foto', date: `${DIA(5)}T12:00:00.000+01:00` };
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [col], past: [], force: true });
    const c = M.hs.anadir(DIA(5), { slotId: 'colab1', time: '13:00' });
    await M.flush();
    await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, slots: [col], past: [], force: true });
    igual(M._test.shared('colab1').length, 1, 'la collab no quedó enlazada');
    M._test.setDate('colab1', `${DIA(7)}T12:00:00.000+01:00`);
    await M.flush();
    const otra = await hasta(async () => { const r = await M._in.idbGet('boards', `${CLIENTE2}-${MES}`); return r && (r.slots[0].date.startsWith(DIA(7)) || M._in.localDay(r.slots[0].date) === DIA(7)) && r; }, 4000, 'que la collab llegue al otro tablero');
    igual(M._in.localDay(otra.historias[0].date) + ' ' + M._in.localTime(otra.historias[0].date), `${DIA(7)} 13:00`, 'la historia del otro cliente no siguió a la collab');
    igual(otra.historias[0].id, c, 'historia del otro tablero');
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [{ ...col, date: `${DIA(7)}T12:00:00.000+01:00` }], past: [], force: true });
    igual(M._in.localTime(hDe(c).date), '13:00', 'al abrir el otro tablero');
  });

  prueba('H6', '⌘Z cubre las historias: crear, borrar, cambiar la hora, aplicar (un paso) y lo que mueve el post (D-054)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.libre && M.hs, 4000, 'libre.js e historias.js');
    const id = M.hs.anadir(DIA(5), { slotId: 'r1', time: '13:00' });
    M._test.undo(); ok(!hDe(id), '⌘Z no quitó la historia nueva');
    M._test.redo(); ok(hDe(id), '⇧⌘Z no la devolvió');
    M.hs.setFecha(id, DIA(5), '18:00'); horaH(id, '18:00');
    M._test.undo(); horaH(id, '13:00');
    M._test.setDate('r1', '2026-11-06T12:00:00.000+01:00');
    igual(M._in.localDay(hDe(id).date), DIA(6), 'no se movió con el post');
    M._test.undo();
    igual(M._in.localDay(hDe(id).date), DIA(5), '⌘Z no devolvió la historia con el post');
    igual(M._in.localDay(slot('r1').date), DIA(5), '⌘Z no devolvió el post');
    M._test.setDate('r1', slot('r1').date);
    // toda la sesión del editor es un paso
    const [f] = await M.addFiles([await foto('h6.jpg')]), n1 = M._test.hist().undo;
    await historiaConFoto(id, f);
    igual(M._test.hist().undo, n1 + 1, 'aplicar no fue un solo paso');
    ok(hDe(id).photos.length === 1, 'no se aplicó');
    M._test.undo();
    igual(M.hs.estado(hDe(id)), 'por diseñar', '⌘Z no deshizo la edición');
    ok(M.board().tray.includes(f), 'la foto no sigue en la bandeja');
    M._test.redo();
    igual(M.hs.estado(hDe(id)), 'diseñada', '⇧⌘Z no rehízo la edición');
    M.hs.borrar(id); ok(!hDe(id), 'no se borró');
    M._test.undo(); ok(hDe(id) && hDe(id).photos.length === 1, '⌘Z no devolvió la borrada con su imagen');
  });

  prueba('H7', 'Exportar e importar llevan las historias y sus imágenes; un archivo de antes se sigue importando; nada borra un archivo que solo usa una historia (D-054, D-017)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.libre && M.hs, 4000, 'libre.js e historias.js');
    const [f] = await M.addFiles([await foto('h7.jpg')]);
    const id = M.hs.anadir(DIA(10), { note: 'Nota h7' });
    await historiaConFoto(id, f);
    const img = hDe(id).photos[0];
    await M.flush();
    // lo que solo usa una historia no se borra
    igual(await M._in.sweepDesigns(true), 0, 'la limpieza borró algo');
    ok(await M._test.fileRec(img), 'la limpieza se llevó la imagen de la historia');
    const d = JSON.parse(await (await M.exportAll({ returnBlob: true })).text());
    igual(d.v, 4, 'versión del archivo');
    const b0 = d.boards.find(b => b.key === `${CLIENTE}-${MES}`);
    igual(b0.historias.map(h => [h.id, h.note]), [[id, 'Nota h7']], 'la historia en el archivo');
    ok(d.files[img] && d.files[f], 'el archivo no lleva la imagen o la foto de la historia');
    // en una mesa sin ese tablero
    await sinMes(`${CLIENTE}-${MES}`);
    ok(!(await M._test.fileRec(img)), 'borrar el mes dejó la imagen de la historia');
    let r = await M.importData(d, { confirm: false });
    ok(r && !r.error, 'importar falló: ' + json(r));
    await M.open(`${CLIENTE}-${MES}`);
    igual(hDe(id).note, 'Nota h7', 'la historia no volvió');
    ok(await M._test.fileRec(img), 'la imagen no volvió');
    ok(M.files[img] && M.files[img].thumbUrl, 'la miniatura no se cargó al abrir');
    await abrirEditor(id);
    ok(compDe(0).els.some(e => e.src === f), 'la composición no volvió con su foto');
    M.libre.cerrar();
    // un archivo de antes (v3, sin historias)
    const v3 = JSON.parse(JSON.stringify(d)); v3.v = 3; v3.boards.forEach(b => { delete b.historias; b.editedAt = '2020-01-01T00:00:00.000Z'; b.savedAt = '2020-01-01T00:00:00.000Z'; });
    r = await M.importData(v3, { confirm: false });
    ok(r && !r.error, 'el archivo v3 no se importó: ' + json(r));
    await M.open(`${CLIENTE}-${MES}`);
    ok(hDe(id), 'un archivo de antes, más viejo, se llevó la historia');
    // recargar el mes desde Notion no las pierde
    await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, slots: [pub(1, 'Foto', 5)], past: [], force: true });
    ok(hDe(id), 'cargar el mes de nuevo perdió la historia');
    // un archivo más nuevo que esta mesa, no
    const v9 = await M.importData({ ...d, v: 9 }, { confirm: false });
    ok(v9 && v9.error, 'un archivo de una versión más nueva entró');
  });

  prueba('H8', 'La vista: un carril por día, añadir, duplicar, orden por hora a 1 minuto, arrastrar, cambiar la hora en su ventana; un tablero sin historias se ve igual (D-054)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.hs, 4000, 'historias.js');
    ok(q('.bar .hvsw') && !M.hs.lista().length && !('historias' in M.board()), 'un tablero sin historias lleva datos de historias');
    igual(q('.hv').hidden, true, 'la vista sale abierta');
    q('.hvsw [data-v="1"]').click();
    ok(M.hs.activo() && !q('.hv').hidden, 'el conmutador no abre la vista');
    igual(qa('.hv-rail[data-day]').length, 30, 'carriles de noviembre');
    ok(q(`.hv-rail[data-day="${DIA(5)}"] .hv-post`), 'el carril no enseña su post');
    // añadir desde su botón: abre la ventana
    q(`.hv-rail[data-day="${DIA(10)}"] [data-hv="add"]`).click();
    const a = M.hs.lista()[0].id;
    await hasta(() => dialogo() && dialogo().dataset.dlg === 'historia', 2000, 'la ventana de la historia');
    horaH(a, '12:00');
    // la hora, desde su campo
    const hora = q('.detail [data-hv-c="hora"]'); hora.value = '19:45'; hora.dispatchEvent(new W.Event('change', { bubbles: true }));
    horaH(a, '19:45');
    const post = q('.detail [data-hv-c="post"]'); post.value = 'r1'; post.dispatchEvent(new W.Event('change', { bubbles: true }));
    igual(hDe(a).slotId, 'r1', 'el enlace');
    M._in.closeDetail();
    // dos a la misma hora: separadas un minuto, en su orden
    const b = M.hs.anadir(DIA(12), { time: '10:00' }), c = M.hs.anadir(DIA(12), { time: '10:00' }), e = M.hs.duplicar(c);
    horaH(b, '10:00'); horaH(c, '10:01'); horaH(e, '10:02');
    const orden = () => qa(`.hv-rail[data-day="${DIA(12)}"] .hv-card`).map(x => x.dataset.h);
    igual(orden(), [b, c, e], 'orden del carril');
    // reordenar: intercambian las horas del día
    M.hs.mover(e, DIA(12), 0);
    igual(orden(), [e, b, c], 'al mover al principio');
    horaH(e, '10:00'); horaH(b, '10:01'); horaH(c, '10:02');
    // a otro día: junto a sus vecinas; a un día vacío conserva su hora
    M.hs.mover(c, DIA(10), 0);
    igual(M._in.localDay(hDe(c).date), DIA(10), 'al mover a otro día');
    ok(M._in.ts(hDe(c).date) < M._in.ts(hDe(a).date), 'no quedó delante de su vecina');
    M.hs.mover(b, DIA(20), 0);
    igual(M._in.localDay(hDe(b).date) + ' ' + M._in.localTime(hDe(b).date), `${DIA(20)} 10:01`, 'al mover a un día vacío');
    // arrastrar con el puntero
    q(`.hv-rail[data-day="${DIA(20)}"] .hv-add`).scrollIntoView({ block: 'center' }); await espera(30);
    q(`.hv-card[data-h="${e}"]`).scrollIntoView({ block: 'nearest' }); await espera(30);
    const a0 = q(`.hv-rail[data-day="${DIA(20)}"] .hv-add`).getBoundingClientRect(), r1 = q(`.hv-card[data-h="${e}"]`).getBoundingClientRect();
    if (a0.top >= 0 && a0.bottom <= W.innerHeight && r1.top >= 0 && r1.bottom <= W.innerHeight) {
      const ev = (t, x, y) => q('.hv').dispatchEvent(new W.PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 7, button: 0 }));
      q(`.hv-card[data-h="${e}"]`).dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientX: r1.left + 10, clientY: r1.top + 10, pointerId: 7, button: 0 }));
      ev('pointermove', a0.left + 2, a0.top + 2); ev('pointermove', a0.left + 4, a0.top + 4); ev('pointerup', a0.left + 4, a0.top + 4);
      await espera(30);
      igual(M._in.localDay(hDe(e).date), DIA(20), 'el arrastre no la llevó al otro día');
    }
    // borrar: solo lo que no está en Zernio; cancelar la lleva abajo
    M.hs.cancelar(c);
    ok(q(`.hv-canc .hv-card[data-h="${c}"]`), 'la cancelada no va abajo');
    M.hs.reactivar(c);
    ok(!q(`.hv-canc .hv-card[data-h="${c}"]`), 'no se reactivó');
    M.hs.ver(false);
  });

  // ---------- las historias: revisión, API y Zernio (D-058, D-059) ----------
  const textoFuera = () => ({ id: 'tz', t: 'texto', txt: 'Arriba del todo', x: 0.2, y: 0.01, w: 0.6, h: 0.03, size: 0.03, color: '#000000', al: 'cen', rot: 0, op: 1 });
  const tipos = (r, id) => r.puntos.filter(p => p.historiaId === id).map(p => p.tipo + (p.bloquea ? '!' : ''));
  const usarIgualmente = async () => { (await hasta(preguntaEditor, 4000, 'la pregunta de no adelantar')).click(); };

  prueba('H9', '«Revisar» con historias: lo que bloquea y lo que avisa; sin la opción sigue solo con el feed; un clic abre la historia (D-058)', async () => {
    await tablero([pub(1, 'Foto', 5), pub(2, 'Foto', 20), pub(3, 'Foto', 7)]);
    await hasta(() => M.libre && M.hs && M.revisar, 4000, 'libre.js, historias.js y revisar.js');
    await poner('r1', [await foto('h9a.jpg')]);
    const [b] = await poner('r2', [await foto('h9b.jpg')]);
    const ids9 = await M.addFiles([await foto('h9d.jpg'), await foto('h9c.jpg', 400, 500), await foto('h9e.jpg')]), porNombre = n => ids9.find(i => M.files[i].name === n);
    const desc = porNombre('h9d.jpg'), chica = porNombre('h9c.jpg'), otra = porNombre('h9e.jpg');
    const sinDis = M.hs.anadir(DIA(10), { time: '09:00' });
    const conHueco = M.hs.anadir(DIA(10), { time: '10:00' });
    await abrirEditor(conHueco); compDe(0).els.push(huecoEl('hh', 0.1, 0.2, 0.8, 0.5)); await aplicarEditor();
    const adel = M.hs.anadir(DIA(11), { time: '10:00' });
    await abrirEditor(adel); accion('tr-add', { f: b }); await usarIgualmente(); await hasta(() => compDe(0).els.some(e => e.src === b), 4000, 'la foto'); await aplicarEditor();
    const antes = M.hs.anadir(DIA(5), { slotId: 'r1', time: '09:00' });
    await historiaConFoto(antes, otra);
    const caida = M.hs.anadir(DIA(7), { slotId: 'r3', time: '13:00' });
    M.setEstado('r3', 'cancelado');
    const fuera = M.hs.anadir(DIA(12), { time: '10:00' });
    await abrirEditor(fuera); compDe(0).els.push(textoFuera()); await aplicarEditor();
    const d1 = M.hs.anadir(DIA(13), { time: '10:00' }), d2 = M.hs.anadir(DIA(14), { time: '10:00' });
    await historiaConFoto(d1, desc); await historiaConFoto(d2, desc);
    const peq = M.hs.anadir(DIA(15), { time: '10:00' });
    await abrirEditor(peq); accion('tr-add', { f: chica });
    { const e = await hasta(() => compDe(0).els.find(x => x.src === chica), 4000, 'la foto pequeña'); e.x = 0.1; e.y = 0.2; e.h = e.h * 0.8 / e.w; e.w = 0.8; }   // ampliada: equivale a menos de 1080 px
    await aplicarEditor();
    const seis = []; for (let i = 0; i < 6; i++) seis.push(M.hs.anadir(DIA(16), { time: '10:00' }));
    await M.flush();
    const r = await M.revisar({ historias: 'solo' });
    igual(tipos(r, sinDis), ['sin diseñar!'], 'sin diseñar');
    igual(tipos(r, conHueco), ['hueco!'], 'con un hueco vacío');
    ok(tipos(r, adel).includes('adelanto!'), 'foto de un post posterior: ' + tipos(r, adel));
    igual(tipos(r, antes), ['antes del post!'], 'antes de su post');
    igual(tipos(r, caida), ['post cancelado!'], 'post cancelado');
    ok(tipos(r, fuera).includes('zona segura'), 'texto fuera de la zona segura: ' + tipos(r, fuera));
    ok(tipos(r, d2).includes('descarte repetido') && tipos(r, d1).includes('descarte repetido'), 'descarte en otra historia');
    ok(tipos(r, peq).includes('resolución'), 'foto de menos de 1080: ' + tipos(r, peq));
    ok(tipos(r, seis[5]).includes('bloque') && !tipos(r, seis[4]).includes('bloque'), 'más de 5 en un bloque');
    ok(!r.ok && r.puntos.every(p => p.historiaId && !p.slotId), 'con «solo» salen puntos del feed');
    // sin la opción: solo el feed; un mes con historias no cambia lo que ve «sube»
    const f = await M.revisar();
    ok(!f.puntos.some(p => p.historiaId) && f.ok, 'M.revisar() sin opción mira las historias: ' + json(f.puntos.slice(0, 2)));
    const u = await M.revisar({ slots: ['r1'] });
    ok(!u.puntos.some(p => p.historiaId), 'la revisión de «sube» mira las historias');
    const t = await M.revisar({ historias: true });
    ok(t.puntos.some(p => p.historiaId) && t.bloquean > 0, 'con true no salen las historias');
    // el botón las enseña y un clic abre la historia
    q('.rvbtn').click();
    const b0 = await hasta(() => q(`.detail [data-hv="ir"][data-id="${sinDis}"]`), 4000, 'la historia en la lista de «Revisar»');
    b0.click();
    await hasta(() => dialogo() && dialogo().dataset.dlg === 'historia', 2000, 'su ventana');
    ok(M.hs.activo(), 'no abrió la vista de historias');
    M._in.closeDetail();
  });

  prueba('H10', 'API: cargarHistorias, historias y marcarHistoriasProgramadas; nunca pisa una diseñada sin replace ni una programada; changed y cambios (D-059)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.libre && M.hs && M.historias, 4000, 'libre.js e historias.js');
    igual(M.historias(), [], 'sin historias');
    const [f] = await M.addFiles([await foto('h10.jpg')]);
    const d = `${DIA(6)}T10:00:00.000Z`;
    let r = await M.cargarHistorias([{ date: d, order: 2, note: 'Dos' }, { date: d, order: 1, note: 'Uno' }, { date: `${DIA(5)}T15:00:00Z`, order: 1, slotId: 'r1', note: 'Tras el post' }]);
    igual(r.map(x => x.result), ['creada', 'creada', 'creada'], 'al crear');
    igual(r.map(x => x.order), [2, 1, 1], 'orden devuelto');
    const uno = r[1].id, dos = r[0].id;
    igual(M.historias(uno)[0].dateMadrid, `${DIA(6)} 11:00`, 'hora en Madrid');
    igual(M.historias(dos)[0].dateMadrid, `${DIA(6)} 11:01`, 'el bloque no va a 1 minuto, en su orden');
    igual(M.historias(uno)[0].date, `${DIA(6)}T10:00:00Z`, 'fecha en UTC');
    const v = M.historias(uno)[0];
    igual(Object.keys(v), ['id', 'date', 'dateMadrid', 'order', 'slotId', 'state', 'note', 'files', 'zernioId', 'changed', 'cambios', 'problems'], 'campos');
    igual([v.state, v.note, v.files, v.zernioId, v.changed, v.cambios], ['por diseñar', 'Uno', [], null, false, []], 'valores');
    ok(v.problems.some(p => p.tipo === 'sin diseñar' && p.bloquea), 'problems no dice que está sin diseñar');
    igual(M.historias(r[2].id)[0].slotId, 'r1', 'enlace');
    igual(M.historias([uno, dos]).length, 2, 'con una lista');
    // errores, sin crear nada
    const n0 = M.historias().length;
    r = await M.cargarHistorias([{ date: '2026-11-08', order: 1 }, { date: `${DIA(8)}T10:00:00Z`, slotId: 'nada' }, { date: '2027-03-01T10:00:00Z', order: 1 }, { date: `${DIA(8)}T10:00:00Z`, fondo: 'rojo' }]);
    ok(r.every(x => x.error), 'errores: ' + json(r));
    igual(M.historias().length, n0, 'un error creó una historia');
    // el fondo, solo del kit (D-016)
    const fk = M.libre.fondosKit; M.libre.fondosKit = async () => ['#112233', '#000000', '#ffffff'];
    try {
      r = await M.cargarHistorias([{ date: `${DIA(9)}T10:00:00Z`, order: 1, fondo: '#FF0000' }, { date: `${DIA(9)}T11:00:00Z`, order: 1, fondo: '#112233' }]);
      ok(/kit/.test(r[0].error) && r[1].result === 'creada', 'fondo: ' + json(r));
      await abrirEditor(r[1].id);
      igual(compDe(0).bg, '#112233', 'el editor no abre con su fondo');
      M.libre.cerrar();
    } finally { M.libre.fondosKit = fk; }
    // el mismo día y orden: por diseñar se reescribe; diseñada, no; con replace, sí; programada, nunca
    r = await M.cargarHistorias([{ date: d, order: 1, note: 'Uno bis' }]);
    igual([r[0].id, r[0].result], [uno, 'sustituida'], 'una por diseñar');
    igual(M.historias(uno)[0].note, 'Uno bis', 'no se reescribió');
    await historiaConFoto(uno, f);
    const img = M.historias(uno)[0].files[0];
    r = await M.cargarHistorias([{ date: d, order: 1, note: 'Pisada' }]);
    igual([r[0].id, r[0].result], [uno, 'ya diseñada'], 'una diseñada sin replace');
    igual(M.historias(uno)[0].note, 'Uno bis', 'pisó una diseñada');
    igual(M.historias(uno)[0].files, [img], 'perdió su imagen');
    // marcar: programada; rechaza la que bloquea
    igual(M.marcarHistoriasProgramadas([{ id: dos, zernioId: 'z2' }])[0].error, 'está sin diseñar', 'marcó una que bloquea');
    igual(M.marcarHistoriasProgramadas([{ id: uno, zernioId: 'z1' }]), [{ id: uno, state: 'programada' }], 'al marcar');
    let h = M.historias(uno)[0];
    igual([h.state, h.zernioId, h.changed, h.cambios], ['programada', 'z1', false, []], 'recién programada');
    r = await M.cargarHistorias([{ date: d, order: 1, note: 'Pisada' }], { replace: true });
    igual(r[0].result, 'programada', 'replace pisó una programada');
    // cambios
    M.hs.setFecha(uno, DIA(6), '12:00');
    h = M.historias(uno)[0]; igual([h.changed, h.cambios], [true, ['fecha']], 'al cambiar la fecha');
    M._test.undo();
    h = M.historias(uno)[0]; igual([h.changed, h.cambios], [false, []], '⌘Z deja de marcarla');
    M.hs.cancelar(uno);
    h = M.historias(uno)[0]; igual([h.state, h.changed, h.cambios], ['cancelada', true, ['cancelada']], 'al cancelarla');
    M.hs.reactivar(uno);
    await abrirEditor(uno); compDe(0).bg = '#334455'; await aplicarEditor();
    h = M.historias(uno)[0]; igual([h.state, h.cambios], ['programada', ['imagen']], 'al cambiar la imagen');
    M.marcarHistoriasProgramadas([{ id: uno, zernioId: 'z1' }]);
    h = M.historias(uno)[0]; igual([h.changed, h.cambios], [false, []], 'marcar otra vez la pone al día');
    M.marcarHistoriasProgramadas([{ id: uno, zernioId: null }]);
    igual(M.historias(uno)[0].state, 'diseñada', 'sin zernioId deja de estar programada');
    // con replace, una diseñada se reescribe y pierde su imagen
    r = await M.cargarHistorias([{ date: d, order: 1, note: 'Otra' }], { replace: true });
    igual(r[0].result, 'sustituida', 'con replace');
    h = M.historias(uno)[0]; igual([h.state, h.note, h.files], ['por diseñar', 'Otra', []], 'tras replace');
    igual(M.board().slots.length, 1, 'la API tocó el feed');
  });

  prueba('H11', 'Zernio: nada sale con un punto que bloquea; la imagen de una historia sube tal cual; a Notion nunca; las fotos del feed, como siempre (D-058, D-059)', async () => {
    await tablero([pub(1, 'Foto', 20)]);
    await hasta(() => M.libre && M.hs && M.startZernio, 4000, 'libre.js, historias.js y startZernio');
    const [p] = await poner('r1', [await foto('h11p.jpg')]), [f] = await M.addFiles([await foto('h11f.jpg')]);
    const buena = M.hs.anadir(DIA(10)), mala = M.hs.anadir(DIA(11));
    await historiaConFoto(buena, f);
    await abrirEditor(mala); accion('tr-add', { f: p }); await usarIgualmente(); await hasta(() => compDe(0).els.some(e => e.src === p), 4000, 'la foto'); await aplicarEditor();
    await M.flush();
    const fb = M.historias(buena)[0].files[0], fm = M.historias(mala)[0].files[0];
    const puts = [], XHR = W.XMLHttpRequest;
    W.XMLHttpRequest = class { constructor() { this.upload = {}; this.status = 200; this.responseText = ''; } open(m, u) { this.m = m; this.u = u; } setRequestHeader() {} abort() {} send(b) { puts.push({ m: this.m, u: this.u, type: b.type, size: b.size }); if (this.m === 'POST') this.responseText = JSON.stringify({ status: 'uploaded', file_upload_id: 'n1' }); setTimeout(() => this.onload(), 0); } };
    try {
      const it = (fileId, slotId) => ({ fileId, slotId, url: `https://r2.invalid/${fileId}`, publicUrl: `https://cdn.invalid/${fileId}` });
      // bloquea: no llega a subirse
      M.startZernio([it(fm, mala)]);
      let s = M.zernioStatus([fm])[fm];
      ok(s.state === 'error' && /antes de que salga/.test(s.err || ''), 'subió una historia que bloquea: ' + json(s));
      igual(puts, [], 'hubo una subida');
      // sin diseñar
      const vacia = M.hs.anadir(DIA(12));
      M.startZernio([{ ...it('nada', vacia) }]);
      igual(puts, [], 'subió algo de una historia sin diseñar');
      // bien: tal cual, JPEG
      M.startZernio([it(fb, buena)]);
      await M.waitZernio([fb], 8000);
      s = M.zernioStatus([fb])[fb];
      igual([s.state, s.publicUrl], ['ok', `https://cdn.invalid/${fb}`], 'la subida de la historia');
      igual(puts.map(x => [x.m, x.u, x.type]), [['PUT', `https://r2.invalid/${fb}`, 'image/jpeg']], 'qué se subió');
      ok(puts[0].size < 8000000, 'pesa más de 8 MB');
      // también sin decir de qué historia es
      puts.length = 0;
      M.startZernio([{ fileId: fb, url: 'https://r2.invalid/b', publicUrl: 'https://cdn.invalid/b' }]);
      await M.waitZernio([fb], 8000);
      igual(M.zernioStatus([fb])[fb].state, 'ok', 'sin slotId');
      // a Notion no
      M.startUpload([{ fileId: fb, slotId: buena, url: 'https://notion.invalid', auth: 'x' }]);
      igual(M.uploadStatus([fb])[fb].state, 'error', 'la imagen de una historia iba a Notion');
      // una foto del feed sigue igual, también con historias
      puts.length = 0;
      M.startZernio([it(p, 'r1')]);
      await M.waitZernio([p], 8000);
      igual(M.zernioStatus([p])[p].state, 'ok', 'una foto del feed');
      igual(puts.length, 1, 'subidas de la foto del feed');
      // y a Notion: la subida que comparte código con la de Zernio
      puts.length = 0;
      M.startUpload([{ fileId: p, slotId: 'r1', url: 'https://notion.invalid/up', auth: 'Bearer x' }]);
      await M.waitUpload([p], 8000);
      igual([M.uploadStatus([p])[p].state, M.uploadStatus([p])[p].fileUploadId, puts.map(x => x.m)], ['ok', 'n1', ['POST']], 'la subida a Notion de una foto del feed');
    } finally { W.XMLHttpRequest = XHR; }
  });

  prueba('H12', 'Una pestaña antigua no puede pisar las historias: la base de datos sube de versión, lo que deja en localStorage no se las lleva y esta se para y pide recargar (D-060)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.hs, 4000, 'historias.js');
    const info = (await W.indexedDB.databases()).find(d => d.name === 'mesa-feed');
    igual(info.version, 5, 'versión de la base de datos');
    const id = M.hs.anadir(DIA(10), { note: 'H12' }), key = `${CLIENTE}-${MES}`;
    await M.flush();
    const guardado = await M._in.idbGet('boards', key);
    // lo que deja una pestaña de antes de la 3.53: sus cambios, sin el campo de las historias, más nuevo que lo guardado
    const { historias, ...viejo } = JSON.parse(json(guardado));
    ok(historias.length === 1, 'no se guardó la historia');
    viejo.savedAt = new Date(Date.now() + 60000).toISOString(); viejo.slots[0].note = 'De la pestaña antigua';
    W.localStorage.setItem('mesa-pending', json({ key, board: viejo }));
    await M.open(key);
    ok(hDe(id), 'lo que dejó una pestaña antigua se llevó la historia');
    igual(slot('r1').note, 'De la pestaña antigua', 'se perdió su cambio');
    // de una mesa de ahora, sí manda: se borró la última
    await M.flush();
    const { historias: h2, ...nuevo } = JSON.parse(json(await M._in.idbGet('boards', key)));
    ok(h2.length === 1, 'la historia no siguió guardada');
    nuevo.savedAt = new Date(Date.now() + 120000).toISOString();
    W.localStorage.setItem('mesa-pending', json({ key, board: nuevo, v: 4 }));
    await M.open(key);
    ok(!hDe(id), 'volvió una historia borrada');
    // otra pestaña abre una versión más nueva: esta se para, no guarda y pide recargar
    const id2 = M.hs.anadir(DIA(11));
    await M.flush();
    const s0 = (await M._in.idbGet('boards', key)).savedAt;
    M._test.versionNueva();
    ok(M._in.locked && q('.lock [data-act="recargar"]'), 'no pide recargar');
    M._in.save(); await M.flush(); await espera(350);
    igual((await M._in.idbGet('boards', key)).savedAt, s0, 'guardó estando parada');
    qa('.lock').forEach(x => x.remove());
    await M._test.claim();
    ok(!M._in.locked && hDe(id2), 'no se pudo seguir');
  });

  prueba('H13', 'Con un hueco vacío en el feed, «Historias» abre su panel y lista la historia; el punto «Hueco vacío» no recibe su contenido ni sus estilos (D-054, D-035)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await hasta(() => M.hs, 4000, 'historias.js');
    await poner('r1', [await foto('h13-a.jpg'), await foto('h13-b.jpg')]);
    await abrirEditor('r1');
    accion('sl-add');
    compDe(ed().i).els.push(huecoEl('h13', 0.1, 0.1, 0.8, 0.8));
    await aplicarEditor();
    await hasta(() => celda('r1') && celda('r1').querySelector('.dot.hv'), 4000, 'el punto «Hueco vacío» en la casilla');
    const id = M.hs.anadir(DIA(10), { note: 'H13' });
    q('.hvsw [data-v="1"]').click();
    const panel = q('.main > section.hv'), punto = () => celda('r1').querySelector('.dot.hv');
    ok(q('.feed').offsetParent === null, 'con «Historias» sigue viéndose la cuadrícula');
    ok(!panel.hidden && panel.offsetParent !== null, 'el panel de historias no se ve');
    ok(panel.querySelector(`.hv-rail[data-day="${DIA(10)}"] .hv-card[data-h="${id}"]`), 'el panel no lista la historia');
    igual(qa('.dot.hv .hv-res, .dot.hv .hv-rail').length, 0, 'las filas de historias en el punto');
    igual(punto().textContent, 'Hueco vacío', 'el texto del punto');
    // ninguna regla de historias.js, media query incluida, coincide con el punto
    const reglas = l => [...l].flatMap(r => r.cssRules ? reglas(r.cssRules) : [r]);
    const ajenas = reglas(D.getElementById('mesa-hv-css').sheet.cssRules).filter(r => punto().matches(r.selectorText)).map(r => r.selectorText);
    igual(ajenas, [], 'reglas del panel que coinciden con el punto');
    const c = W.getComputedStyle(punto());
    igual([c.borderRightWidth, c.flexGrow, c.overflowY, c.paddingTop, c.boxSizing], ['0px', '0', 'hidden', '0px', 'border-box'], 'los estilos del punto');
    // «Vista cliente»: el panel no sale y su regla no toca el punto
    const raiz = M._in.root();
    raiz.classList.add('client');
    try {
      ok(panel.offsetParent !== null, 'en «Vista cliente» no se ve el panel (D-064)');
      ok(W.getComputedStyle(punto()).display !== 'none', 'la regla de «Vista cliente» del panel oculta el punto');
    } finally { raiz.classList.remove('client'); }
    // de vuelta al feed, el punto se ve
    q('.hvsw [data-v="0"]').click();
    ok(q('.feed').offsetParent !== null && panel.hidden, 'con «Feed» no vuelve la cuadrícula');
    ok(punto().offsetParent !== null, 'el punto no se ve en la cuadrícula');
  });

  // ---------- historias solas: fotos a la bandeja, plantillas del kit y diseño desde fuera (D-061 a D-063) ----------
  const bytesIguales = async (a, b) => { const x = new Uint8Array(await a.arrayBuffer()), y = new Uint8Array(await b.arrayBuffer()); return x.length === y.length && x.every((v, i) => v === y[i]); };
  // el kit de verdad para el cliente de prueba, con el monograma entre sus logos: la mesa las siembra (D-062)
  async function conPlantillas({ logo = true } = {}) {
    await hasta(() => M.hs && M.diseno && M.libre && M.libre.hist, 6000, 'historias.js, diseno.js y libre.js');
    const kit = await (await W.fetch('kits/uribe.json', { cache: 'no-store' })).json();
    const k0 = M.diseno.kit; M.diseno.kit = async () => kit;
    const c0 = await M._in.idbGet('clients', CLIENTE), libre0 = c0.libre || null;
    c0.libre = { ...(libre0 || {}), plantillas: ((libre0 && libre0.plantillas) || []).filter(t => !t.historia) };
    delete c0.libre.historiasKit;
    let idLogo = null;
    if (logo) {
      const c = D.createElement('canvas'); c.width = c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#16110e'; x.fillRect(0, 0, 120, 120);
      const png = await new Promise(r => c.toBlob(r, 'image/png'));
      idLogo = `kit-${CLIENTE}-logo-h15`;
      await M._in.idbPut('files', idLogo, { name: 'uribe-visuals-monograma-ink.png', size: png.size, type: 'image/png', w: 120, h: 120, blob: png, thumb: png });
      c0.libre.logos = [idLogo];
    }
    await M._in.idbPut('clients', CLIENTE, c0);
    await M.hs.asegurar(CLIENTE); await M._in.loadClients();
    return { kit, salir: async () => {           // el cliente de prueba sigue entre pruebas: queda como estaba
      M.diseno.kit = k0;
      const c = await M._in.idbGet('clients', CLIENTE);
      if (c) { if (libre0) c.libre = libre0; else delete c.libre; await M._in.idbPut('clients', CLIENTE, c); await M._in.loadClients(); }
      if (idLogo) { await M._in.idbDel('files', idLogo); delete M.files[idLogo]; }
    } };
  }
  const tplDe = nombre => M.plantillasHistoria().find(t => t.nombre === 'Historia · ' + nombre);
  const compH = id => { const h = M.hs.lista().find(x => x.id === id); return h.libre.slides[h.photos[0]]; };
  const textosH = id => compH(id).els.filter(e => e.t === 'texto');
  const conTexto = (id, s) => textosH(id).find(e => e.txt === s);

  prueba('H14', 'Una foto que entra a la bandeja guarda los mismos bytes y dimensiones, y la misma foto no entra dos veces (D-061, D-022)', async () => {
    await tablero([pub(1)]);
    const f = await foto('h14.jpg', 2400, 3000), id = (await M.addFiles([f]))[0];
    ok(M.board().tray.includes(id), 'no está en la bandeja');
    const rec = await M._in.idbGet('files', id);
    igual([rec.size, rec.w, rec.h, rec.lastModified, rec.type], [f.size, 2400, 3000, 1767225600000, 'image/jpeg'], 'tamaño, dimensiones y fecha');
    ok(await bytesIguales(rec.blob, f), 'los bytes guardados no son los del original');
    igual((await M.addFiles([await foto('h14.jpg', 2400, 3000)], null, { tray: true }))[0], id, 'la segunda vez');
    igual(M.board().tray.filter(x => x === id).length, 1, 'veces en la bandeja');
    igual(M.files[id].name, 'h14.jpg', 'su nombre, con el que se busca para diseñar');
  });

  prueba('H15', 'Las 8 plantillas salen del kit una sola vez, 9:16 en el editor; la borrada no vuelve y no cuentan para las 24 del cliente (D-062)', async () => {
    await tablero([pub(1)]);
    const c0 = await M._in.idbGet('clients', CLIENTE), viejas = Array.from({ length: 24 }, (_, i) => ({ id: 'v' + i, nombre: `Plantilla ${i + 1}`, comp: { bg: '#ffffff', els: [] }, fmt: '4:5', rat: 0.8 }));
    await M._in.idbPut('clients', CLIENTE, { ...c0, libre: { ...(c0.libre || {}), plantillas: viejas } });
    const { salir } = await conPlantillas();
    try {
      igual((await M._in.idbGet('clients', CLIENTE)).libre.plantillas.filter(t => !t.historia).length, 24, 'las 24 del cliente');
      igual(M.plantillasHistoria().map(t => t.nombre.replace('Historia · ', '')), ['Texto Ink', 'Texto Paper', 'Texto Terracota', 'Foto a sangre', 'Foto + texto', 'Post enmarcado', 'Secuencia', 'Dato grande'], 'las plantillas');
      igual(tplDe('Texto Ink').campos, ['titular', 'etiqueta', 'texto'], 'campos de Texto Ink');
      igual(tplDe('Texto Terracota').campos, ['titular', 'texto'], 'campos de Terracota');
      igual(tplDe('Foto a sangre').campos, ['foto'], 'campos de Foto a sangre');
      igual(tplDe('Secuencia').campos, ['foto', 'titular', 'texto', 'serie'], 'campos de Secuencia');
      igual(tplDe('Dato grande').campos, ['foto', 'dato', 'etiqueta', 'texto', 'serie'], 'campos de Dato grande');
      let c = await M._in.idbGet('clients', CLIENTE);
      igual(c.libre.plantillas.length, 32, 'sembrar no se lleva ninguna de las 24 del cliente');
      ok(c.libre.plantillas.filter(t => t.historia).every(t => t.fmt === '9:16' && Math.abs(t.rat - 9 / 16) < 1e-3), 'el formato de las plantillas');
      igual(c.libreAt || null, c0.libreAt || null, 'sembrar no toca libreAt (importar de otro Mac sigue mandando)');
      const terr = c.libre.plantillas.find(t => t.nombre === 'Historia · Texto Terracota');
      ok(terr.comp.els.some(e => e.t === 'logo' && e.src === `kit-${CLIENTE}-logo-h15`), 'Terracota no lleva el monograma del kit');
      // en el editor, con el resto; guardar una plantilla sigue tirando la más vieja del cliente, nunca una de historia
      const id = M.hs.anadir(DIA(10), { note: 'H15' });
      await M.hs.editar(id);
      await hasta(() => ed() && ed().plant.length === 32, 4000, 'las plantillas en el editor');
      await hasta(() => qa('canvas[data-lb="tpl"]').length === 32, 4000, 'las miniaturas');
      accion('tpl-save');
      c = await hasta(async () => { const x = await M._in.idbGet('clients', CLIENTE); return x.libre.plantillas.some(t => t.nombre === 'Plantilla 25') && x; }, 4000, 'la plantilla guardada');
      igual([c.libre.plantillas.filter(t => t.historia).length, c.libre.plantillas.filter(t => !t.historia).length, c.libre.plantillas.some(t => t.id === 'v0')], [8, 24, false], 'las de historia se quedan');
      M.libre.cerrar();
      // una borrada no vuelve
      c.libre.plantillas = c.libre.plantillas.filter(t => t.nombre !== 'Historia · Foto a sangre');
      await M._in.idbPut('clients', CLIENTE, c); await M._in.loadClients();
      await M.hs.asegurar(CLIENTE);
      igual(M.plantillasHistoria().length, 7, 'la borrada ha vuelto');
    } finally {
      await salir();
      const c = await M._in.idbGet('clients', CLIENTE); await M._in.idbPut('clients', CLIENTE, { ...c, libre: c0.libre }); await M._in.loadClients();
    }
  });

  prueba('H16', 'Cada plantilla: diseñada a 1440 × 2560, editable, en su zona segura con 1 a 3 líneas, y ninguna etiqueta encima de un titular o un dato (D-062, D-055, D-020)', async () => {
    await tablero([pub(1)]);
    const { salir } = await conPlantillas();
    try {
      const fid = (await M.addFiles([await foto('h16.jpg', 3000, 5400)]))[0];
      const lineas = ['Una', 'Una línea que pasa a dos', 'Un titular que ocupa justo tres líneas'];
      const zona = [['Texto Ink', {}], ['Texto Paper', {}], ['Texto Terracota', {}], ['Foto + texto', { foto: fid }], ['Post enmarcado', { foto: fid }], ['Secuencia', { foto: fid, serie: { n: 1, total: 3 } }], ['Dato grande', { foto: fid, serie: { n: 2, total: 3 } }]];
      let dia = 3;
      for (const [nombre, extra] of zona) for (const titular of lineas) {
        const t = tplDe(nombre), id = M.hs.anadir(DIA(dia++ % 27 + 1), { note: 'H16' });
        const datos = { plantilla: t.id, ...extra };
        if (t.campos.includes('titular')) datos.titular = titular; else datos.dato = '85 %';
        if (t.campos.includes('etiqueta')) datos.etiqueta = 'Una etiqueta';
        if (t.campos.includes('texto')) datos.texto = 'Un texto corto para ver cómo queda.';
        const out = await M.disenarHistoria(id, datos);
        ok(!out.error, `${nombre}: ${out.error}`);
        igual(out.state, 'diseñada', nombre + ': el estado');
        ok(!out.problems.some(p => p.tipo === 'zona segura' || p.bloquea), `${nombre} «${titular}»: ${json(out.problems)}`);
        const h = M.hs.lista().find(x => x.id === id), f = M.files[h.photos[0]];
        igual([f.w, f.h, f.design], [1440, 2560, true], nombre + ': la imagen');
        // de abajo arriba: etiqueta por debajo de su titular o su dato
        const ts = textosH(id), et = conTexto(id, 'Una etiqueta'), gr = datos.titular ? conTexto(id, titular) : conTexto(id, '85 %');
        if (et) ok(et.y > gr.y + gr.h - 1e-3, `${nombre}: la etiqueta va encima`);
        // el bloque acaba en su base
        const base = nombre === 'Secuencia' || nombre === 'Dato grande' ? 0.735 : 0.8, pie = Math.max(...ts.filter(e => !/^\d\d \/ /.test(e.txt) && e.txt !== 'URIBE' && e.txt !== 'U').map(e => e.y + e.h));
        cerca(pie, base, 2e-3, nombre + ': el pie del bloque');
      }
      // Foto a sangre: toda la página y sin nada más, sin ampliar
      const id = M.hs.anadir(DIA(28), {}), o = await M.disenarHistoria(id, { plantilla: tplDe('Foto a sangre').id, foto: fid });
      ok(!o.error && !o.problems.some(p => p.tipo === 'resolución'), json(o));
      igual(compH(id).els.map(e => [e.t, e.x, e.y, e.w, e.h, e.src]), [['foto', 0, 0, 1, 1, fid]], 'Foto a sangre');
      // Foto + texto: el velo de las portadas
      const id2 = M.hs.anadir(DIA(28), {}); await M.disenarHistoria(id2, { plantilla: tplDe('Foto + texto').id, foto: fid, titular: 'Velo' });
      igual(compH(id2).velo, { tipo: 'grad', color: '#16110e', op: 0.85, dir: 'abajo', alc: 0.55 }, 'el velo');
      // a más de 3 líneas pasa al titular medio y sigue en su sitio
      const id3 = M.hs.anadir(DIA(28), {}), largo = 'Un titular bastante más largo de lo normal que ya no cabe en tres líneas';
      await M.disenarHistoria(id3, { plantilla: tplDe('Texto Ink').id, titular: largo });
      igual(conTexto(id3, largo).size, 0.07, 'el titular medio');
      // sigue siendo editable: se abre con su composición, sin nada que aplicar, y la foto sigue en la bandeja (D-056)
      ok(M.board().tray.includes(fid), 'la foto salió de la bandeja');
      await M.hs.editar(id3);
      await hasta(() => ed() && ed().historia, 4000, 'el editor');
      ok(compDe(0).els.some(e => e.t === 'texto' && e.txt === largo), 'el editor no abre la composición');
      igual(M.libre.abierto() && M.libre.aplicando(), false, 'aplicando');
      M.libre.cerrar();
      // los campos que su plantilla no lleva se rechazan sin tocar nada
      const id4 = M.hs.anadir(DIA(28), {});
      const mal = await M.disenarHistoria(id4, { plantilla: tplDe('Foto a sangre').id, foto: fid, titular: 'No' });
      ok(/no lleva titular/.test(mal.error) && mal.state === 'por diseñar', json(mal));
      ok(/no existe/.test((await M.disenarHistoria(id4, { plantilla: 'otra', titular: 'x' })).error), 'una plantilla que no existe');
    } finally { await salir(); }
  });

  prueba('H17', 'La foto que no da los píxeles lo dice en problems; un hueco sin foto bloquea, y el texto que no cabe se devuelve (D-062, D-058)', async () => {
    await tablero([pub(1)]);
    const { salir } = await conPlantillas();
    try {
      const a = async (nombre, w, h) => (await M.addFiles([await foto(nombre, w, h)]))[0];
      const justa = await a('h17-1200.jpg', 1200, 2133), poca = await a('h17-800.jpg', 800, 1422), sobra = await a('h17-2000.jpg', 2000, 3556);
      const sangre = tplDe('Foto a sangre').id, d = (f) => M.disenarHistoria(M.hs.anadir(DIA(10), {}), { plantilla: sangre, foto: f });
      let o = await d(sobra);
      ok(!o.problems.some(p => p.tipo === 'resolución'), 'con píxeles de sobra avisa: ' + json(o.problems));
      o = await d(justa);
      ok(o.problems.some(p => p.tipo === 'resolución' && /se amplía/.test(p.texto) && !p.bloquea), 'de 1080 a 1440 se amplía y no lo dice: ' + json(o.problems));
      o = await d(poca);
      ok(o.problems.some(p => p.tipo === 'resolución' && /menos de 1080/.test(p.texto)), 'por debajo de 1080 no lo dice: ' + json(o.problems));
      // sin foto: diseñada, con su hueco, y no sale
      const id = M.hs.anadir(DIA(11), {});
      o = await M.disenarHistoria(id, { plantilla: tplDe('Foto + texto').id, titular: 'Sin foto' });
      ok(o.state === 'diseñada' && o.problems.some(p => p.tipo === 'hueco' && p.bloquea), json(o));
      // Secuencia: más de 20 palabras, o un texto que no cabe, se devuelve
      const sec = tplDe('Secuencia').id, largo = Array(40).fill('palabra').join(' ');
      o = await M.disenarHistoria(M.hs.anadir(DIA(12), {}), { plantilla: sec, foto: sobra, titular: 'Corto', texto: largo, serie: { n: 1, total: 2 } });
      ok(o.problems.some(p => /40 palabras/.test(p.texto)), 'las palabras: ' + json(o.problems));
      o = await M.disenarHistoria(M.hs.anadir(DIA(13), {}), { plantilla: sec, foto: sobra, titular: 'Un titular muy largo que ocupa muchísimas líneas en la parte baja de esta historia y se come la foto de arriba', texto: 'Corto', serie: { n: 1, total: 2 } });
      ok(o.problems.some(p => p.tipo === 'no cabe' && /no cabe/.test(p.texto)), 'lo que no cabe: ' + json(o.problems));
      // Secuencia necesita su serie; una serie mal hecha no entra
      ok(/necesita serie/.test((await M.disenarHistoria(M.hs.anadir(DIA(14), {}), { plantilla: sec, titular: 'x' })).error), 'sin serie');
      ok(/serie no válida/.test((await M.disenarHistoria(M.hs.anadir(DIA(14), {}), { plantilla: sec, titular: 'x', serie: { n: 4, total: 3 } })).error), 'serie mal hecha');
    } finally { await salir(); }
  });

  prueba('H18', 'disenarHistoria: una diseñada solo con replace, una programada o cancelada nunca, y una foto de un post posterior no entra (D-062, D-056, D-059)', async () => {
    await tablero([pub(1, 'Foto', 20)]);
    await poner('r1', [await foto('h18-post.jpg')]);
    const { salir } = await conPlantillas();
    try {
      const ink = tplDe('Texto Ink').id, sangre = tplDe('Foto a sangre').id, id = M.hs.anadir(DIA(10), {});
      let o = await M.disenarHistoria(id, { plantilla: ink, titular: 'Primera' });
      ok(!o.error, json(o));
      const img = M.hs.lista().find(x => x.id === id).photos[0];
      o = await M.disenarHistoria(id, { plantilla: ink, titular: 'Segunda' });
      ok(/replace/.test(o.error) && o.state === 'diseñada', json(o));
      ok(conTexto(id, 'Primera') && M.hs.lista().find(x => x.id === id).photos[0] === img, 'la pisó sin replace');
      o = await M.disenarHistoria(id, { plantilla: ink, titular: 'Segunda' }, { replace: true });
      ok(!o.error && conTexto(id, 'Segunda'), json(o));
      const img2 = M.hs.lista().find(x => x.id === id).photos[0];
      ok(img2 !== img, 'la imagen no cambió con replace');
      ok(!M._in.refsOf(M.board()).has(img), 'la imagen vieja sigue en la historia');
      // la foto vieja de una sustituida vuelve a la bandeja
      const u = (await M.addFiles([await foto('h18-a.jpg', 1800, 3200)]))[0];
      const v = (await M.addFiles([await foto('h18-b.jpg', 1800, 3200)]))[0];
      const id2 = M.hs.anadir(DIA(11), {});
      await M.disenarHistoria(id2, { plantilla: sangre, foto: u });
      await M.disenarHistoria(id2, { plantilla: sangre, foto: v }, { replace: true });
      ok(M.board().tray.includes(u) && M.board().tray.includes(v), 'las fotos siguen en la bandeja');
      // programada: nunca, ni con replace
      M.marcarHistoriasProgramadas([{ id, zernioId: 'z-h18' }]);
      o = await M.disenarHistoria(id, { plantilla: ink, titular: 'Tercera' }, { replace: true });
      ok(/programada/.test(o.error) && o.state === 'programada', json(o));
      ok(conTexto(id, 'Segunda') && M.hs.lista().find(x => x.id === id).photos[0] === img2, 'tocó una programada');
      // cancelada: tampoco
      M.hs.cancelar(id2);
      o = await M.disenarHistoria(id2, { plantilla: ink, titular: 'x' }, { replace: true });
      ok(/cancelada/.test(o.error), json(o));
      // no adelanta: la foto de un post posterior no entra y la historia sigue por diseñar
      const id3 = M.hs.anadir(DIA(12), {}), fpost = slot('r1').photos[0];
      o = await M.disenarHistoria(id3, { plantilla: sangre, foto: fpost });
      ok(o.error && /después/.test(o.error) && o.state === 'por diseñar', json(o));
      igual(M.hs.lista().find(x => x.id === id3).photos, [], 'las fotos de la historia');
      // después de su post sí: ese es el material de una historia
      const id4 = M.hs.anadir(DIA(25), {});
      o = await M.disenarHistoria(id4, { plantilla: sangre, foto: fpost });
      ok(!o.error && !o.problems.some(p => p.tipo === 'adelanto'), json(o));
      // ⌘Z deshace el diseño: un paso
      await M.flush();
      M._test.undo();
      await hasta(() => !(M.hs.lista().find(x => x.id === id4).photos || []).length, 3000, 'que ⌘Z deshaga el diseño');
    } finally { await salir(); }
  });

  prueba('H19', 'Una serie de 3: numeración 01 / 03, flecha en 1/3 y 2/3 y «Send us a DM» en 3/3, en Secuencia y en Dato grande (D-063)', async () => {
    await tablero([pub(1)]);
    const { salir } = await conPlantillas();
    try {
      const fid = (await M.addFiles([await foto('h19.jpg', 2000, 3000)]))[0];
      const sec = tplDe('Secuencia').id, ids = [];
      for (const n of [1, 2, 3]) {
        const id = M.hs.anadir(DIA(10 + n), {}), o = await M.disenarHistoria(id, { plantilla: sec, foto: fid, titular: 'Paso ' + n, texto: 'Un texto corto.', serie: { n, total: 3 } });
        ok(!o.error && !o.problems.some(p => p.bloquea || p.tipo === 'zona segura' || p.tipo === 'no cabe'), `${n}/3: ${json(o)}`);
        ids.push(id);
      }
      const formas = id => compH(id).els.filter(e => e.t === 'forma').map(e => e.forma);
      igual(formas(ids[0]), ['elipse', 'flecha'], '1/3');
      igual(formas(ids[1]), ['elipse', 'flecha'], '2/3');
      igual(formas(ids[2]), [], '3/3');
      ok(!conTexto(ids[0], 'Send us a DM') && !conTexto(ids[1], 'Send us a DM'), '«Send us a DM» antes de la última');
      const dm = conTexto(ids[2], 'Send us a DM');
      ok(dm && dm.al === 'der' && dm.may && dm.color === '#d07152', 'en 3/3: ' + json(dm));
      igual([1, 2, 3].map((n, i) => !!conTexto(ids[i], `0${n} / 03`)), [true, true, true], 'la numeración');
      const num = conTexto(ids[0], '01 / 03');
      igual([num.x, num.color, num.peso, num.size], [0.074, '#9a8f84', 700, 0.024], 'la numeración, en etiqueta');
      // el círculo: diámetro 0.082·W, redondo de verdad, borde en 0.926, centrado en 0.785, con la flecha dentro
      const [ci, fl] = compH(ids[0]).els.filter(e => e.t === 'forma');
      cerca(ci.x + ci.w, 0.926, 2e-4, 'el borde del círculo');
      cerca(ci.w * 1440, ci.h * 2560, 0.5, 'el círculo no es redondo');
      cerca(ci.y + ci.h / 2, 0.785, 2e-4, 'el centro del círculo');
      igual([ci.color, fl.color, fl.puntas, !!ci.g && ci.g === fl.g], ['#b2503a', '#f4efe8', 'der', true], 'colores y grupo');
      ok(fl.x > ci.x && fl.x + fl.w < ci.x + ci.w && fl.y > ci.y && fl.y + fl.h < ci.y + ci.h, 'la flecha se sale del círculo');
      // Secuencia: foto arriba y separación 0.026·W bajo el titular
      igual(compH(ids[0]).els[0].h, 0.5, 'la foto');
      const ti = conTexto(ids[0], 'Paso 1'), tx = conTexto(ids[0], 'Un texto corto.');
      cerca(tx.y - (ti.y + ti.h), 0.026 * 1440 / 2560, 3e-4, 'la separación');
      igual([ti.size, ti.color, tx.color], [0.07, '#f4efe8', '#c4b8ac'], 'titular medio y texto');
      // Dato grande: con serie la misma fila, con su numeración; sin serie, ninguna fila
      const dg = tplDe('Dato grande').id, a = M.hs.anadir(DIA(20), {}), b = M.hs.anadir(DIA(21), {}), c = M.hs.anadir(DIA(22), {});
      await M.disenarHistoria(a, { plantilla: dg, foto: fid, dato: '85 %', etiqueta: 'De las reservas', texto: 'Un texto.', serie: { n: 1, total: 2 } });
      await M.disenarHistoria(b, { plantilla: dg, foto: fid, dato: '85 %', etiqueta: 'De las reservas', texto: 'Un texto.', serie: { n: 2, total: 2 } });
      await M.disenarHistoria(c, { plantilla: dg, foto: fid, dato: '85 %', etiqueta: 'De las reservas', texto: 'Un texto.' });
      igual(conTexto(a, '01 / 02').color, '#6e635a', 'la numeración de Dato grande');
      igual([formas(a), formas(b), !!conTexto(b, 'Send us a DM'), formas(c), textosH(c).some(e => / \/ /.test(e.txt)), !!conTexto(c, 'Send us a DM')], [['elipse', 'flecha'], [], true, [], false, false], 'la fila');
      const da = conTexto(a, '85 %'), et = conTexto(a, 'De las reservas'), tt = conTexto(a, 'Un texto.');
      ok(da.y + da.h <= et.y && et.y + et.h <= tt.y, 'el orden: dato, etiqueta, texto');
      cerca(et.y - (da.y + da.h), 0.03 * 1440 / 2560, 3e-4, 'la separación bajo el dato');
      igual([da.size, da.lh, da.ls, da.peso, da.color, et.color, tt.color], [0.185, 0.9, -0.04, 800, '#16110e', '#6e635a', '#4a4038'], 'los estilos');
      // la serie en otra plantilla no entra
      ok(/no lleva serie/.test((await M.disenarHistoria(M.hs.anadir(DIA(23), {}), { plantilla: tplDe('Texto Ink').id, titular: 'x', serie: { n: 1, total: 2 } })).error), 'serie en Texto Ink');
    } finally { await salir(); }
  });

  // ---------- la ventana de una historia, su nota y «Vista cliente» (D-064 a D-066) ----------
  const viva = id => M.hs.lista().find(h => h.id === id);
  const conFichero = (id, fid) => { viva(id).photos = [fid]; M._in.changed(); };
  const abrirH = async id => { q(`.hv-card[data-h="${id}"]`).click(); await hasta(() => dialogo() && dialogo().dataset.dlg === 'historia' && q('.detail .hv-story'), 2000, 'la ventana de la historia'); };
  const cmd = key => { const e = new W.KeyboardEvent('keydown', { key, metaKey: true, bubbles: true, cancelable: true }); D.body.dispatchEvent(e); return e; };
  const flecha = d => q(`.detail [data-hv="nav"][data-d="${d}"]`);
  const fijarCampo = (c, v) => { const t = q(`.detail [data-hv-c="${c}"]`); t.value = v; t.dispatchEvent(new W.Event('change', { bubbles: true })); };
  prueba('H20', 'La ventana de una historia: arriba estado y publicación, la imagen 9:16 entera con el archivo original, día y hora, y debajo solo Cancelar y la papelera, sin scroll (D-065)', async () => {
    await tablero([pub(1, 'Foto', 5), pub(2, 'Foto', 20)]);
    await hasta(() => M.hs && M.libre, 4000, 'historias.js y libre.js');
    M.hs.ver(true);
    const fid = (await M.addFiles([await foto('h20.jpg', 1440, 2560)]))[0], id = M.hs.anadir(DIA(10), { note: 'Guion H20' });
    conFichero(id, fid);
    await abrirH(id);
    const top = s => q('.detail ' + s).getBoundingClientRect().top;
    ok(top('.hv-e') < top('[data-hv-c="post"]') && top('[data-hv-c="post"]') < top('.hv-big') && top('.hv-big') < top('[data-hv-c="hora"]') && top('[data-hv-c="hora"]') < top('[data-hv="cancelar"]'), 'el orden vertical');
    const card = q('.detail .card'), r = q('.detail .hv-big').getBoundingClientRect();
    ok(card.scrollHeight <= card.clientHeight && card.scrollWidth <= card.clientWidth, 'la ventana se desplaza');
    cerca(r.width / r.height, 9 / 16, 0.01, 'la imagen no es 9:16');
    ok(r.bottom <= card.getBoundingClientRect().bottom && r.height > 200, 'la imagen no cabe o sale pequeña');
    igual(W.getComputedStyle(q('.detail .hv-big img')).objectFit, 'contain', 'la imagen se recorta');
    await hasta(() => q('.detail .hv-big img').src !== M.files[fid].thumbUrl && q('.detail .hv-big img').naturalWidth === 1440, 4000, 'el archivo original');
    ok(!q('.detail [data-hv-c="nota"]') && !q('.detail [data-hv="editar"]') && !q('.detail [data-hv="duplicar"]'), 'siguen la nota o los botones de editar y duplicar');
    igual(qa('.detail .hv-acc button').map(b => b.dataset.hv), ['cancelar', 'borrar'], 'lo de abajo');
    // la hora, sin perder el campo en uso
    const hora = q('.detail [data-hv-c="hora"]'); hora.focus(); fijarCampo('hora', '18:30');
    horaH(id, '18:30');
    ok(q('.detail [data-hv-c="hora"]') === hora && D.activeElement === hora, 'cambiar la hora rehízo el campo en uso');
    q('.detail [data-hv="cancelar"]').focus(); await espera(20);
    // Zernio: sin papelera; lo que cambió aquí se dice
    viva(id).zernio = { id: 'z', date: viva(id).date, file: fid }; M._in.changed();
    igual(qa('.detail .hv-acc button').map(b => b.dataset.hv), ['cancelar'], 'en Zernio');
    fijarCampo('hora', '18:40');
    await hasta(() => /falta actualizar Zernio/.test(q('.detail .hv-e').textContent), 2000, '«falta actualizar Zernio»');
    delete viva(id).zernio; M._in.changed();
    // cancelada: «Reactivar» sustituye a «Cancelar» y no se tocan día ni hora
    await pulsar('.detail [data-hv="cancelar"]');
    igual(qa('.detail .hv-acc button').map(b => b.dataset.hv), ['reactivar', 'borrar'], 'cancelada');
    ok(q('.detail [data-hv-c="dia"]').disabled && q('.detail [data-hv-c="hora"]').disabled, 'día y hora siguen editables');
    await pulsar('.detail [data-hv="reactivar"]');
    ok(!viva(id).cancelada && !q('.detail [data-hv-c="hora"]').disabled, 'no se reactivó');
    await pulsar('.detail [data-hv="borrar"]');
    ok(!viva(id) && dialogo() === null, 'la papelera no la borró');
    // no adelantar: su aviso sigue
    const f2 = (await M.addFiles([await foto('h20b.jpg')]))[0], k = M.hs.anadir(DIA(10), { time: '12:00' });
    await historiaConFoto(k, f2);
    M._test.place('r2', f2);
    await abrirH(k);
    ok(/antes de que salga en el feed/.test(q('.detail .hv-mal').textContent), 'el aviso de adelanto');
    const c2 = q('.detail .card'); ok(c2.scrollHeight <= c2.clientHeight, 'con el aviso, la ventana se desplaza');
    M._in.closeDetail();
    M.hs.ver(false);
  });

  prueba('H21', '⌘E abre el editor y ⌘D duplica y abre la copia, solo con la historia abierta; en una cancelada ⌘E no hace nada (D-065)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.hs && M.libre, 4000, 'historias.js y libre.js');
    M.hs.ver(true);
    const id = M.hs.anadir(DIA(10), { time: '12:00', note: 'H21' });
    // sin la ventana abierta: como si nada
    const n0 = cmd('d');
    ok(!n0.defaultPrevented && M.hs.lista().length === 1, '⌘D actuó sin la historia abierta');
    ok(!cmd('e').defaultPrevented, '⌘E actuó sin la historia abierta');
    await abrirH(id);
    const ev = cmd('d');
    ok(ev.defaultPrevented, '⌘D no anula el marcador');
    igual(M.hs.lista().length, 2, 'historias tras ⌘D');
    const copia = M.hs.lista().find(h => h.id !== id).id;
    igual(q('.detail [data-hv-c="hora"]').value, '12:01', 'la ventana no abrió la copia');
    const sinRepetir = new W.KeyboardEvent('keydown', { key: 'd', metaKey: true, repeat: true, bubbles: true, cancelable: true }); D.body.dispatchEvent(sinRepetir);
    igual(M.hs.lista().length, 2, 'mantener ⌘D sigue duplicando');
    ok(cmd('e').defaultPrevented, '⌘E no se anula');
    await hasta(() => ed() && ed().el && ed().el.isConnected, 4000, 'el editor abierto');
    igual(ed().slotId, copia, 'el editor abrió otra historia');
    ok(dialogo() === null, 'la ventana sigue abierta debajo');
    // en el editor, su ⌘D de siempre: no crea historias
    cmd('d'); igual(M.hs.lista().length, 2, '⌘D en el editor duplicó la historia');
    M.libre.cerrar();
    await hasta(() => !ed(), 2000, 'cerrar el editor');
    // cerrada con ×, ni ⌘D ni ⌘E
    await abrirH(id);
    q('.detail .x').click();
    ok(!cmd('d').defaultPrevented && M.hs.lista().length === 2, '⌘D actuó con la ventana cerrada');
    // cancelada: ⌘E no hace nada, ⌘D sí, y la copia empieza libre
    M.hs.cancelar(id);
    await abrirH(id);
    ok(cmd('e').defaultPrevented, '⌘E en una cancelada abre lo del navegador');
    await espera(50);
    ok(!ed() && dialogo() && dialogo().dataset.dlg === 'historia', '⌘E abrió una cancelada');
    M._in.closeDetail();
    M.hs.ver(false);
  });

  prueba('H22', 'Las flechas: por hora entre las no canceladas de su día, sin flechas con una sola o en una cancelada, y siguen al día nuevo (D-065)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.hs, 4000, 'historias.js');
    M.hs.ver(true);
    const a = M.hs.anadir(DIA(10), { time: '10:00' }), b = M.hs.anadir(DIA(10), { time: '11:00' }), c = M.hs.anadir(DIA(10), { time: '12:00' }), x = M.hs.anadir(DIA(10), { time: '10:30' }), sola = M.hs.anadir(DIA(14), { time: '08:00' });
    M.hs.cancelar(x);
    const hora = () => q('.detail [data-hv-c="hora"]').value;
    await abrirH(a);
    ok(flecha(-1).disabled && !flecha(1).disabled, 'la primera');
    flecha(1).click(); await espera(20); igual(hora(), '11:00', 'la siguiente salta la cancelada');
    ok(!flecha(-1).disabled && !flecha(1).disabled, 'la del medio');
    flecha(1).click(); await espera(20); igual(hora(), '12:00', 'la última');
    ok(!flecha(-1).disabled && flecha(1).disabled, 'la última');
    flecha(-1).click(); await espera(20); igual(hora(), '11:00', 'volver');
    // por hora, no por orden de creación
    fijarCampo('hora', '09:00');
    await hasta(() => flecha(-1) && flecha(-1).disabled, 2000, 'la nueva primera');
    // con otro día, usa el suyo
    fijarCampo('dia', DIA(14));
    await hasta(() => flecha(-1) && !flecha(-1).disabled && flecha(1).disabled, 2000, 'las flechas de su día nuevo');
    igual(M._in.localDay(viva(b).date), DIA(14), 'el día');
    flecha(-1).click(); await espera(20); igual(hora(), '08:00', 'la otra del día nuevo');
    M._in.closeDetail();
    // una sola en el día y una cancelada: sin flechas
    await abrirH(a);
    fijarCampo('dia', DIA(16));
    await hasta(() => !flecha(1) && !flecha(-1), 2000, 'sin flechas con una sola');
    M._in.closeDetail();
    await abrirH(x);
    ok(!flecha(1) && !flecha(-1), 'una cancelada lleva flechas');
    M._in.closeDetail();
    M.hs.ver(false);
    ok(sola, 'sin historia');
  });

  prueba('H23', 'La nota se edita en la cabecera del editor, sin «Aplicar» y sin cambios por aplicar; un paso de ⌘Z; la tarjeta sin diseño la enseña (D-066)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.hs && M.libre, 4000, 'historias.js y libre.js');
    M.hs.ver(true);
    const id = M.hs.anadir(DIA(10), { note: 'Antes' });
    await M.flush();
    await abrirEditor(id);
    const t = ed().el.querySelector('textarea.lb-guion');
    igual(t.value, 'Antes', 'la nota en la cabecera');
    t.value = 'Después'; t.dispatchEvent(new W.Event('change', { bubbles: true }));
    igual(hDe(id).note, 'Después', 'la nota al salir del campo');
    igual(ed().el.querySelector('.lb-state').textContent, 'Sin cambios', 'la nota pide «Aplicar»');
    t.value = 'Sin salir del campo';
    M.libre.cerrar();
    await hasta(() => !ed(), 2000, 'cerrar el editor');
    igual(hDe(id).note, 'Sin salir del campo', 'al cerrar el editor se pierde la nota');
    igual(q(`.hv-card[data-h="${id}"] .hv-img p`).textContent, 'Sin salir del campo', 'la tarjeta');
    q('#mesa').focus && D.body.focus();
    cmd('z');
    await hasta(() => hDe(id) && hDe(id).note === 'Antes', 2000, '⌘Z devuelve la nota de antes del editor');
    M.hs.ver(false);
    // el editor de una publicación no lleva nota
    await abrirEditor('r1');
    ok(!ed().el.querySelector('textarea.lb-guion') && ed().el.querySelector('.lb-ttl p'), 'la cabecera de una publicación cambió');
    M.libre.cerrar();
  });

  prueba('H24', '«Vista cliente»: conmutador y solo las diseñadas no canceladas, de solo lectura, en grande con flechas, fecha y hora; sin nada de la mesa (D-064)', async () => {
    await tablero([pub(1, 'Foto', 5), pub(2, 'Foto', 20)]);
    await hasta(() => M.hs, 4000, 'historias.js');
    const fid = (await M.addFiles([await foto('h24.jpg', 1440, 2560)]))[0];
    const a = M.hs.anadir(DIA(10), { time: '10:00', slotId: 'r2' }), z = M.hs.anadir(DIA(10), { time: '11:00' }), sin = M.hs.anadir(DIA(10), { time: '12:00', note: 'Privado' }), can = M.hs.anadir(DIA(12), { time: '12:00' }), sola = M.hs.anadir(DIA(14), { time: '09:00' });
    [a, z, can, sola].forEach(i => { viva(i).photos = [fid]; });
    viva(z).zernio = { id: 'z', date: viva(z).date, file: fid };
    M.hs.cancelar(can);
    M.hs.ver(true);
    const cliente = () => q('.clientToggle').click();
    cliente();
    ok(q('.hvsw').offsetParent !== null && q('.hv').offsetParent !== null && q('.feed').offsetParent === null, 'no se ven las historias');
    igual(q('.hvsw [data-v="1"] i').textContent, '3', 'el contador');
    igual(qa('.hv-card[data-h]').map(c => c.dataset.h).sort(), [a, z, sola].sort(), 'las tarjetas');
    igual(qa('.hv-rail').map(r => r.dataset.day), [DIA(10), DIA(14)], 'los carriles');
    ok(!qa('.hv .hv-add, .hv .hv-est, .hv .hv-lk, .hv .hv-post, .hv .hv-canc').length && !/Privado|apoya/.test(q('.hv').textContent), 'se ve algo de la mesa');
    igual(q(`.hv-card[data-h="${a}"] .hv-pie b`).textContent, '10:00', 'la hora');
    // sin arrastre
    const c0 = q(`.hv-card[data-h="${a}"]`), r0 = c0.getBoundingClientRect(), pe = (t, el, x, y) => el.dispatchEvent(new W.PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 9, button: 0 }));
    pe('pointerdown', c0, r0.left + 5, r0.top + 5); pe('pointermove', q('.hv'), r0.left + 60, r0.top + 60); ok(!q('.hv-ghost'), 'la tarjeta se arrastra'); pe('pointerup', q('.hv'), r0.left + 60, r0.top + 60);
    // abierta: imagen, flechas, fecha y hora, nada más
    await abrirH(a);
    ok(q('.detail .hv-big img') && /10 nov 10:00/.test(q('.detail .hv-cf').textContent), 'la imagen o su fecha');
    ok(!qa('.detail input, .detail select, .detail .hv-acc, .detail .hv-e, .detail .hv-mal').length, 'la ventana enseña algo de la mesa');
    ok(flecha(-1).disabled && !flecha(1).disabled, 'las flechas');
    const card = q('.detail .card'); ok(card.scrollHeight <= card.clientHeight, 'la ventana se desplaza');
    const n = M.hs.lista().length;
    ok(!cmd('d').defaultPrevented && M.hs.lista().length === n, '⌘D actúa');
    ok(!cmd('e').defaultPrevented && !(M.libre && ed()), '⌘E actúa');
    flecha(1).click(); await espera(20);
    ok(/10 nov 11:00/.test(q('.detail .hv-cf').textContent) && flecha(1).disabled, 'la siguiente no salta a la que no está diseñada');
    M._in.closeDetail();
    await abrirH(sola);
    ok(!flecha(1) && !flecha(-1), 'con una sola lleva flechas');
    M._in.closeDetail();
    // Feed y vuelta, y al salir todo sigue
    q('.hvsw [data-v="0"]').click();
    ok(q('.feed').offsetParent !== null && q('.hv').offsetParent === null, 'el conmutador no vuelve al feed');
    q('.hvsw [data-v="1"]').click();
    cliente();
    ok(q('.hv-add') && q('.hv-est') && q(`.hv-card[data-h="${sin}"]`) && q(`.hv-canc .hv-card[data-h="${can}"]`), 'al salir de «Vista cliente» no vuelve la vista normal');
    igual(q('.hvsw [data-v="1"] i').textContent, '4', 'el contador al salir');
    M.hs.ver(false);
  });

  // ---------- la portada de un hueco (D-049) ----------
  const portada = k => q(`.cell.filler[data-filler="${k}"] img.hfoto`);
  // la imagen del feed: px(x, y) -> [r, g, b]
  async function pixelesDe(blob) {
    const bm = await W.createImageBitmap(blob), c = D.createElement('canvas'); c.width = bm.width; c.height = bm.height;
    const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
    return (a, b) => [...x.getImageData(a, b, 1, 1).data].slice(0, 3);
  }
  const negro = p => p.every(v => v < 24);

  prueba('M24', 'Portada en un hueco: foto y etiqueta en la mesa, «Vista cliente» y la imagen del feed; no es una publicación; se quita sin borrar el hueco y sigue al reabrir (D-049)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4)]);
    await pulsar('[data-act="addfiller"]'); await pulsar('[data-act="addfiller"]');
    ok(!('previews' in M.board()), 'un tablero sin portadas lleva el campo');
    const [a] = await M.addFiles([await foto('m24.jpg', 1600, 1000, '#b03030')]);
    await M._test.setPreview(0, a);
    await hasta(() => portada(0), 4000, 'la portada en el hueco');
    ok(M.board().tray.length === 0, 'la foto sigue en la bandeja');
    igual(W.getComputedStyle(portada(0)).objectFit, 'cover', 'la foto no rellena la casilla');
    igual(q('.cell.filler[data-filler="0"] .htag').textContent, 'Preview · próximo mes', 'la etiqueta');
    ok(W.getComputedStyle(q('.cell.filler .htag')).textTransform === 'none', 'la etiqueta va en mayúsculas');
    ok(!q('.cell.filler[data-filler="1"] img') && !q('.cell.filler[data-filler="1"] .htag'), 'el hueco sin portada no se ve negro');
    // no es una publicación
    igual([M.status().fillers, M.status().filled, M.plan().length], [2, 0, 0], 'huecos, casillas llenas y plan');
    ok(!json(await M.revisar({ ver: false })).includes('m24'), '«Revisar» habla de la portada');
    // la imagen del feed: la misma casilla; la 1.ª tiene la foto, la 2.ª es negra (358 × 477, desde y = 250)
    await M.render('clean');
    const px = await pixelesDe(M.out.clean);
    for (const [x, y] of [[30, 490], [328, 490], [179, 280]]) ok(!negro(px(x, y)), `no llega la foto a ${x},${y}`);
    ok(negro(px(540, 490)), 'el hueco sin portada no es negro en la imagen');
    // «Vista cliente»: la foto y la etiqueta, sin la ×
    q('.clientToggle').click();
    ok(q('#mesa').classList.contains('client'), 'no se abrió «Vista cliente»');
    ok(portada(0).getBoundingClientRect().width > 0 && W.getComputedStyle(q('.cell.filler .htag')).display !== 'none', 'la vista cliente no enseña la portada');
    ok(W.getComputedStyle(q('.cell.filler .hx')).display === 'none', 'la vista cliente enseña la ×');
    q('.clientToggle').click();
    // reabrir
    await M.flush();
    await M.open(`${CLIENTE}-${MES}`);
    ok(portada(0) && M.board().previews[0] === a, 'al reabrir se perdió la portada');
    // la × quita la foto, no el hueco; ⌘Z la devuelve
    await filtro('sin');
    q('.cell.filler[data-filler="0"] .hx').click(); await espera(30);
    igual([M.status().fillers, !!portada(0), vista(false)], [2, false, ['m24.jpg']], 'tras quitar la portada');
    M._test.undo(); await espera(30);
    igual([M.status().fillers, !!portada(0), vista(false)], [2, true, []], 'tras ⌘Z');
    M._test.redo(); await espera(30);
    igual([M.status().fillers, !!portada(0), vista(false)], [2, false, ['m24.jpg']], 'tras ⇧⌘Z');
    q('.cell.filler[data-filler="0"] .hx').click(); await espera(30);
    ok(M.status().fillers === 1, 'la × de un hueco sin portada no lo quitó');
  });

  prueba('M27', 'Portada a toda la casilla, sin borde negro y con la etiqueta recta y traslúcida, igual en la mesa, «Vista cliente» y la imagen del feed, sobre foto clara y oscura (D-067)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4)]);
    await pulsar('[data-act="addfiller"]'); await pulsar('[data-act="addfiller"]'); await pulsar('[data-act="addfiller"]');
    igual(M.status().fillers, 2, 'los huecos');
    const [clara, oscura] = await M.addFiles([await foto('m27-clara.jpg', 1600, 1000, '#f6f6f6'), await foto('m27-oscura.jpg', 1000, 1600, '#101010')]);
    await M._test.setPreview(0, clara); await M._test.setPreview(1, oscura);
    await hasta(() => portada(0) && portada(1), 4000, 'las portadas');
    const mira = () => {
      for (const k of [0, 1]) {
        const c = q(`.cell.filler[data-filler="${k}"]`).getBoundingClientRect(), f = portada(k).getBoundingClientRect(), css = W.getComputedStyle(portada(k)), t = W.getComputedStyle(q(`.cell.filler[data-filler="${k}"] .htag`));
        igual(css.paddingTop + css.paddingLeft, '0px0px', 'la portada lleva margen');
        for (const l of ['left', 'top', 'right', 'bottom']) cerca(f[l], c[l], .5, 'la foto no llega al canto ' + l);
        igual(t.borderTopLeftRadius, '0px', 'la etiqueta lleva redondeo');
        igual(t.backgroundColor, 'rgba(0, 0, 0, 0.7)', 'el fondo de la etiqueta');
      }
    };
    mira();
    q('.clientToggle').click(); mira(); q('.clientToggle').click();
    // la imagen del feed (casillas de 358 × 477, desde y = 250): la foto llega a los cantos y la etiqueta deja pasar un 30 %
    await M.render('clean');
    const px = await pixelesDe(M.out.clean), blanca = p => p.every(v => v > 225), hueco2 = 358 + 3;
    for (const [x, y] of [[1, 251], [356, 251], [1, 725], [356, 725]]) ok(blanca(px(x, y)), `la foto clara no llega a ${x},${y}: ${px(x, y)}`);
    for (const [x, y] of [[hueco2 + 1, 725], [hueco2 + 356, 725]]) { const p = px(x, y); ok(p.every(v => v < 40 && v > 6), `la foto oscura no llega a ${x},${y}: ${p}`); }
    // el pie de la etiqueta, a la izquierda del texto; esquina recta: el píxel del canto ya lleva su fondo
    const [tx, ty] = (() => { for (let x = 1; x < 179; x++) if (!blanca(px(x, 663))) return [x, 663]; throw new Error('sin etiqueta en la imagen'); })();
    const fondo = px(tx + 3, ty);
    fondo.forEach(v => cerca(v, Math.round(246 * .3), 8, 'el fondo de la etiqueta en la foto clara'));
    let abajo = ty; while (!blanca(px(tx + 3, abajo + 1))) abajo++;
    fondo.forEach((v, i) => cerca(px(tx + 1, abajo - 1)[i], v, 12, 'la esquina de la etiqueta no es recta'));
    px(hueco2 + tx + 3, ty).forEach(v => cerca(v, Math.round(16 * .3), 8, 'el fondo de la etiqueta en la foto oscura'));
  });

  prueba('M28', 'La columna derecha de la publicación se desliza entera: captions enteros, sin scroll propio; la foto fija; escribir o redibujar no mueve el scroll; en móvil se desliza la ventana (D-068)', async () => {
    await tablero([pub(1)]);
    await poner('r1', [await foto('m28.jpg')]);
    const largo = n => Array.from({ length: 14 }, (_, i) => `Caption ${n}, línea ${i + 1} con algo de texto para que ocupe.`).join('\n');
    M.loadCaptions([{ slotId: 'r1', options: [{ tone: 'a', text: largo(1) }, { tone: 'b', text: largo(2) }, { tone: 'c', text: largo(3) }] }]);
    const marco = W.frameElement, ancho0 = marco.style.width;
    q('.cell[data-slot="r1"]').click();
    const col = await hasta(() => q('.detail .pright.hascap'), 3000, 'la ventana');
    const caps = () => qa('.detail textarea.capt');
    igual(W.getComputedStyle(col).overflowY, 'auto', 'la columna no se desliza');
    igual(W.getComputedStyle(q('.detail .capbody')).overflowY, 'visible', 'los captions tienen scroll propio');
    ok(col.scrollHeight > col.clientHeight + 200, 'la columna no tiene de qué deslizarse');
    caps().forEach((t, i) => ok(t.clientHeight >= t.scrollHeight, `el caption ${i + 1} tiene scroll interno: ${t.clientHeight} de ${t.scrollHeight}`));
    // la foto, fija
    const foto0 = q('.detail .stage').getBoundingClientRect().top;
    col.scrollTop = 250; await espera(30);
    igual(col.scrollTop, 250, 'el scroll de la columna');
    igual(q('.detail .stage').getBoundingClientRect().top, foto0, 'la foto se mueve con la columna');
    // escribir no lo mueve, tampoco abajo del todo, donde el alto automático lo recortaría
    const escribe = (t, v) => { t.focus({ preventScroll: true }); t.value = v; t.dispatchEvent(new W.Event('input', { bubbles: true })); };
    col.scrollTop = 1e6; await espera(30);
    const fondo = col.scrollTop, ult = caps()[2];
    escribe(ult, ult.value + '\notra');
    igual(col.scrollTop, fondo, 'escribir hizo saltar la columna');
    ok(ult.clientHeight >= ult.scrollHeight, 'el caption que crece tiene scroll interno');
    // redibujar la ventana con el foco en el caption: mismo scroll, mismo foco
    col.scrollTop = 250; await espera(30);
    M._test.refreshDetail();
    const col2 = q('.detail .pright.hascap');
    ok(col2 !== col, 'la ventana no se redibujó');
    igual(col2.scrollTop, 250, 'redibujar movió la columna');
    ok(D.activeElement && D.activeElement.matches('textarea.capt'), 'redibujar perdió el foco del caption');
    igual(col2.scrollTop, 250, 'recuperar el foco movió la columna');
    // móvil: se desliza la ventana, la foto incluida, y redibujar tampoco la mueve
    marco.style.width = '420px'; W.dispatchEvent(new W.Event('resize')); await espera(120);
    const movil = q('.detail .pright.hascap'), cuerpo = q('.detail .pbody');
    igual(W.getComputedStyle(movil).overflowY, 'visible', 'en móvil la columna tiene scroll propio');
    ok(cuerpo.scrollHeight > cuerpo.clientHeight + 200, 'en móvil no se desliza la ventana');
    caps().forEach((t, i) => ok(t.clientHeight >= t.scrollHeight, `en móvil, el caption ${i + 1} tiene scroll interno`));
    cuerpo.scrollTop = 400; await espera(30);
    M._test.refreshDetail();
    igual(q('.detail .pbody').scrollTop, 400, 'en móvil, redibujar movió la ventana');
    marco.style.width = ancho0; W.dispatchEvent(new W.Event('resize')); await espera(60);
  });

  prueba('M25', 'Portada → usada → mes nuevo → «Sin usar» en todos los meses → en una publicación sin aviso; si se borra ese mes vuelve a usada; si se borra el mes del hueco, la foto queda en la bandeja (D-049, D-022, D-041)', async () => {
    const DIC = '2026-12', dic = [pub(5, 'Foto', 3, DIC)], claveNov = `${CLIENTE}-${MES}`, claveDic = `${CLIENTE}-${DIC}`;
    const aviso = () => { const d = dialogo(); return d && d.querySelector('[data-act="repe"]'); };
    await tablero([pub(1), pub(2)]);
    await pulsar('[data-act="addfiller"]');
    const [a] = await M.addFiles([await foto('m25.jpg')]);
    await filtro('sin');
    igual(vista(false), ['m25.jpg'], 'antes de ponerla');
    await M._test.setPreview(0, a);
    await hasta(() => portada(0), 4000, 'la portada en el hueco');
    igual([vista(false), vista(true), enBandejaUI()], [[], ['m25.jpg ✓'], []], 'en el hueco del último mes cuenta como usada');
    await filtro('todas');
    ok(!q(`.tray .titem[data-file="${a}"] [data-act="del"]`), 'una portada se puede quitar desde la bandeja');
    await filtro('sin');
    // en una publicación del mismo mes, avisa (cuenta como usada)
    M._test.addToSlot('r1', [a]);
    await hasta(aviso, 4000, 'el aviso de foto ya usada');
    await pulsar('.detail:not([hidden]) .x[data-act="close"]');
    igual(slot('r1').photos, [], 'al cancelar entró la foto');
    await M.flush();
    // un mes posterior: «Sin usar» allí y en noviembre, sin perder su portada
    await abrirMes(dic, DIC);
    await hasta(() => vista(false).includes('m25.jpg'), 6000, '«Sin usar» en diciembre');
    ok(q('.tray .tcount').textContent.includes('1 sin usar'), 'la cuenta en diciembre: ' + q('.tray .tcount').textContent);
    await M.flush();
    await M.open(claveNov);
    await hasta(() => vista(false).includes('m25.jpg'), 6000, '«Sin usar» en noviembre');
    ok(portada(0), 'noviembre perdió su portada');
    // se borra diciembre con noviembre abierto: usada otra vez
    await M.purge(claveDic);
    await hasta(() => !vista(false).includes('m25.jpg'), 6000, 'que vuelva a contar como usada');
    igual(vista(true), ['m25.jpg ✓'], 'tras borrar diciembre');
    // diciembre otra vez: a su publicación sin aviso, y el hueco de noviembre no cambia
    await abrirMes(dic, DIC);
    await hasta(() => vista(false).includes('m25.jpg'), 6000, '«Sin usar» en diciembre otra vez');
    M._test.addToSlot('r5-2026-12', [a]);
    await hasta(() => slot('r5-2026-12').photos.includes(a), 4000, 'la foto en la publicación de diciembre');
    ok(!aviso(), 'saltó el aviso de foto repetida');
    igual(vista(false), [], 'ya en una publicación sigue en «Sin usar»');
    await M.flush();
    await M.open(claveNov);
    ok(portada(0) && M.board().previews[0] === a, 'el hueco de noviembre perdió la foto');
    await hasta(() => vista(true).includes('m25.jpg ✓'), 6000, 'con ✓ en noviembre, por la publicación de diciembre');
    // se borra el mes del hueco, abierto otro mes o abierto él: la foto, que no va en otro sitio, queda en la bandeja del cliente
    for (const abierto of [DIC, MES]) {
      await tablero([pub(1)]);
      await pulsar('[data-act="addfiller"]');
      const [c] = await M.addFiles([await foto('m25-c.jpg')]);
      await M._test.setPreview(0, c);
      await M.flush();
      await abrirMes(dic, DIC);
      await hasta(() => vista(false).includes('m25-c.jpg'), 6000, '«Sin usar» en diciembre');
      ok(!M.board().tray.includes(c), 'la portada está en la bandeja guardada antes de borrar su mes');
      await M.flush();
      if (abierto === MES) await M.open(claveNov);
      await M.purge(claveNov);
      if (abierto === MES) await M.open(claveDic);
      await M.flush();
      ok(M.board().tray.includes(c), 'la foto no quedó en la bandeja al borrar el mes del hueco, abierto ' + abierto);
      ok(await M._test.fileRec(c), 'se borró la foto, abierto ' + abierto);
      igual(vista(false), ['m25-c.jpg'], 'tras borrar noviembre, abierto ' + abierto);
    }
  });

  prueba('M26', '«⇅ Exportar» e «Importar» conservan la portada de cada hueco; un archivo sin portadas importa igual, con los huecos negros (D-049, D-017)', async () => {
    const clave = `${CLIENTE}-${MES}`;
    await tablero([pub(1)]);
    await pulsar('[data-act="addfiller"]'); await pulsar('[data-act="addfiller"]');
    const [a, b] = await M.addFiles([await foto('m26-a.jpg'), await foto('m26-b.jpg')]);
    await M._test.setPreview(0, a);
    await M._test.setPreview(1, b);
    await hasta(() => portada(1), 4000, 'las dos portadas');
    await M.flush();
    const blob = await M.exportAll({ returnBlob: true });
    await sinMes(clave);
    ok(!(await M._test.fileRec(a)), 'borrar el mes y la bandeja dejó la foto');
    let r = await M.importData(blob, { confirm: false });
    ok(r && !r.error, 'importar falló: ' + json(r));
    await M.open(clave);
    igual(M.board().previews, [a, b], 'las portadas tras importar');
    igual([M.status().fillers, !!portada(0), !!portada(1)], [2, true, true], 'los huecos tras importar');
    ok((await M._test.fileRec(a)) && (await M._test.fileRec(b)), 'faltan las fotos');
    igual([vista(false), vista(true).sort()], [[], ['m26-a.jpg ✓', 'm26-b.jpg ✓']], 'la bandeja tras importar');
    // un archivo de antes de la 3.51
    const d = JSON.parse(await blob.text()); d.boards.forEach(x => { delete x.previews; });
    await sinMes(clave);
    r = await M.importData(new W.Blob([JSON.stringify(d)], { type: 'application/json' }), { confirm: false });
    ok(r && !r.error, 'importar el archivo antiguo falló: ' + json(r));
    await M.open(clave);
    igual([M.status().fillers, !!q('.cell.filler img'), 'previews' in M.board()], [2, false, false], 'el tablero antiguo');
  });

  // =====================================================================================================
  // Editor de diapositivas (libre.js)
  // =====================================================================================================

  prueba('E1','Editor: un carrusel vacío abre sin diapositivas, y abrir y salir sin cambios no deja paso en el ⌘Z de la mesa (libre 1.1)', async () => {
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

  // un marco vacío (el «+ Foto» de las plantillas) en x, y, w, h
  const marcoEl = (id, x, y, w, h) => ({ id, t: 'foto', src: null, x, y, w, h, cx: 0.5, cy: 0.5, z: 1, rot: 0, op: 1, lock: false, sh: 0, fx: false, fy: false, b: 0, bc: '#000000', r: 0 });

  prueba('E47', 'Borrar la foto de un marco vacío devuelve el marco tal como era, aunque se haya movido; borrarlo vacío lo quita; una foto suelta se borra (D-014, D-052)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('e47a.jpg')]);
    const [f] = await M.addFiles([await foto('e47b.jpg', 1600, 1000)]);
    await abrirEditor('r1');
    accion('sl-add');
    const h = marcoEl('m1', 0.1, 0.15, 0.8, 0.5);
    compDe(1).els.push(JSON.parse(json(h)));
    const p = await enHueco(1, 'm1', f);
    p.x = 0.2; p.w = 0.5;                            // movida y escalada
    elegir(p); accion('del');
    igual(compDe(1).els, [h], 'el marco que vuelve al borrar la foto');
    elegir(compDe(1).els[0]); ed().pick = { modo: 'fill', id: 'm1' }; accion('del');   // un clic en un marco vacío abre «Foto para el hueco»
    igual(compDe(1).els, [], 'borrar el marco vacío no lo quitó');
    ok(!ed().pick && !q('.lb-fl:not([hidden])'), 'quedó abierto lo del marco que ya no está');
    accion('add'); accion('pickf', { f });           // una foto suelta: se va del todo
    const s = await hasta(() => compDe(1).els.find(e => e.src === f), 4000, 'la foto suelta');
    elegir(s); accion('del');
    igual(compDe(1).els, [], 'la foto suelta dejó algo al borrarla');
  });

  prueba('E7', 'Encaje en huecos: «Rellenar» cubre el hueco, «Mantener el formato» entra entera y centrada, doble clic alterna, #2B231F → #16110E (D-018, D-050)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('e7a.jpg')]);
    const [ancha, alta] = await M.addFiles([await foto('e7b.jpg', 1600, 1000), await foto('e7c.jpg', 1200, 1500)]);
    await abrirEditor('r1');
    const { W: SW, H: SH } = tam();
    // a sangre, sobre el fondo provisional
    accion('sl-add'); compDe(1).bg = '#2b231f'; compDe(1).els.push(huecoEl('hs', 0, 0, 1, 1));
    const a = await enHueco(1, 'hs', ancha, '1');
    ok(a.x <= 0.001 && a.y <= 0.001 && a.x + a.w >= 0.999 && a.y + a.h >= 0.999, 'a sangre no cubre la diapositiva: ' + json([a.x, a.y, a.w, a.h]));
    igual(String(compDe(1).bg).toLowerCase(), '#16110e', 'el fondo provisional no pasó a Ink');
    // dentro del margen: una foto vertical en un hueco apaisado entra entera, lo más alta posible y centrada
    accion('sl-add'); compDe(2).els.push(huecoEl('hm', 0.1, 0.1, 0.8, 0.5));
    const b = await enHueco(2, 'hm', alta, '2'), d = M.files[alta];
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
    await enHueco(i, 'h1', fc, '2');
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

  // ---------- mesa 3.52 (libre 1.25): la foto en un hueco, por orientación (D-050 a D-053) ----------
  const HV = (id, x = 0.05) => huecoEl(id, x, 0.1, 0.4, 0.8), HH = (id, y = 0.1) => huecoEl(id, 0.5, y, 0.45, 0.2);   // vertical y horizontal
  // un carrusel con la diapositiva 2 abierta, con esos huecos, y esas fotos en la bandeja
  async function conHuecos(els, fotos) {
    await tablero([pub(1, 'Carrusel'), pub(2)]);
    await poner('r1', [await foto('base.jpg')]);
    const ids = fotos.length ? await M.addFiles(await Promise.all(fotos.map(([n, w, h]) => foto(n, w, h)))) : [];
    await abrirEditor('r1');
    if (!ed().trOpen) accion('bandeja');
    accion('sl-add');
    compDe(1).els.push(...JSON.parse(json(els)));
    await dibujado();
    return ids;
  }
  const V = n => [n, 1200, 1500], A = n => [n, 1600, 1000];   // vertical y apaisada
  const enLienzo = (fx, fy) => { const r = ed().cv.getBoundingClientRect(); return [r.left + fx * r.width, r.top + fy * r.height]; };
  // fotos del ordenador soltadas en un punto de la diapositiva
  async function soltarOrdenador(files, fx, fy) {
    const dt = new W.DataTransfer(); files.forEach(f => dt.items.add(f));
    const [x, y] = enLienzo(fx, fy);
    ed().cv.dispatchEvent(new W.DragEvent('drop', { clientX: x, clientY: y, dataTransfer: dt, bubbles: true, cancelable: true }));
  }
  const miniatura = f => ed().el.querySelector(`.lb-tph[data-f="${f}"]`);
  // arrastre con el ratón desde una foto de la bandeja hasta un punto de la diapositiva
  function arrastrarDeBandeja(f, fx, fy) {
    const b = miniatura(f); ok(b, 'la foto no está en la bandeja: ' + f);
    const r = b.getBoundingClientRect(), [x, y] = enLienzo(fx, fy);
    puntero('pointerdown', b, r.left + 5, r.top + 5);
    puntero('pointermove', D, x, y);
    puntero('pointerup', D, x, y);
  }
  const conMeta = f => miniatura(f).dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
  const elegidas = () => [...ed().el.querySelectorAll('.lb-tph.elegida')].map(b => b.dataset.f);
  const enCapa = (id, f) => { const e = compDe(1).els.find(q => (q.id === id && !q.hueco) || (q.hueco && q.hueco.id === id)); return e && (f ? e.src === f : e.t === 'hueco' || !e.src); };
  const pasos = () => ed().hist.undo.length;
  const cubre = (e, h) => cerca(e.x, h.x, 0.0002, 'x') || cerca(e.y, h.y, 0.0002, 'y') || cerca(e.w, h.w, 0.0002, 'w') || cerca(e.h, h.h, 0.0002, 'h');
  const aviso = () => qa('.toast').map(t => t.textContent).join(' · ');

  prueba('E48', 'Una foto a un hueco: misma orientación, rellena sin preguntar; distinta, pregunta con su miniatura (1, 2, clic o Esc), va al hueco donde se suelta y ningún atajo actúa; un paso de ⌘Z (D-050)', async () => {
    const [v, a] = await conHuecos([HV('hv'), HH('hh')], [V('e48a.jpg'), A('e48b.jpg')]);
    const hv = HV('hv'), { W: SW, H: SH } = tam();
    // misma orientación: rellena, centrada, sin preguntar
    let n = pasos();
    arrastrarDeBandeja(v, 0.2, 0.5);
    let e = await hasta(() => compDe(1).els.find(q => q.src === v), 4000, 'la vertical en su hueco');
    ok(!ed().ask, 'preguntó con la misma orientación');
    cubre(e, hv); igual([e.cx, e.cy, e.z, e.hueco.id], [0.5, 0.5, 1, 'hv'], 'centrada y con su hueco');
    igual(pasos(), n + 1, 'no es un paso de ⌘Z');
    tecla('z', { meta: true });
    ok(enCapa('hv'), '⌘Z no devolvió el hueco');
    // distinta: al hueco donde se suelta, aunque otro encaje mejor; pregunta y enseña esa foto
    arrastrarDeBandeja(a, 0.2, 0.5);
    let pr = await hasta(() => preguntaHueco(), 4000, 'la pregunta');
    igual([...pr.querySelectorAll('[data-ask]')].map(b => b.textContent), ['1 · Rellenar el recuadro', '2 · Mantener el formato de la foto'], 'las dos respuestas');
    igual(pr.querySelector('img').src, M.files[a].thumbUrl, 'no enseña la miniatura de esa foto');
    ok(!compDe(1).els.some(q => q.src === a), 'la puso antes de contestar');
    // mientras está abierta, ningún otro atajo actúa
    const antes = json(compDe(1)); n = pasos();
    ['t', 'r', 'f', 'Backspace', 'ArrowLeft'].forEach(k => tecla(k)); tecla('z', { meta: true }); tecla('d', { meta: true }); tecla('3');
    ok(preguntaHueco() && !ed().fv, 'un atajo cerró la pregunta o actuó');
    igual(json(compDe(1)), antes, 'un atajo cambió la diapositiva');
    tecla('2');
    e = await hasta(() => compDe(1).els.find(q => q.src === a), 4000, 'la foto con «2»');
    ok(!ed().ask, 'la pregunta sigue abierta');
    igual(e.hueco.id, 'hv', 'no fue al hueco donde se soltó');
    cerca((e.w * SW) / (e.h * SH), 1.6, 0.01, '«2» deformó la foto');
    cerca(e.w, 0.4, 0.002, '«2» no es lo más grande que cabe');
    cerca(e.y + e.h / 2, 0.5, 0.002, '«2» no la centró');
    ok(e.h < 0.8 - 0.01, '«2» no deja franjas');
    igual(pasos(), n + 1, '«2» no es un paso de ⌘Z');
    // una tecla mantenida nunca contesta
    tecla('z', { meta: true });
    arrastrarDeBandeja(a, 0.2, 0.5);
    await hasta(() => preguntaHueco(), 4000, 'la pregunta');
    D.body.dispatchEvent(new W.KeyboardEvent('keydown', { key: '1', repeat: true, bubbles: true, cancelable: true }));
    ok(preguntaHueco(), 'una tecla mantenida contestó');
    // 1: rellena el recuadro, sin deformar
    tecla('1');
    e = await hasta(() => compDe(1).els.find(q => q.src === a), 4000, 'la foto con «1»');
    cubre(e, hv); igual([e.cx, e.cy, e.z], [0.5, 0.5, 1], 'centrada');
    tecla('z', { meta: true });
    // clic
    arrastrarDeBandeja(a, 0.2, 0.5);
    (await hasta(() => preguntaHueco(), 4000, 'la pregunta')).querySelector('[data-ask="entera"]').click();
    e = await hasta(() => compDe(1).els.find(q => q.src === a), 4000, 'la foto con un clic');
    ok(e.h < 0.8 - 0.01, 'el clic no mantuvo el formato');
    tecla('z', { meta: true });
    // Esc: no entra, su hueco queda libre, ningún paso de ⌘Z
    n = pasos();
    arrastrarDeBandeja(a, 0.2, 0.5);
    await hasta(() => preguntaHueco(), 4000, 'la pregunta');
    tecla('Escape');
    await hasta(() => !ed().ask, 4000, 'que Esc cierre la pregunta');
    await espera(30);
    ok(enCapa('hv') && !compDe(1).els.some(q => q.src === a), 'Esc puso la foto');
    igual(pasos(), n, 'Esc sumó un paso de ⌘Z');
    ok(!ed().ojo, 'quedó resaltado el hueco');
  });

  prueba('E49', 'Varias fotos: cada una a un hueco libre de su orientación, en orden de capas y sin preguntar; las otras, una pregunta por foto; un solo paso de ⌘Z; Esc solo deja fuera esa (D-050)', async () => {
    // 1 hueco horizontal y 2 verticales con 1 horizontal y 2 verticales, del ordenador: ninguna pregunta
    await conHuecos([HV('v1'), HH('h1'), HV('v2', 0.5)], []);
    let n = pasos();
    await soltarOrdenador([await foto('e49v1.jpg', 1200, 1500), await foto('e49a.jpg', 1600, 1000), await foto('e49v2.jpg', 1200, 1500)], 0.9, 0.95);
    await hasta(() => compDe(1).els.filter(q => q.src).length === 3, 8000, 'las tres en sus huecos');
    ok(!ed().ask, 'preguntó con las tres en su orientación');
    const nombre = e => M.files[e.src].name;
    igual(compDe(1).els.map(e => [e.hueco.id, nombre(e)]), [['v1', 'e49v1.jpg'], ['h1', 'e49a.jpg'], ['v2', 'e49v2.jpg']], 'cada una en su hueco, en orden de capas');
    igual(pasos(), n + 1, 'no es un solo paso de ⌘Z');
    tecla('z', { meta: true });
    ok(compDe(1).els.every(e => e.t === 'hueco'), '⌘Z no las quitó todas');
    // 2 huecos verticales con una vertical y una horizontal, de la bandeja: solo pregunta por la horizontal
    const [v, a] = await conHuecos([HV('v1'), HV('v2', 0.5)], [V('e49c.jpg'), A('e49d.jpg')]);
    conMeta(a); conMeta(v);
    n = pasos();
    arrastrarDeBandeja(v, 0.9, 0.95);
    const pr = await hasta(() => preguntaHueco(), 4000, 'la pregunta por la horizontal');
    igual(pr.querySelector('img').src, M.files[a].thumbUrl, 'no pregunta por la horizontal');
    igual(ed().ojo, 'v2', 'no resalta el hueco que queda');
    ok(enCapa('v1', v), 'la vertical no entró antes de la pregunta');
    tecla('1');
    await hasta(() => enCapa('v2', a), 4000, 'la horizontal en el otro');
    ok(!ed().ask, 'hizo otra pregunta');
    igual(pasos(), n + 1, 'con una pregunta no es un solo paso de ⌘Z');
    tecla('z', { meta: true });
    ok(compDe(1).els.every(e => e.t === 'hueco'), '⌘Z no las quitó las dos');
    // Esc en la pregunta: esa no entra, su hueco queda libre y las ya colocadas se quedan
    conMeta(a); conMeta(v);
    arrastrarDeBandeja(v, 0.9, 0.95);
    await hasta(() => preguntaHueco(), 4000, 'la pregunta');
    tecla('Escape');
    await hasta(() => !ed().ask, 4000, 'que Esc cierre');
    ok(enCapa('v1', v) && enCapa('v2'), 'Esc no dejó la vertical puesta y el otro hueco libre');
    ok(miniatura(a), 'la de Esc no sigue en la bandeja');
    // varias preguntas: una por foto
    const [a1, a2] = await conHuecos([HV('v1'), HV('v2', 0.5)], [A('e49e.jpg'), A('e49f.jpg')]);
    conMeta(a1); conMeta(a2);
    arrastrarDeBandeja(a1, 0.9, 0.95);
    igual((await hasta(() => preguntaHueco(), 4000, 'la 1.ª')).querySelector('img').src, M.files[a1].thumbUrl, 'la primera pregunta');
    tecla('2');
    await hasta(() => enCapa('v1', a1), 4000, 'la primera puesta');
    igual((await hasta(() => preguntaHueco(), 4000, 'la 2.ª')).querySelector('img').src, M.files[a2].thumbUrl, 'la segunda pregunta');
    tecla('1');
    await hasta(() => enCapa('v2', a2), 4000, 'la segunda puesta');
    tecla('z', { meta: true });
    ok(compDe(1).els.every(e => e.t === 'hueco'), 'con dos preguntas no es un solo paso de ⌘Z');
  });

  prueba('E50', 'Más fotos que huecos: las que no caben se quedan en la bandeja, con un aviso que dice cuántas; sin ningún hueco, como siempre (D-050)', async () => {
    const [a, b, c] = await conHuecos([HV('v1')], [V('e50a.jpg'), V('e50b.jpg'), V('e50c.jpg')]);
    [a, b, c].forEach(conMeta);
    igual(elegidas().length, 3, 'las elegidas');
    arrastrarDeBandeja(a, 0.2, 0.5);
    await hasta(() => enCapa('v1', a), 4000, 'la primera en el hueco');
    await espera(30);
    ok(!ed().ask, 'preguntó');
    igual(compDe(1).els.length, 1, 'alguna entró en la diapositiva');
    ok(/2 fotos no caben/.test(aviso()), 'el aviso: ' + aviso());
    ok(miniatura(b) && miniatura(c) && !miniatura(a), 'las que no caben no siguen en la bandeja');
    // sin ningún hueco: fotos sueltas, como hoy
    const [d, e] = await conHuecos([], [V('e50d.jpg'), V('e50e.jpg')]);
    conMeta(d); conMeta(e);
    arrastrarDeBandeja(d, 0.5, 0.5);
    await hasta(() => compDe(1).els.length === 2, 4000, 'las dos, sueltas');
    ok(compDe(1).els.every(q => q.src && !q.hueco) && !ed().ask, 'sin huecos no son fotos sueltas');
  });

  prueba('E51', 'Una foto: pulsada, al hueco elegido o al primero de su orientación o al primero libre con la pregunta; sobre un hueco lleno lo sustituye y la anterior vuelve a la bandeja; fuera de un hueco, suelta (D-050)', async () => {
    const [v, a, v2] = await conHuecos([HH('h1'), HV('v1')], [V('e51a.jpg'), A('e51b.jpg'), V('e51c.jpg')]);
    // sin elegir: el primero libre de su orientación, aunque no sea el primero en capas
    accion('tr-add', { f: v });
    await hasta(() => enCapa('v1', v), 4000, 'al vertical');
    ok(!ed().ask, 'preguntó');
    tecla('z', { meta: true });
    // el hueco elegido, aunque no coincida: con la pregunta
    elegir(compDe(1).els.find(q => q.id === 'v1'));
    accion('tr-add', { f: a });
    await hasta(() => preguntaHueco(), 4000, 'la pregunta');
    igual(ed().ojo, 'v1', 'no va al hueco elegido');
    tecla('Escape');
    await hasta(() => !ed().ask, 4000, 'que Esc cierre');
    // lleno el de su orientación, el primero libre, con la pregunta
    ed().sel = null; ed().mas = [];
    accion('tr-add', { f: v });
    await hasta(() => enCapa('v1', v), 4000, 'al vertical');
    ed().sel = null; ed().mas = [];
    accion('tr-add', { f: v2 });
    await hasta(() => preguntaHueco(), 4000, 'la pregunta del hueco que queda');
    igual(ed().ojo, 'h1', 'no va al primero libre');
    tecla('1');
    await hasta(() => enCapa('h1', v2), 4000, 'al horizontal');
    // sobre un hueco lleno: sustituye con la misma regla; la anterior vuelve a la bandeja, también la de un post ya aplicado
    await aplicarEditor();
    await abrirEditor('r1', 1); if (!ed().trOpen) accion('bandeja');
    await dibujado();
    ok(!miniatura(v) && miniatura(a), 'en la bandeja antes de sustituir');
    ok(!ed().ask, 'una pregunta al abrir');
    arrastrarDeBandeja(a, 0.2, 0.5);
    await hasta(() => preguntaHueco(), 4000, 'la pregunta al sustituir');
    igual(ed().ojo, compDe(1).els.find(q => q.hueco && q.hueco.id === 'v1').id, 'no pregunta por el hueco lleno');
    tecla('2');
    const e = await hasta(() => compDe(1).els.find(q => q.src === a), 4000, 'la sustituta');
    igual([e.hueco.id, compDe(1).els.length], ['v1', 2], 'no entró en ese hueco');
    ok(e.h < 0.8 - 0.01, 'no siguió la regla');
    await hasta(() => miniatura(v), 4000, 'la anterior en la bandeja');
    ok(!miniatura(v).classList.contains('uso'), 'la anterior sale como usada');
    tecla('z', { meta: true });
    await hasta(() => !miniatura(v), 4000, 'que ⌘Z la devuelva a su hueco');
    ok(compDe(1).els.some(q => q.src === v), '⌘Z no la devolvió');
    // todos llenos: pulsada no entra y avisa; soltada fuera de un hueco, suelta
    ed().sel = null; ed().mas = [];
    accion('tr-add', { f: a });
    await hasta(() => /1 foto no cabe/.test(aviso()), 4000, 'el aviso');
    igual(compDe(1).els.length, 2, 'entró en la diapositiva sin hueco');
    arrastrarDeBandeja(a, 0.75, 0.8);
    await hasta(() => compDe(1).els.length === 3, 4000, 'la foto suelta');
    const s = compDe(1).els.find(q => q.src === a);
    ok(!s.hueco && !ed().ask, 'fuera de un hueco no es una foto suelta');
  });

  prueba('E52', 'Bandeja: ⌘+clic elige y quita, se marcan; arrastrar una elegida se las lleva todas y otra solo a sí misma; clic y Esc vacían; con «Todas» sale antes el aviso de lote (D-051, D-022)', async () => {
    const [a, b, c] = await conHuecos([HV('v1'), HV('v2', 0.5)], [V('e52a.jpg'), V('e52b.jpg'), V('e52c.jpg')]);
    conMeta(a); conMeta(b);
    igual(elegidas(), [a, b], '⌘+clic no las elige ni las marca');
    ok(!compDe(1).els.some(q => q.src), '⌘+clic puso una foto');
    conMeta(a);
    igual(elegidas(), [b], '⌘+clic no la quita');
    conMeta(a);
    tecla('Escape');
    igual(elegidas(), [], 'Esc no vacía la selección');
    ok(M.libre.abierto(), 'Esc cerró el editor');
    // un clic sin ⌘ hace lo de hoy y la vacía
    conMeta(a);
    miniatura(c).click();
    await hasta(() => enCapa('v1', c), 4000, 'el clic pone la foto');
    igual(elegidas(), [], 'el clic no vacía la selección');
    tecla('z', { meta: true });
    // arrastrar una que no está elegida: solo esa, y las elegidas siguen
    conMeta(a); conMeta(b);
    arrastrarDeBandeja(c, 0.2, 0.5);
    await hasta(() => enCapa('v1', c), 4000, 'solo esa');
    await espera(30);
    ok(!enCapa('v2', a) && !enCapa('v2', b) && enCapa('v2'), 'se llevó otra');
    igual(elegidas(), [a, b], 'la selección cambió');
    tecla('z', { meta: true });
    await dibujado();
    // una de las elegidas: todas, en el orden de la bandeja
    arrastrarDeBandeja(b, 0.2, 0.5);
    await hasta(() => enCapa('v1', a) && enCapa('v2', b), 4000, 'las dos elegidas');
    igual(elegidas(), [], 'la selección no se vació al soltar');
    // con «Todas» y una ya usada: antes el aviso de lote, luego lo demás
    const [u, l] = await conHuecos([HV('v1'), HV('v2', 0.5)], [V('e52u.jpg'), V('e52v.jpg')]);
    M._test.place('r2', u);
    await hasta(() => slot('r2').photos.includes(u), 4000, 'la foto usada en otra publicación');
    M._in.trayFiltro('todas');
    await hasta(() => miniatura(u) && miniatura(u).classList.contains('uso'), 4000, 'la usada, con ✓');
    conMeta(u); conMeta(l);
    igual(elegidas().sort(), [u, l].sort(), 'con «Todas» no se eligen');
    arrastrarDeBandeja(l, 0.2, 0.5);
    let pr = await hasta(() => ed().ask, 4000, 'el aviso de lote');
    ok(pr.querySelector('[data-ask="saltar"]') && pr.querySelector('[data-ask="usar"]') && !preguntaHueco(), 'no es el aviso de lote');
    pr.querySelector('[data-ask="saltar"]').click();
    await hasta(() => enCapa('v1', l), 4000, 'solo la no usada');
    await espera(30);
    ok(enCapa('v2'), '«Saltar repetidas» la puso');
    tecla('z', { meta: true });
    await dibujado();
    conMeta(u); conMeta(l);
    arrastrarDeBandeja(l, 0.2, 0.5);
    pr = await hasta(() => ed().ask, 4000, 'el aviso de lote');
    pr.querySelector('[data-ask="usar"]').click();
    await hasta(() => compDe(1).els.filter(q => q.src).length === 2, 6000, 'las dos, con «Usar todas»');
    M._in.trayFiltro('sin');
  });

  prueba('E53', 'Marco vacío: cuenta como hueco y alterna con doble clic; lo aplicado coincide con el editor; plantilla sin preguntar; «Guardar como plantilla» y «Quitar plantilla» con los huecos nuevos (D-050, D-052, D-034)', async () => {
    const [a, v] = await conHuecos([marcoEl('m1', 0.05, 0.1, 0.4, 0.8)], [A('e53a.jpg'), V('e53v.jpg')]);
    const m0 = marcoEl('m1', 0.05, 0.1, 0.4, 0.8), { W: SW, H: SH } = tam();
    arrastrarDeBandeja(a, 0.2, 0.5);
    await hasta(() => preguntaHueco(), 4000, 'la pregunta del marco');
    tecla('2');
    const e = await hasta(() => compDe(1).els.find(q => q.src === a), 4000, 'la foto en el marco');
    igual(e.id, 'm1', 'el marco no conserva su capa');
    cerca((e.w * SW) / (e.h * SH), 1.6, 0.01, 'deformada');
    // doble clic: alterna
    const dbl = el => { const [x, y] = enLienzo(el.x + el.w / 2, el.y + el.h / 2); ed().cv.dispatchEvent(new W.MouseEvent('dblclick', { clientX: x, clientY: y, bubbles: true, cancelable: true })); };
    await dibujado(); dbl(e);
    cubre(compDe(1).els[0], m0);
    dbl(compDe(1).els[0]);
    ok(compDe(1).els[0].h < 0.8 - 0.01, 'el segundo doble clic no volvió a la foto entera');
    // lo aplicado es lo que enseña el editor: la foto entera y las franjas con el fondo
    await dibujado();
    const puntos = [[0.35, 0.55], [0.25, 0.15]], editor = puntos.map(([x, y]) => pixel(x * SW, y * SH).slice(0, 3));
    ok(editor[1].every(c => c > 240), 'la franja del editor no enseña el fondo: ' + json(editor[1]));
    await aplicarEditor();
    const s = slot('r1'), px = await pixelesDe(await M._in.getBlob(s.photos[1]));
    const bm = await W.createImageBitmap(await M._in.getBlob(s.photos[1]));
    puntos.forEach(([x, y], k) => { const p = px(Math.round(x * bm.width), Math.round(y * bm.height)); p.forEach((c, j) => cerca(c, editor[k][j], 26, `el píxel ${k} aplicado frente al editor`)); });
    await abrirEditor('r1', 1); if (!ed().trOpen) accion('bandeja');
    // la plantilla guarda el hueco, no la foto ni su recorte; aplicarla no pregunta
    const t = await guardarPlant();
    igual(t.comp.els[0].src, null, 'la plantilla guardó la foto');
    accion('sl-add');
    aplicarPlant(t, 'todo');
    const h = compDe(2).els[0];
    igual([h.t, h.src, h.x, h.y, h.w, h.h, !!h.hueco], ['foto', null, m0.x, m0.y, m0.w, m0.h, false], 'al aplicar la plantilla, el marco como era');
    // «Solo fotos»: el hueco de la plantilla se llena sin preguntar y al borrarla el marco vuelve
    ed().i = 1; await dibujado();
    aplicarPlant(t, 'fotos');
    ok(!ed().ask, 'la plantilla preguntó');
    const f1 = compDe(1).els.find(q => q.src);
    ok(f1 && f1.hueco && f1.hueco.src === null, 'la foto de la plantilla no guarda su marco: ' + json(f1));
    igual([f1.hueco.x, f1.hueco.w], [m0.x, m0.w], 'el marco guardado');
    elegir(f1); accion('del');
    igual(compDe(1).els.filter(e => e.t === 'foto' && !e.src).length, 1, 'al borrar la foto el marco no volvió');
    // «Quitar plantilla» la deja como estaba
    tecla('z', { meta: true });
    accion('tpl-quitar');
    const f2 = compDe(1).els.find(q => q.src === a);
    ok(f2 && f2.hueco && f2.hueco.id === 'm1', '«Quitar plantilla» no devolvió la foto en su hueco');
    M.libre.cerrar();
  });

  prueba('E54', '«Intercambiar»: solo en una foto de un hueco; entre llenos y hacia uno vacío, con la regla de siempre y la pregunta; Esc y un clic fuera cancelan; un paso de ⌘Z; nada en lo que se dibuja (D-053)', async () => {
    const [p1, p2, p3] = await conHuecos([HV('v1'), HV('v2', 0.5), HH('h1', 0.9), { id: 'tx', t: 'texto', txt: 'Hola', x: 0.1, y: 0.92, w: 0.3, h: 0.04, size: 0.03, color: '#000000', al: 'izq', rot: 0, op: 1 }], [V('e54a.jpg'), V('e54b.jpg'), A('e54c.jpg')]);
    const hv1 = HV('v1'), hv2 = HV('v2', 0.5), { W: SW, H: SH } = tam();
    arrastrarDeBandeja(p1, 0.2, 0.5);
    await hasta(() => enCapa('v1', p1), 4000, 'p1');
    arrastrarDeBandeja(p2, 0.7, 0.5);
    await hasta(() => enCapa('v2', p2), 4000, 'p2');
    const a = () => compDe(1).els.find(e => e.hueco && e.hueco.id === 'v1'), b = () => compDe(1).els.find(e => e.hueco && e.hueco.id === 'v2');
    const boton = () => q('.lb-fl [data-lb="cambio"]');
    // solo sale con una foto de un hueco
    accion('cap', { id: 'tx' }); ok(!boton(), 'sale en un texto');
    accion('cap', { id: 'v1' });
    accion('cap', { id: a().id }); ok(boton(), 'no sale en la foto de un hueco');
    accion('lock'); ok(!boton(), 'sale en una foto bloqueada'); accion('lock');
    const clic = (fx, fy) => { const [x, y] = enLienzo(fx, fy); puntero('pointerdown', ed().cv, x, y); puntero('pointerup', ed().cv, x, y); };
    const elegirA = () => { accion('cap', { id: a().id }); ok(boton(), 'sin el botón'); boton().click(); ok(ed().cambio, 'no entró en «Intercambiar»'); };
    // el rótulo, el resaltado (solo en el lienzo) y la barra
    await dibujado();
    const fuera = pixel(0.7 * SW, 0.5 * SH), c0 = json(compDe(1));
    elegirA();
    ok(!q('.lb-hint').hidden && /Intercambiar/.test(q('.lb-hint').textContent), 'sin rótulo');
    ok(q('.lb-fl').hidden, 'la barra sigue ahí');
    await dibujado();
    ok(json(pixel(0.7 * SW, 0.5 * SH)) !== json(fuera), 'el otro hueco no se resalta');
    igual(json(compDe(1)), c0, 'el resaltado cambió la diapositiva');
    // Esc cancela; ningún otro atajo actúa
    tecla('Backspace'); tecla('t'); ok(ed().cambio && json(compDe(1)) === c0, 'un atajo actuó');
    tecla('Escape'); ok(!ed().cambio && M.libre.abierto(), 'Esc no cancela');
    await dibujado();
    igual(json(pixel(0.7 * SW, 0.5 * SH)), json(fuera), 'quedó el resaltado');
    // un clic fuera de un hueco, o fuera de la diapositiva, cancela
    elegirA(); clic(0.97, 0.05); ok(!ed().cambio && json(compDe(1)) === c0, 'un clic en la diapositiva no cancela');
    elegirA(); puntero('pointerdown', ed().scroll, 2, 2); ok(!ed().cambio && json(compDe(1)) === c0, 'un clic en el área gris no cancela');
    elegirA(); puntero('pointerdown', q('.lb-panel'), 2, 2); ok(!ed().cambio, 'un clic en el panel no cancela');
    // entre dos llenos de la misma orientación: sin preguntar, el encuadre manual se pierde, un paso de ⌘Z
    a().z = 2; a().cx = 0.1;
    let n = pasos();
    elegirA(); await dibujado(); clic(0.7, 0.5);
    await hasta(() => a().src === p2 && b().src === p1, 4000, 'el intercambio');
    ok(!ed().ask, 'preguntó');
    igual([a().z, a().cx, b().z, b().cx], [1, 0.5, 1, 0.5], 'el encuadre no se perdió');
    cubre(a(), hv1); cubre(b(), hv2);
    igual(pasos(), n + 1, 'no es un paso de ⌘Z');
    tecla('z', { meta: true });
    igual([a().src, b().src, a().z], [p1, p2, 2], '⌘Z no lo deshizo');
    a().z = 1; a().cx = 0.5;
    // hacia uno vacío de otra orientación: pregunta, y el suyo queda libre
    n = pasos();
    elegirA(); clic(0.7, 0.95);
    await hasta(() => preguntaHueco(), 4000, 'la pregunta hacia el vacío');
    igual(ed().ojo, 'h1', 'no resalta el destino');
    tecla('1');
    await hasta(() => enCapa('h1', p1), 4000, 'la foto en el vacío');
    const v1 = compDe(1).els.find(e => e.id === 'v1');
    ok(v1 && v1.t === 'hueco', 'su hueco no quedó libre: ' + json(compDe(1).els.map(e => e.id)));
    igual(compDe(1).els.map(e => e.hueco ? e.hueco.id : e.id), ['v1', 'v2', 'h1', 'tx'], 'las capas');
    igual(pasos(), n + 1, 'no es un paso de ⌘Z');
    tecla('z', { meta: true });
    ok(a() && a().src === p1 && enCapa('h1'), '⌘Z no lo devolvió');
    // Esc en la pregunta: todo como estaba
    const c1 = json(compDe(1)); n = pasos();
    elegirA(); clic(0.7, 0.95);
    await hasta(() => preguntaHueco(), 4000, 'la pregunta');
    tecla('Escape');
    await hasta(() => !ed().ask, 4000, 'que Esc cierre');
    await espera(30);
    igual(json(compDe(1)), c1, 'Esc cambió algo'); igual(pasos(), n, 'Esc sumó un paso');
    // entre llenos de distinta orientación: una pregunta por cada foto
    arrastrarDeBandeja(p3, 0.7, 0.95);
    await hasta(() => enCapa('h1', p3), 4000, 'p3');
    n = pasos();
    elegirA(); clic(0.7, 0.95);
    await hasta(() => preguntaHueco(), 4000, 'la 1.ª pregunta');
    igual(preguntaHueco().querySelector('img').src, M.files[p1].thumbUrl, 'la 1.ª es la foto elegida');
    tecla('2');
    await hasta(() => preguntaHueco() && preguntaHueco().querySelector('img').src === M.files[p3].thumbUrl, 4000, 'la 2.ª pregunta');
    tecla('2');
    await hasta(() => enCapa('h1', p1) && enCapa('v1', p3), 4000, 'el intercambio con preguntas');
    const ph = compDe(1).els.find(e => e.src === p1);
    cerca((ph.w * SW) / (ph.h * SH), 0.8, 0.01, 'la vertical deformada');
    igual(pasos(), n + 1, 'con preguntas no es un paso de ⌘Z');
    // una foto que cruza diapositivas no lo tiene
    ph.pan = { id: 'x', n: 2, k: 0 }; accion('cap', { id: ph.id });
    ok(!boton(), 'sale en una foto que cruza diapositivas');
    delete ph.pan;
    M.libre.cerrar();
  });

  // ---------- carpetas de la bandeja (D-069 a D-073) ----------
  const hist = () => M.board().carpetas.find(c => c.id === 'historias');
  const carp = id => M.board().carpetas.find(c => c.id === id);
  const raiz = (todas = true) => M._in.bandejaVista({ carpeta: null, todas }).map(x => x.f);
  const enCarpeta = (id, todas = true) => M._in.bandejaVista({ carpeta: id, todas }).map(x => x.f);
  const aCarpeta = (id, files) => M.addFiles(files, null, { carpeta: id });
  const medida = async () => { const r = await M.informeArchivos(); return { claves: r.claves, bytes: r.bytes }; };

  prueba('C1', '«Historias» existe para todo cliente, nuevo o de antes, es fija y la base de datos va en la 5 (D-069, D-060)', async () => {
    await tablero([pub(1)]);
    igual(M.carpetas(), [{ id: 'historias', name: 'Historias', parent: null, fija: true, fotos: 0 }], 'las carpetas de un cliente nuevo');
    await M.flush();
    const rec = await M._in.idbGet('bandejas', CLIENTE);
    igual(rec.carpetas.map(c => c.id), ['historias'], 'guardada en su registro');
    // un cliente de antes: su registro sin carpetas
    await M._in.idbPut('bandejas', CLIENTE, { client: CLIENTE, tray: rec.tray, at: rec.at });
    await M.open(`${CLIENTE}-${MES}`);
    igual(M.carpetas().map(c => c.id), ['historias'], 'las carpetas de un cliente de antes');
    const err = await M.borrarCarpeta('historias');
    ok(err && err.error, 'se pudo borrar «Historias»');
    await M.pedirBorrarCarpeta('historias');
    ok(!dialogo() || !q('[data-act="carpeta-borrar"]'), 'avisa como si se pudiera borrar');
    const v = await new Promise((res, rej) => { const r = W.indexedDB.open('mesa-feed'); r.onsuccess = () => { const n = r.result.version; r.result.close(); res(n); }; r.onerror = () => rej(r.error); });
    igual(v, 5, 'versión de IndexedDB');
  });

  prueba('C2', 'Ninguna escritura de «bandejas» pierde las carpetas: guardar, juntar, borrar mes, importar y la copia de una recarga; board().tray lleva las sin usar y la raíz no (D-069)', async () => {
    const clave = `${CLIENTE}-${MES}`;
    await tablero([pub(1)]);
    const c = M.crearCarpeta('Sesión').id, s2 = M.crearCarpeta('Sub', c).id;
    igual(M.crearCarpeta('Sesión').id, c, 'dos hermanas con el mismo nombre');
    const [a] = await aCarpeta(s2, [await foto('c2-a.jpg')]);
    const [b] = await M.addFiles([await foto('c2-b.jpg')]);
    ok(M.board().tray.includes(a), 'board().tray no lleva la foto de la carpeta');
    igual(raiz(), [b], 'la raíz');
    igual(enCarpeta(s2), [a], 'la carpeta');
    igual(M._in.bandejaVista().map(x => x.f), [b], 'lo que enseña la bandeja abierta en la raíz');
    const mira = async que => { igual(((await M._in.idbGet('bandejas', CLIENTE)).carpetas || []).map(x => [x.id, x.files.length]).sort(), [['historias', 0], [c, 0], [s2, 1]].sort(), que); };
    await M.flush(); await mira('guardar');
    ok(!('carpetas' in (await M._in.idbGet('boards', clave))), 'el tablero guarda las carpetas');
    // juntar: un tablero de antes de la 3.44 con su bandeja
    const viejo = await M._in.idbGet('boards', clave); viejo.tray = [b]; await M._in.idbPut('boards', clave, viejo);
    await M.open(clave); await M.flush(); await mira('juntar');
    igual(carp(s2).files, [a], 'tras reabrir');
    // borrar otro mes y el último: se quedan (D-072)
    await M.init({ client: CLIENTE, month: '2026-12', slots: [pub(9, 'Foto', 9, '2026-12')], past: [], force: true });
    igual(carp(s2).files, [a], 'en el otro mes');
    await M.flush();
    await M.purge(clave); await mira('borrar un mes con otro abierto');
    await M.purge(`${CLIENTE}-2026-12`); await mira('borrar el último mes, abierto');
    ok(await M._test.fileRec(a), 'el último mes se llevó la foto de la carpeta');
    // importar
    await M.init({ client: CLIENTE, month: MES, slots: [pub(1)], past: [], force: true });
    igual(carp(s2).files, [a], 'el mes nuevo trae la bandeja');
    await M.flush();
    const blob = await M.exportAll({ returnBlob: true });
    const r = await M.importData(blob, { confirm: false });
    ok(r && !r.error, 'importar falló: ' + json(r));
    await M.open(clave); await M.flush(); await mira('importar');
    // la copia que deja una recarga: si es más nueva manda
    const b0 = await M._in.idbGet('boards', clave), futuro = new Date(Date.now() + 60000).toISOString();
    W.localStorage.setItem('mesa-pending', json({ key: clave, v: 5, board: { ...b0, savedAt: futuro, tray: [a, b], carpetas: [{ id: 'historias', name: 'Historias', parent: null, files: [b], fija: true }, { id: c, name: 'Sesión', parent: null, files: [] }, { id: s2, name: 'Sub', parent: c, files: [a] }] } }));
    await M.open(clave);
    igual(hist().files, [b], 'la copia de una recarga');
  });

  prueba('C3', 'Una foto en dos carpetas es un solo archivo: sobrevive a borrar una, con los mismos bytes, y se va al quitarla de la otra (D-069, D-071)', async () => {
    const clave = `${CLIENTE}-${MES}`;
    await tablero([pub(1)]);
    const c = M.crearCarpeta('Origen').id, antes = await medida();
    const [a] = await aCarpeta(c, [await foto('c3-a.jpg', 1400, 1000)]);
    const con = await medida(), rec0 = await M._test.fileRec(a);
    ok(con.claves === antes.claves + 1, 'la foto no entró');
    const [a2] = await aCarpeta('historias', [await foto('c3-a.jpg', 1400, 1000)]);
    igual(a2, a, 'es otro archivo');
    igual(await medida(), con, 'copiarla escribió bytes');
    igual(hist().files, [a], '«Historias»');
    const p = await M.planBorrarCarpeta(c);
    igual([p.fotos, p.nBorran, p.quedan.otra, p.bytes], [1, 0, 1, 0], 'el plan');
    const r = await M.borrarCarpeta(c);
    ok(r && r.ok, json(r));
    igual(await M._test.fileRec(a), rec0, 'los bytes tras borrar el origen');
    ok(M.board().tray.includes(a) && hist().files.includes(a), 'sigue en «Historias»');
    M._test.removeFile(a, 'historias');
    ok(!M.board().tray.includes(a) && !hist().files.includes(a), 'no salió de «Historias»');
    ok(M._in.delList().includes(a), 'no queda apuntada para borrar');
    await M.flush(); await M.open(clave);      // ya ningún paso de ⌘Z la tiene
    await hasta(async () => !(await M._test.fileRec(a)), 6000, 'que se borre su archivo');
    igual(await medida(), antes, 'lo guardado tras quitarla');
  });

  prueba('C4', 'Borrar carpeta: el aviso dice lo que hay, lo que se borra, lo que se queda y por qué; se queda lo de publicaciones (también canceladas), historias, huecos y otras carpetas (D-070)', async () => {
    await tablero([pub(1), pub(2)]);
    const c = M.crearCarpeta('Sesión').id, sub = M.crearCarpeta('Sub', c).id, sub2 = M.crearCarpeta('Vacía', sub).id;
    const nombres = ['c4-pub', 'c4-can', 'c4-his', 'c4-hue', 'c4-otr', 'c4-lib'];
    const ids = await aCarpeta(c, await Promise.all(nombres.map(n => foto(n + '.jpg'))));
    const [pu, ca, hi, hu, ot, li] = ids;
    const [zz] = await aCarpeta(sub, [await foto('c4-zz.jpg')]);
    M._test.place('r1', pu); M._test.place('r2', ca); M.setEstado('r2', 'cancelado');
    const hid = M.hs.anadir(`${MES}-20`);
    M._in.S.historias.find(h => h.id === hid).photos = [hi]; M._in.save();
    await pulsar('[data-act="addfiller"]'); await M._test.setPreview(0, hu);
    await aCarpeta('historias', [await foto('c4-otr.jpg')]);
    await M.flush();
    const p = await M.planBorrarCarpeta(c);
    igual([p.fotos, p.subcarpetas, p.nBorran], [7, 2, 2], 'el plan');
    igual(p.quedan, { pub: 1, cancelada: 1, historia: 1, hueco: 1, otra: 1 }, 'lo que se queda y por qué');
    const reales = (await M._test.fileRec(li)).bytes + (await M._test.fileRec(zz)).bytes;
    ok(p.bytes >= reales, 'el espacio que libera no cuenta las fotos');
    await M.pedirBorrarCarpeta(c);
    const t = dialogo().textContent;
    for (const x of ['«Sesión»', '7 fotos', '2 subcarpetas', 'borran 2 fotos', 'quedan 5', 'en una publicación', 'en una publicación cancelada', 'en una historia', 'portada de un hueco', 'también en otra carpeta', 'no se puede deshacer']) ok(t.includes(x), `el aviso no dice «${x}»: ${t}`);
    ok(q('.detail .btn2[data-act="close"]').textContent === 'Cancelar' && q('[data-act="carpeta-borrar"]').textContent === 'Borrar', 'los botones');
    await pulsar('.detail .btn2[data-act="close"]');
    ok(carp(c), 'cancelar borró la carpeta');
    await M.pedirBorrarCarpeta(c);
    await pulsar('[data-act="carpeta-borrar"]');
    await hasta(async () => !carp(c) && !(await M._test.fileRec(li)), 6000, 'que se borre');
    igual([!!carp(sub), !!carp(sub2), !!(await M._test.fileRec(zz))], [false, false, false], 'las subcarpetas y sus fotos');
    for (const f of [pu, ca, hi, hu, ot]) ok(await M._test.fileRec(f), 'se borró una foto que se usa: ' + M.files[f]);
    ok(raiz().includes(hi), 'la foto de la historia no queda en la raíz (D-056)');
    ok(!raiz().includes(ot) && hist().files.includes(ot), 'la de «Historias» salió suelta en la raíz');
    const rec = await M._in.idbGet('bandejas', CLIENTE);
    igual(rec.carpetas.map(x => x.id), ['historias'], 'guardado');
    ok(!rec.tray.includes(li) && !M._in.delList().includes(li), 'quedan restos en la bandeja o en la lista');
  });

  prueba('C5', 'Borrar carpeta suelta la memoria y sale del historial: ⌘Z no la devuelve, los pasos que quedan funcionan y uno con su foto en una publicación se corta (D-070, D-071)', async () => {
    await tablero([pub(1)]);
    const c = M.crearCarpeta('Una').id;
    const [a, b] = await aCarpeta(c, [await foto('c5-a.jpg'), await foto('c5-b.jpg')]);
    const [t1] = await M.addFiles([await foto('c5-t1.jpg')]);
    const [t2] = await M.addFiles([await foto('c5-t2.jpg')]);
    await M.flush();
    M._test.place('r1', a); await M.flush();   // paso: a en la publicación
    M._in.S.slots[0].photos = []; M._in.S.tray.unshift(a); M._in.changed(); await M.flush();   // paso: vuelve a su carpeta
    ok(M.board().tray.includes(a) && enCarpeta(c, false).includes(a), 'no volvió a su carpeta');
    M._test.place('r1', t1); await M.flush();  // paso: otra foto en la publicación
    ok(M._test.hist().undo >= 3, 'faltan pasos');
    const url = M.files[b].thumbUrl;
    ok(String(url).startsWith('blob:'), 'sin miniatura');
    M.blobs[b] = await M._in.getBlob(b); M.bigUrls = M.bigUrls || {}; M.bigUrls[b] = W.URL.createObjectURL(M.blobs[b]);
    const r = await M.borrarCarpeta(c);
    ok(r && r.ok && r.borradas === 2, json(r));
    for (const f of [a, b]) {
      ok(!M.files[f] && !M.blobs[f] && !M.thumbBlobs[f] && !(M.bigUrls && M.bigUrls[f]), 'queda en memoria');
      ok(!(await M._test.fileRec(f)), 'queda el archivo');
    }
    const u1 = M._test.hist().undo;
    ok(u1 === 1, 'el paso con la foto en la publicación no se cortó: ' + u1);
    M._test.place('r1', t2); await M.flush();
    M._test.undo(); await M.flush();
    igual(slot('r1').photos.includes(t2), false, 'deshacer un paso que queda');
    for (let i = 0; i < 4; i++) { M._test.undo(); await M.flush(); }
    ok(!carp(c), '⌘Z devolvió la carpeta');
    ok(!M.board().tray.some(f => f === a || f === b), '⌘Z devolvió las fotos');
    for (let i = 0; i < 4; i++) { M._test.redo(); await M.flush(); }
    ok(!carp(c) && !(await M._test.fileRec(a)), 'rehacer devolvió algo');
  });

  prueba('C6', 'Sin restos: rondas de subir y borrar una carpeta dejan las claves y los bytes de «files» como estaban (D-071)', async () => {
    await tablero([pub(1)]);
    await M.flush();
    const antes = await medida();
    for (let n = 0; n < 3; n++) {
      const c = M.crearCarpeta('Ronda ' + n).id;
      await aCarpeta(c, await Promise.all(Array.from({ length: 12 }, (_, i) => foto(`c6-${n}-${i}.jpg`, 500, 600))));
      const con = await medida();
      ok(con.claves === antes.claves + 12, 'no entraron: ' + con.claves);
      const r = await M.borrarCarpeta(c);
      ok(r && r.ok && r.borradas === 12, json(r));
      igual(await medida(), antes, 'tras la ronda ' + n);
    }
    igual(Object.keys(M.files).filter(k => M.files[k].name && M.files[k].name.startsWith('c6-')), [], 'M.files');
    igual((await M.informeArchivos()).huerfanos, [], 'huérfanos');
  });

  prueba('C7', 'Una foto que sale de una publicación vuelve a su carpeta si sigue; si no, a la raíz. Se ve con ✓ dentro de la carpeta, «Sin usar» la esconde y sigue el aviso de D-022 (D-069)', async () => {
    await tablero([pub(1)]);
    const c = M.crearCarpeta('Vuelta').id;
    const [a] = await aCarpeta(c, [await foto('c7-a.jpg')]);
    M._test.place('r1', a);
    ok(!M.board().tray.includes(a), 'sigue en board().tray estando usada');
    igual(enCarpeta(c, false), [], '«Sin usar»');
    igual(M._in.bandejaVista({ carpeta: c, todas: true }).map(x => [x.f, !!x.u]), [[a, true]], '«Todas», con ✓');
    igual(raiz(true), [], 'una foto usada de una carpeta no sale en la raíz');
    await M.flush();
    M._in.S.slots[0].photos = []; M._in.S.tray.unshift(a); M._in.changed();
    igual(enCarpeta(c, false), [a], 'no volvió a su carpeta');
    M._test.place('r1', a); await M.flush();
    const r = await M.borrarCarpeta(c);
    ok(r && r.ok && r.borradas === 0, json(r));
    ok(await M._test.fileRec(a), 'se borró la foto usada');
    igual(raiz(true), [a], 'sin carpeta sale en la raíz, con ✓');
    M._in.S.slots[0].photos = []; M._in.S.tray.unshift(a); M._in.changed();
    igual(raiz(false), [a], 'vuelve a la raíz');
  });

  prueba('C8', '«⇅ Exportar» no lleva las carpetas ni sus fotos, salvo las usadas, y avisa de cuántas no viajan; importar no las toca (D-073)', async () => {
    const clave = `${CLIENTE}-${MES}`;
    await tablero([pub(1), pub(2)]);
    const c = M.crearCarpeta('Fuera').id;
    const [l, u, h] = await aCarpeta(c, [await foto('c8-1.jpg'), await foto('c8-2.jpg'), await foto('c8-3.jpg')]);
    const [g] = await aCarpeta('historias', [await foto('c8-4.jpg')]);
    const [r0] = await M.addFiles([await foto('c8-5.jpg')]);
    M._test.place('r1', u);
    const hid = M.hs.anadir(`${MES}-20`); M._in.S.historias.find(x => x.id === hid).photos = [h]; M._in.save();
    await M.flush();
    const res = await M.exportAll({ returnBlob: true });
    const d = JSON.parse(await res.text());
    igual(d.bandejas.find(x => x.client === CLIENTE).tray, [r0], 'la bandeja del archivo: solo la raíz');
    ok(!('carpetas' in d.bandejas[0]) && d.boards.every(b => !('carpetas' in b)), 'el archivo lleva carpetas');
    ok(!d.files[l] && !d.files[g], 'el archivo lleva fotos sin usar de las carpetas');
    ok(d.files[u] && d.files[h] && d.files[r0], 'al archivo le faltan las usadas o la raíz');
    const exp = await M.exportAll();
    igual(exp.carpetasFuera, 2, 'las carpetas que no viajan');
    await hasta(() => /2 carpetas de la bandeja no viajan/.test(M._in.root().textContent), 4000, 'el aviso de las carpetas');
    M._in.closeDetail();
    // en otra mesa
    await sinMes(clave);
    const r = await M.importData(d, { confirm: false });
    ok(r && !r.error, 'importar falló: ' + json(r));
    await M.open(clave);
    igual(M.carpetas().map(x => [x.id, x.fotos]), [['historias', 0]], 'en la otra mesa');
    ok(slot('r1').photos.includes(u) && (await M._test.fileRec(u)), 'la foto usada no viajó');
    igual(raiz(false).includes(r0), true, 'la raíz no viajó');
    // sobre esta misma mesa, importar no quita carpetas
    const c2 = M.crearCarpeta('Aquí').id; await aCarpeta(c2, [await foto('c8-6.jpg')]); await M.flush();
    const r2 = await M.importData(d, { confirm: false });
    ok(r2 && !r2.error, 'importar sobre la mesa falló');
    await M.open(clave);
    igual(carp(c2).files.length, 1, 'importar quitó una carpeta');
  });

  prueba('C9', 'El informe de huérfanos solo lee: los lista sin borrarlos y nunca cuenta kit-, perfil-, past:, logos ni fotos de historias (D-073)', async () => {
    await tablero([pub(1)]);
    const [ph] = await M.addFiles([await foto('c9-h.jpg')]);
    const hid = M.hs.anadir(`${MES}-20`); M._in.S.historias.find(x => x.id === hid).photos = [ph]; M._in.S.tray = M._in.S.tray.filter(f => f !== ph); M._in.save();
    await M.flush();
    const blob = await (await foto('c9-o.jpg')).arrayBuffer(), b = new W.Blob([blob], { type: 'image/jpeg' });
    const claves = ['c9-huerfano', 'kit-c9-logo', 'perfil-c9', 'past:c9'];
    for (const k of claves) await M._in.idbPut('files', k, { name: k + '.jpg', size: b.size, type: 'image/jpeg', w: 10, h: 10, blob: b, thumb: b });
    const antes = await medida(), r = await M.informeArchivos();
    igual(r.huerfanos.map(x => x.id), ['c9-huerfano'], 'los huérfanos');
    igual(r.bytesHuerfanos, b.size * 2, 'sus bytes');
    igual(await medida(), antes, 'el informe cambió algo');
    for (const k of claves) ok(await M._in.idbGet('files', k), 'el informe borró ' + k);
    for (const k of claves) await M._in.idbDel('files', k);
  });

  prueba('C10', 'Quitar una foto suelta no deja restos: apuntada desde el principio, «Deshacer» la saca de la lista y una recarga la borra; lo que entra a medias tampoco queda (D-071)', async () => {
    const clave = `${CLIENTE}-${MES}`;
    await tablero([pub(1)]);
    const [a, b] = await M.addFiles([await foto('c10-a.jpg'), await foto('c10-b.jpg')]);
    await M.flush(); await M.open(clave);      // la lista de lo que entra se vacía al abrir
    igual(M._in.delList().filter(f => f === a || f === b), [], 'la lista al abrir');
    M._test.removeFile(a);
    ok(M._in.delList().includes(a), 'no se apuntó');
    const des = await hasta(() => qa('.toast button, .toasts button').find(x => /Deshacer/.test(x.textContent)), 2000, 'el botón Deshacer');
    des.click();
    ok(M.board().tray.includes(a) && !M._in.delList().includes(a), '«Deshacer» no la devolvió o sigue apuntada');
    M._test.removeFile(b);
    await M.flush(); await M.open(clave);      // como una recarga dentro de los 6 s
    await hasta(async () => !(await M._test.fileRec(b)), 6000, 'que se borre al abrir');
    ok(await M._test.fileRec(a), 'se borró la que volvió');
    // un archivo escrito que no llegó a la bandeja: una recarga a media subida
    const blob = await foto('c10-c.jpg');
    await M._in.idbPut('files', 'c10-suelto', { name: 'c10-c.jpg', size: blob.size, type: blob.type, w: 10, h: 10, blob, thumb: blob });
    M._in.delList(l => [...l, 'c10-suelto']);
    await M.open(clave);
    await hasta(async () => !(await M._in.idbGet('files', 'c10-suelto')), 6000, 'que se borre lo que quedó a medias');
    // pero no lo que solo tiene la copia que deja una recarga, de otro mes
    const [p1] = await M.addFiles([await foto('c10-p.jpg')]);
    await M.flush();
    M._in.S.tray = M._in.S.tray.filter(f => f !== p1); M._in.delList(l => [...l, p1]);
    W.localStorage.setItem('mesa-pending', json({ key: `${CLIENTE}-2026-12`, v: 5, board: { key: `${CLIENTE}-2026-12`, client: CLIENTE, slots: [], tray: [p1], savedAt: new Date().toISOString() } }));
    await M.flush(); await M.open(clave);
    await espera(300);
    ok(await M._test.fileRec(p1), 'se borró una foto que tenía la copia de una recarga');
    W.localStorage.removeItem('mesa-pending');
    await M._in.deleteIfUnused(p1);
    ok(!(await M._test.fileRec(p1)), 'sin la copia de la recarga, la foto se queda');
  });

  prueba('C11', 'La bandeja solo se va con el cliente, carpetas incluidas: el botón dice cuánto y no toca fotos fijas ni de otros (D-072)', async () => {
    const clave = `${CLIENTE}-${MES}`;
    await tablero([pub(1)]);
    const c = M.crearCarpeta('Se va').id;
    const [a] = await aCarpeta(c, [await foto('c11-a.jpg')]);
    const [g] = await aCarpeta('historias', [await foto('c11-g.jpg')]);
    const [t] = await M.addFiles([await foto('c11-t.jpg')]);
    M._test.place('r1', a);               // solo la usa ese mes y está en una carpeta: se queda
    await M.flush();
    await M.purge(clave);
    const rec = await M._in.idbGet('bandejas', CLIENTE);
    ok(rec && rec.tray.includes(t) && rec.carpetas.some(x => x.id === c), 'el último mes se llevó la bandeja');
    for (const f of [a, g, t]) ok(await M._test.fileRec(f), 'el último mes se llevó una foto de la bandeja');
    await M.init({ client: CLIENTE, month: MES, slots: [pub(1)], past: [], force: true });
    ok(M.board().tray.includes(a) && enCarpeta(c, false).includes(a), 'la foto cuyo mes se borró no volvió a estar libre en su carpeta');
    igual(M.carpetas().length, 2, 'las carpetas al volver a crear el mes');
    await M.flush();
    await M.purge(clave);
    const r = await M.removeClient(CLIENTE);
    ok(r === true, 'no se pudo borrar el cliente: ' + r);
    ok(!(await M._in.idbGet('bandejas', CLIENTE)), 'quedó su bandeja');
    for (const f of [a, g, t]) ok(!(await M._test.fileRec(f)), 'quedó una foto del cliente');
  });

  prueba('C12', 'Con el editor abierto, una foto puesta en una diapositiva sin aplicar se queda al borrar su carpeta (D-070)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    const c = M.crearCarpeta('En uso').id;
    const [a, b] = await aCarpeta(c, [await foto('c12-a.jpg'), await foto('c12-b.jpg')]);
    await abrirEditor('r1');
    const E = ed();
    igual(typeof M.libre.fotosSesion, 'function', 'sin fotosSesion');
    E.hist.undo.push(json({ sl: [{ key: a }], i: 0, fmt: E.fmt }));
    const p = await M.planBorrarCarpeta(c);
    igual([p.nBorran, p.quedan.editor], [1, 1], 'el plan con el editor abierto');
    const r = await M.borrarCarpeta(c);
    ok(r && r.ok && r.borradas === 1, json(r));
    ok(await M._test.fileRec(a), 'se borró la foto del editor');
    ok(!(await M._test.fileRec(b)), 'no se borró la otra');
    E.hist.undo.pop();
    M.libre.cerrar();
  });

  prueba('C13', 'Las miniaturas no crean URL hasta que se piden y se leen por tandas; la imagen de una foto de carpeta se abre igual (D-069)', async () => {
    const clave = `${CLIENTE}-${MES}`;
    await tablero([pub(1)]);
    const c = M.crearCarpeta('Muchas').id;
    await aCarpeta(c, await Promise.all(Array.from({ length: 5 }, (_, i) => foto(`c13-${i}.jpg`, 400, 500))));
    await M.flush();
    Object.keys(M.files).forEach(k => { delete M.files[k]; });
    let urls = 0; const orig = W.URL.createObjectURL; W.URL.createObjectURL = o => { urls++; return orig.call(W.URL, o); };
    try {
      await M.open(clave);
      const f = carp(c).files[0];
      ok(M.files[f] && M.files[f].name.startsWith('c13-'), 'no se cargó su ficha');
      const antes = urls;
      igual(typeof M.files[f].w, 'number', 'sus medidas');
      igual(urls, antes, 'leer la ficha creó una URL');
      ok(String(M.files[f].thumbUrl).startsWith('blob:'), 'sin URL al pedirla');
      igual(urls, antes + 1, 'pedirla no creó una URL');
    } finally { W.URL.createObjectURL = orig; }
  });

  // ---------- subir y crear carpetas (D-074, D-075) ----------
  const ui = () => { ok(M.carpetasUI, 'carpetas.js no se cargó'); return M.carpetasUI; };
  const iguales = async (a, b) => { const x = new Uint8Array(await a.arrayBuffer()), y = new Uint8Array(await b.arrayBuffer()); return x.length === y.length && x.every((v, i) => v === y[i]); };
  const porNombre = () => Object.fromEntries(M.board().carpetas.map(c => [c.name, c]));
  const nombres = c => c.files.map(f => M.files[f].name);

  prueba('C14', 'Subir una carpeta: conserva nombre y subcarpetas, los bytes son los del disco y salta lo que no entra (D-074)', async () => {
    await tablero([pub(1)]);
    const a = await foto('c14-b.jpg', 900, 700), b = await foto('c14-a.jpg', 700, 900), c = await foto('c14-c.jpg', 500, 600), d = await foto('c14-d.jpg', 500, 600);
    const r = await ui().subir([
      { path: ['Sesión'], file: a }, { path: ['Sesión'], file: b }, { path: ['Sesión', 'Terraza'], file: c }, { path: ['Sesión', 'Terraza', 'Noche'], file: d },
      { path: ['Sesión'], file: new W.File(['x'], '.DS_Store') }, { path: ['Sesión'], file: new W.File(['x'], '._c14-a.jpg', { type: 'image/jpeg' }) },
      { path: ['Sesión'], file: new W.File(['xx'], 'clip.MOV', { type: 'video/quicktime' }) }, { path: ['Sesión', 'Solo vídeo'], file: new W.File(['xx'], 'otro.mov', { type: 'video/quicktime' }) },
      { path: ['Sesión'], file: new W.File([], 'vacia.jpg', { type: 'image/jpeg' }) }, { path: ['Sesión'], file: new W.File(['xx'], 'foto.heic', { type: 'image/heic' }) },
    ], null, { sinAviso: true });
    igual([r.total, r.subidas, r.yaEstaban, r.parada], [4, 4, 0, null], 'el resultado');
    ok(/6 archivos saltados/.test(r.saltados) && /\.MOV/.test(r.saltados) && /del sistema/.test(r.saltados) && /\.HEIC/.test(r.saltados), 'lo saltado: ' + r.saltados);
    const n = porNombre();
    igual(Object.keys(n).sort(), ['Historias', 'Noche', 'Sesión', 'Terraza'], 'las carpetas (sin la de solo vídeo)');
    igual([n['Terraza'].parent, n['Noche'].parent, n['Sesión'].parent], [n['Sesión'].id, n['Terraza'].id, null], 'el árbol');
    igual(nombres(n['Sesión']), ['c14-a.jpg', 'c14-b.jpg'], 'en orden de nombre');
    igual(nombres(n['Noche']), ['c14-d.jpg'], 'la subcarpeta honda');
    ok(await iguales(await M._in.getBlob(n['Sesión'].files[1]), a), 'los bytes no son los del disco');
    const rec = await M._test.fileRec(n['Sesión'].files[1]);
    igual([rec.w, rec.h, rec.type, rec.reduced], [900, 700, 'image/jpeg', false], 'la ficha');
    await M.flush();
    const g = await M._in.idbGet('bandejas', CLIENTE);
    igual(g.carpetas.find(x => x.name === 'Noche').files, n['Noche'].files, 'guardado');
    ok(M.board().tray.includes(n['Noche'].files[0]), 'board().tray no lleva las fotos subidas');
    igual((await M.informeArchivos()).huerfanos, [], 'huérfanos');
  });

  prueba('C15', 'Una foto ya presente no escribe bytes: raíz, usada o en otra carpeta; volver a subir retoma sin repetir; otro cliente tiene la suya (D-074, D-069, D-041)', async () => {
    await tablero([pub(1)]);
    const f1 = await foto('c15-1.jpg'), f2 = await foto('c15-2.jpg'), f3 = await foto('c15-3.jpg');
    const [en1] = await M.addFiles([f1]);
    const [en2] = await poner('r1', [f2]);
    const antes = await medida();
    const r = await ui().subir([{ path: ['Dup'], file: f1 }, { path: ['Dup'], file: f2 }, { path: ['Dup'], file: f3 }], null, { sinAviso: true });
    igual([r.subidas, r.yaEstaban], [1, 2], 'el resultado');
    const c = porNombre()['Dup'];
    igual(c.files.slice(0, 2), [en1, en2], 'es el mismo archivo');
    igual((await medida()).claves, antes.claves + 1, 'solo la nueva escribe');
    igual(raiz(false), [], 'la de la raíz pasa a la carpeta');
    igual(M._in.bandejaVista({ carpeta: c.id, todas: true }).filter(x => x.u).map(x => x.f), [en2], 'la usada sale con ✓');
    const med = await medida();
    const r2 = await ui().subir([{ path: ['Dup'], file: f1 }, { path: ['Dup'], file: f2 }, { path: ['Dup'], file: f3 }], null, { sinAviso: true });
    igual([r2.subidas, r2.yaEstaban, r2.carpetas], [0, 3, 0], 'volver a subir');
    igual(await medida(), med, 'volver a subir escribió');
    igual(porNombre()['Dup'].files.length, 3, 'se repitieron en la carpeta');
    await M.flush();
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [pub(1)], past: [], force: true });
    const r3 = await ui().subir([{ path: ['Dup'], file: f1 }], null, { sinAviso: true });
    igual([r3.subidas, r3.yaEstaban], [1, 0], 'otro cliente');
    ok(porNombre()['Dup'].files[0] !== en1, 'otro cliente comparte el archivo');
  });

  prueba('C16', 'El aviso antes de subir dice fotos, GB, espacio, lo que ya está y lo que se salta; «Cancelar» no hace nada y «Subir» sube (D-074)', async () => {
    await tablero([pub(1)]);
    const f1 = await foto('c16-1.jpg');
    await M.addFiles([f1]);
    const antes = await medida();
    const lista = [{ path: ['Aviso'], file: f1 }, { path: ['Aviso', 'Sub'], file: await foto('c16-2.jpg') }, { path: ['Aviso'], file: new W.File(['xx'], 'a.CR3') }];
    await ui().subir(lista, null);
    const t = dialogo().textContent;
    for (const x of ['Subir «Aviso»', '2 fotos', 'en 2 carpetas', 'a la bandeja', 'Una ya está', 'libres para la Mesa', '1 archivo saltado', '.CR3']) ok(t.includes(x), `el aviso no dice «${x}»: ${t}`);
    ok(!q('.detail [data-act="cp-ir"]').disabled, 'sin botón Subir');
    await pulsar('.detail .btn2[data-act="close"]');
    igual(await medida(), antes, 'cancelar escribió');
    igual(M.carpetas().map(c => c.name), ['Historias'], 'cancelar creó carpetas');
    await ui().subir(lista, null);
    await pulsar('[data-act="cp-ir"]');
    await hasta(() => porNombre()['Sub'] && porNombre()['Sub'].files.length && !M.subiendo(), 6000, 'que suba');
    igual((await medida()).claves, antes.claves + 1, 'tras subir');
    // lo que no cabe: lo dice y se puede intentar
    const m0 = M.cfg.margenSubida; M.cfg.margenSubida = 1e15;
    try {
      await ui().subir([{ path: ['Grande'], file: await foto('c16-3.jpg') }], null);
      ok(dialogo().textContent.includes('No cabe todo'), 'no avisa de que no cabe');
      await pulsar('.detail .btn2[data-act="close"]');
    } finally { M.cfg.margenSubida = m0; }
  });

  prueba('C17', 'Sin espacio la subida se para, lo dice y deja lo subido en su carpeta, sin restos ni carpetas vacías; también al dejar el margen; «Cancelar» igual (D-074)', async () => {
    await tablero([pub(1)]);
    const base = await medida();
    const fs = await Promise.all([0, 1, 2, 3, 4].map(i => foto(`c17-${i}.jpg`, 400, 500)));
    const proto = W.IDBObjectStore.prototype, put0 = proto.put; let n = 0;
    proto.put = function (v, k) { if (this.name === 'files' && v && String(v.name).startsWith('c17-') && ++n === 3) throw new W.DOMException('sin sitio', 'QuotaExceededError'); return put0.call(this, v, k); };
    let r; try { r = await ui().subir(fs.map(file => ({ path: ['Llena', 'Honda'], file })).concat([{ path: ['Otra'], file: await foto('c17-z.jpg', 400, 500) }]), null, { sinAviso: true }); }
    finally { proto.put = put0; }
    igual([r.parada, r.subidas], ['espacio', 2], 'el resultado');
    const c = porNombre();
    igual(c['Honda'].files.length, 2, 'lo subido sigue en su carpeta');
    ok(c['Llena'], 'perdió la carpeta padre');
    ok(!c['Otra'], 'dejó una carpeta vacía');
    ok(dialogo() && dialogo().textContent.includes('Subida parada') && dialogo().textContent.includes('No queda espacio'), 'no avisa');
    M._in.closeDetail();
    igual(M.board().tray.length, 2, 'la bandeja coherente');
    igual((await medida()).claves, base.claves + 2, 'el store coherente');
    igual((await M.informeArchivos()).huerfanos, [], 'huérfanos');
    igual(Object.keys(M.files).filter(k => M.files[k].name === 'c17-2.jpg'), [], 'queda en memoria la que falló');
    // seguir: lo que ya está no se repite
    const r2 = await ui().subir(fs.map(file => ({ path: ['Llena', 'Honda'], file })), null, { sinAviso: true });
    igual([r2.parada, r2.subidas, r2.yaEstaban], [null, 3, 2], 'al seguir');
    igual(porNombre()['Honda'].files.length, 5, 'tras seguir');
    // el margen, antes de escribir nada
    const m0 = M.cfg.margenSubida; M.cfg.margenSubida = 1e15;
    try {
      const r3 = await ui().subir([{ path: ['Margen'], file: await foto('c17-m.jpg', 400, 500) }], null, { sinAviso: true });
      igual([r3.parada, r3.subidas], ['espacio', 0], 'el margen');
      ok(!porNombre()['Margen'], 'el margen dejó una carpeta vacía');
      M._in.closeDetail();
    } finally { M.cfg.margenSubida = m0; }
    // cancelar a medias
    const lista = await Promise.all(Array.from({ length: 30 }, (_, i) => foto(`c17-k${i}.jpg`, 300, 400)));
    const pr = ui().subir(lista.map(file => ({ path: ['Corta'], file })), null, { sinAviso: true });
    await hasta(() => q('[data-act="cp-cancelar"]') && porNombre()['Corta'] && porNombre()['Corta'].files.length, 8000, 'que empiece');
    q('[data-act="cp-cancelar"]').click();
    const r4 = await pr;
    igual(r4.parada, 'cancelada', 'cancelar');
    ok(r4.subidas < 30 && porNombre()['Corta'].files.length === r4.subidas, 'lo subido al cancelar');
    ok(!q('.cpprog'), 'la barra sigue');
    igual((await M.informeArchivos()).huerfanos, [], 'huérfanos al cancelar');
  });

  prueba('C18', 'Una subida sigue al cambiar de mes y de cliente, sin perder nada ni pisar la bandeja; bloquea importar y borrar carpeta (D-074)', async () => {
    await tablero([pub(1)]);
    const lista = await Promise.all(Array.from({ length: 24 }, (_, i) => foto(`c18-${i}.jpg`, 300, 400)));
    const pr = ui().subir(lista.map(file => ({ path: ['Viaja'], file })), null, { sinAviso: true });
    await hasta(() => porNombre()['Viaja'] && porNombre()['Viaja'].files.length >= 3, 8000, 'que empiece');
    ok(M.subiendo(), 'no dice que sube');
    const b = await M.borrarCarpeta(porNombre()['Viaja'].id);
    ok(b && b.error, 'se pudo borrar una carpeta durante la subida');
    const im = await M.importData(await M.exportAll({ returnBlob: true }), { confirm: false });
    ok(im && im.error, 'se pudo importar durante la subida');
    M._in.clearToasts();
    await M.init({ client: CLIENTE, month: '2026-12', slots: [pub(9, 'Foto', 9, '2026-12')], past: [], force: true });
    ok(porNombre()['Viaja'], 'el otro mes no tiene la carpeta');
    await hasta(() => porNombre()['Viaja'].files.length >= 8, 8000, 'que siga en el otro mes');
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [pub(1)], past: [], force: true });
    igual(M.carpetas().map(c => c.name), ['Historias'], 'la carpeta sale en otro cliente');
    const r = await pr;
    igual([r.subidas, r.parada], [24, null], 'el resultado');
    igual(M.carpetas().map(c => c.name), ['Historias'], 'al terminar, en otro cliente');
    const g = await M._in.idbGet('bandejas', CLIENTE);
    igual(g.carpetas.find(c => c.name === 'Viaja').files.length, 24, 'lo guardado del cliente');
    igual(new Set(g.tray).size, 24, 'su bandeja');
    await M.flush();
    await M.open(`${CLIENTE}-${MES}`);
    igual(porNombre()['Viaja'].files.length, 24, 'al volver');
    igual((await M.informeArchivos()).huerfanos, [], 'huérfanos');
  });

  prueba('C19', 'Lo arrastrado se lee por tandas, con subcarpetas, sin carpetas del sistema; las fotos sueltas van a lo abierto: pocas sin aviso, muchas con él (D-074)', async () => {
    await tablero([pub(1)]);
    const fich = file => ({ isFile: true, isDirectory: false, name: file.name, file: (ok2) => ok2(file) });
    const dir = (name, hijos) => ({ isFile: false, isDirectory: true, name, createReader: () => { const t = hijos.slice(); return { readEntries: ok2 => setTimeout(() => ok2(t.splice(0, 2))) }; } });
    const fs = await Promise.all([0, 1, 2, 3, 4].map(i => foto(`c19-${i}.jpg`, 300, 400)));
    const arbol = dir('Rodaje', [fich(fs[0]), fich(fs[1]), fich(fs[2]), dir('Parte', [fich(fs[3])]), dir('Vacía', []), dir('.Spotlight-V100', [fich(fs[4])]), fich(new W.File(['x'], '.DS_Store'))]);
    const r = await ui().desdeEntradas([arbol], null, { sinAviso: true });
    igual([r.subidas, r.parada], [4, null], 'por tandas');
    const c = porNombre();
    igual(Object.keys(c).sort(), ['Historias', 'Parte', 'Rodaje'], 'las carpetas');
    igual(c['Rodaje'].files.length, 3, 'las de arriba');
    igual(c['Parte'].parent, c['Rodaje'].id, 'la subcarpeta');
    // soltar: una carpeta sube; fotos sueltas, a la abierta
    M._in.trayAbrir(c['Parte'].id);
    await ui().elegidas([await foto('c19-s.jpg', 300, 400)], M._in.trayCarpeta);
    igual(nombres(porNombre()['Parte']).includes('c19-s.jpg'), true, 'una suelta, a la abierta');
    const muchas = await Promise.all(Array.from({ length: 20 }, (_, i) => foto(`c19-m${i}.jpg`, 200, 300)));
    await ui().elegidas(muchas, M._in.trayCarpeta);
    ok(dialogo() && dialogo().textContent.includes('Subir 20 fotos') && dialogo().textContent.includes('«Parte»'), 'veinte sueltas no avisan');
    await pulsar('.detail .btn2[data-act="close"]');
    M._in.trayAbrir(null);
  });

  prueba('C20', 'Entrar y volver: la carpeta sale delante de las fotos, «+ Carpeta» crea dentro de lo abierto, la × quita de la abierta, el filtro funciona dentro; el editor navega igual y las vistas largas cargan lo visible (D-075)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await M.addFiles([await foto('c20-r.jpg', 300, 400)]);
    const r = await ui().subir([{ path: ['Abre'], file: await foto('c20-a.jpg', 300, 400) }, { path: ['Abre', 'Dentro'], file: await foto('c20-b.jpg', 300, 400) }], null, { sinAviso: true });
    ok(r && !r.parada, json(r));
    const tiles = () => qa('.tgrid .tcarpeta .cn').map(x => x.textContent), fotos = () => qa('.tgrid .titem').map(x => M.files[x.dataset.file].name);
    const n = porNombre();
    igual(tiles(), ['Historias', 'Abre'], 'las carpetas de la raíz');
    igual(fotos(), ['c20-r.jpg'], 'las fotos de la raíz');
    ok(q('.tgrid').firstElementChild.classList.contains('tcarpeta'), 'las carpetas no van delante');
    await pulsar(`.tcarpeta[data-id="${n['Abre'].id}"]`);
    igual([tiles(), fotos()], [['Dentro'], ['c20-a.jpg']], 'dentro');
    ok(q('.cpruta').textContent.includes('Abre') && q('.cpvolver'), 'sin ruta ni volver');
    // + Carpeta, dentro de lo abierto
    await pulsar('[data-act="cp-nueva"]');
    const input = await hasta(() => q('#cp-nombre'), 2000, 'el nombre');
    input.value = 'Nueva';
    q('form[data-form="cp-nueva"]').requestSubmit();
    await hasta(() => porNombre()['Nueva'], 2000, 'que se cree');
    igual(porNombre()['Nueva'].parent, n['Abre'].id, 'dentro de la abierta');
    igual(tiles().sort(), ['Dentro', 'Nueva'], 'sale');
    // el filtro dentro
    M._test.place('r1', n['Abre'].files[0]);
    igual(fotos(), [], '«Sin usar» dentro');
    M._in.trayFiltro('todas');
    igual(fotos(), ['c20-a.jpg'], '«Todas» dentro');
    igual(qa('.tgrid .titem.uso').length, 1, 'con ✓');
    M._in.trayFiltro('sin');
    // el editor ve lo mismo
    await abrirEditor('r1');
    if (!ed().trOpen) accion('bandeja');
    await hasta(() => ed().el.querySelector('.lb-tcarp'), 2000, 'las carpetas en el editor');
    igual([...ed().el.querySelectorAll('.lb-tcarp span')].map(x => x.textContent).sort(), ['Dentro', 'Nueva'], 'las carpetas en el editor');
    accion('tr-carp', { id: '' });
    await hasta(() => [...ed().el.querySelectorAll('.lb-tcarp span')].some(x => x.textContent === 'Abre'), 2000, 'volver en el editor');
    igual(M._in.trayCarpeta, null, 'la misma bandeja');
    M.libre.cerrar();
    igual(tiles(), ['Historias', 'Abre'], 'la mesa sigue al editor');
    // la × quita de la abierta
    const [h] = await aCarpeta('historias', [await foto('c20-h.jpg', 300, 400)]);
    await aCarpeta(n['Dentro'].id, [await foto('c20-h.jpg', 300, 400)]);
    M._in.trayAbrir(n['Dentro'].id);
    const x = q(`.titem[data-file="${h}"] .x`);
    ok(x, 'sin ×'); x.click();
    igual(carp(n['Dentro'].id).files.includes(h), false, 'la × no la quitó de la abierta');
    igual(hist().files.includes(h), true, 'la × la quitó de la otra');
    // una vista larga: sin URL hasta llegar a la pantalla
    const lista = await Promise.all(Array.from({ length: 90 }, (_, i) => foto(`c20-l${i}.jpg`, 120, 160)));
    await ui().subir(lista.map(file => ({ path: ['Larga'], file })), null, { sinAviso: true });
    M._in.trayAbrir(porNombre()['Larga'].id);
    igual(qa('.tgrid .titem').length, 90, 'las fotos de la vista');
    await hasta(() => qa('.tgrid .titem img[src]').length > 0, 4000, 'las primeras miniaturas');
    ok(qa('.tgrid .titem img[src]').length < 90 || D.documentElement.clientHeight > 3000, 'cargó todas: ' + qa('.tgrid .titem img[src]').length);
    M._in.trayAbrir(null);
    // cambiar de cliente vuelve a la raíz
    M._in.trayAbrir(n['Abre'].id);
    await M.flush();
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [pub(1)], past: [], force: true });
    igual(M._in.trayCarpeta, null, 'otro cliente empieza en la raíz');
  });

  // ---------- pestañas y menú (D-076) ----------
  const tabsTxt = () => M._in.pestLista().map(p => (p.activa ? '*' : '') + p.nombre);
  const clicDerecho = el => { const r = el.getBoundingClientRect(); el.dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.x + 5, clientY: r.y + 5 })); return q('.cpmenu'); };
  const itemMenu = t => [...q('.cpmenu').querySelectorAll('button')].find(b => b.textContent.startsWith(t));
  const arbolTabs = async () => {
    await tablero([pub(1)]);
    const r = await ui().subir([{ path: ['Uno'], file: await foto('c21-a.jpg', 300, 400) }, { path: ['Uno', 'Hija'], file: await foto('c21-b.jpg', 300, 400) }, { path: ['Dos'], file: await foto('c21-c.jpg', 300, 400) }], null, { sinAviso: true });
    ok(r && !r.parada, json(r));
    return porNombre();
  };

  prueba('C21', 'Pestañas: una fija y las abiertas, cada una con su carpeta; entrar va en la pestaña en uso y cerrar nunca borra (D-076)', async () => {
    const n = await arbolTabs();
    igual(tabsTxt(), ['*Bandeja'], 'de entrada');
    ok(!q('.cptab.fija .cpx'), 'la fija se puede cerrar');
    await pulsar(`.tcarpeta[data-id="${n['Uno'].id}"]`);
    igual([tabsTxt(), M._in.trayCarpeta], [['*Bandeja'], n['Uno'].id], 'entrar va en la fija');
    M._in.pestNueva(n['Dos'].id);
    igual(tabsTxt(), ['Bandeja', '*Dos'], 'una nueva');
    igual(qa('.tgrid .titem').map(x => M.files[x.dataset.file].name), ['c21-c.jpg'], 'lo de la pestaña nueva');
    const dup = M._in.pestLista().length; M._in.pestNueva(n['Dos'].id);
    igual(M._in.pestLista().length, dup, 'la misma carpeta abre otra pestaña');
    await pulsar('.cptab.fija [data-act="cp-pest"]');
    igual(M._in.trayCarpeta, n['Uno'].id, 'la fija conserva dónde estaba');
    await pulsar(`.tcarpeta[data-id="${n['Hija'].id}"]`);
    igual(tabsTxt(), ['*Bandeja', 'Dos'], 'entrar en la fija no toca la otra');
    await pulsar('.cpvolver');
    igual(M._in.trayCarpeta, n['Uno'].id, 'volver');
    M._in.pestIr(M._in.pestLista()[1].id);
    M._in.trayAbrir(null);
    igual(tabsTxt(), ['Bandeja', '*Bandeja'], 'una abierta que vuelve a la raíz');
    M._in.trayAbrir(n['Dos'].id);
    const antes = await medida(), bd = (await M._in.idbGet('bandejas', CLIENTE));
    await pulsar('.cptab:not(.fija) .cpx');
    igual(tabsTxt(), ['*Bandeja'], 'cerrar pasa a la de la izquierda');
    igual(await medida(), antes, 'cerrar borró algo');
    await M.flush();
    igual((await M._in.idbGet('bandejas', CLIENTE)).carpetas.map(c => c.files.length), bd.carpetas.map(c => c.files.length), 'cerrar cambió las carpetas');
  });

  prueba('C22', 'Las pestañas se recuerdan por cliente, también entre meses y al recargar; la de una carpeta que ya no está se cierra (D-076)', async () => {
    const clave = `${CLIENTE}-${MES}`, n = await arbolTabs();
    M._in.trayAbrir(n['Uno'].id); M._in.pestNueva(n['Dos'].id); M._in.pestNueva(n['Hija'].id);
    igual(tabsTxt(), ['Bandeja', 'Dos', '*Hija'], 'las abiertas');
    await M.flush();
    await M.init({ client: CLIENTE, month: '2026-12', slots: [pub(9, 'Foto', 9, '2026-12')], past: [], force: true });
    igual(tabsTxt(), ['Bandeja', 'Dos', '*Hija'], 'en otro mes');
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [pub(1)], past: [], force: true });
    igual([tabsTxt(), M._in.trayCarpeta], [['*Bandeja'], null], 'otro cliente tiene las suyas');
    await M.open(clave);
    igual(tabsTxt(), ['Bandeja', 'Dos', '*Hija'], 'al volver al cliente');
    igual(M._in.pestLista()[0].carpeta, n['Uno'].id, 'la fija, donde estaba');
    // una carpeta que ya no está
    const k = 'mesa-pestanas:' + CLIENTE, d = JSON.parse(W.localStorage.getItem(k));
    d.tabs.push({ id: 'xx', carpeta: 'nada' }); d.tabs[0].carpeta = 'nada'; d.act = 'xx';
    W.localStorage.setItem(k, json(d));
    await M.open(clave);
    igual(tabsTxt(), ['*Bandeja', 'Dos', 'Hija'], 'sin la carpeta');
    igual(M._in.trayCarpeta, null, 'la fija en la raíz');
    W.localStorage.setItem(k, 'esto no es json');
    await M.open(clave);
    igual(tabsTxt(), ['*Bandeja'], 'con lo guardado roto');
  });

  prueba('C23', 'Clic derecho en una carpeta: sus cinco opciones, «Abrir» y «Abrir en una pestaña nueva» funcionan, Esc y un clic fuera lo cierran y «Historias» no se borra (D-076)', async () => {
    const n = await arbolTabs();
    const tile = id => q(`.tcarpeta[data-id="${id}"]`);
    let m = clicDerecho(tile(n['Uno'].id));
    ok(m, 'no sale el menú');
    igual([...m.querySelectorAll('button')].map(b => b.childNodes[0].textContent), ['Abrir', 'Abrir en una pestaña nueva', 'Copiar', 'Pegar', 'Borrar carpeta…'], 'las opciones');
    itemMenu('Abrir en').click();
    ok(!q('.cpmenu'), 'el menú sigue');
    igual(tabsTxt(), ['Bandeja', '*Uno'], 'en una pestaña nueva');
    await pulsar('.cptab.fija [data-act="cp-pest"]');
    clicDerecho(tile(n['Dos'].id));
    itemMenu('Abrir').click();
    igual([tabsTxt(), M._in.trayCarpeta], [['*Bandeja', 'Uno'], n['Dos'].id], '«Abrir» va en la pestaña en uso');
    await pulsar('.cpvolver');
    clicDerecho(tile(n['Dos'].id));
    D.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    ok(!q('.cpmenu'), 'Esc no lo cierra');
    clicDerecho(tile(n['Dos'].id));
    D.body.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true }));
    ok(!q('.cpmenu'), 'un clic fuera no lo cierra');
    clicDerecho(tile('historias'));
    ok(itemMenu('Borrar').disabled, 'en «Historias» se puede borrar');
    ui().cerrarMenu();
    // sin menú en las fotos: sigue el del navegador
    const foto1 = q('.tgrid .titem');
    if (foto1) { clicDerecho(foto1); ok(!q('.cpmenu'), 'una foto saca el menú de carpeta'); }
  });

  prueba('C24', '«Borrar carpeta…» avisa y cierra las pestañas de ella y de sus subcarpetas; la fija pasa a la carpeta que la contenía (D-076, D-070)', async () => {
    const n = await arbolTabs();
    M._in.pestNueva(n['Uno'].id); M._in.pestNueva(n['Hija'].id); M._in.pestNueva(n['Dos'].id);
    M._in.pestIr('fija'); M._in.trayAbrir(n['Uno'].id); M._in.trayAbrir(n['Hija'].id);
    igual(tabsTxt(), ['*Bandeja', 'Uno', 'Hija', 'Dos'], 'antes');
    M._in.trayAbrir(n['Uno'].id);
    clicDerecho(q(`.tcarpeta[data-id="${n['Hija'].id}"]`));
    itemMenu('Borrar').click();
    await hasta(() => q('[data-act="carpeta-borrar"]'), 3000, 'el aviso');
    await pulsar('[data-act="carpeta-borrar"]');
    await hasta(() => !carp(n['Hija'].id), 4000, 'que se borre');
    igual(tabsTxt(), ['*Bandeja', 'Uno', 'Dos'], 'la pestaña de la hija');
    // la fija dentro de la que se borra, y otra en su subcarpeta
    const hija2 = M.crearCarpeta('Nieta', n['Uno'].id).id;
    M._in.pestNueva(hija2); M._in.pestIr('fija'); M._in.trayAbrir(hija2);
    const r = await M.borrarCarpeta(n['Uno'].id);
    ok(r && r.ok, json(r));
    igual([tabsTxt(), M._in.trayCarpeta], [['*Bandeja', 'Dos'], null], 'tras borrar la de arriba');
    // la pestaña en uso se borra: pasa a la de su izquierda
    M._in.pestIr(M._in.pestLista()[1].id);
    const r2 = await M.borrarCarpeta(n['Dos'].id);
    ok(r2 && r2.ok, json(r2));
    igual([tabsTxt(), M._in.trayCarpeta], [['*Bandeja'], null], 'la pestaña en uso');
    igual(JSON.parse(W.localStorage.getItem('mesa-pestanas:' + CLIENTE)).tabs.length, 1, 'lo recordado');
  });

  prueba('C25', 'En el editor: las mismas pestañas, el mismo menú y el aviso de borrar encima del editor (D-076)', async () => {
    const n = await arbolTabs();
    await abrirEditor('r1');
    if (!ed().trOpen) accion('bandeja');
    const box = () => ed().el.querySelector('.lb-tray');
    await hasta(() => box().querySelector('.lb-tcarp'), 2000, 'las carpetas');
    ok(!box().querySelector('.cptab'), 'con una sola pestaña no hace falta enseñarlas');
    const tile = box().querySelector(`.lb-tcarp[data-id="${n['Uno'].id}"]`);
    clicDerecho(tile);
    ok(q('.cpmenu'), 'no sale el menú');
    const r = q('.cpmenu').getBoundingClientRect();
    ok(D.elementFromPoint(r.x + r.width / 2, r.y + 10).closest('.cpmenu'), 'el menú queda detrás del editor');
    itemMenu('Abrir en').click();
    await hasta(() => box().querySelector('.cptab'), 2000, 'las pestañas en el editor');
    igual([...box().querySelectorAll('.cptab button:not(.cpx)')].map(b => b.textContent), ['Bandeja', 'Uno'], 'las pestañas');
    igual(tabsTxt(), ['Bandeja', '*Uno'], 'las mismas de la mesa');
    accion('tr-pest', { id: 'fija' });
    igual(M._in.trayCarpeta, null, 'cambiar de pestaña');
    accion('tr-pcerrar', { id: M._in.pestLista()[1].id });
    igual(tabsTxt(), ['*Bandeja'], 'cerrar');
    // borrar desde el editor: visible y con el editor abierto
    clicDerecho(box().querySelector(`.lb-tcarp[data-id="${n['Dos'].id}"]`));
    itemMenu('Borrar').click();
    const b = await hasta(() => q('[data-act="carpeta-borrar"]'), 3000, 'el aviso');
    const rb = b.getBoundingClientRect();
    igual(D.elementFromPoint(rb.x + rb.width / 2, rb.y + rb.height / 2), b, 'el aviso queda detrás del editor');
    b.click();
    await hasta(() => !carp(n['Dos'].id), 4000, 'que se borre');
    await hasta(() => !box().querySelector(`.lb-tcarp[data-id="${n['Dos'].id}"]`), 2000, 'que salga del cajón');
    ok(M.libre.abierto(), 'se cerró el editor');
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
    await hasta(() => M.carpetasUI, 15000, 'carpetas.js');
    M.cfg.margenSubida = 0;                         // el cupo de un Chrome sin ventana es pequeño: el margen se prueba aparte (C16, C17)
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
