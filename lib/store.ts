import type { ContentDraft, EvidenceItem, IntelEvent, MatrixAccount, PublicationJob } from "./domain";
import { routeEvent } from "./routing";
import { MockBinanceSquarePublisher } from "./publishing/mock";
import { sourceCatalog } from "./sources/catalog";

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

interface AppStore {
  events: IntelEvent[];
  evidence: EvidenceItem[];
  accounts: MatrixAccount[];
  drafts: ContentDraft[];
  jobs: PublicationJob[];
  audit: AuditEntry[];
}

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

const seedEvents: IntelEvent[] = [
  {
    id: "evt-btc-etf-flow",
    slug: "btc-etf-inflow-accelerates",
    title: "比特币现货 ETF 单日净流入显著放大",
    summary: "多只美国现货 ETF 同步录得资金流入，BTC 成交量与价格在一小时内放大，事件仍在发展。",
    category: "market", status: "verified", confidence: 92, heatScore: 88.6,
    velocityScore: 91, marketScore: 89, trustScore: 94, crossSourceScore: 82, relevanceScore: 96, noveltyScore: 66,
    symbols: ["BTC"], tags: ["ETF", "market", "institutional"],
    facts: ["多个独立数据源显示净流入放大", "BTC 一小时成交量高于近 7 日同时段均值"],
    unknowns: ["当日最终净流入仍需等待收盘后数据确认"],
    marketSnapshot: { price: 68420, change1h: "+2.8%", volumeRatio: "2.3x" },
    firstSeenAt: ago(18), occurredAt: ago(26), createdAt: ago(18), updatedAt: ago(4),
  },
  {
    id: "evt-protocol-outflow",
    slug: "protocol-abnormal-outflow",
    title: "DeFi 协议出现异常大额资金转移",
    summary: "链上监控发现协议金库向新地址转出大额资产，项目方表示正在调查，攻击原因尚未确认。",
    category: "security", status: "developing", confidence: 84, heatScore: 81.4,
    velocityScore: 86, marketScore: 78, trustScore: 80, crossSourceScore: 72, relevanceScore: 88, noveltyScore: 91,
    symbols: ["ETH", "DEFI"], tags: ["security", "onchain", "exploit"],
    facts: ["约 1,240 万美元资产已转入新地址", "项目方已公开确认正在调查"],
    unknowns: ["是否为攻击行为", "最终损失范围"],
    marketSnapshot: { estimatedValue: "$12.4M", tokenChange30m: "-6.2%", volumeRatio: "3.1x" },
    firstSeenAt: ago(11), occurredAt: ago(16), createdAt: ago(11), updatedAt: ago(2),
  },
  {
    id: "evt-regulation-consultation",
    slug: "asia-stablecoin-consultation",
    title: "亚洲监管机构发布稳定币监管咨询文件",
    summary: "新文件涉及储备披露、赎回机制与发行人资本要求，市场正在评估对稳定币项目的潜在影响。",
    category: "regulation", status: "verified", confidence: 96, heatScore: 72.8,
    velocityScore: 58, marketScore: 61, trustScore: 99, crossSourceScore: 88, relevanceScore: 82, noveltyScore: 76,
    symbols: ["USDT", "USDC"], tags: ["regulation", "stablecoin", "asia"],
    facts: ["监管机构官网已发布完整咨询文件", "咨询期为六周"], unknowns: ["最终规则实施时间"],
    marketSnapshot: { marketChange: "0.1%", consultationWeeks: 6 },
    firstSeenAt: ago(74), occurredAt: ago(90), createdAt: ago(74), updatedAt: ago(31),
  },
  {
    id: "evt-l2-upgrade",
    slug: "l2-mainnet-upgrade",
    title: "头部 Layer 2 公布主网升级计划",
    summary: "升级计划将改善证明效率和交易成本，官方代码仓库与治理论坛已同步发布版本说明。",
    category: "project", status: "candidate", confidence: 76, heatScore: 61.2,
    velocityScore: 63, marketScore: 52, trustScore: 85, crossSourceScore: 68, relevanceScore: 72, noveltyScore: 70,
    symbols: ["ETH", "L2"], tags: ["project", "upgrade", "github"],
    facts: ["官方仓库已创建升级版本标签"], unknowns: ["升级执行区块高度尚未最终确认"],
    marketSnapshot: { change24h: "+1.4%" }, firstSeenAt: ago(126), occurredAt: ago(140), createdAt: ago(126), updatedAt: ago(80),
  },
];

const seedEvidence: EvidenceItem[] = [
  { id: "evd-etf-1", eventId: "evt-btc-etf-flow", sourceId: "src-market", sourceName: "公开市场数据", kind: "market", title: "BTC 实时成交数据", excerpt: "一小时成交量达到近 7 日同时段均值的 2.3 倍。", capturedAt: ago(4), publishedAt: ago(4), trustScore: 92, isPrimary: true },
  { id: "evd-etf-2", eventId: "evt-btc-etf-flow", sourceId: "src-rss", sourceName: "ETF 发行方公告", kind: "announcement", title: "基金申购赎回数据", url: "https://example.com/etf-flow", excerpt: "多只产品当日申购额显著上升。", capturedAt: ago(8), publishedAt: ago(12), trustScore: 96, isPrimary: true },
  { id: "evd-sec-1", eventId: "evt-protocol-outflow", sourceId: "src-onchain", sourceName: "链上公开数据", kind: "onchain", title: "协议金库异常转账", url: "https://example.com/tx/0x123", excerpt: "多种资产从协议金库转入此前未活跃的新地址。", capturedAt: ago(9), publishedAt: ago(15), trustScore: 94, isPrimary: true },
  { id: "evd-sec-2", eventId: "evt-protocol-outflow", sourceId: "src-rss", sourceName: "项目官方频道", kind: "announcement", title: "项目方调查声明", url: "https://example.com/project-status", excerpt: "团队确认观察到异常活动，已启动调查并建议用户等待后续公告。", capturedAt: ago(5), publishedAt: ago(7), trustScore: 91, isPrimary: true },
  { id: "evd-reg-1", eventId: "evt-regulation-consultation", sourceId: "src-reg", sourceName: "监管机构官网", kind: "document", title: "稳定币监管咨询文件", url: "https://example.com/regulation", excerpt: "文件提出储备、赎回、审计及资本要求。", capturedAt: ago(70), publishedAt: ago(90), trustScore: 100, isPrimary: true },
  { id: "evd-l2-1", eventId: "evt-l2-upgrade", sourceId: "src-github", sourceName: "GitHub", kind: "announcement", title: "主网升级 Release", url: "https://github.com/example/release", excerpt: "新版本包含证明系统与费用计算改进。", capturedAt: ago(120), publishedAt: ago(140), trustScore: 88, isPrimary: true },
];

const seedAccounts: MatrixAccount[] = [
  { id: "acc-flash", name: "Web3 快讯", platform: "binance_square", specialty: "breaking", tone: "口语化、快速、克制", topicRules: ["breaking", "market", "regulation", "project"], minConfidence: 75, dailyLimit: 24, enabled: true },
  { id: "acc-market", name: "加密市场", platform: "binance_square", specialty: "market", tone: "数据驱动、专业易懂", topicRules: ["market", "macro", "ETF", "BTC", "ETH"], minConfidence: 80, dailyLimit: 16, enabled: true },
  { id: "acc-onchain", name: "链上雷达", platform: "binance_square", specialty: "onchain", tone: "严谨、证据优先", topicRules: ["onchain", "security", "whale", "exploit"], minConfidence: 82, dailyLimit: 12, enabled: true },
  { id: "acc-research", name: "项目研究", platform: "binance_square", specialty: "project", tone: "客观、结构化、深度", topicRules: ["project", "protocol", "upgrade", "regulation"], minConfidence: 85, dailyLimit: 8, enabled: true },
];

const globalStore = globalThis as typeof globalThis & { __web3IntelStore?: AppStore };

export function getStore(): AppStore {
  if (!globalStore.__web3IntelStore) {
    globalStore.__web3IntelStore = { events: [...seedEvents], evidence: [...seedEvidence], accounts: [...seedAccounts], drafts: [], jobs: [], audit: [] };
  }
  return globalStore.__web3IntelStore;
}

export function getEventDetail(id: string) {
  const store = getStore();
  const event = store.events.find((item) => item.id === id || item.slug === id);
  if (!event) return null;
  return {
    event,
    evidence: store.evidence.filter((item) => item.eventId === event.id),
    drafts: store.drafts.filter((item) => item.eventId === event.id),
    routes: routeEvent(event, store.accounts),
  };
}

export function createDraft(eventId: string, input: { accountId?: string; format?: ContentDraft["format"]; angle?: string }) {
  const store = getStore();
  const event = store.events.find((item) => item.id === eventId || item.slug === eventId);
  if (!event) return null;
  const account = input.accountId ? store.accounts.find((item) => item.id === input.accountId) : undefined;
  const evidence = store.evidence.filter((item) => item.eventId === event.id);
  const timestamp = new Date().toISOString();
  const market = Object.entries(event.marketSnapshot).map(([key, value]) => `${key}：${value}`).join("，");
  const body = [
    `刚刚，${event.title}，这件事值得关注。`,
    event.facts.length ? `目前可以确认的是：${event.facts.join("；")}。` : event.summary,
    market ? `市场与数据表现：${market}。` : "市场影响仍在观察中。",
    event.unknowns.length ? `需要注意，${event.unknowns.join("；")}仍待确认。` : "现有信息已获得多个来源确认。",
    "本文仅为信息整理，不构成投资建议。",
  ].join("\n\n");
  const draft: ContentDraft = {
    id: crypto.randomUUID(), eventId: event.id, accountId: account?.id ?? null,
    format: input.format ?? (event.heatScore >= 80 ? "flash" : "brief"), status: "review",
    headline: `【${event.category === "security" ? "风险快讯" : "Web3 快讯"}】${event.title}`,
    body, disclosure: "信息状态与来源已标注；不构成投资建议。",
    angle: input.angle ?? account?.specialty ?? event.category,
    sourceCitationIds: evidence.map((item) => item.id), version: 1, generatedBy: "structured-template-v1",
    createdAt: timestamp, updatedAt: timestamp,
  };
  store.drafts.unshift(draft);
  store.audit.unshift({ id: crypto.randomUUID(), actor: "system", action: "draft.generated", entityType: "draft", entityId: draft.id, createdAt: timestamp });
  return draft;
}

export function approveDraft(draftId: string, actor = "editor") {
  const store = getStore();
  const draft = store.drafts.find((item) => item.id === draftId);
  if (!draft) return null;
  const timestamp = new Date().toISOString();
  draft.status = "approved"; draft.approvedAt = timestamp; draft.approvedBy = actor; draft.updatedAt = timestamp;
  store.audit.unshift({ id: crypto.randomUUID(), actor, action: "draft.approved", entityType: "draft", entityId: draft.id, createdAt: timestamp });
  return draft;
}

export function queueDraft(draftId: string, input: { accountId?: string; scheduledAt?: string }) {
  const store = getStore();
  const draft = store.drafts.find((item) => item.id === draftId);
  if (!draft || (draft.status !== "approved" && draft.status !== "queued")) return null;
  const accountId = input.accountId ?? draft.accountId;
  const account = store.accounts.find((item) => item.id === accountId);
  if (!account) return null;
  const timestamp = new Date().toISOString();
  const scheduledAt = input.scheduledAt ?? timestamp;
  const idempotencyKey = `${draft.id}:${account.id}:${scheduledAt.slice(0, 16)}`;
  const existing = store.jobs.find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) return existing;
  const job: PublicationJob = { id: crypto.randomUUID(), draftId: draft.id, accountId: account.id, status: "queued", scheduledAt, attempts: 0, idempotencyKey, createdAt: timestamp, updatedAt: timestamp };
  store.jobs.unshift(job); draft.status = "queued"; draft.accountId = account.id; draft.updatedAt = timestamp;
  store.audit.unshift({ id: crypto.randomUUID(), actor: "editor", action: "publication.queued", entityType: "publication_job", entityId: job.id, createdAt: timestamp });
  return job;
}

export function getDashboard() {
  const store = getStore();
  const sorted = [...store.events].sort((a, b) => b.heatScore - a.heatScore);
  return {
    generatedAt: new Date().toISOString(),
    mode: "demo",
    metrics: {
      candidateEvents: store.events.filter((item) => item.status === "candidate" || item.status === "developing").length,
      verifiedEvents: store.events.filter((item) => item.status === "verified").length,
      reviewDrafts: store.drafts.filter((item) => item.status === "review").length,
      queuedJobs: store.jobs.filter((item) => item.status === "queued").length,
      enabledAccounts: store.accounts.filter((item) => item.enabled).length,
      averageHeat: Math.round(store.events.reduce((sum, item) => sum + item.heatScore, 0) / store.events.length),
    },
    events: sorted,
    accounts: store.accounts.map((account) => ({ ...account, queued: store.jobs.filter((job) => job.accountId === account.id && job.status === "queued").length })),
    drafts: store.drafts.slice(0, 10),
    publicationJobs: store.jobs.slice(0, 10),
    sourceHealth: sourceCatalog,
  };
}

export async function runPublicationJobs(input: { limit?: number; now?: string } = {}) {
  const store = getStore();
  const runAt = input.now ? new Date(input.now) : new Date();
  const limit = Math.min(20, Math.max(1, input.limit ?? 5));
  const publisher = new MockBinanceSquarePublisher();
  const due = store.jobs
    .filter((job) => job.status === "queued" && new Date(job.scheduledAt) <= runAt)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, limit);
  const results: Array<{ jobId: string; ok: boolean; platformUrl?: string; error?: string }> = [];

  for (const job of due) {
    const draft = store.drafts.find((item) => item.id === job.draftId);
    const account = store.accounts.find((item) => item.id === job.accountId);
    job.status = "processing";
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    if (!draft || !account) {
      job.status = "failed";
      job.lastError = "草稿或账号不存在";
      results.push({ jobId: job.id, ok: false, error: job.lastError });
      continue;
    }
    const published = await publisher.publish({ draft, account, assetUrls: [], idempotencyKey: job.idempotencyKey });
    if (published.ok) {
      const timestamp = new Date().toISOString();
      job.status = "published";
      job.platformPostId = published.platformPostId;
      job.platformUrl = published.platformUrl;
      job.publishedAt = timestamp;
      job.updatedAt = timestamp;
      draft.status = "published";
      draft.updatedAt = timestamp;
      store.audit.unshift({ id: crypto.randomUUID(), actor: "publisher:mock", action: "publication.published", entityType: "publication_job", entityId: job.id, createdAt: timestamp });
      results.push({ jobId: job.id, ok: true, platformUrl: published.platformUrl });
    } else {
      job.status = "failed";
      job.lastError = published.error ?? "发布失败";
      job.updatedAt = new Date().toISOString();
      results.push({ jobId: job.id, ok: false, error: job.lastError });
    }
  }
  return { processed: results.length, mode: "dry-run", results };
}
