import { generateWithUserModel, type GenerationInput } from "@/lib/ai/generate";
import { getRequestUser } from "@/lib/auth/user";
import { apiError, json, readJson } from "@/lib/http";

export const runtime = "edge";

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return apiError("需要登录后才能使用个人模型", 401);
  const input = await readJson<GenerationInput>(request);
  if (!input.title || !input.summary) return apiError("标题与摘要不能为空");
  try { return json(await generateWithUserModel(user.id, input)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    if (message === "NO_ACTIVE_MODEL" || message === "MODEL_NOT_CONFIGURED") return apiError("尚未配置并启用内容生成模型", 409);
    return apiError(message, 502);
  }
}
