-- =============================================================================
-- QResto — schéma initial
--
-- Décisions de cadrage appliquées :
--   D1  session de table : sessions entre tables_resto et commandes
--   D2  exécution directe ; l'impression du ticket vaut engagement
--   D3a token statique par table ; détection des abus par la vue caisse
--   D3b nom du convive : information de service, non vérifiée
--   D4  multi-tenant : restaurant_id partout, RLS par tenant
--   D5  variantes obligatoires ; variante « Standard » pour les plats simples
--   D6  disponibilité manuelle par plat, propagée en temps réel
--   D7  annulation par la caisse ; motif obligatoire après impression
--   D8  ETA en fourchette, indicative, désactivable
--   D9  un compte authentifié par restaurant
--   D21 expiration des sessions + clôture de journée
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- =============================================================================
-- 1. Référentiel
-- =============================================================================

create table restaurants (
  id                  uuid primary key default gen_random_uuid(),
  nom                 text        not null,
  ville               text        not null default 'Alger',
  fuseau              text        not null default 'Africa/Algiers',
  -- D21 : un restaurant ouvert jusqu'à 1 h du matin ne change pas de journée
  -- d'exploitation à minuit. Tout ce qui précède cette heure appartient à la veille.
  fin_journee         time        not null default '04:00',
  -- Interrupteurs par restaurant, prévus dès maintenant pour éviter une migration.
  validation_requise  boolean     not null default false,  -- D2
  code_table_requis   boolean     not null default false,  -- D3a, réserve
  eta_active          boolean     not null default true,   -- D8
  cree_le             timestamptz not null default now()
);

create table tables_resto (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  numero        int  not null,
  -- D3a : c'est ce token qui est encodé dans le QR, jamais le numéro de table
  -- (un numéro serait devinable : /table/1, /table/2, ...).
  qr_token      uuid not null default gen_random_uuid(),
  active        boolean not null default true,
  unique (restaurant_id, numero),
  unique (qr_token)
);

create table categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  nom_fr        text not null,
  nom_ar        text,
  nom_en        text,
  ordre         int  not null default 0
);

create table plats (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  categorie_id  uuid references categories(id) on delete set null,
  nom_fr        text not null,
  nom_ar        text,
  nom_en        text,
  desc_fr       text,
  desc_ar       text,
  desc_en       text,
  image_url     text,
  -- D6 : bascule manuelle par le caissier, propagée en temps réel.
  disponible    boolean not null default true,
  -- Un plat retiré du menu n'est jamais supprimé : les commandes passées
  -- le référencent encore.
  archive       boolean not null default false,
  ordre         int not null default 0
);

-- D5 : toute ligne de commande référence une variante, jamais un plat.
-- Un plat sans déclinaison a une unique variante « Standard » que l'interface masque.
create table variantes_plat (
  id         uuid primary key default gen_random_uuid(),
  plat_id    uuid not null references plats(id) on delete cascade,
  libelle_fr text not null default 'Standard',
  libelle_ar text,
  libelle_en text,
  prix       numeric(10,2) not null check (prix >= 0),
  ordre      int not null default 0
);

create index on tables_resto (restaurant_id);
create index on plats (restaurant_id, categorie_id);
create index on variantes_plat (plat_id);

-- =============================================================================
-- 2. Exploitation
-- =============================================================================

-- D1 : la session est le couvert. Plusieurs commandes, une seule addition.
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_id      uuid not null references tables_resto(id) on delete restrict,
  statut        text not null default 'ouverte'
                check (statut in ('ouverte','a_payer','payee','expiree')),
  journee       date not null,
  total         numeric(10,2) not null default 0,
  ouverte_le    timestamptz not null default now(),
  activite_le   timestamptz not null default now(),  -- D21 : base de l'expiration
  fermee_le     timestamptz
);

-- Une seule session ouverte par table à un instant donné : c'est cette contrainte
-- qui garantit que deux convives de la même table tombent dans la même addition.
create unique index sessions_une_ouverte_par_table
  on sessions (table_id) where statut in ('ouverte','a_payer');

create table commandes (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  session_id    uuid not null references sessions(id) on delete cascade,
  numero        int  not null,           -- D11 : séquence par restaurant et par journée
  journee       date not null,
  -- D1 : « payee » n'existe pas ici. C'est la session qui est payée.
  statut        text not null default 'nouvelle'
                check (statut in ('nouvelle','cuisine','prete','servie','annulee')),
  nom_convive   text,                    -- D3b : déclaratif, non vérifié
  note          text,
  total         numeric(10,2) not null default 0,
  eta_min       int,                     -- D8 : fourchette, jamais un chiffre sec
  eta_max       int,
  -- Remis au client à la création ; seul moyen de suivre sa propre commande
  -- sans exposer celles des autres tables.
  secret        uuid not null default gen_random_uuid(),
  cree_le       timestamptz not null default now(),
  -- D2 : l'impression est l'acte d'engagement, pas la création.
  imprimee_le   timestamptz,
  -- D7 : une annulation après impression est une perte sèche, elle doit être tracée.
  annulee_apres_impression boolean not null default false,
  motif_annulation text
);

create unique index on commandes (restaurant_id, journee, numero);
create index on commandes (session_id);
create index on commandes (restaurant_id, statut) where statut <> 'annulee';

create table lignes_commande (
  id            uuid primary key default gen_random_uuid(),
  commande_id   uuid not null references commandes(id) on delete cascade,
  variante_id   uuid not null references variantes_plat(id) on delete restrict,
  -- Dénormalisé pour que les statistiques par plat restent simples.
  plat_id       uuid not null references plats(id) on delete restrict,
  quantite      int  not null check (quantite > 0),
  -- Prix figé au moment de la commande : si le patron change ses tarifs demain,
  -- les tickets d'hier gardent le bon montant.
  prix_unitaire numeric(10,2) not null check (prix_unitaire >= 0),
  -- Idem pour le libellé : le ticket réimprimé doit être identique à l'original.
  libelle       text not null
);

create index on lignes_commande (commande_id);
create index on lignes_commande (plat_id);

-- D11 : sans compteur dédié, deux commandes simultanées obtiennent le même numéro.
create table compteurs_journee (
  restaurant_id  uuid not null references restaurants(id) on delete cascade,
  journee        date not null,
  dernier_numero int  not null default 100,
  primary key (restaurant_id, journee)
);

-- D17 : qui a changé quoi. Indispensable dès que les annulations sont possibles.
create table journal_audit (
  id            bigserial primary key,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  commande_id   uuid,
  session_id    uuid,
  action        text not null,
  detail        jsonb,
  acteur        uuid,          -- auth.uid(), null si action automatique
  cree_le       timestamptz not null default now()
);

create index on journal_audit (restaurant_id, cree_le desc);

-- =============================================================================
-- 3. Fonctions utilitaires
-- =============================================================================

-- D4 : le restaurant du poste connecté vient du JWT.
-- IMPÉRATIF : app_metadata, jamais user_metadata — cette dernière est modifiable
-- par l'utilisateur lui-même, ce qui lui permettrait de lire un autre restaurant.
-- search_path figé : sans lui, la résolution des noms dépend du rôle appelant
-- et peut être détournée.
create or replace function mon_restaurant()
returns uuid language sql stable security invoker set search_path = public as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'restaurant_id', '')::uuid;
$$;

-- D21 : journée d'exploitation, décalée de fin_journee.
create or replace function journee_exploitation(p_restaurant_id uuid, p_ts timestamptz default now())
returns date language sql stable security invoker set search_path = public as $$
  select ((p_ts at time zone r.fuseau) - (r.fin_journee - time '00:00'))::date
  from restaurants r
  where r.id = p_restaurant_id;
$$;

-- =============================================================================
-- 4. Sécurité (RLS)
-- =============================================================================

alter table restaurants       enable row level security;
alter table tables_resto      enable row level security;
alter table categories        enable row level security;
alter table plats             enable row level security;
alter table variantes_plat    enable row level security;
alter table sessions          enable row level security;
alter table commandes         enable row level security;
alter table lignes_commande   enable row level security;
alter table compteurs_journee enable row level security;
alter table journal_audit     enable row level security;

-- --- Menu : lisible sans authentification (le client arrive avec un QR) --------
create policy menu_public_categories on categories
  for select to anon, authenticated using (true);

create policy menu_public_plats on plats
  for select to anon, authenticated using (not archive);

create policy menu_public_variantes on variantes_plat
  for select to anon, authenticated using (true);

-- --- Caisse : strictement cloisonnée par tenant --------------------------------
create policy caisse_lit_resto on restaurants
  for select to authenticated using (id = mon_restaurant());

create policy caisse_lit_tables on tables_resto
  for select to authenticated using (restaurant_id = mon_restaurant());

create policy caisse_lit_sessions on sessions
  for select to authenticated using (restaurant_id = mon_restaurant());

create policy caisse_lit_commandes on commandes
  for select to authenticated using (restaurant_id = mon_restaurant());

create policy caisse_lit_lignes on lignes_commande
  for select to authenticated using (
    exists (select 1 from commandes c
            where c.id = lignes_commande.commande_id
              and c.restaurant_id = mon_restaurant())
  );

create policy caisse_lit_audit on journal_audit
  for select to authenticated using (restaurant_id = mon_restaurant());

-- D6 : seule écriture directe autorisée depuis l'interface caisse.
create policy caisse_bascule_dispo on plats
  for update to authenticated
  using      (restaurant_id = mon_restaurant())
  with check (restaurant_id = mon_restaurant());

-- Aucune policy INSERT/UPDATE sur commandes, sessions ou lignes_commande :
-- toute écriture passe obligatoirement par les fonctions ci-dessous.

-- =============================================================================
-- 5. Écritures — le client anonyme
-- =============================================================================

-- Le téléphone n'envoie que des identifiants de variantes et des quantités.
-- Les prix sont lus en base. Un client qui modifie le JavaScript ne peut pas
-- s'attribuer un tarif.
create or replace function creer_commande(
  p_qr_token uuid,
  p_lignes   jsonb,          -- [{"variante_id":"...","quantite":2}]
  p_nom      text default null,
  p_note     text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table     tables_resto%rowtype;
  v_resto     restaurants%rowtype;
  v_journee   date;
  v_session   uuid;
  v_commande  uuid;
  v_secret    uuid;
  v_numero    int;
  v_total     numeric(10,2);
  v_articles  int;
  v_charge    int;
  v_eta       int;
begin
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) = 0 then
    raise exception 'Commande vide' using errcode = '22023';
  end if;

  -- Validation de forme AVANT la validation métier. Sans elle, une quantité
  -- aberrante était filtrée par la jointure et ressortait en « plat
  -- indisponible » — un message faux qui envoie l'exploitation sur une
  -- fausse piste.
  if exists (
    select 1 from jsonb_array_elements(p_lignes) l
    where (l->>'variante_id') is null
       or (l->>'quantite') !~ '^[0-9]+$'
       or (l->>'quantite')::int not between 1 and 50
  ) then
    raise exception 'Quantité invalide' using errcode = '22023';
  end if;

  select * into v_table from tables_resto where qr_token = p_qr_token and active;
  if not found then
    raise exception 'Table inconnue' using errcode = 'P0002';
  end if;

  select * into v_resto from restaurants where id = v_table.restaurant_id;
  v_journee := journee_exploitation(v_resto.id);

  -- D1 : on rattache à la session ouverte de la table, sinon on l'ouvre.
  select id into v_session
  from sessions
  where table_id = v_table.id and statut in ('ouverte','a_payer')
  for update;

  if not found then
    insert into sessions (restaurant_id, table_id, journee)
    values (v_resto.id, v_table.id, v_journee)
    returning id into v_session;
  end if;

  -- D11 : incrément atomique, résistant aux commandes simultanées.
  insert into compteurs_journee (restaurant_id, journee, dernier_numero)
  values (v_resto.id, v_journee, 101)
  on conflict (restaurant_id, journee)
    do update set dernier_numero = compteurs_journee.dernier_numero + 1
  returning dernier_numero into v_numero;

  insert into commandes (restaurant_id, session_id, numero, journee, nom_convive, note)
  values (v_resto.id, v_session, v_numero, v_journee, nullif(trim(p_nom), ''), nullif(trim(p_note), ''))
  returning id, secret into v_commande, v_secret;

  -- Les prix et libellés viennent de la base, jamais de la requête.
  -- La jointure filtre sur le restaurant : impossible de commander le plat d'un autre.
  insert into lignes_commande (commande_id, variante_id, plat_id, quantite, prix_unitaire, libelle)
  select
    v_commande,
    v.id,
    p.id,
    (l->>'quantite')::int,
    v.prix,
    p.nom_fr || case when v.libelle_fr = 'Standard' then '' else ' (' || v.libelle_fr || ')' end
  from jsonb_array_elements(p_lignes) l
  join variantes_plat v on v.id = (l->>'variante_id')::uuid
  join plats p          on p.id = v.plat_id
  where p.restaurant_id = v_resto.id
    and p.disponible                       -- D6 : un plat épuisé est rejeté ici
    and not p.archive;

  -- Si une ligne a été filtrée, la commande ne correspond pas à ce que le client
  -- a vu à l'écran : on refuse tout plutôt que de servir une commande partielle.
  if (select count(*) from lignes_commande where commande_id = v_commande)
     <> jsonb_array_length(p_lignes) then
    raise exception 'Un plat n''est plus disponible' using errcode = '23514';
  end if;

  select coalesce(sum(quantite * prix_unitaire), 0), coalesce(sum(quantite), 0)
    into v_total, v_articles
  from lignes_commande where commande_id = v_commande;

  -- D8 : fourchette calculée sur la charge réelle en cuisine.
  select count(*) into v_charge
  from commandes
  where restaurant_id = v_resto.id and statut in ('nouvelle','cuisine');

  v_eta := 8 + v_articles * 2 + v_charge * 3;

  update commandes
     set total = v_total,
         eta_min = case when v_resto.eta_active then v_eta else null end,
         eta_max = case when v_resto.eta_active then v_eta + 5 else null end
   where id = v_commande;

  update sessions
     set total = (select coalesce(sum(total), 0) from commandes
                  where session_id = v_session and statut <> 'annulee'),
         activite_le = now()
   where id = v_session;

  insert into journal_audit (restaurant_id, commande_id, session_id, action, detail)
  values (v_resto.id, v_commande, v_session, 'commande_creee',
          jsonb_build_object('numero', v_numero, 'total', v_total));

  return jsonb_build_object(
    'id', v_commande, 'secret', v_secret, 'numero', v_numero,
    'total', v_total,
    'eta_min', case when v_resto.eta_active then v_eta else null end,
    'eta_max', case when v_resto.eta_active then v_eta + 5 else null end
  );
end $$;

-- Suivi par le client : ne renvoie que l'état, jamais les montants d'autrui.
create or replace function suivre_commande(p_secret uuid)
returns table (numero int, statut text, eta_min int, eta_max int)
language sql security definer set search_path = public as $$
  select numero, statut, eta_min, eta_max
  from commandes
  where secret = p_secret;
$$;

-- =============================================================================
-- 6. Écritures — la caisse
-- =============================================================================

-- D2 : l'impression fait passer la commande en cuisine. C'est l'engagement.
create or replace function marquer_imprimee(p_commande_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update commandes
     set statut = 'cuisine', imprimee_le = coalesce(imprimee_le, now())
   where id = p_commande_id
     and restaurant_id = mon_restaurant()      -- cloisonnement : SECURITY DEFINER
     and statut = 'nouvelle';                  -- contourne RLS, on revérifie ici

  if not found then
    raise exception 'Commande introuvable ou déjà imprimée' using errcode = 'P0002';
  end if;

  insert into journal_audit (restaurant_id, commande_id, action, acteur)
  values (mon_restaurant(), p_commande_id, 'ticket_imprime', auth.uid());
end $$;

create or replace function changer_statut(p_commande_id uuid, p_statut text)
returns void language plpgsql security definer set search_path = public as $$
declare v_ancien text;
begin
  if p_statut not in ('prete','servie') then
    raise exception 'Transition non autorisée' using errcode = '22023';
  end if;

  select statut into v_ancien from commandes
   where id = p_commande_id and restaurant_id = mon_restaurant();

  if v_ancien is null or v_ancien = 'annulee' then
    raise exception 'Commande introuvable ou annulée' using errcode = 'P0002';
  end if;

  update commandes set statut = p_statut where id = p_commande_id;

  insert into journal_audit (restaurant_id, commande_id, action, detail, acteur)
  values (mon_restaurant(), p_commande_id, 'statut_change',
          jsonb_build_object('de', v_ancien, 'vers', p_statut), auth.uid());
end $$;

-- D7 : après impression, le motif est obligatoire et la perte est tracée.
create or replace function annuler_commande(p_commande_id uuid, p_motif text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_cmd commandes%rowtype;
begin
  select * into v_cmd from commandes
   where id = p_commande_id and restaurant_id = mon_restaurant();

  if not found then
    raise exception 'Commande introuvable' using errcode = 'P0002';
  end if;

  if v_cmd.imprimee_le is not null and coalesce(trim(p_motif), '') = '' then
    raise exception 'Motif obligatoire après impression' using errcode = '22023';
  end if;

  update commandes
     set statut = 'annulee',
         motif_annulation = nullif(trim(p_motif), ''),
         annulee_apres_impression = (v_cmd.imprimee_le is not null)
   where id = p_commande_id;

  update sessions
     set total = (select coalesce(sum(total), 0) from commandes
                  where session_id = v_cmd.session_id and statut <> 'annulee')
   where id = v_cmd.session_id;

  insert into journal_audit (restaurant_id, commande_id, action, detail, acteur)
  values (mon_restaurant(), p_commande_id, 'commande_annulee',
          jsonb_build_object('motif', p_motif,
                             'apres_impression', v_cmd.imprimee_le is not null,
                             'perte', case when v_cmd.imprimee_le is not null
                                           then v_cmd.total else 0 end),
          auth.uid());
end $$;

-- D1 : on encaisse la session, pas la commande.
create or replace function encaisser_session(p_session_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_total numeric(10,2);
begin
  update sessions
     set statut = 'payee', fermee_le = now()
   where id = p_session_id
     and restaurant_id = mon_restaurant()
     and statut in ('ouverte','a_payer')
  returning total into v_total;

  if v_total is null then
    raise exception 'Session introuvable ou déjà encaissée' using errcode = 'P0002';
  end if;

  insert into journal_audit (restaurant_id, session_id, action, detail, acteur)
  values (mon_restaurant(), p_session_id, 'session_encaissee',
          jsonb_build_object('total', v_total), auth.uid());

  return v_total;
end $$;

-- =============================================================================
-- 7. D21 — expiration et clôture de journée
-- =============================================================================

-- Une table dont plus personne ne s'occupe est libérée au bout de 4 h.
create or replace function expirer_sessions_inactives()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with expirees as (
    update sessions
       set statut = 'expiree', fermee_le = now()
     where statut in ('ouverte','a_payer')
       and activite_le < now() - interval '4 hours'
    returning id, restaurant_id, total
  )
  insert into journal_audit (restaurant_id, session_id, action, detail)
  select restaurant_id, id, 'session_expiree', jsonb_build_object('total', total)
  from expirees;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Fige le chiffre d'affaires et ferme ce qui traîne.
create or replace function cloturer_journee(p_restaurant_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_journee date; v_ca numeric(10,2); v_orphelines int; v_moi uuid;
begin
  -- Le test du NULL est indispensable : pour un appelant anonyme,
  -- mon_restaurant() vaut NULL, « p_restaurant_id <> NULL » vaut NULL, et
  -- « if NULL then » est FAUX. Le garde-fou ne se déclenchait pas et
  -- n'importe qui pouvait clôturer la journée de n'importe quel restaurant.
  v_moi := mon_restaurant();
  if v_moi is null or p_restaurant_id is distinct from v_moi then
    raise exception 'Interdit' using errcode = '42501';
  end if;

  v_journee := journee_exploitation(p_restaurant_id);

  update sessions set statut = 'expiree', fermee_le = now()
   where restaurant_id = p_restaurant_id
     and journee = v_journee
     and statut in ('ouverte','a_payer');
  get diagnostics v_orphelines = row_count;

  -- Les sessions expirées sont conservées mais exclues du chiffre d'affaires :
  -- ce sont des anomalies, pas des ventes.
  select coalesce(sum(total), 0) into v_ca
  from sessions
  where restaurant_id = p_restaurant_id and journee = v_journee and statut = 'payee';

  insert into journal_audit (restaurant_id, action, detail, acteur)
  values (p_restaurant_id, 'journee_cloturee',
          jsonb_build_object('journee', v_journee, 'ca', v_ca,
                             'sessions_orphelines', v_orphelines), auth.uid());

  return jsonb_build_object('journee', v_journee, 'ca', v_ca,
                            'sessions_orphelines', v_orphelines);
end $$;

select cron.schedule('qresto-expiration', '*/30 * * * *',
                     $$select expirer_sessions_inactives()$$);

-- =============================================================================
-- 8. Droits d'exécution
-- =============================================================================

-- Le rôle PUBLIC englobe anon et authenticated : on retire tout, puis on
-- n'accorde que le strict nécessaire, rôle par rôle.
revoke execute on all functions in schema public from public, anon, authenticated;

-- Seules ces deux procédures sont accessibles sans authentification.
grant execute on function creer_commande(uuid, jsonb, text, text) to anon, authenticated;
grant execute on function suivre_commande(uuid)                   to anon, authenticated;

grant execute on function marquer_imprimee(uuid)        to authenticated;
grant execute on function changer_statut(uuid, text)    to authenticated;
grant execute on function annuler_commande(uuid, text)  to authenticated;
grant execute on function encaisser_session(uuid)       to authenticated;
grant execute on function cloturer_journee(uuid)        to authenticated;

-- expirer_sessions_inactives n'est accordée à personne : c'est une tâche de
-- maintenance globale, sans cloisonnement par restaurant. Elle est appelée
-- uniquement par l'ordonnanceur, qui s'exécute en tant que propriétaire.

-- =============================================================================
-- 9. Temps réel
-- =============================================================================
-- Realtime respecte les policies RLS : un caissier abonné ne reçoit que les
-- événements de son restaurant, même s'il trafique le filtre côté navigateur.

alter publication supabase_realtime add table commandes;
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table plats;
