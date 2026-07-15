import { json } from "@/lib/http";
import { getDashboard } from "@/lib/store";

export const runtime = "edge";

export async function GET() {
  return json(getDashboard(), { headers: { "cache-control": "no-store" } });
}
