-- =============================================================================
-- QResto — rétention des données personnelles (D16)
--
-- La commande à distance (R3) a changé l'échelle du sujet : on ne stocke plus
-- un simple prénom mais nom + téléphone + adresse du domicile. Ces données
-- n'ont d'utilité que pendant le service — le temps d'appeler le client, de
-- préparer et de livrer.
--
-- Principe : purger l'identité, conserver les montants. Les statistiques
-- (chiffre d'affaires, plats vendus, heures de pointe) portent sur des totaux
-- et des libellés de plats ; elles n'ont besoin d'aucune donnée personnelle.
-- On ne supprime aucune ligne : on met à NULL les seuls champs personnels.
-- =============================================================================

-- La contrainte de cohérence garantissait qu'une livraison a bien téléphone,
-- adresse et zone. Elle ne doit s'appliquer qu'aux sessions VIVANTES : une
-- fois la session close, l'adresse a fait son travail et doit pouvoir être
-- effacée. Sans cet assouplissement, la purge violerait la contrainte.
alter table sessions drop constraint sessions_coherence_mode;

alter table sessions add constraint sessions_coherence_mode check (
  statut not in ('ouverte','a_payer')
  or case mode
       when 'sur_place'  then table_id is not null and zone_id is null
       when 'a_emporter' then table_id is null
                           and coalesce(client_telephone,'') <> ''
                           and zone_id is null
       when 'livraison'  then table_id is null
                           and coalesce(client_telephone,'') <> ''
                           and coalesce(client_adresse,'') <> ''
                           and zone_id is not null
     end
);

create or replace function purger_donnees_personnelles(p_age interval default interval '7 days')
returns int language plpgsql security definer set search_path = public as $$
declare v_commandes int; v_sessions int;
begin
  update commandes c
     set nom_convive = null
    from sessions s
   where s.id = c.session_id
     and s.statut in ('payee','expiree')
     and s.fermee_le < now() - p_age
     and c.nom_convive is not null;
  get diagnostics v_commandes = row_count;

  update sessions s
     set client_nom = null, client_telephone = null, client_adresse = null
   where s.statut in ('payee','expiree')
     and s.fermee_le < now() - p_age
     and (s.client_nom is not null or s.client_telephone is not null
          or s.client_adresse is not null);
  get diagnostics v_sessions = row_count;

  if v_commandes > 0 or v_sessions > 0 then
    insert into journal_audit (restaurant_id, action, detail)
    select id, 'donnees_personnelles_purgees',
           jsonb_build_object('commandes', v_commandes, 'sessions', v_sessions,
                              'age_jours', extract(day from p_age))
    from restaurants limit 1;
  end if;

  return v_commandes + v_sessions;
end $$;

-- Tâche quotidienne à 4h30. Le délai de 7 jours laisse le temps de traiter une
-- réclamation client avant l'effacement.
select cron.unschedule('qresto-purge-donnees')
 where exists (select 1 from cron.job where jobname = 'qresto-purge-donnees');
select cron.schedule('qresto-purge-donnees', '30 4 * * *',
                     $$select purger_donnees_personnelles()$$);

revoke execute on function purger_donnees_personnelles(interval) from public, anon, authenticated;
