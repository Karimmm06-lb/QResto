-- =============================================================================
-- QResto — procédures de la commande à distance
--
-- Distinctes de `creer_commande` : le parcours par QR n'a ni téléphone, ni
-- adresse, ni zone, et ne doit pas être alourdi par des paramètres qui ne le
-- concernent pas.
-- =============================================================================

create or replace function creer_commande_distance(
  p_restaurant_slug text,
  p_mode            text,          -- 'a_emporter' | 'livraison'
  p_lignes          jsonb,
  p_nom             text,
  p_telephone       text,
  p_adresse         text default null,
  p_zone_id         uuid default null,
  p_heure_souhaitee timestamptz default null,   -- NULL = dès que possible
  p_note            text default null,
  p_cle_envoi       uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_resto restaurants%rowtype;
  v_zone zones_livraison%rowtype;
  v_journee date; v_session uuid; v_commande uuid; v_secret uuid;
  v_numero int; v_sous_total numeric(10,2); v_frais numeric(10,2) := 0;
  l jsonb; s jsonb; v_ligne uuid; v_attendu int := 0; v_insere int;
  v_deja commandes%rowtype;
begin
  if p_mode not in ('a_emporter','livraison') then
    raise exception 'Mode invalide' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_lignes,'[]'::jsonb)) = 0 then
    raise exception 'Commande vide' using errcode = '22023';
  end if;
  if coalesce(trim(p_nom),'') = '' or coalesce(trim(p_telephone),'') = '' then
    raise exception 'Nom et téléphone obligatoires' using errcode = '22023';
  end if;

  select * into v_resto from restaurants where slug = p_restaurant_slug;
  if not found then raise exception 'Restaurant inconnu' using errcode = 'P0002'; end if;

  -- L'interrupteur du caissier fait foi : il coupe les commandes à distance
  -- quand la cuisine sature ou que le service se termine.
  if p_mode = 'a_emporter' and not v_resto.emporter_actif then
    raise exception 'Les commandes à emporter sont fermées pour le moment'
      using errcode = '22023';
  end if;
  if p_mode = 'livraison' and not v_resto.livraison_active then
    raise exception 'La livraison est fermée pour le moment' using errcode = '22023';
  end if;

  if p_heure_souhaitee is not null
     and p_heure_souhaitee < now() + (v_resto.delai_min_minutes || ' minutes')::interval then
    raise exception 'Heure trop proche' using errcode = '22023';
  end if;

  if p_mode = 'livraison' then
    select * into v_zone from zones_livraison
     where id = p_zone_id and restaurant_id = v_resto.id and active;
    if not found then raise exception 'Zone de livraison inconnue' using errcode = 'P0002'; end if;
    if coalesce(trim(p_adresse),'') = '' then
      raise exception 'Adresse obligatoire pour une livraison' using errcode = '22023';
    end if;
    v_frais := v_zone.frais;
  end if;

  -- Idempotence (D10), identique au parcours par QR.
  if p_cle_envoi is not null then
    select * into v_deja from commandes
     where restaurant_id = v_resto.id and cle_envoi = p_cle_envoi;
    if found then
      return jsonb_build_object('id', v_deja.id, 'secret', v_deja.secret,
        'numero', v_deja.numero, 'total', v_deja.total, 'doublon', true);
    end if;
  end if;

  perform valider_lignes(v_resto.id, p_lignes);
  v_journee := journee_exploitation(v_resto.id);

  insert into sessions (restaurant_id, table_id, journee, mode,
                        client_nom, client_telephone, client_adresse,
                        zone_id, frais_livraison, heure_souhaitee)
  values (v_resto.id, null, v_journee, p_mode,
          trim(p_nom), trim(p_telephone), nullif(trim(p_adresse),''),
          case when p_mode = 'livraison' then p_zone_id end, v_frais, p_heure_souhaitee)
  returning id into v_session;

  insert into compteurs_journee (restaurant_id, journee, dernier_numero)
  values (v_resto.id, v_journee, 101)
  on conflict (restaurant_id, journee)
    do update set dernier_numero = compteurs_journee.dernier_numero + 1
  returning dernier_numero into v_numero;

  -- Statut initial « à confirmer » : rien ne part en cuisine avant l'appel.
  insert into commandes (restaurant_id, session_id, numero, journee, statut,
                         nom_convive, note, cle_envoi)
  values (v_resto.id, v_session, v_numero, v_journee, 'a_confirmer',
          trim(p_nom), nullif(trim(p_note),''), p_cle_envoi)
  returning id, secret into v_commande, v_secret;

  for l in select * from jsonb_array_elements(p_lignes)
  loop
    v_attendu := v_attendu + 1;
    insert into lignes_commande (commande_id, variante_id, plat_id, quantite, prix_unitaire, libelle)
    select v_commande, v.id, p.id, (l->>'quantite')::int, v.prix,
           p.nom_fr || case when v.libelle_fr = 'Standard' then '' else ' ('||v.libelle_fr||')' end
    from variantes_plat v join plats p on p.id = v.plat_id
    where v.id = (l->>'variante_id')::uuid and p.restaurant_id = v_resto.id
      and p.disponible and not p.archive and not p.est_supplement
    returning id into v_ligne;

    if v_ligne is null then
      raise exception 'Un plat n''est plus disponible' using errcode = '23514';
    end if;

    for s in select * from jsonb_array_elements(coalesce(l->'supplements','[]'::jsonb))
    loop
      v_attendu := v_attendu + 1;
      insert into lignes_commande (commande_id, variante_id, plat_id, quantite,
                                   prix_unitaire, libelle, parent_ligne_id)
      select v_commande, v.id, p.id,
             greatest(1, least(50, coalesce((s->>'quantite')::int, 1))),
             v.prix, p.nom_fr, v_ligne
      from variantes_plat v join plats p on p.id = v.plat_id
      where v.id = (s->>'variante_id')::uuid and p.restaurant_id = v_resto.id
        and p.disponible and not p.archive and p.est_supplement;
    end loop;
  end loop;

  select count(*) into v_insere from lignes_commande where commande_id = v_commande;
  if v_insere <> v_attendu then
    raise exception 'Un plat n''est plus disponible' using errcode = '23514';
  end if;

  select coalesce(sum(quantite*prix_unitaire),0) into v_sous_total
  from lignes_commande where commande_id = v_commande;

  if p_mode = 'livraison' and v_sous_total < v_zone.minimum then
    raise exception 'Commande minimum de % DA pour cette zone', v_zone.minimum
      using errcode = '22023';
  end if;

  update commandes set total = v_sous_total where id = v_commande;
  update sessions set total = v_sous_total + v_frais, activite_le = now()
   where id = v_session;

  insert into journal_audit (restaurant_id, commande_id, session_id, action, detail)
  values (v_resto.id, v_commande, v_session, 'commande_distance_creee',
          jsonb_build_object('mode', p_mode, 'numero', v_numero,
                             'total', v_sous_total + v_frais));

  return jsonb_build_object('id', v_commande, 'secret', v_secret, 'numero', v_numero,
    'sous_total', v_sous_total, 'frais_livraison', v_frais,
    'total', v_sous_total + v_frais, 'doublon', false);
end $$;

-- Le caissier appelle le client, puis confirme. C'est l'acte qui autorise la
-- production (R2 + R3).
create or replace function confirmer_commande(p_commande_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update commandes set statut = 'nouvelle'
   where id = p_commande_id and restaurant_id = mon_restaurant()
     and statut = 'a_confirmer';
  if not found then
    raise exception 'Commande introuvable ou déjà confirmée' using errcode = 'P0002';
  end if;

  update sessions s set confirmee_le = now()
   from commandes c where c.id = p_commande_id and s.id = c.session_id;

  insert into journal_audit (restaurant_id, commande_id, action, acteur)
  values (mon_restaurant(), p_commande_id, 'commande_confirmee', auth.uid());
end $$;

-- R7 : c'est le caissier qui acte le paiement au retour du livreur, pas le
-- livreur lui-même. Aucun outil à installer, aucun utilisateur de plus à former.
create or replace function marquer_en_livraison(p_commande_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update commandes set statut = 'en_livraison'
   where id = p_commande_id and restaurant_id = mon_restaurant() and statut = 'prete';
  if not found then
    raise exception 'La commande doit être prête' using errcode = 'P0002';
  end if;
  insert into journal_audit (restaurant_id, commande_id, action, acteur)
  values (mon_restaurant(), p_commande_id, 'partie_en_livraison', auth.uid());
end $$;

revoke execute on function creer_commande_distance(text,text,jsonb,text,text,text,uuid,timestamptz,text,uuid) from public;
grant  execute on function creer_commande_distance(text,text,jsonb,text,text,text,uuid,timestamptz,text,uuid) to anon, authenticated;
revoke execute on function confirmer_commande(uuid) from public, anon;
grant  execute on function confirmer_commande(uuid) to authenticated;
revoke execute on function marquer_en_livraison(uuid) from public, anon;
grant  execute on function marquer_en_livraison(uuid) to authenticated;
