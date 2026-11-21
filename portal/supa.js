// Cliente mínimo de Supabase, sin dependencias (D-241): entrada con código por correo, datos y archivos privados.
// Lo usan el portal de clientes (portal/) y la Mesa de Kevin (web.js). Expone `window.Supa.crear({url, publica, clave, almacen})`.
// La sesión vive en localStorage bajo `clave` (por origen), o donde diga `almacen` ({leer, guardar, oir}: la Mesa la guarda
// cifrada, D-262); nunca se escribe en consola ni en avisos. La Mesa entra además con contraseña y el código de su app (TOTP).
(function () {
  'use strict';
  var V = '1.4';

  function SupaError(mensaje, status, codigo, detalle) { this.name = 'SupaError'; this.message = mensaje; this.status = status || 0; this.codigo = codigo || ''; this.statusCode = detalle && detalle.statusCode != null ? String(detalle.statusCode) : ''; this.error = detalle && typeof detalle.error === 'string' ? detalle.error : ''; }
  SupaError.prototype = Object.create(Error.prototype);

  function guardado(k) { try { var t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function guardar(k, v) { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch (e) { /* sin almacenamiento: la sesión dura lo que la pestaña */ } }

  // Lo que dice el token de la sesión (sin comprobar su firma: solo para decidir qué pedir; quien decide es el servidor).
  function leerToken(tk) {
    try { var b = String(tk).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))))); }
    catch (e) { return null; }
  }

  function crear(o) {
    if (!o || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(String(o.url || '').replace(/\/$/, ''))) throw new SupaError('proyecto sin configurar', 0, 'config');
    var url = o.url.replace(/\/$/, ''), publica = o.publica, clave = o.clave || ('supa-' + url.split('//')[1].split('.')[0]);
    // Dónde vive la sesión: por defecto, localStorage bajo `clave` (el portal); la Mesa da el suyo (D-262).
    var alm = o.almacen || { leer: function () { return guardado(clave); }, guardar: function (s) { guardar(clave, s); },
      oir: function (f) { try { window.addEventListener('storage', function (e) { if (e.key === clave) f(guardado(clave)); }); } catch (e) { /* sin ventana (pruebas) */ } } };
    var ses = alm.leer(), renovando = null, oyentes = [];

    function avisar() { oyentes.slice().forEach(function (f) { try { f(ses ? { id: ses.user.id, email: ses.user.email } : null); } catch (e) { /* un oyente roto no para a los demás */ } }); }
    function ponerSesion(s) {
      ses = s && s.access_token ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || (Math.floor(Date.now() / 1000) + (s.expires_in || 3600)), user: { id: s.user.id, email: s.user.email } } : null;
      alm.guardar(ses); avisar();
    }
    alm.oir(function (s) { ses = s || null; avisar(); });   // otra pestaña la renovó o la quitó

    function pedir(ruta, op) {
      op = op || {};
      var h = { apikey: publica };
      if (op.token) h.Authorization = 'Bearer ' + op.token;
      if (op.json !== undefined) h['Content-Type'] = 'application/json';
      if (op.tipo) h['Content-Type'] = op.tipo;
      if (op.prefer) h.Prefer = op.prefer;
      if (op.upsert) h['x-upsert'] = 'true';
      if (op.binario) h.Accept = '*/*';
      var ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, op.espera || 20000);
      return fetch(url + ruta, { method: op.metodo || 'GET', headers: h, body: op.json !== undefined ? JSON.stringify(op.json) : op.cuerpo, signal: ctl && ctl.signal })
        .then(function (r) {
          if (t) clearTimeout(t);
          if (op.binario && r.ok) return r.blob();   // un archivo (la Mesa, lote 4): sus bytes tal cual
          return r.text().then(function (txt) {
            var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { /* no es JSON */ }
            if (!r.ok) {
              var m = (j && (j.msg || j.message || j.error_description || j.error)) || ('error ' + r.status);
              throw new SupaError(String(m).slice(0, 300), r.status, (j && (j.error_code || j.code || j.statusCode)) || '', j);
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
      // otra pestaña pudo renovarla ya: la más nueva del almacén, antes de renovar con un refresh token que ya no vale (D-262)
      var fresca = null; try { fresca = alm.leer(); } catch (e) { fresca = null; }
      if (fresca && fresca.refresh_token && fresca.refresh_token !== ses.refresh_token && fresca.expires_at >= ses.expires_at) { ses = fresca; if (ses.expires_at - Date.now() / 1000 > 60) return Promise.resolve(ses.access_token); }
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
            if (e.status === 429) {   // un código por minuto y correo («after N seconds»), o el tope de códigos por hora de todo el portal (D-247)
              var s = /after (\d+) second/i.exec(e.message);
              throw new SupaError(s ? 'acabas de pedir uno: espera ' + s[1] + ' segundos y pide otro' : 'se han pedido muchos códigos en poco tiempo: inténtalo dentro de un rato', 429, 'espera');
            }
            if (e.status === 0) throw e;
            if (e.status >= 500) throw new SupaError('no se pudo enviar el código: inténtalo en un momento', e.status, 'servidor');
            return true;   // un correo sin acceso no se distingue de uno con acceso
          });
      },
      verificarCodigo: function (correo, codigo) {
        return pedir('/auth/v1/verify', { metodo: 'POST', json: { type: 'email', email: correo, token: String(codigo).replace(/\D/g, '') } })
          .then(function (s) { ponerSesion(s); return api.usuario(); }, function (e) {
            if (e.status === 429) throw new SupaError('demasiados intentos: espera unos minutos y vuelve a probar', 429, 'espera');   // el real deja 10 por IP cada 5 min (D-278, D-280)
            if (e.status === 0) throw e;
            throw new SupaError('ese código no vale o ha caducado', e.status, 'codigo');
          });
      },
      // ---- La entrada de la Mesa (D-262): contraseña y el código de la app (TOTP). El portal no los usa. ----
      entrarConContrasena: function (correo, contrasena) {
        return pedir('/auth/v1/token?grant_type=password', { metodo: 'POST', json: { email: correo, password: contrasena } })
          .then(function (s) { ponerSesion(s); return api.usuario(); }, function (e) {
            if (e.status === 429) throw new SupaError('demasiados intentos: espera un rato', 429, 'espera');
            if (e.status === 0) throw e;
            if (e.status === 400 || e.status === 401 || e.status === 422) throw new SupaError('el correo o la contraseña no son correctos', e.status, 'credenciales');
            throw new SupaError('no se pudo entrar: inténtalo en un momento', e.status, 'servidor');
          });
      },
      // Lo que dice la sesión de ahora: nivel (aal1 / aal2) y la hora (s) del último código de la app, o null.
      nivel: function () {
        var c = ses && leerToken(ses.access_token); if (!c) return null;
        var t = null; (Array.isArray(c.amr) ? c.amr : []).forEach(function (e) { if (e && e.method === 'totp' && +e.timestamp > (t || 0)) t = +e.timestamp; });
        return { aal: c.aal || 'aal1', totp: t, sesion: c.session_id || null };
      },
      // La sesión con un token vigente (renueva si hace falta) y su nivel.
      vigente: function () { return token().then(function () { return api.nivel(); }); },
      factores: function () {
        return conToken('/auth/v1/user').then(function (u) {
          return ((u && u.factors) || []).filter(function (f) { return f.factor_type === 'totp'; }).map(function (f) { return { id: f.id, verificado: f.status === 'verified', nombre: f.friendly_name || '' }; });
        });
      },
      // Alta del código en la app: quita antes los que se quedaron sin verificar (un alta a medias) y da el QR (SVG) y la clave.
      altaApp: function (op) {
        op = op || {};
        return api.factores().then(function (l) {
          return l.filter(function (f) { return !f.verificado; }).reduce(function (p, f) { return p.then(function () { return conToken('/auth/v1/factors/' + f.id, { metodo: 'DELETE' }); }); }, Promise.resolve());
        }).then(function () {
          return conToken('/auth/v1/factors', { metodo: 'POST', json: { factor_type: 'totp', issuer: op.emisor || 'Mesa Uribe Visuals', friendly_name: op.nombre || 'Contraseñas' } });
        }).then(function (f) { return { id: f.id, qr: f.totp && f.totp.qr_code, clave: f.totp && f.totp.secret, uri: f.totp && f.totp.uri }; }, function (e) {
          if (e.status === 0) throw e;
          if (e.status === 403 || e.status === 422) throw new SupaError('esta cuenta ya tiene su código: entra con él', e.status, 'nivel');
          throw e;
        });
      },
      // Escribe el código de la app en la sesión de ahora: sale `aal2` (y la hora del código, al día).
      verificarApp: function (factorId, codigo) {
        var c = String(codigo || '').replace(/\D/g, '');
        return conToken('/auth/v1/factors/' + factorId + '/challenge', { metodo: 'POST', json: {} })
          .then(function (ch) { return conToken('/auth/v1/factors/' + factorId + '/verify', { metodo: 'POST', json: { challenge_id: ch.id, code: c } }); })
          .then(function (s) { ponerSesion(Object.assign({ user: ses && ses.user }, s)); return api.nivel(); }, function (e) {
            if (e.status === 429) throw new SupaError('demasiados intentos: espera un rato', 429, 'espera');
            if (e.status === 0) throw e;
            if (e.status === 400 || e.status === 422) throw new SupaError('ese código no vale: escribe el que se ve ahora en la app', e.status, 'codigo');
            throw e;
          });
      },
      // Contraseña nueva (alta, «¿Olvidaste?»). Con el código de la app activo, Supabase la pide en una sesión `aal2`.
      ponerContrasena: function (nueva) {
        return conToken('/auth/v1/user', { metodo: 'PUT', json: { password: nueva } }).then(function () { return true; }, function (e) {
          if (e.status === 0) throw e;
          var c = String(e.codigo || '');
          if (c === 'weak_password' || /password/i.test(e.message) && e.status === 422) throw new SupaError('la contraseña es demasiado corta: al menos 20 caracteres', e.status, 'debil');
          if (c === 'insufficient_aal') throw new SupaError('falta el código de tu app', e.status, 'nivel');
          if (c === 'reauthentication_needed') throw new SupaError('hace falta confirmar con un código por correo', e.status, 'reautenticar');
          if (c === 'same_password') throw new SupaError('es la misma que ya tenías', e.status, 'igual');
          throw e;
        });
      },
      // Cierra las sesiones de esta cuenta en los demás ordenadores (esta sigue).
      salirOtros: function () { return conToken('/auth/v1/logout?scope=others', { metodo: 'POST' }).then(function () { return true; }); },
      // Solo para las pruebas: una sesión obtenida fuera (Node, contraseña de un usuario inventado del proyecto de pruebas).
      _sesion: function (s) { ponerSesion(s); },
      // Salir. Sin nada, como siempre (todas las sesiones de la cuenta); con 'local', solo esta (la Mesa: «Otra cuenta», D-262).
      salir: function (alcance) {
        var tk = ses && ses.access_token; ponerSesion(null);
        return tk ? pedir('/auth/v1/logout' + (alcance === 'local' ? '?scope=local' : ''), { metodo: 'POST', token: tk }).catch(function () { return null; }) : Promise.resolve(null);
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
      // Archivos. Una ruta ya existente cuenta como subida (los nombres son la huella del contenido): solo el 409 (o un cuerpo
      // con `statusCode` 409, «Duplicate»), nunca otro error cuyo texto diga «exist».
      subir: function (bucket, ruta, blob, tipo) {
        return conToken('/storage/v1/object/' + bucket + '/' + ruta, { metodo: 'POST', cuerpo: blob, tipo: tipo || blob.type, espera: 120000 })
          .then(function () { return true; }, function (e) { if (e.status === 409 || String(e.codigo) === '409' || e.statusCode === '409' || /^duplicate$/i.test(e.error) || e.codigo === 'KeyAlreadyExists') return true; throw e; });
      },
      // Los bytes de un archivo privado, con la sesión (la Mesa, lote 4): Blob.
      archivo: function (bucket, ruta) {
        return conToken('/storage/v1/object/authenticated/' + bucket + '/' + ruta, { binario: true, espera: 120000 });
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
