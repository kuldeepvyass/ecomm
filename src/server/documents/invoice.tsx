import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Prisma } from "@/generated/prisma/client";
import { INDIAN_STATES, stateName } from "@/lib/india";
import { rupeesInWords } from "@/lib/number-words";
import { allocateDiscount, splitInclusive } from "@/lib/orders/totals";
import type { StoreConfig } from "@/server/settings";

type Order = Prisma.OrderGetPayload<{ include: { items: true; user: { select: { email: true } } } }> & { payments?: { utr: string; status: string }[] };

// Built-in Helvetica has no ₹ glyph, so amounts use "Rs." on documents.
const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1C1917" },
  brand: { fontSize: 18, letterSpacing: 3, fontFamily: "Times-Roman" },
  muted: { color: "#57534E" },
  h: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  row: { flexDirection: "row" },
  box: { borderWidth: 1, borderColor: "#E7E2D9", padding: 8 },
  th: { fontFamily: "Helvetica-Bold", backgroundColor: "#F3EEE6", paddingVertical: 5, paddingHorizontal: 4 },
  td: { paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#E7E2D9" },
  right: { textAlign: "right" },
  gold: { color: "#785B28" },
});

const gstCode = (code: string) => INDIAN_STATES.find((x) => x.code === code)?.gst ?? "";

function InvoiceDoc({ order, settings }: { order: Order; settings: StoreConfig }) {
  const intra = order.cgst + order.sgst > 0;
  const cols = [
    { k: "#", w: "4%" }, { k: "Description", w: "34%" }, { k: "HSN", w: "8%" }, { k: "Qty", w: "6%" },
    { k: "Unit (incl.)", w: "12%" }, { k: "Taxable", w: "12%" }, { k: intra ? "CGST+SGST" : "IGST", w: "12%" }, { k: "Total", w: "12%" },
  ];
  const charges = [
    ...(order.couponDiscount ? [] : []),
    ...(order.shippingFee ? [{ label: "Insured shipping", amount: order.shippingFee }] : []),
  ];
  const shares = allocateDiscount(order.items.map((it) => it.lineTotal), order.couponDiscount);
  return (
    <Document title={`Invoice ${order.invoiceNumber}`} author={settings.storeName}>
      <Page size="A4" style={s.page}>
        <View style={[s.row, { justifyContent: "space-between", marginBottom: 18 }]}>
          <View>
            <Text style={s.brand}>{settings.storeName.toUpperCase()}</Text>
            <Text style={[s.muted, { marginTop: 4 }]}>{settings.addressLine}</Text>
            <Text style={s.muted}>{settings.contactEmail} · {settings.contactPhone}</Text>
            <Text style={{ marginTop: 2 }}>GSTIN: {settings.gstin ?? "Not registered"} · State: {stateName(settings.stateCode)} ({gstCode(settings.stateCode)})</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.h, s.gold]}>{settings.gstin ? "TAX INVOICE" : "BILL OF SUPPLY"}</Text>
            <Text>Invoice no: {order.invoiceNumber}</Text>
            <Text>Invoice date: {(order.invoicedAt ?? order.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</Text>
            <Text>Order no: {order.orderNumber}</Text>
            <Text>Payment: {`Prepaid (UPI${order.payments?.find((p) => p.status !== "REJECTED")?.utr ? `, UTR ${order.payments.find((p) => p.status !== "REJECTED")!.utr}` : ""})`}</Text>
          </View>
        </View>

        <View style={[s.row, { gap: 10, marginBottom: 14 }]}>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.h}>Bill to / Ship to</Text>
            <Text>{order.shipName}</Text>
            <Text>{order.shipLine1}{order.shipLine2 ? `, ${order.shipLine2}` : ""}</Text>
            <Text>{order.shipCity}, {stateName(order.shipState)} {order.shipPincode}</Text>
            <Text>+91 {order.shipPhone} · {order.user.email}</Text>
          </View>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.h}>Place of supply</Text>
            <Text>{stateName(order.shipState)} (State code {gstCode(order.shipState)})</Text>
            <Text style={[s.muted, { marginTop: 4 }]}>{intra ? "Intra-state supply: CGST + SGST" : "Inter-state supply: IGST"}</Text>
          </View>
        </View>

        <View style={s.row}>{cols.map((c) => <Text key={c.k} style={[s.th, { width: c.w }, c.k !== "Description" && c.k !== "#" ? s.right : {}]}>{c.k}</Text>)}</View>
        {order.items.map((it, i) => {
          const gross = it.lineTotal;
          const share = shares[i];
          const { taxable, tax } = splitInclusive(gross - share, Number(it.gstRatePct));
          return (
            <View key={it.id} style={s.row} wrap={false}>
              <Text style={[s.td, { width: "4%" }]}>{i + 1}</Text>
              <Text style={[s.td, { width: "34%" }]}>{it.brandName} {it.modelName}{"\n"}<Text style={s.muted}>Ref. {it.reference} · SKU {it.sku} · GST {Number(it.gstRatePct)}%</Text></Text>
              <Text style={[s.td, s.right, { width: "8%" }]}>{it.hsnCode}</Text>
              <Text style={[s.td, s.right, { width: "6%" }]}>{it.quantity}</Text>
              <Text style={[s.td, s.right, { width: "12%" }]}>{rs(it.unitPrice)}</Text>
              <Text style={[s.td, s.right, { width: "12%" }]}>{rs(taxable)}</Text>
              <Text style={[s.td, s.right, { width: "12%" }]}>{rs(tax)}</Text>
              <Text style={[s.td, s.right, { width: "12%" }]}>{rs(gross - share)}</Text>
            </View>
          );
        })}
        {charges.map((c) => {
          const { taxable, tax } = splitInclusive(c.amount, 18);
          return (
            <View key={c.label} style={s.row}>
              <Text style={[s.td, { width: "4%" }]} />
              <Text style={[s.td, { width: "34%" }]}>{c.label} (SAC 996812, GST 18%)</Text>
              <Text style={[s.td, { width: "26%" }]} />
              <Text style={[s.td, s.right, { width: "12%" }]}>{rs(taxable)}</Text>
              <Text style={[s.td, s.right, { width: "12%" }]}>{rs(tax)}</Text>
              <Text style={[s.td, s.right, { width: "12%" }]}>{rs(c.amount)}</Text>
            </View>
          );
        })}

        <View style={[s.row, { justifyContent: "flex-end", marginTop: 12 }]}>
          <View style={{ width: "45%" }}>
            {[
              ["Total MRP", rs(order.mrpTotal)],
              ["Boutique discount", `- ${rs(order.mrpTotal - order.itemsTotal)}`],
              ...(order.couponDiscount ? [[`Coupon ${order.couponCode ?? ""}`, `- ${rs(order.couponDiscount)}`]] : []),
              ["Taxable value", rs(order.taxableValue)],
              ...(intra ? [["CGST", rs(order.cgst)], ["SGST", rs(order.sgst)]] : [["IGST", rs(order.igst)]]),
            ].map(([k, v]) => (
              <View key={k} style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}><Text style={s.muted}>{k}</Text><Text>{v}</Text></View>
            ))}
            <View style={[s.row, { justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#1C1917", marginTop: 4, paddingTop: 4 }]}>
              <Text style={s.h}>Grand total</Text><Text style={s.h}>{rs(order.grandTotal)}</Text>
            </View>
          </View>
        </View>
        <Text style={{ marginTop: 8 }}>Amount in words: {rupeesInWords(order.grandTotal)}</Text>
        <Text style={[s.muted, { marginTop: 24 }]}>All prices are inclusive of GST. This is a computer-generated invoice and does not require a signature. Whether tax is payable under reverse charge: No.</Text>
      </Page>
    </Document>
  );
}

function PackingSlipDoc({ order, settings }: { order: Order; settings: StoreConfig }) {
  return (
    <Document title={`Packing slip ${order.orderNumber}`}>
      <Page size="A5" style={s.page}>
        <Text style={s.brand}>{settings.storeName.toUpperCase()}</Text>
        <Text style={[s.h, { marginTop: 12 }]}>PACKING SLIP · {order.orderNumber}</Text>
        <Text style={s.muted}>{order.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} · Prepaid (UPI) · {order.deliveryOption}</Text>
        <View style={[s.box, { marginVertical: 12 }]}>
          <Text style={s.h}>Ship to</Text>
          <Text>{order.shipName} · +91 {order.shipPhone}</Text>
          <Text>{order.shipLine1}{order.shipLine2 ? `, ${order.shipLine2}` : ""}{order.shipLandmark ? `, near ${order.shipLandmark}` : ""}</Text>
          <Text>{order.shipCity}, {stateName(order.shipState)} {order.shipPincode}</Text>
        </View>
        <View style={s.row}><Text style={[s.th, { width: "15%" }]}>Qty</Text><Text style={[s.th, { width: "55%" }]}>Item</Text><Text style={[s.th, { width: "30%" }]}>SKU</Text></View>
        {order.items.map((it) => (
          <View key={it.id} style={s.row}>
            <Text style={[s.td, { width: "15%" }]}>{it.quantity}</Text>
            <Text style={[s.td, { width: "55%" }]}>{it.brandName} {it.modelName} (Ref. {it.reference})</Text>
            <Text style={[s.td, { width: "30%" }]}>{it.sku}</Text>
          </View>
        ))}
        <Text style={[s.muted, { marginTop: 16 }]}>Checklist: watch · box · warranty card · papers · invoice. Insured parcel — signature required.</Text>
      </Page>
    </Document>
  );
}

export function renderInvoicePdf(order: Order, settings: StoreConfig) {
  return renderToBuffer(<InvoiceDoc order={order} settings={settings} />);
}

export function renderPackingSlipPdf(order: Order, settings: StoreConfig) {
  return renderToBuffer(<PackingSlipDoc order={order} settings={settings} />);
}
