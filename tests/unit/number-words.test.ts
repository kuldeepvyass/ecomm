import { describe, expect, it } from "vitest";
import { rupeesInWords } from "@/lib/number-words";

describe("rupeesInWords", () => {
  it("uses the Indian numbering system", () => {
    expect(rupeesInWords(1500000)).toBe("Rupees Fifteen Lakh Only");
    expect(rupeesInWords(460750)).toBe("Rupees Four Lakh Sixty Thousand Seven Hundred Fifty Only");
    expect(rupeesInWords(12345678)).toBe("Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only");
    expect(rupeesInWords(0)).toBe("Rupees Zero Only");
  });
});
