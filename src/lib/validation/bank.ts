import { z } from "zod";

/** Indian IFSC: 4 bank letters, a zero, 6 branch characters — e.g. HDFC0001234. */
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const bankDetailsSchema = z.object({
  accountHolder: z.string().trim().min(2, "Enter the name on the bank account").max(80)
    .regex(/^[A-Za-z][A-Za-z .'-]*$/, "Use letters only, as printed on your passbook or cheque"),
  accountNumber: z.string().transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{9,18}$/, "Account numbers are 9–18 digits")),
  ifsc: z.string().transform((v) => v.trim().toUpperCase())
    .pipe(z.string().regex(IFSC_REGEX, "IFSC is 11 characters, e.g. HDFC0001234 (printed on your cheque book)")),
  bankName: z.string().trim().min(2, "Enter your bank's name").max(80),
  bankBranch: z.string().trim().max(120).optional(),
});

export type BankDetails = z.infer<typeof bankDetailsSchema>;

/** "••••1234" */
export const maskAccount = (last4: string | null | undefined) => (last4 ? `••••${last4}` : "your account");
