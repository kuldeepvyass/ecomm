import { Button, Column, Row, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles as s } from "./layout";

export type OrderEmailData = {
  orderNumber: string;
  customerName: string;
  status: string;
  headline: string;
  message: string;
  items: { name: string; quantity: number; lineTotal: string }[];
  total: string;
  orderUrl: string;
  tracking?: { courier: string | null; number: string | null; url: string | null } | null;
  siteUrl: string;
  storeName: string;
};

export function OrderStatusEmail(d: OrderEmailData) {
  return (
    <EmailLayout preview={`${d.headline} — order ${d.orderNumber}`} siteUrl={d.siteUrl} storeName={d.storeName}>
      <Text style={s.muted}>ORDER {d.orderNumber}</Text>
      <Text style={s.h1}>{d.headline}</Text>
      <Text style={s.p}>Dear {d.customerName},</Text>
      <Text style={s.p}>{d.message}</Text>
      {d.tracking?.number && (
        <Section style={{ border: "1px solid #E7E2D9", padding: 16, margin: "8px 0 24px" }}>
          <Text style={{ ...s.muted, margin: 0 }}>Courier</Text>
          <Text style={{ ...s.p, margin: "0 0 8px" }}>{d.tracking.courier ?? "—"} · {d.tracking.number}</Text>
          {d.tracking.url && <Button href={d.tracking.url} style={{ ...s.button, padding: "10px 18px" }}>TRACK PARCEL</Button>}
        </Section>
      )}
      <Section style={{ margin: "8px 0 24px" }}>
        {d.items.map((it, i) => (
          <Row key={i} style={{ borderBottom: "1px solid #E7E2D9" }}>
            <Column style={{ padding: "10px 0", fontSize: 14 }}>{it.name} × {it.quantity}</Column>
            <Column style={{ padding: "10px 0", fontSize: 14, textAlign: "right" }}>{it.lineTotal}</Column>
          </Row>
        ))}
        <Row>
          <Column style={{ padding: "12px 0", fontSize: 15, fontWeight: 600 }}>Total (incl. GST)</Column>
          <Column style={{ padding: "12px 0", fontSize: 15, fontWeight: 600, textAlign: "right" }}>{d.total}</Column>
        </Row>
      </Section>
      <Section style={{ textAlign: "center" }}>
        <Button href={d.orderUrl} style={s.button}>VIEW ORDER</Button>
      </Section>
    </EmailLayout>
  );
}

export function BackInStockEmail({ productName, url, siteUrl }: { productName: string; url: string; siteUrl: string }) {
  return (
    <EmailLayout preview={`${productName} is back in stock`} siteUrl={siteUrl}>
      <Text style={s.h1}>It&apos;s back.</Text>
      <Text style={s.p}>The {productName} you asked about is available again. Pieces like this rarely stay long.</Text>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button href={url} style={s.button}>VIEW THE WATCH</Button>
      </Section>
    </EmailLayout>
  );
}
