-- Portal de clientes · esquema del servidor (Supabase, Postgres 15+). Lote 1.
-- Se puede aplicar varias veces: crea lo que falta y rehace funciones, disparadores y permisos.
-- Lo aplica `node tools/web.mjs esquema <pruebas|real>` (o se pega en el editor SQL del proyecto).
--
-- Reglas (plan.md, lecciones 81, 86, 88, 89, 118, 136):
--   · El cliente solo ve filas de los clientes de los que es miembro; Kevin (tabla `duenos`) lo ve todo.
--   · El cliente solo escribe aprobaciones y comentarios, en su nombre y con la hora del servidor.
--   · Aprobaciones y comentarios solo se añaden; nadie los borra (salvo al borrar un cliente entero).
--   · Ninguna tabla guarda nada privado de Kevin: lo que llega aquí ya viene filtrado desde la Mesa.

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

create table if not exists public.miembros (
  user_id    uuid not null references auth.users on delete cascade,
  cliente_id text not null references public.clientes on delete cascade,
  nombre     text not null check (char_length(btrim(nombre)) between 1 and 60),
  primary key (user_id, cliente_id)
);

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
  -- Hasta qué hora había leído Kevin las decisiones del cliente cuando envió (lo pone la Mesa).
  vistas_hasta timestamptz,
  primary key (cliente_id, pid)
);
create index if not exists publicaciones_mes on public.publicaciones (cliente_id, mes);

create table if not exists public.sesiones (
  cliente_id text not null references public.clientes on delete cascade,
  id         text not null check (char_length(id) between 1 and 60),
  mes        text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  nombre     text not null check (char_length(btrim(nombre)) between 1 and 80),
  inicio     timestamptz not null,
  fin        timestamptz check (fin is null or fin >= inicio),
  primary key (cliente_id, id)
);

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
  id         uuid primary key default gen_random_uuid(),
  cliente_id text not null,
  pid        text not null,
  version    text not null check (version ~ '^[0-9a-f]{64}$'),
  decision   text not null check (decision in ('aprobada', 'cambios', 'retirada')),
  motivo     text check (motivo is null or char_length(motivo) <= 2000),
  diapositiva smallint check (diapositiva is null or diapositiva between 1 and 20),
  autor      uuid references auth.users on delete set null default auth.uid(),
  autor_nombre text not null default '',
  hora       timestamptz not null default now(),
  foreign key (cliente_id, pid) references public.publicaciones (cliente_id, pid) on delete cascade,
  check (decision <> 'cambios' or char_length(btrim(coalesce(motivo, ''))) between 1 and 2000)
);
create index if not exists aprobaciones_hora on public.aprobaciones (cliente_id, hora);

create table if not exists public.comentarios (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   text not null,
  pid          text not null,
  version      text not null check (version ~ '^[0-9a-f]{64}$'),
  diapositiva  smallint check (diapositiva is null or diapositiva between 1 and 20),
  texto        text not null check (char_length(btrim(texto)) between 1 and 2000),
  autor        uuid references auth.users on delete set null default auth.uid(),
  autor_nombre text not null default '',
  de_kevin     boolean not null default false,
  hora         timestamptz not null default now(),
  resuelto     timestamptz,
  foreign key (cliente_id, pid) references public.publicaciones (cliente_id, pid) on delete cascade
);
create index if not exists comentarios_hora on public.comentarios (cliente_id, hora);
create index if not exists comentarios_pid on public.comentarios (cliente_id, pid, hora);

create table if not exists public.lecturas (
  user_id     uuid not null references auth.users on delete cascade default auth.uid(),
  cliente_id  text not null references public.clientes on delete cascade,
  visto_hasta timestamptz not null,
  primary key (user_id, cliente_id)
);

-- ───────────────────────── Quién es quién ─────────────────────────
-- security definer: leen `duenos` y `miembros` sin que sus propias políticas entren en bucle.

create or replace function public.es_dueno() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.duenos d where d.user_id = (select auth.uid()));
$$;

create or replace function public.es_miembro(c text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.miembros m where m.user_id = (select auth.uid()) and m.cliente_id = c);
$$;

-- ───────────────────────── Disparadores ─────────────────────────

-- Lo que escribe un cliente lleva su id, su nombre y la hora del servidor, diga lo que diga la petición (lección 89).
create or replace function public.firmar() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := auth.uid();
begin
  new.id := gen_random_uuid();
  new.hora := now();
  new.autor := yo;
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

-- Una aprobación solo vale para la versión vigente de una publicación visible y en su momento (lecciones 86, 132).
create or replace function public.comprobar_aprobacion() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  p public.publicaciones;
begin
  select * into p from public.publicaciones where cliente_id = new.cliente_id and pid = new.pid;
  if not found or not p.visible then raise exception 'publicación no encontrada' using errcode = 'P0002'; end if;
  if p.version <> new.version then raise exception 'versión anterior' using errcode = '40001'; end if;
  if new.decision in ('aprobada', 'cambios') and p.estado not in ('por_aprobar', 'aprobada', 'cambios') then
    raise exception 'no se puede aprobar ahora' using errcode = '22023';
  end if;
  if new.decision = 'retirada' and p.estado in ('programada', 'publicada') then
    raise exception 'ya está programada' using errcode = '22023';
  end if;
  if new.decision <> 'cambios' then new.motivo := null; end if;
  return new;
end $$;

-- La decisión del cliente se ve al momento en su publicación.
create or replace function public.aplicar_aprobacion() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('portal.desde_aprobacion', '1', true);
  update public.publicaciones
     set estado = case new.decision when 'aprobada' then 'aprobada' when 'cambios' then 'cambios' else 'por_aprobar' end
   where cliente_id = new.cliente_id and pid = new.pid and version = new.version;
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
  if tg_op = 'UPDATE' and new.version = old.version and old.estado in ('aprobada', 'cambios', 'por_aprobar')
     and exists (select 1 from public.aprobaciones a
                  where a.cliente_id = new.cliente_id and a.pid = new.pid and a.version = new.version
                    and a.hora > coalesce(new.vistas_hasta, '-infinity'::timestamptz)) then
    new.estado := old.estado;
  end if;
  return new;
end $$;

-- Un comentario solo en una publicación visible de ese cliente.
create or replace function public.comprobar_comentario() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.publicaciones p where p.cliente_id = new.cliente_id and p.pid = new.pid and p.visible) then
    raise exception 'publicación no encontrada' using errcode = 'P0002';
  end if;
  return new;
end $$;

drop trigger if exists aprobaciones_firmar on public.aprobaciones;
create trigger aprobaciones_firmar before insert on public.aprobaciones for each row execute function public.firmar();
drop trigger if exists aprobaciones_comprobar on public.aprobaciones;
create trigger aprobaciones_comprobar before insert on public.aprobaciones for each row execute function public.comprobar_aprobacion();
drop trigger if exists aprobaciones_aplicar on public.aprobaciones;
create trigger aprobaciones_aplicar after insert on public.aprobaciones for each row execute function public.aplicar_aprobacion();
drop trigger if exists publicaciones_enviar on public.publicaciones;
create trigger publicaciones_enviar before insert or update on public.publicaciones for each row execute function public.al_enviar();
drop trigger if exists comentarios_firmar on public.comentarios;
create trigger comentarios_firmar before insert on public.comentarios for each row execute function public.firmar();
drop trigger if exists comentarios_comprobar on public.comentarios;
create trigger comentarios_comprobar before insert on public.comentarios for each row execute function public.comprobar_comentario();

-- ───────────────────────── Permisos por fila ─────────────────────────

alter table public.duenos        enable row level security;
alter table public.clientes      enable row level security;
alter table public.miembros      enable row level security;
alter table public.publicaciones enable row level security;
alter table public.sesiones      enable row level security;
alter table public.meses         enable row level security;
alter table public.pagos         enable row level security;
alter table public.aprobaciones  enable row level security;
alter table public.comentarios   enable row level security;
alter table public.lecturas      enable row level security;

-- Nada para quien no ha entrado.
revoke all on public.duenos, public.clientes, public.miembros, public.publicaciones, public.sesiones, public.meses,
  public.pagos, public.aprobaciones, public.comentarios, public.lecturas from anon;
-- Lo que puede intentar quien ha entrado; las políticas deciden sobre qué filas.
revoke all on public.duenos, public.clientes, public.miembros, public.publicaciones, public.sesiones, public.meses,
  public.pagos, public.aprobaciones, public.comentarios, public.lecturas from authenticated;
-- La clave secreta (solo en .env de Kevin) lo puede todo: altas y la prueba de aislamiento. Explícito porque el proyecto
-- se crea sin «Automatically expose new tables».
grant all on public.duenos, public.clientes, public.miembros, public.publicaciones, public.sesiones, public.meses,
  public.pagos, public.aprobaciones, public.comentarios, public.lecturas to service_role;
grant select on public.duenos, public.miembros, public.aprobaciones to authenticated;
grant select, insert, update, delete on public.clientes, public.publicaciones, public.sesiones, public.meses, public.pagos to authenticated;
grant insert (cliente_id, pid, version, decision, motivo, diapositiva) on public.aprobaciones to authenticated;
grant select on public.comentarios to authenticated;
grant insert (cliente_id, pid, version, diapositiva, texto) on public.comentarios to authenticated;
grant update (resuelto) on public.comentarios to authenticated;
grant select, insert, update on public.lecturas to authenticated;
revoke execute on function public.es_dueno(), public.es_miembro(text) from public, anon;
grant execute on function public.es_dueno(), public.es_miembro(text) to authenticated;

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

drop policy if exists aprobaciones_ver on public.aprobaciones;
create policy aprobaciones_ver on public.aprobaciones for select to authenticated
  using ((select public.es_dueno()) or public.es_miembro(cliente_id));
-- Solo los clientes aprueban: Kevin aprueba en su Mesa.
drop policy if exists aprobaciones_cliente on public.aprobaciones;
create policy aprobaciones_cliente on public.aprobaciones for insert to authenticated
  with check (public.es_miembro(cliente_id));

drop policy if exists comentarios_ver on public.comentarios;
create policy comentarios_ver on public.comentarios for select to authenticated
  using ((select public.es_dueno()) or public.es_miembro(cliente_id));
drop policy if exists comentarios_escribir on public.comentarios;
create policy comentarios_escribir on public.comentarios for insert to authenticated
  with check ((select public.es_dueno()) or public.es_miembro(cliente_id));
drop policy if exists comentarios_resolver on public.comentarios;
create policy comentarios_resolver on public.comentarios for update to authenticated
  using ((select public.es_dueno())) with check ((select public.es_dueno()));

drop policy if exists lecturas_mias on public.lecturas;
create policy lecturas_mias on public.lecturas for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and ((select public.es_dueno()) or public.es_miembro(cliente_id)));

-- ───────────────────────── Archivos privados ─────────────────────────
-- Rutas: fotos/<cliente>/<sha256>.jpg (y -m.jpg), facturas/<cliente>/<id>.pdf. La primera carpeta es el cliente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/webp']),
       ('facturas', 'facturas', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists archivos_ver on storage.objects;
create policy archivos_ver on storage.objects for select to authenticated
  using (bucket_id in ('fotos', 'facturas')
         and ((select public.es_dueno()) or public.es_miembro((storage.foldername(name))[1])));
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
