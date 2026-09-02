-- ============================================================
-- ⚠️  RÉINITIALISATION DES DONNÉES DE TEST — USAGE UNIQUE ⚠️
-- ============================================================
-- À exécuter UNE SEULE FOIS dans Supabase SQL Editor, juste avant la
-- mise en production, pour repartir sur des données propres.
--
-- Cette migration est DESTRUCTIVE et IRRÉVERSIBLE : elle vide
-- complètement les tables listées ci-dessous. NE PAS la rejouer après
-- la mise en production (elle effacerait les vraies données saisies
-- par l'équipe).
--
-- Conservés : users (comptes/rôles) et tout le planning
-- (planning, planning_events, planning_taches, planning_shifts, planning_tasks).
-- ============================================================

DELETE FROM pointages;
DELETE FROM access_logs;
DELETE FROM conges;
DELETE FROM messages;
DELETE FROM expense_reports;   -- notes de frais

-- Tables volontairement NON touchées : users, planning, planning_events,
-- planning_taches, planning_shifts, planning_tasks, notifications,
-- payslips, documents.
