import { z } from "zod";
import { dmvicCertificateSchemas } from "./schemas";

/**
 * Canonical Zest-side inputs for a DMVIC Type A certificate.
 *
 * DMVIC numeric identifiers are intentionally supplied by verified mappings;
 * this module never guesses MemberCompanyID, TypeOfCertificate or Typeofcover.
 */
export const zestTypeAMappingInputSchema = z.object({
  memberCompanyId: z.union([z.string().min(1), z.number().int().positive()]),
  certificateTypeCode: z.union([z.literal(1), z.literal(8)]),
  coverCode: z.union([z.literal(100), z.literal(200), z.literal(300)]),
  policyholder: z.string().min(1),
  policyNumber: z.string().min(1),
  commencementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  registrationNumber: z.string().optional(),
  chassisNumber: z.string().min(4).max(20),
  phoneNumber: z.string().min(9).max(15),
  bodyType: z.string().min(1),
  licensedToCarry: z.number().int().positive(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  engineNumber: z.string().optional(),
  email: z.string().email(),
  sumInsured: z.number().nonnegative().optional(),
  insuredPin: z.string().min(1).max(11),
  yearOfManufacture: z.number().int().min(1900).max(2200).optional(),
  hudumaNumber: z.string().optional(),
});

export type ZestTypeAMappingInput = z.infer<typeof zestTypeAMappingInputSchema>;

function toDmvicDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Maps authoritative Zest policy/client/vehicle data to DMVIC's Type A shape.
 * The returned payload is validated again by the DMVIC schema before transport.
 */
export function mapZestToDmvicTypeA(input: ZestTypeAMappingInput) {
  const value = zestTypeAMappingInputSchema.parse(input);

  const payload = {
    TypeOfCertificate: value.certificateTypeCode,
    MemberCompanyID: value.memberCompanyId,
    Typeofcover: value.coverCode,
    Policyholder: value.policyholder.trim(),
    policynumber: value.policyNumber.trim(),
    Commencingdate: toDmvicDate(value.commencementDate),
    Expiringdate: toDmvicDate(value.expiryDate),
    ...(value.registrationNumber ? { Registrationnumber: value.registrationNumber.trim() } : {}),
    Chassisnumber: value.chassisNumber.replace(/\s+/g, "").toUpperCase(),
    Phonenumber: value.phoneNumber.replace(/[\s-]/g, ""),
    Bodytype: value.bodyType.trim(),
    Licensedtocarry: value.licensedToCarry,
    ...(value.vehicleMake ? { Vehiclemake: value.vehicleMake.trim() } : {}),
    ...(value.vehicleModel ? { Vehiclemodel: value.vehicleModel.trim() } : {}),
    ...(value.engineNumber ? { Enginenumber: value.engineNumber.trim() } : {}),
    Email: value.email.trim().toLowerCase(),
    ...(value.sumInsured != null ? { SumInsured: value.sumInsured } : {}),
    InsuredPIN: value.insuredPin.trim().toUpperCase(),
    ...(value.yearOfManufacture != null ? { Yearofmanufacture: value.yearOfManufacture } : {}),
    ...(value.hudumaNumber ? { HudumaNumber: value.hudumaNumber.trim() } : {}),
  };

  // DMVIC docs show Yearofregistration struck through, so it is deliberately
  // not generated here. Validate the exact outbound payload before transport.
  return dmvicCertificateSchemas.A.parse(payload);
}
