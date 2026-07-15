import type { IntelEvent, MatrixAccount } from "./domain";

const CATEGORY_KEYWORDS: Record<IntelEvent["category"], string[]> = {
  breaking: ["breaking", "快讯", "公告"],
  market: ["market", "btc", "eth", "price", "etf", "市场", "宏观"],
  macro: ["macro", "etf", "fed", "监管", "宏观"],
  onchain: ["onchain", "whale", "exchange-flow", "链上", "巨鲸"],
  security: ["security", "exploit", "hack", "安全", "攻击"],
  regulation: ["regulation", "policy", "sec", "监管", "政策"],
  project: ["project", "protocol", "upgrade", "项目", "协议"],
};

export interface RouteDecision {
  accountId: string;
  accountName: string;
  score: number;
  reasons: string[];
  recommended: boolean;
}

export function routeEvent(event: IntelEvent, accounts: MatrixAccount[]): RouteDecision[] {
  const eventTokens = new Set([
    event.category,
    ...CATEGORY_KEYWORDS[event.category],
    ...event.tags.map((tag) => tag.toLowerCase()),
    ...event.symbols.map((symbol) => symbol.toLowerCase()),
  ]);

  return accounts
    .filter((account) => account.enabled && event.confidence >= account.minConfidence)
    .map((account) => {
      const matches = account.topicRules.filter((rule) => eventTokens.has(rule.toLowerCase()));
      const specialtyMatch = eventTokens.has(account.specialty.toLowerCase());
      const score = Math.min(100, 45 + matches.length * 15 + (specialtyMatch ? 20 : 0) + event.relevanceScore * 0.2);
      const reasons = matches.length ? [`匹配领域：${matches.join("、")}`] : ["满足可信度门槛"];
      if (specialtyMatch) reasons.push("与账号主定位一致");
      return { accountId: account.id, accountName: account.name, score: Math.round(score), reasons, recommended: score >= 65 };
    })
    .sort((a, b) => b.score - a.score);
}
