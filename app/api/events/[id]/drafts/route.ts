import type { ContentDraft } from "@/lib/domain";
import { apiError, json, readJson } from "@/lib/http";
import { createDraft } from "@/lib/store";

export const runtime = "edge";

interface GenerateDraftInput {
  accountId?: string;
  format?: ContentDraft["format"];
  angle?: string;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const input = await readJson<GenerateDraftInput>(request);
  if (input.format && !["flash", "brief", "analysis", "thread"].includes(input.format)) return apiError("不支持的内容格式");
  const draft = createDraft(id, input);
  return draft ? json({ draft }, { status: 201 }) : apiError("事件不存在", 404);
}
