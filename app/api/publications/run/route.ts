import { apiError, json, readJson } from "@/lib/http";
import { runPublicationJobs } from "@/lib/store";

export const runtime = "edge";

export async function POST(request: Request) {
  const input = await readJson<{ limit?: number; now?: string }>(request);
  if (input.now && Number.isNaN(Date.parse(input.now))) return apiError("now 必须是 ISO 时间");
  return json(await runPublicationJobs(input));
}
