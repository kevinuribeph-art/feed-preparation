-- Portal de clientes · esquema del servidor (Supabase, Postgres 15+). Lote 1.
-- Se puede aplicar varias veces: crea lo que falta y rehace restricciones, funciones, disparadores y permisos.
-- Lo aplica `node tools/web.mjs esquema <pruebas|real>` (o se pega en el editor SQL del proyecto).
--
-- Reglas (plan.md, lecciones 81, 86, 88, 89, 118, 136, y la revisión del lote 1):
--   · El cliente solo ve filas de los clientes de los que es miembro, y de una publicación solo si es visible; Kevin
--     (tabla `duenos`) lo ve todo.
--   · Kevin además necesita, con el interruptor `exigir_codigo` encendido, un código de su app de los últimos 30 días en la
--     sesión (`aal2`, D-262). Los clientes no: siguen entrando con su código por correo.
--   · El cliente solo escribe aprobaciones y comentarios, en su nombre, con la hora del servidor y con tope por minuto.
--   · Una cuenta que solo mira (`miembros.observa`, D-266) ve lo mismo que el cliente y no escribe nada: ni aprueba, ni pide
--     cambios, ni comenta. Su fila llega sola a cada cliente nuevo.
--   · Aprobaciones y comentarios solo se añaden; nadie los borra, salvo al borrar un cliente entero.
--   · Los archivos no se abren desde fuera: los firma la función `firmar` (servidor/funciones/firmar.ts) con caducidad fija
--     y solo si los usa algo que ese cliente puede ver.
--   · Los errores para el cliente son códigos HTTP claros (PTxxx) y no distinguen lo ajeno de lo que no existe.

-- ───────────────────────── Tablas ─────────────────────────

create table if not exists public.duenos (
  user_id uuid primary key references auth.users on delete cascade
);

create table if not exists public.clientes (
  id              text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  nombre          text not null check (char_length(btrim(nombre)) between 1 and 80),
  handle          text check (handle is null or char_length(handle) <= 40),
  foto            text check (foto is null or foto ~ '^[a-z0-9-]+/[a-z0-9._-]+$'),
  cuota_cent      integer check (cuota_cent is null or cuota_cent between 0 and 10000000),
  proxima_emision date,
  creado          timestamptz not null default now()
);

-- Un id de cliente borrado no se vuelve a usar: sus archivos podían seguir en el almacén.
create table if not exists public.clientes_borrados (
  id      text primary key,
  borrado timestamptz not null default now()
);

create table if not exists public.miembros (
  user_id    uuid not null references auth.users on delete cascade,
  cliente_id text not null references public.clientes on delete cascade,
  nombre     text not null check (char_length(btrim(nombre)) between 1 and 60),
  primary key (user_id, cliente_id)
);
-- Solo mirar (D-266): ve ese cliente como lo ve él, sin decidir ni comentar. Se da de alta con `tools/web.mjs observador`.
alter table public.miembros add column if not exists observa boolean not null default false;

create table if not exists public.publicaciones (
  cliente_id text not null references public.clientes on delete cascade,
  pid        text not null check (pid ~ '^[0-9a-f]{16}$'),
  mes        text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  orden      integer not null check (orden between 0 and 999),
  tipo       text not null check (tipo in ('foto', 'carrusel', 'reel', 'collab_reel', 'trial_reel')),
  nombre     text not null check (char_length(btrim(nombre)) between 1 and 80),
  fecha      timestamptz,
  sin_hora   boolean not null default false,
  caption    text not null default '' check (char_length(caption) <= 2200),
  imagenes   jsonb not null default '[]' check (jsonb_typeof(imagenes) = 'array' and jsonb_array_length(imagenes) <= 20),
  estado     text not null check (estado in ('preparando', 'por_aprobar', 'aprobada', 'cambios', 'programada', 'publicada')),
  version    text not null check (version ~ '^[0-9a-f]{64}$'),
  visible    boolean not null default true,
  enviada    timestamptz not null default now(),
  primary key (cliente_id, pid)
);
-- La marca de lo leído por Kevin vive en `lecturas` (un upsert con ella en la publicación no podía leer su propia columna).
alter table public.publicaciones drop column if exists vistas_hasta;
create index if not exists publicaciones_mes on public.publicaciones (cliente_id, mes);

create table if not exists public.sesiones (
  cliente_id text not null references public.clientes on delete cascade,
  id         text not null check (char_length(id) between 1 and 60),
  mes        text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  nombre     text not null check (char_length(btrim(nombre)) between 1 and 80),
  inicio     timestamptz not null,
  fin        timestamptz check (fin is null or fin >= inicio),
  sin_hora   boolean not null default false,
  primary key (cliente_id, id)
);
alter table public.sesiones add column if not exists sin_hora boolean not null default false;

create table if not exists public.meses (
  cliente_id text not null references public.clientes on delete cascade,
  mes        text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  porque     jsonb check (porque is null or jsonb_typeof(porque) = 'object'),
  resumen    jsonb check (resumen is null or jsonb_typeof(resumen) = 'object'),
  primary key (cliente_id, mes)
);

create table if not exists public.pagos (
  cliente_id   text not null references public.clientes on delete cascade,
  id           text not null check (char_length(id) between 1 and 80),
  periodo      text check (periodo is null or periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  concepto     text check (concepto is null or char_length(concepto) <= 120),
  importe_cent integer not null check (importe_cent between 0 and 100000000),
  factura      text check (factura is null or char_length(factura) <= 40),
  emitida      date,
  vence        date,
  cobrada      date,
  pdf          text check (pdf is null or pdf ~ '^[a-z0-9-]+/[a-z0-9._-]+\.pdf$'),
  primary key (cliente_id, id)
);

create table if not exists public.aprobaciones (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   text not null,
  pid          text not null,
  version      text not null check (version ~ '^[0-9a-f]{64}$'),
  decision     text not null check (decision in ('aprobada', 'cambios', 'retirada')),
  motivo       text check (motivo is null or char_length(motivo) <= 2000),
  diapositiva  smallint check (diapositiva is null or diapositiva between 1 and 20),
  autor        uuid references auth.users on delete set null default auth.uid(),
  autor_nombre text not null default '',
  hora         timestamptz not null default now(),
  check (decision <> 'cambios' or char_length(btrim(coalesce(motivo, ''))) between 1 and 2000)
);
create index if not exists aprobaciones_hora on public.aprobaciones (cliente_id, hora);

create table if not exists public.comentarios (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   text not null,
  pid          text not null,
  version      text not null check (version ~ '^[0-9a-f]{64}$'),
  diapositiva  smallint check (diapositiva is null or diapositiva between 1 and 20),
  texto        text not null,
  autor        uuid references auth.users on delete set null default auth.uid(),
  autor_nombre text not null default '',
  de_kevin     boolean not null default false,
  hora         timestamptz not null default now(),
  resuelto     timestamptz
);
create index if not exists comentarios_hora on public.comentarios (cliente_id, hora);
create index if not exists comentarios_pid on public.comentarios (cliente_id, pid, hora);
create index if not exists comentarios_autor on public.comentarios (autor, hora);
create index if not exists aprobaciones_autor on public.aprobaciones (autor, hora);

-- Restricciones con nombre, rehechas en cada aplicación (revisión del lote 1):
--   · el texto de un comentario, de 1 a 2.000 caracteres contados enteros (antes se contaba sin espacios: entraban 300.000);
--   · borrar una publicación no se lleva sus aprobaciones ni sus comentarios (una que deja de verse queda `visible=false`);
--     borrar un cliente sí se lleva todo lo suyo.
alter table public.comentarios drop constraint if exists comentarios_texto_check;
alter table public.comentarios add constraint comentarios_texto_check check (char_length(texto) between 1 and 2000 and char_length(btrim(texto)) >= 1);
alter table public.aprobaciones drop constraint if exists aprobaciones_cliente_id_pid_fkey;
alter table public.aprobaciones add constraint aprobaciones_cliente_id_pid_fkey foreign key (cliente_id, pid) references public.publicaciones (cliente_id, pid);
alter table public.aprobaciones drop constraint if exists aprobaciones_cliente_fkey;
alter table public.aprobaciones add constraint aprobaciones_cliente_fkey foreign key (cliente_id) references public.clientes on delete cascade;
alter table public.comentarios drop constraint if exists comentarios_cliente_id_pid_fkey;
alter table public.comentarios add constraint comentarios_cliente_id_pid_fkey foreign key (cliente_id, pid) references public.publicaciones (cliente_id, pid);
alter table public.comentarios drop constraint if exists comentarios_cliente_fkey;
alter table public.comentarios add constraint comentarios_cliente_fkey foreign key (cliente_id) references public.clientes on delete cascade;

create table if not exists public.lecturas (
  user_id     uuid not null references auth.users on delete cascade default auth.uid(),
  cliente_id  text not null references public.clientes on delete cascade,
  visto_hasta timestamptz not null,
  primary key (user_id, cliente_id)
);

-- ───────────────────────── Quién es quién ─────────────────────────
-- security definer: leen `duenos` y `miembros` sin que sus propias políticas entren en bucle.

-- La entrada de Kevin (D-262): además de ser la cuenta dueña, un código de su app (TOTP, `aal2`) de hace menos de 30 días
-- en la sesión, si el interruptor `exigir_codigo` está encendido. El interruptor solo lo cambia `tools/web.mjs codigo` (con la
-- clave secreta): nadie con sesión lo lee ni lo escribe. Al aplicar este archivo se crea apagado y nunca se toca después.
create table if not exists public.ajustes_entrada (
  id            boolean primary key default true check (id),
  exigir_codigo boolean not null default false,
  cambiado      timestamptz not null default now()
);
insert into public.ajustes_entrada (id) values (true) on conflict (id) do nothing;

-- La cuenta dueña (lo que hasta D-262 era `es_dueno()`): sin mirar el código.
create or replace function public.dueno_cuenta() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.duenos d where d.user_id = (select auth.uid()));
$$;

-- La hora del último código de la app en la sesión (null si no hay): el `amr` del token, que pone Supabase y renovar no
-- cambia; un código nuevo en la misma sesión la pone al día. Cuenta la hora del servidor, nunca la del aparato.
create or replace function public.hora_codigo() returns timestamptz
  language sql stable set search_path = '' as $$
  select case when coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
               and jsonb_typeof((select auth.jwt()) -> 'amr') = 'array' then
    (select to_timestamp(max((e ->> 'timestamp')::bigint))
       from jsonb_array_elements((select auth.jwt()) -> 'amr') e
      where jsonb_typeof(e) = 'object' and e ->> 'method' = 'totp' and (e ->> 'timestamp') ~ '^[0-9]{1,12}$')
  end;
$$;

create or replace function public.codigo_reciente() returns boolean
  language sql stable set search_path = '' as $$
  select coalesce(public.hora_codigo() > now() - interval '30 days', false);
$$;

-- Kevin: la cuenta dueña y, con el interruptor encendido, un código de los últimos 30 días. Lo piden las políticas del
-- portal, las del almacén `mesa`, las `mesa_*` (después de `dueno_cuenta()`, para decir «falta el código») y `zernio`.
create or replace function public.es_dueno() returns boolean
  language sql stable security definer set search_path = '' as $$
  select public.dueno_cuenta()
     and (not coalesce((select a.exigir_codigo from public.ajustes_entrada a where a.id), false) or public.codigo_reciente());
$$;

-- Quién eres para la Mesa (D-262): si eres la cuenta dueña y, solo entonces, si el código vale, hasta cuándo y si se exige.
-- La entrada y `zernio` lo usan para decir «falta el código» en vez de «sin permiso».
create or replace function public.mesa_yo() returns jsonb
  language plpgsql stable security definer set search_path = '' as $$
declare
  v_hora timestamptz;
begin
  if not public.dueno_cuenta() then return jsonb_build_object('ok', true, 'dueno', false); end if;
  v_hora := public.hora_codigo();
  return jsonb_build_object('ok', true, 'dueno', true, 'valido', public.es_dueno(),
    'exige', coalesce((select a.exigir_codigo from public.ajustes_entrada a where a.id), false),
    'codigo', v_hora is not null and v_hora > now() - interval '30 days',
    'codigo_hasta', case when v_hora is not null then v_hora + interval '30 days' end,
    'ahora', now());
end $$;

create or replace function public.es_miembro(c text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.miembros m where m.user_id = (select auth.uid()) and m.cliente_id = c);
$$;

-- Quien decide por un cliente: un miembro que no solo mira (D-266). Aprobar, pedir cambios y comentar lo piden.
create or replace function public.puede_decidir(c text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.miembros m where m.user_id = (select auth.uid()) and m.cliente_id = c and not m.observa);
$$;

-- Una publicación que el cliente puede ver: suya y visible (Kevin, todas).
create or replace function public.puede_ver(c text, p text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select public.es_dueno() or (public.es_miembro(c) and exists (
    select 1 from public.publicaciones x where x.cliente_id = c and x.pid = p and x.visible));
$$;

-- ───────────────────────── Disparadores ─────────────────────────
-- Errores (revisión del lote 1): 403 igual para todo lo ajeno, exista o no; PT404, PT409, PT422 y PT429 salen tal cual
-- (un 40001 hacía que PostgREST reintentara 2 minutos y acabara en 504).

-- Lo que escribe un cliente lleva su id, su nombre y la hora del servidor, diga lo que diga la petición (lección 89),
-- con un tope por minuto y autor: 20 comentarios o 10 aprobaciones.
create or replace function public.firmar() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := auth.uid();
  n integer;
begin
  if yo is null then raise exception 'sin permiso' using errcode = '42501'; end if;
  -- una escritura a la vez por persona: el tope cuenta también lo que entra en paralelo
  perform pg_advisory_xact_lock(hashtextextended(yo::text, 0));
  new.id := gen_random_uuid();
  new.hora := now();
  new.autor := yo;
  if tg_table_name = 'comentarios' then
    select count(*) into n from public.comentarios where autor = yo and hora > now() - interval '1 minute';
    if n >= 20 then raise exception 'demasiados comentarios seguidos: espera un minuto' using errcode = 'PT429'; end if;
  else
    select count(*) into n from public.aprobaciones where autor = yo and hora > now() - interval '1 minute';
    if n >= 10 then raise exception 'demasiadas decisiones seguidas: espera un minuto' using errcode = 'PT429'; end if;
  end if;
  if public.es_dueno() then
    new.autor_nombre := 'Kevin · Uribe Visuals';
    if tg_table_name = 'comentarios' then new.de_kevin := true; new.resuelto := null; end if;
  else
    select m.nombre into new.autor_nombre from public.miembros m where m.user_id = yo and m.cliente_id = new.cliente_id;
    if new.autor_nombre is null then raise exception 'sin permiso' using errcode = '42501'; end if;
    if tg_table_name = 'comentarios' then new.de_kevin := false; new.resuelto := null; end if;
  end if;
  return new;
end $$;

-- Una aprobación: primero, que sea de un cliente suyo (si no, el mismo 403 para todo); después, la versión vigente de una
-- publicación visible que espera su decisión (lecciones 86, 132). La fila se bloquea mientras se decide.
create or replace function public.comprobar_aprobacion() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  p public.publicaciones;
begin
  if not public.es_miembro(new.cliente_id) then raise exception 'sin permiso' using errcode = '42501'; end if;
  if not public.puede_decidir(new.cliente_id) then raise exception 'esta cuenta solo mira' using errcode = 'PT403'; end if;   -- D-266
  select * into p from public.publicaciones where cliente_id = new.cliente_id and pid = new.pid for update;
  if not found or not p.visible then raise exception 'publicación no encontrada' using errcode = 'PT404'; end if;
  if p.version <> new.version then raise exception 'la publicación ha cambiado: vuelve a mirarla' using errcode = 'PT409'; end if;
  if new.decision in ('aprobada', 'cambios') and p.estado not in ('por_aprobar', 'aprobada', 'cambios') then
    raise exception 'esta publicación no espera tu decisión' using errcode = 'PT409';
  end if;
  -- Retirar solo deshace una decisión tomada (no abre una que Kevin no ha pedido: revisión del lote 1).
  if new.decision = 'retirada' and p.estado not in ('aprobada', 'cambios') then
    raise exception 'no hay ninguna decisión que retirar' using errcode = 'PT409';
  end if;
  if new.decision <> 'cambios' then new.motivo := null; end if;
  return new;
end $$;

-- La decisión del cliente se ve al momento en su publicación (si sigue en esa versión y esperando decisión).
create or replace function public.aplicar_aprobacion() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('portal.desde_aprobacion', '1', true);
  update public.publicaciones
     set estado = case new.decision when 'aprobada' then 'aprobada' when 'cambios' then 'cambios' else 'por_aprobar' end
   where cliente_id = new.cliente_id and pid = new.pid and version = new.version
     and estado in ('por_aprobar', 'aprobada', 'cambios');
  perform set_config('portal.desde_aprobacion', '', true);
  return null;
end $$;

-- Un envío de Kevin: lleva la hora del servidor y, con la misma versión, no borra una decisión del cliente que su Mesa
-- aún no había leído al enviar (lección 88). El cambio que hace `aplicar_aprobacion` no pasa por aquí.
drop function if exists public.conservar_decision() cascade;
create or replace function public.al_enviar() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if current_setting('portal.desde_aprobacion', true) = '1' then return new; end if;
  new.enviada := now();
  if tg_op = 'UPDATE' and new.version = old.version and new.estado in ('por_aprobar', 'aprobada', 'cambios')
     and old.estado in ('aprobada', 'cambios', 'por_aprobar')
     and exists (select 1 from public.aprobaciones a
                  where a.cliente_id = new.cliente_id and a.pid = new.pid and a.version = new.version
                    and a.hora > coalesce((select l.visto_hasta from public.lecturas l
                                            where l.user_id = auth.uid() and l.cliente_id = new.cliente_id), '-infinity'::timestamptz)) then
    new.estado := old.estado;
  end if;
  return new;
end $$;

-- Un comentario: de un cliente suyo (o de Kevin) y en una publicación que puede ver.
create or replace function public.comprobar_comentario() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_dueno() or public.es_miembro(new.cliente_id)) then raise exception 'sin permiso' using errcode = '42501'; end if;
  if not public.es_dueno() and not public.puede_decidir(new.cliente_id) then raise exception 'esta cuenta solo mira' using errcode = 'PT403'; end if;   -- D-266
  if not public.puede_ver(new.cliente_id, new.pid) then raise exception 'publicación no encontrada' using errcode = 'PT404'; end if;
  if not exists (select 1 from public.publicaciones p where p.cliente_id = new.cliente_id and p.pid = new.pid and p.version = new.version) then
    raise exception 'la publicación ha cambiado: vuelve a mirarla' using errcode = 'PT409';
  end if;
  return new;
end $$;

-- Un id de cliente borrado no vuelve.
create or replace function public.cliente_nuevo() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.clientes_borrados b where b.id = new.id) then
    raise exception 'ese id de cliente ya se usó y se borró' using errcode = 'PT409';
  end if;
  return new;
end $$;

-- Un cliente nuevo: cada cuenta que solo mira lo ve también, con el nombre que ya tiene (D-266).
create or replace function public.cliente_observadores() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.miembros (user_id, cliente_id, nombre, observa)
  select distinct on (m.user_id) m.user_id, new.id, m.nombre, true from public.miembros m where m.observa order by m.user_id, m.nombre
  on conflict (user_id, cliente_id) do nothing;
  return null;
end $$;

drop trigger if exists aprobaciones_firmar on public.aprobaciones;
drop trigger if exists aprobaciones_comprobar on public.aprobaciones;
drop trigger if exists aprobaciones_1_comprobar on public.aprobaciones;
drop trigger if exists aprobaciones_2_firmar on public.aprobaciones;
-- Se disparan por orden alfabético: primero comprobar (permiso), después firmar.
create trigger aprobaciones_1_comprobar before insert on public.aprobaciones for each row execute function public.comprobar_aprobacion();
create trigger aprobaciones_2_firmar before insert on public.aprobaciones for each row execute function public.firmar();
drop trigger if exists aprobaciones_aplicar on public.aprobaciones;
create trigger aprobaciones_aplicar after insert on public.aprobaciones for each row execute function public.aplicar_aprobacion();
drop trigger if exists publicaciones_conservar on public.publicaciones;
drop trigger if exists publicaciones_enviar on public.publicaciones;
create trigger publicaciones_enviar before insert or update on public.publicaciones for each row execute function public.al_enviar();
drop trigger if exists comentarios_firmar on public.comentarios;
drop trigger if exists comentarios_comprobar on public.comentarios;
drop trigger if exists comentarios_1_comprobar on public.comentarios;
drop trigger if exists comentarios_2_firmar on public.comentarios;
create trigger comentarios_1_comprobar before insert on public.comentarios for each row execute function public.comprobar_comentario();
create trigger comentarios_2_firmar before insert on public.comentarios for each row execute function public.firmar();
-- Un cliente borrado, por cualquier vía, deja su id reservado; un id no se cambia (heredaría archivos y facturas de otro).
create or replace function public.cliente_borrado() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.clientes_borrados (id) values (old.id) on conflict (id) do nothing;
  return null;
end $$;
create or replace function public.cliente_mismo_id() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id then raise exception 'el id de un cliente no se cambia' using errcode = 'PT409'; end if;
  return new;
end $$;
drop trigger if exists clientes_nuevo on public.clientes;
create trigger clientes_nuevo before insert on public.clientes for each row execute function public.cliente_nuevo();
drop trigger if exists clientes_observadores on public.clientes;
create trigger clientes_observadores after insert on public.clientes for each row execute function public.cliente_observadores();
drop trigger if exists clientes_borrado on public.clientes;
create trigger clientes_borrado after delete on public.clientes for each row execute function public.cliente_borrado();
drop trigger if exists clientes_mismo_id on public.clientes;
create trigger clientes_mismo_id before update on public.clientes for each row execute function public.cliente_mismo_id();

-- ───────────────────────── Permisos por fila ─────────────────────────

alter table public.duenos            enable row level security;
alter table public.clientes          enable row level security;
alter table public.clientes_borrados enable row level security;
alter table public.miembros          enable row level security;
alter table public.publicaciones     enable row level security;
alter table public.sesiones          enable row level security;
alter table public.meses             enable row level security;
alter table public.pagos             enable row level security;
alter table public.aprobaciones      enable row level security;
alter table public.comentarios       enable row level security;
alter table public.lecturas          enable row level security;
alter table public.ajustes_entrada   enable row level security;   -- sin políticas: nadie con sesión lo ve (D-262)

-- Nada para quien no ha entrado; lo que puede intentar quien ha entrado (las políticas deciden sobre qué filas).
revoke all on public.duenos, public.clientes, public.clientes_borrados, public.miembros, public.publicaciones, public.sesiones,
  public.meses, public.pagos, public.aprobaciones, public.comentarios, public.lecturas, public.ajustes_entrada from anon, authenticated;
-- La clave secreta (solo en .env de Kevin) lo puede todo: altas, bajas y las pruebas. Explícito porque el proyecto se crea
-- sin «Automatically expose new tables».
grant all on public.duenos, public.clientes, public.clientes_borrados, public.miembros, public.publicaciones, public.sesiones,
  public.meses, public.pagos, public.aprobaciones, public.comentarios, public.lecturas, public.ajustes_entrada to service_role;
grant select on public.duenos, public.miembros to authenticated;
-- Kevin no borra clientes desde la página: se borran con `tools/web.mjs borrar-cliente` (antes sus archivos).
grant select, insert, update on public.clientes to authenticated;
grant select, insert, update, delete on public.sesiones, public.meses, public.pagos to authenticated;
-- Publicaciones: Kevin escribe todo; nadie lee `vistas_hasta` (es solo una marca de sus envíos).
grant insert, update, delete on public.publicaciones to authenticated;
grant select (cliente_id, pid, mes, orden, tipo, nombre, fecha, sin_hora, caption, imagenes, estado, version, visible, enviada)
  on public.publicaciones to authenticated;
-- Aprobaciones y comentarios: sin el uuid del autor (basta su nombre).
grant select (id, cliente_id, pid, version, decision, motivo, diapositiva, autor_nombre, hora) on public.aprobaciones to authenticated;
grant insert (cliente_id, pid, version, decision, motivo, diapositiva) on public.aprobaciones to authenticated;
grant select (id, cliente_id, pid, version, diapositiva, texto, autor_nombre, de_kevin, hora, resuelto) on public.comentarios to authenticated;
grant insert (cliente_id, pid, version, diapositiva, texto) on public.comentarios to authenticated;
grant update (resuelto) on public.comentarios to authenticated;
grant select, insert, update on public.lecturas to authenticated;
revoke execute on function public.es_dueno(), public.es_miembro(text), public.puede_ver(text, text), public.puede_decidir(text) from public, anon;
grant execute on function public.es_dueno(), public.es_miembro(text), public.puede_ver(text, text), public.puede_decidir(text) to authenticated;
revoke execute on function public.dueno_cuenta(), public.hora_codigo(), public.codigo_reciente(), public.mesa_yo() from public, anon;
grant execute on function public.dueno_cuenta(), public.hora_codigo(), public.codigo_reciente(), public.mesa_yo() to authenticated;
-- Los disparadores no se llaman por la API (S9, D-278): sin permiso de ejecutarlos para nadie. Siguen saltando en sus tablas
-- (PostgreSQL no mira ese permiso al dispararlos); llamarlos por /rest/v1/rpc ya fallaba, pero el aviso de seguridad de
-- Supabase los contaba como «Public Can Execute SECURITY DEFINER Function».
revoke execute on function public.firmar(), public.comprobar_aprobacion(), public.aplicar_aprobacion(), public.comprobar_comentario(),
  public.cliente_nuevo(), public.cliente_observadores(), public.cliente_borrado() from public, anon, authenticated;

drop policy if exists duenos_ver on public.duenos;
create policy duenos_ver on public.duenos for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists miembros_ver on public.miembros;
create policy miembros_ver on public.miembros for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_dueno()));

drop policy if exists clientes_ver on public.clientes;
create policy clientes_ver on public.clientes for select to authenticated
  using ((select public.es_dueno()) or public.es_miembro(id));
drop policy if exists clientes_kevin on public.clientes;
create policy clientes_kevin on public.clientes for all to authenticated
  using ((select public.es_dueno())) with check ((select public.es_dueno()));

drop policy if exists publicaciones_ver on public.publicaciones;
create policy publicaciones_ver on public.publicaciones for select to authenticated
  using ((select public.es_dueno()) or (visible and public.es_miembro(cliente_id)));
drop policy if exists publicaciones_kevin on public.publicaciones;
create policy publicaciones_kevin on public.publicaciones for all to authenticated
  using ((select public.es_dueno())) with check ((select public.es_dueno()));

drop policy if exists sesiones_ver on public.sesiones;
create policy sesiones_ver on public.sesiones for select to authenticated
  using ((select public.es_dueno()) or public.es_miembro(cliente_id));
drop policy if exists sesiones_kevin on public.sesiones;
create policy sesiones_kevin on public.sesiones for all to authenticated
  using ((select public.es_dueno())) with check ((select public.es_dueno()));

drop policy if exists meses_ver on public.meses;
create policy meses_ver on public.meses for select to authenticated
  using ((select public.es_dueno()) or public.es_miembro(cliente_id));
drop policy if exists meses_kevin on public.meses;
create policy meses_kevin on public.meses for all to authenticated
  using ((select public.es_dueno())) with check ((select public.es_dueno()));

drop policy if exists pagos_ver on public.pagos;
create policy pagos_ver on public.pagos for select to authenticated
  using ((select public.es_dueno()) or public.es_miembro(cliente_id));
drop policy if exists pagos_kevin on public.pagos;
create policy pagos_kevin on public.pagos for all to authenticated
  using ((select public.es_dueno())) with check ((select public.es_dueno()));

-- Aprobaciones y comentarios: los de una publicación que se puede ver (una oculta, tampoco su conversación).
drop policy if exists aprobaciones_ver on public.aprobaciones;
create policy aprobaciones_ver on public.aprobaciones for select to authenticated
  using (public.puede_ver(cliente_id, pid));
-- Solo los clientes aprueban: Kevin aprueba en su Mesa; una cuenta que solo mira, tampoco (D-266).
drop policy if exists aprobaciones_cliente on public.aprobaciones;
create policy aprobaciones_cliente on public.aprobaciones for insert to authenticated
  with check (public.puede_decidir(cliente_id));

drop policy if exists comentarios_ver on public.comentarios;
create policy comentarios_ver on public.comentarios for select to authenticated
  using (public.puede_ver(cliente_id, pid));
drop policy if exists comentarios_escribir on public.comentarios;
create policy comentarios_escribir on public.comentarios for insert to authenticated
  with check (public.puede_ver(cliente_id, pid) and ((select public.es_dueno()) or public.puede_decidir(cliente_id)));
drop policy if exists comentarios_resolver on public.comentarios;
create policy comentarios_resolver on public.comentarios for update to authenticated
  using ((select public.es_dueno())) with check ((select public.es_dueno()));

-- Lo leído es de Kevin («sin leer» en su Mesa).
drop policy if exists lecturas_mias on public.lecturas;
create policy lecturas_mias on public.lecturas for all to authenticated
  using (user_id = (select auth.uid()) and (select public.es_dueno()))
  with check (user_id = (select auth.uid()) and (select public.es_dueno()));

-- ───────────────────────── Archivos privados ─────────────────────────
-- Rutas: fotos/<cliente>/<sha256>.jpg (y -m.jpg), facturas/<cliente>/<id>.pdf. Solo Kevin lista, sube y borra; los
-- clientes no leen el almacén: la función `firmar` les da URL de 10 minutos (fotos) o 60 s (facturas) de lo que pueden ver.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/webp']),
       ('facturas', 'facturas', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists archivos_ver on storage.objects;
create policy archivos_ver on storage.objects for select to authenticated
  using (bucket_id in ('fotos', 'facturas') and (select public.es_dueno()));
drop policy if exists archivos_kevin_subir on storage.objects;
create policy archivos_kevin_subir on storage.objects for insert to authenticated
  with check (bucket_id in ('fotos', 'facturas') and (select public.es_dueno()));
drop policy if exists archivos_kevin_cambiar on storage.objects;
create policy archivos_kevin_cambiar on storage.objects for update to authenticated
  using (bucket_id in ('fotos', 'facturas') and (select public.es_dueno()))
  with check (bucket_id in ('fotos', 'facturas') and (select public.es_dueno()));
drop policy if exists archivos_kevin_borrar on storage.objects;
create policy archivos_kevin_borrar on storage.objects for delete to authenticated
  using (bucket_id in ('fotos', 'facturas') and (select public.es_dueno()));
