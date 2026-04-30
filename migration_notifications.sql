-- Migration : table notifications
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  type       text not null,          -- conge_demande | conge_approuve | conge_refuse | conge_modifie
  message    text not null,
  lu         boolean not null default false,
  conge_id   uuid,
  created_at timestamptz not null default now()
);

-- Pas de RLS pour cette table
alter table notifications disable row level security;

-- Droits lecture/écriture pour les clients anon et authenticated
grant select, insert, update on notifications to anon, authenticated;
