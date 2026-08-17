-- Ejecutar en Supabase → SQL Editor.
-- Tabla de suscriptores del formulario "Club Epycentro" (index.html #club).

create table if not exists club_subscribers (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  telefono text not null,
  created_at timestamptz not null default now()
);

-- RLS activado y sin policies: nadie puede leer/escribir con las keys
-- públicas (publishable / anon). Solo la service_role key (usada en
-- api/subscribe.js, nunca en el navegador) puede acceder, porque
-- service_role se salta RLS por diseño de Supabase.
alter table club_subscribers enable row level security;
