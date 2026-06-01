-- Migration : ajout colonne tache dans planning_shifts
-- Exécuter dans Supabase SQL Editor

ALTER TABLE planning_shifts ADD COLUMN IF NOT EXISTS tache TEXT;
