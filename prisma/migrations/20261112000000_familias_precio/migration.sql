-- El precio de la familia lo lleva la principal; cada medida puede tener el suyo
-- (publications.ownPrice). La marca de la familia no hace falta.
ALTER TABLE "listing_families" DROP COLUMN "samePrice";
