/** Safe localStorage helpers (private mode / blocked storage never throws). */
export function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  wishlist: "mh:wishlist",
  recent: "mh:recent",
  compare: "mh:compare",
  theme: "mh:theme",
  consent: "mh:consent",
} as const;
