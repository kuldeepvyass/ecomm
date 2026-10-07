/**
 * Ready-made local test accounts. They only exist in dev/test databases (seeded) and the
 * password-less quick sign-in is refused in production unless ALLOW_TEST_LOGIN=1 is set explicitly.
 */
export const TEST_ACCOUNTS = [
  { email: "customer@maison.test", name: "Test Customer", role: "CUSTOMER" as const, label: "Test customer", hint: "Shop, check out, pay by UPI, track orders" },
  { email: "admin@maison.test", name: "Test Admin", role: "ADMIN" as const, label: "Test admin", hint: "Confirm payments, manage products, import CSV" },
];

export function testLoginEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_LOGIN === "1";
}
