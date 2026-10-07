import { describe, expect, it } from "vitest";
import { normalizeUtr, upiAppLinks, upiUri, UTR_REGEX, VPA_REGEX } from "@/lib/upi";

const req = { vpa: "maison@okhdfcbank", payeeName: "Maison Horlogère", amount: 65075, orderNumber: "MH-2026-000123" };

describe("UPI helpers", () => {
  it("builds a standard upi://pay link with exact amount and order note", () => {
    const u = new URL(upiUri(req));
    expect(u.protocol).toBe("upi:");
    expect(u.searchParams.get("pa")).toBe("maison@okhdfcbank");
    expect(u.searchParams.get("am")).toBe("65075.00");
    expect(u.searchParams.get("cu")).toBe("INR");
    expect(u.searchParams.get("tn")).toBe("Order MH-2026-000123");
  });
  it("offers app-specific links with the same parameters", () => {
    const links = upiAppLinks(req);
    expect(links.map((l) => l.id)).toEqual(["gpay", "phonepe", "paytm", "bhim"]);
    for (const l of links) expect(l.href).toContain("am=65075.00");
  });
  it("validates UTRs and UPI IDs", () => {
    expect(UTR_REGEX.test(normalizeUtr("4123 5678 9012"))).toBe(true);
    expect(UTR_REGEX.test("12345")).toBe(false);
    expect(VPA_REGEX.test("store.name@ybl")).toBe(true);
    expect(VPA_REGEX.test("no-at-sign")).toBe(false);
  });
});
