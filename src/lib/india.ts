/** Indian states & UTs with GST state codes (used for CGST/SGST vs IGST). */
export const INDIAN_STATES = [
  { code: "AN", gst: "35", name: "Andaman and Nicobar Islands" },
  { code: "AP", gst: "37", name: "Andhra Pradesh" },
  { code: "AR", gst: "12", name: "Arunachal Pradesh" },
  { code: "AS", gst: "18", name: "Assam" },
  { code: "BR", gst: "10", name: "Bihar" },
  { code: "CH", gst: "04", name: "Chandigarh" },
  { code: "CT", gst: "22", name: "Chhattisgarh" },
  { code: "DN", gst: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "DL", gst: "07", name: "Delhi" },
  { code: "GA", gst: "30", name: "Goa" },
  { code: "GJ", gst: "24", name: "Gujarat" },
  { code: "HR", gst: "06", name: "Haryana" },
  { code: "HP", gst: "02", name: "Himachal Pradesh" },
  { code: "JK", gst: "01", name: "Jammu and Kashmir" },
  { code: "JH", gst: "20", name: "Jharkhand" },
  { code: "KA", gst: "29", name: "Karnataka" },
  { code: "KL", gst: "32", name: "Kerala" },
  { code: "LA", gst: "38", name: "Ladakh" },
  { code: "LD", gst: "31", name: "Lakshadweep" },
  { code: "MP", gst: "23", name: "Madhya Pradesh" },
  { code: "MH", gst: "27", name: "Maharashtra" },
  { code: "MN", gst: "14", name: "Manipur" },
  { code: "ML", gst: "17", name: "Meghalaya" },
  { code: "MZ", gst: "15", name: "Mizoram" },
  { code: "NL", gst: "13", name: "Nagaland" },
  { code: "OR", gst: "21", name: "Odisha" },
  { code: "PY", gst: "34", name: "Puducherry" },
  { code: "PB", gst: "03", name: "Punjab" },
  { code: "RJ", gst: "08", name: "Rajasthan" },
  { code: "SK", gst: "11", name: "Sikkim" },
  { code: "TN", gst: "33", name: "Tamil Nadu" },
  { code: "TG", gst: "36", name: "Telangana" },
  { code: "TR", gst: "16", name: "Tripura" },
  { code: "UP", gst: "09", name: "Uttar Pradesh" },
  { code: "UK", gst: "05", name: "Uttarakhand" },
  { code: "WB", gst: "19", name: "West Bengal" },
] as const;

export type StateCode = (typeof INDIAN_STATES)[number]["code"];
export const STATE_CODES = INDIAN_STATES.map((s) => s.code) as [StateCode, ...StateCode[]];

export function stateName(code: string): string {
  return INDIAN_STATES.find((s) => s.code === code)?.name ?? code;
}

/** 6 digits, cannot start with 0. */
export const PIN_REGEX = /^[1-9]\d{5}$/;
/** 10-digit Indian mobile starting 6–9 (optional +91 / 0 prefix stripped before checking). */
export const MOBILE_REGEX = /^[6-9]\d{9}$/;

export function normalizeMobile(input: string): string {
  return input.replace(/\D/g, "").replace(/^(91|0)(?=[6-9]\d{9}$)/, "");
}

/**
 * First digit of a PIN maps to postal regions; used to catch obviously mismatched state/PIN pairs.
 * (1: DL/HR/PB/HP/JK/CH/LA, 2: UP/UK, 3: RJ/GJ/DN, 4: MH/MP/CT/GA, 5: AP/TG/KA, 6: TN/KL/PY/LD, 7: WB/OR/NE/AN/SK, 8: BR/JH)
 */
const PIN_REGION: Record<string, StateCode[]> = {
  "1": ["DL", "HR", "PB", "HP", "JK", "CH", "LA"],
  "2": ["UP", "UK"],
  "3": ["RJ", "GJ", "DN"],
  "4": ["MH", "MP", "CT", "GA"],
  "5": ["AP", "TG", "KA"],
  "6": ["TN", "KL", "PY", "LD"],
  "7": ["WB", "OR", "AS", "AR", "MN", "ML", "MZ", "NL", "TR", "SK", "AN"],
  "8": ["BR", "JH"],
};

export function pinMatchesState(pin: string, state: string): boolean {
  const allowed = PIN_REGION[pin[0]];
  return !allowed || (allowed as string[]).includes(state);
}
