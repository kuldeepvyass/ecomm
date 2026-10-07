/** Lowercase, strip diacritics ("Équinoxe" → "equinoxe") and collapse whitespace. */
export function normalizeSearch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(input: string): string {
  return normalizeSearch(input).replace(/[ .]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function buildSearchText(p: {
  brand: string;
  modelName: string;
  referenceNumber: string;
  calibre?: string | null;
  sku?: string;
  extra?: string[];
}): string {
  return normalizeSearch(
    [p.brand, p.modelName, p.referenceNumber, p.referenceNumber.replace(/[^a-z0-9]/gi, ""), p.calibre ?? "", p.sku ?? "", ...(p.extra ?? [])].join(" "),
  );
}

/** Strips control chars and trims; React escapes HTML on render. */
export function sanitizeText(input: string, max = 5000): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

/** "Black Chronograph AX2098" + "AX2098" → unchanged; "Classic" + "AX2098" → "Classic AX2098". Avoids "AX2098 AX2098". */
export function nameWithRef(modelName: string, ref: string | null | undefined): string {
  const r = (ref ?? "").trim();
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!r || /tbc|variant/i.test(r) || squash(modelName).includes(squash(r))) return modelName;
  return `${modelName} ${r}`;
}
