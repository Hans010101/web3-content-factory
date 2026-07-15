export const sourceCatalog = [
  { id: "binance-market", name: "Binance 市场数据", kind: "行情 / 成交量 / K线", cost: "免费", role: "确认", access: "无需配置" },
  { id: "official-rss", name: "项目官方 RSS", kind: "官网 / 博客 / 公告", cost: "免费", role: "确认", access: "内置源可用" },
  { id: "exchange-announcements", name: "交易所官方公告", kind: "上币 / 下币 / 维护", cost: "免费", role: "确认", access: "待填官方订阅" },
  { id: "governance", name: "治理论坛", kind: "提案 / 投票 / 升级", cost: "免费", role: "发现+确认", access: "无需配置" },
  { id: "regulatory", name: "监管官方源", kind: "SEC / CFTC / 政策", cost: "免费", role: "确认", access: "内置源可用" },
  { id: "defillama", name: "DefiLlama", kind: "TVL / 收益 / 协议", cost: "基础免费", role: "确认", access: "无需配置" },
  { id: "github", name: "GitHub 项目动态", kind: "Release / Commit / Issue", cost: "免费额度", role: "确认", access: "免密可用" },
  { id: "gdelt", name: "GDELT 全球新闻", kind: "全球新闻事件", cost: "免费", role: "发现", access: "官方限频" },
  { id: "hacker-news", name: "Hacker News", kind: "科技热点", cost: "免费", role: "发现", access: "无需配置" },
  { id: "wikimedia", name: "Wikipedia Pageviews", kind: "搜索关注变化", cost: "免费", role: "发现", access: "无需配置" },
  { id: "web-reader", name: "公开网页监控", kind: "官网 / 长文 / 无 RSS 页面", cost: "免费", role: "确认", access: "待填公开 URL" },
  { id: "onchain", name: "链上 RPC / 浏览器", kind: "区块 / 交易 / 地址", cost: "免费额度", role: "确认", access: "待填 RPC" },
  { id: "coingecko", name: "CoinGecko Demo", kind: "市场价格补充", cost: "免费额度", role: "确认", access: "待填 Key" },
  { id: "youtube", name: "YouTube Data", kind: "视频热点", cost: "免费配额", role: "发现", access: "待填 Key" },
  { id: "x", name: "X 舆情增强", kind: "实时讨论 / KOL", cost: "按量", role: "发现", access: "待填 Token" },
] as const;

export type SourceCatalogItem = (typeof sourceCatalog)[number];
