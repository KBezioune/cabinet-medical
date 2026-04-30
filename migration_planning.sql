-- Table des créneaux planifiés par date (planning_taches)
-- Utilisée par la vue "Planning équipe" pour les créneaux spécifiques.
create table if not exists planning_taches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  date        date not null,
  tache       text not null,        -- consultation | sterilisation | accueil | administratif | autre | conge
  heure_debut time,
  heure_fin   time,
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

alter table planning_taches disable row level security;
grant select, insert, update, delete on planning_taches to anon, authenticated;
