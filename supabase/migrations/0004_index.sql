-- =============================================================================
-- QResto — index manquants
--
-- Relevés par l'audit de performance après déploiement. Une clé étrangère sans
-- index couvrant force un balayage complet de la table fille à chaque
-- suppression ou mise à jour du parent, et ralentit les jointures.
--
-- Invisible sur une base de démonstration, pénalisant dès qu'un restaurant
-- accumule quelques mois de commandes (§2.6 : jusqu'à 100 000 lignes par an).
-- =============================================================================

create index on categories (restaurant_id);
create index on sessions (restaurant_id);
create index on plats (categorie_id);
create index on lignes_commande (variante_id);
create index on supplements_categories (categorie_id);

-- Requête la plus fréquente du poste caisse : les sessions ouvertes d'un
-- restaurant, triées par ancienneté. Index partiel : les sessions payées et
-- expirées n'y figurent pas, il reste donc petit même après des années.
create index sessions_ouvertes_idx
  on sessions (restaurant_id, ouverte_le desc)
  where statut in ('ouverte', 'a_payer');

-- Statistiques du gérant : les commandes d'une journée d'exploitation.
create index commandes_journee_idx on commandes (restaurant_id, journee);
