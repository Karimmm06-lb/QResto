-- =============================================================================
-- QResto — commande à distance (à emporter et livraison)
--
-- Rouvre E2 (« sur place uniquement »). Le produit couvre trois modes :
--
--   sur_place    arrivé par le QR d'une table. Le client est dans la salle.
--   a_emporter   commandé à distance, retiré au comptoir, payé en caisse.
--   livraison    commandé à distance, porté par un livreur, payé à la porte.
--
-- Règle centrale (R2 + R3) : une commande à distance ne part JAMAIS en cuisine
-- avant que le caissier ait appelé le client. L'appel confirme la commande,
-- prouve que le numéro est réel et annonce le délai — trois fonctions en un
-- seul geste, sans coût d'envoi de SMS.
--
-- Ce que la commande à distance a fait tomber, et comment c'est remplacé :
--   · la session de table        → session sans table, même unité de facturation
--   · le paiement en caisse      → conservé pour le retrait, déporté au livreur
--   · « le caissier voit la salle » → l'appel téléphonique (R3)
--   · « aucune inscription »     → exception assumée : téléphone obligatoire
-- =============================================================================

-- --- Zones de livraison (R5) -------------------------------------------------
-- Les frais dépendent de la distance : livrer à Cheraga ne coûte pas le même
-- prix que livrer à Aïn Benian. Chaque restaurant définit ses zones et le
-- montant minimum de commande qui s'y applique.
create table zones_livraison (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  nom           text not null,
  frais         numeric(10,2) not null check (frais >= 0),
  minimum       numeric(10,2) not null default 0 check (minimum >= 0),
  active        boolean not null default true,
  ordre         int not null default 0,
  unique (restaurant_id, nom)
);

create index on zones_livraison (restaurant_id) where active;

-- --- Paramètres du restaurant ------------------------------------------------
alter table restaurants
  -- Interrupteurs manuels plutôt qu'horaires programmés : un restaurant ferme
  -- plus tôt certains soirs, sature un vendredi, tombe en rupture. Un bouton
  -- que le caissier coupe est plus fiable qu'un planning qu'il oubliera de
  -- tenir à jour.
  add column emporter_actif    boolean not null default false,
  add column livraison_active  boolean not null default false,
  -- Délai minimum avant l'heure de retrait souhaitée (R6).
  add column delai_min_minutes int not null default 30;

-- --- Sessions ----------------------------------------------------------------
-- Une commande à distance forme sa propre session : même unité de facturation,
-- même encaissement, mêmes statistiques. Seule la table manque.
alter table sessions alter column table_id drop not null;

alter table sessions
  add column mode text not null default 'sur_place'
      check (mode in ('sur_place','a_emporter','livraison')),
  add column client_nom       text,
  add column client_telephone text,
  add column client_adresse   text,
  add column zone_id          uuid references zones_livraison(id) on delete restrict,
  add column frais_livraison  numeric(10,2) not null default 0,
  add column heure_souhaitee  timestamptz,   -- NULL = dès que possible
  add column confirmee_le     timestamptz,
  add column livree_le        timestamptz;

-- Cohérence des trois modes, portée par la base et non par le navigateur :
-- le client n'étant pas authentifié, un contrôle côté interface serait
-- contournable.
alter table sessions add constraint sessions_coherence_mode check (
  case mode
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

-- L'unicité ne concerne que les tables physiques : deux sessions à distance
-- simultanées sont normales. NULL n'entre pas dans un index unique, mais on
-- l'exclut explicitement pour que l'intention soit lisible.
drop index if exists sessions_une_ouverte_par_table;
create unique index sessions_une_ouverte_par_table
  on sessions (table_id)
  where table_id is not null and statut in ('ouverte','a_payer');

-- --- Commandes ---------------------------------------------------------------
-- Deux états s'ajoutent : « à confirmer » précède tout pour une commande à
-- distance, « en livraison » s'intercale avant la remise.
alter table commandes drop constraint if exists commandes_statut_check;
alter table commandes add constraint commandes_statut_check check (
  statut in ('a_confirmer','nouvelle','cuisine','prete','en_livraison','servie','annulee')
);

comment on column commandes.statut is
  'sur place : nouvelle → cuisine → prete → servie. '
  'à distance : a_confirmer → nouvelle → cuisine → prete → [en_livraison] → servie.';
