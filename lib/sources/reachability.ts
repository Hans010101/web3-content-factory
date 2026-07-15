import { sourceAdapters } from "./adapters";
import type { SourceHealth } from "./types";

export interface ReachProfile {
  tier: 0 | 1 | 2;
  backends: string[];
  remediation: string;
}

const profiles: Record<string, ReachProfile> = {
  "binance-market": { tier: 0, backends: ["Binance Public REST"], remediation: "等待官方端点恢复，期间不依据缓存价格发布快讯。" },
  "official-rss": { tier: 0, backends: ["官方 RSS / Atom"], remediation: "检查订阅地址是否迁移，并保留官网人工核验。" },
  "exchange-announcements": { tier: 1, backends: ["交易所官方 RSS / Atom"], remediation: "在配置中心填写经过审核的官方订阅地址。" },
  governance: { tier: 0, backends: ["Discourse JSON API"], remediation: "检查论坛域名或延后轮询，不使用非官方镜像替代确认。" },
  regulatory: { tier: 0, backends: ["SEC RSS", "CFTC RSS"], remediation: "单一监管源异常时使用另一官方源，并等待交叉确认。" },
  defillama: { tier: 0, backends: ["DefiLlama Public API"], remediation: "降低轮询频率，异常期间用链上与项目官方数据确认。" },
  github: { tier: 0, backends: ["GitHub REST（认证）", "GitHub REST（匿名回退）"], remediation: "Token 异常时自动降级匿名只读；频控后等待配额恢复。" },
  gdelt: { tier: 0, backends: ["GDELT DOC 2.0"], remediation: "至少间隔五秒，使用五分钟级轮询并缓存结果。" },
  "hacker-news": { tier: 0, backends: ["Hacker News Firebase API"], remediation: "延后采集；该来源只做发现，不影响事实确认。" },
  wikimedia: { tier: 0, backends: ["Wikimedia Analytics API"], remediation: "使用最近完整日数据，避免把当天不完整数据误判为降温。" },
  "web-reader": { tier: 1, backends: ["Jina Reader", "原网页直读回退"], remediation: "检查监控 URL 是否公开可访问；动态登录页应改用官方 RSS/API。" },
  onchain: { tier: 1, backends: ["用户 EVM RPC"], remediation: "更换 RPC 节点或检查额度；不要把单节点异常当成链上事件。" },
  coingecko: { tier: 1, backends: ["CoinGecko Demo API"], remediation: "检查 Demo Key 与配额，核心价格仍以交易所公开行情为准。" },
  youtube: { tier: 1, backends: ["YouTube Data API"], remediation: "检查 API Key 与每日配额，视频热点只作发现信号。" },
  x: { tier: 2, backends: ["X Recent Search API"], remediation: "检查 Bearer Token、套餐和查询语法；不使用主账号 Cookie 绕过 API。" },
};

export interface SourceDiagnostic extends SourceHealth, ReachProfile {
  id: string;
  name: string;
  category: string;
  costTier: "free" | "freemium" | "paid";
  requiresConfig: string[];
  activeBackend: string | null;
}

const runtime = globalThis as typeof globalThis & { __sourceDoctorCache?: { expiresAt: number; results: SourceDiagnostic[] } };

export async function runSourceDoctor(force = false) {
  const cached = runtime.__sourceDoctorCache;
  if (!force && cached && cached.expiresAt > Date.now()) return { results: cached.results, cached: true };
  const adapters = sourceAdapters.filter((adapter) => adapter.id !== "mock");
  const results = await Promise.all(adapters.map(async (adapter): Promise<SourceDiagnostic> => {
    const profile = profiles[adapter.id] ?? { tier: adapter.requiresConfig.length ? 1 as const : 0 as const, backends: [adapter.name], remediation: "检查官方服务状态与本地配置。" };
    try {
      const result = await adapter.healthcheck();
      const activeBackend = adapter.id === "github" && (result.status === "live" || result.status === "degraded") ? "GitHub REST（匿名回退）" : result.status === "live" || result.status === "degraded" ? profile.backends[0] : null;
      return { id: adapter.id, name: adapter.name, category: adapter.category, costTier: adapter.costTier, requiresConfig: adapter.requiresConfig, ...profile, ...result, activeBackend };
    } catch (error) {
      return { id: adapter.id, name: adapter.name, category: adapter.category, costTier: adapter.costTier, requiresConfig: adapter.requiresConfig, ...profile, ok: false, status: "unavailable", detail: error instanceof Error ? `体检异常：${error.message}` : "体检异常", checkedAt: new Date().toISOString(), activeBackend: null };
    }
  }));
  runtime.__sourceDoctorCache = { expiresAt: Date.now() + 60_000, results };
  return { results, cached: false };
}
