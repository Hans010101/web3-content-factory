import { getRequestUser } from "@/lib/auth/user";
import { apiError, json } from "@/lib/http";
import { testIntegration } from "@/lib/settings/test-integration";

export const runtime = "edge";
type Context = { params: Promise<{ provider: string }> };

export async function POST(request: Request, context: Context) {
  const user = await getRequestUser(request);
  if (!user) return apiError("需要登录后才能测试个人配置", 401);
  const { provider } = await context.params;
  try { return json(await testIntegration(user.id, provider)); }
  catch (error) { return apiError(error instanceof Error ? error.message : "连通性测试失败", 422); }
}
