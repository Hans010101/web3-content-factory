import { apiError, json } from "@/lib/http";
import { getEventDetail } from "@/lib/store";

export const runtime = "edge";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const detail = getEventDetail(id);
  return detail ? json(detail) : apiError("事件不存在", 404);
}
