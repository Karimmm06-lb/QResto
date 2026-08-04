-- =============================================================================
-- QResto — idempotence des envois (D10)
--
-- Sur une connexion lente, le client appuie sur « Envoyer », ne voit rien se
-- passer, et appuie une seconde fois. Deux commandes identiques sont créées,
-- le restaurant en produit deux, et il en perd une.
--
-- Le téléphone tire une clé au hasard pour chaque panier et la rejoue à
-- l'identique en cas de nouvelle tentative. Si la clé est déjà connue, la
-- procédure renvoie la commande existante au lieu d'en créer une seconde.
--
-- Désactiver le bouton côté interface ne suffit pas : cela ne protège ni d'un
-- rechargement de page, ni d'un renvoi automatique par le réseau, ni d'un
-- client qui revient en arrière.
-- =============================================================================

alter table commandes add column cle_envoi uuid;

-- Index partiel : les commandes créées sans clé (import, tests) n'y figurent pas.
create unique index commandes_cle_envoi_idx
  on commandes (restaurant_id, cle_envoi) where cle_envoi is not null;

-- La procédure gagne un cinquième argument. Voir 0003_supplements.sql pour le
-- corps complet ; seul l'en-tête et le bloc de reprise ci-dessous changent.
--
--   if p_cle_envoi is not null then
--     select * into v_deja from commandes
--      where restaurant_id = v_resto.id and cle_envoi = p_cle_envoi;
--     if found then
--       return jsonb_build_object('id', v_deja.id, 'secret', v_deja.secret,
--         'numero', v_deja.numero, 'total', v_deja.total,
--         'eta_min', v_deja.eta_min, 'eta_max', v_deja.eta_max, 'doublon', true);
--     end if;
--   end if;
--
-- Le contrôle est placé APRÈS la résolution de la table mais AVANT toute
-- écriture : une clé rejouée ne doit ni consommer un numéro de commande, ni
-- prolonger la session.

-- L'ancienne signature à quatre arguments est supprimée : la laisser exposée
-- permettrait de contourner l'idempotence en l'appelant directement.
drop function if exists creer_commande(uuid, jsonb, text, text);
