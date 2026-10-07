/** Indian-format rupee display: 1500000 → "₹15,00,000". Prices are whole rupees. */
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formatINR(rupees: number): string {
  return inr.format(rupees);
}

const num = new Intl.NumberFormat("en-IN");
export function formatCount(n: number): string {
  return num.format(n);
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
