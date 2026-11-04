-- Las fotos del protocolo que la Mac procesó sin problemas se aprueban solas:
-- queda anotado cuáles no miró nadie.
ALTER TABLE "photo_step_runs" ADD COLUMN "autoApproved" BOOLEAN NOT NULL DEFAULT false;
