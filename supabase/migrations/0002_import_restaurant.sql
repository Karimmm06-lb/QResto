-- =============================================================================
-- QResto — intégration d'un restaurant
--
-- D14 / R4 : la saisie initiale du menu est le risque le plus probable du
-- projet, et il est organisationnel, pas technique. Plusieurs heures de travail
-- pour un restaurateur peu à l'aise avec l'informatique suffisent à bloquer
-- l'adoption.
--
-- La réponse retenue : la saisie est assurée par l'éditeur à l'installation,
-- et cette procédure la ramène à un seul appel.
-- =============================================================================

-- Format attendu :
-- {
--   "nom": "Black & Silver", "ville": "Aïn Benian", "tables": 15,
--   "carte": [
--     { "categorie": "Pizzas",
--       "plats": [
--         { "nom": "Margherita",
--           "variantes": [ {"libelle":"Petite","prix":700},
--                          {"libelle":"Grande","prix":1200} ] },
--         { "nom": "Tacos", "prix": 750 }          <- plat à prix unique
--       ] }
--   ]
-- }
--
-- Les champs `nom_ar`, `nom_en`, `description*` et `image` sont facultatifs :
-- un restaurant peut démarrer en français seul et compléter ensuite.

create or replace function importer_restaurant(p_data jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_resto uuid; v_cat uuid; v_plat uuid;
  c jsonb; p jsonb; v jsonb;
  v_ordre_cat int := 0; v_ordre_plat int; v_ordre_var int;
  v_nb_plats int := 0;
begin
  if coalesce(p_data->>'nom', '') = '' then
    raise exception 'Le nom du restaurant est obligatoire' using errcode = '22023';
  end if;

  insert into restaurants (nom, ville)
  values (p_data->>'nom', coalesce(p_data->>'ville', 'Alger'))
  returning id into v_resto;

  insert into tables_resto (restaurant_id, numero)
  select v_resto, generate_series(1, coalesce((p_data->>'tables')::int, 12));

  for c in select * from jsonb_array_elements(coalesce(p_data->'carte', '[]'::jsonb))
  loop
    v_ordre_cat := v_ordre_cat + 1;
    insert into categories (restaurant_id, nom_fr, nom_ar, nom_en, ordre)
    values (v_resto, c->>'categorie', c->>'categorie_ar', c->>'categorie_en', v_ordre_cat)
    returning id into v_cat;

    v_ordre_plat := 0;
    for p in select * from jsonb_array_elements(coalesce(c->'plats', '[]'::jsonb))
    loop
      v_ordre_plat := v_ordre_plat + 1;
      v_nb_plats := v_nb_plats + 1;

      insert into plats (restaurant_id, categorie_id, nom_fr, nom_ar, nom_en,
                         desc_fr, desc_ar, desc_en, image_url, ordre)
      values (v_resto, v_cat, p->>'nom', p->>'nom_ar', p->>'nom_en',
              p->>'description', p->>'description_ar', p->>'description_en',
              p->>'image', v_ordre_plat)
      returning id into v_plat;

      if p ? 'variantes' then
        v_ordre_var := 0;
        for v in select * from jsonb_array_elements(p->'variantes')
        loop
          v_ordre_var := v_ordre_var + 1;
          insert into variantes_plat (plat_id, libelle_fr, libelle_ar, libelle_en, prix, ordre)
          values (v_plat, v->>'libelle', v->>'libelle_ar', v->>'libelle_en',
                  (v->>'prix')::numeric, v_ordre_var);
        end loop;
      else
        -- D5 : un plat à prix unique reçoit la déclinaison « Standard », que
        -- l'interface masque. Le restaurateur ne voit jamais le mot « variante ».
        insert into variantes_plat (plat_id, prix) values (v_plat, (p->>'prix')::numeric);
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'restaurant_id', v_resto,
    'nom', p_data->>'nom',
    'tables', coalesce((p_data->>'tables')::int, 12),
    'categories', v_ordre_cat,
    'plats', v_nb_plats);
end $$;

-- Procédure d'administration : appelée par l'éditeur lors de l'intégration,
-- jamais exposée à l'API publique.
revoke execute on function importer_restaurant(jsonb) from public, anon, authenticated;
