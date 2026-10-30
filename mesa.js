// Mesa de trabajo — Uribe Visuals · v3.32
// Planning board for each client's Instagram grid. Kevin drops photos, arranges them on the empty grid of
// the month being prepared (one cell per publication loaded from Notion), sees the whole previous month under
// the line, and Claude later uploads the chosen (cropped) photos to each publication's Notion page.
// Runs in the Claude desktop app's built-in browser on a host page without a restrictive CSP; designed to be
// hosted as a static page later (GitHub Pages): it builds its own UI and keeps everything in IndexedDB.
// v3.18: carousel / reel-cover designer (diseno.js + kits/motor.js) — a slot's design (s.design) keeps its source
// photos and its rendered outputs (files flagged design:true, uploaded exactly as rendered); bridge for it in M._in.
// v3.25: free slide editor (libre.js): «Editar diapositivas» / «Editar foto» keep each edited slide's composition in s.libre
// (keyed by its rendered image, its photos counted as in use); 1:1 format for carousels and photo posts.
// v3.19: «Mesa de trabajo»; «Abrir notas»; scroll while carrying a photo past the edges; thirds only while reframing;
// Instagram-style carousel arrows; 4 kit text colours + «+» in the designer (diseño 1.2).
// v3.20: designs belong to their post (swaps, «Cambiar portada», reframe in the post view, automatic re-render); reels
// 9:16 with the profile lines; vista cliente as in Instagram; pinned posts; client profile photo (diseño 1.3, motor 1.2).
// v3.21: the export file is mesa-de-trabajo-….json.
// v3.22: captions in the mesa — 3 options per post (one per tone) to choose and edit in the post view, originals kept;
// uploaded ones shown as in Instagram in the vista cliente; API loadCaptions / captions / markCaptionsUploaded; export v2.
// v3.23: «Editado» / «Volver al original» on an edited caption; the post view's header follows the contexto as it is typed;
// a collab's captions are merged (never replaced) when its boards sync; vista cliente: the caption whole at the top.
// v3.26: a Foto is a carousel with its own label (one photo or several pages, all published; no more candidates); the type
// of a post changes in the post view (pending for Notion, with its «Reel» name); a second click unchooses a caption; the
// post view's photos are dragged into order; bridge for the editor's «Preview» (libre 1.3).
// v3.27: a Foto is named «Foto» in the grid again (the carousel icon only with several pages, as Instagram); a designed
// carousel also opens in the free editor; M.addFiles(…, {tray}) gives back photos already in the tray (libre 1.4).
// v3.28: «+ Hueco»: up to 2 black cells at the top of the grid (after the pinned posts) to square the feed into rows of 3.
// v3.29: «Sustituir» / «Añadir» on a carousel drawn in the free editor keep its texts and fill its photo holes (libre 1.6);
// «Editar portada» on a reel opens its cover in the free editor; a post that changes type has its edited images drawn again.
// Export: in the Claude app's browser (its save dialog can't write) a normal download; a write that fails says why and
// leaves no empty file nor a second dialog.
// v3.30: the free editor's colour pickers show only the kit's colours, in the groups of its «grupos», and two basics (libre 1.7).
// v3.31: the free editor copies whole slides and pastes what was copied in the same place, also in another post (libre 1.8).
// v3.32: monthly calendar under the tray (calendario.js, its own file: the mesa never waits for it) linked both ways with
// the grid; one state per post (estadoDe), the same in the grid, the calendar and the post view: three follow from its data,
// four are chosen in the post view or with M.setEstado; a cancelled post leaves the feed, the counts and what is uploaded.
// v3.33: the grid's cells no longer show the state dot (the calendar and the post view do); a board opened has its old drawn
// photo holes turned into the free editor's hole element (libre 1.9: M.libre.migrar).
// v3.34: the free editor fits a photo in a hole without cropping it inside the margin, fills it a sangre, and double click
// switches it (libre 1.10).
// v3.35: in the free editor a change of format and back leaves every text, shape and logo not moved by hand exactly as it
// was (libre 1.11). Designs never get an eyebrow; the kit's accent goes to the footer of inner slides and to the final's
// contact line when it reads (motor 1.3).
// v3.36: a photo already used goes in again (D-022): before it goes into a post the mesa says its nearest use (this post, this
// month, the previous month or another month of the client's boards; the free editor adds this slide) and asks «Usar
// igualmente» / «Cancelar» (several: «Usar todas» / «Saltar repetidas»); into the tray it just goes in, never twice (libre 1.12).
// v3.37: the free editor's guides belong to the post (s.guias, px of a 1080-wide slide): kept, undone and merged with it.
// Its magnet measures, marks equal gaps and sizes and works on the eight handles; new shortcuts (libre 1.13).
// v3.38: quick fixes in the free editor: «H» in its tray, the centre lines, deleting a slide, the proportion chip, ⌘D on a
// slide and «Zona del grid» (⌘P) (libre 1.14).
// v3.39: the grey area around the slide is part of the free editor: deselect, rectangle selection, zoom on the pointer,
// space + drag, «Ajustar» on a double click and a right-click menu (libre 1.15).
// v3.40: templates of the free editor (libre 1.16). A post with an empty photo hole is marked in its cell, flagged in
// plan() ('hueco vacío') and never uploaded, nor the feed image while a cover has one (D-035).
// v3.41: «⇅ Exportar» exports empty photo holes as they are and then says where each one is (D-037).
// v3.42: automatic numbering of a carousel's texts, arrows, lines with a stroke and pills in the free editor (libre 1.17,
// D-038, D-039); a post's numbered images are drawn again when its slides change in the mesa.
// v3.43: «Revisar» in the board's bar (revisar.js): what to look at before uploading or scheduling, by post and slide; it
// also runs by itself on «sube», «programa» and «⇅ Exportar» (D-040).
// v3.44: one tray per client, shared by all its months and the free editor (store 'bandejas', IndexedDB 3), with «Sin
// usar / Todas» and ✓ on photos used in any month (D-041); the months' old trays are joined into it, a photo once; a photo
// leaving a collab goes back to the tray of the client that brought it; «⇅ Exportar» carries the trays (file v3).
// v3.46: the free editor (libre.js 1.20): a text's frame hugs its lines (D-043); a frame of a listed proportion has its
// button on (D-044).
// v3.51: a «+ Hueco» can hold a preview of next month's first post, with a black border and its label, in the mesa, «Vista
// cliente» and the feed image; in the tray it counts as used until the client has a later month (D-049).
(function mesaBoot() {
  const M = window.MESA = window.MESA || {};
  let prevDispose = typeof M._dispose === 'function' ? M._dispose : null;   // previous instance on this page
  M.version = '3.56'; // 3.56: stories designed from outside, from the kit's templates (D-061 to D-063)

  const TZ = 'Europe/Madrid';
  const THUMB_LONG = 1600;                               // px, long side of on-screen thumbnails
  const MAX_UPLOAD = 20 * 1024 * 1024 - 256 * 1024;      // Notion single-part limit (20 MiB) with margin
  const ZERNIO_MAX = 8 * 1000 * 1000;                    // Zernio recompresses images over 8 MB: stay under it
  M.cfg = Object.assign({ uploadIdleMs: 120000, uploadConc: 1 }, M.cfg || {});   // idle = no bytes sent/received
  const UNDO_MS = 6000;
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  M.files = M.files || {};             // fileId -> {name,size,type,w,h,thumbUrl}
  M.thumbBlobs = M.thumbBlobs || {};   // fileId -> thumbnail Blob
  M.blobs = M.blobs || {};             // fileId -> original Blob (lazy, small LRU)
  M.pastThumbs = M.pastThumbs || {};   // Notion pageId -> object URL
  M.pastBlobs = M.pastBlobs || {};     // Notion pageId -> thumbnail Blob
  M.pastPending = {};
  M.pastErrors = {};
  M.uploads = M.uploads || {};         // fileId -> {state,...}
  M.zUploads = M.zUploads || {};       // fileId -> {state,...} of the uploads to Zernio (their own record, apart from Notion's)
  M.out = M.out || {};                 // rendered preview Blobs
  const OUT_SLOTS = {};                // mode -> ids of the posts drawn in M.out[mode] (the later months are blank cells)
  M._ctrl = M._ctrl || {};             // fileId ('z:' + fileId for Zernio) -> controller of the running upload
  M._gen = M._gen || {};               // fileId ('z:' + fileId for Zernio) -> generation of the latest upload request

  let S = null;          // open board (month of one client), persisted
  let PB = null;         // same client's previous-month board, read only (null if it doesn't exist)
  let CL = [];           // clients
  let MB = [];           // month boards of the open client: [{key, month, filled, n}]
  let curClient = null;  // id of the open tab
  let root = null;
  let toastQ = [];       // toasts raised before the shell exists (e.g. while taking the lock at boot)
  let sel = null;        // fileId selected in the tray (click-to-place)
  let drag = null;       // current internal drag
  let cur = { slot: null, idx: 0 };
  let importing = 0;     // photos being prepared
  let UP = { total: 0, done: 0 };
  let busyText = { imp: null, up: null, sel: null, dz: null };
  let downOnBackdrop = false;
  const TAB = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let locked = false;    // another tab/window took over: this one stops saving
  let bc = null;
  try { bc = new BroadcastChannel('mesa-feed'); } catch (e) { bc = null; }
  if (bc) bc.onmessage = e => { if (e.data && e.data.t === 'claim' && e.data.id !== TAB) lockHere(); };
  // One tab works on the mesa at a time. The working tab holds a Web Lock; a tab that takes over announces it and waits
  // until the previous one has saved everything (the designer's edit in flight too) and let go, so it never reads a
  // stale board. A tab that doesn't answer in 4 s (frozen) loses the lock and the new one opens with what was saved.
  const LOCK = 'mesa-feed-tab';
  let held = null, claiming = null, locking = false;
  function takeLock(ms) {
    return new Promise(res => {
      const ctl = ms ? new AbortController() : null, t = ctl ? setTimeout(() => ctl.abort(), ms) : 0;
      let mine = null;
      navigator.locks.request(LOCK, ctl ? { signal: ctl.signal } : { steal: true }, () => { clearTimeout(t); res(true); return new Promise(r => { held = mine = r; }); })
        .catch(() => { clearTimeout(t); if (mine && held === mine) held = null; res(false); });   // timed out, or later taken by a tab that gave up waiting
    });
  }
  function claim() {
    locked = false;
    if (bc) { try { bc.postMessage({ t: 'claim', id: TAB }); } catch (e) { /* */ } }
    if (root) root.querySelectorAll('.lock').forEach(o => o.remove());
    if (held || !(navigator.locks && navigator.locks.request)) return Promise.resolve();
    if (!claiming) claiming = (async () => {
      if (!(await takeLock(4000))) { await takeLock(0); toast('La otra pestaña de la mesa no respondió: se abre con lo último que guardó.'); }
    })().finally(() => { claiming = null; });
    return claiming;
  }
  async function lockHere() {
    if (locked || locking) return;
    locking = true;
    try {
      if (M.diseno && M.diseno.volcar) { try { M.diseno.volcar(); } catch (e) { /* */ } }   // the designer's edit in flight
      // a tab that took the lock after waiting for this one in vain may have saved since: never write over it
      const B = S, fresh = B && await idbGet('boards', B.key).catch(() => null);
      if (!(fresh && fresh.savedAt && B.savedAt && fresh.savedAt > B.savedAt)) { try { await flushNow(); } catch (e) { /* */ } }
    } finally { locked = true; locking = false; }
    if (held) { held(); held = null; }                             // the other tab may read the board now
    if (!shellReady()) return;
    root.querySelectorAll('.lock').forEach(x => x.remove());
    const o = document.createElement('div'); o.className = 'lock';
    o.innerHTML = '<div class="card dlg"><h3>La mesa está abierta en otra pestaña</h3><p>Para no pisar cambios, esta se ha pausado. Lo último que hiciste aquí está guardado.</p><div class="form"><div class="row"><button type="button" class="btn" data-act="takeover">Usar aquí</button></div></div></div>';
    root.append(o);
  }

  // ---------- IndexedDB ----------
  let dbp = null, dbConn = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      // 3 (mesa 3.44): + 'bandejas', the client's tray (D-041). 4 (mesa 3.55): no new store: a tab that doesn't know the stories
      // (before 3.53) saved a board without them and deleted their images, so it must no longer reach the data (D-060). Raise
      // it whenever a board starts to keep something an older tab would drop.
      const r = indexedDB.open('mesa-feed', 4);
      r.onupgradeneeded = () => { const d = r.result; for (const n of ['files', 'boards', 'clients', 'bandejas']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); };
      r.onsuccess = () => { const d = r.result; dbConn = d; d.onversionchange = () => { try { d.close(); } catch (e) { /* */ } dbp = null; dbConn = null; versionNueva(); }; res(d); };
      r.onerror = () => { dbp = null; if (r.error && r.error.name === 'VersionError') versionNueva(); rej(r.error); };
      r.onblocked = () => { const m = 'Hay otra copia de la mesa abierta con una versión anterior. Ciérrala o recarga esta página.'; if (shellReady()) toast(m); else if (document.body) document.body.textContent = m; };
    });
    return dbp;
  }
  // Another tab opened a newer mesa, whose data this code must not touch: it stops here, without saving, until it is reloaded
  function versionNueva() {
    locked = true;
    if (held) { held(); held = null; }   // the new tab needn't wait for this one
    const m = 'Hay una versión nueva de la mesa';
    if (!shellReady()) { if (document.body) document.body.textContent = m + ': recarga esta pestaña.'; return; }
    root.querySelectorAll('.lock').forEach(x => x.remove());
    const o = document.createElement('div'); o.className = 'lock';
    o.innerHTML = `<div class="card dlg"><h3>${m}</h3><p>Esta pestaña se ha pausado para no pisar los datos. Recárgala para seguir: lo guardado no se pierde.</p><div class="form"><div class="row"><button type="button" class="btn" data-act="recargar">Recargar</button></div></div></div>`;
    root.append(o);
  }
  async function tx(store, mode, fn) {   // store: a name, or several (fn gets {name: objectStore}: one transaction for all)
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const req = fn(Array.isArray(store) ? Object.fromEntries(store.map(n => [n, t.objectStore(n)])) : t.objectStore(store));
      let out;
      if (req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error || (req && req.error) || new Error('IndexedDB error'));
      t.onabort = () => rej(t.error || (req && req.error) || new Error('IndexedDB abort'));
    });
  }
  const idbGet = (st, k) => tx(st, 'readonly', s => s.get(k));
  const idbPut = (st, k, v) => tx(st, 'readwrite', s => s.put(v, k));
  const idbDel = (st, k) => tx(st, 'readwrite', s => s.delete(k));
  const idbAll = st => tx(st, 'readonly', s => s.getAll());

  // ---------- helpers ----------
  const cssq = v => (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, '\\$&');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isReel = t => t === 'Reel' || t === 'Collab Reel' || t === 'Trial Reel';
  const isCarousel = t => t === 'Carrusel' || t === 'Foto';         // a Foto works as a carousel (3.26): one photo or several pages, all published
  const typeIcon = (t, n) => isReel(t) ? ICON.reel : t === 'Carrusel' || (t === 'Foto' && n > 1) ? ICON.carousel : '';   // as Instagram's grid: a Foto of one page has none
  const isMulti = isCarousel;
  const edLabel = s => s.type === 'Foto' ? 'Editar foto' : isReel(s.type) ? 'Editar portada' : 'Editar diapositivas';   // the free editor's button: the label follows the post's
  const publishList = s => isCarousel(s.type) ? s.photos : s.photos.slice(0, 1);
  const noteOf = s => String(s.note || '').trim();                   // «Contexto»: goes to Notion for the caption
  const memoOf = s => String(s.memo || '').trim();                   // «Nota»: only for Kevin, never uploaded
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const newId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const slugify = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'cliente';
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage off */ } };
  // a slot's design (diseno.js) holds its source photos (slides[].src) and its rendered outputs (out): both are in use
  const lSrc = s => s && s.libre && s.libre.slides ? Object.values(s.libre.slides).flatMap(c => ((c && c.els) || []).map(e => e && e.src)).filter(Boolean) : [];   // the free editor's compositions (libre.js): the photos behind its images
  const lOut = s => s && s.libre && s.libre.slides ? Object.keys(s.libre.slides) : [];
  // an empty photo hole (libre.js: a 'hueco' element, or a frame with no photo) in a slide drawn by the free editor: the post
  // never leaves the mesa with it (no upload of any kind) and its cell says so (D-035); the slides, 1 = the first
  const vacia = c => ((c && c.els) || []).some(e => e && !e.oculto && (e.t === 'hueco' || (e.t === 'foto' && !e.src)));
  const lComp = (s, f, sl = S && S.slots) => (s.libre && s.libre.slides && s.libre.slides[f]) || ((sl || []).map(x => x.libre && x.libre.slides && x.libre.slides[f]).find(Boolean)) || null;   // a swap moves photos, not s.libre
  const huecosVacios = (s, sl) => s ? publishList(s).flatMap((f, i) => vacia(lComp(s, f, sl)) ? [i + 1] : []) : [];   // sl: the slots of its board (the open one if not given)
  const isLib = f => !!S && S.slots.some(x => lOut(x).includes(f));
  const trayable = f => !String(f).startsWith('kit-');   // a client's protected file (a logo in an editor composition) never goes to a tray   // an image drawn by the free editor, whichever post holds its composition (a swap moves photos, not s.libre)
  const libN = s => !s || s.design ? 0 : (s.photos || []).filter(isLib).length;   // images of the post drawn by the free editor
  const dSrc = s => [...(s && s.design ? [...(s.design.slides || []), ...((s.design.stash && s.design.stash.slides) || [])].map(x => x && x.src).filter(Boolean) : []), ...lSrc(s)];   // + the design kept while its type changed
  const dOut = s => s && s.design ? (s.design.out || []).filter(Boolean) : [];
  const slotRefs = s => [...(s.photos || []), ...dSrc(s), ...dOut(s)];
  const previewsOf = b => (b && Array.isArray(b.previews) ? b.previews : []).filter(Boolean);   // the photos on a board's fillers (D-049)
  const refsOf = b => new Set([...(b.tray || []), ...(b.slots || []).flatMap(slotRefs), ...(b.prev || []).filter(p => p.own).flatMap(p => p.photos || []), ...previewsOf(b)]);
  // Stories (historias.js, D-054): a board's b.historias, apart from b.slots, so the feed never has to filter them out. Each
  // has a post's shape ({id, type: 'Historia', name, date, photos, libre, guias}) so the free editor opens it as it opens a
  // reel's cover, plus slotId + postDate (the post it supports and that post's date when last seen), note, fondo, and
  // cancelada / porPost (cancelled by hand, or because of its post). refsOf stays the feed's and the tray's: it decides what
  // goes back to a tray. refsTodo also counts the stories: whatever decides that a file can go, or travels, uses it.
  const hsDe = b => (b && Array.isArray(b.historias) ? b.historias : []);
  const hRefs = b => hsDe(b).flatMap(h => [...(h.photos || []), ...lSrc(h)]);
  const refsTodo = b => new Set([...refsOf(b), ...hRefs(b)]);
  const kitRef = c => { const f = c && c.kit && c.kit.final && c.kit.final.foto; return typeof f === 'string' && f.startsWith('kit-') ? f : null; };   // a client's fixed final photo (file id)
  // upload file names: no / \ : * ? " < > | nor control characters (a normal name stays exactly as it is)
  const safeName = n => String(n).replace(/"/g, "'").replace(/[/\\:*?<>|]/g, '-').replace(/[\u0000-\u001f\u007f]/g, '');
  const dName = (s, fid) => safeName(isReel(s.type) ? `${s.name} portada.jpg` : `${s.name} ${String(s.photos.indexOf(fid) + 1).padStart(2, '0')}.jpg`);   // a design image goes up named after its post as it is now
  // 'ok' (applied, up to date) | 'chg' | null; without the designer loaded it can't be checked: 'nc' when the post
  // still holds its applied images (they go up as they are), 'chg' when it doesn't
  const dState = s => !s || !s.design ? null : M.diseno && M.diseno.estadoDe ? M.diseno.estadoDe(s) : dOut(s).length && same(s.photos, dOut(s)) ? 'nc' : 'chg';
  const slot = id => S && (S.slots.find(s => s.id === id) || (S.prev || []).find(p => p.id === id));
  const prevItem = id => S && (S.prev || []).find(p => p.id === id);
  const isPrev = s => !!(s && S && S.prev && S.prev.includes(s));
  const upBusy = u => !!u && (u.state === 'pending' || u.state === 'uploading');
  const uploadsBusy = () => Object.values(M.uploads).some(upBusy) || Object.values(M.zUploads).some(upBusy);

  function monthOf(iso) {
    const d = new Date(String(iso || '').replace(' ', 'T'));
    if (isNaN(d)) return null;
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).formatToParts(d).map(x => [x.type, x.value]));
    return p.year + '-' + p.month;
  }
  function prevMonth(m) { let [y, mo] = m.split('-').map(Number); mo--; if (!mo) { mo = 12; y--; } return y + '-' + String(mo).padStart(2, '0'); }
  function monthLabel(m, short) {
    if (!m) return '';
    const [y, mo] = m.split('-').map(Number); const n = MONTHS[mo - 1] || '';
    return short ? cap(n.slice(0, 3)) + ' ' + y : cap(n) + ' ' + y;
  }
  function shortLabel(name, type) {
    const n = String(name || '').trim();
    if (/collab/i.test(n)) { const m = n.match(/(\d+)\s*$/); return m ? 'Collab ' + m[1] : 'Collab'; }
    const m = n.match(/(\d+\.\d+)\s*$/);
    if (m) return (type === 'Reel' || type === 'Trial Reel' ? 'Reel ' : type === 'Carrusel' ? 'Carrusel ' : 'Foto ') + m[1];   // a Foto keeps its name, one page or several
    return n;
  }
  function fmtDate(iso, short) {
    if (!iso) return 'sin fecha';
    const s = String(iso);
    const d = new Date(s.replace(' ', 'T'));
    if (isNaN(d)) return s;
    if (short) return new Intl.DateTimeFormat('es-ES', { timeZone: TZ, day: 'numeric', month: 'short' }).format(d).replace('.', '');
    const hasTime = /[T ]\d\d:\d\d/.test(s);
    const day = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(d);
    if (!hasTime) return day;
    return day + ' · ' + new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }
  const ts = iso => { const d = new Date(String(iso || '').replace(' ', 'T')); return isNaN(d) ? 0 : d.getTime(); };
  // ---------- months range + Madrid dates ----------
  function addMonths(m, k) { let [y, mo] = m.split('-').map(Number); mo += k; y += Math.floor((mo - 1) / 12); mo = ((mo - 1) % 12 + 12) % 12 + 1; return y + '-' + String(mo).padStart(2, '0'); }
  const monthsOf = (m, span) => Array.from({ length: Math.max(1, span || 1) }, (_, i) => addMonths(m, i));
  // ---------- work cycles (the only definition, used everywhere) ----------
  // A client's cycle starts on day CD (1-28) of a month and ends on day CD-1 of the next; it is named by the month it
  // starts in ('YYYY-MM': kamaya-2026-10 = 22 oct-21 nov). CD 1 = the calendar month. Days are Madrid days ('YYYY-MM-DD').
  const cdOf = v => { const n = +v; return Number.isInteger(n) && n >= 1 && n <= 28 ? n : 1; };
  const okCd = v => v == null || v === '' || (Number.isInteger(+v) && +v >= 1 && +v <= 28);
  const curCd = () => cdOf(S && S.cycleDay);
  const cycleOfDay = (day, cd) => !day ? null : +day.slice(8, 10) >= cdOf(cd) ? day.slice(0, 7) : prevMonth(day.slice(0, 7));
  const cycleOf = (iso, cd) => cycleOfDay(localDay(iso), cd);
  const cycleStart = (m, cd) => `${m}-${String(cdOf(cd)).padStart(2, '0')}`;
  function cycleEnd(m, cd) {
    cd = cdOf(cd); const [y, mo] = m.split('-').map(Number);
    return cd === 1 ? `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0')}` : `${addMonths(m, 1)}-${String(cd - 1).padStart(2, '0')}`;
  }
  // label of 1-3 cycles from m: day 1 «Octubre 2026» / «Oct 2026» (as always); other days «22 oct–21 nov 2026» / «22 oct–21 nov»
  function rangeLabel(m, span, short, cd) {
    if (cdOf(cd) !== 1) {
      const a = cycleStart(m, cd), b = cycleEnd(addMonths(m, Math.max(1, span || 1) - 1), cd);
      const dm = x => `${+x.slice(8)} ${MONTHS[+x.slice(5, 7) - 1].slice(0, 3)}`;
      return short ? `${dm(a)}–${dm(b)}` : a.slice(0, 4) === b.slice(0, 4) ? `${dm(a)}–${dm(b)} ${b.slice(0, 4)}` : `${dm(a)} ${a.slice(0, 4)}–${dm(b)} ${b.slice(0, 4)}`;
    }
    const last = addMonths(m, Math.max(1, span || 1) - 1);
    if (last === m) return monthLabel(m, short);
    const nm = x => { const n = MONTHS[+x.slice(5) - 1]; return cap(short ? n.slice(0, 3) : n); };
    return m.slice(0, 4) === last.slice(0, 4) ? `${nm(m)}–${nm(last)} ${last.slice(0, 4)}` : `${nm(m)} ${m.slice(0, 4)}–${nm(last)} ${last.slice(0, 4)}`;
  }
  const cycName = (m, cd) => cdOf(cd) === 1 ? cap(MONTHS[+m.slice(5, 7) - 1]) : rangeLabel(m, 1, true, cd);
  const MADF = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function madParts(t) { const p = Object.fromEntries(MADF.formatToParts(new Date(t)).map(x => [x.type, x.value])); return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` }; }
  const dOnly = iso => !/[T ]\d\d:\d\d/.test(String(iso || ''));
  const localDay = iso => { const s = String(iso || ''); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const t = ts(s); return t ? madParts(t).day : null; };
  const localTime = iso => dOnly(iso) || !ts(iso) ? '' : madParts(ts(iso)).time;
  const wallMs = (day, time) => { const [y, mo, d] = day.split('-').map(Number), [h, mi] = time.split(':').map(Number); return Date.UTC(y, mo - 1, d, h, mi); };
  // Madrid wall clock -> ISO UTC (right on both sides of a DST change)
  function madridISO(day, time) {
    const want = wallMs(day, time); let t = want - 7200e3;
    for (let i = 0; i < 3; i++) { const p = madParts(t); t += want - wallMs(p.day, p.time); }
    return new Date(t).toISOString().replace(/\.000Z$/, 'Z');
  }
  const sameDate = (a, b) => a === b || (!!a && !!b && dOnly(a) === dOnly(b) && (dOnly(a) ? localDay(a) === localDay(b) : ts(a) === ts(b) && !!ts(a)));
  const dateChg = s => !sameDate(s.date, s.notionDate);
  const nameChg = s => s.notionName != null && s.name !== s.notionName;
  const typeChg = s => s.notionType != null && s.type !== s.notionType;   // the type was changed here (3.26): pending for Notion
  const ord = iso => dOnly(iso) ? ts(madridISO(localDay(iso), '00:00')) : ts(iso);
  const initials = name => String(name || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

  // ---------- crop model (post format + reframe) ----------
  // Instagram feed formats: 4:5, 3:4, landscape up to 1.91:1. The profile grid shows the centred 3:4 of the post.
  // Per photo: {fmt, cx, cy, z}. A carousel's format lives on the slot (s.fmt); a reel cover is always 9:16 (as the
  // reel plays) and the grid shows its centred 3:4.
  const FMT_LABEL = { v45: '4:5', v34: '3:4', q11: '1:1', h: 'Horizontal', r916: '9:16' };
  const dims = fid => M.files[fid] || { w: 3, h: 4 };
  function fmtRatio(fmt, w, h) {
    if (fmt === 'v45') return 4 / 5;
    if (fmt === 'v34') return 3 / 4;
    if (fmt === 'q11') return 1;
    if (fmt === 'r916') return 9 / 16;
    const r = w / h; return r >= 1 ? Math.min(r, 1.91) : 16 / 9;
  }
  function baseCrop(fid, B) { const f = dims(fid); return (B && B.crops && B.crops[fid]) || { fmt: f.w > f.h ? 'h' : 'v45', cx: 0.5, cy: 0.5, z: 1 }; }
  function slotFmt(s, B) { return s.fmt || (s.photos.length ? baseCrop(s.photos[0], B).fmt : 'v45'); }
  function cropOf(fid, s, B = S) {
    const c = { ...baseCrop(fid, B) };
    if (s && (isReel(s.type) || s.type === 'Historia')) c.fmt = 'r916';
    else if (s && isCarousel(s.type)) c.fmt = slotFmt(s, B);
    return c;
  }
  function slotRatio(s, fid, B = S) {
    if (s && isCarousel(s.type) && s.photos.length) { const f0 = dims(s.photos[0]); return fmtRatio(slotFmt(s, B), f0.w, f0.h); }
    const f = dims(fid); return fmtRatio(cropOf(fid, s, B).fmt, f.w, f.h);
  }
  function rectFor(w, h, R, c) {
    let cw, ch;
    if (w / h > R) { ch = h; cw = h * R; } else { cw = w; ch = w / R; }
    const z = Math.max(1, Math.min(3, c.z || 1)); cw /= z; ch /= z;
    let x = (c.cx == null ? 0.5 : c.cx) * w - cw / 2, y = (c.cy == null ? 0.5 : c.cy) * h - ch / 2;
    x = Math.max(0, Math.min(w - cw, x)); y = Math.max(0, Math.min(h - ch, y));
    return { x, y, w: cw, h: ch };
  }
  function postRect(fid, s, B = S) { const f = dims(fid); return rectFor(f.w, f.h, slotRatio(s, fid, B), cropOf(fid, s, B)); }
  function gridRect(fid, s, B = S) {
    const p = postRect(fid, s, B), r = 3 / 4;
    let gw, gh; if (p.w / p.h > r) { gh = p.h; gw = gh * r; } else { gw = p.w; gh = gw / r; }
    return { x: p.x + (p.w - gw) / 2, y: p.y + (p.h - gh) / 2, w: gw, h: gh };
  }
  const rectStyle = (f, r) => `width:${(f.w / r.w * 100).toFixed(3)}%;height:${(f.h / r.h * 100).toFixed(3)}%;left:${(-r.x / r.w * 100).toFixed(3)}%;top:${(-r.y / r.h * 100).toFixed(3)}%`;
  const num = (v, d, p) => +(v == null ? d : +v).toFixed(p);
  const fileSig = (fid, s, B = S) => { const c = cropOf(fid, s, B); return [c.fmt, num(c.cx, 0.5, 3), num(c.cy, 0.5, 3), num(c.z, 1, 2), +slotRatio(s, fid, B).toFixed(3)]; };
  const cropSig = (s, B = S) => JSON.stringify(publishList(s).map(fid => fileSig(fid, s, B)));
  // a reel cover uploaded while reels were 3:4 (≤ v3.19): the same reframe, signed as it was then — it stays «en Notion»
  // until it is reframed or changed
  const cropSig34 = (s, B = S) => JSON.stringify(publishList(s).map(fid => { const c = cropOf(fid, s, B); return ['v34', num(c.cx, 0.5, 3), num(c.cy, 0.5, 3), num(c.z, 1, 2), 0.75]; }));
  // Stores position/zoom; the format is written only where the photo owns it (never the forced reel/carousel one).
  function setCrop(fid, s, patch) {
    const f = M.files[fid]; if (!f || !S) return;
    const stored = baseCrop(fid, S);
    const ownsFmt = !s || !(isReel(s.type) || isCarousel(s.type));
    const next = { fmt: ownsFmt && patch.fmt ? patch.fmt : stored.fmt, cx: patch.cx ?? stored.cx, cy: patch.cy ?? stored.cy, z: patch.z ?? stored.z ?? 1 };
    S.crops[fid] = next;
    const r = postRect(fid, s);                     // clamp with the effective ratio
    next.cx = (r.x + r.w / 2) / f.w; next.cy = (r.y + r.h / 2) / f.h;
  }
  function setFmt(slotId, fmt) {
    const s = slot(slotId); if (!s || isReel(s.type) || !s.photos.length) return;
    if (isCarousel(s.type) && s.design) {                // one format: the design's, drawn again in the new one
      if (M.diseno && M.diseno.formato && M.diseno.formato(slotId, fmt)) { changed(); rerender(s); openDetail(slotId, cur.idx); }
      return;
    }
    if (isCarousel(s.type) ? libN(s) : isLib(s.photos[cur.idx])) {   // slides drawn by the free editor: drawn again there in the new format
      if (M.libre && M.libre.abrir) M.libre.abrir(slotId, cur.idx, { fmt }); else waitLibre(slotId, cur.idx, { fmt });
      return;
    }
    if (isCarousel(s.type)) { s.fmt = fmt; s.photos.forEach(fid => { S.crops[fid] = { ...baseCrop(fid, S), cx: 0.5, cy: 0.5, z: 1 }; }); }
    else setCrop(s.photos[cur.idx], s, { fmt, cx: 0.5, cy: 0.5, z: 1 });
    save(); renderFeed(); openDetail(slotId, cur.idx);
  }
  // A carousel keeps the format it had when it got its first photo, so reordering never flips it silently.
  function normalize() {
    if (!S) return;
    trayUnica(S);
    S.slots.forEach(s => {
      if (!isCarousel(s.type)) { delete s.fmt; return; }
      if (!s.photos.length) delete s.fmt;
      else if (!s.fmt) s.fmt = baseCrop(s.photos[0], S).fmt;
    });
    podarLibre(S);
  }
  // a photo once in the tray (D-041): the same id or the same name and size (D-022) twice, the first stays and the other
  // goes (deleted only if nothing uses it, nor a step of ⌘Z)
  function trayUnica(B) {
    const ya = new Set(), fuera = [];
    B.tray = (B.tray || []).filter(f => { if (ya.has(f)) return false; ya.add(f); const k = fileKey(f); if (!k || ajena(f, B.client)) return true; if (ya.has(k)) { fuera.push(f); return false; } ya.add(k); return true; });   // another client's: on its way to its own tray (guardar)
    fuera.forEach(f => { deleteIfUnused(f).catch(() => null); });
  }
  // the free editor's compositions whose image is gone from the board (cover changed, deleted from the tray, replaced):
  // dropped, and the photos behind them go back to the tray (one they were the only use of)
  function podarLibre(B) {
    if (!B.slots.some(s => s.libre)) return;
    const live = new Set([...B.tray, ...B.slots.flatMap(s => s.photos || []), ...(B.prev || []).flatMap(p => p.photos || [])]);
    let back = [];
    for (const s of B.slots) {
      if (!s.libre) continue;
      const e = (s.libre.slides = s.libre.slides || {});
      for (const k of Object.keys(e)) if (!live.has(k)) { back.push(...((e[k] && e[k].els) || []).map(x => x && x.src).filter(Boolean)); delete e[k]; }
      if (!Object.keys(e).length) delete s.libre;
    }
    if (!back.length) return;
    const refs = refsOf(B);
    B.tray.unshift(...[...new Set(back)].filter(f => trayable(f) && M.files[f] && !refs.has(f)));
  }

  // ---------- Notion nomenclature (renumbering after a date change) ----------
  // Normal posts «<prefijo><W>.<N>» (prefix kept exactly, «Reel» included); collabs «COLLAB … <Mes> <K>» (Mes = the month
  // the cycle starts in, K by date within the cycle).
  // The week rule lives only here. Week of the cycle (rule of the clients' «Skill» pages in Notion): Monday–Sunday weeks
  // cut at the cycle edges, so the start day always opens week 1 and a trailing Monday/Tuesday opens a new week (day 1:
  // 31 Aug 2026 = 6.1); a cycle that starts on a Sunday folds that day into week 1 (day 1: 1–8 Nov 2026 = week 1;
  // day 22: 22-25 oct = 1, 26 oct-1 nov = 2 … 16-21 nov = 5). Returns 'YYYY-MM#W' with the cycle's month.
  function weekOf(day, cd) {
    const c = cycleOfDay(day, cd), [y, m, d] = cycleStart(c, cd).split('-').map(Number), [y2, m2, d2] = day.split('-').map(Number);
    const t0 = Date.UTC(y, m - 1, d), e = Math.round((Date.UTC(y2, m2 - 1, d2) - t0) / 864e5), dow1 = (new Date(t0).getUTCDay() + 6) % 7;
    const w = dow1 === 6 ? (e === 0 ? 1 : Math.floor((e - 1) / 7) + 1) : Math.floor((e + dow1) / 7) + 1;
    return c + '#' + w;
  }
  const RX_N = /^([\s\S]*?)(\d+)\.(\d+)$/, RX_C = /^(COLLAB\b[\s\S]*?\s)(\p{L}+)(\s+)(\d+)$/iu;
  function nameKind(s) {   // how a post is numbered, from its Notion name (null = never renamed)
    const nm = String(s.notionName ?? s.name ?? '');
    if (s.type === 'Collab Reel' || /^collab\b/i.test(nm)) { const m = nm.match(RX_C); return m && MONTHS.includes(m[2].toLowerCase()) ? { c: true, p: m[1], sep: m[3], n: +m[4] } : null; }
    const m = nm.match(RX_N); return m ? { c: false, p: m[1], n: +m[3] } : null;
  }
  // group key 'YYYY-MM…' (the cycle's month): a week («YYYY-MM#W») or the collabs of one partner in a cycle («YYYY-MM@PREFIJO»)
  const grpOf = (k, iso) => { const d = localDay(iso); return !d ? null : k.c ? cycleOfDay(d, curCd()) + '@' + k.p.replace(/\s+/g, ' ').trim().toUpperCase() : weekOf(d, curCd()); };
  // Names from dates: only groups touched by a pending date change (old or new date) — or holding a rename whose
  // cause is already in Notion (s.hold) — get renumbered; every other post keeps its Notion name. A group of a month
  // outside the board is never renumbered (the board doesn't hold all its posts): its posts keep their current name.
  function kinds() { const K = {}; S.slots.forEach(s => { const k = nameKind(s); if (k) K[s.id] = k; }); return K; }
  function affected(K, holds) {
    const aff = new Set();
    S.slots.forEach(s => { const k = K[s.id]; if (!k) return; if (dateChg(s)) { aff.add(grpOf(k, s.notionDate)); aff.add(grpOf(k, s.date)); } if (holds && s.hold) aff.add(grpOf(k, s.date)); });
    return aff;
  }
  function computeNames() {
    const out = {}, K = kinds(), aff = affected(K, true), G = {}, bm = boardMonths();
    S.slots.forEach(s => {
      const g = K[s.id] && grpOf(K[s.id], s.date), inB = g && bm.includes(g.slice(0, 7)) && !(IDX[s.id] || []).some(x => x.client !== S.client && x.cd !== curCd());   // a collab with a client of other cycles keeps its name
      out[s.id] = g && !inB ? s.name : s.notionName ?? s.name;
      if (inB && aff.has(g)) (G[g] = G[g] || []).push(s);
    });
    for (const g in G) G[g].sort((a, b) => ord(a.date) - ord(b.date) || K[a.id].n - K[b.id].n || (a.id < b.id ? -1 : 1)).forEach((s, i) => {
      const k = K[s.id];
      out[s.id] = k.c ? `${k.p}${cap(MONTHS[+g.slice(5, 7) - 1])}${k.sep}${i + 1}` : `${k.p}${g.split('#')[1]}.${i + 1}`;
    });
    S.slots.forEach(s => { if (typeChg(s)) out[s.id] = reelName(out[s.id], isReel(s.type)); });
    return out;
  }
  // a type changed here: «X Reel 2.3» ↔ «X 2.3» (the Notion rule «CLIENTE [Reel] Semana.Nº»; a collab keeps its name)
  function reelName(nm, reel) {
    const m = String(nm).match(RX_N); if (!m || /^collab\b/i.test(nm)) return nm;
    const has = /(^|\s)reel\s*$/i.test(m[1]); if (reel === has) return nm;
    const p = reel ? (m[1].trim() ? m[1].replace(/\s*$/, ' ') : '') + 'Reel ' : m[1].replace(/\s*reel\s*$/i, ' ').replace(/^\s+$/, '');
    return `${p}${m[2]}.${m[3]}`;
  }
  function renumber() { const nm = computeNames(); S.slots.forEach(s => { s.name = nm[s.id]; if (s.hold && !nameChg(s)) delete s.hold; }); }
  // a pending rename that no pending date explains any more (its cause is already in Notion) must not get lost
  // (skip: ids of the posts whose change Notion overrode in init — their own renames go)
  function holdOrphans(skip) { const K = kinds(), aff = affected(K, false); S.slots.forEach(s => { if (!(skip && skip.has(s.id)) && nameChg(s) && K[s.id] && !aff.has(grpOf(K[s.id], s.date))) s.hold = true; }); }
  const sortSlots = () => S.slots.sort((a, b) => ts(b.date) - ts(a.date));
  const boardMonths = () => S ? monthsOf(S.month, S.span) : [];                 // the board's cycles ('YYYY-MM' of their start)
  const inBoard = day => boardMonths().includes(cycleOfDay(day, curCd()));
  const outToast = () => toast(`Esa fecha cae fuera de la mesa (${rangeLabel(S.month, S.span, false, curCd()).toLowerCase()}).`);
  // back: return to the Notion date (allowed even outside the board's months); src: the post-view input being typed in
  function setDate(id, iso, back, src) {
    const s = S && S.slots.find(x => x.id === id); if (!s) return 'no existe';
    const day = localDay(iso); if (!day) return 'fecha no válida';
    if (!back && !inBoard(day)) { outToast(); return 'fuera de la mesa'; }
    s.date = sameDate(iso, s.notionDate) ? s.notionDate : iso;
    renumber(); sortSlots(); changed();
    const d = root && root.querySelector('.detail');
    if (d && !d.hidden && d.dataset.slot && !d.dataset.prev) { if (src) syncHead(d.dataset.slot, src); else refreshDetail(); }
    return true;
  }

  const ICON = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>',
    reel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M3 8.5h18M9 3l2.6 5.5M14.6 3l2.6 5.5"/><path d="M10 12v5.2l4.6-2.6z" fill="currentColor" stroke="none"/></svg>',
    carousel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="7.5" y="3" width="13.5" height="13.5" rx="3"/><path d="M16.5 19.5a2 2 0 0 1-2 1.5H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 1.5-2"/></svg>',
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.9 2.3a1 1 0 0 1 1.4 0l5.4 5.4a1 1 0 0 1 0 1.4l-1.2 1.2a1 1 0 0 1-1.1.2l-.6-.3-3.8 3.8.4 3.2a1 1 0 0 1-.3.8l-1.3 1.3a1 1 0 0 1-1.4 0l-3.3-3.3-4.6 4.6a1 1 0 1 1-1.4-1.4l4.6-4.6-3.3-3.3a1 1 0 0 1 0-1.4l1.3-1.3a1 1 0 0 1 .8-.3l3.2.4 3.8-3.8-.3-.6a1 1 0 0 1 .2-1.1z"/></svg>'
  };

  // ---------- persistence ----------
  let saveTimer = null;
  // editedAt = last real change of a board's content (opening or re-saving it doesn't count): decides import merges
  const BODY = new WeakMap();
  function edited(B) { const b = boardBody(B); if (BODY.get(B) !== b) { B.editedAt = new Date().toISOString(); BODY.set(B, b); } }
  // ---------- the client's tray (D-041) ----------
  // One tray per client, shared by all its months and by the free editor: store 'bandejas', key = client id,
  // {client, tray: [fileId…] newest first, at}. The open board's S.tray is its client's tray: saved with the board, in the
  // same transaction, and never inside it. A photo brought by another client (a collab's, file record `de`) never stays in
  // this one's: saving moves it to its own. Boards saved before 3.44 kept a tray each (b.tray): juntarBandeja moves them
  // into their client's, a photo once (same id, or same name and size as in D-022), and takes them off the boards.
  const deDe = f => (M.files[f] && M.files[f].de) || metaDe.get(f) || null;   // the client that brought the photo (3.44 on)
  const ajena = (f, c) => { const d = deDe(f); return !!d && d !== c && CL.some(x => x.id === d); };
  function guardar(B) {
    const b = JSON.parse(JSON.stringify(B)), c = B.client || boardClient(B), fuera = {};
    delete b.tray;
    if (!c) return idbPut('boards', B.key, b);
    const tray = (B.tray || []).filter(f => { if (!ajena(f, c)) return true; (fuera[deDe(f)] = fuera[deDe(f)] || []).push(f); return false; });
    return tx(['boards', 'bandejas'], 'readwrite', st => {
      st.boards.put(b, B.key);
      st.bandejas.put({ client: c, tray, at: B.savedAt }, c);
      for (const o of Object.keys(fuera)) { const g = st.bandejas.get(o); g.onsuccess = () => { const r = g.result || { client: o, tray: [] }; r.tray = [...fuera[o].filter(f => !r.tray.includes(f)), ...r.tray]; r.at = B.savedAt; st.bandejas.put(r, o); }; }
    }).then(() => {
      const n = Object.values(fuera).flat();
      if (!n.length) return;
      B.tray = B.tray.filter(f => !n.includes(f));
      if (B === S) { renderTray(); toast(Object.keys(fuera).map(o => `${n.length === 1 ? 'La foto vuelve' : `${fuera[o].length} fotos vuelven`} a la bandeja de ${(CL.find(x => x.id === o) || {}).name || o}.`).join(' ')); }
    });
  }
  // a photo once: the same id, or the same name and size (D-022); the first one stays. gone: the ones left out
  async function sinRepetir(ids, gone = []) {
    const out = [], ya = new Set(), yaK = new Set();
    for (const f of ids) {
      if (!f || ya.has(f) || !trayable(f)) continue;
      ya.add(f);
      let k = fileKey(f);
      if (!k && !M.files[f]) {
        let r; try { r = await idbGet('files', f); } catch (e) { out.push(f); continue; }   // not readable now: it stays
        if (!r) continue;                                                                     // no such photo any more
        k = r.design ? null : fkey(r.name, r.size); metaKey.set(f, k); if (r.de) metaDe.set(f, r.de);
      }
      if (k && yaK.has(k)) { gone.push(f); continue; }
      if (k) yaK.add(k);
      out.push(f);
    }
    return out;
  }
  // the tray of client c as saved, with the ones its boards still keep (before 3.44, or brought by an import) moved into it
  async function juntarBandeja(c) {
    if (!c) return [];
    const rec = await idbGet('bandejas', c);
    const viejas = ((await idbAll('boards')) || []).filter(b => boardClient(b) === c && Array.isArray(b.tray))
      .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));   // the newest month's first
    if (!viejas.length) return rec ? rec.tray.slice() : [];
    const todas = [...(rec ? rec.tray : []), ...viejas.flatMap(b => b.tray)], vistos = new Set(todas), gone = [], tray = await sinRepetir(todas, gone);
    await tx(['boards', 'bandejas'], 'readwrite', st => {
      let n = viejas.length;
      for (const v of viejas) {
        const g = st.boards.get(v.key);
        g.onsuccess = () => {
          const b = g.result;
          if (b && Array.isArray(b.tray)) { b.tray.forEach(f => { if (!vistos.has(f) && !tray.includes(f)) tray.push(f); }); delete b.tray; st.boards.put(b, v.key); }   // as it is now: only what came in meanwhile
          if (--n === 0) st.bandejas.put({ client: c, tray, at: new Date().toISOString() }, c);
        };
      }
    });
    if (gone.length) delList(l => [...new Set([...l, ...gone])]);   // the same photo twice: the copy left out goes (deleteIfUnused: only if nothing uses it)
    return tray;
  }
  // every photo in a tray (the open one's as it is now)
  async function trayRefs() {
    const all = (await idbAll('bandejas')) || [];
    return new Set([...all.filter(r => !S || r.client !== S.client).flatMap(r => r.tray || []), ...(S ? S.tray : [])]);
  }
  function save() {
    usoS = null;                       // the open board's photos in use: looked at again on the next warning (D-022)
    if (!S || locked) return;
    alinearH(S);                       // a post's stories follow it, before this save point is taken
    track(S);                          // ⌘Z history: each save point is a step (several quick actions stay separate)
    vigilaH();
    clearTimeout(saveTimer);
    setSave('Guardando…');
    const B = S;
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      try { track(B); stamp(B); edited(B); B.savedAt = new Date().toISOString(); await guardar(B); await pushShared(B); if (B === S) setSave('Guardado'); }
      catch (e) { setSave('No se pudo guardar', true); }
    }, 250);
  }
  async function flushNow() {
    clearTimeout(saveTimer); saveTimer = null;
    clearTimeout(noteTimer); noteTimer = null;
    if (!S || locked) return null;
    const B = S;
    alinearH(B);
    track(B); stamp(B); edited(B); B.savedAt = new Date().toISOString();
    await guardar(B);
    await pushShared(B);
    setSave('Guardado');
    return B.savedAt;
  }
  M.flush = flushNow;
  // Lets a newer copy of the code take over this page without losing a pending save.
  M._dispose = async () => {
    try { await flushNow(); } catch (e) { /* */ }
    S = null; PB = null;
    if (bc) { try { bc.close(); } catch (e) { /* */ } bc = null; }
    if (M._onHide) { document.removeEventListener('visibilitychange', M._onHide); window.removeEventListener('pagehide', M._onHide); }
    if (dbConn) { try { dbConn.close(); } catch (e) { /* */ } }
    dbp = null; dbConn = null;
  };

  // ---------- linked publications ----------
  // One Notion page can be in several boards (a collab of two clients, overlapping months of one client): it is one
  // publication, so its photos (with their crops), contexto (note), nota (memo), format, upload record, date, name, captions and state are shared. Each slot
  // keeps a revision (s.at, ms): a save writes the changed ones through to every other board that has them, and
  // opening a board takes the newest copy of each of its slots.
  const SYNC = ['photos', 'note', 'memo', 'uploaded', 'fmt', 'date', 'notionDate', 'name', 'notionName', 'type', 'notionType', 'design', 'libre', 'caption', 'estado'];
  let IDX = {};                                     // slotId -> [{key, client}] of the other boards that have it
  let SIG = { b: null, m: {}, dirty: new Set() };   // open board: signature of each slot as last saved + slots to write through
  const boardClient = b => b.client || (String(b.key || '').match(/^(.+)-\d{4}-\d{2}$/) || [])[1] || null;
  const slotSig = (s, B) => JSON.stringify([SYNC.map(k => s[k] ?? null), [...(s.photos || []), ...dSrc(s)].map(f => (B.crops || {})[f] || null)]);
  function copyShared(to, toB, from, fromB) {
    for (const k of SYNC) {
      if (k === 'caption') { const m = capMerge(to.caption, from.caption); if (m) to.caption = m; else delete to.caption; continue; }   // merged, never replaced: no batch is lost
      if (from[k] === undefined) delete to[k]; else to[k] = JSON.parse(JSON.stringify(from[k]));
    }
    if (from.at) to.at = from.at; else delete to.at;
    toB.crops = toB.crops || {};
    for (const f of [...(to.photos || []), ...dSrc(to)]) { const c = fromB.crops && fromB.crops[f]; if (c) toB.crops[f] = { ...c }; else delete toB.crops[f]; }
  }
  // init: the newest copy of each slot (this board's or another's) becomes the «old» copy the board is built from
  async function importShared(cfgSlots, old, key) {
    let pend = null; try { pend = JSON.parse(lsGet('mesa-pending') || 'null'); } catch (e) { /* */ }
    const others = ((await idbAll('boards')) || []).filter(b => b.key !== key)
      .map(b => pend && pend.board && pend.key === b.key && String(pend.board.savedAt || '') > String(b.savedAt || '') ? pend.board : b);
    const refs = new Set([...others.flatMap(b => [...refsOf(b)]), ...(await trayRefs())]);   // + the clients' trays (D-041)
    old.slots = old.slots || []; old.tray = old.tray || []; old.crops = old.crops || {};
    IDX = {};
    for (const id of new Set(cfgSlots.map(s => s.id))) {
      const own = old.slots.find(s => s.id === id), capd = [];
      let best = own, from = null;
      for (const b of others) {
        const s = (b.slots || []).find(x => x.id === id); if (!s) continue;
        (IDX[id] = IDX[id] || []).push({ key: b.key, client: boardClient(b), cd: cdOf(b.cycleDay) });
        if (s.caption) capd.push(s);
        if (!best || (s.at || 0) > (best.at || 0)) { best = s; from = b; }
      }
      if (from) {
        const o = { ...(own || {}), id };
        copyShared(o, old, best, from);
        for (const f of own ? [...(own.photos || []), ...dSrc(own)] : []) if (trayable(f) && !slotRefs(o).includes(f) && !dOut(own).includes(f) && !lOut(own).includes(f) && !refs.has(f)) old.tray.push(f);   // never lose a photo (a design's or the editor's outputs are not photos)
        if (own) old.slots[old.slots.indexOf(own)] = o; else old.slots.push(o);
      }
      // the caption batches of every other copy too (the newest copy, already merged in, wins where they disagree)
      const t = old.slots.find(s => s.id === id);
      if (t) for (const s of capd) if (s !== best) { const m = capMerge(s.caption, t.caption); if (m) t.caption = m; }
    }
  }
  // once S is built: keep the revisions; the baseline is each slot as it was before init (base: id -> signature of the
  // pre-merge copy), so what init changed (Notion wins, synced, renames) gets a new revision and reaches the other boards
  function sharedInit(oldById, base) {
    S.slots.forEach(s => { const o = oldById[s.id]; if (o && o.at) s.at = o.at; });
    SIG = { b: S, m: Object.fromEntries(S.slots.map(s => [s.id, base[s.id] ?? slotSig(s, S)])), dirty: new Set() };
  }
  function stamp(B) {              // before saving: new revision for the slots whose shared state changed
    if (!B || SIG.b !== B) return;
    const now = Date.now();
    for (const s of B.slots) { const g = slotSig(s, B); if (SIG.m[s.id] !== g) { SIG.m[s.id] = g; s.at = now; if (IDX[s.id]) SIG.dirty.add(s.id); } }
  }
  // after saving: write those slots through to the other boards (one read/put per board; other slots untouched)
  async function pushShared(B) {
    if (SIG.b !== B || !SIG.dirty.size) return;
    const ids = [...SIG.dirty]; SIG.dirty.clear();
    const by = {}, cOf = {}, gone = [], srcRefs = refsOf(B), myC = B.client || boardClient(B);
    ids.forEach(id => (IDX[id] || []).forEach(x => { (by[x.key] = by[x.key] || []).push(id); cOf[x.key] = x.client || boardClient(x); }));
    const keys = Object.keys(by), otros = [...new Set(keys.map(k => cOf[k]))].filter(Boolean);
    let mia = false;
    try {
      // the other board's tray is its client's (D-041): this one's, in memory; another client's, its record (in the same
      // transaction); a board from before 3.44 still keeps its own
      await tx(['boards', 'bandejas'], 'readwrite', st => {
        const trays = {}, dirty = new Set();
        const go = () => { let n = keys.length; for (const k of keys) { const g = st.boards.get(k); g.onsuccess = () => {
          const ob = g.result;
          if (!ob) gone.push(k);
          else {
            const oc = boardClient(ob) || cOf[k], suya = Array.isArray(ob.tray), vivo = oc === myC && S && (S.client || boardClient(S)) === myC ? S : null;   // this client open now: its tray in memory
            const T = suya ? ob.tray : vivo ? vivo.tray : (trays[oc] = trays[oc] || { client: oc, tray: [] }).tray;
            let hit = false;
            for (const id of by[k]) {
              const s = B.slots.find(x => x.id === id), o = (ob.slots || []).find(x => x.id === id); if (!s || !o) continue;
              const had = [...(o.photos || []), ...dSrc(o)].filter(f => trayable(f) && !slotRefs(s).includes(f) && !dOut(o).includes(f) && !lOut(o).includes(f));   // an image the editor drew again is not a photo for its tray
              copyShared(o, ob, s, B); hit = true;
              for (let i = T.length - 1; i >= 0; i--) if (s.photos.includes(T[i])) { T.splice(i, 1); if (!suya) (vivo ? mia = true : dirty.add(oc)); }
              const refs = refsOf({ ...ob, tray: T }), lost = had.filter(f => !refs.has(f) && !srcRefs.has(f));   // never orphan a photo (one this board still holds stays only here)
              if (lost.length) { T.unshift(...lost); if (!suya) (vivo ? mia = true : dirty.add(oc)); }
            }
            if (hit) { alinearH(ob); ob.editedAt = new Date().toISOString(); st.boards.put(ob, k); }
          }
          if (--n === 0) dirty.forEach(c => st.bandejas.put({ ...trays[c], at: new Date().toISOString() }, c));
        }; } };
        let n = otros.length;
        if (!n) go(); else otros.forEach(c => { const g = st.bandejas.get(c); g.onsuccess = () => { if (g.result) trays[c] = g.result; if (--n === 0) go(); }; });
      });
    } catch (e) { if (SIG.b === B) ids.forEach(id => SIG.dirty.add(id)); return; }
    if (mia && S && (S.client || boardClient(S)) === myC) { renderTray(); save(); }   // this client's tray changed through another of its boards
    if (gone.length) { dropIdx(gone); renderFeed(); }
    if (B === S && Object.keys(by).some(k => MB.some(m => m.key === k))) { await refreshMonths(); renderBar(); }
  }
  function dropIdx(keys) { for (const id of Object.keys(IDX)) { IDX[id] = IDX[id].filter(x => !keys.includes(x.key)); if (!IDX[id].length) delete IDX[id]; } }
  function sharedWith(s) {         // the other clients whose boards have this publication (a collab)
    if (!S || !s) return [];
    return [...new Set((IDX[s.id] || []).map(x => x.client).filter(c => c && c !== S.client))].map(c => (CL.find(x => x.id === c) || {}).name || c);
  }
  const linkLine = s => { const w = sharedWith(s); return w.length ? `<p class="lk">Collab enlazada con ${esc(w.join(' y '))}: foto, fecha, hora, contexto, nota, captions y estado se cambian en ${w.length > 1 ? 'todas' : 'las dos'}.</p>` : ''; };

  async function loadClients() { CL = ((await idbAll('clients')) || []).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))); return CL; }
  async function refreshMonths() {
    const all = (await idbAll('boards')) || [];
    MB = all.filter(b => b.client === curClient).map(b => ({ key: b.key, month: b.month, span: b.span || 1, cycleDay: cdOf(b.cycleDay), filled: (b.slots || []).filter(s => vivo(s) && (s.photos || []).length).length, n: (b.slots || []).filter(vivo).length }))
      .sort((a, b) => String(b.month).localeCompare(String(a.month)));
  }

  // ---------- images ----------
  async function thumbFromBitmap(src, w, h) {
    const k = Math.min(1, THUMB_LONG / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);   // transparent areas white, as in the upload (opaque photos: same pixels)
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/jpeg', 0.86));
  }
  async function makeThumb(blob) {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    try { const w = bmp.width, h = bmp.height; return { w, h, thumb: await thumbFromBitmap(bmp, w, h) }; }
    finally { bmp.close(); }
  }
  // JPEG of a canvas under max bytes, trying each quality in turn. With shrink, a canvas still too big at the lowest
  // quality is scaled down until it fits (for Zernio: Instagram keeps 1440 px wide at most, so nothing visible is lost).
  async function toJpeg(c, max, qs, shrink) {
    for (;;) {
      let b = null;
      for (const q of qs) { b = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); if (b && b.size <= max) return { blob: b, w: c.width, h: c.height }; }
      if (!shrink || !b || c.width <= 1440) return null;
      const k = Math.max(0.5, Math.sqrt(max / b.size) * 0.95), d = document.createElement('canvas');
      d.width = Math.max(1440, Math.round(c.width * k)); d.height = Math.round(c.height * d.width / c.width);
      const x = d.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, d.width, d.height); c = d;
    }
  }
  async function reencode(blob, max = MAX_UPLOAD, shrink = false) {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
    cx.drawImage(bmp, 0, 0); bmp.close();
    const out = await toJpeg(c, max, [0.92, 0.88, 0.82, 0.75], shrink);
    if (out) return out.blob;
    throw new Error(`supera ${Math.round(max / 1048576)} MB incluso recomprimida`);
  }
  async function getBlob(id) {
    if (M.blobs[id]) return M.blobs[id];
    const rec = await idbGet('files', id);
    if (!rec || !rec.blob) throw new Error('foto no encontrada en la mesa');
    return (M.blobs[id] = rec.blob);
  }
  async function cropBlob(blob, fid, r, max = MAX_UPLOAD, shrink = false) {
    const f = M.files[fid];
    if (r.x < 1 && r.y < 1 && Math.abs(r.w - f.w) < 1 && Math.abs(r.h - f.h) < 1 && blob.type === 'image/jpeg' && blob.size <= max) return { blob, w: f.w, h: f.h, original: true };
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const k = bmp.width / f.w;
    const c = document.createElement('canvas'); c.width = Math.round(r.w * k); c.height = Math.round(r.h * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high';
    x.drawImage(bmp, r.x * k, r.y * k, r.w * k, r.h * k, 0, 0, c.width, c.height); bmp.close();
    const out = await toJpeg(c, max, [0.93, 0.9, 0.85, 0.8], shrink);
    if (out) return out;
    throw new Error(`supera ${Math.round(max / 1048576)} MB incluso recortada`);
  }
  async function loadThumbs(ids) {
    const missing = [];
    for (const id of ids) {
      if (M.files[id]) continue;
      const rec = await idbGet('files', id);
      if (rec && rec.thumb) { M.files[id] = { name: rec.name, size: rec.size, type: rec.type, w: rec.w, h: rec.h, thumbUrl: URL.createObjectURL(rec.thumb) }; if (rec.reduced) M.files[id].reduced = true; if (rec.design) M.files[id].design = true; if (rec.de) M.files[id].de = rec.de; M.thumbBlobs[id] = rec.thumb; }
      else missing.push(id);
    }
    return missing;
  }

  // ---------- a photo used again (D-022) ----------
  // A photo may go in again: before it goes into a post the mesa says its nearest use and asks, never blocks. Same photo =
  // same name and size; used = in a live post of the same client's boards (its photos, its design or the editor's
  // compositions), in a previous-month cell set here, or on a filler of the client's last month (D-049), never in a tray.
  // Index name|size -> uses: the open board's is rebuilt on the first look after a save; the other boards' is read once when
  // a board opens (in the background).
  const AVISOS = [null, 'Ya usada en esta diapositiva', 'Ya usada en este post', 'Ya usada este mes', 'Ya usada el mes anterior'];
  const fkey = (n, z) => n + '|' + z;
  const metaKey = new Map();           // fileId -> name|size (null: nothing to compare) of photos not loaded
  const metaDe = new Map();            // fileId -> the client that brought it (file record `de`), of photos not loaded
  let usoS = null, usoO = new Map(), usoP = Promise.resolve(), usoTok = 0, usoIdsO = new Map();   // usoIdsO: name|size -> a fileId used in the other boards
  let usoFin = '', usoPrevO = [];      // the client's last month; the photos on the fillers of its other boards (D-049)
  const finDe = b => { const m = b.month || (String(b.key || '').match(/-(\d{4}-\d{2})$/) || [])[1]; return m ? monthsOf(m, b.span).slice(-1)[0] : ''; };
  const fileKey = f => { if (!trayable(f)) return null; const x = M.files[f]; return x ? (x.design ? null : fkey(x.name, x.size)) : metaKey.get(f) || null; };
  function usosDe(b, put) {            // each photo used in board b: put(fileId, {slot | prev, m: its month})
    const cd = cdOf(b.cycleDay);
    for (const s of b.slots || []) {
      if (!vivo(s)) continue;
      const out = new Set([...dOut(s), ...lOut(s)]), m = cycleOf(s.date, cd) || b.month;
      new Set([...(s.photos || []).filter(f => !out.has(f)), ...dSrc(s)]).forEach(f => put(f, { slot: s.id, m, date: s.date, name: s.name }));
    }
    for (const p of b.prev || []) if (p.own) (p.photos || []).forEach(f => put(f, { prev: true, m: cycleOf(p.date, cd) }));
    if (finDe(b) >= usoFin) previewsOf(b).forEach(f => put(f, { hueco: true, m: finDe(b) }));   // with a later month, it is free again (D-049)
  }
  function usoMap(b, map = new Map()) { usosDe(b, (f, u) => { const k = fileKey(f); if (!k) return; if (!map.has(k)) map.set(k, []); map.get(k).push(u); }); return map; }
  // ---------- stories: what they use and the rule of not showing a photo before its post (D-056) ----------
  let usoHO = new Map();               // photos used in the stories of the client's other boards: key -> [{id, date}]
  function hUsos(b, map = new Map()) { hsDe(b).forEach(h => { if (h.cancelada) return; new Set(lSrc(h)).forEach(f => { const k = fileKey(f); if (!k) return; if (!map.has(k)) map.set(k, []); map.get(k).push({ id: h.id, date: h.date }); }); }); return map; }
  const usoHMap = () => { const m = hUsos(S); usoHO.forEach((l, k) => m.set(k, [...(m.get(k) || []), ...l])); return m; };
  const hFecha = iso => { const p = madParts(ts(iso)); return `${+p.day.slice(8)} ${MONTHS[+p.day.slice(5, 7) - 1].slice(0, 3)} ${p.time}`; };
  const tsPost = d => (dOnly(d) ? ts(madridISO(localDay(d), '23:59')) : ts(d));   // a post with no time yet: its day counts whole
  function postsDespues(k, t) {        // the client's live posts of any loaded month with the photo, later than t: the nearest first
    if (!usoS || usoS.B !== S) usoS = { B: S, map: usoMap(S) };
    return [...(usoS.map.get(k) || []), ...(usoO.get(k) || [])].filter(u => u.slot && u.date && tsPost(u.date) > t).sort((a, b) => tsPost(a.date) - tsPost(b.date));
  }
  function adelantos(h) {              // what a story shows before its post: [{f, post, date}], one per photo
    if (!S || !h || h.cancelada) return [];
    const out = [];
    for (const f of new Set(lSrc(h))) { const k = fileKey(f), u = k && postsDespues(k, ts(h.date))[0]; if (u) out.push({ f, post: u.name, date: u.date }); }
    return out;
  }
  // What stops or warns about a story without measuring anything, for its API, «Revisar» and the upload to Zernio (D-058):
  // [{tipo, bloquea, texto}]. What needs its fonts (the safe zone) and the photo's px, only in M.revisar.
  function hProblemas(h) {
    const out = [], add = (tipo, texto, bloquea = false) => out.push({ tipo, bloquea, texto });
    if (h.cancelada) { if (h.porPost) add('post cancelado', 'su publicación está cancelada', true); return out; }
    const f0 = (h.photos || [])[0], comp = f0 && h.libre && h.libre.slides && h.libre.slides[f0];
    if (!f0) add('sin diseñar', 'está sin diseñar', true);
    else if (vacia(comp)) add('hueco', 'tiene un hueco de foto vacío', true);
    adelantos(h).forEach(a => add('adelanto', `enseña una foto antes de que salga en el feed: ${a.post}, ${hFecha(a.date)}`, true));
    const s = h.slotId && (S.slots || []).find(x => x.id === h.slotId);
    if (s && !dOnly(s.date) && ts(h.date) < ts(s.date)) add('antes del post', `va antes que su publicación: ${s.name}, ${hFecha(s.date)}`, true);
    if (!usoS || usoS.B !== S) usoS = { B: S, map: usoMap(S) };
    const hm = usoHMap(), rep = new Set();
    for (const f of new Set(lSrc(h))) { const k = fileKey(f); if (k && !(usoS.map.get(k) || []).length && !(usoO.get(k) || []).length && (hm.get(k) || []).some(u => u.id !== h.id)) rep.add(k); }
    if (rep.size) add('descarte repetido', rep.size === 1 ? 'usa un descarte que ya va en otra historia' : `usa ${rep.size} descartes que ya van en otras historias`);
    const dia = localDay(h.date), hoy = hsDe(S).filter(x => !x.cancelada && localDay(x.date) === dia).sort((a, b) => ts(a.date) - ts(b.date));
    if (hoy.indexOf(h) >= 5) add('bloque', 'es la sexta o más de un bloque: pasa de 5 historias en el día');
    return out;
  }
  async function usoHistoria(name, size, h) {   // the warning for a photo going into a story
    await usoP;
    if (!S || !h) return null;
    const u = postsDespues(fkey(name, size), ts(h.date))[0];
    return u ? { n: 7, txt: `Sale en el feed después de esta historia: ${u.name}, ${hFecha(u.date)}` } : null;
  }
  // Any change: a warning when a story has come to show a photo before its post, whichever way it happened (a post moved, a
  // photo moved or pasted, a template…). It asks nothing: D-022's silent ways stay silent, and «Revisar» stops that story.
  let hVistas = { key: null, set: new Set() };
  function vigilaH() {
    if (!S || !hsDe(S).length) return;
    const now = new Set(); let nuevo = null;
    for (const h of hsDe(S)) for (const a of adelantos(h)) { const k = h.id + '|' + a.f; now.add(k); if (!nuevo && hVistas.key === S.key && !hVistas.set.has(k)) nuevo = { h, a }; }
    hVistas = { key: S.key, set: now };
    if (nuevo) toast(`La historia del ${hFecha(nuevo.h.date)} enseña una foto antes de que salga en el feed (${nuevo.a.post}, ${hFecha(nuevo.a.date)}).`, { ms: 9000, key: 'historia-adelanta' });
  }
  // ---------- stories: the link with their post (D-057), every way a post can change ----------
  const isoDe = t => new Date(t).toISOString().replace(/\.000Z$/, 'Z');
  // Stories of a day in time order, at least a minute apart so they come out in that order; each named after its moment.
  function hNorm(B) {
    const l = hsDe(B); if (!l.length) return;
    const dias = {};
    l.forEach(h => { if (!h.cancelada) { const d = localDay(h.date); (dias[d] = dias[d] || []).push(h); } });
    Object.values(dias).forEach(a => { a.sort((x, y) => ts(x.date) - ts(y.date)); let t = -Infinity; a.forEach(h => { if (ts(h.date) < t + 6e4) h.date = isoDe(t + 6e4); t = ts(h.date); }); });
    l.forEach(h => { h.name = 'Historia ' + hFecha(h.date); });
    l.sort((x, y) => ts(x.date) - ts(y.date));
  }
  // Its stories follow a post: the same distance when its date changes, cancelled while it is cancelled or gone (those
  // cancelled by hand stay so when it comes back). Idempotent: it runs on every save, on opening a board and when a collab
  // writes through to another board, so it doesn't matter how the post changed.
  function alinearH(B) {
    let cambio = false;
    for (const h of hsDe(B)) {
      if (!h.slotId) continue;
      const s = (B.slots || []).find(x => x.id === h.slotId), caido = !s || !vivo(s);
      if (caido && !h.cancelada) { h.cancelada = true; h.porPost = true; cambio = true; }
      else if (!caido && h.porPost) { delete h.cancelada; delete h.porPost; cambio = true; }
      if (s && !sameDate(s.date, h.postDate)) {
        const d = tsPost(s.date) - tsPost(h.postDate);
        if (h.postDate && d) h.date = isoDe(ts(h.date) + d);
        h.postDate = s.date; cambio = true;
      }
    }
    if (cambio) hNorm(B);
  }
  function hsRender() { if (M.hs && M.hs.render) { try { M.hs.render(); } catch (e) { console.warn('historias:', e); } } }
  function usosOtros() {               // the same client's other boards
    const B = S, tok = ++usoTok; usoO = new Map(); usoIdsO = new Map(); usoHO = new Map(); usoFin = finDe(B); usoPrevO = [];
    usoP = (async () => {
      const clientOf = b => b.client || (String(b.key || '').match(/^(.+)-\d{4}-\d{2}$/) || [])[1];
      const all = ((await idbAll('boards')) || []).map(b => newest(b.key, b)).filter(b => b && b.key !== B.key && clientOf(b) === B.client);
      const prevs = [...new Set(all.flatMap(previewsOf))];
      await loadThumbs(prevs);
      if (tok !== usoTok) return;
      usoFin = all.map(finDe).reduce((a, m) => (m > a ? m : a), finDe(B)); usoPrevO = prevs; usoS = null;
      const need = new Set(), pide = f => { if (trayable(f) && !M.files[f] && !metaKey.has(f)) need.add(f); };
      all.forEach(b => usosDe(b, pide));
      if ([...all, B].some(b => hsDe(b).length)) { usosDe(B, pide); [...all, B].forEach(b => hRefs(b).forEach(pide)); }   // with stories, what they and this board's slides use must be known by name and size (D-056)
      for (const f of need) { const r = await idbGet('files', f).catch(() => null); metaKey.set(f, r && !r.design ? fkey(r.name, r.size) : null); if (r && r.de) metaDe.set(f, r.de); }
      if (tok !== usoTok) return;
      usoS = null;
      const map = new Map(), ids = new Map(), hm = new Map(); all.forEach(b => { usoMap(b, map); hUsos(b, hm); }); usoO = map; usoHO = hm;
      all.sort((a, b) => String(b.month || '').localeCompare(String(a.month || ''))).forEach(b => usosDe(b, f => { const k = fileKey(f); if (k && !ids.has(k) && !ajena(f, B.client)) ids.set(k, f); }));
      usoIdsO = ids;                   // «Todas» in the tray (D-041): a photo of each one used in the other months, the newest month's
      if (B === S) { renderTray(); hsRender(); if (M.libre && M.libre.bandeja) M.libre.bandeja(); }   // their ✓ are known now
    })().catch(() => { /* without it the photo just goes in */ });
  }
  // the nearest use of a photo going into post sid: {n: 2 this post · 3 this month · 4 the previous month · 5 another
  // month, m, txt} or null. skip: a post whose uses don't count (the free editor counts its own, open: a = 1 or 2 found there)
  async function usoFoto(name, size, { slot: sid, skip, a } = {}) {
    await usoP;
    if (!S) return null;
    if (!usoS || usoS.B !== S) usoS = { B: S, map: usoMap(S) };
    const k = fkey(name, size), pm = prevMonth(S.month), mine = monthsOf(S.month, S.span), mi = m => { const [y, mo] = String(m).split('-').map(Number); return y * 12 + mo; };
    let best = a ? { n: a } : null;
    const cand = (n, m) => { if (!best || n < best.n || (n === 5 && best.n === 5 && Math.abs(mi(m) - mi(S.month)) < Math.abs(mi(best.m) - mi(S.month)))) best = { n, m }; };
    for (const u of usoS.map.get(k) || []) if (!u.slot || u.slot !== skip) cand(u.prev ? 4 : u.slot === sid ? 2 : 3, u.m);
    for (const u of usoO.get(k) || []) cand(u.m === pm ? 4 : mine.includes(u.m) ? 3 : 5, u.m);
    if (!best) { const h = usoHMap().get(k); if (h && h.length) return { n: 6, m: S.month, txt: `Ya usada en una historia del ${hFecha(h[0].date)}` }; }   // the feed's own uses first (D-056)
    return best && { ...best, txt: best.n < 5 ? AVISOS[best.n] : /^\d{4}-\d{2}$/.test(best.m || '') ? `Ya usada en la mesa en ${rangeLabel(best.m, 1, false, curCd()).toLowerCase()}` : 'Ya usada en otro mes de la mesa' };
  }
  // one dialog per action: the photos [{name, size, …}] that would go in again, each with its nearest use. Resolves with the
  // ones that go in (all, or without the repeated ones) or null (Cancelar: nothing changes)
  let repeAsk = null;
  const repeCancel = () => { const f = repeAsk; repeAsk = null; if (f) f(null); };
  async function repetidas(items, ctx) {
    const rep = [];
    for (const it of items) { const u = await usoFoto(it.name, it.size, ctx); if (u) rep.push({ it, u }); }
    if (!rep.length || !S || !shellReady()) return items;
    const x = '<button class="x" data-act="close" aria-label="Cerrar">×</button>';
    showDialog('repe', items.length === 1
      ? `${x}<h3>${esc(rep[0].u.txt)}</h3><p>${esc(rep[0].it.name)}</p><div class="form"><div class="row"><button type="button" class="btn2" data-act="close">Cancelar</button><button type="button" class="btn" data-act="repe" data-m="usar">Usar igualmente</button></div></div>`
      : `${x}<h3>${rep.length === 1 ? '1 foto ya usada' : `${rep.length} fotos ya usadas`} de ${items.length}</h3><ul class="repl">${rep.map(r => `<li><b>${esc(r.it.name)}</b><span>${esc(r.u.txt)}</span></li>`).join('')}</ul><div class="form"><div class="row"><button type="button" class="btn2" data-act="repe" data-m="saltar">Saltar repetidas</button><button type="button" class="btn" data-act="repe" data-m="usar">Usar todas</button></div></div>`);
    return new Promise(res => { repeAsk = v => res(v === 'usar' ? items : v === 'saltar' ? items.filter(it => !rep.some(r => r.it === it)) : null); });
  }
  // tray photos onto a post: the warning first, then as always (Sustituir / Añadir when it has photos)
  function addToSlot(slotId, ids) {
    ids = (ids || []).filter(id => M.files[id]);
    const B = S;
    repetidas(ids.map(f => ({ f, name: M.files[f].name, size: M.files[f].size })), { slot: slotId }).then(async r => { if (!r || !r.length) return; const go = await paraPoner(r.map(x => x.f)); if (S === B && go.length) askAddMode(slotId, go); });
  }
  // a photo shown with ✓ (D-041) that is in a publication of this board goes into another as a copy, the same photo under
  // a new id: a photo is in one post only, each with its own crop (as importing it again, D-022)
  async function copiaFoto(f) {
    const r = await idbGet('files', f).catch(() => null); if (!r || !r.thumb || !S || !M.files[f]) return null;
    const id = newId(), c = S.client;
    await idbPut('files', id, { ...r, de: c });
    M.files[id] = { ...M.files[f], de: c, thumbUrl: URL.createObjectURL(r.thumb) };
    M.thumbBlobs[id] = r.thumb;
    delList(l => [...l, id]);          // a dialog closed without placing it: deleted on the next open, only if nothing uses it
    return id;
  }
  async function paraPoner(ids, sin) {   // sin: a post whose photos don't count (the one open in the editor)
    const en = refsOf({ slots: S.slots.filter(x => x.id !== sin), prev: S.prev, tray: [] }), out = [];
    for (const f of ids) out.push(en.has(f) ? await copiaFoto(f) : f);
    return out.filter(Boolean);
  }
  function prevDesdeBandeja(id, f) { const B = S; paraPoner([f]).then(g => { if (S === B && g[0]) withPrev(() => prevSetFromTray(id, g[0]), 'edit'); }); }

  // ---------- adding photos (serialised so two drops never race) ----------
  let addQ = Promise.resolve();
  M.addFiles = (list, targetSlotId, opts) => {   // opts.tray: a photo already in the tray comes back (the free editor puts it on a slide)
    const files = Array.from(list || []);
    const p = addQ.then(() => addFilesNow(files, targetSlotId, opts));
    addQ = p.catch(() => { /* keep the queue alive */ });
    return p;
  };
  async function addFilesNow(list, targetSlotId, opts) {
    if (!S) { toast('Abre un mes antes de añadir fotos.'); return []; }
    const B = S;
    list.filter(f => f && !f.size).forEach(f => toast(`${f.name} está vacío: no se puede añadir.`));
    let files = list.filter(f => f && f.size).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
    const into = targetSlotId || (opts && opts.aviso);   // photos going into a post warn if used before (D-022); into the tray they just go in
    if (into) {
      const d = root && root.querySelector('.detail'), back = d && !d.hidden && !d.dataset.dlg && d.dataset.slot ? { id: d.dataset.slot, idx: cur.idx } : null;
      const ok = await repetidas(files.filter(f => OK_TYPES.includes(f.type || '')).map(f => ({ f, name: f.name, size: f.size })), { slot: into });
      if (back && S === B && d.hidden) openDetail(back.id, back.idx);   // the post view the photos were dropped on comes back
      if (!ok) return [];
      const go = new Set(ok.map(x => x.f)); files = files.filter(f => go.has(f) || !OK_TYPES.includes(f.type || ''));
    }
    const got = [], fresh = [], refs = refsOf(B);
    importing += files.length;
    try {
      let i = 0;
      for (const f of files) {
        i++;
        setBusy('imp', files.length > 1 ? `Preparando fotos ${i}/${files.length}…` : 'Preparando foto…');
        const type = f.type || '';
        if (!OK_TYPES.includes(type)) {
          toast(/heic|heif/i.test(f.name + type) ? `${f.name}: HEIC no se puede leer aquí. Expórtala como JPG.` : `${f.name}: formato no compatible (usa JPG o PNG).`);
          continue;
        }
        // the same photo already here: in the tray (the client's, D-041) it is taken from there (never twice in it); used in
        // this board, a copy goes in (each post keeps its own crop); only in other boards of this client, its record is the same
        const same = Object.keys(M.files).filter(id => M.files[id].name === f.name && M.files[id].size === f.size && !M.files[id].design);
        const inTray = same.find(id => B.tray.includes(id) || fresh.includes(id));
        if (inTray) { if (!got.includes(inTray)) got.push(inTray); if (!into && !(opts && opts.tray)) toast(`${f.name} ya está en la bandeja.`); continue; }
        const dup = same.find(id => !refs.has(id) && M.files[id].de === B.client);   // another client's photo keeps its own
        let decoded = false;
        try {
          const { w, h, thumb } = await makeThumb(f);
          decoded = true;
          const id = dup || newId();
          await idbPut('files', id, { name: f.name, size: f.size, type, w, h, lastModified: f.lastModified || 0, blob: f, thumb, de: B.client });   // de: the client it came in for (D-041)
          if (M.files[id]) URL.revokeObjectURL(M.files[id].thumbUrl);
          M.files[id] = { name: f.name, size: f.size, type, w, h, de: B.client, thumbUrl: URL.createObjectURL(thumb) };
          M.thumbBlobs[id] = thumb;
          delete M.blobs[id];
          fresh.push(id);
          got.push(id);
        } catch (e) {
          if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)))) { toast('El navegador no tiene espacio para más fotos. Quita fotos que ya no uses o termina y sube un mes.'); break; }
          toast(decoded ? `${f.name}: no se pudo leer.` : `${f.name} está dañada o incompleta: vuelve a exportarla.`);   // the image itself can't be decoded
        }
      }
    } finally {
      if (fresh.length) B.tray.unshift(...fresh);          // newest imports first, in name order
      importing -= files.length; setBusy('imp', null);
    }
    if (B !== S) {                     // another board opened meanwhile: the photos go to their client's tray (D-041)
      if (fresh.length && S && S.client === B.client) { S.tray.unshift(...fresh.filter(id => !refsOf(S).has(id))); changed(); }
      else if (fresh.length && !locked) { try { await tx('bandejas', 'readwrite', st => { const g = st.get(B.client); g.onsuccess = () => { const r = g.result || { client: B.client, tray: [] }; r.tray = [...fresh.filter(f => !r.tray.includes(f)), ...r.tray]; st.put(r, B.client); }; }); } catch (e) { /* */ } }
      return got;
    }
    if (!into && !(opts && opts.tray) && got.length) {   // into the tray, a photo already used: it is in «Todas», with ✓ (D-041)
      const ya = bandejaVista({ todas: true }).filter(x => x.u && got.includes(x.f)).length;
      if (ya && !trayTodas()) toast(ya === 1 ? 'Esa foto ya está usada en una publicación: la ves en «Todas», con ✓.' : `${ya} de esas fotos ya están usadas en publicaciones: las ves en «Todas», con ✓.`, { ms: 6000 });
    }
    if (targetSlotId && got.length) {
      const s = slot(targetSlotId);
      if (s && isCarousel(s.type)) got.forEach(id => place(targetSlotId, id, true));
      else if (s) place(targetSlotId, got[0], true);
    }
    changed();
    const d = root && root.querySelector('.detail');
    if (targetSlotId && d && !d.hidden && d.dataset.slot === targetSlotId) refreshDetail();
    return got;
  }

  // ---------- board mutations ----------
  function takeFromTray(fileId) { S.tray = S.tray.filter(x => x !== fileId); }
  function place(slotId, fileId, silent) {
    const s = slot(slotId); if (!s) return;
    if (designed(s) && !isMulti(s.type) && sinPortada(s)) return;
    if (sel === fileId) sel = null;
    const other = S.slots.find(x => x !== s && x.photos.includes(fileId));
    if (other) other.photos = other.photos.filter(x => x !== fileId);
    takeFromTray(fileId);
    if (isCarousel(s.type)) { if (!s.photos.includes(fileId)) s.photos.push(fileId); }   // one more page, after the others
    else if (designed(s)) { const old = setCoverPhoto(s, fileId); centerCrop(fileId, null); if (old && old !== fileId && !(M.files[old] || {}).design && !refsOf(S).has(old)) S.tray.unshift(old); rerender(s); }   // the texts stay
    else { if (s.photos.length) S.tray.unshift(...s.photos.filter(x => x !== fileId && !dOut(s).includes(x))); s.photos = [fileId]; }
    if (!silent) changed();
  }
  function fixSingle(s) {
    if (!isMulti(s.type) && s.photos.length > 1) {
      S.tray.unshift(...s.photos.slice(1)); s.photos = s.photos.slice(0, 1);
      toast('Los reels solo llevan una portada: las demás fotos vuelven a la bandeja.');
    }
  }
  // Two posts of the same type without design swap all their photos, as always. Otherwise (other types, or a designed
  // post) only their covers — the photo the grid shows — change places: each one takes its new post's format with a
  // centred crop, and texts, designs and the other photos stay with their posts (an applied design is drawn again).
  function swap(a, b) {
    if (a === b) return;
    const A = slot(a), B = slot(b); if (!A || !B) return;
    const kind = x => isCarousel(x.type) ? 'c' : isReel(x.type) ? 'r' : 'f';
    if (kind(A) === kind(B) && !designed(A) && !designed(B)) {
      [A.photos, B.photos] = [B.photos, A.photos];
      if (isCarousel(A.type) && isCarousel(B.type)) [A.fmt, B.fmt] = [B.fmt, A.fmt];
      else { delete A.fmt; delete B.fmt; }
      fixSingle(A); fixSingle(B);
      changed(); return;
    }
    if (sinPortada(A, B)) return;
    const fa = coverOf(A), fb = coverOf(B); if (!fa && !fb) return;
    const comp = [[A, fa], [B, fb]].find(([x, f]) => portadaCompartida(x, f));
    if (comp) { toast(`La portada de ${comp[0].name} también se usa en otra diapositiva: cámbiala con «Cambiar portada» o en «Diseñar».`, { ms: 7000 }); return; }
    if ((!fb && designed(A)) || (!fa && designed(B))) { toast('Una publicación diseñada no se queda sin portada: para cambiársela, arrastra otra foto sobre su casilla o usa «Cambiar portada».', { ms: 6000 }); return; }
    setCoverPhoto(A, fb); setCoverPhoto(B, fa);
    if (fb) centerCrop(fb, null); if (fa) centerCrop(fa, null);
    changed(); rerender(A); rerender(B);
  }
  // ---------- a post's cover (B1): the photo its grid cell shows ----------
  const designed = s => !!(s && s.design && (isCarousel(s.type) || isReel(s.type)));
  const coverOf = s => designed(s) && M.diseno && M.diseno._portada ? M.diseno._portada(s) : (s.photos[0] || null);
  function centerCrop(fid, fmt) { if (M.files[fid]) S.crops[fid] = { fmt: fmt || baseCrop(fid, S).fmt, cx: 0.5, cy: 0.5, z: 1 }; }
  // the cover becomes fid (null: the post loses it); returns the photo it had — the caller decides where that one goes
  function setCoverPhoto(s, fid) {
    if (designed(s) && M.diseno && M.diseno._ponerPortada) return M.diseno._ponerPortada(s, fid);
    const old = s.photos[0] || null;
    if (fid) { if (s.photos.length) s.photos[0] = fid; else s.photos = [fid]; s.photos = [...new Set(s.photos)]; }
    else s.photos = s.photos.slice(1);
    return old;
  }
  // a cover also used elsewhere (another slide of its design, another post) can't change places: it would end up in two
  // posts sharing one reframe
  function portadaCompartida(s, fid) {
    if (!fid) return false;
    if (S.slots.some(x => x !== s && slotRefs(x).includes(fid))) return true;
    return designed(s) && s.design.slides.filter(x => x.src === fid).length > 1;
  }
  // a designed post's cover is the designer's: without it loaded, or with no cover slide, the post is left as it is
  function sinPortada(...ps) {
    const bad = ps.find(x => designed(x) && !(M.diseno && M.diseno._tienePortada && M.diseno._tienePortada(x)));
    if (!bad) return false;
    toast(M.diseno && M.diseno._tienePortada ? `${bad.name}: su diseño no tiene diapositiva de portada; cámbiala en «Diseñar».` : 'El diseñador no está cargado: recarga la página para cambiar la portada de una publicación diseñada.', { ms: 6000 });
    return true;
  }
  const rerender = s => { if (designed(s) && s.design.out && M.diseno && M.diseno.reaplicar) { const id = s.id; setTimeout(() => M.diseno.reaplicar(id), 0); } };
  // ---------- pinned posts (B8) ----------
  // Up to 3 of the board's posts pinned at the top of the profile, as in Instagram: the last one pinned goes first, and
  // unpinned it goes back to its place by date. Only how the feed looks (mesa, vista cliente, the feed image): dates,
  // names and what goes to Notion don't change. Kept per board (S.pins: slot ids, newest first).
  const MAX_PINS = 3;
  const pinsOf = () => (S && S.pins ? S.pins.filter(id => S.slots.some(x => x.id === id && vivo(x))) : []);   // a cancelled post is not in the feed
  const isPinned = s => !!(s && S && S.pins && S.pins.includes(s.id));
  function feedOrder() { const p = pinsOf(); return [...p.map(id => S.slots.find(x => x.id === id)), ...S.slots.filter(x => !p.includes(x.id) && vivo(x))]; }
  function setPin(slotId, on) {
    const s = S && S.slots.find(x => x.id === slotId); if (!s) return false;
    const p = pinsOf().filter(id => id !== slotId);
    if (on) { if (p.length >= MAX_PINS) { toast('Como en Instagram, se pueden fijar como mucho 3 publicaciones: quita la fijación de otra antes.', { ms: 6000 }); return false; } p.unshift(slotId); }
    if (p.length) S.pins = p; else delete S.pins;
    save(); renderFeed(); return true;
  }
  // ---------- fillers («+ Hueco») ----------
  // Up to 2 plain black cells at the top of the grid, after the pinned posts, to square the feed into rows of 3. Only how
  // the feed looks (mesa, vista cliente, the feed image): not posts, never in Notion or the counters. Kept per board as a
  // count (S.fillers); old boards have none. Each may hold a preview of next month's first post (S.previews[k], null: none;
  // D-049): a photo from the tray, inside a black border, with its label.
  const MAX_FILLERS = 2;
  const fillersOf = () => (S && S.fillers > 0 ? Math.min(MAX_FILLERS, Math.floor(S.fillers)) : 0);
  function setFillers(n) {
    if (!S) return false;
    if (n > MAX_FILLERS) { toast(`Como mucho ${MAX_FILLERS} huecos: con ellos ya cuadran las filas de 3.`, { ms: 6000 }); return false; }
    if (n > 0) S.fillers = n; else delete S.fillers;
    save(); renderFeed(); return true;
  }
  const previewAt = k => (S && k < fillersOf() && (S.previews || [])[k]) || null;
  function setPreviews(c) { while (c.length && !c[c.length - 1]) c.pop(); if (c.length) S.previews = c; else delete S.previews; }
  function putPreview(k, f) {
    const c = (S.previews || []).slice(), old = c[k];
    while (c.length < k) c.push(null);
    c[k] = f; setPreviews(c); takeFromTray(f);
    if (sel === f) sel = null;
    if (old && !refsOf(S).has(old)) S.tray.unshift(old);
    changed();
  }
  // a tray photo onto filler k: the warning first (D-022), as onto a post; the one it replaces goes back to the tray
  async function setPreview(k, f) {
    if (!S || k >= fillersOf() || !M.files[f] || previewAt(k) === f) return;
    const B = S, r = await repetidas([{ name: M.files[f].name, size: M.files[f].size }], {});
    if (r && r.length && S === B && k < fillersOf() && M.files[f]) putPreview(k, f);
  }
  function delPreview(k) {             // the filler stays, black again
    const f = previewAt(k); if (!f) return;
    const B = S, c = S.previews.slice(); c[k] = null; setPreviews(c);
    const back = !refsOf(S).has(f); if (back) S.tray.unshift(f);
    changed();
    toast(back ? 'La foto vuelve a la bandeja.' : 'Portada quitada del hueco.', { action: 'Deshacer', ms: UNDO_MS, onAction: () => {
      if (S !== B || k >= fillersOf() || previewAt(k) || !M.files[f]) { toast('No se puede deshacer: el hueco ya ha cambiado.'); return; }
      putPreview(k, f);
    } });
  }
  function delFiller(k) {              // × on a filler: its photo first, the filler itself once it is empty
    if (previewAt(k)) return delPreview(k);
    if (S.previews) { const c = S.previews.slice(); c.splice(k, 1); setPreviews(c); }
    setFillers(fillersOf() - 1);
  }
  // «Cambiar portada» (post view) and a new photo on a designed reel: a tray photo becomes the cover; the old one goes back
  // to the tray unless something else uses it; the texts stay
  function changeCover(slotId, fid) {
    const s = S && S.slots.find(x => x.id === slotId); if (!s || !M.files[fid] || sinPortada(s)) return;
    const other = S.slots.find(x => x !== s && x.photos.includes(fid)); if (other) other.photos = other.photos.filter(x => x !== fid);
    takeFromTray(fid); if (sel === fid) sel = null;
    const old = setCoverPhoto(s, fid);
    centerCrop(fid, null);
    if (old && old !== fid && !(M.files[old] || {}).design && !refsOf(S).has(old)) S.tray.unshift(old);
    changed(); rerender(s);
  }
  function unassign(slotId, k, undoable) {
    const s = slot(slotId); if (!s) return;
    if (k != null && (k < 0 || k >= s.photos.length)) return;
    const back = k == null ? s.photos.slice() : [s.photos[k]];
    if (!back.length) return;
    const before = { photos: s.photos.slice(), fmt: s.fmt }, B = S;
    if (back.includes(sel)) sel = null;
    s.photos = s.photos.filter(x => !back.includes(x));
    const tb = back.filter(f => !dOut(s).includes(f));          // a design's rendered images stay with it, not in the tray
    S.tray.unshift(...tb);
    changed();
    const after = s.photos.slice();
    if (undoable) toast(tb.length > 1 ? `${tb.length} fotos vuelven a la bandeja.` : tb.length ? 'La foto vuelve a la bandeja.' : 'Imágenes del diseño quitadas de la casilla: siguen en «Diseñar».', { action: 'Deshacer', ms: UNDO_MS, onAction: () => {
      if (S !== B || !slot(slotId) || !same(s.photos, after) || !tb.every(id => S.tray.includes(id))) { toast('No se puede deshacer: la casilla ya ha cambiado.'); return; }
      S.tray = S.tray.filter(id => !tb.includes(id));
      S.slots.forEach(o => { if (o !== s) o.photos = o.photos.filter(id => !before.photos.includes(id)); });
      s.photos = before.photos.slice(); if (before.fmt) s.fmt = before.fmt;
      changed();
    } });
  }
  function setCover(slotId, k) {
    const s = slot(slotId); if (!s || k <= 0 || k >= s.photos.length) return;
    const [f] = s.photos.splice(k, 1); s.photos.unshift(f);
    changed();
  }
  let noteTimer = null;
  function setNote(slotId, text) {
    const s = slot(slotId); if (!s) return;
    s.note = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { noteTimer = null; save(); renderFeed(); renderBar(); capSync(slotId); }, 400);   // the header («cambiada») and the captions' state follow the contexto
  }
  function setMemo(slotId, text) {           // «Nota»: saved and shared like the contexto, never uploaded (empty = no field)
    const s = slot(slotId); if (!s) return;
    if (text) s.memo = text; else delete s.memo;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { noteTimer = null; save(); if (memoEdit !== slotId) renderFeed(); renderBar(); }, 400);   // the open in-cell editor already shows it
  }
  // ---------- captions (M3) ----------
  // s.caption = {tones, orig, text, pick, at, basis, old, sent}: orig = the 3 options as Claude wrote them, in the client's
  // tone order (never changed); text = Kevin's edit of each (starts as orig); pick = the chosen one (0-2, null = none yet);
  // at = when they were loaded; basis = {f: photos, n: contexto} they were written from; old = earlier batches a new one
  // replaced (each with `until`), kept for «analiza»; sent = the caption uploaded to Notion {text, pick, tone, at}.
  // Shared by a collab's boards like its photos; outside the ⌘Z history (like the upload record): undoing a photo leaves them.
  const capOf = s => s && s.caption && Array.isArray(s.caption.orig) && s.caption.orig.length === 3 ? s.caption : null;
  const capPhotos = s => designed(s) ? s.design.slides.filter(x => x.tipo !== 'final').map(x => x.src).filter(Boolean) : publishList(s);   // a design's photos, not its renders
  const capBatch = c => ({ tones: c.tones, orig: c.orig, text: c.text, pick: c.pick, at: c.at, basis: c.basis });
  function capLoad(s, options, basis) {     // a new batch is shown; the one it replaces (if any) goes to old
    const now = new Date().toISOString(), c = capOf(s), was = s.caption || {}, old = (was.old || []).slice();
    if (c) old.push({ ...capBatch(c), until: now });
    const t = options.map(o => String(o.text).replace(/\r\n?/g, '\n').trim());
    s.caption = { tones: options.map(o => String(o.tone).trim()), orig: t, text: t.slice(), pick: null, at: now, basis: basis || { f: capPhotos(s), n: noteOf(s) } };
    if (old.length) s.caption.old = old;
    if (was.sent) s.caption.sent = was.sent;
  }
  // states (M4): 'sin captions' | 'por elegir' | 'elegido' | 'subido' (Notion has the chosen one exactly as it is now).
  // Outdated: the photo or the contexto changed after they were written (they are never deleted nor redone on their own).
  const capFinal = s => { const c = capOf(s); return c && c.pick != null ? String(c.text[c.pick] ?? '').trim() : null; };
  function capStatus(s) {                    // its upload record: null (never uploaded) | 'ok' | 'chg' (edited or another one chosen since)
    const x = s && s.caption && s.caption.sent; if (!x) return null;
    const c = capOf(s); return c && c.pick === x.pick && capFinal(s) === x.text ? 'ok' : 'chg';
  }
  const capState = s => { const c = capOf(s); return !c ? 'sin captions' : c.pick == null ? 'por elegir' : capStatus(s) === 'ok' ? 'subido' : 'elegido'; };
  function capOutdated(s) {                  // what changed since they were written: [] | ['foto'] | ['contexto'] | both
    const c = capOf(s), b = c && c.basis; if (!b) return [];
    const set = a => [...a].sort();          // which photos, not their order: reordering a carousel doesn't outdate them
    return [!same(set(b.f || []), set(capPhotos(s))) && 'foto', (b.n || '') !== noteOf(s) && 'contexto'].filter(Boolean);
  }
  // two copies of a post's captions (a collab's boards) as one, never losing a batch: a batch (known by its `at`) that both
  // have is taken from b (the newest copy of the post); the newest batch loaded is the one shown and every other one goes
  // to old (a current one replaced this way, with `until` = when the newer one was loaded); the latest upload record wins
  function capMerge(a, b) {
    if (!a || !b) return a || b ? JSON.parse(JSON.stringify(a || b)) : undefined;
    const all = c => [...(Array.isArray(c.orig) ? [{ ...capBatch(c), cur: true }] : []), ...(c.old || []).map(x => ({ ...x }))];
    const by = new Map(); [...all(a), ...all(b)].forEach(x => by.set(x.at, x));
    // shown: the newest of the two current batches, even if the other copy already has it among the earlier ones
    const curAt = [a, b].filter(c => Array.isArray(c.orig)).map(c => String(c.at)).sort().pop();
    const cur = curAt != null ? by.get(curAt) || null : null;
    const out = cur ? capBatch(cur) : {};
    const old = [...by.values()].filter(x => x !== cur).map(({ cur: was, ...x }) => (was && !x.until ? { ...x, until: cur ? cur.at : null } : x))
      .sort((x, y) => String(x.at).localeCompare(String(y.at)));
    if (old.length) out.old = old;
    const sent = a.sent && b.sent ? (String(a.sent.at) > String(b.sent.at) ? a.sent : b.sent) : a.sent || b.sent;
    if (sent) out.sent = sent;
    return JSON.parse(JSON.stringify(out));
  }
  function setCapText(slotId, k, text) {     // Kevin's edit of one option (its original is never touched)
    const s = S && S.slots.find(x => x.id === slotId), c = capOf(s); if (!c || !(k >= 0 && k < 3)) return;
    c.text[k] = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { noteTimer = null; save(); renderFeed(); renderBar(); capSync(slotId); }, 400);
  }
  // «Volver al original»: the option as Claude wrote it (shown only once it has been edited); the edit can come back for a
  // few seconds with «Deshacer»
  function capRevert(slotId, k) {
    const s = S && S.slots.find(x => x.id === slotId), c = capOf(s); if (!c || !(k >= 0 && k < 3) || c.text[k] === c.orig[k]) return;
    const was = c.text[k], B = S, at = c.at;
    clearTimeout(noteTimer); noteTimer = null;
    const put = text => {                     // the open box shows it at once (even if it has the focus) and keeps the focus
      const d = root && root.querySelector('.detail'), t = d && !d.hidden && d.dataset.slot === slotId && d.querySelector(`textarea.capt[data-k="${k}"]`);
      if (t) { t.value = text; fitPit(t); t.focus({ preventScroll: true }); }
    };
    c.text[k] = c.orig[k]; put(c.orig[k]);
    save(); renderFeed(); renderBar(); capSync(slotId);
    toast(`Caption ${k + 1} vuelve al original.`, { action: 'Deshacer', ms: UNDO_MS, onAction: () => {
      if (S !== B) { toast('No se puede deshacer: has cambiado de cliente o de mes.'); return; }
      const c2 = capOf(S.slots.find(x => x.id === slotId));
      if (!c2 || c2.at !== at || c2.text[k] !== c2.orig[k]) { toast('No se puede deshacer: el caption ya ha cambiado.'); return; }
      c2.text[k] = was; put(was); save(); renderFeed(); renderBar(); capSync(slotId);
    } });
  }
  function setCapPick(slotId, k) {           // the chosen option: one at a time
    const s = S && S.slots.find(x => x.id === slotId), c = capOf(s); if (!c || !(k >= 0 && k < 3) || c.pick === k) return;
    c.pick = k;
    save(); renderFeed(); renderBar(); capSync(slotId);
  }
  // a click on the option already chosen unchooses it (back to «por elegir»; an uploaded one stays in Notion as it is)
  function unsetCapPick(slotId, k) {
    const s = S && S.slots.find(x => x.id === slotId), c = capOf(s); if (!c || c.pick == null || c.pick !== k) return;
    c.pick = null;
    save(); renderFeed(); renderBar(); capSync(slotId);
  }
  // the open post view of a publication of this month (not a dialog, not a September post): photos dropped on it are added to it
  function postDrop(e) {
    const d = root && root.querySelector('.detail'); if (!d || d.hidden || d.dataset.dlg || d.dataset.prev || !d.dataset.slot) return null;
    const card = e.target.closest && e.target.closest('.detail .card.post'); return card && S && S.slots.some(x => x.id === d.dataset.slot) ? card : null;
  }
  // tray photo viewer: a click on a tray thumbnail shows it big; ←/→ go through the tray
  function openTrayView(fid) {
    if (!S || !M.files[fid]) return;
    const list = bandejaVista().map(x => x.f), k = list.indexOf(fid); if (k < 0) return;
    const f = M.files[fid], n = list.length;
    showDialog('trayview', `<button class="x" data-act="close" aria-label="Cerrar">×</button>
      <div class="tvwrap"><img class="tvimg" src="${f.thumbUrl}" alt="${esc(f.name)}">${n > 1 ? `<button class="nav prev" data-act="tvnav" data-d="-1" aria-label="Foto anterior" ${k === 0 ? 'hidden' : ''}>‹</button><button class="nav next" data-act="tvnav" data-d="1" aria-label="Foto siguiente" ${k === n - 1 ? 'hidden' : ''}>›</button>` : ''}</div>
      <div class="tvbar"><span class="tvname"><b>${esc(f.name)}</b> · ${f.w}×${f.h}${n > 1 ? ` · ${k + 1} de ${n}` : ''}</span><button type="button" class="btn2" data-act="tvsel">Colocar en una casilla</button></div>`);
    root.querySelector('.detail').dataset.file = fid;
  }
  function trayNav(dir) {
    const d = root.querySelector('.detail'), list = S ? bandejaVista().map(x => x.f) : [], k = list.indexOf(d.dataset.file);
    if (k >= 0 && list[k + dir]) openTrayView(list[k + dir]);
  }
  let pendingAdd = null;
  function askAddMode(slotId, ids) {
    const s = S && S.slots.find(x => x.id === slotId); ids = (ids || []).filter(id => M.files[id]);
    if (!s || !ids.length) return;
    if (!s.photos.length || !isMulti(s.type)) { if (isMulti(s.type)) ids.forEach(id => place(slotId, id, true)); else place(slotId, ids[0], true); changed(); return; }
    pendingAdd = { key: S.key, slotId, ids };
    const n = ids.length;
    showDialog('addmode', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>${esc(shortLabel(s.name, s.type))} ya tiene foto</h3><p>¿Qué hago con ${n > 1 ? `las ${n} nuevas` : 'la nueva'}?</p>
      <div class="amode"><button type="button" class="btn2" data-act="addmode" data-m="replace"><kbd>1</kbd><b>Sustituir</b></button>
      <button type="button" class="btn2" data-act="addmode" data-m="add"><kbd>2</kbd><b>Añadir</b></button></div>`);
  }
  function doAddMode(m) {
    const P = pendingAdd; pendingAdd = null; closeDetail();
    if (!P || !S || S.key !== P.key) return;
    const s = S.slots.find(x => x.id === P.slotId), ids = P.ids.filter(id => M.files[id]); if (!s || !ids.length) return;
    if (m !== 'add' && designed(s) && sinPortada(s)) return;
    if (isCarousel(s.type) && s.libre && !s.design) {   // drawn in the free editor: its texts stay and the photos go to its holes (libre.js)
      if (M.libre && M.libre.casilla) M.libre.casilla(s.id, ids, m);
      else toast('El editor no está cargado: recarga la página para poner fotos en este carrusel.', { ms: 6000 });
      return;
    }
    if (m === 'add') { ids.forEach(id => place(P.slotId, id, true)); changed(); return; }
    ids.forEach(id => { const o = S.slots.find(x => x !== s && x.photos.includes(id)); if (o) o.photos = o.photos.filter(x => x !== id); takeFromTray(id); if (sel === id) sel = null; });
    if (designed(s) && isCarousel(s.type)) {   // a designed carousel: the cover slide's photo (texts stay), never a new slide
      const old = setCoverPhoto(s, ids[0]); centerCrop(ids[0], null);
      if (old && old !== ids[0] && !(M.files[old] || {}).design && !refsOf(S).has(old)) S.tray.unshift(old);
      ids.slice(1).forEach(id => { if (!s.photos.includes(id)) s.photos.push(id); });
      changed(); rerender(s); return;
    }
    const old = s.photos[0], rest = s.photos.slice(1).filter(x => !ids.includes(x));
    s.photos = [ids[0], ...rest, ...ids.slice(1)];
    if (old && !ids.includes(old) && !dOut(s).includes(old)) S.tray.unshift(old);
    changed();
  }
  function moveMemo(fromId, toId) {
    const A = S && S.slots.find(x => x.id === fromId), B = S && S.slots.find(x => x.id === toId);
    if (!A || !B || A === B || !memoOf(A)) return;
    const ma = A.memo, mb = memoOf(B) ? B.memo : '';
    B.memo = ma; if (mb) A.memo = mb; else delete A.memo;
    changed();
  }
  function move(slotId, k, dir) {
    const s = slot(slotId), j = k + dir;
    if (!s || j < 0 || j >= s.photos.length) return;
    [s.photos[k], s.photos[j]] = [s.photos[j], s.photos[k]];
    changed();
  }
  function movePhoto(slotId, k, j) {         // a photo dragged in the post view's strip: from place k to place j
    const s = slot(slotId); if (!s || k === j || !(k >= 0 && j >= 0 && k < s.photos.length && j < s.photos.length)) return;
    const [f] = s.photos.splice(k, 1); s.photos.splice(j, 0, f);
    changed(); openDetail(slotId, j);
  }
  // Removing from the tray is undoable for a few seconds; only then is the photo deleted (if no board uses it).
  function removeFile(fileId) {
    if (!S || !S.tray.includes(fileId)) return;
    const B = S, name = (M.files[fileId] || {}).name || 'La foto';
    takeFromTray(fileId);
    if (sel === fileId) sel = null;
    changed();
    const t = setTimeout(() => deleteIfUnused(fileId), UNDO_MS);
    toast(`«${name}» quitada de la mesa.`, { action: 'Deshacer', ms: UNDO_MS, onAction: () => {
      clearTimeout(t);
      if (S === B && !refsOf(S).has(fileId) && M.files[fileId]) { S.tray.unshift(fileId); changed(); }
      else deleteIfUnused(fileId);
    } });
  }
  async function deleteIfUnused(fileId) {
    if (String(fileId).startsWith('kit-') || String(fileId).startsWith('perfil-')) return;   // a client's fixed design photo (diseno.js) and profile photo stay
    if (S && refsTodo(S).has(fileId)) return;
    if (histRefs().has(fileId)) { delList(l => l.includes(fileId) ? l : [...l, fileId]); return; }   // ⌘Z can still bring it back
    const boards = await idbAll('boards');
    if (boards.some(b => (!S || b.key !== S.key) && refsTodo(b).has(fileId))) return;
    if ((await trayRefs()).has(fileId)) return;   // in a client's tray (D-041)
    await idbDel('files', fileId);
    if (M.files[fileId]) URL.revokeObjectURL(M.files[fileId].thumbUrl);
    if (M.bigUrls && M.bigUrls[fileId]) { URL.revokeObjectURL(M.bigUrls[fileId]); delete M.bigUrls[fileId]; }
    delete M.files[fileId]; delete M.blobs[fileId]; delete M.thumbBlobs[fileId];
  }
  function changed() { normalize(); save(); render(); }

  // ---------- undo / redo (⌘Z / ⇧⌘Z) ----------
  // History of the open board's editable state: photos (publications, tray, previous month), crops, formats, contexto,
  // nota, dates and states. Every save compares it with the last state and a change becomes one step; typing in one field or
  // reframing one photo in a burst (< 2 s between saves) is one step. New photos only added to the tray are not a step.
  // Restoring never loses a photo: one that is in the board now and not in the restored state goes to the tray.
  const HMAX = 60, HMERGE = 2000;
  let H = { b: null, cur: null, curJ: '', undo: [], redo: [], tag: null, t: 0 };
  function editState(B) {
    return {
      slots: B.slots.map(s => { const o = { id: s.id, type: s.type, photos: s.photos.slice(), note: s.note ?? '', date: s.date }; if (s.memo) o.memo = s.memo; if (s.fmt) o.fmt = s.fmt; if (s.design) o.design = JSON.parse(JSON.stringify(s.design)); if (s.libre) o.libre = JSON.parse(JSON.stringify(s.libre)); if (s.estado) o.estado = { ...s.estado }; if (s.guias) o.guias = JSON.parse(JSON.stringify(s.guias)); return o; }),
      tray: B.tray.slice(),
      crops: JSON.parse(JSON.stringify(B.crops || {})),
      prev: (B.prev || []).map(p => ({ id: p.id, own: !!p.own, photos: (p.photos || []).slice(), alt: p.alt || null, hidden: !!p.hidden, fmt: p.fmt || null })),
      ...(previewsOf(B).length ? { previews: B.previews.slice(), fillers: B.fillers } : {}),   // the fillers' previews (D-049), with their count
      ...(hsDe(B).length ? { historias: JSON.parse(JSON.stringify(B.historias)) } : {})   // the stories, whole (D-054)
    };
  }
  const stRefs = st => new Set([...st.tray, ...st.slots.flatMap(slotRefs), ...st.prev.filter(p => p.own).flatMap(p => p.photos), ...previewsOf(st), ...hRefs(st)]);
  function histRefs() { const r = new Set(); if (H.b && H.b === S) [...H.undo, ...H.redo].forEach(st => stRefs(st).forEach(f => r.add(f))); return r; }
  function histReset() { H = { b: S, cur: S ? editState(S) : null, curJ: '', undo: [], redo: [], tag: null, t: 0 }; if (H.cur) H.curJ = JSON.stringify(H.cur); }
  // what kind of change a→b is, to merge a burst: 'note:<id>' / 'memo:<id>' (one field of one post), 'crop:<file>' (one photo)
  function stepTag(a, b) {
    const J = JSON.stringify;
    if (J(a.tray) !== J(b.tray) || J(a.prev) !== J(b.prev) || a.slots.length !== b.slots.length || J(a.historias) !== J(b.historias)) return null;
    const ds = [];
    for (let i = 0; i < a.slots.length; i++) { if (a.slots[i].id !== b.slots[i].id) return null; if (J(a.slots[i]) !== J(b.slots[i])) ds.push(i); }
    const cs = [...new Set([...Object.keys(a.crops), ...Object.keys(b.crops)])].filter(f => J(a.crops[f]) !== J(b.crops[f]));
    if (!ds.length && cs.length === 1) return 'crop:' + cs[0];
    if (ds.length !== 1 || cs.length) return null;
    const x = a.slots[ds[0]], y = b.slots[ds[0]], ks = ['photos', 'note', 'memo', 'date', 'fmt', 'design'].filter(k => J(x[k]) !== J(y[k]));
    return ks.length === 1 && (ks[0] === 'note' || ks[0] === 'memo' || ks[0] === 'design') ? ks[0] + ':' + x.id : null;
  }
  function track(B) {
    if (!B || H.b !== B || !H.cur) return;
    const st = editState(B), j = JSON.stringify(st);
    if (j === H.curJ) return;
    const was = stRefs(H.cur);
    if (st.tray.some(f => !was.has(f)) && JSON.stringify({ ...st, tray: st.tray.filter(f => was.has(f)) }) === H.curJ) { H.cur = st; H.curJ = j; H.tag = null; return; }   // only new photos in the tray
    const now = Date.now(), tag = stepTag(H.cur, st);
    if (!(tag && tag === H.tag && now - H.t < HMERGE)) {
      const dropped = H.redo.length || H.undo.length >= HMAX;
      H.undo.push(H.cur); if (H.undo.length > HMAX) { H.undo.shift(); H.drop = (H.drop || 0) + 1; } H.redo = [];
      if (dropped) delSweep();
    }
    H.cur = st; H.curJ = j; H.tag = tag; H.t = now;
  }
  // the designer (B6): an editing session becomes one step of the mesa's ⌘Z — from the state before it opened to the one
  // it leaves (none if it leaves everything as it was)
  function histMarca() { if (!S || H.b !== S || !H.cur) return null; track(S); return { b: S, n: H.undo.length, drop: H.drop || 0, st: H.cur, j: H.curJ, redo: H.redo.slice() }; }
  function histJuntar(m) {
    if (!m || !S || H.b !== m.b || m.b !== S) return;
    track(S);
    const k = m.n - ((H.drop || 0) - m.drop);            // steps dropped from the front meanwhile (more than HMAX)
    if (H.undo.length < k) return;                        // the history started again meanwhile
    const was = stRefs(m.st), igual = JSON.stringify({ ...H.cur, tray: H.cur.tray.filter(f => was.has(f)) }) === m.j;   // nothing, or only photos added to the tray
    H.undo.splice(Math.max(0, k));
    if (igual) H.redo = m.redo; else { H.undo.push(m.st); H.redo = []; }
    H.tag = null;
    delSweep();
  }
  // an automatic re-render (diseno.js) joins the step of the change that caused it: that post's photos and design are
  // brought up to date in the current state, so ⌘Z undoes the change and its re-render together
  function histAmend(slotId) {
    if (!S || H.b !== S || !H.cur) return;
    const s = S.slots.find(x => x.id === slotId), o = H.cur.slots.find(x => x.id === slotId); if (!s || !o) return;
    o.photos = s.photos.slice(); if (s.design) o.design = JSON.parse(JSON.stringify(s.design)); else delete o.design;
    if (s.libre) o.libre = JSON.parse(JSON.stringify(s.libre)); else delete o.libre;
    if (s.guias) o.guias = JSON.parse(JSON.stringify(s.guias)); else delete o.guias;
    if (s.fmt) o.fmt = s.fmt; else delete o.fmt;          // (key order as editState writes it: type, photos, note, date, memo, fmt, design, libre, estado, guias)
    const { id, type, photos, note, date, memo, fmt, design, libre, estado, guias } = o; H.cur.slots[H.cur.slots.indexOf(o)] = { id, type, photos, note, date, ...(memo ? { memo } : {}), ...(fmt ? { fmt } : {}), ...(design ? { design } : {}), ...(libre ? { libre } : {}), ...(estado ? { estado } : {}), ...(guias ? { guias } : {}) };
    H.curJ = JSON.stringify(H.cur);
  }
  function applyState(st) {
    const had = refsOf(S), has = f => !!M.files[f];
    const by = Object.fromEntries(st.slots.map(s => [s.id, s])), pby = Object.fromEntries(st.prev.map(p => [p.id, p]));
    S.slots.forEach(s => {
      const o = by[s.id]; if (!o) return;
      s.photos = o.photos.filter(has); s.note = o.note; s.date = o.date; if (o.type) s.type = o.type;
      if (o.memo) s.memo = o.memo; else delete s.memo;
      if (o.fmt) s.fmt = o.fmt; else delete s.fmt;
      if (o.design) s.design = JSON.parse(JSON.stringify(o.design)); else delete s.design;
      if (o.libre) s.libre = JSON.parse(JSON.stringify(o.libre)); else delete s.libre;
      if (o.estado) s.estado = { ...o.estado }; else delete s.estado;
      if (o.guias) s.guias = JSON.parse(JSON.stringify(o.guias)); else delete s.guias;
    });
    (S.prev || []).forEach(p => {
      const o = pby[p.id]; if (!o) return;
      p.own = o.own; p.photos = o.photos.filter(has); p.alt = o.alt; p.hidden = o.hidden;
      if (o.fmt) p.fmt = o.fmt; else delete p.fmt;
    });
    S.tray = st.tray.filter(has);
    S.crops = JSON.parse(JSON.stringify(st.crops));
    if (st.previews) { S.previews = st.previews.map(f => (f && has(f) ? f : null)); S.fillers = st.fillers; } else delete S.previews;
    if (st.historias) S.historias = JSON.parse(JSON.stringify(st.historias)); else delete S.historias;
    const now = refsOf(S), lost = [...had].filter(f => !now.has(f) && has(f)), isD = f => !!M.files[f].design;
    if (lost.some(f => !isD(f))) S.tray.unshift(...lost.filter(f => !isD(f)));
    if (lost.some(isD)) delList(l => [...new Set([...l, ...lost.filter(isD)])]);   // rendered images are never photos: deleted once no step needs them
    const ord = Object.fromEntries(st.slots.map((s, i) => [s.id, i]));
    S.slots.sort((a, b) => (ord[a.id] ?? 1e9) - (ord[b.id] ?? 1e9));
    renumber();                                    // names follow the restored dates
    normalize();
    if (sel && !S.tray.includes(sel)) sel = null;
  }
  function histStep(back) {
    if (!S || locked || H.b !== S || !H.cur) return;
    track(S);                                      // a change not saved yet is a step too
    const from = back ? H.undo : H.redo, to = back ? H.redo : H.undo;
    if (!from.length) { toast(back ? 'Nada que deshacer.' : 'Nada que rehacer.', { ms: 1800 }); return; }
    to.push(H.cur);
    applyState(from.pop());
    H.cur = editState(S); H.curJ = JSON.stringify(H.cur); H.tag = null;
    changed();
    refreshDetail();
  }
  const undo = () => histStep(true), redo = () => histStep(false);
  // rendered images (design:true) nothing refers to any more — replaced on another Mac and imported back, or written by an
  // «Aplicar» cut short by a reload — are deleted: once per session (or after an import), never while an «Aplicar» runs
  let swept = false;
  async function sweepDesigns(force) {
    const busy = () => (M.diseno && M.diseno.aplicando && M.diseno.aplicando()) || (M.libre && M.libre.aplicando && M.libre.aplicando());
    if ((swept && !force) || busy()) return 0;
    swept = true;
    const ids = [];
    await tx('files', 'readonly', st => { const r = st.openCursor(); r.onsuccess = () => { const c = r.result; if (!c) return; if (c.value && c.value.design) ids.push(String(c.key)); c.continue(); }; });
    if (!ids.length) return 0;
    const refs = new Set([...((await idbAll('boards')) || []).map(b => newest(b.key, b)).flatMap(b => [...refsTodo(b)]), ...(S ? refsTodo(S) : []), ...histRefs()]);
    let n = 0;
    for (const id of ids) if (!refs.has(id) && !busy()) {
      await idbDel('files', id); n++;
      if (M.files[id]) URL.revokeObjectURL(M.files[id].thumbUrl);
      delete M.files[id]; delete M.blobs[id]; delete M.thumbBlobs[id];
    }
    return n;
  }
  // a photo removed from the mesa is deleted only when no step of the history can bring it back (list kept across reloads)
  function delList(fn) { let l = []; try { l = JSON.parse(lsGet('mesa-del') || '[]'); } catch (e) { /* */ } if (!fn) return l; l = fn(l); lsSet('mesa-del', JSON.stringify(l)); return l; }
  async function delSweep() {
    const l = delList(); if (!l.length) return;
    const keep = histRefs(), go = l.filter(id => !keep.has(id));
    if (!go.length) return;
    delList(x => x.filter(id => !go.includes(id)));
    for (const id of go) { try { await deleteIfUnused(id); } catch (e) { /* */ } }
  }

  // ---------- previous month (under the line) ----------
  // From the mesa's own board of that month when it exists; otherwise the posts Claude loaded from Notion.
  // S.prev = the previous month as editable items: {id, name, type, date, src:'mesa'|'notion', base (photo of the
  // previous-month board), own (edited here), photos:[fileId] when own, alt (id whose Notion photo it shows), hidden}.
  const pastPosts = () => S.past.filter(p => !S.slots.some(s => s.id === p.id));   // a post of this board shows once
  function buildPrev(oldPrev) {
    const oldBy = Object.fromEntries((oldPrev || []).map(p => [p.id, p]));
    const src = PB && PB.slots.length
      ? PB.slots.map(s => ({ id: s.id, name: s.name, type: s.type, date: s.date, src: 'mesa', base: publishList(s)[0] || null, fmt: s.fmt || null }))
      : pastPosts().map(p => ({ id: p.id, name: p.name, type: p.type, date: p.date, src: 'notion', base: null }));
    S.prev = src.map(p => {
      const o = oldBy[p.id] || {};
      const it = { ...p, own: !!o.own, photos: o.own ? (o.photos || []).filter(f => M.files[f]) : [], alt: o.own ? (o.alt || null) : null, hidden: !!o.hidden };
      const fmt = (o.own && o.fmt) || p.fmt; if (fmt) it.fmt = fmt; else delete it.fmt;
      return it;
    }).sort((a, b) => ts(b.date) - ts(a.date));
  }
  // what a previous-month cell shows: {f: fileId, B: board whose crop applies} | {t: id of a Notion photo} | null
  function prevImg(it) {
    if (it.own) return it.photos[0] ? { f: it.photos[0], B: S } : it.alt ? { t: it.alt } : null;
    if (it.base && M.files[it.base]) return { f: it.base, B: PB };
    return M.pastThumbs[it.id] || M.pastPending[it.id] ? { t: it.id } : null;
  }
  function setPrevImg(it, tok) {
    it.own = true; it.photos = tok && tok.f ? [tok.f] : []; it.alt = tok && tok.t ? tok.t : null;
    if (tok && tok.f && tok.B === PB && PB && PB.crops && PB.crops[tok.f] && !S.crops[tok.f]) S.crops[tok.f] = { ...PB.crops[tok.f] };
  }
  function pastList(withHidden) {
    if (!S || !S.prev) return [];
    return S.prev.filter(it => withHidden || !it.hidden).map(it => { const im = prevImg(it); return { id: it.id, nid: it.id, name: it.name, type: it.type, date: it.date, hidden: it.hidden, own: it.own, fid: im && im.f ? im.f : null, B: im && im.B, thumb: im && im.t ? im.t : null, item: it }; });
  }
  // lock: the previous month comes locked; «solo esta vez» opens it for one action (or while its post is open),
  // «hasta nuevo orden» keeps it open for this month's board until it is locked again.
  let prevOnce = false, pendingUnlock = null;
  const prevLocked = () => !(S && S.prevUnlocked) && !prevOnce;
  function withPrev(fn, kind) {
    if (!prevLocked()) { fn(); if (kind === 'edit') endOnce(); return; }
    pendingUnlock = { fn, kind };
    const pm = S ? rangeLabel(prevMonth(S.month), 1, false, curCd()).toLowerCase() : 'el mes anterior';
    showDialog('unlock', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>${esc(cap(pm))} está bloqueado</h3><p>Son publicaciones ya publicadas. Desbloquéalo para cambiar fotos, moverlas u ocultar las que se hayan borrado del perfil.</p><div class="form"><div class="row" style="flex-wrap:wrap"><button type="button" class="btn2" data-act="close">Cancelar</button><button type="button" class="btn2" data-act="unlock-once">Solo esta vez</button><button type="button" class="btn" data-act="unlock-always">Hasta nuevo orden</button></div></div>`);
  }
  function endOnce() { if (prevOnce && !(root && root.querySelector('.detail').dataset.prev)) { prevOnce = false; renderFeed(); } }
  function prevSetFromTray(id, fid) {
    const it = prevItem(id); if (!it || !M.files[fid]) return;
    const old = prevImg(it);
    if (old && old.f && it.own && old.f !== fid && old.f !== it.base && !S.tray.includes(old.f)) S.tray.unshift(old.f);
    takeFromTray(fid); if (sel === fid) sel = null;
    setPrevImg(it, { f: fid, B: S }); it.hidden = false;
    changed();
  }
  function prevToTray(id) {
    const it = prevItem(id); if (!it) return;
    const old = prevImg(it);
    if (!old || !old.f) { toast('Esta foto viene de Notion. Para quitarla del feed, pulsa la casilla y «Ocultar del feed».'); return; }
    const before = { own: it.own, photos: it.photos.slice(), alt: it.alt }, B = S;
    setPrevImg(it, null); S.tray.unshift(old.f);
    changed();
    toast('La foto vuelve a la bandeja.', { action: 'Deshacer', ms: UNDO_MS, onAction: () => {
      if (S !== B || !S.tray.includes(old.f) || it.own !== true || it.photos.length || it.alt) { toast('No se puede deshacer: ya ha cambiado.'); return; }
      takeFromTray(old.f); Object.assign(it, before); changed();
    } });
  }
  function prevSwap(a, b) {
    const A = prevItem(a), B2 = prevItem(b); if (!A || !B2 || A === B2) return;
    const ta = prevImg(A), tb = prevImg(B2);
    setPrevImg(A, tb); setPrevImg(B2, ta);
    changed();
  }
  function prevRestore(id) {
    const it = prevItem(id); if (!it) return;
    const f0 = it.own && it.photos[0];
    if (f0 && f0 !== it.base && !S.tray.includes(f0) && !refsOf({ slots: S.slots, prev: S.prev.filter(p => p !== it) }).has(f0)) S.tray.unshift(f0);
    it.own = false; it.photos = []; it.alt = null; it.hidden = false;
    if (it.src === 'mesa' && PB) { const ps = PB.slots.find(x => x.id === it.id); if (ps && ps.fmt) it.fmt = ps.fmt; else delete it.fmt; } else delete it.fmt;
    changed();
  }
  function touchPrev(s) { if (isPrev(s) && !s.own && s.base && M.files[s.base]) setPrevImg(s, { f: s.base, B: PB }); }

  // ---------- rendering ----------
  const CSS = `
#mesa{--bg:#fafafa;--panel:#fff;--line:#dbdbdb;--line2:#efefef;--ink:#262626;--mute:#737373;--faint:#a8a8a8;--acc:#0095f6;--acc2:#1877f2;--ok:#1a7f37;--chg:#c2410c;--red:#c0392b;position:fixed;inset:0;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font:14px/1.4 ${FONT};-webkit-font-smoothing:antialiased}
#mesa *{box-sizing:border-box}
#mesa button{font:inherit;color:inherit;cursor:pointer}
#mesa :focus-visible{outline:2px solid var(--acc);outline-offset:2px}
#mesa .appbar{flex:none;display:flex;align-items:stretch;gap:6px;height:46px;padding:0 12px;background:var(--panel);border-bottom:1px solid var(--line)}
#mesa .brand{flex:none;display:flex;align-items:center;gap:7px;font-weight:700;font-size:13.5px;padding-right:12px;border-right:1px solid var(--line2);white-space:nowrap}
#mesa .brand svg{width:18px;height:18px}
#mesa .tabs{flex:1;min-width:0;display:flex;align-items:stretch;overflow-x:auto;scrollbar-width:none}
#mesa .tabs::-webkit-scrollbar{display:none}
#mesa .tab{flex:none;border:0;background:none;padding:0 13px;font-size:13.5px;color:var(--mute);white-space:nowrap;border-bottom:2px solid transparent}
#mesa .tab:hover{color:var(--ink)}
#mesa .tab.on{color:var(--ink);font-weight:600;border-bottom-color:var(--ink)}
#mesa .tab.add{flex:none;color:var(--acc);font-weight:600;border:0;background:none;padding:0 12px;font-size:13.5px;white-space:nowrap}
#mesa .tabs .tedit{align-self:stretch;height:auto;width:28px;border-radius:0;border-bottom:2px solid var(--ink);font-size:15px;line-height:1}
#mesa .tab.on.hasedit{padding-right:2px}
#mesa .appbar .xfer{align-self:center}
#mesa .save{flex:none;align-self:center;font-size:12px;color:var(--mute);white-space:nowrap}#mesa .save.err{color:var(--red)}
#mesa .bar{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;padding:12px 14px;background:var(--panel);border-bottom:1px solid var(--line)}
#mesa .bar:empty{display:none}
#mesa .ident{display:flex;align-items:center;gap:10px;min-width:0}
#mesa .av{flex:none;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;background:var(--ink);box-shadow:0 0 0 2px var(--panel),0 0 0 3px var(--line)}
#mesa .who{min-width:0}#mesa .who b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#mesa .who span{display:block;font-size:12.5px;color:var(--mute)}
#mesa .ibtn{flex:none;border:0;background:none;width:30px;height:30px;border-radius:50%;color:var(--mute);font-size:17px;line-height:30px;padding:0}
#mesa .ibtn:hover{background:var(--line2);color:var(--ink)}
#mesa .mgrp,#mesa .months{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#mesa .mchip{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 12px;min-height:32px;font-size:12.5px;display:inline-flex;gap:6px;align-items:center}
#mesa .mchip i{font-style:normal;color:var(--mute);font-size:11.5px}
#mesa .mchip:hover{border-color:#bdbdbd}
#mesa .mchip.on{background:var(--ink);border-color:var(--ink);color:#fff}#mesa .mchip.on i{color:#cfcfcf}
#mesa .mchip.ghost{border-style:dashed;color:var(--mute)}
#mesa .spacer{flex:1}
#mesa .stats{display:flex;gap:4px 12px;font-size:12.5px;color:var(--mute);flex-wrap:wrap}#mesa .stats b{color:var(--ink);font-weight:600}#mesa .stats .c{color:var(--chg)}
#mesa .sw{display:flex;align-items:center;gap:8px;min-height:28px;font-size:12.5px;cursor:pointer;user-select:none;white-space:nowrap}
#mesa .sw input{appearance:none;-webkit-appearance:none;width:32px;height:18px;border-radius:999px;background:#c7c7c7;position:relative;cursor:pointer;margin:0;transition:background .15s}
#mesa .sw input::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s}
#mesa .sw input:checked{background:var(--ink)}#mesa .sw input:checked::after{transform:translateX(14px)}
#mesa .busy{flex:none;background:var(--acc);color:#fff;font-size:12.5px;padding:5px 14px}
#mesa .main{flex:1;min-height:0;display:flex}
#mesa .feed{flex:0 0 auto;width:min(480px,58vw);overflow-y:auto;background:#000;border-right:1px solid var(--line)}
#mesa .legend{position:sticky;top:0;z-index:4;display:flex;gap:4px 14px;flex-wrap:wrap;align-items:center;padding:8px 12px;background:rgba(255,255,255,.95);border-bottom:1px solid var(--line2);font-size:12px;color:var(--mute)}
#mesa .legend b{color:var(--ink);font-weight:600}
#mesa .legend .ln{display:inline-block;width:14px;height:3px;background:var(--ink);vertical-align:middle;margin-right:6px;border-radius:2px}
#mesa .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin:0 auto}
#mesa .cell{position:relative;aspect-ratio:3/4;overflow:hidden;background:#efefef;user-select:none}
#mesa .cell img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-user-drag:none}
#mesa .cell img.crop{position:absolute;max-width:none;object-fit:fill}
#mesa .cell.full{cursor:default}
#mesa .cell.empty{background:#f5f5f5;cursor:default}
#mesa .cell.empty::before{content:'';position:absolute;inset:6px;border:1.5px dashed #c9c9c9;border-radius:6px;pointer-events:none}
#mesa .cell.empty:hover{background:#eef6fe}#mesa .cell.empty:hover::before{border-color:#8cc8f5}
#mesa .cell.filler{background:#000}
#mesa .cell.filler .hx{position:absolute;top:6px;right:6px;width:28px;height:28px;border:0;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;font-size:16px;line-height:28px;padding:0;cursor:pointer}
#mesa .cell.filler .hx:hover{background:rgba(255,255,255,.3)}
#mesa .cell.filler.tapa{container-type:inline-size}
#mesa .cell.filler .hfoto{position:absolute;inset:0;box-sizing:border-box;padding:6cqw;background:#000}
#mesa .cell.filler .htag{position:absolute;left:50%;bottom:9cqw;transform:translateX(-50%);width:max-content;max-width:88cqw;text-align:center;background:#000;color:#fff;font-size:max(9px,5.2cqw);font-weight:600;line-height:1.2;padding:.35em .8em;border-radius:.95em;pointer-events:none}
#mesa .ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;padding:12px;color:var(--mute)}
#mesa .ph b{color:var(--ink);font-size:12.5px}#mesa .ph span{font-size:11px}
#mesa .pico svg{width:20px;height:20px;color:#8e8e8e}
#mesa .ico{position:absolute;top:7px;right:7px;width:19px;height:19px;color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55))}
#mesa .ico svg{width:100%;height:100%}#mesa .cell.empty .ico.pinned{color:#8e8e8e;filter:none;z-index:3}
#mesa .lab{position:absolute;left:0;right:0;bottom:0;padding:18px 7px 6px;background:linear-gradient(transparent,rgba(0,0,0,.66));color:#fff;font-size:10.5px;line-height:1.25;pointer-events:none}
#mesa .lab b{display:block;font-size:11.5px}
#mesa .tag{display:inline-block;margin-top:3px;font-size:10px;background:var(--ink);color:#fff;border-radius:4px;padding:1px 5px}
#mesa .lab .tag{background:rgba(255,255,255,.22)}
#mesa span.ltag{display:block;width:fit-content;max-width:100%;margin-top:3px;font-size:10px;font-weight:600;background:#0064d1;color:#fff;border-radius:4px;padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa.client .ltag{display:none}
#mesa .phead p.lk{margin-top:4px;color:var(--acc2);font-size:12px}
#mesa .badges{position:absolute;top:6px;left:6px;right:30px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;z-index:3;pointer-events:none}
#mesa .badges .mk{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
#mesa .badges .dot{pointer-events:auto;display:block;box-sizing:border-box;width:auto;height:17px;min-width:17px;max-width:17px;padding:0;border-radius:9px;overflow:hidden;white-space:nowrap;margin:0;font-size:10px;font-weight:600;line-height:17px;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:max-width .18s ease}
#mesa .badges .dot .dl{display:block;padding:0 7px;opacity:0;transition:opacity .1s ease}
#mesa .badges .dot:hover{max-width:240px;transition-delay:.5s}
#mesa .badges .dot:hover .dl{opacity:1;transition-delay:.55s}
#mesa .badges .dot.nb{background:#fff;color:var(--ink)}
#mesa .edot{display:inline-block;flex:none;width:7px;height:7px;border-radius:50%}
#mesa .e-empezar{background:#f3f1ef;box-shadow:inset 0 0 0 1.5px #a8a29e}#mesa .e-captions{background:#e3b341}#mesa .e-aprobar{background:#74b3e8}
#mesa .e-aprobado{background:#2f6fd0}#mesa .e-programado{background:#c9649f}#mesa .e-publicado{background:#3d3d3d}#mesa .e-cancelado{background:#fff;box-shadow:inset 0 0 0 1.5px #c4c4c4}
#mesa .pest{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}#mesa .esbtn{padding:4px 10px;font-size:12.5px;min-height:30px}#mesa .esold{font-size:11.5px;color:var(--chg)}
#mesa .badges .dot.ok{background:var(--ok);color:#fff}
#mesa .badges .dot.chg{background:var(--chg);color:#fff}
#mesa .badges .dot.hv{background:var(--red);color:#fff}
#mesa .badges .dot.ltag,#mesa .badges .dot.cb{background:#0064d1;color:#fff}
#mesa .pit{pointer-events:auto;display:flex;align-items:flex-start;gap:4px;width:max-content;max-width:17px;max-height:17px;overflow:hidden;margin:0 0 4px;border-radius:2px;background:#f8df74;color:#3d3300;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45));transition:max-width .18s ease,max-height .18s ease}
#mesa .pit svg{flex:none;display:block;width:17px;height:17px}
#mesa .pit{cursor:default}#mesa .pit.dragging{opacity:.35}
#mesa .pit.edit,#mesa .pit.edit:hover{width:100%;max-width:100%;max-height:none;transition:none;box-shadow:0 0 0 1.5px #fff}
#mesa .cell.empty>.pit.edit,#mesa .cell.empty>.pit.edit:hover{width:calc(100% - 12px);max-width:calc(100% - 12px)}
#mesa .pit .pitin{flex:1;min-width:0;display:block;box-sizing:border-box;margin:0;border:0;outline:0;resize:none;overflow-y:auto;background:transparent;color:inherit;font:500 10.5px/1.35 ${FONT};padding:2px 6px 3px 0;max-height:max(4.2em,calc(133cqw - 74px));cursor:text;user-select:text;-webkit-user-select:text}
#mesa.grabbing,#mesa.grabbing *{cursor:grabbing !important}
#mesa .pdghost{position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;opacity:.85;filter:drop-shadow(0 6px 14px rgba(0,0,0,.35));will-change:transform}
#mesa .pdghost>*{width:100% !important;height:100% !important;margin:0 !important;max-width:none !important;max-height:none !important}
#mesa .pdghost,#mesa .pdghost *{pointer-events:none !important}
#mesa .detail .card.post.over{outline:3px solid var(--acc);outline-offset:-3px}
#mesa .amode{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
#mesa .amode button{display:flex;gap:10px;align-items:center;text-align:left;padding:10px 12px;border-radius:10px}
#mesa .amode kbd{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid var(--line);border-bottom-width:2px;border-radius:6px;font:600 14px/1 ${FONT};background:var(--bg)}
#mesa .amode b{font-size:14px}
#mesa .amode button:hover{border-color:var(--acc)}
#mesa .detail[data-dlg="trayview"] .card.dlg{max-width:min(94vw,980px);width:auto;padding:12px 12px 10px}
#mesa .tvwrap{position:relative;display:flex;justify-content:center;background:#111;border-radius:8px;overflow:hidden;margin-top:30px}
#mesa .tvimg{display:block;max-width:100%;max-height:calc(100vh - 190px);object-fit:contain}
#mesa .tvbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:12.5px;color:var(--mute)}
#mesa .tvbar .tvname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#mesa .tvbar b{color:var(--ink)}
#mesa .pit .pt{min-width:0;padding:2px 6px 3px 0;font-size:10.5px;font-weight:500;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere;opacity:0;transition:opacity .1s ease}
#mesa .pit:hover{max-width:100%;max-height:8.6em;transition-delay:.5s}
#mesa .pit:hover .pt{opacity:1;transition-delay:.55s}
#mesa .cell.empty>.pit{position:absolute;left:6px;bottom:6px;z-index:3;margin:0;max-width:17px}
#mesa .cell.empty>.pit:hover{max-width:calc(100% - 12px)}
#mesa.client .pit{display:none}
#mesa .nb{width:21px;height:21px;border-radius:50%;background:#fff;color:var(--ink);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.35)}
#mesa .nb svg{width:13px;height:13px}
#mesa .st{font-size:10px;border-radius:4px;padding:1px 5px;color:#fff;white-space:nowrap}
#mesa .st.ok{background:var(--ok)}#mesa .st.chg{background:var(--chg)}
#mesa .mpill{font-size:9.5px;font-weight:600;background:rgba(38,38,38,.88);color:#fff;border-radius:999px;padding:1px 7px;line-height:17px}
#mesa .dchg{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--chg);box-shadow:0 0 0 1.5px #fff;margin:0 5px 1px 1px;vertical-align:middle}
#mesa .dchg.nm{background:none;box-shadow:inset 0 0 0 1.5px var(--chg),0 0 0 1.5px #fff}
#mesa .cnt{position:absolute;top:30px;right:7px;font-size:10px;color:#fff;background:rgba(0,0,0,.55);border-radius:4px;padding:0 4px}
#mesa .cnt.tr{top:7px}#mesa .cnt .cs{display:none}
#mesa .grid .cell{container-type:inline-size}
@container (max-width:150px){#mesa .cnt .cw{display:none}#mesa .cnt .cs{display:inline}}
#mesa .cell.past{cursor:default}
#mesa .bd{position:absolute;inset:0;pointer-events:none;z-index:2}
#mesa .pmonth{position:absolute;top:4px;left:4px;z-index:3;font-size:9.5px;font-weight:600;background:var(--acc);color:#fff;border-radius:999px;padding:1px 7px;opacity:.95;cursor:default}
#mesa .pmonth::after{content:'';position:absolute;inset:-7px -4px -9px}
#mesa .ptag2{position:absolute;top:28px;left:4px;z-index:3;font-size:9.5px;font-weight:600;background:rgba(38,38,38,.85);color:#fff;border-radius:4px;padding:1px 6px;pointer-events:none}
#mesa .ptag2.ed{background:rgba(0,149,246,.9)}
#mesa .cell.past.phidden img,#mesa .cell.past.phidden .ph{opacity:.35}
#mesa .lockbtn{border:1px solid var(--line);background:var(--panel);border-radius:999px;font-size:11.5px;padding:3px 9px;min-height:28px;color:var(--ink)}
#mesa .lockbtn.on{border-color:var(--acc);color:var(--acc)}
#mesa .memobtn{display:inline-flex;align-items:center;gap:5px}#mesa .memobtn svg{flex:none;width:13px;height:13px}
#mesa.memos .pit:not(.edit){max-width:100%;max-height:8.6em;transition-delay:0s}#mesa.memos .pit .pt{opacity:1;transition-delay:0s}#mesa.memos .cell.empty>.pit:not(.edit){max-width:calc(100% - 12px)}
#mesa .pthumb{max-width:100%;max-height:60vh;display:block;margin:0 auto;border-radius:4px}
#mesa .pvacts{display:flex;flex-direction:column;gap:8px;margin-top:4px}
#mesa .pvacts button{text-align:left}
#mesa .pdate{position:absolute;left:6px;bottom:5px;z-index:3;font-size:10px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7);pointer-events:none}
#mesa .cell.past.nophoto .ph b{color:#8e8e8e}
#mesa .cell.over{outline:3px solid var(--acc) !important;outline-offset:-3px !important}
#mesa .cell.over::after{content:'';position:absolute;inset:0;z-index:6;border:3px solid var(--acc);pointer-events:none}
#mesa .cell.dragging,#mesa .titem.dragging{opacity:.35}
#mesa.picking .cell:not(.past){cursor:copy}
#mesa .tray{flex:1;min-width:0;overflow-y:auto;background:var(--bg)}
#mesa .side{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}#mesa .side>.tray{flex:1 1 0;min-height:0}
#mesa.client .side:not(:has(>.cal:not([hidden]))){display:none}
#mesa .tray.over{background:#e8f3fe}
#mesa .trayhead{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;padding:10px 12px;background:inherit}
#mesa .trayhead b{font-size:14px}#mesa .trayhead span{color:var(--mute);font-size:12px}
#mesa .btn{border:0;border-radius:8px;background:var(--acc);color:#fff !important;font-weight:600;font-size:13px;padding:7px 12px;display:inline-flex;gap:6px;align-items:center}
#mesa .btn svg{width:15px;height:15px}
#mesa .btn:hover{background:var(--acc2)}
#mesa .trayhead .btn{margin-left:auto}
#mesa .trayhead .tcount{min-width:0}#mesa .trayhead .btn{white-space:nowrap}
#mesa .tfil{display:inline-flex;flex:none;border:1px solid var(--line);border-radius:999px;overflow:hidden;background:var(--panel)}
#mesa .tfil button{border:0;background:none;padding:2px 9px;font:inherit;font-size:12px;color:var(--mute);cursor:pointer}#mesa .tfil button.on{background:var(--ink);color:#fff}
#mesa .hs{position:absolute;bottom:22px;left:5px;width:14px;height:14px;border-radius:50%;border:2.5px solid #d6249f;background:rgba(0,0,0,.35);box-sizing:border-box;pointer-events:none}
#mesa .titem.uso::after{content:'✓';position:absolute;top:5px;right:5px;width:18px;height:18px;border-radius:50%;background:var(--acc);color:#fff;font-size:12px;line-height:18px;text-align:center;pointer-events:none}
#mesa .btn2{border:1px solid var(--line);border-radius:8px;background:var(--panel);font-size:13px;padding:6px 11px}
#mesa .btn2:hover{border-color:#bdbdbd}
#mesa .btn2.danger{color:var(--red);border-color:#efc2c2}
#mesa .tbody{padding:0 12px 24px}
#mesa .drop{border:1.5px dashed #c7c7c7;border-radius:10px;padding:14px;text-align:center;color:var(--mute);font-size:12.5px;margin-bottom:10px;background:var(--panel)}
#mesa .tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px}
#mesa .titem{position:relative;aspect-ratio:3/4;border-radius:6px;overflow:hidden;background:#efefef;cursor:default;user-select:none;-webkit-user-select:none}
#mesa .titem img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-user-drag:none}
#mesa .titem.sel{outline:3px solid var(--acc);outline-offset:-3px}
#mesa .titem .x{position:absolute;top:4px;right:4px;width:28px;height:28px;border:0;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:16px;line-height:28px;padding:0;display:none}
#mesa .titem .hb{position:absolute;top:5px;left:5px;font-size:9.5px;font-weight:700;color:#fff;background:rgba(0,0,0,.55);border-radius:4px;padding:0 4px;pointer-events:none}
#mesa .titem:hover .x,#mesa .titem .x:focus-visible{display:block}
#mesa .tname{position:absolute;left:0;right:0;bottom:0;padding:10px 5px 3px;font-size:9.5px;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.6));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
#mesa .hint{color:var(--mute);font-size:12px;margin:12px 2px 0;line-height:1.5}
#mesa .empty{flex:1;display:flex;align-items:center;justify-content:center;padding:24px}
#mesa .ecard{max-width:430px;text-align:center;color:var(--mute);font-size:13.5px}
#mesa .ecard svg{width:34px;height:34px;color:var(--faint)}
#mesa .ecard h3{color:var(--ink);font-size:16px;margin:10px 0 6px}
#mesa .ecard .say{display:inline-block;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 12px;color:var(--ink);margin:12px 0 4px}
#mesa .detail{position:absolute;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:5}
#mesa .detail[hidden]{display:none}
#mesa .card{position:relative;background:var(--panel);border-radius:12px;max-width:640px;width:100%;max-height:100%;overflow:auto;padding:18px 18px 16px;box-shadow:0 10px 40px rgba(0,0,0,.2)}
#mesa .card h3{margin:0 28px 4px 0;font-size:16px}#mesa .card>p{margin:0 0 10px;color:var(--mute);font-size:12.5px}
#mesa .card .x{position:absolute;top:10px;right:10px;border:0;background:none;font-size:22px;line-height:1;color:var(--ink);width:30px;height:30px;border-radius:50%}
#mesa .card .x:hover{background:var(--line2)}
#mesa .card.dlg{max-width:420px}
#mesa .repl{list-style:none;margin:6px 0 0;padding:0;max-height:min(50vh,320px);overflow:auto;font-size:13px}#mesa .repl li{display:flex;flex-direction:column;gap:1px;padding:6px 0;border-top:1px solid var(--line2)}#mesa .repl li span{color:var(--mute);font-size:12.5px}
#mesa .form label{display:block;font-size:12.5px;font-weight:600;margin:12px 0 5px}#mesa .form label span{font-weight:400;color:var(--mute)}
#mesa .form input[type=text],#mesa .form input[type=number]{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 10px;font:14px ${FONT};color:var(--ink)}
#mesa .form input[type=text]:focus,#mesa .form input[type=number]:focus{outline:2px solid var(--acc);outline-offset:-1px;border-color:transparent}
#mesa .form .row{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:18px}
#mesa .form .row .left{margin-right:auto}
#mesa .ferr{color:var(--red);font-size:12px;margin:8px 0 0}
#mesa .muted{color:var(--mute);font-size:12px}
#mesa .nlab{display:block;font-size:13px;font-weight:600;margin:0 0 6px}#mesa .nlab span{font-weight:400;color:var(--mute);font-size:12px}
#mesa textarea.note,#mesa textarea.memo{width:100%;min-height:74px;resize:vertical;border:1px solid var(--line);border-radius:8px;padding:9px 10px;font:13px/1.45 ${FONT};color:var(--ink)}
#mesa textarea.note:focus,#mesa textarea.memo:focus{outline:2px solid var(--acc);outline-offset:-1px;border-color:transparent}
#mesa textarea.memo{min-height:64px;font-size:12.5px;background:#fcfcfc}
#mesa .nlab.mlab{margin-top:12px}
#mesa .card.post{max-width:1000px;padding:0;display:flex;flex-direction:column;overflow:hidden}
#mesa .phead{padding:12px 50px 11px 16px;border-bottom:1px solid var(--line2);flex:none}
#mesa .phead h3{margin:0;font-size:15px}#mesa .phead p{margin:2px 0 0;color:var(--mute);font-size:12.5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#mesa .phead .st{font-size:10.5px}
#mesa .phead p[hidden]{display:none}
#mesa .pwhen{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap}#mesa .pwhen .wd{min-width:2.2em}
#mesa .pwhen input{font:12.5px ${FONT};color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:3px 6px;min-height:30px}
#mesa .tysel,#mesa .essel{font:12.5px ${FONT};color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:3px 4px;min-height:30px;cursor:pointer}
#mesa .phead .pnot{flex-wrap:nowrap}#mesa .phead .pnot>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mesa .phead .pnot .lnk{flex:none;white-space:nowrap;padding:6px 2px}
#mesa .pbody{display:grid;grid-template-columns:minmax(0,1fr) clamp(190px,32%,300px);min-height:0;flex:1;overflow:auto}
#mesa .pleft{padding:12px;display:flex;flex-direction:column;align-items:center;gap:10px;background:var(--bg);border-right:1px solid var(--line2);min-width:0}
#mesa .stagewrap{width:100%;display:flex;justify-content:center}
#mesa .stage{position:relative;overflow:hidden;background:#111;touch-action:none;cursor:default;user-select:none;width:300px;height:375px}
#mesa .stage.panning{cursor:grabbing}
#mesa .stage img.big{position:absolute;max-width:none;pointer-events:none;-webkit-user-drag:none}
#mesa .stage canvas.dzv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}#mesa .stage canvas.dzv[hidden]{display:none}
#mesa .stage.fixed{cursor:default}
#mesa .gguide{position:absolute;z-index:1;pointer-events:none;outline:1.5px dashed rgba(255,255,255,.95);box-shadow:0 0 0 9999px rgba(0,0,0,.22)}
#mesa .gguide span{position:absolute;left:6px;top:6px;font-size:10px;color:#fff;background:rgba(0,0,0,.5);border-radius:4px;padding:1px 5px}
#mesa .thirds{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;transition:opacity .15s}
#mesa .thirds i{position:absolute;background:rgba(255,255,255,.45);box-shadow:0 0 1.5px rgba(0,0,0,.35)}
#mesa .thirds i:nth-child(-n+2){top:0;bottom:0;width:1px}#mesa .thirds i:nth-child(n+3){left:0;right:0;height:1px}
#mesa .thirds i:nth-child(1){left:33.333%}#mesa .thirds i:nth-child(2){left:66.667%}#mesa .thirds i:nth-child(3){top:33.333%}#mesa .thirds i:nth-child(4){top:66.667%}
#mesa .stage.panning .thirds,#mesa .stage.reframe .thirds{opacity:1}
#mesa .nav{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:var(--ink);font-size:20px;line-height:34px;padding:0;box-shadow:0 1px 4px rgba(0,0,0,.35);z-index:2}
#mesa .nav.prev{left:8px}#mesa .nav.next{right:8px}#mesa .nav[hidden]{display:none}
#mesa .stage .nav{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.78);color:#262626;line-height:0;display:flex;align-items:center;justify-content:center;box-shadow:0 0 6px rgba(0,0,0,.18);transition:background .12s}
#mesa .stage .nav:hover{background:rgba(255,255,255,.96)}#mesa .stage .nav svg{width:16px;height:16px}#mesa .stage .nav.prev{left:10px}#mesa .stage .nav.next{right:10px}#mesa .stage .nav[hidden]{display:none}
#mesa .igmedia .nav{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.78);color:#262626;line-height:0;display:flex;align-items:center;justify-content:center;box-shadow:0 0 6px rgba(0,0,0,.18)}#mesa .igmedia .nav:hover{background:rgba(255,255,255,.96)}#mesa .igmedia .nav svg{width:16px;height:16px}#mesa .igmedia .nav.prev{left:10px}#mesa .igmedia .nav.next{right:10px}#mesa .igmedia .nav[hidden]{display:none}
#mesa .detail[data-dlg="ig"]{background:rgba(0,0,0,.65)}
#mesa .igwrap{position:relative;display:flex;flex-direction:column;align-items:flex-end;gap:8px;max-width:100%;max-height:100%}
#mesa .igtop{display:flex;align-items:center;gap:6px}
#mesa .igedit{border:1px solid rgba(255,255,255,.55);background:transparent;color:#fff !important;border-radius:8px;font-size:12.5px;padding:4px 10px}#mesa .igedit:hover{background:rgba(255,255,255,.14)}
#mesa .igx{border:0;background:none;color:#fff !important;font-size:26px;line-height:1;width:32px;height:32px;padding:0}
#mesa .igcard{display:flex;background:#fff;color:#000;border-radius:4px;overflow:hidden;max-width:96vw;font:14px/18px ${FONT}}
#mesa .igmedia{position:relative;flex:none;background:#000;overflow:hidden}
#mesa .igmedia img.igimg{position:absolute;max-width:none;pointer-events:none}
#mesa .igmedia img.igfit{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
#mesa .igph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8e8e8e;background:#efefef;font-size:13px}
#mesa .igside{width:340px;display:flex;flex-direction:column;border-left:1px solid #efefef;min-height:0}
#mesa .ighead{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #efefef}#mesa .ighead b{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mesa .igav{width:32px;height:32px;border-radius:50%;overflow:hidden;flex:none;background:#262626;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 0 0 1px rgba(0,0,0,.08)}#mesa .igav img{width:100%;height:100%;object-fit:cover}
#mesa .igmore svg{display:block;width:24px;height:24px}
#mesa .igbody{flex:1;min-height:40px;overflow:auto}
#mesa .igacts{display:flex;align-items:center;gap:16px;padding:10px 16px 6px;border-top:1px solid #efefef}#mesa .igacts svg{display:block;width:24px;height:24px}#mesa .igacts .igsave{margin-left:auto}
#mesa .iglikes{padding:2px 16px 0}#mesa .iglikes b{font-weight:600}
#mesa .igdate{padding:4px 16px 12px;font-size:12px;color:#737373}
#mesa .igadd{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid #efefef;color:#737373}#mesa .igadd svg{display:block;width:24px;height:24px;flex:none;color:#262626}#mesa .igadd span{flex:1}#mesa .igadd b{font-weight:600;color:#262626;opacity:.4}
#mesa .igcard.hascap .igside{contain:size}#mesa .igcard.hascap .igbody{min-height:0}
#mesa .igcap{display:flex;align-items:flex-start;gap:14px;padding:14px 16px}
#mesa .igct{flex:1;min-width:0;padding-top:7px;white-space:pre-wrap;overflow-wrap:anywhere}#mesa .igct b{font-weight:600}
#mesa .igtag{color:#00376b}
@media (max-width:719px){#mesa .igcard{flex-direction:column}#mesa .igside{display:contents}#mesa .ighead{order:-1}#mesa .igacts{border-top:0}#mesa .igbody{order:1;flex:0 1 auto;min-height:0;max-height:32vh}#mesa .igdate{order:2}#mesa .igadd{display:none}#mesa .igcap{padding:6px 16px 0}#mesa .igcap .igav{display:none}#mesa .igct{padding-top:0}}
#mesa .dots{position:absolute;bottom:8px;left:0;right:0;display:flex;justify-content:center;gap:4px;z-index:2;pointer-events:none}
#mesa .dots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.5)}#mesa .dots i.on{background:#fff}
#mesa .ptools{width:100%;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;font-size:12.5px}
#mesa .seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel)}
#mesa .seg button{border:0;background:none;padding:5px 11px;min-height:32px;font-size:12.5px}#mesa .seg button.on{background:var(--ink);color:#fff}
#mesa .zoom{display:flex;align-items:center;gap:6px;color:var(--mute)}#mesa .zoom input{width:100px}
#mesa .lnk{border:0;background:none;color:var(--acc) !important;font-size:12.5px;padding:8px 4px}
#mesa .strip{width:100%;display:flex;gap:6px;overflow-x:auto;padding:2px}
#mesa .strip .th{position:relative;flex:0 0 58px;height:58px;border:0;padding:0;border-radius:6px;overflow:hidden;background:#efefef;outline:2px solid transparent;outline-offset:-2px}
#mesa .strip .th.on{outline-color:var(--acc)}
#mesa .strip .th.drg{opacity:.4}#mesa .strip .th.dl::after,#mesa .strip .th.dr::after{content:'';position:absolute;top:0;bottom:0;width:3px;background:var(--acc)}#mesa .strip .th.dl::after{left:0}#mesa .strip .th.dr::after{right:0}
#mesa .strip .th img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-user-drag:none}
#mesa .strip .th span{position:absolute;left:0;right:0;bottom:0;font-size:9px;color:#fff;background:rgba(0,0,0,.55);text-align:center;line-height:14px}
#mesa .pacts{width:100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#mesa .pacts button{border:1px solid var(--line);background:var(--panel);border-radius:6px;font-size:12px;padding:6px 10px;min-height:32px}
#mesa .pacts button:disabled{opacity:.35;cursor:default}
#mesa .pacts .fname{color:var(--mute);font-size:11.5px;margin-right:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:50%}
#mesa .pright{padding:12px 14px;display:flex;flex-direction:column;min-width:0}
#mesa .pinsw{margin:0 0 12px;align-self:flex-start}
#mesa .avrow{display:flex;align-items:center;gap:10px}#mesa .avprev{width:40px;height:40px;border-radius:50%;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center;background:var(--ink);color:#fff;font-weight:700;font-size:13px}#mesa .avprev img{width:100%;height:100%;object-fit:cover}
#mesa .cpick{width:100%;display:flex;flex-direction:column;gap:6px}#mesa .cpick .th{cursor:pointer}
#mesa .pright textarea.note{flex:1;min-height:180px}
#mesa .card.post.hascap{max-width:1080px}
#mesa .card.post.hascap .pbody{grid-template-columns:minmax(0,1fr) clamp(260px,40%,420px);min-height:min(540px,calc(100vh - 150px))}
#mesa .pright.hascap{contain:size;min-height:0}
#mesa .pright.hascap textarea.note{flex:none;min-height:64px;height:68px}
#mesa .caps{flex:1;min-height:170px;display:flex;flex-direction:column;margin-top:14px}
#mesa .caphead{flex:none;display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px;margin:0 0 6px}#mesa .caphead .nlab{margin:0}
#mesa .capbody{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px;border:1px solid var(--line2);border-radius:8px;background:var(--bg);padding:10px}
#mesa .capempty{margin:auto;padding:12px;color:var(--mute);font-size:12.5px;text-align:center}
#mesa .capst{font-size:10.5px;border-radius:4px;padding:1px 6px;white-space:nowrap;color:var(--mute);border:1px solid var(--line)}
#mesa .capst.on{color:#fff;background:var(--acc);border-color:var(--acc)}#mesa .capst.ok{color:#fff;background:var(--ok);border-color:var(--ok)}#mesa .capst.chg{background:var(--chg);border-color:var(--chg)}
#mesa .capold{flex-basis:100%;color:var(--chg);font-size:12px}
#mesa .capbox{display:flex;flex-direction:column;gap:5px}
#mesa .caplab{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;cursor:pointer;min-height:24px}
#mesa .caplab input{margin:0;width:15px;height:15px;accent-color:var(--acc);flex:none;cursor:pointer}
#mesa .caprow{display:flex;align-items:center;gap:7px}
#mesa .ctags{margin-left:auto;display:flex;align-items:center;gap:5px}
#mesa .ctags em{display:none;font-style:normal;font-weight:600;font-size:10.5px;color:#fff;background:var(--acc);border-radius:999px;padding:1px 7px}
#mesa .capbox.on .ctags em{display:inline}
#mesa .capedit{display:none;font-style:normal;font-weight:600;font-size:10.5px;color:var(--mute);border:1px solid var(--line);border-radius:999px;padding:0 7px}
#mesa .capbox.edited .capedit{display:inline}
#mesa .caprev{display:none;align-self:flex-end;padding:0 2px;font-size:12px}
#mesa .capbox.edited .caprev{display:inline-block}
#mesa textarea.capt{width:100%;min-height:58px;resize:none;overflow:hidden;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:13px/1.45 ${FONT};color:var(--ink);background:var(--panel)}
#mesa .capbox.on textarea.capt{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}
#mesa textarea.capt:focus{outline:2px solid var(--acc);outline-offset:-1px;border-color:transparent}
#mesa .pempty{color:#9a9a9a;font-size:13px;text-align:center;padding:60px 12px}
#mesa .toasts{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;align-items:center;z-index:9;pointer-events:none}
#mesa .toast{pointer-events:none;background:var(--ink);color:#fff;font-size:12.5px;padding:8px 12px;border-radius:8px;max-width:90vw;display:flex;gap:12px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.25)}
#mesa .toast button{pointer-events:auto;border:0;background:none;color:#7cc4fa;font-weight:600;font-size:12.5px;padding:4px 2px;white-space:nowrap}
#mesa .lock{position:absolute;inset:0;z-index:20;background:rgba(250,250,250,.94);display:flex;align-items:center;justify-content:center;padding:16px}
#mesa.client .lab,#mesa.client .badges,#mesa.client .cnt,#mesa.client .pdate,#mesa.client .pmonth,#mesa.client .ptag2,#mesa.client .cell.past.phidden,#mesa.client .ph>*,#mesa.client .legend,#mesa.client .tray{display:none}
#mesa.client .cell.empty::before{display:none}#mesa.client .rvbtn{display:none}
#mesa.client .cell.filler .hx{display:none}
#mesa.client .cell.empty{background:#efefef}
#mesa.client .bd{display:none}
#mesa.client .stats,#mesa.client .mchip i{display:none}
#mesa.client .feed{margin:0 auto;border-left:1px solid var(--line)}
@media (max-width:560px){#mesa .pbody{grid-template-columns:1fr}#mesa .pleft{border-right:0;border-bottom:1px solid var(--line2)}#mesa .pright textarea.note{min-height:90px}#mesa .pright textarea.memo{min-height:52px}}
@media (max-width:560px){#mesa .card.post.hascap .pbody{grid-template-columns:1fr;min-height:0}#mesa .pright.hascap{contain:none;min-height:auto}#mesa .pright.hascap textarea.note{min-height:52px;height:60px}#mesa .capbody{flex:none;max-height:60vh}}
@media (max-width:720px){
#mesa .toasts{top:46px;bottom:auto}
#mesa .appbar{height:40px;padding:0 8px;gap:4px}
#mesa .brand{padding-right:8px}
#mesa .brand span{display:none}
#mesa .tab{padding:0 10px;font-size:13px}#mesa .tab.add{padding:0 8px;font-size:13px}
#mesa .save{font-size:11.5px}
#mesa .bar{flex-wrap:nowrap;padding:5px 10px;gap:8px}
#mesa .ident{display:none}
#mesa .mgrp{flex:1 1 0;min-width:190px;flex-wrap:nowrap}
#mesa .months{flex:0 1 auto;min-width:0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
#mesa .months::-webkit-scrollbar{display:none}
#mesa .mchip{flex:none;min-height:30px;padding:4px 10px;font-size:12px;white-space:nowrap}#mesa .mchip i{font-size:11px}
#mesa .bar .spacer{display:none}
#mesa .stats{flex:0 1 auto;min-width:0;font-size:11.5px;line-height:1.25;gap:0 8px}#mesa .stats>span{white-space:nowrap}#mesa .stats .lg{display:none}
#mesa .sw{flex:none;gap:6px;font-size:12px}
#mesa .legend{position:static;flex-wrap:nowrap;white-space:nowrap;gap:10px;min-height:30px;padding:1px 10px;font-size:11.5px}
#mesa .legend>*{flex:none}#mesa .legend .lp{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
#mesa .legend .ln{width:12px;margin-right:5px}
#mesa .lockbtn{margin-left:auto;padding:2px 8px;font-size:11px}
#mesa .lockbtn+.memobtn{margin-left:0}#mesa .memobtn span{display:none}#mesa .memobtn{padding:2px 7px}
#mesa .main{flex-direction:column}
#mesa .feed{width:100%;flex:1;border-right:0;border-bottom:1px solid var(--line)}
#mesa .tray{flex:none;overflow:hidden;display:flex;flex-direction:column}
#mesa .side{flex:none}#mesa .side>.tray{flex:none}
#mesa .trayhead{position:static;min-height:32px;padding:2px 10px}
#mesa .trayhead b{font-size:13px}#mesa .trayhead span{font-size:11.5px}
#mesa .trayhead .btn{min-height:28px;padding:4px 10px;font-size:12px}#mesa .trayhead .btn svg{width:13px;height:13px}
#mesa .tbody{flex:none;height:68px;padding:0 10px 4px;overflow-x:auto;overflow-y:hidden;-webkit-mask-image:linear-gradient(to right,#000 90%,transparent);mask-image:linear-gradient(to right,#000 90%,transparent)}
#mesa .drop,#mesa .hint{display:none}
#mesa .tray.isempty .tbody{height:auto;-webkit-mask-image:none;mask-image:none}
#mesa .tray.isempty .drop{display:block;height:34px;line-height:31px;padding:0 10px;margin:0;border-radius:8px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mesa .tray.isempty .tgrid{display:none}
#mesa .tgrid{height:64px;grid-auto-flow:column;grid-template-columns:none;grid-template-rows:64px;grid-auto-columns:48px;gap:5px}
#mesa .titem{border-radius:5px}#mesa .titem .x{top:2px;right:2px}#mesa .tname{padding:8px 3px 2px;font-size:8.5px}
}
#mesa .appbar .xfer{align-self:center}
#mesa .xsum{list-style:none;margin:0 0 10px;padding:0;font-size:12.5px;max-height:38vh;overflow:auto}
#mesa .xsum li{padding:6px 0;border-top:1px solid var(--line2);line-height:1.5}#mesa .xsum li span{color:var(--mute)}
#mesa .card>p.xwhat{color:var(--ink);font-size:13px}
#mesa .pdz{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;margin:0 0 12px}
#mesa .pdzav{flex-basis:100%;margin:0;padding:0 0 0 16px;color:var(--chg);font-size:12px;max-height:7.5em;overflow:auto}`;

  function buildShell() {
    document.title = 'Mesa de trabajo';
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    const st = document.createElement('style'); st.textContent = CSS; document.body.append(st);
    root = document.createElement('div');
    root.id = 'mesa';
    root.innerHTML = `<header class="appbar"><div class="brand">${ICON.grid}<span>Mesa de trabajo</span></div><nav class="tabs" aria-label="Clientes"></nav><button class="tab add" data-act="newclient" title="Crear un cliente nuevo">+ Cliente</button><button class="ibtn xfer" data-act="xfer" title="Exportar / importar la mesa (para pasarla a otro Mac)" aria-label="Exportar o importar la mesa">⇅</button><span class="save" aria-live="polite"></span></header>`
      + '<section class="bar"></section><div class="busy" hidden></div><div class="main"></div><div class="detail" hidden></div><div class="toasts" aria-live="polite"></div>'
      + '<input type="file" class="picker" accept="image/jpeg,image/png,image/webp" multiple hidden>';
    document.body.append(root);
    mainMode = null;
    wire();
    const q = toastQ.filter(t => Date.now() - t.at < 15000); toastQ = [];
    if (q.length) setTimeout(() => q.forEach(t => toast(t.msg, t.opt)), 0);
  }
  const shellReady = () => root && document.body.contains(root);

  let pendingRender = false;
  function render() {
    if (!shellReady()) return;
    if (M.diseno && M.diseno.sync) M.diseno.sync();       // the designer closes itself when its board or post is gone
    if (M.libre && M.libre.sync) M.libre.sync();         // and so does the free editor
    if (drag) { pendingRender = true; return; }
    pendingRender = false;
    renderTabs(); renderBar(); renderMain();
  }
  function flushRender() { if (pendingRender) render(); }

  // narrow pane: the bar hides the client's name (the active tab already shows it), so «⋯ Editar cliente» moves into that tab
  const NARROW = window.matchMedia ? window.matchMedia('(max-width:720px)') : { matches: false };
  function renderTabs() {
    const nav = root.querySelector('.tabs'), ed = NARROW.matches;
    nav.innerHTML = CL.map(c => c.id === curClient
      ? `<button class="tab on${ed ? ' hasedit' : ''}" data-act="client" data-id="${esc(c.id)}" aria-current="page">${esc(c.name)}</button>` + (ed ? '<button class="ibtn tedit" data-act="editclient" title="Editar cliente" aria-label="Editar cliente">⋯</button>' : '')
      : `<button class="tab" data-act="client" data-id="${esc(c.id)}">${esc(c.name)}</button>`).join('');
    const on = nav.querySelector('.tab.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function counts() {
    const L = S.slots.filter(vivo), n = L.length, filled = L.filter(s => s.photos.length).length, notes = L.filter(s => noteOf(s)).length;   // a cancelled post doesn't count
    const st = L.map(slotStatus); return { n, filled, notes, ok: st.filter(x => x === 'ok').length, chg: st.filter(x => x === 'chg').length, dates: L.filter(dateChg).length, names: L.filter(nameChg).length };
  }
  function renderBar() {
    if (!shellReady()) return;
    const bar = root.querySelector('.bar');
    const c = CL.find(x => x.id === curClient);
    root.classList.toggle('picking', !!sel);
    setBusy('sel', sel && M.files[sel] ? `Pulsa una casilla para colocar «${M.files[sel].name}» · Esc cancela` : null);
    if (!c) { bar.innerHTML = ''; return; }
    const months = MB.map(b => {
      const live = S && b.key === S.key ? counts() : null;
      const f = live ? live.filled : b.filled, n = live ? live.n : b.n;
      return `<button class="mchip${S && b.key === S.key ? ' on' : ''}" data-act="month" data-key="${esc(b.key)}">${esc(rangeLabel(b.month, b.span, true, b.cycleDay))}<i>${f}/${n}</i></button>`;
    }).join('');
    let stats = '';
    if (S) {
      const k = counts();
      const pl = (n, a, b) => n === 1 ? a : b;
      stats = `<div class="stats"><span title="Publicaciones con foto"><b>${k.filled}</b>/${k.n} <span class="lg">con </span>foto</span><span title="Publicaciones con contexto para el caption (se sube a Notion)"><b>${k.notes}</b> <span class="lg">con </span>contexto</span><span><b>${k.ok}</b> en Notion</span>${k.chg ? `<span class="c" title="Cambiadas después de subirlas a Notion (foto, encuadre, contexto o caption): pide a Claude que las vuelva a subir"><b class="c">${k.chg}</b> ${pl(k.chg, 'cambiada', 'cambiadas')}</span>` : ''}`
        + (k.dates ? `<span class="c dates" title="Fecha u hora cambiada aquí: al subir a Notion se cambia allí${k.names ? ` y se renombran ${k.names} publicaci${k.names === 1 ? 'ón' : 'ones'} para que la numeración cuadre` : ''}"><i class="dchg" aria-hidden="true"></i><b class="c">${k.dates}</b> con fecha nueva</span>` : '') + '</div>';
    }
    bar.innerHTML = `<div class="ident"><div class="av" aria-hidden="true">${esc(initials(c.name))}</div><div class="who"><b>${esc(c.name)}</b><span>${esc(c.handle || 'sin @usuario')}</span></div><button class="ibtn" data-act="editclient" title="Editar cliente" aria-label="Editar cliente">⋯</button></div>`
      + `<div class="mgrp"><div class="months">${months}</div><button class="mchip ghost" data-act="howmonth" title="Cómo cargar otro mes">+ Mes</button>${S ? '<button class="mchip ghost" data-act="addfiller" title="Añade una casilla negra arriba del grid para cuadrar las filas de 3 (no es una publicación; como mucho 2)">+ Hueco</button>' : ''}</div><div class="spacer"></div>${stats}`
      + (S && M.hs && M.hs.barra ? M.hs.barra() : '')
      + (S ? '<button class="mchip ghost rvbtn" data-act="revisar" title="Lo que hay que mirar antes de subir o programar el mes: huecos vacíos, numeración, resolución, márgenes y formato">Revisar</button>' : '')
      + (S ? `<label class="sw"><input type="checkbox" class="clientToggle"${root.classList.contains('client') ? ' checked' : ''}> Vista cliente</label>` : '');
    const ms = bar.querySelector('.months'), on = ms.querySelector('.mchip.on');   // narrow: the chips scroll sideways
    if (on && ms.scrollWidth > ms.clientWidth + 1) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  let mainMode = null;   // 'board:<key>' | 'empty-client' | 'no-clients'
  function renderMain() {
    const main = root.querySelector('.main');
    const cn = (CL.find(x => x.id === curClient) || {}).name || '';
    const mode = S ? 'board:' + S.key : CL.length ? 'empty-client:' + curClient + ':' + cn : 'no-clients';
    if (mode !== mainMode) {
      mainMode = mode;
      if (M._ro) { M._ro.disconnect(); M._ro = null; }
      if (!S) root.classList.remove('client');
      if (S) {
        main.innerHTML = '<section class="feed"><div class="legend"></div><div class="grid"></div></section><section class="hv" aria-label="Historias" hidden></section>'
          + '<div class="side"><aside class="tray"><div class="trayhead"><b>Bandeja</b><span class="tcount"></span><div class="tfil" role="group" aria-label="Fotos de la bandeja"><button type="button" data-act="tfil" data-v="sin">Sin usar</button><button type="button" data-act="tfil" data-v="todas">Todas</button></div><button class="btn" data-act="add">' + ICON.upload + 'Añadir fotos</button></div>'
          + '<div class="tbody"><div class="drop">Arrastra aquí tus fotos (JPG o PNG) o pulsa «Añadir fotos».</div><div class="tgrid"></div>'
          + '<p class="hint">Arrastra cada foto a su casilla. Entre casillas se intercambian; de vuelta a la bandeja se quitan. Pulsa una casilla para verla en grande, elegir formato, reencuadrar y dejar una nota.</p></div></aside>'
          + '<section class="cal" aria-label="Calendario" hidden></section></div>';   // filled by calendario.js (none: the tray takes it all)
        watchFeed();
      } else if (CL.length) {
        const c = CL.find(x => x.id === curClient);
        main.innerHTML = `<div class="empty"><div class="ecard">${ICON.grid}<h3>${esc(c ? c.name : 'Elige un cliente')}${c ? ': aún no hay ningún mes en la mesa' : ''}</h3>Los meses se cargan desde Notion, con las publicaciones del calendario ya creado. Pídeselo a Claude en el chat:<br><span class="say">«Carga ${esc(nextMonthName(c && c.cycleDay))} de ${esc(c ? c.name : 'este cliente')} en la mesa»</span></div></div>`;
      } else {
        main.innerHTML = `<div class="empty"><div class="ecard">${ICON.grid}<h3>Crea tu primer cliente</h3>Cada cliente tiene su pestaña, con sus meses.<br><br><button class="btn" data-act="newclient">+ Nuevo cliente</button></div></div>`;
      }
    }
    if (S) { renderFeed(); renderTray(); }
  }

  function nextMonthName(cd) { const m = cycleOf(new Date().toISOString(), cd); let [y, mo] = m.split('-').map(Number); mo++; if (mo > 12) { mo = 1; y++; } return MONTHS[mo - 1]; }   // the next cycle to load
  function photoStatus(s) {                   // its photos and contexto as uploaded (what plan() reports)
    const u = s.uploaded; if (!u) return null;
    const asRendered = publishList(s).length && publishList(s).every(f => (M.files[f] || {}).design);   // a design's images go up as rendered: a new render is new files
    return same(u.fileIds || [], publishList(s)) && (u.note || '') === noteOf(s) && (u.crop == null || asRendered || u.crop === cropSig(s) || (isReel(s.type) && u.crop === cropSig34(s))) ? 'ok' : 'chg';
  }
  // the post as a whole: «cambiada» when its photo, crop or contexto — or its uploaded caption — changed after the upload;
  // «en Notion» only when its photos and contexto are (an uploaded caption alone never makes it so)
  function slotStatus(s) { const a = photoStatus(s), b = capStatus(s); return a === 'chg' || b === 'chg' ? 'chg' : a; }
  // the post's state (3.32), one at a time and the same everywhere. The first three follow from its data: «Por empezar»
  // (no photo or no contexto), «Captions» (none chosen yet), «Por aprobar» (one chosen, the preview still to approve).
  const ESTADOS = [['empezar', 'Por empezar'], ['captions', 'Captions'], ['aprobar', 'Por aprobar'], ['aprobado', 'Aprobado'], ['programado', 'Programado'], ['publicado', 'Publicado'], ['cancelado', 'Cancelado']];
  // The other four are chosen in the post view (s.estado = {v}). «Aprobado» keeps what was approved (sig: its photos with
  // their crops, contexto and chosen caption, as the upload records compare them): once one of them changes it is «Por
  // aprobar» again (undoing the change makes it «Aprobado» again). «Cancelado» leaves the feed, the counts and everything
  // uploaded or scheduled (M.plan, M.notionChanges, M.captions); none of its data is deleted and Notion is not touched.
  const MANUAL = ['aprobado', 'programado', 'publicado', 'cancelado'];
  const estadoAuto = s => !s.photos.length || !noteOf(s) ? 'empezar' : capFinal(s) == null ? 'captions' : 'aprobar';
  const aprobSig = s => JSON.stringify([cropSig(s), noteOf(s), capFinal(s)]);
  function estadoDe(s) {
    const v = s.estado && s.estado.v, a = estadoAuto(s);
    return !v ? a : v === 'aprobado' ? (a === 'aprobar' && s.estado.sig === aprobSig(s) ? v : a) : v;
  }
  const vivo = s => !(s && s.estado && s.estado.v === 'cancelado');
  // v: one of MANUAL, or null (back to the one its data gives). Returns why it can't be, or ''.
  function setEstado(id, v) {
    const s = S && S.slots.find(x => x.id === id); if (!s) return 'no existe';
    if (v != null && !MANUAL.includes(v)) return 'estado no válido';
    const a = estadoAuto(s);
    if (v === 'aprobado' && a !== 'aprobar') return a === 'empezar' ? 'para aprobarla le falta la foto o el contexto' : 'para aprobarla le falta elegir el caption';
    if (v) s.estado = v === 'aprobado' ? { v, sig: aprobSig(s) } : { v }; else delete s.estado;
    return '';
  }
  function pickEstado(id, v) {               // from the post view
    if (locked) return;
    const s = slot(id), why = setEstado(id, v);
    if (why) toast(cap(why) + '.');
    else {
      changed();
      if (v === 'cancelado') toast(`${s.name} cancelada: sale del feed y no se sube ni se programa. «Reactivar» la devuelve.`, { ms: 6000 });
    }
    refreshDetail();
  }
  // the post view's state: the automatic one its data gives (the other two can't be chosen) and the four chosen by hand
  function estadoHTML(s) {
    const e = estadoDe(s), a = estadoAuto(s), id = esc(s.id), old = s.estado && s.estado.v === 'aprobado' && e !== 'aprobado';
    const opts = ESTADOS.map(([k, l]) => {
      const auto = !MANUAL.includes(k), dis = auto ? k !== a : k === 'aprobado' && a !== 'aprobar' && e !== k;
      return `<option value="${auto ? '' : k}"${k === e ? ' selected' : ''}${dis ? ' disabled' : ''}>${esc(l)}</option>`;
    }).join('');
    const btn = e === 'aprobar' ? `<button type="button" class="btn2 esbtn" data-act="aprobar" data-slot="${id}" title="Has revisado el preview completo: fotos, reels y caption">Aprobar</button>`
      : e === 'cancelado' ? `<button type="button" class="btn2 esbtn" data-act="reactivar" data-slot="${id}" title="Vuelve al feed con el estado que le toque">Reactivar</button>` : '';
    return `<span class="pest"><i class="edot e-${e}" aria-hidden="true"></i><select class="essel" data-slot="${id}" aria-label="Estado" title="Por empezar, Captions y Por aprobar van solos; los demás se eligen aquí">${opts}</select>${btn}`
      + (old ? '<span class="esold" title="Cambió la foto, el recorte, el contexto o el caption después de aprobarla">cambió tras aprobarla</span>' : '') + '</span>';
  }
  function statusBadge(s) {
    const st = slotStatus(s);
    return st === 'ok' ? '<span class="st ok" title="Subida a Notion tal como está">✓ en Notion</span>' : st === 'chg' ? '<span class="st chg" title="Cambiada después de subirla a Notion (foto, encuadre, contexto o caption): pide a Claude que la vuelva a subir">cambiada</span>' : '';
  }
  // cell markers: month pill, then a column of dots (text, Notion, collab) that open into their label after 0.5 s of hover;
  // the post's state is not one of them (the calendar and the post view show it)
  const dot = (cls, label, aria) => `<span class="dot ${cls}" title="" aria-label="${esc(aria || label)}"><span class="dl">${esc(label)}</span></span>`;
  function badgesHTML(s, pill) {
    const mp = pill ? `<span class="mpill">${esc(pill)}</span>` : '';
    const cx = !!noteOf(s), st = slotStatus(s), w = sharedWith(s);
    const hv = huecosVacios(s);
    const d = (hv.length ? dot('hv', 'Hueco vacío', `Hueco de foto vacío (${hv.length === 1 ? 'diapositiva' : 'diapositivas'} ${hv.join(', ')}): no se sube ni se programa hasta llenarlo`) : '')
      + (cx && st !== 'ok' ? dot('nb', 'Contexto', 'Tiene contexto') : '')
      + (st === 'ok' ? dot('st ok', '✓ en Notion', 'Subida a Notion tal como está') : st === 'chg' ? dot('st chg', 'cambiada', 'Cambiada después de subirla a Notion (foto, encuadre, contexto o caption): pide a Claude que la vuelva a subir') : '')
      + (w.length ? dot('ltag', 'Collab ↔ ' + w.join(' · '), 'Collab enlazada con ' + w.join(' y ') + ': foto, fecha, hora, contexto, nota, captions y estado se cambian en las dos') : s.type === 'Collab Reel' ? dot('tag cb', 'Collab') : '');
    return mp || d ? `<div class="badges">${mp}${d ? `<div class="mk">${d}</div>` : ''}</div>` : '';
  }
  const POSTIT = '<svg viewBox="0 0 17 17" aria-hidden="true"><path d="M1.5 1.5h14v14H7.4C4 15.5 1.5 13 1.5 9.6z" fill="#f8df74"/><path d="M1.5 1.5h14v2.6h-14z" fill="#fcebaa"/><path d="M1.5 9.6c0 3.3 2.6 5.9 5.9 5.9-1.2-1.6-1.6-3.5-1.2-5.4-1.6.4-3.3.3-4.7-.5z" fill="#d9ad35"/></svg>';
  // the Nota's post-it; while it is edited in its cell (double click once open), a text field in its place
  let memoEdit = null;
  const postit = s => {
    if (memoEdit === s.id) return `<span class="pit edit" data-memo="${esc(s.id)}" title="">${POSTIT}<textarea class="pitin" data-slot="${esc(s.id)}" rows="1" aria-label="Nota (solo para ti, no se sube)">${esc(s.memo || '')}</textarea></span>`;
    const m = memoOf(s); return m ? `<span class="pit" data-memo="${esc(s.id)}" title="" aria-label="Nota: ${esc(m)} (doble clic para editarla; arrástrala a otra publicación para moverla)">${POSTIT}<span class="pt">${esc(m)}</span></span>` : '';
  };
  const DCHG = '<i class="dchg" title="Fecha cambiada aquí: pendiente de pasar a Notion"></i>';
  const DNM = '<i class="dchg nm" title="Cambia en Notion al subir (nombre o tipo)"></i>';
  function cellHTML(s, pill) {
    const lab = shortLabel(s.name, s.type), when = (dateChg(s) ? DCHG : nameChg(s) || typeChg(s) ? DNM : '') + esc(fmtDate(s.date));
    const icon = typeIcon(s.type, s.photos.length), pin = isPinned(s);
    if (!s.photos.length) {
      return `<div class="cell empty" data-slot="${esc(s.id)}" title="${esc(s.name)}">${pin ? `<span class="ico pinned" title="Fijada">${ICON.pin}</span>` : ''}${badgesHTML(s, pill)}<div class="ph"><span class="pico">${icon || ICON.photo}</span><b>${esc(lab)}</b><span>${when}</span></div>${postit(s)}</div>`;
    }
    const f = M.files[s.photos[0]] || {};
    const imgStyle = f.w ? rectStyle(f, gridRect(s.photos[0], s)) : '';
    const n = s.photos.length;
    const cnt = isCarousel(s.type) && (n > 1 || s.type === 'Carrusel') ? `<span class="cnt" title="${n} foto${n === 1 ? '' : 's'}">${n}<span class="cw"> foto${n === 1 ? '' : 's'}</span></span>` : '';
    return `<div class="cell full" data-slot="${esc(s.id)}" title="${esc(s.name)}"><img class="crop" src="${f.thumbUrl || ''}" style="${imgStyle}" alt="">${pin ? `<span class="ico" title="Fijada">${ICON.pin}</span>` : icon ? `<span class="ico">${icon}</span>` : ''}${badgesHTML(s, pill)}${cnt}<div class="lab">${postit(s)}<b>${esc(lab)}</b>${when}</div></div>`;
  }
  function fillerHTML(k) {
    const f = previewAt(k) && M.files[previewAt(k)], x = f ? 'Quitar la portada' : 'Quitar el hueco';
    return `<div class="cell filler${f ? ' tapa' : ''}" data-filler="${k}" title="${f ? `Preview de la primera publicación del mes siguiente: ${esc(f.name)}. No es una publicación.` : 'Hueco: solo para cuadrar el feed (no es una publicación). Suelta una foto de la bandeja para previsualizar el mes siguiente.'}">${f ? `<img class="hfoto" src="${f.thumbUrl}" alt=""><span class="htag">Preview · próximo mes</span>` : ''}<button class="hx" data-act="delfiller" data-k="${k}" title="${x}" aria-label="${x}">×</button></div>`;
  }
  function pastHTML(p, i, N) {
    const col = i % 3, bd = [];
    if (i - 3 < N) bd.push('border-top:4px solid #0095f6');
    if (i === N && col > 0) bd.push('border-left:4px solid #0095f6');
    const line = bd.length ? `<span class="bd" style="${bd.join(';')}"></span>` : '';
    const icon = typeIcon(p.type, (p.photos || []).length);
    const date = `<span class="pdate">${esc(fmtDate(p.date, true))}</span>`;
    const lk = prevLocked();
    const pill = i === N ? `<span class="pmonth" data-act="prevlock" role="button" title="${lk ? 'Desbloquear' : 'Bloquear'} el mes anterior">${lk ? '🔒' : '🔓'} ${esc(cycName(prevMonth(S.month), curCd()))} · publicado</span>` : '';
    const tags = (p.hidden ? '<span class="ptag2">Oculta</span>' : '') + (p.own && !p.hidden ? '<span class="ptag2 ed">Editada</span>' : '');
    const cls = `cell past${lk ? ' locked' : ''}${p.hidden ? ' phidden' : ''}`;
    const attrs = `data-prev="${esc(p.id)}" title="${esc(p.name)}${lk ? ' · bloqueada' : ''}"`;
    const f = p.fid && M.files[p.fid];
    if (f) return `<div class="${cls}" ${attrs}><img class="crop" src="${f.thumbUrl}" style="${rectStyle(f, gridRect(p.fid, p.item, p.B))}" alt="">${line}${pill}${tags}${icon ? `<span class="ico">${icon}</span>` : ''}${date}</div>`;
    const url = p.thumb && M.pastThumbs[p.thumb];
    if (url) return `<div class="${cls}" ${attrs}><img src="${url}" alt="">${line}${pill}${tags}${icon ? `<span class="ico">${icon}</span>` : ''}${date}</div>`;
    const why = p.thumb && M.pastPending[p.thumb] ? 'cargando…' : p.own ? 'sin foto' : p.item.src === 'mesa' ? 'sin foto en la mesa' : 'sin imagen en Notion';
    return `<div class="${cls} nophoto" ${attrs}>${line}${pill}${tags}<div class="ph"><b>${esc(shortLabel(p.name, p.type))}</b><span>${esc(fmtDate(p.date, true))} · ${why}</span></div></div>`;
  }
  function renderFeed() {
    if (!S || !shellReady()) return;
    const grid = root.querySelector('.feed .grid'); if (!grid) return;
    const N = S.slots.filter(vivo).length, lk = prevLocked(), past = pastList(!lk), shown = past.filter(p => !p.hidden).length, nh = (S.prev || []).filter(p => p.hidden).length;
    const seen = new Set();   // range board: a month pill on the newest cell of each month
    const pill = s => { const m = cycleOf(s.date, curCd()); if (S.span < 2 || !m || seen.has(m)) return ''; seen.add(m); return curCd() === 1 ? cap(MONTHS[+m.slice(5) - 1].slice(0, 3)) : cycName(m, curCd()); };
    if (memoEdit && !S.slots.some(s => s.id === memoEdit)) memoEdit = null;
    const pinned = new Set(pinsOf());               // pinned first (no month pill: they are out of the date order)
    const F = fillersOf(), cells = feedOrder().map(s => cellHTML(s, pinned.has(s.id) ? '' : pill(s)));
    cells.splice(pinned.size, 0, ...Array.from({ length: F }, (_, k) => fillerHTML(k)));   // the fillers right after the pinned posts; the rest moves down
    const html = cells.join('') + past.map((p, j) => pastHTML(p, N + F + j, N + F)).join('');
    // a Nota being edited in its cell: that cell stays in the page untouched (a rebuilt field would lose an accent being
    // typed and its own undo); the others are rebuilt around it, and it is redrawn once the editing ends
    const live = memoEdit && grid.querySelector(`.pit.edit[data-memo="${cssq(memoEdit)}"]`), keep = live && live.closest('.cell');
    if (keep) {
      const tpl = document.createElement('div'); tpl.innerHTML = html;
      const nodes = [...tpl.children], k = nodes.findIndex(n => n.dataset.slot === memoEdit);
      [...grid.children].forEach(n => { if (n !== keep) n.remove(); });
      nodes.forEach((n, i) => { if (i < k) grid.insertBefore(n, keep); else if (i > k) grid.appendChild(n); });
      memoStale = true;
    } else {
      grid.innerHTML = html;
      const pin = memoEdit && grid.querySelector(`.pitin[data-slot="${cssq(memoEdit)}"]`); if (pin) fitPit(pin);
    }
    if (hov.id) hov.t = Date.now();          // a redrawn post-it opens again after its 0.5 s
    pdRefresh();
    const pm = rangeLabel(prevMonth(S.month), 1, false, curCd());
    const lockBtn = (S.prev || []).length ? (S.prevUnlocked ? '<button class="lockbtn on" data-act="prevlock" title="Volver a bloquear el mes anterior">🔓 Desbloqueado · Bloquear</button>' : lk ? '<button class="lockbtn" data-act="prevlock" title="Desbloquear el mes anterior">🔒 Bloqueado</button>' : '<button class="lockbtn on" data-act="prevlock">🔓 Solo esta vez</button>') : '';
    const below = `Debajo: ${pm} · ${shown} publicada${shown === 1 ? '' : 's'}${nh ? ` · ${nh} oculta${nh === 1 ? '' : 's'}` : ''}${PB && PB.slots.length ? ' (de tu mesa)' : ''}`;
    const memoBtn = S.slots.some(s => memoOf(s)) ? `<button class="lockbtn memobtn${memosOpen ? ' on' : ''}" data-act="memos" aria-pressed="${memosOpen}" title="${memosOpen ? 'Cerrar todas las notas' : 'Abrir todas las notas a la vez'}">${POSTIT}<span>${memosOpen ? 'Cerrar notas' : 'Abrir notas'}</span></button>` : '';
    root.querySelector('.feed .legend').innerHTML = `<span class="lr"><b>${esc(rangeLabel(S.month, S.span, false, curCd()))}</b> · ${N} a preparar</span>`
      + ((S.prev || []).length ? `<span class="lp" title="${esc(below)}"><span class="ln"></span>Debajo: <b>${esc(pm)}</b> · ${shown} publicada${shown === 1 ? '' : 's'}${nh ? ` · ${nh} oculta${nh === 1 ? '' : 's'}` : ''}${PB && PB.slots.length ? ' (de tu mesa)' : ''}</span>${lockBtn}` : `<span class="lp">Sin publicaciones de ${esc(pm.toLowerCase())} cargadas</span>`) + memoBtn;
    fitGrid();
    calRender();
    hsRender();
  }
  // the calendar (calendario.js) follows every redraw of the grid; if it didn't load or throws, the mesa goes on without it
  function calRender() { if (M.calendario && M.calendario.render) { try { M.calendario.render(); } catch (e) { /* never needed by the mesa */ } } }
  // the grid's width follows the feed's height so that ≈3.4 rows fit (cell = 3:4 of a third), between 300 px and the
  // feed's own width (max 480 px); recomputed on every render and whenever the feed or its legend change size
  const FIT_ROWS = 3.4;
  function fitGrid() {
    const feed = root && root.querySelector('.feed'), grid = feed && feed.querySelector('.grid'); if (!grid || !feed.clientHeight) return;
    const lg = feed.querySelector('.legend'), lh = lg && lg.offsetParent ? lg.offsetHeight : 0;
    const w = Math.round(Math.min(480, feed.clientWidth, Math.max(300, (feed.clientHeight - lh - 6) * 9 / (4 * FIT_ROWS) + 4)));
    if (grid.style.maxWidth !== w + 'px') grid.style.maxWidth = w + 'px';
  }
  function watchFeed() {
    if (M._ro) { M._ro.disconnect(); M._ro = null; }
    const feed = root.querySelector('.feed'); if (!feed || typeof ResizeObserver !== 'function') return;
    M._ro = new ResizeObserver(() => fitGrid());
    M._ro.observe(feed); M._ro.observe(feed.querySelector('.legend'));
  }
  // What a tray shows (D-041), the mesa's and the free editor's alike: the client's tray, a photo once, each with u = used
  // in a publication of any of the client's months (the rule of D-022); with «Todas», also the client's photos used in its
  // publications that are not in the tray. o.todas: instead of the filter; o.sin: a post whose uses don't count (the one
  // open in the editor), o.mas: photos in use there (on its slides). Never another client's photo (a collab's, `de`).
  const LS_TF = 'mesa-bandeja-filtro';
  const trayTodas = () => lsGet(LS_TF) === 'todas';
  function trayFiltro(v) { lsSet(LS_TF, v === 'todas' ? 'todas' : 'sin'); renderTray(); if (M.libre && M.libre.bandeja) M.libre.bandeja(); }
  let todasCarga = null; const sinMini = new Set();   // photos of «Todas» whose thumbnail can't load: not asked again
  function bandejaVista(o = {}) {
    if (!S) return [];
    if (!usoS || usoS.B !== S) usoS = { B: S, map: usoMap(S) };
    const todas = o.todas ?? trayTodas(), mas = o.mas || new Set(), c = S.client, out = [], ya = new Set(), hm = usoHMap();
    const cuenta = u => !o.sin || u.slot !== o.sin;
    const usada = (f, k) => mas.has(f) || (!!k && ((usoS.map.get(k) || []).some(cuenta) || (usoO.get(k) || []).some(cuenta)));
    const add = f => {
      if (!f || ya.has(f) || !M.files[f] || M.files[f].design || !trayable(f) || ajena(f, c)) return;
      const k = fileKey(f); if (k && ya.has(k)) return;
      ya.add(f); if (k) ya.add(k);
      out.push({ f, u: usada(f, k), ...(k && hm.has(k) ? { h: true } : {}) });   // h: in a story (not ✓: it is still free for the feed, D-056)
    };
    S.tray.forEach(add);
    [...previewsOf(S), ...usoPrevO].forEach(add);   // a filler's photo: with ✓ while it counts as used, free once there is a later month (D-049)
    if (!todas) return out.filter(x => !x.u);
    mas.forEach(add);
    usosDe(S, (f, u) => { if (cuenta(u)) add(f); });
    usoIdsO.forEach(add);
    const need = [...usoIdsO.values()].filter(f => !M.files[f] && !sinMini.has(f));
    if (need.length && !todasCarga) { const B = S; todasCarga = loadThumbs(need).catch(() => need).then(m => { (m || []).forEach(f => sinMini.add(f)); todasCarga = null; if (B === S) { renderTray(); if (M.libre && M.libre.bandeja) M.libre.bandeja(); } }); }
    return out;
  }
  const enVista = f => bandejaVista({ todas: true }).some(x => x.f === f);   // a photo the tray can show (click to place)
  function renderTray() {
    if (!S || !shellReady()) return;
    const tray = root.querySelector('.tray'); if (!tray) return;
    const todas = trayTodas(), vis = bandejaVista({ todas }), n = vis.filter(x => !x.u).length;
    tray.querySelector('.tcount').textContent = todas ? `${n} sin usar · ${vis.length - n} ✓` : n ? `${n} sin usar` : 'vacía';
    tray.querySelectorAll('.tfil button').forEach(b => { const on = (b.dataset.v === 'todas') === todas; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    tray.classList.toggle('isempty', !vis.length);
    const enHueco = new Set([...previewsOf(S), ...usoPrevO]);   // on a filler: it comes off there, not from the tray (D-049)
    tray.querySelector('.tgrid').innerHTML = vis.map(({ f: id, u, h }) => {
      const f = M.files[id];
      return `<div class="titem${sel === id ? ' sel' : ''}${u ? ' uso' : ''}" data-file="${esc(id)}" title="${esc(f.name)}${u ? (enHueco.has(id) ? ' · ya usada' : ' · ya usada en una publicación') : ''}${h ? ' · usada en una historia' : ''} · arrástrala a una casilla o púlsala y luego la casilla"><img src="${f.thumbUrl}" alt="">${f.w > f.h ? '<span class="hb" title="Horizontal">H</span>' : ''}${h ? '<span class="hs" title="Usada en una historia"></span>' : ''}<span class="tname">${esc(f.name)}</span>${u || h || enHueco.has(id) ? '' : `<button class="x" data-act="del" data-file="${esc(id)}" title="Quitar de la mesa" aria-label="Quitar ${esc(f.name)} de la mesa">×</button>`}</div>`;
    }).join('');
    pdRefresh();
  }

  // ---------- post view (Instagram-desktop style) ----------
  // a post opened with the keyboard gets focus on its close button; opened with the mouse, no focus ring appears
  let kbd = false;
  addEventListener('keydown', () => { kbd = true; }, true); addEventListener('pointerdown', () => { kbd = false; }, true);
  const focusClose = d => { const x = d.querySelector('.card > .x'); if (!x) return; if (kbd) x.focus({ preventScroll: true }); else if (d.contains(document.activeElement)) document.activeElement.blur(); };
  let pickOpen = null;   // the post whose «Cambiar portada» picker is open
  function openDetail(id, idx) {
    const s = slot(id); if (!s || !shellReady()) return;
    repeCancel();
    if (pickOpen && pickOpen !== id) pickOpen = null;
    if (isPrev(s)) return openPast(id);
    const d = root.querySelector('.detail');
    if (idx == null) idx = cur.slot === id ? cur.idx : 0;
    const n = s.photos.length;
    idx = Math.max(0, Math.min(n - 1, idx || 0));
    // keep the focus and caret of the field being typed in (contexto, nota or a caption) if we're re-rendering the same post
    const ta = document.activeElement;
    const keep = ta && d.contains(ta) && ta.matches('textarea.note, textarea.memo, textarea.capt') && ta.dataset.slot === id ? { c: ta.className, k: ta.dataset.k, a: ta.selectionStart, b: ta.selectionEnd, t: ta.scrollTop } : null;
    const cb = !d.hidden && d.dataset.slot === id && !d.dataset.prev && d.querySelector('.capbody'), capTop = cb ? cb.scrollTop : 0;   // where the captions were scrolled to
    // focus: the close button when the post opens (or when it had it before this re-render, e.g. arrow keys)
    const ae = document.activeElement, fresh = d.hidden || d.dataset.slot !== id || !!d.dataset.prev || !!(ae && d.contains(ae) && ae.matches('.card > .x'));
    cur = { slot: id, idx };
    const car = isCarousel(s.type), foto = s.type === 'Foto', reel = isReel(s.type);
    const fid = s.photos[idx];
    const fd = !!(n && (M.files[fid] || {}).design);   // a designed image: uploaded as rendered
    const live = fd && designed(s) && dState(s) !== 'chg' && s.photos.length === s.design.slides.length;   // a designed slide: reframed here on its photo, drawn live with its texts (B4)
    let left;
    if (!n) left = '<div class="pempty">Sin foto todavía.<br>Arrastra aquí fotos desde tu ordenador o suelta una de la bandeja sobre la casilla.</div>';
    else {
      const c = cropOf(fid, s);
      const seg = `<div class="seg" role="group" aria-label="Formato">${['v45', 'v34', 'q11', 'h'].map(k => `<button data-act="fmt" data-fmt="${k}" class="${c.fmt === k ? 'on' : ''}" aria-pressed="${c.fmt === k}">${FMT_LABEL[k]}</button>`).join('')}</div>`;
      const dfmt = car && s.design ? s.design.fmt : null;   // a designed carousel: the design's format
      const segD = dfmt ? `<div class="seg" role="group" aria-label="Formato">${['v45', 'v34', 'h'].map(k => `<button data-act="fmt" data-fmt="${k}" class="${dfmt === k ? 'on' : ''}" aria-pressed="${dfmt === k}">${FMT_LABEL[k]}</button>`).join('')}</div>` : '';
      const fmtCtl = reel ? '<span class="muted">Portada del reel · 9:16 · las líneas marcan el 3:4 del perfil</span>' : dfmt ? `<span class="muted">${esc(s.type)}</span>${segD}` : car ? `<span class="muted">${esc(s.type)}</span>${seg}` : seg;
      const dsrc = live && M.diseno && M.diseno._srcVista ? M.diseno._srcVista(s, idx) : null, zv = (dsrc ? baseCrop(dsrc, S) : c).z || 1;
      const lo = fd && !s.design && isLib(fid);   // an image drawn by the free editor: its format is changed here (drawn again there)
      const tools = lo ? `${fmtCtl}<span class="muted">Editada: se sube tal cual · cámbiala en «${edLabel(s)}»</span>`
        : fd && !live ? `<span class="muted">${designed(s) ? 'Diseño con cambios sin aplicar: reencuádralo en «Diseñar»' : 'Imagen diseñada: se sube tal cual'}</span>`
        : `${fmtCtl}<label class="zoom">Zoom <input type="range" class="zoomr" min="1" max="3" step="0.01" value="${zv}"></label><button class="lnk" data-act="center">Centrar</button><span class="muted phint">Arrastra la foto para reencuadrar</span>`;
      const nav = n > 1 ? `<button class="nav prev" data-act="prev" title="Anterior" aria-label="Foto anterior" ${idx === 0 ? 'hidden' : ''}>${CHEV.l}</button><button class="nav next" data-act="next" title="Siguiente" aria-label="Foto siguiente" ${idx === n - 1 ? 'hidden' : ''}>${CHEV.r}</button><div class="dots">${s.photos.map((_, k) => `<i class="${k === idx ? 'on' : ''}"></i>`).join('')}</div>` : '';
      const strip = n > 1 ? `<div class="strip">${s.photos.map((p, k) => `<button class="th ${k === idx ? 'on' : ''}" data-act="pick" data-k="${k}" title="${esc((M.files[p] || {}).name || '')}"><img src="${(M.files[p] || {}).thumbUrl || ''}" alt="">${k === 0 && (foto || car) ? '<span>Portada</span>' : ''}</button>`).join('')}</div>` : '';
      const acts = `<div class="pacts"><span class="fname">${esc(fd && (car || reel) ? dName(s, fid) : (M.files[fid] || {}).name || '')}${(M.files[fid] || {}).reduced ? ' · 1080 px' : ''}</span>`
        + (car && n > 1 && !(fd && s.design) ? `<button data-act="left" data-slot="${esc(id)}" data-k="${idx}" ${idx === 0 ? 'disabled' : ''}>◀ Mover</button><button data-act="right" data-slot="${esc(id)}" data-k="${idx}" ${idx === n - 1 ? 'disabled' : ''}>Mover ▶</button>` : '')
        + (car || reel ? `<button data-act="pickcover" data-slot="${esc(id)}" aria-expanded="${pickOpen === id}">Cambiar portada</button>` : '')
        + (fd && s.design && (car || reel) ? (car ? '<span class="muted">Las demás diapositivas se cambian en «Diseñar»</span>' : '') : `<button data-act="unpick" data-slot="${esc(id)}" data-k="${idx}">Quitar</button>`) + '</div>';
      const tr = S.tray.filter(f => M.files[f]);
      const pick = (car || reel) && pickOpen === id ? `<div class="cpick"><span class="muted">${tr.length ? 'Elige la nueva portada en la bandeja (la de ahora vuelve a la bandeja; el texto se queda):' : 'La bandeja está vacía: añade fotos con «Añadir fotos».'}</span>`
        + (tr.length ? `<div class="strip">${tr.map(f => `<button class="th" data-act="setcover" data-slot="${esc(id)}" data-f="${esc(f)}" title="${esc(M.files[f].name)}"><img src="${M.files[f].thumbUrl}" alt=""></button>`).join('')}</div>` : '') + '</div>' : '';
      left = `<div class="stagewrap"><div class="stage" data-slot="${esc(id)}" data-file="${esc(fid)}"${live ? ' data-live="1"' : ''}><img class="big" alt="" src="${(M.files[fid] || {}).thumbUrl || ''}">${live ? '<canvas class="dzv" hidden></canvas>' : ''}<div class="gguide" hidden><span>Así se ve en el perfil</span></div>${THIRDS}${nav}</div></div>
        <div class="ptools">${tools}</div>
        ${strip}${acts}${pick}`;
    }
    const hint = car && n > 1 ? `${foto ? 'Foto de varias páginas' : 'Carrusel'}: se suben todas en este orden, con un solo formato. Arrastra las miniaturas para cambiar el orden.` : '';
    const dst = car || reel ? dState(s) : null;
    const dav = (dst === 'ok' || dst === 'nc') && s.design.avisos && s.design.avisos.length ? s.design.avisos : [];   // what «Aplicar» warned about
    const nl = libN(s);
    const dzB = (car || reel) && !nl ? `<button type="button" class="btn2" data-act="disenar" data-slot="${esc(id)}">Diseñar</button>` : '';   // «Diseñar» while no slide comes from the free editor; the editor also opens a designed carousel (3.27)
    const edB = car || (reel && n) ? `<button type="button" class="btn2" data-act="editar" data-slot="${esc(id)}" data-k="${idx}">${edLabel(s)}</button>` : '';
    const pg = foto ? 'página' : 'diapositiva', lbT = nl ? `<span class="muted">${reel ? 'Portada editada · se sube tal cual' : nl === 1 ? `1 ${pg} editada · se sube tal cual` : `${nl} ${pg}s editadas · se suben tal cual`}</span>` : '';
    const dz = dzB || edB ? `<div class="pdz">${dzB}${edB}${lbT}${dst === 'ok' ? '<span class="muted">Diseño aplicado · se sube tal cual</span>' : dst === 'nc' ? '<span class="muted">Diseño aplicado · se sube tal cual (sin comprobar: el diseñador no está cargado)</span>' : dst ? '<span class="muted" style="color:var(--chg)">Diseño con cambios sin aplicar · abre «Diseñar» y pulsa Aplicar</span>' : ''}${dav.length ? `<ul class="pdzav">${dav.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}</div>` : '';
    d.innerHTML = `<div class="card post hascap" role="dialog" aria-label="${esc(s.name)}"><button class="x" data-act="close" title="Cerrar" aria-label="Cerrar">×</button>
      <div class="phead"><h3>${esc(s.name)}</h3><p>${whenHTML(s)}<span>·</span>${typeHTML(s)}<span>·</span>${estadoHTML(s)}${statusBadge(s)}</p>${pnotHTML(s)}${linkLine(s)}</div>
      <div class="pbody"><div class="pleft">${left}</div>
        <div class="pright hascap"><label class="sw pinsw" title="Como en Instagram: arriba del todo, con la chincheta. Solo cambia cómo se ve el feed (no la fecha ni Notion)."><input type="checkbox" class="pinToggle" data-slot="${esc(id)}"${isPinned(s) ? ' checked' : ''}> Fijar en el perfil</label>${dz}<label class="nlab" for="nota-${esc(id)}">Contexto <span>· para el caption, se sube a Notion</span></label>
          <textarea class="note" id="nota-${esc(id)}" data-slot="${esc(id)}" placeholder="Qué se ve, qué contar, tono…">${esc(s.note || '')}</textarea>
          <label class="nlab mlab" for="memo-${esc(id)}">Nota <span>· solo para ti, no se sube</span></label>
          <textarea class="memo" id="memo-${esc(id)}" data-slot="${esc(id)}" placeholder="Recordatorios, pendientes…">${esc(s.memo || '')}</textarea>
          ${capsHTML(s)}
          ${hint ? `<p class="muted" style="margin:10px 0 0">${hint}</p>` : ''}</div></div></div>`;
    if (d.hidden || d.dataset.slot !== id) clearToasts();
    d.hidden = false;
    d.dataset.slot = id; delete d.dataset.dlg; delete d.dataset.prev;
    fitCaps(d); if (capTop) d.querySelector('.capbody').scrollTop = capTop;
    if (keep) { const t2 = keep.c === 'capt' ? d.querySelector(`textarea.capt[data-k="${cssq(keep.k)}"]`) : d.querySelector('textarea.' + (keep.c === 'memo' ? 'memo' : 'note')); if (t2) { t2.focus({ preventScroll: keep.c === 'capt' }); t2.setSelectionRange(keep.a, keep.b); t2.scrollTop = keep.t; } }
    else if (fresh) focusClose(d);
    if (n) { layoutStage(); loadBig(fid); }
    if (live && M.diseno && M.diseno.vista) M.diseno.vista(d.querySelector('.stage canvas.dzv'), id, idx);   // ready for a reframe
    markReframe();
  }
  // the post view's «Captions» block: under the Contexto and the Nota, as tall as the column allows, scrolling inside.
  // The 3 options in the client's tone order, each one editable (its original stays as Claude wrote it); the radio
  // marks the chosen one — one at a time, changeable at any moment.
  function capsHTML(s) {
    const c = capOf(s), id = esc(s.id), cn = (CL.find(x => x.id === S.client) || {}).name || 'este cliente';
    const body = !c ? `<p class="capempty">Sin captions todavía. Pídeselos a Claude: «genera los captions de ${esc(cn)}».</p>`
      : c.orig.map((_, k) => {
        const lab = `Caption ${k + 1} · ${c.tones[k] || ''}`, on = c.pick === k, ed = c.text[k] !== c.orig[k];
        return `<div class="capbox${on ? ' on' : ''}${ed ? ' edited' : ''}" data-k="${k}"><div class="caprow"><label class="caplab" title="${on ? 'Elegido: otro clic lo desmarca' : 'Elegir este caption'}"><input type="radio" class="cappick" name="cap-${id}" data-slot="${id}" data-k="${k}"${on ? ' checked' : ''}><span>${esc(lab)}</span></label><span class="ctags"><i class="capedit">Editado</i><em>Elegida</em></span></div>`
          + `<textarea class="capt" data-slot="${id}" data-k="${k}" aria-label="${esc(lab)}">${esc(c.text[k])}</textarea>`
          + `<button type="button" class="lnk caprev" data-act="caporig" data-slot="${id}" data-k="${k}" title="Deja este caption tal como lo escribió Claude">Volver al original</button></div>`;
      }).join('');
    return `<section class="caps" aria-label="Captions"><div class="caphead"><span class="nlab">Captions</span>${capStateHTML(s)}</div><div class="capbody">${body}</div></section>`;
  }
  function capStateHTML(s) {                 // M4: the state, and whether they are outdated
    const c = capOf(s), st = capState(s), od = capOutdated(s), chg = capStatus(s) === 'chg';
    const txt = st === 'sin captions' ? 'Sin captions' : st === 'por elegir' ? (s.caption && s.caption.sent ? 'Por elegir · Notion sigue con el que subiste' : 'Por elegir') : st === 'subido' ? '✓ Subido a Notion' : `Elegido: Caption ${c.pick + 1}` + (chg ? ' · cambiado después de subirlo' : '');
    const why = od.length === 2 ? 'cambiaron la foto y el contexto' : od[0] === 'foto' ? 'cambió la foto' : 'cambió el contexto';
    return `<span class="capst ${st === 'subido' ? 'ok' : st === 'elegido' ? 'on' : ''}${chg && st !== 'por elegir' ? ' chg' : ''}">${esc(txt)}</span>`
      + (od.length ? `<span class="capold" title="No se borran ni se rehacen solos: si quieres otros, pídeselo a Claude">Desactualizados: ${why} después de generarlos</span>` : '');
  }
  // after an edit, a new choice or a contexto change in the open post view: the boxes stay (no re-render), only what they show changes
  function capSync(id) {
    const d = root && root.querySelector('.detail'), s = slot(id); if (!d || d.hidden || d.dataset.slot !== id || !s || isPrev(s)) return;
    const c = capOf(s), h = d.querySelector('.caphead');
    if (h) { h.querySelectorAll('.capst, .capold').forEach(x => x.remove()); h.insertAdjacentHTML('beforeend', capStateHTML(s)); }
    if (c) d.querySelectorAll('.capbox').forEach(b => {
      const k = +b.dataset.k, on = k === c.pick, r = b.querySelector('.cappick'), t = b.querySelector('textarea.capt');
      b.classList.toggle('on', on); if (r && r.checked !== on) r.checked = on;
      const l = b.querySelector('.caplab'); if (l) l.title = on ? 'Elegido: otro clic lo desmarca' : 'Elegir este caption';
      if (t && t !== document.activeElement && t.value !== c.text[k]) { t.value = c.text[k]; fitPit(t); }   // a revert, never the field being typed in
      b.classList.toggle('edited', c.text[k] !== c.orig[k]);
    });
    syncEstado(id);
  }
  const fitCaps = d => d && d.querySelectorAll('textarea.capt').forEach(fitPit);
  // date + time of the post (Madrid), editable within the board's months; date-only posts stay date-only
  const wday = iso => { const d = localDay(iso); return d ? new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', weekday: 'short' }).format(new Date(d + 'T12:00:00Z')).replace('.', '') : ''; };
  function whenHTML(s) {
    const ms = boardMonths(), max = cycleEnd(ms[ms.length - 1], curCd());
    const at = `data-slot="${esc(s.id)}" required`;
    return `<span class="pwhen"><span class="wd">${esc(wday(s.date))}</span><input type="date" class="dtin" ${at} value="${esc(localDay(s.date) || '')}" min="${cycleStart(ms[0], curCd())}" max="${max}" aria-label="Fecha (hora de Madrid)" title="Cambiar la fecha: al subir a Notion se cambia allí">`
      + (dOnly(s.date) ? '' : `<input type="time" class="tmin" ${at} value="${esc(localTime(s.date))}" aria-label="Hora (Madrid)" title="Hora de Madrid">`) + '</span>';
  }
  function pnotHTML(s) {
    const dc = dateChg(s), nc = nameChg(s), tc = typeChg(s);
    if (!dc && !nc && !tc) return '<p class="pnot" hidden></p>';
    const txt = dc || tc ? 'En Notion: ' + [tc ? s.notionType : '', nc ? s.notionName : '', dc ? fmtDate(s.notionDate) : ''].filter(Boolean).join(' · ') : 'Se renombra al subir · en Notion: ' + s.notionName;
    return `<p class="pnot"><span title="${esc(txt)}"><i class="dchg${dc ? '' : ' nm'}"></i>${esc(txt)}</span>${dc ? `<button class="lnk" data-act="datereset" data-slot="${esc(s.id)}">Volver a la fecha de Notion</button>` : ''}${tc ? `<button class="lnk" data-act="typereset" data-slot="${esc(s.id)}">Volver a ${esc(s.notionType)}</button>` : ''}</p>`;
  }
  // the post's type (3.26): Foto, Carrusel or its kind of reel (a collab's: Collab Reel); the change waits for «sube»
  function typeOpts(s) {
    const nt = s.notionType ?? s.type, reel = isReel(s.type) ? s.type : isReel(nt) ? nt : /^collab\b/i.test(String(s.notionName ?? s.name)) ? 'Collab Reel' : 'Reel';
    const o = ['Foto', 'Carrusel', reel]; if (s.type && !o.includes(s.type)) o.unshift(s.type);
    return o;
  }
  const typeHTML = s => `<select class="tysel" data-slot="${esc(s.id)}" aria-label="Tipo de publicación" title="Cambiar el tipo (al subir a Notion se cambia allí)">${typeOpts(s).map(t => `<option value="${esc(t)}"${t === s.type ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  // A reel keeps only its cover: the other photos (and edited pages) go back to the tray; a designed post's design converts
  // as when Notion retypes it (diseno.js); the name gets or loses «Reel». Foto ↔ Carrusel only changes the label.
  function setType(id, to) {
    const s = S && S.slots.find(x => x.id === id);
    if (!s || !to || s.type === to || locked || !typeOpts(s).includes(to)) { refreshDetail(); return; }
    if (s.design && !(M.diseno && M.diseno._retipo)) { toast('El diseñador no está cargado: recarga la página para cambiar el tipo de una publicación diseñada.', { ms: 6000 }); refreshDetail(); return; }
    const from = s.type, name0 = s.name;
    if (s.notionType == null) s.notionType = from;
    if (s.design) { const x = M.diseno._retipo(s, to); if (x) { S.tray.unshift(...x.tray.filter(f => M.files[f])); if (x.dead.length) delList(l => [...new Set([...l, ...x.dead])]); } }
    s.type = to;
    let back = 0;
    if (!isMulti(to) && s.photos.length > 1) { const ex = s.photos.slice(1).filter(f => !dOut(s).includes(f)); s.photos = s.photos.slice(0, 1); S.tray.unshift(...ex); back = ex.length; }
    S.tray = [...new Set(S.tray)].filter(f => !S.slots.some(x => x.photos.includes(f)));
    renumber(); changed();
    if (s.libre && !s.design) {                          // images drawn in the free editor: drawn again in the new type's format (libre.js)
      if (M.libre && M.libre.redibujar) M.libre.redibujar(s.id);
      else toast('El editor no está cargado: abre «Editar» y aplica para pasar la imagen editada al formato nuevo.', { ms: 7000 });
    }
    if (cur.slot === id) openDetail(id, 0);
    const pend = typeChg(s) ? (s.name !== name0 ? ` · se llamará ${s.name}` : '') + ' · al subir a Notion se cambia allí' : ' · como en Notion';
    toast(`Ahora es ${to}${pend}.` + (back ? ` Un reel solo lleva portada: ${back === 1 ? 'la otra foto ha vuelto' : `las otras ${back} fotos han vuelto`} a la bandeja.` : ''), { ms: back ? 8000 : 5000 });
  }
  // after a date change typed in the post view: update its header without replacing the input being edited
  // (Chrome fires the date input's change while focus is briefly on <body>, so the source input is passed in)
  function syncHead(id, src) {
    const d = root && root.querySelector('.detail'), s = slot(id); if (!d || d.hidden || d.dataset.slot !== id || !s || !d.querySelector('.pwhen')) return;
    d.querySelector('.phead h3').textContent = s.name; d.querySelector('.card').setAttribute('aria-label', s.name);
    d.querySelector('.pwhen .wd').textContent = wday(s.date);
    d.querySelector('.phead .pnot').outerHTML = pnotHTML(s);
    d.querySelectorAll('.pwhen input').forEach(el => { if (el !== src) resetWhen(el, s); });
    layoutStage();
  }
  function resetWhen(el, s) { const v = el.classList.contains('dtin') ? localDay(s.date) : localTime(s.date); if (el.value !== v) el.value = v; }
  function onWhen(el) {
    const s = S && S.slots.find(x => x.id === el.dataset.slot), d = root.querySelector('.detail'); if (!s) return;
    const day = d.querySelector('.dtin').value, ti = d.querySelector('.tmin');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || (ti && !ti.value)) return;   // half-typed: restored on blur
    if (!inBoard(day)) return;                                             // typing can pass through other cycles: told on blur
    const iso = dOnly(s.date) ? day : madridISO(day, ti ? ti.value : '00:00');
    if (!sameDate(iso, s.date)) setDate(s.id, iso, false, el);
  }
  const bOf = s => (isPrev(s) && !s.own && s.src === 'mesa' && PB) ? PB : S;
  function openPast(id) {
    const it = prevItem(id); if (!it || !shellReady()) return;
    const d = root.querySelector('.detail');
    const fresh = d.hidden || d.dataset.slot !== id || !d.dataset.prev;
    cur = { slot: id, idx: 0 };
    const im = prevImg(it), B = im && im.B;
    let left;
    if (im && im.f && M.files[im.f]) {
      const c = cropOf(im.f, it, B);
      const fmtCtl = isReel(it.type) ? '<span class="muted">Portada del reel · 9:16 · las líneas marcan el 3:4 del perfil</span>' : `<div class="seg" role="group" aria-label="Formato">${['v45', 'v34', 'q11', 'h'].map(k => `<button data-act="fmt" data-fmt="${k}" class="${c.fmt === k ? 'on' : ''}" aria-pressed="${c.fmt === k}">${FMT_LABEL[k]}</button>`).join('')}</div>`;
      left = `<div class="stagewrap"><div class="stage" data-slot="${esc(id)}" data-file="${esc(im.f)}"><img class="big" alt="" src="${M.files[im.f].thumbUrl}"><div class="gguide" hidden><span>Así se ve en el perfil</span></div>${THIRDS}</div></div>
        <div class="ptools">${fmtCtl}<label class="zoom">Zoom <input type="range" class="zoomr" min="1" max="3" step="0.01" value="${c.z || 1}"></label><button class="lnk" data-act="center">Centrar</button><span class="muted phint">Arrastra la foto para reencuadrar</span></div>
        <div class="pacts"><span class="fname">${esc(M.files[im.f].name)}</span></div>`;
    } else if (im && im.t && M.pastThumbs[im.t]) left = `<img class="pthumb" src="${M.pastThumbs[im.t]}" alt=""><p class="muted" style="margin:0">Foto tal como está en Notion.</p>`;
    else left = '<div class="pempty">Sin foto.<br>Arrastra una foto de la bandeja sobre su casilla.</div>';
    const acts = `<div class="pvacts">`
      + `<button class="btn2" data-act="prevhide" data-id="${esc(id)}">${it.hidden ? 'Volver a mostrar en el feed' : 'Ocultar del feed (borrada o archivada)'}</button>`
      + (im && im.f ? `<button class="btn2" data-act="prevtotray" data-id="${esc(id)}">Devolver la foto a la bandeja</button>` : '')
      + (it.own || it.hidden ? `<button class="btn2" data-act="prevrestore" data-id="${esc(id)}">Restaurar como estaba</button>` : '')
      + `</div>`;
    d.innerHTML = `<div class="card post" role="dialog" aria-label="${esc(it.name)}"><button class="x" data-act="close" title="Cerrar" aria-label="Cerrar">×</button>
      <div class="phead"><h3>${esc(it.name)}</h3><p><span>${esc(fmtDate(it.date))} · ${esc(it.type || '')}</span><span class="st ok" style="background:#737373">Publicada</span>${it.hidden ? '<span class="st chg">Oculta</span>' : ''}${it.own ? '<span class="st" style="background:#0095f6">Editada en la mesa</span>' : ''}</p></div>
      <div class="pbody"><div class="pleft">${left}</div>
        <div class="pright"><span class="nlab">Mes anterior <span>· solo cambia la vista del feed, no Notion</span></span>${acts}
          <p class="muted" style="margin:12px 0 0">Para cambiar la foto, arrastra una de la bandeja sobre su casilla. Para intercambiar dos publicaciones, arrastra una sobre la otra.</p></div></div></div>`;
    if (d.hidden || d.dataset.slot !== id) clearToasts();
    repeCancel(); d.hidden = false; d.dataset.slot = id; d.dataset.prev = '1'; delete d.dataset.dlg;
    if (fresh) focusClose(d);
    if (im && im.f && M.files[im.f]) { layoutStage(); loadBig(im.f); }
    markReframe();
  }
  // rule-of-thirds lines over the post frame: shown only while reframing — panning, and for a moment after a zoom, format or
  // «Centrar» change (those re-render the stage, so the moment is kept in reframeUntil)
  const THIRDS = '<div class="thirds" aria-hidden="true"><i></i><i></i><i></i><i></i></div>';
  // carousel arrows as in Instagram: a small translucent white circle with a chevron
  const CHEV = { l: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5.5 8.5 12l6.5 6.5"/></svg>', r: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5.5l6.5 6.5L9 18.5"/></svg>' };
  let reframeUntil = 0, reframeTimer = null;
  function markReframe() { const st = root && root.querySelector('.detail .stage'); if (st) st.classList.toggle('reframe', Date.now() < reframeUntil); }
  function flashThirds() {
    reframeUntil = Date.now() + 1000; markReframe();
    clearTimeout(reframeTimer); reframeTimer = setTimeout(() => { reframeTimer = null; markReframe(); }, 1010);
  }
  function layoutStage() {
    const st = root && root.querySelector('.detail .stage'); if (!st) return;
    const s = slot(st.dataset.slot), fid = st.dataset.file; if (!s || !M.files[fid]) return;
    const R = slotRatio(s, fid, bOf(s));
    const W = Math.max(200, st.parentElement.clientWidth || 300);
    const n = (slot(st.dataset.slot) || { photos: [] }).photos.length;
    const ph = root.querySelector('.detail .phead'), hh = ph ? ph.offsetHeight : 80;
    const H = Math.max(220, Math.min(680, window.innerHeight * 0.62, window.innerHeight - hh - (n > 1 ? 285 : 205)));
    let w = W, h = W / R; if (h > H) { h = H; w = H * R; }
    st.style.width = Math.round(w) + 'px'; st.style.height = Math.round(h) + 'px';
    placeBig();
  }
  function placeBig() {
    const st = root && root.querySelector('.detail .stage'); if (!st) return;
    const s = slot(st.dataset.slot), fid = st.dataset.file, f = M.files[fid]; if (!s || !f) return;
    const p = postRect(fid, s, bOf(s)), g = gridRect(fid, s, bOf(s));
    st.querySelector('img.big').setAttribute('style', rectStyle(f, p));
    // dashed frame = the 3:4 the profile grid will show (hidden when it is the whole post)
    const gg = st.querySelector('.gguide');
    if (gg) {
      const same3x4 = Math.abs(g.w - p.w) < 1 && Math.abs(g.h - p.h) < 1;
      gg.hidden = same3x4;
      if (!same3x4) gg.setAttribute('style', `left:${((g.x - p.x) / p.w * 100).toFixed(3)}%;top:${((g.y - p.y) / p.h * 100).toFixed(3)}%;width:${(g.w / p.w * 100).toFixed(3)}%;height:${(g.h / p.h * 100).toFixed(3)}%`);
    }
    const fixed = !st.dataset.live && p.w >= f.w - 1 && p.h >= f.h - 1;
    st.classList.toggle('fixed', fixed);
    const hint = root.querySelector('.detail .phint'); if (hint) hint.textContent = st.dataset.live ? 'Arrastra la foto para reencuadrar: el texto se queda' : fixed ? 'Se ve entera: usa el zoom para reencuadrar' : 'Arrastra la foto para reencuadrar';
  }
  async function loadBig(fid) {
    try {
      M.bigUrls = M.bigUrls || {}; M.bigOrder = (M.bigOrder || []).filter(x => x !== fid); M.bigOrder.push(fid);
      if (!M.bigUrls[fid]) M.bigUrls[fid] = URL.createObjectURL(await getBlob(fid));
      while (M.bigOrder.length > 6) { const old = M.bigOrder.shift(); if (M.bigUrls[old]) URL.revokeObjectURL(M.bigUrls[old]); delete M.bigUrls[old]; if (!upBusy(M.uploads[old]) && !upBusy(M.zUploads[old])) delete M.blobs[old]; }
      const st = root.querySelector('.detail .stage'); if (st && st.dataset.file === fid) st.querySelector('img.big').src = M.bigUrls[fid];
    } catch (e) { /* keep the thumbnail */ }
  }
  function closeDetail() {
    repeCancel();
    if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; save(); renderFeed(); renderBar(); }
    const d = root && root.querySelector('.detail'); if (!d) return;
    const wasPrev = d.dataset.prev; if (d.dataset.dlg === 'addmode') pendingAdd = null;
    if (d.dataset.dlg === 'editclient' && avStage) { if (avStage.id) avDiscard(); else avStage = null; }
    d.hidden = true; d.innerHTML = ''; delete d.dataset.slot; delete d.dataset.dlg; delete d.dataset.prev; delete d.dataset.file; pickOpen = null; ig = null;
    if (wasPrev && prevOnce) { prevOnce = false; renderFeed(); }
  }
  // the designer loads on its own (async script): «Diseñar» waits for it a few seconds; a script that failed is said at once
  async function waitDesigner(id) {
    const failed = () => (window.MESA_CARGA || {}).diseno === 'fallo', B = S;
    if (!failed()) { toast('Cargando el diseñador…'); for (let i = 0; i < 150 && !(M.diseno && M.diseno.abrir) && !failed(); i++) await new Promise(r => setTimeout(r, 100)); }
    if (M.diseno && M.diseno.abrir) { if (S === B && slot(id)) M.diseno.abrir(id); }
    else toast('El diseñador no está cargado: recarga la página.');
  }
  async function waitLibre(id, k, opts) {     // the same for the free editor (libre.js)
    const failed = () => (window.MESA_CARGA || {}).libre === 'fallo', B = S;
    if (!failed()) { toast('Cargando el editor…'); for (let i = 0; i < 150 && !(M.libre && M.libre.abrir) && !failed(); i++) await new Promise(r => setTimeout(r, 100)); }
    if (M.libre && M.libre.abrir) { if (S === B && slot(id)) M.libre.abrir(id, k, opts); }
    else toast('El editor no está cargado: recarga la página.');
  }
  // the post view's «✓ en Notion» / «cambiada» and its state after a change made in it (the rest of the view stays as it is)
  function syncEstado(id) {
    const d = root && root.querySelector('.detail'), s = slot(id); if (!d || d.hidden || d.dataset.slot !== id || !s || isPrev(s)) return;
    const p = d.querySelector('.phead p'); if (!p) return;
    const old = p.querySelector(':scope > .st'), html = statusBadge(s);
    if (old) old.outerHTML = html; else if (html) p.insertAdjacentHTML('beforeend', html);
    const pe = p.querySelector('.pest'), eh = estadoHTML(s); if (pe && pe.outerHTML !== eh) pe.outerHTML = eh;   // its state follows too
  }
  let refreshLater = false;   // a refresh asked for while a photo is being dragged in the post view: done when it is let go
  function refreshDetail() {
    const d = root && root.querySelector('.detail');
    if (d && d.querySelector('.stage.panning')) { refreshLater = true; return; }
    if (d && !d.hidden && d.dataset.slot) { if (slot(d.dataset.slot)) openDetail(d.dataset.slot, cur.idx); else closeDetail(); }
  }

  // ---------- vista cliente: a post opens as in Instagram (B7) ----------
  // Its real proportion (a carousel with the arrows of T6, a reel in 9:16), the client's name and photo, its caption whole
  // at the top of the side (scrolls if long) and a likes line; comment, share, save and «Añade un comentario…» are only
  // drawn (they do nothing) and there are no comments. «Editar», outside the post's card, opens the post view to edit it
  // or leave a note.
  const IGI = {
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M16.8 3.6c-1.9 0-3.6 1-4.8 2.6-1.2-1.6-2.9-2.6-4.8-2.6C4.3 3.6 2 6 2 9.1c0 5.9 8.2 10.9 10 11.9 1.8-1 10-6 10-11.9 0-3.1-2.3-5.5-5.2-5.5z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20.7 16.9A9.9 9.9 0 1 0 17 20.6L22 22z"/></svg>',
    repost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12V9a4 4 0 0 1 4-4h11M15.5 1.5 19 5l-3.5 3.5M20 12v3a4 4 0 0 1-4 4H5M8.5 22.5 5 19l3.5-3.5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 3 9.2 10.1M22 3l-7 18-5.8-10.9L2 6z"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 21 12 13.4 4 21V3h16z"/></svg>',
    emoji: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 14.5c1 1.3 2.3 2 4 2s3-.7 4-2"/><circle cx="9" cy="9.5" r=".5" fill="currentColor"/><circle cx="15" cy="9.5" r=".5" fill="currentColor"/></svg>'
  };
  let ig = null;                                      // {id, idx, prev}: the post open as in Instagram
  // what a post shows in the feed, as it goes up: [{f, B, s} | {t} | null]
  function igFotos(id) {
    const s = S && S.slots.find(x => x.id === id);
    if (s) return { name: s.name, type: s.type, date: s.date, prev: false, list: publishList(s).filter(f => M.files[f]).map(f => ({ f, B: S, s })) };
    const it = prevItem(id); if (!it) return null;
    const im = prevImg(it);
    return { name: it.name, type: it.type, date: it.date, prev: true, list: im && im.f && M.files[im.f] ? [{ f: im.f, B: im.B, s: it }] : im && im.t && M.pastThumbs[im.t] ? [{ t: im.t }] : [] };
  }
  const igFecha = iso => { const d = new Date(String(iso || '').replace(' ', 'T')); if (isNaN(d)) return ''; const y = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, year: 'numeric' }).format(d); return new Intl.DateTimeFormat('es-ES', { timeZone: TZ, day: 'numeric', month: 'long' }).format(d) + (y !== String(new Date().getFullYear()) ? ' de ' + y : ''); };
  function igTam(R) {                                 // the media box: as big as fits, keeping the post's proportion
    const narrow = window.innerWidth < 720;
    const maxW = narrow ? window.innerWidth * 0.94 : Math.min(window.innerWidth * 0.96, 1180) - 340, maxH = narrow ? window.innerHeight * 0.6 : window.innerHeight * 0.9;
    let w = maxW, h = w / R; if (h > maxH) { h = maxH; w = h * R; }
    return { w: Math.max(160, Math.round(w)), h: Math.max(160, Math.round(h)) };
  }
  // its caption as it went up to Notion (M6): only an uploaded one, and the text uploaded even if edited here since
  function igCaption(id) {
    const s = S && S.slots.find(x => x.id === id), it = !s && prevItem(id);
    const src = s || (it && it.src === 'mesa' && PB ? PB.slots.find(x => x.id === id) : null), x = src && src.caption && src.caption.sent;
    return x && x.text ? x.text : null;
  }
  // as in Instagram: line breaks kept, #hashtags and @mentions in its link colour
  const IG_TAG = /(^|[^\p{L}\p{N}_])(#[\p{L}\p{N}_]+|@[\p{L}\p{N}_]+(?:\.[\p{L}\p{N}_]+)*)/gu;
  function igCapHTML(text) {
    let out = '', i = 0;
    for (const m of text.matchAll(IG_TAG)) { const at = m.index + m[1].length; out += esc(text.slice(i, at)) + `<span class="igtag">${esc(m[2])}</span>`; i = at + m[2].length; }
    return out + esc(text.slice(i));
  }
  async function openIG(id, idx) {
    const P = igFotos(id); if (!P || !shellReady()) return;
    const n = P.list.length; idx = Math.max(0, Math.min(n - 1, idx || 0));
    ig = { id, idx, prev: P.prev };
    await loadClientPhotos();
    const it = P.list[idx];
    let R = 4 / 5, media = `<div class="igph">Sin foto todavía</div>`;
    if (it && it.f) {
      const f = M.files[it.f], r = postRect(it.f, it.s, it.B); R = r.w / r.h;
      media = `<img class="igimg" alt="" src="${f.thumbUrl}" style="${rectStyle(f, r)}">`;
    } else if (it && it.t) {
      const url = M.pastThumbs[it.t], im = new Image(); im.src = url;
      try { await im.decode(); R = im.naturalWidth / im.naturalHeight || R; } catch (e) { /* default */ }
      media = `<img class="igfit" alt="" src="${url}">`;
    }
    if (!ig || ig.id !== id) return;
    const { w, h } = igTam(R), c0 = CL.find(c => c.id === S.client) || {}, handle = String(c0.handle || '').replace(/^@/, '') || c0.name || '';
    // as the first thing under the header: the photo, the user name in bold and the whole text (no «… más»)
    const capText = igCaption(id), cap = capText ? `<div class="igcap">${avatarHTML(c0)}<div class="igct"><b>${esc(handle)}</b> ${igCapHTML(capText)}</div></div>` : '';
    const nav = n > 1 ? `<button class="nav prev" data-act="ignav" data-d="-1" aria-label="Foto anterior" ${idx === 0 ? 'hidden' : ''}>${CHEV.l}</button><button class="nav next" data-act="ignav" data-d="1" aria-label="Foto siguiente" ${idx === n - 1 ? 'hidden' : ''}>${CHEV.r}</button><div class="dots">${P.list.map((_, k) => `<i class="${k === idx ? 'on' : ''}"></i>`).join('')}</div>` : '';
    const d = root.querySelector('.detail');
    d.innerHTML = `<div class="igwrap"><div class="igtop"><button type="button" class="igedit" data-act="igedit" title="Editar la publicación o dejar una nota (solo en tu mesa)">Editar</button><button type="button" class="igx" data-act="close" aria-label="Cerrar">×</button></div>`
      + `<div class="igcard${capText ? ' hascap' : ''}" role="dialog" aria-label="${esc(P.name)}"><div class="igmedia" style="width:${w}px;height:${h}px">${media}${nav}</div>`
      + `<div class="igside"><header class="ighead">${avatarHTML(c0)}<b>${esc(handle)}</b><span class="igmore" aria-hidden="true">${IGI.more}</span></header><div class="igbody">${cap}</div>`
      + `<div class="igacts" aria-hidden="true">${IGI.heart}${IGI.comment}${IGI.repost}${IGI.share}<span class="igsave">${IGI.save}</span></div>`
      + `<div class="iglikes">Les gusta a <b>uribe.visuals</b> y <b>otras personas</b></div><div class="igdate">${esc(igFecha(P.date))}</div>`
      + `<div class="igadd" aria-hidden="true">${IGI.emoji}<span>Añade un comentario…</span><b>Publicar</b></div></div></div></div>`;
    if (d.hidden || d.dataset.dlg !== 'ig') clearToasts();
    repeCancel(); d.hidden = false; d.dataset.dlg = 'ig'; delete d.dataset.slot; delete d.dataset.prev; delete d.dataset.file;
  }
  const igNav = dir => { if (ig) openIG(ig.id, ig.idx + dir); };
  // the editor's «Preview» (libre.js): the pieces of the vista cliente for post s with media of proportion R (w/h); the
  // caption as it will go up — the chosen one, else the one already in Notion
  async function igPieces(s, R) {
    await loadClientPhotos();
    const c0 = CL.find(c => c.id === S.client) || {}, handle = String(c0.handle || '').replace(/^@/, '') || c0.name || '', t = capFinal(s) || igCaption(s.id);
    return { av: avatarHTML(c0), handle: esc(handle), cap: t ? igCapHTML(t) : '', fecha: esc(igFecha(s.date)), IGI, CHEV, tam: igTam(R) };
  }
  function igEditar() {
    const x = ig; closeDetail(); if (!x) return;
    if (x.prev) withPrev(() => openPast(x.id), 'open'); else openDetail(x.id, x.idx);
  }

  // ---------- dialogs (clients, how to add a month) ----------
  function showDialog(kind, html) {
    repeCancel();
    const d = root.querySelector('.detail');
    d.innerHTML = `<div class="card dlg" role="dialog" aria-modal="true">${html}</div>`;
    clearToasts();
    d.hidden = false; delete d.dataset.slot; delete d.dataset.prev; delete d.dataset.file; d.dataset.dlg = kind;
    const first = d.querySelector('input[type=text]'); if (first) first.focus();
  }
  function dlgNewClient() {
    showDialog('newclient', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Nuevo cliente</h3><p>Se crea su pestaña vacía. Después pídele a Claude que cargue el mes desde Notion.</p>
      <form class="form" data-form="newclient" autocomplete="off"><label for="nc-name">Nombre</label><input id="nc-name" name="name" type="text" maxlength="60" placeholder="Ej.: daGiorgio" required>
      <label for="nc-handle">Usuario de Instagram <span>(opcional)</span></label><input id="nc-handle" name="handle" type="text" maxlength="120" placeholder="@usuario">
      <label for="nc-cycle">Inicio de ciclo <span>(día del mes, 1-28)</span></label><input id="nc-cycle" name="cycleDay" type="number" min="1" max="28" step="1" value="1" required>
      <p class="ferr" hidden></p><div class="row"><button type="button" class="btn2" data-act="close">Cancelar</button><button type="submit" class="btn">Crear cliente</button></div></form>`);
  }
  function dlgEditClient() {
    const c = CL.find(x => x.id === curClient); if (!c) return;
    const nm = MB.length;
    showDialog('editclient', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Editar cliente</h3>
      <form class="form" data-form="editclient" autocomplete="off"><label for="ec-name">Nombre</label><input id="ec-name" name="name" type="text" maxlength="60" value="${esc(c.name)}" required>
      <label for="ec-handle">Usuario de Instagram</label><input id="ec-handle" name="handle" type="text" maxlength="120" value="${esc(c.handle || '')}" placeholder="@usuario">
      <label for="ec-cycle">Inicio de ciclo <span>(día del mes, 1-28; los meses ya cargados conservan el suyo)</span></label><input id="ec-cycle" name="cycleDay" type="number" min="1" max="28" step="1" value="${cdOf(c.cycleDay)}" required>
      <label>Foto de perfil <span>(la de su Instagram, para la vista cliente)</span></label><div class="avrow">${avatarHTML(c, 'avprev')}<button type="button" class="btn2" data-act="avpick">Elegir foto…</button><button type="button" class="lnk" data-act="avdel"${c.foto ? '' : ' hidden'}>Quitar</button><input type="file" class="avin" accept="image/jpeg,image/png,image/webp" hidden></div>
      <p class="ferr" hidden></p>
      <div class="row">${nm ? `<span class="left muted">Tiene ${nm} mes${nm === 1 ? '' : 'es'} guardado${nm === 1 ? '' : 's'}: no se puede eliminar.</span>` : '<button type="button" class="btn2 danger left" data-act="delclient">Eliminar cliente</button>'}<button type="button" class="btn2" data-act="close">Cancelar</button><button type="submit" class="btn">Guardar</button></div></form>`);
  }
  function dlgHowMonth() {
    const c = CL.find(x => x.id === curClient), cn = esc(c ? c.name : 'este cliente');
    const last = MB.filter(b => /^\d{4}-\d{2}$/.test(b.month || '')).map(b => addMonths(b.month, (b.span || 1) - 1)).sort().pop();
    const m1 = last ? addMonths(last, 1) : null, n1 = m1 ? MONTHS[+m1.slice(5) - 1] : nextMonthName(c && c.cycleDay);
    const n2 = MONTHS[(MONTHS.indexOf(n1) + 1) % 12];
    showDialog('howmonth', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Añadir otro mes</h3><p>Los meses se cargan desde Notion con las publicaciones del calendario (nombre, fecha, hora y tipo exactos), para que al subir las fotos cada una vaya a su página. Pídeselo a Claude en el chat:</p><p style="color:var(--ink);font-size:14px;margin:12px 0 4px">«Carga ${n1} de ${cn} en la mesa»</p><p>Si ya tienes preparados dos meses, pídelos juntos y se preparan en la misma mesa, con el mes anterior debajo: «Carga ${n1} y ${n2} de ${cn} en la mesa». Las fechas y horas se pueden cambiar aquí; al subir a Notion se cambian allí.</p><div class="form"><div class="row"><button type="button" class="btn" data-act="close">Entendido</button></div></div>`);
  }
  const normHandle = h => { h = String(h || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@+/, ''); return h ? '@' + h : ''; };
  async function submitForm(form) {
    const kind = form.dataset.form, err = form.querySelector('.ferr');
    const name = form.elements.name.value.trim(), handle = normHandle(form.elements.handle.value), cyc = form.elements.cycleDay ? form.elements.cycleDay.value.trim() : '1';
    const fail = m => { err.textContent = m; err.hidden = false; };
    if (!name) return fail('Escribe el nombre del cliente.');
    if (!/^\d+$/.test(cyc) || !okCd(+cyc)) return fail('El inicio de ciclo es un día del 1 al 28.');
    const cycleDay = +cyc;
    if (CL.some(c => c.name.toLowerCase() === name.toLowerCase() && (kind === 'newclient' || c.id !== curClient))) return fail('Ya existe un cliente con ese nombre.');
    if (kind === 'newclient') {
      if (busyGuard()) return;
      const c = await M.addClient({ name, handle, cycleDay }); closeDetail(); await M.openClient(c.id); toast(`Cliente «${c.name}» creado.`);
    } else {
      const av = avStage && avStage.cid === curClient ? avStage : null;
      await M.updateClient(curClient, { name, handle, cycleDay, ...(av ? { foto: av.id } : {}) });
      if (av) avStage = null;                       // kept: the dialog no longer owns it
      closeDetail();
    }
  }
  // ---------- the client's profile photo (vista cliente) ----------
  // A protected file «perfil-<cliente>-<n>» (never in the tray, kept while the client points at it); chosen in «Editar
  // cliente» and saved with «Guardar» (Cancelar discards it); it travels with the export.
  let avStage = null;                                // {cid, id}: chosen in the open dialog, not saved yet ('' = remove)
  function avatarHTML(c, cls) {
    const f = c && c.foto && M.files[c.foto];
    return `<span class="${cls || 'igav'}">${f ? `<img src="${f.thumbUrl}" alt="">` : esc(initials(c ? c.name : '?'))}</span>`;
  }
  async function avPick(file) {
    const c = CL.find(x => x.id === curClient); if (!c || !file) return;
    if (!OK_TYPES.includes(file.type)) { toast('La foto de perfil tiene que ser JPG o PNG.'); return; }
    try {
      const { w, h, thumb } = await makeThumb(file), id = `perfil-${c.id}-${Date.now().toString(36)}`;
      await idbPut('files', id, { name: 'Perfil · ' + file.name, size: file.size, type: file.type, w, h, lastModified: file.lastModified || 0, blob: file, thumb });
      await avDiscard();
      avStage = { cid: c.id, id }; await loadThumbs([id]);
      const d = root.querySelector('.detail'); if (d.dataset.dlg !== 'editclient') { await avDiscard(); return; }
      d.querySelector('.avprev').outerHTML = avatarHTML({ ...c, foto: id }, 'avprev'); d.querySelector('[data-act="avdel"]').hidden = false;
    } catch (e) { toast('No se pudo leer esa foto.'); }
  }
  const loadClientPhotos = () => loadThumbs(CL.map(c => c.foto).filter(f => f && !M.files[f]));
  async function avDiscard() { const a = avStage; avStage = null; if (a && a.id) { try { await idbDel('files', a.id); } catch (e) { /* */ } delete M.files[a.id]; delete M.thumbBlobs[a.id]; } }

  // ---------- messages ----------
  function clearToasts() { if (shellReady()) root.querySelector('.toasts').innerHTML = ''; }
  function toast(msg, opt) {
    if (!shellReady()) { toastQ.push({ msg, opt, at: Date.now() }); toastQ = toastQ.slice(-3); return; }
    const box = root.querySelector('.toasts');
    const key = (opt && opt.key) || msg;   // the same message replaces the previous one, unless it has its own key
    [...box.children].forEach(el => { if (el.dataset.msg === key) el.remove(); });
    while (box.children.length >= 2) box.firstElementChild.remove();
    const t = document.createElement('div'); t.className = 'toast'; t.dataset.msg = key;
    const span = document.createElement('span'); span.textContent = msg; t.append(span);
    if (opt && opt.action) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = opt.action;
      b.addEventListener('click', () => { t.remove(); opt.onAction(); });
      t.append(b);
    }
    root.querySelector('.toasts').append(t);
    setTimeout(() => t.remove(), (opt && opt.ms) || 4200);
  }
  function setBusy(kind, msg) {
    busyText[kind] = msg || null;
    const text = [busyText.imp, busyText.up, busyText.dz, busyText.sel].filter(Boolean).join(' · ');
    M.busyText = [busyText.imp, busyText.up, busyText.dz].filter(Boolean).join(' · ') || null;
    if (!shellReady()) return;
    const b = root.querySelector('.busy'); b.textContent = text; b.hidden = !text;
  }
  function setSave(msg, err) { if (!shellReady()) return; const s = root.querySelector('.save'); s.textContent = msg; s.classList.toggle('err', !!err); }
  function busyGuard() {
    if (uploadsBusy()) { toast('Espera a que termine la subida de fotos.'); return true; }
    if (importing) { toast('Espera a que terminen de prepararse las fotos.'); return true; }
    return false;
  }

  // ---------- events ----------
  const hasFiles = e => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  function clearOver() { root.querySelectorAll('.over').forEach(el => el.classList.remove('over')); }

  // ---------- Nota edited in its cell ----------
  // Once the post-it has opened (0.5 s of hover, as the CSS does), a click on it does nothing and a double click turns it
  // into a text field right there; it ends on leaving the field or with Esc. Without a Nota nothing changes (post view).
  let hov = { id: null, t: 0 };
  let memosOpen = false;                 // «Abrir notas»: every Nota open at once until «Cerrar notas»
  const pitOpen = id => !!id && (memosOpen || (hov.id === id && Date.now() - hov.t >= 500));
  function fitPit(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  function editMemo(id) {
    const s = S && S.slots.find(x => x.id === id);
    if (!s || !memoOf(s) || locked || root.classList.contains('client')) return false;
    memoEdit = id; renderFeed();
    const ta = root.querySelector(`.feed .pitin[data-slot="${cssq(id)}"]`); if (!ta) { memoEdit = null; return false; }
    ta.focus({ preventScroll: true }); const n = ta.value.length; ta.setSelectionRange(n, n);
    return true;
  }
  let memoStale = false;                 // the feed was redrawn around the edited cell: redraw it all once editing ends
  function endMemoEdit() {
    if (!memoEdit) return;
    const id = memoEdit, s = S && S.slots.find(x => x.id === id), p = root && root.querySelector(`.feed .pit.edit[data-memo="${cssq(id)}"]`);
    memoEdit = null;
    if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; save(); renderBar(); }
    if (p) { if (s && memoOf(s)) p.outerHTML = postit(s); else p.remove(); }
    if (hov.id === id) hov.t = Date.now();
    if (memoStale || !p) { memoStale = false; whenReleased(renderFeed); }
  }
  // runs fn now, or once the mouse button is up and its click has been delivered (a redraw would swallow that click)
  let btnDown = false;
  function whenReleased(fn) {
    if (!btnDown) return fn();
    const h = () => { document.removeEventListener('pointerup', h, true); document.removeEventListener('pointercancel', h, true); setTimeout(fn, 0); };
    document.addEventListener('pointerup', h, true); document.addEventListener('pointercancel', h, true);
  }

  // ---------- moving photos and Notas with the mouse ----------
  // The mesa's own drag (pointer events), not the browser's: the cursor stays the system arrow and turns into the closed
  // hand only while a photo (or a Nota) is being carried, with a copy of it under the mouse. Files from the computer still
  // come through the browser's drag and drop (the drag* handlers below, which also take synthetic drag events).
  // where a carried item would land over element t: {el: what lights up, cell | pc | tray} — null = not there
  function dragTarget(t, d) {
    if (!t || !t.closest || !d) return null;
    const cell = t.closest('.cell[data-slot], .cell.past[data-prev]'), tray = t.closest('.tray');
    if (d.from === 'memo') return cell && cell.dataset.slot && cell.dataset.slot !== d.slotId ? { el: cell, cell } : null;
    if (cell && cell.dataset.prev && d.from === 'slot') return null;
    if (cell && cell.dataset.slot && d.from === 'prev') return null;
    const hueco = d.from === 'tray' && t.closest('.cell.filler'); if (hueco) return { el: hueco, hueco };
    const hcard = d.from === 'tray' && t.closest('.hv-card[data-h]'); if (hcard) return { el: hcard, hcard };
    if (cell) return cell.dataset.slot ? { el: cell, cell } : { el: cell, pc: cell };
    if (tray) return { el: tray, tray };
    return null;
  }
  function dropOn(d, { cell, pc, tray, hueco, hcard }) {
    if (hcard) { if (M.hs) M.hs.soltar(hcard.dataset.h, d.fileId); return; }
    if (d.from === 'memo') { if (cell) moveMemo(d.slotId, cell.dataset.slot); return; }
    if (hueco) { if (d.from === 'tray') setPreview(+hueco.dataset.filler, d.fileId); return; }
    if (pc) {
      if (d.from === 'tray') prevDesdeBandeja(pc.dataset.prev, d.fileId);
      else if (d.from === 'prev') withPrev(() => prevSwap(d.prevId, pc.dataset.prev), 'edit');
    }
    else if (cell) {
      if (d.from === 'tray') addToSlot(cell.dataset.slot, [d.fileId]);
      else if (d.from === 'slot') swap(d.slotId, cell.dataset.slot);
      else toast('Una publicación del mes anterior no pasa directamente al mes nuevo: arrástrala antes a la bandeja.');
    }
    else if (tray && d.from === 'slot') unassign(d.slotId, null, true);
    else if (tray && d.from === 'prev') withPrev(() => prevToTray(d.prevId), 'edit');
  }
  function dragSource(t) {
    if (!t || !t.closest || t.closest('.pit.edit, textarea, input, .detail')) return null;
    const act = t.closest('[data-act]'); if (act && !act.matches('.titem .x, .cell.past .pmonth')) return null;
    const pm = t.closest('.pit[data-memo]'); if (pm) return { from: 'memo', slotId: pm.dataset.memo, el: pm };
    const ti = t.closest('.titem[data-file]'); if (ti) return { from: 'tray', fileId: ti.dataset.file, el: ti };
    const ce = t.closest('.cell.full[data-slot]'); if (ce) return { from: 'slot', slotId: ce.dataset.slot, el: ce };
    const pc = t.closest('.cell.past[data-prev]'); if (pc) return { from: 'prev', prevId: pc.dataset.prev, el: pc };
    return null;
  }
  let pd = null, pdNoClick = false, pdHold = null, stripNoClick = false;   // stripNoClick: a thumbnail of the post view was just dragged   // the mouse drag in progress (pd.on once it really moves); pdHold: a cancelled one still pressed
  function pdDown(e) {
    pdHold = null;
    if (e.button !== 0 || e.ctrlKey || e.pointerType === 'touch' || pd || drag || !S || locked) return;
    const d = dragSource(e.target); if (!d) return;
    pd = { d, id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
  }
  function pdBegin() {
    const d = pd.d;
    if (!d.el.isConnected) {                                       // re-drawn while pressed (e.g. a Nota being edited ended)
      const q = d.from === 'memo' ? `.feed .pit[data-memo="${cssq(d.slotId)}"]` : d.from === 'tray' ? `.titem[data-file="${cssq(d.fileId)}"]` : d.from === 'slot' ? `.cell.full[data-slot="${cssq(d.slotId)}"]` : `.cell.past[data-prev="${cssq(d.prevId)}"]`;
      d.el = root.querySelector(q); if (!d.el) { pd = null; return false; }
    }
    if (d.from === 'prev' && prevLocked()) { pd = null; withPrev(() => {}, 'none'); return false; }
    const r = d.el.getBoundingClientRect(), g = document.createElement('div');
    g.className = 'pdghost';
    if (d.from === 'memo') { g.innerHTML = `<span class="pit">${POSTIT}</span>`; g.style.width = g.style.height = '17px'; pd.dx = pd.dy = 8; }
    else {
      const c = d.el.cloneNode(true);
      c.classList.remove('dragging', 'over', 'sel'); c.removeAttribute('title');
      c.querySelectorAll('.bd, .pmonth, .x, .pit').forEach(x => x.remove());
      g.appendChild(c); g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
      pd.dx = pd.x - r.left; pd.dy = pd.y - r.top;
    }
    root.appendChild(g); pd.ghost = g; pd.on = true;
    drag = d; d.el.classList.add('dragging'); root.classList.add('grabbing');
    try { const sl = window.getSelection(); if (sl) sl.removeAllRanges(); } catch (err) { /* */ }
    return true;
  }
  function pdAt(x, y) {
    pd.lx = x; pd.ly = y;
    pd.ghost.style.transform = `translate(${Math.round(x - pd.dx)}px,${Math.round(y - pd.dy)}px)`;
    const t = document.elementFromPoint(x, y), tg = dragTarget(t, pd.d), el = tg ? tg.el : null;
    if (el !== pd.over || (el && !el.classList.contains('over'))) { clearOver(); if (el) el.classList.add('over'); pd.over = el; }
    // held near the top or bottom edge of the feed or the tray — or past it, over the bars or out of the window — (0.3 s, so
    // starting a drag there doesn't scroll): it scrolls little by little, faster the closer to the edge or the further past it
    const { box, sv } = edgeScroll(t, x, y);
    if (!sv || box !== pd.sb) pd.zt = sv ? Date.now() : 0;
    else if (!pd.zt) pd.zt = Date.now();
    pd.sv = sv; pd.sb = box;
    if (sv && !pd.raf) pd.raf = requestAnimationFrame(pdTick);
  }
  // the scroll a carried item makes at x, y: the feed or tray under it (or, past their edge, the one whose column it is in);
  // the edge zone starts under its sticky header; 2–10 px per frame
  function edgeScroll(t, x, y) {
    const E = 40, speed = d => Math.round(2 + Math.min(1, d / 60) * 8);
    let box = t && t.closest ? t.closest('.feed, .tray') : null;
    if (!box) box = [...root.querySelectorAll('.feed, .tray')].find(b => { const r = b.getBoundingClientRect(); return x >= r.left && x < r.right && (y < r.top || y >= r.bottom); }) || null;
    if (!box) return { box: null, sv: 0 };
    const b = box.getBoundingClientRect(), hd = box.querySelector('.legend, .trayhead'), top = hd && hd.offsetParent ? Math.max(b.top, hd.getBoundingClientRect().bottom) : b.top;
    if (y < top + E) return { box, sv: -speed(top + E - y) };
    if (y > b.bottom - E) return { box, sv: speed(y - b.bottom + E) };
    return { box, sv: 0 };
  }
  function pdTick() {
    if (!pd || !pd.on) return;
    pd.raf = 0;
    if (!pd.sv || !pd.sb) return;
    if (Date.now() - pd.zt < 300) { pd.raf = requestAnimationFrame(pdTick); return; }
    const top = pd.sb.scrollTop; pd.sb.scrollTop = top + pd.sv;
    if (pd.sb.scrollTop !== top) pdAt(pd.lx, pd.ly);
  }
  function pdMove(e) {
    if (!pd || e.pointerId !== pd.id) return;
    if (!(e.buttons & 1)) { pdCancel(); return; }      // its release never reached the page
    if (!pd.on && (Math.hypot(e.clientX - pd.x, e.clientY - pd.y) < 5 || !pdBegin())) return;
    e.preventDefault();
    pdAt(e.clientX, e.clientY);
  }
  function pdEnd() {
    const p = pd; pd = null; if (!p) return;
    if (p.raf) cancelAnimationFrame(p.raf);
    if (p.ghost) p.ghost.remove();
    if (p.d.el) p.d.el.classList.remove('dragging');
    root.classList.remove('grabbing'); clearOver();
    if (drag === p.d) drag = null;
    if (p.on) { pdNoClick = true; setTimeout(() => { pdNoClick = false; }, 0); }   // the click of that same release is not a click on a cell
  }
  function pdUp(e) {
    if (pdHold === e.pointerId) { pdHold = null; pdNoClick = true; setTimeout(() => { pdNoClick = false; }, 0); return; }
    if (!pd || e.pointerId !== pd.id) return;
    const p = pd, tg = p.on ? dragTarget(document.elementFromPoint(e.clientX, e.clientY), p.d) : null;
    pdEnd();
    if (tg && S) dropOn(p.d, tg);
    if (p.on) flushRender();
  }
  function pdCancel() { const on = pd && pd.on, id = pd && pd.id; pdEnd(); if (on) { pdHold = id; flushRender(); } }
  // after a redraw during a drag: the item carried stays faded and the target lit
  function pdRefresh() {
    if (!pd || !pd.on) return;
    const d = pd.d;
    if (!d.el || !d.el.isConnected) {
      const q = d.from === 'memo' ? `.feed .pit[data-memo="${cssq(d.slotId)}"]` : d.from === 'tray' ? `.titem[data-file="${cssq(d.fileId)}"]` : d.from === 'slot' ? `.cell.full[data-slot="${cssq(d.slotId)}"]` : `.cell.past[data-prev="${cssq(d.prevId)}"]`;
      const el = root.querySelector(q); if (el) { d.el = el; el.classList.add('dragging'); }
    }
    pd.over = null; if (pd.lx != null) pdAt(pd.lx, pd.ly);
  }

  function wire() {
    if (!M._winWired) {
      M._winWired = true;
      window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
      window.addEventListener('drop', e => { if (hasFiles(e)) e.preventDefault(); });
    }
    root.addEventListener('dragstart', e => {
      if (e.target.closest && e.target.closest('textarea, input, .pit.edit')) return;      // dragging selected text
      if (e.isTrusted && dragSource(e.target)) { e.preventDefault(); return; }              // the mouse drag is the mesa's own (pd*)
      const pm = e.target.closest && e.target.closest('.pit[data-memo]');   // a Nota (post-it) moves on its own
      if (pm) {
        drag = { from: 'memo', slotId: pm.dataset.memo, el: pm };
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'mesa'); pm.classList.add('dragging'); return;
      }
      const ti = e.target.closest && e.target.closest('.titem[data-file]');
      const ce = e.target.closest && e.target.closest('.cell.full[data-slot]');
      const pc = e.target.closest && e.target.closest('.cell.past[data-prev]');
      if (ti) drag = { from: 'tray', fileId: ti.dataset.file, el: ti };
      else if (ce) drag = { from: 'slot', slotId: ce.dataset.slot, el: ce };
      else if (pc) {
        if (prevLocked()) { e.preventDefault(); withPrev(() => {}, 'none'); return; }
        drag = { from: 'prev', prevId: pc.dataset.prev, el: pc };
      }
      else return;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'mesa');
      const img = drag.el.querySelector('img'); if (img) e.dataTransfer.setDragImage(img, img.clientWidth / 2, img.clientHeight / 2);
      drag.el.classList.add('dragging');
    });
    root.addEventListener('dragend', () => { if (drag && drag.el) drag.el.classList.remove('dragging'); drag = null; clearOver(); flushRender(); });
    root.addEventListener('dragover', e => {
      if (!drag && !hasFiles(e)) return;
      const cell = e.target.closest('.cell[data-slot], .cell.past[data-prev]');
      const tray = e.target.closest('.tray');
      clearOver();
      const pv = postDrop(e); if (pv && hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; pv.classList.add('over'); return; }
      if (drag) { const tg = dragTarget(e.target, drag); if (tg) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; tg.el.classList.add('over'); } return; }
      if (cell) { e.preventDefault(); e.dataTransfer.dropEffect = hasFiles(e) ? 'copy' : 'move'; cell.classList.add('over'); }
      else if (tray) { e.preventDefault(); e.dataTransfer.dropEffect = hasFiles(e) ? 'copy' : 'move'; tray.classList.add('over'); }
      else if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
    });
    root.addEventListener('dragleave', e => { if (!e.relatedTarget || !root.contains(e.relatedTarget)) clearOver(); });
    root.addEventListener('drop', e => {
      const cell = e.target.closest('.cell[data-slot]');
      const pc = e.target.closest('.cell.past[data-prev]');
      const tray = e.target.closest('.tray');
      clearOver();
      if (hasFiles(e)) {
        e.preventDefault(); drag = null;
        if (!S) { toast('Abre un mes antes de añadir fotos.'); return; }
        const pv = postDrop(e); if (pv) { M.addFiles(e.dataTransfer.files, root.querySelector('.detail').dataset.slot); return; }
        if (pc) { const id = pc.dataset.prev; M.addFiles(e.dataTransfer.files, null).then(got => { if (got && got[0]) withPrev(() => prevSetFromTray(id, got[0]), 'edit'); }); return; }
        const tgt = cell && S.slots.find(x => x.id === cell.dataset.slot);
        if (tgt && tgt.photos.length && isMulti(tgt.type)) { const sid = tgt.id; M.addFiles(e.dataTransfer.files, null, { aviso: sid }).then(got => askAddMode(sid, got)); return; }
        M.addFiles(e.dataTransfer.files, cell ? cell.dataset.slot : null); return;
      }
      if (!drag || !S) return;
      e.preventDefault();
      const d = drag; drag = null;
      dropOn(d, { cell, pc, tray, hueco: e.target.closest('.cell.filler') });
      flushRender();
    });
    // the mouse drag (see pdDown…): starts on the photo, follows the mouse anywhere on the page
    root.addEventListener('pointerdown', pdDown);
    if (M._pd) { document.removeEventListener('pointermove', M._pd.move, true); document.removeEventListener('pointerup', M._pd.up, true); document.removeEventListener('pointercancel', M._pd.cancel, true); window.removeEventListener('blur', M._pd.cancel); }
    if (M._pd) { document.removeEventListener('pointerdown', M._pd.down, true); document.removeEventListener('contextmenu', M._pd.cancel, true); }
    M._pd = { move: pdMove, up: e => { btnDown = false; pdUp(e); }, cancel: () => { btnDown = false; pdCancel(); }, down: e => { btnDown = e.button === 0; pdHold = null; } };
    document.addEventListener('pointerdown', M._pd.down, true); document.addEventListener('contextmenu', M._pd.cancel, true);
    document.addEventListener('pointermove', M._pd.move, true); document.addEventListener('pointerup', M._pd.up, true); document.addEventListener('pointercancel', M._pd.cancel, true); window.addEventListener('blur', M._pd.cancel);
    root.addEventListener('click', e => { if (pdNoClick || stripNoClick) { pdNoClick = false; stripNoClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
    // the post view's thumbnails (a carousel's or a Foto's pages, not a designed post's) are dragged into another place
    root.addEventListener('pointerdown', e => {
      const th = e.button === 0 && e.target.closest && e.target.closest('.detail .card.post .strip .th[data-act="pick"]'); if (!th) return;
      const s = slot(root.querySelector('.detail').dataset.slot);
      if (!s || isPrev(s) || !isCarousel(s.type) || designed(s) || s.photos.length < 2 || locked) return;
      const strip = th.parentElement, k = +th.dataset.k, x0 = e.clientX, y0 = e.clientY, ths = () => [...strip.querySelectorAll('.th[data-act="pick"]')];
      let on = false, to = null;
      const aim = ev => {                  // the place it would drop at: before or after the nearest thumbnail
        let best = null;
        ths().forEach((t, i) => { const r = t.getBoundingClientRect(), cx = r.left + r.width / 2, d = Math.abs(ev.clientX - cx); t.classList.remove('dl', 'dr'); if (!best || d < best.d) best = { d, i, t, after: ev.clientX > cx }; });
        if (!best) return;
        best.t.classList.add(best.after ? 'dr' : 'dl');
        to = best.i + (best.after ? 1 : 0); if (to > k) to--;
      };
      const mv = ev => {
        if (!on) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; on = true; th.classList.add('drg'); }
        aim(ev);
        const r = strip.getBoundingClientRect(); if (ev.clientX < r.left + 24) strip.scrollLeft -= 12; else if (ev.clientX > r.right - 24) strip.scrollLeft += 12;
      };
      const end = drop => ev => {
        document.removeEventListener('pointermove', mv, true); document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', cancel, true);
        if (drop && !on && Math.hypot(ev.clientX - x0, ev.clientY - y0) >= 6) on = true;   // released far away before any move was seen
        if (drop && on) aim(ev);
        ths().forEach(t => t.classList.remove('drg', 'dl', 'dr'));
        if (!on) return;
        stripNoClick = true; setTimeout(() => { stripNoClick = false; }, 0);
        if (drop && to != null && to !== k) movePhoto(s.id, k, to);
      };
      const up = end(true), cancel = end(false);
      document.addEventListener('pointermove', mv, true); document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', cancel, true);
    });
    // the post-it under the mouse and since when (it opens after 0.5 s)
    root.addEventListener('pointerover', e => { const p = e.target.closest && e.target.closest('.pit[data-memo]'), id = p ? p.dataset.memo : null; if (id !== hov.id) hov = { id, t: Date.now() }; });
    root.addEventListener('pointerout', e => { const p = e.target.closest && e.target.closest('.pit[data-memo]'); if (p && !(e.relatedTarget && p.contains(e.relatedTarget))) hov = { id: null, t: 0 }; });
    root.addEventListener('dblclick', e => {
      const p = e.target.closest && e.target.closest('.feed .pit[data-memo]');
      if (!p || p.classList.contains('edit') || sel || !pitOpen(p.dataset.memo)) return;
      e.preventDefault(); editMemo(p.dataset.memo);
    });
    root.addEventListener('pointerdown', e => { downOnBackdrop = !!(e.target.classList && e.target.classList.contains('detail')); }, true);
    root.addEventListener('wheel', e => {
      const tb = e.target.closest && e.target.closest('.tbody, .bar .months');   // narrow strips: the wheel scrolls them sideways
      if (!tb || tb.scrollWidth <= tb.clientWidth + 1 || tb.scrollHeight > tb.clientHeight + 1 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      tb.scrollLeft += e.deltaY; e.preventDefault();
    }, { passive: false });
    root.addEventListener('click', e => {
      if (e.target.matches && e.target.matches('.cappick')) { unsetCapPick(e.target.dataset.slot, +e.target.dataset.k); return; }   // before its change: a 2nd click on the chosen one
      const a = e.target.closest('[data-act]');
      if (a) { onAct(a, e); return; }
      if (e.target.classList.contains('detail')) { if (downOnBackdrop) closeDetail(); return; }
      if (!S) return;
      const ti = e.target.closest('.titem[data-file]');
      if (ti) { openTrayView(ti.dataset.file); return; }
      const pc = e.target.closest('.cell.past[data-prev]');
      if (pc) {
        const id = pc.dataset.prev;
        if (root.classList.contains('client')) { openIG(id, 0); return; }   // vista cliente: as in Instagram
        if (sel && enVista(sel)) { const f = sel; sel = null; renderTray(); renderBar(); prevDesdeBandeja(id, f); return; }
        withPrev(() => openPast(id), 'open'); return;
      }
      const pit = e.target.closest('.pit[data-memo]');     // an open Nota: a click reads, a double click edits
      if (pit && (pit.classList.contains('edit') || (!sel && pitOpen(pit.dataset.memo)))) return;
      const hueco = e.target.closest('.cell.filler');
      if (hueco && sel && enVista(sel) && !root.classList.contains('client')) { const f = sel; sel = null; setPreview(+hueco.dataset.filler, f); return; }
      const cell = e.target.closest('.cell[data-slot]');
      if (cell) {
        const id = cell.dataset.slot;
        if (root.classList.contains('client')) { sel = null; openIG(id, 0); return; }   // vista cliente: as in Instagram
        if (sel && enVista(sel)) { const f = sel; sel = null; addToSlot(id, [f]); return; }
        sel = null;
        openDetail(id, 0);
      }
    });
    root.addEventListener('submit', e => { e.preventDefault(); const f = e.target.closest('form[data-form]'); if (f) submitForm(f); });
    root.addEventListener('input', e => {
      if (!e.target.matches) return;
      if (e.target.matches('textarea.note')) setNote(e.target.dataset.slot, e.target.value);
      else if (e.target.matches('textarea.memo')) setMemo(e.target.dataset.slot, e.target.value);
      else if (e.target.matches('textarea.capt')) {
        const id = e.target.dataset.slot, k = +e.target.dataset.k, c = capOf(slot(id)), b = e.target.closest('.capbox');
        setCapText(id, k, e.target.value); fitPit(e.target);
        if (c && b) b.classList.toggle('edited', e.target.value !== c.orig[k]);   // «Editado» / «Volver al original» as soon as it differs
      }
      else if (e.target.matches('.pitin')) { setMemo(e.target.dataset.slot, e.target.value); fitPit(e.target); }
      else if (e.target.matches('.zoomr')) {
        flashThirds(); const s = slot(cur.slot); if (s) touchPrev(s);
        const st = root.querySelector('.detail .stage'); if (st && st.dataset.live) { if (M.diseno && M.diseno.vistaZoom) M.diseno.vistaZoom(+e.target.value); return; }
        const fid = s && s.photos[cur.idx]; if (fid) { setCrop(fid, s, { z: +e.target.value }); placeBig(); }
      }
    });
    root.addEventListener('change', e => {
      if (!e.target.matches) return;
      if (e.target.matches('.zoomr')) {
        const st = root.querySelector('.detail .stage');
        if (st && st.dataset.live && M.diseno && M.diseno.vistaSoltar) {   // a designed slide: applied again only if its frame changed
          if (M.diseno.vistaSoltar()) { save(); renderFeed(); renderBar(); rerender(slot(cur.slot)); } else { const cv = st.querySelector('canvas.dzv'); if (cv) cv.hidden = true; }
          return;
        }
        save(); renderFeed(); renderBar(); if (cur.slot) syncEstado(cur.slot);
      }
      else if (e.target.matches('.pwhen input')) onWhen(e.target);
      else if (e.target.matches('.tysel')) setType(e.target.dataset.slot, e.target.value);
      else if (e.target.matches('.essel')) pickEstado(e.target.dataset.slot, e.target.value || null);
      else if (e.target.matches('.clientToggle')) root.classList.toggle('client', e.target.checked);
      else if (e.target.matches('.pinToggle')) { if (!setPin(e.target.dataset.slot, e.target.checked)) e.target.checked = !e.target.checked; }
      else if (e.target.matches('.cappick')) setCapPick(e.target.dataset.slot, +e.target.dataset.k);
      else if (e.target.matches('.picker')) { const fl = e.target.files; if (fl && fl.length) M.addFiles(fl).finally(() => { e.target.value = ''; }); }
      else if (e.target.matches('.avin')) { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) avPick(f); }
    });
    root.addEventListener('focusout', e => {
      if (e.target.matches && e.target.matches('.pitin')) {   // left the Nota being edited in its cell (a re-draw keeps the focus)
        const id = e.target.dataset.slot;
        setTimeout(() => { const a = document.activeElement; if (memoEdit === id && !(a && a.matches && a.matches('.pitin') && a.dataset.slot === id)) endMemoEdit(); }, 0);
        return;
      }
      const el = e.target, s = el.matches && el.matches('.pwhen input') && slot(el.dataset.slot); if (!s) return;
      if (el.classList.contains('dtin') && /^\d{4}-\d{2}-\d{2}$/.test(el.value) && !inBoard(el.value)) outToast();
      resetWhen(el, s);
    });
    root.addEventListener('pointerdown', e => {
      const st = e.target.closest && e.target.closest('.detail .stage');
      if (!st || e.target.closest('.nav') || e.button !== 0) return;
      const s = slot(st.dataset.slot), fid = st.dataset.file, f = M.files[fid]; if (!s || !f) return;
      if (f.design) {                                      // a designed slide: its photo is reframed, drawn live with the texts
        const g = st.dataset.live && M.diseno && M.diseno.vistaEmpezar ? M.diseno.vistaEmpezar() : null; if (!g) return;
        e.preventDefault();
        try { st.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        st.classList.add('panning');
        const sx = e.clientX, sy = e.clientY, sw = st.clientWidth, sh = st.clientHeight;
        const mv = ev => M.diseno.vistaMover(g, (ev.clientX - sx) / sw, (ev.clientY - sy) / sh);
        const up = () => {
          st.removeEventListener('pointermove', mv); st.removeEventListener('pointerup', up); st.removeEventListener('pointercancel', up); st.classList.remove('panning');
          if (M.diseno.vistaSoltar && M.diseno.vistaSoltar()) { save(); renderFeed(); renderBar(); rerender(s); }   // a click alone draws nothing again
          else { const cv = st.querySelector('canvas.dzv'); if (cv) cv.hidden = true; }
          if (refreshLater) { refreshLater = false; refreshDetail(); }
        };
        st.addEventListener('pointermove', mv); st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
        return;
      }
      e.preventDefault();
      touchPrev(s);
      try { st.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      st.classList.add('panning');
      const r0 = postRect(fid, s);
      const sx = e.clientX, sy = e.clientY, cx0 = (r0.x + r0.w / 2) / f.w, cy0 = (r0.y + r0.h / 2) / f.h;
      const sw = st.clientWidth, sh = st.clientHeight;
      const mv = ev => { setCrop(fid, s, { cx: cx0 - (ev.clientX - sx) / sw * (r0.w / f.w), cy: cy0 - (ev.clientY - sy) / sh * (r0.h / f.h) }); placeBig(); };
      const up = () => { st.removeEventListener('pointermove', mv); st.removeEventListener('pointerup', up); st.removeEventListener('pointercancel', up); st.classList.remove('panning'); save(); renderFeed(); renderBar(); syncEstado(s.id); if (refreshLater) { refreshLater = false; refreshDetail(); } };
      st.addEventListener('pointermove', mv); st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
    });
    if (M._onKey) document.removeEventListener('keydown', M._onKey);
    M._onKey = e => {
      if (!shellReady()) return;
      const open = !root.querySelector('.detail').hidden;
      if (e.key === 'Escape' && pd && pd.on) { e.preventDefault(); pdCancel(); return; }
      if (e.key === 'Escape' && e.target.matches && e.target.matches('.pitin')) { e.preventDefault(); e.target.blur(); return; }
      if (e.key === 'Escape') { if (open) closeDetail(); else if (sel) { sel = null; renderTray(); renderBar(); } return; }
      const typing = e.target && /^(TEXTAREA|INPUT)$/.test(e.target.tagName) && e.target.type !== 'range';
      if (open && !typing && root.querySelector('.detail').dataset.dlg === 'trayview' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); trayNav(e.key === 'ArrowLeft' ? -1 : 1); return; }
      if (open && !typing && root.querySelector('.detail').dataset.dlg === 'ig' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); igNav(e.key === 'ArrowLeft' ? -1 : 1); return; }
      if (open && !typing && root.querySelector('.detail').dataset.dlg === 'addmode' && (e.key === '1' || e.key === '2')) { e.preventDefault(); doAddMode(e.key === '1' ? 'replace' : 'add'); return; }
      if (open && !typing && cur.slot && root.querySelector('.detail .stage') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); openDetail(cur.slot, cur.idx + (e.key === 'ArrowLeft' ? -1 : 1)); }
      // ⌘Z / ⇧⌘Z (Ctrl on other systems): undo/redo in the mesa — not while writing in Contexto/Nota (the text field
      // undoes its own typing) nor with a dialog open; the date/time fields and the zoom do use it
      if ((e.metaKey || e.ctrlKey) && !e.altKey && String(e.key).toLowerCase() === 'z') {
        const writing = e.target && (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && /^(text|search|email|url|tel|password|)$/.test(e.target.type || '')));
        if (writing || e.target.isContentEditable || (open && root.querySelector('.detail').dataset.dlg) || drag) return;
        e.preventDefault(); if (e.shiftKey) redo(); else undo();
      }
    };
    document.addEventListener('keydown', M._onKey);
    if (M._mq && M._onMq) { try { M._mq.removeEventListener('change', M._onMq); } catch (e) { /* */ } }
    M._mq = NARROW; M._onMq = () => { if (shellReady()) renderTabs(); };
    try { NARROW.addEventListener('change', M._onMq); } catch (e) { /* old engines */ }
    if (M._onResize) window.removeEventListener('resize', M._onResize);
    M._onResize = () => { layoutStage(); fitCaps(root.querySelector('.detail')); if (ig) openIG(ig.id, ig.idx); };
    window.addEventListener('resize', M._onResize);
    if (M._onHide) { document.removeEventListener('visibilitychange', M._onHide); window.removeEventListener('pagehide', M._onHide); }
    M._onHide = e => {
      if ((e.type === 'pagehide' || document.visibilityState === 'hidden') && M.diseno && M.diseno.volcar) M.diseno.volcar();   // the designer's edit in flight
      if (!(e.type === 'pagehide' || document.visibilityState === 'hidden') || !S || locked || !(saveTimer || noteTimer)) return;
      stamp(S);
      S.savedAt = new Date().toISOString();
      lsSet('mesa-pending', JSON.stringify({ key: S.key, board: S, v: 4 }));   // sync: survives a reload that kills the async write
      flushNow().catch(() => { /* */ });
    };
    document.addEventListener('visibilitychange', M._onHide); window.addEventListener('pagehide', M._onHide);
  }

  async function onAct(a, e) {
    const act = a.dataset.act;
    if (act === 'add') root.querySelector('.picker').click();
    else if (act === 'del') { e.stopPropagation(); removeFile(a.dataset.file); }
    else if (act === 'tfil') trayFiltro(a.dataset.v);
    else if (act === 'close') closeDetail();
    else if (act === 'repe') { const f = repeAsk; repeAsk = null; closeDetail(); if (f) f(a.dataset.m); }
    else if (act === 'unpick') { const s = slot(a.dataset.slot), f = s && s.photos[+a.dataset.k]; if (f && s.design && (isCarousel(s.type) || isReel(s.type)) && (M.files[f] || {}).design) { toast('Para cambiar diapositivas, usa «Diseñar».'); refreshDetail(); return; } unassign(a.dataset.slot, +a.dataset.k); refreshDetail(); }
    else if (act === 'left') { move(a.dataset.slot, +a.dataset.k, -1); openDetail(a.dataset.slot, +a.dataset.k - 1); }
    else if (act === 'right') { move(a.dataset.slot, +a.dataset.k, 1); openDetail(a.dataset.slot, +a.dataset.k + 1); }
    else if (act === 'cover') { setCover(a.dataset.slot, +a.dataset.k); openDetail(a.dataset.slot, 0); }
    else if (act === 'ignav') igNav(+a.dataset.d);
    else if (act === 'igedit') igEditar();
    else if (act === 'caporig') capRevert(a.dataset.slot, +a.dataset.k);
    else if (act === 'pickcover') { pickOpen = pickOpen === a.dataset.slot ? null : a.dataset.slot; openDetail(a.dataset.slot, cur.idx); }
    else if (act === 'setcover') { const id = a.dataset.slot, f = a.dataset.f; pickOpen = null; if (!M.files[f]) return; repetidas([{ name: M.files[f].name, size: M.files[f].size }], { slot: id }).then(r => { if (r) changeCover(id, f); openDetail(id, 0); }); }
    else if (act === 'prev') openDetail(cur.slot, cur.idx - 1);
    else if (act === 'next') openDetail(cur.slot, cur.idx + 1);
    else if (act === 'pick') openDetail(cur.slot, +a.dataset.k);
    else if (act === 'fmt') { flashThirds(); touchPrev(slot(cur.slot)); setFmt(cur.slot, a.dataset.fmt); }
    else if (act === 'center') {
      flashThirds(); const s = slot(cur.slot); touchPrev(s);
      const st = root.querySelector('.detail .stage');
      if (st && st.dataset.live) {
        if (M.diseno && M.diseno.vistaCentrar && M.diseno.vistaCentrar() && M.diseno.vistaSoltar()) { const z = root.querySelector('.detail .zoomr'); if (z) z.value = 1; save(); renderFeed(); renderBar(); rerender(s); }
        else { const cv = st.querySelector('canvas.dzv'); if (cv) cv.hidden = true; }
        return;
      }
      if (s && s.photos[cur.idx]) { setCrop(s.photos[cur.idx], s, { cx: 0.5, cy: 0.5, z: 1 }); save(); renderFeed(); renderBar(); openDetail(cur.slot, cur.idx); }
    }
    else if (act === 'client') { if (a.dataset.id !== curClient && !busyGuard()) await M.openClient(a.dataset.id); }
    else if (act === 'month') { if ((!S || a.dataset.key !== S.key) && !busyGuard()) await M.open(a.dataset.key); }
    else if (act === 'newclient') dlgNewClient();
    else if (act === 'editclient') { await loadClientPhotos(); dlgEditClient(); }
    else if (act === 'avpick') { const i = root.querySelector('.detail .avin'); if (i) i.click(); }
    else if (act === 'avdel') { await avDiscard(); avStage = { cid: curClient, id: '' }; const c = CL.find(x => x.id === curClient); const pv = root.querySelector('.detail .avprev'); if (pv) pv.outerHTML = avatarHTML({ ...c, foto: null }, 'avprev'); a.hidden = true; }
    else if (act === 'howmonth') dlgHowMonth();
    else if (act === 'addfiller') setFillers(fillersOf() + 1);
    else if (act === 'delfiller') delFiller(+a.dataset.k);
    else if (act === 'xfer') dlgXfer();
    else if (act === 'revisar') { if (M.revisar && M.revisar.ver) M.revisar.ver(); else toast((window.MESA_CARGA || {}).revisar === 'fallo' ? 'No se pudo cargar la revisión (revisar.js): recarga la página.' : 'Cargando la revisión… Vuelve a pulsar «Revisar» en un momento.'); }
    else if (act === 'rv-ir') {          // a point of the review: its slide in the editor, or the post's view
      const id = a.dataset.slot, k = +a.dataset.k || 0; closeDetail();
      if (!slot(id)) toast('Esa publicación ya no está en el mes abierto.');
      else if (!a.dataset.ed) openDetail(id, k);
      else if (M.libre && M.libre.abrir) M.libre.abrir(id, k); else waitLibre(id, k);
    }
    else if (act === 'xfer-export') { closeDetail(); M.exportAll(); }   // no await before the save picker: it needs the click
    else if (act === 'xfer-import') { const i = root.querySelector('.detail .xferin'); if (i) i.click(); }
    else if (act === 'xfer-go') { if (xferAsk) xferAsk(true); }
    else if (act === 'disenar') { if (libN(slot(a.dataset.slot))) { toast('Este carrusel tiene diapositivas del editor: quítales la edición en «Editar diapositivas» para usar «Diseñar».', { ms: 7000 }); return; } if (M.diseno && M.diseno.abrir) M.diseno.abrir(a.dataset.slot); else waitDesigner(a.dataset.slot); }
    else if (act === 'editar') { if (M.libre && M.libre.abrir) M.libre.abrir(a.dataset.slot, +a.dataset.k || 0); else waitLibre(a.dataset.slot, +a.dataset.k || 0); }
    else if (act === 'datereset') { const s = slot(a.dataset.slot); if (s && !isPrev(s)) setDate(s.id, s.notionDate, true); }
    else if (act === 'aprobar') pickEstado(a.dataset.slot, 'aprobado');
    else if (act === 'reactivar') pickEstado(a.dataset.slot, null);
    else if (act === 'typereset') { const s = slot(a.dataset.slot); if (s && !isPrev(s) && s.notionType) setType(s.id, s.notionType); }
    else if (act === 'addmode') doAddMode(a.dataset.m);
    else if (act === 'tvnav') trayNav(+a.dataset.d);
    else if (act === 'tvsel') { const f = root.querySelector('.detail').dataset.file; closeDetail(); if (f && S && enVista(f)) { sel = f; renderTray(); renderBar(); } }
    else if (act === 'unlock-once' || act === 'unlock-always') {
      const pu = pendingUnlock; pendingUnlock = null;
      if (act === 'unlock-always') { S.prevUnlocked = true; save(); } else prevOnce = true;
      closeDetail(); renderFeed();
      if (pu) { pu.fn(); if (pu.kind === 'edit') endOnce(); }
    }
    else if (act === 'memos') { memosOpen = !memosOpen; root.classList.toggle('memos', memosOpen); renderFeed(); }
    else if (act === 'prevlock') { if (S.prevUnlocked || prevOnce) { S.prevUnlocked = false; prevOnce = false; save(); renderFeed(); toast('Mes anterior bloqueado.'); } else withPrev(() => {}, 'none'); }
    else if (act === 'prevhide') { const it = prevItem(a.dataset.id); if (it) { it.hidden = !it.hidden; changed(); openPast(it.id); } }
    else if (act === 'prevtotray') { prevToTray(a.dataset.id); openPast(a.dataset.id); }
    else if (act === 'prevrestore') { prevRestore(a.dataset.id); openPast(a.dataset.id); }
    else if (act === 'recargar') location.reload();
    else if (act === 'takeover') { const k = S && S.key; S = null; PB = null; await claim(); if (k && (await idbGet('boards', k))) await M.open(k); else await M.boot(); }
    else if (act === 'delclient') {
      if (a.dataset.confirm !== '1') { a.dataset.confirm = '1'; a.textContent = 'Confirmar: eliminar'; return; }
      const c = CL.find(x => x.id === curClient);
      const r = await M.removeClient(curClient);
      closeDetail();
      if (r === true) toast(`Cliente «${c ? c.name : ''}» eliminado.`); else toast(String(r));
    }
  }

  // ---------- clients ----------
  M.clients = async () => {
    await loadClients();
    const boards = (await idbAll('boards')) || [];
    return CL.map(c => ({ ...c, months: boards.filter(b => b.client === c.id).map(b => b.month).sort() }));
  };
  // cycleDay: the day of the month its work cycle starts (1-28, default 1 = calendar month)
  M.addClient = async ({ id, name, handle, cycleDay } = {}) => {
    if (!okCd(cycleDay)) throw new Error('cycleDay debe ser un día del 1 al 28');
    await loadClients();
    name = String(name || '').trim(); if (!name) throw new Error('falta el nombre');
    const existing = CL.find(c => (id && c.id === id) || c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (cycleDay != null && cycleDay !== '' && existing.cycleDay !== cdOf(cycleDay)) return M.updateClient(existing.id, { cycleDay });
      return existing;
    }
    const base = id ? String(id) : slugify(name);
    let cid = base, k = 2;
    while (CL.some(c => c.id === cid)) cid = base + k++;
    const c = { id: cid, name, handle: normHandle(handle), cycleDay: cdOf(cycleDay), createdAt: new Date().toISOString() };
    await idbPut('clients', cid, c);
    await loadClients();
    if (!curClient && !S) curClient = cid;
    if (shellReady()) render();
    return c;
  };
  M.updateClient = async (id, patch) => {
    if (!okCd(patch.cycleDay)) throw new Error('cycleDay debe ser un día del 1 al 28');
    const c = await idbGet('clients', id); if (!c) return 'no existe';
    if (patch.name != null) c.name = String(patch.name).trim() || c.name;
    if (patch.handle != null) c.handle = normHandle(patch.handle);
    if (patch.cycleDay != null && patch.cycleDay !== '') c.cycleDay = cdOf(patch.cycleDay);   // the boards already made keep theirs
    let gone = null;
    if (patch.foto !== undefined && (patch.foto || null) !== (c.foto || null)) { gone = c.foto || null; if (patch.foto) c.foto = patch.foto; else delete c.foto; c.fotoAt = new Date().toISOString(); }   // profile photo (vista cliente)
    await idbPut('clients', id, c);
    if (gone && String(gone).startsWith('perfil-')) { try { await idbDel('files', gone); } catch (e) { /* */ } delete M.files[gone]; delete M.thumbBlobs[gone]; }
    await loadClients(); render();
    return c;
  };
  M.removeClient = async id => {
    const boards = (await idbAll('boards')) || [];
    const n = boards.filter(b => b.client === id).length;
    if (n) return `No se puede eliminar: tiene ${n} mes(es) guardados.`;
    const c0 = await idbGet('clients', id), tr = await idbGet('bandejas', id);
    await idbDel('clients', id);
    if (tr) { await idbDel('bandejas', id); for (const f of tr.tray || []) { try { await deleteIfUnused(f); } catch (e) { /* */ } } }   // its tray, with no month left (D-041)
    if (c0 && c0.foto && String(c0.foto).startsWith('perfil-')) { try { await idbDel('files', c0.foto); } catch (e) { /* */ } }   // its profile photo
    await loadClients();
    if (curClient === id) {
      curClient = null;
      if (CL[0]) { await M.openClient(CL[0].id); return true; }
      mainMode = null;
    }
    render();
    return true;
  };
  M.openClient = async id => {
    if (prevDispose) { try { await prevDispose(); } catch (e) { /* */ } prevDispose = null; }
    await claim();
    await addQ;
    await loadClients();
    if (!CL.find(c => c.id === id)) return 'no existe';
    if (uploadsBusy() || importing) return 'ocupada: espera a que termine la subida o la importación';
    const all = (await idbAll('boards')) || [];
    const mine = all.filter(b => b.client === id).sort((a, b) => String(b.month).localeCompare(String(a.month)));
    let lastBy = {}; try { lastBy = JSON.parse(lsGet('mesa-lastByClient') || '{}'); } catch (e) { /* */ }
    const pick = mine.find(b => b.key === lastBy[id]) || mine[0];
    if (pick) return M.open(pick.key);
    if (S) { try { await flushNow(); } catch (e) { /* */ } }
    if (shellReady()) closeDetail(); else buildShell();
    S = null; PB = null; sel = null; curClient = id;
    lsSet('mesa-lastClient', id); lsSet('mesa-last', '');
    await refreshMonths(); render(); setSave('');
    return M.status();
  };

  // ---------- init / open ----------
  // the newest saved copy of a board: IndexedDB's or the synchronous one a reload left in localStorage (mesa-pending)
  function newest(key, b) {
    let p = null; try { p = JSON.parse(lsGet('mesa-pending') || 'null'); } catch (e) { /* */ }
    if (!(p && p.key === key && p.board && String(p.board.savedAt || '') > String((b && b.savedAt) || ''))) return b;
    return !p.v && !('historias' in p.board) && hsDe(b).length ? { ...p.board, historias: b.historias } : p.board;   // left by a tab that doesn't know the stories: its changes, and the stories (D-060)
  }
  // a re-init must not drop a month the board holds: a month of the range with posts here but none in cfg, or a
  // shorter range whose dropped months have photos, notes or uploads -> error message (null = fine)
  function dropCheck(old, slots, month, span, cd) {      // cd: the cycle day being loaded (posts are grouped by it)
    const os = old.slots || [], om = old.month || month, ospan = old.span || 1, range = monthsOf(month, span);
    const mo = s => cycleOf(s.notionDate ?? s.date, cd), used = s => (s.photos || []).length || noteOf(s) || memoOf(s) || s.uploaded || s.design || s.caption;
    const ml = ms => ms.map(m => cdOf(cd) === 1 ? MONTHS[+m.slice(5) - 1] : rangeLabel(m, 1, true, cd)).join(', ').replace(/, ([^,]*)$/, ' y $1');
    const u = cdOf(cd) === 1 ? ['meses', 'el mes entero'] : ['ciclos', 'el ciclo entero'];
    if (old.key && os.length && cdOf(old.cycleDay) !== cdOf(cd)) {      // re-cut with another cycle day
      const gone = os.filter(s => used(s) && !slots.some(x => x.id === s.id));
      if (gone.length) return `Esta mesa (${rangeLabel(om, ospan, false, old.cycleDay).toLowerCase()}) va por ciclos del día ${cdOf(old.cycleDay)} y la cargas con el día ${cdOf(cd)}: ${gone.length} publicacion${gone.length > 1 ? 'es' : ''} con fotos, notas o subidas no ${gone.length > 1 ? 'vienen' : 'viene'} en esta carga (${gone.slice(0, 4).map(x => x.name).join(', ')}${gone.length > 4 ? '…' : ''}). Cárgala${gone.length > 1 ? 's' : ''} también (o pasa force:true).`;
    }
    const miss = range.filter(m => os.some(s => mo(s) === m) && !slots.some(s => cycleOf(s.date, cd) === m));
    if (miss.length) return `Esta mesa cubre ${rangeLabel(month, span, false, cd).toLowerCase()} y no vienen las publicaciones de ${ml(miss)}: carga ${span > 1 ? `los ${span} ${u[0]}` : u[1]} (o pasa force:true).`;
    const lost = span < ospan ? monthsOf(om, ospan).filter(m => !range.includes(m) && os.some(s => mo(s) === m && used(s))) : [];
    if (lost.length) return `Esta mesa cubre ${rangeLabel(om, ospan, false, old.cycleDay).toLowerCase()} y ${ml(lost)} ${lost.length > 1 ? 'tienen' : 'tiene'} fotos, notas o subidas: carga los ${ospan} ${u[0]} (o pasa force:true).`;
    return null;
  }
  // cfg = { client, month:'YYYY-MM', months?:1-3, slots:[{id,name,type,date}], past:[{id,name,type,date}] }  (key optional)
  // force: true lets a re-init drop months of the saved board (their photos go to the tray, their notes are lost)
  // months: how many months the board prepares from `month` (default: the saved board's, else 1); key = client-month.
  // Legacy cfg {key, handle, title, slots, past} still works: the client is derived from the key.
  M.init = async (cfg) => {
    if (prevDispose) { try { await prevDispose(); } catch (e) { /* */ } prevDispose = null; }
    if (uploadsBusy() || importing) return { error: 'ocupada: espera a que termine la subida o la importación' };
    await claim();
    await addQ;
    cfg = { ...cfg, slots: cfg.slots || [], past: cfg.past || [] };
    if (cfg.months != null && !(Number.isInteger(+cfg.months) && +cfg.months >= 1 && +cfg.months <= 3)) throw new Error('months debe ser 1, 2 o 3');
    if (!okCd(cfg.cycleDay)) throw new Error('cycleDay debe ser un día del 1 al 28');
    let client = cfg.client, month = cfg.month;
    const km = String(cfg.key || '').match(/^(.+)-(\d{4}-\d{2})$/);
    if (!client) client = km ? km[1] : String(cfg.key || 'cliente');
    await loadClients();
    const askedClient = client;
    let cl0 = CL.find(c => c.id === client);
    if (!cl0) {
      if (cfg.createClient === false) throw new Error(`no existe el cliente ${client}`);
      const t = String(cfg.title || '');
      const name = cfg.clientName || (t.includes(' · ') ? t.split(' · ')[0].trim() : '') || client;
      cl0 = await M.addClient({ id: client, name, handle: cfg.handle || '' });
      client = cl0.id;                                    // an existing client with that name keeps its id
    }
    // cycle day: cfg's; else the saved board's own (a board keeps its cycles); else the client's; else 1 (calendar month)
    const hasCd = cfg.cycleDay != null && cfg.cycleDay !== '';
    if (!month) {
      const cyc = iso => cycleOf(iso, hasCd ? cfg.cycleDay : cl0.cycleDay);
      if (km) month = km[2];
      else if (+cfg.months > 1) month = cfg.slots.map(s => cyc(s.date)).filter(Boolean).sort()[0] || cyc(new Date().toISOString());
      else { const cnt = {}; cfg.slots.forEach(s => { const m = cyc(s.date); if (m) cnt[m] = (cnt[m] || 0) + 1; }); month = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || cyc(new Date().toISOString()); }
    }
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month debe ser YYYY-MM');
    const key = cfg.key && client === askedClient ? cfg.key : `${client}-${month}`;
    if (S) { try { await flushNow(); } catch (e) { /* ignore */ } }
    const bandeja = await juntarBandeja(client);   // the client's tray, shared by all its months (D-041)
    const saved = newest(key, await idbGet('boards', key)), old = saved || { slots: [], tray: [] };
    const cd = hasCd ? cdOf(cfg.cycleDay) : saved ? cdOf(saved.cycleDay) : cdOf(cl0.cycleDay);
    const span = cfg.months != null ? +cfg.months : (old.span || 1);
    const why = cfg.force ? null : dropCheck(old, cfg.slots, month, span, cd);
    if (why) throw new Error(why);
    if (hasCd && !cfg.reopen && cl0.cycleDay !== cd) { await idbPut('clients', client, { ...cl0, cycleDay: cd }); await loadClients(); }   // the latest cycle day given (not a reopened board's own) is the client's
    try { const pend = JSON.parse(lsGet('mesa-pending') || 'null'); if (pend && pend.key === key) localStorage.removeItem('mesa-pending'); } catch (e) { /* */ }
    if (pd) pdCancel();
    sel = null; drag = null; pendingRender = false; noteTimer = null; cur = { slot: null, idx: 0 }; memoEdit = null;
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* ignore */ }
    if (!shellReady()) buildShell(); else closeDetail();
    setSave('Cargando…');
    await importShared(cfg.slots, old, key);
    const oldById = Object.fromEntries((old.slots || []).map(s => [s.id, s]));
    const base = Object.fromEntries((old.slots || []).map(s => [s.id, slotSig(s, old)]));   // shared state before init
    const orphans = [], deadRenders = [], retyped = [];
    for (const s of old.slots || []) if (!cfg.slots.some(x => x.id === s.id)) { orphans.push(...[...(s.photos || []), ...dSrc(s)].filter(f => trayable(f) && !dOut(s).includes(f) && !lOut(s).includes(f))); deadRenders.push(...dOut(s), ...lOut(s)); }
    const pm = prevMonth(month);
    const pastIn = cfg.past.length ? cfg.past : (old.past || []);
    // Dates and names: cfg carries Notion's values (notionDate/notionName); a change made here stays pending until
    // Notion has it. If Notion changed the same post on its own, Notion wins.
    const won = [], wonIds = new Set();
    const merge = n => {
      const o = oldById[n.id] || {};
      const r = { id: n.id, name: n.name, type: n.type, notionType: n.type, date: n.date, notionDate: n.date, notionName: n.name, photos: o.photos || [], note: o.note || '', uploaded: o.uploaded || null };
      const ont = o.notionType ?? o.type, tw = !!o.type && o.type !== ont && n.type !== ont && n.type !== o.type;   // Notion changed a type changed here too: Notion wins
      if (o.type && o.type !== ont && n.type === ont) r.type = o.type;   // a type changed here stays pending until Notion has it
      if (o.fmt) r.fmt = o.fmt;
      if (o.memo) r.memo = o.memo;
      if (o.design) r.design = o.design;
      if (o.libre) r.libre = o.libre;
      if (o.caption) r.caption = o.caption;
      if (o.estado) r.estado = o.estado;
      if (o.guias) r.guias = o.guias;
      if (r.design && o.type && o.type !== r.type && M.diseno && M.diseno._retipo) {   // its type changed in Notion: the design converts
        const x = M.diseno._retipo(r, r.type);
        if (x) { orphans.push(...x.tray); deadRenders.push(...x.dead); retyped.push(n.name); }
      }
      if (!o.id) return r;
      const od = o.notionDate === undefined ? o.date : o.notionDate, on = o.notionName === undefined ? o.name : o.notionName;
      let w = tw;
      if (!sameDate(o.date, od)) { if (sameDate(n.date, od)) r.date = o.date; else if (!sameDate(n.date, o.date)) w = true; }
      if (o.name !== on) { if (n.name === on) r.name = o.name; else if (n.name !== o.name) w = true; }
      if (w) { won.push(n.name); wonIds.add(n.id); } else if (o.hold && r.name !== r.notionName) r.hold = true;
      return r;
    };
    S = {
      key, client, month, span, cycleDay: cd,
      slots: cfg.slots.map(merge),
      tray: [...bandeja, ...(old.tray || []), ...orphans],   // old.tray: the copy a reload left in localStorage, or a board from before 3.44
      past: pastIn.filter(p => p.date && cycleOf(p.date, cd) === pm).map(p => ({ id: p.id, name: p.name, type: p.type, date: p.date })),
      crops: old.crops || {},
      ...(old.pins && old.pins.some(id => cfg.slots.some(x => x.id === id)) ? { pins: old.pins.filter(id => cfg.slots.some(x => x.id === id)) } : {}),
      ...(old.fillers > 0 ? { fillers: old.fillers } : {}),
      ...(old.fillers > 0 && previewsOf(old).length ? { previews: old.previews } : {}),
      ...(hsDe(old).length ? { historias: old.historias } : {}),
      // when the board last had Notion's data (loaded from Notion here, or an upload confirmed by markSynced): the calendar's «Notion a fecha de»
      ...(!cfg.reopen ? { notionAt: new Date().toISOString() } : old.notionAt ? { notionAt: old.notionAt } : {}),
      savedAt: old.savedAt || null, editedAt: old.editedAt || old.savedAt || null
    };
    holdOrphans(wonIds);   // a rename whose date change is already in Notion stays pending (not the posts Notion won)
    renumber();
    sortSlots();
    const oldPrevOwn = (old.prev || []).filter(p => p.own).flatMap(p => p.photos || []);
    alinearH(S);                       // a post that changed while this board was closed (Notion, a collab): its stories follow
    const ids = [...new Set([...S.tray, ...S.slots.flatMap(s => s.photos), ...oldPrevOwn, ...previewsOf(S), ...hsDe(S).flatMap(h => h.photos || [])])];
    const missing = await loadThumbs(ids);
    if (missing.length && S.previews) setPreviews(S.previews.map(f => (missing.includes(f) ? null : f)));
    await loadThumbs([...new Set(S.slots.flatMap(dSrc))]);   // a design's photos too: its cover can move to another post (the designer says if one is missing)
    if (missing.length) { S.tray = S.tray.filter(x => !missing.includes(x)); S.slots.forEach(s => { s.photos = s.photos.filter(x => !missing.includes(x)); }); }
    S.slots.forEach(s => { if (!isMulti(s.type) && s.photos.length > 1) { S.tray.unshift(...s.photos.slice(1).filter(f => !dOut(s).includes(f))); s.photos = s.photos.slice(0, 1); } });
    S.tray = [...new Set(S.tray)].filter(id => !S.slots.some(s => s.photos.includes(id)));
    normalize();
    // previous month: the same client's board (1–3 months) that covers it — newest if several — only its posts of that month
    const rangeOf = b => { const k2 = String(b.key || '').match(/^(.+)-(\d{4}-\d{2})$/); return { c: b.client || (k2 && k2[1]), m: b.month || (k2 && k2[2]) }; };
    PB = ((await idbAll('boards')) || []).filter(b => { const r = rangeOf(b); return b.key !== key && r.c === client && r.m && monthsOf(r.m, b.span).includes(pm) && cdOf(b.cycleDay) === cd; })
      .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))[0] || null;
    if (PB) PB = { ...PB, slots: (PB.slots || []).filter(s => cycleOf(s.date, cd) === pm && !S.slots.some(x => x.id === s.id)) };   // a post of this board (moved) shows once
    if (PB) await loadThumbs([...new Set(PB.slots.flatMap(s => publishList(s)))]);
    for (const p of S.past) {
      if (M.pastThumbs[p.id]) continue;
      const rec = await idbGet('files', 'past:' + p.id);
      if (rec && rec.thumb) { M.pastBlobs[p.id] = rec.thumb; M.pastThumbs[p.id] = URL.createObjectURL(rec.thumb); }
    }
    buildPrev(old.prev);
    S.prevUnlocked = !!old.prevUnlocked; prevOnce = false; pendingUnlock = null;
    { const own = new Set(S.prev.filter(p => p.own).flatMap(p => p.photos)); S.tray = S.tray.filter(id => !own.has(id)); }
    { const kept = refsOf(S); (old.prev || []).filter(p => p.own).forEach(p => (p.photos || []).forEach(f => { if (M.files[f] && !kept.has(f)) { S.tray.push(f); kept.add(f); } })); }
    sharedInit(oldById, base);
    curClient = client;
    lsSet('mesa-last', key); lsSet('mesa-lastClient', client);
    let lastBy = {}; try { lastBy = JSON.parse(lsGet('mesa-lastByClient') || '{}'); } catch (e) { /* */ }
    lastBy[client] = key; lsSet('mesa-lastByClient', JSON.stringify(lastBy));
    if (M.libre && M.libre.migrar) M.libre.migrar(S);   // old drawn photo holes become the editor's hole element (libre ≥ 1.9)
    BODY.set(S, boardBody(S));        // what init loaded/merged is the baseline: only later changes count as edits
    histReset();                      // ⌘Z history starts here (another board or a reload: new history)
    if (deadRenders.length) delList(l => [...new Set([...l, ...deadRenders])]);
    await flushNow();
    delSweep(); sweepDesigns();
    if (M.diseno && M.diseno.prepararKits) await M.diseno.prepararKits(S);   // plan() right after init knows if a design is out of date
    await refreshMonths();
    render();
    usoS = null; usosOtros();         // the photos in use (D-022): this board on the first warning, the client's other boards now
    if (missing.length) toast(`${missing.length} foto(s) guardadas ya no estaban disponibles y se han quitado.`);
    if (retyped.length) toast(`En Notion cambió el tipo de ${retyped.join(', ')}: su diseño se ha convertido y está pendiente de aplicar («Diseñar»).`, { ms: 9000 });
    if (won.length) toast(`En Notion cambió la fecha, el nombre o el tipo de ${won.length > 4 ? won.slice(0, 4).join(', ') + ` y ${won.length - 4} más` : won.join(', ')}: se queda lo de Notion y se descarta el cambio hecho aquí.`, { ms: 9000 });
    return M.status();
  };

  M.open = async key => {
    if (S) { try { await flushNow(); } catch (e) { /* */ } }   // its linked slots reach the board being opened first
    await migrateLegacy();
    const b = newest(key, await idbGet('boards', key));        // cfg (Notion values included) from the copy init uses
    if (!b) return 'no existe';
    const km = String(b.key || key).match(/^(.+)-(\d{4}-\d{2})$/);
    const client = b.client || (km ? km[1] : key), month = b.month || (km ? km[2] : null);
    const t = String(b.title || '');
    return M.init({ key, client, month, months: b.span || 1, cycleDay: cdOf(b.cycleDay), reopen: true, clientName: t.includes(' · ') ? t.split(' · ')[0].trim() : null, handle: b.handle || '', slots: (b.slots || []).map(({ id, name, type, date, notionName, notionDate, notionType }) => ({ id, name: notionName ?? name, type: notionType ?? type, date: notionDate ?? date })), past: b.past || [] });
  };
  async function migrateLegacy() {
    const all = (await idbAll('boards')) || [];
    for (const b of all) {
      if (b.client && b.month) continue;
      const km = String(b.key || '').match(/^(.+)-(\d{4}-\d{2})$/); if (!km) continue;
      await loadClients();
      let c = CL.find(x => x.id === km[1]);
      if (!c) { const t = String(b.title || ''); c = await M.addClient({ id: km[1], name: t.includes(' · ') ? t.split(' · ')[0].trim() : km[1], handle: b.handle || '' }); }
      b.client = c.id; b.month = km[2];
      await idbPut('boards', b.key, b);
    }
  }
  // Opens what was open last (or the first client) — used by the loader page.
  M.boot = async () => {
    if (prevDispose) { try { await prevDispose(); } catch (e) { /* */ } prevDispose = null; }
    await db().catch(() => { /* the calls below say why */ });   // first: an older tab is cut off before it is asked to save (claim)
    await claim();
    await migrateLegacy();
    await loadClients();
    const last = lsGet('mesa-last');
    if (last && (await idbGet('boards', last))) return M.open(last);
    const lc = lsGet('mesa-lastClient');
    if (lc && CL.find(c => c.id === lc)) return M.openClient(lc);
    if (CL.length) return M.openClient(CL[0].id);
    const all = (await idbAll('boards')) || [];
    if (all.length) return M.open(all.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))[0].key);
    if (!shellReady()) buildShell();
    curClient = null; S = null; render();
    return M.status();
  };

  // ---------- past posts from Notion (only when the previous month isn't in the mesa) ----------
  function loadPastOne(id, url) {
    M.pastPending[id] = true; delete M.pastErrors[id];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      img.onload = img.onerror = null;
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        const b = await thumbFromBitmap(img, w, h);
        if (M.pastThumbs[id]) URL.revokeObjectURL(M.pastThumbs[id]);
        M.pastBlobs[id] = b; M.pastThumbs[id] = URL.createObjectURL(b);
        await idbPut('files', 'past:' + id, { thumb: b, w, h });
      } catch (e) { M.pastErrors[id] = 'draw: ' + String(e); }
      finally { delete M.pastPending[id]; renderFeed(); }
    };
    img.onerror = () => { img.onload = img.onerror = null; M.pastErrors[id] = 'load failed'; delete M.pastPending[id]; renderFeed(); };
    img.src = url;
  }
  M.startPast = items => { items.forEach(it => loadPastOne(it.id, it.url)); renderFeed(); return M.pastStatus(); };
  M.pastStatus = () => ({ source: PB ? 'mesa:' + PB.key : 'notion', pending: Object.keys(M.pastPending).length, loaded: S ? pastPosts().filter(p => M.pastThumbs[p.id]).map(p => p.id) : [], errors: { ...M.pastErrors } });
  M.waitPast = async (ms = 25000) => { const t0 = Date.now(); while (Object.keys(M.pastPending).length && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 250)); return M.pastStatus(); };

  // ---------- upload to Notion ----------
  // «sube» / «programa»: the review (revisar.js) runs by itself on the posts sent and shows what it finds; it never stops
  // anything (only an empty photo hole does, below: D-035, D-040)
  function revAuto(motivo, items) {
    if (!(M.revisar && M.revisar.auto) || !S) return;
    try { M.revisar.auto(motivo, (items || []).map(it => it && (it.slotId || (S.slots.find(x => publishList(x).includes(it.fileId)) || {}).id)).filter(Boolean)); } catch (e) { /* never in the upload's way */ }
  }
  M.plan = () => S ? S.slots.filter(s => vivo(s) && (s.photos.length || noteOf(s) || s.uploaded)).map(s => {   // a cancelled post is never uploaded
    const st = photoStatus(s), pub = publishList(s);   // photos and contexto only: the caption has its own record (M.captions)
    return {
      slotId: s.id, name: s.name, type: s.type, date: s.date, dateChanged: dateChg(s),
      status: st === null ? 'nueva' : st === 'ok' ? 'ya subida' : 'cambiada',
      emptied: !pub.length && !!s.uploaded,
      files: pub.map(id => {
        const f = M.files[id] || {};
        if (f.design) return { fileId: id, name: dName(s, id), mb: +((f.size || 0) / 1048576).toFixed(1), formato: `diseño ${f.w}x${f.h}`, recorte: f.w + 'x' + f.h };   // uploaded as rendered
        const r = postRect(id, s); return { fileId: id, name: f.name, mb: +((f.size || 0) / 1048576).toFixed(1), formato: isReel(s.type) ? 'portada 9:16' : FMT_LABEL[cropOf(id, s).fmt], recorte: Math.round(r.w) + 'x' + Math.round(r.h), ...(f.reduced ? { reducida: true } : {}) };
      }),
      alternatives: s.photos.length - pub.length,
      note: noteOf(s),
      uploaded: s.uploaded || null,
      ...(huecosVacios(s).length ? { 'hueco vacío': huecosVacios(s) } : {}),   // its slides with an empty photo hole: not uploaded (D-035)
      ...(s.design && (isCarousel(s.type) || isReel(s.type)) && dState(s) !== 'ok' ? { 'diseño': dState(s) === 'nc' ? 'sin comprobar' : 'desactualizado' } : {})   // a design not applied as it is now: don't upload silently (a post retyped to Foto just keeps it dormant; designer not loaded: «sin comprobar»)
    };
  }) : [];

  // Where a photo goes: Notion (multipart POST with the upload's auth) or Zernio (raw PUT to a presigned URL: the API
  // key stays in tools/zernio.mjs, never here). Each keeps its own record, so one never aborts or overwrites the other.
  const DEST = {
    notion: { label: 'Notion', store: () => M.uploads, key: fid => fid, max: MAX_UPLOAD },
    zernio: { label: 'Zernio', store: () => M.zUploads, key: fid => 'z:' + fid, max: ZERNIO_MAX, jpegOnly: true, shrink: true }   // Instagram takes JPEG only
  };
  // items: [{fileId, slotId, url, auth, crop?}] — starts in background, poll with waitUpload().
  // The crop is fixed at the moment of the call, so later edits or a board switch can't change what is sent.
  // A new request for a photo that is still uploading replaces (aborts) the previous one.
  M.startUpload = (items, conc = M.cfg.uploadConc) => startJobs('notion', items, conc);
  // ---------- upload to Zernio (to schedule on Instagram) ----------
  // items: [{fileId, slotId, url, publicUrl}] — url / publicUrl from `node tools/zernio.mjs presign <n>`. Same crop as the
  // upload to Notion, always JPEG and under 8 MB. Poll with waitZernio(); each 'ok' carries its publicUrl for the
  // post's mediaItems (in the order of plan().files).
  M.startZernio = (items, conc = M.cfg.uploadConc) => startJobs('zernio', items, conc);
  function startJobs(dn, items, conc) {
    if (locked) return { error: 'locked: la mesa está abierta en otra pestaña; pulsa «Usar aquí» o vuelve a abrirla' };
    revAuto(dn === 'zernio' ? 'programa' : 'sube', items);
    const D = DEST[dn], U = D.store(), B = S;
    const jobs = [];
    for (const it of items || []) {
      const fid = it.fileId, k = D.key(fid);
      const s = B && (it.slotId ? B.slots.find(x => x.id === it.slotId) : B.slots.find(x => publishList(x).includes(fid)));
      const hz = dn === 'zernio' && B && !s ? hsDe(B).find(h => (!it.slotId || h.id === it.slotId) && (h.photos || []).includes(fid)) : null;   // a story's image goes to Zernio, never to Notion (D-059)
      if (M._ctrl[k]) { try { M._ctrl[k].abort('replaced'); } catch (e) { /* */ } }
      const gen = M._gen[k] = (M._gen[k] || 0) + 1;
      const hb = hz && hProblemas(hz).find(p => p.bloquea);
      if (hb) { U[fid] = { state: 'error', err: `la historia ${hb.texto}: arréglalo antes de programarla` }; continue; }   // nothing reaches Zernio with a point that stops it (D-058)
      if (it.crop !== false && !hz && (!s || !s.photos.includes(fid))) {
        U[fid] = { state: 'error', err: 'la foto no está en ninguna casilla de la mesa abierta' };
        continue;
      }
      if (s && huecosVacios(s).length) { U[fid] = { state: 'error', err: 'la publicación tiene un hueco de foto vacío: llénalo en el editor antes de subirla' }; continue; }   // D-035
      if (dn === 'zernio' && !it.publicUrl) { U[fid] = { state: 'error', err: 'falta publicUrl (la da tools/zernio.mjs presign junto a url)' }; continue; }
      const rect = it.crop !== false && !hz && !(M.files[fid] || {}).design ? postRect(fid, s, B) : null;   // a design output goes up exactly as rendered
      const sig = s ? fileSig(fid, s, B) : null;
      U[fid] = { state: 'pending', slotId: s ? s.id : hz ? hz.id : null, sig };
      jobs.push({ dn, fid, url: it.url, auth: it.auth, publicUrl: it.publicUrl, rect, sig, gen, slotId: s ? s.id : null, name: s && s.photos.includes(fid) && (M.files[fid] || {}).design ? dName(s, fid) : null });
    }
    if (jobs.length) {
      UP.total += jobs.length; UP.label = D.label; busyUpload();
      const q = jobs.slice();
      const worker = async () => { while (q.length) await runJob(q.shift()); };
      const nw = Math.min(conc, q.length);
      for (let i = 0; i < nw; i++) worker();
    }
    return upStatus(U, (items || []).map(i => i.fileId));
  }
  function busyUpload(pct) {
    if (UP.done >= UP.total) { UP = { total: 0, done: 0 }; setBusy('up', null); }
    else setBusy('up', `Subiendo fotos a ${UP.label || 'Notion'}: ${UP.done}/${UP.total}${pct != null ? ` · ${pct}%` : ''}`);
  }
  // XHR instead of fetch: upload progress lets a slow connection keep going; only a stall (no bytes for
  // M.cfg.uploadIdleMs) or a newer request for the same photo stops it.
  function send(method, url, headers, body, ctrl, label, onProgress) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      let last = Date.now(), done = false;
      const end = () => { done = true; clearInterval(iv); };
      const iv = setInterval(() => { if (!done && Date.now() - last > M.cfg.uploadIdleMs) { ctrl.reason = 'idle'; x.abort(); } }, 1000);
      x.open(method, url);
      for (const [h, v] of Object.entries(headers)) if (v != null) x.setRequestHeader(h, v);
      x.upload.onprogress = e => { last = Date.now(); if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onprogress = () => { last = Date.now(); };
      x.onload = () => { end(); res({ status: x.status, ok: x.status >= 200 && x.status < 300, text: x.responseText || '' }); };
      x.onerror = () => { end(); rej(new Error('sin conexión con ' + label)); };
      x.onabort = () => { end(); rej(new Error('aborted')); };
      ctrl.abort = reason => { ctrl.reason = ctrl.reason || reason; if (!done) x.abort(); };
      if (ctrl.reason) { end(); rej(new Error('aborted')); return; }
      x.send(body);
    });
  }
  async function runJob(j) {
    const D = DEST[j.dn], U = D.store(), k = D.key(j.fid);
    const live = () => M._gen[k] === j.gen;
    if (!live()) { UP.done++; busyUpload(); return; }
    const ctrl = { reason: null, abort(r) { this.reason = this.reason || r; } }; M._ctrl[k] = ctrl;
    U[j.fid] = { ...U[j.fid], state: 'uploading' };
    let res;
    try {
      let blob = await getBlob(j.fid);
      let name = j.name || (M.files[j.fid] || {}).name || 'foto.jpg';
      let reencoded = false, cropped = null;
      if (j.rect) { const cb = await cropBlob(blob, j.fid, j.rect, D.max, D.shrink); if (!cb.original) { blob = cb.blob; cropped = cb.w + 'x' + cb.h; name = name.replace(/\.[^.]+$/, '') + '.jpg'; } }
      else if (blob.size > D.max || (D.jpegOnly && blob.type !== 'image/jpeg')) { blob = await reencode(blob, D.max, D.shrink); reencoded = true; name = name.replace(/\.[^.]+$/, '') + '.jpg'; }
      if (ctrl.reason) throw new Error('aborted');
      name = safeName(name);
      const prog = f => { if (live()) busyUpload(Math.round(f * 100)); }, mb = +(blob.size / 1048576).toFixed(1);
      if (j.dn === 'zernio') {
        const r = await send('PUT', j.url, { 'content-type': 'image/jpeg' }, blob, ctrl, D.label, prog);
        res = r.ok ? { state: 'ok', publicUrl: j.publicUrl, name, mb, reencoded, cropped } : { state: 'error', http: r.status, err: r.text.slice(0, 200) };
      } else {
        const fd = new FormData(); fd.append('file', blob, name);
        const r = await send('POST', j.url, { authorization: j.auth }, fd, ctrl, D.label, prog);
        let js = {}; try { js = JSON.parse(r.text); } catch (e) { /* not json */ }
        res = (r.ok && js.status === 'uploaded')
          ? { state: 'ok', fileUploadId: js.file_upload_id, name, mb, reencoded, cropped }
          : { state: 'error', http: r.status, err: r.text.slice(0, 200) };
      }
    } catch (e) {
      delete M.blobs[j.fid];
      const why = ctrl.reason === 'idle' ? `sin progreso durante ${Math.round(M.cfg.uploadIdleMs / 1000)} s: vuelve a intentarlo` : ctrl.reason ? 'sustituida por un nuevo intento' : String(e.message || e).slice(0, 200);
      res = { state: 'error', err: why };
    }
    if (M._ctrl[k] === ctrl) delete M._ctrl[k];
    if (live()) U[j.fid] = { ...res, slotId: j.slotId, sig: j.sig };
    UP.done++; busyUpload();
  }
  const upStatus = (U, ids) => Object.fromEntries((ids || Object.keys(U)).map(id => [id, U[id] || { state: 'none' }]));
  async function upWait(U, ids, ms) {
    const t0 = Date.now();
    while (ids.some(id => upBusy(U[id])) && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 400));
    return upStatus(U, ids);
  }
  M.uploadStatus = ids => upStatus(M.uploads, ids);
  M.waitUpload = (ids, ms = 45000) => upWait(M.uploads, ids, ms);
  M.zernioStatus = ids => upStatus(M.zUploads, ids);
  M.waitZernio = (ids, ms = 45000) => upWait(M.zUploads, ids, ms);
  // list: [{slotId, fileIds, note}] — records exactly the crop that was sent for each photo.
  M.markUploaded = list => {
    if (locked) return { error: 'locked: la mesa está abierta en otra pestaña; no se ha guardado nada' };
    if (!S) return [];
    list.forEach(({ slotId, fileIds, note }) => {
      const s = slot(slotId); if (!s) return;
      fileIds = fileIds || [];
      const nt = note == null ? noteOf(s) : String(note).trim();
      if (!fileIds.length && !nt) { s.uploaded = null; return; }
      const sigs = fileIds.map(fid => { const u = M.uploads[fid]; return u && u.slotId === slotId && u.sig ? u.sig : fileSig(fid, s); });
      s.uploaded = { fileIds, note: nt, crop: JSON.stringify(sigs), at: new Date().toISOString() };
    });
    changed();
    return M.plan();
  };
  // Dates/times changed here and the renames they cause (numbering «W.N» / collab «Mes K»), to write to Notion.
  // dateMadrid = the new date as Madrid wall clock ('YYYY-MM-DDTHH:MM', or 'YYYY-MM-DD' when date-only).
  // type / notionType / typeChanged (3.26): a type changed in the post view goes to «Tipo de Contenido».
  M.notionChanges = () => S ? S.slots.filter(s => vivo(s) && (dateChg(s) || nameChg(s) || typeChg(s))).map(s => ({
    slotId: s.id, notionName: s.notionName, name: s.name, notionDate: s.notionDate, date: s.date, dateOnly: dOnly(s.date),
    dateMadrid: dOnly(s.date) ? localDay(s.date) : localDay(s.date) + 'T' + localTime(s.date),
    notionType: s.notionType ?? s.type, type: s.type, typeChanged: typeChg(s)
  })) : [];
  // After Claude has written them to Notion: those posts (all if no ids) take their current date and name as Notion's.
  M.markSynced = ids => {
    if (locked) return { error: 'locked: la mesa está abierta en otra pestaña; no se ha guardado nada' };
    if (!S) return [];
    const only = ids == null ? null : new Set([].concat(ids));
    S.slots.forEach(s => { if (only ? only.has(s.id) : vivo(s)) { s.notionDate = s.date; s.notionName = s.name; s.notionType = s.type; delete s.hold; } });
    S.notionAt = new Date().toISOString();
    holdOrphans(); renumber(); changed(); refreshDetail();
    return M.notionChanges();
  };
  // States (3.32): ids = a slotId or a list; estado = 'aprobado' (only from «Por aprobar») | 'programado' | 'publicado' |
  // 'cancelado', or null to give the post back the state its data gives. Returns each post's state after it.
  M.setEstado = (ids, estado) => {
    if (locked) return { error: 'locked: la mesa está abierta en otra pestaña; no se ha guardado nada' };
    if (!S) return [];
    const v = estado == null || estado === '' ? null : String(estado).trim().toLowerCase();
    const out = [].concat(ids ?? []).map(id => {
      const why = setEstado(id, v), s = S.slots.find(x => x.id === id);
      return { slotId: id, name: s ? s.name : null, estado: s ? estadoDe(s) : null, ...(why ? { error: why } : {}) };
    });
    if (out.some(x => !x.error)) { changed(); refreshDetail(); }
    return out;
  };

  // ---------- captions for Claude (M5) ----------
  // items: [{slotId, options:[{tone, text} ×3, in the client's tone order], note?, photos?}] — note / photos: the contexto
  // and photo ids they were written from (default: the post's now, so later changes show them as outdated). A post with
  // one already chosen is left as it is ('omitido') unless force:true (for the call or the item); a new batch replaces the
  // one shown, which is kept for the analysis.
  M.loadCaptions = (items, opts = {}) => {
    if (locked) return { error: 'locked: la mesa está abierta en otra pestaña; no se ha guardado nada' };
    if (!S) return { error: 'no hay mesa abierta' };
    const out = [];
    for (const it of [].concat(items || [])) {
      const s = it && S.slots.find(x => x.id === it.slotId), o = it && Array.isArray(it.options) ? it.options : [], r = { slotId: it && it.slotId, name: s ? s.name : null };
      if (!s) { out.push({ ...r, result: 'error', error: 'no está en la mesa abierta' }); continue; }
      if (o.length !== 3 || o.some(x => !x || typeof x.tone !== 'string' || typeof x.text !== 'string' || !x.tone.trim() || !x.text.trim())) { out.push({ ...r, result: 'error', error: 'hacen falta 3 opciones, cada una con tone y text (texto)' }); continue; }
      const c = capOf(s);
      if (c && c.pick != null && !(opts.force || it.force)) { out.push({ ...r, result: 'omitido', why: `ya tiene elegido el Caption ${c.pick + 1} (force:true para sustituirlo)` }); continue; }
      capLoad(s, o, { f: it.photos ? [].concat(it.photos) : capPhotos(s), n: it.note != null ? String(it.note).trim() : noteOf(s) });
      out.push({ ...r, result: c ? 'sustituido' : 'cargado' });
    }
    if (out.some(x => x.result === 'cargado' || x.result === 'sustituido')) { changed(); refreshDetail(); if (ig) openIG(ig.id, ig.idx); }
    return out;
  };
  // ids: a slotId or a list (default: every post of the open board). pick / n are 1-3, as the mesa shows them
  // («Caption 2 · tono»); each option keeps its original exactly as Claude wrote it; history = earlier batches, oldest first;
  // writtenFrom = the contexto and photos a batch was written from (a redo after a change vs. the 3 rejected)
  const capView = (b, n) => ({ n, tone: b.tones[n - 1], original: b.orig[n - 1], text: b.text[n - 1], edited: b.text[n - 1] !== b.orig[n - 1] });
  const capFrom = b => ({ note: b.basis ? b.basis.n || '' : null, photos: b.basis ? (b.basis.f || []).slice() : null });
  M.captions = ids => {
    if (!S) return [];
    const only = ids == null ? null : new Set([].concat(ids));
    return S.slots.filter(s => only ? only.has(s.id) : vivo(s)).map(s => {
      const c = capOf(s), x = s.caption && s.caption.sent, od = capOutdated(s), p = c && c.pick != null ? c.pick : null;
      return {
        slotId: s.id, name: s.name, type: s.type, date: s.date, note: noteOf(s), photo: capPhotos(s).length > 0,
        state: capState(s), outdated: od.length > 0, outdatedBy: od, changed: capStatus(s) === 'chg',
        pick: p != null ? p + 1 : null, tone: p != null ? c.tones[p] : null, text: capFinal(s),
        options: c ? [1, 2, 3].map(n => capView(c, n)) : [], loadedAt: c ? c.at : null, writtenFrom: c ? capFrom(c) : null,
        sent: x ? { text: x.text, pick: x.pick + 1, tone: x.tone, at: x.at } : null,
        history: ((s.caption && s.caption.old) || []).map(b => ({ loadedAt: b.at, replacedAt: b.until || null, pick: b.pick != null ? b.pick + 1 : null, options: [1, 2, 3].map(n => capView(b, n)), writtenFrom: capFrom(b) }))
      };
    });
  };
  // list: [{slotId, text?}] (or slotIds) — after Claude has written the chosen caption in its Notion page; text = what went
  // up (default: the chosen one as it is now). The vista cliente shows it from then on; editing it or choosing another one
  // makes the post «cambiada».
  M.markCaptionsUploaded = list => {
    if (locked) return { error: 'locked: la mesa está abierta en otra pestaña; no se ha guardado nada' };
    if (!S) return { error: 'no hay mesa abierta' };
    const out = [], now = new Date().toISOString();
    for (const it of [].concat(list || [])) {
      const id = typeof it === 'string' ? it : it && it.slotId, s = S.slots.find(x => x.id === id), c = capOf(s), r = { slotId: id, name: s ? s.name : null };
      if (!s) { out.push({ ...r, result: 'error', error: 'no está en la mesa abierta' }); continue; }
      if (!c || c.pick == null) { out.push({ ...r, result: 'error', error: 'no tiene caption elegido' }); continue; }
      const t = it && it.text != null ? String(it.text).replace(/\r\n?/g, '\n').trim() : capFinal(s);
      s.caption.sent = { text: t, pick: c.pick, tone: c.tones[c.pick], at: now };
      out.push({ ...r, result: 'subido', state: capState(s) });
    }
    if (out.some(x => x.result === 'subido')) { changed(); refreshDetail(); if (ig) openIG(ig.id, ig.idx); }   // an open vista cliente shows it at once
    return out;
  };

  // ---------- preview image for the client (1080 px wide) ----------
  // opts.month ('YYYY-MM', one of the board's months): only that month above the line; the board's earlier
  // months (if any) and the previous month go below, so a client can approve one month of a 2-3 month board.
  // The later months are not drawn, but their place is kept: blank cells at the start (their count mod 3) so every
  // photo sits in the same row/column as in the mesa. Fillers («+ Hueco») drawn black after the pinned posts, with their
  // preview if they have one (D-049), as in the mesa. `check` compares each drawn post with its mesa position.
  M.render = async (mode = 'clean', opts = {}) => {
    if (!S) return { error: 'no hay mesa abierta' };
    const only = opts && opts.month ? String(opts.month) : null;
    if (only && !boardMonths().includes(only)) return { error: `${only} no está en esta mesa (${boardMonths().join(', ')})` };
    const W = 1080, GAP = 3, COLS = 3, TW = 358, TH = 477, HEADER = 250, FOOT = 40;
    const c0 = CL.find(c => c.id === S.client) || {};
    const past = pastList(false);
    const cd = curCd(), cyc = iso => cycleOf(iso, cd);     // opts.month = a cycle of the board ('YYYY-MM' of its start)
    // pinned posts (B8) first, as in the mesa; a pinned one of a later month keeps its place as a blank cell
    const order = feedOrder(), pinned = new Set(pinsOf()), un = order.filter(s => !pinned.has(s.id));
    const mOf = s => cyc(s.date), inM = s => !only || mOf(s) === only, isLater = s => !!only && !!mOf(s) && mOf(s) > only;
    const fresh = un.filter(inM);
    const earlier = only ? un.filter(s => { const m = mOf(s); return m && m < only; }) : [];
    const later = only ? un.filter(isLater).length : 0;
    const lead = later % COLS, F = fillersOf();
    const slotPost = (s, isNew) => ({ mesaIdx: order.indexOf(s) + (pinned.has(s.id) ? 0 : F), name: s.name, type: s.type, n: s.photos.length, date: s.date, isNew, planned: !isNew, pin: pinned.has(s.id), blob: s.photos.length ? M.thumbBlobs[s.photos[0]] : null, rect: s.photos.length && M.files[s.photos[0]] ? { g: gridRect(s.photos[0], s), f: M.files[s.photos[0]] } : null });
    const pinPosts = order.filter(s => pinned.has(s.id)).map(s => isLater(s) ? { blank: true, mesaIdx: null } : slotPost(s, inM(s)));
    const nuevas = fresh.length + order.filter(s => pinned.has(s.id) && !isLater(s) && inM(s)).length;
    const posts = [
      ...pinPosts,
      ...Array.from({ length: F }, (_, k) => ({ blank: true, filler: true, mesaIdx: null, preview: previewAt(k) && M.thumbBlobs[previewAt(k)] })),
      ...Array.from({ length: lead }, () => ({ blank: true, mesaIdx: null })),
      ...fresh.map(s => slotPost(s, true)),
      ...earlier.map(s => slotPost(s, false)),
      ...past.map((p, j) => (p.fid
        ? { mesaIdx: S.slots.length + F + j, name: p.name, type: p.type, n: (p.photos || []).length, date: p.date, isNew: false, blob: M.thumbBlobs[p.fid] || null, rect: M.files[p.fid] ? { g: gridRect(p.fid, p.item, p.B), f: M.files[p.fid] } : null }
        : { mesaIdx: S.slots.length + F + j, name: p.name, type: p.type, date: p.date, isNew: false, blob: p.thumb ? (M.pastBlobs[p.thumb] || null) : null }))
    ];
    const N = pinPosts.length + F + lead + fresh.length;   // first cell below the line
    // each drawn post in the same column as in the mesa, and in the mesa's order
    const mismatches = []; let lastIdx = -1;
    posts.forEach((p, i) => { if (p.mesaIdx == null) return; if ((p.mesaIdx - i) % COLS !== 0 || p.mesaIdx < lastIdx) mismatches.push(p.name); lastIdx = p.mesaIdx; });
    const BLUE = '#0095f6';
    const rows = Math.ceil(posts.length / COLS);
    const H = HEADER + rows * TH + (rows - 1) * GAP + FOOT;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.textBaseline = 'alphabetic';
    x.fillStyle = '#111'; x.font = `700 46px ${FONT}`; x.fillText(c0.handle || c0.name || '', 48, 92);
    x.fillStyle = '#555'; x.font = `400 30px ${FONT}`; x.fillText('Propuesta de feed · ' + (only ? rangeLabel(only, 1, false, cd) : rangeLabel(S.month, S.span, false, cd)), 48, 140);
    x.fillStyle = '#8a8a8a'; x.font = `400 24px ${FONT}`;
    const planificadas = earlier.length + (only ? order.filter(s => pinned.has(s.id) && !isLater(s) && !inM(s)).length : 0);
    const below = [planificadas ? `${planificadas} ya planificadas` : '', past.length ? `${past.length} de ${cd === 1 ? MONTHS[+prevMonth(S.month).slice(5) - 1] : rangeLabel(prevMonth(S.month), 1, true, cd)}` : ''].filter(Boolean).join(' + ');
    x.fillText(`${nuevas} publicaciones nuevas${below ? ' + ' + below : ''} · vista del perfil (recorte 3:4)`, 48, 184);
    if (earlier.length || past.length) {
      x.fillStyle = BLUE; x.fillRect(48, 212, 44, 8);
      x.fillStyle = '#8a8a8a'; x.font = `400 22px ${FONT}`; x.fillText(`Por encima de la franja: publicaciones nuevas · Debajo: ${earlier.length ? 'lo anterior' : 'ya publicado'}`, 104, 222);
    }
    const drawIcon = (svg, cx, cy, color) => new Promise(res => {
      const im = new Image();
      im.onload = () => { x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 6; x.drawImage(im, cx - 16, cy - 16, 32, 32); x.restore(); res(); };
      im.onerror = () => res();
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" style="color:${color}" `).replace(/currentColor/g, color));
    });
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const px = (i % COLS) * (TW + GAP), py = HEADER + Math.floor(i / COLS) * (TH + GAP);
      if (p.blank) {
        x.fillStyle = p.filler ? '#000' : '#efefef'; x.fillRect(px, py, TW, TH);
        if (p.preview) {                   // the same proportions as .hfoto and .htag in the mesa
          const bmp = await createImageBitmap(p.preview), b = Math.round(TW * .06), iw = TW - 2 * b, ih = TH - 2 * b, k = Math.max(iw / bmp.width, ih / bmp.height), sw = iw / k, sh = ih / k;
          x.imageSmoothingQuality = 'high';
          x.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, px + b, py + b, iw, ih);
          bmp.close();
          const fs = TW * .052, lbl = 'Preview · próximo mes';
          x.font = `600 ${fs}px ${FONT}`;
          const tw = x.measureText(lbl).width + 1.6 * fs, th = 1.9 * fs, tx = px + (TW - tw) / 2, ty = py + TH - TW * .09 - th;
          x.fillStyle = '#000'; x.beginPath();
          if (x.roundRect) x.roundRect(tx, ty, tw, th, th / 2); else x.rect(tx, ty, tw, th);
          x.fill();
          x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(lbl, px + TW / 2, ty + th / 2);
          x.textAlign = 'left'; x.textBaseline = 'alphabetic';
        }
        continue;
      }
      if (p.blob) {
        const bmp = await createImageBitmap(p.blob);
        const r = TW / TH, sr = bmp.width / bmp.height;
        let sw, sh, sx, sy;
        if (p.rect) { const k = bmp.width / p.rect.f.w; sx = p.rect.g.x * k; sy = p.rect.g.y * k; sw = p.rect.g.w * k; sh = p.rect.g.h * k; }
        else if (sr > r) { sh = bmp.height; sw = sh * r; sx = (bmp.width - sw) / 2; sy = 0; } else { sw = bmp.width; sh = sw / r; sx = 0; sy = (bmp.height - sh) / 2; }
        x.imageSmoothingQuality = 'high';
        x.drawImage(bmp, sx, sy, sw, sh, px, py, TW, TH);
        bmp.close();
      } else {
        x.fillStyle = '#efefef'; x.fillRect(px, py, TW, TH);
        if (mode === 'annotated' || p.isNew || p.planned) {
          x.fillStyle = '#9a9a9a'; x.font = `600 26px ${FONT}`; x.textAlign = 'center';
          x.fillText(p.isNew || p.planned ? 'Pendiente' : 'Publicada', px + TW / 2, py + TH / 2);
          x.textAlign = 'left';
        }
      }
      if (p.pin) await drawIcon(ICON.pin, px + TW - 30, py + 30, p.blob ? '#fff' : '#9a9a9a');
      else if (isReel(p.type)) await drawIcon(ICON.reel, px + TW - 30, py + 30, p.blob ? '#fff' : '#9a9a9a');
      else if (typeIcon(p.type, p.n)) await drawIcon(ICON.carousel, px + TW - 30, py + 30, p.blob ? '#fff' : '#9a9a9a');
      if (mode === 'annotated') {
        const g = x.createLinearGradient(0, py + TH - 112, 0, py + TH);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)');
        x.fillStyle = g; x.fillRect(px, py + TH - 112, TW, 112);
        x.fillStyle = '#fff'; x.font = `600 22px ${FONT}`; x.fillText(p.name, px + 14, py + TH - 44, TW - 28);
        x.font = `400 19px ${FONT}`; x.fillStyle = 'rgba(255,255,255,.9)'; x.fillText(fmtDate(p.date) + (p.isNew || p.planned ? '' : '  ·  publicada'), px + 14, py + TH - 16, TW - 28);
      }
    }
    if (N > 0 && N < posts.length) {
      const R = Math.floor(N / COLS), k = N % COLS;
      const yRow = r => HEADER + r * (TH + GAP) - GAP / 2;
      const xCol = cc => cc * (TW + GAP) - GAP / 2;
      x.strokeStyle = BLUE; x.lineWidth = 12; x.lineCap = 'square';
      x.beginPath();
      if (k === 0) { x.moveTo(0, yRow(R)); x.lineTo(W, yRow(R)); }
      else if ((R + 1) * COLS < posts.length) { x.moveTo(0, yRow(R + 1)); x.lineTo(xCol(k), yRow(R + 1)); x.lineTo(xCol(k), yRow(R)); x.lineTo(W, yRow(R)); }
      else { x.moveTo(xCol(k), yRow(R + 1)); x.lineTo(xCol(k), yRow(R)); x.lineTo(W, yRow(R)); }
      x.stroke();
      // label on the first cell below the band, like the mesa's «Septiembre · publicado»
      const lbl = earlier.length ? cycName(cyc(earlier[0].date), cd) + ' · planificado' : cycName(prevMonth(S.month), cd) + ' · publicado';
      const lx = k * (TW + GAP) + 16, ly = HEADER + R * (TH + GAP) + 18;
      x.font = `600 24px ${FONT}`; const tw = x.measureText(lbl).width;
      x.fillStyle = BLUE; x.beginPath();
      if (x.roundRect) x.roundRect(lx, ly, tw + 32, 44, 22); else x.rect(lx, ly, tw + 32, 44);
      x.fill();
      x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.fillText(lbl, lx + 16, ly + 23); x.textBaseline = 'alphabetic';
    }
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    M.out[mode] = blob; OUT_SLOTS[mode] = order.filter(s => !isLater(s)).map(s => s.id);
    return { mode, month: only || null, width: W, height: H, kb: Math.round(blob.size / 1024), posts: posts.filter(p => !p.blank).length, fresh: nuevas, blankStart: lead, pinned: pinPosts.filter(p => !p.blank).length,
      empty: posts.filter(p => p.isNew && !p.blob).map(p => p.name),
      check: { ok: !mismatches.length, sameColumnsAsMesa: !mismatches.length, mismatches } };
  };
  M.uploadOut = async (mode, url, auth, filename) => {
    const hv = S ? S.slots.filter(s => vivo(s) && (!OUT_SLOTS[mode] || OUT_SLOTS[mode].includes(s.id)) && huecosVacios(s)[0] === 1) : [];   // a cover in the image with an empty photo hole (D-035)
    if (hv.length) return { http: 0, state: 'error', fileUploadId: null, err: `hueco de foto vacío en la portada de ${hv.map(s => s.name).join(', ')}: llénalo antes de subir la imagen` };
    const fd = new FormData(); fd.append('file', M.out[mode], safeName(filename));
    const r = await fetch(url, { method: 'POST', headers: { authorization: auth }, body: fd });
    const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) { /* */ }
    return { http: r.status, state: j.status || 'error', fileUploadId: j.file_upload_id || null };
  };
  M.showOut = mode => { const u = URL.createObjectURL(M.out[mode]); const w = window.open(u); setTimeout(() => URL.revokeObjectURL(u), 60000); return !!w; };

  // ---------- pasar la mesa a otro Mac (exportar / importar a mano) ----------
  // One JSON file with the whole mesa: clients, every board, the photos they use and the previous-month thumbnails.
  // Kevin moves it by AirDrop or iCloud. Photos travel at 1080 px on the short side (JPEG, orientation baked in).
  // Importing merges: a board is added if missing and replaced only by a newer copy (savedAt); clients and photos are
  // only added (a full-resolution photo is never replaced by its 1080 copy). Format:
  // {format:'mesa-feed', v:2, app, exportedAt, clients:[…], boards:[…], files:{id:{name,type,w,h,size,lastModified,
  //  reduced,design?,data:<base64>, thumb?:<base64>}}, past:{notionId:{w,h,thumb:<base64>}}} — no thumb: the photo (1080) is its own.
  // A client's design-kit override (kit, kitAt) travels with it: the newer one wins, with its fixed final photo.
  // v:2 = boards may carry captions (s.caption): a mesa older than that refuses the file instead of dropping them; v:1 files
  // (no captions) import as always.
  const XF_SHORT = 1080;
  let xferRun = null, xferAsk = null;
  const nOf = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const b64of = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res(s.slice(s.indexOf(',') + 1)); }; r.onerror = () => rej(r.error || new Error('no se pudo leer')); r.readAsDataURL(blob); });
  function blobOf(b64, type) { const s = atob(b64), n = s.length, u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type }); }
  const allKeys = async st => ((await tx(st, 'readonly', s => s.getAllKeys())) || []).map(String);
  // only unsaved changes: a flush stamps savedAt, and savedAt decides which copy of a board wins
  const flushPending = async () => { if (S && !locked && (saveTimer || noteTimer)) await flushNow(); };
  // short side 1080, never upscaled; a landscape keeps w > h and w/h to 3 decimals, so crops and upload signatures don't move
  function xferDims(w, h) {
    const sh = Math.min(w, h); if (!(sh > XF_SHORT)) return null;
    const L = Math.max(w, h), want = (L / sh).toFixed(3), n0 = Math.round(L * XF_SHORT / sh);
    let n = n0;
    for (const k of [0, -1, 1, -2, 2]) if (((n0 + k) / XF_SHORT).toFixed(3) === want) { n = n0 + k; break; }
    if (w !== h) n = Math.max(n, XF_SHORT + 1);
    return w > h ? { w: n, h: XF_SHORT } : { w: XF_SHORT, h: w === h ? XF_SHORT : n };
  }
  async function xferPhoto(rec) {        // the copy that travels: already reduced / small ones as they are
    const same = { blob: rec.blob, type: rec.type, name: rec.name, w: rec.w, h: rec.h, reduced: !!rec.reduced };
    if (rec.reduced || rec.logo || !xferDims(rec.w, rec.h)) return same;   // a logo travels as it is (PNG with its transparency, ≤ 1600 px)
    const bmp = await createImageBitmap(rec.blob, { imageOrientation: 'from-image' });
    try {
      const t = xferDims(bmp.width, bmp.height); if (!t) return same;
      const c = document.createElement('canvas'); c.width = t.w; c.height = t.h;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, t.w, t.h); x.imageSmoothingQuality = 'high';
      x.drawImage(bmp, 0, 0, t.w, t.h);
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/jpeg', 0.88));
      c.width = c.height = 0;
      return { blob, type: 'image/jpeg', name: String(rec.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', w: t.w, h: t.h, reduced: true };
    } finally { bmp.close(); }
  }
  // The save dialog (File System Access) writes the file where Kevin chooses. The Claude app's browser opens it but never
  // lets it write (permission «denied», NotAllowedError: an empty file was left behind and a second dialog came up), so
  // there the export is a normal download, with the browser's own dialog; a browser where writing once failed, the same.
  const LS_NOFSA = 'mesa-export-descarga';
  const fsaOk = () => typeof window.showSaveFilePicker === 'function' && !/\bClaude\//.test(navigator.userAgent) && lsGet(LS_NOFSA) !== '1';
  // opts.returnBlob: true -> the Blob, nothing saved (Claude / tests)
  M.exportAll = async (opts = {}) => {
    const fail = m => { toast(m, { ms: 7000 }); return { error: m }; };
    if (locked) return fail('La mesa está abierta en otra pestaña: pulsa «Usar aquí» antes de exportar.');
    if (xferRun) return fail('Espera: ya se está exportando o importando la mesa.');
    xferRun = 'export';
    try {
      const now = new Date(), mp = madParts(now.getTime()), fname = `mesa-de-trabajo-${mp.day}-${mp.time.replace(':', '')}.json`;
      let handle = null;
      if (!opts.returnBlob && fsaOk()) {   // first thing: it needs the click
        try { handle = await window.showSaveFilePicker({ suggestedName: fname, types: [{ description: 'Mesa de trabajo', accept: { 'application/json': ['.json'] } }] }); }
        catch (e) { if (e && e.name === 'AbortError') return { cancelled: true }; handle = null; }
        if (handle) {
          xferH = handle; try { xferSz = (await handle.getFile()).size; } catch (e) { xferSz = null; }   // an existing file chosen to be replaced is never deleted
          try { xferW = await handle.createWritable(); } catch (e) { return await xferNoWrite(handle, e); }   // can it write there? known now, not after the photos
        }
      }
      setBusy('imp', 'Exportando la mesa…');
      await addQ; await flushPending();
      const clients = (await idbAll('clients')) || [];
      for (const c of new Set([...clients.map(x => x.id), ...((await idbAll('boards')) || []).map(boardClient)])) await juntarBandeja(c);   // the months' old trays, into their client's (D-041)
      const bandejas = ((await idbAll('bandejas')) || []).filter(r => r && r.client && (r.tray || []).length);
      const boards = ((await idbAll('boards')) || []).map(b => newest(b.key, b)).sort((a, b) => String(a.key).localeCompare(String(b.key)));
      const huecos = boards.flatMap(b => (b.slots || []).filter(vivo).flatMap(s => { const d = huecosVacios(s, b.slots); return d.length ? [{ client: b.client, month: b.month, slotId: s.id, post: shortLabel(s.name, s.type), diapositivas: d }] : []; }));   // exported as they are, then said where (D-037)
      const ids = [...new Set([...boards.flatMap(b => [...refsTodo(b)]), ...bandejas.flatMap(r => r.tray), ...clients.map(kitRef).filter(Boolean), ...clients.map(c => c.foto).filter(Boolean), ...clients.flatMap(c => (c.libre && c.libre.logos) || [])])];   // + the editor's logos of each client
      const parts = ['{"format":"mesa-feed","v":4,"app":' + JSON.stringify(M.version) + ',"exportedAt":' + JSON.stringify(now.toISOString())   // v3: + bandejas (D-041); v4: the boards may hold stories (D-054), whose images a mesa before 3.53 wouldn't bring
        + ',"clients":' + JSON.stringify(clients) + ',"bandejas":' + JSON.stringify(bandejas) + ',"boards":' + JSON.stringify(boards) + ',"files":{'];
      let sep = '', n = 0, photos = 0, skipped = 0;
      for (const id of ids) {
        setBusy('imp', `Exportando ${++n}/${ids.length} fotos…`);
        const rec = await idbGet('files', id);
        if (!rec || !rec.blob) { skipped++; continue; }
        try {
          const p = await xferPhoto(rec);
          const meta = { name: p.name, type: p.type, w: p.w, h: p.h, size: p.blob.size, lastModified: rec.lastModified || 0, reduced: p.reduced };
          if (rec.design) meta.design = true;
          if (rec.logo) meta.logo = true;
          if (rec.de) meta.de = rec.de;
          const th = !p.reduced && rec.thumb ? ',"thumb":"' + await b64of(rec.thumb) + '"' : '';
          parts.push(new Blob([sep + JSON.stringify(id) + ':' + JSON.stringify(meta).slice(0, -1) + ',"data":"', await b64of(p.blob), '"' + th + '}']));
          sep = ','; photos++;
        } catch (e) { skipped++; }
      }
      parts.push('},"past":{'); sep = '';
      let past = 0;
      for (const k of (await allKeys('files')).filter(k => k.startsWith('past:'))) {
        const r = await idbGet('files', k); if (!r || !r.thumb) continue;
        parts.push(new Blob([sep + JSON.stringify(k.slice(5)) + ':{"w":' + (+r.w || 0) + ',"h":' + (+r.h || 0) + ',"thumb":"', await b64of(r.thumb), '"}']));
        sep = ','; past++;
      }
      parts.push('}}');
      const blob = new Blob(parts, { type: 'application/json' });
      if (opts.returnBlob) return blob;
      setBusy('imp', 'Guardando el archivo…');
      let via = 'archivo';
      if (handle) { try { await xferW.write(blob); await xferW.close(); xferW = null; } catch (e) { return await xferNoWrite(handle, e); } }
      else {                               // no save dialog here: a normal download (the browser's own dialog)
        via = 'descarga';
        const u = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = u; a.download = fname; a.hidden = true; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 120000);
      }
      const mb = +(blob.size / 1048576).toFixed(1);
      const msg = `Exportada: ${nOf(boards.length, 'mes', 'meses')}, ${nOf(photos, 'foto', 'fotos')} (${mb} MB)` + (skipped ? ` · ${skipped} no se pudieron leer` : '');
      const aviso = () => { if (huecos.length) dlgHuecos(msg, huecos, clients); else toast(msg, { ms: 7000 }); };
      if (M.revisar && M.revisar.auto) M.revisar.auto('exportar', null, { msg, fallo: aviso, huecos: huecos.map(h => ({ ...h, cliente: (clients.find(c => c.id === h.client) || {}).name || h.client, mes: monthLabel(h.month) })) });   // the review, with the holes of the other months (D-037, D-040)
      else aviso();
      return { ok: true, file: fname, via, clients: clients.length, boards: boards.length, photos, past, skipped, mb, huecos };
    } catch (e) { const q = xferW ? await xferDrop() : 'borrado'; return fail('No se pudo exportar la mesa: ' + String((e && e.message) || e) + (q === 'vacio' ? ' Puede haber quedado un archivo vacío con el nombre elegido: bórralo.' : '')); }
    finally { xferRun = null; xferW = null; xferH = null; xferSz = null; setBusy('imp', null); }
  };
  // the file chosen in the save dialog could not be written: what was written is dropped and so is the empty file the
  // dialog made (never a second dialog); without permission, the next exports from this browser are a normal download
  // what is left where it was chosen: 'borrado' (the empty file is gone) | 'intacto' (a file that was there stays as it
  // was: the browser only replaces it on close) | 'vacio' (an empty file may be left)
  let xferW = null, xferH = null, xferSz = null;
  async function xferDrop() {
    const w = xferW, h = xferH; xferW = null;
    if (w) { try { await w.abort(); } catch (e) { /* already closed */ } }
    if (!h) return 'borrado';
    if (xferSz > 0) return 'intacto';
    if (xferSz !== 0) return 'vacio';
    try { await h.remove(); return 'borrado'; } catch (e) { return 'vacio'; }
  }
  async function xferNoWrite(h, e) {
    const gone = await xferDrop(), perm = !!e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');   // no permission: the dialog is no use in this browser
    if (perm) lsSet(LS_NOFSA, '1');
    const why = perm ? 'este navegador no deja escribir en el archivo elegido' : e && e.name === 'QuotaExceededError' ? 'no queda espacio en el disco' : 'el navegador no pudo escribir el archivo';
    const m = `No se pudo guardar «${h.name}»: ${why} (${(e && e.name) || 'Error'}: ${(e && e.message) || e}).` + (gone === 'vacio' ? ' Puede haber quedado un archivo vacío con ese nombre: bórralo.' : gone === 'intacto' ? ' El archivo que había sigue como estaba.' : '') + (perm ? ' Vuelve a pulsar Exportar: esta vez se guarda con una descarga normal.' : ' Vuelve a intentarlo o elige otra carpeta.');
    toast(m, { ms: 12000 });
    return { error: m, name: (e && e.name) || null, left: gone };
  }

  function xferCheck(d) {
    if (!d || typeof d !== 'object' || d.format !== 'mesa-feed') return 'Este archivo no es una exportación de la Mesa de trabajo.';
    if (d.v !== 1 && d.v !== 2 && d.v !== 3 && d.v !== 4) return +d.v > 4 ? 'Este archivo viene de una versión más nueva de la mesa: actualízala antes de importarlo.' : 'Versión de archivo desconocida: no se puede importar.';
    const bad = 'El archivo está dañado o incompleto: no se puede importar.';
    if (!Array.isArray(d.clients) || !Array.isArray(d.boards) || !d.files || typeof d.files !== 'object' || (d.past != null && typeof d.past !== 'object')) return bad;
    if (d.clients.some(c => !c || typeof c.id !== 'string' || !c.id)) return bad;
    if (d.bandejas != null && (!Array.isArray(d.bandejas) || d.bandejas.some(r => !r || typeof r.client !== 'string' || !r.client || !Array.isArray(r.tray)))) return bad;
    if (d.boards.some(b => !b || typeof b.key !== 'string' || !/^.+-\d{4}-\d{2}$/.test(b.key) || !Array.isArray(b.slots))) return bad;
    if (Object.values(d.files).some(f => !f || typeof f.data !== 'string' || !f.data)) return bad;
    return null;
  }
  // what the file changes here: boards added / replaced (newer) / kept (newer here) / same content; clients to add
  const boardBody = ({ cycleDay, ...b }) => JSON.stringify({ ...b, savedAt: null, editedAt: null, slots: (b.slots || []).map(({ at, ...s }) => s), cycleDay: cdOf(cycleDay) });   // no cycle day (older mesa) = day 1
  const eAt = b => String(b.editedAt || b.savedAt || '');
  const newerEdit = (b, o) => eAt(b) > eAt(o) || (eAt(b) === eAt(o) && String(b.savedAt || '') > String(o.savedAt || ''));
  async function xferPlan(d) {
    const local = ((await idbAll('boards')) || []).map(b => newest(b.key, b)), byKey = Object.fromEntries(local.map(b => [b.key, b]));
    const clients = (await idbAll('clients')) || [], cids = new Set(clients.map(c => c.id)), keys = await allKeys('files');
    const P = { clients, local: byKey, add: [], upd: [], newer: [], same: [], newClients: [], files: new Set(keys.filter(k => !k.startsWith('past:'))), past: new Set(keys.filter(k => k.startsWith('past:')).map(k => k.slice(5))) };
    P.kitUpd = d.clients.filter(c => c.kit && cids.has(c.id) && String(c.kitAt || '') > String((clients.find(x => x.id === c.id) || {}).kitAt || ''));   // newer design-kit override of a client that is here
    P.libUpd = d.clients.filter(c => c.libre && cids.has(c.id) && String(c.libreAt || '') > String((clients.find(x => x.id === c.id) || {}).libreAt || ''));   // newer colours and templates of the free editor (libre.js)
    const fotoAt = c => (c && c.kit && c.kit.final && c.kit.final.fotoAt) || '';
    P.kitFiles = P.kitUpd.filter(c => fotoAt(c) !== fotoAt(clients.find(x => x.id === c.id))).map(kitRef).filter(id => id && d.files[id]);   // only another final photo replaces the one here (same id): never the same photo by its 1080 copy
    for (const b of d.boards) {
      const o = byKey[b.key];
      if (!o) P.add.push(b);
      else if (boardBody(o) === boardBody(b)) P.same.push(b);
      else if (newerEdit(b, o)) P.upd.push(b);
      else P.newer.push(b);
    }
    P.put = [...P.add, ...P.upd];
    // boards kept here (newer) that still take caption batches only the file has
    P.capKeep = P.newer.map(b => { const o = JSON.parse(JSON.stringify(byKey[b.key])), was = JSON.stringify(o.slots); keepCaps(o, b); return JSON.stringify(o.slots) === was ? null : o; }).filter(Boolean);
    const pk = new Set(P.put.map(b => b.key));
    P.refs = new Set([...local.filter(b => !pk.has(b.key)), ...P.put].flatMap(b => [...refsTodo(b)]));   // photos the mesa uses after the import
    P.fotoUpd = d.clients.filter(c => cids.has(c.id) && c.fotoAt && String(c.fotoAt) > String((clients.find(x => x.id === c.id) || {}).fotoAt || ''));   // a newer profile photo of a client that is here
    d.clients.forEach(c => { const k = kitRef(c); if (k) P.refs.add(k); if (c.foto && (!cids.has(c.id) || P.fotoUpd.includes(c))) P.refs.add(c.foto); });   // a profile photo only when it is used
    // the clients' trays (D-041): what the file's adds to each one here (never takes anything out of it)
    const locTr = {}; ((await idbAll('bandejas')) || []).forEach(r => { locTr[r.client] = new Set(r.tray || []); });
    local.forEach(b => { if (Array.isArray(b.tray)) { const c = boardClient(b); (locTr[c] = locTr[c] || new Set()); b.tray.forEach(f => locTr[c].add(f)); } });   // boards from before 3.44
    if (S) locTr[S.client] = new Set([...(locTr[S.client] || []), ...S.tray]);
    P.trays = (d.bandejas || []).map(r => ({ client: r.client, at: r.at || '', add: r.tray.filter(f => typeof f === 'string' && (d.files[f] || P.files.has(f)) && !(locTr[r.client] || new Set()).has(f)) })).filter(r => r.add.length);
    P.trayAdd = P.trays.reduce((n, r) => n + r.add.length, 0);
    P.trays.forEach(r => r.add.forEach(f => P.refs.add(f)));
    d.clients.forEach(c => { const o = clients.find(x => x.id === c.id), l = !o || P.libUpd.includes(c) ? c.libre : o.libre; ((l && l.logos) || []).forEach(f => P.refs.add(f)); });   // the editor's logos the client keeps, used or not (also one an import before 3.45 left without its file)
    P.newFiles = Object.keys(d.files).filter(id => P.refs.has(id) && !P.files.has(id));
    P.newPast = Object.keys(d.past || {}).filter(id => !P.past.has(id) && d.past[id] && typeof d.past[id].thumb === 'string');
    for (const c of d.clients) if (!cids.has(c.id)) { P.newClients.push(c); cids.add(c.id); }
    for (const b of P.put) { const c = boardClient(b); if (c && !cids.has(c)) { P.newClients.push({ id: c, name: c, handle: '', createdAt: new Date().toISOString() }); cids.add(c); } }
    P.trays = P.trays.filter(r => cids.has(r.client)); P.trayAdd = P.trays.reduce((n, r) => n + r.add.length, 0);   // a tray only with its client
    P.nothing = !P.put.length && !P.newClients.length && !P.newFiles.length && !P.newPast.length && !P.kitUpd.length && !P.libUpd.length && !P.fotoUpd.length && !P.capKeep.length && !P.trayAdd;
    return P;
  }
  // captions are never lost between Macs: whichever copy of a board is kept (b), a batch (known by its `at`) that only the
  // other copy (o) has goes to b's earlier batches (all of o's, if b's post has none); the latest upload record wins
  function keepCaps(b, o) {
    for (const s of (o && b.slots) || []) {
      const l = (o.slots || []).find(x => x.id === s.id); if (!l || !l.caption) continue;
      s.caption = capMerge(l.caption, s.caption);   // b's copy wins where both have the same batch; the newest batch is the one shown
    }
  }
  // a collab's post is in several boards: after an import every copy holds all its caption batches, so a copy left
  // without them can never write itself back over the others (returns the boards whose copies changed)
  function spreadCaps(boards) {
    const by = {}, changed = new Set();
    boards.forEach(b => (b.slots || []).forEach(s => { (by[s.id] = by[s.id] || []).push({ b, s }); }));
    for (const id in by) {
      const L = by[id]; if (L.length < 2 || !L.some(x => x.s.caption)) continue;
      for (const t of L) for (const o of L) if (t !== o) { const was = JSON.stringify(t.s.caption || null); keepCaps({ slots: [t.s] }, { slots: [o.s] }); if (JSON.stringify(t.s.caption || null) !== was) changed.add(t.b); }
    }
    return changed;
  }
  function xferWhat(P) {
    const u = P.upd.length, k = P.newer.length, s = P.same.length;
    return [P.add.length && nOf(P.add.length, 'mes nuevo', 'meses nuevos'), u && `${u} se actualiza${u === 1 ? '' : 'n'}`,
      k && `${k} ya estaba${k === 1 ? '' : 'n'} más reciente${k === 1 ? '' : 's'} aquí`, s && `${s} igual${s === 1 ? '' : 'es'}`,
      P.newClients.length && nOf(P.newClients.length, 'cliente nuevo', 'clientes nuevos'), P.kitUpd && P.kitUpd.length && nOf(P.kitUpd.length, 'kit de diseño actualizado', 'kits de diseño actualizados'),
      P.libUpd && P.libUpd.length && nOf(P.libUpd.length, 'cliente con colores y plantillas actualizados', 'clientes con colores y plantillas actualizados'),
      P.fotoUpd && P.fotoUpd.length && nOf(P.fotoUpd.length, 'foto de perfil actualizada', 'fotos de perfil actualizadas'),
      P.capKeep && P.capKeep.length && `${nOf(P.capKeep.length, 'mes recibe', 'meses reciben')} captions que solo estaban en el archivo`,
      P.trayAdd && `${nOf(P.trayAdd, 'foto entra', 'fotos entran')} en la bandeja`].filter(Boolean).join(', ')
      || (P.newPast.length ? nOf(P.newPast.length, 'miniatura del mes anterior', 'miniaturas del mes anterior') : '');
  }
  function xferSummaryHTML(d, P) {
    const st = {}; P.add.forEach(b => { st[b.key] = 'nuevo'; }); P.upd.forEach(b => { st[b.key] = 'se actualiza'; }); P.newer.forEach(b => { st[b.key] = 'más reciente aquí'; }); P.same.forEach(b => { st[b.key] = 'igual'; });
    const names = {}; [...d.clients, ...P.clients].forEach(c => { names[c.id] = c.name || c.id; });
    const mOf = b => b.month || (String(b.key).match(/(\d{4}-\d{2})$/) || [])[1] || '';
    const byC = {}; d.boards.slice().sort((a, b) => mOf(a).localeCompare(mOf(b))).forEach(b => { const c = boardClient(b) || '?'; (byC[c] = byC[c] || []).push(b); });
    const rows = Object.entries(byC).map(([c, bs]) => `<li><b>${esc(names[c] || c)}</b>${P.newClients.some(x => x.id === c) ? ' <span>· cliente nuevo</span>' : ''}<br>`
      + bs.map(b => `${esc(rangeLabel(mOf(b), b.span, true, b.cycleDay))} <span>· ${st[b.key]}</span>`).join(', ') + '</li>').join('');
    const fl = Object.values(d.files), red = fl.filter(f => f.reduced).length;
    const info = `Exportado el ${esc(fmtDate(d.exportedAt))} · ${nOf(fl.length, 'foto', 'fotos')}${red ? ` (${red === fl.length ? 'todas' : red} a 1080 px)` : ''}`;
    const what = P.nothing ? 'Nada que importar: todo lo de este archivo ya está aquí, igual o más reciente.'
      : `Al importar: ${xferWhat(P)}${P.newFiles.length ? ` · ${nOf(P.newFiles.length, 'foto nueva', 'fotos nuevas')}` : ''}. No se borra nada de este Mac.`;
    return `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Importar la mesa</h3><p>${info}</p><ul class="xsum">${rows || '<li>Sin meses</li>'}</ul><p class="xwhat">${esc(what)}</p>`
      + `<div class="form"><div class="row">${P.nothing ? '<button type="button" class="btn" data-act="close">Cerrar</button>' : '<button type="button" class="btn2" data-act="close">Cancelar</button><button type="button" class="btn" data-act="xfer-go">Importar</button>'}</div></div>`;
  }
  // resolves true on «Importar», false when the dialog goes away any other way (×, Cancelar, Esc, backdrop)
  function xferConfirm(html) {
    return new Promise(res => {
      showDialog('xfer-confirm', html);
      const d = root.querySelector('.detail'); let over = false, mo = null;
      const done = v => { if (over) return; over = true; if (mo) mo.disconnect(); if (xferAsk === done) xferAsk = null; res(v); };
      mo = new MutationObserver(() => { if (d.hidden || d.dataset.dlg !== 'xfer-confirm') done(false); });
      mo.observe(d, { attributes: true, attributeFilter: ['hidden', 'data-dlg'], childList: true });
      xferAsk = done;
      const b = d.querySelector('[data-act="xfer-go"]') || d.querySelector('.row [data-act="close"]'); if (b) b.focus();
    });
  }
  function xferErr(m) {
    const d = shellReady() && root.querySelector('.detail');
    const e = d && !d.hidden && d.dataset.dlg === 'xfer' && d.querySelector('.ferr');
    if (e) { e.textContent = m; e.hidden = false; return; }
    if (d && !d.hidden && /^xfer/.test(d.dataset.dlg || '')) closeDetail();
    toast(m, { ms: 8000 });
  }
  // src: File | Blob | JSON text | parsed object; opts.confirm: false skips the confirmation dialog
  M.importData = async (src, opts = {}) => {
    const fail = m => { xferErr(m); return { error: m }; };
    if (locked) return fail('La mesa está abierta en otra pestaña: pulsa «Usar aquí» antes de importar.');
    if (xferRun) return fail('Espera: ya se está exportando o importando la mesa.');
    if (uploadsBusy()) return fail('Espera a que termine la subida de fotos.');
    if (importing) return fail('Espera a que terminen de prepararse las fotos.');
    xferRun = 'import';
    let cleared = false, back = null;
    const reopen = async () => {
      if (!cleared) return; cleared = false;
      if (shellReady()) closeDetail();
      await loadClients();
      if (back.key && (await idbGet('boards', back.key))) await M.open(back.key);
      else if (back.client && CL.some(c => c.id === back.client)) await M.openClient(back.client);
      else await M.boot();
    };
    try {
      let d = src;
      setBusy('imp', 'Leyendo el archivo…');
      try { if (src instanceof Blob) d = await src.text(); if (typeof d === 'string') d = JSON.parse(d); }
      catch (e) { return fail('No se puede leer el archivo: no es una exportación de la mesa o está incompleto (¿terminó de copiarse?).'); }
      const why = xferCheck(d); if (why) return fail(why);
      await addQ; await flushPending();
      let P = await xferPlan(d);
      // photos and thumbnails decoded before anything is written: a damaged file changes nothing
      const got = {}, gotPast = {}, need = Object.keys(d.files).filter(id => !P.files.has(id) || P.kitFiles.includes(id));
      let i = 0;
      for (const id of need) {
        setBusy('imp', `Preparando ${++i}/${need.length} fotos…`);
        const f = d.files[id];
        try {
          const type = OK_TYPES.includes(f.type) ? f.type : 'image/jpeg', blob = blobOf(f.data, type);
          const bm = await createImageBitmap(blob, { imageOrientation: 'from-image' }), bw = bm.width, bh = bm.height; bm.close();
          const thumb = f.thumb ? blobOf(f.thumb, 'image/jpeg') : f.reduced ? blob : (await makeThumb(blob)).thumb;
          got[id] = { name: String(f.name || 'foto.jpg'), size: blob.size, type, w: +f.w > 0 ? +f.w : bw, h: +f.h > 0 ? +f.h : bh, lastModified: +f.lastModified || 0, blob, thumb };
          if (f.reduced) got[id].reduced = true;
          if (f.design) got[id].design = true; if (f.logo) got[id].logo = true; if (typeof f.de === 'string' && f.de) got[id].de = f.de;
        } catch (e) { return fail(`El archivo está dañado: no se puede leer la foto «${String((f && f.name) || id)}». No se ha importado nada.`); }
      }
      for (const pid of P.newPast) { const p = d.past[pid]; try { gotPast[pid] = { thumb: blobOf(p.thumb, 'image/jpeg'), w: +p.w || 0, h: +p.h || 0 }; } catch (e) { /* only a preview */ } }
      setBusy('imp', null);
      if (opts.confirm !== false && shellReady() && !(await xferConfirm(xferSummaryHTML(d, P)))) return { cancelled: true };
      if (locked) return fail('La mesa está abierta en otra pestaña: no se ha importado nada.');
      await addQ; await flushPending();
      if (uploadsBusy() || importing) return fail('Espera a que termine la subida de fotos: no se ha importado nada.');   // the board couldn't reopen
      P = await xferPlan(d);                       // again, with what is saved now
      const res = { ok: true, boards: { added: P.add.map(b => b.key), updated: P.upd.map(b => b.key), keptNewer: P.newer.map(b => b.key), same: P.same.map(b => b.key) }, clients: P.newClients.map(c => c.id), photos: 0, past: 0, ...(P.kitUpd.length ? { kits: P.kitUpd.map(c => c.id) } : {}) };
      const newPast = P.newPast.filter(id => gotPast[id]);
      if (P.nothing) {
        if (shellReady() && /^xfer/.test(root.querySelector('.detail').dataset.dlg || '')) closeDetail();
        toast('Nada que importar: ya tenías todo igual o más reciente.', { ms: 6000 });
        return res;
      }
      if (shellReady()) showDialog('xfer-busy', '<h3>Importando la mesa…</h3><p>Un momento: se están guardando los meses y las fotos.</p>');
      setBusy('imp', 'Guardando la mesa importada…');
      back = { key: S && S.key, client: curClient };
      clearTimeout(saveTimer); saveTimer = null; clearTimeout(noteTimer); noteTimer = null;
      S = null; PB = null; cleared = true;         // nothing in memory may overwrite what is written now
      for (const id of [...new Set([...P.newFiles, ...P.kitFiles])]) if (got[id]) {  // photos first: a board never points at a photo that isn't here
        await idbPut('files', id, got[id]); res.photos++;
        if (M.files[id]) { URL.revokeObjectURL(M.files[id].thumbUrl); delete M.files[id]; } delete M.blobs[id]; delete M.thumbBlobs[id];
      }
      for (const id of newPast) { await idbPut('files', 'past:' + id, gotPast[id]); res.past++; }
      for (const c of P.newClients) await idbPut('clients', c.id, c);
      for (const c of P.kitUpd) { const o = await idbGet('clients', c.id); if (o) await idbPut('clients', c.id, { ...o, kit: c.kit, kitAt: c.kitAt }); }
      for (const c of P.libUpd || []) { const o = await idbGet('clients', c.id); if (o) await idbPut('clients', c.id, { ...o, libre: c.libre, libreAt: c.libreAt }); }
      for (const c of P.fotoUpd || []) {
        const o = await idbGet('clients', c.id); if (!o) continue;
        const n = { ...o, fotoAt: c.fotoAt }; if (!c.foto) delete n.foto; else if (got[c.foto] || P.files.has(c.foto)) n.foto = c.foto;
        await idbPut('clients', c.id, n);
        if (o.foto && o.foto !== n.foto && String(o.foto).startsWith('perfil-')) { try { await idbDel('files', o.foto); } catch (e) { /* */ } }   // the one it replaces
      }
      P.upd.forEach(b => keepCaps(b, P.local[b.key]));
      // a board that only takes caption batches keeps its own editedAt: the batches came from the other Mac, which has them,
      // and a newer date would make its older photos and notes win over that Mac's later edits on the next import
      const capKept = P.capKeep;
      const fin = Object.fromEntries(Object.entries(P.local).map(([k, b]) => [k, JSON.parse(JSON.stringify(b))]));   // every board as it ends up
      [...P.put, ...capKept].forEach(b => { fin[b.key] = b; });
      const spread = [...spreadCaps(Object.values(fin))].filter(b => !P.put.includes(b) && !capKept.includes(b));
      const writes = [...P.put, ...capKept, ...spread];
      if (capKept.length || spread.length) res.captionsKept = [...capKept, ...spread].map(b => b.key);
      if (writes.length) await tx('boards', 'readwrite', st => { for (const b of writes) st.put(b, b.key); });
      for (const r of P.trays) {           // each client's tray takes the file's photos it lacks: newer tray, in front (D-041)
        await tx('bandejas', 'readwrite', st => { const g = st.get(r.client); g.onsuccess = () => {
          const o = g.result || { client: r.client, tray: [], at: '' }, add = r.add.filter(f => !o.tray.includes(f) && (got[f] || P.files.has(f)));
          o.tray = String(r.at) > String(o.at || '') ? [...add, ...o.tray] : [...o.tray, ...add]; st.put(o, r.client);
        }; });
      }
      for (const c of new Set([...P.put.map(boardClient), ...P.trays.map(r => r.client)])) if (c) await juntarBandeja(c);   // a file from before 3.44: its months' trays
      try { const pend = JSON.parse(lsGet('mesa-pending') || 'null'); if (pend && writes.some(b => b.key === pend.key)) localStorage.removeItem('mesa-pending'); } catch (e) { /* */ }
      setBusy('imp', null);
      await reopen();
      try { await sweepDesigns(true); } catch (e) { /* only housekeeping */ }   // rendered images the imported months replaced
      const k = P.newer.length;
      toast('Importada: ' + [xferWhat({ ...P, same: [], newer: [] }), res.photos && nOf(res.photos, 'foto', 'fotos'), k && `${k} se ${k === 1 ? 'queda' : 'quedan'} como estaba${k === 1 ? '' : 'n'} (más reciente${k === 1 ? '' : 's'} aquí)`].filter(Boolean).join(' · ') + '.', { ms: 8000 });
      return res;
    } catch (e) {
      const q = e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)));
      return fail(q ? 'El navegador no tiene espacio para importar las fotos. Libera espacio y vuelve a intentarlo.' : 'No se pudo importar: ' + String((e && e.message) || e));
    } finally {
      xferRun = null; setBusy('imp', null);
      if (cleared) { try { await reopen(); } catch (e) { /* */ } }
    }
  };
  // the export went out with empty photo holes: where each one is (client, month, post and slide), never a block (D-037)
  function dlgHuecos(msg, hs, clients) {
    const cn = id => (clients.find(c => c.id === id) || {}).name || id;
    showDialog('huecos', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>${hs.length === 1 ? 'Hay un hueco de foto vacío' : `Hay huecos de foto vacíos en ${hs.length} publicaciones`}</h3>`
      + `<p>${esc(msg)}. La copia ${hs.length === 1 ? 'lo lleva tal cual: llénalo en el editor antes de subir o programar esa publicación' : 'los lleva tal cual: llénalos en el editor antes de subir o programar esas publicaciones'}.</p>`
      + `<ul class="xsum">${hs.map(h => `<li><b>${esc(h.post)}</b>: ${h.diapositivas.length === 1 ? 'diapositiva' : 'diapositivas'} ${h.diapositivas.join(', ')} <span>· ${esc(cn(h.client))}, ${esc(monthLabel(h.month))}</span></li>`).join('')}</ul>`
      + '<div class="form"><div class="row"><button type="button" class="btn" data-act="close">Entendido</button></div></div>');
    root.querySelector('.detail [data-act="close"].btn').focus();
  }
  function dlgXfer() {
    showDialog('xfer', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Pasar la mesa a otro Mac</h3><p>Se exportan todos los clientes y meses, con las fotos a 1080 px. En el otro Mac pulsa Importar: se combina con lo que haya allí; de cada mes gana la versión más reciente y nunca se cambia una foto a resolución completa por una de 1080.</p>`
      + '<div class="form"><p class="ferr" hidden></p><div class="row"><button type="button" class="btn2 left" data-act="close">Cancelar</button><button type="button" class="btn2" data-act="xfer-import">Importar…</button><button type="button" class="btn" data-act="xfer-export">Exportar</button></div></div>'
      + '<input type="file" class="xferin" accept=".json,application/json" hidden>');
    const d = root.querySelector('.detail'), inp = d.querySelector('.xferin');
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) M.importData(f); });
    d.querySelector('[data-act="xfer-export"]').focus();
  }

  // ---------- status / housekeeping ----------
  M.status = () => S ? ({
    version: M.version, key: S.key, client: S.client, month: S.month, months: boardMonths(), cycleDay: curCd(), range: rangeLabel(S.month, S.span, false, curCd()), slots: S.slots.length,
    pendingDates: S.slots.filter(s => vivo(s) && dateChg(s)).length, pendingRenames: S.slots.filter(s => vivo(s) && nameChg(s)).length,
    filled: S.slots.filter(s => s.photos.length).length, fillers: fillersOf(),
    tray: S.tray.length, files: Object.keys(M.files).length,
    past: PB ? `mesa ${prevMonth(S.month)}: ${PB.slots.length}` : `${pastPosts().filter(p => M.pastThumbs[p.id]).length}/${pastPosts().length}`,
    busy: M.busyText || null, locked, savedAt: S.savedAt,
    prevLock: S.prevUnlocked ? 'desbloqueado' : prevOnce ? 'solo esta vez' : 'bloqueado',
    prevHidden: (S.prev || []).filter(p => p.hidden).length, prevEdited: (S.prev || []).filter(p => p.own).length,
    linked: S.slots.filter(s => sharedWith(s).length).length
  }) : { version: M.version, client: curClient, board: null, locked };
  M.board = () => S && JSON.parse(JSON.stringify(S));
  M.purge = async key => {
    try { const pend = JSON.parse(lsGet('mesa-pending') || 'null'); if (pend && pend.key === key) localStorage.removeItem('mesa-pending'); } catch (e) { /* */ }
    const boards = await idbAll('boards');
    const b = boards.find(x => x.key === key); if (!b) return 'no existe';
    if (S && S.key === key) { clearTimeout(saveTimer); saveTimer = null; clearTimeout(noteTimer); noteTimer = null; }   // no save of it while it goes
    const others = boards.filter(x => x.key !== key);
    // the client's tray (D-041) stays with its other months; with its last month it goes too, as a month's tray did
    const c = boardClient(b), last = !others.some(x => boardClient(x) === c), trays = (await idbAll('bandejas')) || [];
    const own = S && S.client === c ? S.tray.slice() : ((trays.find(r => r.client === c) || {}).tray || []);
    const libres = last ? [] : previewsOf(b).filter(f => !own.includes(f) && !others.some(x => refsOf(x).has(f)));   // a filler's photo is not a post's: it stays with its client (D-049)
    own.unshift(...libres);
    if (!last && S && S.key === key) await idbPut('bandejas', c, { client: c, tray: own, at: new Date().toISOString() });   // what the open board had
    else if (libres.length && S && S.client === c) { S.tray.unshift(...libres); save(); }
    else if (libres.length) await idbPut('bandejas', c, { client: c, tray: own, at: new Date().toISOString() });
    const otherRefs = new Set([...others.flatMap(x => [...refsTodo(x)]), ...trays.filter(r => r.client !== c).flatMap(r => r.tray || []), ...(last ? [] : own), ...(S && S.key !== key ? refsTodo(S) : [])]);
    let n = 0;
    for (const id of new Set([...refsTodo(b), ...(last ? own : [])])) if (!otherRefs.has(id)) {
      await idbDel('files', id);
      if (M.files[id]) URL.revokeObjectURL(M.files[id].thumbUrl);
      if (M.bigUrls && M.bigUrls[id]) { URL.revokeObjectURL(M.bigUrls[id]); delete M.bigUrls[id]; }
      delete M.files[id]; delete M.blobs[id]; delete M.thumbBlobs[id]; n++;
    }
    const otherPast = new Set(others.flatMap(x => (x.past || []).map(p => p.id)));
    for (const p of b.past || []) if (!otherPast.has(p.id)) {
      await idbDel('files', 'past:' + p.id);
      if (M.pastThumbs[p.id]) URL.revokeObjectURL(M.pastThumbs[p.id]);
      delete M.pastThumbs[p.id]; delete M.pastBlobs[p.id];
    }
    await idbDel('boards', key);
    if (last) { await idbDel('bandejas', c); if (S && S.client === c && S.key !== key) S.tray = []; }
    dropIdx([key]); if (S && S.key !== key) renderFeed();
    if (S && S.key !== key && S.client === c) { usoS = null; usosOtros(); }   // a filler's photo may count as used again (D-049)
    if (S && S.key === key) { clearTimeout(saveTimer); clearTimeout(noteTimer); S = null; PB = null; if (shellReady()) { closeDetail(); await refreshMonths(); render(); } }
    else if (PB && PB.key === key) { PB = null; renderFeed(); }
    return `borrada ${key}: ${n} fotos eliminadas`;
  };
  M.boards = async () => {           // tray: its client's (D-041), the same in all its months
    const tr = Object.fromEntries(((await idbAll('bandejas')) || []).map(r => [r.client, (r.tray || []).length]));
    return (await idbAll('boards')).map(b => ({ key: b.key, client: b.client || null, month: b.month || null, months: b.month ? monthsOf(b.month, b.span) : [], cycleDay: cdOf(b.cycleDay), slots: (b.slots || []).length, filled: (b.slots || []).filter(s => (s.photos || []).length).length, tray: Array.isArray(b.tray) ? b.tray.length : S && S.client === boardClient(b) ? S.tray.length : tr[boardClient(b)] || 0, savedAt: b.savedAt }));
  };
  // a board switch in progress (the designer refuses to open meanwhile: its board is about to go away)
  let switching = 0;
  for (const k of ['openClient', 'open', 'init']) { const f = M[k]; M[k] = async (...a) => { switching++; try { return await f(...a); } finally { switching--; } }; }
  // internal bridge for the designer (diseno.js): the open board and the mesa's own helpers (getters for what changes)
  M._in = {
    get S() { return S; }, get CL() { return CL; }, get curClient() { return curClient; }, get locked() { return locked; },
    root: () => root, shellReady, slot, changed, save, flushNow, render, renderFeed, renderBar, renderTray, refreshDetail, openDetail, closeDetail,
    bandejaVista, trayFiltro, trayTodas, paraPoner,   // the client's tray as the trays show it (D-041)
    toast, esc, isReel, isCarousel, publishList, same, refsOf, uploadsBusy, rectFor, baseCrop, cropOf, postRect, gridRect, dims, fmtRatio,
    getBlob, makeThumb, loadThumbs, idbGet, idbPut, idbDel, idbAll, newId, deleteIfUnused, loadClients, FONT, FMT_LABEL,
    dName, delList, sweepDesigns, switching: () => switching > 0, setBusy, histAmend, histMarca, histJuntar, clearToasts, igPieces,
    // for the calendar (calendario.js, mesa ≥ 3.32)
    ESTADOS, estadoDe, pastList, boardMonths, curCd, cycleStart, cycleEnd, cycleOfDay, localDay, localTime, dOnly, fmtDate, shortLabel,
    dateChg, nameChg, typeChg, sharedWith, MONTHS, hoy: () => madParts(Date.now()).day, openIG, openPast, withPrev, setDate, madridISO, DCHG, DNM,
    usoFoto, AVISOS,  // a photo used again (D-022, libre ≥ 1.12)
    huecosVacios, lComp, vivo, showDialog, monthLabel,   // for the review (revisar.js, mesa ≥ 3.43)
    hsDe, hNorm, adelantos, hProblemas, usoHistoria, hFecha, ts, isoDe, sameDate, inBoard, pick: () => sel, pickOff: () => { sel = null; render(); }   // for the stories (historias.js, mesa ≥ 3.53)
  };
  M._test = {
    place, swap, unassign, move, movePhoto, setType, removeFile, setCover, setNote, setMemo, pastList, addToSlot, setPreview,
    versionNueva, claim,
    setCrop: (fid, slotId, patch) => { setCrop(fid, slot(slotId), patch); save(); render(); },
    setFmt: (slotId, fmt) => { cur = { slot: slotId, idx: 0 }; setFmt(slotId, fmt); },
    postRect: (fid, slotId) => postRect(fid, slot(slotId)), gridRect: (fid, slotId) => gridRect(fid, slot(slotId)),
    cropSig: slotId => cropSig(slot(slotId)), cur: () => ({ ...cur }), setSel: id => { sel = id; render(); },
    undo, redo, hist: () => ({ undo: H.undo.length, redo: H.redo.length, own: H.b === S }), delList: () => delList(),
    moveMemo, prev: () => JSON.parse(JSON.stringify((S && S.prev) || [])), prevSetFromTray, prevToTray, prevSwap, prevRestore,
    setHidden: (id, v) => { const it = prevItem(id); if (it) { it.hidden = !!v; changed(); } },
    prevLocked: () => prevLocked(), setDate: (slotId, iso) => setDate(slotId, iso), weekOf: day => weekOf(day, 1), weekOfCycle: (day, cd) => weekOf(day, cd), madridISO, cycleOf: (day, cd) => cycleOfDay(day, cd), cycleEnd, rangeLabel,
    unlock: mode => { if (mode === 'always') { S.prevUnlocked = true; save(); } else if (mode === 'once') prevOnce = true; else { S.prevUnlocked = false; prevOnce = false; save(); } renderFeed(); },
    shared: id => sharedWith(slot(id)), idx: () => JSON.parse(JSON.stringify(IDX)), deleteIfUnused,
    setSlot: (id, patch) => { const s = slot(id); if (s) { Object.assign(s, patch); save(); render(); } },
    capLoad: (id, options, basis) => { const s = S && S.slots.find(x => x.id === id); if (s) { capLoad(s, options, basis); changed(); } }
  };
  M._test.fileRec = async id => {       // stored photo: record fields + the real size of its image and thumbnail
    const r = await idbGet('files', id); if (!r) return null;
    const px = async b => { if (!b) return null; const m = await createImageBitmap(b, { imageOrientation: 'from-image' }); const o = [m.width, m.height]; m.close(); return o; };
    return { name: r.name, type: r.type, w: r.w, h: r.h, size: r.size, lastModified: r.lastModified, reduced: !!r.reduced, bytes: r.blob ? r.blob.size : null, blobType: r.blob ? r.blob.type : null, px: await px(r.blob), thumbPx: await px(r.thumb) };
  };

  try { localStorage.setItem('mesa-code', '(' + mesaBoot.toString() + ')()'); localStorage.setItem('mesa-version', M.version); } catch (e) { /* storage off */ }
  return 'Mesa de trabajo ' + M.version + ' cargada';
})();
