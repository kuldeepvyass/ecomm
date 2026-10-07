export const PRIMARY_NAV = [
  { href: "/watches", label: "All Watches" },
  { href: "/watches?gender=MEN", label: "Men" },
  { href: "/watches?gender=WOMEN", label: "Women" },
  { href: "/collections", label: "Collections" },
  { href: "/brands", label: "Maisons" },
] as const;

export const SERVICE_LINKS = [
  { href: "/about", label: "Our Story" },
  { href: "/authenticity", label: "Authenticity Guarantee" },
  { href: "/shipping-policy", label: "Shipping" },
  { href: "/refund-policy", label: "Returns & Refunds" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;

export const LEGAL_LINKS = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
] as const;
