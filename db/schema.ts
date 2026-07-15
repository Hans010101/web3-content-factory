import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["rss", "market", "social", "onchain", "regulatory", "manual", "mock"] }).notNull(),
  adapter: text("adapter").notNull(),
  endpoint: text("endpoint"),
  config: text("config", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  costTier: text("cost_tier", { enum: ["free", "freemium", "paid"] }).notNull().default("free"),
  trustScore: integer("trust_score").notNull().default(50),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastCollectedAt: text("last_collected_at"),
  ...timestamps,
}, (table) => [index("sources_kind_idx").on(table.kind), index("sources_enabled_idx").on(table.enabled)]);

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  category: text("category", { enum: ["breaking", "market", "onchain", "security", "regulation", "project", "macro"] }).notNull(),
  status: text("status", { enum: ["candidate", "verified", "developing", "closed", "rejected"] }).notNull().default("candidate"),
  confidence: integer("confidence").notNull().default(0),
  heatScore: real("heat_score").notNull().default(0),
  velocityScore: real("velocity_score").notNull().default(0),
  marketScore: real("market_score").notNull().default(0),
  trustScore: real("trust_score").notNull().default(0),
  crossSourceScore: real("cross_source_score").notNull().default(0),
  relevanceScore: real("relevance_score").notNull().default(0),
  noveltyScore: real("novelty_score").notNull().default(0),
  symbols: text("symbols", { mode: "json" }).$type<string[]>().notNull().default([]),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  facts: text("facts", { mode: "json" }).$type<string[]>().notNull().default([]),
  unknowns: text("unknowns", { mode: "json" }).$type<string[]>().notNull().default([]),
  marketSnapshot: text("market_snapshot", { mode: "json" }).$type<Record<string, number | string>>().notNull().default({}),
  firstSeenAt: text("first_seen_at").notNull(),
  occurredAt: text("occurred_at"),
  ...timestamps,
}, (table) => [
  uniqueIndex("events_slug_idx").on(table.slug),
  index("events_heat_idx").on(table.heatScore),
  index("events_status_idx").on(table.status),
  index("events_category_idx").on(table.category),
]);

export const evidence = sqliteTable("evidence", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["article", "post", "announcement", "market", "onchain", "document", "screenshot"] }).notNull(),
  title: text("title").notNull(),
  url: text("url"),
  author: text("author"),
  excerpt: text("excerpt").notNull(),
  publishedAt: text("published_at"),
  capturedAt: text("captured_at").notNull(),
  contentHash: text("content_hash"),
  trustScore: integer("trust_score").notNull().default(50),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  raw: text("raw", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
}, (table) => [index("evidence_event_idx").on(table.eventId), index("evidence_source_idx").on(table.sourceId)]);

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform", { enum: ["binance_square", "x", "other"] }).notNull().default("binance_square"),
  specialty: text("specialty").notNull(),
  tone: text("tone").notNull(),
  topicRules: text("topic_rules", { mode: "json" }).$type<string[]>().notNull().default([]),
  minConfidence: integer("min_confidence").notNull().default(75),
  dailyLimit: integer("daily_limit").notNull().default(20),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  credentialsRef: text("credentials_ref"),
  ...timestamps,
}, (table) => [index("accounts_platform_idx").on(table.platform), index("accounts_enabled_idx").on(table.enabled)]);

export const contentDrafts = sqliteTable("content_drafts", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  format: text("format", { enum: ["flash", "brief", "analysis", "thread"] }).notNull(),
  status: text("status", { enum: ["draft", "review", "approved", "queued", "published", "rejected"] }).notNull().default("draft"),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  disclosure: text("disclosure"),
  angle: text("angle").notNull(),
  sourceCitationIds: text("source_citation_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
  version: integer("version").notNull().default(1),
  generatedBy: text("generated_by").notNull().default("template-v1"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  ...timestamps,
}, (table) => [index("drafts_event_idx").on(table.eventId), index("drafts_status_idx").on(table.status)]);

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }),
  draftId: text("draft_id").references(() => contentDrafts.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["evidence_capture", "info_card", "market_chart", "cover", "video"] }).notNull(),
  status: text("status", { enum: ["planned", "rendering", "ready", "failed"] }).notNull().default("planned"),
  url: text("url"),
  storageKey: text("storage_key"),
  altText: text("alt_text").notNull(),
  width: integer("width"),
  height: integer("height"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
}, (table) => [index("assets_event_idx").on(table.eventId), index("assets_draft_idx").on(table.draftId)]);

export const publicationJobs = sqliteTable("publication_jobs", {
  id: text("id").primaryKey(),
  draftId: text("draft_id").notNull().references(() => contentDrafts.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["queued", "processing", "published", "failed", "cancelled"] }).notNull().default("queued"),
  scheduledAt: text("scheduled_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  idempotencyKey: text("idempotency_key").notNull(),
  platformPostId: text("platform_post_id"),
  platformUrl: text("platform_url"),
  lastError: text("last_error"),
  publishedAt: text("published_at"),
  ...timestamps,
}, (table) => [uniqueIndex("publication_idempotency_idx").on(table.idempotencyKey), index("publication_status_schedule_idx").on(table.status, table.scheduledAt)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  before: text("before", { mode: "json" }).$type<Record<string, unknown> | null>(),
  after: text("after", { mode: "json" }).$type<Record<string, unknown> | null>(),
  requestId: text("request_id"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("audit_entity_idx").on(table.entityType, table.entityId), index("audit_created_idx").on(table.createdAt)]);

export const userIntegrations = sqliteTable("user_integrations", {
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  category: text("category", { enum: ["ai", "data", "publishing"] }).notNull(),
  config: text("config_json", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  secretCiphertext: text("secret_ciphertext").notNull(),
  secretIv: text("secret_iv").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [uniqueIndex("user_integrations_owner_provider_idx").on(table.userId, table.provider), index("user_integrations_owner_idx").on(table.userId)]);

export const userAiPreferences = sqliteTable("user_ai_preferences", {
  userId: text("user_id").primaryKey(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type SourceRow = typeof sources.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type EvidenceRow = typeof evidence.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type DraftRow = typeof contentDrafts.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
export type PublicationJobRow = typeof publicationJobs.$inferSelect;
export type UserIntegrationRow = typeof userIntegrations.$inferSelect;
