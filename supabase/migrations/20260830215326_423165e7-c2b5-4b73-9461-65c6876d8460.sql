ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS risk_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_label text;

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS risk_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_label text;

ALTER TYPE public.kyc_doc_type ADD VALUE IF NOT EXISTS 'valuation_report';
ALTER TYPE public.kyc_doc_type ADD VALUE IF NOT EXISTS 'business_permit';
ALTER TYPE public.kyc_doc_type ADD VALUE IF NOT EXISTS 'employee_schedule';
ALTER TYPE public.kyc_doc_type ADD VALUE IF NOT EXISTS 'stock_declaration';
ALTER TYPE public.kyc_doc_type ADD VALUE IF NOT EXISTS 'contract_bq';
ALTER TYPE public.kyc_doc_type ADD VALUE IF NOT EXISTS 'bill_of_lading';
ALTER TYPE public.kyc_doc_type ADD VALUE IF NOT EXISTS 'member_list';