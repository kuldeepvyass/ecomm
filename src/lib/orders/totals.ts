export type LineInput = {
  mrp: number;
  unitPrice: number; // server-computed selling price
  quantity: number;
  gstRatePct: number;
};

export type TotalsInput = {
  lines: LineInput[];
  couponDiscount: number;
  shippingFee: number;
  freeShippingThreshold: number | null;
  sellerStateCode: string;
  shipStateCode: string;
};

export type OrderTotals = {
  mrpTotal: number;
  itemsTotal: number;
  couponDiscount: number;
  shippingFee: number;
  grandTotal: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
};

const SERVICE_GST_PCT = 18; // shipping charges

/** Back-calculates GST from an inclusive amount. */
export function splitInclusive(gross: number, ratePct: number) {
  const taxable = Math.round((gross * 100) / (100 + ratePct));
  return { taxable, tax: gross - taxable };
}

/** Splits a discount across lines proportionally; the last line absorbs rounding so shares sum exactly. */
export function allocateDiscount(lineTotals: number[], discount: number): number[] {
  const total = lineTotals.reduce((a, b) => a + b, 0);
  const shares: number[] = [];
  let allocated = 0;
  lineTotals.forEach((gross, i) => {
    const share = i === lineTotals.length - 1 ? discount - allocated : total > 0 ? Math.round((discount * gross) / total) : 0;
    allocated += share;
    shares.push(share);
  });
  return shares;
}

export function computeShippingFee(itemsTotal: number, fee: number, threshold: number | null) {
  if (itemsTotal <= 0) return 0;
  if (threshold !== null && itemsTotal >= threshold) return 0;
  return fee;
}

/**
 * All amounts are GST-inclusive whole rupees. The coupon discount is allocated across
 * lines proportionally so each line's tax uses its own rate.
 */
export function computeOrderTotals(input: TotalsInput): OrderTotals {
  const mrpTotal = input.lines.reduce((s, l) => s + l.mrp * l.quantity, 0);
  const itemsTotal = input.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const couponDiscount = Math.max(0, Math.min(input.couponDiscount, itemsTotal));
  const shippingFee = computeShippingFee(itemsTotal, input.shippingFee, input.freeShippingThreshold);
  const grandTotal = itemsTotal - couponDiscount + shippingFee;

  let taxableValue = 0;
  let tax = 0;
  const shares = allocateDiscount(input.lines.map((l) => l.unitPrice * l.quantity), couponDiscount);
  input.lines.forEach((l, i) => {
    const gross = l.unitPrice * l.quantity;
    const share = shares[i];
    const s = splitInclusive(gross - share, l.gstRatePct);
    taxableValue += s.taxable;
    tax += s.tax;
  });
  if (shippingFee > 0) {
    const s = splitInclusive(shippingFee, SERVICE_GST_PCT);
    taxableValue += s.taxable;
    tax += s.tax;
  }

  const intraState = input.sellerStateCode === input.shipStateCode;
  const cgst = intraState ? Math.floor(tax / 2) : 0;
  const sgst = intraState ? tax - cgst : 0;
  const igst = intraState ? 0 : tax;

  return { mrpTotal, itemsTotal, couponDiscount, shippingFee, grandTotal, taxableValue, cgst, sgst, igst };
}
