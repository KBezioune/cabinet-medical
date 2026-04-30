-- ── Table logs d'accès ───────────────────────────────────────
create table if not exists access_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  action     text not null,   -- login_success | login_failure
  ip         text,            -- null côté client (résolu côté serveur si besoin)
  user_agent text,
  created_at timestamptz not null default now()
);

alter table access_logs disable row level security;
grant select, insert on access_logs to anon, authenticated;

-- ── Colonne mot de passe plus long ───────────────────────────
-- À exécuter si la colonne pin est encore VARCHAR(4) ou similaire
alter table users alter column pin type varchar(255);
