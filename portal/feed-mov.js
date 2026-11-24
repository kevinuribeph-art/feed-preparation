// La cabecera de meses del feed continuo del portal (y su movimiento): la misma que la «Vista cliente» de la Mesa (mesa.js,
// `cabNodo`/`cabRender`/`cabColocar`, D-323), escrita para el portal: sin estilos en línea (CSP del portal: solo CSSOM, como
// `style.transform` y `style.setProperty`), sin innerHTML y con las flechas del sprite del portal. No sabe nada del portal: le dan
// los meses y le dicen cuál es el activo; ella avisa cuando se pulsa un mes o una flecha.
(function (g) {
  'use strict';
  const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
  const attr = (e, k, v) => { if (e.getAttribute(k) !== v) { if (v == null) e.removeAttribute(k); else e.setAttribute(k, v); } };   // solo si cambia: el repaso no toca la cabecera

  // [‹] [ el mes anterior | el mes que se ve, en una píldora fija | el siguiente ] [›]. Una tira con todos los meses del cliente,
  // cada uno en un hueco del mismo ancho (--fm-w, W); la ventana enseña 3; la píldora (fija sobre el hueco del centro) lleva una
  // segunda tira en --on-ink recortada a ella: un solo número mueve las dos (mover(v): el hueco v, centrado en la píldora).
  // o: { icono(n) → svg, alPulsar(key) (un mes o una flecha) }
  function cabecera(o) {
    const nodo = el('div', 'fm-cab'); nodo.setAttribute('role', 'group'); nodo.setAttribute('aria-label', 'Meses');
    const inn = el('div', 'fm-in'), vent = el('div', 'fm-vent'), tira = el('div', 'fm-tira'), pild = el('div', 'fm-pild'), tira2 = el('div', 'fm-tira fm-tira2');
    const fl = d => { const b = el('button', 'fm-fl'); b.type = 'button'; b.dataset.d = d; b.setAttribute('aria-label', d < 0 ? 'Mes anterior' : 'Mes siguiente'); b.title = d < 0 ? 'Mes anterior' : 'Mes siguiente'; const i = o.icono && o.icono(d < 0 ? 'left' : 'right'); if (i) b.append(i); return b; };
    const bI = fl(-1), bD = fl(1);
    pild.setAttribute('aria-hidden', 'true'); pild.append(tira2); vent.append(tira, pild); inn.append(bI, vent, bD); nodo.append(inn);
    let meses = [], activo = null, WN = 0, W = 0, X = null, sig = '', PX = 0;
    const huecos = () => [...tira.children];
    const iDe = k => meses.findIndex(m => m.key === k);
    function vecino(d, desde) { const i = iDe(desde || activo); const j = i + d; return j >= 0 && j < meses.length ? meses[j].key : null; }
    function medirNombres() {            // el ancho de los huecos: el nombre más largo (una lectura de diseño, solo cuando cambian los meses)
      nodo.style.removeProperty('--fm-w');
      const w = Math.max(0, ...huecos().map(h => h.offsetWidth));
      WN = w ? Math.max(56, Math.ceil(w)) : 0; W = WN; X = null;
      if (W) nodo.style.setProperty('--fm-w', W + 'px');
    }
    function poner(lista) {              // los meses, del más viejo al más nuevo: [{key, label, title}]
      const s = lista.map(m => m.key + '=' + m.label).join(',');
      nodo.hidden = !lista.length;
      if (s === sig) return false;
      sig = s; meses = lista.slice();
      tira.replaceChildren(...meses.map(m => { const b = el('button', 'fm-mes'); b.type = 'button'; b.dataset.mes = m.key; b.textContent = m.label; b.title = m.title || m.label; return b; }));
      tira2.replaceChildren(...meses.map(m => { const s2 = el('span', 'fm-mes'); s2.textContent = m.label; return s2; }));
      if (nodo.isConnected) medirNombres(); else WN = 0;
      return true;
    }
    // el mes activo: aria-current, solo los 3 de la ventana se enfocan y se leen, y las flechas apagadas en los extremos
    function marcar(key) {
      activo = key; const i = Math.max(0, iDe(key));
      huecos().forEach((h, j) => {
        const ve = Math.abs(j - i) <= 1;
        if (h.tabIndex !== (ve ? 0 : -1)) h.tabIndex = ve ? 0 : -1;
        attr(h, 'aria-hidden', ve ? null : 'true'); attr(h, 'aria-current', j === i ? 'true' : null);
      });
      [bI, bD].forEach(b => attr(b, 'aria-disabled', vecino(+b.dataset.d) ? null : 'true'));
      foco();
    }
    function mover(v) {                  // el hueco v (con decimales) centrado en la píldora: solo transform, nada que mida
      if (!W) return; const x = (1 - v) * W; if (x === X) return; X = x;
      tira.style.transform = `translateX(${x}px)`; tira2.style.transform = `translateX(${x - W}px)`;
    }
    // su sitio: centrada sobre la rejilla y nunca más ancha (si no cabe, los huecos se estrechan); una lectura de diseño, cuando
    // cambia el tamaño o los meses, nunca al deslizar
    function colocar(grid) {
      if (!nodo.isConnected || nodo.hidden) return;
      if (!WN) { medirNombres(); if (!WN) return; }
      const extra = inn.offsetWidth - vent.offsetWidth + 2;
      const r = grid && grid.offsetWidth ? grid.getBoundingClientRect() : null;
      const w = r ? Math.max(40, Math.min(WN, Math.floor((r.width - extra) / 3))) : W;
      if (w !== W) { W = w; X = null; nodo.style.setProperty('--fm-w', w + 'px'); }
      const iw = extra + 3 * W;
      if (r) { const s = nodo.getBoundingClientRect(), want = r.left + (r.width - iw) / 2 - s.left; PX = want >= -0.5 && want + iw <= s.width + 0.5 ? Math.max(0, Math.round(want * 2) / 2) : 0; }
      const tx = PX ? `translateX(${PX}px)` : '';
      if (inn.style.transform !== tx) inn.style.transform = tx;
    }
    function foco() {                    // el aro del mes activo, en la píldora; un mes con aro: sin la degradación de los bordes
      const a = document.activeElement, en = !!(a && vent.contains(a) && a.classList.contains('fm-mes') && a.matches(':focus-visible')), fp = en && a.getAttribute('aria-current') === 'true';
      if (vent.classList.contains('fpild') !== fp) vent.classList.toggle('fpild', fp);
      if (vent.classList.contains('fmes') !== en) vent.classList.toggle('fmes', en);
    }
    nodo.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('button'); if (!b || !nodo.contains(b)) return;
      if (b.classList.contains('fm-fl')) { if (b.getAttribute('aria-disabled') !== 'true') { const k = vecino(+b.dataset.d); if (k) o.alPulsar(k, 'flecha'); } return; }
      if (b.dataset.mes) o.alPulsar(b.dataset.mes, 'mes');
    });
    nodo.addEventListener('keydown', e => {   // ← → con el foco en la cabecera: el mes de antes o el de después (el foco va con él)
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      e.preventDefault(); e.stopPropagation();
      const k = vecino(e.key === 'ArrowLeft' ? -1 : 1); if (!k) return;
      const enMes = e.target.classList && e.target.classList.contains('fm-mes');
      o.alPulsar(k, 'tecla');
      if (enMes) { const h = huecos()[iDe(k)]; if (h) h.focus({ preventScroll: true }); foco(); }
    });
    nodo.addEventListener('focusin', foco); nodo.addEventListener('focusout', () => setTimeout(foco, 0));
    vent.addEventListener('scroll', () => { vent.scrollLeft = 0; });   // un mes con el foco nunca desliza la ventana
    return { nodo, poner, marcar, mover, colocar, activo: () => activo, ancho: () => W, indice: iDe, meses: () => meses.slice() };
  }

  // ---------- el movimiento: el motor de la Mesa (mesa.js, `MOV`, `movBez`, `movMotor`; D-325), portado tal cual ----------
  // Un número v (en huecos de la tira) que sigue al desplazamiento del feed; nada del portal dentro. Lo que se le dice y cuándo:
  //  · medir(pts, filaH, max, s): pts = [{j, st}], el scrollTop del punto de cada mes (su publicación más vieja en la fila de abajo),
  //    medido cuando cambian el tamaño o el contenido, nunca al deslizar; en reposo sobre el punto de un mes (ancla) y cambió el
  //    diseño: el feed se queda en el punto de ese mes.
  //  · v(s): lineal entre los dos puntos alrededor de s; arriba el más nuevo, abajo el más viejo; sobre el ancla, su mes; más un
  //    desvío que lleva la tira al mes activo cuando el feed no fue allí (se apaga a una fila). Solo transform, desde un escuchador
  //    pasivo y requestAnimationFrame: ninguna lectura de diseño por cuadro (solo scrollTop).
  //  · un desplazamiento es de quien mira solo con un gesto vivo (rueda, dedo, ratón apretado —también sobre la barra— o una tecla
  //    de desplazamiento, 2,5 s); lo demás (nuestro eco, el navegador que recorta o ancla) solo mueve la tira.
  //  · asentar: 150 ms sin desplazamiento, rueda ni tecla y nada apretado → el imán: el punto más cercano a menos de 0,35 de fila,
  //    un desplazamiento animado hasta él (nunca con «reducir movimiento» ni imanNo()) → asentado(v), una vez.
  //  · ir(dest, j, {instantaneo}): el salto, de duración fija sea cual sea la distancia; un gesto lo para donde esté. volver(j):
  //    solo la tira al hueco j.
  // sc: el que desliza: un elemento, o cualquier objeto con scrollTop (get/set) y add/removeEventListener (la ventana: `ventana()`).
  const MOV = { PAUSA: 150, INTENCION: 2500, UMBRAL: .35, ECO: 1.5, TECLAS: /^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/ };
  function bez(x1, y1, x2, y2) {         // un cubic-bezier de CSS como función del tiempo (0..1)
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x; for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-5) break; const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; } return Y(Math.min(1, Math.max(0, t))); };
  }
  let tk = null;
  function tokens() {                    // --d-m y --ease-m (los de la Mesa, en portal.css), leídos una vez
    if (tk) return tk;
    const cs = getComputedStyle(document.documentElement), dm = /([\d.]+)\s*(m?s)/.exec(cs.getPropertyValue('--d-m') || ''), em = /cubic-bezier\(([^)]+)\)/.exec(cs.getPropertyValue('--ease-m') || '');
    const dur = dm ? +dm[1] * (dm[2] === 's' ? 1000 : 1) : 320, n = em ? em[1].split(',').map(Number) : [.32, .72, 0, 1];
    tk = { dur: dur > 0 ? dur : 320, ease: bez(...(n.length === 4 && n.every(Number.isFinite) ? n : [.32, .72, 0, 1])), curva: n };
    return tk;
  }
  // la página como «el que desliza»: scrollTop = scrollY; el desplazamiento y su fin, de la ventana; los gestos, de toda la página
  function ventana() {
    return {
      get scrollTop() { return window.scrollY; }, set scrollTop(y) { window.scrollTo(0, y); },
      addEventListener: (t, f, o2) => window.addEventListener(t, f, o2), removeEventListener: (t, f, o2) => window.removeEventListener(t, f, o2),
    };
  }
  function motor(sc, o) {
    // o: { pintar(v), jFijo() (sin puntos ni ancla: el hueco del mes activo), reducir(), imanNo(), asentado(v), dur (ms), ease }
    const ahoraMs = () => performance.now();
    let pts = [], filaH = 0, max = 0, sC = sc.scrollTop, ancla = null, desv = null, anim = null, raf = 0, glide = null, rafG = 0, rafP = 0;
    let ultimaEsc = -9, tInt = -1e9, huboScroll = false, tocando = 0, tAs = 0, vu = null, vivo = true;
    const viva = () => ahoraMs() - tInt < MOV.INTENCION;
    function interp(s) {
      if (!pts.length || max <= 0) return ancla ? ancla.j : o.jFijo();
      if (s <= pts[0].st) return pts[0].j;                       // arriba (un empate: el más nuevo)
      if (s >= pts[pts.length - 1].st) return pts[pts.length - 1].j;   // abajo (un empate: el más viejo)
      for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (s <= b.st) { const d = b.st - a.st; return d < 1 ? b.j : a.j + (b.j - a.j) * (s - a.st) / d; } }
      return pts[pts.length - 1].j;
    }
    const base = s => (ancla && Math.abs(s - ancla.st) < 1 ? ancla.j : interp(s));
    function desvDe(s) {
      if (!desv) return 0; if (desv.fijo) return desv.d;
      const k = filaH > 0 ? 1 - Math.abs(s - desv.sR) / filaH : 0; return k > 0 ? desv.d * k : 0;
    }
    const v = (s = sC) => base(s) + desvDe(s);
    function pintar() { rafP = 0; if (!vivo) return; const x = v(); if (x !== vu && Number.isFinite(x)) { vu = x; o.pintar(x); } }
    function pedir() { if (!rafP) rafP = requestAnimationFrame(pintar); }
    function escribir(y) { ultimaEsc = y; sc.scrollTop = y; sC = max > 0 ? Math.max(0, Math.min(max, y)) : sC; }
    function paraGlide() { if (!glide) return; cancelAnimationFrame(rafG); glide = null; if (desv) { desv.fijo = false; desv.sR = sC; } }
    function cancelar() {                 // para un desplazamiento animado donde esté (la tira no salta: su desvío se apaga)
      if (!anim) return; cancelAnimationFrame(raf); anim = null;
      if (desv) { desv.fijo = false; desv.sR = sC; }
    }
    // (lo que añade el portal: libre = el destino no es el punto del mes —«Revisarla» lleva el feed a una casilla—: en reposo la
    // tira sigue en el mes j, pero medir() no lo devuelve a su punto)
    function mover(dest, j, inst, fin, libre) {  // el salto y el imán: hasta dest; al acabar, en reposo sobre el punto del mes j
      cancelar(); paraGlide(); clearTimeout(tAs); tAs = 0; huboScroll = false; tInt = -1e9;
      const s0 = sC, d = dest - s0, v0 = v(s0);
      const acabar = () => { anim = null; ancla = { j, st: dest, libre }; desv = null; vu = null; pintar(); if (fin) fin(); };
      if (inst || o.reducir()) { if (Math.abs(sc.scrollTop - dest) >= .5) escribir(dest); else sC = dest; acabar(); return; }
      if (Math.abs(d) < .5) { ancla = { j, st: dest, libre }; desv = { d: v0 - j, sR: sC }; volver(j); if (fin) fin(); return; }
      ancla = null;
      const d0 = v0 - interp(s0), d1 = j - interp(dest), t0 = ahoraMs(), tok = anim = { s0, d, dest };
      desv = { fijo: true, d: d0 };
      const paso = t => {
        if (anim !== tok) return;
        const k = Math.min(1, Math.max(0, (t - t0) / o.dur)), e = o.ease(k);
        escribir(tok.s0 + tok.d * e); desv.d = d0 * (1 - e) + d1 * e; pintar();
        if (k < 1) raf = requestAnimationFrame(paso); else { ancla = null; acabar(); }
      };
      raf = requestAnimationFrame(paso);
    }
    function volver(j, inst) {           // solo la tira al hueco j, sin mover el feed
      paraGlide(); const s = sC, a = v(s) - base(s), b = j - base(s);
      if (Math.abs(b - a) < 1e-3) return;
      if (inst || o.reducir()) { desv = { d: b, sR: s }; vu = null; pintar(); return; }
      desv = { d: a, sR: s, fijo: true };
      const t0 = ahoraMs(), tok = glide = {};
      const paso = t => {
        if (glide !== tok) return;
        const k = Math.min(1, Math.max(0, (t - t0) / o.dur)), e = o.ease(k); desv.d = a + (b - a) * e; pintar();
        if (k < 1) rafG = requestAnimationFrame(paso); else { glide = null; desv.fijo = false; desv.sR = sC; }
      };
      rafG = requestAnimationFrame(paso);
    }
    function armar() { clearTimeout(tAs); tAs = setTimeout(asentar, MOV.PAUSA); }
    function asentar() {                 // el desplazamiento se ha parado: el imán y, después, el mes una vez
      tAs = 0; if (!vivo || anim || tocando || !huboScroll) return;
      huboScroll = false; tInt = -1e9;
      const s = sC;
      if (filaH > 0 && max > 0 && pts.length && !o.reducir() && !o.imanNo()) {
        const vs = v(s); let b = null, bd = Infinity;
        for (const p of pts) { const dd = Math.abs(p.st - s); if (dd < bd - .01 || (Math.abs(dd - bd) <= .01 && Math.abs(p.j - vs) < Math.abs(b.j - vs))) { b = p; bd = dd; } }
        if (b && bd <= MOV.UMBRAL * filaH) {
          if (bd > .5) { mover(b.st, b.j, false, () => o.asentado(b.j)); return; }
          ancla = { j: b.j, st: b.st }; desv = null; pedir(); o.asentado(b.j); return;
        }
      }
      o.asentado(v(s));
    }
    function alScroll() {
      sC = sc.scrollTop;
      if (anim) { pedir(); return; }      // los cuadros de nuestra animación (un gesto la para antes de su desplazamiento)
      // de quien mira: con un gesto vivo o, ya empezado su desplazamiento, mientras siga (la inercia del dedo en Safari puede durar más
      // de 2,5 s: sin esto, el imán tiraba antes de parar y peleaba con ella; D-P13, lo que añade el portal)
      if (Math.abs(sC - ultimaEsc) >= MOV.ECO && (viva() || huboScroll)) {
        huboScroll = true; ultimaEsc = -9;
        if (ancla && Math.abs(sC - ancla.st) >= 1) ancla = null;
        if (desv && !desv.fijo && filaH > 0 && Math.abs(sC - desv.sR) >= filaH) desv = null;
        armar();
      }
      pedir();
    }
    function intento() { if (anim) cancelar(); paraGlide(); tInt = ahoraMs(); }
    const suelta = () => { tocando = Math.max(0, tocando - 1); armar(); };
    const fin = () => { suelta(); removeEventListener('pointerup', fin, true); removeEventListener('pointercancel', fin, true); };
    const on = [
      ['scroll', alScroll],
      ['scrollend', () => { if (huboScroll) armar(); }],
      ['wheel', () => { intento(); armar(); }],
      ['touchstart', () => { tocando++; intento(); }],
      ['touchend', suelta], ['touchcancel', suelta],
      ['pointerdown', e => {
        if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
        tocando++; intento();
        addEventListener('pointerup', fin, true); addEventListener('pointercancel', fin, true);
      }],
      ['keydown', e => { if (MOV.TECLAS.test(e.key)) intento(); }],
    ];
    on.forEach(([t, f]) => sc.addEventListener(t, f, { passive: true }));
    return {
      sc,
      medir(p, fh, mx, s) {
        const quieto = !anim && ancla && !ancla.libre && Math.abs(sC - ancla.st) < 1 ? ancla.j : null;   // en reposo sobre el punto de un mes (antes del cambio)
        pts = p.slice().sort((a, b) => a.st - b.st || b.j - a.j); filaH = fh; max = mx; if (s != null) sC = s;
        if (quieto != null) {
          const q = pts.find(x => x.j === quieto);
          if (q) { if (Math.abs(q.st - sC) > .5) escribir(q.st); ancla = { j: quieto, st: q.st }; }
        }
        vu = null; pintar();
      },
      ir: (dest, j, op = {}) => mover(dest, j, !!op.instantaneo, null, !!op.libre),
      volver: (j, inst) => volver(j, inst),
      v: () => v(),
      repintar() { vu = null; pintar(); },
      corregir(y, d) {                   // la corrección propia del feed: nuestra, y una animación la sigue
        if (anim) { anim.s0 += d; anim.dest += d; } else escribir(y);
        if (ancla) ancla = { j: ancla.j, st: ancla.st + d, libre: ancla.libre };
      },
      reindex(f) { if (ancla) { const j = f(ancla.j); ancla = j >= 0 ? { j, st: ancla.st, libre: ancla.libre } : null; } pts = []; },
      quieto: () => !anim && !glide && !huboScroll && !tocando && !tAs,
      estado: () => ({ v: v(), st: sC, ancla: ancla && { ...ancla }, anim: !!anim, glide: !!glide, desv: desv && { ...desv }, gesto: huboScroll, tocando, puntos: pts.map(x => ({ ...x })), filaH, max }),
      destruir() { vivo = false; cancelar(); paraGlide(); clearTimeout(tAs); cancelAnimationFrame(rafP); on.forEach(([t, f]) => sc.removeEventListener(t, f, { passive: true })); fin(); },
    };
  }

  g.FeedMov = { cabecera, motor, ventana, tokens, bez, MOV };
})(window);
