ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS product_subclass text, ADD COLUMN IF NOT EXISTS tonnage numeric;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS product_subclass text, ADD COLUMN IF NOT EXISTS tonnage numeric;
UPDATE public.policies SET product_class = 'motor_private' WHERE product_class = 'motor';
UPDATE public.quotations SET product_class = 'motor_private' WHERE product_class = 'motor';