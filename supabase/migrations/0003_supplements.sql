-- =============================================================================
-- QResto — suppléments (D5-bis)
--
-- Lors du cadrage de D5, les suppléments avaient été écartés au motif
-- qu'« aucun restaurant cible ne les a exprimés ». Les cartes réelles de
-- Black & Silver et de Spicy Max ont invalidé cette hypothèse : les
-- suppléments y sont partout, et sur les pizzas leur prix dépend même de la
-- taille commandée.
--
-- Traités comme des articles indépendants, ils produisent un ticket cuisine
-- ambigu : le cuistot ne sait pas sur quel plat poser le camembert quand la
-- table a commandé trois sandwichs à côté.
-- =============================================================================

-- Un supplément EST un plat marqué comme tel : il hérite des déclinaisons
-- (250 en Normale, 500 en Mega), de la disponibilité et du prix figé, sans
-- aucune table supplémentaire.
alter table plats add column est_supplement boolean not null default false;

-- La ligne « camembert » pointe vers la ligne « Burger DZ » qu'elle complète.
alter table lignes_commande
  add column parent_ligne_id uuid references lignes_commande(id) on delete cascade;

create index on lignes_commande (parent_ligne_id);

-- Portée : les familles de plats auxquelles un supplément s'applique.
-- Sans ce filtre, l'écran proposerait « Kit Kat » sur un burger.
-- Un supplément sans aucune ligne ici reste applicable partout : c'est le
-- comportement par défaut, pour ne pas imposer ce paramétrage aux petits
-- restaurants.
create table supplements_categories (
  supplement_id uuid not null references plats(id) on delete cascade,
  categorie_id  uuid not null references categories(id) on delete cascade,
  primary key (supplement_id, categorie_id)
);

alter table supplements_categories enable row level security;

create policy portee_publique on supplements_categories
  for select to anon, authenticated using (true);

-- Un supplément ne peut pas être commandé seul, et un plat ne peut pas être
-- rattaché à un autre plat. La règle est portée par la base, pas par le code
-- applicatif — le navigateur du client n'est jamais une source de confiance.
create or replace function verifier_supplement()
returns trigger language plpgsql set search_path = public as $$
declare v_est_supp boolean; v_parent_est_supp boolean;
begin
  select est_supplement into v_est_supp from plats where id = new.plat_id;

  if new.parent_ligne_id is null then
    if v_est_supp then
      raise exception 'Un supplément doit être rattaché à un plat' using errcode = '23514';
    end if;
  else
    if not v_est_supp then
      raise exception 'Seul un supplément peut être rattaché à un plat' using errcode = '23514';
    end if;
    select p.est_supplement into v_parent_est_supp
    from lignes_commande l join plats p on p.id = l.plat_id
    where l.id = new.parent_ligne_id;
    if v_parent_est_supp then
      raise exception 'Un supplément ne peut pas en porter un autre' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger trg_verifier_supplement
  before insert or update on lignes_commande
  for each row execute function verifier_supplement();

-- Diagnostics précis. Même leçon qu'avec les quantités : un rejet correct
-- assorti d'un message faux envoie l'exploitation sur une fausse piste.
create or replace function valider_lignes(p_resto uuid, p_lignes jsonb)
returns void language plpgsql set search_path = public as $$
declare l jsonb; s jsonb; v_supp boolean;
begin
  for l in select * from jsonb_array_elements(p_lignes)
  loop
    select p.est_supplement into v_supp
    from variantes_plat v join plats p on p.id = v.plat_id
    where v.id = (l->>'variante_id')::uuid and p.restaurant_id = p_resto;

    if v_supp is null then
      raise exception 'Article inconnu' using errcode = 'P0002';
    elsif v_supp then
      raise exception 'Un supplément doit accompagner un plat' using errcode = '23514';
    end if;

    for s in select * from jsonb_array_elements(coalesce(l->'supplements','[]'::jsonb))
    loop
      select p.est_supplement into v_supp
      from variantes_plat v join plats p on p.id = v.plat_id
      where v.id = (s->>'variante_id')::uuid and p.restaurant_id = p_resto;

      if v_supp is null then
        raise exception 'Supplément inconnu' using errcode = 'P0002';
      elsif not v_supp then
        raise exception 'Cet article ne peut pas servir de supplément' using errcode = '23514';
      end if;
    end loop;
  end loop;
end $$;

-- Création de commande avec suppléments.
-- Format des lignes :
--   [{ "variante_id": "...", "quantite": 2,
--      "supplements": [{"variante_id": "...", "quantite": 1}] }]
create or replace function creer_commande(
  p_qr_token uuid, p_lignes jsonb, p_nom text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table tables_resto%rowtype; v_resto restaurants%rowtype;
  v_journee date; v_session uuid; v_commande uuid; v_secret uuid;
  v_numero int; v_total numeric(10,2); v_articles int; v_charge int; v_eta int;
  l jsonb; s jsonb; v_ligne uuid; v_attendu int := 0; v_insere int;
begin
  if jsonb_array_length(coalesce(p_lignes,'[]'::jsonb)) = 0 then
    raise exception 'Commande vide' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_lignes) x
    where (x->>'variante_id') is null
       or (x->>'quantite') !~ '^[0-9]+$'
       or (x->>'quantite')::int not between 1 and 50
  ) then
    raise exception 'Quantité invalide' using errcode = '22023';
  end if;

  select * into v_table from tables_resto where qr_token = p_qr_token and active;
  if not found then raise exception 'Table inconnue' using errcode = 'P0002'; end if;

  select * into v_resto from restaurants where id = v_table.restaurant_id;
  perform valider_lignes(v_resto.id, p_lignes);

  v_journee := journee_exploitation(v_resto.id);

  select id into v_session from sessions
   where table_id = v_table.id and statut in ('ouverte','a_payer') for update;
  if not found then
    insert into sessions (restaurant_id, table_id, journee)
    values (v_resto.id, v_table.id, v_journee) returning id into v_session;
  end if;

  insert into compteurs_journee (restaurant_id, journee, dernier_numero)
  values (v_resto.id, v_journee, 101)
  on conflict (restaurant_id, journee)
    do update set dernier_numero = compteurs_journee.dernier_numero + 1
  returning dernier_numero into v_numero;

  insert into commandes (restaurant_id, session_id, numero, journee, nom_convive, note)
  values (v_resto.id, v_session, v_numero, v_journee,
          nullif(trim(p_nom),''), nullif(trim(p_note),''))
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

  -- Les suppléments comptent dans le total, mais pas dans la charge cuisine :
  -- ajouter du camembert ne rallonge pas la préparation.
  select coalesce(sum(quantite),0) into v_articles
  from lignes_commande where commande_id = v_commande and parent_ligne_id is null;
  select coalesce(sum(quantite*prix_unitaire),0) into v_total
  from lignes_commande where commande_id = v_commande;

  select count(*) into v_charge from commandes
   where restaurant_id = v_resto.id and statut in ('nouvelle','cuisine');
  v_eta := 8 + v_articles*2 + v_charge*3;

  update commandes set total = v_total,
    eta_min = case when v_resto.eta_active then v_eta else null end,
    eta_max = case when v_resto.eta_active then v_eta+5 else null end
  where id = v_commande;

  update sessions set
    total = (select coalesce(sum(total),0) from commandes
             where session_id = v_session and statut <> 'annulee'),
    activite_le = now()
  where id = v_session;

  insert into journal_audit (restaurant_id, commande_id, session_id, action, detail)
  values (v_resto.id, v_commande, v_session, 'commande_creee',
          jsonb_build_object('numero', v_numero, 'total', v_total));

  return jsonb_build_object('id', v_commande, 'secret', v_secret, 'numero', v_numero,
    'total', v_total,
    'eta_min', case when v_resto.eta_active then v_eta else null end,
    'eta_max', case when v_resto.eta_active then v_eta+5 else null end);
end $$;
