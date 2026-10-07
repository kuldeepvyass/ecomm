import { ImageResponse } from "next/og";

export const alt = "Maison Horlogère — Fine Watches, India";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0b0a09", color: "#f5f1ea" }}>
        <div style={{ width: 120, height: 120, borderRadius: 60, border: "2px solid #c9a96e", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9a96e", fontSize: 64, fontFamily: "serif" }}>M</div>
        <div style={{ marginTop: 40, fontSize: 72, letterSpacing: 18, fontFamily: "serif" }}>MAISON</div>
        <div style={{ marginTop: 8, fontSize: 24, letterSpacing: 16, color: "#a39e95" }}>HORLOGÈRE</div>
        <div style={{ marginTop: 48, width: 160, height: 2, background: "#c9a96e" }} />
        <div style={{ marginTop: 36, fontSize: 28, color: "#d8d2c8" }}>Fine watches · Authenticity guaranteed · Insured delivery across India</div>
      </div>
    ),
    size,
  );
}
