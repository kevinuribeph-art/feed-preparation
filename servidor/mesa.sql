-- Mesa de trabajo · copia en el servidor (Supabase, Postgres 15+). Lote 2 del traspaso C (.claude/rediseno/traspaso/plan.md).
-- Un registro por cada registro de IndexedDB de la Mesa, su historial, el turno (qué ordenador tiene la Mesa), la versión
-- mínima de la app y las fotos en un almacenamiento privado. El contrato para los lotes 3 a 6 está en
-- .claude/rediseno/traspaso/contrato.md (fuera de git).
-- Lo aplica `node tools/web.mjs mesa <pruebas|real>`; la versión mínima, `node tools/web.mjs mesa-version <pruebas|real> <x.yy>`.
-- Necesita `servidor/esquema.sql` (usa `public.es_dueno()`) y no cambia nada del portal: ni sus funciones, ni sus tablas, ni
-- sus políticas `archivos_*`.
--
-- Se puede aplicar varias veces sin perder datos: crea lo que falta (`if not exists`), rehace funciones (`create or replace`),
-- permisos y sus propias políticas `mesa_*`; nunca `drop table` ni `truncate`. Una función que cambie de parámetros necesita
-- antes su `drop function if exists` con la firma vieja (si no, quedarían dos y PostgREST no sabría cuál llamar).
--
-- Reglas (plan: «Lo que guarda el servidor», «Reglas para construirlo»; lecciones 88, 89, 94, 118, 120, 121, 136):
--   · Solo Kevin (`public.duenos`). Cada función `mesa_*` empieza comprobando `es_dueno()`. El esquema `mesa` no se expone en
--     la API (no está en los esquemas de PostgREST) y nadie más que su dueño lo usa; las funciones son la única puerta.
--   · La hora la pone el servidor (`now()`), nunca el aparato; las respuestas dan la hora del servidor y las edades en
--     segundos, para que el cliente no use su reloj.
--   · Una Mesa a la vez: el turno, con un número que crece cada vez que alguien la reclama. Una escritura con un turno que no
--     es el vigente se rechaza entera, y también la de una app más vieja que la mínima (D-060 entre ordenadores).
--   · Cada registro lleva su versión (la sube el servidor). Un cambio sobre una versión que no es la última se rechaza solo
--     (los demás del lote entran) y dice cuál es la última.
--   · Se baja por número de orden, nunca por hora, y por páginas. El número se da con la fila del turno bloqueada, de un
--     contador de esa fila (no de una secuencia, que no es transaccional): nunca se confirma un número menor después de uno
--     mayor, así que quien baja «desde N» no se salta nada.
--   · Nada se borra de verdad: un borrado deja el registro con `valor` nulo (lápida) y su último valor en el historial.
--   · Historial: la versión anterior de cada registro, como mucho una cada 5 minutos, durante 30 días. Lo poda la propia
--     escritura, como mucho 300 filas por llamada (sin pg_cron).
--   · Errores con código propio (PTxxx → HTTP xxx): PT400 lote mal formado, PT409 el turno cambió al reclamar, PT413 demasiado
--     grande, PT423 la Mesa la tiene otro ordenador, PT426 app más vieja que la mínima; 42501 → 401/403 sin permiso.

do $$ begin
  if to_regprocedure('public.es_dueno()') is null then
    raise exception 'falta servidor/esquema.sql: aplícalo antes (node tools/web.mjs esquema …)';
  end if;
end $$;

create schema if not exists mesa;

-- ───────────────────────── Tablas ─────────────────────────

-- La versión mínima de la Mesa que puede escribir (una sola fila). La pone `tools/web.mjs mesa-version`; aplicar este archivo
-- otra vez no la cambia. «0.0»: sin mínima.
create table if not exists mesa.ajustes (
  id             boolean primary key default true check (id),
  version_minima text not null default '0.0' check (version_minima ~ '^[0-9]{1,4}\.[0-9]{1,4}$'),
  cambiada       timestamptz not null default now()
);
insert into mesa.ajustes (id) values (true) on conflict (id) do nothing;

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

-- Versiones anteriores: como mucho una cada 5 minutos por registro, 30 días. Nunca una lápida (no hay nada que recuperar).
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

-- ───────────────────────── Permisos del esquema ─────────────────────────
-- Nadie más que su dueño: ni uso del esquema ni de sus tablas para anon, authenticated ni service_role. RLS activo y sin
-- políticas, por si algún día alguien concede algo: no se vería ninguna fila. Las funciones `mesa_*` (security definer)
-- entran como dueño.

revoke all on schema mesa from public, anon, authenticated, service_role;
revoke all on all tables in schema mesa from public, anon, authenticated, service_role;
revoke all on all sequences in schema mesa from public, anon, authenticated, service_role;
alter table mesa.ajustes   enable row level security;
alter table mesa.turno     enable row level security;
alter table mesa.registros enable row level security;
alter table mesa.historial enable row level security;

-- ───────────────────────── Ayudantes (solo para las funciones `mesa_*`) ─────────────────────────

-- «4.10» → {4,10}: las versiones se comparan como números (4.9 < 4.10), nunca como texto.
create or replace function mesa.version_num(v text) returns integer[]
  language sql immutable strict set search_path = '' as $$
  select array[split_part(v, '.', 1)::integer, split_part(v, '.', 2)::integer];
$$;

-- El dispositivo y, si se da, la versión de la app: forma y mínima.
create or replace function mesa.comprobar(d text, a text) returns void
  language plpgsql stable set search_path = '' as $$
begin
  if d is null or d !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'dispositivo no válido: de 8 a 64 letras, cifras, - o _' using errcode = 'PT400';
  end if;
  if a is null or a !~ '^[0-9]{1,4}\.[0-9]{1,4}$' then
    raise exception 'app no válida: su versión como «4.31»' using errcode = 'PT400';
  end if;
  if mesa.version_num(a) < (select mesa.version_num(x.version_minima) from mesa.ajustes x where x.id) then
    raise exception 'esta Mesa es más vieja que la mínima (%): recárgala', (select x.version_minima from mesa.ajustes x where x.id)
      using errcode = 'PT426';
  end if;
end $$;

-- Lo que dicen las funciones del turno: el turno vigente, quién lo tiene y quién lo pide, con la hora del servidor y las
-- edades en segundos (sin el reloj del aparato).
create or replace function mesa.turno_json(t mesa.turno, yo text) returns jsonb
  language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'turno', t.numero,
    'tuyo', t.dispositivo is not null and t.dispositivo = yo,
    'libre', t.dispositivo is null,
    'tiene', case when t.dispositivo is null then null else jsonb_build_object(
      'dispositivo', t.dispositivo,
      'desde', t.desde,
      'latido', t.latido,
      'latido_hace', case when t.latido is null then null else floor(extract(epoch from now() - t.latido))::bigint end,
      'cola', t.cola,
      'cola_desde', t.cola_desde,
      'cola_hace', case when t.cola_desde is null then null else floor(extract(epoch from now() - t.cola_desde))::bigint end) end,
    'pide', case when t.pide is null then null else jsonb_build_object(
      'dispositivo', t.pide,
      'desde', t.pide_desde,
      'hace', floor(extract(epoch from now() - t.pide_desde))::bigint,
      'tuyo', t.pide = yo) end,
    'orden', t.orden,
    'version_minima', (select x.version_minima from mesa.ajustes x where x.id),
    'hora', now());
$$;

revoke all on function mesa.version_num(text), mesa.comprobar(text, text), mesa.turno_json(mesa.turno, text)
  from public, anon, authenticated, service_role;

-- ───────────────────────── El turno, en dos fases ─────────────────────────
-- El que llega la pide (`mesa_turno_pedir`); el que la tiene lo ve en su latido (`mesa_turno_latido`), sube su cola y la
-- suelta (`mesa_turno_soltar`); el que llega la reclama (`mesa_turno_reclamar`) con el número que vio. Si el que la tiene no
-- contesta, el que llega puede reclamarla igual (lo decide la Mesa): desde ese momento el turno viejo ya no escribe.

-- Pedir la Mesa: apunta quién la pide y desde cuándo (pedirla otra vez no cambia ese «desde»). No cambia quién la tiene.
-- Sirve también para ver el turno: quien ya la tiene recibe `tuyo` y su número.
create or replace function public.mesa_turno_pedir(dispositivo text, app text) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_yo text := mesa_turno_pedir.dispositivo;
  t mesa.turno;
begin
  if not public.es_dueno() then raise exception 'sin permiso' using errcode = '42501'; end if;
  perform mesa.comprobar(v_yo, mesa_turno_pedir.app);
  select * into t from mesa.turno where id for update;
  if t.dispositivo is distinct from v_yo and t.pide is distinct from v_yo then
    update mesa.turno set pide = v_yo, pide_desde = now() where id returning * into t;
  end if;
  return mesa.turno_json(t, v_yo);
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
  t mesa.turno;
begin
  if not public.es_dueno() then raise exception 'sin permiso' using errcode = '42501'; end if;
  perform mesa.comprobar(v_yo, mesa_turno_latido.app);
  if v_turno is null or v_cola is null or v_cola < 0 then raise exception 'turno y cola: dos números' using errcode = 'PT400'; end if;
  select * into t from mesa.turno where id for update;
  if t.dispositivo is distinct from v_yo or t.numero <> v_turno then
    raise exception 'la Mesa la tiene otro ordenador (turno %)', t.numero using errcode = 'PT423';
  end if;
  update mesa.turno
     set latido = now(), cola = v_cola, cola_desde = case when v_cola > 0 then coalesce(cola_desde, now()) end
   where id returning * into t;
  return mesa.turno_json(t, v_yo);
end $$;

-- Reclamar la Mesa con el número de turno que se vio (en `pedir` o en un latido): si ha cambiado desde entonces, PT409 y se
-- vuelve a pedir. El número sube, el que la tenía ya no escribe y la petición de quien la reclama se borra. `orden` es el
-- último número de orden confirmado: hay que haber bajado hasta ahí antes de escribir. Quien ya la tiene la conserva tal cual.
create or replace function public.mesa_turno_reclamar(dispositivo text, visto bigint, app text) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_yo text := mesa_turno_reclamar.dispositivo;
  v_visto bigint := mesa_turno_reclamar.visto;
  t mesa.turno;
begin
  if not public.es_dueno() then raise exception 'sin permiso' using errcode = '42501'; end if;
  perform mesa.comprobar(v_yo, mesa_turno_reclamar.app);
  if v_visto is null then raise exception 'visto: el número de turno que se vio' using errcode = 'PT400'; end if;
  select * into t from mesa.turno where id for update;
  if t.numero <> v_visto then
    raise exception 'el turno ha cambiado (ahora %): vuelve a pedirla', t.numero using errcode = 'PT409';
  end if;
  if t.dispositivo is distinct from v_yo then
    update mesa.turno
       set numero = numero + 1, dispositivo = v_yo, desde = now(), latido = now(), cola = 0, cola_desde = null,
           pide = case when pide = v_yo then null else pide end,
           pide_desde = case when pide = v_yo then null else pide_desde end
     where id returning * into t;
  end if;
  return mesa.turno_json(t, v_yo);
end $$;

-- Soltar la Mesa: solo quien la tiene, con su número. Queda libre (con el mismo número) para quien la pidió.
create or replace function public.mesa_turno_soltar(dispositivo text, turno bigint) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_yo text := mesa_turno_soltar.dispositivo;
  v_turno bigint := mesa_turno_soltar.turno;
  t mesa.turno;
begin
  if not public.es_dueno() then raise exception 'sin permiso' using errcode = '42501'; end if;
  if v_yo is null or v_yo !~ '^[A-Za-z0-9_-]{8,64}$' or v_turno is null then
    raise exception 'dispositivo y turno' using errcode = 'PT400';
  end if;
  select * into t from mesa.turno where id for update;
  if t.dispositivo is distinct from v_yo or t.numero <> v_turno then
    raise exception 'la Mesa la tiene otro ordenador (turno %)', t.numero using errcode = 'PT423';
  end if;
  update mesa.turno set dispositivo = null, desde = null, latido = null, cola = null, cola_desde = null
   where id returning * into t;
  return mesa.turno_json(t, v_yo);
end $$;

-- ───────────────────────── Escribir y bajar ─────────────────────────

-- Un lote de cambios: [{almacen, clave, base, valor}], de 1 a 500, como mucho 8 MB en total y 4 MB por valor. `base` es la
-- versión del registro sobre la que se hizo el cambio (null o 0: un registro nuevo); `valor` nulo es un borrado (lápida), y
-- tiene que venir siempre (un `valor` que falta no se toma por borrado).
-- Rechaza el lote entero (nada escrito): sin permiso (42501), mal formado o con un registro repetido (PT400), demasiado
-- grande (PT413), app más vieja que la mínima (PT426), turno que no es el vigente (PT423).
-- Cada cambio, por orden: `ok` (escrito: versión y número de orden nuevos), `igual` (nada que hacer: el mismo valor, o borrar
-- lo que no está vivo) o `choque` (su base no es la última: dice cuál es, si está borrado y su número de orden).
-- Antes de pisar un registro vivo, su valor pasa al historial si el último guardado de ese registro tiene más de 5 minutos,
-- y siempre al borrarlo.
create or replace function public.mesa_escribir(dispositivo text, turno bigint, app text, cambios jsonb) returns jsonb
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_yo text := mesa_escribir.dispositivo;
  v_turno bigint := mesa_escribir.turno;
  v_app text := mesa_escribir.app;
  v_cambios jsonb := mesa_escribir.cambios;
  t mesa.turno;
  r mesa.registros;
  c jsonb;
  v_alm text;
  v_cla text;
  v_base bigint;
  v_val jsonb;
  v_ord bigint;
  v_n integer;
  v_res jsonb[] := '{}';   -- un arreglo de Postgres crece en su sitio; un jsonb se copiaría entero en cada vuelta
begin
  if not public.es_dueno() then raise exception 'sin permiso' using errcode = '42501'; end if;
  perform mesa.comprobar(v_yo, v_app);
  if v_turno is null then raise exception 'falta el turno' using errcode = 'PT400'; end if;
  if jsonb_typeof(v_cambios) is distinct from 'array' then raise exception 'cambios: una lista' using errcode = 'PT400'; end if;
  v_n := jsonb_array_length(v_cambios);
  if v_n = 0 then raise exception 'cambios: la lista está vacía' using errcode = 'PT400'; end if;
  if v_n > 500 then raise exception 'cambios: como mucho 500 por lote' using errcode = 'PT413'; end if;
  if octet_length(v_cambios::text) > 8388608 then raise exception 'cambios: como mucho 8 MB por lote' using errcode = 'PT413'; end if;
  -- Primero la forma de todo el lote: un error no deja nada a medias.
  for c in select e from jsonb_array_elements(v_cambios) e loop
    if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c -> 'almacen') is distinct from 'string'
       or jsonb_typeof(c -> 'clave') is distinct from 'string' or not (c ? 'valor')
       or (c ? 'base' and jsonb_typeof(c -> 'base') not in ('null', 'number')) then
      raise exception 'cambio mal formado: {almacen, clave, base, valor}' using errcode = 'PT400';
    end if;
    if (c ->> 'almacen') !~ '^[a-z][a-z0-9_]{0,39}$' then raise exception 'almacén no válido: %', left(c ->> 'almacen', 40) using errcode = 'PT400'; end if;
    if char_length(c ->> 'clave') not between 1 and 512 then raise exception 'clave no válida (de 1 a 512 caracteres)' using errcode = 'PT400'; end if;
    if jsonb_typeof(c -> 'base') = 'number' and ((c ->> 'base') !~ '^[0-9]{1,15}$') then
      raise exception 'base no válida: un entero desde 0' using errcode = 'PT400';
    end if;
    if octet_length((c -> 'valor')::text) > 4194304 then raise exception 'valor de %/%: como mucho 4 MB', c ->> 'almacen', left(c ->> 'clave', 60) using errcode = 'PT413'; end if;
  end loop;
  if (select count(distinct (e ->> 'almacen', e ->> 'clave')) from jsonb_array_elements(v_cambios) e) <> v_n then
    raise exception 'cambios: un registro repetido en el lote' using errcode = 'PT400';
  end if;

  -- El turno bloqueado hasta el final: nadie más da números de orden mientras tanto.
  select * into t from mesa.turno where id for update;
  if t.dispositivo is distinct from v_yo or t.numero <> v_turno then
    raise exception 'la Mesa la tiene otro ordenador (turno %)', t.numero using errcode = 'PT423';
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
        v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'choque', 'ultima', 0, 'borrado', false, 'orden', null);
      elsif v_val is null then
        v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'igual', 'version', 0);
      else
        v_ord := v_ord + 1;
        insert into mesa.registros (almacen, clave, valor, version, orden, app, dispositivo, hora, borrado)
        values (v_alm, v_cla, v_val, 1, v_ord, v_app, v_yo, now(), null);
        v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'ok', 'version', 1, 'orden', v_ord);
      end if;
    elsif not (v_base = r.version or (r.valor is null and v_base = 0)) then
      -- Su base no es la última (un registro vivo solo se pisa con su versión; una lápida, también como nuevo).
      v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'choque', 'ultima', r.version,
                                           'borrado', r.valor is null, 'orden', r.orden);
    elsif (v_val is null and r.valor is null) or v_val = r.valor then
      v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'igual', 'version', r.version);
    else
      if r.valor is not null and (v_val is null or not exists (
            select 1 from mesa.historial h where h.almacen = v_alm and h.clave = v_cla and h.guardada > now() - interval '5 minutes')) then
        insert into mesa.historial (almacen, clave, valor, version, orden, app, dispositivo, hora)
        values (r.almacen, r.clave, r.valor, r.version, r.orden, r.app, r.dispositivo, r.hora);
      end if;
      v_ord := v_ord + 1;
      update mesa.registros x
         set valor = v_val, version = r.version + 1, orden = v_ord, app = v_app, dispositivo = v_yo, hora = now(),
             borrado = case when v_val is null then now() end
       where x.almacen = v_alm and x.clave = v_cla;
      v_res := v_res || jsonb_build_object('almacen', v_alm, 'clave', v_cla, 'estado', 'ok', 'version', r.version + 1, 'orden', v_ord);
    end if;
  end loop;

  -- Escribir también es señal de vida del que la tiene.
  update mesa.turno set orden = v_ord, latido = now() where id;
  -- Lo de más de 30 días sale del historial, poco a poco: una escritura nunca se hace lenta.
  delete from mesa.historial where id in (
    select h.id from mesa.historial h where h.guardada < now() - interval '30 days' order by h.guardada limit 300);
  return jsonb_build_object('turno', v_turno, 'orden', v_ord, 'hora', now(), 'resultados', to_jsonb(v_res));
end $$;

-- Bajar lo escrito desde un número de orden (sin incluirlo), por orden: como mucho `limite` registros (de 1 a 500; 500 si no
-- se dice) y unos 4 MB de valores por página (siempre al menos uno). `mas` dice si hay más: se sigue con `desde = hasta`.
-- Cada registro baja con su última versión; un borrado, con `valor` nulo y `borrado` verdadero. No hace falta el turno.
create or replace function public.mesa_bajar(desde bigint, limite integer default 500) returns jsonb
  language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_desde bigint := mesa_bajar.desde;
  v_lim integer := least(greatest(coalesce(mesa_bajar.limite, 500), 1), 500);
  r mesa.registros;
  v_filas jsonb[] := '{}';
  v_bytes bigint := 0;
  v_tam bigint;
  v_hasta bigint;
  v_mas boolean := false;
begin
  if not public.es_dueno() then raise exception 'sin permiso' using errcode = '42501'; end if;
  if v_desde is null or v_desde < 0 then raise exception 'desde: un número de orden desde 0' using errcode = 'PT400'; end if;
  v_hasta := v_desde;
  for r in select * from mesa.registros x where x.orden > v_desde order by x.orden limit v_lim loop
    v_tam := coalesce(octet_length(r.valor::text), 0);
    if v_bytes > 0 and v_bytes + v_tam > 4194304 then v_mas := true; exit; end if;
    v_bytes := v_bytes + v_tam;
    v_filas := v_filas || jsonb_build_object('almacen', r.almacen, 'clave', r.clave, 'valor', r.valor, 'version', r.version,
      'orden', r.orden, 'borrado', r.valor is null, 'hora', r.hora, 'app', r.app, 'dispositivo', r.dispositivo);
    v_hasta := r.orden;
  end loop;
  if not v_mas then v_mas := exists (select 1 from mesa.registros x where x.orden > v_hasta); end if;
  return jsonb_build_object('filas', to_jsonb(v_filas), 'hasta', v_hasta, 'mas', v_mas,
    'orden', (select x.orden from mesa.turno x where x.id), 'hora', now());
end $$;

-- Solo Kevin, con sesión: nada para quien no ha entrado.
revoke all on function public.mesa_turno_pedir(text, text), public.mesa_turno_latido(text, bigint, text, integer),
  public.mesa_turno_reclamar(text, bigint, text), public.mesa_turno_soltar(text, bigint),
  public.mesa_escribir(text, bigint, text, jsonb), public.mesa_bajar(bigint, integer) from public, anon;
grant execute on function public.mesa_turno_pedir(text, text), public.mesa_turno_latido(text, bigint, text, integer),
  public.mesa_turno_reclamar(text, bigint, text), public.mesa_turno_soltar(text, bigint),
  public.mesa_escribir(text, bigint, text, jsonb), public.mesa_bajar(bigint, integer) to authenticated;

-- ───────────────────────── Archivos privados ─────────────────────────
-- Almacén `mesa`: copias de trabajo de 2560 px, miniaturas, diseños, PDF de facturas y fotos de sesiones. Ruta por huella:
-- `<almacén de IndexedDB>/<sha256 de los bytes>.<ext>` (p. ej. `files/9f86…0a08.jpg`, `cfacturas/…pdf`): la misma ruta
-- siempre son los mismos bytes, así que una ruta nunca se reutiliza para otra cosa. No hay política de cambiar: un archivo
-- no se sobrescribe ni se mueve (subirlo otra vez da 409, que `supa.subir` cuenta como subido). Solo Kevin lee, lista, sube
-- y borra. Límite de 25 MB por archivo (el global del proyecto es 50 MB: `tools/web.mjs mesa` lo comprueba antes).

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
create policy mesa_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'mesa' and (select public.es_dueno()));
