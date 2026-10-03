// Mesa de feed — Uribe Visuals · v3.4
// Planning board for each client's Instagram grid. Kevin drops photos, arranges them on the empty grid of
// the month being prepared (one cell per publication loaded from Notion), sees the whole previous month under
// the line, and Claude later uploads the chosen (cropped) photos to each publication's Notion page.
// Runs in the Claude desktop app's built-in browser on a host page without a restrictive CSP; designed to be
// hosted as a static page later (GitHub Pages): it builds its own UI and keeps everything in IndexedDB.
(function mesaBoot() {
  const M = window.MESA = window.MESA || {};
  let prevDispose = typeof M._dispose === 'function' ? M._dispose : null;   // previous instance on this page
  M.version = '3.9';

  const TZ = 'Europe/Madrid';
  const THUMB_LONG = 1600;                               // px, long side of on-screen thumbnails
  const MAX_UPLOAD = 20 * 1024 * 1024 - 256 * 1024;      // Notion single-part limit (20 MiB) with margin
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
  M.out = M.out || {};                 // rendered preview Blobs
  M._ctrl = M._ctrl || {};             // fileId -> controller of the running upload
  M._gen = M._gen || {};               // fileId -> generation of the latest upload request

  let S = null;          // open board (month of one client), persisted
  let PB = null;         // same client's previous-month board, read only (null if it doesn't exist)
  let CL = [];           // clients
  let MB = [];           // month boards of the open client: [{key, month, filled, n}]
  let curClient = null;  // id of the open tab
  let root = null;
  let sel = null;        // fileId selected in the tray (click-to-place)
  let drag = null;       // current internal drag
  let cur = { slot: null, idx: 0 };
  let importing = 0;     // photos being prepared
  let UP = { total: 0, done: 0 };
  let busyText = { imp: null, up: null, sel: null };
  let downOnBackdrop = false;
  const TAB = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let locked = false;    // another tab/window took over: this one stops saving
  let bc = null;
  try { bc = new BroadcastChannel('mesa-feed'); } catch (e) { bc = null; }
  if (bc) bc.onmessage = e => { if (e.data && e.data.t === 'claim' && e.data.id !== TAB) lockHere(); };
  function claim() { locked = false; if (bc) { try { bc.postMessage({ t: 'claim', id: TAB }); } catch (e) { /* */ } } if (root) { const o = root.querySelector('.lock'); if (o) o.remove(); } }
  async function lockHere() {
    if (locked) return;
    try { await flushNow(); } catch (e) { /* */ }
    locked = true;
    if (!shellReady()) return;
    const o = document.createElement('div'); o.className = 'lock';
    o.innerHTML = '<div class="card dlg"><h3>La mesa está abierta en otra pestaña</h3><p>Para no pisar cambios, esta se ha pausado. Lo último que hiciste aquí está guardado.</p><div class="form"><div class="row"><button type="button" class="btn" data-act="takeover">Usar aquí</button></div></div></div>';
    root.append(o);
  }

  // ---------- IndexedDB ----------
  let dbp = null, dbConn = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('mesa-feed', 2);
      r.onupgradeneeded = () => { const d = r.result; for (const n of ['files', 'boards', 'clients']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); };
      r.onsuccess = () => { const d = r.result; dbConn = d; d.onversionchange = () => { try { d.close(); } catch (e) { /* */ } dbp = null; dbConn = null; }; res(d); };
      r.onerror = () => { dbp = null; rej(r.error); };
      r.onblocked = () => { const m = 'Hay otra copia de la mesa abierta con una versión anterior. Ciérrala o recarga esta página.'; if (shellReady()) toast(m); else if (document.body) document.body.textContent = m; };
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const req = fn(t.objectStore(store));
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
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isReel = t => t === 'Reel' || t === 'Collab Reel' || t === 'Trial Reel';
  const isCarousel = t => t === 'Carrusel';
  const isMulti = t => isCarousel(t) || t === 'Foto';                 // Foto: candidates (only the cover is published)
  const publishList = s => isCarousel(s.type) ? s.photos : s.photos.slice(0, 1);
  const noteOf = s => String(s.note || '').trim();                   // «Contexto»: goes to Notion for the caption
  const memoOf = s => String(s.memo || '').trim();                   // «Nota»: only for Kevin, never uploaded
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const newId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const slugify = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'cliente';
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage off */ } };
  const refsOf = b => new Set([...(b.tray || []), ...(b.slots || []).flatMap(s => s.photos || []), ...(b.prev || []).filter(p => p.own).flatMap(p => p.photos || [])]);
  const slot = id => S && (S.slots.find(s => s.id === id) || (S.prev || []).find(p => p.id === id));
  const prevItem = id => S && (S.prev || []).find(p => p.id === id);
  const isPrev = s => !!(s && S && S.prev && S.prev.includes(s));
  const uploadsBusy = () => Object.values(M.uploads).some(u => u.state === 'pending' || u.state === 'uploading');

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
    if (m) return (type === 'Reel' || type === 'Trial Reel' ? 'Reel ' : isCarousel(type) ? 'Carrusel ' : 'Foto ') + m[1];
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
  function rangeLabel(m, span, short) {
    const last = addMonths(m, Math.max(1, span || 1) - 1);
    if (last === m) return monthLabel(m, short);
    const nm = x => { const n = MONTHS[+x.slice(5) - 1]; return cap(short ? n.slice(0, 3) : n); };
    return m.slice(0, 4) === last.slice(0, 4) ? `${nm(m)}–${nm(last)} ${last.slice(0, 4)}` : `${nm(m)} ${m.slice(0, 4)}–${nm(last)} ${last.slice(0, 4)}`;
  }
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
  const ord = iso => dOnly(iso) ? ts(madridISO(localDay(iso), '00:00')) : ts(iso);
  const initials = name => String(name || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

  // ---------- crop model (post format + reframe) ----------
  // Instagram feed formats: 4:5, 3:4, landscape up to 1.91:1. The profile grid shows the centred 3:4 of the post.
  // Per photo: {fmt, cx, cy, z}. A carousel's format lives on the slot (s.fmt); a reel cover is always 3:4.
  const FMT_LABEL = { v45: '4:5', v34: '3:4', h: 'Horizontal' };
  const dims = fid => M.files[fid] || { w: 3, h: 4 };
  function fmtRatio(fmt, w, h) {
    if (fmt === 'v45') return 4 / 5;
    if (fmt === 'v34') return 3 / 4;
    const r = w / h; return r >= 1 ? Math.min(r, 1.91) : 16 / 9;
  }
  function baseCrop(fid, B) { const f = dims(fid); return (B && B.crops && B.crops[fid]) || { fmt: f.w > f.h ? 'h' : 'v45', cx: 0.5, cy: 0.5, z: 1 }; }
  function slotFmt(s, B) { return s.fmt || (s.photos.length ? baseCrop(s.photos[0], B).fmt : 'v45'); }
  function cropOf(fid, s, B = S) {
    const c = { ...baseCrop(fid, B) };
    if (s && isReel(s.type)) c.fmt = 'v34';
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
    if (isCarousel(s.type)) { s.fmt = fmt; s.photos.forEach(fid => { S.crops[fid] = { ...baseCrop(fid, S), cx: 0.5, cy: 0.5, z: 1 }; }); }
    else setCrop(s.photos[cur.idx], s, { fmt, cx: 0.5, cy: 0.5, z: 1 });
    save(); renderFeed(); openDetail(slotId, cur.idx);
  }
  // A carousel keeps the format it had when it got its first photo, so reordering never flips it silently.
  function normalize() {
    if (!S) return;
    S.slots.forEach(s => {
      if (!isCarousel(s.type)) { delete s.fmt; return; }
      if (!s.photos.length) delete s.fmt;
      else if (!s.fmt) s.fmt = baseCrop(s.photos[0], S).fmt;
    });
  }

  // ---------- Notion nomenclature (renumbering after a date change) ----------
  // Normal posts «<prefijo><W>.<N>» (prefix kept exactly, «Reel» included); collabs «COLLAB … <Mes> <K>».
  // The week rule lives only here: Monday–Sunday weeks; a week belongs to the month that holds its Thursday.
  // Week of the month (rule of the clients' «Skill» pages in Notion): Monday–Sunday weeks cut at the month edges, so the
  // 1st always starts week 1 and a trailing Monday/Tuesday opens a new week (31 Aug 2026 = 6.1); a month that starts on
  // a Sunday folds that day into week 1 (Nov 2026: 1–8 Nov = week 1). Returns 'YYYY-MM#W'.
  function weekOf(day) {
    const [y, m, d] = day.split('-').map(Number), dow1 = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const w = dow1 === 6 ? (d === 1 ? 1 : Math.floor((d - 2) / 7) + 1) : Math.floor((d - 1 + dow1) / 7) + 1;
    return day.slice(0, 7) + '#' + w;
  }
  const RX_N = /^([\s\S]*?)(\d+)\.(\d+)$/, RX_C = /^(COLLAB\b[\s\S]*?\s)(\p{L}+)(\s+)(\d+)$/iu;
  function nameKind(s) {   // how a post is numbered, from its Notion name (null = never renamed)
    const nm = String(s.notionName ?? s.name ?? '');
    if (s.type === 'Collab Reel' || /^collab\b/i.test(nm)) { const m = nm.match(RX_C); return m && MONTHS.includes(m[2].toLowerCase()) ? { c: true, p: m[1], sep: m[3], n: +m[4] } : null; }
    const m = nm.match(RX_N); return m ? { c: false, p: m[1], n: +m[3] } : null;
  }
  // group key 'YYYY-MM…': a week («YYYY-MM#W») or the collabs of one partner in a month («YYYY-MM@PREFIJO»)
  const grpOf = (k, iso) => { const d = localDay(iso); return !d ? null : k.c ? d.slice(0, 7) + '@' + k.p.replace(/\s+/g, ' ').trim().toUpperCase() : weekOf(d); };
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
      const g = K[s.id] && grpOf(K[s.id], s.date), inB = g && bm.includes(g.slice(0, 7));
      out[s.id] = g && !inB ? s.name : s.notionName ?? s.name;
      if (inB && aff.has(g)) (G[g] = G[g] || []).push(s);
    });
    for (const g in G) G[g].sort((a, b) => ord(a.date) - ord(b.date) || K[a.id].n - K[b.id].n || (a.id < b.id ? -1 : 1)).forEach((s, i) => {
      const k = K[s.id];
      out[s.id] = k.c ? `${k.p}${cap(MONTHS[+g.slice(5, 7) - 1])}${k.sep}${i + 1}` : `${k.p}${g.split('#')[1]}.${i + 1}`;
    });
    return out;
  }
  function renumber() { const nm = computeNames(); S.slots.forEach(s => { s.name = nm[s.id]; if (s.hold && !nameChg(s)) delete s.hold; }); }
  // a pending rename that no pending date explains any more (its cause is already in Notion) must not get lost
  // (skip: ids of the posts whose change Notion overrode in init — their own renames go)
  function holdOrphans(skip) { const K = kinds(), aff = affected(K, false); S.slots.forEach(s => { if (!(skip && skip.has(s.id)) && nameChg(s) && K[s.id] && !aff.has(grpOf(K[s.id], s.date))) s.hold = true; }); }
  const sortSlots = () => S.slots.sort((a, b) => ts(b.date) - ts(a.date));
  const boardMonths = () => S ? monthsOf(S.month, S.span) : [];
  const outToast = () => toast(`Esa fecha cae fuera de la mesa (${rangeLabel(S.month, S.span).toLowerCase()}).`);
  // back: return to the Notion date (allowed even outside the board's months); src: the post-view input being typed in
  function setDate(id, iso, back, src) {
    const s = S && S.slots.find(x => x.id === id); if (!s) return 'no existe';
    const day = localDay(iso); if (!day) return 'fecha no válida';
    if (!back && !boardMonths().includes(day.slice(0, 7))) { outToast(); return 'fuera de la mesa'; }
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
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>'
  };

  // ---------- persistence ----------
  let saveTimer = null;
  // editedAt = last real change of a board's content (opening or re-saving it doesn't count): decides import merges
  const BODY = new WeakMap();
  function edited(B) { const b = boardBody(B); if (BODY.get(B) !== b) { B.editedAt = new Date().toISOString(); BODY.set(B, b); } }
  function save() {
    if (!S || locked) return;
    clearTimeout(saveTimer);
    setSave('Guardando…');
    const B = S;
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      try { stamp(B); edited(B); B.savedAt = new Date().toISOString(); await idbPut('boards', B.key, JSON.parse(JSON.stringify(B))); await pushShared(B); if (B === S) setSave('Guardado'); }
      catch (e) { setSave('No se pudo guardar', true); }
    }, 250);
  }
  async function flushNow() {
    clearTimeout(saveTimer); saveTimer = null;
    clearTimeout(noteTimer); noteTimer = null;
    if (!S || locked) return null;
    const B = S;
    stamp(B); edited(B); B.savedAt = new Date().toISOString();
    await idbPut('boards', B.key, JSON.parse(JSON.stringify(B)));
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
  // publication, so its photos (with their crops), contexto (note), nota (memo), format, upload record, date and name are shared. Each slot
  // keeps a revision (s.at, ms): a save writes the changed ones through to every other board that has them, and
  // opening a board takes the newest copy of each of its slots.
  const SYNC = ['photos', 'note', 'memo', 'uploaded', 'fmt', 'date', 'notionDate', 'name', 'notionName'];
  let IDX = {};                                     // slotId -> [{key, client}] of the other boards that have it
  let SIG = { b: null, m: {}, dirty: new Set() };   // open board: signature of each slot as last saved + slots to write through
  const boardClient = b => b.client || (String(b.key || '').match(/^(.+)-\d{4}-\d{2}$/) || [])[1] || null;
  const slotSig = (s, B) => JSON.stringify([SYNC.map(k => s[k] ?? null), (s.photos || []).map(f => (B.crops || {})[f] || null)]);
  function copyShared(to, toB, from, fromB) {
    for (const k of SYNC) { if (from[k] === undefined) delete to[k]; else to[k] = JSON.parse(JSON.stringify(from[k])); }
    if (from.at) to.at = from.at; else delete to.at;
    toB.crops = toB.crops || {};
    for (const f of to.photos || []) { const c = fromB.crops && fromB.crops[f]; if (c) toB.crops[f] = { ...c }; else delete toB.crops[f]; }
  }
  // init: the newest copy of each slot (this board's or another's) becomes the «old» copy the board is built from
  async function importShared(cfgSlots, old, key) {
    let pend = null; try { pend = JSON.parse(lsGet('mesa-pending') || 'null'); } catch (e) { /* */ }
    const others = ((await idbAll('boards')) || []).filter(b => b.key !== key)
      .map(b => pend && pend.board && pend.key === b.key && String(pend.board.savedAt || '') > String(b.savedAt || '') ? pend.board : b);
    const refs = new Set(others.flatMap(b => [...refsOf(b)]));
    old.slots = old.slots || []; old.tray = old.tray || []; old.crops = old.crops || {};
    IDX = {};
    for (const id of new Set(cfgSlots.map(s => s.id))) {
      const own = old.slots.find(s => s.id === id);
      let best = own, from = null;
      for (const b of others) {
        const s = (b.slots || []).find(x => x.id === id); if (!s) continue;
        (IDX[id] = IDX[id] || []).push({ key: b.key, client: boardClient(b) });
        if (!best || (s.at || 0) > (best.at || 0)) { best = s; from = b; }
      }
      if (!from) continue;
      const o = { ...(own || {}), id };
      copyShared(o, old, best, from);
      for (const f of (own && own.photos) || []) if (!(o.photos || []).includes(f) && !refs.has(f)) old.tray.push(f);   // never lose a photo
      if (own) old.slots[old.slots.indexOf(own)] = o; else old.slots.push(o);
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
    const by = {}, gone = [], srcRefs = refsOf(B);
    ids.forEach(id => (IDX[id] || []).forEach(x => { (by[x.key] = by[x.key] || []).push(id); }));
    try {
      await tx('boards', 'readwrite', st => { for (const k of Object.keys(by)) { const g = st.get(k); g.onsuccess = () => {
        const ob = g.result; if (!ob) { gone.push(k); return; }
        let hit = false;
        for (const id of by[k]) {
          const s = B.slots.find(x => x.id === id), o = (ob.slots || []).find(x => x.id === id); if (!s || !o) continue;
          const had = (o.photos || []).filter(f => !s.photos.includes(f));
          copyShared(o, ob, s, B); ob.tray = (ob.tray || []).filter(f => !s.photos.includes(f)); hit = true;
          const refs = refsOf(ob), lost = had.filter(f => !refs.has(f) && !srcRefs.has(f));   // never orphan a photo (one this board still holds stays only here)
          if (lost.length) ob.tray.unshift(...lost);
        }
        if (hit) { ob.editedAt = new Date().toISOString(); st.put(ob, k); }
      }; } });
    } catch (e) { if (SIG.b === B) ids.forEach(id => SIG.dirty.add(id)); return; }
    if (gone.length) { dropIdx(gone); renderFeed(); }
    if (B === S && Object.keys(by).some(k => MB.some(m => m.key === k))) { await refreshMonths(); renderBar(); }
  }
  function dropIdx(keys) { for (const id of Object.keys(IDX)) { IDX[id] = IDX[id].filter(x => !keys.includes(x.key)); if (!IDX[id].length) delete IDX[id]; } }
  function sharedWith(s) {         // the other clients whose boards have this publication (a collab)
    if (!S || !s) return [];
    return [...new Set((IDX[s.id] || []).map(x => x.client).filter(c => c && c !== S.client))].map(c => (CL.find(x => x.id === c) || {}).name || c);
  }
  const linkLine = s => { const w = sharedWith(s); return w.length ? `<p class="lk">Collab enlazada con ${esc(w.join(' y '))}: foto, fecha, hora, contexto y nota se cambian en ${w.length > 1 ? 'todas' : 'las dos'}.</p>` : ''; };

  async function loadClients() { CL = ((await idbAll('clients')) || []).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))); return CL; }
  async function refreshMonths() {
    const all = (await idbAll('boards')) || [];
    MB = all.filter(b => b.client === curClient).map(b => ({ key: b.key, month: b.month, span: b.span || 1, filled: (b.slots || []).filter(s => (s.photos || []).length).length, n: (b.slots || []).length }))
      .sort((a, b) => String(b.month).localeCompare(String(a.month)));
  }

  // ---------- images ----------
  async function thumbFromBitmap(src, w, h) {
    const k = Math.min(1, THUMB_LONG / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/jpeg', 0.86));
  }
  async function makeThumb(blob) {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    try { const w = bmp.width, h = bmp.height; return { w, h, thumb: await thumbFromBitmap(bmp, w, h) }; }
    finally { bmp.close(); }
  }
  async function reencode(blob) {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
    cx.drawImage(bmp, 0, 0); bmp.close();
    for (const q of [0.92, 0.88, 0.82, 0.75]) {
      const b = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
      if (b && b.size <= MAX_UPLOAD) return b;
    }
    throw new Error('supera 20 MB incluso recomprimida');
  }
  async function getBlob(id) {
    if (M.blobs[id]) return M.blobs[id];
    const rec = await idbGet('files', id);
    if (!rec || !rec.blob) throw new Error('foto no encontrada en la mesa');
    return (M.blobs[id] = rec.blob);
  }
  async function cropBlob(blob, fid, r) {
    const f = M.files[fid];
    if (r.x < 1 && r.y < 1 && Math.abs(r.w - f.w) < 1 && Math.abs(r.h - f.h) < 1 && blob.type === 'image/jpeg' && blob.size <= MAX_UPLOAD) return { blob, w: f.w, h: f.h, original: true };
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const k = bmp.width / f.w;
    const c = document.createElement('canvas'); c.width = Math.round(r.w * k); c.height = Math.round(r.h * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high';
    x.drawImage(bmp, r.x * k, r.y * k, r.w * k, r.h * k, 0, 0, c.width, c.height); bmp.close();
    for (const q of [0.93, 0.9, 0.85, 0.8]) { const b = await new Promise(res => c.toBlob(res, 'image/jpeg', q)); if (b && b.size <= MAX_UPLOAD) return { blob: b, w: c.width, h: c.height }; }
    throw new Error('supera 20 MB incluso recortada');
  }
  async function loadThumbs(ids) {
    const missing = [];
    for (const id of ids) {
      if (M.files[id]) continue;
      const rec = await idbGet('files', id);
      if (rec && rec.thumb) { M.files[id] = { name: rec.name, size: rec.size, type: rec.type, w: rec.w, h: rec.h, thumbUrl: URL.createObjectURL(rec.thumb) }; if (rec.reduced) M.files[id].reduced = true; M.thumbBlobs[id] = rec.thumb; }
      else missing.push(id);
    }
    return missing;
  }

  // ---------- adding photos (serialised so two drops never race) ----------
  let addQ = Promise.resolve();
  M.addFiles = (list, targetSlotId) => {
    const files = Array.from(list || []);
    const p = addQ.then(() => addFilesNow(files, targetSlotId));
    addQ = p.catch(() => { /* keep the queue alive */ });
    return p;
  };
  async function addFilesNow(list, targetSlotId) {
    if (!S) { toast('Abre un mes antes de añadir fotos.'); return []; }
    const B = S;
    const files = list.filter(f => f && f.size).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
    const got = [], fresh = [];
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
        const dup = Object.keys(M.files).find(id => M.files[id].name === f.name && M.files[id].size === f.size);
        if (dup && (B.tray.includes(dup) || B.slots.some(s => s.photos.includes(dup)))) {
          if (!targetSlotId || !B.tray.includes(dup)) { toast(`${f.name} ya está en la mesa.`); continue; }
          got.push(dup); continue;
        }
        try {
          const { w, h, thumb } = await makeThumb(f);
          const id = dup || newId();
          await idbPut('files', id, { name: f.name, size: f.size, type, w, h, lastModified: f.lastModified || 0, blob: f, thumb });
          if (M.files[id]) URL.revokeObjectURL(M.files[id].thumbUrl);
          M.files[id] = { name: f.name, size: f.size, type, w, h, thumbUrl: URL.createObjectURL(thumb) };
          M.thumbBlobs[id] = thumb;
          delete M.blobs[id];
          fresh.push(id);
          got.push(id);
        } catch (e) {
          if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)))) { toast('El navegador no tiene espacio para más fotos. Quita fotos que ya no uses o termina y sube un mes.'); break; }
          toast(`${f.name}: no se pudo leer.`);
        }
      }
    } finally {
      if (fresh.length) B.tray.unshift(...fresh);          // newest imports first, in name order
      importing -= files.length; setBusy('imp', null);
    }
    if (B !== S) {
      if (fresh.length && S && S.key === B.key) { S.tray.unshift(...fresh.filter(id => !refsOf(S).has(id))); changed(); }
      else if (fresh.length && !locked) { try { await idbPut('boards', B.key, JSON.parse(JSON.stringify(B))); } catch (e) { /* */ } }
      return got;
    }
    if (targetSlotId && got.length) {
      const s = slot(targetSlotId);
      if (s && isCarousel(s.type)) got.forEach(id => place(targetSlotId, id, true));
      else if (s && s.type === 'Foto') got.slice().reverse().forEach(id => place(targetSlotId, id, true));
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
    if (sel === fileId) sel = null;
    const other = S.slots.find(x => x !== s && x.photos.includes(fileId));
    if (other) other.photos = other.photos.filter(x => x !== fileId);
    takeFromTray(fileId);
    if (isCarousel(s.type)) { if (!s.photos.includes(fileId)) s.photos.push(fileId); }
    else if (s.type === 'Foto') {
      const prev = s.photos[0];
      s.photos = [fileId, ...s.photos.filter(x => x !== fileId)];
      if (!silent && prev && prev !== fileId) toast('Nueva portada. La anterior queda como opción.', { action: 'Devolverla a la bandeja', onAction: () => { const k = s.photos.indexOf(prev); if (S && slot(slotId) === s && k > 0) unassign(slotId, k); } });
    }
    else { if (s.photos.length) S.tray.unshift(...s.photos.filter(x => x !== fileId)); s.photos = [fileId]; }
    if (!silent) changed();
  }
  function fixSingle(s) {
    if (!isMulti(s.type) && s.photos.length > 1) {
      S.tray.unshift(...s.photos.slice(1)); s.photos = s.photos.slice(0, 1);
      toast('Los reels solo llevan una portada: las demás fotos vuelven a la bandeja.');
    }
  }
  function swap(a, b) {
    if (a === b) return;
    const A = slot(a), B = slot(b); if (!A || !B) return;
    [A.photos, B.photos] = [B.photos, A.photos];
    if (isCarousel(A.type) && isCarousel(B.type)) [A.fmt, B.fmt] = [B.fmt, A.fmt];
    else { delete A.fmt; delete B.fmt; }
    fixSingle(A); fixSingle(B);
    changed();
  }
  function unassign(slotId, k, undoable) {
    const s = slot(slotId); if (!s) return;
    if (k != null && (k < 0 || k >= s.photos.length)) return;
    const back = k == null ? s.photos.slice() : [s.photos[k]];
    if (!back.length) return;
    const before = { photos: s.photos.slice(), fmt: s.fmt }, B = S;
    if (back.includes(sel)) sel = null;
    s.photos = s.photos.filter(x => !back.includes(x));
    S.tray.unshift(...back);
    changed();
    const after = s.photos.slice();
    if (undoable) toast(back.length > 1 ? `${back.length} fotos vuelven a la bandeja.` : 'La foto vuelve a la bandeja.', { action: 'Deshacer', ms: UNDO_MS, onAction: () => {
      if (S !== B || !slot(slotId) || !same(s.photos, after) || !back.every(id => S.tray.includes(id))) { toast('No se puede deshacer: la casilla ya ha cambiado.'); return; }
      S.tray = S.tray.filter(id => !back.includes(id));
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
    noteTimer = setTimeout(() => { noteTimer = null; save(); renderFeed(); renderBar(); }, 400);
  }
  function setMemo(slotId, text) {           // «Nota»: saved and shared like the contexto, never uploaded (empty = no field)
    const s = slot(slotId); if (!s) return;
    if (text) s.memo = text; else delete s.memo;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { noteTimer = null; save(); renderFeed(); renderBar(); }, 400);
  }
  function move(slotId, k, dir) {
    const s = slot(slotId), j = k + dir;
    if (!s || j < 0 || j >= s.photos.length) return;
    [s.photos[k], s.photos[j]] = [s.photos[j], s.photos[k]];
    changed();
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
    if (S && refsOf(S).has(fileId)) return;
    const boards = await idbAll('boards');
    if (boards.some(b => (!S || b.key !== S.key) && refsOf(b).has(fileId))) return;
    await idbDel('files', fileId);
    if (M.files[fileId]) URL.revokeObjectURL(M.files[fileId].thumbUrl);
    if (M.bigUrls && M.bigUrls[fileId]) { URL.revokeObjectURL(M.bigUrls[fileId]); delete M.bigUrls[fileId]; }
    delete M.files[fileId]; delete M.blobs[fileId]; delete M.thumbBlobs[fileId];
  }
  function changed() { normalize(); save(); render(); }

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
    const pm = S ? monthLabel(prevMonth(S.month)).toLowerCase() : 'el mes anterior';
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
#mesa .cell.full{cursor:grab}
#mesa .cell.empty{background:#f5f5f5;cursor:pointer}
#mesa .cell.empty::before{content:'';position:absolute;inset:6px;border:1.5px dashed #c9c9c9;border-radius:6px;pointer-events:none}
#mesa .cell.empty:hover{background:#eef6fe}#mesa .cell.empty:hover::before{border-color:#8cc8f5}
#mesa .ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;padding:12px;color:var(--mute)}
#mesa .ph b{color:var(--ink);font-size:12.5px}#mesa .ph span{font-size:11px}
#mesa .pico svg{width:20px;height:20px;color:#8e8e8e}
#mesa .ico{position:absolute;top:7px;right:7px;width:19px;height:19px;color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55))}
#mesa .ico svg{width:100%;height:100%}
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
#mesa .badges .dot.ok{background:var(--ok);color:#fff}
#mesa .badges .dot.chg{background:var(--chg);color:#fff}
#mesa .badges .dot.ltag,#mesa .badges .dot.cb{background:#0064d1;color:#fff}
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
#mesa .pmonth{position:absolute;top:4px;left:4px;z-index:3;font-size:9.5px;font-weight:600;background:var(--acc);color:#fff;border-radius:999px;padding:1px 7px;opacity:.95;cursor:pointer}
#mesa .pmonth::after{content:'';position:absolute;inset:-7px -4px -9px}
#mesa .ptag2{position:absolute;top:28px;left:4px;z-index:3;font-size:9.5px;font-weight:600;background:rgba(38,38,38,.85);color:#fff;border-radius:4px;padding:1px 6px;pointer-events:none}
#mesa .ptag2.ed{background:rgba(0,149,246,.9)}
#mesa .cell.past.phidden img,#mesa .cell.past.phidden .ph{opacity:.35}
#mesa .cell.past:not(.locked){cursor:grab}
#mesa .cell.past.locked{cursor:pointer}
#mesa .lockbtn{border:1px solid var(--line);background:var(--panel);border-radius:999px;font-size:11.5px;padding:3px 9px;min-height:28px;color:var(--ink)}
#mesa .lockbtn.on{border-color:var(--acc);color:var(--acc)}
#mesa .pthumb{max-width:100%;max-height:60vh;display:block;margin:0 auto;border-radius:4px}
#mesa .pvacts{display:flex;flex-direction:column;gap:8px;margin-top:4px}
#mesa .pvacts button{text-align:left}
#mesa .pdate{position:absolute;left:6px;bottom:5px;z-index:3;font-size:10px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7);pointer-events:none}
#mesa .cell.past.nophoto .ph b{color:#8e8e8e}
#mesa .cell.over{outline:3px solid var(--acc) !important;outline-offset:-3px !important}
#mesa .cell.dragging,#mesa .titem.dragging{opacity:.35}
#mesa.picking .cell:not(.past){cursor:copy}
#mesa .tray{flex:1;min-width:0;overflow-y:auto;background:var(--bg)}
#mesa .tray.over{background:#e8f3fe}
#mesa .trayhead{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;padding:10px 12px;background:inherit}
#mesa .trayhead b{font-size:14px}#mesa .trayhead span{color:var(--mute);font-size:12px}
#mesa .btn{border:0;border-radius:8px;background:var(--acc);color:#fff !important;font-weight:600;font-size:13px;padding:7px 12px;display:inline-flex;gap:6px;align-items:center}
#mesa .btn svg{width:15px;height:15px}
#mesa .btn:hover{background:var(--acc2)}
#mesa .trayhead .btn{margin-left:auto}
#mesa .btn2{border:1px solid var(--line);border-radius:8px;background:var(--panel);font-size:13px;padding:6px 11px}
#mesa .btn2:hover{border-color:#bdbdbd}
#mesa .btn2.danger{color:var(--red);border-color:#efc2c2}
#mesa .tbody{padding:0 12px 24px}
#mesa .drop{border:1.5px dashed #c7c7c7;border-radius:10px;padding:14px;text-align:center;color:var(--mute);font-size:12.5px;margin-bottom:10px;background:var(--panel)}
#mesa .tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px}
#mesa .titem{position:relative;aspect-ratio:3/4;border-radius:6px;overflow:hidden;background:#efefef;cursor:grab}
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
#mesa .form label{display:block;font-size:12.5px;font-weight:600;margin:12px 0 5px}#mesa .form label span{font-weight:400;color:var(--mute)}
#mesa .form input[type=text]{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 10px;font:14px ${FONT};color:var(--ink)}
#mesa .form input[type=text]:focus{outline:2px solid var(--acc);outline-offset:-1px;border-color:transparent}
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
#mesa .phead .pnot{flex-wrap:nowrap}#mesa .phead .pnot>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mesa .phead .pnot .lnk{flex:none;white-space:nowrap;padding:6px 2px}
#mesa .pbody{display:grid;grid-template-columns:minmax(0,1fr) clamp(190px,32%,300px);min-height:0;flex:1;overflow:auto}
#mesa .pleft{padding:12px;display:flex;flex-direction:column;align-items:center;gap:10px;background:var(--bg);border-right:1px solid var(--line2);min-width:0}
#mesa .stagewrap{width:100%;display:flex;justify-content:center}
#mesa .stage{position:relative;overflow:hidden;background:#111;touch-action:none;cursor:grab;user-select:none;width:300px;height:375px}
#mesa .stage.panning{cursor:grabbing}
#mesa .stage img.big{position:absolute;max-width:none;pointer-events:none;-webkit-user-drag:none}
#mesa .stage.fixed{cursor:default}
#mesa .gguide{position:absolute;z-index:1;pointer-events:none;outline:1.5px dashed rgba(255,255,255,.95);box-shadow:0 0 0 9999px rgba(0,0,0,.22)}
#mesa .gguide span{position:absolute;left:6px;top:6px;font-size:10px;color:#fff;background:rgba(0,0,0,.5);border-radius:4px;padding:1px 5px}
#mesa .thirds{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;transition:opacity .15s}
#mesa .thirds i{position:absolute;background:rgba(255,255,255,.45);box-shadow:0 0 1.5px rgba(0,0,0,.35)}
#mesa .thirds i:nth-child(-n+2){top:0;bottom:0;width:1px}#mesa .thirds i:nth-child(n+3){left:0;right:0;height:1px}
#mesa .thirds i:nth-child(1){left:33.333%}#mesa .thirds i:nth-child(2){left:66.667%}#mesa .thirds i:nth-child(3){top:33.333%}#mesa .thirds i:nth-child(4){top:66.667%}
#mesa .stage:hover .thirds,#mesa .stage.panning .thirds,#mesa .stage.reframe .thirds{opacity:1}
#mesa .nav{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:var(--ink);font-size:20px;line-height:34px;padding:0;box-shadow:0 1px 4px rgba(0,0,0,.35);z-index:2}
#mesa .nav.prev{left:8px}#mesa .nav.next{right:8px}#mesa .nav[hidden]{display:none}
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
#mesa .strip .th img{width:100%;height:100%;object-fit:cover;display:block}
#mesa .strip .th span{position:absolute;left:0;right:0;bottom:0;font-size:9px;color:#fff;background:rgba(0,0,0,.55);text-align:center;line-height:14px}
#mesa .pacts{width:100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#mesa .pacts button{border:1px solid var(--line);background:var(--panel);border-radius:6px;font-size:12px;padding:6px 10px;min-height:32px}
#mesa .pacts button:disabled{opacity:.35;cursor:default}
#mesa .pacts .fname{color:var(--mute);font-size:11.5px;margin-right:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:50%}
#mesa .pright{padding:12px 14px;display:flex;flex-direction:column;min-width:0}
#mesa .pright textarea.note{flex:1;min-height:180px}
#mesa .pempty{color:#9a9a9a;font-size:13px;text-align:center;padding:60px 12px}
#mesa .toasts{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;flex-direction:column;gap:6px;align-items:center;z-index:9;pointer-events:none}
#mesa .toast{pointer-events:none;background:var(--ink);color:#fff;font-size:12.5px;padding:8px 12px;border-radius:8px;max-width:90vw;display:flex;gap:12px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.25)}
#mesa .toast button{pointer-events:auto;border:0;background:none;color:#7cc4fa;font-weight:600;font-size:12.5px;padding:4px 2px;white-space:nowrap}
#mesa .lock{position:absolute;inset:0;z-index:20;background:rgba(250,250,250,.94);display:flex;align-items:center;justify-content:center;padding:16px}
#mesa.client .lab,#mesa.client .badges,#mesa.client .cnt,#mesa.client .pdate,#mesa.client .pmonth,#mesa.client .ptag2,#mesa.client .cell.past.phidden,#mesa.client .ph>*,#mesa.client .legend,#mesa.client .tray{display:none}
#mesa.client .cell.empty::before{display:none}
#mesa.client .cell.empty{background:#efefef}
#mesa.client .bd{display:none}
#mesa.client .stats,#mesa.client .mchip i{display:none}
#mesa.client .feed{margin:0 auto;border-left:1px solid var(--line)}
@media (max-width:560px){#mesa .pbody{grid-template-columns:1fr}#mesa .pleft{border-right:0;border-bottom:1px solid var(--line2)}#mesa .pright textarea.note{min-height:90px}#mesa .pright textarea.memo{min-height:52px}}
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
#mesa .main{flex-direction:column}
#mesa .feed{width:100%;flex:1;border-right:0;border-bottom:1px solid var(--line)}
#mesa .tray{flex:none;overflow:hidden;display:flex;flex-direction:column}
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
#mesa .card>p.xwhat{color:var(--ink);font-size:13px}`;

  function buildShell() {
    document.title = 'Mesa de feed';
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    const st = document.createElement('style'); st.textContent = CSS; document.body.append(st);
    root = document.createElement('div');
    root.id = 'mesa';
    root.innerHTML = `<header class="appbar"><div class="brand">${ICON.grid}<span>Mesa de feed</span></div><nav class="tabs" aria-label="Clientes"></nav><button class="tab add" data-act="newclient" title="Crear un cliente nuevo">+ Cliente</button><button class="ibtn xfer" data-act="xfer" title="Exportar / importar la mesa (para pasarla a otro Mac)" aria-label="Exportar o importar la mesa">⇅</button><span class="save" aria-live="polite"></span></header>`
      + '<section class="bar"></section><div class="busy" hidden></div><div class="main"></div><div class="detail" hidden></div><div class="toasts" aria-live="polite"></div>'
      + '<input type="file" class="picker" accept="image/jpeg,image/png,image/webp" multiple hidden>';
    document.body.append(root);
    mainMode = null;
    wire();
  }
  const shellReady = () => root && document.body.contains(root);

  let pendingRender = false;
  function render() {
    if (!shellReady()) return;
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
    const n = S.slots.length, filled = S.slots.filter(s => s.photos.length).length, notes = S.slots.filter(s => noteOf(s)).length;
    const st = S.slots.map(slotStatus); return { n, filled, notes, ok: st.filter(x => x === 'ok').length, chg: st.filter(x => x === 'chg').length, dates: S.slots.filter(dateChg).length, names: S.slots.filter(nameChg).length };
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
      return `<button class="mchip${S && b.key === S.key ? ' on' : ''}" data-act="month" data-key="${esc(b.key)}">${esc(rangeLabel(b.month, b.span, true))}<i>${f}/${n}</i></button>`;
    }).join('');
    let stats = '';
    if (S) {
      const k = counts();
      const pl = (n, a, b) => n === 1 ? a : b;
      stats = `<div class="stats"><span title="Publicaciones con foto"><b>${k.filled}</b>/${k.n} <span class="lg">con </span>foto</span><span title="Publicaciones con contexto para el caption (se sube a Notion)"><b>${k.notes}</b> <span class="lg">con </span>contexto</span><span><b>${k.ok}</b> en Notion</span>${k.chg ? `<span class="c" title="Cambiadas después de subirlas a Notion (foto, encuadre o contexto): pide a Claude que las vuelva a subir"><b class="c">${k.chg}</b> ${pl(k.chg, 'cambiada', 'cambiadas')}</span>` : ''}`
        + (k.dates ? `<span class="c dates" title="Fecha u hora cambiada aquí: al subir a Notion se cambia allí${k.names ? ` y se renombran ${k.names} publicaci${k.names === 1 ? 'ón' : 'ones'} para que la numeración cuadre` : ''}"><i class="dchg" aria-hidden="true"></i><b class="c">${k.dates}</b> con fecha nueva</span>` : '') + '</div>';
    }
    bar.innerHTML = `<div class="ident"><div class="av" aria-hidden="true">${esc(initials(c.name))}</div><div class="who"><b>${esc(c.name)}</b><span>${esc(c.handle || 'sin @usuario')}</span></div><button class="ibtn" data-act="editclient" title="Editar cliente" aria-label="Editar cliente">⋯</button></div>`
      + `<div class="mgrp"><div class="months">${months}</div><button class="mchip ghost" data-act="howmonth" title="Cómo cargar otro mes">+ Mes</button></div><div class="spacer"></div>${stats}`
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
        main.innerHTML = '<section class="feed"><div class="legend"></div><div class="grid"></div></section>'
          + '<aside class="tray"><div class="trayhead"><b>Bandeja</b><span class="tcount"></span><button class="btn" data-act="add">' + ICON.upload + 'Añadir fotos</button></div>'
          + '<div class="tbody"><div class="drop">Arrastra aquí tus fotos (JPG o PNG) o pulsa «Añadir fotos».</div><div class="tgrid"></div>'
          + '<p class="hint">Arrastra cada foto a su casilla. Entre casillas se intercambian; de vuelta a la bandeja se quitan. Pulsa una casilla para verla en grande, elegir formato, reencuadrar y dejar una nota.</p></div></aside>';
        watchFeed();
      } else if (CL.length) {
        const c = CL.find(x => x.id === curClient);
        main.innerHTML = `<div class="empty"><div class="ecard">${ICON.grid}<h3>${esc(c ? c.name : 'Elige un cliente')}${c ? ': aún no hay ningún mes en la mesa' : ''}</h3>Los meses se cargan desde Notion, con las publicaciones del calendario ya creado. Pídeselo a Claude en el chat:<br><span class="say">«Carga ${esc(nextMonthName())} de ${esc(c ? c.name : 'este cliente')} en la mesa»</span></div></div>`;
      } else {
        main.innerHTML = `<div class="empty"><div class="ecard">${ICON.grid}<h3>Crea tu primer cliente</h3>Cada cliente tiene su pestaña, con sus meses.<br><br><button class="btn" data-act="newclient">+ Nuevo cliente</button></div></div>`;
      }
    }
    if (S) { renderFeed(); renderTray(); }
  }

  function nextMonthName() { const m = monthOf(new Date().toISOString()); let [y, mo] = m.split('-').map(Number); mo++; if (mo > 12) { mo = 1; y++; } return MONTHS[mo - 1]; }
  function slotStatus(s) {
    const u = s.uploaded; if (!u) return null;
    return same(u.fileIds || [], publishList(s)) && (u.note || '') === noteOf(s) && (u.crop == null || u.crop === cropSig(s)) ? 'ok' : 'chg';
  }
  function statusBadge(s) {
    const st = slotStatus(s);
    return st === 'ok' ? '<span class="st ok" title="Subida a Notion tal como está">✓ en Notion</span>' : st === 'chg' ? '<span class="st chg" title="Cambiada después de subirla a Notion (foto, encuadre o contexto): pide a Claude que la vuelva a subir">cambiada</span>' : '';
  }
  // cell markers: month pill, then a column of dots (text, state, collab) that open into their label after 0.5 s of hover
  const dot = (cls, label, aria) => `<span class="dot ${cls}" title="" aria-label="${esc(aria || label)}"><span class="dl">${esc(label)}</span></span>`;
  function badgesHTML(s, pill) {
    const mp = pill ? `<span class="mpill">${esc(pill)}</span>` : '';
    const cx = !!noteOf(s), me = !!memoOf(s), st = slotStatus(s), w = sharedWith(s);
    const d = (cx || me ? dot('nb', cx && me ? 'Contexto y nota' : cx ? 'Contexto' : 'Nota', cx && me ? 'Tiene contexto y nota' : cx ? 'Tiene contexto' : 'Tiene nota') : '')
      + (st === 'ok' ? dot('st ok', '✓ en Notion', 'Subida a Notion tal como está') : st === 'chg' ? dot('st chg', 'cambiada', 'Cambiada después de subirla a Notion: pide a Claude que la vuelva a subir') : '')
      + (w.length ? dot('ltag', 'Collab ↔ ' + w.join(' · '), 'Collab enlazada con ' + w.join(' y ') + ': foto, fecha, hora, contexto y nota se cambian en las dos') : s.type === 'Collab Reel' ? dot('tag cb', 'Collab') : '');
    return mp || d ? `<div class="badges">${mp}${d ? `<div class="mk">${d}</div>` : ''}</div>` : '';
  }
  const DCHG = '<i class="dchg" title="Fecha cambiada aquí: pendiente de pasar a Notion"></i>';
  const DNM = '<i class="dchg nm" title="Se renombra al subir"></i>';
  function cellHTML(s, pill) {
    const lab = shortLabel(s.name, s.type), when = (dateChg(s) ? DCHG : nameChg(s) ? DNM : '') + esc(fmtDate(s.date));
    const icon = isReel(s.type) ? ICON.reel : isCarousel(s.type) ? ICON.carousel : '';
    if (!s.photos.length) {
      return `<div class="cell empty" data-slot="${esc(s.id)}" title="${esc(s.name)}">${badgesHTML(s, pill)}<div class="ph"><span class="pico">${icon || ICON.photo}</span><b>${esc(lab)}</b><span>${when}</span></div></div>`;
    }
    const f = M.files[s.photos[0]] || {};
    const imgStyle = f.w ? rectStyle(f, gridRect(s.photos[0], s)) : '';
    const n = s.photos.length;
    const cnt = isCarousel(s.type) ? `<span class="cnt" title="${n} foto${n === 1 ? '' : 's'}">${n}<span class="cw"> foto${n === 1 ? '' : 's'}</span></span>` : (s.type === 'Foto' && n > 1) ? `<span class="cnt tr" title="${n} opciones">${n}<span class="cw"> opciones</span><span class="cs"> op.</span></span>` : '';
    return `<div class="cell full" draggable="true" data-slot="${esc(s.id)}" title="${esc(s.name)}"><img class="crop" src="${f.thumbUrl || ''}" style="${imgStyle}" alt="">${icon ? `<span class="ico">${icon}</span>` : ''}${badgesHTML(s, pill)}${cnt}<div class="lab"><b>${esc(lab)}</b>${when}</div></div>`;
  }
  function pastHTML(p, i, N) {
    const col = i % 3, bd = [];
    if (i - 3 < N) bd.push('border-top:4px solid #0095f6');
    if (i === N && col > 0) bd.push('border-left:4px solid #0095f6');
    const line = bd.length ? `<span class="bd" style="${bd.join(';')}"></span>` : '';
    const icon = isReel(p.type) ? ICON.reel : isCarousel(p.type) ? ICON.carousel : '';
    const date = `<span class="pdate">${esc(fmtDate(p.date, true))}</span>`;
    const lk = prevLocked();
    const pill = i === N ? `<span class="pmonth" data-act="prevlock" role="button" title="${lk ? 'Desbloquear' : 'Bloquear'} el mes anterior">${lk ? '🔒' : '🔓'} ${esc(cap(MONTHS[+prevMonth(S.month).slice(5) - 1]))} · publicado</span>` : '';
    const tags = (p.hidden ? '<span class="ptag2">Oculta</span>' : '') + (p.own && !p.hidden ? '<span class="ptag2 ed">Editada</span>' : '');
    const cls = `cell past${lk ? ' locked' : ''}${p.hidden ? ' phidden' : ''}`;
    const attrs = `data-prev="${esc(p.id)}" draggable="true" title="${esc(p.name)}${lk ? ' · bloqueada' : ''}"`;
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
    const N = S.slots.length, lk = prevLocked(), past = pastList(!lk), shown = past.filter(p => !p.hidden).length, nh = (S.prev || []).filter(p => p.hidden).length;
    const seen = new Set();   // range board: a month pill on the newest cell of each month
    const pill = s => { const m = (localDay(s.date) || '').slice(0, 7); if (S.span < 2 || !m || seen.has(m)) return ''; seen.add(m); return cap(MONTHS[+m.slice(5) - 1].slice(0, 3)); };
    grid.innerHTML = S.slots.map(s => cellHTML(s, pill(s))).join('') + past.map((p, j) => pastHTML(p, N + j, N)).join('');
    const pm = monthLabel(prevMonth(S.month));
    const lockBtn = (S.prev || []).length ? (S.prevUnlocked ? '<button class="lockbtn on" data-act="prevlock" title="Volver a bloquear el mes anterior">🔓 Desbloqueado · Bloquear</button>' : lk ? '<button class="lockbtn" data-act="prevlock" title="Desbloquear el mes anterior">🔒 Bloqueado</button>' : '<button class="lockbtn on" data-act="prevlock">🔓 Solo esta vez</button>') : '';
    const below = `Debajo: ${pm} · ${shown} publicada${shown === 1 ? '' : 's'}${nh ? ` · ${nh} oculta${nh === 1 ? '' : 's'}` : ''}${PB && PB.slots.length ? ' (de tu mesa)' : ''}`;
    root.querySelector('.feed .legend').innerHTML = `<span class="lr"><b>${esc(rangeLabel(S.month, S.span))}</b> · ${N} a preparar</span>`
      + ((S.prev || []).length ? `<span class="lp" title="${esc(below)}"><span class="ln"></span>Debajo: <b>${esc(pm)}</b> · ${shown} publicada${shown === 1 ? '' : 's'}${nh ? ` · ${nh} oculta${nh === 1 ? '' : 's'}` : ''}${PB && PB.slots.length ? ' (de tu mesa)' : ''}</span>${lockBtn}` : `<span class="lp">Sin publicaciones de ${esc(pm.toLowerCase())} cargadas</span>`);
    fitGrid();
  }
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
  function renderTray() {
    if (!S || !shellReady()) return;
    const tray = root.querySelector('.tray'); if (!tray) return;
    const opts = S.slots.filter(s => s.type === 'Foto').reduce((n, s) => n + Math.max(0, s.photos.length - 1), 0);
    tray.querySelector('.tcount').textContent = (S.tray.length ? `${S.tray.length} sin usar` : 'vacía') + (opts ? ` · ${opts} como ${opts === 1 ? 'opción' : 'opciones'}` : '');
    tray.classList.toggle('isempty', !S.tray.length);
    tray.querySelector('.tgrid').innerHTML = S.tray.map(id => {
      const f = M.files[id]; if (!f) return '';
      return `<div class="titem${sel === id ? ' sel' : ''}" draggable="true" data-file="${esc(id)}" title="${esc(f.name)} · arrástrala a una casilla o púlsala y luego la casilla"><img src="${f.thumbUrl}" alt="">${f.w > f.h ? '<span class="hb" title="Horizontal">H</span>' : ''}<span class="tname">${esc(f.name)}</span><button class="x" data-act="del" data-file="${esc(id)}" title="Quitar de la mesa" aria-label="Quitar ${esc(f.name)} de la mesa">×</button></div>`;
    }).join('');
  }

  // ---------- post view (Instagram-desktop style) ----------
  // a post opened with the keyboard gets focus on its close button; opened with the mouse, no focus ring appears
  let kbd = false;
  addEventListener('keydown', () => { kbd = true; }, true); addEventListener('pointerdown', () => { kbd = false; }, true);
  const focusClose = d => { const x = d.querySelector('.card > .x'); if (!x) return; if (kbd) x.focus({ preventScroll: true }); else if (d.contains(document.activeElement)) document.activeElement.blur(); };
  function openDetail(id, idx) {
    const s = slot(id); if (!s || !shellReady()) return;
    if (isPrev(s)) return openPast(id);
    const d = root.querySelector('.detail');
    if (idx == null) idx = cur.slot === id ? cur.idx : 0;
    const n = s.photos.length;
    idx = Math.max(0, Math.min(n - 1, idx || 0));
    // keep the focus and caret of the field being typed in (contexto or nota) if we're re-rendering the same post
    const ta = document.activeElement;
    const keep = ta && d.contains(ta) && ta.matches('textarea.note, textarea.memo') && ta.dataset.slot === id ? { c: ta.className, a: ta.selectionStart, b: ta.selectionEnd, t: ta.scrollTop } : null;
    // focus: the close button when the post opens (or when it had it before this re-render, e.g. arrow keys)
    const ae = document.activeElement, fresh = d.hidden || d.dataset.slot !== id || !!d.dataset.prev || !!(ae && d.contains(ae) && ae.matches('.card > .x'));
    cur = { slot: id, idx };
    const car = isCarousel(s.type), foto = s.type === 'Foto', reel = isReel(s.type);
    const fid = s.photos[idx];
    let left;
    if (!n) left = '<div class="pempty">Sin foto todavía.<br>Suelta una foto de la bandeja sobre la casilla.</div>';
    else {
      const c = cropOf(fid, s);
      const seg = `<div class="seg" role="group" aria-label="Formato">${['v45', 'v34', 'h'].map(k => `<button data-act="fmt" data-fmt="${k}" class="${c.fmt === k ? 'on' : ''}" aria-pressed="${c.fmt === k}">${FMT_LABEL[k]}</button>`).join('')}</div>`;
      const fmtCtl = reel ? '<span class="muted">Portada del perfil · 3:4</span>' : car ? `<span class="muted">Carrusel</span>${seg}` : seg;
      const nav = n > 1 ? `<button class="nav prev" data-act="prev" title="Anterior" aria-label="Foto anterior" ${idx === 0 ? 'hidden' : ''}>‹</button><button class="nav next" data-act="next" title="Siguiente" aria-label="Foto siguiente" ${idx === n - 1 ? 'hidden' : ''}>›</button><div class="dots">${s.photos.map((_, k) => `<i class="${k === idx ? 'on' : ''}"></i>`).join('')}</div>` : '';
      const strip = n > 1 ? `<div class="strip">${s.photos.map((p, k) => `<button class="th ${k === idx ? 'on' : ''}" data-act="pick" data-k="${k}" title="${esc((M.files[p] || {}).name || '')}"><img src="${(M.files[p] || {}).thumbUrl || ''}" alt="">${k === 0 && (foto || car) ? '<span>Portada</span>' : ''}</button>`).join('')}</div>` : '';
      const acts = `<div class="pacts"><span class="fname">${esc((M.files[fid] || {}).name || '')}${(M.files[fid] || {}).reduced ? ' · 1080 px' : ''}</span>`
        + (foto && idx > 0 ? `<button data-act="cover" data-slot="${esc(id)}" data-k="${idx}">Hacer portada</button>` : '')
        + (car && n > 1 ? `<button data-act="left" data-slot="${esc(id)}" data-k="${idx}" ${idx === 0 ? 'disabled' : ''}>◀ Mover</button><button data-act="right" data-slot="${esc(id)}" data-k="${idx}" ${idx === n - 1 ? 'disabled' : ''}>Mover ▶</button>` : '')
        + `<button data-act="unpick" data-slot="${esc(id)}" data-k="${idx}">Quitar</button></div>`;
      left = `<div class="stagewrap"><div class="stage" data-slot="${esc(id)}" data-file="${esc(fid)}"><img class="big" alt="" src="${(M.files[fid] || {}).thumbUrl || ''}"><div class="gguide" hidden><span>Así se ve en el perfil</span></div>${THIRDS}${nav}</div></div>
        <div class="ptools">${fmtCtl}<label class="zoom">Zoom <input type="range" class="zoomr" min="1" max="3" step="0.01" value="${c.z || 1}"></label><button class="lnk" data-act="center">Centrar</button><span class="muted phint">Arrastra la foto para reencuadrar</span></div>
        ${strip}${acts}`;
    }
    const hint = car ? 'Carrusel: se suben todas en este orden, con el formato del carrusel.' : foto ? 'Candidatas: solo se sube la portada.' : '';
    d.innerHTML = `<div class="card post" role="dialog" aria-label="${esc(s.name)}"><button class="x" data-act="close" title="Cerrar" aria-label="Cerrar">×</button>
      <div class="phead"><h3>${esc(s.name)}</h3><p>${whenHTML(s)}<span>· ${esc(s.type || '')}</span>${statusBadge(s)}</p>${pnotHTML(s)}${linkLine(s)}</div>
      <div class="pbody"><div class="pleft">${left}</div>
        <div class="pright"><label class="nlab" for="nota-${esc(id)}">Contexto <span>· para el caption, se sube a Notion</span></label>
          <textarea class="note" id="nota-${esc(id)}" data-slot="${esc(id)}" placeholder="Qué se ve, qué contar, tono…">${esc(s.note || '')}</textarea>
          <label class="nlab mlab" for="memo-${esc(id)}">Nota <span>· solo para ti, no se sube</span></label>
          <textarea class="memo" id="memo-${esc(id)}" data-slot="${esc(id)}" placeholder="Recordatorios, pendientes…">${esc(s.memo || '')}</textarea>
          ${hint ? `<p class="muted" style="margin:10px 0 0">${hint}</p>` : ''}</div></div></div>`;
    if (d.hidden || d.dataset.slot !== id) clearToasts();
    d.hidden = false;
    d.dataset.slot = id; delete d.dataset.dlg; delete d.dataset.prev;
    if (keep) { const t2 = d.querySelector('textarea.' + (keep.c === 'memo' ? 'memo' : 'note')); t2.focus(); t2.setSelectionRange(keep.a, keep.b); t2.scrollTop = keep.t; }
    else if (fresh) focusClose(d);
    if (n) { layoutStage(); loadBig(fid); }
    markReframe();
  }
  // date + time of the post (Madrid), editable within the board's months; date-only posts stay date-only
  const wday = iso => { const d = localDay(iso); return d ? new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', weekday: 'short' }).format(new Date(d + 'T12:00:00Z')).replace('.', '') : ''; };
  function whenHTML(s) {
    const ms = boardMonths(), [y, m] = ms[ms.length - 1].split('-').map(Number), max = `${ms[ms.length - 1]}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
    const at = `data-slot="${esc(s.id)}" required`;
    return `<span class="pwhen"><span class="wd">${esc(wday(s.date))}</span><input type="date" class="dtin" ${at} value="${esc(localDay(s.date) || '')}" min="${ms[0]}-01" max="${max}" aria-label="Fecha (hora de Madrid)" title="Cambiar la fecha: al subir a Notion se cambia allí">`
      + (dOnly(s.date) ? '' : `<input type="time" class="tmin" ${at} value="${esc(localTime(s.date))}" aria-label="Hora (Madrid)" title="Hora de Madrid">`) + '</span>';
  }
  function pnotHTML(s) {
    const dc = dateChg(s), nc = nameChg(s);
    if (!dc && !nc) return '<p class="pnot" hidden></p>';
    const txt = dc ? 'En Notion: ' + (nc ? s.notionName + ' · ' : '') + fmtDate(s.notionDate) : 'Se renombra al subir · en Notion: ' + s.notionName;
    return `<p class="pnot"><span title="${esc(txt)}"><i class="dchg${dc ? '' : ' nm'}"></i>${esc(txt)}</span>${dc ? `<button class="lnk" data-act="datereset" data-slot="${esc(s.id)}">Volver a la fecha de Notion</button>` : ''}</p>`;
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
    if (!boardMonths().includes(day.slice(0, 7))) return;                 // typing can pass through other months: told on blur
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
      const fmtCtl = isReel(it.type) ? '<span class="muted">Portada del perfil · 3:4</span>' : `<div class="seg" role="group" aria-label="Formato">${['v45', 'v34', 'h'].map(k => `<button data-act="fmt" data-fmt="${k}" class="${c.fmt === k ? 'on' : ''}" aria-pressed="${c.fmt === k}">${FMT_LABEL[k]}</button>`).join('')}</div>`;
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
    d.hidden = false; d.dataset.slot = id; d.dataset.prev = '1'; delete d.dataset.dlg;
    if (fresh) focusClose(d);
    if (im && im.f && M.files[im.f]) { layoutStage(); loadBig(im.f); }
    markReframe();
  }
  // rule-of-thirds lines over the post frame: shown on hover, while panning and for a moment after a zoom, format or
  // «Centrar» change (those re-render the stage, so the moment is kept in reframeUntil)
  const THIRDS = '<div class="thirds" aria-hidden="true"><i></i><i></i><i></i><i></i></div>';
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
    const fixed = p.w >= f.w - 1 && p.h >= f.h - 1;
    st.classList.toggle('fixed', fixed);
    const hint = root.querySelector('.detail .phint'); if (hint) hint.textContent = fixed ? 'Se ve entera: usa el zoom para reencuadrar' : 'Arrastra la foto para reencuadrar';
  }
  async function loadBig(fid) {
    try {
      M.bigUrls = M.bigUrls || {}; M.bigOrder = (M.bigOrder || []).filter(x => x !== fid); M.bigOrder.push(fid);
      if (!M.bigUrls[fid]) M.bigUrls[fid] = URL.createObjectURL(await getBlob(fid));
      while (M.bigOrder.length > 6) { const old = M.bigOrder.shift(); if (M.bigUrls[old]) URL.revokeObjectURL(M.bigUrls[old]); delete M.bigUrls[old]; if (!['pending', 'uploading'].includes((M.uploads[old] || {}).state)) delete M.blobs[old]; }
      const st = root.querySelector('.detail .stage'); if (st && st.dataset.file === fid) st.querySelector('img.big').src = M.bigUrls[fid];
    } catch (e) { /* keep the thumbnail */ }
  }
  function closeDetail() {
    if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; save(); renderFeed(); renderBar(); }
    const d = root && root.querySelector('.detail'); if (!d) return;
    const wasPrev = d.dataset.prev;
    d.hidden = true; d.innerHTML = ''; delete d.dataset.slot; delete d.dataset.dlg; delete d.dataset.prev;
    if (wasPrev && prevOnce) { prevOnce = false; renderFeed(); }
  }
  function refreshDetail() { const d = root && root.querySelector('.detail'); if (d && !d.hidden && d.dataset.slot) { if (slot(d.dataset.slot)) openDetail(d.dataset.slot, cur.idx); else closeDetail(); } }

  // ---------- dialogs (clients, how to add a month) ----------
  function showDialog(kind, html) {
    const d = root.querySelector('.detail');
    d.innerHTML = `<div class="card dlg" role="dialog" aria-modal="true">${html}</div>`;
    clearToasts();
    d.hidden = false; delete d.dataset.slot; delete d.dataset.prev; d.dataset.dlg = kind;
    const first = d.querySelector('input[type=text]'); if (first) first.focus();
  }
  function dlgNewClient() {
    showDialog('newclient', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Nuevo cliente</h3><p>Se crea su pestaña vacía. Después pídele a Claude que cargue el mes desde Notion.</p>
      <form class="form" data-form="newclient" autocomplete="off"><label for="nc-name">Nombre</label><input id="nc-name" name="name" type="text" maxlength="60" placeholder="Ej.: daGiorgio" required>
      <label for="nc-handle">Usuario de Instagram <span>(opcional)</span></label><input id="nc-handle" name="handle" type="text" maxlength="120" placeholder="@usuario">
      <p class="ferr" hidden></p><div class="row"><button type="button" class="btn2" data-act="close">Cancelar</button><button type="submit" class="btn">Crear cliente</button></div></form>`);
  }
  function dlgEditClient() {
    const c = CL.find(x => x.id === curClient); if (!c) return;
    const nm = MB.length;
    showDialog('editclient', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Editar cliente</h3>
      <form class="form" data-form="editclient" autocomplete="off"><label for="ec-name">Nombre</label><input id="ec-name" name="name" type="text" maxlength="60" value="${esc(c.name)}" required>
      <label for="ec-handle">Usuario de Instagram</label><input id="ec-handle" name="handle" type="text" maxlength="120" value="${esc(c.handle || '')}" placeholder="@usuario">
      <p class="ferr" hidden></p>
      <div class="row">${nm ? `<span class="left muted">Tiene ${nm} mes${nm === 1 ? '' : 'es'} guardado${nm === 1 ? '' : 's'}: no se puede eliminar.</span>` : '<button type="button" class="btn2 danger left" data-act="delclient">Eliminar cliente</button>'}<button type="button" class="btn2" data-act="close">Cancelar</button><button type="submit" class="btn">Guardar</button></div></form>`);
  }
  function dlgHowMonth() {
    const c = CL.find(x => x.id === curClient), cn = esc(c ? c.name : 'este cliente');
    const last = MB.filter(b => /^\d{4}-\d{2}$/.test(b.month || '')).map(b => addMonths(b.month, (b.span || 1) - 1)).sort().pop();
    const m1 = last ? addMonths(last, 1) : null, n1 = m1 ? MONTHS[+m1.slice(5) - 1] : nextMonthName();
    const n2 = MONTHS[(MONTHS.indexOf(n1) + 1) % 12];
    showDialog('howmonth', `<button class="x" data-act="close" aria-label="Cerrar">×</button><h3>Añadir otro mes</h3><p>Los meses se cargan desde Notion con las publicaciones del calendario (nombre, fecha, hora y tipo exactos), para que al subir las fotos cada una vaya a su página. Pídeselo a Claude en el chat:</p><p style="color:var(--ink);font-size:14px;margin:12px 0 4px">«Carga ${n1} de ${cn} en la mesa»</p><p>Si ya tienes preparados dos meses, pídelos juntos y se preparan en la misma mesa, con el mes anterior debajo: «Carga ${n1} y ${n2} de ${cn} en la mesa». Las fechas y horas se pueden cambiar aquí; al subir a Notion se cambian allí.</p><div class="form"><div class="row"><button type="button" class="btn" data-act="close">Entendido</button></div></div>`);
  }
  const normHandle = h => { h = String(h || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@+/, ''); return h ? '@' + h : ''; };
  async function submitForm(form) {
    const kind = form.dataset.form, err = form.querySelector('.ferr');
    const name = form.elements.name.value.trim(), handle = normHandle(form.elements.handle.value);
    const fail = m => { err.textContent = m; err.hidden = false; };
    if (!name) return fail('Escribe el nombre del cliente.');
    if (CL.some(c => c.name.toLowerCase() === name.toLowerCase() && (kind === 'newclient' || c.id !== curClient))) return fail('Ya existe un cliente con ese nombre.');
    if (kind === 'newclient') {
      if (busyGuard()) return;
      const c = await M.addClient({ name, handle }); closeDetail(); await M.openClient(c.id); toast(`Cliente «${c.name}» creado.`);
    } else { await M.updateClient(curClient, { name, handle }); closeDetail(); }
  }

  // ---------- messages ----------
  function clearToasts() { if (shellReady()) root.querySelector('.toasts').innerHTML = ''; }
  function toast(msg, opt) {
    if (!shellReady()) return;
    const box = root.querySelector('.toasts');
    [...box.children].forEach(el => { if (el.dataset.msg === msg) el.remove(); });
    while (box.children.length >= 2) box.firstElementChild.remove();
    const t = document.createElement('div'); t.className = 'toast'; t.dataset.msg = msg;
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
    const text = [busyText.imp, busyText.up, busyText.sel].filter(Boolean).join(' · ');
    M.busyText = [busyText.imp, busyText.up].filter(Boolean).join(' · ') || null;
    if (!shellReady()) return;
    const b = root.querySelector('.busy'); b.textContent = text; b.hidden = !text;
  }
  function setSave(msg, err) { if (!shellReady()) return; const s = root.querySelector('.save'); s.textContent = msg; s.classList.toggle('err', !!err); }
  function busyGuard() {
    if (uploadsBusy()) { toast('Espera a que termine la subida a Notion.'); return true; }
    if (importing) { toast('Espera a que terminen de prepararse las fotos.'); return true; }
    return false;
  }

  // ---------- events ----------
  const hasFiles = e => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  function clearOver() { root.querySelectorAll('.over').forEach(el => el.classList.remove('over')); }

  function wire() {
    if (!M._winWired) {
      M._winWired = true;
      window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
      window.addEventListener('drop', e => { if (hasFiles(e)) e.preventDefault(); });
    }
    root.addEventListener('dragstart', e => {
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
      if (cell && cell.dataset.prev && drag && drag.from === 'slot') return;
      if (cell && cell.dataset.slot && drag && drag.from === 'prev') return;
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
        if (pc) { const id = pc.dataset.prev; M.addFiles(e.dataTransfer.files, null).then(got => { if (got && got[0]) withPrev(() => prevSetFromTray(id, got[0]), 'edit'); }); return; }
        M.addFiles(e.dataTransfer.files, cell ? cell.dataset.slot : null); return;
      }
      if (!drag || !S) return;
      e.preventDefault();
      const d = drag; drag = null;
      if (pc) {
        if (d.from === 'tray') withPrev(() => prevSetFromTray(pc.dataset.prev, d.fileId), 'edit');
        else if (d.from === 'prev') withPrev(() => prevSwap(d.prevId, pc.dataset.prev), 'edit');
      }
      else if (cell) {
        if (d.from === 'tray') place(cell.dataset.slot, d.fileId);
        else if (d.from === 'slot') swap(d.slotId, cell.dataset.slot);
        else toast('Una publicación del mes anterior no pasa directamente al mes nuevo: arrástrala antes a la bandeja.');
      }
      else if (tray && d.from === 'slot') unassign(d.slotId, null, true);
      else if (tray && d.from === 'prev') withPrev(() => prevToTray(d.prevId), 'edit');
      flushRender();
    });
    root.addEventListener('pointerdown', e => { downOnBackdrop = !!(e.target.classList && e.target.classList.contains('detail')); }, true);
    root.addEventListener('wheel', e => {
      const tb = e.target.closest && e.target.closest('.tbody, .bar .months');   // narrow strips: the wheel scrolls them sideways
      if (!tb || tb.scrollWidth <= tb.clientWidth + 1 || tb.scrollHeight > tb.clientHeight + 1 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      tb.scrollLeft += e.deltaY; e.preventDefault();
    }, { passive: false });
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-act]');
      if (a) { onAct(a, e); return; }
      if (e.target.classList.contains('detail')) { if (downOnBackdrop) closeDetail(); return; }
      if (!S) return;
      const ti = e.target.closest('.titem[data-file]');
      if (ti) { sel = sel === ti.dataset.file ? null : ti.dataset.file; renderTray(); renderBar(); return; }
      const pc = e.target.closest('.cell.past[data-prev]');
      if (pc) {
        const id = pc.dataset.prev;
        if (sel && S.tray.includes(sel)) { const f = sel; sel = null; renderTray(); renderBar(); withPrev(() => prevSetFromTray(id, f), 'edit'); return; }
        withPrev(() => openPast(id), 'open'); return;
      }
      const cell = e.target.closest('.cell[data-slot]');
      if (cell) {
        const id = cell.dataset.slot;
        if (sel && S.tray.includes(sel)) { const f = sel; sel = null; place(id, f); return; }
        sel = null;
        openDetail(id, 0);
      }
    });
    root.addEventListener('submit', e => { e.preventDefault(); const f = e.target.closest('form[data-form]'); if (f) submitForm(f); });
    root.addEventListener('input', e => {
      if (!e.target.matches) return;
      if (e.target.matches('textarea.note')) setNote(e.target.dataset.slot, e.target.value);
      else if (e.target.matches('textarea.memo')) setMemo(e.target.dataset.slot, e.target.value);
      else if (e.target.matches('.zoomr')) { flashThirds(); const s = slot(cur.slot); if (s) touchPrev(s); const fid = s && s.photos[cur.idx]; if (fid) { setCrop(fid, s, { z: +e.target.value }); placeBig(); } }
    });
    root.addEventListener('change', e => {
      if (!e.target.matches) return;
      if (e.target.matches('.zoomr')) { save(); renderFeed(); renderBar(); }
      else if (e.target.matches('.pwhen input')) onWhen(e.target);
      else if (e.target.matches('.clientToggle')) root.classList.toggle('client', e.target.checked);
      else if (e.target.matches('.picker')) { const fl = e.target.files; if (fl && fl.length) M.addFiles(fl).finally(() => { e.target.value = ''; }); }
    });
    root.addEventListener('focusout', e => {
      const el = e.target, s = el.matches && el.matches('.pwhen input') && slot(el.dataset.slot); if (!s) return;
      if (el.classList.contains('dtin') && /^\d{4}-\d{2}/.test(el.value) && !boardMonths().includes(el.value.slice(0, 7))) outToast();
      resetWhen(el, s);
    });
    root.addEventListener('pointerdown', e => {
      const st = e.target.closest && e.target.closest('.detail .stage');
      if (!st || e.target.closest('.nav') || e.button !== 0) return;
      const s = slot(st.dataset.slot), fid = st.dataset.file, f = M.files[fid]; if (!s || !f) return;
      e.preventDefault();
      touchPrev(s);
      try { st.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      st.classList.add('panning');
      const r0 = postRect(fid, s);
      const sx = e.clientX, sy = e.clientY, cx0 = (r0.x + r0.w / 2) / f.w, cy0 = (r0.y + r0.h / 2) / f.h;
      const sw = st.clientWidth, sh = st.clientHeight;
      const mv = ev => { setCrop(fid, s, { cx: cx0 - (ev.clientX - sx) / sw * (r0.w / f.w), cy: cy0 - (ev.clientY - sy) / sh * (r0.h / f.h) }); placeBig(); };
      const up = () => { st.removeEventListener('pointermove', mv); st.removeEventListener('pointerup', up); st.removeEventListener('pointercancel', up); st.classList.remove('panning'); save(); renderFeed(); renderBar(); };
      st.addEventListener('pointermove', mv); st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
    });
    if (M._onKey) document.removeEventListener('keydown', M._onKey);
    M._onKey = e => {
      if (!shellReady()) return;
      const open = !root.querySelector('.detail').hidden;
      if (e.key === 'Escape') { if (open) closeDetail(); else if (sel) { sel = null; renderTray(); renderBar(); } return; }
      const typing = e.target && /^(TEXTAREA|INPUT)$/.test(e.target.tagName) && e.target.type !== 'range';
      if (open && !typing && cur.slot && root.querySelector('.detail .stage') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); openDetail(cur.slot, cur.idx + (e.key === 'ArrowLeft' ? -1 : 1)); }
    };
    document.addEventListener('keydown', M._onKey);
    if (M._mq && M._onMq) { try { M._mq.removeEventListener('change', M._onMq); } catch (e) { /* */ } }
    M._mq = NARROW; M._onMq = () => { if (shellReady()) renderTabs(); };
    try { NARROW.addEventListener('change', M._onMq); } catch (e) { /* old engines */ }
    if (M._onResize) window.removeEventListener('resize', M._onResize);
    M._onResize = () => layoutStage();
    window.addEventListener('resize', M._onResize);
    if (M._onHide) { document.removeEventListener('visibilitychange', M._onHide); window.removeEventListener('pagehide', M._onHide); }
    M._onHide = e => {
      if (!(e.type === 'pagehide' || document.visibilityState === 'hidden') || !S || locked || !(saveTimer || noteTimer)) return;
      stamp(S);
      S.savedAt = new Date().toISOString();
      lsSet('mesa-pending', JSON.stringify({ key: S.key, board: S }));   // sync: survives a reload that kills the async write
      flushNow().catch(() => { /* */ });
    };
    document.addEventListener('visibilitychange', M._onHide); window.addEventListener('pagehide', M._onHide);
  }

  async function onAct(a, e) {
    const act = a.dataset.act;
    if (act === 'add') root.querySelector('.picker').click();
    else if (act === 'del') { e.stopPropagation(); removeFile(a.dataset.file); }
    else if (act === 'close') closeDetail();
    else if (act === 'unpick') { unassign(a.dataset.slot, +a.dataset.k); refreshDetail(); }
    else if (act === 'left') { move(a.dataset.slot, +a.dataset.k, -1); openDetail(a.dataset.slot, +a.dataset.k - 1); }
    else if (act === 'right') { move(a.dataset.slot, +a.dataset.k, 1); openDetail(a.dataset.slot, +a.dataset.k + 1); }
    else if (act === 'cover') { setCover(a.dataset.slot, +a.dataset.k); openDetail(a.dataset.slot, 0); }
    else if (act === 'prev') openDetail(cur.slot, cur.idx - 1);
    else if (act === 'next') openDetail(cur.slot, cur.idx + 1);
    else if (act === 'pick') openDetail(cur.slot, +a.dataset.k);
    else if (act === 'fmt') { flashThirds(); touchPrev(slot(cur.slot)); setFmt(cur.slot, a.dataset.fmt); }
    else if (act === 'center') { flashThirds(); const s = slot(cur.slot); touchPrev(s); if (s && s.photos[cur.idx]) { setCrop(s.photos[cur.idx], s, { cx: 0.5, cy: 0.5, z: 1 }); save(); renderFeed(); renderBar(); openDetail(cur.slot, cur.idx); } }
    else if (act === 'client') { if (a.dataset.id !== curClient && !busyGuard()) await M.openClient(a.dataset.id); }
    else if (act === 'month') { if ((!S || a.dataset.key !== S.key) && !busyGuard()) await M.open(a.dataset.key); }
    else if (act === 'newclient') dlgNewClient();
    else if (act === 'editclient') dlgEditClient();
    else if (act === 'howmonth') dlgHowMonth();
    else if (act === 'xfer') dlgXfer();
    else if (act === 'xfer-export') { closeDetail(); M.exportAll(); }   // no await before the save picker: it needs the click
    else if (act === 'xfer-import') { const i = root.querySelector('.detail .xferin'); if (i) i.click(); }
    else if (act === 'xfer-go') { if (xferAsk) xferAsk(true); }
    else if (act === 'datereset') { const s = slot(a.dataset.slot); if (s && !isPrev(s)) setDate(s.id, s.notionDate, true); }
    else if (act === 'unlock-once' || act === 'unlock-always') {
      const pu = pendingUnlock; pendingUnlock = null;
      if (act === 'unlock-always') { S.prevUnlocked = true; save(); } else prevOnce = true;
      closeDetail(); renderFeed();
      if (pu) { pu.fn(); if (pu.kind === 'edit') endOnce(); }
    }
    else if (act === 'prevlock') { if (S.prevUnlocked || prevOnce) { S.prevUnlocked = false; prevOnce = false; save(); renderFeed(); toast('Mes anterior bloqueado.'); } else withPrev(() => {}, 'none'); }
    else if (act === 'prevhide') { const it = prevItem(a.dataset.id); if (it) { it.hidden = !it.hidden; changed(); openPast(it.id); } }
    else if (act === 'prevtotray') { prevToTray(a.dataset.id); openPast(a.dataset.id); }
    else if (act === 'prevrestore') { prevRestore(a.dataset.id); openPast(a.dataset.id); }
    else if (act === 'takeover') { const k = S && S.key; S = null; PB = null; claim(); if (k && (await idbGet('boards', k))) await M.open(k); else await M.boot(); }
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
  M.addClient = async ({ id, name, handle } = {}) => {
    await loadClients();
    name = String(name || '').trim(); if (!name) throw new Error('falta el nombre');
    const existing = CL.find(c => (id && c.id === id) || c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const base = id ? String(id) : slugify(name);
    let cid = base, k = 2;
    while (CL.some(c => c.id === cid)) cid = base + k++;
    const c = { id: cid, name, handle: normHandle(handle), createdAt: new Date().toISOString() };
    await idbPut('clients', cid, c);
    await loadClients();
    if (!curClient && !S) curClient = cid;
    if (shellReady()) render();
    return c;
  };
  M.updateClient = async (id, patch) => {
    const c = await idbGet('clients', id); if (!c) return 'no existe';
    if (patch.name != null) c.name = String(patch.name).trim() || c.name;
    if (patch.handle != null) c.handle = normHandle(patch.handle);
    await idbPut('clients', id, c);
    await loadClients(); render();
    return c;
  };
  M.removeClient = async id => {
    const boards = (await idbAll('boards')) || [];
    const n = boards.filter(b => b.client === id).length;
    if (n) return `No se puede eliminar: tiene ${n} mes(es) guardados.`;
    await idbDel('clients', id);
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
    claim();
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
    return p && p.key === key && p.board && String(p.board.savedAt || '') > String((b && b.savedAt) || '') ? p.board : b;
  }
  // a re-init must not drop a month the board holds: a month of the range with posts here but none in cfg, or a
  // shorter range whose dropped months have photos, notes or uploads -> error message (null = fine)
  function dropCheck(old, slots, month, span) {
    const os = old.slots || [], om = old.month || month, ospan = old.span || 1, range = monthsOf(month, span);
    const mo = s => monthOf(s.notionDate ?? s.date), used = s => (s.photos || []).length || noteOf(s) || memoOf(s) || s.uploaded;
    const ml = ms => ms.map(m => MONTHS[+m.slice(5) - 1]).join(', ').replace(/, ([^,]*)$/, ' y $1');
    const miss = range.filter(m => os.some(s => mo(s) === m) && !slots.some(s => monthOf(s.date) === m));
    if (miss.length) return `Esta mesa cubre ${rangeLabel(month, span).toLowerCase()} y no vienen las publicaciones de ${ml(miss)}: carga ${span > 1 ? `los ${span} meses` : 'el mes entero'} (o pasa force:true).`;
    const lost = span < ospan ? monthsOf(om, ospan).filter(m => !range.includes(m) && os.some(s => mo(s) === m && used(s))) : [];
    if (lost.length) return `Esta mesa cubre ${rangeLabel(om, ospan).toLowerCase()} y ${ml(lost)} ${lost.length > 1 ? 'tienen' : 'tiene'} fotos, notas o subidas: carga los ${ospan} meses (o pasa force:true).`;
    return null;
  }
  // cfg = { client, month:'YYYY-MM', months?:1-3, slots:[{id,name,type,date}], past:[{id,name,type,date}] }  (key optional)
  // force: true lets a re-init drop months of the saved board (their photos go to the tray, their notes are lost)
  // months: how many months the board prepares from `month` (default: the saved board's, else 1); key = client-month.
  // Legacy cfg {key, handle, title, slots, past} still works: the client is derived from the key.
  M.init = async (cfg) => {
    if (prevDispose) { try { await prevDispose(); } catch (e) { /* */ } prevDispose = null; }
    if (uploadsBusy() || importing) return { error: 'ocupada: espera a que termine la subida o la importación' };
    claim();
    await addQ;
    cfg = { ...cfg, slots: cfg.slots || [], past: cfg.past || [] };
    if (cfg.months != null && !(Number.isInteger(+cfg.months) && +cfg.months >= 1 && +cfg.months <= 3)) throw new Error('months debe ser 1, 2 o 3');
    let client = cfg.client, month = cfg.month;
    const km = String(cfg.key || '').match(/^(.+)-(\d{4}-\d{2})$/);
    if (!client) client = km ? km[1] : String(cfg.key || 'cliente');
    if (!month) {
      if (km) month = km[2];
      else if (+cfg.months > 1) month = cfg.slots.map(s => monthOf(s.date)).filter(Boolean).sort()[0] || monthOf(new Date().toISOString());
      else { const cnt = {}; cfg.slots.forEach(s => { const m = monthOf(s.date); if (m) cnt[m] = (cnt[m] || 0) + 1; }); month = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || monthOf(new Date().toISOString()); }
    }
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month debe ser YYYY-MM');
    await loadClients();
    const askedClient = client;
    if (!CL.find(c => c.id === client)) {
      if (cfg.createClient === false) throw new Error(`no existe el cliente ${client}`);
      const t = String(cfg.title || '');
      const name = cfg.clientName || (t.includes(' · ') ? t.split(' · ')[0].trim() : '') || client;
      const c = await M.addClient({ id: client, name, handle: cfg.handle || '' });
      client = c.id;                                      // an existing client with that name keeps its id
    }
    const key = cfg.key && client === askedClient ? cfg.key : `${client}-${month}`;
    if (S) { try { await flushNow(); } catch (e) { /* ignore */ } }
    const old = newest(key, await idbGet('boards', key)) || { slots: [], tray: [] };
    const span = cfg.months != null ? +cfg.months : (old.span || 1);
    const why = cfg.force ? null : dropCheck(old, cfg.slots, month, span);
    if (why) throw new Error(why);
    try { const pend = JSON.parse(lsGet('mesa-pending') || 'null'); if (pend && pend.key === key) localStorage.removeItem('mesa-pending'); } catch (e) { /* */ }
    sel = null; drag = null; pendingRender = false; noteTimer = null; cur = { slot: null, idx: 0 };
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* ignore */ }
    if (!shellReady()) buildShell(); else closeDetail();
    setSave('Cargando…');
    await importShared(cfg.slots, old, key);
    const oldById = Object.fromEntries((old.slots || []).map(s => [s.id, s]));
    const base = Object.fromEntries((old.slots || []).map(s => [s.id, slotSig(s, old)]));   // shared state before init
    const orphans = [];
    for (const s of old.slots || []) if (!cfg.slots.some(x => x.id === s.id)) orphans.push(...(s.photos || []));
    const pm = prevMonth(month);
    const pastIn = cfg.past.length ? cfg.past : (old.past || []);
    // Dates and names: cfg carries Notion's values (notionDate/notionName); a change made here stays pending until
    // Notion has it. If Notion changed the same post on its own, Notion wins.
    const won = [], wonIds = new Set();
    const merge = n => {
      const o = oldById[n.id] || {};
      const r = { id: n.id, name: n.name, type: n.type, date: n.date, notionDate: n.date, notionName: n.name, photos: o.photos || [], note: o.note || '', uploaded: o.uploaded || null };
      if (o.fmt) r.fmt = o.fmt;
      if (o.memo) r.memo = o.memo;
      if (!o.id) return r;
      const od = o.notionDate === undefined ? o.date : o.notionDate, on = o.notionName === undefined ? o.name : o.notionName;
      let w = false;
      if (!sameDate(o.date, od)) { if (sameDate(n.date, od)) r.date = o.date; else if (!sameDate(n.date, o.date)) w = true; }
      if (o.name !== on) { if (n.name === on) r.name = o.name; else if (n.name !== o.name) w = true; }
      if (w) { won.push(n.name); wonIds.add(n.id); } else if (o.hold && r.name !== r.notionName) r.hold = true;
      return r;
    };
    S = {
      key, client, month, span,
      slots: cfg.slots.map(merge),
      tray: [...(old.tray || []), ...orphans],
      past: pastIn.filter(p => p.date && monthOf(p.date) === pm).map(p => ({ id: p.id, name: p.name, type: p.type, date: p.date })),
      crops: old.crops || {},
      savedAt: old.savedAt || null, editedAt: old.editedAt || old.savedAt || null
    };
    holdOrphans(wonIds);   // a rename whose date change is already in Notion stays pending (not the posts Notion won)
    renumber();
    sortSlots();
    const oldPrevOwn = (old.prev || []).filter(p => p.own).flatMap(p => p.photos || []);
    const ids = [...new Set([...S.tray, ...S.slots.flatMap(s => s.photos), ...oldPrevOwn])];
    const missing = await loadThumbs(ids);
    if (missing.length) { S.tray = S.tray.filter(x => !missing.includes(x)); S.slots.forEach(s => { s.photos = s.photos.filter(x => !missing.includes(x)); }); }
    S.slots.forEach(s => { if (!isMulti(s.type) && s.photos.length > 1) { S.tray.unshift(...s.photos.slice(1)); s.photos = s.photos.slice(0, 1); } });
    S.tray = [...new Set(S.tray)].filter(id => !S.slots.some(s => s.photos.includes(id)));
    normalize();
    // previous month: the same client's board (1–3 months) that covers it — newest if several — only its posts of that month
    const rangeOf = b => { const k2 = String(b.key || '').match(/^(.+)-(\d{4}-\d{2})$/); return { c: b.client || (k2 && k2[1]), m: b.month || (k2 && k2[2]) }; };
    PB = ((await idbAll('boards')) || []).filter(b => { const r = rangeOf(b); return b.key !== key && r.c === client && r.m && monthsOf(r.m, b.span).includes(pm); })
      .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))[0] || null;
    if (PB) PB = { ...PB, slots: (PB.slots || []).filter(s => monthOf(s.date) === pm && !S.slots.some(x => x.id === s.id)) };   // a post of this board (moved) shows once
    if (PB) await loadThumbs([...new Set(PB.slots.flatMap(s => publishList(s)))]);
    for (const p of S.past) {
      if (M.pastThumbs[p.id]) continue;
      const rec = await idbGet('files', 'past:' + p.id);
      if (rec && rec.thumb) { M.pastBlobs[p.id] = rec.thumb; M.pastThumbs[p.id] = URL.createObjectURL(rec.thumb); }
    }
    buildPrev(old.prev);
    S.prevUnlocked = !!old.prevUnlocked; prevOnce = false; pendingUnlock = null;
    { const own = new Set(S.prev.filter(p => p.own).flatMap(p => p.photos)); S.tray = S.tray.filter(id => !own.has(id)); }
    sharedInit(oldById, base);
    curClient = client;
    lsSet('mesa-last', key); lsSet('mesa-lastClient', client);
    let lastBy = {}; try { lastBy = JSON.parse(lsGet('mesa-lastByClient') || '{}'); } catch (e) { /* */ }
    lastBy[client] = key; lsSet('mesa-lastByClient', JSON.stringify(lastBy));
    BODY.set(S, boardBody(S));        // what init loaded/merged is the baseline: only later changes count as edits
    await flushNow();
    await refreshMonths();
    render();
    if (missing.length) toast(`${missing.length} foto(s) guardadas ya no estaban disponibles y se han quitado.`);
    if (won.length) toast(`En Notion cambió la fecha o el nombre de ${won.length > 4 ? won.slice(0, 4).join(', ') + ` y ${won.length - 4} más` : won.join(', ')}: se queda lo de Notion y se descarta el cambio hecho aquí.`, { ms: 9000 });
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
    return M.init({ key, client, month, months: b.span || 1, clientName: t.includes(' · ') ? t.split(' · ')[0].trim() : null, handle: b.handle || '', slots: (b.slots || []).map(({ id, name, type, date, notionName, notionDate }) => ({ id, name: notionName ?? name, type, date: notionDate ?? date })), past: b.past || [] });
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
    claim();
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
  M.plan = () => S ? S.slots.filter(s => s.photos.length || noteOf(s) || s.uploaded).map(s => {
    const st = slotStatus(s), pub = publishList(s);
    return {
      slotId: s.id, name: s.name, type: s.type, date: s.date, dateChanged: dateChg(s),
      status: st === null ? 'nueva' : st === 'ok' ? 'ya subida' : 'cambiada',
      emptied: !pub.length && !!s.uploaded,
      files: pub.map(id => { const r = postRect(id, s); return { fileId: id, name: (M.files[id] || {}).name, mb: +(((M.files[id] || {}).size || 0) / 1048576).toFixed(1), formato: isReel(s.type) ? 'portada 3:4' : FMT_LABEL[cropOf(id, s).fmt], recorte: Math.round(r.w) + 'x' + Math.round(r.h), ...((M.files[id] || {}).reduced ? { reducida: true } : {}) }; }),
      alternatives: s.photos.length - pub.length,
      note: noteOf(s),
      uploaded: s.uploaded || null
    };
  }) : [];

  // items: [{fileId, slotId, url, auth, crop?}] — starts in background, poll with waitUpload().
  // The crop is fixed at the moment of the call, so later edits or a board switch can't change what is sent.
  // A new request for a photo that is still uploading replaces (aborts) the previous one.
  M.startUpload = (items, conc = M.cfg.uploadConc) => {
    if (locked) return { error: 'locked: la mesa está abierta en otra pestaña; pulsa «Usar aquí» o vuelve a abrirla' };
    const B = S;
    const jobs = [];
    for (const it of items || []) {
      const fid = it.fileId;
      const s = B && (it.slotId ? B.slots.find(x => x.id === it.slotId) : B.slots.find(x => publishList(x).includes(fid)));
      if (M._ctrl[fid]) { try { M._ctrl[fid].abort('replaced'); } catch (e) { /* */ } }
      const gen = M._gen[fid] = (M._gen[fid] || 0) + 1;
      if (it.crop !== false && (!s || !s.photos.includes(fid))) {
        M.uploads[fid] = { state: 'error', err: 'la foto no está en ninguna casilla de la mesa abierta' };
        continue;
      }
      const rect = it.crop !== false ? postRect(fid, s, B) : null;
      const sig = s ? fileSig(fid, s, B) : null;
      M.uploads[fid] = { state: 'pending', slotId: s ? s.id : null, sig };
      jobs.push({ fid, url: it.url, auth: it.auth, rect, sig, gen, slotId: s ? s.id : null });
    }
    if (jobs.length) {
      UP.total += jobs.length; busyUpload();
      const q = jobs.slice();
      const worker = async () => { while (q.length) await runJob(q.shift()); };
      const nw = Math.min(conc, q.length);
      for (let i = 0; i < nw; i++) worker();
    }
    return M.uploadStatus((items || []).map(i => i.fileId));
  };
  function busyUpload(pct) {
    if (UP.done >= UP.total) { UP = { total: 0, done: 0 }; setBusy('up', null); }
    else setBusy('up', `Subiendo fotos a Notion: ${UP.done}/${UP.total}${pct != null ? ` · ${pct}%` : ''}`);
  }
  // XHR instead of fetch: upload progress lets a slow connection keep going; only a stall (no bytes for
  // M.cfg.uploadIdleMs) or a newer request for the same photo stops it.
  function postForm(url, auth, fd, ctrl, onProgress) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      let last = Date.now(), done = false;
      const end = () => { done = true; clearInterval(iv); };
      const iv = setInterval(() => { if (!done && Date.now() - last > M.cfg.uploadIdleMs) { ctrl.reason = 'idle'; x.abort(); } }, 1000);
      x.open('POST', url);
      x.setRequestHeader('authorization', auth);
      x.upload.onprogress = e => { last = Date.now(); if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onprogress = () => { last = Date.now(); };
      x.onload = () => { end(); res({ status: x.status, ok: x.status >= 200 && x.status < 300, text: x.responseText || '' }); };
      x.onerror = () => { end(); rej(new Error('sin conexión con Notion')); };
      x.onabort = () => { end(); rej(new Error('aborted')); };
      ctrl.abort = reason => { ctrl.reason = ctrl.reason || reason; if (!done) x.abort(); };
      if (ctrl.reason) { end(); rej(new Error('aborted')); return; }
      x.send(fd);
    });
  }
  async function runJob(j) {
    const live = () => M._gen[j.fid] === j.gen;
    if (!live()) { UP.done++; busyUpload(); return; }
    const ctrl = { reason: null, abort(r) { this.reason = this.reason || r; } }; M._ctrl[j.fid] = ctrl;
    M.uploads[j.fid] = { ...M.uploads[j.fid], state: 'uploading' };
    let res;
    try {
      let blob = await getBlob(j.fid);
      let name = (M.files[j.fid] || {}).name || 'foto.jpg';
      let reencoded = false, cropped = null;
      if (j.rect) { const cb = await cropBlob(blob, j.fid, j.rect); if (!cb.original) { blob = cb.blob; cropped = cb.w + 'x' + cb.h; name = name.replace(/\.[^.]+$/, '') + '.jpg'; } }
      else if (blob.size > MAX_UPLOAD) { blob = await reencode(blob); reencoded = true; name = name.replace(/\.[^.]+$/, '') + '.jpg'; }
      if (ctrl.reason) throw new Error('aborted');
      const fd = new FormData(); fd.append('file', blob, name);
      const r = await postForm(j.url, j.auth, fd, ctrl, f => { if (live()) busyUpload(Math.round(f * 100)); });
      let js = {}; try { js = JSON.parse(r.text); } catch (e) { /* not json */ }
      res = (r.ok && js.status === 'uploaded')
        ? { state: 'ok', fileUploadId: js.file_upload_id, name, mb: +(blob.size / 1048576).toFixed(1), reencoded, cropped }
        : { state: 'error', http: r.status, err: r.text.slice(0, 200) };
    } catch (e) {
      delete M.blobs[j.fid];
      const why = ctrl.reason === 'idle' ? `sin progreso durante ${Math.round(M.cfg.uploadIdleMs / 1000)} s: vuelve a intentarlo` : ctrl.reason ? 'sustituida por un nuevo intento' : String(e.message || e).slice(0, 200);
      res = { state: 'error', err: why };
    }
    if (M._ctrl[j.fid] === ctrl) delete M._ctrl[j.fid];
    if (live()) M.uploads[j.fid] = { ...res, slotId: j.slotId, sig: j.sig };
    UP.done++; busyUpload();
  }
  M.uploadStatus = ids => Object.fromEntries((ids || Object.keys(M.uploads)).map(id => [id, M.uploads[id] || { state: 'none' }]));
  M.waitUpload = async (ids, ms = 45000) => {
    const t0 = Date.now();
    const busy = () => ids.some(id => ['pending', 'uploading'].includes((M.uploads[id] || {}).state));
    while (busy() && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 400));
    return M.uploadStatus(ids);
  };
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
  M.notionChanges = () => S ? S.slots.filter(s => dateChg(s) || nameChg(s)).map(s => ({
    slotId: s.id, notionName: s.notionName, name: s.name, notionDate: s.notionDate, date: s.date, dateOnly: dOnly(s.date),
    dateMadrid: dOnly(s.date) ? localDay(s.date) : localDay(s.date) + 'T' + localTime(s.date)
  })) : [];
  // After Claude has written them to Notion: those posts (all if no ids) take their current date and name as Notion's.
  M.markSynced = ids => {
    if (locked) return { error: 'locked: la mesa está abierta en otra pestaña; no se ha guardado nada' };
    if (!S) return [];
    const only = ids == null ? null : new Set([].concat(ids));
    S.slots.forEach(s => { if (!only || only.has(s.id)) { s.notionDate = s.date; s.notionName = s.name; delete s.hold; } });
    holdOrphans(); renumber(); changed(); refreshDetail();
    return M.notionChanges();
  };

  // ---------- preview image for the client (1080 px wide) ----------
  // opts.month ('YYYY-MM', one of the board's months): only that month above the line; the board's earlier
  // months (if any) and the previous month go below, so a client can approve one month of a 2-3 month board.
  M.render = async (mode = 'clean', opts = {}) => {
    if (!S) return { error: 'no hay mesa abierta' };
    const only = opts && opts.month ? String(opts.month) : null;
    if (only && !boardMonths().includes(only)) return { error: `${only} no está en esta mesa (${boardMonths().join(', ')})` };
    const W = 1080, GAP = 3, COLS = 3, TW = 358, TH = 477, HEADER = 250, FOOT = 40;
    const c0 = CL.find(c => c.id === S.client) || {};
    const past = pastList(false);
    const fresh = only ? S.slots.filter(s => monthOf(s.date) === only) : S.slots;
    const earlier = only ? S.slots.filter(s => { const m = monthOf(s.date); return m && m < only; }) : [];
    const slotPost = (s, isNew) => ({ name: s.name, type: s.type, date: s.date, isNew, planned: !isNew, blob: s.photos.length ? M.thumbBlobs[s.photos[0]] : null, rect: s.photos.length && M.files[s.photos[0]] ? { g: gridRect(s.photos[0], s), f: M.files[s.photos[0]] } : null });
    const posts = [
      ...fresh.map(s => slotPost(s, true)),
      ...earlier.map(s => slotPost(s, false)),
      ...past.map(p => (p.fid
        ? { name: p.name, type: p.type, date: p.date, isNew: false, blob: M.thumbBlobs[p.fid] || null, rect: M.files[p.fid] ? { g: gridRect(p.fid, p.item, p.B), f: M.files[p.fid] } : null }
        : { name: p.name, type: p.type, date: p.date, isNew: false, blob: p.thumb ? (M.pastBlobs[p.thumb] || null) : null }))
    ];
    const rows = Math.ceil(posts.length / COLS);
    const H = HEADER + rows * TH + (rows - 1) * GAP + FOOT;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.textBaseline = 'alphabetic';
    x.fillStyle = '#111'; x.font = `700 46px ${FONT}`; x.fillText(c0.handle || c0.name || '', 48, 92);
    x.fillStyle = '#555'; x.font = `400 30px ${FONT}`; x.fillText('Propuesta de feed · ' + (only ? monthLabel(only) : rangeLabel(S.month, S.span)), 48, 140);
    x.fillStyle = '#8a8a8a'; x.font = `400 24px ${FONT}`;
    const below = [earlier.length ? `${earlier.length} ya planificadas` : '', past.length ? `${past.length} de ${MONTHS[+prevMonth(S.month).slice(5) - 1]}` : ''].filter(Boolean).join(' + ');
    x.fillText(`${fresh.length} publicaciones nuevas${below ? ' + ' + below : ''} · vista del perfil (recorte 3:4)`, 48, 184);
    if (earlier.length || past.length) {
      x.fillStyle = '#111'; x.fillRect(48, 214, 44, 5);
      x.fillStyle = '#8a8a8a'; x.font = `400 22px ${FONT}`; x.fillText(`Por encima de la línea: publicaciones nuevas · Debajo: ${earlier.length ? 'lo anterior' : 'ya publicado'}`, 104, 222);
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
      if (isReel(p.type)) await drawIcon(ICON.reel, px + TW - 30, py + 30, p.blob ? '#fff' : '#9a9a9a');
      else if (isCarousel(p.type)) await drawIcon(ICON.carousel, px + TW - 30, py + 30, p.blob ? '#fff' : '#9a9a9a');
      if (mode === 'annotated') {
        const g = x.createLinearGradient(0, py + TH - 112, 0, py + TH);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)');
        x.fillStyle = g; x.fillRect(px, py + TH - 112, TW, 112);
        x.fillStyle = '#fff'; x.font = `600 22px ${FONT}`; x.fillText(p.name, px + 14, py + TH - 44, TW - 28);
        x.font = `400 19px ${FONT}`; x.fillStyle = 'rgba(255,255,255,.9)'; x.fillText(fmtDate(p.date) + (p.isNew || p.planned ? '' : '  ·  publicada'), px + 14, py + TH - 16, TW - 28);
      }
    }
    const N = fresh.length;
    if (N > 0 && N < posts.length) {
      const R = Math.floor(N / COLS), k = N % COLS;
      const yRow = r => HEADER + r * (TH + GAP) - GAP / 2;
      const xCol = cc => cc * (TW + GAP) - GAP / 2;
      x.strokeStyle = '#111'; x.lineWidth = 8; x.lineCap = 'square';
      x.beginPath();
      if (k === 0) { x.moveTo(0, yRow(R)); x.lineTo(W, yRow(R)); }
      else if ((R + 1) * COLS < posts.length) { x.moveTo(0, yRow(R + 1)); x.lineTo(xCol(k), yRow(R + 1)); x.lineTo(xCol(k), yRow(R)); x.lineTo(W, yRow(R)); }
      else { x.moveTo(xCol(k), yRow(R + 1)); x.lineTo(xCol(k), yRow(R)); x.lineTo(W, yRow(R)); }
      x.stroke();
    }
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    M.out[mode] = blob;
    return { mode, month: only || null, width: W, height: H, kb: Math.round(blob.size / 1024), posts: posts.length, fresh: N, empty: posts.filter(p => p.isNew && !p.blob).map(p => p.name) };
  };
  M.uploadOut = async (mode, url, auth, filename) => {
    const fd = new FormData(); fd.append('file', M.out[mode], filename);
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
  // {format:'mesa-feed', v:1, app, exportedAt, clients:[…], boards:[…], files:{id:{name,type,w,h,size,lastModified,
  //  reduced,data:<base64>, thumb?:<base64>}}, past:{notionId:{w,h,thumb:<base64>}}} — no thumb: the photo (1080) is its own.
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
    if (rec.reduced || !xferDims(rec.w, rec.h)) return same;
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
  // opts.returnBlob: true -> the Blob, nothing saved (Claude / tests)
  M.exportAll = async (opts = {}) => {
    const fail = m => { toast(m, { ms: 7000 }); return { error: m }; };
    if (locked) return fail('La mesa está abierta en otra pestaña: pulsa «Usar aquí» antes de exportar.');
    if (xferRun) return fail('Espera: ya se está exportando o importando la mesa.');
    xferRun = 'export';
    try {
      const now = new Date(), mp = madParts(now.getTime()), fname = `mesa-de-feed-${mp.day}-${mp.time.replace(':', '')}.json`;
      let handle = null;
      if (!opts.returnBlob && typeof window.showSaveFilePicker === 'function') {   // first thing: it needs the click
        try { handle = await window.showSaveFilePicker({ suggestedName: fname, types: [{ description: 'Mesa de feed', accept: { 'application/json': ['.json'] } }] }); }
        catch (e) { if (e && e.name === 'AbortError') return { cancelled: true }; handle = null; }
      }
      setBusy('imp', 'Exportando la mesa…');
      await addQ; await flushPending();
      const clients = (await idbAll('clients')) || [];
      const boards = ((await idbAll('boards')) || []).map(b => newest(b.key, b)).sort((a, b) => String(a.key).localeCompare(String(b.key)));
      const ids = [...new Set(boards.flatMap(b => [...refsOf(b)]))];
      const parts = ['{"format":"mesa-feed","v":1,"app":' + JSON.stringify(M.version) + ',"exportedAt":' + JSON.stringify(now.toISOString())
        + ',"clients":' + JSON.stringify(clients) + ',"boards":' + JSON.stringify(boards) + ',"files":{'];
      let sep = '', n = 0, photos = 0, skipped = 0;
      for (const id of ids) {
        setBusy('imp', `Exportando ${++n}/${ids.length} fotos…`);
        const rec = await idbGet('files', id);
        if (!rec || !rec.blob) { skipped++; continue; }
        try {
          const p = await xferPhoto(rec);
          const meta = { name: p.name, type: p.type, w: p.w, h: p.h, size: p.blob.size, lastModified: rec.lastModified || 0, reduced: p.reduced };
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
      if (handle) { try { const w = await handle.createWritable(); await w.write(blob); await w.close(); } catch (e) { handle = null; } }
      if (!handle) {                       // no picker (or it failed): a normal download
        via = 'descarga';
        const u = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = u; a.download = fname; a.hidden = true; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 120000);
      }
      const mb = +(blob.size / 1048576).toFixed(1);
      toast(`Exportada: ${nOf(boards.length, 'mes', 'meses')}, ${nOf(photos, 'foto', 'fotos')} (${mb} MB)` + (skipped ? ` · ${skipped} no se pudieron leer` : ''), { ms: 7000 });
      return { ok: true, file: fname, via, clients: clients.length, boards: boards.length, photos, past, skipped, mb };
    } catch (e) { return fail('No se pudo exportar la mesa: ' + String((e && e.message) || e)); }
    finally { xferRun = null; setBusy('imp', null); }
  };

  function xferCheck(d) {
    if (!d || typeof d !== 'object' || d.format !== 'mesa-feed') return 'Este archivo no es una exportación de la Mesa de feed.';
    if (d.v !== 1) return +d.v > 1 ? 'Este archivo viene de una versión más nueva de la mesa: actualízala antes de importarlo.' : 'Versión de archivo desconocida: no se puede importar.';
    const bad = 'El archivo está dañado o incompleto: no se puede importar.';
    if (!Array.isArray(d.clients) || !Array.isArray(d.boards) || !d.files || typeof d.files !== 'object' || (d.past != null && typeof d.past !== 'object')) return bad;
    if (d.clients.some(c => !c || typeof c.id !== 'string' || !c.id)) return bad;
    if (d.boards.some(b => !b || typeof b.key !== 'string' || !/^.+-\d{4}-\d{2}$/.test(b.key) || !Array.isArray(b.slots))) return bad;
    if (Object.values(d.files).some(f => !f || typeof f.data !== 'string' || !f.data)) return bad;
    return null;
  }
  // what the file changes here: boards added / replaced (newer) / kept (newer here) / same content; clients to add
  const boardBody = b => JSON.stringify({ ...b, savedAt: null, editedAt: null, slots: (b.slots || []).map(({ at, ...s }) => s) });
  const eAt = b => String(b.editedAt || b.savedAt || '');
  const newerEdit = (b, o) => eAt(b) > eAt(o) || (eAt(b) === eAt(o) && String(b.savedAt || '') > String(o.savedAt || ''));
  async function xferPlan(d) {
    const local = ((await idbAll('boards')) || []).map(b => newest(b.key, b)), byKey = Object.fromEntries(local.map(b => [b.key, b]));
    const clients = (await idbAll('clients')) || [], cids = new Set(clients.map(c => c.id)), keys = await allKeys('files');
    const P = { clients, add: [], upd: [], newer: [], same: [], newClients: [], files: new Set(keys.filter(k => !k.startsWith('past:'))), past: new Set(keys.filter(k => k.startsWith('past:')).map(k => k.slice(5))) };
    for (const b of d.boards) {
      const o = byKey[b.key];
      if (!o) P.add.push(b);
      else if (boardBody(o) === boardBody(b)) P.same.push(b);
      else if (newerEdit(b, o)) P.upd.push(b);
      else P.newer.push(b);
    }
    P.put = [...P.add, ...P.upd];
    const pk = new Set(P.put.map(b => b.key));
    P.refs = new Set([...local.filter(b => !pk.has(b.key)), ...P.put].flatMap(b => [...refsOf(b)]));   // photos the mesa uses after the import
    P.newFiles = Object.keys(d.files).filter(id => P.refs.has(id) && !P.files.has(id));
    P.newPast = Object.keys(d.past || {}).filter(id => !P.past.has(id) && d.past[id] && typeof d.past[id].thumb === 'string');
    for (const c of d.clients) if (!cids.has(c.id)) { P.newClients.push(c); cids.add(c.id); }
    for (const b of P.put) { const c = boardClient(b); if (c && !cids.has(c)) { P.newClients.push({ id: c, name: c, handle: '', createdAt: new Date().toISOString() }); cids.add(c); } }
    P.nothing = !P.put.length && !P.newClients.length && !P.newFiles.length && !P.newPast.length;
    return P;
  }
  function xferWhat(P) {
    const u = P.upd.length, k = P.newer.length, s = P.same.length;
    return [P.add.length && nOf(P.add.length, 'mes nuevo', 'meses nuevos'), u && `${u} se actualiza${u === 1 ? '' : 'n'}`,
      k && `${k} ya estaba${k === 1 ? '' : 'n'} más reciente${k === 1 ? '' : 's'} aquí`, s && `${s} igual${s === 1 ? '' : 'es'}`,
      P.newClients.length && nOf(P.newClients.length, 'cliente nuevo', 'clientes nuevos')].filter(Boolean).join(', ')
      || (P.newPast.length ? nOf(P.newPast.length, 'miniatura del mes anterior', 'miniaturas del mes anterior') : '');
  }
  function xferSummaryHTML(d, P) {
    const st = {}; P.add.forEach(b => { st[b.key] = 'nuevo'; }); P.upd.forEach(b => { st[b.key] = 'se actualiza'; }); P.newer.forEach(b => { st[b.key] = 'más reciente aquí'; }); P.same.forEach(b => { st[b.key] = 'igual'; });
    const names = {}; [...d.clients, ...P.clients].forEach(c => { names[c.id] = c.name || c.id; });
    const mOf = b => b.month || (String(b.key).match(/(\d{4}-\d{2})$/) || [])[1] || '';
    const byC = {}; d.boards.slice().sort((a, b) => mOf(a).localeCompare(mOf(b))).forEach(b => { const c = boardClient(b) || '?'; (byC[c] = byC[c] || []).push(b); });
    const rows = Object.entries(byC).map(([c, bs]) => `<li><b>${esc(names[c] || c)}</b>${P.newClients.some(x => x.id === c) ? ' <span>· cliente nuevo</span>' : ''}<br>`
      + bs.map(b => `${esc(rangeLabel(mOf(b), b.span, true))} <span>· ${st[b.key]}</span>`).join(', ') + '</li>').join('');
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
    if (uploadsBusy()) return fail('Espera a que termine la subida a Notion.');
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
      const got = {}, gotPast = {}, need = Object.keys(d.files).filter(id => !P.files.has(id));
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
        } catch (e) { return fail(`El archivo está dañado: no se puede leer la foto «${String((f && f.name) || id)}». No se ha importado nada.`); }
      }
      for (const pid of P.newPast) { const p = d.past[pid]; try { gotPast[pid] = { thumb: blobOf(p.thumb, 'image/jpeg'), w: +p.w || 0, h: +p.h || 0 }; } catch (e) { /* only a preview */ } }
      setBusy('imp', null);
      if (opts.confirm !== false && shellReady() && !(await xferConfirm(xferSummaryHTML(d, P)))) return { cancelled: true };
      if (locked) return fail('La mesa está abierta en otra pestaña: no se ha importado nada.');
      await addQ; await flushPending();
      if (uploadsBusy() || importing) return fail('Espera a que termine la subida a Notion: no se ha importado nada.');   // the board couldn't reopen
      P = await xferPlan(d);                       // again, with what is saved now
      const res = { ok: true, boards: { added: P.add.map(b => b.key), updated: P.upd.map(b => b.key), keptNewer: P.newer.map(b => b.key), same: P.same.map(b => b.key) }, clients: P.newClients.map(c => c.id), photos: 0, past: 0 };
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
      for (const id of P.newFiles) if (got[id]) {  // photos first: a board never points at a photo that isn't here
        await idbPut('files', id, got[id]); res.photos++;
        if (M.files[id]) { URL.revokeObjectURL(M.files[id].thumbUrl); delete M.files[id]; } delete M.blobs[id]; delete M.thumbBlobs[id];
      }
      for (const id of newPast) { await idbPut('files', 'past:' + id, gotPast[id]); res.past++; }
      for (const c of P.newClients) await idbPut('clients', c.id, c);
      if (P.put.length) await tx('boards', 'readwrite', st => { for (const b of P.put) st.put(b, b.key); });
      try { const pend = JSON.parse(lsGet('mesa-pending') || 'null'); if (pend && P.put.some(b => b.key === pend.key)) localStorage.removeItem('mesa-pending'); } catch (e) { /* */ }
      setBusy('imp', null);
      await reopen();
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
    version: M.version, key: S.key, client: S.client, month: S.month, months: boardMonths(), slots: S.slots.length,
    pendingDates: S.slots.filter(dateChg).length, pendingRenames: S.slots.filter(nameChg).length,
    filled: S.slots.filter(s => s.photos.length).length,
    tray: S.tray.length, files: Object.keys(M.files).length,
    past: PB ? `mesa ${prevMonth(S.month)}: ${PB.slots.length}` : `${pastPosts().filter(p => M.pastThumbs[p.id]).length}/${pastPosts().length}`,
    busy: M.busyText || null, locked, savedAt: S.savedAt,
    prevLock: S.prevUnlocked ? 'desbloqueado' : prevOnce ? 'solo esta vez' : 'bloqueado',
    prevHidden: (S.prev || []).filter(p => p.hidden).length, prevEdited: (S.prev || []).filter(p => p.own).length,
    linked: S.slots.filter(s => sharedWith(s).length).length
  }) : { version: M.version, client: curClient, board: null, locked };
  M.board = () => S && JSON.parse(JSON.stringify(S));
  M.purge = async key => {
    const boards = await idbAll('boards');
    const b = boards.find(x => x.key === key); if (!b) return 'no existe';
    const others = boards.filter(x => x.key !== key);
    const otherRefs = new Set(others.flatMap(x => [...refsOf(x)]));
    let n = 0;
    for (const id of refsOf(b)) if (!otherRefs.has(id)) {
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
    dropIdx([key]); if (S && S.key !== key) renderFeed();
    if (S && S.key === key) { clearTimeout(saveTimer); clearTimeout(noteTimer); S = null; PB = null; if (shellReady()) { closeDetail(); await refreshMonths(); render(); } }
    else if (PB && PB.key === key) { PB = null; renderFeed(); }
    return `borrada ${key}: ${n} fotos eliminadas`;
  };
  M.boards = async () => (await idbAll('boards')).map(b => ({ key: b.key, client: b.client || null, month: b.month || null, months: b.month ? monthsOf(b.month, b.span) : [], slots: (b.slots || []).length, filled: (b.slots || []).filter(s => (s.photos || []).length).length, tray: (b.tray || []).length, savedAt: b.savedAt }));
  M._test = {
    place, swap, unassign, move, removeFile, setCover, setNote, setMemo, pastList,
    setCrop: (fid, slotId, patch) => { setCrop(fid, slot(slotId), patch); save(); render(); },
    setFmt: (slotId, fmt) => { cur = { slot: slotId, idx: 0 }; setFmt(slotId, fmt); },
    postRect: (fid, slotId) => postRect(fid, slot(slotId)), gridRect: (fid, slotId) => gridRect(fid, slot(slotId)),
    cropSig: slotId => cropSig(slot(slotId)), cur: () => ({ ...cur }), setSel: id => { sel = id; render(); },
    prev: () => JSON.parse(JSON.stringify((S && S.prev) || [])), prevSetFromTray, prevToTray, prevSwap, prevRestore,
    setHidden: (id, v) => { const it = prevItem(id); if (it) { it.hidden = !!v; changed(); } },
    prevLocked: () => prevLocked(), setDate: (slotId, iso) => setDate(slotId, iso), weekOf, madridISO,
    unlock: mode => { if (mode === 'always') { S.prevUnlocked = true; save(); } else if (mode === 'once') prevOnce = true; else { S.prevUnlocked = false; prevOnce = false; save(); } renderFeed(); },
    shared: id => sharedWith(slot(id)), idx: () => JSON.parse(JSON.stringify(IDX)), deleteIfUnused,
    setSlot: (id, patch) => { const s = slot(id); if (s) { Object.assign(s, patch); save(); render(); } }
  };
  M._test.fileRec = async id => {       // stored photo: record fields + the real size of its image and thumbnail
    const r = await idbGet('files', id); if (!r) return null;
    const px = async b => { if (!b) return null; const m = await createImageBitmap(b, { imageOrientation: 'from-image' }); const o = [m.width, m.height]; m.close(); return o; };
    return { name: r.name, type: r.type, w: r.w, h: r.h, size: r.size, lastModified: r.lastModified, reduced: !!r.reduced, bytes: r.blob ? r.blob.size : null, blobType: r.blob ? r.blob.type : null, px: await px(r.blob), thumbPx: await px(r.thumb) };
  };

  try { localStorage.setItem('mesa-code', '(' + mesaBoot.toString() + ')()'); localStorage.setItem('mesa-version', M.version); } catch (e) { /* storage off */ }
  return 'Mesa de feed ' + M.version + ' cargada';
})();
