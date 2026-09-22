import { z } from "zod";
import { dmvicValidationSchemas, dmvicIssuanceSchemas } from "./schemas";
import type { DmvicCertificateType } from "./types";

const base = z.object({
  memberCompanyId: z.union([z.string().min(1), z.number().int().positive()]),
  coverCode: z.union([z.literal(100), z.literal(200), z.literal(300)]),
  policyholder: z.string().min(1),
  policyNumber: z.string().min(1),
  commencementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  registrationNumber: z.string().optional(),
  chassisNumber: z.string().min(4).max(20),
  phoneNumber: z.string().min(9).max(15),
  bodyType: z.string().min(1),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  engineNumber: z.string().optional(),
  email: z.string().email(),
  sumInsured: z.number().nonnegative().optional(),
  insuredPin: z.string().min(1).max(11),
  yearOfRegistration: z.number().int().min(1900).max(2200),
  yearOfManufacture: z.number().int().min(1900).max(2200).optional(),
  hudumaNumber: z.string().optional(),
});

export const zestDmvicMappingInputSchema = z.discriminatedUnion("certificateType", [
  base.extend({ certificateType: z.literal("A"), certificateTypeCode: z.union([z.literal(1),z.literal(6),z.literal(7),z.literal(8)]), licensedToCarry: z.number().int().positive() }),
  base.extend({ certificateType: z.literal("B"), vehicleType: z.number().int().min(1).max(6), tonnageCarryingCapacity: z.number().int().positive(), licensedToCarry: z.number().int().positive().optional() }),
  base.extend({ certificateType: z.literal("C") }),
  base.extend({ certificateType: z.literal("D"), certificateTypeCode: z.union([z.literal(4),z.literal(9),z.literal(10)]).optional(), licensedToCarry: z.number().int().positive().optional(), tonnage: z.number().int().positive().optional() }),
]);
export type ZestDmvicMappingInput = z.infer<typeof zestDmvicMappingInputSchema>;

const toDate=(iso:string)=>{const [y,m,d]=iso.split("-");return `${d}/${m}/${y}`;};
function common(v:any){return {
 MemberCompanyID:v.memberCompanyId, Typeofcover:v.coverCode, Policyholder:v.policyholder.trim(), policynumber:v.policyNumber.trim(),
 Commencingdate:toDate(v.commencementDate), Expiringdate:toDate(v.expiryDate),
 ...(v.registrationNumber?{Registrationnumber:v.registrationNumber.trim()}:{}), Chassisnumber:v.chassisNumber.replace(/\s+/g,"").toUpperCase(),
 Phonenumber:v.phoneNumber.replace(/[\s-]/g,""), Bodytype:v.bodyType.trim(), Yearofregistration:v.yearOfRegistration,
 ...(v.vehicleMake?{Vehiclemake:v.vehicleMake.trim()}:{}), ...(v.vehicleModel?{Vehiclemodel:v.vehicleModel.trim()}:{}),
 ...(v.engineNumber?{Enginenumber:v.engineNumber.trim()}:{}), Email:v.email.trim().toLowerCase(),
 ...(v.sumInsured!=null?{SumInsured:v.sumInsured}:{}), InsuredPIN:v.insuredPin.trim().toUpperCase(),
 ...(v.yearOfManufacture!=null?{Yearofmanufacture:v.yearOfManufacture}:{}), ...(v.hudumaNumber?{HudumaNumber:v.hudumaNumber.trim()}:{}),
};}

export function mapZestToDmvic(input: ZestDmvicMappingInput, operation:"validate"|"issue"="validate"){
 const v=zestDmvicMappingInputSchema.parse(input); let payload:any=common(v);
 if(v.certificateType==="A") payload={...payload,TypeOfCertificate:v.certificateTypeCode,Licensedtocarry:v.licensedToCarry};
 if(v.certificateType==="B") payload={...payload,VehicleType:v.vehicleType,TonnageCarryingCapacity:v.tonnageCarryingCapacity,...(v.licensedToCarry?{Licensedtocarry:v.licensedToCarry}:{})};
 if(v.certificateType==="D" && operation==="issue") payload={...payload,TypeOfCertificate:v.certificateTypeCode,...(v.licensedToCarry?{Licensedtocarry:v.licensedToCarry}:{}),...(v.tonnage?{Tonnage:v.tonnage}:{})};
 const schemas=operation==="issue"?dmvicIssuanceSchemas:dmvicValidationSchemas;
 return schemas[v.certificateType as DmvicCertificateType].parse(payload);
}

/** Backward-compatible Type A mapper used by the existing preview screen. */
export function mapZestToDmvicTypeA(input:any){return mapZestToDmvic({certificateType:"A",...input},"issue");}
