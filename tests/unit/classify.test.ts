import { describe, expect, it } from "vitest";
import { firstNumber, normalizeGender, normalizeMovement, parseWarrantyMonths, parseWaterResistanceM, strapTypeOf, tidyLabel } from "@/lib/catalog/classify";

describe("dataset value normalisers", () => {
  it("maps movement text", () => {
    expect(normalizeMovement("Quartz")).toBe("QUARTZ");
    expect(normalizeMovement("Japanese quartz chronograph")).toBe("QUARTZ");
    expect(normalizeMovement("Automatic (self-winding)")).toBe("AUTOMATIC");
    expect(normalizeMovement("Hand-wound mechanical")).toBe("MANUAL");
    expect(normalizeMovement("Eco-Drive")).toBe("SOLAR");
    expect(normalizeMovement("Kinetic")).toBe("KINETIC");
    expect(normalizeMovement("Hybrid smartwatch")).toBe("SMART");
    expect(normalizeMovement("")).toBeNull();
  });
  it("maps gender", () => {
    expect(normalizeGender("Men")).toBe("MEN");
    expect(normalizeGender("Women")).toBe("WOMEN");
    expect(normalizeGender("Ladies")).toBe("WOMEN");
    expect(normalizeGender("Unisex")).toBe("UNISEX");
  });
  it("categorises straps", () => {
    expect(strapTypeOf("Black steel bracelet")).toBe("Metal bracelet");
    expect(strapTypeOf("Brown leather strap")).toBe("Leather");
    expect(strapTypeOf("Black silicone strap")).toBe("Rubber / silicone");
    expect(strapTypeOf("Rose gold mesh")).toBe("Mesh");
  });
  it("parses numbers, water resistance and warranty", () => {
    expect(firstNumber("45.0")).toBe(45);
    expect(parseWaterResistanceM("50 m (5 ATM)")).toBe(50);
    expect(parseWaterResistanceM("10 ATM")).toBe(100);
    expect(parseWaterResistanceM("Not water resistant")).toBe(0);
    expect(parseWarrantyMonths("2 years")).toBe(24);
    expect(parseWarrantyMonths("18 months")).toBe(18);
    expect(parseWarrantyMonths("2")).toBe(24);
    expect(tidyLabel("chronograph")).toBe("Chronograph");
  });
});
