ALTER TABLE public.commercial_sales
ADD COLUMN is_special_offer boolean NOT NULL DEFAULT false,
ADD COLUMN special_offer_reason text;