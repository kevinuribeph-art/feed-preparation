// Cliente mínimo de Supabase, sin dependencias (D-241): entrada con código por correo, datos y archivos privados.
// Lo usan el portal de clientes (portal/) y la Mesa de Kevin (web.js). Expone `window.Supa.crear({url, publica, clave})`.
// La sesión vive en localStorage bajo `clave` (por origen); nunca se escribe en consola ni en avisos.
(function () {
  'use strict';
  var V = '1.0';

  function SupaError(mensaje, status, codigo) { this.name = 'SupaError'; this.message = mensaje; this.status = status || 0; this.codigo = codigo || ''; }
  SupaError.prototype = Object.create(Error.prototype);

  function guardado(k) { try { var t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function guardar(k, v) { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch (e) { /* sin almacenamiento: la sesión dura lo que la pestaña */ } }

  function crear(o) {
    if (!o || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(String(o.url || '').replace(/\/$/, ''))) throw new SupaError('proyecto sin configurar', 0, 'config');
    var url = o.url.replace(/\/$/, ''), publica = o.publica, clave = o.clave || ('supa-' + url.split('//')[1].split('.')[0]);
    var ses = guardado(clave), renovando = null, oyentes = [];

    function avisar() { oyentes.slice().forEach(function (f) { try { f(ses ? { id: ses.user.id, email: ses.user.email } : null); } catch (e) { /* un oyente roto no para a los demás */ } }); }
    function ponerSesion(s) {
      ses = s && s.access_token ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || (Math.floor(Date.now() / 1000) + (s.expires_in || 3600)), user: { id: s.user.id, email: s.user.email } } : null;
      guardar(clave, ses); avisar();
    }
    try { window.addEventListener('storage', function (e) { if (e.key === clave) { ses = guardado(clave); avisar(); } }); } catch (e) { /* sin ventana (pruebas) */ }

    function pedir(ruta, op) {
      op = op || {};
      var h = { apikey: publica };
      if (op.token) h.Authorization = 'Bearer ' + op.token;
      if (op.json !== undefined) h['Content-Type'] = 'application/json';
      if (op.tipo) h['Content-Type'] = op.tipo;
      if (op.prefer) h.Prefer = op.prefer;
      if (op.upsert) h['x-upsert'] = 'true';
      var ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, op.espera || 20000);
      return fetch(url + ruta, { method: op.metodo || 'GET', headers: h, body: op.json !== undefined ? JSON.stringify(op.json) : op.cuerpo, signal: ctl && ctl.signal })
        .then(function (r) {
          if (t) clearTimeout(t);
          return r.text().then(function (txt) {
            var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { /* no es JSON */ }
            if (!r.ok) {
              var m = (j && (j.msg || j.message || j.error_description || j.error)) || ('error ' + r.status);
              throw new SupaError(String(m).slice(0, 300), r.status, (j && (j.error_code || j.code || j.statusCode)) || '');
            }
            return j;
          });
        }, function (e) {
          if (t) clearTimeout(t);
          throw new SupaError(e && e.name === 'AbortError' ? 'el servidor no contesta' : 'sin conexión', 0, 'red');
        });
    }

    // Un token válido; renueva si le queda menos de un minuto. Una renovación a la vez.
    function token() {
      if (!ses) return Promise.reject(new SupaError('sin sesión', 401, 'sesion'));
      if (ses.expires_at - Date.now() / 1000 > 60) return Promise.resolve(ses.access_token);
      if (!renovando) {
        var rt = ses.refresh_token;
        renovando = pedir('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', json: { refresh_token: rt } })
          .then(function (s) { ponerSesion(s); return ses.access_token; }, function (e) {
            if (e.status === 400 || e.status === 401) ponerSesion(null);
            throw e.status === 400 || e.status === 401 ? new SupaError('la sesión ha caducado', 401, 'sesion') : e;
          })
          .then(function (t) { renovando = null; return t; }, function (e) { renovando = null; throw e; });
      }
      return renovando;
    }
    function conToken(ruta, op) { return token().then(function (tk) { op = op || {}; op.token = tk; return pedir(ruta, op); }); }

    var api = {
      version: V,
      usuario: function () { return ses ? { id: ses.user.id, email: ses.user.email } : null; },
      alCambiar: function (f) { oyentes.push(f); return function () { oyentes = oyentes.filter(function (g) { return g !== f; }); }; },
      // Pide un código. No dice si el correo está dado de alta: un correo desconocido también «se envía» (D-241).
      pedirCodigo: function (correo) {
        return pedir('/auth/v1/otp', { metodo: 'POST', json: { email: correo, create_user: false } })
          .then(function () { return true; }, function (e) {
            if (e.status === 429) throw new SupaError('demasiados intentos: espera un minuto', 429, 'espera');
            if (e.status === 0) throw e;
            if (e.status >= 500) throw new SupaError('no se pudo enviar el código: inténtalo en un momento', e.status, 'servidor');
            return true;   // un correo sin acceso no se distingue de uno con acceso
          });
      },
      verificarCodigo: function (correo, codigo) {
        return pedir('/auth/v1/verify', { metodo: 'POST', json: { type: 'email', email: correo, token: String(codigo).replace(/\D/g, '') } })
          .then(function (s) { ponerSesion(s); return api.usuario(); }, function (e) {
            if (e.status === 429) throw new SupaError('demasiados intentos: espera un minuto', 429, 'espera');
            if (e.status === 0) throw e;
            throw new SupaError('ese código no vale o ha caducado', e.status, 'codigo');
          });
      },
      // Solo para las pruebas: una sesión obtenida fuera (Node, contraseña de un usuario inventado del proyecto de pruebas).
      _sesion: function (s) { ponerSesion(s); },
      salir: function () {
        var tk = ses && ses.access_token; ponerSesion(null);
        return tk ? pedir('/auth/v1/logout', { metodo: 'POST', token: tk }).catch(function () { return null; }) : Promise.resolve(null);
      },
      leer: function (ruta) { return conToken('/rest/v1/' + ruta); },
      insertar: function (tabla, filas, op) {
        op = op || {};
        var pref = [op.devolver ? 'return=representation' : 'return=minimal'];
        if (op.upsert) pref.push('resolution=merge-duplicates');
        return conToken('/rest/v1/' + tabla + (op.conflicto ? (tabla.includes('?') ? '&' : '?') + 'on_conflict=' + op.conflicto : ''), { metodo: 'POST', json: filas, prefer: pref.join(',') });
      },
      actualizar: function (ruta, campos, op) { return conToken('/rest/v1/' + ruta, { metodo: 'PATCH', json: campos, prefer: op && op.devolver ? 'return=representation' : 'return=minimal' }); },
      borrar: function (ruta) { return conToken('/rest/v1/' + ruta, { metodo: 'DELETE' }); },
      rpc: function (fn, args) { return conToken('/rest/v1/rpc/' + fn, { metodo: 'POST', json: args || {} }); },
      // Archivos. Una ruta ya existente cuenta como subida (los nombres son la huella del contenido).
      subir: function (bucket, ruta, blob, tipo) {
        return conToken('/storage/v1/object/' + bucket + '/' + ruta, { metodo: 'POST', cuerpo: blob, tipo: tipo || blob.type, espera: 60000 })
          .then(function () { return true; }, function (e) { if (e.status === 409 || /exist|duplicate/i.test(e.message)) return true; throw e; });
      },
      // Los nombres de una carpeta, por páginas de 1000.
      listar: function (bucket, prefijo) {
        var out = [];
        function pagina(desde) {
          return conToken('/storage/v1/object/list/' + bucket, { metodo: 'POST', json: { prefix: prefijo, limit: 1000, offset: desde } })
            .then(function (l) { (l || []).forEach(function (x) { out.push(x.name); }); return (l || []).length === 1000 ? pagina(desde + 1000) : out; });
        }
        return pagina(0);
      },
      quitar: function (bucket, rutas) { return conToken('/storage/v1/object/' + bucket, { metodo: 'DELETE', json: { prefixes: rutas } }); },
      // URL firmadas de varias rutas a la vez, por la función `firmar` del servidor: {ruta: url}. Solo salen las que usa algo
      // que esta persona puede ver, con caducidad fija (10 min las fotos, 60 s las facturas); las demás no salen.
      firmar: function (bucket, rutas) {
        if (!rutas.length) return Promise.resolve({});
        return conToken('/functions/v1/firmar', { metodo: 'POST', json: { bucket: bucket, rutas: rutas.slice(0, 100) } })
          .then(function (r) { return (r && r.urls) || {}; });
      },
    };
    return api;
  }

  window.Supa = { crear: crear, Error: SupaError, version: V };
})();
