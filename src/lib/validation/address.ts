import { z } from "zod";
import { MOBILE_REGEX, normalizeMobile, PIN_REGEX, pinMatchesState, STATE_CODES } from "@/lib/india";

export const addressSchema = z
  .object({
    label: z.string().trim().max(30).optional().transform((v) => v || undefined),
    fullName: z.string().trim().min(2, "Enter the recipient's full name").max(80),
    phone: z.string().transform(normalizeMobile).pipe(z.string().regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number")),
    line1: z.string().trim().min(3, "Enter house / flat and street").max(120),
    line2: z.string().trim().max(120).optional().transform((v) => v || undefined),
    landmark: z.string().trim().max(80).optional().transform((v) => v || undefined),
    city: z.string().trim().min(2, "Enter the city").max(60),
    state: z.enum(STATE_CODES, { message: "Choose a state" }),
    pincode: z.string().trim().regex(PIN_REGEX, "Enter a valid 6-digit PIN code"),
    isDefault: z.boolean().default(false),
  })
  .refine((a) => pinMatchesState(a.pincode, a.state), { message: "This PIN code doesn't belong to the selected state", path: ["pincode"] });

export type AddressInput = z.input<typeof addressSchema>;
