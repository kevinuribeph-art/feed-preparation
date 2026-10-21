/*
 * Motor de diseño de la Mesa de trabajo: carruseles (portada, fichas, final) y portadas de reel.
 * Script plano para navegador (ES2020, sin módulos ni dependencias). Define window.DisenoMotor.
 *
 *   DisenoMotor.version                                   '1.2'
 *   DisenoMotor.cargarKit(url)                         -> Promise<kit>
 *   DisenoMotor.usarKit(kitObj, baseUrl)               -> Promise<kit>
 *   DisenoMotor.tamano(kit, fmt, srcW, srcH)           -> {W, H, factor}
 *   DisenoMotor.capaFoto(bitmap, rect, W, H)           -> {canvas, an, origen}
 *   DisenoMotor.dibujar(ctx, kit, capa, slide, opts)   -> {decision, bloque, avisos, avisosInfo, lineas}
 *   DisenoMotor.render(kit, slide, bitmap, rect, opts) -> Promise<{canvas, decision, bloque, avisos, avisosInfo}>
 *   DisenoMotor.aBlob(canvas, calidad = 0.92)          -> Promise<Blob>
 *
 * Reglas de colocación, velo y color: las del motor de referencia (motor.py) aprobado por el cliente,
 * con las reglas de pieza del kit (kit.piezas). El análisis caro de la foto se hace una vez en capaFoto;
 * dibujar solo consulta zonas (con caché) y por eso se puede llamar en cada pulsación.
 *
 * Criterios (v1.1, tras la QA de estrés):
 *  - Contraste: cada texto se mide contra su fondo REAL (foto + velos) en el rectángulo de sus líneas, con los
 *    percentiles 2 y 98 de luminancia (no se diluyen los focos pequeños). Aviso si < 3 en cualquier texto.
 *    El velo automático apunta a contraste_objetivo (4,5) con el color real del texto, se redondea hacia arriba
 *    y nunca deja un texto automático por debajo de 3 si el tope del velo lo permite.
 *  - Palabras: nunca se parte una palabra que cabe; si una sola no cabe en el ancho máximo, se parte por
 *    grafemas con guion (en URLs, tras «/», «.» o «-») y se avisa. No se separan «2,80 €», «10 %», «« x»»…
 *  - Líneas: si la tinta de dos líneas seguidas queda a menos de 1 px, la de abajo baja lo justo.
 */
(function (global) {
  'use strict';

  const VERSION = '1.2';
  const TIPOS = ['portada', 'ficha', 'final', 'reel'];
  // Alto mínimo de la zona analizada (y anclaje del velo) en px a factor 1: el de motor.py.
  const ALTO_ANALISIS = { ficha: 400, final: 480 };
  const AVISO_MIN = 3;        // contraste por debajo del cual se avisa (cualquier texto)
  const HUECO_LINEAS = 1;     // px mínimos de aire entre la tinta de dos líneas seguidas

  // ---------------------------------------------------------------- utilidades
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r2 = (v) => Math.round(v * 100) / 100;
  const c2 = (v) => Math.ceil(v * 100 - 1e-6) / 100;     // redondeo hacia arriba (velos)
  const lu = (v) => Math.floor(v * 64) / 64;            // LayoutUnit de CSS (1/64 px)
  const esNum = (v) => typeof v === 'number' && isFinite(v);
  const num = (v, d) => (esNum(v) ? v : d);
  const lleno = (t) => typeof t === 'string' && t.trim() !== '';
  const EPS = 0.01;

  function nuevoCanvas(W, H) {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      return c;
    }
    return new OffscreenCanvas(W, H);
  }

  const SEG = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('es', { granularity: 'grapheme' }) : null;
  const grafemas = (t) => (SEG ? Array.from(SEG.segment(t), (s) => s.segment) : Array.from(t));

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
  const LIN4 = new Float64Array(1021);
  for (let i = 0; i < 1021; i++) LIN4[i] = linf(i / 4);
  function hex2rgb(h) {
    h = String(h || '').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (!isFinite(n)) return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const ratio = (la, lb) => (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  function contraste(a, b) { return ratio(lumRGB(a), lumRGB(b)); }
  function mezcla(c, v, a) { return [c[0] + (v[0] - c[0]) * a, c[1] + (v[1] - c[1]) * a, c[2] + (v[2] - c[2]) * a]; }
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
      fuentes: k.fuentes || {},
      nombres: k._nombres || {}
    };
  }
  function colorHex(C, key) {
    if (C.colores[key]) return C.colores[key];
    if (key === 'blanco') return '#FFFFFF';
    if (key === 'carbon') return C.velo.color || '#393732';
    return '#FFFFFF';
  }
  function esOscuro(C, key) { return lumRGB(hex2rgb(colorHex(C, key))) < 0.179; }
  // Fondo del lienzo bajo la foto (PNG con transparencia, lienzo reutilizado): blanco, como al subir y al
  // exportar en la mesa; solo si el kit define colores.fondo se usa ese.
  function colorFondo(C) { return C.colores.fondo || '#FFFFFF'; }

  // ---------------------------------------------------------------- fuentes
  // Cada (familia, archivo) se registra con un nombre interno propio: dos kits con la misma familia y archivos
  // distintos no se pisan, y las cachés de anchos van por ese nombre. Las fuentes variables se registran con
  // el rango real del eje wght (peso 700 = el 700 de la fuente, no negrita sintética).
  const cacheKits = new Map();
  const REG = new Map();   // familia|url absoluta -> {nombre, promesa}
  const REL = new Map();   // familia|archivo (tal cual en el kit) -> nombre interno (último registrado)
  let nReg = 0;

  function urlAbs(u, base) {
    const b = base || (typeof document !== 'undefined' ? document.baseURI : (global.location && global.location.href));
    return new URL(u, b).href;
  }

  // Lee la cabecera sfnt: ¿es una fuente? ¿tiene eje wght (fvar)? Devuelve {valida, wght:[min,max]|null}.
  function infoFuente(buf) {
    try {
      const dv = new DataView(buf);
      if (buf.byteLength < 12) return { valida: false };
      const tag = dv.getUint32(0);
      const leerFvar = (off) => {
        const axOff = dv.getUint16(off + 4), n = dv.getUint16(off + 8), sz = dv.getUint16(off + 10);
        for (let i = 0; i < n; i++) {
          const a = off + axOff + i * sz;
          if (dv.getUint32(a) === 0x77676874) return [dv.getInt32(a + 4) / 65536, dv.getInt32(a + 12) / 65536]; // 'wght'
        }
        return null;
      };
      if (tag === 0x00010000 || tag === 0x4F54544F || tag === 0x74727565) { // TrueType, 'OTTO', 'true'
        const n = dv.getUint16(4);
        for (let i = 0; i < n; i++) {
          const r = 12 + 16 * i;
          if (dv.getUint32(r) === 0x66766172) return { valida: true, wght: leerFvar(dv.getUint32(r + 8)) }; // 'fvar'
        }
        return { valida: true, wght: null };
      }
      if (tag === 0x774F4646) { // 'wOFF'
        const n = dv.getUint16(12);
        for (let i = 0; i < n; i++) {
          const r = 44 + 20 * i;
          if (dv.getUint32(r) === 0x66766172) {
            const off = dv.getUint32(r + 4), comp = dv.getUint32(r + 8), orig = dv.getUint32(r + 12);
            return { valida: true, wght: comp === orig ? leerFvar(off) : [1, 1000] };
          }
        }
        return { valida: true, wght: null };
      }
      if (tag === 0x774F4632 || tag === 0x74746366) return { valida: true, wght: null }; // 'wOF2', 'ttcf'
      return { valida: false };
    } catch (e) {
      return { valida: false };
    }
  }

  function registrarFuente(f, base, pesos) {
    const url = urlAbs(f.archivo, base);
    const key = f.familia + '|' + url;
    let reg = REG.get(key);
    if (!reg) {
      const nombre = `${String(f.familia).replace(/["\\]/g, '')} ·${++nReg}`;
      reg = { nombre };
      reg.promesa = (async () => {
        let r;
        try { r = await fetch(url, { cache: 'reload' }); } catch (e) { r = null; }
        if (!r || !r.ok) throw new Error(`No se encuentra el archivo de fuente ${f.archivo} del kit`);
        const buf = await r.arrayBuffer();
        const info = infoFuente(buf);
        if (!info.valida) throw new Error(`${f.archivo} no es una fuente válida`);
        const pmin = Math.min(...pesos), pmax = Math.max(...pesos);
        const weight = info.wght ? `${Math.round(info.wght[0])} ${Math.round(info.wght[1])}` : (pmin === pmax ? String(pmin) : `${pmin} ${pmax}`);
        let face;
        try {
          face = new FontFace(reg.nombre, buf, { weight, style: 'normal' });
          await face.load();
        } catch (e) {
          throw new Error(`${f.archivo} no es una fuente válida`);
        }
        document.fonts.add(face);
        return face;
      })();
      reg.promesa.catch(() => { if (REG.get(key) === reg) REG.delete(key); });
      REG.set(key, reg);
    }
    REL.set(f.familia + '|' + f.archivo, reg.nombre);
    return reg;
  }

  async function usarKit(kitObj, baseUrl) {
    if (!kitObj || typeof kitObj !== 'object') throw new Error('Kit no válido');
    const base = urlAbs(baseUrl || '.');
    Object.defineProperty(kitObj, '_base', { value: base, enumerable: false, configurable: true, writable: true });
    const fuentes = kitObj.fuentes || {};
    // pesos pedidos por archivo (para registrar una fuente estática con su peso, o su rango si se usa con varios)
    const pesos = new Map();
    for (const id of Object.keys(fuentes)) {
      const f = fuentes[id];
      if (!f || !f.familia || !f.archivo) continue;
      const k = f.familia + '|' + f.archivo;
      if (!pesos.has(k)) pesos.set(k, []);
      pesos.get(k).push(f.peso || 400);
    }
    const nombres = {}, tareas = [];
    for (const id of Object.keys(fuentes)) {
      const f = fuentes[id];
      if (!f || !f.familia || !f.archivo) continue;
      const reg = registrarFuente(f, base, pesos.get(f.familia + '|' + f.archivo));
      nombres[id] = reg.nombre;
      tareas.push(reg.promesa);
    }
    await Promise.all(tareas);
    Object.defineProperty(kitObj, '_nombres', { value: nombres, enumerable: false, configurable: true, writable: true });
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

  // Familia genérica de reserva para glifos que la fuente del kit no tiene (campo opcional «generica»).
  function genericaDe(f) {
    if (f && f.generica) return f.generica;
    const t = `${(f && f.familia) || ''} ${(f && f.archivo) || ''}`.toLowerCase();
    if (/sans|grotesk|grotesque|gothic/.test(t)) return 'sans-serif';
    if (/mono/.test(t)) return 'monospace';
    if (/serif|newsreader|playfair|garamond|cormorant|lora|merriweather|baskerville|bodoni|didot|caslon|georgia|times|abril|fraunces|spectral|crimson|tinos|minion/.test(t)) return 'serif';
    return 'sans-serif';
  }
  function nombreFuente(C, id) {
    const f = C.fuentes[id] || {};
    return C.nombres[id] || (f.familia && f.archivo && REL.get(f.familia + '|' + f.archivo)) || f.familia || 'sans-serif';
  }

  // ---------------------------------------------------------------- formatos
  function tamano(kit, fmt, srcW, srcH) {
    const F = (kit && kit.formatos) || {};
    const ancho = (F[fmt] && F[fmt].ancho) || 1080;
    if (fmt === 'h') {
      const f = Object.assign({ ancho: 1080, ratio_max: 1.91, ratio_vertical: 1.7778, factor_tipografia: 0.72 }, F.h || {});
      let rt = srcW / srcH;
      if (!(rt >= 1)) rt = f.ratio_vertical;
      rt = Math.min(rt, f.ratio_max);
      // hacia arriba: nunca más apaisado que el máximo de Instagram (1080x566) ni que la foto (16:9 → 608)
      return { W: f.ancho, H: Math.ceil(f.ancho / rt - 1e-3), factor: f.factor_tipografia };
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

  // Píxeles con transparencia compuestos sobre un color (la foto se ve así una vez dibujada sobre el fondo).
  function sobreFondo(px, hex) {
    const f = hex2rgb(hex), out = new Uint8ClampedArray(px.length);
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3] / 255;
      out[i] = px[i] * a + f[0] * (1 - a);
      out[i + 1] = px[i + 1] * a + f[1] * (1 - a);
      out[i + 2] = px[i + 2] * a + f[2] * (1 - a);
      out[i + 3] = 255;
    }
    return out;
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
      const px = ctx.getImageData(0, 0, W, H).data;
      let alfa = false;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 255) { alfa = true; break; }
      if (alfa) {
        an = analizarPixeles(sobreFondo(px, '#FFFFFF'), W, H);
        an.conAlfa = true; an.crudo = px; an.fondo = '#FFFFFF';
      } else {
        an = analizarPixeles(px, W, H);
      }
    } catch (e) {
      an = null; // lienzo contaminado (foto de otro origen sin CORS): se dibuja sin análisis
    }
    // origen: píxeles de la foto que se usan (para avisar de fotos pequeñas o con mucho zoom)
    return { canvas, an, origen: { w: r.w, h: r.h, bw, bh } };
  }

  // Análisis de la foto tal como queda sobre el fondo del kit (solo cambia si la foto tiene transparencia).
  function analisisDe(capa, fondo) {
    if (!capa || !capa.an) return null;
    const an = capa.an;
    if (!an.conAlfa || an.fondo === fondo) return an;
    capa._anFondo = capa._anFondo || {};
    if (!capa._anFondo[fondo]) {
      const a2 = analizarPixeles(sobreFondo(an.crudo, fondo), an.W, an.H);
      a2.conAlfa = true; a2.crudo = an.crudo; a2.fondo = fondo;
      capa._anFondo[fondo] = a2;
    }
    return capa._anFondo[fondo];
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

  // Alfa mínimo del velo para que el texto llegue al contraste objetivo sobre un color de fondo.
  function alfaPara(claro, textoRGB, objetivo, veloRGB) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 20; i++) {
      const a = (lo + hi) / 2;
      if (contraste(textoRGB, mezcla(claro, veloRGB, a)) >= objetivo) hi = a; else lo = a;
    }
    return hi;
  }
  // Alfa mínimo del velo para que el texto llegue al contraste objetivo sobre lo más claro de la zona.
  function veloNecesario(st, textoRGB, objetivo, veloRGB) {
    return st ? alfaPara(st.claro, textoRGB, objetivo, veloRGB) : 0;
  }

  // ---------------------------------------------------------------- velos (capas) y fondo real
  // Capa lineal: {tipo:'lin', y0, y1, stops:[[t, alfa]…]} pintada en y0..y1 (fuera, alfa 0).
  // Capa radial: {tipo:'rad', cx, cy, rx, ry, stops} (elipse; fuera del radio, el último alfa).
  function alfaStops(st, t) {
    if (t <= st[0][0]) return st[0][1];
    for (let i = 1; i < st.length; i++) {
      if (t <= st[i][0]) {
        const a = st[i - 1], b = st[i];
        return b[0] > a[0] ? a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]) : b[1];
      }
    }
    return st[st.length - 1][1];
  }
  function alfaCapa(c, x, y) {
    if (c.tipo === 'lin') return (y + 0.5 < c.y0 || y + 0.5 >= c.y1) ? 0 : alfaStops(c.stops, (y + 0.5 - c.y0) / (c.y1 - c.y0));
    const u = (x + 0.5 - c.cx) / c.rx, v = (y + 0.5 - c.cy) / c.ry;
    return alfaStops(c.stops, Math.sqrt(u * u + v * v));
  }
  function pintarCapa(ctx, W, H, rgb, c) {
    if (!c) return;
    if (c.tipo === 'lin') {
      if (!(c.y1 > c.y0)) return;
      const g = ctx.createLinearGradient(0, c.y0, 0, c.y1);
      for (const [t, a] of c.stops) g.addColorStop(t, rgba(rgb, a));
      ctx.fillStyle = g; ctx.fillRect(0, c.y0, W, c.y1 - c.y0);
    } else {
      ctx.save();
      ctx.translate(c.cx, c.cy);
      ctx.scale(c.rx, c.ry);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const [t, a] of c.stops) g.addColorStop(t, rgba(rgb, a));
      ctx.fillStyle = g;
      ctx.fillRect(-c.cx / c.rx, -c.cy / c.ry, W / c.rx, H / c.ry);
      ctx.restore();
    }
  }
  function capaBloque(lugar, a, zTop, zBot, bTop, bBot, H, kv) {
    if (!(a > 0)) return null;
    const R1 = 260 * kv, R2 = 80 * kv;
    // el alfa calculado se alcanza como tarde en el borde del bloque (bloques altos: la primera línea también)
    if (lugar === 'abajo') {
      const t = Math.max(0, zTop - R1);
      if (t >= H) return null;
      return { tipo: 'lin', y0: t, y1: H, stops: [[0, 0], [clamp((Math.min(zTop + R2, bTop) - t) / (H - t), 0, 1), a], [1, a]] };
    }
    if (lugar === 'arriba') {
      const b = Math.min(H, zBot + R1);
      if (b <= 0) return null;
      return { tipo: 'lin', y0: 0, y1: b, stops: [[0, a], [clamp(Math.max(zBot - R2, bBot) / b, 0, 1), a], [1, 0]] };
    }
    const t = Math.max(0, zTop - R1), b = Math.min(H, zBot + R1);
    if (b <= t) return null;
    const s1 = clamp((Math.min(zTop + R2, bTop) - t) / (b - t), 0, 1), s2 = clamp((Math.max(zBot - R2, bBot) - t) / (b - t), s1, 1);
    return { tipo: 'lin', y0: t, y1: b, stops: [[0, 0], [s1, a], [s2, a], [1, 0]] };
  }
  // Velo de la portada de reel: más oscuro en el centro (el del título) y más claro hacia los bordes, de forma muy suave
  // y homogénea (elipse con la forma del lienzo; la curva llega plana al final, así que no se ve ningún círculo ni
  // borde); al 100 % toda la foto queda del color del velo por igual.
  function capaReel(a, cx, cy, W, H) {
    if (!(a > 0)) return null;
    const rx = Math.max(cx, W - cx) * Math.SQRT2, ry = Math.max(cy, H - cy) * Math.SQRT2, N = 24, stops = [];
    for (let i = 0; i <= N; i++) { const t = i / N, sv = t * t * (3 - 2 * t); stops.push([t, a * (1 - (1 - a) * sv)]); }
    return { tipo: 'rad', cx, cy, rx, ry, stops };
  }
  function capaTop(a, y0, alto) {
    return a > 0 ? { tipo: 'lin', y0, y1: y0 + alto, stops: [[0, a], [1, 0]] } : null;
  }

  // Fondo real de unos rectángulos (foto + velos, en el orden en que se pintan): percentiles 2 y 98 de
  // luminancia y color medio por encima del p98 / por debajo del p2.
  let COMP = new Float32Array(3 << 16);
  function fondoStats(an, rects, capas, V) {
    if (!an) return null;
    const W = an.W, H = an.H, px = an.px;
    const rs = [];
    let area = 0;
    for (const r of rects) {
      const x0 = clamp(Math.floor(r[0]), 0, W), x1 = clamp(Math.ceil(r[2]), 0, W);
      const y0 = clamp(Math.floor(r[1]), 0, H), y1 = clamp(Math.ceil(r[3]), 0, H);
      if (x1 > x0 && y1 > y0) { rs.push([x0, y0, x1, y1]); area += (x1 - x0) * (y1 - y0); }
    }
    if (!area) return null;
    const cs = (capas || []).filter(Boolean);
    // en caché por rectángulos y velos (se repite mucho al teclear y al arrastrar)
    const key = 'f' + rs.map((r) => r.join(',')).join(';') + '|' + JSON.stringify(cs) + '|' + V.join(',');
    const hit = an.cache.get(key);
    if (hit) return hit;
    const st = Math.max(1, Math.round(Math.sqrt(area / 25000)));   // ~25 000 muestras como mucho
    const maxN = Math.ceil(area / (st * st)) + rs.length * 4 + 16;
    if (BINS.length < maxN) BINS = new Uint16Array(maxN);
    if (COMP.length < maxN * 3) COMP = new Float32Array(maxN * 3);
    HIST.fill(0);
    let n = 0;
    for (const [x0, y0, x1, y1] of rs) {
      for (let y = y0; y < y1; y += st) {
        const fila = cs.map((c) => (c.tipo === 'lin' ? alfaCapa(c, 0, y) : -1));
        let i = (y * W + x0) * 4;
        for (let x = x0; x < x1; x += st, i += 4 * st) {
          let r = px[i], g = px[i + 1], b = px[i + 2];
          for (let k = 0; k < cs.length; k++) {
            const a = fila[k] >= 0 ? fila[k] : alfaCapa(cs[k], x, y);
            if (a > 0) { r += (V[0] - r) * a; g += (V[1] - g) * a; b += (V[2] - b) * a; }
          }
          const L = 0.2126 * LIN4[(r * 4 + 0.5) | 0] + 0.7152 * LIN4[(g * 4 + 0.5) | 0] + 0.0722 * LIN4[(b * 4 + 0.5) | 0];
          const bin = (L * 65535 + 0.5) | 0;
          BINS[n] = bin; HIST[bin]++;
          COMP[3 * n] = r; COMP[3 * n + 1] = g; COMP[3 * n + 2] = b;
          n++;
        }
      }
    }
    const k2 = Math.floor(0.02 * (n - 1)), k98 = Math.floor(0.98 * (n - 1));
    let cum = 0, b2 = -1, b98 = -1;
    for (let b = 0; b < 65536; b++) {
      cum += HIST[b];
      if (b2 < 0 && cum > k2) b2 = b;
      if (cum > k98) { b98 = b; break; }
    }
    let s98 = [0, 0, 0], n98 = 0, s2 = [0, 0, 0], n2 = 0;
    for (let j = 0; j < n; j++) {
      const bin = BINS[j];
      if (bin >= b98) { s98[0] += COMP[3 * j]; s98[1] += COMP[3 * j + 1]; s98[2] += COMP[3 * j + 2]; n98++; }
      if (bin <= b2) { s2[0] += COMP[3 * j]; s2[1] += COMP[3 * j + 1]; s2[2] += COMP[3 * j + 2]; n2++; }
    }
    const res = {
      L2: b2 / 65535, L98: b98 / 65535,
      c98: n98 ? s98.map((v) => v / n98) : [255, 255, 255],
      c2: n2 ? s2.map((v) => v / n2) : [0, 0, 0]
    };
    if (an.cache.size > 400) an.cache.clear();
    an.cache.set(key, res);
    return res;
  }
  // Contraste de un color de texto con el peor fondo (p2 o p98) de sus rectángulos.
  function contrasteSobre(textoRGB, fs) {
    if (!fs) return 21;
    const lt = lumRGB(textoRGB);
    return Math.min(ratio(lt, fs.L2), ratio(lt, fs.L98));
  }

  // ---------------------------------------------------------------- avisos
  function nuevosAvisos() {
    const lista = [], vistos = new Set();
    return {
      lista,
      add(tipo, elemento, mensaje, valor) {
        if (vistos.has(mensaje)) return;
        vistos.add(mensaje);
        lista.push(valor === undefined ? { tipo, elemento, mensaje } : { tipo, elemento, mensaje, valor });
      }
    };
  }

  // ---------------------------------------------------------------- tipografía
  // El texto se compone palabra a palabra (el canvas de Chromium ya da forma a cada palabra por separado) y
  // se añade el kerning de los pares «letra␣letra» que CSS sí aplica: así los anchos, cortes de línea y
  // posiciones coinciden con el texto HTML/CSS del motor de referencia.
  const TIENE_LS = (() => {
    try { const c = nuevoCanvas(1, 1).getContext('2d'); return 'letterSpacing' in c; } catch (e) { return false; }
  })();
  const cacheMedidas = new Map();
  const cacheAjustes = new Map();
  const cacheBases = new Map();

  function estilo(C, nivel, esc) {
    const s = C.escala[nivel] || { fuente: 'sans', px: 32, interlineado: 1.2, espaciado: 0 };
    const f = C.fuentes[s.fuente] || {};
    const px = s.px * esc;
    const peso = s.peso || f.peso || 400;
    return {
      nivel, px, peso, lh: lu(px * num(s.interlineado, 1.2)), ls: num(s.espaciado, 0) * px,
      font: `${peso} ${px}px "${nombreFuente(C, s.fuente)}", ${genericaDe(f)}`, mayus: !!s.mayusculas
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
  // Ancho de avance y tinta vertical (sobre/bajo la línea base) de un texto.
  function medida(est, t) {
    const k = est.font + '|' + est.ls + '|' + t;
    let m = cacheMedidas.get(k);
    if (m) return m;
    const ctx = ctxMedida();
    ponerFuente(ctx, est);
    const r = ctx.measureText(t);
    let w = r.width;
    if (!TIENE_LS) w += est.ls * Array.from(t).length;
    m = { w, asc: num(r.actualBoundingBoxAscent, est.px * 0.8), desc: num(r.actualBoundingBoxDescent, est.px * 0.2) };
    if (cacheMedidas.size > 20000) cacheMedidas.clear();
    cacheMedidas.set(k, m);
    return m;
  }
  function ancho(_ctx, est, t) { return medida(est, t).w; }

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

  // ---- dirección del texto (hebreo, árabe): orden visual por palabras, como el algoritmo bidi del navegador
  const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  const LETRA_RE = /\p{L}/u;
  function dirPalabra(p) {
    for (const ch of p) {
      if (RTL_RE.test(ch)) return 'rtl';
      if (LETRA_RE.test(ch)) return 'ltr';
      if (ch >= '0' && ch <= '9') return 'num';
    }
    return 'neutro';
  }
  function dirParrafo(palabras) {
    for (const p of palabras) { const d = dirPalabra(p); if (d === 'rtl' || d === 'ltr') return d; }
    return 'ltr';
  }
  // Devuelve null si la línea es toda de izquierda a derecha (caso normal), o {orden, dirs}.
  function ordenVisual(pal, base) {
    const dirs = pal.map(dirPalabra);
    if (base !== 'rtl' && !dirs.includes('rtl')) return null;
    const b = base === 'rtl' ? 1 : 0;
    const lv = dirs.map((d) => (d === 'rtl' ? 1 : d === 'ltr' ? (b ? 2 : 0) : d === 'num' ? (b ? 2 : -1) : -1));
    for (let i = 0; i < lv.length; i++) {
      if (lv[i] >= 0) continue;
      let p = i - 1; while (p >= 0 && lv[p] < 0 && dirs[p] !== 'num') p--;
      let q = i + 1; while (q < lv.length && lv[q] < 0) q++;
      const lp = p >= 0 ? lv[p] : b, lq = q < lv.length ? lv[q] : b;
      lv[i] = dirs[i] === 'num' ? (lp === 1 ? 2 : b) : (lp === lq ? lp : b);
    }
    const orden = pal.map((_, i) => i);
    const maxL = Math.max(...lv);
    for (let L = maxL; L >= 1; L--) {
      let i = 0;
      while (i < orden.length) {
        if (lv[orden[i]] >= L) {
          let j = i;
          while (j < orden.length && lv[orden[j]] >= L) j++;
          const tramo = orden.slice(i, j).reverse();
          for (let k = i; k < j; k++) orden[k] = tramo[k - i];
          i = j;
        } else i++;
      }
    }
    return { orden, dirs };
  }

  // Párrafo preparado: anchos de palabra y de cada hueco (espacio + kerning del par), sumas acumuladas.
  // rompible[i] = se puede cortar entre la palabra i y la i+1 (los pegados no se separan);
  // sinEsp[i] = entre ellas no hay espacio (chino, japonés, emojis seguidos).
  function prepararParrafo(ctx, est, palabras, rompible, base, sinEsp) {
    const N = palabras.length;
    const ww = palabras.map((p) => ancho(ctx, est, p));
    const sp = ancho(ctx, est, ' ');
    const dir = base || dirParrafo(palabras);
    const pw = new Float64Array(N + 1), pg = new Float64Array(N);
    for (let i = 0; i < N; i++) pw[i + 1] = pw[i] + ww[i];
    for (let i = 0; i < N - 1; i++) {
      const a = Array.from(palabras[i]), b = Array.from(palabras[i + 1]);
      pg[i + 1] = pg[i] + (sinEsp && sinEsp[i] ? 0 : sp + ajustePar(ctx, est, a[a.length - 1], b[0]));
    }
    const anchoR = (i, j) => (pw[j] - pw[i]) + (j - i > 1 ? pg[j - 1] - pg[i] : 0);
    const linea = (i, j) => {
      const pal = palabras.slice(i, j), xs = [];
      let asc = 0, desc = 0;
      for (let k = i; k < j; k++) {
        xs.push(anchoR(i, k + 1) - ww[k]);
        const m = medida(est, palabras[k]);
        asc = Math.max(asc, m.asc); desc = Math.max(desc, m.desc);
      }
      const w = anchoR(i, j);
      let t = pal[0] || '';
      for (let k = 1; k < pal.length; k++) t += (sinEsp && sinEsp[i + k - 1] ? '' : ' ') + pal[k];
      const ln = { t, palabras: pal, xs, w, asc, desc, vis: null };
      const ov = ordenVisual(pal, dir);
      if (ov) {
        // posiciones de izquierda a derecha en orden visual, con los mismos huecos
        const hueco = (a, b) => (Math.abs(a - b) === 1 ? xs[Math.max(a, b)] - xs[Math.min(a, b)] - ww[i + Math.min(a, b)] : (sinEsp && sinEsp[i + Math.min(a, b)] ? 0 : sp));
        const pos = new Array(pal.length);
        let x = 0;
        for (let v = 0; v < ov.orden.length; v++) {
          const k = ov.orden[v];
          pos[k] = x;
          x += ww[i + k] + (v < ov.orden.length - 1 ? hueco(k, ov.orden[v + 1]) : 0);
        }
        ln.vis = { pos, dirs: ov.dirs };
      }
      return ln;
    };
    return { N, palabras, anchoR, linea, rompible: rompible || null, sinEsp: sinEsp || null };
  }

  // Corte voraz de CSS; solo en huecos rompibles: un tramo pegado se trata como una palabra (si no cabe en la
  // línea, se desborda como con un espacio duro; partir() ya despega los tramos más anchos que la línea).
  function voraz(P, maxW) {
    const cortes = [];
    const corte = (j) => j >= P.N || !P.rompible || P.rompible[j - 1];
    let i = 0;
    while (i < P.N) {
      let j = i + 1;
      while (!corte(j)) j++;                                   // primera unidad entera, quepa o no
      for (let k = j + 1; k <= P.N; k++) {
        if (!corte(k)) continue;
        if (P.anchoR(i, k) <= maxW + EPS) j = k; else break;
      }
      cortes.push([i, j]);
      i = j;
    }
    return cortes;
  }

  // Corte equilibrado como text-wrap:balance de Chromium (contrastado con 389 casos reales, 388 iguales):
  //  - si alguna palabra no cabe en el ancho máximo: corte voraz, sin equilibrar;
  //  - con menos de 4 unidades: el ancho más estrecho que mantiene el número de líneas, y corte voraz a ese ancho;
  //  - si no (ScoreLineBreaker en modo balance): mismo número de líneas que el voraz, minimizando la suma de
  //    (ancho disponible − ancho de línea)², última línea incluida, + 10000 por dejar sola la última palabra.
  const PENAL_VIUDA = 10000, MAX_LINEAS_BALANCE = 6;
  function equilibrado(P, maxW) {
    const g = voraz(P, maxW);
    const n = g.length, N = P.N;
    if (n <= 1 || n > MAX_LINEAS_BALANCE) return g;
    const corte = (j) => j === N || !P.rompible || P.rompible[j - 1];
    // unidades (tramos que no se pueden separar)
    let unidades = 0, ultimo = 0, ini = 0;
    for (let j = 1; j <= N; j++) {
      if (!corte(j)) continue;
      if (P.anchoR(ini, j) > maxW + EPS) return g;
      unidades++;
      if (j < N) ultimo = j;
      ini = j;
    }
    if (unidades < 4) {
      let lo = 0, hi = maxW;
      for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; if (voraz(P, mid).length <= n) hi = mid; else lo = mid; }
      return voraz(P, hi);
    }
    const coste = [], prev = [];
    for (let k = 0; k <= n; k++) { coste.push(new Float64Array(N + 1).fill(Infinity)); prev.push(new Int32Array(N + 1).fill(-1)); }
    coste[0][0] = 0;
    for (let k = 1; k <= n; k++) {
      for (let j = k; j <= N; j++) {
        if (!corte(j)) continue;
        for (let i = j - 1; i >= k - 1; i--) {
          if (i > 0 && !corte(i)) continue;
          const w = P.anchoR(i, j);
          if (w > maxW + EPS) break;
          if (coste[k - 1][i] === Infinity) continue;
          const c = coste[k - 1][i] + (maxW - w) * (maxW - w) + (j === ultimo ? PENAL_VIUDA : 0);
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

  // ---- lo que no se separa: «2,80 €», «10 %», «« palabra»», «palabra »», separadores al principio de línea
  const NO_INICIO = /^[·—–€%‰»:;?!)\]}”’…]/;
  const APERTURA = /^[«¿¡(\[{“‘]+$/;
  const NUMERO = /^[+\-−]?\d[\d.,:'’]*$/;
  const UNIDADES = new Set(['€', '$', '£', '¥', '%', '‰', '°', 'º', '°c', 'ºc', '°f', 'km', 'm', 'cm', 'mm', 'kg', 'g', 'mg',
    'l', 'ml', 'cl', 'h', 'min', 's', 'km/h', 'm²', 'm2', 'm³', 'ha', 'x', 'pax', 'kb', 'mb', 'gb', 'tb', 'kcal', 'cal', 'kw', 'w', 'v']);
  function rompibles(toks) {
    const r = new Array(Math.max(0, toks.length - 1)).fill(true);
    for (let i = 0; i < toks.length - 1; i++) {
      const a = toks[i], b = toks[i + 1];
      if (NO_INICIO.test(b)) r[i] = false;
      else if (APERTURA.test(a) || (i === 0 && /^[—–]$/.test(a))) r[i] = false;
      else if (NUMERO.test(a) && UNIDADES.has(b.toLowerCase().replace(/[.,;:!?)»]+$/, ''))) r[i] = false;
    }
    return r;
  }

  // ---- sílabas en español (para partir una palabra que no cabe): V-CV, VC-CV salvo grupos inseparables,
  // VC-CCV / VCC-CV, sin separar diptongos ni triptongos; mínimo 2 letras a cada lado del corte.
  const VOCALES = new Set([...'aeiouáéíóúü']);
  const ABIERTAS = new Set([...'aeoáéó']), CERRADAS_TILDE = new Set([...'íú']);
  const INSEP = new Set(['pl', 'pr', 'bl', 'br', 'cl', 'cr', 'dr', 'tr', 'fl', 'fr', 'gl', 'gr', 'kl', 'kr']);
  const hiato = (a, b) => (ABIERTAS.has(a) && ABIERTAS.has(b)) || (CERRADAS_TILDE.has(a) && ABIERTAS.has(b)) || (ABIERTAS.has(a) && CERRADAS_TILDE.has(b));
  // s: letras en minúscula; devuelve los índices k donde puede empezar una sílaba (corte antes de s[k])
  function silabear(s) {
    const u = [];
    for (let i = 0; i < s.length;) {
      const c = s[i], d = s[i + 1], e = s[i + 2];
      if ((c === 'c' && d === 'h') || (c === 'l' && d === 'l') || (c === 'r' && d === 'r')) { u.push({ v: false, i, k: c + d }); i += 2; continue; }
      if ((c === 'q' || c === 'g') && d === 'u' && (e === 'e' || e === 'i' || e === 'é' || e === 'í')) { u.push({ v: false, i, k: c + 'u' }); i += 2; continue; }
      if (c === 'y') { u.push({ v: !(i + 1 < s.length && VOCALES.has(s[i + 1])) && i > 0, i, k: 'y' }); i++; continue; }
      u.push({ v: VOCALES.has(c), i, k: c }); i++;
    }
    const nuc = [];
    for (let j = 0; j < u.length; j++) {
      if (!u[j].v) continue;
      const n = nuc[nuc.length - 1];
      if (n && n.fin === j - 1 && !hiato(u[j - 1].k === 'y' ? 'i' : u[j - 1].k, u[j].k === 'y' ? 'i' : u[j].k)) n.fin = j;
      else nuc.push({ ini: j, fin: j });
    }
    const cortes = [];
    for (let n = 1; n < nuc.length; n++) {
      const a = nuc[n - 1].fin, b = nuc[n].ini, cs = u.slice(a + 1, b);
      let c;
      if (cs.length === 0) c = b;
      else if (cs.length === 1) c = a + 1;
      else if (cs.length === 2) c = INSEP.has(cs[0].k + cs[1].k) ? a + 1 : a + 2;
      else if (cs.length === 3) c = INSEP.has(cs[1].k + cs[2].k) ? a + 2 : a + 3;
      else c = a + 3;
      cortes.push(u[c].i);
    }
    return cortes;
  }
  const ES_LETRA = /^\p{L}/u;
  // Cortes silábicos permitidos en una lista de grafemas (en cada tramo de letras, con 2 letras a cada lado)
  function cortesSilabicos(g) {
    const out = new Set();
    for (let a = 0; a < g.length;) {
      if (!ES_LETRA.test(g[a])) { a++; continue; }
      let b = a;
      while (b < g.length && ES_LETRA.test(g[b])) b++;
      const s = g.slice(a, b).map((x) => x.normalize('NFC').toLowerCase());
      for (const k of silabear(s)) if (k >= 2 && s.length - k >= 2) out.add(a + k);
      a = b;
    }
    return out;
  }

  // ---- chino, japonés y emojis: se puede cortar entre caracteres, sin guion (con kinsoku básico)
  const CJK_RE = /[⺀-⿿　-〿぀-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿＀-￯]/;
  const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
  const NO_INICIO_CJK = new Set([...'、。，．・：；？！ー〜～…‥」』）】〕〉》｝］〟’”ゝゞヽヾ々〻ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ％‰°℃·»:;?!),.]}']);
  const NO_FIN_CJK = new Set([...'「『（【〔〈《｛［〝‘“«(¿¡[{']);
  const esIdeo = (c) => CJK_RE.test(c) || EMOJI_RE.test(c);
  // Devuelve los trozos de un token entre los que se puede cortar sin espacio, o null si no hay ninguno.
  function segmentosSinEspacio(tok) {
    const g = grafemas(tok);
    if (!g.some((c) => esIdeo(c) || c === '​')) return null;
    const segs = [];
    let cur = '';
    for (let k = 0; k < g.length; k++) {
      const c = g[k];
      if (c === '​') { if (cur) { segs.push(cur); cur = ''; } continue; }
      if (cur) {
        const p = Array.from(cur).length ? grafemas(cur).pop() : '';
        if ((esIdeo(p) || esIdeo(c)) && !NO_INICIO_CJK.has(c) && !NO_FIN_CJK.has(p)) { segs.push(cur); cur = ''; }
      }
      cur += c;
    }
    if (cur) segs.push(cur);
    return segs.length > 1 ? segs : null;
  }

  // ---- palabra que no cabe en el ancho útil: se parte por sílabas con guion (por grafemas si no hay sílaba
  // que quepa), en trozos parejos. Las URL se cortan primero tras / . - _ ? & = (sin guion).
  const SEP_URL = new Set(['/', '.', '-', '_', '?', '&', '=']);
  function trocearPalabra(est, p, maxW) {
    const g = grafemas(p), n = g.length;
    const sil = [...cortesSilabicos(g)].sort((a, b) => a - b);
    const pieza = (i, j) => g.slice(i, j).join('');
    const guion = (k) => (k < n && ES_LETRA.test(g[k - 1]) && ES_LETRA.test(g[k]) ? '-' : '');
    const cabe = (i, k, lim) => ancho(null, est, pieza(i, k) + guion(k)) <= lim + EPS;
    const corta = (lim) => {
      const out = [];
      let i = 0;
      while (i < n) {
        if (ancho(null, est, pieza(i, n)) <= lim + EPS) { out.push(pieza(i, n)); break; }
        let mejor = -1;
        for (const k of sil) { if (k <= i) continue; if (cabe(i, k, lim)) mejor = k; else break; }
        if (mejor < 0) for (let k = i + 1; k < n; k++) { if (cabe(i, k, lim)) mejor = k; else break; }
        if (mejor < 0) mejor = i + 1;
        out.push(pieza(i, mejor) + guion(mejor));
        i = mejor;
      }
      return out;
    };
    const base = corta(maxW);
    if (base.length <= 1) return base;
    let lo = 0, hi = maxW;
    for (let it = 0; it < 16; it++) { const mid = (lo + hi) / 2; if (corta(mid).length <= base.length) hi = mid; else lo = mid; }
    return corta(hi);
  }
  // Tramos que terminan en uno de los separadores (los separadores seguidos van juntos: «https://»)
  function tramosPor(p, seps) {
    const g = grafemas(p), out = [];
    let cur = '';
    for (let k = 0; k < g.length; k++) {
      cur += g[k];
      if (seps.has(g[k]) && !(k + 1 < g.length && seps.has(g[k + 1])) && k < g.length - 1) { out.push(cur); cur = ''; }
    }
    if (cur) out.push(cur);
    return out;
  }
  // Une piezas sin espacio en líneas de ancho ≤ lim, con las líneas lo más parejas posible
  function empaquetar(est, piezas, lim) {
    const pack = (w) => {
      const out = [];
      let cur = '';
      for (const q of piezas) {
        if (cur && ancho(null, est, cur + q) > w + EPS) { out.push(cur); cur = q; } else cur += q;
      }
      if (cur) out.push(cur);
      return out;
    };
    const base = pack(lim);
    if (base.length <= 1) return base;
    let lo = 0, hi = lim;
    for (let it = 0; it < 16; it++) { const mid = (lo + hi) / 2; if (pack(mid).length <= base.length) hi = mid; else lo = mid; }
    return pack(hi);
  }
  const SEP1 = new Set(['/']), SEP2 = new Set(['.', '-', '_', '?', '&', '=']);
  // URL o palabra compuesta: primero tras «/», luego tras . - _ ? & = y solo si un tramo no cabe, por sílabas
  function trocear(est, p, lim) {
    if (tramosPor(p, SEP_URL).length < 2) return trocearPalabra(est, p, lim);
    const cabe = (t) => ancho(null, est, t) <= lim + EPS;
    const out = [];
    let tanda = [];
    const vaciar = () => { if (tanda.length) out.push(...empaquetar(est, tanda, lim)); tanda = []; };
    for (const t1 of tramosPor(p, SEP1)) {
      if (cabe(t1)) { tanda.push(t1); continue; }
      vaciar();
      let t2s = [];
      for (const t2 of tramosPor(t1, SEP2)) {
        if (cabe(t2)) { t2s.push(t2); continue; }
        if (t2s.length) out.push(...empaquetar(est, t2s, lim));
        t2s = [];
        const tr = trocearPalabra(est, t2, lim);
        out.push(...tr.slice(0, -1));
        t2s.push(tr[tr.length - 1]);
      }
      if (t2s.length) out.push(...empaquetar(est, t2s, lim));
    }
    vaciar();
    return out;
  }

  // Texto → líneas [{t, palabras, xs, w, asc, desc, vis}]. '\n' fuerza salto (los del principio y el final se
  // ignoran); cada párrafo se equilibra dentro de maxW. Una palabra solo se parte si no cabe en «limite» (el
  // ancho útil del bloque); info.palabras recoge las que se han partido.
  function partir(ctx, est, texto, maxW, limite, info) {
    let t = String(texto).replace(/<br\s*\/?>/gi, '\n').replace(/\r\n?/g, '\n');
    if (est.mayus) t = t.toLocaleUpperCase('es-ES');
    const lim = Math.max(maxW, esNum(limite) ? limite : maxW);
    const pars = t.split('\n');
    while (pars.length && !pars[0].trim()) pars.shift();
    while (pars.length && !pars[pars.length - 1].trim()) pars.pop();
    const lineas = [];
    const vacia = { t: '', palabras: [], xs: [], w: 0, asc: 0, desc: 0, vis: null };
    for (const par of pars) {
      const limpio = par.replace(/[ \t]+/g, ' ').trim();
      if (!limpio) { lineas.push(vacia); continue; }
      const toks = limpio.split(' ');
      const rompe = rompibles(toks);
      // un tramo pegado más ancho que el ancho útil se despega (se podrá cortar entre sus palabras)
      for (let a = 0; a < toks.length;) {
        let b = a;
        while (b < toks.length - 1 && !rompe[b]) b++;
        const tramo = toks.slice(a, b + 1);
        if (b > a && !tramo.some((x) => ancho(ctx, est, x) > lim + EPS) && ancho(ctx, est, tramo.join(' ')) > lim + EPS) {
          for (let k = a; k < b; k++) rompe[k] = true;
        }
        a = b + 1;
      }
      const base = dirParrafo(toks);
      let grupo = [], gr = [], ge = [];
      const vaciar = () => {
        if (!grupo.length) return;
        const P = prepararParrafo(ctx, est, grupo, gr.slice(0, grupo.length - 1), base, ge.slice(0, grupo.length - 1));
        for (const [i, j] of equilibrado(P, maxW)) lineas.push(P.linea(i, j));
        grupo = []; gr = []; ge = [];
      };
      const meter = (p, rompible, sinEsp) => { grupo.push(p); gr.push(rompible); ge.push(sinEsp); };
      for (let i = 0; i < toks.length; i++) {
        const sig = i < toks.length - 1 ? rompe[i] : true;
        const segs = segmentosSinEspacio(toks[i]) || [toks[i]];
        for (let s = 0; s < segs.length; s++) {
          const p = segs[s], ultimo = s === segs.length - 1;
          if (ancho(ctx, est, p) <= lim + EPS) { meter(p, ultimo ? sig : true, !ultimo); continue; }
          if (info) info.palabras.add(p);
          const trozos = trocear(est, p, lim);   // los trozos pueden usar todo el ancho útil
          meter(trozos[0], true, false);
          vaciar();
          for (let k = 1; k < trozos.length - 1; k++) lineas.push(prepararParrafo(ctx, est, [trozos[k]], null, base).linea(0, 1));
          if (trozos.length > 1) meter(trozos[trozos.length - 1], ultimo ? sig : true, !ultimo);
        }
      }
      vaciar();
    }
    return lineas;
  }

  // Bloque de texto: [{est, lineas, tops, y (relativa), h}], alto total. col: columna visible (portada horizontal).
  function maquetar(ctx, C, items, esc, factor, W, col, info) {
    const L = C.L;
    const disp = Math.max(10, col ? col.w - 2 * col.m : W - 2 * L.margen);
    const res = [];
    let y = 0;
    for (const it of items) {
      const est = estilo(C, it.nivel, esc);
      const maxW = Math.min(disp, (it.nivel === 'texto' ? L.ancho_max_texto : L.ancho_max_titulo) * factor);
      const lineas = partir(ctx, est, it.texto, maxW, disp, info);
      if (!lineas.length) continue;
      if (res.length) y += it.gap * esc;
      const tops = lineas.map((_, i) => i * est.lh);
      const h = lineas.length * est.lh;
      res.push({ est, lineas, tops, y, h, nivel: it.nivel });
      y += h;
    }
    return { items: res, h: y };
  }

  // ---- líneas que se tocan: perfil de tinta por columna de cada línea (render real, en caché)
  const cachePerfiles = new Map();
  let LIENZO_PERFIL = null;
  function perfilLinea(est, ln) {
    const k = est.font + '|' + est.ls + '|' + ln.t + '|' + ln.xs.map((v) => v.toFixed(2)).join(',');
    let p = cachePerfiles.get(k);
    if (p) return p;
    const PAD = 4;
    const w = Math.max(1, Math.ceil(ln.w + 2 * PAD)), a = Math.ceil(ln.asc + PAD), h = Math.max(1, a + Math.ceil(ln.desc + PAD));
    if (!LIENZO_PERFIL) LIENZO_PERFIL = nuevoCanvas(8, 8);
    const cv = LIENZO_PERFIL;
    if (cv.width < w) cv.width = w;
    if (cv.height < h) cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    estadoTexto(ctx);
    ctx.fillStyle = '#000';
    pintarLinea(ctx, est, ln, PAD, a - lineaBase(ctx, est), true);
    const d = ctx.getImageData(0, 0, w, h).data;
    const top = new Float32Array(w).fill(Infinity), bot = new Float32Array(w).fill(-Infinity);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] >= 64) {
          if (y - a < top[x]) top[x] = y - a;
          if (y + 1 - a > bot[x]) bot[x] = y + 1 - a;
        }
      }
    }
    p = { x0: -PAD, top, bot };
    if (cachePerfiles.size > 400) cachePerfiles.clear();
    cachePerfiles.set(k, p);
    return p;
  }
  // Baja cada línea lo justo para que su tinta no quede a menos de HUECO_LINEAS de la de arriba (los huecos
  // entre bloques de texto se conservan). xRel(w): x de una línea de ancho w respecto al ancla de alineación.
  function espaciarLineas(lay, xRel) {
    const gaps = lay.items.map((it, n) => (n === 0 ? it.y : it.y - (lay.items[n - 1].y + lay.items[n - 1].h)));
    let y = 0;
    lay.items.forEach((it, n) => {
      const lh = it.est.lh;
      for (let i = 1; i < it.lineas.length; i++) {
        const A = it.lineas[i - 1], B = it.lineas[i];
        it.tops[i] = it.tops[i - 1] + lh;
        if (!A.t || !B.t || lh - A.desc - B.asc >= HUECO_LINEAS) continue; // las cajas de tinta ni se acercan
        const pa = perfilLinea(it.est, A), pb = perfilLinea(it.est, B);
        const xa = xRel(A.w) + pa.x0, xb = xRel(B.w) + pb.x0;
        let minD = Infinity;
        for (let c = 0; c < pa.bot.length; c++) {
          const ba = pa.bot[c];
          if (ba === -Infinity) continue;
          for (let d = -1; d <= 1; d++) {
            const cb = Math.round(xa + c + d - xb);
            if (cb < 0 || cb >= pb.top.length || pb.top[cb] === Infinity) continue;
            const dist = lh + pb.top[cb] - ba;
            if (dist < minD) minD = dist;
          }
        }
        if (minD < HUECO_LINEAS) it.tops[i] += Math.ceil(HUECO_LINEAS - minD);
      }
      it.h = it.tops[it.tops.length - 1] + lh;
      it.y = n === 0 ? gaps[0] : y + gaps[n];
      y = it.y + it.h;
    });
    lay.h = y;
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
    if (!ln.vis) {
      for (let k = 0; k < ln.palabras.length; k++) pintarPalabra(ctx, est, ln.palabras[k], x + ln.xs[k], base);
      return;
    }
    for (let k = 0; k < ln.palabras.length; k++) {
      if ('direction' in ctx) ctx.direction = ln.vis.dirs[k] === 'rtl' ? 'rtl' : 'ltr';
      pintarPalabra(ctx, est, ln.palabras[k], x + ln.vis.pos[k], base);
    }
    if ('direction' in ctx) ctx.direction = 'ltr';
  }

  // Etiqueta suelta (marca, página, pie) en una línea; si no cabe en «disp», se reduce hasta el 80 % y, si
  // aun así no cabe, se recorta con «…».
  function prepEtiqueta(ctx, C, texto, fe, disp) {
    let est = estilo(C, 'etiqueta', fe);
    let t = String(texto).replace(/\s+/g, ' ').trim();
    if (est.mayus) t = t.toLocaleUpperCase('es-ES');
    const lineaDe = (e, s) => { const P = prepararParrafo(ctx, e, s.split(' '), null); return P.linea(0, P.N); };
    let ln = lineaDe(est, t), recortado = false;
    if (disp > 0 && ln.w > disp + EPS) {
      const s = Math.max(0.8, disp / ln.w);
      est = estilo(C, 'etiqueta', fe * s); ln = lineaDe(est, t);
      if (ln.w > disp + EPS && s > 0.8) { est = estilo(C, 'etiqueta', fe * 0.8); ln = lineaDe(est, t); }
      if (ln.w > disp + EPS) {
        const g = grafemas(t);
        let lo = 0, hi = g.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (lineaDe(est, g.slice(0, mid).join('').trimEnd() + '…').w <= disp + EPS) lo = mid; else hi = mid - 1;
        }
        ln = lineaDe(est, g.slice(0, lo).join('').trimEnd() + '…');
        recortado = true;
      }
    }
    return { est, ln, recortado };
  }

  // ---------------------------------------------------------------- posiciones de marca, número y pie
  // Del kit («posiciones»), con los valores de cada publicación encima (opts.pos = {marca|pagina|pie: {x, y}}).
  // Sin «posiciones» en el kit: las de siempre, con los márgenes del lienzo.
  //   ancla: izquierda | derecha | centro — x en px desde ese borde (en centro, desde el centro; + = a la derecha)
  //   desde: arriba | abajo — y en px desde ese borde de la zona visible hasta la caja de la línea (en horizontal, × kv)
  const ANCLAS = ['izquierda', 'derecha', 'centro'];
  function posDefecto(L) {
    return {
      marca: { ancla: 'izquierda', desde: 'arriba', x: L.margen, y: L.barra_top },
      pagina: { ancla: 'derecha', desde: 'arriba', x: L.margen, y: L.barra_top },
      pie: { ancla: 'centro', desde: 'abajo', x: 0, y: L.pie }
    };
  }
  function posiciones(C, pos) {
    const def = posDefecto(C.L), k = C.kit.posiciones || {}, o = pos || {}, out = {};
    for (const e of ['marca', 'pagina', 'pie']) {
      const b = Object.assign({}, def[e], k[e] || {}), v = o[e] || {};
      out[e] = { ancla: ANCLAS.includes(b.ancla) ? b.ancla : def[e].ancla, desde: b.desde === 'abajo' ? 'abajo' : b.desde === 'arriba' ? 'arriba' : def[e].desde, x: num(v.x, num(b.x, def[e].x)), y: num(v.y, num(b.y, def[e].y)) };
    }
    return out;
  }

  // ---------------------------------------------------------------- dibujo
  function zonaDe(C, W, H, tipo, opts) {
    if (opts && Array.isArray(opts.zona)) return opts.zona;
    const r = (C.kit.formatos || {}).r916 || { ancho: 1080, alto: 1920, zona_segura: [240, 1680] };
    const zs = r.zona_segura || [240, 1680];
    if (tipo === 'reel' || (W === (r.ancho || 1080) && H === (r.alto || 1920))) return [zs[0], zs[1]];
    return [0, H];
  }

  const NOMBRE_NIVEL = { titular: 'el titular', texto: 'el texto', entradilla: 'la entradilla', etiqueta: 'el contacto' };

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
    const fondo = colorFondo(C);
    const an = analisisDe(capa, fondo);
    const AV = nuevosAvisos();
    const dx = num(ov.dx, 0), dy = num(ov.dy, 0);
    const esc = factor * clamp(num(ov.escala, 1), 0.6, 1.6);
    const colorOv = ov.color && C.colores[ov.color] ? ov.color : null;
    const VMAX = tipo === 'reel' ? 1 : 0.9;                  // tope del velo (el del control en Diseñar)
    const veloOv = esNum(ov.velo) ? clamp(ov.velo, 0, VMAX) : null;
    const manual = !!colorOv || veloOv !== null;
    const veloRGB = hex2rgb(C.velo.color);
    const blancoRGB = hex2rgb(colorHex(C, 'blanco')), carbonRGB = hex2rgb(colorHex(C, 'carbon'));
    const rgbDe = (key) => hex2rgb(colorHex(C, key));
    // Formato horizontal (H < W): las distancias verticales (anclas del bloque, barra, pie, rampas del velo)
    // se escalan por kv. Las etiquetas sueltas van al mismo factor que los títulos (1 en 4:5, 3:4 y 9:16).
    const horiz = H < W;
    const kv = horiz ? clamp(H / 1350, 0.45, 1) : 1;
    const fe = factor;
    const G = {
      inf: L.bloque_inferior * kv, sup: L.bloque_superior * kv,
      f0: 40 * kv, f1: 120 * kv
    };
    // Portada horizontal: marca y título dentro de la columna 3:4 central que se ve en la cuadrícula del perfil.
    const col = (tipo === 'portada' && (horiz || factor < 1) && H * 0.75 < W) ? { x0: (W - H * 0.75) / 2, w: H * 0.75, m: m * kv } : null;
    const xIzq = col ? col.x0 + col.m : m, xDer = col ? col.x0 + col.w - col.m : W - m, xCen = col ? col.x0 + col.w / 2 : W / 2;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if ('filter' in ctx) ctx.filter = 'none';
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    estadoTexto(ctx);

    // 1. fondo y foto (el fondo tapa lo que hubiera en el lienzo y se ve bajo las zonas transparentes)
    if (capa && capa.canvas) {
      ctx.fillStyle = fondo;
      ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(capa.canvas, 0, 0, W, H);
    } else {
      ctx.fillStyle = colorHex(C, 'carbon');
      ctx.fillRect(0, 0, W, H);
    }

    // 2. bloque de texto
    const info = { palabras: new Set() };
    // portada horizontal: si la palabra más larga del título no cabe en la columna visible, se reduce el cuerpo
    // lo justo (hasta 0,75 del cuerpo horizontal) antes de partir nada
    let escB = esc;
    if (col && lleno(slide.titulo)) {
      const e0 = estilo(C, P.nivel || 'portada', esc);
      const t0 = e0.mayus ? slide.titulo.toLocaleUpperCase('es-ES') : slide.titulo;
      const dispCol = col.w - 2 * col.m;
      const maxPal = Math.max(0, ...t0.split(/\s+/).filter(Boolean).flatMap((x) => segmentosSinEspacio(x) || [x]).map((x) => ancho(ctx, e0, x)));
      if (maxPal > dispCol + EPS) escB = esc * Math.max(0.75, (dispCol - 0.5) / maxPal);
    }
    let lay = maquetar(ctx, C, itemsDe(C, tipo, slide), escB, factor, W, col, info);
    // portada horizontal (panorámicas): como mucho 3 líneas y el 60 % del alto; si no, el cuerpo baja (hasta
    // 0,75 del cuerpo horizontal) y, si aun así no cabe, aviso
    if (col && lay.items.length) {
      const demasiado = (l) => l.items.reduce((n, it) => n + it.lineas.length, 0) > 3 || l.h > 0.6 * H + EPS;
      if (demasiado(lay)) {
        const minimo = esc * 0.75;
        let elegido = null;
        for (let k = escB - esc * 0.025; k >= minimo - 1e-9; k -= esc * 0.025) {
          const inf2 = { palabras: new Set() }, l2 = maquetar(ctx, C, itemsDe(C, tipo, slide), Math.max(k, minimo), factor, W, col, inf2);
          if (!demasiado(l2)) { elegido = { l2, inf2 }; break; }
        }
        if (!elegido) {
          const inf2 = { palabras: new Set() };
          elegido = { l2: maquetar(ctx, C, itemsDe(C, tipo, slide), minimo, factor, W, col, inf2), inf2 };
          AV.add('no-cabe', 'el título', 'el título ocupa demasiado en este formato: acórtalo');
        }
        lay = elegido.l2;
        info.palabras = elegido.inf2.palabras;
      }
    }
    for (const p of info.palabras) AV.add('palabra', 'el texto', `la palabra «${p}» no cabe en una línea: acórtala o baja el tamaño`);
    const anclas = { arriba: zona[0] + G.sup, abajo: zona[1] - G.inf, centro: (zona[0] + zona[1]) / 2 };
    const topDe = (lugar, h) => (lugar === 'arriba' ? anclas.arriba : lugar === 'abajo' ? anclas.abajo - h : anclas.centro - h / 2);
    const LUGARES = ['arriba', 'abajo', 'centro'], ALINEAR = ['izquierda', 'derecha', 'centro'];
    const lugarOv = LUGARES.includes(ov.lugar) ? ov.lugar : null;
    const alinearOv = ALINEAR.includes(ov.alinear) ? ov.alinear : null;
    const xRel = (al) => (w) => (al === 'derecha' ? -w : al === 'centro' ? -w / 2 : 0);
    const xLinea = (al, w) => (al === 'derecha' ? xDer + dx - w : al === 'centro' ? xCen + dx - w / 2 : xIzq + dx);
    const rectsDe = (al, top, its) => {
      const out = [];
      for (const it of its) {
        it.lineas.forEach((ln, i) => {
          if (!ln.t) return;
          const x = xLinea(al, ln.w), y = top + it.y + it.tops[i];
          out.push([x, y, x + ln.w, y + it.est.lh]);
        });
      }
      return out;
    };

    let lugar, alinear, velo = 0, color, vTop = 0, top = 0;
    // Velo «Auto»: el mínimo que deja cada texto del bloque justo por encima de 3:1 contra su fondo real (medido igual
    // que el aviso), redondeado al 1 % hacia arriba, hasta el tope del control. Si ni al tope llega, se queda en el tope
    // y se avisa. Solo para textos claros (a un texto oscuro el velo no le ayuda: sin velo).
    const minTexto = (colRGB, capas, extra) => {          // el peor contraste de los textos del bloque (y de «extra»)
      let mn = 21;
      for (const it of lay.items) { const rs = rectsDe(alinear, top, [it]); if (rs.length) mn = Math.min(mn, contrasteSobre(colRGB, fondoStats(an, rs, capas, veloRGB))); }
      for (const r of extra || []) mn = Math.min(mn, contrasteSobre(colRGB, fondoStats(an, [r], capas, veloRGB)));
      return mn;
    };
    const veloMinimo = (cDe) => {
      if (!an || cDe(0) >= AVISO_MIN) return 0;
      if (cDe(VMAX) < AVISO_MIN) return VMAX;
      let lo = 0, hi = VMAX;
      for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (cDe(mid) >= AVISO_MIN) hi = mid; else lo = mid; }
      return Math.min(VMAX, c2(hi));
    };
    let capaB = null, capaT = null;
    const et = { marca: null, pagina: null, pie: null };      // colores de las etiquetas
    const etq = {};                                         // etiquetas preparadas {est, ln, x, y, rect}
    // marca, número y pie: dónde van (kit + publicación); la columna 3:4 de la portada horizontal manda en x
    const PS = posiciones(C, opts.pos);
    const yEt = (p, lh) => (p.desde === 'abajo' ? zona[1] - p.y * kv - lh : zona[0] + p.y * kv);
    const xEt = (p, w) => {
      if (col) return p.ancla === 'derecha' ? col.x0 + col.w - p.x * kv - w : p.ancla === 'centro' ? col.x0 + col.w / 2 + p.x * kv - w / 2 : col.x0 + p.x * kv;
      return p.ancla === 'derecha' ? W - p.x - w : p.ancla === 'centro' ? W / 2 + p.x - w / 2 : p.x;
    };
    // separación mínima entre la tinta del bloque y el nombre del carrusel (pie)
    const sepPie = L.separacion * fe;
    const tintaDe = (t) => {
      let a = Infinity, b = -Infinity;
      for (const it of lay.items) {
        const bl = lineaBase(ctx, it.est);
        it.lineas.forEach((ln, i) => {
          if (!ln.t) return;
          const lt = t + it.y + it.tops[i];
          a = Math.min(a, lt + bl - ln.asc); b = Math.max(b, lt + bl + ln.desc);
        });
      }
      return [a, b];
    };

    // etiquetas (marca, página, pie): preparadas antes para conocer su rectángulo real
    if (P.pagina && esNum(opts.pagina)) {
      const e = prepEtiqueta(ctx, C, String(Math.round(opts.pagina)).padStart(2, '0'), fe, 0);
      etq.pagina = Object.assign(e, { x: xEt(PS.pagina, e.ln.w), y: yEt(PS.pagina, e.est.lh) });
    }
    if (P.marca && lleno(kit.marca || kit.cliente || '')) {
      const disp = col ? col.w - 2 * col.m : W - 2 * m - (etq.pagina ? etq.pagina.ln.w + 24 * fe : 0);
      const e = prepEtiqueta(ctx, C, kit.marca || kit.cliente, fe, disp);
      etq.marca = Object.assign(e, { x: xEt(PS.marca, e.ln.w), y: yEt(PS.marca, e.est.lh) });
      if (e.recortado) AV.add('recorte', 'la marca', 'la marca no cabe en su línea: se ha recortado (acorta «marca» en el kit)');
    }
    if (P.pie && lleno(opts.serie)) {
      const e = prepEtiqueta(ctx, C, opts.serie, fe, W - 2 * m);
      etq.pie = Object.assign(e, { x: xEt(PS.pie, e.ln.w), y: yEt(PS.pie, e.est.lh) });
      if (e.recortado) AV.add('recorte', 'el nombre del carrusel', 'el nombre del carrusel no cabe: se ha recortado con «…» (acórtalo)');
    }
    for (const k of Object.keys(etq)) { const e = etq[k]; e.rect = [e.x, e.y, e.x + e.ln.w, e.y + e.est.lh]; }
    // límites para el bloque de texto: bajo las etiquetas de arriba y sobre el pie de abajo
    const deArriba = ['marca', 'pagina', 'pie'].filter((k) => etq[k] && PS[k].desde === 'arriba' && k !== 'pie');
    const techoEt = deArriba.length ? Math.max(...deArriba.map((k) => etq[k].y)) + estilo(C, 'etiqueta', fe).lh : null;
    const pieAbajo = etq.pie && PS.pie.desde === 'abajo' ? etq.pie : null;

    // mejor de blanco/carbón sobre un fondo: blanco si llega al umbral, si no carbón, si no el que más
    const mejor = (fs, umbral) => {
      const cb = contrasteSobre(blancoRGB, fs), cc = contrasteSobre(carbonRGB, fs);
      if (cb >= umbral) return { color: 'blanco', c: cb };
      if (cc >= umbral) return { color: 'carbon', c: cc };
      return cb >= cc ? { color: 'blanco', c: cb } : { color: 'carbon', c: cc };
    };

    if (tipo === 'ficha' || tipo === 'final') {
      const altoMin = num(P.alto_analisis, ALTO_ANALISIS[tipo]) * (horiz ? kv : factor);
      let hz = Math.max(lay.h, altoMin);
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
      const h0 = lay.h;
      espaciarLineas(lay, xRel(alinear));
      if (lay.h !== h0) hz = Math.max(lay.h, altoMin);
      top = topDe(lugar, lay.h) + dy;
      if (pieAbajo && !dy && lugar !== 'abajo' && lay.h > 0) {
        const [ti, tb] = tintaDe(top), limite = pieAbajo.y - sepPie;
        if (tb > limite) {
          const techo = techoEt != null ? techoEt + sepPie : zona[0];
          // solo se sube si así cabe entero; si no, se queda donde estaba y se avisa
          if (tb - limite <= ti - techo) top -= tb - limite;
        }
      }
      const rects = rectsDe(alinear, top, lay.items);
      // zona real (con desplazamiento del usuario): de ella salen color y velo
      const z = (dx || dy || lay.h !== h0) ? candidato(lugar, dx, dy) : base;
      const fsFoto = rects.length ? fondoStats(an, rects, [], veloRGB) : null;
      if (colorOv) color = colorOv;
      else if (P.color && C.colores[P.color]) color = P.color;
      else {
        // modo carbón: foto clara y tranquila, y sin objetos oscuros bajo el texto (p2 del rectángulo del texto)
        const tranquila = C.vari.texto_oscuro_en_foto_clara && z.p10 > 0.40 && z.bordes < 0.03;
        color = tranquila && contrasteSobre(carbonRGB, fsFoto) >= C.velo.contraste_objetivo ? 'carbon' : 'blanco';
      }
      const colRGB = rgbDe(color);
      const zTop = z.y0, zBot = z.y0 + hz;
      const capaF = (a) => capaBloque(lugar, a, zTop, zBot, top, top + lay.h, H, kv);
      // con el bloque abajo, el mismo velo cubre el nombre del carrusel (que va del color del bloque): también cuenta
      const conPie = lugar === 'abajo' && pieAbajo ? [pieAbajo.rect] : [];
      const minBloque = (fijas, a) => minTexto(colRGB, [...fijas, capaF(a)], conPie);

      // marca y página: velo superior de motor.py; blanco o carbón según su fondo local con todos los velos
      const franja = zonaStats(an, m, zona[0] + G.f0, W - m, zona[0] + G.f1);
      const vTop0 = r2(clamp(veloNecesario(franja, blancoRGB, C.velo.contraste_objetivo, veloRGB), 0, 0.6));
      const altoTop = 300 * kv;
      const lbl = ['marca', 'pagina'].filter((k) => etq[k]);
      const etiquetasArriba = (cB) => {
        const minC = (key, v) => {
          if (!an || !lbl.length) return 21;
          const cs = [capaTop(v, zona[0], altoTop), cB];
          return Math.min(...lbl.map((k) => contrasteSobre(rgbDe(key), fondoStats(an, [etq[k].rect], cs, veloRGB))));
        };
        let colLbl = vTop0 > 0 || !esOscuro(C, color) ? 'blanco' : 'carbon', vT = colLbl === 'blanco' ? vTop0 : 0;
        if (lbl.length && an) {
          const cC = minC('carbon', 0);
          if (colLbl === 'blanco' && vTop0 > 0 && cC >= C.velo.contraste_objetivo && cC > minC('blanco', vTop0)) {
            // carbón sin banda llega al objetivo y se lee mejor que blanco con banda (foto clara arriba)
            colLbl = 'carbon'; vT = 0;
          } else if (minC(colLbl, vT) < AVISO_MIN) {
            // blanco con el velo superior que haga falta (hasta velo.maximo) o carbón sin velo superior
            let lo = vTop0, hi = C.velo.maximo;
            if (minC('blanco', hi) >= AVISO_MIN) {
              for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (minC('blanco', mid) >= AVISO_MIN) hi = mid; else lo = mid; }
            }
            const vW = c2(hi), cW = minC('blanco', vW);
            if (cC > cW) { colLbl = 'carbon'; vT = 0; } else { colLbl = 'blanco'; vT = vW; }
          }
        }
        return { colLbl, vT };
      };

      if (veloOv !== null) velo = veloOv;
      else if (esOscuro(C, color)) velo = 0;
      else velo = veloMinimo((a) => minBloque([], a));
      velo = r2(velo);
      capaB = capaF(velo);
      let lb = etiquetasArriba(capaB);
      // Auto: la banda de arriba (marca y número) también oscurece la foto; con ella puesta, el bloque puede necesitar
      // menos velo para quedar justo por encima de 3:1 (la banda y el color de la marca no cambian; si con menos velo
      // la marca o el número bajaran de 3, se queda el primero)
      if (veloOv === null && velo > 0 && lb.vT > 0) {
        const cT = capaTop(lb.vT, zona[0], altoTop), v2 = r2(veloMinimo((a) => minBloque([cT], a)));
        if (v2 < velo) {
          const cB2 = capaF(v2);
          const ok = !an || !lbl.length || Math.min(...lbl.map((k) => contrasteSobre(rgbDe(lb.colLbl), fondoStats(an, [etq[k].rect], [cT, cB2], veloRGB)))) >= AVISO_MIN;
          if (ok) { velo = v2; capaB = cB2; }
        }
      }
      vTop = lb.vT;
      et.marca = etq.marca ? lb.colLbl : null;
      et.pagina = etq.pagina ? lb.colLbl : null;
      capaT = capaTop(vTop, zona[0], altoTop);

      // pie: su propio rectángulo; color del bloque si va abajo, si no blanco/carbón según su fondo
      if (etq.pie) {
        const fsPie = fondoStats(an, [etq.pie.rect], [capaT, capaB], veloRGB);
        if (lugar === 'abajo' && contrasteSobre(colRGB, fsPie) >= AVISO_MIN) et.pie = color;
        else et.pie = mejor(fsPie, AVISO_MIN).color;
        if (lugar === 'abajo' && !an) et.pie = color;
      }
    } else if (tipo === 'portada') {
      lugar = lugarOv || (LUGARES.includes(P.lugar) ? P.lugar : 'abajo');
      alinear = alinearOv || (ALINEAR.includes(P.alinear) ? P.alinear : 'izquierda');
      espaciarLineas(lay, xRel(alinear));
      top = topDe(lugar, lay.h) + dy;
      const rects = rectsDe(alinear, top, lay.items), cmin = num(P.contraste_min, 3);
      const capaP = (a) => capaBloque(lugar, a, top, top + lay.h, top, top + lay.h, H, kv);
      if (veloOv !== null) {
        velo = r2(veloOv);
        // color: el mejor sobre el fondo real con el velo puesto a mano
        color = colorOv || mejor(fondoStats(an, rects, [capaP(velo)], veloRGB), cmin).color;
      } else {
        // Auto: sin velo si blanco o carbón ya se leen; si no, blanco con el velo mínimo que lo deja justo por encima de 3:1
        const m0 = mejor(fondoStats(an, rects, [], veloRGB), cmin);
        color = colorOv || (m0.c >= cmin ? m0.color : 'blanco');
        velo = esOscuro(C, color) ? 0 : r2(veloMinimo((a) => minTexto(rgbDe(color), [capaP(a)])));
      }
      capaB = capaP(velo);
      if (etq.marca) et.marca = mejor(fondoStats(an, [etq.marca.rect], [capaB], veloRGB), AVISO_MIN).color;
    } else { // reel
      lugar = lugarOv || (LUGARES.includes(P.lugar) ? P.lugar : 'centro');
      alinear = alinearOv || (ALINEAR.includes(P.alinear) ? P.alinear : 'centro');
      espaciarLineas(lay, xRel(alinear));
      top = topDe(lugar, lay.h) + dy;
      color = colorOv || 'blanco';
      const capaR = (a) => capaReel(a, W / 2 + dx, top + lay.h / 2, W, H);
      if (veloOv !== null) velo = veloOv;
      else velo = esOscuro(C, color) ? 0 : veloMinimo((a) => minTexto(rgbDe(color), [capaR(a)]));
      velo = r2(velo);
      capaB = capaR(velo);
    }
    const capas = [capaT, capaB];

    // 3. velos, etiquetas y texto
    pintarCapa(ctx, W, H, veloRGB, capaT);
    pintarCapa(ctx, W, H, veloRGB, capaB);
    for (const k of ['marca', 'pagina', 'pie']) {
      const e = etq[k];
      if (!e || !et[k]) continue;
      ctx.fillStyle = colorHex(C, et[k]);
      pintarLinea(ctx, e.est, e.ln, e.x, e.y);
    }
    ctx.fillStyle = colorHex(C, color);
    let minX = Infinity, maxX = -Infinity, tintaTop = Infinity, tintaBot = -Infinity;
    for (const it of lay.items) {
      const bl = lineaBase(ctx, it.est);
      for (let i = 0; i < it.lineas.length; i++) {
        const ln = it.lineas[i], w = ln.w;
        const x = xLinea(alinear, w), lt = top + it.y + it.tops[i];
        pintarLinea(ctx, it.est, ln, x, lt);
        if (ln.t) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x + w);
          tintaTop = Math.min(tintaTop, lt + bl - ln.asc); tintaBot = Math.max(tintaBot, lt + bl + ln.desc);
        }
      }
    }
    if (minX === Infinity) {
      const x = xLinea(alinear, 0);
      minX = maxX = x;
    }
    ctx.restore();

    // 4. avisos
    // contraste de cada texto contra su fondo real
    let contrasteMin = null;
    if (an) {
      const consejo = manual ? 'prueba otro color o ajusta el velo' : (tipo === 'ficha' || tipo === 'final') ? 'mueve el texto o cambia el encuadre o la foto' : 'cambia el encuadre o la foto';
      const colRGB = rgbDe(color);
      for (const it of lay.items) {
        const rs = rectsDe(alinear, top, [it]);
        if (!rs.length) continue;
        const c = contrasteSobre(colRGB, fondoStats(an, rs, capas, veloRGB));
        contrasteMin = Math.min(contrasteMin == null ? 21 : contrasteMin, c);
        const nombre = it.nivel === 'portada' ? (tipo === 'reel' ? 'el título del reel' : 'el título') : NOMBRE_NIVEL[it.nivel] || 'el texto';
        if (c < AVISO_MIN) AV.add('contraste', nombre, `contraste ${c.toFixed(2)} < 3 en ${nombre}: ${consejo}`, r2(c));
      }
      const nombresEt = { marca: 'la marca', pagina: 'el número de página', pie: 'el nombre del carrusel' };
      for (const k of ['marca', 'pagina', 'pie']) {
        const e = etq[k];
        if (!e || !et[k]) continue;
        const c = contrasteSobre(rgbDe(et[k]), fondoStats(an, [e.rect], capas, veloRGB));
        if (k === 'pie' && lugar === 'abajo' && (tipo === 'ficha' || tipo === 'final')) contrasteMin = Math.min(contrasteMin == null ? 21 : contrasteMin, c);   // el velo del bloque también lo cubre
        if (c < AVISO_MIN) AV.add('contraste', nombresEt[k], `contraste ${c.toFixed(2)} < 3 en ${nombresEt[k]}: cambia el encuadre o la foto`, r2(c));
      }
    }
    // trazo muy fino en lo que se ve en la cuadrícula del perfil (portada y reel)
    if (tipo === 'portada' || tipo === 'reel') {
      const visible = Math.min(W, H * 0.75);
      const fino = (est, nombre) => {
        if (est.peso > 200) return;
        const pxEf = est.px * 1080 / visible, umbral = est.peso <= 100 ? 220 : 130;
        if (pxEf < umbral) AV.add('trazo-fino', nombre, `trazo muy fino: ${nombre} puede no leerse en la cuadrícula (usa un peso mayor o más tamaño)`);
      };
      for (const it of lay.items) fino(it.est, tipo === 'reel' ? 'el título del reel' : 'el título');
      if (etq.marca && et.marca) fino(etq.marca.est, 'la marca');
    }
    // el bloque no cabe (por la tinta real de las líneas)
    if (lay.h > 0 && tintaTop !== Infinity) {
      const arribaMin = techoEt != null ? techoEt : -Infinity;
      const abajoMax = pieAbajo ? pieAbajo.y : Infinity;
      const pegadoMax = pieAbajo ? pieAbajo.y - sepPie : Infinity;
      const zonaSegura = zona[0] > 0 || zona[1] < H;
      let causa = null;
      if (minX < -0.5 || maxX > W + 0.5 || tintaTop < -0.5 || tintaBot > H + 0.5) causa = 'se sale del lienzo';
      else if (zonaSegura && (tintaTop < zona[0] - 0.5 || tintaBot > zona[1] + 0.5)) causa = `se sale de la zona visible del perfil (${zona[0]}–${zona[1]})`;
      else if (tintaTop < arribaMin - 0.5) causa = 'pisa la marca';
      else if (tintaBot > abajoMax + 0.5) causa = 'pisa el nombre del carrusel';
      else if (tintaBot > pegadoMax + 0.5) causa = 'queda pegado al nombre del carrusel';
      if (causa) AV.add('no-cabe', 'el texto', `el texto no cabe: ${causa} (acórtalo, baja la escala o muévelo)`);
      else if (col && (minX < col.x0 + col.m - 0.5 || maxX > col.x0 + col.w - col.m + 0.5)) {
        AV.add('no-cabe', 'el título', 'el título no cabe en la parte visible del perfil (centro 3:4): acórtalo, baja la escala o muévelo');
      }
    }
    // foto pequeña: los píxeles usados no llegan al 50 % del tamaño de salida en el lado corto
    const og = capa && capa.origen;
    if (og && og.w > 0 && og.h > 0 && Math.min(og.w, og.h) < 0.5 * Math.min(W, H)) {
      const s = Math.max(W / og.bw, H / og.bh);
      // la foto es pequeña solo si su lado corto ya lo es; si no, el problema es el encuadre (zoom o una
      // proporción muy distinta, como una panorámica en 9:16)
      const enc = `el encuadre usa solo ${Math.round(og.w)}×${Math.round(og.h)} px de la foto: saldrá borrosa`;
      if (Math.min(og.bw, og.bh) < 0.5 * Math.min(W, H)) AV.add('foto-pequena', 'la foto', `la foto es pequeña (${og.bw}×${og.bh} px): saldrá borrosa`);
      else if (Math.min(og.w, og.h) < 0.99 * Math.min(W, H) / s) AV.add('foto-pequena', 'la foto', enc + ' (quita zoom)');
      else AV.add('foto-pequena', 'la foto', enc);
    }

    return {
      decision: { lugar, alinear, velo, color, velo_top: vTop, etiquetas: et, contraste: contrasteMin == null ? null : r2(contrasteMin) },
      bloque: { x: minX, y: top, w: maxX - minX, h: lay.h },
      avisos: AV.lista.map((a) => a.mensaje),
      avisosInfo: AV.lista,
      lineas: lay.items.map((it) => it.lineas.map((ln) => ln.t))
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
    const r = dibujar(ctx, kit, capa, slide, { W: t.W, H: t.H, factor: t.factor, pagina: opts.pagina, serie: opts.serie, pos: opts.pos });
    return { canvas, decision: r.decision, bloque: r.bloque, avisos: r.avisos, avisosInfo: r.avisosInfo, lineas: r.lineas };
  }

  // JPEG siempre opaco: el lienzo se aplana sobre «fondo» (blanco por defecto) por si tuviera transparencias.
  function aBlob(canvas, calidad, fondo) {
    const q = esNum(calidad) ? calidad : 0.92;
    const plano = nuevoCanvas(canvas.width, canvas.height);
    const pc = plano.getContext('2d');
    pc.fillStyle = fondo || '#FFFFFF';
    pc.fillRect(0, 0, plano.width, plano.height);
    pc.drawImage(canvas, 0, 0);
    if (plano.convertToBlob && !plano.toBlob) return plano.convertToBlob({ type: 'image/jpeg', quality: q });
    return new Promise((res, rej) => plano.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo exportar la imagen'))), 'image/jpeg', q));
  }

  global.DisenoMotor = {
    version: VERSION,
    cargarKit, usarKit, tamano, capaFoto, dibujar, render, aBlob,
    posiciones: (kit, pos) => posiciones(conf(kit), pos),
    // uso interno y pruebas
    _interno: {
      rectCover, zonaStats, bordesMedia, veloNecesario, contraste, partir, estilo, conf, analizarPixeles,
      prepararParrafo, voraz, fondoStats, contrasteSobre, infoFuente, trocear, rompibles, ordenVisual, grafemas,
      cortesSilabicos, segmentosSinEspacio
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
