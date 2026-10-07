export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Top rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export const PRICE_PRESETS = [
  { label: "Under ₹15,000", min: undefined, max: 15000 },
  { label: "₹15,000 – ₹30,000", min: 15000, max: 30000 },
  { label: "₹30,000 – ₹50,000", min: 30000, max: 50000 },
  { label: "₹50,000 – ₹75,000", min: 50000, max: 75000 },
  { label: "₹75,000 – ₹1,00,000", min: 75000, max: 100000 },
] as const;

export const SIZE_OPTIONS = [
  { value: "lt36", label: "Under 36 mm" },
  { value: "36-39", label: "36 – 39 mm" },
  { value: "40-42", label: "40 – 42 mm" },
  { value: "gt42", label: "43 mm +" },
] as const;

export const MOVEMENT_OPTIONS = [
  { value: "AUTOMATIC", label: "Automatic" },
  { value: "MANUAL", label: "Manual wind" },
  { value: "QUARTZ", label: "Quartz" },
  { value: "SOLAR", label: "Solar" },
  { value: "KINETIC", label: "Kinetic" },
  { value: "SMART", label: "Smart" },
] as const;

export const GENDER_OPTIONS = [
  { value: "MEN", label: "Men" },
  { value: "WOMEN", label: "Women" },
] as const;

/** URL keys that count as "filters" (for the chip row & clear-all). */
export const FILTER_KEYS = ["brand", "min", "max", "size", "type", "movement", "strap", "shape", "dial", "gender", "instock"] as const;
