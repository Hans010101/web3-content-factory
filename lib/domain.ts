export type EventCategory = "breaking" | "market" | "onchain" | "security" | "regulation" | "project" | "macro";
export type EventStatus = "candidate" | "verified" | "developing" | "closed" | "rejected";
export type DraftStatus = "draft" | "review" | "approved" | "queued" | "published" | "rejected";
export type DraftFormat = "flash" | "brief" | "analysis" | "thread";

export interface IntelEvent {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: EventCategory;
  status: EventStatus;
  confidence: number;
  heatScore: number;
  velocityScore: number;
  marketScore: number;
  trustScore: number;
  crossSourceScore: number;
  relevanceScore: number;
  noveltyScore: number;
  symbols: string[];
  tags: string[];
  facts: string[];
  unknowns: string[];
  marketSnapshot: Record<string, string | number>;
  firstSeenAt: string;
  occurredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceItem {
  id: string;
  eventId: string;
  sourceId: string | null;
  sourceName: string;
  kind: "article" | "post" | "announcement" | "market" | "onchain" | "document" | "screenshot";
  title: string;
  url?: string;
  author?: string;
  excerpt: string;
  publishedAt?: string;
  capturedAt: string;
  trustScore: number;
  isPrimary: boolean;
}

export interface MatrixAccount {
  id: string;
  name: string;
  platform: "binance_square" | "x" | "other";
  specialty: string;
  tone: string;
  topicRules: string[];
  minConfidence: number;
  dailyLimit: number;
  enabled: boolean;
}

export interface ContentDraft {
  id: string;
  eventId: string;
  accountId: string | null;
  format: DraftFormat;
  status: DraftStatus;
  headline: string;
  body: string;
  disclosure?: string;
  angle: string;
  sourceCitationIds: string[];
  version: number;
  generatedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicationJob {
  id: string;
  draftId: string;
  accountId: string;
  status: "queued" | "processing" | "published" | "failed" | "cancelled";
  scheduledAt: string;
  attempts: number;
  idempotencyKey: string;
  platformPostId?: string;
  platformUrl?: string;
  lastError?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HotnessSignals {
  velocity: number;
  marketAnomaly: number;
  sourceTrust: number;
  crossSource: number;
  assetRelevance: number;
  novelty: number;
}
