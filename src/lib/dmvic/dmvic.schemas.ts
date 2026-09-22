import { z } from "zod";

const dmvicDate = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Use DD/MM/YYYY");
const year = z.number().int().min(1900).max(2200);
const chassis = z.string().regex(/^[A-Za-z0-9]{4,20}$/, "Chassis number must be 4-20 alphanumeric characters");
const kenyanPhone = z.string().min(9).max(15);
const pin = z.string().max(11);
const cover = z.union([z.literal(100), z.literal(200), z.literal(300)]);

const base = z.object({
  MemberCompanyID: z.number().int().positive(),
  Typeofcover: cover,
  Policyholder: z.string().min(1),
  policynumber: z.string().min(1),
  Commencingdate: dmvicDate,
  Expiringdate: dmvicDate,
  Registrationnumber: z.string().optional(),
  Chassisnumber: chassis,
  Phonenumber: kenyanPhone,
  Bodytype: z.string().min(1),
  Vehiclemake: z.string().optional(),
  Vehiclemodel: z.string().optional(),
  Yearofregistration: year,
  Enginenumber: z.string().optional(),
  Email: z.string().email(),
  SumInsured: z.number().nonnegative().optional(),
  InsuredPIN: pin,
  Yearofmanufacture: year.optional(),
  HudumaNumber: z.string().optional(),
  color: z.string().optional(),
  passengerCapacity: z.number().int().nonnegative().optional(),
  cubicCapacity: z.number().int().nonnegative().optional(),
  issuedby: z.string().optional(),
  issuerEmail: z.string().email().optional(),
  agencyName: z.string().optional(),
  agencyNumber: z.string().optional(),
}).passthrough().superRefine((value, ctx) => {
  if ((value.Typeofcover === 100 || value.Typeofcover === 300) && value.SumInsured == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SumInsured"], message: "SumInsured is required for COMP/TPTF" });
  }
});

export const typeASchema = base.and(z.object({
  TypeOfCertificate: z.union([z.literal(1), z.literal(8)]),
  Licensedtocarry: z.number().int().positive(),
}).passthrough());

export const typeBSchema = base.and(z.object({
  VehicleType: z.number().int().min(1).max(6),
  TonnageCarryingCapacity: z.number().int().nonnegative(),
}).passthrough());

export const typeCSchema = base;
export const typeDSchema = base.and(z.object({
  TypeOfCertificate: z.union([z.literal(4), z.literal(9), z.literal(10)]),
}).passthrough());

export const dmvicCertificateSchemas = {
  A: typeASchema,
  B: typeBSchema,
  C: typeCSchema,
  D: typeDSchema,
} as const;
