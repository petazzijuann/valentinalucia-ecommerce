-- Rename Andreani-specific columns to generic carrier names
-- Using RENAME COLUMN to preserve any existing data
ALTER TABLE "orders" RENAME COLUMN "andreani_tracking_id" TO "carrier_tracking_id";
ALTER TABLE "orders" RENAME COLUMN "andreani_order_id" TO "carrier_order_id";
