-- ============================================================
-- MIGRATION : horaires individuels corrects par collaborateur
-- Exécuter dans Supabase SQL Editor
-- ============================================================
-- Nouveau planning par défaut (géré côté code dans PlanningPartage.jsx) :
--   Imene (apprentie)          : lundi, mardi 08h30-12h00 + 14h00-17h00
--                                 absente le reste de la semaine (école)
--   Dessa, Talya, Dr. Bezioune : lundi, mardi, jeudi, vendredi
--                                 08h30-12h00 + 14h00-17h00
--                                 mercredi 08h30-12h00 seulement
--                                 fermé samedi/dimanche
--
-- Cette migration supprime les anciens créneaux journée complète
-- (08h00-17h00 / 08h30-17h30) devenus obsolètes, pour laisser le
-- nouveau planning par défaut du code s'appliquer.
-- ============================================================

-- Anciens créneaux récurrents (table "planning", 1 ligne / jour / collaborateur)
DELETE FROM planning
WHERE (heure_debut, heure_fin) IN (('08:00','17:00'), ('08:30','17:30'));

-- Anciens créneaux ponctuels (table "planning_shifts")
DELETE FROM planning_shifts
WHERE (heure_debut, heure_fin) IN (('08:00','17:00'), ('08:30','17:30'));
