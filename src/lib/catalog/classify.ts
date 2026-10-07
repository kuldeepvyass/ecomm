/** Normalises free-text watch attributes (from spreadsheets / datasets) into store values. */

export type MovementValue = "AUTOMATIC" | "QUARTZ" | "MANUAL" | "SOLAR" | "KINETIC" | "SMART";

export const MOVEMENT_LABEL: Record<MovementValue, string> = {
  AUTOMATIC: "Automatic",
  QUARTZ: "Quartz",
  MANUAL: "Manual wind",
  SOLAR: "Solar",
  KINETIC: "Kinetic",
  SMART: "Smart",
};

export function normalizeMovement(input: string | null | undefined): MovementValue | null {
  const t = (input ?? "").toLowerCase().trim();
  if (!t) return null;
  if (/solar|eco[-\s]?drive|light[-\s]?powered/.test(t)) return "SOLAR";
  // Only smartwatches are "rechargeable" (solar-rechargeable is caught above).
  if (/\bsmart|hybrid|connected|wear\s?os|rechargeable/.test(t)) return "SMART";
  if (/kinetic|automatic quartz|auto[-\s]?quartz/.test(t)) return "KINETIC";
  if (/automatic|self[-\s]?wind|auto\b|mechanical automatic/.test(t)) return "AUTOMATIC";
  if (/manual|hand[-\s]?wo?und|hand[-\s]?wind|mechanical/.test(t)) return "MANUAL";
  if (/quartz|battery|digital|analog[-\s]?digital/.test(t)) return "QUARTZ";
  return null;
}

export function normalizeGender(input: string | null | undefined): "MEN" | "WOMEN" | "UNISEX" | null {
  const t = (input ?? "").toLowerCase().trim();
  if (!t) return null;
  if (/unisex|couple|both|all/.test(t)) return "UNISEX";
  if (/^(wo|ladies|lady|female|her\b)|women/.test(t)) return "WOMEN";
  if (/^(men|man|male|gents|gent|him\b)|^mens/.test(t)) return "MEN";
  return null;
}

/** Strap/bracelet text → one of a few filterable categories. */
export function strapTypeOf(input: string | null | undefined): string {
  const t = (input ?? "").toLowerCase();
  if (/mesh|milanese/.test(t)) return "Mesh";
  if (/leather|alligator|croco|suede|calf/.test(t)) return "Leather";
  if (/rubber|silicone|resin|fkm|polyurethane/.test(t)) return "Rubber / silicone";
  if (/nylon|fabric|nato|canvas|textile/.test(t)) return "Fabric";
  if (/ceramic/.test(t)) return "Ceramic";
  if (/bracelet|steel|metal|gold|titanium|link|chain/.test(t)) return "Metal bracelet";
  return t ? "Other" : "";
}

/**
 * Free-text watch type → one filterable category, so "Analogue (multifunction)" and
 * "Smartwatch (GPS outdoor)" don't splinter the Type filter into near-duplicates.
 */
export function watchTypeOf(input: string | null | undefined): string | null {
  const t = (input ?? "").toLowerCase().trim();
  if (!t) return null;
  if (/smart|gps|fitness|connected|hybrid/.test(t)) return "Smartwatch";
  if (/chrono/.test(t)) return "Chronograph";
  if (/div(e|er|ing)/.test(t)) return "Diver";
  if (/skeleton|squelette|open[-\s]?heart/.test(t)) return "Skeleton";
  if (/multi[-\s]?function|day[-\s]?date/.test(t)) return "Multifunction";
  if (/ana\w*[-\s/]+digi|digi\w*[-\s/]+ana|ana-digi/.test(t)) return "Analog-digital";
  if (/digital/.test(t)) return "Digital";
  if (/dress/.test(t)) return "Dress";
  if (/pilot|aviat/.test(t)) return "Pilot";
  if (/field|military/.test(t)) return "Field";
  if (/analog/.test(t)) return "Analog";
  return tidyLabel(input);
}

/** First number in a string: "45.0" → 45, "12 mm" → 12. */
export function firstNumber(input: string | null | undefined): number | null {
  const m = String(input ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** "50 m (5 ATM)" → 50, "10 ATM" → 100, "5 bar" → 50, "Not water resistant" → 0. */
export function parseWaterResistanceM(input: string | null | undefined): number | null {
  const t = String(input ?? "").toLowerCase();
  if (!t.trim()) return null;
  if (/not\s+water|no\s+water/.test(t)) return 0;
  const metres = t.match(/(\d+(?:\.\d+)?)\s*(m\b|metres?|meters?)/);
  if (metres) return Math.round(Number(metres[1]));
  const atm = t.match(/(\d+(?:\.\d+)?)\s*(atm|bar)/);
  if (atm) return Math.round(Number(atm[1]) * 10);
  const n = firstNumber(t);
  return n === null ? null : Math.round(n);
}

/** "2 years" → 24, "18 months" → 18, "1 yr" → 12, "2" → 24 (small bare numbers are years). */
export function parseWarrantyMonths(input: string | null | undefined): number | null {
  const t = String(input ?? "").toLowerCase();
  const n = firstNumber(t);
  if (n === null) return null;
  if (/month|mo\b/.test(t)) return Math.round(n);
  if (/year|yr/.test(t)) return Math.round(n * 12);
  return n <= 10 ? Math.round(n * 12) : Math.round(n);
}

/** "chronograph" → "Chronograph", "ROUND" → "Round". */
export function tidyLabel(input: string | null | undefined): string | null {
  const t = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!t) return null;
  return t.length <= 3 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
