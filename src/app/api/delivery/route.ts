import type { NextRequest } from "next/server";
import { estimateDelivery } from "@/server/delivery";
import { getSettings } from "@/server/settings";

export async function GET(req: NextRequest) {
  const pin = (req.nextUrl.searchParams.get("pin") ?? "").trim();
  const settings = await getSettings();
  const est = await estimateDelivery(pin, settings.defaultDeliveryDays);
  return Response.json(est, { status: est.ok ? 200 : 400 });
}
