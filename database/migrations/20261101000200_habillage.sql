-- Habillage personnel : logo et image d'ambiance choisis par l'utilisateur
alter table user_settings add column if not exists logo_url text;
alter table user_settings add column if not exists hero_image_url text;
