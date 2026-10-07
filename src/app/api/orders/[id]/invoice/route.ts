import { auth } from "@/auth";
import { db } from "@/lib/db";
import { renderInvoicePdf, renderPackingSlipPdf } from "@/server/documents/invoice";
import { readSettings } from "@/server/settings";

export const runtime = "nodejs";

/** GET → GST invoice PDF (owner or admin). ?type=packing → packing slip (admin only). */
export async function GET(req: Request, ctx: RouteContext<"/api/orders/[id]/invoice">) {
  const session = await auth();
  if (!session?.user) return new Response("Sign in required", { status: 401 });
  const { id } = await ctx.params;
  const isAdmin = session.user.role === "ADMIN";
  const order = await db.order.findFirst({
    where: { id, ...(isAdmin ? {} : { userId: session.user.id }) },
    include: { items: true, user: { select: { email: true } }, payments: { select: { utr: true, status: true } } },
  });
  if (!order) return new Response("Not found", { status: 404 });
  const packing = new URL(req.url).searchParams.get("type") === "packing";
  if (packing && !isAdmin) return new Response("Forbidden", { status: 403 });
  if (!packing && !order.invoiceNumber) return new Response("Invoice not yet issued", { status: 409 });

  const settings = await readSettings();
  const pdf = packing ? await renderPackingSlipPdf(order, settings) : await renderInvoicePdf(order, settings);
  const name = packing ? `packing-slip-${order.orderNumber}.pdf` : `invoice-${order.invoiceNumber!.replace(/\//g, "-")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"`, "Cache-Control": "private, no-store" },
  });
}
