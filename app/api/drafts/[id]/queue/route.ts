import { apiError, json, readJson } from "@/lib/http";
import { queueDraft } from "@/lib/store";

export const runtime = "edge";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const input = await readJson<{ accountId?: string; scheduledAt?: string }>(request);
  if (input.scheduledAt && Number.isNaN(Date.parse(input.scheduledAt))) return apiError("scheduledAt 必须是 ISO 时间");
  const job = queueDraft(id, input);
  return job ? json({ job }, { status: 201 }) : apiError("草稿未审批，或未指定有效账号", 409);
}
