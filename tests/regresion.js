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
  const V_ARCHIVO = 10, V_IDB = 12;   // la versión del archivo de «⇅ Exportar» y la de IndexedDB: v8 y 10 desde la 3.91 (D-119); v9 y 11 desde la 3.92 (D-120); v10 y 12 desde la 3.95 (D-124)
  // la batería va con el reloj de la mesa parado antes de sus fechas (noviembre de 2026): nada vence ni pasa solo a Publicado
  // salvo en las pruebas que lo adelantan (D-120)
  const RELOJ_PRUEBAS = Date.parse('2026-10-01T10:00:00+02:00');
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
    M._test.vaciarClip();
    if (M._test.olvidarDonde) M._test.olvidarDonde();
    if (M._test.ubBorrar) await M._test.ubBorrar();   // el catálogo de ubicaciones y las listas (D-124)
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

  prueba('M4', 'Un caption subido sin fotos ni Contexto subidos no da la publicación por subida; la casilla ya no dice «✓ en Notion» (M4, D-081)', async () => {
    await tablero([pub(1), pub(2)]);
    await poner('r1', [await foto('m4a.jpg')]);      // foto y Contexto puestos, pero sin subir
    M._test.setNote('r1', 'Contexto');
    M.loadCaptions([{ slotId: 'r1', options: [{ tone: 'a', text: '1' }, { tone: 'b', text: '2' }, { tone: 'c', text: '3' }] }]);
    M._test.setSlot('r1', { caption: { ...slot('r1').caption, pick: 0 } });
    const r = M.markCaptionsUploaded(['r1']);
    ok(r[0].result === 'subido', 'no se marcó subido: ' + json(r));
    await espera(50);
    ok(!celda('r1').querySelector('.st, .dot'), 'la casilla lleva una marca de Notion (D-081)');
    const p = M.plan().find(x => x.slotId === 'r1');
    ok(p && p.status === 'nueva', 'plan() no la da como nueva: ' + json(p));
    // control: con su foto y su Contexto subidos sí sale
    const [f] = await poner('r2', [await foto('m4.jpg')]);
    M._test.setNote('r2', 'Contexto');
    M.markUploaded([{ slotId: 'r2', fileIds: [f] }]);
    await espera(50);
    igual((M.plan().find(x => x.slotId === 'r2') || {}).status, 'ya subida', 'una publicación subida de verdad no sale como subida (la prueba no distingue)');
    ok(!celda('r2').querySelector('.st, .dot'), 'la casilla subida lleva una marca de Notion (D-081)');
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

  // cuatro publicaciones con foto, contexto y caption elegido: «Por aprobar» (las que se pidan)
  async function porAprobar(ids, pre = 'pa') {
    for (const id of ids) { await poner(id, [await foto(`${pre}-${id}.jpg`)]); M._test.setNote(id, 'Contexto ' + id); }
    M.loadCaptions(ids.map(slotId => ({ slotId, options: [{ tone: 'a', text: '1' }, { tone: 'b', text: '2' }, { tone: 'c', text: '3' }] })));
    ids.forEach(id => M._test.setSlot(id, { caption: { ...slot(id).caption, pick: 0 } }));
    ids.forEach(id => igual(M._in.estadoDe(slot(id)), 'aprobar', `${id} no está «Por aprobar»`));
  }
  const marcas = id => { const c = celda(id); return c ? [...c.querySelectorAll('.mks .mk')].map(e => [...e.classList].find(k => /^e-/.test(k)) || 'cambios') : null; };

  prueba('M10', 'La cuadrícula enseña solo Programado (✓), Publicado (dos ✓) y No aprobado (●), en una fila junto a la fecha; sin puntos arriba ni «en Notion» en la barra (D-081, sustituye D-004)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4), pub(5), pub(6)]);
    await porAprobar(['r1', 'r2', 'r3', 'r4'], 'm10');
    M.setEstado('r1', 'programado'); M.setEstado('r2', 'publicado'); M.setEstado('r3', 'noaprobado'); M.setEstado('r4', 'aprobado'); M.setEstado('r5', 'cancelado');
    await espera(60);
    igual(marcas('r1'), ['e-programado'], 'Programado');
    igual(marcas('r2'), ['e-publicado'], 'Publicado');
    igual(marcas('r3'), ['e-noaprobado'], 'No aprobado');
    igual(marcas('r4'), [], 'Aprobado no sale en la cuadrícula');
    igual(marcas('r6'), [], 'Por empezar no sale en la cuadrícula');
    ok(!celda('r5'), 'una cancelada sale en la cuadrícula');
    const fila = celda('r1').querySelector('.lab .mks');
    ok(fila && fila.nextSibling && fila.nextSibling.nodeType === 3 && /nov/.test(fila.nextSibling.textContent), 'las marcas no van junto a la fecha');
    ok(celda('r6').querySelector('.ph span') && !celda('r6').querySelector('.badges'), 'la casilla sin foto lleva algo arriba a la izquierda');
    ok(!qa('.cell .badges .dot, .cell .badges .mk, .cell .dot, .cell .st, .cell .dchg').length, 'quedan indicadores de antes en las casillas');
    const ancho = sel => q(sel).getBoundingClientRect().width;
    ok(ancho('.cell[data-slot="r2"] .e-publicado') <= ancho('.cell[data-slot="r1"] .e-programado') + 0.5, 'el doble tick ocupa más que el ✓');
    ok(!q('.bar .stats').textContent.includes('Notion'), 'la barra sigue contando «en Notion»');
    // «Vista cliente»: ninguna marca
    M._in.root().classList.add('client');
    try { ok(qa('.cell .mks').every(e => e.offsetParent === null), 'las marcas salen en «Vista cliente»'); } finally { M._in.root().classList.remove('client'); }
  });

  prueba('M29', 'Un solo marcador de cambios desde la última subida (caption, foto o encuadre, fecha u hora, contexto, nombre o tipo); al pasar el ratón dice qué cambió (D-081)', async () => {
    await tablero([pub(1), pub(2)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    await porAprobar(['r1'], 'm29');
    const f = slot('r1').photos[0];
    M.markUploaded([{ slotId: 'r1', fileIds: [f] }]); M.markCaptionsUploaded(['r1']);
    await espera(60);
    const mk = () => celda('r1') && celda('r1').querySelector('.mks .mk-cambios');
    ok(!mk(), 'sale el marcador sin cambios');
    M._test.setNote('r1', 'Otro contexto');
    await hasta(() => mk(), 3000, 'el marcador tras cambiar el contexto');
    igual(mk().dataset.tip, 'Cambió: contexto', 'lo que dice el marcador');
    M._test.setCrop(f, 'r1', { z: 1.6 });
    await hasta(() => mk() && mk().dataset.tip === 'Cambió: foto o encuadre y contexto', 3000, 'el encuadre en el marcador');
    M._test.setDate('r1', '2026-11-20T18:00:00.000+01:00');
    M._test.setSlot('r1', { caption: { ...slot('r1').caption, pick: 1 } });
    M._test.setType('r1', 'Carrusel');
    await hasta(() => mk() && mk().dataset.tip === 'Cambió: caption, foto o encuadre, fecha u hora, contexto y nombre o tipo', 3000, 'los cinco cambios, en su orden: ' + (mk() && mk().dataset.tip));
    igual(qa('.cell[data-slot="r1"] .mk-cambios').length, 1, 'más de un marcador de cambios');
    const r = mk().getBoundingClientRect(); igual([Math.round(r.width), Math.round(r.height)], [10, 10], 'el tamaño del marcador (el del punto de antes: 7 px y su aro)');
    igual(mk().getAttribute('title'), '', 'el marcador deja ver el título de la casilla');
    igual(W.getComputedStyle(mk()).pointerEvents, 'auto', 'el marcador no recibe el puntero');
    igual(W.getComputedStyle(mk(), '::after').content, '"Cambió: caption, foto o encuadre, fecha u hora, contexto y nombre o tipo"', 'el texto al pasar el ratón');
    ok(+W.getComputedStyle(mk(), '::after').zIndex < +W.getComputedStyle(q('.detail')).zIndex, 'el texto del marcador queda por encima de las ventanas');
    igual([...mk().querySelectorAll('circle')].map(c => c.getAttribute('fill')), ['#ffcf1f', '#1f5fd6', '#e3262b'], 'los tres colores: aro amarillo, disco azul, punto rojo');
    // el calendario lleva el mismo marcador, con lo que cambió
    const cm = await hasta(() => q('.side > .cal .chip[data-slot="r1"] .mk-cambios'), 3000, 'el marcador en el calendario');
    ok(/contexto/.test(cm.title), 'el calendario no dice qué cambió: ' + cm.title);
    // deshecho el contexto, sale de la lista
    M._test.setNote('r1', 'Contexto r1');
    await hasta(() => mk() && !/contexto/.test(mk().dataset.tip), 3000, 'el contexto fuera de la lista');
  });

  prueba('M30', 'No aprobado: va después de Por aprobar, se pone desde Por aprobar y vuelve a Por aprobar si la publicación cambia (D-082)', async () => {
    await tablero([pub(1), pub(2)]);
    await poner('r1', [await foto('m30.jpg')]); M._test.setNote('r1', 'Contexto');
    igual(M.setEstado('r1', 'noaprobado')[0].error, 'para marcarla como no aprobada le falta elegir el caption', 'sin caption elegido');
    M.loadCaptions([{ slotId: 'r1', options: [{ tone: 'a', text: '1' }, { tone: 'b', text: '2' }, { tone: 'c', text: '3' }] }]);
    M._test.setSlot('r1', { caption: { ...slot('r1').caption, pick: 0 } });
    igual(M.setEstado('r1', 'noaprobado')[0].estado, 'noaprobado', 'no se puso No aprobado');
    const E = M._in.ESTADOS.map(e => e[0]); igual(E.indexOf('noaprobado'), E.indexOf('aprobar') + 1, 'No aprobado no va después de Por aprobar');
    M._in.openDetail('r1', 0);
    const sel = await hasta(() => q('.detail .essel'), 3000, 'el estado en la publicación');
    igual([sel.value, sel.selectedOptions[0].textContent], ['noaprobado', 'No aprobado'], 'el selector');
    igual([...sel.options].map(o => o.textContent).slice(2, 4), ['Por aprobar', 'No aprobado'], 'el orden del selector');
    ok(q('.detail .pest .edot.e-noaprobado'), 'la publicación no lleva el ● rojo');
    M._in.closeDetail();
    // la publicación cambia: vuelve a Por aprobar y lo dice; deshecho el cambio, vuelve a No aprobado
    M._test.setNote('r1', 'Otro');
    igual(M._in.estadoDe(slot('r1')), 'aprobar', 'cambiada, sigue No aprobado');
    M._in.openDetail('r1', 0);
    await hasta(() => q('.detail .esold') && /no aprobarla/.test(q('.detail .esold').textContent), 3000, 'el aviso «cambió tras no aprobarla»');
    M._in.closeDetail();
    M._test.setNote('r1', 'Contexto');
    igual(M._in.estadoDe(slot('r1')), 'noaprobado', 'deshecho el cambio, no vuelve a No aprobado');
    // desde el selector de la ventana, a Aprobado y otra vez a No aprobado
    M._in.openDetail('r1', 0);
    const s2 = await hasta(() => q('.detail .essel'), 3000, 'el selector');
    s2.value = 'aprobado'; s2.dispatchEvent(new W.Event('change', { bubbles: true }));
    await hasta(() => M._in.estadoDe(slot('r1')) === 'aprobado', 3000, 'Aprobado desde la ventana');
    const s3 = await hasta(() => q('.detail .essel'), 3000, 'el selector');
    s3.value = 'noaprobado'; s3.dispatchEvent(new W.Event('change', { bubbles: true }));
    await hasta(() => M._in.estadoDe(slot('r1')) === 'noaprobado', 3000, 'No aprobado desde la ventana');
    M._in.closeDetail();
  });

  prueba('M31', 'Cancelar con «Motivo» opcional: se escribe en la publicación, se ve al abrirla y en el calendario al pasar el ratón, y viaja al exportar; IndexedDB 6 (D-082, D-060)', async () => {
    await tablero([pub(1), pub(2)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    M._in.openDetail('r1', 0);
    const sel = await hasta(() => q('.detail .essel'), 3000, 'el estado en la publicación');
    sel.value = 'cancelado'; sel.dispatchEvent(new W.Event('change', { bubbles: true }));
    const mi = await hasta(() => q('.detail .esmot'), 3000, 'el campo «Motivo»');
    igual(D.activeElement, mi, 'el campo «Motivo» no recibe el foco al cancelar');
    igual(mi.placeholder, 'Motivo (opcional)', 'el texto del campo');
    const MOT = 'El cliente cambia la fecha del evento';
    mi.value = MOT; mi.dispatchEvent(new W.Event('input', { bubbles: true }));
    await espera(500);
    igual(slot('r1').estado, { v: 'cancelado', motivo: MOT }, 'el motivo no se guardó');
    ok(q('.detail .esmot') === mi, 'el campo se redibujó mientras se escribía');
    M._in.closeDetail();
    const chip = await hasta(() => q('.side > .cal .chip[data-slot="r1"]'), 3000, 'la cancelada en el calendario');
    ok(chip.title.endsWith('· Cancelada: ' + MOT), 'el calendario no dice el motivo: ' + chip.title);
    ok(chip.querySelector('.eico.e-cancelado svg'), 'la cancelada no lleva ✕ en el calendario');
    M._in.openDetail('r1', 0);
    igual((await hasta(() => q('.detail .esmot'), 3000, 'el motivo al abrirla')).value, MOT, 'la publicación no enseña el motivo');
    M._in.closeDetail();
    // M.setEstado: cancelar otra vez lo conserva; uno nuevo lo cambia; '' lo quita; solo una cancelada lleva motivo
    igual(M.setEstado('r1', 'cancelado')[0].motivo, MOT, 'cancelar otra vez perdió el motivo');
    igual(M.setEstado('r1', 'cancelado', { motivo: 'Otro' })[0].motivo, 'Otro', 'el motivo nuevo');
    igual(M.setEstado('r2', 'programado', { motivo: 'x' })[0].error, 'solo una cancelada lleva motivo', 'motivo en una no cancelada');
    M.setEstado('r1', 'cancelado', { motivo: MOT });
    // viaja al exportar (archivo v5 desde la 3.66; v6 desde la 3.68, D-084; v7 desde la 3.69, D-085) y se vuelve a importar
    await M.flush();
    const d = JSON.parse(await (await M.exportAll({ returnBlob: true })).text());
    igual(d.v, V_ARCHIVO, 'la versión del archivo');
    igual(d.boards.find(b => b.client === CLIENTE).slots.find(x => x.id === 'r1').estado, { v: 'cancelado', motivo: MOT }, 'el motivo no viaja al exportar');
    M.setEstado('r1', null);
    ok(!slot('r1').estado, 'reactivada, guarda el estado');
    const dbs = W.indexedDB.databases ? await W.indexedDB.databases() : [];
    if (dbs.length) igual((dbs.find(x => x.name === 'mesa-feed') || {}).version, V_IDB, 'la versión de IndexedDB');   // 6 desde la 3.66 (D-082); 7 desde la 3.68 (D-084); 8 desde la 3.69 (D-085); 9 desde la 3.85 (D-107)
  });

  prueba('M32', 'Calendario: Aprobado ● verde, No aprobado ● rojo, Programado ✓, Publicado dos ✓, Cancelado ✕ rojo; Por empezar, Captions y Por aprobar como antes; la leyenda al día (D-081)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4), pub(5), pub(6), pub(7)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    await porAprobar(['r1', 'r2', 'r3', 'r4', 'r7'], 'm32');
    M.setEstado('r1', 'aprobado'); M.setEstado('r2', 'noaprobado'); M.setEstado('r3', 'programado'); M.setEstado('r4', 'publicado'); M.setEstado('r5', 'cancelado');
    await espera(80);
    const ico = id => q(`.side > .cal .chip[data-slot="${id}"] .cl > i:first-child`);
    igual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'].map(id => ico(id) && ico(id).className), ['edot e-aprobado', 'edot e-noaprobado', 'eico e-programado', 'eico e-publicado', 'eico e-cancelado', 'edot e-empezar', 'edot e-aprobar'], 'la marca de cada estado');
    const cs = id => W.getComputedStyle(ico(id));
    igual([cs('r1').backgroundColor, cs('r2').backgroundColor, cs('r3').color, cs('r4').color, cs('r5').color], ['rgb(26, 127, 55)', 'rgb(192, 57, 43)', 'rgb(26, 127, 55)', 'rgb(26, 127, 55)', 'rgb(192, 57, 43)'], 'los colores');
    igual(ico('r4').querySelectorAll('path:not(.h)').length, 2, 'Publicado no lleva dos ✓');
    // desde la 3.68 la leyenda es la barra de pasos, con No aprobado y Cancelado aparte (D-084; P1)
    igual(qa('.side > .cal .cleg .cpaso, .side > .cal .cleg .cextra > span').map(x => x.textContent), ['Por empezar', 'Captions', 'Por aprobar', 'Aprobado', 'Programado', 'Publicado', 'No aprobado', 'Cancelado'], 'la leyenda');
    igual(qa('.side > .cal .cleg .cpaso > i, .side > .cal .cleg .cextra > span > i').map(x => x.className), ['edot e-empezar', 'edot e-captions', 'edot e-aprobar', 'edot e-aprobado', 'eico e-programado', 'eico e-publicado', 'edot e-noaprobado', 'eico e-cancelado'], 'las marcas de la leyenda');
  });

  prueba('M33', '⌘E con la ventana de una publicación abierta hace lo de su «Editar …» en la diapositiva que se ve y guarda antes el campo en el que se escribe; nada en «Vista cliente», sin el botón, mantenida ni con el editor abierto (D-088)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Foto'), pub(3, 'Reel'), pub(4, 'Reel')]);
    await hasta(() => M.libre, 4000, 'libre.js');
    await poner('r1', [await foto('m33a.jpg'), await foto('m33b.jpg'), await foto('m33c.jpg')]);
    await poner('r2', [await foto('m33d.jpg')]);
    await poner('r3', [await foto('m33e.jpg', 1080, 1920)]);
    M.loadCaptions([{ slotId: 'r2', options: [{ tone: 'a', text: '1' }, { tone: 'b', text: '2' }, { tone: 'c', text: '3' }] }]);
    const tE = (o = {}) => { const e = new W.KeyboardEvent('keydown', { key: 'e', metaKey: true, repeat: !!o.repeat, bubbles: true, cancelable: true }); (o.en || D.body).dispatchEvent(e); return e; };
    const escribe = (t, v) => { t.focus(); t.value = v; t.dispatchEvent(new W.Event('input', { bubbles: true })); };
    const abrio = async (id, i, que) => {
      await hasta(() => ed() && ed().el && ed().el.isConnected, 4000, 'el editor abierto');
      igual([ed().slotId, ed().i, !!ed().car, !!ed().reel], [id, i, que === 'car', que === 'reel'], 'el editor abrió otra publicación o diapositiva');
      M.libre.cerrar(); await hasta(() => !ed(), 2000, 'cerrar el editor');
    };
    const guardada = async id => { await M.flush(); return (await M._in.idbGet('boards', M.board().key)).slots.find(s => s.id === id); };
    // sin la ventana abierta: como si nada
    ok(!tE().defaultPrevented, '⌘E actuó sin la ventana abierta');
    await espera(50); ok(!ed(), '⌘E abrió el editor sin la ventana');
    // carrusel, en la 2.ª diapositiva, escribiendo en la Nota: la guarda antes de abrir (su post-it sale al momento en la casilla)
    M._in.openDetail('r1', 1);
    const memo = q('.detail textarea.memo'); escribe(memo, 'M33 nota');
    ok(!q('.cell[data-slot="r1"] .pit'), 'la nota se guardó sin esperar');
    ok(tE({ en: memo }).defaultPrevented, '⌘E no se anula');
    ok(q('.cell[data-slot="r1"] .pit') && D.activeElement !== memo, 'la nota no se guardó antes de abrir el editor');
    await abrio('r1', 1, 'car');
    igual((await guardada('r1')).memo, 'M33 nota', 'la nota guardada');
    // foto, escribiendo en un caption
    M._in.openDetail('r2', 0);
    escribe(q('.detail textarea.capt[data-k="1"]'), '2 editado');
    ok(tE({ en: q('.detail textarea.capt[data-k="1"]') }).defaultPrevented, '⌘E en un caption no se anula');
    await abrio('r2', 0, 'car');
    igual((await guardada('r2')).caption.text[1], '2 editado', 'el caption guardado');
    // reel, escribiendo en el Contexto: su portada
    M._in.openDetail('r3', 0);
    escribe(q('.detail textarea.note'), 'M33 contexto');
    tE({ en: q('.detail textarea.note') });
    await abrio('r3', 0, 'reel');
    igual((await guardada('r3')).note, 'M33 contexto', 'el contexto guardado');
    // mantenida no abre; soltada y otra vez, sí, en la diapositiva que se ve tras moverse con →
    M._in.openDetail('r1', 1);
    tecla('ArrowRight'); await espera(20);
    ok(tE({ repeat: true }).defaultPrevented, '⌘E mantenida no se anula');
    await espera(80); ok(!ed(), '⌘E mantenida abrió el editor');
    tE(); await abrio('r1', 2, 'car');
    // un reel sin portada no tiene «Editar portada»: nada
    M._in.openDetail('r4', 0);
    ok(!q('.detail [data-act="editar"]'), 'el reel sin portada tiene botón');
    tE(); await espera(80);
    ok(!ed() && dialogo() && dialogo().dataset.slot === 'r4', '⌘E hizo algo sin el botón');
    M._in.closeDetail();
    // con el editor abierto, sus teclas: ⌘E no lo cambia
    await abrirEditor('r1', 0);
    tE(); await espera(80);
    igual([ed() && ed().slotId, ed() && ed().i], ['r1', 0], '⌘E en el editor lo cambió');
    M.libre.cerrar(); await hasta(() => !ed(), 2000, 'cerrar el editor');
    // «Vista cliente»: su ventana no edita
    const raiz = M._in.root(); raiz.classList.add('client');
    try {
      celda('r1').click(); await espera(30);
      ok(dialogo() && dialogo().dataset.dlg === 'ig', 'en «Vista cliente» no se abrió su ventana');
      ok(!tE().defaultPrevented, '⌘E se anula en «Vista cliente»');
      await espera(80); ok(!ed(), '⌘E abrió el editor en «Vista cliente»');
    } finally { raiz.classList.remove('client'); M._in.closeDetail(); }
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
    ok(d.v === V_ARCHIVO, 'versión del archivo: ' + d.v);   // v5 desde la 3.66 (D-082); v6 desde la 3.68 (D-084); v7 desde la 3.69 (D-085)
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
    await hasta(() => dialogo() && dialogo().dataset.dlg === 'addmode', 2000, 'sustituir o añadir: la historia ya tiene imagen');
    tecla('2');
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
    igual(d.v, V_ARCHIVO, 'versión del archivo');   // v5 desde la 3.66 (D-082); v6 desde la 3.68 (D-084); v7 desde la 3.69 (D-085)
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
    const v9 = await M.importData({ ...d, v: V_ARCHIVO + 1 }, { confirm: false });
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
    igual(info.version, V_IDB, 'versión de la base de datos');   // 6 desde la 3.66 (D-082); 7 desde la 3.68 (D-084); 8 desde la 3.69 (D-085); 9 desde la 3.85 (D-107)
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

  prueba('H13', 'Con un hueco vacío en el feed, «Historias» abre su panel y lista la historia; la casilla ya no lleva el punto «Hueco vacío» (D-054, D-035, D-081)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await hasta(() => M.hs, 4000, 'historias.js');
    await poner('r1', [await foto('h13-a.jpg'), await foto('h13-b.jpg')]);
    await abrirEditor('r1');
    accion('sl-add');
    compDe(ed().i).els.push(huecoEl('h13', 0.1, 0.1, 0.8, 0.8));
    await aplicarEditor();
    await hasta(() => (M.plan().find(x => x.slotId === 'r1') || {})['hueco vacío'], 4000, 'el hueco vacío en plan()');
    ok(celda('r1') && !celda('r1').querySelector('.dot, .hv'), 'la casilla lleva todavía el punto «Hueco vacío» (D-081)');
    const id = M.hs.anadir(DIA(10), { note: 'H13' });
    q('.hvsw [data-v="1"]').click();
    const panel = q('.main > section.hv');
    ok(q('.feed').offsetParent === null, 'con «Historias» sigue viéndose la cuadrícula');
    ok(!panel.hidden && panel.offsetParent !== null, 'el panel de historias no se ve');
    ok(panel.querySelector(`.hv-rail[data-day="${DIA(10)}"] .hv-card[data-h="${id}"]`), 'el panel no lista la historia');
    // «Vista cliente»: el panel sigue saliendo (D-064)
    const raiz = M._in.root();
    raiz.classList.add('client');
    try { ok(panel.offsetParent !== null, 'en «Vista cliente» no se ve el panel (D-064)'); } finally { raiz.classList.remove('client'); }
    q('.hvsw [data-v="0"]').click();
    ok(q('.feed').offsetParent !== null && panel.hidden, 'con «Feed» no vuelve la cuadrícula');
    ok(celda('r1').offsetParent !== null, 'la casilla no se ve en la cuadrícula');
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
    delete c0.libre.historiasKit; delete c0.libre.historiasKitIds;
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

  prueba('H22', 'Las flechas recorren todo el mes por fecha y hora: saltan días vacíos y canceladas, se desactivan en los extremos y siguen a la historia si cambia (D-080, D-065)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.hs, 4000, 'historias.js');
    M.hs.ver(true);
    const a = M.hs.anadir(DIA(10), { time: '10:00' }), b = M.hs.anadir(DIA(10), { time: '11:00' }), x = M.hs.anadir(DIA(10), { time: '10:30' }), c = M.hs.anadir(DIA(14), { time: '09:00' }), d = M.hs.anadir(DIA(14), { time: '08:00' }), e = M.hs.anadir(DIA(20), { time: '12:00' });
    M.hs.cancelar(x);
    const rotulo = () => q('.detail .hv-dn').textContent, hora = () => q('.detail [data-hv-c="hora"]').value;
    await abrirH(a);
    igual(rotulo(), 'Mar 10 nov · 1 de 2', 'el rótulo');
    ok(flecha(-1).disabled && !flecha(1).disabled, 'la primera del mes');
    flecha(1).click(); await espera(20); igual(hora(), '11:00', 'salta la cancelada'); igual(rotulo(), 'Mar 10 nov · 2 de 2', 'dentro del día');
    ok(!flecha(1).disabled, 'la última del día se para');
    flecha(1).click(); await espera(20); igual(hora(), '08:00', 'cruza por hora y salta los días vacíos'); igual(rotulo(), 'Sáb 14 nov · 1 de 2', 'el día siguiente');
    flecha(1).click(); await espera(20); igual(hora(), '09:00', 'en su día');
    flecha(1).click(); await espera(20); igual(rotulo(), 'Vie 20 nov · 1 de 1', 'el último día');
    ok(!flecha(-1).disabled && flecha(1).disabled, 'la última del mes');
    flecha(-1).click(); await espera(20); igual(rotulo(), 'Sáb 14 nov · 2 de 2', 'volver cruza a la última del día anterior');
    flecha(-1).click(); await espera(20); flecha(-1).click(); await espera(20); igual(rotulo(), 'Mar 10 nov · 2 de 2', 'volver al primer día');
    // la abierta cambia de día: el rótulo y el recorrido la siguen
    fijarCampo('dia', DIA(20));
    await hasta(() => /Vie 20 nov/.test(rotulo()), 2000, 'el rótulo de su día nuevo');
    igual(M._in.localDay(viva(b).date), DIA(20), 'el día');
    M._in.closeDetail();
    // una cancelada: sin flechas, y lo dice
    await abrirH(x);
    ok(!flecha(1) && !flecha(-1), 'una cancelada lleva flechas');
    igual(rotulo(), 'Mar 10 nov · cancelada', 'el rótulo de una cancelada');
    M._in.closeDetail();
    // una sola en el mes: sin flechas
    [a, b, c, d].forEach(i => M.hs.cancelar(i));
    await abrirH(e);
    ok(!flecha(1) && !flecha(-1), 'con una sola lleva flechas');
    igual(rotulo(), 'Vie 20 nov · 1 de 1', 'el rótulo de una sola');
    M._in.closeDetail();
    M.hs.ver(false);
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
    ok(/10 nov 11:00/.test(q('.detail .hv-cf').textContent), 'la siguiente salta a la que no está diseñada');
    igual(q('.detail .hv-dn').textContent, 'Mar 10 nov · 2 de 2', 'el día cuenta solo las que ve');
    // todo el mes, también aquí, y con ← → (D-080)
    flecha(1).click(); await espera(20);
    ok(/14 nov/.test(q('.detail .hv-cf').textContent) && flecha(1).disabled, 'cruza a la última que ve');
    ok(!q('.detail .hv-post, .detail select'), 'sale la publicación');
    tecla('ArrowLeft'); await espera(20);
    ok(/10 nov 11:00/.test(q('.detail .hv-cf').textContent), '← no vuelve');
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


  prueba('H25', 'Una foto soltada en una historia con imagen: 1 Sustituir, 2 Añadir (tecla o clic), Esc nada; sin imagen no pregunta; siguen D-056 y Zernio (D-078)', async () => {
    await tablero([pub(1, 'Foto', 20)]);
    await hasta(() => M.libre && M.hs, 4000, 'libre.js e historias.js');
    const [fa, fb, fc, fd] = await M.addFiles([await foto('h25a.jpg'), await foto('h25b.jpg'), await foto('h25c.jpg'), await foto('h25d.jpg')]);
    const [post] = await poner('r1', [await foto('h25p.jpg')]);
    const id = M.hs.anadir(DIA(10), { time: '12:00' });
    M.hs.ver(true);
    const pregunta = () => hasta(() => dialogo() && dialogo().dataset.dlg === 'addmode', 2000, 'la pregunta');
    const src = () => compDe(0).els.filter(e => e.t === 'foto').map(e => e.src);
    const n0 = M.board().historias.length;
    // sin imagen no pregunta
    M.hs.soltar(id, fa);
    await hasta(() => ed() && ed().el && compDe(0).els.some(e => e.src === fa), 4000, 'la foto en una historia sin imagen');
    ok(!dialogo(), 'preguntó sin imagen');
    await aplicarEditor();
    // Esc: nada cambia y el editor no se abre
    const antes = json(hDe(id));
    M.hs.soltar(id, fb);
    await pregunta();
    ok(/Sustituir/.test(dialogo().textContent) && /Añadir/.test(dialogo().textContent), 'no ofrece las dos');
    ok(!M.libre.abierto(), 'el editor se abrió antes de contestar');
    tecla('Escape');
    await espera(50);
    ok(!dialogo() && !M.libre.abierto(), 'Esc dejó algo abierto');
    igual(json(hDe(id)), antes, 'Esc cambió la historia');
    // 1: sustituye
    M.hs.soltar(id, fb);
    await pregunta();
    tecla('1');
    await hasta(() => ed() && ed().el && src().includes(fb), 4000, 'la nueva foto');
    igual(src(), [fb], 'al sustituir');
    await aplicarEditor();
    // 2: añade en esa misma historia
    M.hs.soltar(id, fc);
    await pregunta();
    tecla('2');
    await hasta(() => ed() && ed().el && src().includes(fc), 4000, 'la foto añadida');
    igual(src().sort(), [fb, fc].sort(), 'al añadir');
    await aplicarEditor();
    igual(M.board().historias.length, n0, 'creó otra historia');
    // también con un clic
    M.hs.soltar(id, fd);
    await pregunta();
    q('.detail [data-act="addmode"][data-m="add"]').click();
    await hasta(() => ed() && ed().el && src().includes(fd), 4000, 'con un clic');
    igual(src().length, 3, 'con un clic');
    M.libre.cerrar(); await espera(50);
    // el aviso de adelanto sigue, después de la pregunta
    M.hs.soltar(id, post);
    await pregunta();
    tecla('1');
    await hasta(preguntaEditor, 4000, 'el aviso de no adelantar');
    ed().ask.querySelector('[data-ask="seguir"]').click();
    await espera(100);
    ok(!src().includes(post), 'con «Cancelar» entró la foto');
    M.libre.cerrar(); await espera(50);
    // programada: sustituir la marca como pendiente de Zernio
    viva(id).zernio = { id: 'z', date: viva(id).date, file: viva(id).photos[0] };
    M.hs.soltar(id, fa);
    await pregunta();
    tecla('1');
    await hasta(() => ed() && ed().el && src().includes(fa), 4000, 'en una programada');
    await aplicarEditor();
    ok(M.historias().find(h => h.id === id).cambios.includes('imagen'), 'no falta actualizar Zernio');
    // cancelada: no pregunta, lo dice
    const can = M.hs.anadir(DIA(11), { time: '12:00' });
    viva(can).photos = [fa];
    M.hs.cancelar(can);
    M.hs.soltar(can, fb);
    await espera(50);
    ok(!dialogo() && !M.libre.abierto(), 'una cancelada preguntó o se abrió');
    M.hs.ver(false);
  });

  prueba('H26', 'En el editor de una historia: qué sustituye con varias fotos, «Añadir» a un hueco libre o suelta, sin pregunta en un hueco libre elegido; Esc no cambia nada (D-078, D-050)', async () => {
    await tablero([pub(1, 'Foto', 20)]);
    await hasta(() => M.libre && M.hs, 4000, 'libre.js e historias.js');
    const [fa, fb, fc, fd, fh] = await M.addFiles([await foto('h26a.jpg'), await foto('h26b.jpg'), await foto('h26c.jpg'), await foto('h26d.jpg'), await foto('h26h.jpg', 1500, 1000)]);
    const id = M.hs.anadir(DIA(10), { time: '12:00' });
    await abrirEditor(id);
    const src = () => compDe(0).els.filter(e => e.t === 'foto').map(e => e.src);
    const pregunta = () => hasta(() => ed().ask && /ya tiene imagen/.test(ed().ask.textContent), 2000, 'la pregunta');
    // sin foto: entra sin preguntar
    accion('tr-add', { f: fa });
    await hasta(() => src().includes(fa), 2000, 'la primera');
    ok(!ed().ask, 'preguntó sin foto');
    // con foto: Esc no cambia nada
    const c0 = json(compDe(0));
    accion('tr-add', { f: fb });
    await pregunta();
    tecla('Escape');
    await espera(50);
    igual(json(compDe(0)), c0, 'Esc cambió la página');
    ok(!ed().ask, 'Esc no cerró');
    // 2 sin huecos: un elemento nuevo
    accion('tr-add', { f: fb });
    await pregunta();
    tecla('2');
    await hasta(() => src().includes(fb), 2000, 'la añadida');
    igual(src().length, 2, 'al añadir');
    const [ea, eb] = compDe(0).els.filter(e => e.t === 'foto');
    Object.assign(ea, { w: 0.2, h: 0.2, x: 0.05, y: 0.05 }); Object.assign(eb, { w: 0.8, h: 0.5, x: 0.1, y: 0.4 });
    // 1 sin nada elegido: la de mayor superficie; la otra y su sitio no cambian
    const a0 = json(ea), caja = [eb.x, eb.y, eb.w, eb.h];
    ed().sel = null; ed().mas = [];
    accion('tr-add', { f: fc });
    await pregunta();
    tecla('1');
    await hasta(() => src().includes(fc), 2000, 'la sustituta');
    ok(!src().includes(fb), 'no sustituyó la mayor');
    igual(json(compDe(0).els.find(e => e.id === ea.id)), a0, 'la otra cambió');
    const nueva = compDe(0).els.find(e => e.src === fc);
    igual([nueva.x, nueva.y, nueva.w, nueva.h], caja, 'su recuadro');
    ok(ed().vuelven.has(fb), 'la anterior no vuelve a la bandeja');
    // 1 con una elegida: esa; un paso de ⌘Z lo deshace
    elegir(compDe(0).els.find(e => e.src === fa));
    accion('tr-add', { f: fd });
    await pregunta();
    tecla('1');
    await hasta(() => src().includes(fd), 2000, 'la elegida');
    ok(!src().includes(fa) && src().includes(fc), 'no sustituyó la elegida');
    tecla('z', { meta: true, code: 'KeyZ' });
    await hasta(() => src().includes(fa) && !src().includes(fd), 2000, '⌘Z');
    // distinta orientación: la pregunta de D-050; con Esc nada cambia
    elegir(compDe(0).els.find(e => e.src === fa));
    const c1 = json(compDe(0));
    accion('tr-add', { f: fh });
    await pregunta();
    tecla('1');
    await hasta(() => ed().ask && /Esta foto es/.test(ed().ask.textContent), 2000, 'la pregunta de encaje');
    tecla('Escape');
    await espera(50);
    igual(json(compDe(0)), c1, 'Esc en la pregunta de encaje');
    M.libre.cerrar(); await espera(50);
    // con huecos: «Añadir» va a un hueco libre; uno libre elegido no pregunta; «Sustituir» en un hueco lleno sigue D-050
    const id2 = M.hs.anadir(DIA(12), { time: '12:00' });
    await abrirEditor(id2);
    accion('tr-add', { f: fa });
    await hasta(() => src().includes(fa), 2000, 'la primera');
    compDe(0).els.push(huecoEl('h1', 0.1, 0.1, 0.3, 0.4), huecoEl('h2', 0.5, 0.1, 0.3, 0.4));
    ed().sel = null;
    accion('tr-add', { f: fb });
    await pregunta();
    tecla('2');
    await hasta(() => src().includes(fb), 2000, 'al hueco libre');
    ok(compDe(0).els.find(e => e.src === fb).hueco, 'no fue a un hueco');
    elegir(compDe(0).els.find(e => e.id === 'h2'));
    accion('tr-add', { f: fc });
    await hasta(() => src().includes(fc), 2000, 'al hueco libre elegido');
    ok(!ed().ask, 'preguntó con un hueco libre elegido');
    // todos llenos y una foto más: «Añadir» la pone suelta, no se queda fuera
    ed().sel = null;
    accion('tr-add', { f: fd });
    await pregunta();
    tecla('2');
    await hasta(() => src().includes(fd), 2000, 'suelta');
    ok(!compDe(0).els.find(e => e.src === fd).hueco, 'no es suelta');
    M.libre.cerrar(); await espera(50);
  });


  prueba('H27', 'Las publicaciones en la vista: su tipo sin abrirlas; un clic las abre en grande sin «Editar», sin cambiar nada y fuera del recorrido de las historias (D-079)', async () => {
    await tablero([pub(1, 'Foto', 10), pub(2, 'Carrusel', 10), pub(3, 'Reel', 10), pub(4, 'Foto', 12)]);
    await hasta(() => M.hs, 4000, 'historias.js');
    await poner('r1', [await foto('h27a.jpg')]);
    await poner('r2', [await foto('h27b.jpg'), await foto('h27c.jpg')]);
    await poner('r3', [await foto('h27d.jpg', 1080, 1920)]);
    await poner('r4', [await foto('h27e.jpg'), await foto('h27f.jpg')]);
    const [libre] = await M.addFiles([await foto('h27g.jpg')]);
    const a = M.hs.anadir(DIA(10), { time: '10:00' }), b = M.hs.anadir(DIA(10), { time: '11:00' });
    M.hs.ver(true);
    const post = id => q(`.hv-post[data-slot="${id}"]`);
    for (const [id, t] of [['r1', 'Foto'], ['r2', 'Carrusel'], ['r3', 'Reel'], ['r4', 'Carrusel']]) {
      ok(post(id).querySelector('.hv-pt svg') && post(id).querySelector('.hv-pt').offsetWidth > 0, `sin indicativo en ${id}`);
      ok(post(id).title.startsWith(t), `${id} no dice ${t}: ${post(id).title}`);
    }
    igual(post('r1').querySelector('.hv-pt').innerHTML === post('r2').querySelector('.hv-pt').innerHTML, false, 'foto y carrusel con el mismo icono');
    igual(post('r2').querySelector('.hv-pt').innerHTML === post('r3').querySelector('.hv-pt').innerHTML, false, 'carrusel y reel con el mismo icono');
    const antes = () => json({ b: M.board(), h: M.historias() }), a0 = antes();
    // un clic: en grande, sin «Editar»; y nada cambia
    post('r2').click();
    await hasta(() => dialogo() && dialogo().dataset.dlg === 'ig' && q('.detail .igmedia img'), 3000, 'la previsualización');
    ok(!q('.detail .igedit'), 'lleva «Editar»');
    // ← → pasan sus fotos, no una historia
    const s0 = q('.detail .igmedia img').src;
    tecla('ArrowRight');
    await hasta(() => q('.detail .igmedia img') && q('.detail .igmedia img').src !== s0, 2000, 'la segunda foto');
    ok(!q('.detail .igedit'), 'al cambiar de foto vuelve «Editar»');
    igual(dialogo().dataset.dlg, 'ig', 'salió de la publicación');
    tecla('Escape');
    await hasta(() => !dialogo(), 1000, 'que Esc la cierre');
    igual(antes(), a0, 'abrirla cambió algo');
    ok(q('.hv').offsetParent !== null, 'no sigue en la vista');
    // con el teclado, sobre un reel
    post('r3').focus(); post('r3').click();
    await hasta(() => dialogo() && dialogo().dataset.dlg === 'ig', 3000, 'el reel');
    q('.detail [data-act="close"]').click();
    await hasta(() => !dialogo(), 1000, 'la ×');
    // con una foto elegida en la bandeja, no la coloca
    const tarjeta = q(`.tray .titem[data-file="${libre}"]`); ok(tarjeta, 'la foto no está en la bandeja'); tarjeta.click();
    post('r1').click();
    await hasta(() => dialogo() && dialogo().dataset.dlg === 'ig', 3000, 'con una elegida');
    tecla('Escape');
    await hasta(() => !dialogo(), 1000, 'Esc');
    igual(antes(), a0, 'con una foto elegida cambió algo');
    // las flechas de una historia no pasan por las publicaciones
    q(`.hv-card[data-h="${a}"]`).click();
    await hasta(() => dialogo() && dialogo().dataset.dlg === 'historia', 2000, 'la historia');
    q('.detail [data-hv="nav"][data-d="1"]').click();
    await espera(50);
    igual(q('.detail [data-hv-c="hora"]').value, '11:00', 'la siguiente no es la historia');
    igual(dialogo().dataset.dlg, 'historia', 'la flecha salió de las historias');
    M._in.closeDetail();
    M.hs.ver(false);
    ok(b, 'sin historia');
  });


  prueba('H28', '← → como las flechas, solo con la ventana abierta y nunca en un campo; el cambio de día se marca: flecha, velo y rótulo (D-080)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.hs, 4000, 'historias.js');
    M.hs.ver(true);
    const a = M.hs.anadir(DIA(10), { time: '10:00' }), b = M.hs.anadir(DIA(10), { time: '11:00' }), c = M.hs.anadir(DIA(14), { time: '09:00' });
    const rotulo = () => q('.detail .hv-dn').textContent, veces = t => { const e = new W.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }); t.dispatchEvent(e); return e; };
    // sin ventana, nada
    tecla('ArrowRight'); await espera(20); ok(!dialogo(), '→ sin ventana abrió algo');
    await abrirH(a);
    igual(flecha(1).classList.contains('otro'), false, 'dentro del día, la flecha marca otro día');
    tecla('ArrowRight'); await espera(20); igual(rotulo(), 'Mar 10 nov · 2 de 2', '→');
    ok(!q('.detail .hv-cruce') && !q('.detail .hv-dn.cruce'), 'dentro del día marca un cruce');
    // en la última del día, la flecha lo anuncia
    ok(flecha(1).classList.contains('otro') && /Sáb 14/.test(flecha(1).textContent), 'no anuncia el día de destino');
    igual(flecha(1).title, 'Día siguiente: Sáb 14 nov', 'su título');
    // al cruzar: velo y rótulo en acento; el velo no para las teclas
    tecla('ArrowRight'); await espera(20); igual(rotulo(), 'Sáb 14 nov · 1 de 1', '→ cruza');
    ok(q('.detail .hv-big .hv-cruce') && /Sábado 14 nov/.test(q('.detail .hv-cruce').textContent) && /1 historia/.test(q('.detail .hv-cruce').textContent), 'el velo');
    ok(q('.detail .hv-dn.cruce'), 'el rótulo en acento');
    igual(W.getComputedStyle(q('.detail .hv-cruce')).pointerEvents, 'none', 'el velo para los clics');
    await hasta(() => !q('.detail .hv-cruce'), 3000, 'que el velo se vaya');
    ok(q('.detail .hv-dn.cruce'), 'el acento se fue con el velo');
    tecla('ArrowRight'); await espera(20); igual(rotulo(), 'Sáb 14 nov · 1 de 1', '→ en la última del mes');
    tecla('ArrowLeft'); await espera(20); igual(rotulo(), 'Mar 10 nov · 2 de 2', '← cruza');
    ok(q('.detail .hv-cruce'), 'volver también marca el cruce');
    tecla('ArrowLeft'); await espera(20); igual(rotulo(), 'Mar 10 nov · 1 de 2', '← dentro del día');
    ok(!q('.detail .hv-cruce') && !q('.detail .hv-dn.cruce'), 'dentro del día sigue la marca');
    tecla('ArrowLeft'); await espera(20); igual(rotulo(), 'Mar 10 nov · 1 de 2', '← en la primera del mes');
    // en un campo no cambia de historia; con modificadores tampoco
    for (const sel of ['[data-hv-c="hora"]', '[data-hv-c="dia"]', '[data-hv-c="post"]']) {
      const t = q(`.detail ${sel}`); t.focus();
      const e = veces(t); await espera(20);
      igual(rotulo(), 'Mar 10 nov · 1 de 2', `→ en ${sel}`);
      ok(!e.defaultPrevented, `→ quitó la tecla a ${sel}`);
    }
    D.activeElement.blur();
    tecla('ArrowRight', { meta: true }); await espera(20); igual(rotulo(), 'Mar 10 nov · 1 de 2', '⌘→');
    tecla('ArrowRight', { shift: true }); await espera(20); igual(rotulo(), 'Mar 10 nov · 1 de 2', '⇧→');
    M._in.closeDetail();
    M.hs.ver(false);
    ok(b && c, 'sin historias');
  });

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
    // redibujar con el foco en el caption no lo rehace (D-112): mismo scroll, mismo foco; al dejarlo se redibuja sin moverla
    col.scrollTop = 250; await espera(30);
    M._test.refreshDetail();
    igual(q('.detail .pright.hascap'), col, 'la ventana se rehízo con el caption en uso');
    igual(col.scrollTop, 250, 'redibujar movió la columna');
    ok(D.activeElement && D.activeElement.matches('textarea.capt'), 'redibujar perdió el foco del caption');
    D.activeElement.blur();
    const col2 = await hasta(() => { const c = q('.detail .pright.hascap'); return c !== col && c; }, 2000, 'que la ventana se redibuje al dejar el caption');
    igual(col2.scrollTop, 250, 'redibujar al dejar el caption movió la columna');
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
    await hasta(() => (M.plan().find(x => x.slotId === 'r1') || {})['hueco vacío'], 4000, 'el hueco vacío en plan()');
    ok(!celda('r1').querySelector('.dot'), 'la casilla lleva todavía el punto «Hueco vacío» (D-081)');
    igual(M.plan().find(x => x.slotId === 'r1')['hueco vacío'], [p + 1, j + 1].sort((a, b) => a - b), 'plan() no marca las diapositivas con hueco vacío');
    ok(!('hueco vacío' in (M.plan().find(x => x.slotId === 'r2') || {})), 'un post sin hueco vacío salió marcado');
    const fid = s.photos[j];
    M.startUpload([{ fileId: fid, slotId: 'r1', url: 'http://127.0.0.1:9/no', auth: 'x' }]);
    ok(M.uploads[fid] && M.uploads[fid].state === 'error' && /hueco/.test(M.uploads[fid].err), 'la subida no se paró: ' + json(M.uploads[fid]));
    // intercambiar casillas mueve las fotos, no su composición: la marca y el bloqueo van con las fotos
    M._test.swap('r1', 'r4');
    igual((M.plan().find(x => x.slotId === 'r4') || {})['hueco vacío'], [p + 1, j + 1].sort((a, b) => a - b), 'tras intercambiar, plan() no marca el post que tiene las fotos');
    await hasta(() => (M.plan().find(x => x.slotId === 'r4') || {})['hueco vacío'] && !('hueco vacío' in (M.plan().find(x => x.slotId === 'r1') || {})), 4000, 'la marca tras intercambiar las casillas');
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
    await hasta(() => (M.plan().find(x => x.slotId === 'r1') || {})['hueco vacío'], 4000, 'el hueco vacío en plan()');
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
    igual(v >= 5, true, 'versión de IndexedDB');   // 5 por las carpetas; 6 desde la 3.66 (D-082)
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
    // la descarga, interceptada: la batería no deja archivos en Descargas; todo se restaura
    const LS = 'mesa-export-descarga', antes = W.localStorage.getItem(LS);
    let exp;
    try {
      W.localStorage.setItem(LS, '1');             // este navegador descarga: sin diálogo de guardar
      ok(await conDescarga(async () => { exp = await M.exportAll(); }), 'exportar no hizo la descarga');
    } finally { if (antes == null) W.localStorage.removeItem(LS); else W.localStorage.setItem(LS, antes); }
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

  // ---------- mover, copiar y pegar (D-077) ----------
  const conCmd = el => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })); };
  const focoBandeja = () => q('.tray .tbody').dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true }));
  const focoFuera = () => q('.feed').dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true }));
  const teclaMesa = (key, o = {}) => D.body.dispatchEvent(new W.KeyboardEvent('keydown', { key, metaKey: !!o.meta, shiftKey: !!o.shift, bubbles: true, cancelable: true }));
  const titem = f => q(`.tgrid .titem[data-file="${f}"]`), tile = id => q(`.tcarpeta[data-id="${id}"]`);
  const arbolMover = async () => {
    await tablero([pub(1), pub(2)]);
    const r = await ui().subir([
      { path: ['A'], file: await foto('c26-1.jpg', 300, 400) }, { path: ['A'], file: await foto('c26-2.jpg', 300, 400) }, { path: ['A'], file: await foto('c26-3.jpg', 300, 400) },
      { path: ['A', 'Sub'], file: await foto('c26-4.jpg', 300, 400) }, { path: ['B'], file: await foto('c26-5.jpg', 300, 400) },
    ], null, { sinAviso: true });
    ok(r && !r.parada, json(r));
    await M.flush();
    return porNombre();
  };

  prueba('C26', '⌘+clic en la bandeja de la mesa: elige y quita fotos y carpetas, se marcan; un clic sin ⌘ y Esc vacían; solo sigue elegido lo que se ve (D-077, D-051)', async () => {
    const n = await arbolMover();
    await pulsar(`.tcarpeta[data-id="${n['A'].id}"]`);
    const [f1, f2] = n['A'].files;
    conCmd(titem(f1)); conCmd(titem(f2)); conCmd(tile(n['Sub'].id));
    igual(M._in.trayLote(), { files: [f1, f2], carpetas: [n['Sub'].id] }, 'lo elegido');
    igual(qa('.tgrid .elegida').length, 3, 'se marcan');
    ok(!q('.detail:not([hidden])'), '⌘+clic abrió la foto');
    ok(M._in.trayCarpeta === n['A'].id, '⌘+clic entró en la carpeta');
    conCmd(titem(f1));
    igual(M._in.trayLote().files, [f2], '⌘+clic la quita');
    M._in.renderTray();
    igual(qa('.tgrid .elegida').length, 2, 'redibujar pierde la marca');
    teclaMesa('Escape');
    igual(M._in.trayLote(), { files: [], carpetas: [] }, 'Esc');
    conCmd(titem(f1));
    q('.tray .tbody .drop').click();
    igual(M._in.trayLote().files, [], 'un clic sin ⌘');
    conCmd(titem(f1));
    M._in.trayAbrir(null);
    igual(M._in.trayLote().files, [], 'cambiar de vista la deja elegida');
  });

  prueba('C27', 'Mover: fotos y carpetas a una carpeta, a una pestaña o a la raíz; sin bytes nuevos; ⌘Z y ⇧⌘Z; dentro de sí misma no; «Historias» no; las hermanas se juntan y sus pestañas las siguen (D-077)', async () => {
    const n = await arbolMover(), antes = await medida();
    const [f1, f2, f3] = n['A'].files, [f5] = n['B'].files;
    M._in.trayAbrir(n['A'].id);
    M._in.trayMover({ files: [f1, f2] }, n['B'].id);
    igual([carp(n['A'].id).files, carp(n['B'].id).files], [[f3], [f5, f1, f2]], 'a otra carpeta');
    igual(M.board().tray.includes(f1), true, 'board().tray');
    igual(await medida(), antes, 'mover escribió');
    // ⌘Z: un paso
    await M.flush();
    M._test.undo();
    igual([carp(n['A'].id).files.length, carp(n['B'].id).files.length], [3, 1], '⌘Z');
    M._test.redo();
    igual([carp(n['A'].id).files.length, carp(n['B'].id).files.length], [1, 3], '⇧⌘Z');
    await M.flush();
    // a la raíz
    M._in.trayAbrir(n['B'].id);
    M._in.trayMover({ files: [f5] }, null);
    igual(raiz(), [f5], 'a la raíz');
    ok(!carp(n['B'].id).files.includes(f5), 'sigue en la carpeta');
    // de la raíz a una carpeta
    M._in.trayAbrir(null);
    M._in.trayMover({ files: [f5] }, 'historias');
    igual([raiz(), hist().files], [[], [f5]], 'de la raíz a «Historias»');
    // a la raíz estando también en otra: lo dice
    await aCarpeta(n['A'].id, [await foto('c26-5.jpg', 300, 400)]);
    M._in.trayAbrir('historias'); M._in.clearToasts();
    M._in.trayMover({ files: [f5] }, null);
    ok(qa('.toast').some(t => t.textContent.includes('también en otra carpeta')), 'no avisa de que sigue en otra');
    igual(carp(n['A'].id).files.includes(f5), true, 'sigue en la otra');
    // carpetas
    M._in.trayAbrir(n['A'].id);
    M._in.trayMover({ carpetas: [n['Sub'].id] }, n['B'].id);
    igual(carp(n['Sub'].id).parent, n['B'].id, 'una carpeta a otra');
    M._in.trayAbrir(null);
    M._in.trayMover({ carpetas: [n['B'].id] }, n['Sub'].id);
    igual(carp(n['B'].id).parent, null, 'dentro de su hija');
    M._in.trayMover({ carpetas: [n['B'].id] }, n['B'].id);
    igual(carp(n['B'].id).parent, null, 'dentro de sí misma');
    M._in.clearToasts();
    M._in.trayMover({ carpetas: ['historias'] }, n['A'].id);
    igual(hist().parent, null, '«Historias» se movió');
    ok(qa('.toast').some(t => t.textContent.includes('se queda donde está')), 'no lo dice');
    // hermanas con el mismo nombre: se juntan, con sus hijas y sus pestañas
    const x = M.crearCarpeta('Dup', n['A'].id).id, y = M.crearCarpeta('Dup', n['B'].id).id;
    const [p] = await aCarpeta(x, [await foto('c27-p.jpg', 200, 300)]), [s] = await aCarpeta(y, [await foto('c27-s.jpg', 200, 300)]);
    M._in.pestNueva(y);
    M._in.pestIr('fija'); M._in.trayAbrir(n['B'].id);
    M._in.trayMover({ carpetas: [y] }, n['A'].id);
    ok(!carp(y), 'quedan dos con el mismo nombre');
    igual(carp(x).files.sort(), [p, s].sort(), 'juntas');
    igual(M._in.pestLista().find(q2 => q2.carpeta === x).nombre, 'Dup', 'la pestaña sigue a la carpeta');
    igual((await M.informeArchivos()).huerfanos, [], 'huérfanos');
  });

  prueba('C28', 'Copiar y pegar: el mismo archivo en dos carpetas, sin bytes ni repetir; carpetas enteras con sus hijas; ⌘Z; sobrevive a borrar el origen; dentro de sí misma no; a otro cliente no (D-077)', async () => {
    const n = await arbolMover(), [f1, f2] = n['A'].files, antes = await medida();
    M._in.trayCopiar({ files: [f1, f2] });
    M._in.trayPegar(n['B'].id);
    igual(carp(n['B'].id).files.slice(-2), [f1, f2], 'el mismo id');
    igual(carp(n['A'].id).files.includes(f1), true, 'copiar la quitó del origen');
    igual(await medida(), antes, 'copiar escribió');
    M._in.trayPegar(n['B'].id);
    igual(carp(n['B'].id).files.length, 3, 'se repitieron');
    // ⌘Z
    await M.flush();
    M._test.undo();
    igual(carp(n['B'].id).files.length, 1, '⌘Z de pegar');
    M._test.redo();
    igual(carp(n['B'].id).files.length, 3, '⇧⌘Z de pegar');
    await M.flush();
    // carpeta entera
    M._in.trayCopiar({ carpetas: [n['A'].id] });
    M._in.trayPegar(n['B'].id);
    const copia = M.board().carpetas.find(c => c.name === 'A' && c.parent === n['B'].id), hija = M.board().carpetas.find(c => c.name === 'Sub' && c.parent === copia.id);
    ok(copia && hija && copia.id !== n['A'].id, 'la copia y su hija');
    igual([copia.files, hija.files], [n['A'].files, n['Sub'].files], 'sus fotos');
    ok(!copia.fija, 'copia rara');
    igual(await medida(), antes, 'copiar la carpeta escribió');
    // dentro de sí misma: ni de la original en su hija ni en ella
    M._in.clearToasts();
    M._in.trayCopiar({ carpetas: [n['A'].id] });
    const n0 = M.board().carpetas.length;
    M._in.trayPegar(n['A'].id); M._in.trayPegar(n['Sub'].id);
    igual(M.board().carpetas.length, n0, 'se copió dentro de sí misma');
    ok(qa('.toast').some(t => t.textContent.includes('dentro de sí misma')), 'no lo dice');
    // en la raíz: las fotos no; una carpeta sí; «Historias» se copia como carpeta normal
    M._in.trayCopiar({ files: [f1] }); M._in.clearToasts();
    M._in.trayPegar(null);
    ok(!raiz().includes(f1) && qa('.toast').some(t => t.textContent.includes('se pegan en una carpeta')), 'una foto en la raíz');
    M._in.trayCopiar({ carpetas: ['historias'] });
    M._in.trayPegar(n['A'].id);
    const cH = M.board().carpetas.find(c => c.name === 'Historias' && c.parent === n['A'].id);
    ok(cH && !cH.fija && cH.id !== 'historias', 'la copia de «Historias»');
    // de la raíz a una carpeta: pasa a ella
    const [r0] = await M.addFiles([await foto('c28-r.jpg', 200, 300)]);
    M._in.trayCopiar({ files: [r0] }); M._in.trayPegar(n['B'].id);
    igual(raiz().includes(r0), false, 'sigue suelta en la raíz');
    // copiada a «Historias», sobrevive al borrar su origen
    M._in.trayCopiar({ files: [f1] }); M._in.trayPegar('historias');
    const rec = await M._test.fileRec(f1);
    await M.borrarCarpeta(copia.id); await M.borrarCarpeta(n['B'].id); const r = await M.borrarCarpeta(n['A'].id);
    ok(r && r.ok, json(r));
    igual(await M._test.fileRec(f1), rec, 'la de «Historias» tras borrar su origen');
    ok(hist().files.includes(f1), 'salió de «Historias»');
    ok(!(await M._test.fileRec(f2)), 'la otra sigue');
    igual((await M.informeArchivos()).huerfanos, [], 'huérfanos');
    // a otro cliente, nada
    M._in.trayCopiar({ files: [f1] });
    await M.flush();
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [pub(1)], past: [], force: true });
    M._in.clearToasts();
    const r2 = M._in.trayPegar('historias');
    ok(r2.error, 'pegó en otro cliente');
    igual(hist().files, [], 'en la bandeja de otro cliente');
    ok(qa('.toast').some(t => t.textContent.includes('otro cliente')), 'no lo dice');
    ok(!M._in.trayPuedePegar(), 'el menú dejaría pegar');
  });

  prueba('C29', '⌘C / ⌘V solo con lo último pulsado en la bandeja y algo elegido, también en el editor, sin tocar su copiar y pegar (D-077)', async () => {
    const n = await arbolMover(), [f1] = n['A'].files;
    M._in.trayAbrir(n['A'].id);
    conCmd(titem(f1));
    focoFuera();
    teclaMesa('c', { meta: true });
    ok(!M._in.trayClip, 'copió con lo último pulsado fuera');
    focoBandeja();
    teclaMesa('c', { meta: true });
    igual(M._in.trayClip && M._in.trayClip.files, [f1], '⌘C');
    M._in.trayAbrir(n['B'].id);
    focoFuera();
    teclaMesa('v', { meta: true });
    igual(carp(n['B'].id).files.includes(f1), false, 'pegó con lo último pulsado fuera');
    focoBandeja();
    teclaMesa('v', { meta: true });
    igual(carp(n['B'].id).files.includes(f1), true, '⌘V');
    // escribiendo no actúa
    await M.flush();
    await pulsar('[data-act="cp-nueva"]');
    const inp = await hasta(() => q('#cp-nombre'), 2000, 'el campo');
    const antes = carp(n['B'].id).files.length;
    inp.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'v', metaKey: true, bubbles: true, cancelable: true }));
    igual(carp(n['B'].id).files.length, antes, 'actuó escribiendo');
    M._in.closeDetail();
    // ⌘Z de la mesa deshace el pegado hecho con teclas
    M._test.undo();
    igual(carp(n['B'].id).files.includes(f1), false, '⌘Z');
    await M.flush();
    // el editor: con una diapositiva, su ⌘C y su ⌘V siguen siendo suyos
    await abrirEditor('r1');
    if (!ed().trOpen) accion('bandeja');
    accion('sl-add'); await espera(50);
    M._in.trayAbrir(n['A'].id); await espera(30);
    const claveClip = M._in.trayClip;
    focoFuera();
    tecla('c', { meta: true });
    igual(M._in.trayClip, claveClip, '⌘C del editor tocó el portapapeles de la bandeja');
    // ⌘+clic en el cajón y ⌘C con el foco en él
    const box = ed().el.querySelector('.lb-tray');
    box.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true }));
    const mini = await hasta(() => box.querySelector(`.lb-tph[data-f="${n['A'].files[1]}"]`), 2000, 'la miniatura');
    mini.dispatchEvent(new W.MouseEvent('click', { bubbles: true, metaKey: true }));
    tecla('c', { meta: true });
    igual(M._in.trayClip.files, [n['A'].files[1]], '⌘C en el cajón');
    M._in.trayAbrir(n['B'].id); await espera(30);
    box.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true }));
    tecla('v', { meta: true });
    igual(carp(n['B'].id).files.includes(n['A'].files[1]), true, '⌘V en el cajón');
    M.libre.cerrar();
  });

  prueba('C30', 'El clic derecho copia y pega: en una carpeta, en una foto y en un hueco de la bandeja; con la selección si se pulsa en ella (D-077)', async () => {
    const n = await arbolMover(), [f1, f2] = n['A'].files;
    await pulsar(`.tcarpeta[data-id="${n['A'].id}"]`);
    let m = clicDerecho(titem(f1));
    igual([...m.querySelectorAll('button')].map(b => b.childNodes[0].textContent), ['Copiar', 'Pegar'], 'el menú de una foto');
    ok(itemMenu('Pegar').disabled, 'pegar sin nada copiado');
    itemMenu('Copiar').click();
    igual(M._in.trayClip.files, [f1], 'copiar una foto');
    // con selección: si se pulsa en ella, toda; si no, solo esa
    conCmd(titem(f1)); conCmd(titem(f2));
    clicDerecho(titem(f2)); itemMenu('Copiar').click();
    igual(M._in.trayClip.files, [f1, f2], 'copiar lo elegido');
    M._in.traySoltar();
    await pulsar('.cpvolver');
    m = clicDerecho(tile(n['B'].id));
    ok(!itemMenu('Pegar').disabled && !itemMenu('Copiar').disabled, 'apagados');
    itemMenu('Pegar').click();
    igual(carp(n['B'].id).files.slice(-2), [f1, f2], 'pegar sobre una carpeta');
    igual(M._in.trayCarpeta, null, 'pegar cambió de vista');
    clicDerecho(tile(n['A'].id)); itemMenu('Copiar').click();
    igual(M._in.trayClip.carpetas, [n['A'].id], 'copiar una carpeta');
    await pulsar(`.tcarpeta[data-id="${n['B'].id}"]`);
    const hueco = q('.tray .tbody .drop');
    clicDerecho(hueco);
    igual([...q('.cpmenu').querySelectorAll('button')].map(b => b.childNodes[0].textContent), ['Pegar'], 'el menú de un hueco');
    itemMenu('Pegar').click();
    ok(M.board().carpetas.find(c => c.name === 'A' && c.parent === n['B'].id), 'pegar en un hueco');
    // sin nada copiado, en un hueco sigue el del navegador
    await M.flush();
    M._in.trayAbrir(null);
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [pub(1)], past: [], force: true });
    clicDerecho(q('.tray .tbody .drop'));
    ok(!q('.cpmenu'), 'en otro cliente saca el menú de pegar');
  });

  prueba('C31', 'Las fotos de carpeta van a publicaciones como las de la raíz: D-022 avisa, varias soltadas entran, una historia la usa con anillo y una colab la devuelve a su cliente y a su carpeta (D-069, D-077)', async () => {
    const col = { id: 'c31', name: 'COLLAB Noviembre 1', type: 'Foto', date: `${MES}-20T12:00:00.000+01:00` };
    await tablero([pub(1), pub(2), pub(3, 'Carrusel'), col]);
    const c = M.crearCarpeta('Usos').id;
    const fC = await foto('c31-a.jpg');
    const [a, b, d, e, g] = await aCarpeta(c, [fC, await foto('c31-b.jpg'), await foto('c31-c.jpg'), await foto('c31-d.jpg'), await foto('c31-e.jpg')]);
    M._in.trayAbrir(c);
    // D-022: ya usada avisa y pregunta
    M._test.place('r1', a);
    const p = M._test.addToSlot('r2', [a]);
    const h = await hasta(() => { const x = dialogo(); return x && x.querySelector('[data-act="repe"][data-m="usar"]') && x; }, 4000, 'el aviso de D-022');
    ok(/este mes/i.test(h.textContent), 'el aviso no dice su uso: ' + h.textContent);
    h.querySelector('.btn2[data-act="close"], [data-act="close"]').click();
    await espera(50); await p;
    igual(slot('r2').photos, [], 'cancelar');
    igual(M._in.bandejaVista({ carpeta: c, todas: true }).find(x => x.f === a).u, true, 'con ✓ en su carpeta');
    // volver a subir esa misma foto a una publicación también avisa
    const pr = M.addFiles([fC], 'r2');
    const h2 = await hasta(() => { const x = dialogo(); return x && x.querySelector('[data-act="repe"][data-m="usar"]') && x; }, 4000, 'el aviso al soltarla');
    h2.querySelector('[data-act="repe"][data-m="usar"]').click();
    await pr;
    igual(slot('r2').photos.length, 1, '«Usar igualmente»');
    // varias a un carrusel, con el lote de la mesa
    M._test.addToSlot('r3', [b, d]);
    await hasta(() => { const x = dialogo(); return slot('r3').photos.length === 2 || (x && x.querySelector('[data-act="addmode"]')); }, 3000, 'que entren');
    igual(slot('r3').photos, [b, d], 'varias en un carrusel');
    ok(!M.board().tray.includes(b), 'usada en board().tray');
    igual(carp(c).files.includes(b), true, 'salió de su carpeta');
    // historia: el anillo y borrar la carpeta la deja en la raíz
    const hid = M.hs.anadir(`${MES}-21`); M._in.S.historias.find(x => x.id === hid).libre = { slides: { r0: { els: [{ id: 'e1', t: 'foto', src: e }] } } }; M._in.save();
    await M.flush();
    await hasta(() => M._in.bandejaVista({ carpeta: c, todas: false }).find(x => x.f === e && x.h), 4000, 'el anillo de la historia');
    igual(M._in.bandejaVista({ carpeta: c, todas: false }).some(x => x.f === e), true, 'la de la historia sale de «Sin usar»');
    // colab: de la carpeta a la publicación compartida; vuelve a su cliente y a su carpeta
    M._test.place('c31', g);
    await M.flush();
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [pub(9), col], past: [], force: true });
    igual(slot('c31').photos, [g], 'la colab en el otro cliente');
    M._test.unassign('c31');
    await M.flush();
    await M.open(`${CLIENTE}-${MES}`);
    ok(M.board().tray.includes(g), 'no volvió a su cliente');
    igual(M._in.bandejaVista({ carpeta: c, todas: false }).some(x => x.f === g), true, 'no volvió a su carpeta');
    igual(raiz().includes(g), false, 'salió suelta en la raíz');
  });

  prueba('C32', '⌘+clic del editor con fotos de carpeta: se eligen y se arrastran juntas a sus huecos, y mover desde el cajón va en la misma bandeja (D-051, D-077)', async () => {
    const [a, b, c2] = await conHuecos([HV('v1'), HV('v2', 0.5)], [V('c32a.jpg'), V('c32b.jpg'), V('c32c.jpg')]);
    const cid = M.crearCarpeta('En cajón').id;
    M._in.trayMover({ files: [a, b, c2] }, cid, null);
    M._in.trayAbrir(cid);
    await hasta(() => miniatura(a), 2000, 'la miniatura de la carpeta');
    conMeta(a); conMeta(b);
    igual(elegidas(), [a, b], '⌘+clic con fotos de carpeta');
    arrastrarDeBandeja(a, 0.2, 0.5);
    await hasta(() => (enCapa('v1', a) || enCapa('v2', a)) && (enCapa('v1', b) || enCapa('v2', b)), 4000, 'las dos a sus huecos');
    ok(carp(cid).files.includes(a) && carp(cid).files.includes(c2), 'salieron de su carpeta');
    M.libre.cerrar();
  });

  prueba('C33', 'En una ventana estrecha, una vista con solo carpetas no cuenta como vacía: las carpetas se ven y se puede entrar (D-075)', async () => {
    const n = await arbolMover(), fr = $('mesa'), w0 = fr.style.width;
    fr.style.width = '580px';
    try {
      await hasta(() => W.innerWidth <= 720, 2000, 'la ventana estrecha');
      M._in.renderTray();
      ok(!q('.tray').classList.contains('isempty'), 'con carpetas cuenta como vacía');
      const t = tile(n['A'].id);
      ok(t.getBoundingClientRect().height > 30 && t.getBoundingClientRect().width > 30, 'la carpeta no se ve');
      await pulsar(`.tcarpeta[data-id="${n['A'].id}"]`);
      igual(M._in.trayCarpeta, n['A'].id, 'no entra');
      M._in.trayAbrir(M.crearCarpeta('Vacía').id);
      ok(q('.tray').classList.contains('isempty') && W.getComputedStyle(q('.tray .drop')).display !== 'none', 'una carpeta vacía no invita a soltar');
      M._in.trayAbrir(null);
    } finally { fr.style.width = w0; }
  });

  // ---------- descargar fotos (D-083) ----------
  const clicCelda = (id, meta) => celda(id).dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: !!meta }));
  const ventanaDl = () => q('.detail:not([hidden])[data-dlg="descargar"] .card');
  // la descarga, interceptada: {name, blob}; todo se restaura
  async function conDescarga(fn) {
    const A = W.HTMLAnchorElement.prototype, click = A.click; let cap = null;
    A.click = function () { if (this.download) cap = { name: this.download, href: this.href }; else click.call(this); };
    try { await fn(() => cap); } finally { A.click = click; }
    return cap ? { name: cap.name, blob: await (await W.fetch(cap.href)).blob() } : null;
  }
  async function descargarYa(opts = {}) {
    const d = await hasta(() => ventanaDl(), 3000, 'la ventana de descarga');
    if (opts.txt) d.querySelector(`input[name="dl-txt"][value="${opts.txt}"]`).click();
    if (opts.res) d.querySelector(`input[name="dl-res"][value="${opts.res}"]`).click();
    return conDescarga(async cap => { d.querySelector('[data-dl="ir"]').click(); await hasta(() => cap() || !ventanaDl(), 60000, 'la descarga'); await hasta(() => cap(), 3000, 'el archivo'); });
  }
  // un ZIP leído a mano: entradas {name, data, crc} por sus cabeceras locales, y el número del directorio final
  async function leerZip(blob) {
    const b = new Uint8Array(await blob.arrayBuffer()), v = new DataView(b.buffer), out = [], dec = new TextDecoder();
    let o = 0;
    while (v.getUint32(o, true) === 0x04034b50) {
      const crc = v.getUint32(o + 14, true), sz = v.getUint32(o + 18, true), n = v.getUint16(o + 26, true), x = v.getUint16(o + 28, true);
      igual([v.getUint16(o + 8, true), v.getUint32(o + 22, true)], [0, sz], 'una entrada comprimida');
      out.push({ name: dec.decode(b.subarray(o + 30, o + 30 + n)), data: b.slice(o + 30 + n + x, o + 30 + n + x + sz), crc });
      o += 30 + n + x + sz;
    }
    const e = b.length - 22; igual(v.getUint32(e, true), 0x06054b50, 'el final del ZIP');
    igual(v.getUint16(e + 10, true), out.length, 'las entradas del directorio central');
    for (const f of out) igual(await M.descargar._crc32(new W.Blob([f.data])), f.crc, 'el CRC de ' + f.name);
    return out;
  }
  const anchoDe = async data => { const bm = await W.createImageBitmap(new W.Blob([data], { type: 'image/jpeg' })); const r = [bm.width, bm.height]; bm.close(); return r; };

  prueba('B1', '⌘+clic en una casilla la elige o la quita sin abrirla; un clic sin ⌘, Esc u otro mes vacían la selección; «Descargar (n)» sale en la barra (D-083, D-077)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4)]);
    await hasta(() => M.descargar, 4000, 'descargar.js');
    await poner('r1', [await foto('b1-a.jpg')]); await poner('r2', [await foto('b1-b.jpg')]); await poner('r3', [await foto('b1-c.jpg')]);
    // antes, ⌘+clic solo actuaba en la bandeja: una casilla se abría
    clicCelda('r1', true);
    ok(!dialogo(), '⌘+clic abrió la publicación');
    ok(celda('r1').classList.contains('dlsel'), 'la casilla elegida no se marca');
    ok(+W.getComputedStyle(celda('r1'), '::before').zIndex < +W.getComputedStyle(q('.detail')).zIndex, 'el marco de la elegida queda por encima de las ventanas');
    clicCelda('r3', true);
    igual(M.descargar.elegidas(), ['r1', 'r3'], 'las elegidas');
    igual(q('.bar [data-dl="abrir"]').textContent, 'Descargar (2)', 'el botón de la barra');
    clicCelda('r3', true);
    igual(M.descargar.elegidas(), ['r1'], '⌘+clic otra vez no la quita');
    ok(!celda('r3').classList.contains('dlsel'), 'la quitada sigue marcada');
    clicCelda('r4', true);
    igual(M.descargar.elegidas(), ['r1'], 'una publicación sin foto entra en la selección');
    // la marca sigue tras redibujar la cuadrícula
    M._in.renderFeed(); ok(celda('r1').classList.contains('dlsel'), 'redibujada, la casilla pierde su marca');
    // Esc la vacía
    tecla('Escape'); await espera(30);
    igual(M.descargar.elegidas(), [], 'Esc no vacía la selección');
    ok(!q('.bar [data-dl="abrir"]'), 'sin nada elegido sigue el botón');
    // un clic sin ⌘ hace lo de siempre y la vacía
    clicCelda('r1', true); clicCelda('r2', true);
    clicCelda('r2');
    await hasta(() => dialogo() && !q('.detail[data-dlg]'), 3000, 'la publicación abierta con un clic');
    igual(M.descargar.elegidas(), [], 'un clic sin ⌘ no vacía la selección');
    M._in.closeDetail();
    // la bandeja sigue eligiendo con ⌘+clic (D-077)
    const [f] = await M.addFiles([await foto('b1-d.jpg')]);
    await espera(50);
    const t = await hasta(() => q(`.tray .titem[data-file="${f}"]`), 3000, 'la foto en la bandeja');
    t.dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
    ok(q(`.tray .titem[data-file="${f}"]`).classList.contains('elegida'), '⌘+clic en la bandeja dejó de elegir');
    igual(M.descargar.elegidas(), [], 'un ⌘+clic en la bandeja eligió una casilla');
    // otro mes vacía la selección
    clicCelda('r1', true); igual(M.descargar.elegidas(), ['r1'], 'elegida otra vez');
    await M.init({ client: CLIENTE, clientName: NOMBRE, month: '2026-12', slots: [pub(1, 'Foto', 3, '2026-12')], past: [], force: true });
    igual(M.descargar.elegidas(), [], 'otro mes conserva la selección');
    await M.purge(`${CLIENTE}-2026-12`);
  });

  prueba('B2', 'La ventana de descarga: por fecha, de la más cercana a hoy a la más lejana; cada pieza en miniatura y marcada; de un reel, su portada; desmarcar cambia la cuenta (D-083)', async () => {
    await tablero([pub(1, 'Carrusel', 25), pub(2, 'Reel', 4), pub(3, 'Foto', 14)]);
    await hasta(() => M.descargar, 4000, 'descargar.js');
    await poner('r1', [await foto('b2-a.jpg'), await foto('b2-b.jpg'), await foto('b2-c.jpg')]);
    await poner('r2', [await foto('b2-d.jpg', 1080, 1920)]);
    await poner('r3', [await foto('b2-e.jpg')]);
    ['r1', 'r2', 'r3'].forEach(id => clicCelda(id, true));
    q('.bar [data-dl="abrir"]').click();
    const d = await hasta(() => ventanaDl(), 3000, 'la ventana');
    const lejos = id => Math.abs(Date.parse(slot(id).date) - Date.now());
    igual(qa('.dl-post').map(x => x.dataset.slot), ['r1', 'r2', 'r3'].sort((a, b) => lejos(a) - lejos(b)), 'el orden de las publicaciones');
    igual(qa('.dl-post[data-slot="r1"] .dl-pz input').map(i => i.checked), [true, true, true], 'las piezas del carrusel');
    igual(qa('.dl-post[data-slot="r2"] .dl-pz').map(x => x.textContent.trim()), ['Portada'], 'la pieza del reel');
    ok(qa('.dl-pz img').every(i => i.getAttribute('src')), 'una miniatura sin imagen');
    igual([d.querySelector('input[name="dl-txt"]:checked').value, d.querySelector('input[name="dl-res"]:checked').value], ['con', 'orig'], 'las opciones de partida');
    igual(qa('.dl-op .dl-ch span').map(x => x.textContent), ['Con textos', 'Solo la foto', 'Original', '1440', '1080'], 'las opciones');
    igual(q('.dl-res').textContent, '5 piezas · cliente-de-prueba-2026-11.zip', 'la cuenta');
    ok(q('.dl-prog').offsetParent === null, 'la barra de progreso se ve antes de descargar');
    q('.dl-post[data-slot="r1"] [data-dl="todas"]').click();
    igual(q('.dl-res').textContent, '2 piezas · cliente-de-prueba-2026-11.zip', '«Ninguna» no desmarca el carrusel');
    q('.dl-post[data-slot="r3"] .dl-pz input').click();
    igual(q('.dl-res').textContent, '1 pieza · un JPG', 'desmarcar una pieza');
    q('.dl-post[data-slot="r2"] .dl-pz input').click();
    ok(q('[data-dl="ir"]').disabled, 'sin nada marcado se puede descargar');
    M._in.closeDetail();
  });

  prueba('B3', 'Varias piezas van en un ZIP «cliente-AAAA-MM» sin compresión: nombres por fecha, publicación y pieza; el número de archivos; cada ancho (Original, 1440, 1080) (D-083)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Reel')]);
    await hasta(() => M.descargar, 4000, 'descargar.js');
    await poner('r1', [await foto('b3-a.jpg', 2000, 2500), await foto('b3-b.jpg', 2000, 2500)]);
    await poner('r2', [await foto('b3-c.jpg', 3000, 2000)]);   // la portada de un reel: 9:16 de una horizontal
    clicCelda('r1', true); clicCelda('r2', true);
    for (const [res, anchos] of [['orig', [2000, 2000, 1125]], ['1440', [1440, 1440, 1440]], ['1080', [1080, 1080, 1080]]]) {
      q('.bar [data-dl="abrir"]').click();
      const z = await descargarYa({ res });
      igual(z && z.name, 'cliente-de-prueba-2026-11.zip', 'el nombre del ZIP');
      const e = await leerZip(z.blob);
      const d1 = M._in.localDay(slot('r1').date), d2 = M._in.localDay(slot('r2').date);
      igual(e.map(x => x.name).sort(), [`${d1}_Carrusel-1.1_01.jpg`, `${d1}_Carrusel-1.1_02.jpg`, `${d2}_Reel-1.2_01.jpg`].sort(), 'los nombres de los archivos');
      const dims = {}; for (const x of e) dims[x.name] = await anchoDe(x.data);
      igual(e.map(x => dims[x.name][0]).sort((a, b) => b - a), anchos.slice().sort((a, b) => b - a), `los anchos con ${res}`);
      const reel = dims[`${d2}_Reel-1.2_01.jpg`]; cerca(reel[0] / reel[1], 9 / 16, 0.01, 'la portada del reel no sale en 9:16');
      igual(M.descargar.ultimo.piezas.length, 3, 'el número de piezas');
      ok(!ventanaDl(), 'la ventana no se cerró al terminar');
    }
    igual(M.descargar.elegidas(), ['r1', 'r2'], 'descargar vacía la selección');
  });

  prueba('B4', 'Una sola pieza se descarga como JPG con su nombre; en Original y sin recorte, el mismo archivo; «Solo la foto» quita textos y logos de una diapositiva del editor; Original de una diapositiva = lo que da su foto (D-083)', async () => {
    await tablero([pub(1), pub(2, 'Carrusel')]);
    await hasta(() => M.descargar, 4000, 'descargar.js');
    const orig = await foto('b4-a.jpg', 1200, 1500);
    const [f] = await poner('r1', [orig]);
    clicCelda('r1', true);
    q('.bar [data-dl="abrir"]').click();
    const j = await descargarYa();
    igual(j.name, `${M._in.localDay(slot('r1').date)}_Foto-1.1_01.jpg`, 'el nombre del JPG');
    ok(await bytesIguales(j.blob, orig), 'en Original y sin recorte no es el mismo archivo');
    // una diapositiva del editor con un texto: con y sin textos
    await poner('r2', [await foto('b4-b.jpg', 1600, 2000, '#20262c')]);
    await abrirEditor('r2');
    accion('add-txt');
    const t = compDe(0).els.find(e => e.t === 'texto'); Object.assign(t, { txt: 'TEXTO GRANDE', size: 0.12, color: '#ffffff', y: 0.42 });
    await aplicarEditor();
    const s = slot('r2'), fid = s.photos[0];
    ok(M._in.lComp(s, fid), 'la diapositiva no quedó en el editor');
    const con = await M.descargar._pieza(s, fid, { textos: true, ancho: '1080' }), sin = await M.descargar._pieza(s, fid, { textos: false, ancho: '1080' });
    const px = async b => { const bm = await W.createImageBitmap(b), c = D.createElement('canvas'); c.width = 108; c.height = Math.round(108 * bm.height / bm.width); const x = c.getContext('2d'); x.drawImage(bm, 0, 0, c.width, c.height); bm.close(); return x.getImageData(0, 0, c.width, c.height).data; };
    const dif = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) n += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return n / (a.length / 4); };
    const [pc, ps] = [await px(con.blob), await px(sin.blob)];
    ok(dif(pc, ps) > 2, 'con y sin textos salen iguales: ' + dif(pc, ps).toFixed(2));
    igual([con.w, sin.w], [1080, 1080], 'el ancho pedido');
    const sinT = { ...M._in.lComp(s, fid), els: M._in.lComp(s, fid).els.filter(e => e.t !== 'texto' && e.t !== 'logo') };
    ok(dif(ps, await px(await M.libre.pieza(sinT, 1080, 1350))) < 1.5, '«Solo la foto» no es la diapositiva sin textos ni logos');
    // Original de una diapositiva: el ancho al que su foto se dibuja 1:1 (la foto de 1600 a sangre)
    const o = await M.descargar._pieza(s, fid, { textos: true, ancho: 'orig' });
    igual(o.w, 1600, 'el ancho Original de la diapositiva');
    igual((await anchoDe(new Uint8Array(await o.blob.arrayBuffer())))[0], 1600, 'el JPEG Original de la diapositiva');
  });

  prueba('B5', 'Con una foto de 24 MP: una pieza cada vez, con barra de progreso, sin colgar la página; Original sin ampliar (D-083)', async () => {
    await tablero([pub(1, 'Reel'), pub(2)]);
    await hasta(() => M.descargar, 4000, 'descargar.js');
    await poner('r1', [await foto('b5-24mp.jpg', 6000, 4000, '#6d5a43')]);
    await poner('r2', [await foto('b5-b.jpg', 4000, 6000, '#2f4b3a')]);
    clicCelda('r1', true); clicCelda('r2', true);
    q('.bar [data-dl="abrir"]').click();
    const d = await hasta(() => ventanaDl(), 3000, 'la ventana');
    let hueco = 0, t = performance.now(), visto = false;
    const iv = W.setInterval(() => { const n = performance.now(); hueco = Math.max(hueco, n - t); t = n; const p = q('.dl-prog'); if (p && !p.hidden && /Pieza \d de 2/.test(p.textContent)) visto = true; }, 30);
    let z;
    try { z = await descargarYa(); } finally { W.clearInterval(iv); }
    ok(visto, 'no se vio la barra de progreso');
    ok(hueco < 2500, `la página se colgó ${Math.round(hueco)} ms`);
    const e = await leerZip(z.blob), dims = await Promise.all(e.map(x => anchoDe(x.data)));
    igual(dims.map(x => x.join('×')).sort(), ['2250×4000', '4000×5000'].sort(), 'Original: la portada 9:16 de la de 24 MP y la 4:5 de la vertical, sin ampliar');
  });

  prueba('B6', 'Cancelar a media descarga no guarda nada (D-083)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await hasta(() => M.descargar, 4000, 'descargar.js');
    await poner('r1', [await foto('b6-a.jpg', 3000, 3750), await foto('b6-b.jpg', 3000, 3750), await foto('b6-c.jpg', 3000, 3750), await foto('b6-d.jpg', 3000, 3750)]);
    clicCelda('r1', true);
    q('.bar [data-dl="abrir"]').click();
    const d = await hasta(() => ventanaDl(), 3000, 'la ventana');
    d.querySelector('input[name="dl-res"][value="1080"]').click();
    const C = W.HTMLCanvasElement.prototype, toBlob = C.toBlob;   // cada pieza tarda medio segundo: da tiempo a cancelar
    C.toBlob = function (cb, ...a) { toBlob.call(this, b => setTimeout(() => cb(b), 500), ...a); };
    const r = await conDescarga(async cap => {
      d.querySelector('[data-dl="ir"]').click();
      await hasta(() => /Pieza 2 de 4/.test(q('.dl-pt') ? q('.dl-pt').textContent : ''), 20000, 'la segunda pieza');
      d.querySelector('.form [data-act="close"]').click();
      await espera(2500);
      ok(!cap(), 'se descargó tras cancelar');
    }).finally(() => { C.toBlob = toBlob; });
    igual(r, null, 'se guardó un archivo');
    ok(qa('.toast').some(x => /cancelada/.test(x.textContent)), 'no se avisa de la cancelación');
  });

  // =====================================================================================================
  // Pasos del mes: la barra del calendario (D-084)
  // =====================================================================================================
  const pasoAct = () => { const e = q('.side > .cal .cleg .cpaso.act'); return e ? e.textContent : null; };
  const pasoDe = () => M._in.pasoDe(M._in.S);
  const est = ids => ids.map(id => M._in.estadoDe(slot(id)));
  const nm = id => M._in.shortLabel(slot(id).name, slot(id).type);
  const lis = d => [...d.querySelectorAll(':scope > .cplist li')].map(li => li.textContent);
  const ponerPaso = k => { M._in.S.pasos = { ...(M._in.S.pasos || {}), [M._in.S.month]: k }; M._in.changed(); };
  const pasoGuardado = (m = MES) => (M.board().pasos || {})[m];   // el paso guardado de ese mes del tablero (D-119)
  // pulsa el paso k en la barra y espera su confirmación (la tarjeta)
  async function pulsarPaso(k, ms = 3000) {
    const b = await hasta(() => q(`.side > .cal .cleg button.cpaso[data-paso="${k}"]`), 3000, `el paso ${k} en la barra`);
    b.click();
    return hasta(() => q('.detail:not([hidden])[data-dlg="paso"] .card'), ms, 'la confirmación del paso');
  }
  // pulsa el paso k cuando no hay nada que avisar: cambia directo, sin ventana (D-085)
  async function pasoDirecto(k, ms = 3000) {
    const b = await hasta(() => q(`.side > .cal .cleg button.cpaso[data-paso="${k}"]`), 3000, `el paso ${k} en la barra`);
    b.click();
    await hasta(() => M._in.pasoDe(M._in.S, b.dataset.mes) === k, ms, `el mes en ${k}`);   // el mes de esa barra (D-119)
    await espera(60);
    ok(!dialogo(), 'salió una ventana sin nada que avisar: ' + (dialogo() || {}).textContent);
  }
  const aceptarPaso = d => d.querySelector('[data-cal="paso-ok"]').click();

  prueba('P1', 'La leyenda del calendario es la barra de pasos: el actual en una pastilla negra, el siguiente se pulsa, los hechos vuelven y los posteriores no; No aprobado y Cancelado aparte, sin pulsar; un mes nuevo empieza en Por empezar; nada en «Vista cliente» (D-084)', async () => {
    await tablero([pub(1), pub(2), pub(3)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    igual(pasoGuardado(), 'empezar', 'un mes nuevo no empieza en Por empezar');
    await hasta(() => pasoAct() === 'Por empezar', 3000, 'Por empezar como paso actual');
    igual(qa('.side > .cal .cleg .cpaso').map(e => e.textContent), ['Por empezar', 'Captions', 'Por aprobar', 'Aprobado', 'Programado', 'Publicado'], 'los pasos');
    igual(qa('.side > .cal .cleg .cpaso > i').map(e => e.className), ['edot e-empezar', 'edot e-captions', 'edot e-aprobar', 'edot e-aprobado', 'eico e-programado', 'eico e-publicado'], 'las marcas de los pasos');
    igual(qa('.side > .cal .cleg .cextra > span').map(e => e.textContent), ['No aprobado', 'Cancelado'], 'No aprobado y Cancelado aparte');
    ok(!q('.side > .cal .cleg .cextra button'), 'No aprobado o Cancelado se pulsan');
    igual(qa('.side > .cal .cleg button.cpaso').map(e => e.dataset.paso), ['captions'], 'solo se pulsa el siguiente');
    igual(W.getComputedStyle(q('.side > .cal .cpaso.act')).backgroundColor, 'rgb(38, 38, 38)', 'el actual no va en una pastilla negra');
    ponerPaso('aprobado');
    await hasta(() => pasoAct() === 'Aprobado', 3000, 'Aprobado como paso actual');
    igual(qa('.side > .cal .cleg button.cpaso').map(e => [e.dataset.paso, e.classList.contains('sig') ? 'siguiente' : 'hecho']), [['empezar', 'hecho'], ['captions', 'hecho'], ['aprobar', 'hecho'], ['programado', 'siguiente']], 'los hechos y el siguiente');
    igual(qa('.side > .cal .cleg .cpaso.fut').map(e => e.textContent), ['Publicado'], 'los posteriores');
    q('.side > .cal .cpaso.fut').click(); await espera(60);
    ok(!dialogo(), 'un paso posterior abrió algo');
    M._in.root().classList.add('client');
    try { igual(W.getComputedStyle(q('.side > .cal .cleg')).display, 'none', 'la barra sale en «Vista cliente»'); } finally { M._in.root().classList.remove('client'); }
  });

  prueba('P2', 'Un mes guardado sin paso (antes de la 3.68) enseña el de su publicación más atrasada, sin contar canceladas y con No aprobado como Por aprobar; se guarda la primera vez que se cambia (D-084)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    await porAprobar(['r1', 'r2', 'r3'], 'p2');
    delete M._in.S.pasos; M._in.changed(); await M.flush();
    const key = `${CLIENTE}-${MES}`;
    await M.open(key);
    ok(!('pasos' in M.board()) && !('paso' in M.board()), 'abrir el mes le puso un paso');
    igual(pasoDe(), 'empezar', 'con una publicación en Por empezar');
    M.setEstado('r4', 'cancelado');
    igual(pasoDe(), 'aprobar', 'cuenta una cancelada');
    M.setEstado('r1', 'noaprobado');
    igual(pasoDe(), 'aprobar', 'No aprobado no cuenta como Por aprobar');
    M.setEstado(['r2', 'r3'], 'aprobado'); M.setEstado('r1', null); M.setEstado('r1', 'aprobado');
    igual(pasoDe(), 'aprobado', 'todas aprobadas');
    M.setEstado('r1', 'publicado');
    igual(pasoDe(), 'aprobado', 'no manda la más atrasada');
    await hasta(() => pasoAct() === 'Aprobado', 3000, 'Aprobado en la barra');
    ok(!('pasos' in M.board()), 'cambiar publicaciones le puso un paso');
    await pasoDirecto('programado');   // las aprobadas pasan y no queda nada atrás: sin ventana (D-087)
    await hasta(() => pasoGuardado() === 'programado', 3000, 'el paso guardado en el tablero');
    await M.flush(); await M.open(key);
    igual(pasoGuardado(), 'programado', 'el paso no vuelve al abrir el mes');
  });

  prueba('P3', 'Pasar a Captions con publicaciones sin foto: la ventana las lista como atrasadas, con el motivo (el contexto no cuenta, D-086); Cancelar, la × y Esc no cambian nada; aceptar es un paso de ⌘Z (D-084, D-085)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    await poner('r1', [await foto('p3-a.jpg')]); M._test.setNote('r1', 'Contexto');
    await poner('r2', [await foto('p3-b.jpg')]);
    M._test.setNote('r3', 'Contexto');
    await M.flush();
    const ids = ['r1', 'r2', 'r3', 'r4'], antes = est(ids), h0 = M._test.hist().undo;
    igual(antes, ['captions', 'captions', 'empezar', 'empezar'], 'los estados de partida');
    const cierres = [d => d.querySelector('.form [data-act="close"]').click(), d => d.querySelector('.x[data-act="close"]').click(), () => tecla('Escape')];
    for (const cierra of cierres) {
      const d = await pulsarPaso('captions');
      igual(d.querySelector('h3').textContent, 'Pasar a Captions', 'el título');
      ok(/2 tienen foto\.2 se quedan atrás:/.test(d.textContent), 'las cifras: ' + d.textContent);
      igual(lis(d), [`${nm('r3')} · sin foto`, `${nm('r4')} · sin foto`], 'las que se quedan');
      igual(W.document.activeElement, d.querySelector('[data-cal="paso-ok"]'), 'el foco no está en «Pasar a Captions»');
      cierra(d); await espera(60);
      ok(!dialogo(), 'la confirmación sigue abierta');
      igual(pasoDe(), 'empezar', 'cancelar cambió el paso');
    }
    await M.flush();
    igual(M._test.hist().undo, h0, 'cancelar dejó un paso de ⌘Z');
    igual(est(ids), antes, 'cancelar cambió publicaciones');
    aceptarPaso(await pulsarPaso('captions'));
    await hasta(() => pasoAct() === 'Captions', 3000, 'Captions en la barra');
    ok(!dialogo(), 'la confirmación sigue abierta tras aceptar');
    igual(est(ids), antes, 'pasar a Captions cambió publicaciones');
    await M.flush();
    igual(M._test.hist().undo, h0 + 1, 'no es un paso de ⌘Z');
    M._test.undo(); igual(pasoDe(), 'empezar', '⌘Z no devolvió el paso');
    M._test.redo(); igual(pasoDe(), 'captions', '⇧⌘Z no lo rehízo');
  });

  prueba('P4', 'Pasar a Por aprobar espera a «Revisar» (con las historias) y enseña sus puntos en la ventana; lo que bloquea no impide pasar; las que no tienen caption elegido se listan y se quedan (D-084, D-085, D-040, D-058)', async () => {
    await tablero([pub(1), pub(2), pub(3)]);
    await hasta(() => M.calendario && M.revisar && M.hs && M.libre, 6000, 'calendario.js, revisar.js, historias.js y libre.js');
    await porAprobar(['r1'], 'p4');
    await poner('r2', [await foto('p4-chica.jpg', 800, 1000)]); M._test.setNote('r2', 'Contexto');   // menos de 1080 px: un aviso
    M.hs.anadir(DIA(9), { time: '10:00' });                                                            // una historia sin diseñar: bloquea
    ponerPaso('captions');
    const d = await pulsarPaso('aprobar', 20000);
    ok(/1 publicación con su caption elegido/.test(d.textContent), 'las cifras: ' + d.textContent);
    igual(lis(d), [`${nm('r2')} · sin caption elegido`, `${nm('r3')} · sin foto`], 'las que se quedan');
    const rv = d.querySelector('.cprv');
    ok(rv && /Revisar:/.test(rv.textContent), 'la ventana salió sin los puntos de «Revisar»: ' + d.textContent);
    ok(/1 punto bloquea/.test(rv.textContent) && /aviso/.test(rv.textContent), 'el resumen de «Revisar»: ' + rv.textContent);
    ok(/historia/.test(rv.textContent) && /diseñ/i.test(rv.textContent), 'falta la historia sin diseñar: ' + rv.textContent);
    ok(rv.textContent.includes(nm('r2')) || rv.textContent.includes(slot('r2').name), 'falta la foto pequeña: ' + rv.textContent);
    ok(rv.querySelector('.cpb'), 'lo que bloquea no va en rojo');
    aceptarPaso(d);
    await hasta(() => pasoAct() === 'Por aprobar', 3000, 'Por aprobar en la barra');
    igual(est(['r1', 'r2', 'r3']), ['aprobar', 'captions', 'empezar'], 'las publicaciones cambiaron');
  });

  prueba('P5', 'Pasar a Aprobado: las Por aprobar pasan a Aprobado; las atrasadas y la No aprobada se listan con su motivo y se quedan; el paso y las aprobadas son un solo paso de ⌘Z (D-084, D-085)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4), pub(5), pub(6), pub(7)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    await porAprobar(['r1', 'r2', 'r3', 'r4', 'r7'], 'p5');
    M.setEstado('r4', 'noaprobado'); M.setEstado('r7', 'aprobado');
    await poner('r5', [await foto('p5-e.jpg')]); M._test.setNote('r5', 'Contexto');   // Captions
    ponerPaso('aprobar'); await M.flush();
    const ids = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'], h0 = M._test.hist().undo;
    const d = await pulsarPaso('aprobado');
    ok(new RegExp(`^3 publicaciones pasan a Aprobado: ${nm('r1')}, ${nm('r2')}, ${nm('r3')}\\.$`).test(d.querySelector('.xwhat').textContent), 'lo que cambia: ' + d.textContent);
    igual(lis(d), [`${nm('r4')} · No aprobado`, `${nm('r5')} · sin caption elegido`, `${nm('r6')} · sin foto`], 'las que se quedan');
    aceptarPaso(d);
    await hasta(() => pasoAct() === 'Aprobado', 3000, 'Aprobado en la barra');
    igual(est(ids), ['aprobado', 'aprobado', 'aprobado', 'noaprobado', 'captions', 'empezar', 'aprobado'], 'los estados tras pasar');
    ok(qa('.toast').some(t => /3 publicaciones pasan a Aprobado/.test(t.textContent)), 'el aviso no dice cuántas pasan');
    await M.flush();
    igual(M._test.hist().undo, h0 + 1, 'no es un solo paso de ⌘Z');
    M._test.undo();
    igual(pasoDe(), 'aprobar', '⌘Z no devolvió el paso');
    igual(est(ids), ['aprobar', 'aprobar', 'aprobar', 'noaprobado', 'captions', 'empezar', 'aprobado'], '⌘Z no devolvió las aprobadas');
    M._test.redo();
    igual(est(['r1', 'r2', 'r3']), ['aprobado', 'aprobado', 'aprobado'], '⇧⌘Z no las aprobó');
  });

  prueba('P6', 'Pasar a Programado: todo lo aprobado menos los reels pasa a Programado; los reels aprobados se quedan en Aprobado para marcarlos a mano y no salen como atrasados; nada de Zernio ni botón de marcar (D-087)', async () => {
    await tablero([pub(1), pub(2, 'Reel'), pub(3, 'Reel'), pub(4), pub(5), pub(6, 'Carrusel')]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    await porAprobar(['r1', 'r2', 'r3', 'r4', 'r6'], 'p6');
    M.setEstado(['r1', 'r2', 'r3', 'r6'], 'aprobado'); M.setEstado('r4', 'programado');
    ponerPaso('aprobado'); await M.flush();
    const h0 = M._test.hist().undo;
    let zernio = 0; const sz = M.startZernio; M.startZernio = (...a) => { zernio++; return sz && sz(...a); };
    try {
      const d = await pulsarPaso('programado');
      ok(new RegExp(`^2 publicaciones pasan a Programado: ${nm('r1')}, ${nm('r6')}\\. 2 reels se quedan en Aprobado, para marcarlos a mano\\.$`).test(d.querySelector('.xwhat').textContent), 'lo que cambia: ' + d.textContent);
      igual(lis(d), [`${nm('r5')} · sin foto`], 'las que se quedan');
      ok(!d.querySelector('[data-cal="reels"], [data-cal="reels-si"], .cpreels'), 'sigue el botón «Marcar como programados»');
      igual(est(['r1', 'r6']), ['aprobado', 'aprobado'], 'abrir la ventana cambió publicaciones');
      aceptarPaso(d);
      await hasta(() => pasoAct() === 'Programado', 3000, 'Programado en la barra');
      igual(est(['r1', 'r2', 'r3', 'r4', 'r5', 'r6']), ['programado', 'aprobado', 'aprobado', 'programado', 'empezar', 'programado'], 'los estados tras pasar');
      igual(marcas('r1'), ['e-programado'], 'la foto no lleva el ✓ de las programadas');
      ok(qa('.toast').some(t => /El mes pasa a Programado: 2 publicaciones pasan a Programado; 2 reels se quedan en Aprobado, para marcarlos a mano\. ⌘Z lo deshace\./.test(t.textContent)), 'el aviso: ' + qa('.toast').map(t => t.textContent).join(' | '));
      await M.flush();
      igual(M._test.hist().undo, h0 + 1, 'no es un solo paso de ⌘Z');
      igual(zernio, 0, 'se llamó a Zernio');
    } finally { M.startZernio = sz; }
  });

  prueba('P7', 'Pasar a Publicado: las Programadas pasan a Publicado y una aprobada sale como «sin programar»; retroceder es directo y solo cambia el paso, con las atrasadas y las adelantadas tal cual; hacia delante no se salta ningún paso (D-085)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    await porAprobar(['r1', 'r2', 'r3'], 'p7');
    M.setEstado('r1', 'publicado'); M.setEstado('r2', 'programado'); M.setEstado('r3', 'aprobado');
    ponerPaso('programado');
    const ids = ['r1', 'r2', 'r3', 'r4'];
    const d = await pulsarPaso('publicado');
    ok(new RegExp(`^1 publicación pasa a Publicado: ${nm('r2')}\\.$`).test(d.querySelector('.xwhat').textContent), 'lo que cambia: ' + d.textContent);
    igual(lis(d), [`${nm('r3')} · sin programar`, `${nm('r4')} · sin foto`], 'las que se quedan');
    aceptarPaso(d);
    await hasta(() => pasoAct() === 'Publicado', 3000, 'Publicado en la barra');
    const antes = est(ids);
    igual(antes, ['publicado', 'publicado', 'aprobado', 'empezar'], 'los estados tras pasar');
    igual(qa('.side > .cal .cleg .cpaso.sig').length, 0, 'después de Publicado hay un paso siguiente');
    // atrás, a Captions: sin ventana, solo el paso, con un aviso y un paso de ⌘Z
    await M.flush();
    const h0 = M._test.hist().undo;
    q('.side > .cal .cleg button.cpaso[data-paso="captions"]').click(); await espera(60);
    ok(!dialogo(), 'retroceder abrió una ventana');
    await hasta(() => pasoAct() === 'Captions', 3000, 'Captions en la barra');
    igual(est(ids), antes, 'retroceder cambió publicaciones');
    ok(qa('.toast').some(t => /El mes vuelve a Captions; las publicaciones no cambian\. ⌘Z lo deshace\./.test(t.textContent)), 'el aviso de volver');
    await M.flush();
    igual(M._test.hist().undo, h0 + 1, 'retroceder no es un paso de ⌘Z');
    M._test.undo(); igual(pasoDe(), 'publicado', '⌘Z no devolvió el paso'); M._test.redo();
    ok(q('.side > .cal .cleg button.cpaso[data-paso="aprobar"]'), 'Por aprobar no se pulsa');
    ok(!q('.side > .cal .cleg button.cpaso[data-paso="aprobado"]'), 'se puede saltar a Aprobado');
  });

  prueba('P8', 'El paso se guarda en el tablero y vuelve al abrirlo; viaja en «⇅ Exportar» (archivo v8, por mes) e «Importar» lo devuelve; un archivo v5, sin paso, entra; IndexedDB 10 (D-084, D-119, D-017, D-060)', async () => {
    await tablero([pub(1)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    aceptarPaso(await pulsarPaso('captions'));
    await hasta(() => pasoGuardado() === 'captions', 3000, 'el paso en el tablero');
    await M.flush();
    const key = `${CLIENTE}-${MES}`;
    await M.open(key);
    igual(pasoGuardado(), 'captions', 'el paso al abrir el mes');
    const d = JSON.parse(await (await M.exportAll({ returnBlob: true })).text());
    igual(d.v, V_ARCHIVO, 'la versión del archivo');
    igual(d.boards.find(b => b.key === key).pasos, { [MES]: 'captions' }, 'el paso en el archivo');
    await sinMes(key);
    let r = await M.importData(d, { confirm: false });
    ok(r && !r.error, 'importar falló: ' + json(r));
    await M.open(key);
    igual(pasoGuardado(), 'captions', 'el paso importado');
    await hasta(() => pasoAct() === 'Captions', 3000, 'Captions en la barra tras importar');
    const v5 = JSON.parse(JSON.stringify(d)); v5.v = 5; v5.boards.forEach(b => { delete b.paso; delete b.pasos; });
    await sinMes(key);
    r = await M.importData(v5, { confirm: false });
    ok(r && !r.error, 'el archivo v5 no se importó: ' + json(r));
    await M.open(key);
    ok(!('paso' in M.board()) && !('pasos' in M.board()), 'un archivo sin paso trajo uno');
    igual(pasoDe(), 'empezar', 'sin paso, el de su publicación más atrasada');
    const dbs = W.indexedDB.databases ? await W.indexedDB.databases() : [];
    if (dbs.length) igual((dbs.find(x => x.name === 'mesa-feed') || {}).version, V_IDB, 'la versión de IndexedDB');   // 8 desde la 3.69 (D-085); 9 desde la 3.85 (D-107); 10 desde la 3.91 (D-119)
  });

  // retrasar desde el selector de la ventana de la publicación (D-085)
  async function retrasarUI(id, k) {
    M._in.openDetail(id, 0);
    const sel = await hasta(() => q('.detail .essel'), 3000, 'el estado en la publicación');
    const o = [...sel.options].find(x => x.value === k);
    ok(o && !o.disabled, `${k} no se puede elegir en ${id}: ` + json([...sel.options].map(x => [x.value, x.textContent, x.disabled])));
    sel.value = k; sel.dispatchEvent(new W.Event('change', { bubbles: true }));
    await hasta(() => q('.detail .essel') && q('.detail .essel').value === k, 3000, `${id} en ${k}`);
  }

  prueba('P9', 'Mes en Por aprobar, todo con caption y nada retrasado: al pasar a Aprobado pasan todas sin ventana, con un aviso; un ⌘Z lo deshace entero (D-085)', async () => {
    await tablero([pub(1), pub(2), pub(3)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    const ids = ['r1', 'r2', 'r3'];
    await porAprobar(ids, 'p9');
    ponerPaso('aprobar'); await M.flush();
    const h0 = M._test.hist().undo;
    await pasoDirecto('aprobado');
    igual(est(ids), ['aprobado', 'aprobado', 'aprobado'], 'no pasaron todas');
    ok(qa('.toast').some(t => /El mes pasa a Aprobado: 3 publicaciones pasan a Aprobado\. ⌘Z lo deshace\./.test(t.textContent)), 'el aviso: ' + qa('.toast').map(t => t.textContent).join(' | '));
    await M.flush();
    igual(M._test.hist().undo, h0 + 1, 'no es un solo paso de ⌘Z');
    M._test.undo();
    igual([pasoDe(), ...est(ids)], ['aprobar', 'aprobar', 'aprobar', 'aprobar'], '⌘Z no lo deshizo entero');
    M._test.redo();
    igual([pasoDe(), ...est(ids)], ['aprobado', 'aprobado', 'aprobado', 'aprobado'], '⇧⌘Z no lo rehízo');
    // a Por aprobar, sin nada atrasado y sin puntos en «Revisar»: también directo
    await tablero([pub(1), pub(2)]);
    await hasta(() => M.calendario && M.revisar, 6000, 'calendario.js y revisar.js');
    await porAprobar(['r1', 'r2'], 'p9b');
    ponerPaso('captions');
    const rv = await M.revisar({ historias: true });
    igual(rv.puntos.length, 0, '«Revisar» da puntos en un mes limpio: ' + json(rv.puntos));
    await pasoDirecto('aprobar', 20000);
    ok(qa('.toast').some(t => /El mes pasa a Por aprobar\. ⌘Z lo deshace\./.test(t.textContent)), 'el aviso: ' + qa('.toast').map(t => t.textContent).join(' | '));
  });

  prueba('P10', 'Caso de un mes casi todo programado: al pasar a Programado pasan las fotos y carruseles aprobados, los reels aprobados (Reel y Collab Reel) se quedan para marcarlos a mano y no hay ventana; marcados, a Publicado pasan todas (D-085, D-087)', async () => {
    await tablero([pub(1), pub(2), { ...pub(3, 'Reel'), type: 'Collab Reel' }, pub(4, 'Reel'), { ...pub(5, 'Reel'), type: 'Trial Reel' }, pub(6, 'Carrusel')]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    const ids = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
    await porAprobar(ids, 'p10');
    M.setEstado(['r1', 'r2', 'r5'], 'programado'); M.setEstado(['r3', 'r4', 'r6'], 'aprobado');
    ponerPaso('aprobado'); await M.flush();
    let zernio = 0; const sz = M.startZernio; M.startZernio = (...a) => { zernio++; return sz && sz(...a); };
    try {
      await pasoDirecto('programado');
      igual(est(ids), ['programado', 'programado', 'aprobado', 'aprobado', 'programado', 'programado'], 'los estados tras pasar');
      ok(qa('.toast').some(t => /El mes pasa a Programado: 1 publicación pasa a Programado; 2 reels se quedan en Aprobado, para marcarlos a mano\. ⌘Z lo deshace\./.test(t.textContent)), 'el aviso: ' + qa('.toast').map(t => t.textContent).join(' | '));
      igual(zernio, 0, 'se llamó a Zernio');
    } finally { M.startZernio = sz; }
    // los reels, a mano; y a Publicado: las programadas pasan, sin ventana
    M.setEstado(['r3', 'r4'], 'programado');
    await pasoDirecto('publicado');
    igual(est(ids), ids.map(() => 'publicado'), 'las programadas no pasaron a Publicado');
  });

  prueba('P11', 'Retrasar a mano: desde la ventana de la publicación se baja a Por empezar aunque tenga foto, contexto y caption; dice «retrasada a mano»; en Captions, al pasar a Por aprobar, sale la ventana y la lista como «retrasada a mano» (D-085)', async () => {
    await tablero([pub(1), pub(2), pub(3)]);
    await hasta(() => M.calendario && M.revisar, 6000, 'calendario.js y revisar.js');
    await porAprobar(['r1', 'r2', 'r3'], 'p11');
    ponerPaso('captions');
    await retrasarUI('r2', 'empezar');
    igual(est(['r1', 'r2', 'r3']), ['aprobar', 'empezar', 'aprobar'], 'no se retrasó');
    igual(slot('r2').estado, { v: 'empezar' }, 'lo que se guarda');
    ok(M._in.retrasada(slot('r2')), 'no cuenta como retrasada');
    await hasta(() => q('.detail .esold') && q('.detail .esold').textContent === 'retrasada a mano', 3000, 'el aviso «retrasada a mano» en la publicación');
    ok(q('.detail .pest .edot.e-empezar'), 'la publicación no lleva la marca de Por empezar');
    M._in.closeDetail();
    const d = await pulsarPaso('aprobar', 20000);
    igual(lis(d), [`${nm('r2')} · retrasada a mano`], 'la retrasada no sale en la ventana');
    ok(/2 publicaciones con su caption elegido\./.test(d.textContent), 'las cifras: ' + d.textContent);
    aceptarPaso(d);
    await hasta(() => pasoAct() === 'Por aprobar', 3000, 'Por aprobar en la barra');
    igual(est(['r1', 'r2', 'r3']), ['aprobar', 'empezar', 'aprobar'], 'pasar movió la retrasada');
  });

  prueba('P12', 'Retrasar: nunca a un estado posterior al que dan sus datos; una retrasada nunca se mueve con la barra; una adelantada nunca baja; retroceder no cambia ninguna; elegir el estado de sus datos la suelta (D-085)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4), pub(5)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    // sin caption elegido: Por aprobar no se puede, ni desde la API ni en el selector
    await poner('r5', [await foto('p12-e.jpg')]); M._test.setNote('r5', 'Contexto');
    igual(M.setEstado('r5', 'aprobar')[0].error, 'para ponerla en Por aprobar le falta elegir el caption', 'se retrasó a un estado posterior');
    igual(M.setEstado('r4', 'captions')[0].error, 'para ponerla en Captions le falta la foto', 'se retrasó a Captions sin foto');
    ok(!slot('r5').estado && !slot('r4').estado, 'un retraso rechazado guardó algo');
    M._in.openDetail('r5', 0);
    let sel = await hasta(() => q('.detail .essel'), 3000, 'el selector');
    igual([...sel.options].slice(0, 3).map(o => [o.textContent, o.value, o.disabled]), [['Por empezar', 'empezar', false], ['Captions', '', false], ['Por aprobar', 'aprobar', true]], 'el selector en Captions');
    M._in.closeDetail();
    // r1 adelantada (Programado), r2 retrasada a Por aprobar desde Aprobado, r3 Por aprobar
    await porAprobar(['r1', 'r2', 'r3'], 'p12');
    M.setEstado('r1', 'programado'); M.setEstado('r2', 'aprobado');
    await retrasarUI('r2', 'aprobar');
    igual(est(['r1', 'r2', 'r3']), ['programado', 'aprobar', 'aprobar'], 'los estados de partida');
    ok(M._in.retrasada(slot('r2')) && !M._in.retrasada(slot('r3')), 'la retrasada');
    sel = q('.detail .essel');
    igual([...sel.options].slice(0, 3).map(o => [o.value, o.disabled]), [['empezar', false], ['captions', false], ['aprobar', false]], 'el selector de la retrasada');
    M._in.closeDetail();
    ponerPaso('aprobar');
    const d = await pulsarPaso('aprobado');
    ok(/^1 publicación pasa a Aprobado: /.test(d.querySelector('.xwhat').textContent), 'lo que cambia: ' + d.textContent);
    igual(lis(d), [`${nm('r2')} · retrasada a mano`, `${nm('r4')} · sin foto`, `${nm('r5')} · sin caption elegido`], 'las que se quedan');
    aceptarPaso(d);
    await hasta(() => pasoAct() === 'Aprobado', 3000, 'Aprobado en la barra');
    igual(est(['r1', 'r2', 'r3']), ['programado', 'aprobar', 'aprobado'], 'la retrasada se movió o la adelantada bajó');
    // retroceder: ninguna cambia, ni la retrasada ni la adelantada
    const antes = est(['r1', 'r2', 'r3', 'r4', 'r5']);
    await pasoDirecto('empezar');
    igual(est(['r1', 'r2', 'r3', 'r4', 'r5']), antes, 'retroceder cambió publicaciones');
    // los datos cambian: la retrasada sigue retenida; si sus datos caen detrás, manda lo de sus datos
    M._test.setSlot('r2', { caption: { ...slot('r2').caption, pick: null } });
    igual(M._in.estadoDe(slot('r2')), 'captions', 'sin caption, sigue en Por aprobar');
    M._test.setSlot('r2', { caption: { ...slot('r2').caption, pick: 0 } });
    igual(M._in.estadoDe(slot('r2')), 'aprobar', 'con el caption otra vez, no vuelve a su retraso');
    // r3 retrasada a Captions: elegir Por aprobar (el de sus datos) la suelta
    await retrasarUI('r3', 'captions');
    igual(est(['r3']), ['captions'], 'r3 no se retrasó desde Aprobado');
    sel = q('.detail .essel');
    const pa = [...sel.options].find(o => o.textContent === 'Por aprobar');
    igual([pa.value, pa.disabled], ['', false], 'Por aprobar no devuelve la publicación a sus datos');
    sel.value = ''; sel.dispatchEvent(new W.Event('change', { bubbles: true }));
    await hasta(() => !slot('r3').estado, 3000, 'r3 suelta');
    igual(M._in.estadoDe(slot('r3')), 'aprobar', 'suelta, no va a Por aprobar');
    ok(!q('.detail .esold'), 'suelta, sigue diciendo «retrasada a mano»');
    M._in.closeDetail();
  });

  prueba('P13', 'Exportar e importar conservan el retrasado (archivo v7); una mesa anterior no lo importa (D-085, D-017, D-060)', async () => {
    await tablero([pub(1), pub(2)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    await porAprobar(['r1', 'r2'], 'p13');
    igual(M.setEstado('r1', 'captions')[0].estado, 'captions', 'no se retrasó');
    await M.flush();
    const key = `${CLIENTE}-${MES}`;
    const d = JSON.parse(await (await M.exportAll({ returnBlob: true })).text());
    igual(d.v, V_ARCHIVO, 'la versión del archivo');
    igual(d.boards.find(b => b.key === key).slots.find(x => x.id === 'r1').estado, { v: 'captions' }, 'el retraso en el archivo');
    await sinMes(key);
    const r = await M.importData(d, { confirm: false });
    ok(r && !r.error, 'importar falló: ' + json(r));
    await M.open(key);
    igual([M._in.estadoDe(slot('r1')), M._in.retrasada(slot('r1')), M._in.estadoDe(slot('r2'))], ['captions', true, 'aprobar'], 'el retraso importado');
    const v8 = JSON.parse(JSON.stringify(d)); v8.v = V_ARCHIVO + 1;
    const r8 = await M.importData(v8, { confirm: false });
    ok(r8 && r8.error && /más nueva/.test(r8.error), 'un archivo más nuevo entró: ' + json(r8));
  });

  prueba('P14', 'El contexto no decide el estado: con foto y sin contexto, Captions y, con caption elegido, Por aprobar; se aprueba y la barra la lleva sin contexto; sin foto, Por empezar aunque tenga contexto (D-086)', async () => {
    await tablero([pub(1), pub(2), pub(3)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    await poner('r1', [await foto('p14-a.jpg')]);
    await poner('r2', [await foto('p14-b.jpg')]);
    M._test.setNote('r3', 'Contexto');
    igual(est(['r1', 'r2', 'r3']), ['captions', 'captions', 'empezar'], 'con foto y sin contexto no está en Captions');
    M.loadCaptions(['r1', 'r2'].map(slotId => ({ slotId, options: [{ tone: 'a', text: '1' }, { tone: 'b', text: '2' }, { tone: 'c', text: '3' }] })));
    ['r1', 'r2'].forEach(id => M._test.setSlot(id, { caption: { ...slot(id).caption, pick: 0 } }));
    igual(est(['r1', 'r2']), ['aprobar', 'aprobar'], 'con caption elegido y sin contexto no está en Por aprobar');
    igual(M.setEstado('r1', 'aprobado')[0].estado, 'aprobado', 'sin contexto no se aprueba');
    igual(M.setEstado('r3', 'captions')[0].error, 'para ponerla en Captions le falta la foto', 'el motivo de no poder');
    ponerPaso('aprobar');
    const d = await pulsarPaso('aprobado');
    igual(lis(d), [`${nm('r3')} · sin foto`], 'las que se quedan');
    aceptarPaso(d);
    await hasta(() => pasoAct() === 'Aprobado', 3000, 'Aprobado en la barra');
    igual(est(['r1', 'r2', 'r3']), ['aprobado', 'aprobado', 'empezar'], 'la barra no llevó la de sin contexto');
  });

  // ---------- un paso por mes (D-119) ----------
  const DIC = '2026-12';
  // un tablero de noviembre y diciembre: r1 y r2 en noviembre, r3 y r4 en diciembre
  async function tableroDos() {
    await limpiar();
    const r = await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, months: 2, slots: [pub(1), pub(2), pub(3, 'Foto', 5, DIC), pub(4, 'Foto', 8, DIC)], past: [], force: true });
    ok(r && r.key === `${CLIENTE}-${MES}`, 'no se abrió el tablero de dos meses: ' + json(r));
    await hasta(() => M.calendario, 4000, 'calendario.js');
    return { key: r.key, nov: ['r1', 'r2'], dic: [`r3-${DIC}`, `r4-${DIC}`] };
  }
  const calMes = () => (q('.side > .cal .cmes') || {}).textContent;
  async function irMes(texto) {   // ‹ › hasta el mes del calendario que diga texto («Diciembre 2026»)
    for (let i = 0; i < 6 && calMes() !== texto; i++) {
      const a = ['Octubre 2026', 'Noviembre 2026', 'Diciembre 2026', 'Enero 2027'], k = a.indexOf(calMes()) < a.indexOf(texto) ? 'next' : 'prev';
      q(`.side > .cal [data-cal="${k}"]`).click(); await espera(30);
    }
    igual(calMes(), texto, 'el mes del calendario');
  }

  prueba('P19', 'Un tablero de dos meses lleva un paso por mes: la barra es la del mes que enseña el calendario y ‹ › pasa a la del otro; avanzar en uno solo lleva y lista sus publicaciones; ⌘Z lo deshace en un paso (D-119)', async () => {
    const { nov, dic } = await tableroDos();
    igual([pasoGuardado(MES), pasoGuardado(DIC)], ['empezar', 'empezar'], 'un tablero nuevo no empieza en Por empezar en cada mes');
    await porAprobar([...nov, ...dic], 'p15');
    M.setEstado('r1', 'noaprobado');
    M._in.S.pasos = { [MES]: 'aprobar', [DIC]: 'aprobar' }; M._in.changed();
    await irMes('Diciembre 2026');
    await hasta(() => pasoAct() === 'Por aprobar', 3000, 'Por aprobar en la barra de diciembre');
    const u0 = M._test.hist().undo;
    await pasoDirecto('aprobado');   // el No aprobado de noviembre no es de este mes: nada se queda atrás
    igual(est([...nov, ...dic]), ['noaprobado', 'aprobar', 'aprobado', 'aprobado'], 'avanzar diciembre llevó publicaciones de noviembre');
    igual([pasoGuardado(MES), pasoGuardado(DIC)], ['aprobar', 'aprobado'], 'los pasos de cada mes');
    igual(M._in.pasoDe(M._in.S, MES), 'aprobar', 'noviembre cambió de paso');
    await irMes('Noviembre 2026');
    await hasta(() => pasoAct() === 'Por aprobar', 3000, 'noviembre sigue en Por aprobar');
    const d = await pulsarPaso('aprobado');
    igual(lis(d), [`${nm('r1')} · No aprobado`], 'la ventana de noviembre lista otras publicaciones');
    ok(!/Foto 1\.[34]/.test(d.textContent), 'la ventana de noviembre habla de diciembre');
    d.querySelector('[data-act="close"]').click();
    await irMes('Diciembre 2026');
    igual(M._test.hist().undo, u0 + 1, 'el cambio de paso no es un solo paso de ⌘Z');
    M._test.undo();
    igual([pasoGuardado(MES), pasoGuardado(DIC), ...est(dic)], ['aprobar', 'aprobar', 'aprobar', 'aprobar'], '⌘Z no lo deshizo entero');
    await hasta(() => pasoAct() === 'Por aprobar', 3000, '⌘Z no devolvió la barra de diciembre');
  });

  prueba('P20', 'Un tablero de varios meses guardado con un solo paso: ese paso va al primer mes y los otros enseñan el de su publicación más atrasada hasta que se cambian; igual al importar un archivo v7 (D-119, D-084)', async () => {
    const { key, nov, dic } = await tableroDos();
    await porAprobar(nov, 'p16'); M.setEstado(nov, 'aprobado');
    await poner(dic[0], [await foto('p16-d0.jpg')]); await poner(dic[1], [await foto('p16-d1.jpg')]);
    const viejo = () => { delete M._in.S.pasos; M._in.S.paso = 'aprobado'; };   // como lo guardaba la 3.90: uno para el tablero
    viejo(); M._in.changed(); await M.flush();
    await M.open(key);
    igual(M.board().pasos, { [MES]: 'aprobado' }, 'el paso de antes no fue al primer mes');
    ok(!('paso' in M.board()), 'sigue el paso de antes');
    igual([M._in.pasoDe(M._in.S, MES), M._in.pasoDe(M._in.S, DIC)], ['aprobado', 'captions'], 'el otro mes no enseña su publicación más atrasada');
    await irMes('Diciembre 2026');
    await hasta(() => pasoAct() === 'Captions', 3000, 'Captions en la barra de diciembre');
    // un archivo v7: el paso del tablero, al primer mes
    const d = JSON.parse(await (await M.exportAll({ returnBlob: true })).text());
    d.v = 7; d.boards.forEach(b => { if (b.key === key) { b.paso = 'aprobado'; delete b.pasos; } });
    await sinMes(key);
    const r = await M.importData(d, { confirm: false });
    ok(r && !r.error, 'el archivo v7 no se importó: ' + json(r));
    await M.open(key);
    igual(M.board().pasos, { [MES]: 'aprobado' }, 'importar el archivo v7 no llevó su paso al primer mes');
    igual(M._in.pasoDe(M._in.S, DIC), 'captions', 'importado, el otro mes no enseña su publicación más atrasada');
  });

  prueba('P21', 'El ciclo anterior, de solo lectura, no lleva una barra que se pulse; con día de ciclo 15, el mes que solo enseña el final de un ciclo lleva la barra de ese ciclo (D-119)', async () => {
    await limpiar();
    const dia = d => `2026-${d}T12:00:00.000+01:00`;
    try {
      await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, cycleDay: 15, slots: [{ id: 'c15a', name: 'Foto 1.1', type: 'Foto', date: dia('11-20') }, { id: 'c15b', name: 'Foto 1.2', type: 'Foto', date: dia('12-10') }], past: [], force: true });
      await hasta(() => M.calendario, 4000, 'calendario.js');
      M._in.S.pasos = { [MES]: 'captions' }; M._in.changed();
      await irMes('Noviembre 2026');
      await hasta(() => pasoAct() === 'Captions', 3000, 'Captions en noviembre');
      await irMes('Octubre 2026');
      ok(q('.side > .cal .cleg.ro') && !q('.side > .cal .cleg button.cpaso') && !pasoAct(), 'el ciclo anterior lleva una barra que se pulsa');
      igual(qa('.side > .cal .cleg .cpaso').length, 6, 'el ciclo anterior no lleva la leyenda de los pasos');
      await irMes('Diciembre 2026');
      await hasta(() => pasoAct() === 'Captions', 3000, 'diciembre (final del ciclo de noviembre) no lleva su barra');
      ok(q('.side > .cal .cleg button.cpaso[data-mes="2026-11"]'), 'la barra de diciembre no es la del ciclo de noviembre');
    } finally { await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, cycleDay: 1, slots: [], past: [], force: true }); await limpiar(); }
  });

  prueba('P22', '«Revisar» al pasar a Por aprobar mira solo ese mes y sus historias (D-119, D-040, D-058)', async () => {
    const { nov, dic } = await tableroDos();
    await hasta(() => M.hs && M.revisar, 4000, 'historias.js y revisar.js');
    await porAprobar(dic, 'p18');
    await poner('r1', [await foto('p18-chica.jpg', 600, 750)]); await poner('r2', [await foto('p18-n2.jpg')]);
    M.hs.anadir('2026-11-10');   // una historia de noviembre sin diseñar: un punto que bloquea
    M.loadCaptions(nov.map(slotId => ({ slotId, options: [{ tone: 'a', text: '1' }, { tone: 'b', text: '2' }, { tone: 'c', text: '3' }] })));
    nov.forEach(id => M._test.setSlot(id, { caption: { ...slot(id).caption, pick: 0 } }));
    M._in.S.pasos = { [MES]: 'captions', [DIC]: 'captions' }; M._in.changed(); await M.flush();
    const rn = await M.revisar({ historias: true, mes: MES }), rd = await M.revisar({ historias: true, mes: DIC });
    ok(rn.puntos.some(p => p.slotId === 'r1') && rn.puntos.some(p => p.historiaId), 'la revisión de noviembre no ve su foto pequeña o su historia: ' + json(rn.puntos));
    igual(rd.puntos, [], 'la revisión de diciembre ve cosas de noviembre');
    await irMes('Diciembre 2026');
    await hasta(() => pasoAct() === 'Captions', 3000, 'Captions en diciembre');
    await pasoDirecto('aprobar');   // diciembre está en orden: sin ventana
    igual(pasoGuardado(MES), 'captions', 'noviembre cambió de paso');
    await irMes('Noviembre 2026');
    const d = await pulsarPaso('aprobar', 6000);
    ok(/Foto 1\.1/.test(d.textContent) && /historia/.test(d.textContent), 'la ventana de noviembre no enseña sus puntos');
    d.querySelector('[data-act="close"]').click();
  });

  // ---------- el calendario en hoy, Publicado solo y las vencidas (D-120) ----------
  const madrid = (dia, hora = '12:00') => Date.parse(M._in.madridISO(dia, hora));
  // el reloj de la mesa (M._test.reloj); en una mesa anterior a la 3.92, el Date.now de su página, para que la prueba falle por lo que mira
  const DATE_NOW = Date.now;
  const reloj = (dia, hora) => { const t = madrid(dia, hora); if (M._test.reloj) M._test.reloj(t); else W.Date.now = () => t; };
  const volverReloj = () => { if (M._test.reloj) M._test.reloj(RELOJ_PRUEBAS); else W.Date.now = DATE_NOW; };
  const revisarV = abrir => M._test.vencRevisar ? M._test.vencRevisar(abrir) : espera(80);
  const vencidasV = () => M._in.vencidas ? M._in.vencidas() : [];
  const abrirV = () => { if (M.calendario && M.calendario.vencidas) M.calendario.vencidas(); };
  const ventanaV = () => q('.detail:not([hidden])[data-dlg="venc"]');
  const filaV = id => q(`.detail[data-dlg="venc"] .vlist li[data-k$="|${id}"]`);
  const enFilaV = (id, cal) => { const b = filaV(id) && filaV(id).querySelector(`[data-cal="${cal}"]`); ok(b, `falta ${cal} en la fila de ${id}`); b.click(); };
  const otroTablero = () => M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [{ id: 'v-otro', name: 'Foto 1.1', type: 'Foto', date: '2026-11-10T12:00:00.000+01:00' }], past: [], force: true });
  const histDe = id => M._in.hsDe(M._in.S).find(h => h.id === id);

  prueba('V1', 'Al abrir un cliente se abre su tablero que contiene hoy (Madrid), aunque el último usado sea otro, y el calendario en el mes de hoy, con hoy marcado; sin tablero con hoy, el último usado (D-121)', async () => {
    try {
      await limpiar();
      reloj('2026-11-04', '12:00');
      await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, slots: [pub(1, 'Foto', 20)], past: [], force: true });
      await M.init({ client: CLIENTE, clientName: NOMBRE, month: '2026-10', slots: [pub(1, 'Foto', 20, '2026-10')], past: [], force: true });   // el último usado
      await otroTablero();
      await M.openClient(CLIENTE);
      igual(M.status().key, `${CLIENTE}-${MES}`, 'no abrió el tablero que contiene hoy');
      await hasta(() => calMes() === 'Noviembre 2026', 3000, 'el calendario en el mes de hoy');
      ok(q('.side > .cal .cday.today[data-day="2026-11-04"]'), 'hoy no está marcado');
      await M.open(`${CLIENTE}-2026-10`); await otroTablero();
      reloj('2027-03-01', '12:00');   // ningún tablero contiene hoy: el último usado
      await M.openClient(CLIENTE);
      igual(M.status().key, `${CLIENTE}-2026-10`, 'sin tablero con hoy no abrió el último usado');
    } finally { volverReloj(); }
  });

  prueba('V2', 'El calendario abre en el mes de hoy; si hoy no cae en el tablero, en su mes más cercano; ‹ › se respeta hasta que se cambia de tablero (D-121)', async () => {
    try {
      reloj('2026-12-10', '12:00');
      const { key } = await tableroDos();
      await hasta(() => calMes() === 'Diciembre 2026', 3000, 'el calendario en el mes de hoy');
      ok(q('.side > .cal .cday.today[data-day="2026-12-10"]'), 'hoy no está marcado');
      await irMes('Noviembre 2026'); M._in.render(); await espera(30);
      igual(calMes(), 'Noviembre 2026', 'al redibujar no se respetó ‹');
      await M.open(key); await espera(30);
      igual(calMes(), 'Noviembre 2026', 'volver a abrir el mismo tablero no respetó ‹');
      await otroTablero(); await M.open(key);
      await hasta(() => calMes() === 'Diciembre 2026', 3000, 'al volver de otro tablero, el mes de hoy');
      reloj('2026-10-02', '12:00'); await otroTablero(); await M.open(key);
      await hasta(() => calMes() === 'Noviembre 2026', 3000, 'antes del tablero, su mes más cercano');
      reloj('2027-02-01', '12:00'); await otroTablero(); await M.open(key);
      await hasta(() => calMes() === 'Diciembre 2026', 3000, 'después del tablero, su mes más cercano');
    } finally { volverReloj(); }
  });

  prueba('V3', 'Una Programada pasa sola a Publicado a su hora (sin hora, al acabar su día), también un reel marcado a mano; una movida después de programarla no pasa y es vencida; un aviso lo dice, ⌘Z las devuelve en un paso y ya no vuelven a pasar solas (D-120, D-103)', async () => {
    try {
      reloj('2026-11-01', '09:00');
      await tablero([pub(1, 'Foto', 3), pub(2, 'Reel', 4), { id: 'r3', name: 'Foto 1.3', type: 'Foto', date: '2026-11-05' }, pub(4, 'Foto', 3)]);
      await porAprobar(['r1', 'r2', 'r3', 'r4'], 'v3');
      M.setEstado(['r1', 'r2', 'r3', 'r4'], 'programado');
      igual(slot('r1').estado.fecha, slot('r1').date, 'la Programada no guarda la fecha con la que se programó');
      M._test.setDate('r4', M._in.madridISO('2026-11-04', '10:00'));   // movida después de programarla: Zernio sigue con la de antes (D-103)
      await M.flush();
      reloj('2026-11-04', '19:00'); M._in.clearToasts();
      const u0 = M._test.hist().undo;
      await revisarV();
      igual(est(['r1', 'r2', 'r3', 'r4']), ['publicado', 'publicado', 'programado', 'programado'], 'lo que pasó a Publicado');
      ok(toastCon(/^2 publicaciones pasan a Publicado/), 'sin el aviso: ' + qa('.toasts .toast').map(t => t.textContent).join(' | '));
      igual(M._test.hist().undo, u0 + 1, 'no es un solo paso de ⌘Z');
      igual(vencidasV().map(v => [v.id, v.movida]), [['r4', true]], 'la movida no es la única vencida');
      ok(celda('r4').querySelector('.vdate') && !celda('r3').querySelector('.vdate') && !celda('r1').querySelector('.vdate'), 'la marca de vencida en la casilla');
      ok(q('.side > .cal .chip.venc[data-slot="r4"]') && !q('.side > .cal .chip.venc[data-slot="r1"]'), 'la marca de vencida en el calendario');
      M._test.undo();
      igual(est(['r1', 'r2']), ['programado', 'programado'], '⌘Z no las devolvió');
      await revisarV();
      igual(est(['r1', 'r2']), ['programado', 'programado'], 'devueltas con ⌘Z, volvieron a pasar solas');
      igual(vencidasV().map(v => v.id).sort(), ['r1', 'r2', 'r4'], 'devueltas con ⌘Z no son vencidas');
      M._test.redo(); igual(est(['r1', 'r2']), ['publicado', 'publicado'], '⇧⌘Z no lo rehízo');
      reloj('2026-11-05', '23:00'); await revisarV();
      igual(est(['r3']), ['programado'], 'la de sin hora pasó antes de acabar su día');
      reloj('2026-11-06', '00:30'); await revisarV();
      igual(est(['r3']), ['publicado'], 'la de sin hora no pasó al acabar su día');
      M.setEstado('r3', 'programado');   // devuelta a mano porque Zernio no la publicó: ya no pasa sola
      await revisarV();
      igual(est(['r3']), ['programado'], 'devuelta a mano, volvió a pasar sola');
      ok(vencidasV().some(v => v.id === 'r3'), 'devuelta a mano no es vencida');
    } finally { volverReloj(); }
  });

  prueba('V4', '«N vencidas» abre la lista por fecha: «Ya se publicó», «Reprogramar» y «Cancelar» con su motivo, cada uno un paso de ⌘Z; Reprogramar una Programada avisa de Zernio y mueve sus historias; sin días por delante no se reprograma (D-120, D-103, D-057, D-082)', async () => {
    try {
      reloj('2026-11-01', '09:00');
      await tablero([pub(1, 'Foto', 2), pub(2, 'Reel', 3), pub(3, 'Carrusel', 4), pub(4, 'Foto', 20)]);
      await hasta(() => M.calendario && M.hs, 4000, 'calendario.js e historias.js');
      await porAprobar(['r1', 'r2', 'r3'], 'v4');
      M.setEstado('r1', 'programado'); M._test.setDate('r1', M._in.madridISO('2026-11-02', '18:00'));
      M.setEstado(['r2', 'r3'], 'aprobado');
      const h = M.hs.anadir('2026-11-04', { slotId: 'r3' });   // una historia que apoya a r3
      await M.flush();
      reloj('2026-11-05', '10:00'); await revisarV();
      const cab = await hasta(() => q('.side > .cal .cvenc'), 3000, '«N vencidas» en la cabecera');
      igual(cab.textContent, '3 vencidas', 'la cuenta de la cabecera');
      cab.click();
      await hasta(() => ventanaV(), 3000, 'la ventana de las vencidas');
      igual(qa('.detail[data-dlg="venc"] .vlist li').map(li => li.dataset.k.split('|')[1]), ['r1', 'r2', 'r3'], 'la lista no va por fecha');
      ok(/movida después de programarla/.test(filaV('r1').textContent), 'la Programada movida no lo dice');
      let u = M._test.hist().undo;
      enFilaV('r2', 'v-pub');
      igual([est(['r2'])[0], M._test.hist().undo], ['publicado', u + 1], '«Ya se publicó» no es un paso de ⌘Z');
      ok(!filaV('r2'), 'sigue en la lista');
      tecla('z', { meta: true, code: 'KeyZ' }); await espera(30);   // con la ventana abierta: sus acciones son pasos (D-120)
      igual(est(['r2']), ['aprobado'], '⌘Z con la ventana abierta no devolvió «Ya se publicó»');
      ok(filaV('r2'), 'tras ⌘Z no vuelve a la lista');
      enFilaV('r2', 'v-can');
      const mi = await hasta(() => filaV('r2').querySelector('input[data-v="motivo"]'), 2000, 'el campo del motivo');
      ok(D.activeElement === mi, 'el motivo no coge el foco');
      mi.value = 'Lo pidió el cliente'; u = M._test.hist().undo;
      enFilaV('r2', 'v-can-ok');
      igual([est(['r2'])[0], M._in.motivoDe(slot('r2')), M._test.hist().undo], ['cancelado', 'Lo pidió el cliente', u + 1], 'cancelar con su motivo');
      M._in.clearToasts();
      enFilaV('r1', 'v-rep');
      const di = await hasta(() => filaV('r1').querySelector('input[data-v="dia"]'), 2000, 'el día de Reprogramar');
      di.value = '2026-11-05'; filaV('r1').querySelector('input[data-v="hora"]').value = '09:00';
      enFilaV('r1', 'v-rep-ok');
      igual(M._in.localDay(slot('r1').date), '2026-11-02', 'se reprogramó a una hora que ya pasó');
      di.value = '2026-11-12'; filaV('r1').querySelector('input[data-v="hora"]').value = '19:30';
      u = M._test.hist().undo;
      enFilaV('r1', 'v-rep-ok');
      igual([M._in.localDay(slot('r1').date), M._in.localTime(slot('r1').date), M._test.hist().undo], ['2026-11-12', '19:30', u + 1], 'Reprogramar');
      ok(toastCon(/Zernio/), 'reprogramar una Programada no avisó de Zernio');
      const dh = M._in.localDay(histDe(h).date);
      enFilaV('r3', 'v-rep');
      await hasta(() => filaV('r3').querySelector('input[data-v="dia"]'), 2000, 'el día de Reprogramar');
      filaV('r3').querySelector('input[data-v="dia"]').value = '2026-11-14';
      enFilaV('r3', 'v-rep-ok');
      igual([M._in.localDay(slot('r3').date), M._in.localDay(histDe(h).date)], ['2026-11-14', '2026-11-14'], `su historia no la siguió (estaba el ${dh})`);
      ok(!vencidasV().length, 'quedan vencidas: ' + json(vencidasV().map(v => v.id)));
      await hasta(() => !q('.side > .cal .cvenc'), 2000, 'la cabecera sin vencidas');
      M._in.closeDetail();
      // sin días por delante en su tablero, no se reprograma
      reloj('2026-12-01', '09:00');
      abrirV();
      await hasta(() => filaV('r4'), 3000, 'r4 vencida');
      ok(filaV('r4').querySelector('[data-cal="v-rep"]').disabled, 'se puede reprogramar sin días por delante');
      M._in.closeDetail();
    } finally { volverReloj(); }
  });

  prueba('V5', 'Al abrir un tablero con vencidas, un aviso «N vencidas · Ver» que abre la ventana, una vez por tablero hasta recargar; en «Vista cliente» no sale nada ni pasa nada solo (D-120, D-095)', async () => {
    try {
      reloj('2026-11-10', '12:00'); if (M._test.avisadas) M._test.avisadas().clear();   // otra prueba ya abrió este tablero con vencidas
      const r = await tablero([pub(1, 'Foto', 2), pub(2, 'Foto', 20)]);
      await hasta(() => toastCon(/^1 vencida/), 3000, 'el aviso al abrir');
      const t = qa('.toasts .toast').find(x => /vencida/.test(x.textContent)), b = t.querySelector('button');
      igual(b && b.textContent, 'Ver', 'el aviso no lleva «Ver»');
      b.click();
      await hasta(() => ventanaV(), 3000, '«Ver» no abrió la ventana');
      M._in.closeDetail(); M._in.clearToasts();
      await M.open(r.key); await revisarV(true);
      ok(!toastCon(/vencida/), 'el aviso salió dos veces');
      // «Vista cliente»: ni marcas, ni cabecera, ni aviso, ni nada que pase solo
      await porAprobar(['r2'], 'v5'); M.setEstado('r2', 'programado'); await M.flush();
      M._in.root().classList.add('client'); M._in.render();
      reloj('2026-11-21', '12:00'); await revisarV(true);
      igual(est(['r2']), ['programado'], 'en «Vista cliente» pasó a Publicado');
      ok(!q('.side > .cal .cvenc') && !q('.side > .cal .chip.venc') && !toastCon(/vencida|Publicado/), 'en «Vista cliente» sale lo de las vencidas');
      M._in.root().classList.remove('client'); M._in.render();
      await revisarV();
      igual(est(['r2']), ['publicado'], 'quitada la vista, no pasó a Publicado');
    } finally { M._in.root().classList.remove('client'); volverReloj(); }
  });

  prueba('V6', 'Mira también los tableros anteriores del cliente: una Programada de octubre pasa sola y las vencidas de octubre salen con su mes; «Ya se publicó» y «Cancelar» las cambian desde aquí, también la copia de su collab, y ⌘Z lo devuelve; «Reprogramar» no tiene días por delante y el nombre abre su tablero (D-120)', async () => {
    const OCT = '2026-10', okey = `${CLIENTE}-${OCT}`, okey2 = `${CLIENTE2}-${OCT}`, de = async (k, id) => { await (M._test.fueraListo ? M._test.fueraListo() : null); const b = await M._in.idbGet('boards', k); const s = b.slots.find(x => x.id === id); return s.estado || null; };
    try {
      await limpiar();
      reloj('2026-10-01', '09:00');
      const o = (id, n, dia) => ({ id, name: `Foto 4.${n}`, type: 'Foto', date: `${OCT}-${dia}T12:00:00.000+02:00` });
      await M.init({ client: CLIENTE, clientName: NOMBRE, month: OCT, slots: [o('o1', 1, 20), o('o2', 2, 22), o('o3', 3, 24)], past: [], force: true });
      await porAprobar(['o1', 'o2', 'o3'], 'v6'); M.setEstado('o1', 'programado'); M.setEstado(['o2', 'o3'], 'aprobado'); await M.flush();
      await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: OCT, slots: [o('o3', 3, 24)], past: [], force: true }); await M.flush();   // o3, collab con el otro cliente
      reloj('2026-11-04', '12:00');
      await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, slots: [pub(1, 'Foto', 20)], past: [], force: true });
      await revisarV();
      igual((await de(okey, 'o1')).v, 'publicado', 'la Programada de octubre no pasó sola');
      igual(vencidasV().map(v => [v.id, v.aqui]), [['o2', false], ['o3', false]], 'las vencidas de octubre');
      abrirV();
      await hasta(() => filaV('o2'), 3000, 'la fila de o2');
      ok(/Octubre 2026, otro tablero/.test(filaV('o2').textContent), 'no dice su mes');
      ok(filaV('o2').querySelector('[data-cal="v-rep"]').disabled, 'se puede reprogramar sin días por delante');
      const u = M._test.hist().undo;
      enFilaV('o3', 'v-pub');
      igual([(await de(okey, 'o3')).v, (await de(okey2, 'o3')).v, M._test.hist().undo], ['publicado', 'publicado', u + 1], '«Ya se publicó» en octubre y en su collab');
      enFilaV('o2', 'v-can');
      (await hasta(() => filaV('o2').querySelector('input[data-v="motivo"]'), 2000, 'el motivo')).value = 'Se quedó sin hacer';
      enFilaV('o2', 'v-can-ok');
      igual(await de(okey, 'o2'), { v: 'cancelado', motivo: 'Se quedó sin hacer' }, 'cancelar la de octubre');
      M._test.undo(); M._test.undo();
      igual([(await de(okey, 'o2')).v, (await de(okey, 'o3')).v, (await de(okey2, 'o3')).v], ['aprobado', 'aprobado', 'aprobado'], '⌘Z no devolvió octubre');
      M._test.undo();
      const e1 = await de(okey, 'o1');
      igual([e1.v, !!e1.tarde], ['programado', true], '⌘Z no devolvió la que pasó sola, como vencida');
      await revisarV();
      igual((await de(okey, 'o1')).v, 'programado', 'devuelta con ⌘Z volvió a pasar sola');
      if (M._in.vencRefrescar) await M._in.vencRefrescar(); abrirV();
      await hasta(() => filaV('o3'), 3000, 'la fila de o3');
      enFilaV('o3', 'v-abrir');
      await hasta(() => M.status().key === okey && dialogo() && dialogo().dataset.slot === 'o3', 4000, 'su tablero y su publicación');
      M._in.closeDetail();
    } finally { volverReloj(); }
  });

  prueba('V7', 'La fecha con la que se programó viaja en «⇅ Exportar» (v9); una Programada de antes, sin fecha, toma la que tiene al abrir su tablero; IndexedDB 11 (D-120, D-060, D-017)', async () => {
    reloj('2026-11-01', '09:00');
    try {
      const r = await tablero([pub(1, 'Foto', 20), pub(2, 'Foto', 21)]);
      await porAprobar(['r1', 'r2'], 'v7'); M.setEstado(['r1', 'r2'], 'programado'); await M.flush();
      const d = JSON.parse(await (await M.exportAll({ returnBlob: true })).text());
      igual(d.v, V_ARCHIVO, 'la versión del archivo');
      igual(d.boards.find(b => b.key === r.key).slots.find(s => s.id === 'r1').estado, { v: 'programado', fecha: slot('r1').date }, 'la fecha en el archivo');
      const v8 = JSON.parse(JSON.stringify(d)); v8.v = 8; v8.boards.forEach(b => (b.slots || []).forEach(s => { if (s.estado) delete s.estado.fecha; }));
      await sinMes(r.key);
      const ri = await M.importData(v8, { confirm: false }); ok(ri && !ri.error, 'el archivo v8 no entró: ' + json(ri));
      await M.open(r.key);
      igual(slot('r2').estado, { v: 'programado', fecha: slot('r2').date }, 'una Programada de antes no tomó su fecha al abrir');
      const dbs = W.indexedDB.databases ? await W.indexedDB.databases() : [];
      if (dbs.length) igual((dbs.find(x => x.name === 'mesa-feed') || {}).version, V_IDB, 'la versión de IndexedDB');
    } finally { volverReloj(); }
  });

  prueba('V8', 'Con el tablero abierto se vuelve a mirar sola: al volver a la pestaña, una Programada cuya hora llegó pasa a Publicado sin hacer nada (D-120)', async () => {
    reloj('2026-11-01', '09:00');
    try {
      await tablero([pub(1, 'Foto', 3)]);
      await porAprobar(['r1'], 'v8'); M.setEstado('r1', 'programado'); await M.flush();
      reloj('2026-11-03', '12:05');
      D.dispatchEvent(new W.Event('visibilitychange'));
      await hasta(() => est(['r1'])[0] === 'publicado', 3000, 'que pase sola a Publicado');
    } finally { volverReloj(); }
  });

  // ---------- «N cambiadas» y «N con fecha nueva», pulsables (mesa 3.97, calendario 1.12, D-126) ----------
  prueba('V9', '«N cambiadas» y «N con fecha nueva» de la barra abren una sola lista por fecha, cada una una vez, con «Cambió: …» como su marcador; el nombre abre la publicación; sin acciones; sin calendario.js no falla; no en «Vista cliente» (D-126)', async () => {
    await tablero([pub(1), pub(2), pub(3), pub(4)]);
    await hasta(() => M.calendario, 4000, 'calendario.js');
    for (const id of ['r1', 'r3']) { await poner(id, [await foto(`v9-${id}.jpg`)]); M._test.setNote(id, 'Contexto ' + id); M.markUploaded([{ slotId: id, fileIds: [slot(id).photos[0]] }]); }
    await espera(60);
    M._test.setNote('r1', 'Otro contexto');                                   // r1: cambiada (contexto)
    M._test.setDate('r2', '2026-11-20T18:00:00.000+01:00');                  // r2: con fecha nueva
    M._test.setDate('r3', '2026-11-10T18:00:00.000+01:00'); M._test.setNote('r3', 'Otro r3');   // r3: las dos
    const txt = () => qa('.bar .stats button[data-act="cambios"]').map(b => b.textContent.trim());
    await hasta(() => json(txt()) === json(['2 cambiadas', '2 con fecha nueva']), 3000, 'los dos botones de la barra: ' + json(txt()));
    const bs = qa('.bar .stats button[data-act="cambios"]');
    for (const b of bs) {
      b.click(); await espera(30);
      const d = await hasta(() => q('.detail:not([hidden])[data-dlg="cambios"]'), 2000, 'la ventana de la lista');
      igual(qa('.detail[data-dlg="cambios"] .vlist li').map(li => li.dataset.k), ['r1', 'r3', 'r2'], 'la lista, por fecha y cada una una vez');
      for (const li of qa('.detail[data-dlg="cambios"] .vlist li')) {
        const tip = celda(li.dataset.k).querySelector('.mk-cambios').dataset.tip;
        ok(li.querySelector('.vque').textContent.endsWith('· ' + tip), `la fila de ${li.dataset.k} no dice «${tip}»: ${li.querySelector('.vque').textContent}`);
      }
      ok(/\b3 publicaciones con cambios\b/.test(d.querySelector('h3').textContent), 'el título: ' + d.querySelector('h3').textContent);
      ok(!d.querySelector('.vacc, .vform') && qa('.detail[data-dlg="cambios"] .vlist button').every(x => x.dataset.cal === 'c-abrir'), 'la lista lleva acciones');
      M._in.closeDetail();
    }
    // se dibuja de nuevo con la mesa: r1 sin cambios ya no sale
    bs[0].click(); await hasta(() => q('.detail:not([hidden])[data-dlg="cambios"]'), 2000, 'la ventana otra vez');
    M._test.setNote('r1', 'Contexto r1');
    await hasta(() => json(qa('.detail[data-dlg="cambios"] .vlist li').map(li => li.dataset.k)) === json(['r3', 'r2']), 3000, 'r1 fuera de la lista abierta');
    // el nombre abre la publicación
    q('.detail[data-dlg="cambios"] li[data-k="r2"] .vnom').click();
    await hasta(() => { const d = dialogo(); return d && d.dataset.slot === 'r2' && !d.dataset.dlg; }, 3000, 'abrir r2 desde la lista');
    M._in.closeDetail();
    // sin calendario.js todavía: no falla y lo dice
    const cal = M.calendario; M.calendario = undefined;
    try { q('.bar .stats button[data-act="cambios"]').click(); await espera(30); ok(toastCon(/Vuelve a pulsar en un momento/), 'sin aviso sin calendario.js'); ok(!q('.detail:not([hidden])[data-dlg="cambios"]'), 'se abrió sin calendario.js'); }
    finally { M.calendario = cal; }
    // «Vista cliente»: no se ven y no abre
    M._in.root().classList.add('client');
    try { ok(qa('.bar .stats button').every(b => b.offsetParent === null), 'los botones salen en «Vista cliente»'); M.calendario.cambios(); ok(!q('.detail:not([hidden])[data-dlg="cambios"]'), 'abre en «Vista cliente»'); }
    finally { M._in.root().classList.remove('client'); }
  });

  // =====================================================================================================
  // Sin «Diseñar» (D-089): el diseñador sigue cargado y respondiendo, solo sin botón en la ventana
  // =====================================================================================================
  // el cliente de prueba toma prestado el kit de kits/uribe.json solo durante fn (el diseñador lo pide como
  // kits/prueba-regresion.json); al salir lo olvida, para que las demás pruebas sigan sin kit
  async function conKitPrueba(fn) {
    await hasta(() => M.diseno && M.diseno.cargar && M.libre, 6000, 'diseno.js y libre.js');
    const f0 = W.fetch, mio = `kits/${CLIENTE}.json`;
    W.fetch = function (u, o) { const s = typeof u === 'string' ? u : u && u.url; return f0.call(W, s && s.includes(mio) ? s.replace(mio, 'kits/uribe.json') : u, o); };
    try { return await fn(); }
    finally { W.fetch = f0; await M.diseno.kit(CLIENTE); }   // lo vuelve a pedir y no está: sin kit otra vez
  }
  // una publicación diseñada como la deja Claude: sus fotos, sus textos con cargar() y, si aplicar, «Aplicar»
  async function disenada(id, fotos, slides, aplicar = true) {
    await poner(id, fotos);
    const c = await M.diseno.cargar(id, { slides }); ok(c && !c.error, 'cargar() falló: ' + json(c));
    if (aplicar) { const r = await M.diseno.aplicar(id); ok(r && r.ok, 'aplicar() falló: ' + json(r)); }
    return slot(id);
  }
  const estadoDz = id => M.diseno.estadoDe(slot(id));
  const salida = id => ((slot(id).design || {}).out || []).filter(Boolean);
  const textoVentana = () => (dialogo() || {}).textContent || '';
  // la ventana abierta, sin botón ni texto que mande a «Diseñar»
  function sinDisenar(que) {
    const d = dialogo(); ok(d, 'sin ventana: ' + que);
    ok(!d.querySelector('[data-act="disenar"]'), 'la ventana tiene «Diseñar»: ' + que);
    const t = d.textContent, i = t.indexOf('Diseñar');
    ok(i < 0, `la ventana manda a «Diseñar» (${que}): …${t.slice(Math.max(0, i - 80), i + 20)}`);
  }
  const huella = async f => { const b = await M._in.getBlob(f), h = await W.crypto.subtle.digest('SHA-256', await b.arrayBuffer()); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join(''); };
  const abierto = (ms = 20000) => hasta(() => ed() && ed().el && ed().el.isConnected, ms, 'el editor abierto');
  const cerrarEd = async () => { M.libre.cerrar(); await hasta(() => !ed(), 2000, 'cerrar el editor'); };
  const DOS = ['portada', 'ficha'];
  const textos = (n, ...t) => t.map((titulo, i) => ({ tipo: DOS[i] || 'ficha', titulo: `${titulo} ${n}` }));

  prueba('D1', '«Editar diapositivas» con un diseño con cambios sin aplicar lo aplica antes y abre sus imágenes; cerrar y ⌘Z lo deshacen de una vez; si no se puede aplicar, el editor no abre y dice por qué (D-089)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d1a.jpg', 1080, 1350), await foto('d1b.jpg', 1080, 1350)], textos('D1', 'Portada', 'Ficha'), false);
      const crudas = slot('r1').photos.slice();
      igual(estadoDz('r1'), 'chg', 'el diseño cargado sin aplicar');
      M._in.openDetail('r1', 0); sinDisenar('carrusel con cambios sin aplicar');
      ok(textoVentana().includes('Diseño con cambios sin aplicar · se aplica al pulsar «Editar diapositivas»'), 'la ventana no dice que «Editar diapositivas» lo aplica');
      const h0 = M._test.hist().undo;
      await pulsar('.detail [data-act="editar"]');
      await abierto();
      igual(estadoDz('r1'), 'ok', 'el diseño no quedó aplicado');
      igual(slot('r1').photos, salida('r1'), 'la casilla no lleva sus imágenes');
      igual(salida('r1').length, 2, 'sus imágenes');
      igual(ed().sl.map(x => x.key), salida('r1'), 'el editor no abrió sus imágenes');
      ok(salida('r1').every(f => M.files[f] && M.files[f].design), 'sus imágenes no son de diseño');
      ok(toastCon(/ya está aplicado/), 'sin aviso de que se aplicó');
      await cerrarEd();
      igual(M._test.hist().undo, h0 + 1, 'aplicar y la sesión del editor no son un solo paso de ⌘Z');
      M._test.undo();
      igual(slot('r1').photos, crudas, '⌘Z no devolvió sus fotos');
      igual(estadoDz('r1'), 'chg', '⌘Z no dejó el diseño sin aplicar');
      await disenada('r2', [await foto('d1c.jpg', 1080, 1350)], textos('D1', 'Sin kit'), false);
    });
    // sin kit el diseñador no puede aplicar: el editor no abre y el aviso dice por qué, sin mandar a «Diseñar»
    const r = await M.libre.abrir('r2', 0);
    ok(r && r.error && /^No se pudo aplicar el diseño: .*kit/.test(r.error) && !r.error.includes('Diseñar'), 'el error: ' + json(r));
    ok(!ed(), 'el editor abrió sin aplicar');
    igual(estadoDz('r2'), 'chg', 'el diseño cambió sin poder aplicarse');
  });

  prueba('D2', 'Un reel sin foto no tiene botón de diseño y ⌘E no hace nada; con su foto, «Editar portada» abre su portada (D-089, D-088)', async () => {
    await tablero([pub(1, 'Reel')]);
    await hasta(() => M.libre, 4000, 'libre.js');
    M._in.openDetail('r1', 0); sinDisenar('reel sin foto');
    ok(!q('.detail [data-act="editar"]') && !q('.detail .pdz button'), 'el reel sin foto tiene un botón de diseño');   // su fila puede llevar solo la ubicación (D-124)
    ok(textoVentana().includes('Sin foto todavía'), 'la ventana no dice cómo ponerle foto');
    tecla('e', { meta: true }); await espera(80);
    ok(!ed(), '⌘E abrió el editor de un reel sin foto');
    await poner('r1', [await foto('d2.jpg', 1080, 1920)]);
    M._in.openDetail('r1', 0); sinDisenar('reel con foto');
    igual(qa('.detail .pdz button').map(b => b.textContent), ['Editar portada'], 'los botones de diseño del reel');
    await pulsar('.detail [data-act="editar"]');
    await abierto(4000);
    ok(ed().reel && ed().slotId === 'r1', 'no abrió la portada del reel');
    await cerrarEd();
  });

  prueba('D3', 'Un reel diseñado con la casilla vaciada conserva «Editar portada», que le devuelve su diseño aplicado; ni el aviso de vaciarla ni la ventana mandan a «Diseñar» (D-089)', async () => {
    await tablero([pub(1, 'Reel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d3.jpg', 1080, 1920)], [{ titulo: 'Portada D3' }]);
      igual(estadoDz('r1'), 'ok', 'el reel diseñado');
      M._test.unassign('r1', null, true);
      igual(slot('r1').photos, [], 'la casilla no se vació');
      ok(toastCon(/Imágenes del diseño quitadas de la casilla: vuelven al pulsar «Editar portada»/), 'el aviso de vaciarla');
      M._in.openDetail('r1', 0); sinDisenar('reel diseñado vacío');
      ok(textoVentana().includes('se aplica al pulsar «Editar portada»'), 'la ventana no dice que «Editar portada» lo aplica');
      await pulsar('.detail [data-act="editar"]');
      await abierto();
      ok(ed().reel, 'no abrió la portada');
      igual(estadoDz('r1'), 'ok', 'su diseño no volvió');
      igual([slot('r1').photos.length, slot('r1').photos], [1, salida('r1')], 'la casilla no lleva su imagen');
      igual(slot('r1').design.slides[0].titulo, 'Portada D3', 'la portada perdió su título');
      await cerrarEd();
    });
  });

  prueba('D4', 'La portada de un carrusel diseñado cambia sin «Diseñar»: intercambiada con otra publicación se redibuja sola; sin diapositiva de portada, el aviso manda a «Editar diapositivas» (D-089)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2), pub(3, 'Carrusel'), pub(4)]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d4a.jpg', 1080, 1350), await foto('d4b.jpg', 1080, 1350)], textos('D4', 'Portada', 'Ficha'));
      const [nueva] = await poner('r2', [await foto('d4c.jpg', 1080, 1350)]);
      const vieja = M.diseno._portada(slot('r1')), out0 = salida('r1');
      M._test.swap('r1', 'r2');
      await hasta(() => M.diseno._portada(slot('r1')) === nueva && estadoDz('r1') === 'ok' && !M.diseno.aplicando() && salida('r1')[0] !== out0[0], 20000, 'que se redibuje con la portada nueva');
      igual(slot('r2').photos, [vieja], 'la otra publicación no se quedó con la portada vieja');
      igual(slot('r1').photos, salida('r1'), 'la casilla no lleva sus imágenes');
      await disenada('r3', [await foto('d4d.jpg', 1080, 1350)], [{ tipo: 'final', titulo: 'Solo el final D4' }], false);   // su portada es su primera diapositiva que no es el final
      await poner('r4', [await foto('d4e.jpg', 1080, 1350)]);
      M._test.swap('r3', 'r4');
      ok(toastCon(/su diseño no tiene diapositiva de portada; cámbiala en «Editar diapositivas»/), 'el aviso sin diapositiva de portada');
    });
  });

  prueba('D5', 'En la ventana, un carrusel diseñado se reencuadra en vivo y cambia de formato sin «Diseñar»; con textos nuevos sin aplicar, la ventana manda a «Editar diapositivas», que los aplica (D-089)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await conKitPrueba(async () => {
      const sl = textos('D5', 'Portada', 'Ficha');
      await disenada('r1', [await foto('d5a.jpg', 1080, 1350), await foto('d5b.jpg', 1080, 1350)], sl);
      M._in.openDetail('r1', 0); sinDisenar('carrusel diseñado al día');
      ok(textoVentana().includes('Diseño aplicado · se sube tal cual'), 'la ventana no dice que está aplicado');
      const cv = await hasta(() => q('.detail .stage[data-live="1"] canvas.dzv'), 4000, 'el lienzo del reencuadre en vivo');
      ok(await M.diseno.vista(cv, 'r1', 0), 'el reencuadre en vivo no se prepara');
      await pulsar('.detail [data-act="fmt"][data-fmt="v34"]');
      await hasta(() => slot('r1').design.fmt === 'v34' && estadoDz('r1') === 'ok' && !M.diseno.aplicando() && M.files[salida('r1')[0]], 20000, 'el diseño redibujado en 3:4');
      const f0 = M.files[salida('r1')[0]]; cerca(f0.w / f0.h, 3 / 4, 0.01, 'la imagen no salió en 3:4');
      const c = await M.diseno.cargar('r1', { slides: [{ tipo: 'portada', titulo: 'Portada nueva' }, sl[1]] }); ok(c && !c.error, 'cargar(): ' + json(c));
      igual(estadoDz('r1'), 'chg', 'los textos nuevos sin aplicar');
      M._in.openDetail('r1', 0); sinDisenar('carrusel con textos nuevos');
      ok(textoVentana().includes('Diseño con cambios sin aplicar: se aplica al pulsar «Editar diapositivas»'), 'las herramientas no mandan a «Editar diapositivas»');
      ok(textoVentana().includes('Las demás diapositivas se cambian en «Editar diapositivas»'), 'las miniaturas no mandan a «Editar diapositivas»');
      await pulsar('.detail [data-act="editar"]');
      await abierto();
      igual([estadoDz('r1'), slot('r1').design.slides[0].titulo], ['ok', 'Portada nueva'], 'no aplicó los textos nuevos');
      await cerrarEd();
    });
  });

  prueba('D6', 'Un carrusel diseñado que pasa a reel queda pendiente y «Editar portada» lo aplica; el tipo cambiado en Notion avisa sin mandar a «Diseñar» (D-089)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d6a.jpg', 1080, 1350), await foto('d6b.jpg', 1080, 1350)], textos('D6', 'Portada', 'Ficha'));
      M._test.setType('r1', 'Reel');
      igual([slot('r1').type, estadoDz('r1')], ['Reel', 'chg'], 'el diseño convertido no quedó pendiente');
      M._in.openDetail('r1', 0); sinDisenar('reel convertido');
      ok(textoVentana().includes('se aplica al pulsar «Editar portada»'), 'la ventana no dice que «Editar portada» lo aplica');
      await pulsar('.detail [data-act="editar"]');
      await abierto();
      ok(ed().reel, 'no abrió la portada');
      igual([estadoDz('r1'), salida('r1').length, slot('r1').design.slides[0].titulo], ['ok', 1, 'Portada D6'], 'no aplicó su portada');
      igual(slot('r1').photos, salida('r1'), 'la casilla no lleva su imagen');
      await cerrarEd();
      // desde Notion: un carrusel diseñado que llega como reel
      await tablero([pub(2, 'Carrusel')]);
      await disenada('r2', [await foto('d6c.jpg', 1080, 1350)], textos('D6', 'Notion'));
      await M.flush();
      await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, slots: [{ ...pub(2, 'Carrusel'), type: 'Reel' }], past: [], force: true });
      await hasta(() => toastCon(/En Notion cambió el tipo de Carrusel 1\.2: su diseño se ha convertido y se aplica al pulsar su «Editar …»/), 4000, 'el aviso del tipo cambiado en Notion');
      igual(estadoDz('r2'), 'chg', 'el diseño de Notion no quedó pendiente');
    });
  });

  prueba('D7', 'Una collab enlazada con un diseño pendiente: «Editar» lo aplica y la copia del otro cliente recibe el mismo diseño y las mismas imágenes (D-089, D-008)', async () => {
    await limpiar();
    const col = { id: 'colab-d7', name: 'COLLAB Carrusel D7', type: 'Carrusel', date: `${MES}-10T12:00:00.000+01:00` };
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [col], past: [], force: true });
    await M.flush();
    await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, slots: [col], past: [], force: true });
    igual(M._test.shared('colab-d7').length, 1, 'la collab no quedó enlazada');
    await conKitPrueba(async () => {
      await disenada('colab-d7', [await foto('d7a.jpg', 1080, 1350), await foto('d7b.jpg', 1080, 1350)], textos('D7', 'Collab', 'Ficha'), false);
      const r = await M.libre.abrir('colab-d7', 0); ok(r && r.ok, 'no abrió: ' + json(r));
      await cerrarEd();
      igual(estadoDz('colab-d7'), 'ok', 'no se aplicó');
    });
    await M.flush();
    const s = slot('colab-d7');
    const otra = await hasta(async () => { const b = await M._in.idbGet('boards', `${CLIENTE2}-${MES}`), x = b && b.slots.find(y => y.id === 'colab-d7'); return x && x.design && x.design.sig === s.design.sig && x; }, 6000, 'que el diseño llegue a la copia del otro cliente');
    igual([otra.photos, otra.design.out, otra.design.slides.map(x => x.titulo)], [s.photos, s.design.out, ['Collab D7', 'Ficha D7']], 'la copia del otro cliente no es igual');
  });

  prueba('D8', 'Exportar e importar un carrusel diseñado lo devuelve igual: su diseño, sus imágenes de diseño y al día (D-089, D-017)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d8a.jpg', 1080, 1350), await foto('d8b.jpg', 1080, 1350)], textos('D8', 'Portada', 'Ficha'));
      await M.flush();
      const antes = json({ photos: slot('r1').photos, design: slot('r1').design });
      const blob = await M.exportAll({ returnBlob: true }); ok(blob && blob.size > 1000, 'la exportación salió vacía');
      await sinMes(`${CLIENTE}-${MES}`);
      const r = await M.importData(blob, { confirm: false }); ok(r && !r.error, 'importar falló: ' + json(r));
      await M.open(`${CLIENTE}-${MES}`);
      igual(json({ photos: slot('r1').photos, design: slot('r1').design }), antes, 'el diseño importado no es igual');
      ok(salida('r1').length === 2 && salida('r1').every(f => M.files[f] && M.files[f].design), 'sus imágenes no llegaron como de diseño');
      igual(estadoDz('r1'), 'ok', 'el diseño importado no está al día');
    });
  });

  prueba('D9', 'Descargar y «Revisar» leen un carrusel diseñado como antes: «Solo la foto» da su foto y «Con textos» su imagen, y «Revisar» no lo marca (D-089, D-083, D-040)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d9a.jpg', 1080, 1350), await foto('d9b.jpg', 1080, 1350)], [{ tipo: 'portada', titulo: 'UN TITULAR GRANDE D9' }, { tipo: 'ficha', titulo: 'Ficha D9' }]);
      await hasta(() => M.descargar && M.descargar._pieza && M.revisar, 6000, 'descargar.js y revisar.js');
      const s = slot('r1'), fid = salida('r1')[0];
      const px = async b => { const bm = await W.createImageBitmap(b), c = D.createElement('canvas'); c.width = 108; c.height = Math.round(108 * bm.height / bm.width); const x = c.getContext('2d'); x.drawImage(bm, 0, 0, c.width, c.height); const w = bm.width; bm.close(); return { w, d: x.getImageData(0, 0, c.width, c.height).data }; };
      const dif = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) n += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return n / (a.length / 4); };
      const con = await px((await M.descargar._pieza(s, fid, { textos: true, ancho: '1080' })).blob), sin = await px((await M.descargar._pieza(s, fid, { textos: false, ancho: '1080' })).blob);
      const foto0 = await px(await M._in.getBlob(s.design.slides[0].src));
      igual([con.w, sin.w], [1080, 1080], 'el ancho de las piezas');
      ok(dif(sin.d, foto0.d) < 3, '«Solo la foto» no es su foto: ' + dif(sin.d, foto0.d).toFixed(2));
      ok(dif(con.d, sin.d) > 2, '«Con textos» sale sin sus textos: ' + dif(con.d, sin.d).toFixed(2));
      const r = await M.revisar();
      igual(r.puntos.filter(p => p.slotId === 'r1'), [], '«Revisar» marca el carrusel diseñado');
    });
  });

  prueba('D10', 'Todas las funciones de M.diseno siguen y responden: estado, ver, kit, estadoDe, aplicando, abierto, y abrir y cerrar el diseñador por la API (D-089)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await hasta(() => M.diseno && M.diseno.cargar, 6000, 'diseno.js');
    const NOMBRES = ['cargar', 'estado', 'aplicar', 'ver', 'kit', 'ajustarKit', 'fijarFinal', 'abrir', 'cerrar', 'estadoDe', 'prepararKits', 'sync', 'volcar', 'aplicando', '_retipo', '_sustituir', '_portada', '_ponerPortada', 'reaplicar', 'vista', 'vistaEmpezar', 'vistaMover', 'vistaZoom', 'vistaCentrar', 'vistaSoltar', 'vistaLibre', 'formato', '_srcVista', '_tienePortada', 'abierto'];
    igual(NOMBRES.filter(k => typeof M.diseno[k] !== 'function'), [], 'funciones de M.diseno que faltan');
    ok(typeof M.diseno.version === 'string', 'M.diseno sin versión');
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d10a.jpg', 1080, 1350), await foto('d10b.jpg', 1080, 1350)], textos('D10', 'Portada', 'Ficha'));
      const e = await M.diseno.estado('r1'); ok(e && e.aplicado === true && e.slides.length === 2, 'estado(): ' + json(e).slice(0, 300));
      const v = await M.diseno.ver('r1', 1); ok(v && v.n === 1 && M.out.diseno && M.out.diseno.size > 0, 'ver(): ' + json(v));
      const k = await M.diseno.kit(CLIENTE); ok(k && !k.error && k.lienzo, 'kit(): ' + json(k).slice(0, 200));
      igual([M.diseno.estadoDe(slot('r1')), M.diseno.aplicando(), M.diseno.abierto(), M.diseno._tienePortada(slot('r1'))], ['ok', false, null, true], 'estadoDe, aplicando, abierto y _tienePortada');
      M.diseno.abrir('r1');
      await hasta(() => M.diseno.abierto(), 6000, 'el diseñador abierto por la API');
      igual(M.diseno.abierto().slot, 'r1', 'el diseñador abrió otra publicación');
      M.diseno.cerrar(); await hasta(() => !M.diseno.abierto(), 3000, 'cerrar el diseñador');
    });
  });

  prueba('D11', 'Un carrusel diseñado y al día se ve igual: la casilla, la ventana y el editor enseñan sus mismas imágenes, con los mismos bytes, y abrir y cerrar el editor no lo redibuja (D-089)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d11a.jpg', 1080, 1350), await foto('d11b.jpg', 1080, 1350)], textos('D11', 'Portada', 'Ficha'));
      const out = salida('r1'), h0 = await Promise.all(out.map(huella)), n0 = Object.keys(M.files).length, sig0 = slot('r1').design.sig;
      igual(slot('r1').photos, out, 'la casilla no lleva sus imágenes');
      const img = () => celda('r1').querySelector('img.crop'), vista0 = [img().getAttribute('src'), img().getAttribute('style')];
      igual(vista0[0], M.files[out[0]].thumbUrl, 'la casilla no enseña su imagen');
      M._in.openDetail('r1', 1);
      igual(q('.detail .stage').dataset.file, out[1], 'la ventana no enseña su imagen');
      await pulsar('.detail [data-act="editar"]');
      await abierto(6000);
      igual([ed().sl.map(x => x.key), ed().i], [out, 1], 'el editor no abrió sus imágenes en la diapositiva que se ve');
      ok(ed().sl.every(x => !x.out && x.raw), 'el editor no las abrió como imagen');
      await cerrarEd();
      igual([slot('r1').photos, salida('r1'), slot('r1').design.sig, Object.keys(M.files).length], [out, out, sig0, n0], 'abrir el editor lo redibujó');
      igual(await Promise.all(out.map(huella)), h0, 'sus imágenes cambiaron de bytes');
      igual([img().getAttribute('src'), img().getAttribute('style')], vista0, 'la casilla cambió');
      igual(estadoDz('r1'), 'ok', 'dejó de estar al día');
    });
  });

  prueba('D12', 'Ningún botón ni texto manda a «Diseñar»: ni el código de la mesa, el editor y el diseñador, ni la ventana de un carrusel, una Foto o un reel sin diseño (D-089)', async () => {
    for (const a of ['mesa.js', 'libre.js', 'diseno.js']) {
      const t = await (await fetch(`../${a}?v=${Date.now()}`, { cache: 'no-store' })).text();
      ok(t.length > 1000 && !t.includes('«Diseñar»') && !t.includes('data-act="disenar"'), `${a} todavía manda a «Diseñar»`);
    }
    await tablero([pub(1, 'Carrusel'), pub(2), pub(3, 'Reel')]);
    await hasta(() => M.libre, 4000, 'libre.js');
    await poner('r1', [await foto('d12a.jpg'), await foto('d12b.jpg')]);
    await poner('r2', [await foto('d12c.jpg')]);
    await poner('r3', [await foto('d12d.jpg', 1080, 1920)]);
    for (const [id, et] of [['r1', 'Editar diapositivas'], ['r2', 'Editar foto'], ['r3', 'Editar portada']]) {
      M._in.openDetail(id, 0); sinDisenar(id);
      igual(qa('.detail .pdz button').map(b => b.textContent), [et], 'los botones de diseño de ' + id);
    }
  });

  prueba('D13', 'Un diseño vacío que nunca se aplicó (abrir el diseñador y cerrarlo sin hacer nada) desaparece al abrir el tablero: sin «cambios sin aplicar», con su foto y su recorte; uno con textos sin aplicar se queda (D-090)', async () => {
    await tablero([pub(1, 'Reel'), pub(2, 'Carrusel')]);
    const key = `${CLIENTE}-${MES}`;
    await conKitPrueba(async () => {
      const [f1] = await poner('r1', [await foto('d13a.jpg', 1080, 1920)]);
      M.diseno.abrir('r1');
      await hasta(() => M.diseno.abierto(), 6000, 'el diseñador abierto');
      M.diseno.cerrar(); await hasta(() => !M.diseno.abierto(), 3000, 'cerrar el diseñador');
      ok(slot('r1').design && !salida('r1').length, 'abrir y cerrar el diseñador no dejó su diseño vacío (el caso a arreglar)');
      igual(estadoDz('r1'), 'chg', 'el diseño vacío no salía como «cambios sin aplicar»');
      await disenada('r2', [await foto('d13b.jpg', 1080, 1350)], textos('D13', 'Con texto'), false);
      const recorte = M._test.cropSig('r1');
      await M.flush();
      await M.open(key);
      ok(!slot('r1').design, 'el diseño vacío sigue al abrir el tablero');
      igual([slot('r1').photos, M._test.cropSig('r1')], [[f1], recorte], 'el reel cambió de foto o de recorte');
      igual(estadoDz('r1'), null, 'el reel sigue con estado de diseño');
      M._in.openDetail('r1', 0); sinDisenar('reel sin su diseño vacío');
      ok(!textoVentana().includes('cambios sin aplicar'), 'la ventana sigue diciendo «cambios sin aplicar»');
      igual(qa('.detail .pdz button').map(b => b.textContent), ['Editar portada'], 'los botones de diseño del reel');
      ok(slot('r2').design && slot('r2').design.slides[0].titulo === 'Con texto D13' && estadoDz('r2') === 'chg', 'el diseño con textos sin aplicar no se quedó');
      await M.flush();
      const g = await M._in.idbGet('boards', key);
      ok(!g.slots.find(x => x.id === 'r1').design && g.slots.find(x => x.id === 'r2').design, 'lo guardado no es lo que se ve');
    });
  });

  // =====================================================================================================
  // Tamaño de las fotos de la bandeja (D-091)
  // =====================================================================================================
  const LS_TAM = 'mesa-bandeja-tamano', LS_TAM_ED = 'mesa-lb-bandeja-tamano';
  const barra = () => q('.trayhead .ttam'), barraEd = () => ed() && ed().el.querySelector('.lb-foot .ttam');
  const visto = el => !!el && !el.closest('[hidden]') && W.getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  // la barra de tamaño a v, como al soltarla (no es la deslizar del panel del editor)
  function aTam(b, v) { const r = b.querySelector('input'); r.value = v; r.dispatchEvent(new W.Event('input', { bubbles: true })); r.dispatchEvent(new W.Event('change', { bubbles: true })); }
  const dobleClic = b => b.querySelector('input').dispatchEvent(new W.MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  const columnas = () => W.getComputedStyle(q('.tray .tgrid')).gridTemplateColumns.split(' ').length;
  const tw = () => q('.tray').style.getPropertyValue('--tw');
  const cajas = sel => qa(sel).map(e => e.getBoundingClientRect());
  // un mes con fotos en la bandeja: una horizontal (H), dos en un carrusel (✓ con «Todas») y una en una carpeta
  async function bandejaTam(n = 12) {
    W.localStorage.removeItem(LS_TAM); W.localStorage.removeItem(LS_TAM_ED);
    await tablero([pub(1, 'Carrusel'), pub(2), pub(3)]);
    const fs = []; for (let i = 0; i < n; i++) fs.push(await foto(`t${i}.jpg`, i === 2 ? 1600 : 900, i === 2 ? 1000 : 1200));
    const ids = await M.addFiles(fs);
    ok(ids.length === n, 'no entraron las fotos');
    M._test.place('r1', ids[0]); M._test.place('r1', ids[1]);
    const c = M.crearCarpeta('Carpeta T');
    M._in.trayMover({ files: [ids[n - 1]] }, c.id, null);
    await M.flush(); M._in.trayAbrir(null); M._in.renderTray();
    q('.tray').scrollTop = 0;
    await hasta(() => visto(barra()), 3000, 'la barra en la cabecera de la bandeja');
    return { ids, c };
  }
  // la bandeja y el editor vuelven al tamaño de siempre, sin nada guardado
  function sinTam() {
    if (barra()) aTam(barra(), 50);
    if (barraEd()) aTam(barraEd(), 50);
    W.localStorage.removeItem(LS_TAM); W.localStorage.removeItem(LS_TAM_ED);
    M._in.trayFiltro('sin'); M._in.traySoltar();
  }
  async function editorConBandeja(slotId = 'r1') {
    await abrirEditor(slotId);
    if (!ed().trOpen) accion('bandeja');
    await hasta(() => visto(ed().el.querySelector('.lb-trs')), 3000, 'la bandeja del editor abierta');
  }

  prueba('T1', 'Sin nada guardado la barra sale en el centro y todo es como siempre: columnas de 92 px con nombre y «N fotos», 72 px en el editor; la barra no mueve ni tapa nada (D-091)', async () => {
    const { c } = await bandejaTam();
    try {
      igual(+barra().querySelector('input').value, 50, 'la barra de la mesa no sale en el centro');
      ok(!tw() && !q('.tray').classList.contains('tam-on'), 'la bandeja lleva un tamaño');
      const g = q('.tray .tgrid'), w = g.clientWidth;
      igual(columnas(), Math.floor((w + 6) / 98), 'las columnas no son las de 92 px');
      const cs = cajas('.tray .tgrid > *');
      ok(cs.every(b => b.width >= 92 && Math.abs(b.width - cs[0].width) < 0.6 && Math.abs(b.height - cs[0].height) < 0.6), 'fotos y carpetas no miden lo mismo');
      ok(visto(q('.tray .titem .tname')) && visto(q(`.tcarpeta[data-id="${c.id}"] .cf`)), 'falta el nombre o el «N fotos»');
      // la barra, entre «Sin usar / Todas» y «Añadir fotos»; quitarla no mueve nada de la cabecera
      const h = q('.trayhead'), pos = () => [...h.children].filter(e => !e.classList.contains('ttam')).map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); });
      const b = barra().getBoundingClientRect(), f = h.querySelector('.tfil').getBoundingClientRect(), a = h.querySelector('.btn').getBoundingClientRect();
      ok(b.left > f.right && b.right < a.left, 'la barra pisa «Sin usar / Todas» o «Añadir fotos»');
      const con = pos(); barra().hidden = true; const sin = pos(); barra().hidden = false;
      igual(con, sin, 'la barra mueve la cabecera');
      await editorConBandeja();
      ok(visto(barraEd()) && +barraEd().querySelector('input').value === 50, 'la barra del editor no sale en el centro');
      const es = cajas('.lb-tray .lb-tph, .lb-tray .lb-tcarp');
      ok(es.length > 3 && es.every(x => Math.abs(x.width - 72) < 0.6 && Math.abs(x.height - 72) < 0.6), 'las fotos del editor no miden 72 px: ' + json(es.map(x => x.width)));
      ok(!ed().el.querySelector('.lb-tray').classList.contains('tam-on'), 'la bandeja del editor lleva un tamaño');
      const be = barraEd().getBoundingClientRect(), t = q('.lb-trb').getBoundingClientRect(), hp = q('.lb-help').getBoundingClientRect();
      ok(be.left > t.right && be.right < hp.left, 'la barra del editor pisa «Bandeja» o «?»');
      accion('bandeja'); ok(!visto(barraEd()), 'la barra del editor sigue con la bandeja cerrada');
      accion('bandeja'); ok(visto(barraEd()), 'la barra del editor no vuelve con la bandeja');
      M.libre.cerrar();
    } finally { sinTam(); }
  });

  prueba('T2', 'Mesa: a la izquierda 46 px, sin nombre ni «N fotos» y con H, ✓, selección y ×; a la derecha 3 por fila, también al cambiar el ancho; dos tramos rectos; las carpetas cambian con las fotos (D-091)', async () => {
    const { ids, c } = await bandejaTam();
    const fr = $('mesa'), w0 = fr.style.width;
    try {
      M._in.trayFiltro('todas');
      aTam(barra(), 0);
      igual(W.localStorage.getItem(LS_TAM), '0', 'no se guardó');
      const w = q('.tray .tgrid').clientWidth;
      igual([tw(), columnas()], ['46px', Math.floor((w + 6) / 52)], 'a la izquierda');
      let cs = cajas('.tray .tgrid > *');
      ok(cs.every(b => b.width >= 46 && b.width < 52.5 && Math.abs(b.height - cs[0].height) < 0.6), 'fotos o carpetas fuera de 46 px: ' + json(cs.map(b => Math.round(b.width))));
      ok(!visto(q('.tray .titem .tname')) && !visto(q(`.tcarpeta[data-id="${c.id}"] .cf`)), 'siguen el nombre o el «N fotos»');
      const t = tile(c.id); ok(t.scrollHeight <= t.clientHeight + 1 && visto(t.querySelector('svg')) && visto(t.querySelector('.cn')), 'la carpeta no cabe en su casilla');
      ok(visto(q('.tray .titem .hb')), 'falta la H');
      ok(W.getComputedStyle(q('.tray .titem.uso'), '::after').content.includes('✓'), 'falta el ✓');
      conCmd(titem(ids[3]));
      ok(titem(ids[3]).classList.contains('elegida') && W.getComputedStyle(titem(ids[3])).outlineStyle === 'solid', 'no se marca lo elegido');
      M._in.traySoltar();
      const x = titem(ids[3]).querySelector('.x'); x.style.display = 'block';
      const xr = x.getBoundingClientRect(), tr = titem(ids[3]).getBoundingClientRect(); x.style.display = '';
      ok(xr.width >= 20 && xr.right <= tr.right && xr.top >= tr.top, 'la × no está o se sale');
      ok(xr.bottom < tr.top + tr.height / 2 && xr.left > tr.left + tr.width / 2 - 1, 'la × tapa el centro de la foto: un clic la quitaría en vez de abrirla');
      aTam(barra(), 25); igual(tw(), '69px', 'el tramo de la izquierda no es recto');
      aTam(barra(), 100);
      const tope = Math.floor((w - 12) / 3);
      igual([tw(), columnas()], [tope + 'px', 3], 'a la derecha');
      cs = cajas('.tray .tgrid > *');
      ok(cs.every(b => Math.abs(b.width - cs[0].width) < 0.6 && Math.abs(b.height - cs[0].height) < 0.6), 'fotos y carpetas no miden lo mismo a la derecha');
      ok(visto(q('.tray .titem .tname')) && visto(q(`.tcarpeta[data-id="${c.id}"] .cf`)), 'a la derecha falta el nombre o el «N fotos»');
      aTam(barra(), 75); igual(tw(), Math.floor(92 + (tope - 92) / 2) + 'px', 'el tramo de la derecha no es recto');
      aTam(barra(), 100);
      fr.style.width = '1000px';
      await hasta(() => q('.tray .tgrid').clientWidth < w - 100 && tw() === Math.floor((q('.tray .tgrid').clientWidth - 12) / 3) + 'px', 3000, 'el tope de 3 por fila con el ancho nuevo');
      igual(columnas(), 3, '3 por fila con el ancho nuevo');
      fr.style.width = w0;
      await hasta(() => tw() === tope + 'px', 3000, 'el tope al volver al ancho');
    } finally { fr.style.width = w0; sinTam(); }
  });

  prueba('T3', 'Editor: a la izquierda 36 px y a la derecha 144 px, siempre una fila, las carpetas con las fotos; se guarda aparte de la mesa (D-091)', async () => {
    const { c } = await bandejaTam();
    try {
      await editorConBandeja();
      for (const [v, px] of [[0, 36], [25, 54], [100, 144], [75, 108]]) {
        aTam(barraEd(), v);
        const es = cajas('.lb-tray .lb-tph, .lb-tray .lb-tcarp');
        ok(es.every(x => Math.abs(x.width - px) < 0.6 && Math.abs(x.height - px) < 0.6), `en ${v} no miden ${px} px: ${json(es.map(x => Math.round(x.width)))}`);
        ok(es.every(x => Math.abs(x.top - es[0].top) < 0.6), `en ${v} no es una fila`);
        const k = ed().el.querySelector(`.lb-tcarp[data-id="${c.id}"]`); ok(k && visto(k.querySelector('svg')), `en ${v} la carpeta no se ve`);
      }
      igual([W.localStorage.getItem(LS_TAM_ED), W.localStorage.getItem(LS_TAM)], ['75', null], 'lo guardado');
      aTam(barraEd(), 0);
      ok(visto(ed().el.querySelector('.lb-tph .hb')), 'falta la H en el editor');
      await espera(100); await dibujado();
      const k0 = ed().k; aTam(barraEd(), 100);
      await hasta(() => { M.libre._dibujar(); return ed().k < k0 - 0.005; }, 3000, 'que la diapositiva deje sitio a la bandeja más alta');
      M.libre.cerrar();
      ok(!tw(), 'el editor cambió la bandeja de la mesa');
    } finally { if (M.libre.abierto()) M.libre.cerrar(); sinTam(); }
  });

  prueba('T4', 'El tamaño se recuerda al recargar, uno en la mesa y otro en el editor, en este navegador: ni en el tablero ni en «Exportar» (D-091)', async () => {
    await bandejaTam();
    try {
      aTam(barra(), 20);
      await editorConBandeja(); aTam(barraEd(), 80); M.libre.cerrar();
      await M.flush();
      const g = await M._in.idbGet('boards', `${CLIENTE}-${MES}`);
      ok(!/tama|"--tw"/.test(json(g)), 'el tamaño entró en el tablero');
      const blob = await M.exportAll({ returnBlob: true });
      ok(!/bandeja-tamano/.test(await blob.text()), 'el tamaño entró en la exportación');
      await preparar();                              // recargar la mesa
      if (!M.board() || M.board().key !== `${CLIENTE}-${MES}`) await M.open(`${CLIENTE}-${MES}`);
      await hasta(() => barra(), 3000, 'la barra tras recargar');
      igual([+barra().querySelector('input').value, tw()], [20, '64px'], 'la mesa no lo recuerda');
      await editorConBandeja();
      igual(+barraEd().querySelector('input').value, 80, 'el editor no lo recuerda');
      const es = cajas('.lb-tray .lb-tph'); ok(es.every(x => Math.abs(x.width - 115) < 0.6), 'el editor no lo aplica: ' + json(es.map(x => x.width)));
      M.libre.cerrar();
    } finally { if (M.libre.abierto()) M.libre.cerrar(); sinTam(); }
  });

  prueba('T5', 'Doble clic en la barra vuelve al centro, en la mesa y en el editor; tocar la barra no suelta lo elegido (D-091)', async () => {
    const { ids } = await bandejaTam();
    try {
      conCmd(titem(ids[3])); conCmd(titem(ids[4]));
      aTam(barra(), 10);
      barra().querySelector('input').dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true }));
      igual(M._in.trayLote().files, [ids[3], ids[4]], 'la barra soltó lo elegido');
      dobleClic(barra());
      igual([+barra().querySelector('input').value, W.localStorage.getItem(LS_TAM), tw(), q('.tray').classList.contains('tam-on')], [50, '50', '', false], 'el doble clic no vuelve al centro');
      igual(columnas(), Math.floor((q('.tray .tgrid').clientWidth + 6) / 98), 'las columnas no son las de siempre');
      igual(M._in.trayLote().files, [ids[3], ids[4]], 'el doble clic soltó lo elegido');
      M._in.traySoltar();
      await editorConBandeja();
      aTam(barraEd(), 90); dobleClic(barraEd());
      igual([+barraEd().querySelector('input').value, W.localStorage.getItem(LS_TAM_ED)], [50, '50'], 'el doble clic del editor no vuelve al centro');
      ok(cajas('.lb-tray .lb-tph').every(x => Math.abs(x.width - 72) < 0.6), 'el editor no vuelve a 72 px');
      M.libre.cerrar();
    } finally { if (M.libre.abierto()) M.libre.cerrar(); sinTam(); }
  });

  prueba('T6', 'En los dos extremos funcionan el clic con ← →, ⌘+clic, arrastrar a casilla, carpeta y pestaña, ⌘Z y soltar del ordenador, en la mesa y en el editor (D-091)', async () => {
    const enEl = (el, fy = 0.5) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + Math.min(r.height * fy, 30)]; };
    const arrastrar = (de, a) => {                   // con el ratón, de una foto de la bandeja a un punto de la mesa
      const [x0, y0] = enEl(de); puntero('pointerdown', de, x0, y0);
      puntero('pointermove', D, x0 + 8, y0 + 8); puntero('pointermove', D, a[0], a[1]); puntero('pointerup', D, a[0], a[1]);
    };
    const soltarArchivo = async (en, nombre) => { const dt = new W.DataTransfer(); dt.items.add(await foto(nombre, 900, 1200)); en.dispatchEvent(new W.DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); };
    const conNombre = (fs, n) => fs.some(x => M.files[x] && M.files[x].name === n);
    try {
      for (const v of [0, 100]) {
        // ---- la mesa ----
        const { ids, c: k } = await bandejaTam(), f = ids.slice(2, -1);
        aTam(barra(), v); q('.tray').scrollTop = 0;
        ok(v ? columnas() === 3 : tw() === '46px', `la bandeja no está en ${v}`);
        titem(f[0]).click();
        await hasta(() => dialogo() && dialogo().dataset.dlg === 'trayview', 2000, `en ${v}, la foto en grande`);
        const n0 = dialogo().dataset.file; tecla('ArrowRight'); await espera(30);
        ok(dialogo().dataset.file !== n0, `en ${v}, → no pasa a la siguiente`);
        tecla('ArrowLeft'); await espera(30); igual(dialogo().dataset.file, n0, `en ${v}, ← no vuelve`);
        M._in.closeDetail();
        conCmd(titem(f[1])); conCmd(titem(f[2])); conCmd(tile('historias'));
        igual(M._in.trayLote(), { files: [f[1], f[2]], carpetas: ['historias'] }, `en ${v}, ⌘+clic`);
        M._in.traySoltar();
        conCmd(titem(f[1])); conCmd(titem(f[2]));
        arrastrar(titem(f[1]), enEl(tile(k.id), 0.2));
        await hasta(() => carp(k.id).files.includes(f[1]) && carp(k.id).files.includes(f[2]), 3000, `en ${v}, arrastrar las elegidas a la carpeta`);
        M._test.undo(); await hasta(() => !carp(k.id).files.includes(f[1]) && !carp(k.id).files.includes(f[2]), 2000, `en ${v}, ⌘Z`);
        M._in.traySoltar();
        arrastrar(titem(f[3]), enEl(celda('r2')));
        await hasta(() => slot('r2').photos.includes(f[3]), 3000, `en ${v}, arrastrar a la casilla`);
        M._in.pestNueva(k.id); M._in.pestIr('fija'); M._in.renderTray();
        arrastrar(titem(f[4]), enEl(q('.cptab:not(.fija) button')));
        await hasta(() => carp(k.id).files.includes(f[4]), 3000, `en ${v}, arrastrar a la pestaña`);
        await soltarArchivo(q('.tray .tgrid'), `t6-${v}a.jpg`);
        await hasta(() => conNombre(M._in.bandejaVista({ carpeta: null }).map(x => x.f), `t6-${v}a.jpg`), 4000, `en ${v}, soltar del ordenador en la bandeja`);
        await soltarArchivo(tile(k.id), `t6-${v}b.jpg`);
        await hasta(() => conNombre(carp(k.id).files, `t6-${v}b.jpg`), 4000, `en ${v}, soltar del ordenador en la carpeta`);
        M._in.clearToasts(); sinTam();
        // ---- el editor ----
        const [a, b, e3, e4] = await conHuecos([HV('v1'), HV('v2', 0.5)], [V(`t6${v}a.jpg`), V(`t6${v}b.jpg`), V(`t6${v}c.jpg`), V(`t6${v}d.jpg`)]);
        const cid = M.crearCarpeta('Carpeta E').id;
        await hasta(() => visto(barraEd()), 2000, `en ${v}, la barra del editor`);
        aTam(barraEd(), v); await dibujado();
        ok(Math.abs(miniatura(a).getBoundingClientRect().width - (v ? 144 : 36)) < 0.6, `el editor no está en ${v}`);
        conMeta(a); conMeta(b);
        igual(elegidas(), [a, b], `en ${v}, ⌘+clic en el editor`);
        arrastrarDeBandeja(a, 0.2, 0.5);
        await hasta(() => (enCapa('v1', a) || enCapa('v2', a)) && (enCapa('v1', b) || enCapa('v2', b)), 4000, `en ${v}, las dos elegidas a sus huecos`);
        miniatura(e3).click();
        await hasta(() => compDe(1).els.some(x => x.src === e3), 4000, `en ${v}, clic: a la diapositiva`);
        await hasta(() => miniatura(e4) && ed().el.querySelector(`.lb-tcarp[data-id="${cid}"]`), 2000, `en ${v}, la carpeta en el cajón`);
        { const m = miniatura(e4), r = m.getBoundingClientRect(), [x1, y1] = enEl(ed().el.querySelector(`.lb-tcarp[data-id="${cid}"]`));
          puntero('pointerdown', m, r.left + 5, r.top + 5); puntero('pointermove', D, x1, y1); puntero('pointerup', D, x1, y1); }
        await hasta(() => carp(cid).files.includes(e4), 3000, `en ${v}, arrastrar a una carpeta del cajón`);
        await soltarArchivo(ed().el.querySelector('.lb-trs'), `t6-${v}c.jpg`);
        await hasta(() => [...ed().el.querySelectorAll('.lb-tph')].some(x => M.files[x.dataset.f] && M.files[x.dataset.f].name === `t6-${v}c.jpg`), 4000, `en ${v}, soltar del ordenador en la bandeja del editor`);
        M.libre.cerrar(); M._in.clearToasts(); sinTam();
      }
    } finally { if (M.libre.abierto()) M.libre.cerrar(); sinTam(); }
  });

  prueba('T7', 'Con la ventana a 720 px o menos no hay barra y la tira sigue de 48 × 64, aunque haya un tamaño guardado; la rueda la sigue desplazando (D-091)', async () => {
    await bandejaTam(30);
    const fr = $('mesa'), w0 = fr.style.width;
    try {
      aTam(barra(), 0); await editorConBandeja(); aTam(barraEd(), 100); M.libre.cerrar();
      fr.style.width = '700px';
      await hasta(() => W.innerWidth <= 720 && !visto(barra()) && !tw(), 3000, 'sin barra en la ventana estrecha');
      const cs = cajas('.tray .tgrid > *'); ok(cs.every(b => Math.abs(b.width - 48) < 0.6 && Math.abs(b.height - 64) < 0.6), 'la tira no es de 48 × 64: ' + json(cs.map(b => [b.width, b.height])));
      ok(visto(q('.tray .titem .tname')), 'la tira perdió el nombre');
      const tb = q('.tray .tbody'), x0 = tb.scrollLeft, r = tb.getBoundingClientRect();
      rueda(tb, r.left + 20, r.top + 20, 120); ok(tb.scrollLeft > x0, 'la rueda no desplaza la tira');
      await editorConBandeja();
      await hasta(() => !visto(barraEd()), 2000, 'sin barra en el editor estrecho');
      ok(cajas('.lb-tray .lb-tph').every(x => Math.abs(x.width - 72) < 0.6), 'el editor estrecho no usa 72 px');
      M.libre.cerrar();
      fr.style.width = w0;
      await hasta(() => visto(barra()) && tw() === '46px', 3000, 'la barra y el tamaño al volver a ensanchar');
    } finally { fr.style.width = w0; if (M.libre.abierto()) M.libre.cerrar(); sinTam(); }
  });

  // ---------- el pellizco sobre la bandeja mueve su barra (D-118) ----------
  // Chrome y la app: rueda con ctrlKey; Safari: gesturestart / gesturechange / gestureend con su scale
  const pellizco = (en, dy, x, y) => { const r = en.getBoundingClientRect(); return rueda(en, x ?? r.left + r.width / 2, y ?? r.top + r.height / 2, dy, { ctrl: true }); };
  function gesto(en, tipo, scale, x, y) {
    const e = new W.UIEvent(tipo, { bubbles: true, cancelable: true });
    Object.defineProperties(e, { scale: { value: scale }, clientX: { value: x }, clientY: { value: y } });
    en.dispatchEvent(e); return e;
  }
  // una foto de la bandeja de la mesa que se ve entera en el centro de su vista
  function fotoEnMedio() {
    const t = q('.tray'), r = t.getBoundingClientRect(), y = (r.top + r.bottom) / 2;
    return qa('.tray .tgrid > .titem').find(e => { const b = e.getBoundingClientRect(); return b.top < y && b.bottom > y && b.left > r.left; });
  }

  prueba('T8', 'Mesa: el pellizco sobre la bandeja mueve su barra, con sus tramos y lo guardado, y la foto bajo el puntero se queda a su altura; también con «Historias»; fuera de la bandeja no cambia nada (D-118)', async () => {
    await bandejaTam(60);
    try {
      const t = q('.tray'); t.scrollTop = Math.round((t.scrollHeight - t.clientHeight) / 2);
      for (const hv of [false, true]) {
        if (hv) { q('.hvsw [data-v="1"]').click(); await hasta(() => q('section.hv'), 3000, 'la vista «Historias»'); aTam(barra(), 50); t.scrollTop = Math.round((t.scrollHeight - t.clientHeight) / 2); }
        const f = fotoEnMedio(); ok(f, 'ninguna foto en el centro de la bandeja');
        const r0 = f.getBoundingClientRect(), x = r0.left + r0.width * 0.3, y = r0.top + r0.height * 0.6, fy = (y - r0.top) / r0.height;
        let e = null; for (let i = 0; i < 6; i++) e = pellizco(f, -12, x, y);
        ok(e.defaultPrevented, 'el pellizco sobre la bandeja haría zoom de la página');
        const v = +barra().querySelector('input').value;
        ok(v > 50 && W.localStorage.getItem(LS_TAM) === String(v), `la barra no se movió con el pellizco (${v}, ${W.localStorage.getItem(LS_TAM)})`);
        const r1 = f.getBoundingClientRect();
        ok(Math.abs(r1.top + fy * r1.height - y) < 1.5, `la foto bajo el puntero se movió ${Math.round(r1.top + fy * r1.height - y)} px en vertical`);
        const conP = tw(); aTam(barra(), v); igual(tw(), conP, 'el pellizco no da el mismo tamaño que la barra');
        for (let i = 0; i < 30; i++) pellizco(fotoEnMedio() || f, 15);
        const v2 = +barra().querySelector('input').value; ok(v2 < 50 && tw() && parseFloat(tw()) < 92, `cerrar los dedos no achica (${v2}, ${tw()})`);
        for (let i = 0; i < 80; i++) pellizco(q('.tray .tgrid > .titem'), 40);
        igual(+barra().querySelector('input').value, 0, 'no se para en el extremo izquierdo'); igual(tw(), '46px', 'el extremo izquierdo no es 46 px');
        aTam(barra(), 50);
      }
      q('.hvsw [data-v="0"]').click();
      const c = q('.feed .grid .cell'), e = pellizco(c, -60);
      igual(+barra().querySelector('input').value, 50, 'un pellizco sobre la cuadrícula movió la barra'); ok(!e.defaultPrevented, 'fuera de la bandeja el pellizco ya no es del navegador');
      const ru = rueda(q('.tray .tgrid > .titem'), 10, 10, 120); ok(!ru.defaultPrevented && !tw(), 'la rueda sin pellizco cambió el tamaño');
      aTam(barra(), 80); pellizco(q('.tray .tgrid > .titem'), -1); ok(+barra().querySelector('input').value >= 80, 'el pellizco no sigue desde donde se dejó la barra');
    } finally { if (q('section.hv')) q('.hvsw [data-v="0"]').click(); sinTam(); }
  });

  prueba('T9', 'Editor: el pellizco sobre su bandeja mueve su barra y la foto bajo el puntero no se mueve; sobre el área gris sigue siendo el zoom del editor; se guarda aparte de la mesa (D-118, D-031)', async () => {
    await bandejaTam(40);
    try {
      await editorConBandeja();
      const tr = ed().el.querySelector('.lb-trs'); tr.scrollLeft = Math.round((tr.scrollWidth - tr.clientWidth) / 2);
      const rr = tr.getBoundingClientRect(), f = [...tr.querySelectorAll('.lb-tph')].find(e => { const b = e.getBoundingClientRect(); return b.left > rr.left + rr.width * 0.4 && b.right < rr.right; });
      ok(f, 'ninguna foto en el centro de la tira');
      const r0 = f.getBoundingClientRect(), x = r0.left + r0.width * 0.7, y = r0.top + r0.height / 2, fx = (x - r0.left) / r0.width, z0 = ed().zoom;
      let e = null; for (let i = 0; i < 6; i++) e = pellizco(f, -12, x, y);
      ok(e.defaultPrevented, 'el pellizco sobre la bandeja del editor haría zoom de la página');
      const v = +barraEd().querySelector('input').value;
      ok(v > 50 && W.localStorage.getItem(LS_TAM_ED) === String(v) && W.localStorage.getItem(LS_TAM) == null, `la barra del editor no se movió sola (${v})`);
      const r1 = f.getBoundingClientRect();
      ok(Math.abs(r1.left + fx * r1.width - x) < 1.5, `la foto bajo el puntero se movió ${Math.round(r1.left + fx * r1.width - x)} px en horizontal`);
      igual(ed().zoom, z0, 'el pellizco en la bandeja cambió el zoom del editor');
      const px = parseFloat(ed().el.querySelector('.lb-tray').style.getPropertyValue('--tw')); aTam(barraEd(), v);
      igual(parseFloat(ed().el.querySelector('.lb-tray').style.getPropertyValue('--tw')), px, 'el pellizco no da el mismo tamaño que la barra');
      const [gx, gy] = enGris(); pellizco(gris(), -40, gx, gy);
      ok(ed().zoom > z0 && +barraEd().querySelector('input').value === v, 'sobre el área gris el pellizco no es el zoom del editor');
      M.libre.cerrar();
    } finally { if (M.libre.abierto()) M.libre.cerrar(); sinTam(); }
  });

  prueba('T10', 'Safari: gesturestart y gesturechange sobre la bandeja mueven su barra, en la mesa y en el editor, sin zoom de la página; en el editor, sobre la diapositiva siguen haciendo su zoom (D-118)', async () => {
    await bandejaTam(30);
    try {
      const f = q('.tray .tgrid > .titem'), r = f.getBoundingClientRect(), x = r.left + 10, y = r.top + 10;
      const es = [gesto(f, 'gesturestart', 1, x, y), gesto(f, 'gesturechange', 1.4, x, y), gesto(f, 'gesturechange', 1.8, x, y), gesto(f, 'gestureend', 1.8, x, y)];
      ok(es.every(e => e.defaultPrevented), 'un gesto sobre la bandeja haría zoom de la página');
      const v = +barra().querySelector('input').value; ok(v > 50 && W.localStorage.getItem(LS_TAM) === String(v), 'el gesto no movió la barra de la mesa: ' + v);
      gesto(f, 'gesturestart', 1, x, y); gesto(f, 'gesturechange', 0.5, x, y); gesto(f, 'gestureend', 0.5, x, y);
      ok(+barra().querySelector('input').value < v, 'cerrar los dedos no achica en la mesa');
      await editorConBandeja();
      const g = ed().el.querySelector('.lb-tph'), b = g.getBoundingClientRect(), z0 = ed().zoom;
      gesto(g, 'gesturestart', 1, b.left + 5, b.top + 5); gesto(g, 'gesturechange', 1.6, b.left + 5, b.top + 5); gesto(g, 'gestureend', 1.6, b.left + 5, b.top + 5);
      ok(+barraEd().querySelector('input').value > 50 && ed().zoom === z0, 'el gesto no movió la barra del editor o cambió su zoom');
      const [gx, gy] = enGris(); gesto(gris(), 'gesturestart', 1, gx, gy); gesto(gris(), 'gesturechange', 1.5, gx, gy); gesto(gris(), 'gestureend', 1.5, gx, gy);
      ok(ed().zoom > z0, 'el gesto sobre el área gris ya no es el zoom del editor');
      M.libre.cerrar();
    } finally { if (M.libre.abierto()) M.libre.cerrar(); sinTam(); }
  });

  prueba('T11', 'Con la ventana a 720 px o menos el pellizco no hace nada en la bandeja, tampoco zoom de la página, en la mesa y en el editor (D-118)', async () => {
    await bandejaTam(30);
    const fr = $('mesa'), w0 = fr.style.width;
    try {
      fr.style.width = '700px';
      await hasta(() => W.innerWidth <= 720 && !visto(barra()), 3000, 'sin barra en la ventana estrecha');
      const f = q('.tray .tgrid > .titem'), r = f.getBoundingClientRect();
      const e = pellizco(f, -60), g = [gesto(f, 'gesturestart', 1, r.left + 5, r.top + 5), gesto(f, 'gesturechange', 2, r.left + 5, r.top + 5)];
      ok(e.defaultPrevented && g.every(x => x.defaultPrevented), 'en la ventana estrecha el pellizco haría zoom de la página');
      ok(W.localStorage.getItem(LS_TAM) == null && !tw(), 'en la ventana estrecha el pellizco cambió el tamaño');
      gesto(f, 'gestureend', 2, r.left + 5, r.top + 5);
      await editorConBandeja();
      const h = ed().el.querySelector('.lb-tph'); pellizco(h, -60);
      ok(W.localStorage.getItem(LS_TAM_ED) == null && !ed().el.querySelector('.lb-tray').classList.contains('tam-on'), 'en el editor estrecho el pellizco cambió el tamaño');
      M.libre.cerrar();
    } finally { fr.style.width = w0; if (M.libre.abierto()) M.libre.cerrar(); sinTam(); }
  });

  // =====================================================================================================
  // Pestañas a la vista, cada carpeta donde se dejó y pestañas en el orden que se quiera (D-092)
  // =====================================================================================================
  // una bandeja larga: 90 fotos en la raíz (más de 80: miniaturas perezosas), «Uno» con 40 y su «Hija» con 30, «Dos» con 40
  // y «Tres» con 4; una pestaña para cada una de las tres, la fija en uso y en la raíz
  async function bandejaLarga() {
    W.localStorage.removeItem(LS_TAM); W.localStorage.removeItem(LS_TAM_ED);
    await tablero([pub(1, 'Carrusel'), pub(2), pub(3)]);
    const mk = async (pre, n) => { const fs = []; for (let i = 0; i < n; i++) fs.push(await foto(`${pre}${i}.jpg`, 240, 300, `hsl(${(i * 47) % 360} 40% 45%)`)); const ids = await M.addFiles(fs); ok(ids.length === n, 'no entraron las fotos ' + pre); return ids; };
    const raiz = await mk('k-r', 90), fu = await mk('k-u', 40), fh = await mk('k-h', 30), fd = await mk('k-d', 40), ft = await mk('k-t', 4);
    const uno = M.crearCarpeta('Uno'), dos = M.crearCarpeta('Dos'), tres = M.crearCarpeta('Tres'), hija = M.crearCarpeta('Hija', uno.id);
    M._in.trayMover({ files: fu }, uno.id, null); M._in.trayMover({ files: fh }, hija.id, null); M._in.trayMover({ files: fd }, dos.id, null); M._in.trayMover({ files: ft }, tres.id, null);
    M._in.trayAbrir(null); M._in.pestNueva(uno.id); M._in.pestNueva(dos.id); M._in.pestNueva(tres.id); M._in.pestIr('fija');
    await M.flush(); M._in.clearToasts();
    if (M._test.olvidarDonde) M._test.olvidarDonde();
    q('.tray').scrollTop = 0;
    return { raiz, fu, fh, fd, ft, uno, dos, tres, hija };
  }
  const navK = () => q('.tray .cpnav'), bordeK = () => navK().getBoundingClientRect().bottom;
  const idK = t => t ? (t.dataset.file ? 'f:' + t.dataset.file : 'c:' + t.dataset.id) : null;
  const tileK = id => id.startsWith('f:') ? titem(id.slice(2)) : tile(id.slice(2));
  // la primera foto o carpeta a la vista bajo lo fijo (más de media por debajo de las pestañas y la ruta), como la recuerda la mesa
  const primeraK = () => qa('.tray .tgrid > *').find(t => { const r = t.getBoundingClientRect(); return r.top + r.height / 2 > bordeK(); });
  // la bandeja de la mesa deslizada hasta la foto f, con un tercio de ella tapado por lo fijo
  function aFotoK(f) { const r = titem(f).getBoundingClientRect(); q('.tray').scrollTop += r.top - bordeK() + r.height / 3; }
  const pulsarPest = n => { const b = qa('.tray .cptab button[data-act="cp-pest"]').find(x => x.textContent === n); ok(b, 'no está la pestaña ' + n); b.click(); };
  // de vuelta en una carpeta: la recordada en la primera fila a la vista, justo bajo lo fijo, sin quedar tapada
  function dondeK(id, que) {
    const t = tileK(id); ok(t, `${que}: la recordada no está`);
    cerca(t.getBoundingClientRect().top, bordeK(), 1.5, `${que}: la recordada no queda justo bajo lo fijo`);
    igual(primeraK().getBoundingClientRect().top, t.getBoundingClientRect().top, `${que}: la recordada no está en la primera fila a la vista`);
  }
  const tabK = (n, en = D) => [...en.querySelectorAll('.cptab')].find(t => t.querySelector('button').textContent === n);
  const mitadK = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  // con el ratón: la pestaña n hasta el sitio de la pestaña a, a su izquierda (su borde izquierdo 4 px antes del de a), o el
  // puntero hasta x, en la mesa o en el editor; al soltar, el clic que daría el navegador en lo que quede debajo (dónde: la
  // pestaña en su sitio nuevo o la fila)
  function llevarK(n, a, { soltar = true, x, en = D, clic = 'pestana' } = {}) {
    const b = tabK(n, en).querySelector('button'), [x0, y0] = mitadK(b), x1 = a ? x0 + tabK(a, en).getBoundingClientRect().left - tabK(n, en).getBoundingClientRect().left - 4 : x;
    puntero('pointerdown', b, x0, y0);
    for (let i = 1; i <= 6; i++) puntero('pointermove', D, x0 + (x1 - x0) * i / 6, y0 + 1);
    if (!soltar) return () => llevarK.soltar(n, x1, y0, en, clic);
    llevarK.soltar(n, x1, y0, en, clic);
  }
  llevarK.soltar = (n, x, y, en, clic) => {
    puntero('pointerup', D, x, y + 1);
    const t = clic === 'pestana' ? tabK(n, en).querySelector('button') : en.querySelector('.cpfila, .lb-trh');
    t.dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  };
  async function dondeYa(id, que) { try { await hasta(() => { try { dondeK(id, que); return true; } catch (e) { return false; } }, 2000); } catch (e) { dondeK(id, que); } }
  const txK = n => parseFloat((tabK(n).style.transform.match(/-?[\d.]+/) || [0])[0]);
  const lsK = () => JSON.parse(W.localStorage.getItem('mesa-pestanas:' + CLIENTE));

  prueba('K1', 'Al deslizar la bandeja, las pestañas y la ruta se quedan pegadas bajo su cabecera, con fondo opaco, también con «Historias» y con el calendario abierto o plegado; a 720 px o menos y en el editor siguen como estaban (D-092)', async () => {
    const k = await bandejaLarga(), fr = $('mesa'), w0 = fr.style.width, plegar = () => q('.side > .cal [data-cal="fold"]').click();
    const pegadas = que => {
      const t = q('.tray'), h = q('.trayhead').getBoundingClientRect(), n = navK().getBoundingClientRect();
      ok(t.scrollTop > 150, `${que}: la bandeja no se desliza (${t.scrollTop})`);
      cerca(h.top, t.getBoundingClientRect().top, 1, `${que}: la cabecera no sigue arriba`);
      cerca(n.top, h.bottom, 1, `${que}: las pestañas no están pegadas bajo la cabecera`);
      ok(qa('.tray .cptab, .tray .cpvolver, .tray .cpruta').every(x => { const r = x.getBoundingClientRect(); return r.top >= h.bottom - 0.5 && r.bottom <= n.bottom + 0.5; }), `${que}: una pestaña o la ruta no se ve`);
      const bg = W.getComputedStyle(navK()).backgroundColor; ok(bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent', `${que}: su fondo no es opaco (${bg})`);
      const e = D.elementFromPoint(n.left + n.width / 2, n.bottom - 2); ok(e && navK().contains(e), `${que}: una foto asoma por encima de las pestañas`);
    };
    try {
      q('.tray').scrollTop = 1e5; pegadas('en la raíz');
      M._in.trayAbrir(k.uno.id); q('.tray').scrollTop = 1e5; pegadas('en «Uno», con ← y la ruta');
      ok(navK().querySelector('.cpvolver') && navK().querySelector('.cpruta'), 'en «Uno» no están ← y la ruta');
      M.hs.ver(true); await espera(60); q('.tray').scrollTop = 1e5; pegadas('con «Historias»'); M.hs.ver(false); await espera(30);
      ok(visto(q('.side > .cal')), 'el calendario no sale');
      plegar(); await espera(60); q('.tray').scrollTop = 1e5; pegadas('con el calendario plegado o abierto');
      plegar(); await espera(60); q('.tray').scrollTop = 1e5; pegadas('con el calendario abierto o plegado');
      // a 720 px o menos, la tira: sus pestañas se ven y nada cambia
      fr.style.width = '700px'; await hasta(() => W.innerWidth <= 720, 3000, 'la ventana estrecha');
      igual([W.getComputedStyle(navK()).position, W.getComputedStyle(q('.trayhead')).position], ['static', 'static'], 'a 720 px o menos cambia la tira');
      ok(qa('.tray .cptab').length === 4 && qa('.tray .cptab').every(visto), 'a 720 px o menos no se ven las pestañas');
      fr.style.width = w0; await hasta(() => W.innerWidth > 720, 3000, 'la ventana ancha');
      // el editor: sus pestañas ya se ven, como estaban
      M._test.place('r1', k.raiz[0]); await editorConBandeja('r1');
      const et = [...ed().el.querySelectorAll('.lb-trt .cptab')];
      ok(et.length === 4 && et.every(visto), 'en el editor no se ven las pestañas');
      igual(W.getComputedStyle(ed().el.querySelector('.lb-trt')).position, 'static', 'en el editor cambian las pestañas');
      M.libre.cerrar();
    } finally { fr.style.width = w0; if (M.libre.abierto()) M.libre.cerrar(); if (M.hs.activo()) M.hs.ver(false); }
  });

  prueba('K2', 'Cada carpeta vuelve a donde se dejó, por su pestaña, con ← o por la ruta: su primera foto a la vista, justo bajo lo fijo; una no visitada empieza arriba, y la que se dejó arriba vuelve arriba (D-092)', async () => {
    const k = await bandejaLarga();
    aFotoK(k.raiz[45]); const r0 = idK(primeraK());
    ok(r0 && r0 !== idK(q('.tray .tgrid > *')), 'la raíz no quedó a media altura');
    pulsarPest('Uno'); igual(q('.tray').scrollTop, 0, '«Uno», sin visitar, no empieza arriba');
    aFotoK(k.fu[22]); const u0 = idK(primeraK());
    pulsarPest('Bandeja'); dondeK(r0, 'la raíz por su pestaña');
    pulsarPest('Uno'); dondeK(u0, '«Uno» por su pestaña');
    pulsarPest('Dos'); igual(q('.tray').scrollTop, 0, '«Dos», sin visitar, no empieza arriba');
    pulsarPest('Tres'); pulsarPest('Dos'); igual(q('.tray').scrollTop, 0, '«Dos», dejada arriba, no vuelve arriba');
    // en la fija: «Uno» (abierta también en otra pestaña: se recuerda por carpeta), «Hija», ← y la ruta
    pulsarPest('Bandeja'); tile(k.uno.id).click(); dondeK(u0, '«Uno» entrando desde la raíz');
    tile(k.hija.id).click(); igual(q('.tray').scrollTop, 0, '«Hija», sin visitar, no empieza arriba');
    aFotoK(k.fh[15]); const h0 = idK(primeraK());
    q('.tray .cpvolver').click(); dondeK(u0, '«Uno» con ←');
    tile(k.hija.id).click(); dondeK(h0, '«Hija» al volver a entrar');
    q(`.tray .cpruta button[data-id="${k.uno.id}"]`).click(); dondeK(u0, '«Uno» por la ruta');
    tile(k.hija.id).click(); q('.tray .cpruta button[data-id=""]').click(); dondeK(r0, 'la raíz por la ruta');
    // la raíz otra vez arriba: vuelve arriba
    q('.tray').scrollTop = 0; pulsarPest('Uno'); pulsarPest('Bandeja'); igual(q('.tray').scrollTop, 0, 'la raíz, dejada arriba, no vuelve arriba');
  });

  prueba('K3', 'Lo recordado aguanta otro tamaño (D-091) y fotos que entran o salen; si la recordada ya no está (colocada, con «Sin usar»), vale la siguiente; las miniaturas perezosas de allí se cargan (D-075); por cliente y también al cambiar de mes (D-092)', async () => {
    const k = await bandejaLarga();
    try {
      aFotoK(k.raiz[45]); let r0 = idK(primeraK());
      pulsarPest('Dos'); aTam(barra(), 100);
      pulsarPest('Bandeja'); dondeK(r0, 'con otro tamaño');
      await hasta(() => tileK(r0).querySelector('img').getAttribute('src'), 3000, 'la miniatura de la recordada');
      ok(qa('.tray .tgrid img[src]').length < 90, 'se cargaron todas las miniaturas: ya no son perezosas');
      aTam(barra(), 0); aFotoK(k.raiz[45]); r0 = idK(primeraK());
      pulsarPest('Dos');
      M._test.removeFile(k.raiz[2]); M._test.removeFile(k.raiz[3]);   // salen dos de antes
      M._in.trayMover({ files: [k.fd[0], k.fd[1]] }, null, k.dos.id);  // y entran dos en la raíz
      M._in.clearToasts();
      pulsarPest('Bandeja'); dondeK(r0, 'con fotos que entran y salen');
      const lista = qa('.tray .tgrid > *').map(idK), sig = lista[lista.indexOf(r0) + 1];
      pulsarPest('Dos'); M._test.place('r2', r0.slice(2)); pulsarPest('Bandeja');
      ok(!tileK(r0), 'la colocada sigue en «Sin usar»'); dondeK(sig, 'sin la recordada');
      // por cliente: el otro empieza arriba y el primero vuelve donde estaba, también tras abrir otro mes
      const clave = `${CLIENTE}-${MES}`;
      await M.flush();
      await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [pub(1)], past: [], force: true });
      await M.addFiles(await Promise.all(Array.from({ length: 40 }, (_, i) => foto(`k3-b${i}.jpg`, 240, 300))));
      await hasta(() => qa('.tray .tgrid .titem').length >= 40, 3000, 'las fotos del otro cliente');
      igual(q('.tray').scrollTop, 0, 'otro cliente no empieza arriba');
      q('.tray').scrollTop = 200;
      await M.open(clave); await dondeYa(sig, 'al volver al cliente');
      await M.init({ client: CLIENTE, month: '2026-12', slots: [pub(9, 'Foto', 9, '2026-12')], past: [], force: true });
      await dondeYa(sig, 'en otro mes del cliente');
      await M.open(clave); await dondeYa(sig, 'de vuelta en el mes');
    } finally { sinTam(); }
  });

  prueba('K4', 'En la tira de 720 px o menos y en la del editor, cada carpeta vuelve a donde se dejó en horizontal, cada tira aparte y aparte de la mesa (D-092)', async () => {
    const k = await bandejaLarga(), fr = $('mesa'), w0 = fr.style.width;
    const izq = sc => sc.getBoundingClientRect().left + parseFloat(W.getComputedStyle(sc).paddingLeft);
    const primeraX = (sc, sel) => [...sc.querySelectorAll(sel)].find(t => { const r = t.getBoundingClientRect(); return r.left + r.width / 2 > izq(sc); });
    const aFotoX = (sc, t) => { const r = t.getBoundingClientRect(); sc.scrollLeft += r.left - izq(sc) + r.width / 3; };
    const dondeX = (sc, t, que) => { ok(t, `${que}: la recordada no está`); cerca(t.getBoundingClientRect().left, izq(sc), 1.5, `${que}: la recordada no queda a la izquierda de la tira`); };
    try {
      M._test.place('r1', k.raiz[0]);
      aFotoK(k.raiz[45]); const v0 = idK(primeraK());
      pulsarPest('Uno'); pulsarPest('Bandeja'); dondeK(v0, 'la mesa');
      // la tira estrecha
      fr.style.width = '700px'; await hasta(() => W.innerWidth <= 720 && W.getComputedStyle(navK()).position === 'static', 3000, 'la tira estrecha');
      const tb = q('.tray .tbody');
      aFotoX(tb, titem(k.raiz[50])); const h0 = primeraX(tb, '.tgrid > *');
      pulsarPest('Uno'); igual(tb.scrollLeft, 0, 'en la tira, «Uno» sin visitar no empieza a la izquierda');
      aFotoX(tb, titem(k.fu[20])); const hu = idK(primeraX(tb, '.tgrid > *'));
      pulsarPest('Bandeja'); dondeX(tb, titem(h0.dataset.file), 'la tira, la raíz');
      pulsarPest('Uno'); dondeX(tb, tileK(hu), 'la tira, «Uno»');
      fr.style.width = w0; await hasta(() => W.innerWidth > 720 && W.getComputedStyle(navK()).position === 'sticky', 3000, 'la ventana ancha');
      pulsarPest('Bandeja'); dondeK(v0, 'la mesa, tras la tira');
      // el editor
      await editorConBandeja('r1');
      const ts = () => ed().el.querySelector('.lb-trs'), edPest = n => M._in.pestLista().find(p => p.nombre === n).id;
      const fotoE = f => ed().el.querySelector(`.lb-trs [data-f="${f}"]`);
      igual(ts().scrollLeft, 0, 'el editor, sin visitar, no empieza a la izquierda');
      aFotoX(ts(), fotoE(k.raiz[30])); const e0 = primeraX(ts(), '.lb-tph, .lb-tcarp').dataset.f;
      accion('tr-pest', { id: edPest('Uno') }); igual(ts().scrollLeft, 0, 'el editor, «Uno» sin visitar no empieza a la izquierda');
      aFotoX(ts(), fotoE(k.fu[25])); const eu = primeraX(ts(), '.lb-tph, .lb-tcarp').dataset.f;
      accion('tr-pest', { id: 'fija' }); dondeX(ts(), fotoE(e0), 'el editor, la raíz');
      accion('tr-pest', { id: edPest('Uno') }); dondeX(ts(), fotoE(eu), 'el editor, «Uno»');
      accion('bandeja'); accion('bandeja'); dondeX(ts(), fotoE(eu), 'el editor, al cerrar y abrir su bandeja');
      M.libre.cerrar(); await editorConBandeja('r1'); dondeX(ts(), fotoE(eu), 'el editor, al volver a abrirlo');
      M.libre.cerrar();
      pulsarPest('Bandeja'); dondeK(v0, 'la mesa, tras el editor');
    } finally { fr.style.width = w0; if (M.libre.abierto()) M.libre.cerrar(); }
  });

  prueba('K5', 'Las pestañas se ordenan arrastrándolas: las demás se apartan y queda donde se suelta; «Bandeja» va siempre la primera y no se arrastra; el orden se guarda como siempre y es el mismo en el editor, donde también se ordena; un clic sin mover cambia de pestaña y la × cierra y pasa a la de su izquierda en el orden nuevo; no es un paso de ⌘Z ni toca el tablero (D-092)', async () => {
    const k = await bandejaLarga(), clave = `${CLIENTE}-${MES}`;
    M._test.place('r1', k.raiz[0]); await M.flush();   // para abrir el editor más abajo
    const sin = r => json(Object.assign({}, r, { savedAt: 0, at: 0 }));   // sin la hora de guardado
    const bd0 = sin(await M._in.idbGet('bandejas', CLIENTE)), tb0 = sin(await M._in.idbGet('boards', clave)), h0 = json(M._test.hist());
    const ls0 = Object.keys(W.localStorage).filter(x => x !== 'mesa-pestanas:' + CLIENTE).sort();
    igual(tabsTxt(), ['*Bandeja', 'Uno', 'Dos', 'Tres'], 'de entrada');
    // «Tres» hasta «Uno»: mientras va, «Uno» y «Dos» se apartan lo que mide «Tres»
    const soltar = llevarK('Tres', 'Uno', { soltar: false }), w3 = tabK('Tres').getBoundingClientRect().width;
    ok(tabK('Tres').classList.contains('arrastrada') && txK('Tres') < 0, 'la pestaña no va con el ratón');
    cerca(txK('Uno'), w3 + 4, 1, '«Uno» no se aparta'); cerca(txK('Dos'), w3 + 4, 1, '«Dos» no se aparta'); igual(txK('Bandeja'), 0, '«Bandeja» se mueve');
    igual(tabsTxt(), ['*Bandeja', 'Uno', 'Dos', 'Tres'], 'el orden cambia antes de soltar');
    soltar();
    igual(tabsTxt(), ['*Bandeja', 'Tres', 'Uno', 'Dos'], 'no queda donde se suelta (o el clic del final cambió de pestaña)');
    ok(!qa('.tray .cptab').some(t => t.style.transform || t.classList.contains('arrastrada')), 'quedan pestañas apartadas');
    // guardado donde siempre y con el mismo formato
    const d = lsK(); igual(Object.keys(d), ['tabs', 'act'], 'otro formato'); igual(d.tabs.map(t => Object.keys(t)), [['id', 'carpeta'], ['id', 'carpeta'], ['id', 'carpeta'], ['id', 'carpeta']], 'otro formato en las pestañas');
    igual(d.tabs.map(t => t.carpeta), [null, k.tres.id, k.uno.id, k.dos.id], 'no se guarda el orden');
    // antes de «Bandeja» no se puede: queda la segunda
    llevarK('Dos', null, { x: tabK('Bandeja').getBoundingClientRect().left - 30 });
    igual(tabsTxt(), ['*Bandeja', 'Dos', 'Tres', 'Uno'], 'antes de la fija');
    // la fija no se arrastra
    llevarK('Bandeja', 'Uno'); igual(tabsTxt(), ['*Bandeja', 'Dos', 'Tres', 'Uno'], 'la fija se arrastra');
    // un clic sin mover (y con menos de 5 px) cambia de pestaña
    { const b = tabK('Uno').querySelector('button'), [x, y] = mitadK(b); puntero('pointerdown', b, x, y); puntero('pointermove', D, x + 3, y); puntero('pointerup', D, x + 3, y); b.click(); }
    igual(tabsTxt(), ['Bandeja', 'Dos', 'Tres', '*Uno'], 'un clic sin mover no cambia de pestaña');
    // la ×: no arrastra y cierra; pasa a la de su izquierda en el orden nuevo
    { const x = tabK('Uno').querySelector('.cpx'), [x0, y0] = mitadK(x); puntero('pointerdown', x, x0, y0); puntero('pointermove', D, x0 - 60, y0); puntero('pointerup', D, x0 - 60, y0); ok(!tabK('Uno').style.transform, 'la × arrastra'); x.click(); }
    igual(tabsTxt(), ['Bandeja', 'Dos', '*Tres'], 'la × no pasa a la de su izquierda en el orden nuevo');
    M._in.pestNueva(k.uno.id); igual(tabsTxt(), ['Bandeja', 'Dos', 'Tres', '*Uno'], 'otra vez «Uno»');
    llevarK('Uno', 'Dos'); igual(tabsTxt(), ['Bandeja', '*Uno', 'Dos', 'Tres'], 'otra vez a la segunda');
    // «Abrir en una pestaña nueva» con la carpeta ya abierta va a esa pestaña
    M._in.pestIr('fija'); M._in.pestNueva(k.dos.id); igual(tabsTxt(), ['Bandeja', 'Uno', '*Dos', 'Tres'], 'una carpeta abierta abre otra pestaña');
    // el editor: el mismo orden, y se ordena igual
    await editorConBandeja('r1');
    const edTabs = () => [...ed().el.querySelectorAll('.lb-trt .cptab button[data-lb="tr-pest"]')].map(b => b.textContent);
    igual(edTabs(), ['Bandeja', 'Uno', 'Dos', 'Tres'], 'el editor tiene otro orden');
    const soltarE = llevarK('Tres', 'Uno', { soltar: false, en: ed().el });
    ok(tabK('Tres', ed().el).classList.contains('arrastrada'), 'en el editor la pestaña no va con el ratón');
    soltarE();
    igual([edTabs(), M._in.pestLista().map(p => p.nombre)], [['Bandeja', 'Tres', 'Uno', 'Dos'], ['Bandeja', 'Tres', 'Uno', 'Dos']], 'ordenar en el editor');
    igual(M._in.pestLista().find(p => p.activa).nombre, 'Dos', 'el clic del final cambió de pestaña en el editor');
    { const b = tabK('Uno', ed().el).querySelector('button'); b.click(); } igual(M._in.pestLista().find(p => p.activa).nombre, 'Uno', 'en el editor, un clic no cambia de pestaña');
    M.libre.cerrar();
    igual(qa('.tray .cptab button[data-act="cp-pest"]').map(b => b.textContent), ['Bandeja', 'Tres', 'Uno', 'Dos'], 'la mesa no sigue el orden del editor');
    // ni ⌘Z, ni el tablero, ni otras cosas del navegador
    igual(json(M._test.hist()), h0, 'ordenar es un paso de ⌘Z');
    await M.flush();
    igual(sin(await M._in.idbGet('bandejas', CLIENTE)), bd0, 'cambió la bandeja guardada');
    igual(sin(await M._in.idbGet('boards', clave)), tb0, 'cambió el tablero guardado');
    igual(Object.keys(W.localStorage).filter(x => x !== 'mesa-pestanas:' + CLIENTE).sort(), ls0, 'algo nuevo en el navegador');
    M._test.undo(); igual(M._in.pestLista().map(p => p.nombre), ['Bandeja', 'Tres', 'Uno', 'Dos'], '⌘Z deshace el orden');
  });

  prueba('K6', 'Arrastrar una pestaña no mueve fotos ni enciende destinos, la zona de soltar archivos ni las casillas, y no suelta lo elegido con ⌘+clic; con la bandeja deslizada, soltar fotos en una pestaña, en la ruta o en ← las mueve allí con su marco y sin desplazar la vista; la barra de tamaño sale igual (D-092, D-077, D-091)', async () => {
    const k = await bandejaLarga();
    const llevarFoto = async (f, a, que) => {      // con el ratón, de una foto de la bandeja a a: marco discontinuo y la vista quieta
      const t = titem(f), [x0, y0] = mitadK(t), [x1, y1] = mitadK(a), st = q('.tray').scrollTop;
      puntero('pointerdown', t, x0, y0); puntero('pointermove', D, x0 + 8, y0 + 8); puntero('pointermove', D, x1, y1);
      ok(a.classList.contains('over'), `${que}: sin su marco discontinuo`);
      await espera(500); puntero('pointermove', D, x1, y1 + 1);
      igual(q('.tray').scrollTop, st, `${que}: la bandeja se desliza mientras la foto está encima`);
      puntero('pointerup', D, x1, y1 + 1);
    };
    // ⌘+clic: dos fotos y una carpeta
    conCmd(titem(k.raiz[5])); conCmd(titem(k.raiz[6])); conCmd(tile(k.dos.id));
    const lote = M._in.trayLote(), c0 = json(M.board().carpetas), cell0 = json(M.board().slots.map(s => s.photos));
    igual(lote, { files: [k.raiz[5], k.raiz[6]], carpetas: [k.dos.id] }, '⌘+clic');
    const soltar = llevarK('Tres', 'Uno', { soltar: false, clic: 'fila' });
    ok(!qa('.over, .dragging').length && !q('.tray').classList.contains('over'), 'arrastrar una pestaña enciende algo: ' + qa('.over, .dragging').map(e => e.className).join(' · '));
    ok(!q('.pdghost') || !visto(q('.pdghost')), 'arrastrar una pestaña lleva una foto');
    soltar();
    igual(M._in.trayLote(), lote, 'arrastrar una pestaña suelta lo elegido');
    igual([json(M.board().carpetas), json(M.board().slots.map(s => s.photos))], [c0, cell0], 'arrastrar una pestaña mueve fotos');
    igual(tabsTxt(), ['*Bandeja', 'Tres', 'Uno', 'Dos'], 'el orden');
    M._in.traySoltar();
    // la barra de tamaño: igual arriba y deslizada
    const pos = () => { const b = barra(); return [b.hidden, ...['left', 'top', 'width'].map(p => Math.round(b.getBoundingClientRect()[p]))]; };
    q('.tray').scrollTop = 0; const b0 = pos(); q('.tray').scrollTop = 1e5;
    igual(pos(), b0, 'la barra de tamaño cambia al deslizar');
    ok(!b0[0], 'la barra de tamaño no sale');
    // soltar en una pestaña con la bandeja deslizada
    await llevarFoto(k.raiz[85], tabK('Dos'), 'en la pestaña');
    await hasta(() => M.board().carpetas.find(c => c.id === k.dos.id).files.includes(k.raiz[85]), 3000, 'soltada en la pestaña no se mueve');
    // en ← y en la ruta, dentro de «Hija», deslizada
    M._in.trayAbrir(k.hija.id); q('.tray').scrollTop = 1e5; ok(q('.tray').scrollTop > 100, '«Hija» no se desliza');
    await llevarFoto(k.fh[28], q('.tray .cpvolver'), 'en ←');
    await hasta(() => M.board().carpetas.find(c => c.id === k.uno.id).files.includes(k.fh[28]), 3000, 'soltada en ← no se mueve');
    q('.tray').scrollTop = 1e5;
    await llevarFoto(k.fh[27], q('.tray .cpruta button[data-id=""]'), 'en la ruta');
    await hasta(() => !M.board().carpetas.some(c => c.files.includes(k.fh[27])), 3000, 'soltada en la ruta no se mueve');
    M._in.clearToasts();
  });

  prueba('K7', 'Las pestañas guardadas antes cargan igual; borrar una carpeta cierra sus pestañas y la en uso pasa a la de su izquierda en el orden nuevo; nada se guarda en el navegador por deslizar (D-092, D-076)', async () => {
    const k = await bandejaLarga(), clave = `${CLIENTE}-${MES}`;
    // guardadas por una mesa de antes: el orden de la lista
    W.localStorage.setItem('mesa-pestanas:' + CLIENTE, json({ tabs: [{ id: 'fija', carpeta: null }, { id: 'b', carpeta: k.dos.id }, { id: 'a', carpeta: k.uno.id }, { id: 'c', carpeta: k.tres.id }], act: 'a' }));
    await M.open(clave);
    igual(tabsTxt(), ['Bandeja', 'Dos', '*Uno', 'Tres'], 'las guardadas antes');
    llevarK('Tres', 'Dos'); igual(tabsTxt(), ['Bandeja', 'Tres', 'Dos', '*Uno'], 'ordenar las de antes');
    // borrar la carpeta de la pestaña en uso: pasa a la de su izquierda
    const r = await M.borrarCarpeta(k.uno.id); ok(r && r.ok, json(r));
    igual(tabsTxt(), ['Bandeja', 'Tres', '*Dos'], 'borrar la carpeta en uso');
    igual(lsK().tabs.map(t => t.id), ['fija', 'c', 'b'], 'lo guardado');
    // deslizar y cambiar de carpeta no guarda nada en el navegador
    const otras = () => json(Object.keys(W.localStorage).filter(x => x !== 'mesa-pestanas:' + CLIENTE).sort().map(x => [x, W.localStorage.getItem(x)]));
    const ls0 = otras(), ss0 = json(Object.keys(W.sessionStorage).sort());
    pulsarPest('Bandeja'); aFotoK(k.raiz[45]); pulsarPest('Dos'); pulsarPest('Bandeja');
    igual(otras(), ls0, 'deslizar guarda algo en el navegador');
    igual([Object.keys(lsK()), lsK().tabs.map(t => t.id)], [['tabs', 'act'], ['fija', 'c', 'b']], 'las pestañas guardadas');
    igual(json(Object.keys(W.sessionStorage).sort()), ss0, 'deslizar guarda algo en la sesión');
  });

  prueba('K8', 'Con «Vista cliente» la bandeja no sale: si mientras tanto se abre otro mes, al quitarla vuelve a donde se dejó (D-092)', async () => {
    const k = await bandejaLarga(), plegado = W.localStorage.getItem('mesa-cal-plegado');
    const cli = on => { const t = q('.clientToggle'); if (t.checked === on) return; t.checked = on; t.dispatchEvent(new W.Event('change', { bubbles: true })); };
    try {
      W.localStorage.setItem('mesa-cal-plegado', '1'); M._in.render();   // con el calendario plegado, «Vista cliente» quita la bandeja
      aFotoK(k.raiz[45]); const r0 = idK(primeraK());
      await espera(300);                             // lo que guarda deslizar, un momento después
      cli(true); await hasta(() => !visto(q('.tray')), 2000, 'la bandeja oculta en «Vista cliente»');
      await M.init({ client: CLIENTE, month: '2026-12', slots: [pub(9, 'Foto', 9, '2026-12')], past: [], force: true });
      cli(false); await hasta(() => visto(q('.tray')), 2000, 'la bandeja otra vez');
      await dondeYa(r0, 'al quitar «Vista cliente» en otro mes');
    } finally { cli(false); if (plegado == null) W.localStorage.removeItem('mesa-cal-plegado'); else W.localStorage.setItem('mesa-cal-plegado', plegado); M._in.render(); }
  });

  // ---------- auditoría, lote 1 (libre 1.39): arreglos del editor ----------
  prueba('E55', 'Una foto de un hueco que cruza diapositivas: «Solo esta» no deja huecos fantasma en las otras (D-014, D-052)', async () => {
    const [v] = await conHuecos([HV('h55', 0.3)], [V('e55a.jpg')]);
    const e = await enHueco(1, 'h55', v);
    ok(e.hueco, 'la foto no lleva su hueco');
    elegir(e); accion('cruzar', { v: 2 });
    await hasta(() => ed().sl.length >= 3 && compDe(2).els.some(q => q.pan && q.src === v), 4000, 'la foto cruzando a la diapositiva 3');
    accion('cruzar', { v: 1 });
    await espera(30);
    ok(!compDe(2).els.some(q => q.t === 'hueco' || (q.t === 'foto' && !q.src)), 'quedó un hueco fantasma en la diapositiva 3: ' + json(compDe(2).els.map(q => q.t)));
    ok(compDe(1).els.some(q => q.src === v && q.hueco), 'la foto perdió su hueco');
    M.libre.cerrar();
  });

  prueba('E56', 'Un logo que se sube mientras se cierra el editor queda en la lista de logos del cliente', async () => {
    await tablero([pub(1)]); await poner('r1', [await foto('e56.jpg')]);
    await abrirEditor('r1');
    const logos = async () => { const c = await M._in.idbGet('clients', CLIENTE); return ((c && c.libre) || {}).logos || []; };
    const antes = await logos(), inp = ed().el.querySelector('.lb-logoin'), dt = new W.DataTransfer();
    dt.items.add(await foto('e56-logo.jpg', 400, 200, '#c0392b'));
    inp.files = dt.files; inp.dispatchEvent(new W.Event('change'));
    M.libre.cerrar();
    const l = await hasta(async () => { const x = await logos(); return x.length > antes.length && x; }, 6000, 'el logo en la lista del cliente');
    ok(l.some(id => id.startsWith(`kit-${CLIENTE}-logo-`) && !antes.includes(id)), 'el logo nuevo no está en la lista: ' + json(l));
  });

  prueba('E57', '«Ver todas» se pone al día con ⌘Z', async () => {
    await tablero([pub(1, 'Carrusel')]); await poner('r1', [await foto('e57a.jpg'), await foto('e57b.jpg')]);
    await abrirEditor('r1');
    ed().sel = null; ed().mas = [];
    accion('todas');
    const n = () => ed().allEl.querySelectorAll('.lb-allit').length;
    await hasta(() => !ed().allEl.hidden && n() === 2, 2000, 'las dos diapositivas en «Ver todas»');
    tecla('d', { meta: true });
    await hasta(() => ed().sl.length === 3 && n() === 3, 2000, 'la copia en «Ver todas»');
    tecla('z', { meta: true });
    await espera(30);
    igual(ed().sl.length, 2, '⌘Z no quitó la copia');
    igual(n(), 2, '«Ver todas» sigue enseñando la copia');
    M.libre.cerrar();
  });

  prueba('E58', 'Los ids de los elementos del editor no se repiten aunque se creen en el mismo milisegundo', async () => {
    await tablero([pub(1)]); await poner('r1', [await foto('e58.jpg')]);
    await abrirEditor('r1');
    const now = W.Date.now, rnd = W.Math.random;
    try { W.Date.now = () => 1767225600000; W.Math.random = () => 0.123456; accion('add-txt'); accion('add-txt'); accion('add-txt'); }
    finally { W.Date.now = now; W.Math.random = rnd; }
    const ids = compDe(0).els.filter(e => e.t === 'texto').map(e => e.id);
    igual(ids.length, 3, 'no entraron los tres textos');
    igual(new Set(ids).size, 3, 'se repitió un id: ' + json(ids));
    M.libre.cerrar();
  });

  prueba('E59', 'En el editor, con el foco en la barra de tamaño de la bandeja, las flechas son de la barra (D-091)', async () => {
    await tablero([pub(1, 'Carrusel')]); await poner('r1', [await foto('e59a.jpg'), await foto('e59b.jpg')]);
    await abrirEditor('r1');
    if (!ed().trOpen) accion('bandeja');
    const r = await hasta(() => ed().el.querySelector('.lb-foot .ttam input'), 2000, 'la barra de tamaño del editor');
    ed().sel = null; ed().mas = [];
    const i0 = ed().i; r.focus();
    const ev = new W.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }); r.dispatchEvent(ev);
    ok(!ev.defaultPrevented, 'el editor se quedó la flecha');
    igual(ed().i, i0, 'la flecha cambió de diapositiva');
    M.libre.cerrar();
  });

  prueba('E60', 'En la bandeja del editor, un clic sin ⌘ en una foto suelta también las carpetas elegidas (D-077)', async () => {
    await tablero([pub(1)]); await poner('r1', [await foto('e60a.jpg')]);
    const [f] = await M.addFiles([await foto('e60b.jpg')]), c = M.crearCarpeta('E60').id;
    await abrirEditor('r1');
    if (!ed().trOpen) accion('bandeja');
    ed().trCar = [c];
    accion('tr-add', { f });
    await espera(30);
    igual(ed().trCar, [], 'la carpeta sigue elegida');
    M.libre.cerrar();
  });

  prueba('E61', '«Reemplazar» en una foto suelta: la que sale vuelve a la bandeja del editor en el momento', async () => {
    await tablero([pub(1)]); const [a] = await poner('r1', [await foto('e61a.jpg')]);
    const [b] = await M.addFiles([await foto('e61b.jpg')]);
    await abrirEditor('r1');
    const el = compDe(0).els.find(e => e.t === 'foto' && e.src === a); ok(el && !el.hueco, 'la foto de la diapositiva');
    ed().pick = { modo: 'rep', id: el.id }; accion('pickf', { f: b });
    await hasta(() => compDe(0).els.some(e => e.src === b), 4000, 'la foto nueva');
    ok(ed().vuelven.has(a), 'la foto que sale no vuelve a la bandeja del editor');
    M.libre.cerrar();
  });

  prueba('E62', 'Una foto soltada en la casilla con «Sustituir»: el marco vacío de la portada cuenta como hueco y se llena (D-050)', async () => {
    await tablero([pub(1, 'Carrusel')]); const [a] = await poner('r1', [await foto('e62a.jpg'), await foto('e62b.jpg')]);
    await abrirEditor('r1');
    accion('add-txt'); compDe(0).els.push(marcoEl('m62', 0.55, 0.1, 0.4, 0.8));
    await aplicarEditor();
    const s0 = slot('r1'), c0 = s0.libre && s0.libre.slides[s0.photos[0]];
    ok(c0 && c0.els.some(e => e.id === 'm62' && !e.src), 'la portada no quedó con el marco vacío: ' + json(c0 && c0.els.map(e => e.t)));
    const [nueva] = await M.addFiles([await foto('e62c.jpg')]);
    M._test.setSel(nueva);
    celda('r1').click();
    await pulsar('[data-act="addmode"][data-m="replace"]');
    const c1 = await hasta(() => { const s = slot('r1'), c = s.libre && s.libre.slides[s.photos[0]]; return c && c.els.some(e => e.src === nueva) && c; }, 15000, 'la portada con la foto nueva');
    igual(c1.els.find(e => e.id === 'm62').src, nueva, 'el marco vacío no se llenó');
    ok(c1.els.some(e => e.src === a), 'cambió la otra foto en vez del marco');
  });

  // ---------- auditoría, lote 2 (libre 1.40): más arreglos del editor ----------
  prueba('E63', 'Con el menú de una carpeta abierto en el editor, Esc cierra el menú y no el editor (D-076)', async () => {
    await tablero([pub(1)]); await poner('r1', [await foto('e63.jpg')]);
    const c = M.crearCarpeta('E63').id;
    await abrirEditor('r1');
    if (!ed().trOpen) accion('bandeja');
    M.carpetasUI.abrirMenu(200, 200, c);
    const menu = await hasta(() => q('.cpmenu'), 2000, 'el menú de la carpeta');
    tecla('Escape', { en: menu.querySelector('button') || D.body });
    await espera(30);
    ok(M.libre.abierto(), 'Esc cerró el editor');
    ok(!q('.cpmenu'), 'el menú sigue abierto');
    M.libre.cerrar();
  });

  prueba('E64', 'Con una pregunta del editor abierta, Enter o espacio no pulsan el botón que tenía el foco detrás', async () => {
    const [a] = await conHuecos([HV('h64')], [A('e64.jpg')]);
    arrastrarDeBandeja(a, 0.2, 0.5);
    await hasta(() => preguntaHueco(), 4000, 'la pregunta 1 / 2');
    const b = [...ed().el.querySelectorAll('button[data-lb]')].find(x => !ed().ask.contains(x) && x.offsetParent);
    ok(b, 'no hay un botón del editor detrás de la pregunta');
    for (const key of ['Enter', ' ']) {
      b.focus();
      const ev = new W.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); b.dispatchEvent(ev);
      ok(ev.defaultPrevented, `«${key === ' ' ? 'espacio' : key}» puede pulsar el botón de detrás`);
    }
    ok(preguntaHueco(), 'la pregunta se cerró');
    tecla('Escape');
    M.libre.cerrar();
  });

  prueba('E65', 'Los logos que usan las plantillas del cliente se cargan con el editor, aunque ya no estén en su lista de logos', async () => {
    await tablero([pub(1)]); await poner('r1', [await foto('e65.jpg')]);
    const png = await new Promise(r => { const c = D.createElement('canvas'); c.width = 120; c.height = 60; c.getContext('2d').fillRect(0, 0, 120, 60); c.toBlob(r, 'image/png'); });
    const id = `kit-${CLIENTE}-logo-e65`;
    await M._in.idbPut('files', id, { name: 'e65-logo.png', size: png.size, type: 'image/png', w: 120, h: 60, lastModified: Date.now(), blob: png, thumb: png, logo: true });
    delete M.files[id];   // como en una mesa recién abierta: el logo no está en memoria
    const c0 = await M._in.idbGet('clients', CLIENTE); ok(c0, 'no está el cliente de prueba');
    const t = { id: 't-e65', nombre: 'Plantilla E65', comp: { bg: '#ffffff', velo: null, els: [{ id: 'l65', t: 'logo', src: id, x: 0.1, y: 0.1, w: 0.2, h: 0.1, rot: 0, op: 1 }] }, fmt: '4:5', rat: 0.8, at: new Date().toISOString() };
    await M._in.idbPut('clients', CLIENTE, { ...c0, libre: { ...(c0.libre || {}), plantillas: [...(((c0.libre || {}).plantillas) || []), t] } });
    try {
      await abrirEditor('r1');
      await hasta(() => ed().plant.some(x => x.id === 't-e65'), 4000, 'la plantilla en el editor');
      await hasta(() => M.files[id], 4000, 'el logo de la plantilla en el editor');
    } finally { M.libre.cerrar(); const c1 = await M._in.idbGet('clients', CLIENTE); await M._in.idbPut('clients', CLIENTE, { ...c1, libre: { ...(c1.libre || {}), plantillas: ((c1.libre || {}).plantillas || []).filter(x => x.id !== 't-e65') } }); }
  });

  prueba('E66', '«Rejilla» no saca a la vista las fotos ocultas ni mueve las bloqueadas', async () => {
    await tablero([pub(1)]); await poner('r1', [await foto('e66a.jpg')]);
    const [b, c] = await M.addFiles([await foto('e66b.jpg'), await foto('e66c.jpg')]);
    await abrirEditor('r1');
    accion('add-txt');
    compDe(0).els.push({ ...marcoEl('o66', 0.6, 0.6, 0.3, 0.3), src: b, oculto: true }, { ...marcoEl('k66', 0.05, 0.6, 0.3, 0.3), src: c, lock: true });
    accion('grid', { v: '2h' });
    await espera(30);
    const o = compDe(0).els.find(e => e.src === b), k = compDe(0).els.find(e => e.src === c);
    ok(o && o.oculto, 'la foto oculta salió a la vista');
    ok(k && k.lock, 'la foto bloqueada perdió el bloqueo');
    igual(k && [k.x, k.y, k.w, k.h], [0.05, 0.6, 0.3, 0.3], 'la foto bloqueada se movió');
    M.libre.cerrar();
  });

  prueba('E67', 'Una fuente que no cargó se vuelve a pedir al dibujar la diapositiva', async () => {
    await tablero([pub(1)]); await poner('r1', [await foto('e67.jpg')]);
    await abrirEditor('r1');
    const f0 = W.fetch; let n = 0;
    W.fetch = (u, o) => { if (String(u).endsWith('fonts/E67.ttf')) { n++; return n === 1 ? Promise.reject(new TypeError('sin red')) : f0.call(W, 'kits/fonts/LibreFranklin-Light.ttf', o); } return f0.call(W, u, o); };
    try {
      accion('add-txt');
      const t = compDe(0).els.find(e => e.t === 'texto'); t.font = { n: 'E67', file: 'fonts/E67.ttf', w: 300 };
      await dibujado(); await espera(100);
      ok(n >= 1, 'el editor no pidió la fuente');
      await M.libre.pieza(compDe(0), 200, 250);
      ok([...W.document.fonts].some(x => x.family.replace(/"/g, '') === 'LB E67' && x.status === 'loaded'), 'la fuente no se volvió a pedir: sigue sin cargar');
    } finally { W.fetch = f0; M.libre.cerrar(); }
  });

  prueba('E68', 'Una foto que llena un hueco agrupado sigue en el grupo del hueco', async () => {
    const [v] = await conHuecos([{ ...HV('h68'), g: 'g68' }, { ...HH('h68b'), g: 'g68' }], [V('e68.jpg')]);
    const e = await enHueco(1, 'h68', v);
    igual(e.g, 'g68', 'la foto salió del grupo del hueco');
    M.libre.cerrar();
  });

  // ---------- auditoría, lote 3: historias, revisar, descargar y calendario ----------
  const diaH = d => M.board().historias.filter(x => !x.cancelada && M._in.localDay(x.date) === d).sort((x, y) => M._in.ts(x.date) - M._in.ts(y.date)).map(x => x.id);
  const deH = id => M.board().historias.find(x => x.id === id);
  prueba('H29', 'Una historia soltada en otro día entre dos a un minuto queda donde se soltó; una duplicada, justo detrás de la suya (D-054)', async () => {
    await tablero([pub(1)]);
    const a = M.hs.anadir(DIA(5), { time: '10:00' }), b = M.hs.anadir(DIA(5), { time: '10:01' }), h = M.hs.anadir(DIA(6), { time: '18:00' });
    M.hs.mover(h, DIA(5), 1);
    igual(diaH(DIA(5)), [a, h, b], 'la soltada entre las dos no quedó en su sitio');
    const c = M.hs.duplicar(a);
    igual(diaH(DIA(5)), [a, c, h, b], 'la copia no quedó justo detrás de la suya');
  });

  prueba('H30', 'Poner a una historia la hora de otra mueve la que se cambia, no la otra (D-054)', async () => {
    await tablero([pub(1)]);
    const a = M.hs.anadir(DIA(5), { time: '09:00' }), b = M.hs.anadir(DIA(5), { time: '10:00' });
    M.hs.setFecha(a, DIA(5), '10:00');
    igual(M._in.localTime(deH(b).date), '10:00', 'se movió la que no se tocó');
    igual(M._in.localTime(deH(a).date), '10:01', 'la cambiada no quedó detrás');
  });

  prueba('H31', 'Añadir o duplicar detrás de una historia de las 23:59 la deja en su día', async () => {
    await tablero([pub(1)]);
    const a = M.hs.anadir(DIA(5), { time: '23:59' }), n = M.hs.anadir(DIA(5)), c = M.hs.duplicar(a);
    igual([M._in.localDay(deH(n).date), M._in.localDay(deH(c).date)], [DIA(5), DIA(5)], 'se fue al día siguiente');
  });

  prueba('M34', '«Revisar» ordena por la hora de la publicación aunque una fecha venga con +01:00 y otra con Z (D-040)', async () => {
    await tablero([{ id: 'r1', name: 'Foto 1.1', type: 'Foto', date: '2026-11-10T12:30:00.000+01:00' }, { id: 'r2', name: 'Foto 1.2', type: 'Foto', date: '2026-11-10T11:45:00.000Z' }]);
    await poner('r1', [await foto('m34a.jpg', 800, 1000)]); await poner('r2', [await foto('m34b.jpg', 700, 900)]);
    const r = await M.revisar();
    igual([...new Set(r.puntos.map(p => p.slotId))], ['r1', 'r2'], 'el orden no sigue la hora (12:30 antes que 12:45 en Madrid)');
  });

  prueba('M35', '«sube» por lotes: el lote siguiente, con la revisión del anterior abierta, se suma a ella (D-040)', async () => {
    await tablero([pub(1), pub(2)]);
    await poner('r1', [await foto('m35a.jpg', 800, 1000)]); await poner('r2', [await foto('m35b.jpg', 700, 900)]);
    M._in.closeDetail();
    M.revisar.auto('sube', ['r1']);
    await hasta(() => q('.detail:not([hidden])[data-dlg="revisar"]'), 6000, 'la revisión del primer lote');
    M.revisar.auto('sube', ['r2']);
    await espera(1700); await M.revisar.ultima;
    const d = await hasta(() => q('.detail:not([hidden])[data-dlg="revisar"]'), 4000, 'la revisión');
    ok(d.textContent.includes('Foto 1.1') && d.textContent.includes('Foto 1.2'), 'la revisión del segundo lote tapó la del primero: ' + d.textContent.slice(0, 160));
    M._in.closeDetail();
  });

  prueba('B7', 'Con el menú de una carpeta abierto, Esc lo cierra y no vacía lo elegido para descargar (D-083, D-076)', async () => {
    await tablero([pub(1), pub(2)]);
    await hasta(() => M.descargar, 4000, 'descargar.js');
    await poner('r1', [await foto('b7-a.jpg')]);
    const c = M.crearCarpeta('B7').id;
    clicCelda('r1', true);
    igual(M.descargar.elegidas().length, 1, 'no se eligió la casilla');
    M.carpetasUI.abrirMenu(200, 200, c);
    const menu = await hasta(() => q('.cpmenu'), 2000, 'el menú de la carpeta');
    tecla('Escape', { en: menu.querySelector('button') || D.body });
    await espera(30);
    ok(!q('.cpmenu'), 'el menú sigue abierto');
    igual(M.descargar.elegidas().length, 1, 'Esc vació lo elegido');
    M.descargar.vaciar();
  });

  prueba('P15', 'El calendario ya no lleva las ramas para una mesa anterior a la 3.68 (código muerto)', async () => {
    const src = await (await W.fetch('calendario.js?v=' + Date.now())).text();
    ok(!/X\.PASOS \?|X\.PASO_DE \?|X\.retenida \?/.test(src), 'siguen las ramas para una mesa anterior a la 3.68');
  });

  // ---------- auditoría, lote 4 (mesa 3.80): datos de la mesa ----------
  prueba('M36', 'La imagen del feed cuadra con una publicación cancelada y el mes anterior debajo (check.ok)', async () => {
    await limpiar();
    const r = await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, slots: [pub(1), pub(2), pub(3)], past: [{ id: 'p36a', name: 'Foto 0.1', type: 'Foto', date: '2026-10-20T12:00:00.000+02:00' }, { id: 'p36b', name: 'Foto 0.2', type: 'Foto', date: '2026-10-22T12:00:00.000+02:00' }], force: true });
    ok(r && r.key, 'no se abrió el tablero: ' + json(r));
    await poner('r1', [await foto('m36a.jpg')]); await poner('r2', [await foto('m36b.jpg')]); await poner('r3', [await foto('m36c.jpg')]);
    ok(!M.setEstado('r2', 'cancelado')[0].error, 'no se canceló');
    const out = await M.render('clean');
    ok(out && out.check && out.check.ok, 'la imagen del feed no cuadra con la mesa: ' + json(out && out.check));
  });

  prueba('M37', 'Abrir un mes no borra la copia de una recarga (mesa-pending) hasta haber guardado el tablero', async () => {
    await tablero([pub(1)]); await poner('r1', [await foto('m37.jpg')]);
    await M.flush();
    const b = M.board(), key = b.key;
    b.savedAt = new Date(Date.now() + 60000).toISOString();
    W.localStorage.setItem('mesa-pending', JSON.stringify({ key, board: b, v: 5 }));
    const mig = M.libre.migrar; M.libre.migrar = () => { throw new Error('fallo de prueba'); };
    try { await M.open(key).catch(() => {}); } finally { M.libre.migrar = mig; }
    const p = JSON.parse(W.localStorage.getItem('mesa-pending') || 'null');
    ok(p && p.key === key, 'la copia de la recarga se borró antes de guardar el tablero');
    W.localStorage.removeItem('mesa-pending');
    await M.open(key);
  });

  prueba('M38', 'El motivo de una cancelación escrito justo antes de cerrar o recargar la pestaña se guarda (D-082)', async () => {
    await tablero([pub(1)]);
    M._in.openDetail('r1', 0);
    const sel = await hasta(() => q('.detail .essel'), 3000, 'el estado en la publicación');
    sel.value = 'cancelado'; sel.dispatchEvent(new W.Event('change', { bubbles: true }));
    const mi = await hasta(() => q('.detail .esmot'), 3000, 'el campo «Motivo»');
    await M.flush(); W.localStorage.removeItem('mesa-pending');
    mi.value = 'Motivo de prueba M38'; mi.dispatchEvent(new W.Event('input', { bubbles: true }));
    M._onHide({ type: 'pagehide' });
    const p = JSON.parse(W.localStorage.getItem('mesa-pending') || 'null'), s = p && p.board && p.board.slots.find(x => x.id === 'r1');
    igual(s && s.estado && s.estado.motivo, 'Motivo de prueba M38', 'la copia de la recarga no lleva el motivo');
    W.localStorage.removeItem('mesa-pending');
    M._in.closeDetail();
  });

  prueba('M39', 'Quitar la foto de perfil de un cliente suelta también su URL de objeto (D-071)', async () => {
    await tablero([pub(1)]);
    const b = FOTOS['m39.jpg'] || (await foto('m39.jpg', 300, 300), FOTOS['m39.jpg']), id = 'perfil-m39-' + Date.now().toString(36);
    await M._in.idbPut('files', id, { name: 'Perfil · m39.jpg', size: b.size, type: 'image/jpeg', w: 300, h: 300, lastModified: Date.now(), blob: b, thumb: b });
    await M._in.loadThumbs([id]);
    const url = M.files[id] && M.files[id].thumbUrl; ok(url, 'la foto de perfil no tiene miniatura');
    await M.updateClient(CLIENTE, { foto: id });
    const rv = W.URL.revokeObjectURL, sueltas = [];
    W.URL.revokeObjectURL = u => { sueltas.push(u); return rv.call(W.URL, u); };
    try { await M.updateClient(CLIENTE, { foto: null }); } finally { W.URL.revokeObjectURL = rv; }
    ok(!M.files[id], 'la foto de perfil sigue en memoria');
    ok(sueltas.includes(url), 'su URL de objeto no se soltó');
  });

  prueba('M40', 'La mesa ya no copia su código entero en localStorage (mesa-code y mesa-version, que nadie lee)', async () => {
    ok(W.localStorage.getItem('mesa-code') === null, 'sigue guardando su código en localStorage («mesa-code»)');
    ok(W.localStorage.getItem('mesa-version') === null, 'sigue guardando «mesa-version»');
  });

  prueba('P16', 'M.setEstado con el estado que dan sus datos no la deja «retrasada a mano», como la ventana (D-085)', async () => {
    await tablero([pub(1)]); await poner('r1', [await foto('p16.jpg')]);
    const s = () => M._in.S.slots.find(x => x.id === 'r1');
    igual(M._in.estadoDe(s()), 'captions', 'con foto y sin caption no está en Captions');
    const r = M.setEstado('r1', 'captions');
    ok(!r[0].error, 'M.setEstado dio error: ' + json(r));
    ok(!M._in.retrasada(s()), 'quedó «retrasada a mano»');
  });

  // ---------- auditoría, lote 5 (mesa 3.81): interfaz de la mesa ----------
  prueba('M41', '⌘Z deshace «+ Hueco» y «Fijar en el perfil» como pasos propios, sin deshacer el cambio de antes (D-095)', async () => {
    await tablero([pub(1), pub(2)]);
    await poner('r1', [await foto('m41.jpg')]);
    await M.flush();
    const fotos = () => slot('r1').photos.length;
    await pulsar('[data-act="addfiller"]'); await M.flush();
    igual(M.board().fillers, 1, 'no se añadió el hueco');
    M._test.undo(); await M.flush();
    ok(!M.board().fillers, '⌘Z no quitó el hueco');
    igual(fotos(), 1, '⌘Z deshizo la foto puesta antes en vez del hueco');
    M._in.openDetail('r2', 0);
    const pin = await hasta(() => q('.detail .pinToggle'), 3000, 'el interruptor «Fijar»');
    pin.click(); await M.flush(); M._in.closeDetail();
    igual(M.board().pins, ['r2'], 'no se fijó');
    M._test.undo(); await M.flush();
    ok(!(M.board().pins || []).length, '⌘Z no quitó la fijación');
    igual(fotos(), 1, '⌘Z deshizo la foto en vez de la fijación');
  });

  prueba('M42', '«Vista cliente» es de solo mirar: ni ⌘Z, ni soltar fotos, ni arrastrar casillas (D-095)', async () => {
    await tablero([pub(1), pub(2)]);
    await poner('r1', [await foto('m42a.jpg')]); await poner('r2', [await foto('m42b.jpg')]);
    await M.flush();
    const orden = () => M.board().slots.map(s => s.id + ':' + s.photos.length).join(' ');
    const antes = orden();
    q('.clientToggle').click();
    try {
      tecla('z', { meta: true }); await M.flush();
      igual(orden(), antes, '⌘Z deshizo en «Vista cliente»');
      const dt = new W.DataTransfer(); dt.items.add(await foto('m42c.jpg'));
      celda('r1').dispatchEvent(new W.DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      await espera(300); await M.flush();
      igual(orden(), antes, 'una foto soltada en «Vista cliente» entró en la casilla');
      const a = celda('r1').getBoundingClientRect(), b = celda('r2').getBoundingClientRect();
      const pe = (t, el, x, y, bt) => el.dispatchEvent(new W.PointerEvent(t, { clientX: x, clientY: y, button: 0, buttons: bt, pointerType: 'mouse', pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      pe('pointerdown', celda('r1'), a.left + 20, a.top + 20, 1);
      pe('pointermove', celda('r1'), a.left + 40, a.top + 40, 1); pe('pointermove', celda('r2'), b.left + 20, b.top + 20, 1);
      pe('pointerup', celda('r2'), b.left + 20, b.top + 20, 0);
      await espera(100); await M.flush();
      ok(slot('r1').photos[0] && M.files[slot('r1').photos[0]].name === 'm42a.jpg', 'arrastrar en «Vista cliente» intercambió las casillas');
    } finally { q('.clientToggle').click(); }
  });

  prueba('M43', 'La tira de miniaturas de la publicación: si su soltar se pierde, el clic siguiente no reordena el carrusel', async () => {
    await tablero([pub(1, 'Carrusel')]);
    const ids = await poner('r1', [await foto('m43a.jpg'), await foto('m43b.jpg'), await foto('m43c.jpg')]);
    M._in.openDetail('r1', 0);
    const ths = await hasta(() => { const t = qa('.detail .card.post .strip .th[data-act="pick"]'); return t.length === 3 && t; }, 3000, 'las tres miniaturas');
    const r0 = ths[0].getBoundingClientRect(), r2 = ths[2].getBoundingClientRect();
    const pe = (t, el, x, y, bt) => el.dispatchEvent(new W.PointerEvent(t, { clientX: x, clientY: y, button: 0, buttons: bt, pointerType: 'mouse', pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
    pe('pointerdown', ths[0], r0.left + 5, r0.top + 5, 1);
    pe('pointermove', ths[1], r2.left + r2.width - 2, r2.top + 5, 1);    // arrastrando
    pe('pointermove', ths[1], r2.left + r2.width - 2, r2.top + 5, 0);    // el botón ya no está pulsado: su soltar se perdió
    pe('pointerup', D.body, r2.left + r2.width - 2, r2.top + 5, 0);      // el clic siguiente, en otra parte
    await espera(50);
    igual(slot('r1').photos, ids, 'el carrusel cambió de orden con el clic siguiente');
    M._in.closeDetail();
  });

  // ---------- auditoría, lote 6 (diseño 1.8, motor 1.4): diseñador y motor ----------
  prueba('D14', 'Sin conexión, el diseñador sigue con el kit ya leído en vez de decir que el cliente no tiene kit', async () => {
    await tablero([pub(1)]);
    await conKitPrueba(async () => {
      const k1 = await M.diseno.kit(CLIENTE); ok(k1 && !k1.error, 'no se leyó el kit: ' + json(k1));
      const f1 = W.fetch, mio = `kits/${CLIENTE}.json`;
      W.fetch = function (u, o) { const s = typeof u === 'string' ? u : u && u.url; return s && s.includes(mio) ? Promise.reject(new TypeError('sin red (prueba)')) : f1.call(W, u, o); };
      try {
        const k2 = await M.diseno.kit(CLIENTE);
        ok(k2 && !k2.error, 'sin red dice: ' + json(k2 && k2.error));
      } finally { W.fetch = f1; }
    });
  });

  prueba('D15', 'Una pestaña pausada no cambia el kit del cliente: ajustarKit se niega, como cargar y aplicar', async () => {
    await tablero([pub(1)]);
    await conKitPrueba(async () => {
      const c0 = await M._in.idbGet('clients', CLIENTE);
      const bc = new W.BroadcastChannel('mesa-feed'); bc.postMessage({ t: 'claim', id: 'otra-pestana-de-prueba' });
      try {
        await hasta(() => M._in.locked, 3000, 'la mesa pausada');
        const r = await M.diseno.ajustarKit(CLIENTE, { lienzo: { margen: 99 } });
        ok(r && r.error, 'ajustarKit escribió desde una pestaña pausada');
        const c1 = await M._in.idbGet('clients', CLIENTE);
        igual(json((c1 && c1.kit) || null), json((c0 && c0.kit) || null), 'cambió el kit guardado');
      } finally { bc.close(); await M._test.claim(); await hasta(() => !M._in.locked, 3000, 'la mesa activa otra vez'); }
    });
  });

  prueba('D16', 'Motor: ©, ® y ™ nunca empiezan una línea', async () => {
    const X = W.DisenoMotor._interno;
    for (const t of ['Travel®', 'Cup™', 'Marca©']) { const s = X.segmentosSinEspacio(t); ok(!s || !s.some(x => /^[©®™]/.test(x)), `«${t}» se puede partir antes del signo: ${json(s)}`); }
  });

  prueba('D17', 'Motor: las sílabas del catalán (à, è, ò, ï) se cortan bien y las del castellano no cambian', async () => {
    const X = W.DisenoMotor._interno;
    const guion = w => { const g = X.grafemas(w), k = [...X.cortesSilabicos(g)].sort((a, b) => a - b); let o = '', p = 0; for (const i of k) { o += g.slice(p, i).join('') + '-'; p = i; } return o + g.slice(p).join(''); };
    igual(guion('València'), 'Va-lèn-cia', 'València');
    igual(guion('història'), 'his-tò-ria', 'història');
    igual(guion('construcción'), 'cons-truc-ción', 'el castellano cambió');
  });

  // ---------- fallos delicados de la 3.82 ----------
  prueba('H32', '⌘Z no quita la marca de Zernio: la programada sigue programada, sin papelera y sin que cargarHistorias la pise; deshacer su creación no la quita (D-097)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.libre && M.hs && M.historias, 4000, 'libre.js e historias.js');
    const [f] = await M.addFiles([await foto('h32.jpg')]);
    const id = M.hs.anadir(DIA(10));               // un paso: crearla
    await historiaConFoto(id, f);                  // otro: diseñarla
    await M.flush();
    igual(M.marcarHistoriasProgramadas([{ id, zernioId: 'z-h32' }]), [{ id, state: 'programada' }], 'al marcar');
    await M.flush();
    const programada = que => { const h = M.historias(id)[0]; ok(h, `${que}: la historia desapareció`); igual([h.state, h.zernioId], ['programada', 'z-h32'], `${que}: perdió la marca de Zernio`); };
    M._test.undo(); await M.flush();
    programada('tras un ⌘Z');
    M.hs.borrar(id);
    ok(hDe(id), 'una programada se pudo borrar tras ⌘Z');
    const r = await M.cargarHistorias([{ date: hDe(id).date, order: 1, note: 'Pisada' }], { replace: true });
    igual(r[0].result, 'programada', 'cargarHistorias con replace la pisó tras ⌘Z');
    for (let i = 0; i < 3; i++) { M._test.undo(); await M.flush(); }   // hasta antes de crearla
    programada('tras deshacer su creación');
    M._test.redo(); await M.flush();
    programada('tras ⇧⌘Z');
    // y al revés: quitada la marca (zernioId: null), ⌘Z no la devuelve
    M.marcarHistoriasProgramadas([{ id, zernioId: null }]); await M.flush();
    ok(!M.historias(id)[0].zernioId, 'no se quitó la marca');
    M._test.undo(); await M.flush();
    ok(!M.historias(id)[0].zernioId, '⌘Z devolvió una marca de Zernio quitada');
  });

  prueba('H33', 'Un post que no tenía hora, o que la pierde, mueve sus historias por días enteros y cada una conserva su hora (D-057, D-098)', async () => {
    const k = id => M._in.localDay(hDe(id).date) + ' ' + M._in.localTime(hDe(id).date);
    const notion = async date => { await M.flush(); await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, slots: [{ ...pub(1), date }], past: [], force: true }); await M.flush(); };
    // sin hora → llega de Notion con hora
    await tablero([{ ...pub(1), date: DIA(5) }]);
    await hasta(() => M.hs, 4000, 'historias.js');
    const a = M.hs.anadir(DIA(5), { slotId: 'r1', time: '20:00' });
    await notion(`${DIA(5)}T19:00:00.000+01:00`);
    igual(k(a), `${DIA(5)} 20:00`, 'al recibir hora, la historia no conservó la suya');
    // con hora → pierde la hora
    await tablero([{ ...pub(1), date: `${DIA(5)}T10:00:00.000+01:00` }]);
    const b = M.hs.anadir(DIA(5), { slotId: 'r1', time: '23:30' });
    await notion(DIA(5));
    igual(k(b), `${DIA(5)} 23:30`, 'al perder la hora, la historia cambió de día u hora');
    // sin hora, a otro día con hora: los mismos días, la misma hora
    await notion(`${DIA(7)}T09:00:00.000+01:00`);
    igual(k(b), `${DIA(7)} 23:30`, 'no se movió por días enteros');
    // con hora a con hora: a la misma distancia, como siempre (D-057)
    await notion(`${DIA(8)}T11:00:00.000+01:00`);
    igual(k(b), `${DIA(9)} 01:30`, 'con hora a con hora no conservó la distancia');
  });

  prueba('M44', 'Con cambios sin aplicar en el editor, el aviso de otra pestaña y el de versión nueva lo dicen, y recargar o cerrar pregunta; sin cambios, no (D-099)', async () => {
    await tablero([pub(1)]);
    await poner('r1', [await foto('m44.jpg')]);
    const aviso = () => { const l = q('.lock'); return l ? l.textContent : ''; };
    const recargaPregunta = () => { const e = new W.Event('beforeunload', { cancelable: true }); W.dispatchEvent(e); return e.defaultPrevented; };
    const activa = async () => { qa('.lock').forEach(x => x.remove()); await M._test.claim(); await hasta(() => !M._in.locked, 3000, 'la mesa activa otra vez'); };
    const bc = new W.BroadcastChannel('mesa-feed'), otra = async () => { bc.postMessage({ t: 'claim', id: 'otra-pestana-de-prueba' }); await hasta(() => M._in.locked && q('.lock'), 3000, 'la mesa pausada'); };
    try {
      await abrirEditor('r1');                     // sin cambios: el aviso de siempre y recargar no pregunta
      await otra();
      ok(!/editor/i.test(aviso()), 'sin cambios, el aviso nombra el editor: ' + aviso());
      await activa();
      ok(!recargaPregunta(), 'sin cambios, recargar pregunta');
      accion('add-txt');                           // un cambio sin aplicar
      await otra();
      ok(aviso().includes('El editor tenía cambios sin aplicar: se perderán al usar la otra pestaña'), 'el aviso de otra pestaña no nombra el editor: ' + aviso());
      ok(!recargaPregunta(), 'pausada, recargar pregunta otra vez (el aviso ya lo dijo)');
      await activa();
      M._test.versionNueva();
      ok(/El editor tenía cambios sin aplicar: se perderán al recargar/.test(aviso()), 'el aviso de versión nueva no nombra el editor: ' + aviso());
      await activa();
      ok(recargaPregunta(), 'con cambios sin aplicar, recargar o cerrar no pregunta');
    } finally { bc.close(); if (M._in.locked) await activa(); }
    M.libre.cerrar();
    ok(!recargaPregunta(), 'con el editor cerrado, recargar pregunta');
  });

  prueba('M45', 'Importar un mes más reciente devuelve a la bandeja las fotos que solo usaba este Mac, con un aviso; nunca una imagen del editor ni una foto que sigue en uso (D-100)', async () => {
    await tablero([pub(1), pub(2)]);
    const [f] = await poner('r1', [await foto('m45-f.jpg')]);
    const [g] = await poner('r2', [await foto('m45-g.jpg')]);
    await abrirEditor('r2'); accion('add-txt'); await aplicarEditor();   // r2 lleva una imagen del editor hecha con g
    const img = slot('r2').photos[0];
    ok(img !== g && M.files[img] && M.files[img].design, 'el editor no dejó su imagen en la publicación');
    await M.flush();
    const d = JSON.parse(await (await M.exportAll({ returnBlob: true })).text());
    const b = d.boards.find(x => x.key === `${CLIENTE}-${MES}`);
    b.slots.find(s => s.id === 'r1').photos = [];  // en el otro Mac, F salió de su publicación (y de su bandeja)
    const s2 = b.slots.find(s => s.id === 'r2'); s2.photos = [g]; delete s2.libre;   // y la imagen del editor se quitó
    delete d.files[f]; delete d.files[img];
    (d.bandejas || []).forEach(r => { r.tray = r.tray.filter(x => x !== f && x !== img); });
    b.editedAt = b.savedAt = new Date(Date.now() + 60000).toISOString();
    M._in.clearToasts();
    const r = await M.importData(d, { confirm: false });
    ok(r && r.ok && r.boards.updated.includes(`${CLIENTE}-${MES}`), 'no se importó el mes: ' + json(r));
    await hasta(() => M.board() && M.board().key === `${CLIENTE}-${MES}`, 4000, 'el mes abierto otra vez');
    igual([slot('r1').photos, slot('r2').photos], [[], [g]], 'no ganó el mes del archivo');
    ok(M.board().tray.includes(f), 'la foto que solo usaba este Mac no volvió a la bandeja');
    ok(!M.board().tray.includes(img), 'la imagen del editor entró en la bandeja');
    ok(!M.board().tray.includes(g), 'una foto que sigue en su publicación entró en la bandeja');
    ok(toastCon(/1 foto que solo usaba este Mac ha vuelto a la bandeja/), 'sin aviso: ' + qa('.toasts .toast').map(t => t.textContent).join(' | '));
    igual(r.vueltas, 1, 'lo que devuelve importData');
  });

  prueba('M46', 'La imagen de «Editar portada» de un reel nunca entra en la bandeja: al cambiar la portada o quitarla, su foto vuelve sin ✓, «Deshacer» la devuelve y al reabrir no hay aviso de fotos quitadas (D-101)', async () => {
    await tablero([pub(1, 'Reel'), pub(2, 'Reel')]);
    const key = `${CLIENTE}-${MES}`;
    const disenos = () => M.board().tray.filter(f => M.files[f] && M.files[f].design);
    const vista = () => M._in.bandejaVista({ carpeta: null, todas: true }).map(x => M.files[x.f].name + (x.u ? ' ✓' : ''));
    const conEditor = async id => { await abrirEditor(id); accion('add-txt'); await aplicarEditor(); const img = slot(id).photos[0]; ok(M.files[img] && M.files[img].design && slot(id).libre && !slot(id).design, 'el reel no lleva la imagen del editor'); return img; };
    // cambiar su portada por otra foto
    const [p] = await poner('r1', [await foto('m46-p.jpg')]);
    await conEditor('r1');
    const [q] = await M.addFiles([await foto('m46-q.jpg')]);
    M._test.place('r1', q); await M.flush();
    igual(slot('r1').photos, [q], 'la portada nueva');
    igual(disenos(), [], 'al cambiar la portada, la imagen del editor entró en la bandeja');
    ok(M.board().tray.includes(p) && vista().includes('m46-p.jpg'), 'la foto de la portada del editor no volvió sin ✓: ' + json(vista()));
    // quitarla de la casilla: su foto vuelve, el aviso la cuenta y «Deshacer» devuelve la portada con su composición
    const [r] = await poner('r2', [await foto('m46-r.jpg')]);
    const img2 = await conEditor('r2');
    M._in.clearToasts();
    M._test.unassign('r2', null, true); await M.flush();
    igual(disenos(), [], 'al quitarla, la imagen del editor entró en la bandeja');
    ok(M.board().tray.includes(r) && vista().includes('m46-r.jpg'), 'al quitarla, su foto no volvió sin ✓: ' + json(vista()));
    ok(toastCon(/^La foto vuelve a la bandeja/), 'el aviso: ' + qa('.toasts .toast').map(t => t.textContent).join(' | '));
    (await hasta(() => qa('.toast button, .toasts button').find(x => /Deshacer/.test(x.textContent)), 2000, 'el botón Deshacer')).click();
    await M.flush();
    igual(slot('r2').photos, [img2], '«Deshacer» no devolvió la portada');
    ok(slot('r2').libre && slot('r2').libre.slides[img2] && !M.board().tray.includes(r), '«Deshacer» no devolvió su composición');
    // con otro cliente abierto se limpian las imágenes que nada usa: al volver, ningún aviso de fotos quitadas
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [pub(9)], past: [], force: true });
    await M._in.sweepDesigns(true); await M.flush();
    M._in.clearToasts();
    await M.open(key);
    ok(!toastCon(/se han quitado/), 'al reabrir, aviso de fotos quitadas: ' + qa('.toasts .toast').map(t => t.textContent).join(' | '));
    igual(slot('r2').photos, [img2], 'la portada del editor no sigue en su reel');
  });

  // ---------- cierre de la auditoría, lote 1 (mesa 3.84): decisiones de Kevin ----------
  prueba('E69', 'La plantilla 25: sin preguntar, el aviso nombra la que sale (la más antigua) y «Deshacer» la devuelve; el tope sigue en 24 y no cuenta las de historia (D-033, D-102)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('e69-a.jpg')]);
    const c0 = await M._in.idbGet('clients', CLIENTE), antes = c0.libre ? JSON.parse(json(c0.libre)) : null;
    const ps = Array.from({ length: 24 }, (_, i) => ({ id: 'e69-' + i, nombre: `Vieja ${i + 1}`, comp: { bg: '#ffffff', els: [] }, fmt: '4:5', rat: 0.8, at: '2026-11-01T00:00:00.000Z' }));
    const hist = { id: 'e69-h', nombre: 'Historia del kit', historia: true, comp: { bg: '#ffffff', els: [] }, fmt: '9:16', rat: 0.5625 };
    try {
      await M._in.idbPut('clients', CLIENTE, { ...c0, libre: { ...(c0.libre || {}), plantillas: [hist, ...ps] } });
      await M._in.loadClients();
      await abrirEditor('r1');
      M._in.clearToasts();
      const t = await guardarPlant();
      ok(!q('.lb-ask'), 'preguntó algo');
      const propias = () => ed().plant.filter(x => !x.historia).map(x => x.id);
      igual(propias().length, 24, 'el tope de 24');
      ok(!propias().includes('e69-0') && propias().includes(t.id), 'no salió la más antigua: ' + json(propias()));
      ok(ed().plant.some(x => x.id === 'e69-h'), 'se fue la plantilla de historia');
      const aviso = await hasta(() => qa('.toasts .toast').find(x => /«Vieja 1»/.test(x.textContent)), 4000, 'el aviso que nombra la plantilla que sale');
      const b = [...aviso.querySelectorAll('button')].find(x => /Deshacer/.test(x.textContent)); ok(b, 'el aviso no lleva «Deshacer»: ' + aviso.textContent);
      b.click();
      await hasta(() => propias()[0] === 'e69-0' && !propias().includes(t.id), 4000, '«Deshacer» devolviendo la plantilla');
      const c1 = await M._in.idbGet('clients', CLIENTE);
      igual(c1.libre.plantillas.filter(x => !x.historia).map(x => x.id), ps.map(x => x.id), 'la ficha del cliente tras «Deshacer»');
      ok(c1.libre.plantillas.some(x => x.id === 'e69-h'), 'la ficha perdió la plantilla de historia');
    } finally {
      if (M.libre.abierto()) M.libre.cerrar();
      const c2 = await M._in.idbGet('clients', CLIENTE);
      if (c2) { if (antes) c2.libre = antes; else delete c2.libre; await M._in.idbPut('clients', CLIENTE, c2); await M._in.loadClients(); }
    }
  });

  prueba('P17', 'Mover una Programada, en el calendario o en su ventana, avisa de que Zernio sigue con la fecha y hora de antes; una Publicada no se mueve ni en el calendario ni en su ventana (D-103)', async () => {
    await tablero([pub(1, 'Foto', 24), pub(2, 'Foto', 25)]);
    await porAprobar(['r1', 'r2'], 'p17');
    M.setEstado('r1', 'programado'); M.setEstado('r2', 'publicado'); await espera(60);
    if (q('.side > .cal.fold')) { q('.side > .cal [data-cal="fold"]').click(); await espera(60); }
    const fecha = id => M._in.localDay(slot(id).date), avisos = () => qa('.toasts .toast').map(t => t.textContent).join(' | ');
    async function arrastra(id, dia) {
      const ch = await hasta(() => q(`.side > .cal .chip[data-slot="${id}"]`), 3000, 'el chip de ' + id);
      const d = await hasta(() => q(`.side > .cal .cday[data-day="${dia}"]`), 3000, 'el día ' + dia);
      d.scrollIntoView({ block: 'center' }); await espera(30);
      const r = ch.getBoundingClientRect(), rd = d.getBoundingClientRect(), x = rd.left + rd.width / 2, y = rd.top + rd.height / 2;
      puntero('pointerdown', ch, r.left + 4, r.top + 4);
      puntero('pointermove', D, (r.left + x) / 2, (r.top + y) / 2); puntero('pointermove', D, x, y); puntero('pointerup', D, x, y);
      await espera(80);
    }
    M._in.clearToasts();
    await arrastra('r1', '2026-11-27');
    igual(fecha('r1'), '2026-11-27', 'la Programada no se movió en el calendario');
    ok(toastCon(/programada en Zernio/), 'mover la Programada no avisó: ' + avisos());
    M._in.clearToasts();
    await arrastra('r2', '2026-11-28');
    igual(fecha('r2'), '2026-11-25', 'la Publicada se movió en el calendario');
    ok(toastCon(/Ya está publicada/), 'sin aviso al soltar la Publicada: ' + avisos());
    // la ventana: la Publicada no deja cambiar fecha ni hora; la Programada sí, con el aviso
    M._in.openDetail('r2', 0);
    const d2 = await hasta(() => dialogo() && dialogo().querySelector('.dtin'), 3000, 'la ventana de la Publicada');
    ok(d2.disabled && dialogo().querySelector('.tmin').disabled, 'la fecha y la hora de la Publicada se pueden cambiar');
    igual(M._in.setDate('r2', '2026-11-28'), 'publicada', 'setDate movió la Publicada');
    igual(fecha('r2'), '2026-11-25', 'la Publicada se movió por setDate');
    M._in.closeDetail(); M._in.clearToasts();
    M._in.openDetail('r1', 0);
    const d1 = await hasta(() => dialogo() && dialogo().querySelector('.dtin'), 3000, 'la ventana de la Programada');
    ok(!d1.disabled, 'la fecha de la Programada no se puede cambiar');
    d1.value = '2026-11-29'; d1.dispatchEvent(new W.Event('change', { bubbles: true })); await espera(60);
    igual(fecha('r1'), '2026-11-29', 'la Programada no se movió desde su ventana');
    ok(toastCon(/programada en Zernio/), 'mover la Programada desde su ventana no avisó: ' + avisos());
    M._in.closeDetail();
  });

  prueba('M47', '«Eliminar cliente» borra sus logos (también los quitados de su lista) y su foto final, salvo los que use otro cliente o un mes; los de otro cliente no se tocan (D-104)', async () => {
    await tablero([pub(1)]);
    const id = 'prueba-regresion-k', otro = CLIENTE;
    await M._in.idbDel('clients', id).catch(() => {});
    const r0 = await M.addClient({ id, name: 'Cliente de prueba K' });
    ok(r0 && !r0.error, 'no se creó el cliente: ' + json(r0));
    const blob = await foto('m47.jpg', 64, 64);
    const fichero = async fid => M._in.idbPut('files', fid, { name: fid + '.png', size: blob.size, type: 'image/png', w: 64, h: 64, lastModified: 1, blob, thumb: blob, logo: true });
    const k = n => `kit-${id}-${n}`, ajeno = `kit-${otro}-logo-m47zz`;
    for (const f of [k('logo-m47a'), k('logo-m47b'), k('logo-m47c'), k('final'), ajeno]) await fichero(f);
    const c = await M._in.idbGet('clients', id);
    await M._in.idbPut('clients', id, { ...c, libre: { logos: [k('logo-m47a'), k('logo-m47b')] }, kit: { final: { foto: k('final') } } });   // m47c: quitado de su lista
    const co = await M._in.idbGet('clients', otro), antes = co.libre ? JSON.parse(json(co.libre)) : null;
    try {
      await M._in.idbPut('clients', otro, { ...co, libre: { ...(co.libre || {}), logos: [...((co.libre && co.libre.logos) || []), k('logo-m47b')] } });   // otro cliente usa uno suyo
      await M._in.loadClients();
      igual(await M.removeClient(id), true, 'no se eliminó el cliente');
      const hay = async f => !!(await M._in.idbGet('files', f));
      igual([await hay(k('logo-m47a')), await hay(k('logo-m47c')), await hay(k('final'))], [false, false, false], 'quedan logos o la foto final del cliente eliminado');
      ok(await hay(k('logo-m47b')), 'se borró el logo que usa otro cliente');
      ok(await hay(ajeno), 'se borró un logo de otro cliente');
    } finally {
      const c2 = await M._in.idbGet('clients', otro); if (c2) { if (antes) c2.libre = antes; else delete c2.libre; await M._in.idbPut('clients', otro, c2); }
      for (const f of [k('logo-m47a'), k('logo-m47b'), k('logo-m47c'), k('final'), ajeno]) await M._in.idbDel('files', f).catch(() => {});
      await M._in.idbDel('clients', id).catch(() => {}); await M._in.loadClients();
    }
  });

  prueba('E70', 'La foto que llena un hueco hereda su grupo, sus esquinas y su sombra; al borrarla vuelve el hueco tal cual (D-105)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('e70-a.jpg')]);
    const [f] = await M.addFiles([await foto('e70-b.jpg')], null, { tray: true });
    await abrirEditor('r1');
    accion('sl-add'); const i = ed().i;
    const h = { ...huecoEl('h70', 0.1, 0.1, 0.8, 0.5), g: 'G70', r: 0.2, sh: 0.5 };
    compDe(i).els.push(h, { id: 'x70', t: 'texto', txt: 'Pie', x: 0.1, y: 0.7, w: 0.8, h: 0.08, size: 0.04, color: '#000000', al: 'izq', g: 'G70' });
    const el = await enHueco(i, 'h70', f, '2');
    igual([el.g, el.r, el.sh], ['G70', 0.2, 0.5], 'la foto del hueco no heredó grupo, esquinas y sombra');
    elegir(el); accion('del');
    const vuelto = await hasta(() => compDe(i).els.find(e => e.t === 'hueco' && e.id === 'h70'), 3000, 'el hueco de vuelta');
    igual([vuelto.g, vuelto.r, vuelto.sh], ['G70', 0.2, 0.5], 'el hueco no volvió tal cual');
  });

  // ---------- cierre de la auditoría, lote 2 (mesa 3.85): datos ----------
  prueba('M48', 'El registro del cliente se cambia en una sola transacción: dos cambios a la vez desde la mesa y el editor quedan los dos, y un doble «Guardar como plantilla» guarda dos con nombres distintos (D-106)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('m48-a.jpg')]);
    const c0 = await M._in.idbGet('clients', CLIENTE), antes = { name: c0.name, handle: c0.handle || '', libre: c0.libre ? JSON.parse(json(c0.libre)) : null };
    try {
      await Promise.all([M.updateClient(CLIENTE, { handle: 'm48' }), M.updateClient(CLIENTE, { name: 'Nombre M48' })]);
      let c = await M._in.idbGet('clients', CLIENTE);
      igual([c.handle, c.name], ['@m48', 'Nombre M48'], 'dos updateClient a la vez: se perdió uno');
      await abrirEditor('r1');
      ed().sel = null; ed().mas = [];
      const ids0 = new Set(((c.libre && c.libre.plantillas) || []).map(t => t.id));
      accion('tpl-save'); accion('tpl-save');
      const p1 = M.updateClient(CLIENTE, { handle: 'm48b' });
      await p1;
      const nuevas = await hasta(async () => { const x = await M._in.idbGet('clients', CLIENTE), l = ((x.libre && x.libre.plantillas) || []).filter(t => !ids0.has(t.id)); return l.length >= 2 && l; }, 4000, 'las dos plantillas guardadas');
      igual(nuevas.length, 2, 'las plantillas nuevas');
      ok(nuevas[0].nombre !== nuevas[1].nombre, 'las dos plantillas se llaman igual: ' + nuevas[0].nombre);
      c = await M._in.idbGet('clients', CLIENTE);
      igual(c.handle, '@m48b', 'el cambio de la mesa a la vez que el editor se perdió');
      igual(ed().plant.filter(t => !ids0.has(t.id)).length, 2, 'el editor no ve las dos plantillas');
    } finally {
      if (M.libre.abierto()) M.libre.cerrar();
      const c2 = await M._in.idbGet('clients', CLIENTE);
      Object.assign(c2, { name: antes.name, handle: antes.handle }); if (antes.libre) c2.libre = antes.libre; else delete c2.libre;
      await M._in.idbPut('clients', CLIENTE, c2); await M._in.loadClients();
    }
  });

  prueba('H34', 'Con una versión nueva del kit, las plantillas de historia borradas no vuelven; entran solo las nuevas y las que siguen se redibujan; IndexedDB 9 (D-062, D-107, D-060)', async () => {
    await tablero([pub(1)]);
    const { kit, salir } = await conPlantillas();
    try {
      let c = await M._in.idbGet('clients', CLIENTE);
      igual(M.plantillasHistoria().length, 8, 'las 8 del kit');
      c.libre.plantillas = c.libre.plantillas.filter(t => t.nombre !== 'Historia · Foto a sangre');
      await M._in.idbPut('clients', CLIENTE, c); await M._in.loadClients();
      const p0 = kit.historias.plantillas[0];
      kit.historias = { ...kit.historias, v: (kit.historias.v || 1) + 1, plantillas: [...kit.historias.plantillas, { ...p0, id: 'h34-nueva', nombre: 'Nueva H34' }] };
      await M.hs.asegurar(CLIENTE); await M._in.loadClients();
      const nombres = M.plantillasHistoria().map(t => t.nombre.replace('Historia · ', ''));
      ok(!nombres.includes('Foto a sangre'), 'la borrada ha vuelto con la versión nueva del kit: ' + json(nombres));
      ok(nombres.includes('Nueva H34'), 'la nueva del kit no entró: ' + json(nombres));
      igual(nombres.length, 8, 'las plantillas de historia');
      c = await M._in.idbGet('clients', CLIENTE);
      igual(c.libre.historiasKit, kit.historias.v, 'la versión sembrada');
      const dbs = W.indexedDB.databases ? await W.indexedDB.databases() : [];
      if (dbs.length) igual((dbs.find(x => x.name === 'mesa-feed') || {}).version, V_IDB, 'la versión de IndexedDB');
    } finally { await salir(); }
  });

  prueba('D18', 'Un tipo cambiado en Notion con el diseñador aún sin cargar: al llegar el diseñador, el diseño se convierte, queda pendiente y avisa (D-089, D-108)', async () => {
    await tablero([pub(2, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r2', [await foto('d18a.jpg', 1080, 1350), await foto('d18b.jpg', 1080, 1350)], textos('D18', 'Portada', 'Ficha'));
      await M.flush();
      const rt = M.diseno._retipo, sy = M.diseno.sync;
      M.diseno._retipo = undefined; M.diseno.sync = undefined;   // como si diseno.js aún no hubiera llegado
      try { await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, slots: [{ ...pub(2, 'Carrusel'), type: 'Reel' }], past: [], force: true }); await espera(50); }
      finally { M.diseno._retipo = rt; M.diseno.sync = sy; }
      igual(slot('r2').design.slides[0].tipo, 'portada', 'sin el diseñador ya se convirtió');
      igual(slot('r2').type, 'Reel', 'el tipo de Notion');
      M._in.clearToasts();
      M.diseno.sync();
      await hasta(() => slot('r2').design.slides[0].tipo === 'reel', 3000, 'el diseño convertido a reel');
      igual(slot('r2').design.slides.length, 1, 'el reel lleva más de una diapositiva');
      igual(estadoDz('r2'), 'chg', 'el diseño convertido no quedó pendiente');
      ok(toastCon(/En Notion cambió el tipo de .*su diseño se ha convertido/), 'sin aviso del tipo cambiado: ' + qa('.toasts .toast').map(t => t.textContent).join(' | '));
      const antes = json(slot('r2').design); M.diseno.sync(); await espera(50);
      igual(json(slot('r2').design), antes, 'un segundo sync volvió a convertirlo');
    });
  });

  prueba('H35', 'cargarHistorias lee una fecha sin zona como hora de Madrid, también en un navegador en otro huso; con Z o su diferencia, como dice (D-109)', async () => {
    await tablero([pub(1)]);
    const D0 = W.Date, sz = /T\d\d:\d\d(:\d\d(\.\d+)?)?$/;
    class Londres extends D0 {                     // un navegador en Londres: en noviembre, una fecha sin zona es UTC
      constructor(...a) { if (a.length === 1 && typeof a[0] === 'string' && sz.test(a[0])) super(a[0] + 'Z'); else super(...a); }
      static parse(x) { return typeof x === 'string' && sz.test(x) ? D0.parse(x + 'Z') : D0.parse(x); }
    }
    let r;
    W.Date = Londres;
    try { r = await M.cargarHistorias([{ date: '2026-11-20T10:00', order: 1, note: 'H35 sin zona' }, { date: '2026-11-21T10:00:00+01:00', order: 1, note: 'H35 con zona' }, { date: '2026-11-22T09:00:00Z', order: 1, note: 'H35 con Z' }]); }
    finally { W.Date = D0; }
    ok(Array.isArray(r) && r.every(x => x.result === 'creada'), 'no se crearon: ' + json(r));
    const h = n => M.historias().find(x => x.note === n);
    igual([h('H35 sin zona').dateMadrid, h('H35 con zona').dateMadrid, h('H35 con Z').dateMadrid], ['2026-11-20 10:00', '2026-11-21 10:00', '2026-11-22 10:00'], 'las horas de Madrid');
    const mal = await M.cargarHistorias([{ date: '2026-11-20', order: 1, note: 'H35 sin hora' }]);
    ok(mal[0] && /fecha no válida/.test(mal[0].error || ''), 'una fecha sin hora no se rechazó: ' + json(mal));
  });

  // ---------- cierre de la auditoría, lote 3 (mesa 3.86): historias y edición ----------
  prueba('H36', 'Ordenar las historias del día nunca mueve una que está en Zernio ni hace cruzar el día: se mueve la otra, y al final del día hacia atrás (D-054, D-094, D-110)', async () => {
    await tablero([pub(1)]);
    const hora = id => M._in.localDay(viva(id).date) + ' ' + M._in.localTime(viva(id).date);
    const zer = id => { viva(id).zernio = { id: 'z-' + id, date: viva(id).date, file: null }; };
    // dos a un minuto, la segunda programada: una soltada entre ellas no mueve a la programada
    const a = M.hs.anadir(DIA(20), { time: '10:00' }), b = M.hs.anadir(DIA(20), { time: '10:01' });
    zer(b); M._in.changed();
    const h = M.hs.anadir(DIA(21), { time: '09:00' });
    M.hs.mover(h, DIA(20), 1);
    igual(hora(b), DIA(20) + ' 10:01', 'la programada cambió de hora');
    igual(hora(a), DIA(20) + ' 10:00', 'la primera cambió de hora');
    ok(hora(h) !== hora(b) && M._in.localDay(viva(h).date) === DIA(20), 'la soltada quedó a la hora de la programada o en otro día: ' + hora(h));
    // al final del día: la programada a las 23:59 no se mueve y la que choca con ella no pasa al día siguiente
    const c = M.hs.anadir(DIA(22), { time: '23:58' }), d = M.hs.anadir(DIA(22), { time: '23:59' });
    zer(d); M._in.changed();
    const e = M.hs.anadir(DIA(23), { time: '09:00' });
    M.hs.setFecha(e, DIA(22), '23:59');
    igual(hora(d), DIA(22) + ' 23:59', 'la programada de las 23:59 cambió');
    igual(M._in.localDay(viva(e).date), DIA(22), 'la que chocaba con ella pasó a otro día: ' + hora(e));
    const hs = M.hs.lista().filter(x => M._in.localDay(x.date) === DIA(22)).map(x => M._in.localTime(x.date));
    igual(new Set(hs).size, hs.length, 'dos historias del 22 a la misma hora: ' + json(hs));
    igual(hora(c), DIA(22) + ' 23:58', 'la de las 23:58 cambió');
  });

  prueba('D19', 'Cambiar el acento del kit deja pendiente un diseño con pie o final; uno sin ellos sigue al día, y uno aplicado antes de la 3.86 también, hasta su siguiente «Aplicar» (D-021, D-089, D-111)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel')]);
    await conKitPrueba(async () => {
      await poner('r1', [await foto('d19a.jpg', 1080, 1350), await foto('d19b.jpg', 1080, 1350)]);
      const c = await M.diseno.cargar('r1', { slides: textos('D19', 'Portada', 'Ficha'), serie: 'SERIE D19' }); ok(c && !c.error, 'cargar() falló: ' + json(c));
      const a = await M.diseno.aplicar('r1'); ok(a && a.ok, 'aplicar() falló: ' + json(a));
      await disenada('r2', [await foto('d19c.jpg', 1080, 1350), await foto('d19d.jpg', 1080, 1350)], textos('D19b', 'Portada', 'Ficha'));
      igual([estadoDz('r1'), estadoDz('r2')], ['ok', 'ok'], 'recién aplicados');
      try {
        await M.diseno.ajustarKit(CLIENTE, { colores: { terracotta_light: '#ff0000', terracotta_dark: '#ff0000' } });
        igual(estadoDz('r1'), 'chg', 'con otro acento, el diseño con pie sigue al día');
        igual(estadoDz('r2'), 'ok', 'el diseño sin pie ni final quedó pendiente');
        const r = await M.diseno.aplicar('r1'); ok(r && r.ok, 'volver a aplicar falló: ' + json(r));
        igual(estadoDz('r1'), 'ok', 'aplicado con el acento nuevo');
        delete M._in.slot('r1').design.acc;          // como uno aplicado antes de la 3.86 (en el tablero vivo)
        await M.diseno.ajustarKit(CLIENTE, { colores: { terracotta_light: '#00ff00', terracotta_dark: '#00ff00' } });
        igual(estadoDz('r1'), 'ok', 'un diseño aplicado antes de la 3.86 quedó pendiente');
      } finally { await M.diseno.ajustarKit(CLIENTE, null); }
    });
  });

  prueba('M49', 'Un cambio desde fuera con un campo de la ventana en uso no rehace ese campo: el estado se pone al día y la ventana se redibuja al dejarlo (D-112)', async () => {
    await tablero([pub(1), pub(2)]);
    await poner('r1', [await foto('m49-a.jpg')]);
    M._in.openDetail('r1', 0);
    const ta = await hasta(() => dialogo() && dialogo().querySelector('textarea.note'), 3000, 'el campo de contexto');
    ta.focus(); ta.value = 'Escribiendo'; ta._marca = 1;
    M.setEstado('r1', 'cancelado'); M.setEstado('r2', 'cancelado'); await espera(60);
    const ta2 = dialogo().querySelector('textarea.note');
    ok(ta2 === ta && ta2._marca === 1, 'el campo en el que se escribe se ha rehecho');
    ok(D.activeElement === ta, 'el campo perdió el foco');
    const sel = dialogo().querySelector('.phead .pest select'), elegido = sel && sel.selectedOptions[0];
    ok(elegido && /Cancelad/.test(elegido.textContent), 'el estado de la ventana no se puso al día: ' + (elegido ? elegido.textContent : 'sin selector'));
    ta.blur();
    await hasta(() => dialogo().querySelector('textarea.note') !== ta, 2000, 'que la ventana se redibuje al dejar el campo');
    M._in.closeDetail();
  });

  // ---------- cierre de la auditoría, lote 4 (mesa 3.87): baratos ----------
  prueba('M50', 'Un botón o un formulario que fallan lo dicen: «Editar cliente» con la escritura rechazada enseña el error en el diálogo, y un botón que falla avisa «No se pudo» (D-113)', async () => {
    await tablero([pub(1)]);
    const u0 = M.updateClient;
    const pulsa = (act, ds = {}) => { const b = D.createElement('button'); b.type = 'button'; b.hidden = true; b.dataset.act = act; Object.assign(b.dataset, ds); M._in.root().append(b); b.click(); b.remove(); };
    try {
      pulsa('editclient');
      const f = await hasta(() => q('form[data-form="editclient"]'), 3000, 'el diálogo de «Editar cliente»');
      M.updateClient = async () => { throw new Error('QuotaExceededError simulado'); };
      f.requestSubmit();
      await hasta(() => { const e = f.querySelector('.ferr'); return e && !e.hidden && /No se pudo/.test(e.textContent); }, 3000, 'el error en el diálogo');
      M._in.closeDetail(); M._in.clearToasts();
      const r0 = M.removeClient;
      M.removeClient = async () => { throw new Error('fallo M50'); };   // «Eliminar cliente» ya confirmado
      try { pulsa('delclient', { confirm: '1' }); await hasta(() => toastCon(/No se pudo: .*fallo M50/), 3000, 'el aviso del botón que falla'); }
      finally { M.removeClient = r0; }
    } finally { M.updateClient = u0; M._in.closeDetail(); }
  });

  prueba('M51', 'La pregunta «Sustituir / Añadir» de la mesa no se contesta con ⌘1 / ⌘2, Ctrl, ⌥ ni con la tecla mantenida; con 1 o 2 a secas, sí (D-078, D-114)', async () => {
    await tablero([pub(1)]);
    let r;
    M._in.askModoHistoria(v => { r = v; });
    await hasta(() => dialogo() && dialogo().dataset.dlg === 'addmode', 3000, 'la pregunta');
    for (const o of [{ meta: true }, { ctrl: true }, { alt: true }]) { tecla('2', o); await espera(20); }
    D.body.dispatchEvent(new W.KeyboardEvent('keydown', { key: '1', repeat: true, bubbles: true, cancelable: true })); await espera(20);
    ok(r === undefined && dialogo() && dialogo().dataset.dlg === 'addmode', 'la pregunta se contestó con un atajo: ' + r);
    tecla('2'); await espera(30);
    igual(r, 'anadir', 'el 2 a secas no contestó «Añadir»');
  });

  prueba('M52', 'Cada módulo dice que cargó entero (MESA_CARGA «ok»), y uno que lanza un error al ejecutarse queda en «fallo» y no en «Cargando…» (D-115)', async () => {
    await tablero([pub(1)]);
    const C = () => W.MESA_CARGA || {};
    await hasta(() => ['motor', 'diseno', 'libre', 'calendario', 'revisar', 'historias', 'carpetas', 'descargar'].every(k => C()[k] === 'ok'), 6000, 'todos los módulos en «ok»: ' + json(C()));
    // un módulo que llega pero falla al ejecutarse: el aviso de la mesa (index.html) lo marca «fallo»
    W.dispatchEvent(new W.ErrorEvent('error', { message: 'roto', filename: location.origin + '/revisar.js?v=9', error: new Error('roto') }));
    igual(C().revisar, 'ok', 'un error después de cargar marcó «fallo» a un módulo que ya estaba');
    delete C().revisar;
    W.dispatchEvent(new W.ErrorEvent('error', { message: 'roto', filename: location.origin + '/revisar.js?v=9', error: new Error('roto') }));
    igual(C().revisar, 'fallo', 'un error al ejecutarse no marcó el módulo');
    C().revisar = 'ok';
  });

  prueba('D20', 'El zoom de una diapositiva diseñada movido antes de que su vista esté lista no se queda marcando un zoom que la foto no tiene (E12)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d20a.jpg', 4000, 5000), await foto('d20b.jpg', 1080, 1350)], textos('D20', 'Portada', 'Ficha'));
      const f = slot('r1').design.slides[0].src;
      M._in.openDetail('r1', 0);
      const z = q('.detail .zoomr'), st = q('.detail .stage');
      ok(z && st && st.dataset.live, 'la ventana no tiene la vista en vivo del diseño');
      z.value = '2'; z.dispatchEvent(new W.Event('input', { bubbles: true }));   // en el mismo instante: la vista aún se prepara
      const zc = (((M._in.S.crops || {})[f]) || {}).z || 1;
      cerca(+z.value, zc, 0.001, 'el control marca un zoom que la foto no tiene');
      M._in.closeDetail();
    });
  });

  // ---------- «Editar …» con una foto que falta (mesa 3.94, D-123) ----------
  const dzAbierto = (ms = 8000) => hasta(() => M.diseno.abierto() && q('.dz'), ms, 'el diseñador abierto');
  const dzCerrar = async () => { M.diseno.cerrar(); await hasta(() => !M.diseno.abierto(), 3000, 'cerrar el diseñador'); };
  const sinPideClaude = m => ok(!/pídele a Claude que elija/.test(m || ''), 'el aviso todavía manda a Claude: ' + m);

  prueba('D21', '«Editar diapositivas» con una diapositiva sin foto abre el diseñador en ella con el aviso, la casilla sigue con sus imágenes; al ponerle foto y aplicar, la casilla se actualiza y todo es un paso de ⌘Z (D-123)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d21a.jpg', 1080, 1350), await foto('d21b.jpg', 1080, 1350)], textos('D21', 'Portada', 'Ficha'));
      const viejas = slot('r1').photos.slice();
      const c = await M.diseno.cargar('r1', { slides: textos('D21', 'Portada', 'Ficha', 'Nueva') }); ok(c && !c.error, 'cargar() falló: ' + json(c));
      igual(estadoDz('r1'), 'chg', 'los textos nuevos sin aplicar');
      const ap = await M.diseno.aplicar('r1');
      igual([ap.error, ap.diapositiva, ap.faltan], ['Falta la foto de la diapositiva 3: añádela y pulsa «Aplicar a la casilla».', 3, [3]], 'el error de aplicar() por la API');
      const [nueva] = await M.addFiles([await foto('d21c.jpg', 1080, 1350)]);
      const h0 = M._test.hist().undo;
      M._in.openDetail('r1', 0);
      await pulsar('.detail [data-act="editar"]');
      await dzAbierto();
      ok(!ed(), 'abrió el editor sin aplicar');
      igual([M.diseno.abierto().slot, M.diseno.abierto().diapositiva], ['r1', 3], 'el diseñador no abrió en la diapositiva sin foto');
      ok(toastCon(/^Falta la foto de la diapositiva 3: añádela y pulsa «Aplicar a la casilla»\./), 'sin el aviso de la foto que falta');
      ok(!toastCon(/No se pudo aplicar/), 'salió el error de antes');
      igual(slot('r1').photos, viejas, 'la casilla cambió sin aplicar');
      igual(estadoDz('r1'), 'chg', 'el diseño dejó de estar pendiente sin aplicar');
      const b = await hasta(() => q(`.dz .dz-ph[data-f="${nueva}"]`), 3000, 'la foto nueva en el panel'); b.click(); await espera(40);
      igual(slot('r1').design.slides[2].src, nueva, 'la foto no fue a la diapositiva 3');
      igual(slot('r1').photos, viejas, 'la casilla cambió al elegir la foto');
      await pulsar('.dz [data-dz="aplicar"]');
      await hasta(() => !M.diseno.abierto() && estadoDz('r1') === 'ok', 20000, 'aplicar desde el diseñador');
      igual(slot('r1').photos, salida('r1'), 'la casilla no lleva las imágenes nuevas');
      igual(salida('r1').length, 3, 'las 3 imágenes');
      ok(!viejas.some(f => slot('r1').photos.includes(f)), 'la casilla se quedó con alguna imagen vieja');
      igual(M._test.hist().undo, h0 + 1, 'abrir el diseñador, ponerle la foto y aplicar no son un paso de ⌘Z');
      await pulsar('.detail [data-act="editar"]');          // ya al día: abre el editor como siempre
      await abierto();
      igual(ed().sl.map(x => x.key), salida('r1'), 'después, «Editar diapositivas» no abrió sus imágenes');
      await cerrarEd();
      M._test.undo();
      igual(slot('r1').photos, viejas, '⌘Z no devolvió las imágenes de antes');
      igual(estadoDz('r1'), 'chg', '⌘Z no dejó el diseño pendiente');
      M._in.closeDetail();
    });
  });

  prueba('D22', 'Con varias diapositivas sin foto, el aviso las nombra todas y el diseñador abre en la primera; cerrar sin aplicar deja la casilla como estaba y se puede volver a entrar (D-123)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d22a.jpg', 1080, 1350)], textos('D22', 'Portada', 'Dos', 'Tres', 'Cuatro'), false);
      const crudas = slot('r1').photos.slice();
      const r = await M.libre.abrir('r1', 0);
      ok(r && r.ok && r.disenador, 'abrir() no dice que abrió el diseñador: ' + json(r));
      igual(r.faltan, [2, 3, 4], 'las diapositivas sin foto');
      await dzAbierto();
      igual(M.diseno.abierto().diapositiva, 2, 'no abrió en la primera sin foto');
      ok(toastCon(/Faltan las fotos de las diapositivas 2, 3 y 4: añádelas y pulsa «Aplicar a la casilla»\./), 'el aviso no las nombra todas');
      await pulsar('.dz [data-dz="cerrar"]');
      await hasta(() => !M.diseno.abierto(), 3000, 'cerrar sin cambios');
      igual(slot('r1').photos, crudas, 'la casilla cambió');
      tecla('e', { meta: true }); await espera(30);       // ⌘E sin la ventana no hace nada; con ella, lo mismo que el botón
      M._in.openDetail('r1', 0); tecla('e', { meta: true });
      await dzAbierto();
      igual(M.diseno.abierto().diapositiva, 2, '⌘E no abrió el diseñador en la primera sin foto');
      await dzCerrar(); M._in.closeDetail();
      const e = await M.diseno.aplicar('r1');
      igual([e.diapositiva, e.faltan], [2, [2, 3, 4]], 'aplicar() por la API');
      sinPideClaude(e.error);
    });
  });

  prueba('D23', 'La portada de un reel diseñado sin foto: «Editar portada» abre el diseñador con «Falta la foto de la portada»; al ponerla y aplicar, el reel tiene su portada (D-123)', async () => {
    await tablero([pub(1, 'Reel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [], [{ titulo: 'Reel D23' }], false);
      igual([slot('r1').photos.length, slot('r1').design.slides[0].src || null], [0, null], 'el reel sin foto');
      const [nueva] = await M.addFiles([await foto('d23a.jpg', 1080, 1920)]);
      M._in.openDetail('r1', 0);
      await pulsar('.detail [data-act="editar"]');
      await dzAbierto();
      ok(!ed(), 'abrió el editor');
      ok(toastCon(/^Falta la foto de la portada: añádela y pulsa «Aplicar a la casilla»\./), 'sin el aviso de la portada');
      igual(slot('r1').photos.length, 0, 'la casilla del reel cambió sin aplicar');
      const b = await hasta(() => q(`.dz .dz-ph[data-f="${nueva}"]`), 3000, 'la foto en el panel'); b.click(); await espera(40);
      await pulsar('.dz [data-dz="aplicar"]');
      await hasta(() => !M.diseno.abierto() && estadoDz('r1') === 'ok', 20000, 'aplicar la portada');
      igual(slot('r1').photos, salida('r1'), 'la casilla no lleva la portada');
      igual(salida('r1').length, 1, 'una portada');
      M._in.closeDetail();
    });
  });

  prueba('D24', 'Una diapositiva cuya foto ya no está en la mesa cuenta como foto que falta: abre el diseñador en ella y su aviso lo dice (D-123)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d24a.jpg', 1080, 1350), await foto('d24b.jpg', 1080, 1350)], textos('D24', 'Portada', 'Ficha'), false);
      const f = slot('r1').design.slides[1].src;
      await M._in.idbDel('files', f); delete M.files[f];
      const r = await M.libre.abrir('r1', 0);
      ok(r && r.ok && r.disenador, 'no abrió el diseñador: ' + json(r));
      await dzAbierto();
      igual(M.diseno.abierto().diapositiva, 2, 'no abrió en la diapositiva sin su foto');
      ok(toastCon(/Falta la foto de la diapositiva 2 \(la que tenía ya no está en la mesa\): añádela y pulsa «Aplicar a la casilla»\./), 'el aviso no dice que su foto ya no está');
      await dzCerrar();
      const v = await M.diseno.ver('r1', 2); ok(v && v.error && v.faltan, 'ver() de la diapositiva sin foto: ' + json(v)); sinPideClaude(v.error);
    });
  });

  prueba('D25', 'Sin la foto final del cliente, «Editar diapositivas» sigue sin abrir nada y dice lo de siempre (D-089, D-123)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d25a.jpg', 1080, 1350), await foto('d25b.jpg', 1080, 1350)], [...textos('D25', 'Portada', 'Ficha'), { tipo: 'final', titulo: 'Final D25' }], false);
      const crudas = slot('r1').photos.slice();
      const r = await M.libre.abrir('r1', 0);
      igual(r && r.error, 'No se pudo aplicar el diseño: Falta la foto final del cliente: pídele a Claude que la fije.', 'el error');
      ok(!ed() && !M.diseno.abierto(), 'abrió el editor o el diseñador');
      igual(slot('r1').photos, crudas, 'la casilla cambió');
    });
  });

  prueba('D26', 'Con la mesa en otra pestaña, «Editar diapositivas» de un diseño sin foto no abre nada y dice lo de siempre (D-123)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    const bc = new W.BroadcastChannel('mesa-feed');
    try {
      await conKitPrueba(async () => {
        await disenada('r1', [await foto('d26a.jpg', 1080, 1350)], textos('D26', 'Portada', 'Ficha'), false);
        bc.postMessage({ t: 'claim', id: 'otra-pestana-de-prueba' }); await hasta(() => M._in.locked && q('.lock'), 3000, 'la mesa pausada');
        const r = await M.libre.abrir('r1', 0);
        igual(r && r.error, 'La mesa está abierta en otra pestaña: pulsa «Usar aquí» antes de editar.', 'el error');
        ok(!ed() && !M.diseno.abierto(), 'abrió el editor o el diseñador');
        const a = await M.diseno.abrir('r1', { faltaFoto: true });
        ok(a && a.error && /otra pestaña/.test(a.error) && !M.diseno.abierto(), 'el diseñador abrió en una pestaña pausada: ' + json(a));
      });
    } finally { bc.close(); qa('.lock').forEach(x => x.remove()); await M._test.claim(); await hasta(() => !M._in.locked, 3000, 'la mesa activa otra vez'); }
  });

  // ---------- cierre de la auditoría, lote 6 (mesa 3.89): rendimiento y memoria ----------
  prueba('H37', 'Volver a aplicar una historia suelta su imagen anterior: queda pendiente de borrar mientras ⌘Z la pueda traer y nunca huérfana (D-117)', async () => {
    await tablero([pub(1, 'Foto', 5)]);
    await hasta(() => M.hs && M.libre, 4000, 'historias.js y libre.js');
    const key = M.board().key;
    const id = M.hs.anadir(DIA(10), { note: 'H37' });
    await M.flush();
    await abrirEditor(id); accion('add-txt'); await aplicarEditor();
    const a = hDe(id).photos[0]; ok(M.files[a] && M.files[a].design, 'la historia no tiene imagen');
    await abrirEditor(id); accion('add-txt'); await aplicarEditor();
    const b = hDe(id).photos[0]; ok(b && b !== a, 'la imagen no cambió al volver a aplicar');
    await M.flush();
    let r = await M.informeArchivos();
    ok(!r.huerfanos.some(x => x.id === a && !x.pendiente), 'la imagen anterior quedó huérfana sin estar pendiente: ' + json(r.huerfanos));
    // otro mes y vuelta: sin ⌘Z que la traiga, se borra
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [pub(9)], past: [], force: true });
    await M.open(key); await M.flush();
    r = await M.informeArchivos();
    ok(!r.huerfanos.some(x => x.id === a), 'la imagen anterior sigue en el navegador: ' + json(r.huerfanos));
    igual(hDe(id).photos, [b], 'la historia perdió su imagen');
  });

  prueba('M53', '«Cambiar portada» con una bandeja larga carga las miniaturas a medida que se ven, como la bandeja (B8)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('m53-p.jpg', 120, 150)]);
    const fs = []; for (let i = 0; i < 120; i++) fs.push(await foto(`m53-${i}.jpg`, 40, 50, `hsl(${i * 3},50%,50%)`));
    await M.addFiles(fs, null, { tray: true });
    M._in.openDetail('r1', 0);
    await pulsar('.detail [data-act="pickcover"]');
    const tira = await hasta(() => q('.detail .cpick .strip'), 3000, 'la tira de «Cambiar portada»');
    const n = qa('.detail .cpick .strip img').length;
    ok(n >= 120, 'la tira no tiene la bandeja: ' + n);
    const conSrc = qa('.detail .cpick .strip img[src^="blob:"]').length;
    ok(conSrc <= 80, `la tira cargó ${conSrc} miniaturas de golpe`);
    M._in.closeDetail();
  });

  prueba('E71', 'Cambiar de formato y volver no deja «cambios sin aplicar» en las diapositivas que no se tocaron (firma resumida, C15)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await poner('r1', [await foto('e71-a.jpg'), await foto('e71-b.jpg')]);
    await abrirEditor('r1');
    ok(!M.libre.pendiente(), 'recién abierto ya tiene cambios');
    accion('fmt', { v: 'q11' }); await espera(30);
    accion('fmt', { v: 'v45' }); await espera(30);
    accion('sl', { i: 1 }); elegir(compDe(1).els.find(e => e.t === 'foto'));
    const lock0 = compDe(1).els.find(e => e.t === 'foto').lock;
    accion('lock'); accion('lock');                // bloquear y desbloquear: la diapositiva pasa a composición sin cambiar
    if (lock0 === undefined) delete ed().sl[1].comp.els.find(e => e.t === 'foto').lock;
    ok(!M.libre.pendiente(), 'tras ir a 1:1 y volver a 4:5 quedan cambios sin aplicar: ' + json(ed().sl.map(x => !!x.comp)));
  });

  // ---------- las marcas de la bandeja: portada o relleno, y cuánto hace (D-122) ----------
  // p0, p1, p2: portada (azul oscuro, intermedio, claro); r: relleno (naranja); '': sin marca. Con el filtro «Todas».
  const uMarcas = () => Object.fromEntries(M._in.bandejaVista({ filtro: 'todas', todas: true, carpeta: null }).map(x => [M.files[x.f].name, x.c || '']));
  async function uEsperaMarcas(esp, que) {
    const sub = () => { const m = uMarcas(); return Object.fromEntries(Object.keys(esp).map(k => [k, k in m ? m[k] : 'no sale'])); };
    try { await hasta(() => json(sub()) === json(esp), 6000, que); } catch (e) { igual(sub(), esp, que); }
  }
  const uClase = t => !t ? 'no sale' : ((t.className.match(/\bu-(p0|p1|p2|r)\b/) || [])[1] || '') + (t.classList.contains('uso') && !/\bu-(p0|p1|p2|r)\b/.test(t.className) ? '?' : '');
  const uTileMesa = nombre => qa('.tray .tgrid .titem').find(t => M.files[t.dataset.file].name === nombre);
  const uTileEd = nombre => qa('.lb-tray .lb-tph').find(t => M.files[t.dataset.f].name === nombre);
  const uNombres = sel => qa(sel).map(t => M.files[t.dataset.file || t.dataset.f].name).sort();
  const uFondo = t => W.getComputedStyle(t, '::after').backgroundColor;
  const U_AGO = '2026-08', U_SEP = '2026-09', U_OCT = '2026-10', U_DIC = '2026-12';

  prueba('U1', 'Portada este mes, el mes pasado, hace 2 meses, hace 3 y en un mes posterior: ✓ azul oscuro, intermedio, claro, sin marca (y en «Sin usar») y oscuro; los meses se cuentan desde el tablero abierto, no desde hoy (D-122)', async () => {
    await tablero([pub(1)]);
    await poner('r1', [await foto('u1-nov.jpg')]);
    await M.flush();
    for (const [n, mes] of [[2, U_OCT], [3, U_SEP], [4, U_AGO], [5, U_DIC]]) {
      await abrirMes([pub(n, 'Foto', 5, mes)], mes);
      await poner(`r${n}-${mes}`, [await foto(`u1-${mes}.jpg`)]);
      await M.flush();
    }
    await M.open(`${CLIENTE}-${MES}`);
    await uEsperaMarcas({ 'u1-nov.jpg': 'p0', 'u1-2026-10.jpg': 'p1', 'u1-2026-09.jpg': 'p2', 'u1-2026-08.jpg': '', 'u1-2026-12.jpg': 'p0' }, 'las marcas en noviembre');
    igual(vista(false).filter(x => x.startsWith('u1-')), ['u1-2026-08.jpg'], '«Sin usar» en noviembre: la de hace 3 meses vuelve');
    await filtro('todas');
    igual(['u1-nov.jpg', 'u1-2026-10.jpg', 'u1-2026-09.jpg', 'u1-2026-08.jpg', 'u1-2026-12.jpg'].map(n => uClase(uTileMesa(n))), ['p0', 'p1', 'p2', '', 'p0'], 'las marcas en la bandeja de la mesa');
    ok(!uTileMesa('u1-2026-08.jpg').classList.contains('uso'), 'la de hace 3 meses lleva ✓');
    // desde septiembre (la batería tiene el reloj en octubre): agosto es el mes pasado y noviembre, posterior
    await M.open(`${CLIENTE}-${U_SEP}`);
    await uEsperaMarcas({ 'u1-nov.jpg': 'p0', 'u1-2026-10.jpg': 'p0', 'u1-2026-09.jpg': 'p0', 'u1-2026-08.jpg': 'p1', 'u1-2026-12.jpg': 'p0' }, 'las marcas en septiembre');
    await filtro('sin');
  });

  prueba('U2', 'Una sola marca por foto: portada y relleno a la vez → azul; portada hace 1 y 2 meses → la más reciente; portada hace 2 meses y relleno este mes → azul claro; relleno este mes, el pasado y hace 2 → naranja (terracota); relleno hace 3 meses → nada (D-122)', async () => {
    await tablero([pub(1), pub(2, 'Carrusel')]);
    const [a] = await poner('r1', [await foto('u2-ambas.jpg')]);
    const viejo = (await poner('r2', [await foto('u2-c-nov.jpg'), await foto('u2-r-nov.jpg'), await foto('u2-x.jpg'), await foto('u2-portada-sep.jpg')])).find(f => M.files[f].name === 'u2-portada-sep.jpg');   // addFiles las ordena por nombre
    const [a2] = await M._in.paraPoner([a]); M._test.place('r2', a2);       // la misma foto, de relleno en otra publicación del mes (copia, D-041)
    await M.flush();
    await abrirMes([pub(4, 'Carrusel', 5, U_OCT), pub(8, 'Foto', 12, U_OCT)], U_OCT);
    await poner(`r4-${U_OCT}`, [await foto('u2-c-oct.jpg'), await foto('u2-r-oct.jpg')]);
    const [dos] = await poner(`r8-${U_OCT}`, [await foto('u2-dos-azules.jpg')]); await M.flush();
    await abrirMes([pub(5, 'Foto', 5, U_SEP), pub(6, 'Carrusel', 9, U_SEP), pub(9, 'Foto', 12, U_SEP)], U_SEP);
    M._test.place(`r5-${U_SEP}`, viejo);                                     // portada en septiembre, relleno en noviembre
    M._test.place(`r9-${U_SEP}`, dos);                                       // portada en septiembre y en octubre: gana octubre
    await poner(`r6-${U_SEP}`, [await foto('u2-c-sep.jpg'), await foto('u2-r-sep.jpg')]); await M.flush();
    await abrirMes([pub(7, 'Carrusel', 5, U_AGO)], U_AGO);
    await poner(`r7-${U_AGO}`, [await foto('u2-c-ago.jpg'), await foto('u2-r-ago.jpg')]); await M.flush();
    await M.open(`${CLIENTE}-${MES}`);
    await uEsperaMarcas({ 'u2-ambas.jpg': 'p0', 'u2-portada-sep.jpg': 'p2', 'u2-c-nov.jpg': 'p0', 'u2-r-nov.jpg': 'r', 'u2-c-oct.jpg': 'p1', 'u2-r-oct.jpg': 'r', 'u2-c-sep.jpg': 'p2', 'u2-r-sep.jpg': 'r', 'u2-c-ago.jpg': '', 'u2-r-ago.jpg': '', 'u2-dos-azules.jpg': 'p1' }, 'las marcas');
    await filtro('todas');
    igual(qa('.tray .tgrid .titem').filter(t => M.files[t.dataset.file].name === 'u2-ambas.jpg').length, 1, 'la foto en dos publicaciones sale dos veces');
    igual(uClase(uTileMesa('u2-ambas.jpg')), 'p0', 'portada y relleno: una sola marca, azul');
    const col = ['u2-c-nov.jpg', 'u2-c-oct.jpg', 'u2-c-sep.jpg', 'u2-r-nov.jpg'].map(n => uFondo(uTileMesa(n)));
    igual(new Set(col).size, 4, 'las cuatro marcas no tienen cuatro colores: ' + json(col));
    igual(col[3], 'rgb(178, 80, 58)', 'el naranja no es el terracota #B2503A');
    ok(['u2-r-oct.jpg', 'u2-r-sep.jpg'].every(n => uFondo(uTileMesa(n)) === col[3]), 'el naranja cambia con el mes');
    ok(/rgb\(255, 255, 255\)/.test(W.getComputedStyle(uTileMesa('u2-c-nov.jpg'), '::after').boxShadow), 'la marca no lleva borde blanco');
    await filtro('sin');
  });

  prueba('U3', 'Portada: las dos fotos de una 1.ª diapositiva diseñada, la de un reel y la de un hueco; una publicación cancelada no cuenta; una foto solo en una historia lleva su anillo, sin ✓ (D-122, D-049, D-056)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Reel'), pub(3), pub(4, 'Foto', 20)]);
    await hasta(() => M.libre && M.hs, 4000, 'libre.js e historias.js');
    await poner('r1', [await foto('u3-a.jpg'), await foto('u3-b.jpg')]);
    const ids = await M.addFiles([await foto('u3-c.jpg'), await foto('u3-hueco.jpg', 1600, 1000), await foto('u3-hist.jpg')]), [c, hz, h] = ['u3-c.jpg', 'u3-hueco.jpg', 'u3-hist.jpg'].map(n => ids.find(f => M.files[f].name === n));   // addFiles las ordena por nombre
    await abrirEditor('r1', 0);
    accion('tr-add', { f: c });
    await hasta(() => compDe(0).els.some(e => e.t === 'foto' && e.src === c), 4000, 'la segunda foto en la diapositiva 1');
    await aplicarEditor();
    await poner('r2', [await foto('u3-reel.jpg', 1080, 1920)]);
    const [x] = await poner('r3', [await foto('u3-cancelada.jpg')]);
    M.setEstado('r3', 'cancelado');
    const [x2] = await M._in.paraPoner([x]); M._test.place('r1', x2);   // y de relleno en el carrusel: solo cuenta esta
    await pulsar('[data-act="addfiller"]');
    await M._test.setPreview(0, hz);
    const id = M.hs.anadir(DIA(10), { time: '12:00' });
    await historiaConFoto(id, h);
    await M.flush();
    await uEsperaMarcas({ 'u3-a.jpg': 'p0', 'u3-c.jpg': 'p0', 'u3-b.jpg': 'r', 'u3-reel.jpg': 'p0', 'u3-hueco.jpg': 'p0', 'u3-cancelada.jpg': 'r', 'u3-hist.jpg': '' }, 'las marcas');
    await filtro('todas');
    const th = uTileMesa('u3-hist.jpg');
    ok(th && th.querySelector('.hs') && !th.classList.contains('uso'), 'la foto de la historia: anillo y sin ✓');
    ok(vista(false).includes('u3-hist.jpg'), 'la foto de la historia salió de «Sin usar»');
    ok(/ · usada en una historia/.test(th.title), 'el título perdió «usada en una historia»: ' + th.title);
    ok(/portada · hueco del feed · nov/.test(uTileMesa('u3-hueco.jpg').title), 'el título del hueco: ' + uTileMesa('u3-hueco.jpg').title);
    ok(!uTileMesa('u3-hueco.jpg').querySelector('[data-act="del"]'), 'la portada del hueco tiene ×');
    await filtro('sin');
  });

  prueba('U4', 'Editor: la diapositiva 1 es portada y las demás relleno, en el mes del post, antes de aplicar; mover una foto de diapositiva cambia la marca en el momento, también con ⌘Z; en una historia no hay marca (D-122)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2)]);
    await hasta(() => M.libre && M.hs, 4000, 'libre.js e historias.js');
    await poner('r1', [await foto('u4-a.jpg'), await foto('u4-b.jpg'), await foto('u4-c.jpg')]);
    const [h] = await M.addFiles([await foto('u4-h.jpg')]);
    await M.flush();
    await editorConBandeja('r1');
    accion('tr-fil', { v: 'todas' });
    const enEd = () => ['u4-a.jpg', 'u4-b.jpg', 'u4-c.jpg'].map(n => uClase(uTileEd(n)));
    igual(enEd(), ['p0', 'r', 'r'], 'al abrir');
    ok(/^u4-b\.jpg · relleno · Carrusel 1\.1 · diapositiva 2 · 3 nov · ya está en una diapositiva$/.test(uTileEd('u4-b.jpg').title), 'el título en el editor: ' + uTileEd('u4-b.jpg').title);
    igual(uFondo(uTileEd('u4-c.jpg')), 'rgb(178, 80, 58)', 'el naranja del editor');
    accion('sl-up', { i: 1 });                     // la b pasa a ser la portada
    igual(enEd(), ['r', 'p0', 'r'], 'tras mover la diapositiva 2 delante');
    accion('undo');
    igual(enEd(), ['p0', 'r', 'r'], 'tras ⌘Z');
    accion('redo');
    igual(enEd(), ['r', 'p0', 'r'], 'tras ⇧⌘Z');
    accion('undo');
    accion('tr-fil', { v: 'sin' });
    M.libre.cerrar();
    // una historia: su foto no lleva marca, ni en el editor ni en la mesa
    const id = M.hs.anadir(DIA(10), { time: '12:00' });
    await historiaConFoto(id, h);
    await editorConBandeja(id);
    accion('tr-fil', { v: 'todas' });
    const t = await hasta(() => uTileEd('u4-h.jpg'), 3000, 'la foto de la historia en la bandeja del editor');
    ok(!t.classList.contains('uso'), 'la foto de la historia lleva ✓ en el editor');
    accion('tr-fil', { v: 'sin' });
    ok(uTileEd('u4-h.jpg'), 'la foto de la historia no está en «Sin usar» del editor');
    M.libre.cerrar();
  });

  prueba('U5', '«Sin usar / Libres para portada / Todas» en la mesa y en el editor: el mismo filtro, con su contador, recordado al recargar (D-122, D-041)', async () => {
    await tablero([pub(1), pub(2, 'Carrusel')]);
    await poner('r1', [await foto('u5-a.jpg')]);
    await poner('r2', [await foto('u5-b.jpg'), await foto('u5-c.jpg')]);
    await M.addFiles([await foto('u5-d.jpg')]);
    await M.flush();
    await abrirMes([pub(3, 'Foto', 5, U_AGO)], U_AGO);
    await poner(`r3-${U_AGO}`, [await foto('u5-e.jpg')]); await M.flush();
    await M.open(`${CLIENTE}-${MES}`);
    await uEsperaMarcas({ 'u5-a.jpg': 'p0', 'u5-b.jpg': 'p0', 'u5-c.jpg': 'r', 'u5-d.jpg': '', 'u5-e.jpg': '' }, 'las marcas');
    const cuenta = () => q('.tray .tcount').textContent;
    await filtro('portada');
    ok(q('.tray [data-act="tfil"][data-v="portada"]').classList.contains('on'), 'el botón «Libres para portada» no se enciende');
    igual(q('.tray [data-act="tfil"][data-v="portada"]').textContent, 'Libres para portada', 'el nombre del botón');
    await hasta(() => uNombres('.tray .tgrid .titem').length === 3, 4000, 'tres fotos libres para portada');
    igual([uNombres('.tray .tgrid .titem'), cuenta()], [['u5-c.jpg', 'u5-d.jpg', 'u5-e.jpg'], '3 libres para portada'], '«Libres para portada» en la mesa');
    await filtro('sin');
    await hasta(() => uNombres('.tray .tgrid .titem').length === 2, 4000, 'dos fotos sin usar');
    igual([uNombres('.tray .tgrid .titem'), cuenta()], [['u5-d.jpg', 'u5-e.jpg'], '2 sin usar'], '«Sin usar» en la mesa');
    await filtro('todas');
    igual([uNombres('.tray .tgrid .titem').length, cuenta()], [5, '2 sin usar · 3 ✓'], '«Todas» en la mesa');
    // el editor: el mismo filtro; la portada del post abierto cuenta como está allí
    await filtro('portada');
    await editorConBandeja('r1');
    ok(q('.lb-tray [data-lb="tr-fil"][data-v="portada"]').classList.contains('on'), 'el editor no tiene el filtro de la mesa');
    igual([uNombres('.lb-tray .lb-tph'), q('.lb-trb .lb-trn').textContent], [['u5-c.jpg', 'u5-d.jpg', 'u5-e.jpg'], 'Bandeja · 3'], '«Libres para portada» en el editor');
    accion('tr-fil', { v: 'sin' });
    igual(W.localStorage.getItem('mesa-bandeja-filtro'), 'sin', 'el editor no guarda el filtro');
    accion('tr-fil', { v: 'portada' });
    M.libre.cerrar();
    ok(q('.tray [data-act="tfil"][data-v="portada"]').classList.contains('on'), 'la mesa no sigue al editor');
    // recargar
    await M.flush();
    await preparar();
    if (!M.board() || M.board().key !== `${CLIENTE}-${MES}`) await M.open(`${CLIENTE}-${MES}`);
    await hasta(() => q('.tray [data-act="tfil"][data-v="portada"].on'), 4000, '«Libres para portada» tras recargar');
    await hasta(() => json(uNombres('.tray .tgrid .titem')) === json(['u5-c.jpg', 'u5-d.jpg', 'u5-e.jpg']), 6000, 'las libres para portada tras recargar');
    await editorConBandeja('r1');
    ok(q('.lb-tray [data-lb="tr-fil"][data-v="portada"]').classList.contains('on'), 'el editor no lo recuerda');
    M.libre.cerrar();
    await filtro('sin');
  });

  prueba('U6', 'El título de la foto dice el uso que decide su marca; la que ya no cuenta no tiene ×, en «Sin usar» y en «Todas», y la sin usar sí (D-122, D-041)', async () => {
    await tablero([pub(1), pub(2, 'Carrusel')]);
    await poner('r1', [await foto('u6-a.jpg')]);
    await poner('r2', [await foto('u6-b.jpg'), await foto('u6-c.jpg'), await foto('u6-d.jpg')]);
    await M.addFiles([await foto('u6-libre.jpg')]);
    await M.flush();
    await abrirMes([pub(5, 'Foto', 7, U_AGO)], U_AGO);
    await poner(`r5-${U_AGO}`, [await foto('u6-e.jpg')]); await M.flush();
    await M.open(`${CLIENTE}-${MES}`);
    await uEsperaMarcas({ 'u6-a.jpg': 'p0', 'u6-d.jpg': 'r', 'u6-e.jpg': '' }, 'las marcas');
    await filtro('todas');
    const tit = n => uTileMesa(n).title;
    igual(tit('u6-a.jpg'), 'u6-a.jpg · portada · Foto 1.1 · 3 nov · arrástrala a una casilla o púlsala y luego la casilla', 'el título de una portada');
    igual(tit('u6-d.jpg'), 'u6-d.jpg · relleno · Carrusel 1.2 · diapositiva 3 · 4 nov · arrástrala a una casilla o púlsala y luego la casilla', 'el título de un relleno');
    igual(tit('u6-e.jpg'), 'u6-e.jpg · usada hace 3 meses o más (portada · Foto 1.5 · 7 ago): ya no cuenta · arrástrala a una casilla o púlsala y luego la casilla', 'el título de una que ya no cuenta');
    igual(tit('u6-libre.jpg'), 'u6-libre.jpg · arrástrala a una casilla o púlsala y luego la casilla', 'el título de una sin usar');
    const x = n => !!uTileMesa(n).querySelector('[data-act="del"]');
    igual(['u6-a.jpg', 'u6-d.jpg', 'u6-e.jpg', 'u6-libre.jpg'].map(x), [false, false, false, true], 'la × en «Todas»');
    await filtro('sin');
    igual(['u6-e.jpg', 'u6-libre.jpg'].map(x), [false, true], 'la × en «Sin usar»');
  });

  // ---------- aviso ligero para las fotos ya usadas solo como relleno (mesa 3.98, libre 1.50, D-127) ----------
  const repeVentana = () => { const d = dialogo(); return d && d.dataset.dlg === 'repe' ? d : null; };
  const toasts = () => qa('.toasts .toast').map(t => t.textContent).join(' | ');
  prueba('U7', 'Mesa: una foto naranja (solo relleno) entra sin preguntar, como portada o como relleno, con un aviso ligero con su uso; azul, ya en esta publicación, en una historia o usada sin marca: la ventana de siempre; en un lote, un aviso para las naranjas y la lista con las demás (D-127)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2), pub(3), pub(4), pub(5, 'Carrusel'), pub(6, 'Carrusel'), pub(7, 'Carrusel')]);
    const fs = await poner('r1', await Promise.all(['a-portada', 'b-relleno', 'c-relleno', 'd-historia', 'e-relleno', 'f-relleno'].map(n => foto(`u7-${n}.jpg`))));
    const id = n => fs.find(f => M.files[f].name === `u7-${n}.jpg`);
    await poner('r5', [await foto('u7-g-portada5.jpg')]);
    await hasta(() => M.libre && M.hs, 4000, 'libre.js e historias.js');
    await historiaConFoto(M.hs.anadir(DIA(10)), id('d-historia'));
    await M.flush();
    await uEsperaMarcas({ 'u7-a-portada.jpg': 'p0', 'u7-b-relleno.jpg': 'r', 'u7-c-relleno.jpg': 'r', 'u7-d-historia.jpg': 'r' }, 'las marcas de partida');
    // naranja como portada de una Foto: entra sin ventana, con el aviso ligero
    M._test.addToSlot('r2', [id('b-relleno')]);
    await hasta(() => slot('r2').photos.length === 1, 3000, 'la naranja entra en r2');
    ok(!repeVentana(), 'la naranja preguntó');
    ok(toastCon(/^Ya usada como relleno · Carrusel 1\.1 · 3 nov$/), 'sin el aviso ligero: ' + toasts());
    // naranja como relleno de un carrusel con foto (desde el ordenador): entra al final sin preguntar
    await M.addFiles([await foto('u7-c-relleno.jpg')], 'r5');
    ok(!repeVentana(), 'la naranja soltada en un carrusel con foto preguntó por repetida');
    await hasta(() => slot('r5').photos.length === 2, 3000, 'la naranja como relleno de r5');
    ok(toastCon(/^Ya usada como relleno · Carrusel 1\.1 · 3 nov$/), 'sin el aviso ligero en r5: ' + toasts());
    // desde la bandeja a una con foto: sale «Sustituir / Añadir» y el aviso ligero sigue encima
    qa('.toasts .toast').forEach(t => t.remove());
    M._test.addToSlot('r5', [id('f-relleno')]);
    await hasta(() => dialogo() && dialogo().dataset.dlg === 'addmode', 3000, '«Sustituir / Añadir»');
    ok(toastCon(/^Ya usada como relleno · Carrusel 1\.1 · 3 nov$/), 'el aviso ligero no sigue sobre «Sustituir / Añadir»: ' + toasts());
    q('.detail[data-dlg="addmode"] [data-act="addmode"][data-m="add"]').click();
    await hasta(() => slot('r5').photos.length === 3, 3000, 'añadida a r5');
    // azul: la ventana de siempre
    M._test.addToSlot('r3', [id('a-portada')]);
    let d = await hasta(repeVentana, 3000, 'la ventana con la azul');
    ok(/Ya usada este mes/.test(d.textContent), 'la ventana de la azul: ' + d.textContent);
    d.querySelector('[data-act="close"].btn2, .btn2[data-act="close"]').click(); await espera(30);
    igual(slot('r3').photos.length, 0, 'Cancelar dejó entrar la azul');
    // naranja que ya va en esta misma publicación: la ventana
    M._test.addToSlot('r1', [id('e-relleno')]);
    d = await hasta(repeVentana, 3000, 'la ventana en la misma publicación');
    ok(/Ya usada en este post/.test(d.textContent), 'la ventana en la misma publicación: ' + d.textContent);
    M._in.closeDetail(); await espera(30);
    // naranja que va también en una historia: la ventana
    M._test.addToSlot('r4', [id('d-historia')]);
    d = await hasta(repeVentana, 3000, 'la ventana con la de la historia');
    M._in.closeDetail(); await espera(30);
    igual(slot('r4').photos.length, 0, 'la de la historia entró sin preguntar');
    // un lote: dos naranjas, una azul y una sin usar → un solo aviso y la lista solo con la azul
    const [nueva] = await M.addFiles([await foto('u7-h-nueva.jpg')]);
    M._test.addToSlot('r6', [nueva, id('e-relleno'), id('f-relleno'), id('a-portada')]);
    d = await hasta(repeVentana, 3000, 'la lista del lote');
    igual(qa('.detail[data-dlg="repe"] .repl li b').map(b => b.textContent), ['u7-a-portada.jpg'], 'la lista lleva solo las demás');
    ok(!toastCon(/^2 fotos ya usadas como relleno$/), 'el aviso salió antes de decidir');
    d.querySelector('[data-act="repe"][data-m="saltar"]').click();
    await hasta(() => slot('r6').photos.length === 3, 3000, 'las naranjas y la nueva entran, la azul no');
    ok(toastCon(/^2 fotos ya usadas como relleno$/), 'sin el aviso del lote: ' + toasts());
    // lote con una sola naranja y una azul, «Usar todas»: el aviso la nombra
    M._test.addToSlot('r7', [id('e-relleno'), id('a-portada')]);
    d = await hasta(repeVentana, 3000, 'la lista del segundo lote');
    d.querySelector('[data-act="repe"][data-m="usar"]').click();
    await hasta(() => slot('r7').photos.length === 2, 3000, 'las dos en r7');
    ok(toastCon(/^1 foto ya usada como relleno: u7-e-relleno\.jpg · Carrusel 1\.6 · 8 nov$/), 'el aviso de una en un lote (decide el uso más tardío, como el título de la bandeja): ' + toasts());
    // «Cancelar» en un lote: no entra nada y no hay aviso
    qa('.toasts .toast').forEach(t => t.remove());
    M._test.addToSlot('r3', [id('f-relleno'), id('a-portada')]);
    d = await hasta(repeVentana, 3000, 'la lista del tercer lote');
    d.querySelector('[data-act="close"]').click(); await espera(60);
    igual(slot('r3').photos.length, 0, 'Cancelar dejó entrar la naranja');
    ok(!toastCon(/relleno/), 'con Cancelar salió el aviso ligero');
  });

  prueba('U8', 'Mesa: usada solo como relleno hace 3 meses o más (sin marca): la ventana de siempre; en un hueco del feed una naranja entra sin preguntar (D-127, D-049)', async () => {
    await abrirMes([pub(9, 'Carrusel', 5, U_AGO)], U_AGO);
    await poner(`r9-${U_AGO}`, [await foto('u8-a-ago.jpg'), await foto('u8-b-ago.jpg')]); await M.flush();
    await abrirMes([pub(1, 'Carrusel'), pub(2)], MES);
    const fs = await poner('r1', [await foto('u8-c-portada.jpg'), await foto('u8-d-relleno.jpg')]); await M.flush();
    await uEsperaMarcas({ 'u8-b-ago.jpg': '', 'u8-d-relleno.jpg': 'r' }, 'las marcas');
    const p = M.addFiles([await foto('u8-b-ago.jpg')], 'r2');
    const d = await hasta(repeVentana, 4000, 'la ventana con la de agosto');
    ok(/agosto/i.test(d.textContent), 'la ventana no dice su uso: ' + d.textContent);
    d.querySelector('[data-act="close"]').click(); await p;
    // en un hueco del feed (D-049): la naranja entra sin preguntar
    q('.bar [data-act="addfiller"]').click(); await espera(60);
    const f = fs.find(x => M.files[x].name === 'u8-d-relleno.jpg');
    let hecho = false; M._test.setPreview(0, f).then(() => { hecho = true; });
    await hasta(() => hecho || repeVentana(), 4000, 'la portada del hueco');
    if (repeVentana()) M._in.closeDetail();
    ok(hecho, 'la naranja en un hueco preguntó');
    ok(toastCon(/^Ya usada como relleno · Carrusel 1\.1 · 3 nov$/), 'sin el aviso ligero en el hueco: ' + toasts());
  });

  prueba('U9', 'Editor: una foto naranja entra en la diapositiva sin preguntar, con el aviso ligero; una azul pregunta; una que ya va en este post pregunta (D-127, D-122)', async () => {
    await tablero([pub(1, 'Carrusel'), pub(2, 'Carrusel')]);
    const fs = await poner('r1', [await foto('u9-a-portada.jpg'), await foto('u9-b-relleno.jpg')]);
    await poner('r2', [await foto('u9-c-portada2.jpg'), await foto('u9-d-otra2.jpg')]);
    await M.flush();
    const id = n => fs.find(f => M.files[f].name === `u9-${n}.jpg`);
    await abrirEditor('r2', 1);
    accion('tr-add', { f: id('b-relleno') });
    await hasta(() => compDe(1).els.some(e => e.t === 'foto' && M.files[e.src] && M.files[e.src].name === 'u9-b-relleno.jpg'), 4000, 'la naranja en la diapositiva');
    ok(!preguntaEditor(), 'la naranja preguntó en el editor');
    ok(toastCon(/^Ya usada como relleno · Carrusel 1\.1 · 3 nov$/), 'sin el aviso ligero en el editor: ' + toasts());
    accion('tr-add', { f: id('a-portada') });
    await hasta(preguntaEditor, 3000, 'la pregunta con la azul');
    ok(/Ya usada este mes/.test(ed().ask.textContent), 'la pregunta de la azul: ' + ed().ask.textContent);
    ed().ask.querySelector('[data-ask="seguir"]').click(); await espera(30);
    accion('tr-add', { f: id('b-relleno') });   // ya va en la diapositiva 2 de este post
    await hasta(preguntaEditor, 3000, 'la pregunta con la que ya va en este post');
    ok(/Ya usada en (esta diapositiva|este post)/.test(ed().ask.textContent), 'la pregunta de la de este post: ' + ed().ask.textContent);
    ed().ask.querySelector('[data-ask="seguir"]').click(); await espera(30);
    await cerrarEd();
  });

  // ---------- ← → en el diseñador (mesa 3.96, diseño 1.15, D-125) ----------
  prueba('D27', 'En el diseñador ← → pasan a la diapositiva anterior y siguiente, como ↑ ↓; no escribiendo, en un conmutador, en la barra del velo ni con modificadores (D-125)', async () => {
    await tablero([pub(1, 'Carrusel')]);
    await conKitPrueba(async () => {
      await disenada('r1', [await foto('d27a.jpg', 1080, 1350), await foto('d27b.jpg', 1080, 1350), await foto('d27c.jpg', 1080, 1350)], textos('D27', 'Portada', 'Ficha', 'Otra'), false);
      const r = await M.diseno.abrir('r1'); ok(!r || !r.error, 'no abrió el diseñador: ' + json(r));
      await dzAbierto();
      const dia = () => M.diseno.abierto().diapositiva;
      igual(dia(), 1, 'no abrió en la primera');
      tecla('ArrowLeft'); igual(dia(), 1, '← en la primera la movió');
      tecla('ArrowRight'); igual(dia(), 2, '→ no pasó a la siguiente');
      tecla('ArrowRight'); igual(dia(), 3, '→ no pasó a la tercera');
      tecla('ArrowRight'); igual(dia(), 3, '→ en la última la movió');
      tecla('ArrowLeft'); igual(dia(), 2, '← no volvió a la anterior');
      for (const m of [{ meta: true }, { ctrl: true }, { alt: true }, { shift: true }]) { tecla('ArrowRight', m); igual(dia(), 2, '→ con modificador ' + json(m)); }
      const en = sel => { const el = q(sel); ok(el, 'sin ' + sel); el.focus(); return el; };
      tecla('ArrowRight', { en: en('.dz textarea[data-f="titulo"]') }); igual(dia(), 2, '→ escribiendo el título');
      tecla('ArrowLeft', { en: en('.dz .seg button') }); igual(dia(), 2, '← en un conmutador');
      const vr = q('.dz .dz-velor'); if (vr) { tecla('ArrowRight', { en: en('.dz .dz-velor') }); igual(dia(), 2, '→ en la barra del velo'); }
      D.activeElement.blur();
      tecla('ArrowDown'); igual(dia(), 3, '↓ dejó de funcionar');
      tecla('ArrowUp'); igual(dia(), 2, '↑ dejó de funcionar');
      await dzCerrar();
    });
  });

  // ---------- ubicaciones de las publicaciones (mesa 3.95, D-124) ----------
  // lugares de prueba: los ids no son de ninguna página de verdad
  const LUG = { a: { nombre: 'Lugar Alfa', locationId: '100000000000001' }, b: { nombre: 'Lugar Gamma', locationId: '100000000000002' }, c: { nombre: 'Lugar Beta', locationId: '100000000000003' } };
  const ubSel = () => q('.detail .ubsel');
  async function ubVentana(id) { M._in.openDetail(id, 0); return hasta(() => ubSel(), 3000, 'el desplegable «Ubicación»'); }
  const ubNombres = sel => [...sel.options].map(o => o.textContent);
  async function ubElegir(sel, nombre) {
    const o = [...sel.options].find(x => x.textContent === nombre); ok(o, `«${nombre}» no está en el desplegable: ` + json(ubNombres(sel)));
    sel.value = o.value; sel.dispatchEvent(new W.Event('change', { bubbles: true })); await espera(30);
  }
  const ubDe = id => { const p = M.plan().find(x => x.slotId === id); ok(p, `${id} no está en plan()`); return p.ubicacion || null; };
  const centroY = el => { const r = el.getBoundingClientRect(); return (r.top + r.bottom) / 2; };

  prueba('L1', 'Las listas de ubicaciones las carga Claude con MESA.ubicaciones: cada lugar una sola vez en el catálogo aunque lo compartan dos clientes; todo o nada si una está mal; una compartida se corrige en un solo sitio (D-124)', async () => {
    await tablero([pub(1)]);
    ok(M.ubicaciones && typeof M.ubicaciones.cargar === 'function', 'no hay MESA.ubicaciones.cargar');
    let r = await M.ubicaciones.cargar(CLIENTE, [LUG.a, LUG.b]);
    ok(r.ok, 'cargar: ' + json(r));
    igual(r.lista.map(x => [x.nombre, x.nueva]), [['Lugar Alfa', true], ['Lugar Gamma', true]], 'la lista del primer cliente');
    await M.addClient({ id: CLIENTE2, name: NOMBRE2 });
    r = await M.ubicaciones.cargar(CLIENTE2, [{ ...LUG.b }, LUG.c]);
    ok(r.ok, 'cargar el segundo: ' + json(r));
    igual(r.lista.map(x => x.nueva), [false, true], 'la compartida se creó otra vez');
    const cat = M.ubicaciones.ver().catalogo;
    igual(cat.map(u => [u.nombre, u.locationId, u.clientes.slice().sort()]), [['Lugar Alfa', LUG.a.locationId, [CLIENTE]], ['Lugar Beta', LUG.c.locationId, [CLIENTE2]], ['Lugar Gamma', LUG.b.locationId, [CLIENTE, CLIENTE2].sort()]], 'el catálogo');
    igual(M.ubicaciones.ver(CLIENTE2).map(u => u.nombre), ['Lugar Beta', 'Lugar Gamma'], 'la lista del segundo, por nombre');
    // todo o nada
    r = await M.ubicaciones.cargar(CLIENTE, [LUG.a, { nombre: 'Lugar Delta', locationId: 'lugar-delta' }]);
    ok(r.error && r.problemas.length === 1 && r.problemas[0].i === 1, 'un id que no es numérico: ' + json(r));
    r = await M.ubicaciones.cargar(CLIENTE, [LUG.a, { nombre: 'Gamma', locationId: LUG.b.locationId }]);
    ok(r.error && /ya está en el catálogo como «Lugar Gamma»/.test(r.problemas[0].error), 'otro nombre para un lugar del catálogo: ' + json(r));
    r = await M.ubicaciones.cargar(CLIENTE, [{ nombre: 'lugar alfa', locationId: '100000000000009' }]);
    ok(r.error && /ya se llama «Lugar Alfa»/.test(r.problemas[0].error), 'el nombre de otro lugar: ' + json(r));
    igual(M.ubicaciones.ver(CLIENTE).map(u => u.nombre), ['Lugar Alfa', 'Lugar Gamma'], 'una carga con problemas cambió la lista');
    igual(M.ubicaciones.ver().catalogo.length, 3, 'una carga con problemas tocó el catálogo');
    // corregir la compartida: un solo sitio, los dos clientes la ven cambiada
    const gam = cat.find(u => u.nombre === 'Lugar Gamma').id;
    r = await M.ubicaciones.corregir(gam, { nombre: 'Lugar Gamma (mirador)', locationId: '100000000000022' });
    ok(r.ok, 'corregir: ' + json(r));
    const v = { id: gam, nombre: 'Lugar Gamma (mirador)', locationId: '100000000000022' };
    igual([CLIENTE, CLIENTE2].map(c => M.ubicaciones.ver(c).find(u => u.id === gam)), [v, v], 'la corregida en los dos clientes');
    igual((await M._in.idbAll('ubicaciones')).length, 3, 'el catálogo guardado');
  });

  prueba('L2', 'Desplegable «Ubicación» en la ventana: a la derecha de «Editar …», en su fila, debajo de «Fijar en el perfil» y encima de «Contexto»; vacío al principio y solo con los nombres de su cliente; un reel sin portada lo lleva solo en ese sitio; sin lista sale vacío y su única entrada dice «Crear lista de ubicaciones» (D-124)', async () => {
    await tablero([pub(1), pub(2, 'Carrusel'), pub(3, 'Reel')]);
    await M.addClient({ id: CLIENTE2, name: NOMBRE2 });
    ok((await M.ubicaciones.cargar(CLIENTE, [LUG.b, LUG.a])).ok, 'cargar');
    ok((await M.ubicaciones.cargar(CLIENTE2, [LUG.c])).ok, 'cargar el otro');
    for (const [id, boton] of [['r1', 'Editar foto'], ['r2', 'Editar diapositivas']]) {
      const sel = await ubVentana(id), fila = sel.parentElement, b = fila.querySelector('[data-act="editar"]');
      ok(fila.matches('.pdz'), `${id}: no va en la fila de «Editar …»`);
      ok(b && b.textContent === boton && b.nextElementSibling === sel, `${id}: no va justo a la derecha de «${boton}»`);
      cerca(centroY(sel), centroY(b), 3, `${id}: no está en la misma línea que el botón`);
      const hijos = [...q('.detail .pright').children];
      ok(hijos.indexOf(q('.detail .pinsw')) < hijos.indexOf(fila) && hijos.indexOf(fila) < hijos.indexOf(q('.detail .pright label.nlab')), `${id}: no está entre «Fijar en el perfil» y «Contexto»`);
      igual(ubNombres(sel), ['Sin ubicación', 'Lugar Alfa', 'Lugar Gamma'], `${id}: las opciones`);
      igual(sel.value, '', `${id}: no empieza vacío`);
      const html = q('.detail').innerHTML;
      ok(![LUG.a, LUG.b, LUG.c].some(u => html.includes(u.locationId)), `${id}: el id de Facebook está en la ventana`);
      M._in.closeDetail();
    }
    const sel = await ubVentana('r3');
    ok(!q('.detail [data-act="editar"]'), 'el reel sin portada tiene «Editar portada»');
    ok(sel.parentElement.matches('.pdz') && sel.parentElement.children.length === 1, 'el reel sin portada no lo lleva solo en su fila');
    M._in.closeDetail();
    await M._test.ubBorrar();
    const vacio = await ubVentana('r1');
    igual(ubNombres(vacio), ['Sin ubicación', 'Crear lista de ubicaciones'], 'sin lista: vacío y el aviso de crearla');
    igual([...vacio.options].map(o => o.disabled), [false, true], 'sin lista: el aviso no se elige');
    igual(vacio.value, '', 'sin lista: no está vacío');
  });

  prueba('L3', 'Elegir la ubicación es un paso de ⌘Z (también con el foco en el desplegable); se guarda, sigue al volver a abrir el mes y MESA.plan() da su nombre y su id de Facebook; «Sin ubicación» la quita; el estado no cambia (D-124)', async () => {
    await tablero([pub(1), pub(2, 'Carrusel')]);
    ok((await M.ubicaciones.cargar(CLIENTE, [LUG.a, LUG.b])).ok, 'cargar');
    await poner('r1', [await foto('l3.jpg')]);
    M.loadCaptions([{ slotId: 'r1', options: [{ tone: 'a', text: '1' }, { tone: 'b', text: '2' }, { tone: 'c', text: '3' }] }]);
    M._test.setSlot('r1', { caption: { ...slot('r1').caption, pick: 0 } });
    igual(M.setEstado('r1', 'aprobado')[0].estado, 'aprobado', 'no se aprobó');
    await M.flush();
    const h0 = M._test.hist().undo;
    await ubElegir(await ubVentana('r1'), 'Lugar Alfa');
    await M.flush();
    igual(ubDe('r1'), { nombre: 'Lugar Alfa', locationId: LUG.a.locationId }, 'plan() tras elegirla');
    igual(M._test.hist().undo, h0 + 1, 'elegirla no es un paso de ⌘Z');
    igual(M._in.estadoDe(slot('r1')), 'aprobado', 'elegirla cambió el estado');
    M._test.undo();
    igual(ubDe('r1'), null, '⌘Z no la quitó');
    await hasta(() => ubSel() && ubSel().value === '', 3000, 'el desplegable vacío tras ⌘Z');
    M._test.redo();
    igual(ubDe('r1') && ubDe('r1').nombre, 'Lugar Alfa', '⇧⌘Z no la devolvió');
    await hasta(() => ubSel() && ubSel().selectedOptions[0].textContent === 'Lugar Alfa', 3000, 'el desplegable tras ⇧⌘Z');
    ubSel().focus(); tecla('z', { meta: true, en: ubSel() });
    await hasta(() => !slot('r1').ubicacion, 3000, '⌘Z con el foco en el desplegable');
    tecla('z', { meta: true, shift: true, en: ubSel() || D.body });
    await hasta(() => slot('r1').ubicacion, 3000, '⇧⌘Z con el foco en el desplegable');
    await M.flush();
    M._in.closeDetail();
    await M.open(`${CLIENTE}-${MES}`);
    igual(ubDe('r1'), { nombre: 'Lugar Alfa', locationId: LUG.a.locationId }, 'al volver a abrir el mes');
    igual((await ubVentana('r1')).selectedOptions[0].textContent, 'Lugar Alfa', 'elegida en la ventana al volver');
    await ubElegir(ubSel(), 'Sin ubicación');
    igual(ubDe('r1'), null, '«Sin ubicación» no la quitó');
    ok(!('ubicacion' in slot('r1')), 'quedó el campo en la publicación');
  });

  prueba('L4', 'En una collab el desplegable junta las listas de los dos clientes, sin repetir, y la ubicación elegida pasa al tablero del otro cliente, como la foto y la fecha (D-124, D-008)', async () => {
    await limpiar();
    const col = { id: 'colab-l4', name: 'COLLAB Foto 1', type: 'Foto', date: `${MES}-05T12:00:00.000+01:00` };
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [col], past: [], force: true });
    await M.flush();
    await M.init({ client: CLIENTE, clientName: NOMBRE, month: MES, slots: [col, pub(1)], past: [], force: true });
    igual(M._test.shared('colab-l4').length, 1, 'la collab no quedó enlazada');
    ok((await M.ubicaciones.cargar(CLIENTE, [LUG.a, LUG.b])).ok, 'cargar');
    ok((await M.ubicaciones.cargar(CLIENTE2, [LUG.b, LUG.c])).ok, 'cargar el otro');
    igual(ubNombres(await ubVentana('colab-l4')), ['Sin ubicación', 'Lugar Alfa', 'Lugar Beta', 'Lugar Gamma'], 'las dos listas juntas, sin repetir');
    M._in.closeDetail();
    igual(ubNombres(await ubVentana('r1')), ['Sin ubicación', 'Lugar Alfa', 'Lugar Gamma'], 'una publicación que no es collab lleva solo las de su cliente');
    M._in.closeDetail();
    await ubElegir(await ubVentana('colab-l4'), 'Lugar Beta');
    await M.flush();
    const beta = M.ubicaciones.ver(CLIENTE2).find(u => u.nombre === 'Lugar Beta').id;
    await hasta(async () => { const r = await M._in.idbGet('boards', `${CLIENTE2}-${MES}`); return r && r.slots.find(s => s.id === 'colab-l4').ubicacion === beta; }, 4000, 'que la ubicación llegue al tablero del otro cliente');
    M._in.closeDetail();
    await M.init({ client: CLIENTE2, clientName: NOMBRE2, month: MES, slots: [col], past: [], force: true });
    igual(slot('colab-l4').ubicacion, beta, 'al abrir el tablero del otro cliente');
    igual((await ubVentana('colab-l4')).selectedOptions[0].textContent, 'Lugar Beta', 'elegida en la ventana del otro cliente');
  });

  prueba('L5', '«⇅ Exportar» (archivo v10) lleva el catálogo, la lista de cada cliente y la ubicación de cada publicación, e «Importar» los devuelve; una corrección más nueva llega y una más vieja no la pisa; un archivo v9 entra; IndexedDB 12 (D-124, D-017, D-060)', async () => {
    await tablero([pub(1)]);
    ok((await M.ubicaciones.cargar(CLIENTE, [LUG.a, LUG.b])).ok, 'cargar');
    await ubElegir(await ubVentana('r1'), 'Lugar Gamma'); M._in.closeDetail();
    await M.flush();
    const key = `${CLIENTE}-${MES}`;
    const d = JSON.parse(await (await M.exportAll({ returnBlob: true })).text());
    igual(d.v, V_ARCHIVO, 'la versión del archivo');
    igual((d.ubicaciones || []).map(u => [u.nombre, u.locationId]).sort(), [['Lugar Alfa', LUG.a.locationId], ['Lugar Gamma', LUG.b.locationId]], 'el catálogo en el archivo');
    const gam = d.ubicaciones.find(u => u.nombre === 'Lugar Gamma').id;
    igual((d.clients.find(c => c.id === CLIENTE).ubicaciones || []).length, 2, 'la lista del cliente en el archivo');
    igual(d.boards.find(b => b.key === key).slots.find(s => s.id === 'r1').ubicacion, gam, 'la ubicación de la publicación en el archivo');
    await sinMes(key); await M._test.ubBorrar();
    igual(M.ubicaciones.ver(CLIENTE), [], 'quedó la lista');
    let r = await M.importData(d, { confirm: false });
    ok(r && !r.error, 'importar falló: ' + json(r));
    await M.open(key);
    igual(M.ubicaciones.ver(CLIENTE).map(u => u.nombre), ['Lugar Alfa', 'Lugar Gamma'], 'la lista importada');
    igual(slot('r1').ubicacion, gam, 'la ubicación importada de la publicación');
    igual((await ubVentana('r1')).selectedOptions[0].textContent, 'Lugar Gamma', 'elegida en la ventana tras importar');
    M._in.closeDetail();
    const d2 = JSON.parse(json(d)), u2 = d2.ubicaciones.find(u => u.id === gam);
    u2.nombre = 'Lugar Gamma (mirador)'; u2.at = new Date(Date.now() + 60000).toISOString();
    r = await M.importData(d2, { confirm: false }); ok(r && !r.error, 'importar la corrección: ' + json(r));
    igual(M.ubicaciones.ver(CLIENTE).find(u => u.id === gam).nombre, 'Lugar Gamma (mirador)', 'la corrección más nueva no llegó');
    r = await M.importData(d, { confirm: false }); ok(r && !r.error, 'importar el archivo viejo: ' + json(r));
    igual(M.ubicaciones.ver(CLIENTE).find(u => u.id === gam).nombre, 'Lugar Gamma (mirador)', 'una más vieja la pisó');
    const v9 = JSON.parse(json(d)); v9.v = 9; delete v9.ubicaciones;
    v9.clients.forEach(c => { delete c.ubicaciones; delete c.ubicacionesAt; }); v9.boards.forEach(b => b.slots.forEach(s => { delete s.ubicacion; }));
    await sinMes(key);
    r = await M.importData(v9, { confirm: false }); ok(r && !r.error, 'el archivo v9 no se importó: ' + json(r));
    const dbs = W.indexedDB.databases ? await W.indexedDB.databases() : [];
    if (dbs.length) igual((dbs.find(x => x.name === 'mesa-feed') || {}).version, V_IDB, 'la versión de IndexedDB');
  });

  prueba('L6', 'Una ubicación quitada de la lista se queda en la publicación que la tiene y sigue elegida en su ventana hasta cambiarla; corregirla cambia el dato que da plan() (D-124)', async () => {
    await tablero([pub(1)]);
    ok((await M.ubicaciones.cargar(CLIENTE, [LUG.a, LUG.b])).ok, 'cargar');
    await poner('r1', [await foto('l6.jpg')]);
    await ubElegir(await ubVentana('r1'), 'Lugar Alfa'); M._in.closeDetail(); await M.flush();
    const r = await M.ubicaciones.cargar(CLIENTE, [LUG.b]);
    ok(r.ok, 'cargar sin ella: ' + json(r));
    igual(r.quitadas.map(x => [x.nombre, x.publicaciones]), [['Lugar Alfa', 1]], 'lo que dice al quitarla');
    igual(ubDe('r1'), { nombre: 'Lugar Alfa', locationId: LUG.a.locationId }, 'la publicación la perdió');
    const sel = await ubVentana('r1');
    igual(ubNombres(sel), ['Sin ubicación', 'Lugar Alfa', 'Lugar Gamma'], 'las opciones con la quitada');
    igual(sel.selectedOptions[0].textContent, 'Lugar Alfa', 'no sigue elegida');
    M._in.closeDetail();
    ok((await M.ubicaciones.corregir(slot('r1').ubicacion, { locationId: '100000000000011' })).ok, 'corregir');
    igual(ubDe('r1').locationId, '100000000000011', 'plan() no da el dato corregido');
    await ubElegir(await ubVentana('r1'), 'Lugar Gamma'); M._in.closeDetail();
    igual(ubNombres(await ubVentana('r1')), ['Sin ubicación', 'Lugar Gamma'], 'la quitada sigue en el desplegable tras cambiarla');
  });

  prueba('L7', 'Cambiar la ubicación de una Foto Programada avisa de que Zernio sigue con la de antes y la cambia; la de una Publicada no se toca: el desplegable está bloqueado (D-124, D-103)', async () => {
    await tablero([pub(1), pub(2), pub(3, 'Reel')]);
    ok((await M.ubicaciones.cargar(CLIENTE, [LUG.a, LUG.b])).ok, 'cargar');
    for (const id of ['r1', 'r2', 'r3']) {
      await poner(id, [await foto(`l7-${id}.jpg`)]);
      M.loadCaptions([{ slotId: id, options: [{ tone: 'a', text: '1' }, { tone: 'b', text: '2' }, { tone: 'c', text: '3' }] }]);
      M._test.setSlot(id, { caption: { ...slot(id).caption, pick: 0 } });
      igual(M.setEstado(id, 'aprobado')[0].estado, 'aprobado', `${id} no se aprobó`);
    }
    igual(M.setEstado('r1', 'programado')[0].estado, 'programado', 'r1 no se programó');
    igual(M.setEstado('r2', 'publicado')[0].estado, 'publicado', 'r2 no se publicó');
    igual(M.setEstado('r3', 'programado')[0].estado, 'programado', 'r3 no se programó');
    await M.flush();
    const avisos = () => qa('.toast').filter(t => /sigue con la ubicación de antes/.test(t.textContent));
    qa('.toast').forEach(t => t.remove());
    await ubElegir(await ubVentana('r1'), 'Lugar Alfa');
    igual(ubDe('r1') && ubDe('r1').nombre, 'Lugar Alfa', 'la Programada no cambió');
    ok(avisos().some(t => t.textContent.includes('Está programada en Zernio, que sigue con la ubicación de antes: pide a Claude que la cambie allí.')), 'sin el aviso de Zernio');
    M._in.closeDetail(); qa('.toast').forEach(t => t.remove());
    await ubElegir(await ubVentana('r3'), 'Lugar Gamma');
    ok(!avisos().length, 'un reel programado avisa de Zernio');
    M._in.closeDetail();
    const sel = await ubVentana('r2');
    ok(sel.disabled, 'el desplegable de la Publicada no está bloqueado');
    sel.value = [...sel.options].find(o => o.textContent === 'Lugar Gamma').value; sel.dispatchEvent(new W.Event('change', { bubbles: true })); await espera(30);
    ok(!slot('r2').ubicacion, 'la Publicada cambió de ubicación');
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
    if (M._test.reloj) M._test.reloj(RELOJ_PRUEBAS);
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
        if (M.ubicaciones) ok(!(await M._in.idbAll('ubicaciones')).length, 'quedaron ubicaciones de prueba en el catálogo');
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
