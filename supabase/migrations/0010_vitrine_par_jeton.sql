-- Pivot 2026-08-13 : la vitrine (resto.html) prend en charge le mode « sur place ».
-- Un seul appel côté client au scan du QR : renvoie le contexte de la table
-- + la vitrine complète du restaurant. Évite deux allers-retours réseau.
create or replace function public.vitrine_par_jeton(p_qr_token uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'table_numero',      t.numero,
    'nom',               r.nom,
    'slogan',            r.slogan,
    'ville',             r.ville,
    'adresse',           r.adresse,
    'telephone',         r.telephone,
    'horaires',          r.horaires,
    'facebook',          r.facebook,
    'instagram',         r.instagram,
    'emporter_actif',    r.emporter_actif,
    'livraison_active',  r.livraison_active,
    'delai_min_minutes', r.delai_min_minutes,
    'zones', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', z.id, 'nom', z.nom, 'frais', z.frais, 'minimum', z.minimum)
             order by z.ordre), '[]'::jsonb)
      from zones_livraison z where z.restaurant_id = r.id and z.active),
    'carte', (
      select coalesce(jsonb_agg(cat order by (cat->>'ordre')::int), '[]'::jsonb)
      from (
        select jsonb_build_object('nom', c.nom_fr, 'ordre', c.ordre,
                 'plats', (
                   select coalesce(jsonb_agg(jsonb_build_object(
                            'nom', p.nom_fr, 'description', p.desc_fr,
                            'disponible', p.disponible, 'livrable', p.livrable,
                            'prix', (select jsonb_agg(jsonb_build_object(
                                       'id', v.id, 'libelle', v.libelle_fr, 'montant', v.prix)
                                     order by v.ordre)
                                     from variantes_plat v where v.plat_id = p.id)
                          ) order by p.ordre), '[]'::jsonb)
                   from plats p
                   where p.categorie_id = c.id and not p.archive and not p.est_supplement)
               ) as cat
        from categories c where c.restaurant_id = r.id
      ) s)
  )
  from tables_resto t
  join restaurants r on r.id = t.restaurant_id
  where t.qr_token = p_qr_token and t.active;
$$;

grant execute on function public.vitrine_par_jeton(uuid) to anon, authenticated;
