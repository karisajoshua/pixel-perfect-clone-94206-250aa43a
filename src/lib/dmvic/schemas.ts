import { z } from "zod";

const dmvicDate = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Use DD/MM/YYYY");
const year = z.number().int().min(1900).max(2200);
const cover = z.union([z.literal(100), z.literal(200), z.literal(300)]);

const base = z.object({
  MemberCompanyID: z.union([z.string().min(1), z.number().int().positive()]),
  Typeofcover: cover,
  Policyholder: z.string().min(1),
  policynumber: z.string().min(1),
  Commencingdate: dmvicDate,
  Expiringdate: dmvicDate,
  Registrationnumber: z.string().optional(),
  Chassisnumber: z.string().regex(/^[A-Za-z0-9]{4,20}$/),
  Phonenumber: z.string().min(9).max(15),
  Bodytype: z.string().min(1),
  // DMVIC intermediary docs show Yearofregistration struck through; do not require it.
  Yearofregistration: year.optional(),
  Email: z.string().email(),
  InsuredPIN: z.string().max(11),
  SumInsured: z.number().nonnegative().optional(),
}).passthrough().superRefine((v, ctx) => {
  if ((v.Typeofcover === 100 || v.Typeofcover === 300) && v.SumInsured == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SumInsured"], message: "SumInsured is required for COMP/TPTF" });
  }
});

export const dmvicCertificateSchemas = {
  A: base.and(z.object({
    TypeOfCertificate: z.union([z.literal(1), z.literal(8)]),
    Licensedtocarry: z.number().int().positive(),
  }).passthrough()),
  B: base.and(z.object({
    VehicleType: z.number().int().min(1).max(6),
  }).passthrough()),
  C: base,
  D: base.and(z.object({
    TypeOfCertificate: z.union([z.literal(4), z.literal(9), z.literal(10)]),
  }).passthrough()),
} as const;

export const dmvicCertificateRequestSchema = z.discriminatedUnion("certificateType", [
  z.object({ certificateType: z.literal("A"), payload: dmvicCertificateSchemas.A }),
  z.object({ certificateType: z.literal("B"), payload: dmvicCertificateSchemas.B }),
  z.object({ certificateType: z.literal("C"), payload: dmvicCertificateSchemas.C }),
  z.object({ certificateType: z.literal("D"), payload: dmvicCertificateSchemas.D }),
]);
