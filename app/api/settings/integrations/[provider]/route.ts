import { getRequestUser } from "@/lib/auth/user";
import { apiError, json, readJson } from "@/lib/http";
import { deleteIntegration, saveIntegration } from "@/lib/settings/store";

export const runtime = "edge";
type Context = { params: Promise<{ provider: string }> };

export async function PUT(request: Request, context: Context) {
  const user = await getRequestUser(request);
  if (!user) return apiError("需要登录后才能保存个人配置", 401);
  const { provider } = await context.params;
  const input = await readJson<{ config?: Record<string, unknown>; secrets?: Record<string, string>; enabled?: boolean }>(request);
  try { return json({ integration: await saveIntegration(user.id, provider, input) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "保存失败"); }
}

export async function DELETE(request: Request, context: Context) {
  const user = await getRequestUser(request);
  if (!user) return apiError("需要登录后才能删除个人配置", 401);
  const { provider } = await context.params;
  await deleteIntegration(user.id, provider);
  return json({ ok: true });
}
