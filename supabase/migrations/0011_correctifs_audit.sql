-- Correctifs relevés à l'audit du 2026-08-13.

-- 1) Bug : creer_commande_distance n'appelait que valider_lignes (générique).
-- Les plats livrable=false (viandes à cuisson précise, glaces, boissons chaudes)
-- passaient donc en livraison, contredisant la logique métier. La fonction
-- valider_lignes_distance existait mais n'était plus référencée : on l'ajoute.
create or replace function public.creer_commande_distance(
  p_restaurant_slug text, p_mode text, p_lignes jsonb, p_nom text, p_telephone text,
  p_adresse text default null, p_zone_id uuid default null,
  p_heure_souhaitee timestamptz default null, p_note text default null,
  p_cle_envoi uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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

  if p_cle_envoi is not null then
    select * into v_deja from commandes
     where restaurant_id = v_resto.id and cle_envoi = p_cle_envoi;
    if found then
      return jsonb_build_object('id', v_deja.id, 'secret', v_deja.secret,
        'numero', v_deja.numero, 'total', v_deja.total, 'doublon', true);
    end if;
  end if;

  perform valider_lignes(v_resto.id, p_lignes);
  perform valider_lignes_distance(v_resto.id, p_lignes);   -- <-- correctif
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

-- 2) Faille : zones_livraison n'avait pas RLS activé — n'importe qui avec la
-- clé publique pouvait lire ou modifier les tarifs. Lecture publique conservée
-- (la vitrine anonyme en a besoin), écriture réservée au gérant du restaurant.
alter table public.zones_livraison enable row level security;

create policy zones_livraison_select_public on public.zones_livraison
  for select using (true);

create policy zones_livraison_ecriture_gerant on public.zones_livraison
  for all
  using (restaurant_id = public.mon_restaurant())
  with check (restaurant_id = public.mon_restaurant());
