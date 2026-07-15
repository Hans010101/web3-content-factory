import { getRequestUser } from "@/lib/auth/user";
import { apiError, json, readJson } from "@/lib/http";
import { setActiveAi } from "@/lib/settings/store";

export const runtime = "edge";

export async function PUT(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return apiError("需要登录后才能设置默认模型", 401);
  const input = await readJson<{ provider?: string; model?: string }>(request);
  if (!input.provider || !input.model) return apiError("provider 与 model 为必填项");
  try { return json({ activeAi: await setActiveAi(user.id, input.provider, input.model) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "设置失败"); }
}
