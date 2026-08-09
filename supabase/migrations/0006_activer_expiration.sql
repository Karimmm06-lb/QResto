-- =============================================================================
-- QResto — activation de l'expiration automatique (D21)
--
-- INCIDENT. La fonction `expirer_sessions_inactives` et son ordonnancement
-- figuraient dans 0001_init.sql, mais l'extension `pg_cron` n'avait pas été
-- installée au moment d'appliquer le schéma. La fonction existait donc en
-- base sans que rien ne l'appelle : D21 n'a jamais été actif en production.
--
-- Constaté sur l'écran caisse : une table affichée « ouverte il y a 55 h ».
-- Conséquences réelles — une table paraît occupée alors qu'elle est libre, et
-- le chiffre d'affaires du jour intègre une session qui n'aurait pas dû rester
-- ouverte.
--
-- Leçon : le dépôt décrivait un comportement que la base ne mettait pas en
-- œuvre. Une migration écrite n'est pas une migration appliquée. Toute
-- fonctionnalité reposant sur une extension doit être vérifiée EN BASE après
-- déploiement, pas seulement relue dans le fichier.
-- =============================================================================

create extension if not exists pg_cron;

-- Idempotent : la planification échouerait si le nom existait déjà.
select cron.unschedule('qresto-expiration-sessions')
where exists (select 1 from cron.job where jobname = 'qresto-expiration-sessions');

select cron.schedule(
  'qresto-expiration-sessions',
  '*/30 * * * *',
  $$select expirer_sessions_inactives()$$
);

-- Vérification à exécuter après tout redéploiement :
--
--   select jobname, schedule, active from cron.job;
--   select count(*) from sessions
--    where statut in ('ouverte','a_payer')
--      and activite_le < now() - interval '4 hours';
--
-- La seconde requête doit renvoyer 0. Si elle renvoie autre chose,
-- l'ordonnancement ne tourne pas.
