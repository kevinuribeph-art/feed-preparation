/*
 * Motor de diseño de la Mesa de feed: carruseles (portada, fichas, final) y portadas de reel.
 * Script plano para navegador (ES2020, sin módulos ni dependencias). Define window.DisenoMotor.
 *
 *   DisenoMotor.version                                   '1.0'
 *   DisenoMotor.cargarKit(url)                         -> Promise<kit>
 *   DisenoMotor.usarKit(kitObj, baseUrl)               -> Promise<kit>
 *   DisenoMotor.tamano(kit, fmt, srcW, srcH)           -> {W, H, factor}
 *   DisenoMotor.capaFoto(bitmap, rect, W, H)           -> {canvas, an}
 *   DisenoMotor.dibujar(ctx, kit, capa, slide, opts)   -> {decision, bloque, avisos}
 *   DisenoMotor.render(kit, slide, bitmap, rect, opts) -> Promise<{canvas, decision, bloque, avisos}>
 *   DisenoMotor.aBlob(canvas, calidad = 0.92)          -> Promise<Blob>
 *
 * Reglas de colocación, velo y color: las del motor de referencia (motor.py) aprobado por el cliente,
 * con las reglas de pieza del kit (kit.piezas). El análisis caro de la foto se hace una vez en capaFoto;
 * dibujar solo consulta zonas (con caché) y por eso se puede llamar en cada pulsación.
 */
(function (global) {
  'use strict';

  const VERSION = '1.0';
  const TIPOS = ['portada', 'ficha', 'final', 'reel'];
  // Alto mínimo de la zona analizada (y anclaje del velo) en px a factor 1: el de motor.py.
  const ALTO_ANALISIS = { ficha: 400, final: 480 };

  // ---------------------------------------------------------------- utilidades
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r2 = (v) => Math.round(v * 100) / 100;
  const lu = (v) => Math.floor(v * 64) / 64; // LayoutUnit de CSS (1/64 px)
  const esNum = (v) => typeof v === 'number' && isFinite(v);
  const num = (v, d) => (esNum(v) ? v : d);
  const lleno = (t) => typeof t === 'string' && t.trim() !== '';

  function nuevoCanvas(W, H) {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      return c;
    }
    return new OffscreenCanvas(W, H);
  }

  // ---------------------------------------------------------------- color (WCAG)
  const LIN = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function linf(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function lumRGB(rgb) { return 0.2126 * linf(rgb[0]) + 0.7152 * linf(rgb[1]) + 0.0722 * linf(rgb[2]); }
  function hex2rgb(h) {
    h = String(h || '').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (!isFinite(n)) return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function contraste(a, b) {
    const la = lumRGB(a), lb = lumRGB(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function rgba(rgb, a) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }

  // ---------------------------------------------------------------- kit
  const DEF_LIENZO = {
    margen: 72, barra_top: 64, bloque_inferior: 150, bloque_superior: 180, pie: 64,
    ancho_max_titulo: 860, ancho_max_texto: 800, separacion: 28, separacion_final: 36
  };
  const DEF_VELO = { color: '#393732', minimo: 0.2, maximo: 0.85, contraste_objetivo: 4.5 };
  const DEF_VARIACION = {
    alineacion_auto: true, lugar_auto: true, texto_oscuro_en_foto_clara: true, margen_lado_limpio: 0.15,
    lugar_preferido: 'abajo', cambiar_lugar_si: { ratio_bordes: 0.65, dif_velo: 0.1 }
  };
  const DEF_PIEZAS = {
    portada: { lugar: 'abajo', alinear: 'izquierda', nivel: 'portada', velo: 0, contraste_min: 3.0, marca: true, pagina: false, pie: false },
    ficha: { lugar: 'auto', alinear: 'auto', nivel: 'titular', marca: true, pagina: true, pie: true },
    final: { lugar: 'arriba', alinear: 'izquierda', nivel: 'titular', color: 'crema', marca: true, pagina: true, pie: true },
    reel: {
      lugar: 'centro', alinear: 'centro', nivel: 'portada', marca: false, pagina: false, pie: false,
      capa: { velo_min: 0.25, velo_max: 0.6, contraste: 4.5, elipse: [90, 30], alto_zona: 380 }
    }
  };

  // Vista del kit con valores por defecto (se calcula en cada dibujo: el editor puede cambiar el kit en vivo).
  function conf(kit) {
    const k = kit || {};
    const piezas = {};
    for (const t of TIPOS) piezas[t] = Object.assign({}, DEF_PIEZAS[t], (k.piezas || {})[t] || {});
    piezas.reel.capa = Object.assign({}, DEF_PIEZAS.reel.capa, piezas.reel.capa || {});
    return {
      kit: k,
      L: Object.assign({}, DEF_LIENZO, k.lienzo || {}),
      velo: Object.assign({}, DEF_VELO, k.velo || {}),
      vari: Object.assign({}, DEF_VARIACION, k.variacion || {},
        { cambiar_lugar_si: Object.assign({}, DEF_VARIACION.cambiar_lugar_si, (k.variacion || {}).cambiar_lugar_si || {}) }),
      piezas,
      colores: k.colores || {},
      escala: k.escala || {},
      fuentes: k.fuentes || {}
    };
  }
  function colorHex(C, key) {
    if (C.colores[key]) return C.colores[key];
    if (key === 'blanco') return '#FFFFFF';
    if (key === 'carbon') return C.velo.color || '#393732';
    return '#FFFFFF';
  }
  function esOscuro(C, key) { return lumRGB(hex2rgb(colorHex(C, key))) < 0.179; }

  // ---------------------------------------------------------------- fuentes
  const cacheKits = new Map();
  const cacheFuentes = new Map();

  function urlAbs(u, base) {
    const b = base || (typeof document !== 'undefined' ? document.baseURI : (global.location && global.location.href));
    return new URL(u, b).href;
  }

  function cargarFuente(familia, url, peso) {
    const k = familia + '|' + url + '|' + peso;
    if (!cacheFuentes.has(k)) {
      const face = new FontFace(familia, `url("${url}")`, { weight: String(peso), style: 'normal' });
      const p = face.load().then((f) => { document.fonts.add(f); return f; }).catch((e) => {
        cacheFuentes.delete(k);
        throw new Error(`No se pudo cargar la fuente «${familia}» (${url}): ${e && e.message ? e.message : e}`);
      });
      cacheFuentes.set(k, p);
    }
    return cacheFuentes.get(k);
  }

  async function usarKit(kitObj, baseUrl) {
    if (!kitObj || typeof kitObj !== 'object') throw new Error('Kit no válido');
    const base = urlAbs(baseUrl || '.');
    Object.defineProperty(kitObj, '_base', { value: base, enumerable: false, configurable: true, writable: true });
    const fuentes = kitObj.fuentes || {};
    const tareas = [];
    for (const id of Object.keys(fuentes)) {
      const f = fuentes[id];
      if (!f || !f.familia || !f.archivo) continue;
      tareas.push(cargarFuente(f.familia, urlAbs(f.archivo, base), f.peso || 400));
    }
    await Promise.all(tareas);
    if (typeof document !== 'undefined' && document.fonts) await document.fonts.ready;
    return kitObj;
  }

  function cargarKit(url) {
    const abs = urlAbs(url);
    if (!cacheKits.has(abs)) {
      const p = fetch(abs, { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error(`No se pudo leer el kit (${r.status}): ${abs}`); return r.json(); })
        .then((kit) => usarKit(kit, abs))
        .catch((e) => { cacheKits.delete(abs); throw e; });
      cacheKits.set(abs, p);
    }
    return cacheKits.get(abs);
  }

  // ---------------------------------------------------------------- formatos
  function tamano(kit, fmt, srcW, srcH) {
    const F = (kit && kit.formatos) || {};
    const ancho = (F[fmt] && F[fmt].ancho) || 1080;
    if (fmt === 'h') {
      const f = Object.assign({ ancho: 1080, ratio_max: 1.91, ratio_vertical: 1.7778, factor_tipografia: 0.72 }, F.h || {});
      let ratio = srcW / srcH;
      if (!(ratio >= 1)) ratio = f.ratio_vertical;
      ratio = Math.min(ratio, f.ratio_max);
      return { W: f.ancho, H: Math.round(f.ancho / ratio), factor: f.factor_tipografia };
    }
    const fijos = { v45: [1080, 1350], v34: [1080, 1440], r916: [1080, 1920] };
    if (F[fmt] && F[fmt].alto) return { W: ancho, H: F[fmt].alto, factor: 1 };
    const d = fijos[fmt] || fijos.v45;
    return { W: d[0], H: d[1], factor: 1 };
  }

  // ---------------------------------------------------------------- análisis de la foto
  // Reducción BOX igual que PIL (Image.resize(..., Image.BOX)): píxeles cuyo centro cae en la caja.
  function coefsBox(inSize, outSize) {
    const scale = inSize / outSize, support = 0.5 * scale, ss = 1 / scale;
    const xmins = new Int32Array(outSize), ks = [];
    for (let xx = 0; xx < outSize; xx++) {
      const center = (xx + 0.5) * scale;
      let xmin = Math.trunc(center - support + 0.5); if (xmin < 0) xmin = 0;
      let xmax = Math.trunc(center + support + 0.5); if (xmax > inSize) xmax = inSize;
      xmax -= xmin;
      const k = new Float64Array(Math.max(0, xmax));
      let ww = 0;
      for (let x = 0; x < xmax; x++) {
        const v = (x + xmin - center + 0.5) * ss;
        const w = (v > -0.5 && v <= 0.5) ? 1 : 0;
        k[x] = w; ww += w;
      }
      if (ww) for (let x = 0; x < xmax; x++) k[x] /= ww;
      xmins[xx] = xmin; ks.push(k);
    }
    return { xmins, ks };
  }
  function reducirBox(src, w, h, ow, oh) {
    const ch = coefsBox(w, ow);
    const tmp = new Uint8Array(ow * h);
    for (let y = 0; y < h; y++) {
      const fila = y * w;
      for (let xx = 0; xx < ow; xx++) {
        const k = ch.ks[xx], x0 = ch.xmins[xx];
        let s = 0;
        for (let i = 0; i < k.length; i++) s += src[fila + x0 + i] * k[i];
        tmp[y * ow + xx] = clamp(Math.floor(s + 0.5), 0, 255);
      }
    }
    const cv = coefsBox(h, oh);
    const out = new Uint8Array(ow * oh);
    for (let yy = 0; yy < oh; yy++) {
      const k = cv.ks[yy], y0 = cv.xmins[yy];
      for (let x = 0; x < ow; x++) {
        let s = 0;
        for (let i = 0; i < k.length; i++) s += tmp[(y0 + i) * ow + x] * k[i];
        out[yy * ow + x] = clamp(Math.floor(s + 0.5), 0, 255);
      }
    }
    return out;
  }

  function analizarPixeles(px, W, H) {
    const n = W * H;
    const q = new Uint8Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const L = 0.2126 * LIN[px[i]] + 0.7152 * LIN[px[i + 1]] + 0.0722 * LIN[px[i + 2]];
      q[p] = (L * 255) | 0;
    }
    const lw = W >> 2, lh = H >> 2;
    const r = reducirBox(q, W, H, lw, lh);
    const ls = new Float32Array(lw * lh);
    for (let i = 0; i < ls.length; i++) ls[i] = r[i] / 255;
    // bordes = |dx| + |dy| de la luminancia reducida (como motor.py), celdas de 4x4 px a tamaño completo
    const cw = Math.max(1, lw - 1), chh = Math.max(1, lh - 1);
    const e = new Float32Array(cw * chh);
    if (lw > 1 && lh > 1) {
      for (let y = 0; y < chh; y++) {
        for (let x = 0; x < cw; x++) {
          const a = ls[y * lw + x];
          e[y * cw + x] = Math.abs(ls[y * lw + x + 1] - a) + Math.abs(ls[(y + 1) * lw + x] - a);
        }
      }
    }
    return { W, H, px, ls, lw, lh, e, cw, ch: chh, cache: new Map() };
  }

  function capaFoto(bitmap, rect, W, H) {
    W = Math.round(W); H = Math.round(H);
    const canvas = nuevoCanvas(W, H);
    const ctx = canvas.getContext('2d'); // una sola lectura: el lienzo sigue acelerado para redibujar rápido
    const bw = bitmap.width || bitmap.naturalWidth || bitmap.videoWidth;
    const bh = bitmap.height || bitmap.naturalHeight || bitmap.videoHeight;
    const r = rect || rectCover(bw, bh, W, H, 0.5, 0.5);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, 0, 0, W, H);
    let an = null;
    try {
      an = analizarPixeles(ctx.getImageData(0, 0, W, H).data, W, H);
    } catch (e) {
      an = null; // lienzo contaminado (foto de otro origen sin CORS): se dibuja sin análisis
    }
    return { canvas, an };
  }

  // Equivale a object-fit:cover + object-position (px, py en 0..1).
  function rectCover(iw, ih, W, H, px, py) {
    const s = Math.max(W / iw, H / ih);
    const w = W / s, h = H / s;
    return { x: (iw - w) * num(px, 0.5), y: (ih - h) * num(py, 0.5), w, h };
  }

  function pesosCelda(a, b, n) {
    const c0 = Math.min(a >> 2, n - 1), c1 = Math.min((b - 1) >> 2, n - 1);
    const w = new Float64Array(c1 - c0 + 1);
    for (let c = c0; c <= c1; c++) {
      const lo = Math.max(a, 4 * c), hi = (c === n - 1) ? b : Math.min(b, 4 * c + 4);
      w[c - c0] = Math.max(0, hi - lo);
    }
    return { c0, w };
  }
  function bordesMedia(an, x0, y0, x1, y1) {
    if (!an || x1 <= x0 || y1 <= y0) return 0;
    const fr = pesosCelda(y0, y1, an.ch), fc = pesosCelda(x0, x1, an.cw);
    let s = 0;
    for (let i = 0; i < fr.w.length; i++) {
      const wr = fr.w[i];
      if (!wr) continue;
      const base = (fr.c0 + i) * an.cw + fc.c0;
      let sf = 0;
      for (let j = 0; j < fc.w.length; j++) sf += fc.w[j] * an.e[base + j];
      s += wr * sf;
    }
    return s / ((y1 - y0) * (x1 - x0));
  }

  let HIST = new Uint32Array(65536);
  let BINS = new Uint16Array(1 << 19);

  // Estadísticas de luz de una zona (a resolución completa): color medio del 10 % más claro y del 10 % más
  // oscuro, percentiles 10/90 de luminancia (interpolación lineal, como numpy) y bordes medios.
  function zonaStats(an, x0, y0, x1, y1) {
    if (!an) return null;
    x0 = clamp(Math.round(x0), 0, an.W); x1 = clamp(Math.round(x1), 0, an.W);
    y0 = clamp(Math.round(y0), 0, an.H); y1 = clamp(Math.round(y1), 0, an.H);
    if (x1 <= x0 || y1 <= y0) return null;
    const key = x0 + ',' + y0 + ',' + x1 + ',' + y1;
    const c = an.cache.get(key);
    if (c) return c;
    const n = (x1 - x0) * (y1 - y0);
    if (BINS.length < n) BINS = new Uint16Array(n);
    HIST.fill(0);
    const px = an.px, W = an.W;
    let k = 0;
    for (let y = y0; y < y1; y++) {
      let i = (y * W + x0) * 4;
      for (let x = x0; x < x1; x++, i += 4) {
        const L = 0.2126 * LIN[px[i]] + 0.7152 * LIN[px[i + 1]] + 0.0722 * LIN[px[i + 2]];
        const b = (L * 65535 + 0.5) | 0;
        BINS[k++] = b; HIST[b]++;
      }
    }
    const pos10 = 0.1 * (n - 1), pos90 = 0.9 * (n - 1);
    const rangos = [Math.floor(pos10), Math.min(n - 1, Math.floor(pos10) + 1), Math.floor(pos90), Math.min(n - 1, Math.floor(pos90) + 1)];
    const valores = [0, 0, 0, 0];
    let cum = 0, ri = 0;
    for (let b = 0; b < 65536 && ri < 4; b++) {
      cum += HIST[b];
      while (ri < 4 && cum > rangos[ri]) { valores[ri] = b; ri++; }
    }
    const t10 = valores[0] + (pos10 - rangos[0]) * (valores[1] - valores[0]);
    const t90 = valores[2] + (pos90 - rangos[2]) * (valores[3] - valores[2]);
    let cr = 0, cg = 0, cb = 0, cn = 0, or = 0, og = 0, ob = 0, on = 0;
    k = 0;
    for (let y = y0; y < y1; y++) {
      let i = (y * W + x0) * 4;
      for (let x = x0; x < x1; x++, i += 4) {
        const b = BINS[k++];
        if (b >= t90) { cr += px[i]; cg += px[i + 1]; cb += px[i + 2]; cn++; }
        if (b <= t10) { or += px[i]; og += px[i + 1]; ob += px[i + 2]; on++; }
      }
    }
    const res = {
      claro: cn ? [cr / cn, cg / cn, cb / cn] : [0, 0, 0],
      oscuro: on ? [or / on, og / on, ob / on] : [0, 0, 0],
      p10: t10 / 65535, p90: t90 / 65535,
      bordes: bordesMedia(an, x0, y0, x1, y1),
      caja: [x0, y0, x1, y1]
    };
    if (an.cache.size > 400) an.cache.clear();
    an.cache.set(key, res);
    return res;
  }

  // Alfa mínimo del velo para que el texto llegue al contraste objetivo sobre lo más claro de la zona.
  function veloNecesario(st, textoRGB, objetivo, veloRGB) {
    if (!st) return 0;
    const claro = st.claro;
    let lo = 0, hi = 1;
    for (let i = 0; i < 20; i++) {
      const a = (lo + hi) / 2;
      const mezcla = [claro[0] * (1 - a) + veloRGB[0] * a, claro[1] * (1 - a) + veloRGB[1] * a, claro[2] * (1 - a) + veloRGB[2] * a];
      if (contraste(textoRGB, mezcla) >= objetivo) hi = a; else lo = a;
    }
    return hi;
  }

  // Sin velo: blanco si se lee; si no, carbón; si ninguno llega, el mejor + aviso.
  function mejorTexto(C, st, objetivo) {
    if (!st) return { color: 'blanco', contraste: 21, aviso: null };
    const cb = contraste(hex2rgb(colorHex(C, 'blanco')), st.claro);
    const cc = contraste(hex2rgb(colorHex(C, 'carbon')), st.oscuro);
    if (cb >= objetivo) return { color: 'blanco', contraste: r2(cb), aviso: null };
    if (cc >= objetivo) return { color: 'carbon', contraste: r2(cc), aviso: null };
    const mx = Math.max(cb, cc);
    return {
      color: cb >= cc ? 'blanco' : 'carbon', contraste: r2(mx),
      aviso: `contraste ${mx.toFixed(2)} < ${objetivo}: cambia el encuadre o la foto`
    };
  }

  // ---------------------------------------------------------------- tipografía
  // El texto se compone palabra a palabra (el canvas de Chromium ya da forma a cada palabra por separado) y
  // se añade el kerning de los pares «letra␣letra» que CSS sí aplica: así los anchos, cortes de línea y
  // posiciones coinciden con el texto HTML/CSS del motor de referencia.
  const TIENE_LS = (() => {
    try { const c = nuevoCanvas(1, 1).getContext('2d'); return 'letterSpacing' in c; } catch (e) { return false; }
  })();
  const cacheAnchos = new Map();
  const cacheAjustes = new Map();
  const cacheBases = new Map();

  function estilo(C, nivel, esc) {
    const s = C.escala[nivel] || { fuente: 'sans', px: 32, interlineado: 1.2, espaciado: 0 };
    const f = C.fuentes[s.fuente] || {};
    const px = s.px * esc;
    const peso = s.peso || f.peso || 400;
    const familia = f.familia || 'sans-serif';
    return {
      nivel, px, lh: lu(px * num(s.interlineado, 1.2)), ls: num(s.espaciado, 0) * px,
      font: `${peso} ${px}px "${familia}"`, mayus: !!s.mayusculas
    };
  }
  // Estado de texto neutro (el contexto puede venir del editor con otros ajustes).
  function estadoTexto(ctx) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if ('direction' in ctx) ctx.direction = 'ltr';
    if ('fontKerning' in ctx) ctx.fontKerning = 'normal';
    if ('wordSpacing' in ctx) ctx.wordSpacing = '0px';
    if ('fontStretch' in ctx) ctx.fontStretch = 'normal';
    if ('fontVariantCaps' in ctx) ctx.fontVariantCaps = 'normal';
    if ('textRendering' in ctx) ctx.textRendering = 'auto';
  }
  // Siempre explícito: save()/restore() del que llama cambian el estado del contexto sin avisar.
  function ponerFuente(ctx, est) {
    ctx.font = est.font;
    if (TIENE_LS) ctx.letterSpacing = est.ls + 'px';
  }
  // Las medidas se hacen en un contexto propio, independiente del lienzo en el que se dibuja.
  let MED = null;
  function ctxMedida() {
    if (!MED) { MED = nuevoCanvas(8, 8).getContext('2d'); estadoTexto(MED); }
    return MED;
  }
  function ancho(_ctx, est, t) {
    const k = est.font + '|' + est.ls + '|' + t;
    let w = cacheAnchos.get(k);
    if (w !== undefined) return w;
    const ctx = ctxMedida();
    ponerFuente(ctx, est);
    w = ctx.measureText(t).width;
    if (!TIENE_LS) w += est.ls * Array.from(t).length;
    if (cacheAnchos.size > 20000) cacheAnchos.clear();
    cacheAnchos.set(k, w);
    return w;
  }

  // Medidor HTML oculto (solo si hay documento): kerning alrededor del espacio y línea base de CSS.
  let CAJA = null;
  function cajaDOM() {
    if (CAJA === false) return null;
    if (typeof document === 'undefined' || !document.documentElement) { CAJA = false; return null; }
    if (!CAJA) {
      const d = document.createElement('div');
      d.setAttribute('aria-hidden', 'true');
      // all:initial aísla las medidas de cualquier CSS de la página que aloja el motor
      d.style.cssText = 'all:initial;display:block;position:absolute;left:-100000px;top:0;visibility:hidden;' +
        'pointer-events:none;contain:layout style;';
      const s = document.createElement('span');
      s.style.cssText = 'all:initial;white-space:pre;';
      const b = document.createElement('div');
      b.style.cssText = 'all:initial;display:block;white-space:pre;width:max-content;';
      const mk = document.createElement('span');
      mk.style.cssText = 'all:initial;display:inline-block;width:0;height:0;vertical-align:baseline;';
      d.appendChild(s); d.appendChild(b);
      CAJA = { d, s, b, mk };
    }
    if (!CAJA.d.isConnected) document.documentElement.appendChild(CAJA.d);
    return CAJA;
  }
  function anchoDOM(est, t) {
    const c = cajaDOM();
    if (!c) return null;
    c.s.style.font = est.font;
    c.s.style.letterSpacing = est.ls + 'px';
    c.s.textContent = t;
    const w = c.s.getBoundingClientRect().width;
    return w > 0 ? w : null;
  }
  // Diferencia entre el ancho CSS de «a␣b» y la suma de anchos por separado (kerning con el espacio).
  function ajustePar(ctx, est, a, b) {
    const k = est.font + '|' + est.ls + '|' + a + ' ' + b;
    let v = cacheAjustes.get(k);
    if (v !== undefined) return v;
    const d = anchoDOM(est, a + ' ' + b);
    v = d === null ? 0 : d - (ancho(ctx, est, a) + ancho(ctx, est, ' ') + ancho(ctx, est, b));
    if (Math.abs(v) < 0.03 || Math.abs(v) > est.px) v = 0; // ruido de redondeo de CSS (1/64 px) o medida rara
    if (cacheAjustes.size > 20000) cacheAjustes.clear();
    cacheAjustes.set(k, v);
    return v;
  }
  // Línea base dentro de una caja de línea de alto est.lh (como la coloca CSS).
  function lineaBase(ctx, est) {
    const k = est.font + '|' + est.lh;
    let v = cacheBases.get(k);
    if (v !== undefined) return v;
    const c = cajaDOM();
    if (c) {
      c.b.style.font = est.font;
      c.b.style.lineHeight = est.lh + 'px';
      c.b.style.letterSpacing = '0px';
      c.b.textContent = 'Hg';
      c.b.appendChild(c.mk);
      const r = c.b.getBoundingClientRect();
      if (r.height > 0) v = c.mk.getBoundingClientRect().top - r.top;
    }
    if (v === undefined || !esNum(v)) {
      const cm = ctxMedida();
      ponerFuente(cm, est);
      const t = cm.measureText('Hg');
      let a = t.fontBoundingBoxAscent, d = t.fontBoundingBoxDescent;
      if (!esNum(a) || !esNum(d)) { a = est.px * 0.95; d = est.px * 0.25; }
      v = (est.lh - (a + d)) / 2 + a;
    }
    cacheBases.set(k, v);
    return v;
  }

  // Párrafo preparado: anchos de palabra y de cada hueco (espacio + kerning del par), sumas acumuladas.
  function prepararParrafo(ctx, est, palabras) {
    const N = palabras.length;
    const ww = palabras.map((p) => ancho(ctx, est, p));
    const sp = ancho(ctx, est, ' ');
    const pw = new Float64Array(N + 1), pg = new Float64Array(N);
    for (let i = 0; i < N; i++) pw[i + 1] = pw[i] + ww[i];
    for (let i = 0; i < N - 1; i++) {
      const a = Array.from(palabras[i]), b = Array.from(palabras[i + 1]);
      pg[i + 1] = pg[i] + sp + ajustePar(ctx, est, a[a.length - 1], b[0]);
    }
    const anchoR = (i, j) => (pw[j] - pw[i]) + (j - i > 1 ? pg[j - 1] - pg[i] : 0);
    const linea = (i, j) => {
      const xs = [];
      for (let k = i; k < j; k++) xs.push(anchoR(i, k + 1) - ww[k]);
      return { t: palabras.slice(i, j).join(' '), palabras: palabras.slice(i, j), xs, w: anchoR(i, j) };
    };
    return { N, palabras, anchoR, linea };
  }

  const EPS = 0.01;
  // Corte voraz de CSS: una palabra más ancha que el máximo ocupa su línea (desborda, como en CSS).
  function voraz(P, maxW) {
    const cortes = [];
    let i = 0;
    while (i < P.N) {
      let j = i + 1;
      while (j < P.N && P.anchoR(i, j + 1) <= maxW + EPS) j++;
      cortes.push([i, j]);
      i = j;
    }
    return cortes;
  }

  // Corte equilibrado como text-wrap:balance de Chromium (contrastado con 389 casos reales, 388 iguales):
  //  - si alguna palabra no cabe en el ancho máximo: corte voraz, sin equilibrar;
  //  - con menos de 4 palabras: el ancho más estrecho que mantiene el número de líneas, y corte voraz a ese ancho;
  //  - si no (ScoreLineBreaker en modo balance): mismo número de líneas que el voraz, minimizando la suma de
  //    (ancho disponible − ancho de línea)², última línea incluida, + 10000 por dejar sola la última palabra.
  const PENAL_VIUDA = 10000, PENAL_DESBORDE = 1e9, MAX_LINEAS_BALANCE = 6;
  function equilibrado(P, maxW) {
    const g = voraz(P, maxW);
    const n = g.length, N = P.N;
    if (n <= 1 || n > MAX_LINEAS_BALANCE) return g;
    for (let i = 0; i < N; i++) if (P.anchoR(i, i + 1) > maxW + EPS) return g;
    if (N < 4) {
      let lo = 0, hi = maxW;
      for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; if (voraz(P, mid).length <= n) hi = mid; else lo = mid; }
      return voraz(P, hi);
    }
    const coste = [], prev = [];
    for (let k = 0; k <= n; k++) { coste.push(new Float64Array(N + 1).fill(Infinity)); prev.push(new Int32Array(N + 1).fill(-1)); }
    coste[0][0] = 0;
    for (let k = 1; k <= n; k++) {
      for (let j = k; j <= N; j++) {
        for (let i = j - 1; i >= k - 1; i--) {
          const w = P.anchoR(i, j);
          let cw;
          if (w <= maxW + EPS) cw = (maxW - w) * (maxW - w);
          else if (j === i + 1) cw = PENAL_DESBORDE;
          else break;
          if (coste[k - 1][i] === Infinity) continue;
          const c = coste[k - 1][i] + cw + (j === N - 1 ? PENAL_VIUDA : 0);
          if (c < coste[k][j] - 1e-6) { coste[k][j] = c; prev[k][j] = i; }
        }
      }
    }
    if (coste[n][N] === Infinity) return g;
    const out = [];
    let j = N;
    for (let k = n; k >= 1; k--) { const i = prev[k][j]; out.unshift([i, j]); j = i; }
    return out;
  }

  // Texto → líneas [{t, palabras, xs, w}]. '\n' fuerza salto; cada párrafo se equilibra dentro de maxW.
  // Una palabra más ancha que «limite» (el ancho útil del lienzo) se parte por letras para no salirse.
  function partir(ctx, est, texto, maxW, limite) {
    let t = String(texto).replace(/<br\s*\/?>/gi, '\n').replace(/\r\n?/g, '\n');
    if (est.mayus) t = t.toLocaleUpperCase('es-ES');
    const lim = esNum(limite) ? limite : Infinity;
    const lineas = [];
    for (const par of t.split('\n')) {
      const limpio = par.replace(/[ \t]+/g, ' ').trim();
      if (!limpio) { lineas.push({ t: '', palabras: [], xs: [], w: 0 }); continue; }
      // trozos de párrafo separados por palabras imposibles (más anchas que el lienzo)
      let grupo = [];
      const vaciar = () => {
        if (!grupo.length) return;
        const P = prepararParrafo(ctx, est, grupo);
        for (const [i, j] of equilibrado(P, maxW)) lineas.push(P.linea(i, j));
        grupo = [];
      };
      for (const p of limpio.split(' ')) {
        if (ancho(ctx, est, p) <= lim) { grupo.push(p); continue; }
        vaciar();
        let trozo = '';
        for (const ch of Array.from(p)) {
          if (trozo && ancho(ctx, est, trozo + ch) > lim) { lineas.push(prepararParrafo(ctx, est, [trozo]).linea(0, 1)); trozo = ch; } else trozo += ch;
        }
        if (trozo) lineas.push(prepararParrafo(ctx, est, [trozo]).linea(0, 1));
      }
      vaciar();
    }
    return lineas;
  }

  // Bloque de texto: [{est, lineas, y (relativa), h}], alto total.
  function maquetar(ctx, C, items, esc, factor, W) {
    const L = C.L;
    const disp = Math.max(10, W - 2 * L.margen);
    const res = [];
    let y = 0;
    for (const it of items) {
      const est = estilo(C, it.nivel, esc);
      const maxW = Math.min(disp, (it.nivel === 'texto' ? L.ancho_max_texto : L.ancho_max_titulo) * factor);
      const lineas = partir(ctx, est, it.texto, maxW, disp);
      if (res.length) y += it.gap * esc;
      const h = lineas.length * est.lh;
      res.push({ est, lineas, y, h });
      y += h;
    }
    return { items: res, h: y };
  }

  function itemsDe(C, tipo, slide) {
    const p = C.piezas[tipo];
    const L = C.L;
    const out = [];
    if (lleno(slide.titulo)) out.push({ nivel: p.nivel || (tipo === 'portada' || tipo === 'reel' ? 'portada' : 'titular'), texto: slide.titulo, gap: 0 });
    if (tipo === 'ficha' && lleno(slide.texto)) out.push({ nivel: 'texto', texto: slide.texto, gap: L.separacion });
    if (tipo === 'final') {
      if (lleno(slide.entradilla)) out.push({ nivel: 'entradilla', texto: slide.entradilla, gap: L.separacion_final });
      // sin contacto (null/undefined) se usa el del kit; '' significa «no dibujar»
      const contacto = slide.contacto == null ? (C.kit.final || {}).contacto : slide.contacto;
      if (lleno(contacto)) out.push({ nivel: 'etiqueta', texto: contacto, gap: L.separacion_final });
    }
    return out;
  }

  function pintarPalabra(ctx, est, t, x, base) {
    if (TIENE_LS || !est.ls) { ctx.fillText(t, x, base); return; }
    // sin letterSpacing en canvas: letra a letra respetando el kerning del prefijo
    const cs = Array.from(t);
    let pre = '';
    for (let i = 0; i < cs.length; i++) {
      ctx.fillText(cs[i], x + ctx.measureText(pre).width + i * est.ls, base);
      pre += cs[i];
    }
  }
  function pintarLinea(ctx, est, ln, x, lineTop) {
    if (!ln.t) return;
    const base = lineTop + lineaBase(ctx, est);
    ponerFuente(ctx, est);
    for (let k = 0; k < ln.palabras.length; k++) pintarPalabra(ctx, est, ln.palabras[k], x + ln.xs[k], base);
  }

  // Etiqueta suelta (marca, página, pie) en una línea: alineada a la izquierda, derecha o centro respecto a x.
  function pintarEtiqueta(ctx, C, texto, x, lineTop, alinear, colorKey, esc) {
    if (!lleno(texto)) return;
    const est = estilo(C, 'etiqueta', esc || 1);
    let t = String(texto).replace(/\s+/g, ' ').trim();
    if (est.mayus) t = t.toLocaleUpperCase('es-ES');
    const P = prepararParrafo(ctx, est, t.split(' '));
    const ln = P.linea(0, P.N);
    const x0 = alinear === 'derecha' ? x - ln.w : alinear === 'centro' ? x - ln.w / 2 : x;
    ctx.fillStyle = colorHex(C, colorKey);
    pintarLinea(ctx, est, ln, x0, lineTop);
  }

  // ---------------------------------------------------------------- velos
  // Rampas del velo: 260 px de transición y 80 px de solape con el bloque (× kv en formato horizontal).
  function veloLineal(ctx, W, H, rgb, a, lugar, zTop, zBot, kv) {
    if (!(a > 0)) return;
    const R1 = 260 * kv, R2 = 80 * kv;
    if (lugar === 'abajo') {
      const t = Math.max(0, zTop - R1);
      if (t >= H) return;
      const g = ctx.createLinearGradient(0, t, 0, H);
      g.addColorStop(0, rgba(rgb, 0));
      g.addColorStop(clamp((zTop + R2 - t) / (H - t), 0, 1), rgba(rgb, a));
      g.addColorStop(1, rgba(rgb, a));
      ctx.fillStyle = g; ctx.fillRect(0, t, W, H - t);
    } else if (lugar === 'arriba') {
      const b = Math.min(H, zBot + R1);
      if (b <= 0) return;
      const g = ctx.createLinearGradient(0, 0, 0, b);
      g.addColorStop(0, rgba(rgb, a));
      g.addColorStop(clamp((zBot - R2) / b, 0, 1), rgba(rgb, a));
      g.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, b);
    } else {
      const t = Math.max(0, zTop - R1), b = Math.min(H, zBot + R1);
      if (b <= t) return;
      const s1 = clamp((zTop + R2 - t) / (b - t), 0, 1), s2 = clamp((zBot - R2 - t) / (b - t), s1, 1);
      const g = ctx.createLinearGradient(0, t, 0, b);
      g.addColorStop(0, rgba(rgb, 0));
      g.addColorStop(s1, rgba(rgb, a));
      g.addColorStop(s2, rgba(rgb, a));
      g.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = g; ctx.fillRect(0, t, W, b - t);
    }
  }
  function veloTop(ctx, W, rgb, a, y0, kv) {
    if (!(a > 0)) return;
    const alto = 300 * kv;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + alto);
    g.addColorStop(0, rgba(rgb, a));
    g.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, alto);
  }
  function veloRadial(ctx, W, H, rgb, a, cx, cy, elipse) {
    if (!(a > 0)) return;
    const rx = (elipse[0] / 100) * W, ry = (elipse[1] / 100) * H;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, rgba(rgb, a));
    g.addColorStop(0.3, rgba(rgb, a));
    g.addColorStop(0.65, rgba(rgb, r2(a * 0.45)));
    g.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-cx / rx, -cy / ry, W / rx, H / ry);
    ctx.restore();
  }

  // ---------------------------------------------------------------- dibujo
  function zonaDe(C, W, H, tipo, opts) {
    if (opts && Array.isArray(opts.zona)) return opts.zona;
    const r = (C.kit.formatos || {}).r916 || { ancho: 1080, alto: 1920, zona_segura: [240, 1680] };
    const zs = r.zona_segura || [240, 1680];
    if (tipo === 'reel' || (W === (r.ancho || 1080) && H === (r.alto || 1920))) return [zs[0], zs[1]];
    return [0, H];
  }

  function dibujar(ctx, kit, capa, slide, opts) {
    opts = opts || {};
    slide = slide || {};
    const C = conf(kit);
    const L = C.L, m = L.margen;
    const W = Math.round(opts.W || (capa && capa.canvas && capa.canvas.width) || ctx.canvas.width);
    const H = Math.round(opts.H || (capa && capa.canvas && capa.canvas.height) || ctx.canvas.height);
    const factor = num(opts.factor, 1);
    const ov = slide.ov || {};
    const tipo = TIPOS.includes(slide.tipo) ? slide.tipo : 'ficha';
    const P = C.piezas[tipo];
    const zona = zonaDe(C, W, H, tipo, opts);
    const an = capa ? capa.an : null;
    const avisos = [];
    const dx = num(ov.dx, 0), dy = num(ov.dy, 0);
    const esc = factor * clamp(num(ov.escala, 1), 0.6, 1.6);
    const colorOv = ov.color && C.colores[ov.color] ? ov.color : null;
    const veloOv = esNum(ov.velo) ? clamp(ov.velo, 0, 0.9) : null;
    const veloRGB = hex2rgb(C.velo.color);
    const blancoRGB = hex2rgb(colorHex(C, 'blanco'));
    // Formato horizontal (H < W): las distancias verticales (anclas del bloque, barra, pie, rampas del velo)
    // se escalan por kv y las etiquetas sueltas por el factor tipográfico. En 4:5, 3:4 y 9:16 kv = fe = 1.
    const horiz = H < W;
    const kv = horiz ? clamp(H / 1350, 0.45, 1) : 1;
    const fe = horiz ? factor : 1;
    const G = {
      inf: L.bloque_inferior * kv, sup: L.bloque_superior * kv, barra: L.barra_top * kv, pie: L.pie * kv,
      f0: 40 * kv, f1: 120 * kv, p0: 60 * kv, p1: 10 * kv
    };

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if ('filter' in ctx) ctx.filter = 'none';
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    estadoTexto(ctx);

    // 1. foto
    if (capa && capa.canvas) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(capa.canvas, 0, 0, W, H);
    } else {
      ctx.fillStyle = colorHex(C, 'carbon');
      ctx.fillRect(0, 0, W, H);
    }

    // 2. bloque de texto
    const lay = maquetar(ctx, C, itemsDe(C, tipo, slide), esc, factor, W);
    const anclas = { arriba: zona[0] + G.sup, abajo: zona[1] - G.inf, centro: (zona[0] + zona[1]) / 2 };
    const topDe = (lugar, h) => (lugar === 'arriba' ? anclas.arriba : lugar === 'abajo' ? anclas.abajo - h : anclas.centro - h / 2);
    const LUGARES = ['arriba', 'abajo', 'centro'], ALINEAR = ['izquierda', 'derecha', 'centro'];
    const lugarOv = LUGARES.includes(ov.lugar) ? ov.lugar : null;
    const alinearOv = ALINEAR.includes(ov.alinear) ? ov.alinear : null;

    let lugar, alinear, velo = 0, color, vTop = 0, colMarca = null, colPie = null;
    let zTop, zBot; // zona del velo (sigue al bloque)

    if (tipo === 'ficha' || tipo === 'final') {
      const altoMin = num(P.alto_analisis, ALTO_ANALISIS[tipo]) * (horiz ? kv : factor);
      const hz = Math.max(lay.h, altoMin);
      const cand = {};
      const candidato = (lg, ddx, ddy) => {
        const y0 = topDe(lg, hz) + ddy;
        const st = zonaStats(an, m + ddx, y0, W - m + ddx, y0 + hz);
        const y0r = Math.round(y0), y1r = Math.round(y0 + hz);
        return {
          y0, st,
          bordes: st ? st.bordes : 0,
          alfa: veloNecesario(st, blancoRGB, C.velo.contraste_objetivo, veloRGB),
          izq: bordesMedia(an, m + ddx, y0r, (W >> 1) + ddx, y1r),
          der: bordesMedia(an, (W >> 1) + ddx, y0r, W - m + ddx, y1r),
          p10: st ? st.p10 : 0
        };
      };
      const fijo = LUGARES.includes(P.lugar) ? P.lugar : null;
      if (lugarOv || fijo) {
        lugar = lugarOv || fijo;
      } else {
        const V = C.vari;
        const pref = V.lugar_preferido === 'arriba' ? 'arriba' : 'abajo';
        const otro = pref === 'arriba' ? 'abajo' : 'arriba';
        cand[pref] = candidato(pref, 0, 0);
        cand[otro] = candidato(otro, 0, 0);
        const peor = cand[otro].bordes < cand[pref].bordes * V.cambiar_lugar_si.ratio_bordes &&
          cand[pref].alfa - cand[otro].alfa > V.cambiar_lugar_si.dif_velo;
        lugar = V.lugar_auto && peor ? otro : pref;
      }
      const base = cand[lugar] || candidato(lugar, 0, 0);
      const fijoA = ALINEAR.includes(P.alinear) ? P.alinear : null;
      if (alinearOv || fijoA) alinear = alinearOv || fijoA;
      else if (lugar === 'centro') alinear = 'centro';
      else alinear = C.vari.alineacion_auto && base.der < base.izq * (1 - C.vari.margen_lado_limpio) ? 'derecha' : 'izquierda';
      // zona real (con desplazamiento del usuario): de ella salen color y velo
      const z = (dx || dy) ? candidato(lugar, dx, dy) : base;
      zTop = z.y0; zBot = z.y0 + hz;
      if (colorOv) color = colorOv;
      else if (P.color && C.colores[P.color]) color = P.color;
      else color = (C.vari.texto_oscuro_en_foto_clara && z.p10 > 0.40 && z.bordes < 0.03) ? 'carbon' : 'blanco';
      if (veloOv !== null) velo = veloOv;
      else if (esOscuro(C, color)) velo = 0;
      else velo = clamp(z.alfa, C.velo.minimo, C.velo.maximo);
      velo = r2(velo);
      const franja = zonaStats(an, m, zona[0] + G.f0, W - m, zona[0] + G.f1);
      vTop = r2(clamp(veloNecesario(franja, blancoRGB, C.velo.contraste_objetivo, veloRGB), 0, 0.6));
      colMarca = vTop > 0 || !esOscuro(C, color) ? 'blanco' : 'carbon';
      if (lugar === 'abajo') colPie = color;
      else colPie = mejorTexto(C, zonaStats(an, 300, zona[1] - G.pie - G.p0, W - 300, zona[1] - G.pie + G.p1), 3.0).color;
      veloTop(ctx, W, veloRGB, vTop, zona[0], kv);
      veloLineal(ctx, W, H, veloRGB, velo, lugar, zTop, zBot, kv);
    } else if (tipo === 'portada') {
      lugar = lugarOv || (LUGARES.includes(P.lugar) ? P.lugar : 'abajo');
      alinear = alinearOv || (ALINEAR.includes(P.alinear) ? P.alinear : 'izquierda');
      zTop = topDe(lugar, lay.h) + dy; zBot = zTop + lay.h;
      velo = veloOv !== null ? r2(veloOv) : 0;
      if (colorOv) color = colorOv;
      else if (velo > 0) color = 'blanco';
      else {
        const xs = alinear === 'derecha' ? [300, W - m] : alinear === 'centro' ? [150, W - 150] : [m, W - 300];
        const mt = mejorTexto(C, zonaStats(an, xs[0] + dx, zTop, xs[1] + dx, zBot), num(P.contraste_min, 3));
        color = mt.color;
        if (mt.aviso) avisos.push(mt.aviso);
      }
      colMarca = mejorTexto(C, zonaStats(an, m, zona[0] + G.f0, W >> 1, zona[0] + G.f1), 3.0).color;
      veloLineal(ctx, W, H, veloRGB, velo, lugar, zTop, zBot, kv);
    } else { // reel
      const cp = P.capa;
      lugar = lugarOv || (LUGARES.includes(P.lugar) ? P.lugar : 'centro');
      alinear = alinearOv || (ALINEAR.includes(P.alinear) ? P.alinear : 'centro');
      zTop = topDe(lugar, lay.h) + dy; zBot = zTop + lay.h;
      const cy = (zTop + zBot) / 2, az = num(cp.alto_zona, 380);
      const st = zonaStats(an, m + dx, Math.round(cy) - (az >> 1), W - m + dx, Math.round(cy) + (az >> 1));
      velo = veloOv !== null ? veloOv : clamp(veloNecesario(st, blancoRGB, num(cp.contraste, 4.5), veloRGB), num(cp.velo_min, 0.25), num(cp.velo_max, 0.6));
      velo = r2(velo);
      color = colorOv || 'blanco';
      veloRadial(ctx, W, H, veloRGB, velo, W / 2 + dx, cy, cp.elipse || [90, 30]);
    }

    // 3. marca, página y pie
    const yBarra = zona[0] + G.barra;
    const lhE = estilo(C, 'etiqueta', fe).lh;
    if (P.marca && colMarca) pintarEtiqueta(ctx, C, kit.marca || kit.cliente || '', m, yBarra, 'izquierda', colMarca, fe);
    if (P.pagina && esNum(opts.pagina)) pintarEtiqueta(ctx, C, String(Math.round(opts.pagina)).padStart(2, '0'), W - m, yBarra, 'derecha', colMarca || 'blanco', fe);
    if (P.pie && lleno(opts.serie)) pintarEtiqueta(ctx, C, opts.serie, W / 2, zona[1] - G.pie - lhE, 'centro', colPie || 'blanco', fe);

    // 4. texto
    const top = topDe(lugar, lay.h) + dy;
    ctx.fillStyle = colorHex(C, color);
    let minX = Infinity, maxX = -Infinity;
    for (const it of lay.items) {
      for (let i = 0; i < it.lineas.length; i++) {
        const ln = it.lineas[i], w = ln.w;
        const x = alinear === 'derecha' ? W - m + dx - w : alinear === 'centro' ? W / 2 + dx - w / 2 : m + dx;
        pintarLinea(ctx, it.est, ln, x, top + it.y + i * it.est.lh);
        if (ln.t) { minX = Math.min(minX, x); maxX = Math.max(maxX, x + w); }
      }
    }
    if (minX === Infinity) {
      const x = alinear === 'derecha' ? W - m + dx : alinear === 'centro' ? W / 2 + dx : m + dx;
      minX = maxX = x;
    }
    ctx.restore();

    // aviso si el bloque se sale del lienzo, de la zona segura del grid (9:16) o pisa la barra de marca o el pie
    if (lay.h > 0) {
      const arribaMin = Math.max(0, zona[0], P.marca || P.pagina ? yBarra + lhE : 0);
      const abajoMax = Math.min(H, zona[1], P.pie && lleno(opts.serie) ? zona[1] - G.pie - lhE : H);
      if (minX < -0.5 || maxX > W + 0.5 || top < arribaMin - 0.5 || top + lay.h > abajoMax + 0.5) {
        avisos.push(tipo === 'reel'
          ? 'el texto no cabe: se sale de la zona visible del perfil (acórtalo, baja la escala o muévelo)'
          : 'el texto no cabe: se sale o pisa la marca o el pie (acórtalo, baja la escala o muévelo)');
      }
    }

    return {
      decision: { lugar, alinear, velo, color, velo_top: vTop },
      bloque: { x: minX, y: top, w: maxX - minX, h: lay.h },
      avisos
    };
  }
  // ---------------------------------------------------------------- atajos
  async function render(kit, slide, bitmap, rect, opts) {
    opts = opts || {};
    const bw = bitmap.width || bitmap.naturalWidth, bh = bitmap.height || bitmap.naturalHeight;
    const srcW = opts.srcW || (rect ? rect.w : bw), srcH = opts.srcH || (rect ? rect.h : bh);
    const fmt = opts.fmt || (slide && slide.tipo === 'reel' ? 'r916' : 'v45');
    const t = tamano(kit, fmt, srcW, srcH);
    if (typeof document !== 'undefined' && document.fonts) await document.fonts.ready;
    const capa = capaFoto(bitmap, rect || rectCover(bw, bh, t.W, t.H, 0.5, 0.5), t.W, t.H);
    const canvas = nuevoCanvas(t.W, t.H);
    const ctx = canvas.getContext('2d');
    const r = dibujar(ctx, kit, capa, slide, { W: t.W, H: t.H, factor: t.factor, pagina: opts.pagina, serie: opts.serie });
    return { canvas, decision: r.decision, bloque: r.bloque, avisos: r.avisos };
  }

  function aBlob(canvas, calidad) {
    const q = esNum(calidad) ? calidad : 0.92;
    if (canvas.convertToBlob && !canvas.toBlob) return canvas.convertToBlob({ type: 'image/jpeg', quality: q });
    return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo exportar la imagen'))), 'image/jpeg', q));
  }

  global.DisenoMotor = {
    version: VERSION,
    cargarKit, usarKit, tamano, capaFoto, dibujar, render, aBlob,
    // uso interno y pruebas
    _interno: { rectCover, zonaStats, bordesMedia, veloNecesario, mejorTexto, contraste, partir, estilo, conf, analizarPixeles, prepararParrafo, voraz }
  };
})(typeof window !== 'undefined' ? window : globalThis);
