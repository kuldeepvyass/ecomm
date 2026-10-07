import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles as s } from "./layout";

export function SignInEmail({ code, url, siteUrl }: { code: string; url: string; siteUrl: string }) {
  return (
    <EmailLayout preview={`Your sign-in code is ${code}`} siteUrl={siteUrl}>
      <Text style={s.h1}>Your sign-in code</Text>
      <Text style={s.p}>Enter this code to continue. It expires in 10 minutes.</Text>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Text data-otp={code} style={{ fontFamily: "Courier, monospace", fontSize: 34, letterSpacing: "0.4em", color: s.gold, margin: 0 }}>
          {code}
        </Text>
      </Section>
      <Text style={s.p}>Or sign in with one tap:</Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={url} style={s.button}>SIGN IN</Button>
      </Section>
      <Text style={s.muted}>If you didn&apos;t request this, you can safely ignore this email.</Text>
    </EmailLayout>
  );
}
