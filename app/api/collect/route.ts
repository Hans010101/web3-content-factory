import { collectAndIngest, type CollectionRequest } from "@/lib/ingestion";
import { getRequestUser } from "@/lib/auth/user";
import { apiError, json, readJson } from "@/lib/http";
import { sourceConfigsForUser } from "@/lib/settings/store";

export const runtime = "edge";

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return apiError("需要登录后才能使用个人数据源", 401);
  const input = await readJson<CollectionRequest>(request);
  if (input.since && Number.isNaN(Date.parse(input.since))) return apiError("since 必须是 ISO 时间");
  const ids = input.adapters?.length ? input.adapters : ["mock"];
  const savedConfigs = await sourceConfigsForUser(user.id, ids);
  const result = await collectAndIngest({ ...input, configs: Object.fromEntries(ids.map((id) => [id, { ...(input.configs?.[id] ?? {}), ...(savedConfigs[id] ?? {}) }])) });
  return json(result, { status: 201 });
}
