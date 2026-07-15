import { apiError, json, readJson } from "@/lib/http";
import { approveDraft } from "@/lib/store";

export const runtime = "edge";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const input = await readJson<{ actor?: string }>(request);
  const draft = approveDraft(id, input.actor || "editor");
  return draft ? json({ draft }) : apiError("草稿不存在", 404);
}
