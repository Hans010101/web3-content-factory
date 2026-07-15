import type { EvidenceItem, IntelEvent } from "../domain";

export interface SourceContext {
  since: string;
  limit: number;
  topics?: string[];
  config?: Record<string, unknown>;
}

export interface CollectedSignal {
  externalId: string;
  title: string;
  summary: string;
  publishedAt: string;
  url?: string;
  category: IntelEvent["category"];
  symbols: string[];
  tags: string[];
  evidence: Omit<EvidenceItem, "id" | "eventId" | "sourceId" | "capturedAt">;
  raw: Record<string, unknown>;
}

export interface SourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly costTier: "free" | "freemium" | "paid";
  readonly category: string;
  readonly requiresConfig: string[];
  healthcheck(): Promise<SourceHealth>;
  collect(context: SourceContext): Promise<CollectedSignal[]>;
}

export type SourceHealthStatus = "live" | "needs_config" | "degraded" | "unavailable";

export interface SourceHealth {
  ok: boolean;
  status: SourceHealthStatus;
  detail: string;
  latencyMs?: number;
  checkedAt: string;
}
