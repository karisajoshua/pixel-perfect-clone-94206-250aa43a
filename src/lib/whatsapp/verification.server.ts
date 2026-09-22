import { createHash, randomInt, timingSafeEqual } from "node:crypto";

type Admin = any;
const TTL_MINUTES = 10;

function digest(challengeId: string, otp: string) {
  const secret=process.env.WHATSAPP_OTP_SECRET;
  if(!secret) throw new Error("WHATSAPP_OTP_SECRET is not configured");
  return createHash("sha256").update(`${secret}:${challengeId}:${otp}`).digest("hex");
}

export async function createWhatsAppOtp(admin: Admin, args: {
  tenantId:string; conversationId:string; clientId:string; vehicleId?:string|null; phone:string;
}) {
  // Invalidate older unused challenges for this conversation.
  await admin.from("whatsapp_verification_challenges").update({ consumed_at:new Date().toISOString() })
    .eq("conversation_id",args.conversationId).is("verified_at",null).is("consumed_at",null);

  const id=crypto.randomUUID();
  const otp=String(randomInt(100000,1000000));
  const expiresAt=new Date(Date.now()+TTL_MINUTES*60_000).toISOString();
  const {error}=await admin.from("whatsapp_verification_challenges").insert({
    id,tenant_id:args.tenantId,conversation_id:args.conversationId,client_id:args.clientId,
    vehicle_id:args.vehicleId??null,phone:args.phone,purpose:"vehicle_access",
    otp_hash:digest(id,otp),expires_at:expiresAt,
  });
  if(error) throw new Error(error.message);
  return {id,otp,expiresAt};
}

export async function verifyWhatsAppOtp(admin: Admin, args:{tenantId:string;conversationId:string;otp:string}) {
  const {data:c,error}=await admin.from("whatsapp_verification_challenges").select("*")
    .eq("tenant_id",args.tenantId).eq("conversation_id",args.conversationId)
    .is("consumed_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(error||!c) return {ok:false,reason:"No active verification code. Please start again."};
  if(c.verified_at) return {ok:true,challenge:c};
  if(new Date(c.expires_at).getTime()<Date.now()) return {ok:false,reason:"That code has expired. Please request a new one."};
  if(c.attempts>=c.max_attempts) return {ok:false,reason:"Too many attempts. Please request a new code."};
  const actual=Buffer.from(digest(c.id,args.otp),"hex"), expected=Buffer.from(c.otp_hash,"hex");
  const ok=actual.length===expected.length&&timingSafeEqual(actual,expected);
  if(!ok){await admin.from("whatsapp_verification_challenges").update({attempts:c.attempts+1}).eq("id",c.id);return {ok:false,reason:"That code is not correct. Please try again."};}
  const verifiedAt=new Date().toISOString();
  await admin.from("whatsapp_verification_challenges").update({verified_at:verifiedAt,attempts:c.attempts+1}).eq("id",c.id);
  return {ok:true,challenge:{...c,verified_at:verifiedAt}};
}
