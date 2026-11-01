-- =====================================================================
-- Super Divers Watch — schéma initial
-- Cible : Supabase (PostgreSQL 15+)
-- Principes :
--   * toute information de référence est rattachée à une source + niveau de fiabilité
--   * une date de sortie n'existe que dans release_calendar (officielle OU estimation, jamais mélangées)
--   * chaque prix garde sa devise d'origine ; la conversion EUR est explicite (taux BCE daté)
--   * annonces en ligne et ventes conclues sont distinguées (price_kind)
--   * aucune valorisation n'est inventée : sans donnée, la valeur reste NULL
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------
create type reliability_level   as enum ('officiel', 'boutique', 'estimation', 'non_verifie');
create type currency_code        as enum ('JPY', 'EUR', 'USD');
create type product_type         as enum ('booster', 'advance_pack', 'first_pack', 'display', 'coffret',
                                          'edition_limitee', 'evenementiel', 'livre', 'accessoire', 'autre');
create type product_status       as enum ('annonce', 'precommande', 'disponible', 'epuise');
create type card_origin          as enum ('borne', 'advance_pack', 'first_pack', 'promo', 'evenement', 'livre', 'autre');
create type price_kind           as enum ('annonce', 'vente_conclue', 'prix_officiel');
create type availability_status  as enum ('en_stock', 'rupture', 'precommande', 'inconnu');
create type store_region         as enum ('FR', 'JP', 'INT');
create type collection_method    as enum ('api', 'flux_public', 'collecte_autorisee', 'manuel', 'a_verifier');
create type release_event_type   as enum ('sortie_set', 'sortie_produit', 'ouverture_precommande', 'evenement');
create type date_precision       as enum ('jour', 'mois', 'trimestre', 'annee');
create type release_region       as enum ('JP', 'FR');
create type announcement_kind    as enum ('nouvelle_serie', 'advance_pack', 'produit', 'cartes', 'evenement', 'autre');
create type grading_company      as enum ('PSA', 'BGS', 'CGC');
create type alert_type           as enum ('nouvelle_serie', 'advance_pack', 'precommande', 'nouveau_produit',
                                          'carte_rare_en_vente', 'prix_sous_seuil', 'retour_stock');
create type alert_channel        as enum ('in_app', 'email', 'discord', 'telegram');
create type market_event_type    as enum ('nouveau_listing', 'variation_prix', 'retour_stock', 'rupture',
                                          'changement_dispo', 'nouvelle_annonce');

-- ---------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Administration (application personnelle : seul l'admin écrit les données de référence)
-- ---------------------------------------------------------------------
create table app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table app_admins enable row level security; -- aucune policy : gérée uniquement en SQL

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Référentiels
-- ---------------------------------------------------------------------
create table games (
  id    text primary key,           -- 'dbsdv', plus tard 'dbs_masters'
  name  text not null
);

create table sources (
  id               uuid primary key default gen_random_uuid(),
  game             text references games(id),
  name             text not null,
  url              text,
  reliability      reliability_level not null,
  method           collection_method not null default 'manuel',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table rarities (
  game        text not null references games(id),
  code        text not null,          -- 'GDR', 'SEC', 'EXR', 'PUR'…
  label       text not null,
  sort_order  int  not null default 0,
  is_premium  boolean not null default false,   -- utilisé par l'alerte « carte rare en vente »
  primary key (game, code)
);

create table fx_rates (
  rate_date    date primary key,
  jpy_per_eur  numeric(12,4) not null,   -- 1 EUR = x JPY (taux de référence BCE)
  usd_per_eur  numeric(12,4),
  source       text not null default 'BCE',
  fetched_at   timestamptz not null default now()
);

create or replace function fx_rate_for(p_currency currency_code, p_date date) returns numeric
language sql stable as $$
  select case p_currency
           when 'EUR' then 1::numeric
           when 'JPY' then (select jpy_per_eur from fx_rates where rate_date <= p_date order by rate_date desc limit 1)
           when 'USD' then (select usd_per_eur from fx_rates where rate_date <= p_date order by rate_date desc limit 1)
         end;
$$;

-- Renvoie NULL si aucun taux n'est disponible : jamais de conversion implicite
create or replace function to_eur(p_amount numeric, p_currency currency_code, p_date date) returns numeric
language sql stable as $$
  select case when p_amount is null then null
              else round(p_amount / nullif(fx_rate_for(p_currency, p_date), 0), 2) end;
$$;

-- ---------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------
create table card_sets (
  id                uuid primary key default gen_random_uuid(),
  game              text not null references games(id) default 'dbsdv',
  code              text not null,           -- ex. 'SDV8'
  series_number     int,
  name_ja           text not null,
  name_fr           text,
  total_cards       int,                     -- nombre officiel annoncé (peut différer du nombre catalogué)
  image_url         text,
  source_id         uuid references sources(id),
  reliability       reliability_level not null default 'non_verifie',
  published_at      timestamptz,
  last_verified_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (game, code)
);

create table cards (
  id                uuid primary key default gen_random_uuid(),
  game              text not null references games(id) default 'dbsdv',
  set_id            uuid references card_sets(id) on delete set null,
  card_number       text not null,           -- ex. 'SDV8-035'
  variant           text not null default '',-- '' = normale ; 'parallele', etc.
  is_parallel       boolean not null default false,
  name_ja           text not null,
  name_fr           text,
  character_ja      text,
  character_fr      text,
  rarity_code       text,
  origin            card_origin not null default 'borne',
  image_url         text,
  source_id         uuid references sources(id),
  reliability       reliability_level not null default 'non_verifie',
  last_verified_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (game, card_number, variant),
  foreign key (game, rarity_code) references rarities(game, code)
);

create table products (
  id                  uuid primary key default gen_random_uuid(),
  game                text not null references games(id) default 'dbsdv',
  set_id              uuid references card_sets(id) on delete set null,
  type                product_type not null,
  name_ja             text not null,
  name_fr             text,
  jan_code            text unique,
  official_price_jpy  int,                   -- prix officiel japonais, uniquement si sourcé
  cards_per_unit      int,
  contents            text,
  status              product_status not null default 'annonce',
  image_url           text,
  source_id           uuid references sources(id),
  reliability         reliability_level not null default 'non_verifie',
  published_at        timestamptz,
  last_verified_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Cartes contenues dans un produit (Advance Pack, livre…), avec exclusivité éventuelle
create table product_cards (
  product_id    uuid not null references products(id) on delete cascade,
  card_id       uuid not null references cards(id) on delete cascade,
  is_exclusive  boolean not null default false,
  reliability   reliability_level not null default 'non_verifie',
  source_id     uuid references sources(id),
  primary key (product_id, card_id)
);

-- Seule table qui porte des dates de sortie : officielle OU estimation, par région
create table release_calendar (
  id               uuid primary key default gen_random_uuid(),
  game             text not null references games(id) default 'dbsdv',
  event_type       release_event_type not null,
  set_id           uuid references card_sets(id) on delete cascade,
  product_id       uuid references products(id) on delete cascade,
  region           release_region not null default 'JP',
  event_date       date not null,
  precision        date_precision not null default 'jour',
  is_estimate      boolean not null default false,
  reliability      reliability_level not null,
  source_id        uuid references sources(id),
  notes            text,
  last_verified_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (num_nonnulls(set_id, product_id) >= 1),
  check (not (is_estimate and reliability = 'officiel'))
);

create table announcements (
  id               uuid primary key default gen_random_uuid(),
  game             text not null references games(id) default 'dbsdv',
  kind             announcement_kind not null default 'autre',
  title_ja         text,
  title_fr         text,
  summary          text,
  url              text not null,
  image_url        text,
  published_at     timestamptz,
  detected_at      timestamptz not null default now(),
  last_verified_at timestamptz,
  reliability      reliability_level not null,
  source_id        uuid references sources(id),
  set_id           uuid references card_sets(id) on delete set null,
  product_id       uuid references products(id) on delete set null,
  content_hash     text unique,              -- dédoublonnage des détections
  check (num_nonnulls(title_ja, title_fr) >= 1)
);

-- ---------------------------------------------------------------------
-- Boutiques et annonces
-- ---------------------------------------------------------------------
create table stores (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  region            store_region not null,
  base_url          text,
  platform          text,                    -- 'shopify', 'woocommerce', 'marketplace'…
  method            collection_method not null default 'a_verifier',
  is_marketplace    boolean not null default false,
  ships_to_fr       boolean,
  active            boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table product_listings (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references stores(id) on delete cascade,
  external_id       text not null,           -- identifiant côté boutique (ou URL normalisée)
  product_id        uuid references products(id) on delete set null,
  card_id           uuid references cards(id) on delete set null,
  title             text not null,
  url               text not null,
  image_url         text,
  price             numeric(12,2),
  currency          currency_code not null,
  shipping_cost     numeric(12,2),
  availability      availability_status not null default 'inconnu',
  is_active         boolean not null default true,
  entered_manually  boolean not null default false,
  first_seen_at     timestamptz not null default now(),
  last_checked_at   timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (store_id, external_id),
  check (num_nonnulls(product_id, card_id) <= 1)
);

-- Toutes les observations de prix (annonces, ventes conclues, prix officiels, saisies manuelles)
create table price_history (
  id                bigint generated always as identity primary key,
  listing_id        uuid references product_listings(id) on delete set null,
  product_id        uuid references products(id) on delete cascade,
  card_id           uuid references cards(id) on delete cascade,
  store_id          uuid references stores(id) on delete set null,
  source_id         uuid references sources(id),
  observed_at       timestamptz not null default now(),
  kind              price_kind not null,
  price             numeric(12,2) not null check (price >= 0),
  currency          currency_code not null,
  price_eur         numeric(12,2),           -- NULL tant qu'aucun taux n'est disponible
  fx_rate           numeric(12,4),
  shipping_cost     numeric(12,2),
  availability      availability_status,
  grade_company     grading_company,         -- renseigné pour une carte gradée
  grade             numeric(3,1),
  condition_note    text,
  url               text,
  entered_manually  boolean not null default false,
  note              text,
  check (num_nonnulls(product_id, card_id) <= 1),
  check (num_nonnulls(product_id, card_id, listing_id) >= 1),
  check ((grade_company is null) = (grade is null))
);

create or replace function price_history_fill_eur() returns trigger
language plpgsql as $$
begin
  new.fx_rate   := fx_rate_for(new.currency, new.observed_at::date);
  new.price_eur := to_eur(new.price, new.currency, new.observed_at::date);
  return new;
end $$;

create trigger trg_price_history_eur
  before insert or update of price, currency, observed_at on price_history
  for each row execute function price_history_fill_eur();

-- File d'événements de marché, consommée par le moteur d'alertes
create table market_events (
  id               bigint generated always as identity primary key,
  type             market_event_type not null,
  listing_id       uuid references product_listings(id) on delete cascade,
  announcement_id  uuid references announcements(id) on delete cascade,
  store_id         uuid references stores(id) on delete cascade,
  product_id       uuid references products(id) on delete cascade,
  card_id          uuid references cards(id) on delete cascade,
  old_price        numeric(12,2),
  new_price        numeric(12,2),
  currency         currency_code,
  old_availability availability_status,
  new_availability availability_status,
  created_at       timestamptz not null default now(),
  processed_at     timestamptz
);

-- Historisation automatique + événements à chaque changement d'une annonce
create or replace function product_listings_log_change() returns trigger
language plpgsql as $$
declare
  v_type market_event_type;
begin
  if tg_op = 'INSERT' then
    if new.price is not null then
      insert into price_history (listing_id, product_id, card_id, store_id, kind, price, currency,
                                 shipping_cost, availability, url, entered_manually)
      values (new.id, new.product_id, new.card_id, new.store_id, 'annonce', new.price, new.currency,
              new.shipping_cost, new.availability, new.url, new.entered_manually);
    end if;
    insert into market_events (type, listing_id, store_id, product_id, card_id, new_price, currency, new_availability)
    values ('nouveau_listing', new.id, new.store_id, new.product_id, new.card_id, new.price, new.currency, new.availability);
    return new;
  end if;

  if new.price is distinct from old.price or new.availability is distinct from old.availability then
    if new.price is not null then
      insert into price_history (listing_id, product_id, card_id, store_id, kind, price, currency,
                                 shipping_cost, availability, url, entered_manually)
      values (new.id, new.product_id, new.card_id, new.store_id, 'annonce', new.price, new.currency,
              new.shipping_cost, new.availability, new.url, new.entered_manually);
    end if;

    if new.availability is distinct from old.availability then
      v_type := case
        when old.availability = 'rupture' and new.availability in ('en_stock', 'precommande') then 'retour_stock'
        when new.availability = 'rupture' then 'rupture'
        else 'changement_dispo' end;
      insert into market_events (type, listing_id, store_id, product_id, card_id, old_price, new_price, currency,
                                 old_availability, new_availability)
      values (v_type, new.id, new.store_id, new.product_id, new.card_id, old.price, new.price, new.currency,
              old.availability, new.availability);
    end if;

    if new.price is distinct from old.price then
      insert into market_events (type, listing_id, store_id, product_id, card_id, old_price, new_price, currency,
                                 old_availability, new_availability)
      values ('variation_prix', new.id, new.store_id, new.product_id, new.card_id, old.price, new.price, new.currency,
              old.availability, new.availability);
    end if;
  end if;
  return new;
end $$;

create trigger trg_product_listings_log
  after insert or update on product_listings
  for each row execute function product_listings_log_change();

create or replace function announcements_log() returns trigger
language plpgsql as $$
begin
  insert into market_events (type, announcement_id, product_id)
  values ('nouvelle_annonce', new.id, new.product_id);
  return new;
end $$;

create trigger trg_announcements_log
  after insert on announcements
  for each row execute function announcements_log();

-- Suivi des collecteurs
create table collector_runs (
  id             bigint generated always as identity primary key,
  store_id       uuid references stores(id) on delete cascade,
  source_id      uuid references sources(id) on delete cascade,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'en_cours' check (status in ('en_cours', 'succes', 'echec', 'ignore')),
  items_found    int,
  items_new      int,
  items_changed  int,
  error          text
);

-- ---------------------------------------------------------------------
-- Données personnelles (collection, surveillance, alertes)
-- ---------------------------------------------------------------------
create table collection_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id             uuid not null references cards(id) on delete cascade,
  quantity            int not null default 1 check (quantity > 0),
  purchase_price      numeric(12,2),         -- prix unitaire
  purchase_currency   currency_code not null default 'EUR',
  purchase_price_eur  numeric(12,2),
  purchase_date       date,
  condition_note      text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table graded_cards (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id             uuid not null references cards(id) on delete cascade,
  company             grading_company not null,
  grade               numeric(3,1) not null check (grade between 1 and 10),
  cert_number         text,
  purchase_price      numeric(12,2),
  purchase_currency   currency_code not null default 'EUR',
  purchase_price_eur  numeric(12,2),
  purchase_date       date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (company, cert_number)
);

create table sealed_inventory (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id          uuid not null references products(id) on delete cascade,
  quantity            int not null default 1 check (quantity > 0),
  is_sealed           boolean not null default true,
  purchase_price      numeric(12,2),         -- prix unitaire
  purchase_currency   currency_code not null default 'EUR',
  purchase_price_eur  numeric(12,2),
  purchase_date       date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create or replace function fill_purchase_eur() returns trigger
language plpgsql as $$
begin
  new.purchase_price_eur := to_eur(new.purchase_price, new.purchase_currency,
                                   coalesce(new.purchase_date, current_date));
  return new;
end $$;

create trigger trg_collection_items_eur before insert or update on collection_items
  for each row execute function fill_purchase_eur();
create trigger trg_graded_cards_eur before insert or update on graded_cards
  for each row execute function fill_purchase_eur();
create trigger trg_sealed_inventory_eur before insert or update on sealed_inventory
  for each row execute function fill_purchase_eur();

-- « Ma surveillance » et cartes recherchées
create table watchlist (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id       uuid references cards(id) on delete cascade,
  product_id    uuid references products(id) on delete cascade,
  store_id      uuid references stores(id) on delete cascade,
  keyword       text,
  is_wanted     boolean not null default false,   -- carte recherchée (non possédée)
  priority      smallint not null default 0,
  max_price_eur numeric(12,2),
  note          text,
  created_at    timestamptz not null default now(),
  check (num_nonnulls(card_id, product_id, store_id, keyword) >= 1)
);

create table alerts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name               text not null,
  type               alert_type not null,
  card_id            uuid references cards(id) on delete cascade,
  product_id         uuid references products(id) on delete cascade,
  store_id           uuid references stores(id) on delete cascade,
  set_id             uuid references card_sets(id) on delete cascade,
  product_type       product_type,
  game               text references games(id),
  rarity_code        text,
  keyword            text,
  threshold_eur      numeric(12,2),
  channels           alert_channel[] not null default '{in_app}',
  active             boolean not null default true,
  last_triggered_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (type <> 'prix_sous_seuil' or threshold_eur is not null)
);

create table notifications (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  alert_id     uuid references alerts(id) on delete set null,
  event_id     bigint references market_events(id) on delete set null,
  title        text not null,
  body         text,
  url          text,
  delivered    alert_channel[] not null default '{}',
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  unique (alert_id, event_id)                -- une seule notification par alerte et par événement
);

create table user_settings (
  user_id              uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  notification_email   text,
  discord_webhook_url  text,
  telegram_chat_id     text,
  display_currency     currency_code not null default 'EUR',
  theme                text not null default 'sombre' check (theme in ('sombre', 'clair', 'systeme')),
  updated_at           timestamptz not null default now()
);

create table portfolio_snapshots (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  snapshot_date       date not null default current_date,
  cards_value_eur     numeric(14,2),
  sealed_value_eur    numeric(14,2),
  invested_eur        numeric(14,2),
  cards_count         int not null default 0,
  cards_unvalued      int not null default 0,  -- cartes sans aucune donnée de prix
  by_rarity           jsonb not null default '{}',
  by_set              jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

-- ---------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['sources','card_sets','cards','products','release_calendar','stores',
                           'product_listings','collection_items','graded_cards','sealed_inventory',
                           'alerts','user_settings']
  loop
    execute format('create trigger trg_%1$s_updated before update on %1$I
                    for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------
create index idx_cards_set          on cards (set_id);
create index idx_cards_rarity       on cards (game, rarity_code);
create index idx_cards_name_ja_trgm on cards using gin (name_ja extensions.gin_trgm_ops);
create index idx_cards_name_fr_trgm on cards using gin (name_fr extensions.gin_trgm_ops);
create index idx_cards_char_ja_trgm on cards using gin (character_ja extensions.gin_trgm_ops);
create index idx_cards_number_trgm  on cards using gin (card_number extensions.gin_trgm_ops);
create index idx_products_set       on products (set_id);
create index idx_products_type      on products (game, type, status);
create index idx_products_name_trgm on products using gin (name_ja extensions.gin_trgm_ops);
create index idx_release_date       on release_calendar (event_date);
create index idx_announcements_pub  on announcements (game, published_at desc);
create index idx_listings_product   on product_listings (product_id) where product_id is not null;
create index idx_listings_card      on product_listings (card_id) where card_id is not null;
create index idx_listings_active    on product_listings (store_id, is_active, availability);
create index idx_listings_title_trgm on product_listings using gin (title extensions.gin_trgm_ops);
create index idx_ph_card            on price_history (card_id, kind, observed_at desc) where card_id is not null;
create index idx_ph_product         on price_history (product_id, kind, observed_at desc) where product_id is not null;
create index idx_ph_listing         on price_history (listing_id, observed_at desc);
create index idx_events_pending     on market_events (created_at) where processed_at is null;
create index idx_collection_user    on collection_items (user_id, card_id);
create index idx_graded_user        on graded_cards (user_id, card_id);
create index idx_sealed_user        on sealed_inventory (user_id, product_id);
create index idx_watchlist_user     on watchlist (user_id);
create index idx_alerts_active      on alerts (type) where active;
create index idx_notifications_user on notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Sécurité (RLS)
-- ---------------------------------------------------------------------
-- Données de référence : lecture pour tout utilisateur connecté, écriture admin uniquement.
-- (Les collecteurs utilisent la clé service_role, qui contourne la RLS.)
do $$
declare t text;
begin
  foreach t in array array['games','sources','rarities','fx_rates','card_sets','cards','products',
                           'product_cards','release_calendar','announcements','stores',
                           'product_listings','price_history','market_events','collector_runs']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "lecture connectee" on %I for select to authenticated using (true)', t);
    execute format('create policy "ecriture admin" on %I for all to authenticated
                    using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Données personnelles : chaque utilisateur ne voit et ne modifie que les siennes
do $$
declare t text;
begin
  foreach t in array array['collection_items','graded_cards','sealed_inventory','watchlist',
                           'alerts','notifications','user_settings','portfolio_snapshots']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "proprietaire" on %I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Vues
-- ---------------------------------------------------------------------

-- Statistiques de prix par carte (non gradée), séparées entre annonces et ventes conclues
create view card_prices with (security_invoker = true) as
select s.*,
       round(100 * (s.dernier_prix_eur - s.prix_il_y_a_7j_eur)  / nullif(s.prix_il_y_a_7j_eur, 0), 1)  as evolution_7j_pct,
       round(100 * (s.dernier_prix_eur - s.prix_il_y_a_30j_eur) / nullif(s.prix_il_y_a_30j_eur, 0), 1) as evolution_30j_pct
from (
  select ph.card_id,
         ph.kind,
         count(*)                                                    as nb_observations,
         min(ph.price_eur)                                           as prix_min_eur,
         round(avg(ph.price_eur), 2)                                 as prix_moyen_eur,
         max(ph.price_eur)                                           as prix_max_eur,
         (array_agg(ph.price_eur order by ph.observed_at desc))[1]   as dernier_prix_eur,
         max(ph.observed_at)                                         as derniere_observation,
         (array_agg(ph.price_eur order by ph.observed_at desc)
            filter (where ph.observed_at <= now() - interval '7 days'))[1]  as prix_il_y_a_7j_eur,
         (array_agg(ph.price_eur order by ph.observed_at desc)
            filter (where ph.observed_at <= now() - interval '30 days'))[1] as prix_il_y_a_30j_eur
  from price_history ph
  where ph.card_id is not null and ph.grade is null and ph.price_eur is not null
  group by ph.card_id, ph.kind
) s;

-- Valorisation d'une carte : médiane des ventes conclues sur 90 j, sinon plus bas prix affiché sur 30 j,
-- sinon NULL. La base de calcul est toujours exposée.
create view card_valuation with (security_invoker = true) as
select c.id as card_id,
       sold.mediane_eur  as mediane_ventes_90j_eur,
       sold.nb           as nb_ventes_90j,
       ask.min_eur       as prix_affiche_min_30j_eur,
       coalesce(sold.mediane_eur, ask.min_eur) as valeur_estimee_eur,
       case when sold.mediane_eur is not null then 'ventes_conclues'
            when ask.min_eur is not null then 'annonces'
            else 'aucune_donnee' end as base_valorisation,
       greatest(sold.derniere, ask.derniere) as derniere_actualisation
from cards c
left join lateral (
  select round(percentile_cont(0.5) within group (order by price_eur)::numeric, 2) as mediane_eur,
         count(*) as nb, max(observed_at) as derniere
  from price_history
  where card_id = c.id and kind = 'vente_conclue' and grade is null and price_eur is not null
    and observed_at > now() - interval '90 days'
) sold on true
left join lateral (
  select min(price_eur) as min_eur, max(observed_at) as derniere
  from price_history
  where card_id = c.id and kind = 'annonce' and grade is null and price_eur is not null
    and observed_at > now() - interval '30 days'
) ask on true;

-- Même logique pour les produits scellés
create view product_valuation with (security_invoker = true) as
select p.id as product_id,
       sold.mediane_eur as mediane_ventes_90j_eur,
       ask.min_eur      as prix_affiche_min_30j_eur,
       coalesce(sold.mediane_eur, ask.min_eur) as valeur_estimee_eur,
       case when sold.mediane_eur is not null then 'ventes_conclues'
            when ask.min_eur is not null then 'annonces'
            else 'aucune_donnee' end as base_valorisation
from products p
left join lateral (
  select round(percentile_cont(0.5) within group (order by price_eur)::numeric, 2) as mediane_eur
  from price_history
  where product_id = p.id and kind = 'vente_conclue' and price_eur is not null
    and observed_at > now() - interval '90 days'
) sold on true
left join lateral (
  select min(price_eur) as min_eur
  from price_history
  where product_id = p.id and kind = 'annonce' and price_eur is not null
    and observed_at > now() - interval '30 days'
) ask on true;

-- Collection de l'utilisateur connecté, carte par carte
create view my_collection with (security_invoker = true) as
select c.id as card_id, c.card_number, c.variant, c.name_ja, c.name_fr, c.rarity_code, c.set_id,
       sum(ci.quantity)::int                                  as quantite,
       sum(ci.quantity * ci.purchase_price_eur)               as investi_eur,
       v.valeur_estimee_eur                                   as valeur_unitaire_eur,
       v.valeur_estimee_eur * sum(ci.quantity)                as valeur_totale_eur,
       v.base_valorisation,
       v.derniere_actualisation
from collection_items ci
join cards c on c.id = ci.card_id
join card_valuation v on v.card_id = c.id
where ci.user_id = auth.uid()
group by c.id, v.valeur_estimee_eur, v.base_valorisation, v.derniere_actualisation;

-- Complétion par set pour l'utilisateur connecté
create view my_set_completion with (security_invoker = true) as
select s.id as set_id, s.code, s.name_ja, s.name_fr,
       s.total_cards                                       as total_officiel,
       (select count(*) from cards where set_id = s.id)    as total_catalogue,
       (select count(distinct ci.card_id)
          from collection_items ci join cards c on c.id = ci.card_id
         where c.set_id = s.id and ci.user_id = auth.uid()) as possedees
from card_sets s;

-- Prochaines sorties
create view upcoming_releases with (security_invoker = true) as
select rc.*, s.code as set_code, coalesce(s.name_fr, s.name_ja) as set_name,
       p.type as product_type, coalesce(p.name_fr, p.name_ja) as product_name,
       src.name as source_name, src.url as source_url
from release_calendar rc
left join card_sets s on s.id = rc.set_id
left join products p on p.id = rc.product_id
left join sources src on src.id = rc.source_id
where rc.event_date >= current_date
order by rc.event_date, rc.is_estimate;

-- ---------------------------------------------------------------------
-- Instantané quotidien des portefeuilles (appelé par une tâche planifiée)
-- ---------------------------------------------------------------------
create or replace function snapshot_portfolios(p_date date default current_date) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into portfolio_snapshots (user_id, snapshot_date, cards_value_eur, sealed_value_eur,
                                   invested_eur, cards_count, cards_unvalued, by_rarity, by_set)
  select u.user_id, p_date,
         cv.valeur, sv.valeur,
         coalesce(cv.investi, 0) + coalesce(sv.investi, 0),
         coalesce(cv.nb, 0), coalesce(cv.sans_valeur, 0),
         coalesce(cv.par_rarete, '{}'), coalesce(cv.par_set, '{}')
  from (select user_id from collection_items union select user_id from sealed_inventory) u
  left join lateral (
    select sum(ci.quantity * v.valeur_estimee_eur)                            as valeur,
           sum(ci.quantity * ci.purchase_price_eur)                           as investi,
           sum(ci.quantity)::int                                              as nb,
           (sum(ci.quantity) filter (where v.valeur_estimee_eur is null))::int as sans_valeur,
           (select jsonb_object_agg(r, val) from (
              select coalesce(c2.rarity_code, '?') r, sum(ci2.quantity * v2.valeur_estimee_eur) val
              from collection_items ci2 join cards c2 on c2.id = ci2.card_id
              join card_valuation v2 on v2.card_id = c2.id
              where ci2.user_id = u.user_id group by 1) x) as par_rarete,
           (select jsonb_object_agg(sc, val) from (
              select coalesce(s3.code, '?') sc, sum(ci3.quantity * v3.valeur_estimee_eur) val
              from collection_items ci3 join cards c3 on c3.id = ci3.card_id
              left join card_sets s3 on s3.id = c3.set_id
              join card_valuation v3 on v3.card_id = c3.id
              where ci3.user_id = u.user_id group by 1) y) as par_set
    from collection_items ci join card_valuation v on v.card_id = ci.card_id
    where ci.user_id = u.user_id
  ) cv on true
  left join lateral (
    select sum(si.quantity * pv.valeur_estimee_eur) as valeur,
           sum(si.quantity * si.purchase_price_eur) as investi
    from sealed_inventory si join product_valuation pv on pv.product_id = si.product_id
    where si.user_id = u.user_id
  ) sv on true
  on conflict (user_id, snapshot_date) do update
    set cards_value_eur = excluded.cards_value_eur,
        sealed_value_eur = excluded.sealed_value_eur,
        invested_eur = excluded.invested_eur,
        cards_count = excluded.cards_count,
        cards_unvalued = excluded.cards_unvalued,
        by_rarity = excluded.by_rarity,
        by_set = excluded.by_set;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function snapshot_portfolios(date) from public, anon, authenticated;
