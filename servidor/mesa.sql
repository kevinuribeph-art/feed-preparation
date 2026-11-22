-- Mesa de trabajo · copia en el servidor (Supabase, Postgres 15+). Lote 2 del traspaso C (.claude/rediseno/traspaso/plan.md).
-- Un registro por cada registro de IndexedDB de la Mesa, su historial, el turno (qué ordenador tiene la Mesa), la versión
-- mínima de la app, la época, el registro de actividad y las fotos en un almacenamiento privado. El contrato para los lotes
-- 3 a 6 está en .claude/rediseno/traspaso/contrato.md (fuera de git).
-- Lo aplica `node tools/web.mjs mesa <pruebas|real>` (en el real, con `--si`); la versión mínima, `mesa-version`; la época,
-- `mesa-epoca`; la actividad se mira con `actividad`.
-- Necesita `servidor/esquema.sql` (usa `public.es_dueno()`) y no cambia nada del portal: ni sus funciones, ni sus tablas, ni
-- sus políticas `archivos_*`.
--
-- Se puede aplicar varias veces sin perder datos: crea lo que falta (`if not exists`), rehace funciones (`create or replace`),
-- permisos, disparadores y sus propias políticas `mesa_*`; nunca `drop table` ni `truncate`. Una función que cambie de
-- parámetros necesita antes su `drop function if exists` con la firma vieja (si no, quedarían dos y PostgREST no sabría cuál
-- llamar). Lleva su versión (`v_archivo`, abajo): súbela en cada cambio; un archivo más viejo que el aplicado no se aplica.
--
-- Reglas (plan: «Lo que guarda el servidor», «Reglas para construirlo»; lecciones 88, 89, 94, 118, 120, 121, 136):
--   · Solo Kevin (`public.duenos`). Cada función `mesa_*` empieza comprobando `dueno_cuenta()` (si no, «ajeno») y después
--     `es_dueno()`, que con el interruptor encendido pide además el código de su app (si no, el rechazo `verificacion`, D-262) y
--     su sesión abierta en `auth.sessions` (si no, el rechazo `sesion`: cerró todas, D-298). El esquema `mesa` no se expone en
--     la API (no está en los esquemas de PostgREST) y nadie más que su dueño lo usa; las funciones son la única puerta.
--   · La hora la pone el servidor (`now()`), nunca el aparato; las respuestas dan la hora del servidor y las edades en
--     segundos, para que el cliente no use su reloj.
--   · Una Mesa a la vez: el turno, con un número que crece cada vez que alguien la reclama. Una escritura con un turno que no
--     es el vigente se rechaza entera, y también la de una app más vieja que la mínima (D-060 entre ordenadores). Quitarle la
--     Mesa a otro ordenador lo decide Kevin (`forzar`) y queda apuntado.
--   · Cada registro lleva su versión (la sube el servidor). Un cambio sobre una versión que no es la última se rechaza solo
--     (los demás del lote entran) y dice cuál es la última y quién la escribió.
--   · Se baja por número de orden, nunca por hora, y por páginas. El número se da con la fila del turno bloqueada, de un
--     contador de esa fila (no de una secuencia, que no es transaccional): nunca se confirma un número menor después de uno
--     mayor, así que quien baja «desde N» no se salta nada. La época (un uuid) cambia si se restaura una copia: los cursores
--     y las versiones de otra época no valen.
--   · Nada se borra de verdad: un borrado deja el registro con `valor` nulo (lápida) y su último valor en el historial.
--   · Historial: la versión anterior de cada registro, 30 días. Siempre si la escribió otro ordenador u otro turno; entre
--     escrituras del mismo ordenador y turno, como mucho una cada 5 minutos. Lo poda la propia escritura, como mucho 50 filas
--     por llamada (sin pg_cron).
--   · Topes de un lote: 500 cambios, 2 MB por valor y 4 MB en total (los tableros reales pesan de 13 a 413 KB).
--   · Actividad (`mesa.actividad`): llamadas de quien no es Kevin, rechazos, choques, reclamos del turno y borrados masivos.
--     Solo se añaden filas (un disparador impide todo lo demás, salvo la poda de 90 días que hace la propia escritura).
--     Nunca valores de registros, tokens, claves ni IP.
--   · Un rechazo NO es un error HTTP: una fila escrita en la misma transacción que acaba en `raise` se desharía con ella. Las
--     funciones apuntan la fila y devuelven, con HTTP 200, `{ok: false, error: {codigo, http, mensaje, …}}`; lo que sale
--     bien lleva `ok: true`. Errores HTTP solo quedan para lo que no llega a la función (sin sesión: 401; nombre o
--     parámetros mal: 404; un texto que `jsonb` no admite: 400) o un fallo inesperado (5xx).

do $$
declare
  v_archivo constant integer := 6;   -- la versión de este archivo (súbela en cada cambio). 3: mesa_turno_ver (lote 3). 4: el código de la app y `total` (D-262). 5: el portal en «Avisos» (D-278). 6: «Es mío» / «No lo reconozco», la sesión cerrada y «Visto» en el servidor (D-298, D-299)
  v_aplicada integer := 0;
begin
  if to_regprocedure('public.es_dueno()') is null or to_regprocedure('public.dueno_cuenta()') is null
     or to_regprocedure('public.sesion_viva()') is null then
    raise exception 'falta servidor/esquema.sql (con dueno_cuenta, D-262, y sesion_viva, D-298): aplícalo antes (node tools/web.mjs esquema …)';
  end if;
  if to_regclass('mesa.ajustes') is not null then
    select coalesce((to_jsonb(a) ->> 'esquema')::integer, 0) into v_aplicada from mesa.ajustes a where a.id;
  end if;
  if coalesce(v_aplicada, 0) > v_archivo then
    raise exception 'este mesa.sql (esquema %) es más viejo que el aplicado (%): no se aplica', v_archivo, v_aplicada;
  end if;
  perform set_config('mesa.esquema_archivo', v_archivo::text, true);   -- lo apunta la última línea
end $$;

create schema if not exists mesa;

-- ───────────────────────── Tablas ─────────────────────────

-- Una sola fila: la versión mínima de la Mesa que puede escribir (la pone `tools/web.mjs mesa-version`; aplicar este archivo
-- otra vez no la cambia; «0.0»: sin mínima), la época (un uuid que solo cambia a mano, con `mesa-epoca`, tras restaurar una
-- copia de la base) y la versión de este archivo que está aplicada.
create table if not exists mesa.ajustes (
  id             boolean primary key default true check (id),
  version_minima text not null default '0.0' check (version_minima ~ '^[0-9]{1,4}\.[0-9]{1,4}$'),
  cambiada       timestamptz not null default now()
);
insert into mesa.ajustes (id) values (true) on conflict (id) do nothing;
alter table mesa.ajustes add column if not exists epoca uuid not null default gen_random_uuid();
alter table mesa.ajustes add column if not exists esquema integer not null default 0;

-- El turno (una sola fila): qué ordenador tiene la Mesa y el contador de los números de orden.
create table if not exists mesa.turno (
  id          boolean primary key default true check (id),
  numero      bigint not null default 0 check (numero >= 0),   -- crece cada vez que alguien la reclama
  dispositivo text check (dispositivo is null or dispositivo ~ '^[A-Za-z0-9_-]{8,64}$'),   -- quién la tiene (null: nadie)
  desde       timestamptz,                                      -- desde cuándo la tiene
  latido      timestamptz,                                      -- su último latido (o escritura)
  cola        integer check (cola is null or cola >= 0),        -- cambios en cola que dijo en ese latido
  cola_desde  timestamptz,                                      -- desde qué latido dice tener cola sin vaciar
  pide        text check (pide is null or pide ~ '^[A-Za-z0-9_-]{8,64}$'),   -- quién la pide (pedirla no la cambia)
  pide_desde  timestamptz,
  orden       bigint not null default 0 check (orden >= 0),     -- el último número de orden dado
  check ((dispositivo is null) = (desde is null)),
  check ((pide is null) = (pide_desde is null))
);
insert into mesa.turno (id) values (true) on conflict (id) do nothing;
-- La última vez que quien la pide volvió a pedirla: una petición que nadie renueva es de alguien que se fue.
alter table mesa.turno add column if not exists pide_ultima timestamptz;

-- Un registro por cada (almacén, clave) de IndexedDB. Las claves son texto: en la 4.29 todas lo son (ids y «cliente|AAAA-MM»).
create table if not exists mesa.registros (
  almacen     text not null check (almacen ~ '^[a-z][a-z0-9_]{0,39}$'),
  clave       text not null check (char_length(clave) between 1 and 512),
  valor       jsonb,                                            -- null: borrado (lápida)
  version     bigint not null check (version >= 1),             -- la sube el servidor en cada escritura
  orden       bigint not null check (orden >= 1),               -- número de orden de su última escritura
  app         text not null check (app ~ '^[0-9]{1,4}\.[0-9]{1,4}$'),   -- versión de la Mesa que la escribió
  dispositivo text not null check (dispositivo ~ '^[A-Za-z0-9_-]{8,64}$'),
  hora        timestamptz not null default now(),               -- hora del servidor de su última escritura
  borrado     timestamptz,                                      -- cuándo se borró (null: vivo)
  primary key (almacen, clave),
  check ((valor is null) = (borrado is not null))
);
create unique index if not exists registros_orden on mesa.registros (orden);
-- El turno con que se escribió (null en lo escrito antes de esta columna): con el dispositivo, dice si un choque es el propio
-- lote de quien lo manda, cuya respuesta se perdió.
alter table mesa.registros add column if not exists turno bigint;

-- Versiones anteriores, 30 días. Nunca una lápida (no hay nada que recuperar).
create table if not exists mesa.historial (
  id          bigint generated always as identity primary key,
  almacen     text not null,
  clave       text not null,
  valor       jsonb not null,
  version     bigint not null,
  orden       bigint not null,
  app         text not null,
  dispositivo text not null,
  hora        timestamptz not null,                             -- cuándo se escribió esa versión
  guardada    timestamptz not null default now()                -- cuándo pasó al historial
);
create index if not exists historial_clave on mesa.historial (almacen, clave, guardada desc);
create index if not exists historial_guardada on mesa.historial (guardada);
alter table mesa.historial add column if not exists turno bigint;

-- Registro de actividad: solo se añaden filas. Nunca valores de registros, tokens, claves ni IP (una IP sería un dato personal
-- de los clientes). El detalle es corto (2 KB como mucho): almacén, clave (un id), cuántos, el código del rechazo, la app…
create table if not exists mesa.actividad (
  id          bigint generated always as identity primary key,   -- se confirman en orden (bloqueo propio en `mesa.apuntar`)
  hora        timestamptz not null default now(),
  tipo        text not null check (tipo ~ '^[a-z_]{1,40}$'),
  usuario     uuid,                                               -- auth.uid() de quien llamó
  dispositivo text check (dispositivo is null or dispositivo ~ '^[A-Za-z0-9_-]{8,64}$'),   -- el que envió la Mesa
  detalle     jsonb not null default '{}' check (jsonb_typeof(detalle) = 'object' and octet_length(detalle::text) <= 2048)
);
create index if not exists actividad_hora on mesa.actividad (hora);
create index if not exists actividad_usuario on mesa.actividad (usuario, hora);
-- La sesión de entrada (`session_id` del token): distingue dos aparatos con la misma cuenta.
alter table mesa.actividad add column if not exists sesion text check (sesion is null or char_length(sesion) <= 64);

-- Los ordenadores que han tenido la Mesa alguna vez: «nunca visto» no depende del historial ni de ninguna poda.
create table if not exists mesa.dispositivos (
  dispositivo text primary key check (dispositivo ~ '^[A-Za-z0-9_-]{8,64}$'),
  primera     timestamptz not null default now(),                 -- la primera vez que la reclamó
  usuario     uuid
);

-- Lo que Kevin dijo de cada aparato (esquema 6, D-298): «Es mío» (`reconocido`) o «No lo reconozco» (`rechazado`, que además
-- cerró todas sus sesiones). Lo último que dijo manda: una de las dos, o ninguna.
alter table mesa.dispositivos add column if not exists reconocido timestamptz;
alter table mesa.dispositivos add column if not exists rechazado timestamptz;

-- «Visto» de los avisos de «Nube», en el servidor (esquema 6, D-299): una fila por aviso visto en cualquier aparato, con un
-- número que crece (`n`) para que cada Mesa pida solo lo nuevo. `mesa.actividad` solo admite filas nuevas, por eso va aparte;
-- se va con su aviso (la poda de 90 días de la actividad).
create table if not exists mesa.vistos (
  aviso       bigint primary key references mesa.actividad (id) on delete cascade,
  n           bigint generated always as identity unique,
  hora        timestamptz not null default now(),
  dispositivo text check (dispositivo is null or dispositivo ~ '^[A-Za-z0-9_-]{8,64}$')   -- dónde se pulsó
);

-- Solo se añaden filas a `actividad`: cambiar, vaciar o borrar se rechaza, salvo la poda de 90 días de `mesa_escribir`
-- (que lo marca con `mesa.poda` solo dentro de su transacción).
create or replace function mesa.actividad_fija() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('mesa.poda', true) = '1' then return old; end if;
  raise exception 'actividad: solo se añaden filas' using errcode = '42501';
end $$;
drop trigger if exists actividad_fija on mesa.actividad;
create trigger actividad_fija before update or delete on mesa.actividad for each row execute function mesa.actividad_fija();
drop trigger if exists actividad_fija_vaciar on mesa.actividad;
create trigger actividad_fija_vaciar before truncate on mesa.actividad for each statement execute function mesa.actividad_fija();

-- ───────────────────────── Permisos del esquema ─────────────────────────
-- Nadie más que su dueño: ni uso del esquema ni de sus tablas para anon, authenticated ni service_role. RLS activo y sin
-- políticas, por si algún día alguien concede algo: no se vería ninguna fila. Las funciones `mesa_*` (security definer)
-- entran como dueño.

revoke all on schema mesa from public, anon, authenticated, service_role;
revoke all on all tables in schema mesa from public, anon, authenticated, service_role;
revoke all on all sequences in schema mesa from public, anon, authenticated, service_role;
alter table mesa.ajustes      enable row level security;
alter table mesa.turno        enable row level security;
alter table mesa.registros    enable row level security;
alter table mesa.historial    enable row level security;
alter table mesa.actividad    enable row level security;
alter table mesa.dispositivos enable row level security;
alter table mesa.vistos       enable row level security;

-- ───────────────────────── Ayudantes (solo para las funciones `mesa_*`) ─────────────────────────

drop function if exists mesa.comprobar(text, text);

-- «4.10» → {4,10}: las versiones se comparan como números (4.9 < 4.10), nunca como texto.
create or replace function mesa.version_num(v text) returns integer[]
  language sql immutable strict set search_path = '' as $$
  select array[split_part(v, '.', 1)::integer, split_part(v, '.', 2)::integer];
$$;

-- Una versión de app solo si está bien escrita (en la actividad no entra texto libre).
create or replace function mesa.app_ok(a text) returns text
  language sql immutable set search_path = '' as $$
  select case when a ~ '^[0-9]{1,4}\.[0-9]{1,4}$' then a end;
$$;

create or replace function mesa.epoca() returns uuid
  language sql stable set search_path = '' as $$
  select x.epoca from mesa.ajustes x where x.id;
$$;

-- La forma única de un rechazo: `{ok: false, error: {codigo, http, mensaje, …}}` (HTTP 200: ver la cabecera).
create or replace function mesa.rechazo(codigo text, http integer, mensaje text, extra jsonb default '{}') returns jsonb
  language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', false,
    'error', jsonb_build_object('codigo', codigo, 'http', http, 'mensaje', mensaje) || coalesce(extra, '{}'::jsonb));
$$;

-- Apuntar una fila de actividad. El bloqueo hace que dos llamadas a la vez confirmen sus filas en el orden de sus ids, así
-- que leer «desde el id N» no se salta ninguna. Un detalle de más de 2 KB pierde antes claves de su muestra (la mitad cada
-- vez) y, si aún no cabe, se queda en lo esencial (función, código, tope, cuántos, almacén y almacenes): la fila no se pierde.
create or replace function mesa.apuntar(p_tipo text, p_disp text, p_det jsonb) returns void
  language plpgsql volatile set search_path = '' as $$
declare
  v_det jsonb := coalesce(p_det, '{}'::jsonb);
  v_n integer;
begin
  if octet_length(v_det::text) > 2048 and jsonb_typeof(v_det -> 'claves') = 'array' then
    v_n := jsonb_array_length(v_det -> 'claves');
    while v_n > 0 and octet_length(v_det::text) > 2048 loop
      v_n := v_n / 2;
      v_det := jsonb_set(v_det, '{claves}', coalesce((select jsonb_agg(e.v order by e.i) from jsonb_array_elements(v_det -> 'claves')
                 with ordinality e(v, i) where e.i <= v_n), '[]'::jsonb)) || jsonb_build_object('recortado', true);
    end loop;
  end if;
  if octet_length(v_det::text) > 2048 then
    v_det := jsonb_strip_nulls(jsonb_build_object('recortado', true, 'funcion', v_det -> 'funcion', 'codigo', v_det -> 'codigo',
      'tope', v_det -> 'tope', 'cuantos', v_det -> 'cuantos', 'almacen', left(v_det ->> 'almacen', 40),
      'almacenes', case when octet_length((v_det -> 'almacenes')::text) <= 1024 then v_det -> 'almacenes' end));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('mesa.actividad', 0));
  insert into mesa.actividad (tipo, usuario, sesion, dispositivo, detalle)
  values (p_tipo, auth.uid(), left(auth.jwt() ->> 'session_id', 64),
          case when p_disp ~ '^[A-Za-z0-9_-]{8,64}$' then p_disp end, v_det);
end $$;

-- Un rechazo de Kevin: deja su fila (`tipo = 'rechazo'`, con la función y el código) salvo que el mismo rechazo (dispositivo,
-- función, código y tope) ya se apuntara hace menos de un minuto, y se devuelve con la época.
create or replace function mesa.rechazar(p_fn text, p_disp text, p_r jsonb, p_det jsonb default '{}') returns jsonb
  language plpgsql volatile set search_path = '' as $$
declare
  v_cod text := p_r #>> '{error,codigo}';
  v_tope text := coalesce(p_det ->> 'tope', p_r #>> '{error,tope}');
  v_disp text := case when p_disp ~ '^[A-Za-z0-9_-]{8,64}$' then p_disp end;
begin
  perform pg_advisory_xact_lock(hashtextextended('mesa.actividad', 0));
  if not exists (select 1 from mesa.actividad a
                  where a.tipo = 'rechazo' and a.hora > now() - interval '1 minute' and a.dispositivo is not distinct from v_disp
                    and a.detalle ->> 'funcion' = p_fn and a.detalle ->> 'codigo' = v_cod
                    and (a.detalle ->> 'tope') is not distinct from v_tope) then
    perform mesa.apuntar('rechazo', v_disp, jsonb_build_object('funcion', p_fn, 'codigo', v_cod, 'http', p_r #> '{error,http}')
                                            || coalesce(p_det, '{}'::jsonb));
  end if;
  return p_r || jsonb_build_object('epoca', mesa.epoca());
end $$;

-- Una llamada de una sesión que no es la de Kevin: se apunta y se rechaza sin decir nada del contenido. Como mucho 10 filas
-- por minuto y usuario, y 60 por minuto entre todos (al llegar, una fila `ajeno_tope` por minuto): nadie llena la tabla.
create or replace function mesa.ajeno(p_fn text, p_disp text) returns jsonb
  language plpgsql volatile set search_path = '' as $$
declare
  v_suyas integer;
  v_todas integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('mesa.actividad', 0));
  select count(*) filter (where a.usuario is not distinct from auth.uid()), count(*) into v_suyas, v_todas
    from mesa.actividad a where a.tipo = 'ajeno' and a.hora > now() - interval '1 minute';
  if v_todas >= 60 then
    if not exists (select 1 from mesa.actividad a where a.tipo = 'ajeno_tope' and a.hora > now() - interval '1 minute') then
      perform mesa.apuntar('ajeno_tope', p_disp, jsonb_build_object('funcion', p_fn, 'en_un_minuto', v_todas));
    end if;
  elsif v_suyas < 10 then
    perform mesa.apuntar('ajeno', p_disp, jsonb_build_object('funcion', p_fn));
  end if;
  return mesa.rechazo('permiso', 403, 'sin permiso');
end $$;

-- Kevin sin un código de su app de los últimos 30 días (D-262): su propio rechazo, `verificacion`, nunca «ajeno». Se apunta
-- como cualquier rechazo (uno por minuto, dispositivo y función): sin el código, alguien con su contraseña también llega aquí.
-- Antes, si su sesión ya no está abierta (cerró todas con «No lo reconozco», `rescate` o una contraseña nueva: D-298), el rechazo
-- `sesion`: la Mesa lleva a entrar otra vez, sin pedir el código ni apartar nada.
create or replace function mesa.sin_codigo(p_fn text, p_disp text) returns jsonb
  language plpgsql volatile set search_path = '' as $$
begin
  if not public.sesion_viva() then
    return mesa.rechazar(p_fn, p_disp, mesa.rechazo('sesion', 401, 'la sesión se cerró: entra otra vez'));
  end if;
  return mesa.rechazar(p_fn, p_disp, mesa.rechazo('verificacion', 401, 'falta el código de tu app: escríbelo para seguir'));
end $$;

-- El dispositivo y la versión de la app: forma y mínima. Null si valen; si no, el rechazo (sin apuntar: lo hace quien llama).
create or replace function mesa.validar(d text, a text) returns jsonb
  language plpgsql stable set search_path = '' as $$
declare
  v_min text;
begin
  if d is null or d !~ '^[A-Za-z0-9_-]{8,64}$' then
    return mesa.rechazo('forma', 400, 'dispositivo no válido: de 8 a 64 letras, cifras, - o _');
  end if;
  if a is null or a !~ '^[0-9]{1,4}\.[0-9]{1,4}$' then return mesa.rechazo('forma', 400, 'app no válida: su versión como «4.31»'); end if;
  select x.version_minima into v_min from mesa.ajustes x where x.id;
  if mesa.version_num(a) < mesa.version_num(v_min) then
    return mesa.rechazo('app', 426, format('esta Mesa es más vieja que la mínima (%s): recárgala', v_min),
                        jsonb_build_object('version_minima', v_min));
  end if;
  return null;
end $$;

-- Segundos desde una hora, según el servidor; nunca negativos (`now()` es la hora en que empezó la transacción).
create or replace function mesa.hace(h timestamptz) returns bigint
  language sql stable set search_path = '' as $$
  select case when h is null then null else greatest(0, floor(extract(epoch from now() - h)))::bigint end;
$$;

-- Lo que dicen las funciones del turno: el turno vigente, quién lo tiene y quién lo pide, con la hora del servidor, las
-- edades en segundos (sin el reloj del aparato) y la época.
create or replace function mesa.turno_json(t mesa.turno, yo text) returns jsonb
  language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'ok', true,
    'turno', t.numero,
    'tuyo', t.dispositivo is not null and t.dispositivo = yo,
    'libre', t.dispositivo is null,
    'tiene', case when t.dispositivo is null then null else jsonb_build_object(
      'dispositivo', t.dispositivo, 'desde', t.desde,
      'latido', t.latido, 'latido_hace', mesa.hace(t.latido),
      'cola', t.cola, 'cola_desde', t.cola_desde, 'cola_hace', mesa.hace(t.cola_desde)) end,
    'pide', case when t.pide is null then null else jsonb_build_object(
      'dispositivo', t.pide, 'desde', t.pide_desde, 'hace', mesa.hace(t.pide_desde),
      'ultima', coalesce(t.pide_ultima, t.pide_desde), 'ultima_hace', mesa.hace(coalesce(t.pide_ultima, t.pide_desde)),
      'tuyo', t.pide = yo) end,
    'orden', t.orden,
    'version_minima', (select x.version_minima from mesa.ajustes x where x.id),
    'epoca', mesa.epoca(),
    'hora', now());
$$;

revoke all on function mesa.version_num(text), mesa.app_ok(text), mesa.epoca(), mesa.rechazo(text, integer, text, jsonb),
  mesa.apuntar(text, text, jsonb), mesa.rechazar(text, text, jsonb, jsonb), mesa.ajeno(text, text), mesa.sin_codigo(text, text), mesa.validar(text, text),
  mesa.hace(timestamptz), mesa.turno_json(mesa.turno, text), mesa.actividad_fija() from public, anon, authenticated, service_role;

-- ───────────────────────── El turno, en dos fases ─────────────────────────
-- El que llega la pide (`mesa_turno_pedir`); el que la tiene lo ve en su latido (`mesa_turno_latido`), sube su cola y la
-- suelta (`mesa_turno_soltar`); el que llega la reclama (`mesa_turno_reclamar`). Si el que la tiene no contesta, Kevin decide
-- quitársela (`forzar`): desde ese momento el turno viejo ya no escribe, y queda apuntado.

-- Pedir la Mesa: apunta quién la pide y desde cuándo (pedirla otra vez no cambia ese «desde», pero sí `ultima`: quien la
-- tiene sabe así si quien la pidió sigue esperando). No cambia quién la tiene. Sirve también para ver el turno: quien ya la
-- tiene recibe `tuyo` y su número.
create or replace function public.mesa_turno_pedir(dispositivo text, app text) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_yo text := mesa_turno_pedir.dispositivo;
  v_err jsonb;
  t mesa.turno;
begin
  if not public.dueno_cuenta() then return mesa.ajeno('mesa_turno_pedir', v_yo); end if;
  if not public.es_dueno() then return mesa.sin_codigo('mesa_turno_pedir', v_yo); end if;
  v_err := mesa.validar(v_yo, mesa_turno_pedir.app);
  if v_err is not null then
    return mesa.rechazar('mesa_turno_pedir', v_yo, v_err, jsonb_strip_nulls(jsonb_build_object('app', mesa.app_ok(mesa_turno_pedir.app))));
  end if;
  select * into t from mesa.turno where id for update;
  if t.dispositivo is distinct from v_yo then
    update mesa.turno
       set pide = v_yo, pide_desde = case when pide = v_yo then pide_desde else now() end, pide_ultima = now()
     where id returning * into t;
  end if;
  return mesa.turno_json(t, v_yo);
end $$;

-- Ver la Mesa sin pedirla (esquema 3, lote 3 del traspaso): quien abre la Mesa mira quién la tiene antes de pedirla («La Mesa
-- está abierta en <A> desde <hora>. ¿Usarla aquí?»). La misma respuesta que pedir; no apunta nada (salvo la fila «ajeno» de
-- quien no es Kevin) ni mira la versión de la app (lo miran pedir, latido, reclamar y escribir).
create or replace function public.mesa_turno_ver(dispositivo text) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_yo text := mesa_turno_ver.dispositivo;
  t mesa.turno;
begin
  if not public.dueno_cuenta() then return mesa.ajeno('mesa_turno_ver', v_yo); end if;
  if not public.es_dueno() then return mesa.sin_codigo('mesa_turno_ver', v_yo); end if;
  if v_yo is null or v_yo !~ '^[A-Za-z0-9_-]{8,64}$' then
    return mesa.rechazar('mesa_turno_ver', v_yo, mesa.rechazo('forma', 400, 'dispositivo no válido: de 8 a 64 letras, cifras, - o _'));
  end if;
  select * into t from mesa.turno where id;
  -- `total`: cuántos registros vivos hay arriba (el «N de M» de la pantalla de carga, D-262)
  return mesa.turno_json(t, v_yo) || jsonb_build_object('total', (select count(*) from mesa.registros r where r.borrado is null));
end $$;

-- El latido del que tiene la Mesa: su hora (del servidor), cuántos cambios tiene en cola y, desde el primer latido con cola
-- sin vaciar, desde cuándo. La respuesta trae la petición pendiente, si hay (`pide`).
create or replace function public.mesa_turno_latido(dispositivo text, turno bigint, app text, cola integer) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_yo text := mesa_turno_latido.dispositivo;
  v_turno bigint := mesa_turno_latido.turno;
  v_cola integer := mesa_turno_latido.cola;
  v_det jsonb := jsonb_strip_nulls(jsonb_build_object('app', mesa.app_ok(mesa_turno_latido.app), 'turno', mesa_turno_latido.turno));
  v_err jsonb;
  t mesa.turno;
begin
  if not public.dueno_cuenta() then return mesa.ajeno('mesa_turno_latido', v_yo); end if;
  if not public.es_dueno() then return mesa.sin_codigo('mesa_turno_latido', v_yo); end if;
  v_err := mesa.validar(v_yo, mesa_turno_latido.app);
  if v_err is null and (v_turno is null or v_cola is null or v_cola < 0) then v_err := mesa.rechazo('forma', 400, 'turno y cola: dos números'); end if;
  if v_err is not null then return mesa.rechazar('mesa_turno_latido', v_yo, v_err, v_det); end if;
  select * into t from mesa.turno where id for update;
  if t.dispositivo is distinct from v_yo or t.numero <> v_turno then
    return mesa.rechazar('mesa_turno_latido', v_yo,
      mesa.rechazo('turno', 423, format('la Mesa la tiene otro ordenador (turno %s)', t.numero), jsonb_build_object('turno', t.numero)), v_det);
  end if;
  update mesa.turno
     set latido = now(), cola = v_cola, cola_desde = case when v_cola > 0 then coalesce(cola_desde, now()) end
   where id returning * into t;
  return mesa.turno_json(t, v_yo);
end $$;

-- La firma de antes no tenía `forzar`: fuera, para que no queden dos.
drop function if exists public.mesa_turno_reclamar(text, bigint, text);

-- Reclamar la Mesa. Si ya es de este ordenador, la conserva tal cual (sea cual sea `visto`). Sin `forzar`: solo si está libre;
-- si la tiene otro, rechazo `turno`. Con `forzar` (lo decide Kevin: «¿Usarla aquí?»): `visto` tiene que ser el turno vigente
-- (si no, `turno_cambiado`: alguien la reclamó desde que se vio) y se la quita a quien la tenga, que ya no escribe. El número
-- sube y la petición de quien la reclama se borra. `orden` es el último número de orden confirmado: hay que haber bajado hasta
-- ahí antes de escribir. Cada cambio de dueño deja una fila `turno_reclamado`; quitársela a otro, además `turno_forzado` (con
-- su latido y su cola); el primer reclamo de un ordenador, además `dispositivo_nuevo`.
create or replace function public.mesa_turno_reclamar(dispositivo text, visto bigint, app text, forzar boolean default false) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_yo text := mesa_turno_reclamar.dispositivo;
  v_visto bigint := mesa_turno_reclamar.visto;
  v_forzar boolean := coalesce(mesa_turno_reclamar.forzar, false);
  v_det jsonb := jsonb_strip_nulls(jsonb_build_object('app', mesa.app_ok(mesa_turno_reclamar.app), 'visto', mesa_turno_reclamar.visto,
                                                      'forzar', coalesce(mesa_turno_reclamar.forzar, false)));
  v_err jsonb;
  v_nuevo boolean;
  t mesa.turno;
  t0 mesa.turno;
begin
  if not public.dueno_cuenta() then return mesa.ajeno('mesa_turno_reclamar', v_yo); end if;
  if not public.es_dueno() then return mesa.sin_codigo('mesa_turno_reclamar', v_yo); end if;
  v_err := mesa.validar(v_yo, mesa_turno_reclamar.app);
  if v_err is null and v_visto is null then v_err := mesa.rechazo('forma', 400, 'visto: el número de turno que se vio'); end if;
  if v_err is not null then return mesa.rechazar('mesa_turno_reclamar', v_yo, v_err, v_det); end if;
  select * into t from mesa.turno where id for update;
  if t.dispositivo = v_yo then return mesa.turno_json(t, v_yo); end if;
  if t.dispositivo is not null and not v_forzar then
    return mesa.rechazar('mesa_turno_reclamar', v_yo,
      mesa.rechazo('turno', 423, format('la Mesa la tiene otro ordenador (turno %s)', t.numero),
                   jsonb_build_object('turno', t.numero, 'dispositivo', t.dispositivo)), v_det);
  end if;
  if v_forzar and t.numero <> v_visto then
    return mesa.rechazar('mesa_turno_reclamar', v_yo,
      mesa.rechazo('turno_cambiado', 409, format('el turno ha cambiado (ahora %s): vuelve a pedirla', t.numero), jsonb_build_object('turno', t.numero)), v_det);
  end if;
  t0 := t;
  update mesa.turno
     set numero = numero + 1, dispositivo = v_yo, desde = now(), latido = now(), cola = 0, cola_desde = null,
         pide = case when pide = v_yo then null else pide end,
         pide_desde = case when pide = v_yo then null else pide_desde end,
         pide_ultima = case when pide = v_yo then null else pide_ultima end
   where id returning * into t;
  perform mesa.apuntar('turno_reclamado', v_yo, jsonb_build_object('turno', t.numero, 'antes', t0.dispositivo,
    'forzado', t0.dispositivo is not null, 'app', mesa.app_ok(mesa_turno_reclamar.app)));
  if t0.dispositivo is not null then
    perform mesa.apuntar('turno_forzado', v_yo, jsonb_build_object('turno', t.numero, 'antes', t0.dispositivo, 'turno_antes', t0.numero,
      'latido', t0.latido, 'latido_hace', mesa.hace(t0.latido), 'cola', t0.cola, 'cola_desde', t0.cola_desde));
  end if;
  insert into mesa.dispositivos (dispositivo, usuario) values (v_yo, auth.uid())
  on conflict (dispositivo) do nothing returning true into v_nuevo;
  if v_nuevo then
    perform mesa.apuntar('dispositivo_nuevo', v_yo, jsonb_build_object('turno', t.numero, 'antes', t0.dispositivo));
  else   -- un aparato que Kevin no reconoció vuelve a coger la Mesa (D-298): otro aviso, una vez por vuelta; Kevin decide otra vez
    update mesa.dispositivos d set rechazado = null where d.dispositivo = v_yo and d.rechazado is not null returning true into v_nuevo;
    if v_nuevo then
      perform mesa.apuntar('dispositivo_nuevo', v_yo, jsonb_build_object('turno', t.numero, 'antes', t0.dispositivo, 'vuelve', true));
    end if;
  end if;
  return mesa.turno_json(t, v_yo);
end $$;

-- Soltar la Mesa: solo quien la tiene, con su número. Queda libre (con el mismo número) para quien la pidió. No mira la
-- versión de la app: soltar siempre es seguro.
create or replace function public.mesa_turno_soltar(dispositivo text, turno bigint) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_yo text := mesa_turno_soltar.dispositivo;
  v_turno bigint := mesa_turno_soltar.turno;
  t mesa.turno;
begin
  if not public.dueno_cuenta() then return mesa.ajeno('mesa_turno_soltar', v_yo); end if;
  if not public.es_dueno() then return mesa.sin_codigo('mesa_turno_soltar', v_yo); end if;
  if v_yo is null or v_yo !~ '^[A-Za-z0-9_-]{8,64}$' or v_turno is null then
    return mesa.rechazar('mesa_turno_soltar', v_yo, mesa.rechazo('forma', 400, 'dispositivo y turno'));
  end if;
  select * into t from mesa.turno where id for update;
  if t.dispositivo is distinct from v_yo or t.numero <> v_turno then
    return mesa.rechazar('mesa_turno_soltar', v_yo,
      mesa.rechazo('turno', 423, format('la Mesa la tiene otro ordenador (turno %s)', t.numero), jsonb_build_object('turno', t.numero)),
      jsonb_build_object('turno', v_turno));
  end if;
  update mesa.turno set dispositivo = null, desde = null, latido = null, cola = null, cola_desde = null
   where id returning * into t;
  return mesa.turno_json(t, v_yo);
end $$;

-- ───────────────────────── Escribir y bajar ─────────────────────────

-- La firma de antes no tenía `reescanear`: fuera, para que no queden dos.
drop function if exists public.mesa_escribir(text, bigint, text, jsonb);

-- Un lote de cambios: [{almacen, clave, base, valor}]. `base` es la versión del registro sobre la que se hizo el cambio
-- (null o 0: un registro nuevo); `valor` nulo es un borrado (lápida), y tiene que venir siempre (un `valor` que falta no se
-- toma por borrado). `reescanear`: el lote sale de volver a recorrer un almacén entero (marca del diario); con ella, cualquier
-- borrado del lote deja una fila `borrado_masivo`.
-- Topes (rechazo `tope`, HTTP 413 en el cuerpo): 500 cambios, 2 MB por valor y 4 MB el lote entero, medidos como
-- `octet_length(valor::text)`.
-- Rechaza el lote entero (nada escrito, una fila `rechazo`): sin permiso (`permiso`, fila `ajeno`), mal formado o con un
-- registro repetido (`forma`), un tope pasado (`tope`), app más vieja que la mínima (`app`), turno que no es el vigente
-- (`turno`).
-- Cada cambio, por orden: `ok` (escrito: versión y número de orden nuevos), `igual` (nada que hacer: ya tiene ese valor, sea
-- cual sea la base, o se borra lo que no está vivo; así repetir un lote cuya respuesta se perdió no choca) o `choque` (su base
-- no es la última: dice cuál es, si está borrado, su número de orden y el dispositivo y turno que la escribieron; deja una
-- fila `choque`).
-- Antes de pisar un registro vivo, su valor pasa al historial: siempre si lo escribió otro dispositivo u otro turno, o si se
-- borra; si lo escribió este mismo dispositivo en este turno, solo si el último guardado de ese registro tiene más de 5
-- minutos. Más de 20 borrados en un lote (o alguno en un lote `reescanear`) dejan una fila `borrado_masivo`.
create or replace function public.mesa_escribir(dispositivo text, turno bigint, app text, cambios jsonb, reescanear boolean default false)
  returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c_cambios constant integer := 500;        -- cambios por lote
  c_valor   constant integer := 2097152;    -- 2 MB por valor
  c_lote    constant integer := 4194304;    -- 4 MB el lote
  v_yo text := mesa_escribir.dispositivo;
  v_turno bigint := mesa_escribir.turno;
  v_app text := mesa_escribir.app;
  v_cambios jsonb := mesa_escribir.cambios;
  v_resc boolean := coalesce(mesa_escribir.reescanear, false);
  v_fn constant text := 'mesa_escribir';
  v_err jsonb;
  v_det jsonb;
  t mesa.turno;
  r mesa.registros;
  c jsonb;
  i integer := 0;
  v_alm text;
  v_cla text;
  v_base bigint;
  v_val jsonb;
  v_tam bigint;
  v_ord bigint;
  v_n integer;
  v_res jsonb[] := '{}';                    -- un arreglo de Postgres crece en su sitio; un jsonb se copiaría entero en cada vuelta
  v_choques jsonb[] := '{}';
  v_nchoques integer := 0;
  v_borrados integer := 0;
  v_por_alm jsonb := '{}'::jsonb;
  v_muestra jsonb[] := '{}';
begin
  if not public.dueno_cuenta() then return mesa.ajeno(v_fn, v_yo); end if;
  if not public.es_dueno() then return mesa.sin_codigo(v_fn, v_yo); end if;
  v_det := jsonb_strip_nulls(jsonb_build_object('app', mesa.app_ok(v_app), 'turno', v_turno, 'reescanear', v_resc,
                              'cambios', case when jsonb_typeof(v_cambios) = 'array' then jsonb_array_length(v_cambios) end));
  v_err := mesa.validar(v_yo, v_app);
  if v_err is null and v_turno is null then v_err := mesa.rechazo('forma', 400, 'falta el turno'); end if;
  if v_err is null and jsonb_typeof(v_cambios) is distinct from 'array' then v_err := mesa.rechazo('forma', 400, 'cambios: una lista'); end if;
  if v_err is not null then return mesa.rechazar(v_fn, v_yo, v_err, v_det); end if;
  v_n := jsonb_array_length(v_cambios);
  if v_n = 0 then return mesa.rechazar(v_fn, v_yo, mesa.rechazo('forma', 400, 'cambios: la lista está vacía'), v_det); end if;
  if v_n > c_cambios then
    v_det := v_det || jsonb_build_object('tope', 'cambios', 'maximo', c_cambios, 'tiene', v_n);
    return mesa.rechazar(v_fn, v_yo, mesa.rechazo('tope', 413, format('como mucho %s cambios por lote', c_cambios),
      jsonb_build_object('tope', 'cambios', 'maximo', c_cambios, 'tiene', v_n)), v_det);
  end if;
  v_tam := octet_length(v_cambios::text);
  if v_tam > c_lote then
    v_det := v_det || jsonb_build_object('tope', 'lote', 'maximo', c_lote, 'tiene', v_tam);
    return mesa.rechazar(v_fn, v_yo, mesa.rechazo('tope', 413, 'como mucho 4 MB por lote',
      jsonb_build_object('tope', 'lote', 'maximo', c_lote, 'tiene', v_tam)), v_det);
  end if;
  -- Primero la forma de todo el lote: un rechazo no deja nada a medias.
  for c in select e from jsonb_array_elements(v_cambios) e loop
    i := i + 1;
    if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c -> 'almacen') is distinct from 'string'
       or jsonb_typeof(c -> 'clave') is distinct from 'string' or not (c ? 'valor')
       or (c ? 'base' and jsonb_typeof(c -> 'base') not in ('null', 'number'))
       or (c ->> 'almacen') !~ '^[a-z][a-z0-9_]{0,39}$' or char_length(c ->> 'clave') not between 1 and 512
       or (jsonb_typeof(c -> 'base') = 'number' and (c ->> 'base') !~ '^[0-9]{1,15}$') then
      return mesa.rechazar(v_fn, v_yo, mesa.rechazo('forma', 400,
        format('cambio %s mal formado: {almacen (a-z), clave (1–512), base (entero ≥ 0 o null), valor}', i),
        jsonb_build_object('indice', i)), v_det || jsonb_build_object('indice', i));
    end if;
    v_tam := octet_length((c -> 'valor')::text);
    if v_tam > c_valor then
      v_det := v_det || jsonb_build_object('tope', 'valor', 'maximo', c_valor, 'tiene', v_tam,
                                           'almacen', c ->> 'almacen', 'clave', left(c ->> 'clave', 120));
      return mesa.rechazar(v_fn, v_yo, mesa.rechazo('tope', 413, format('el valor de %s/%s pasa de 2 MB', c ->> 'almacen', left(c ->> 'clave', 60)),
        jsonb_build_object('tope', 'valor', 'maximo', c_valor, 'tiene', v_tam, 'almacen', c ->> 'almacen', 'clave', c ->> 'clave')), v_det);
    end if;
  end loop;
  if (select count(distinct (e ->> 'almacen', e ->> 'clave')) from jsonb_array_elements(v_cambios) e) <> v_n then
    return mesa.rechazar(v_fn, v_yo, mesa.rechazo('forma', 400, 'cambios: un registro repetido en el lote'), v_det);
  end if;

  -- El turno bloqueado hasta el final: nadie más da números de orden mientras tanto.
  select * into t from mesa.turno where id for update;
  if t.dispositivo is distinct from v_yo or t.numero <> v_turno then
    return mesa.rechazar(v_fn, v_yo,
      mesa.rechazo('turno', 423, format('la Mesa la tiene otro ordenador (turno %s)', t.numero), jsonb_build_object('turno', t.numero)), v_det);
  end if;
  v_ord := t.orden;

  for c in select e from jsonb_array_elements(v_cambios) e loop
    v_alm := c ->> 'almacen';
    v_cla := c ->> 'clave';
    v_base := case when jsonb_typeof(c -> 'base') = 'number' then (c ->> 'base')::bigint else 0 end;   -- null o falta: 0, nuevo
    v_val := case when jsonb_typeof(c -> 'valor') = 'null' then null else c -> 'valor' end;
    select * into r from mesa.registros x where x.almacen = v_alm and x.clave = v_cla for update;
    if not found then
      if v_base <> 0 then
        v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'choque', 'ultima', 0, 'borrado', false,
                                             'orden', null, 'dispositivo', null, 'turno', null);
        v_nchoques := v_nchoques + 1;
        if v_nchoques <= 50 then v_choques := v_choques || jsonb_build_object('almacen', v_alm, 'clave', left(v_cla, 120), 'base', v_base, 'ultima', 0); end if;
      elsif v_val is null then
        v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'igual', 'version', 0);
      else
        v_ord := v_ord + 1;
        insert into mesa.registros (almacen, clave, valor, version, orden, app, dispositivo, hora, borrado, turno)
        values (v_alm, v_cla, v_val, 1, v_ord, v_app, v_yo, now(), null, v_turno);
        v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'ok', 'version', 1, 'orden', v_ord);
      end if;
    elsif (v_val is null and r.valor is null) or v_val = r.valor then
      -- Ya está como se pide, sea cual sea la base: repetir un lote cuya respuesta se perdió no choca consigo mismo.
      v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'igual', 'version', r.version);
    elsif not (v_base = r.version or (r.valor is null and v_base = 0)) then
      -- Su base no es la última (un registro vivo solo se pisa con su versión; una lápida, también como nuevo).
      v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'choque', 'ultima', r.version,
                                           'borrado', r.valor is null, 'orden', r.orden, 'dispositivo', r.dispositivo, 'turno', r.turno);
      v_nchoques := v_nchoques + 1;
      if v_nchoques <= 50 then
        v_choques := v_choques || jsonb_build_object('almacen', v_alm, 'clave', left(v_cla, 120), 'base', v_base, 'ultima', r.version,
                                                     'de', r.dispositivo, 'turno_de', r.turno);
      end if;
    else
      if r.valor is not null and (v_val is null or r.dispositivo is distinct from v_yo or r.turno is distinct from v_turno or not exists (
            select 1 from mesa.historial h where h.almacen = v_alm and h.clave = v_cla and h.guardada > now() - interval '5 minutes')) then
        insert into mesa.historial (almacen, clave, valor, version, orden, app, dispositivo, hora, turno)
        values (r.almacen, r.clave, r.valor, r.version, r.orden, r.app, r.dispositivo, r.hora, r.turno);
      end if;
      v_ord := v_ord + 1;
      update mesa.registros x
         set valor = v_val, version = r.version + 1, orden = v_ord, app = v_app, dispositivo = v_yo, hora = now(),
             borrado = case when v_val is null then now() end, turno = v_turno
       where x.almacen = v_alm and x.clave = v_cla;
      v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'ok', 'version', r.version + 1, 'orden', v_ord);
      if v_val is null then
        v_borrados := v_borrados + 1;
        v_por_alm := jsonb_set(v_por_alm, array[v_alm], to_jsonb(coalesce((v_por_alm ->> v_alm)::integer, 0) + 1));
        if v_borrados <= 10 then v_muestra := v_muestra || to_jsonb(v_alm || '/' || left(v_cla, 100)); end if;
      end if;
    end if;
  end loop;

  -- Escribir también es señal de vida del que la tiene.
  update mesa.turno set orden = v_ord, latido = now() where id;

  -- Lo que deja fila: cada choque (los 50 primeros, y cuántos más), un borrado masivo.
  for c in select unnest(v_choques) loop perform mesa.apuntar('choque', v_yo, c || jsonb_strip_nulls(jsonb_build_object('app', mesa.app_ok(v_app)))); end loop;
  if v_nchoques > 50 then perform mesa.apuntar('choque', v_yo, jsonb_build_object('cuantos', v_nchoques, 'sin_fila', v_nchoques - 50)); end if;
  if v_borrados > 20 or (v_resc and v_borrados > 0) then
    perform mesa.apuntar('borrado_masivo', v_yo, jsonb_strip_nulls(jsonb_build_object('cuantos', v_borrados, 'reescanear', v_resc,
      'almacenes', v_por_alm, 'claves', to_jsonb(v_muestra), 'app', mesa.app_ok(v_app))));
  end if;

  -- Lo de más de 30 días sale del historial (50 filas por llamada: sus valores pesan, y esto corre con el turno bloqueado) y
  -- lo de más de 90 de la actividad (300, filas pequeñas): una escritura nunca se hace lenta.
  delete from mesa.historial where id in (
    select h.id from mesa.historial h where h.guardada < now() - interval '30 days' order by h.guardada limit 50);
  perform set_config('mesa.poda', '1', true);
  delete from mesa.actividad where id in (
    select a.id from mesa.actividad a where a.hora < now() - interval '90 days' order by a.hora limit 300);
  perform set_config('mesa.poda', '', true);
  return jsonb_build_object('ok', true, 'turno', v_turno, 'orden', v_ord, 'hora', now(), 'epoca', mesa.epoca(), 'resultados', to_jsonb(v_res));
end $$;

-- Bajar lo escrito desde un número de orden (sin incluirlo), por orden: como mucho `limite` registros (de 1 a 500; 500 si no
-- se dice) y unos 4 MB de valores por página (siempre al menos uno). `mas` dice si hay más: se sigue con `desde = hasta`.
-- Cuando no hay más, `hasta` es como poco el contador del turno leído al empezar (`orden`), aunque falte una fila: el bucle
-- termina. Un `desde` mayor que ese contador es un cursor de otra época (rechazo `cursor`). No hace falta el turno.
create or replace function public.mesa_bajar(desde bigint, limite integer default 500) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_desde bigint := mesa_bajar.desde;
  v_lim integer := least(greatest(coalesce(mesa_bajar.limite, 500), 1), 500);
  v_cont bigint;
  r mesa.registros;
  v_filas jsonb[] := '{}';
  v_bytes bigint := 0;
  v_tam bigint;
  v_hasta bigint;
  v_mas boolean := false;
begin
  if not public.dueno_cuenta() then return mesa.ajeno('mesa_bajar', null); end if;
  if not public.es_dueno() then return mesa.sin_codigo('mesa_bajar', null); end if;
  if v_desde is null or v_desde < 0 then
    return mesa.rechazar('mesa_bajar', null, mesa.rechazo('forma', 400, 'desde: un número de orden desde 0'));
  end if;
  -- Primero el contador: todo lo que tiene un número hasta él ya está confirmado y lo verá la lectura de abajo.
  select x.orden into v_cont from mesa.turno x where x.id;
  if v_desde > v_cont then
    return mesa.rechazar('mesa_bajar', null, mesa.rechazo('cursor', 409,
      format('ese cursor (%s) es de otra época: el último número es %s; baja desde 0', v_desde, v_cont),
      jsonb_build_object('orden', v_cont)), jsonb_build_object('desde', v_desde, 'orden', v_cont));
  end if;
  v_hasta := v_desde;
  for r in select * from mesa.registros x where x.orden > v_desde order by x.orden limit v_lim loop
    v_tam := coalesce(octet_length(r.valor::text), 0);
    if v_bytes > 0 and v_bytes + v_tam > 4194304 then v_mas := true; exit; end if;
    v_bytes := v_bytes + v_tam;
    v_filas := v_filas || jsonb_build_object('almacen', r.almacen, 'clave', r.clave, 'valor', r.valor, 'version', r.version,
      'orden', r.orden, 'borrado', r.valor is null, 'hora', r.hora, 'app', r.app, 'dispositivo', r.dispositivo, 'turno', r.turno);
    v_hasta := r.orden;
  end loop;
  if not v_mas then v_mas := exists (select 1 from mesa.registros x where x.orden > v_hasta); end if;
  if not v_mas then v_hasta := greatest(v_hasta, v_cont); end if;
  return jsonb_build_object('ok', true, 'filas', to_jsonb(v_filas), 'hasta', v_hasta, 'mas', v_mas,
    'orden', v_cont, 'epoca', mesa.epoca(), 'hora', now());
end $$;

-- ───────────────────────── Leer la actividad ─────────────────────────
-- Las filas con id mayor que `desde`, por orden de id: como mucho `limite` (de 1 a 500; 200 si no se dice). `mas` dice si hay
-- más: se sigue con `desde = hasta`. Los ids se confirman en orden (bloqueo de `mesa.apuntar`): leer «desde N» no se salta
-- ninguna. Solo Kevin; una sesión que no es la suya deja su fila `ajeno`. Las entradas del portal (`auth.audit_log_entries`)
-- no salen: el proyecto no las guarda en la base de datos (`audit_log_disable_postgres`), y activarlo es cambiar su configuración.
-- Esquema 6 (D-299): cada fila dice si ya está vista (`visto`); con `vistos` (un número, 0 la primera vez), además los avisos
-- vistos después de ese número (`vistos`, como mucho 1000, por orden), hasta cuál (`vistos_hasta`) y si hay más (`vistos_mas`).
-- Una Mesa de antes llama sin `vistos` y recibe lo de siempre.
drop function if exists public.mesa_actividad(bigint, integer);
create or replace function public.mesa_actividad(desde bigint default 0, limite integer default 200, vistos bigint default null) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_desde bigint := mesa_actividad.desde;
  v_lim integer := least(greatest(coalesce(mesa_actividad.limite, 200), 1), 500);
  v_vistos bigint := mesa_actividad.vistos;
  v_filas jsonb;
  v_hasta bigint;
  v_r jsonb;
  v_lv jsonb;
  v_vh bigint;
begin
  if not public.dueno_cuenta() then return mesa.ajeno('mesa_actividad', null); end if;
  if not public.es_dueno() then return mesa.sin_codigo('mesa_actividad', null); end if;
  if v_desde is null or v_desde < 0 then
    return mesa.rechazar('mesa_actividad', null, mesa.rechazo('forma', 400, 'desde: un id desde 0'));
  end if;
  if v_vistos is not null and v_vistos < 0 then
    return mesa.rechazar('mesa_actividad', null, mesa.rechazo('forma', 400, 'vistos: un número desde 0'));
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'hora', a.hora, 'tipo', a.tipo, 'usuario', a.usuario, 'sesion', a.sesion,
           'dispositivo', a.dispositivo, 'detalle', a.detalle, 'visto', exists (select 1 from mesa.vistos v where v.aviso = a.id)) order by a.id), '[]'::jsonb), max(a.id)
    into v_filas, v_hasta
    from (select * from mesa.actividad x where x.id > v_desde order by x.id limit v_lim) a;
  v_hasta := coalesce(v_hasta, v_desde);
  v_r := jsonb_build_object('ok', true, 'filas', v_filas, 'hasta', v_hasta,
    'mas', exists (select 1 from mesa.actividad x where x.id > v_hasta), 'epoca', mesa.epoca(), 'hora', now());
  if v_vistos is not null then
    select coalesce(jsonb_agg(v.aviso order by v.n), '[]'::jsonb), max(v.n) into v_lv, v_vh
      from (select * from mesa.vistos y where y.n > v_vistos order by y.n limit 1000) v;
    v_vh := coalesce(v_vh, v_vistos);
    v_r := v_r || jsonb_build_object('vistos', v_lv, 'vistos_hasta', v_vh,
      'vistos_mas', exists (select 1 from mesa.vistos y where y.n > v_vh));
  end if;
  return v_r;
end $$;

-- «Visto» (esquema 6, D-299): los avisos que Kevin quitó en un aparato, para que se quiten en todos. Como mucho 500 de una vez;
-- un id que no existe (o ya podado) no se apunta; uno ya visto, tampoco otra vez; un «aparato nuevo», tampoco (eso lo decide
-- mesa_aparato, D-298). Devuelve hasta dónde llegan los vistos.
create or replace function public.mesa_visto(dispositivo text, avisos bigint[]) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_yo text := mesa_visto.dispositivo;
  v_av bigint[] := mesa_visto.avisos;
begin
  if not public.dueno_cuenta() then return mesa.ajeno('mesa_visto', v_yo); end if;
  if not public.es_dueno() then return mesa.sin_codigo('mesa_visto', v_yo); end if;
  if v_yo is null or v_yo !~ '^[A-Za-z0-9_-]{8,64}$' then
    return mesa.rechazar('mesa_visto', null, mesa.rechazo('forma', 400, 'dispositivo no válido: de 8 a 64 letras, cifras, - o _'));
  end if;
  if v_av is null or cardinality(v_av) = 0 or cardinality(v_av) > 500 or exists (select 1 from unnest(v_av) x where x is null or x < 1) then
    return mesa.rechazar('mesa_visto', v_yo, mesa.rechazo('forma', 400, 'avisos: de 1 a 500 ids de la actividad'));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('mesa.vistos', 0));   -- los números se confirman en orden: leer «desde n» no se salta ninguno
  insert into mesa.vistos (aviso, dispositivo)
    select a.id, v_yo from mesa.actividad a where a.id = any (v_av) and a.tipo <> 'dispositivo_nuevo' order by a.id   -- un aparato nuevo, solo con mesa_aparato
  on conflict (aviso) do nothing;
  return jsonb_build_object('ok', true, 'vistos_hasta', coalesce((select max(y.n) from mesa.vistos y), 0), 'epoca', mesa.epoca());
end $$;

-- Un aparato nuevo (esquema 6, D-298): «Es mío» (`es_mio`) lo apunta como suyo; «No lo reconozco», como no suyo y, en la misma
-- transacción, cierra todas las sesiones de la cuenta (también la que llama): al momento, porque `es_dueno()` mira que la
-- sesión siga en `auth.sessions`. En los dos casos sus avisos «aparato nuevo» quedan vistos en todos los aparatos y la decisión
-- queda en la actividad (`aparato_mio` / `aparato_ajeno`, que no son avisos). Un aparato que nunca abrió la Mesa: «forma» (404).
create or replace function public.mesa_aparato(dispositivo text, aparato text, es_mio boolean) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_yo text := mesa_aparato.dispositivo;
  v_ap text := mesa_aparato.aparato;
  v_mio boolean := mesa_aparato.es_mio;
  v_ses integer := 0;
begin
  if not public.dueno_cuenta() then return mesa.ajeno('mesa_aparato', v_yo); end if;
  if not public.es_dueno() then return mesa.sin_codigo('mesa_aparato', v_yo); end if;
  if v_yo is null or v_yo !~ '^[A-Za-z0-9_-]{8,64}$' or v_ap is null or v_ap !~ '^[A-Za-z0-9_-]{8,64}$' then
    return mesa.rechazar('mesa_aparato', v_yo, mesa.rechazo('forma', 400, 'dispositivo o aparato no válido: de 8 a 64 letras, cifras, - o _'));
  end if;
  if v_mio is null then
    return mesa.rechazar('mesa_aparato', v_yo, mesa.rechazo('forma', 400, 'es_mio: sí o no'));
  end if;
  -- «Es mío» se dice desde otro aparato: nunca desde el mismo (su id) ni desde la sesión que lo abrió. Quien tenga la contraseña y el
  -- código podría saltárselo con otra sesión y otro nombre; esto para lo de a mano (la Mesa del intruso enseña su propio aviso).
  if v_mio and (v_ap = v_yo or exists (select 1 from mesa.actividad a where a.tipo = 'dispositivo_nuevo' and a.dispositivo = v_ap
                                          and a.sesion is not null and a.sesion = left((select auth.jwt()) ->> 'session_id', 64))) then
    return mesa.rechazar('mesa_aparato', v_yo, mesa.rechazo('propio', 403, 'un aparato no se confirma a sí mismo: hazlo desde otro'));
  end if;
  update mesa.dispositivos d
     set reconocido = case when v_mio then now() end, rechazado = case when v_mio then null else now() end
   where d.dispositivo = v_ap;
  if not found then
    return mesa.rechazar('mesa_aparato', v_yo, mesa.rechazo('forma', 404, 'ese aparato nunca abrió la Mesa'));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('mesa.vistos', 0));
  insert into mesa.vistos (aviso, dispositivo)
    select a.id, v_yo from mesa.actividad a where a.tipo = 'dispositivo_nuevo' and a.dispositivo = v_ap order by a.id
  on conflict (aviso) do nothing;
  if not v_mio then
    with fuera as (delete from auth.sessions s where s.user_id = auth.uid() returning 1) select count(*) into v_ses from fuera;
  end if;
  perform mesa.apuntar(case when v_mio then 'aparato_mio' else 'aparato_ajeno' end, v_yo,
    jsonb_strip_nulls(jsonb_build_object('aparato', v_ap, 'sesiones', case when not v_mio then v_ses end)));
  return jsonb_build_object('ok', true, 'vistos_hasta', coalesce((select max(y.n) from mesa.vistos y), 0), 'epoca', mesa.epoca())
    || case when v_mio then '{}'::jsonb else jsonb_build_object('sesiones', v_ses) end;
end $$;

-- Solo Kevin, con sesión: nada para quien no ha entrado (sin sesión no llega a la función y no deja fila).
revoke all on function public.mesa_turno_ver(text), public.mesa_turno_pedir(text, text), public.mesa_turno_latido(text, bigint, text, integer),
  public.mesa_turno_reclamar(text, bigint, text, boolean), public.mesa_turno_soltar(text, bigint),
  public.mesa_escribir(text, bigint, text, jsonb, boolean), public.mesa_bajar(bigint, integer),
  public.mesa_actividad(bigint, integer, bigint), public.mesa_visto(text, bigint[]), public.mesa_aparato(text, text, boolean) from public, anon;
grant execute on function public.mesa_turno_ver(text), public.mesa_turno_pedir(text, text), public.mesa_turno_latido(text, bigint, text, integer),
  public.mesa_turno_reclamar(text, bigint, text, boolean), public.mesa_turno_soltar(text, bigint),
  public.mesa_escribir(text, bigint, text, jsonb, boolean), public.mesa_bajar(bigint, integer),
  public.mesa_actividad(bigint, integer, bigint), public.mesa_visto(text, bigint[]), public.mesa_aparato(text, text, boolean) to authenticated;

-- ───────────────────────── El portal en «Avisos» (esquema 5, D-278) ─────────────────────────
-- Supabase no guarda su registro de auditoría en la base (`audit_log_disable_postgres`) y un código mal no deja rastro; sí cada
-- entrada (una fila en `auth.sessions`, con su navegador) y cada código pedido (una en `auth.one_time_tokens`). Dos disparadores
-- lo apuntan en `mesa.actividad`, que solo lee Kevin con su código (`mesa_actividad`) y la Mesa enseña en «Avisos»:
--   portal_aparato_nuevo  una cuenta del portal (miembro de algún cliente) entra desde un navegador y sistema que no había usado
--                         (`primera`: su primera entrada); el aparato es «navegador · sistema», sin IP ni correo
--   portal_no_miembro     entra una cuenta que no es de Kevin ni miembro de ningún cliente
--   portal_codigos        5 códigos pedidos para una cuenta en una hora (y cada 5 más), también para la de Kevin
--   portal_fallo          el disparador falló: la entrada sigue igual (nunca se para por esto)
-- Las entradas de Kevin no avisan aquí: la Mesa ya avisa de «La Mesa se abrió en un aparato nuevo».

create table if not exists mesa.portal_aparatos (
  usuario uuid not null,
  aparato text not null check (char_length(aparato) <= 60),
  primera timestamptz not null default now(),
  primary key (usuario, aparato)
);
create table if not exists mesa.portal_codigos (
  id      bigint generated always as identity primary key,
  usuario uuid not null,
  hora    timestamptz not null default now()
);
create index if not exists portal_codigos_usuario on mesa.portal_codigos (usuario, hora);
revoke all on mesa.portal_aparatos, mesa.portal_codigos from public, anon, authenticated, service_role;
revoke all on sequence mesa.portal_codigos_id_seq from public, anon, authenticated, service_role;
alter table mesa.portal_aparatos enable row level security;
alter table mesa.portal_codigos  enable row level security;

-- «Safari · iPhone»: el navegador y el sistema de una cabecera User-Agent, sin versión ni nada que identifique a nadie.
create or replace function mesa.aparato_de(ua text) returns text
  language sql immutable set search_path = '' as $$
  select (case when ua ~* 'edg/' then 'Edge' when ua ~* 'firefox|fxios' then 'Firefox' when ua ~* 'crios|chrome' then 'Chrome'
               when ua ~* 'safari' then 'Safari' else 'Otro navegador' end) || ' · ' ||
         (case when ua ~* 'iphone' then 'iPhone' when ua ~* 'ipad' then 'iPad' when ua ~* 'android' then 'Android'
               when ua ~* 'mac os x|macintosh' then 'Mac' when ua ~* 'windows' then 'Windows' when ua ~* 'linux' then 'Linux'
               else 'otro sistema' end);
$$;

-- Quién es una cuenta, para el aviso: su nombre de miembro y los clientes que ve (sin correo); si es la de Kevin.
create or replace function mesa.portal_quien(u uuid) returns jsonb
  language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'nombre', (select left(min(m.nombre), 60) from public.miembros m where m.user_id = u),
    'clientes', coalesce((select jsonb_agg(x.nombre order by x.nombre) from (select distinct left(c.nombre, 80) as nombre
                  from public.miembros m join public.clientes c on c.id = m.cliente_id where m.user_id = u limit 20) x), '[]'::jsonb),
    'dueno', exists (select 1 from public.duenos d where d.user_id = u));
$$;

-- Una fila de actividad que no viene de una llamada de la Mesa (no hay auth.uid() en un disparador de Supabase Auth).
create or replace function mesa.portal_apuntar(p_tipo text, p_usuario uuid, p_sesion text, p_det jsonb) returns void
  language plpgsql volatile security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('mesa.actividad', 0));
  insert into mesa.actividad (tipo, usuario, sesion, detalle)
  values (p_tipo, p_usuario, left(p_sesion, 64), coalesce(p_det, '{}'::jsonb));
end $$;

create or replace function mesa.portal_sesion() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_q jsonb; v_ap text; v_primera boolean;
begin
  begin
    v_q := mesa.portal_quien(new.user_id);
    if (v_q ->> 'dueno')::boolean then return null; end if;
    v_ap := mesa.aparato_de(coalesce(new.user_agent, ''));
    if jsonb_array_length(v_q -> 'clientes') = 0 then
      perform mesa.portal_apuntar('portal_no_miembro', new.user_id, new.id::text, jsonb_build_object('aparato', v_ap));
      return null;
    end if;
    v_primera := not exists (select 1 from mesa.portal_aparatos a where a.usuario = new.user_id);
    insert into mesa.portal_aparatos (usuario, aparato) values (new.user_id, v_ap) on conflict do nothing;
    if found then
      perform mesa.portal_apuntar('portal_aparato_nuevo', new.user_id, new.id::text,
        (v_q - 'dueno') || jsonb_build_object('aparato', v_ap, 'primera', v_primera));
    end if;
  exception when others then
    begin
      perform mesa.portal_apuntar('portal_fallo', new.user_id, null, jsonb_build_object('donde', 'entrada', 'error', left(sqlerrm, 200)));
    exception when others then null;
    end;
  end;
  return null;
end $$;

create or replace function mesa.portal_codigo() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_n integer;
begin
  begin
    if new.user_id is null then return null; end if;
    insert into mesa.portal_codigos (usuario) values (new.user_id);
    delete from mesa.portal_codigos c where c.usuario = new.user_id and c.hora < now() - interval '2 hours';
    select count(*) into v_n from mesa.portal_codigos c where c.usuario = new.user_id and c.hora > now() - interval '1 hour';
    if v_n >= 5 and v_n % 5 = 0 then
      perform mesa.portal_apuntar('portal_codigos', new.user_id, null, mesa.portal_quien(new.user_id) || jsonb_build_object('n', v_n));
    end if;
  exception when others then
    begin
      perform mesa.portal_apuntar('portal_fallo', new.user_id, null, jsonb_build_object('donde', 'codigo', 'error', left(sqlerrm, 200)));
    exception when others then null;
    end;
  end;
  return null;
end $$;

-- Los aparatos que ya tienen sesión cuentan como vistos: al aplicar, nadie avisa de golpe de todas las cuentas de siempre.
insert into mesa.portal_aparatos (usuario, aparato, primera)
select s.user_id, mesa.aparato_de(coalesce(s.user_agent, '')), min(s.created_at)
  from auth.sessions s group by 1, 2
on conflict do nothing;

drop trigger if exists mesa_portal_sesion on auth.sessions;
create trigger mesa_portal_sesion after insert on auth.sessions for each row execute function mesa.portal_sesion();
drop trigger if exists mesa_portal_codigo on auth.one_time_tokens;
create trigger mesa_portal_codigo after insert on auth.one_time_tokens for each row execute function mesa.portal_codigo();
revoke all on function mesa.aparato_de(text), mesa.portal_quien(uuid), mesa.portal_apuntar(text, uuid, text, jsonb),
  mesa.portal_sesion(), mesa.portal_codigo() from public, anon, authenticated, service_role;

-- ───────────────────────── Archivos privados ─────────────────────────
-- Almacén `mesa`: copias de trabajo de 2560 px, miniaturas, diseños, PDF de facturas y fotos de sesiones. Ruta por huella:
-- `<almacén de IndexedDB>/<sha256 de los bytes>.<ext>` (p. ej. `files/9f86…0a08.jpg`, `cfacturas/…pdf`): la misma ruta
-- siempre son los mismos bytes, así que una ruta nunca se reutiliza para otra cosa. No hay política de cambiar ni de borrar:
-- un archivo no se sobrescribe, ni se mueve, ni se borra desde la Mesa (subirlo otra vez da 409, que `supa.subir` cuenta como
-- subido; si algún día hay que borrar, con la clave secreta desde `tools/web.mjs`). Solo Kevin lee, lista y sube. Además, una
-- política restrictiva: ninguna política futura, de nadie, abre `mesa` a quien no es Kevin. Límite de 25 MB por archivo (el
-- global del proyecto es 50 MB: `tools/web.mjs mesa` lo comprueba antes).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mesa', 'mesa', false, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists mesa_ver on storage.objects;
create policy mesa_ver on storage.objects for select to authenticated
  using (bucket_id = 'mesa' and (select public.es_dueno()));
drop policy if exists mesa_subir on storage.objects;
create policy mesa_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'mesa' and (select public.es_dueno())
              and name ~ '^[a-z][a-z0-9_]{0,39}/[0-9a-f]{64}\.(jpg|png|webp|heic|heif|pdf)$');
drop policy if exists mesa_borrar on storage.objects;
drop policy if exists mesa_solo_dueno on storage.objects;
create policy mesa_solo_dueno on storage.objects as restrictive for all to public
  using (bucket_id <> 'mesa' or (select public.es_dueno()))
  with check (bucket_id <> 'mesa' or (select public.es_dueno()));

-- La versión de este archivo, ya aplicado entero (el bloque del principio no deja aplicar uno más viejo).
update mesa.ajustes set esquema = current_setting('mesa.esquema_archivo')::integer
 where id and esquema < current_setting('mesa.esquema_archivo')::integer;
