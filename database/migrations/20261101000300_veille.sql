-- Moteur de veille : sources surveillées et détections à valider par l'utilisateur
do $$ begin
  create type detection_status as enum ('en_attente', 'validee', 'rejetee');
exception when duplicate_object then null; end $$;

create table if not exists watch_sources (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  url           text not null unique,
  parser        text not null check (parser in ('dbsdv_news', 'rss', 'shopify', 'page')),
  keywords      text,                       -- mots-clés séparés par des virgules (filtre)
  currency      currency_code not null default 'EUR',
  reliability   reliability_level not null default 'boutique',
  store_id      uuid references stores(id) on delete set null,
  active        boolean not null default true,
  last_scan_at  timestamptz,
  last_error    text,
  created_at    timestamptz not null default now()
);

create table if not exists detections (
  id               uuid primary key default gen_random_uuid(),
  watch_source_id  uuid references watch_sources(id) on delete cascade,
  kind             text not null default 'annonce',   -- nouvelle_serie, advance_pack, produit, annonce, evenement
  title            text not null,
  url              text not null,
  image_url        text,
  published_at     date,
  tags             text[] not null default '{}',
  price            numeric(12,2),
  currency         currency_code,
  available        boolean,
  reliability      reliability_level not null default 'non_verifie',
  status           detection_status not null default 'en_attente',
  content_hash     text not null unique,
  detected_at      timestamptz not null default now(),
  reviewed_at      timestamptz,
  note             text
);
create index if not exists idx_detections_pending on detections (detected_at desc) where status = 'en_attente';

alter table watch_sources enable row level security;
alter table detections enable row level security;
do $$ declare t text; begin
  foreach t in array array['watch_sources', 'detections'] loop
    execute format('drop policy if exists "lecture connectee" on %I', t);
    execute format('drop policy if exists "ecriture admin" on %I', t);
    execute format('create policy "lecture connectee" on %I for select to authenticated using (true)', t);
    execute format('create policy "ecriture admin" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

insert into watch_sources (name, url, parser, reliability)
values ('Actualités officielles Dragon Ball Super Divers', 'https://www.dbsdv.com/news/', 'dbsdv_news', 'officiel')
on conflict (url) do nothing;

update sources set url = 'https://www.dbsdv.com/', method = 'collecte_autorisee',
  notes = 'Lecture quotidienne de la liste des actualités (titre, date, lien) ; aucune reproduction du contenu'
where name = 'Site officiel Dragon Ball Super Divers (Bandai)' and url is null;
