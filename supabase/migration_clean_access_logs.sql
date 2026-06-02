-- Supprime les entrées liées au compte Test Admin et les entrées sans utilisateur (Inconnu)
-- user_id NULL  → tentatives de connexion non attribuées
-- user_id 099   → compte Test Admin
DELETE FROM access_logs
WHERE user_id IS NULL
   OR user_id = '00000000-0000-0000-0000-000000000099';
