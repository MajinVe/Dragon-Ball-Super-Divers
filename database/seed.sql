-- =====================================================================
-- Super Divers Watch — données de référence initiales
-- Ne contient AUCUNE donnée de carte, de produit, de date ou de prix :
-- elles seront importées depuis des sources vérifiées.
-- Les URL non confirmées sont laissées à NULL volontairement.
-- =====================================================================

insert into games (id, name) values
  ('dbsdv',       'Dragon Ball Super Divers'),
  ('dbs_masters', 'Dragon Ball Super Card Game Masters')
on conflict do nothing;

-- Raretés citées dans le cahier des charges. EXR = エクストラレア (source : annonce Bandai du 1er volet).
-- Les autres raretés (communes, etc.) seront ajoutées à partir de la liste officielle.
insert into rarities (game, code, label, sort_order, is_premium) values
  ('dbsdv', 'EXR', 'Extra Rare (エクストラレア)', 90, true),
  ('dbsdv', 'GDR', 'GDR',                         80, true),
  ('dbsdv', 'SEC', 'SEC',                         85, true),
  ('dbsdv', 'PUR', 'PUR',                         70, true)
on conflict do nothing;

insert into sources (game, name, url, reliability, method, notes) values
  (null,    'Banque centrale européenne — taux de référence', 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
            'officiel', 'api', 'Taux EUR/JPY quotidien (jours ouvrés BCE)'),
  ('dbsdv', 'Site officiel Dragon Ball Super Divers (Bandai)', null,
            'officiel', 'a_verifier', 'URL à renseigner ; méthode à valider selon CGU et robots.txt'),
  ('dbsdv', 'Saisie manuelle', null,
            'non_verifie', 'manuel', 'Informations saisies à la main sans source publiée')
on conflict do nothing;

insert into stores (slug, name, region, base_url, platform, method, is_marketplace, notes) values
  ('jumpichiban',   'JumpIchiban',             'FR',  null, null, 'a_verifier', false, 'URL et plateforme à confirmer'),
  ('dbcardshop',    'DbCardShop',              'FR',  null, null, 'a_verifier', false, 'URL et plateforme à confirmer'),
  ('japandco',      'Japandco',                'FR',  null, null, 'a_verifier', false, 'URL et plateforme à confirmer'),
  ('japondemande',  'Jap''On Demande',         'FR',  null, null, 'a_verifier', false, 'URL et plateforme à confirmer'),
  ('ncrs',          'NCRS',                    'INT', null, null, 'a_verifier', false, 'Région, URL et plateforme à confirmer'),
  ('mercari-jp',    'Mercari Japon',           'JP',  'https://jp.mercari.com',       'marketplace', 'manuel', true,
                    'Pas d''API publique : saisie assistée par URL'),
  ('yahoo-auctions','Yahoo! Auctions Japon',   'JP',  'https://auctions.yahoo.co.jp', 'marketplace', 'manuel', true,
                    'Saisie assistée ; principale source de ventes conclues'),
  ('buyee',         'Buyee',                   'JP',  'https://buyee.jp',             'proxy',       'manuel', true,
                    'Service d''intermédiaire ; saisie assistée'),
  ('zenmarket',     'ZenMarket',               'JP',  'https://zenmarket.jp',         'proxy',       'manuel', true,
                    'Service d''intermédiaire ; saisie assistée'),
  ('ebay',          'eBay',                    'INT', 'https://www.ebay.fr',          'marketplace', 'api',    true,
                    'Browse API officielle pour les annonces actives ; ventes conclues sur accès restreint')
on conflict (slug) do nothing;
