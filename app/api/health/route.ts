import { json } from "@/lib/http";
import { getRequestUser } from "@/lib/auth/user";
import { listIntegrationStates } from "@/lib/settings/store";
import { runSourceDoctor } from "@/lib/sources/reachability";

export const runtime = "edge";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  const configured = new Set(user ? (await listIntegrationStates(user.id)).filter((item) => item.enabled).map((item) => item.provider) : []);
  const doctor = await runSourceDoctor(new URL(request.url).searchParams.get("fresh") === "1");
  const adapters = doctor.results.map((adapter) => ({ ...adapter, configured: configured.has(adapter.id) }));
  const operational = adapters.filter((item) => item.status === "live").length;
  return json({ ok: operational > 0 && adapters.every((item) => item.status !== "unavailable" || item.requiresConfig.length > 0), service: "web3-content-factory", checkedAt: new Date().toISOString(), cached: doctor.cached, summary: { total: adapters.length, operational, needsConfig: adapters.filter((item) => item.status === "needs_config").length, degraded: adapters.filter((item) => item.status === "degraded").length, unavailable: adapters.filter((item) => item.status === "unavailable").length, routed: adapters.filter((item) => item.backends.length > 1).length }, adapters }, { headers: { "cache-control": "no-store" } });
}
