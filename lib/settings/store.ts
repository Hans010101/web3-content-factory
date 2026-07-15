import { getD1Binding } from "@/db";
import { decryptSecrets, encryptSecrets } from "./crypto";
import { getIntegrationDefinition } from "./catalog";

export interface StoredIntegration {
  userId: string;
  provider: string;
  category: "ai" | "data" | "publishing";
  config: Record<string, unknown>;
  secretCiphertext: string;
  secretIv: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface AiPreference { provider: string; model: string; updatedAt: string }

const globalStore = globalThis as typeof globalThis & {
  __signalForgeIntegrations?: Map<string, StoredIntegration>;
  __signalForgeAiPreferences?: Map<string, AiPreference>;
};
const integrations = globalStore.__signalForgeIntegrations ??= new Map();
const aiPreferences = globalStore.__signalForgeAiPreferences ??= new Map();
let schemaReady: Promise<void> | undefined;

async function ensureSchema() {
  const db = getD1Binding();
  if (!db) return;
  schemaReady ??= db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS user_integrations (user_id TEXT NOT NULL, provider TEXT NOT NULL, category TEXT NOT NULL, config_json TEXT NOT NULL DEFAULT '{}', secret_ciphertext TEXT NOT NULL, secret_iv TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, provider))"),
    db.prepare("CREATE INDEX IF NOT EXISTS user_integrations_owner_idx ON user_integrations (user_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS user_ai_preferences (user_id TEXT PRIMARY KEY NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, updated_at TEXT NOT NULL)"),
  ]).then(() => undefined);
  await schemaReady;
}

function parseRow(row: Record<string, unknown>): StoredIntegration {
  return { userId: String(row.user_id), provider: String(row.provider), category: row.category as StoredIntegration["category"], config: JSON.parse(String(row.config_json || "{}")), secretCiphertext: String(row.secret_ciphertext), secretIv: String(row.secret_iv), enabled: Boolean(row.enabled), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

export async function getStoredIntegration(userId: string, provider: string) {
  const db = getD1Binding();
  if (!db) return integrations.get(`${userId}:${provider}`) ?? null;
  await ensureSchema();
  const row = await db.prepare("SELECT * FROM user_integrations WHERE user_id = ? AND provider = ?").bind(userId, provider).first<Record<string, unknown>>();
  return row ? parseRow(row) : null;
}

export async function getIntegrationWithSecrets(userId: string, provider: string) {
  const item = await getStoredIntegration(userId, provider);
  if (!item) return null;
  return { ...item, secrets: await decryptSecrets(item.secretCiphertext, item.secretIv, Boolean(getD1Binding())) };
}

export async function saveIntegration(userId: string, provider: string, input: { config?: Record<string, unknown>; secrets?: Record<string, string>; enabled?: boolean }) {
  const definition = getIntegrationDefinition(provider);
  if (!definition) throw new Error("未知服务商");
  const previous = await getIntegrationWithSecrets(userId, provider);
  const secretKeys = new Set(definition.fields.filter((field) => field.secret).map((field) => field.key));
  const configKeys = new Set(definition.fields.filter((field) => !field.secret).map((field) => field.key));
  const nextSecrets = Object.fromEntries(Object.entries(input.secrets ?? {}).filter(([key, value]) => secretKeys.has(key) && Boolean(value)));
  const nextConfig = Object.fromEntries(Object.entries(input.config ?? {}).filter(([key]) => configKeys.has(key)));
  const secrets = { ...(previous?.secrets ?? {}), ...nextSecrets };
  const missing = definition.fields.filter((field) => field.required && field.secret && !secrets[field.key]).map((field) => field.label);
  const config = { ...(definition.defaultConfig ?? {}), ...(previous?.config ?? {}), ...nextConfig };
  missing.push(...definition.fields.filter((field) => field.required && !field.secret && !String(config[field.key] ?? "").trim()).map((field) => field.label));
  if (missing.length) throw new Error(`缺少必填项：${missing.join("、")}`);
  const encrypted = await encryptSecrets(secrets, Boolean(getD1Binding()));
  const now = new Date().toISOString();
  const item: StoredIntegration = { userId, provider, category: definition.category, config, secretCiphertext: encrypted.ciphertext, secretIv: encrypted.iv, enabled: input.enabled ?? previous?.enabled ?? true, createdAt: previous?.createdAt ?? now, updatedAt: now };
  const db = getD1Binding();
  if (!db) integrations.set(`${userId}:${provider}`, item);
  else {
    await ensureSchema();
    await db.prepare("INSERT INTO user_integrations (user_id, provider, category, config_json, secret_ciphertext, secret_iv, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, provider) DO UPDATE SET category=excluded.category, config_json=excluded.config_json, secret_ciphertext=excluded.secret_ciphertext, secret_iv=excluded.secret_iv, enabled=excluded.enabled, updated_at=excluded.updated_at").bind(userId, provider, definition.category, JSON.stringify(config), encrypted.ciphertext, encrypted.iv, item.enabled ? 1 : 0, item.createdAt, now).run();
  }
  return publicIntegration(item, secrets);
}

export async function deleteIntegration(userId: string, provider: string) {
  const db = getD1Binding();
  if (!db) integrations.delete(`${userId}:${provider}`);
  else { await ensureSchema(); await db.prepare("DELETE FROM user_integrations WHERE user_id = ? AND provider = ?").bind(userId, provider).run(); }
  const active = await getActiveAi(userId);
  if (active?.provider === provider) await clearActiveAi(userId);
}

function publicIntegration(item: StoredIntegration, secrets?: Record<string, string>) {
  const definition = getIntegrationDefinition(item.provider);
  const secretKeys = definition?.fields.filter((field) => field.secret).map((field) => field.key) ?? [];
  return { provider: item.provider, category: item.category, config: item.config, enabled: item.enabled, configured: true, secretStatus: Object.fromEntries(secretKeys.map((key) => [key, Boolean(secrets?.[key])])), updatedAt: item.updatedAt };
}

export async function listIntegrationStates(userId: string) {
  const db = getD1Binding();
  let rows: StoredIntegration[];
  if (!db) rows = [...integrations.values()].filter((item) => item.userId === userId);
  else { await ensureSchema(); const result = await db.prepare("SELECT * FROM user_integrations WHERE user_id = ? ORDER BY updated_at DESC").bind(userId).all<Record<string, unknown>>(); rows = result.results.map(parseRow); }
  return Promise.all(rows.map(async (item) => publicIntegration(item, await decryptSecrets(item.secretCiphertext, item.secretIv, Boolean(db)))));
}

export async function setActiveAi(userId: string, provider: string, model: string) {
  const definition = getIntegrationDefinition(provider);
  const stored = await getStoredIntegration(userId, provider);
  if (!definition || definition.category !== "ai" || !stored?.enabled) throw new Error("请先保存并启用该模型服务");
  if (!model.trim()) throw new Error("模型 ID 不能为空");
  const preference = { provider, model: model.trim(), updatedAt: new Date().toISOString() };
  const db = getD1Binding();
  if (!db) aiPreferences.set(userId, preference);
  else { await ensureSchema(); await db.prepare("INSERT INTO user_ai_preferences (user_id, provider, model, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET provider=excluded.provider, model=excluded.model, updated_at=excluded.updated_at").bind(userId, provider, preference.model, preference.updatedAt).run(); }
  return preference;
}

export async function getActiveAi(userId: string) {
  const db = getD1Binding();
  if (!db) return aiPreferences.get(userId) ?? null;
  await ensureSchema();
  const row = await db.prepare("SELECT provider, model, updated_at FROM user_ai_preferences WHERE user_id = ?").bind(userId).first<Record<string, unknown>>();
  return row ? { provider: String(row.provider), model: String(row.model), updatedAt: String(row.updated_at) } : null;
}

async function clearActiveAi(userId: string) {
  const db = getD1Binding();
  if (!db) aiPreferences.delete(userId);
  else { await ensureSchema(); await db.prepare("DELETE FROM user_ai_preferences WHERE user_id = ?").bind(userId).run(); }
}

export async function sourceConfigsForUser(userId: string, adapterIds: string[]) {
  const entries = await Promise.all(adapterIds.map(async (id) => [id, await getIntegrationWithSecrets(userId, id)] as const));
  return Object.fromEntries(entries.filter(([, item]) => item?.enabled).map(([id, item]) => {
    const config = { ...(item?.config ?? {}), ...(item?.secrets ?? {}) };
    if (id === "github" && typeof config.repos === "string") config.repos = config.repos.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (id === "exchange-announcements" && typeof config.feedUrls === "string") config.feedUrls = config.feedUrls.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (id === "web-reader" && typeof config.urls === "string") config.urls = config.urls.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 10);
    return [id, config];
  }));
}
