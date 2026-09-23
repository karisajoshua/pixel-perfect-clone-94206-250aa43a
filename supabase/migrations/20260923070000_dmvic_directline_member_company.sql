-- DMVIC UAT mapping supplied by DMVIC Support on 23 September 2026.
-- Directline Assurance Company Ltd -> Member Company Entity ID 18.
--
-- Keep this migration deliberately narrow: only map a record when the insurer
-- name identifies Directline. Other underwriters remain unmapped until DMVIC
-- supplies their authoritative entity IDs.

update public.insurers
set dmvic_member_company_id = 18
where lower(trim(name)) in (
  'directline assurance company ltd',
  'directline assurance company limited',
  'directline assurance'
)
and dmvic_member_company_id is distinct from 18;
