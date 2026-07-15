import { getRequestUser } from "@/lib/auth/user";
import { apiError, json } from "@/lib/http";
import { integrationCatalog } from "@/lib/settings/catalog";
import { getActiveAi, listIntegrationStates } from "@/lib/settings/store";

export const runtime = "edge";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return apiError("需要登录后才能读取个人配置", 401);
  return json({ user: { email: user.email, displayName: user.displayName, local: user.local }, catalog: integrationCatalog, integrations: await listIntegrationStates(user.id), activeAi: await getActiveAi(user.id) }, { headers: { "cache-control": "no-store" } });
}
