import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

const gold = "#785B28";
const ink = "#1C1917";
const muted = "#57534E";

export function EmailLayout({ preview, children, storeName = "Maison Horlogère", siteUrl }: {
  preview: string;
  children?: ReactNode;
  storeName?: string;
  siteUrl: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#FAF7F2", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: "#FFFFFF", maxWidth: 560, padding: "40px 32px", border: "1px solid #E7E2D9" }}>
          <Text style={{ fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: "0.18em", textAlign: "center", color: ink, margin: 0 }}>
            {storeName.toUpperCase()}
          </Text>
          <Hr style={{ borderColor: gold, width: 48, margin: "16px auto 32px" }} />
          {children}
          <Hr style={{ borderColor: "#E7E2D9", margin: "40px 0 16px" }} />
          <Section>
            <Text style={{ color: muted, fontSize: 12, lineHeight: "18px", textAlign: "center", margin: 0 }}>
              Authenticity guaranteed · Insured shipping · Secure payments
              <br />
              <Link href={siteUrl} style={{ color: gold }}>{siteUrl.replace(/^https?:\/\//, "")}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  h1: { fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 400, color: ink, margin: "0 0 16px" },
  p: { fontSize: 15, lineHeight: "24px", color: ink, margin: "0 0 16px" },
  muted: { fontSize: 13, lineHeight: "20px", color: muted, margin: "0 0 12px" },
  button: {
    backgroundColor: ink, color: "#FFFFFF", padding: "14px 28px", fontSize: 13, letterSpacing: "0.16em",
    textDecoration: "none", display: "inline-block",
  },
  gold,
};
