-- Supprime toutes les entrées liées au compte Test Admin et les entrées "Inconnu" (user_id null)
DELETE FROM access_logs
WHERE user_id IS NULL
   OR user_id = '00000000-0000-0000-0000-000000000099';
