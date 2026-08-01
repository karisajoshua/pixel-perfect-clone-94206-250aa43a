ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS mpesa_till text,
  ADD COLUMN IF NOT EXISTS mpesa_paybill text,
  ADD COLUMN IF NOT EXISTS paybill_account text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_branch text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_account_no text,
  ADD COLUMN IF NOT EXISTS stamp_url text,
  ADD COLUMN IF NOT EXISTS doc_footer_note text;

UPDATE public.tenants
SET website = COALESCE(website, 'www.zestinsurance.co.ke'),
    mpesa_till = COALESCE(mpesa_till, '603830'),
    mpesa_paybill = COALESCE(mpesa_paybill, '522533'),
    paybill_account = COALESCE(paybill_account, '1211118266'),
    bank_name = COALESCE(bank_name, 'KCB'),
    address = COALESCE(address, 'Ruai, Miranje Hse'),
    city = COALESCE(city, 'Nairobi'),
    country = COALESCE(country, 'Kenya'),
    contact_phone = COALESCE(contact_phone, '+254 713 985 230'),
    contact_email = COALESCE(contact_email, 'info@zestinsurance.co.ke'),
    tagline = COALESCE(tagline, 'Insurance Brokerage & Advisory')
WHERE name ILIKE 'Zest Insurance Agency';