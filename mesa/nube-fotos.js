// nube-fotos.js · 1.1 · el trabajo pesado de las fotos de la nube, fuera del hilo principal (lote 4 del traspaso C, D-259).
// Un worker que solo crea nube.js con la nube encendida. Recibe {id, op, blob, w, h} y contesta {id, …} o {id, error}:
//   huella → {sha256}: SHA-256 de los bytes (hex).
//   copia  → {sha256, copia, w, h}: la copia de trabajo (JPEG 0,9, 2560 px de lado largo, sRGB, píxeles ya orientados, fondo
//            blanco; un PNG o WebP, en WebP con su transparencia) y su huella. `w` y `h` son las medidas del original ya orientado (las del registro).
// Nunca toca IndexedDB ni la red. Si no hay worker (o lo bloquea algo), nube.js hace lo mismo en el hilo principal.
'use strict';
const LARGO = 2560, CALIDAD = 0.9;
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const huella = async b => hex(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()));
async function copia(blob, w, h) {
  const alfa = /^image\/(png|webp)$/.test(blob.type || '');   // con transparencia: en WebP (o PNG si no hay WebP), sin fondo blanco
  let bmp = null, cw = 0, ch = 0;
  if (w > 0 && h > 0) {   // pedir la decodificación ya reducida (más rápida y ligera)
    const k = Math.min(1, LARGO / Math.max(w, h)), tw = Math.max(1, Math.round(w * k)), th = Math.max(1, Math.round(h * k));
    bmp = await createImageBitmap(blob, { imageOrientation: 'from-image', resizeWidth: tw, resizeHeight: th, resizeQuality: 'high' });
    if (bmp.width === tw && bmp.height === th) { cw = tw; ch = th; } else { bmp.close(); bmp = null; }   // girada respecto al registro: sin reducir
  }
  if (!bmp) {   // sin medidas en el registro, o girada: entera, y se reduce al dibujar
    bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const k2 = Math.min(1, LARGO / Math.max(bmp.width, bmp.height)); cw = Math.max(1, Math.round(bmp.width * k2)); ch = Math.max(1, Math.round(bmp.height * k2));
  }
  const c = new OffscreenCanvas(cw, ch), x = c.getContext('2d');
  if (!alfa) { x.fillStyle = '#fff'; x.fillRect(0, 0, cw, ch); }
  x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, cw, ch); bmp.close();
  const out = await c.convertToBlob({ type: alfa ? 'image/webp' : 'image/jpeg', quality: CALIDAD });
  return { copia: out, w: cw, h: ch, sha256: await huella(out) };
}
self.NubeFotos = { huella, copia, LARGO, version: '1.1' };
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = async e => {
    const { id, op, blob, w, h } = e.data || {};
    try {
      if (op === 'huella') self.postMessage({ id, sha256: await huella(blob) });
      else if (op === 'copia') self.postMessage({ id, ...(await copia(blob, w, h)) });
      else self.postMessage({ id, error: 'operación desconocida' });
    } catch (x) { self.postMessage({ id, error: String((x && x.message) || x || 'no se pudo') }); }
  };
}
