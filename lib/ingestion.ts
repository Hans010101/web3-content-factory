import type { IntelEvent } from "./domain";
import { calculateHotness } from "./scoring";
import { getSourceAdapter } from "./sources/adapters";
import type { SourceContext } from "./sources/types";
import { getStore } from "./store";

export interface CollectionRequest {
  adapters?: string[];
  topics?: string[];
  since?: string;
  limitPerAdapter?: number;
  configs?: Record<string, Record<string, unknown>>;
}

export async function collectAndIngest(request: CollectionRequest) {
  const ids = request.adapters?.length ? request.adapters : ["mock"];
  const store = getStore();
  const results: Array<{ adapter: string; collected: number; inserted: number; skipped: number; errors: string[] }> = [];

  for (const id of ids) {
    const adapter = getSourceAdapter(id);
    if (!adapter) { results.push({ adapter: id, collected: 0, inserted: 0, skipped: 0, errors: ["未知适配器"] }); continue; }
    const context: SourceContext = {
      since: request.since ?? new Date(Date.now() - 6 * 3_600_000).toISOString(),
      limit: Math.min(100, Math.max(1, request.limitPerAdapter ?? 20)), topics: request.topics, config: request.configs?.[id],
    };
    try {
      const signals = await adapter.collect(context);
      let inserted = 0; let skipped = 0;
      for (const signal of signals) {
        const safeExternalId = signal.externalId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
        const eventId = `evt-${id}-${safeExternalId}`;
        if (store.events.some((event) => event.id === eventId)) { skipped += 1; continue; }
        const timestamp = new Date().toISOString();
        const trust = signal.evidence.trustScore;
        const marketAnomaly = signal.category === "market" ? 82 : 55;
        const signalsScore = { velocity: 68, marketAnomaly, sourceTrust: trust, crossSource: 45, assetRelevance: signal.symbols.length ? 82 : 55, novelty: 78 };
        const event: IntelEvent = {
          id: eventId, slug: eventId.slice(4), title: signal.title, summary: signal.summary, category: signal.category,
          status: trust >= 90 ? "verified" : "candidate", confidence: Math.round(trust * 0.7 + 20), heatScore: calculateHotness(signalsScore),
          velocityScore: signalsScore.velocity, marketScore: signalsScore.marketAnomaly, trustScore: trust, crossSourceScore: signalsScore.crossSource,
          relevanceScore: signalsScore.assetRelevance, noveltyScore: signalsScore.novelty, symbols: signal.symbols, tags: signal.tags,
          facts: [signal.summary], unknowns: ["等待更多独立来源交叉确认"], marketSnapshot: {}, firstSeenAt: timestamp,
          occurredAt: signal.publishedAt, createdAt: timestamp, updatedAt: timestamp,
        };
        store.events.unshift(event);
        store.evidence.unshift({ id: crypto.randomUUID(), eventId, sourceId: null, capturedAt: timestamp, ...signal.evidence });
        inserted += 1;
      }
      results.push({ adapter: id, collected: signals.length, inserted, skipped, errors: [] });
    } catch (error) {
      results.push({ adapter: id, collected: 0, inserted: 0, skipped: 0, errors: [error instanceof Error ? error.message : "采集失败"] });
    }
  }
  return { results, totalInserted: results.reduce((sum, item) => sum + item.inserted, 0) };
}
