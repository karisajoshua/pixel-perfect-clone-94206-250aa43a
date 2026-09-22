import { z } from "zod";

const dmvicDate = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Use DD/MM/YYYY");
const year = z.number().int().min(1900).max(2200);
const cover = z.union([z.literal(100), z.literal(200), z.literal(300)]);
const memberCompany = z.union([z.string().min(1), z.number().int().positive()]);

const common = z.object({
  MemberCompanyID: memberCompany,
  Typeofcover: cover,
  Policyholder: z.string().min(1),
  policynumber: z.string().min(1),
  Commencingdate: dmvicDate,
  Expiringdate: dmvicDate,
  Registrationnumber: z.string().optional(),
  Chassisnumber: z.string().regex(/^[A-Za-z0-9]{4,20}$/),
  Phonenumber: z.string().min(9).max(15),
  Bodytype: z.string().min(1),
  Yearofregistration: year,
  Vehiclemake: z.string().optional(),
  Vehiclemodel: z.string().optional(),
  Enginenumber: z.string().optional(),
  Email: z.string().email(),
  InsuredPIN: z.string().min(1).max(11),
  SumInsured: z.number().nonnegative().optional(),
  Yearofmanufacture: year.optional(),
  HudumaNumber: z.string().optional(),
}).passthrough();

function requireSumInsured<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.superRefine((v: any, ctx) => {
    if ((v.Typeofcover === 100 || v.Typeofcover === 300) && v.SumInsured == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SumInsured"], message: "SumInsured is required for COMP/TPTF" });
    }
  });
}

const typeAValidation = requireSumInsured(common.extend({
  TypeOfCertificate: z.union([z.literal(1), z.literal(6), z.literal(7), z.literal(8)]),
  Licensedtocarry: z.number().int().positive(),
}));
// Issuance documentation formally lists only 1 and 8. Bus/Matatu (6/7) remain
// validation-only until DMVIC confirms their issuance contract in UAT.
const typeAIssuance = requireSumInsured(common.extend({
  TypeOfCertificate: z.union([z.literal(1), z.literal(8)]),
  Licensedtocarry: z.number().int().positive(),
}));

const typeB = requireSumInsured(common.extend({
  VehicleType: z.number().int().min(1).max(6),
  TonnageCarryingCapacity: z.number().int().positive(),
  Licensedtocarry: z.number().int().positive().optional(),
}));

const typeC = requireSumInsured(common);

const typeDValidation = requireSumInsured(common);
const typeDIssuance = requireSumInsured(common.extend({
  TypeOfCertificate: z.union([z.literal(4), z.literal(9), z.literal(10)]),
  Licensedtocarry: z.number().int().positive().optional(),
  Tonnage: z.number().int().positive().optional(),
})).superRefine((v, ctx) => {
  if ((v.TypeOfCertificate === 4 || v.TypeOfCertificate === 9) && v.Licensedtocarry == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["Licensedtocarry"], message: "Licensedtocarry is required for Type D motorcycle/PSV motorcycle" });
  }
  if (v.TypeOfCertificate === 10 && v.Tonnage == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["Tonnage"], message: "Tonnage is required for commercial motorcycle" });
  }
});

export const dmvicValidationSchemas = { A: typeAValidation, B: typeB, C: typeC, D: typeDValidation } as const;
export const dmvicIssuanceSchemas = { A: typeAIssuance, B: typeB, C: typeC, D: typeDIssuance } as const;

// Kept for preview compatibility until the exact intermediary preview specifications are verified.
export const dmvicCertificateSchemas = dmvicIssuanceSchemas;

export const dmvicValidationRequestSchema = z.discriminatedUnion("certificateType", [
  z.object({ certificateType: z.literal("A"), payload: dmvicValidationSchemas.A }),
  z.object({ certificateType: z.literal("B"), payload: dmvicValidationSchemas.B }),
  z.object({ certificateType: z.literal("C"), payload: dmvicValidationSchemas.C }),
  z.object({ certificateType: z.literal("D"), payload: dmvicValidationSchemas.D }),
]);

export const dmvicIssuanceRequestSchema = z.discriminatedUnion("certificateType", [
  z.object({ certificateType: z.literal("A"), payload: dmvicIssuanceSchemas.A }),
  z.object({ certificateType: z.literal("B"), payload: dmvicIssuanceSchemas.B }),
  z.object({ certificateType: z.literal("C"), payload: dmvicIssuanceSchemas.C }),
  z.object({ certificateType: z.literal("D"), payload: dmvicIssuanceSchemas.D }),
]);

export const dmvicCertificateRequestSchema = dmvicIssuanceRequestSchema;
