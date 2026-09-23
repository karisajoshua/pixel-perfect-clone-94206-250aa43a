import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-mfa.middleware";
import { dmvicMemberCompanyStock, dmvicProcessZestCertificate } from "./dmvic.functions";

const schema=z.object({
 policyId:z.string().uuid(), vehicleId:z.string().uuid().nullable().optional(), insurerId:z.string().uuid(),
 certificateType:z.enum(["A","B","C","D"]), classification:z.number().int().optional(), memberCompanyId:z.number().int().positive(),
 input:z.any(),
});

function stockCount(payload:any, classification?:number):number|null{
 const rows=Array.isArray(payload)?payload:(payload?.Data??payload?.data??payload?.Stock??payload?.stock);
 if(!Array.isArray(rows)) return null;
 const row=classification==null?rows[0]:rows.find((x:any)=>Number(x.Classification??x.classification??x.CertificateType??x.certificateType)===classification);
 if(!row) return 0;
 for(const k of ["Available","available","Quantity","quantity","Stock","stock","Balance","balance","AvailableStock","availableStock"]){
   if(row[k]!=null && Number.isFinite(Number(row[k]))) return Number(row[k]);
 }
 return null;
}

export const dmvicPrepareCertificateOrder=createServerFn({method:"POST"})
 .middleware([requireAuth])
 .inputValidator(schema)
 .handler(async({data,context}:any)=>{
   const db=context.supabase;
   const validation=await dmvicProcessZestCertificate({data:{operation:"validate",input:data.input}} as any);
   if(!validation.ok) return {ok:false,stage:"validation",validation};

   const stock=await dmvicMemberCompanyStock({data:{MemberCompanyId:data.memberCompanyId}} as any);
   if(!stock.ok) return {ok:false,stage:"stock",validation,stock};
   const available=stockCount(stock.data,data.classification);
   if(available===0) return {ok:false,stage:"stock",validation,stock,error:"No DMVIC certificate stock is available for this category."};
   if(available==null) return {ok:false,stage:"stock",validation,stock,error:"DMVIC stock response could not be safely interpreted. Manual review is required before payment."};

   const q=(db as any).from("dmvic_certificate_prices").select("selling_price,dmvic_cost").eq("certificate_type",data.certificateType).eq("active",true).lte("effective_from",new Date().toISOString()).order("effective_from",{ascending:false}).limit(1);
   const {data:prices,error:priceError}=data.classification==null?await q.is("classification",null):await q.eq("classification",data.classification);
   if(priceError) throw priceError;
   const price=prices?.[0];
   if(!price) return {ok:false,stage:"pricing",validation,stock,error:"No active certificate price is configured for this category."};

   const {data:orderId,error}=await (db as any).rpc("dmvic_create_order",{p_policy_id:data.policyId,p_vehicle_id:data.vehicleId??null,p_insurer_id:data.insurerId,p_certificate_type:data.certificateType,p_classification:data.classification??null,p_member_company_id:data.memberCompanyId,p_selling_price:price.selling_price,p_dmvic_cost:price.dmvic_cost??null,p_validation_payload:data.input});
   if(error) throw error;
   const {error:markError}=await (db as any).rpc("dmvic_mark_validated",{p_order_id:orderId,p_response:validation.data??{},p_stock_checked:true});
   if(markError) throw markError;
   return {ok:true,orderId,price:Number(price.selling_price),available,validation};
 });


/**
 * Service-side issuance orchestrator.
 *
 * This intentionally has no createServerFn export: it must only be called by
 * trusted server code after a verified payment callback. The caller supplies
 * the service-role Supabase client and the already-paid order.
 */
export async function issuePaidCertificateOrder({
 db, orderId, input,
}: { db:any; orderId:string; input:any }) {
 const key=`dmvic-issue:${orderId}`;
 const {data:claimed,error:claimError}=await db.rpc("dmvic_claim_issuance",{p_order_id:orderId,p_idempotency_key:key});
 if(claimError) throw claimError;
 if(!claimed) return {ok:true,duplicate:true,status:"already_claimed"};

 const result=await dmvicProcessZestCertificate({data:{operation:"issue",input}} as any);
 if(result.requiresManualReview){
   await db.from("dmvic_certificate_orders").update({
     status:"manual_review",
     issuance_response:result.data??{},
     updated_at:new Date().toISOString(),
   }).eq("id",orderId).eq("status","issuing");
   await db.from("dmvic_order_events").insert({
     order_id:orderId,event_type:"manual_review_required",from_status:"issuing",to_status:"manual_review",
     detail:{issuance_request_id:result.issuanceRequestId,error:result.error},
   });
   return {ok:false,status:"manual_review",requestId:result.issuanceRequestId,error:result.error};
 }
 if(!result.ok){
   await db.from("dmvic_certificate_orders").update({
     status:"issuance_failed",issuance_response:result.data??{},updated_at:new Date().toISOString(),
   }).eq("id",orderId).eq("status","issuing");
   await db.from("dmvic_order_events").insert({
     order_id:orderId,event_type:"issuance_failed",from_status:"issuing",to_status:"issuance_failed",
     detail:{error:result.error,transport_error:result.transportError??null},
   });
   return {ok:false,status:"issuance_failed",error:result.error};
 }

 const raw:any=result.data??{};
 const certificateNo=String(
   raw.CertificateNumber??raw.certificateNumber??raw.CertificateNo??raw.certificateNo??
   raw.Data?.CertificateNumber??raw.data?.certificateNumber??""
 ).trim();
 const transactionNo=String(raw.TransactionNumber??raw.transactionNumber??raw.Data?.TransactionNumber??"").trim()||null;
 const apiRequestNo=String(raw.APIRequestNumber??raw.apiRequestNumber??raw.RequestNumber??"").trim()||null;
 if(!certificateNo){
   await db.from("dmvic_certificate_orders").update({
     status:"manual_review",issuance_response:raw,updated_at:new Date().toISOString(),
   }).eq("id",orderId).eq("status","issuing");
   return {ok:false,status:"manual_review",error:"DMVIC returned success without a certificate number."};
 }
 const {error:completeError}=await db.rpc("dmvic_complete_issuance",{
   p_order_id:orderId,p_certificate_no:certificateNo,p_transaction_no:transactionNo,
   p_api_request_no:apiRequestNo,p_response:raw,
 });
 if(completeError) throw completeError;

 const {data:order}=await db.from("dmvic_certificate_orders").select("policy_id").eq("id",orderId).single();
 if(order?.policy_id){
   await db.from("policies").update({certificate_no:certificateNo}).eq("id",order.policy_id);
 }
 return {ok:true,status:"issued",certificateNo};
}
