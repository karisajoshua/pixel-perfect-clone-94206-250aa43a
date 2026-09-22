-- Atomic DMVIC order transitions. These functions enforce tenant ownership,
-- payment-before-issuance and idempotent issuance claims in the database.
create or replace function public.dmvic_create_order(
 p_policy_id uuid, p_vehicle_id uuid, p_insurer_id uuid, p_certificate_type text,
 p_classification integer, p_member_company_id integer, p_selling_price numeric,
 p_dmvic_cost numeric, p_validation_payload jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_tenant uuid;
begin
 v_tenant:=public.current_tenant_id();
 if v_tenant is null then raise exception 'No active agency'; end if;
 if not exists(select 1 from public.policies where id=p_policy_id and tenant_id=v_tenant) then raise exception 'Policy is not in this agency'; end if;
 insert into public.dmvic_certificate_orders(policy_id,vehicle_id,insurer_id,requested_by,tenant_id,certificate_type,certificate_classification,member_company_id,status,selling_price,dmvic_cost,validation_payload)
 values(p_policy_id,p_vehicle_id,p_insurer_id,auth.uid(),v_tenant,p_certificate_type,p_classification,p_member_company_id,'awaiting_validation',p_selling_price,p_dmvic_cost,p_validation_payload)
 returning id into v_id;
 insert into public.dmvic_order_events(order_id,actor_id,event_type,to_status) values(v_id,auth.uid(),'order_created','awaiting_validation');
 return v_id;
end $$;
revoke all on function public.dmvic_create_order(uuid,uuid,uuid,text,integer,integer,numeric,numeric,jsonb) from public;
grant execute on function public.dmvic_create_order(uuid,uuid,uuid,text,integer,integer,numeric,numeric,jsonb) to authenticated;

create or replace function public.dmvic_mark_validated(p_order_id uuid,p_response jsonb,p_stock_checked boolean default true)
returns void language plpgsql security definer set search_path=public as $$
declare v_tenant uuid:=public.current_tenant_id();
begin
 update public.dmvic_certificate_orders set status='awaiting_payment',validated_at=now(),validation_response=p_response,
 stock_checked_at=case when p_stock_checked then now() else stock_checked_at end,updated_at=now()
 where id=p_order_id and tenant_id=v_tenant and status='awaiting_validation';
 if not found then raise exception 'Order cannot be validated'; end if;
 insert into public.dmvic_order_events(order_id,actor_id,event_type,from_status,to_status) values(p_order_id,auth.uid(),'validated','awaiting_validation','awaiting_payment');
end $$;
grant execute on function public.dmvic_mark_validated(uuid,jsonb,boolean) to authenticated;

create or replace function public.dmvic_confirm_payment(p_order_id uuid,p_reference text,p_provider text,p_amount numeric,p_idempotency_key text)
returns void language plpgsql security definer set search_path=public as $$
declare v_order public.dmvic_certificate_orders%rowtype;
begin
 select * into v_order from public.dmvic_certificate_orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if v_order.payment_status='confirmed' then
   if v_order.payment_reference=p_reference then return; end if;
   raise exception 'Order already paid with a different reference';
 end if;
 if v_order.status<>'awaiting_payment' then raise exception 'Order is not awaiting payment'; end if;
 if p_amount<>v_order.selling_price then raise exception 'Payment amount does not match order'; end if;
 update public.dmvic_certificate_orders set payment_status='confirmed',payment_reference=p_reference,payment_provider=p_provider,
 payment_idempotency_key=p_idempotency_key,paid_at=now(),status='paid',updated_at=now() where id=p_order_id;
 insert into public.dmvic_order_events(order_id,event_type,from_status,to_status,detail)
 values(p_order_id,'payment_confirmed','awaiting_payment','paid',jsonb_build_object('provider',p_provider,'reference',p_reference));
end $$;
revoke all on function public.dmvic_confirm_payment(uuid,text,text,numeric,text) from public;
-- Deliberately not granted to authenticated users: invoke from a verified payment webhook/service context only.

create or replace function public.dmvic_claim_issuance(p_order_id uuid,p_idempotency_key text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update public.dmvic_certificate_orders set status='issuing',issuance_idempotency_key=p_idempotency_key,updated_at=now()
 where id=p_order_id and status='paid' and payment_status='confirmed' and issuance_idempotency_key is null;
 if not found then return false; end if;
 insert into public.dmvic_order_events(order_id,event_type,from_status,to_status) values(p_order_id,'issuance_claimed','paid','issuing');
 return true;
end $$;
revoke all on function public.dmvic_claim_issuance(uuid,text) from public;
-- Service-only: no authenticated grant.

create or replace function public.dmvic_complete_issuance(p_order_id uuid,p_certificate_no text,p_transaction_no text,p_api_request_no text,p_response jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if coalesce(trim(p_certificate_no),'')='' then raise exception 'Certificate number required'; end if;
 update public.dmvic_certificate_orders set status='issued',dmvic_certificate_number=p_certificate_no,dmvic_transaction_number=p_transaction_no,
 dmvic_api_request_number=p_api_request_no,issuance_response=p_response,issued_at=now(),updated_at=now()
 where id=p_order_id and status='issuing' and payment_status='confirmed';
 if not found then raise exception 'Order is not in an issuable state'; end if;
 insert into public.dmvic_order_events(order_id,event_type,from_status,to_status) values(p_order_id,'issued','issuing','issued');
end $$;
revoke all on function public.dmvic_complete_issuance(uuid,text,text,text,jsonb) from public;
