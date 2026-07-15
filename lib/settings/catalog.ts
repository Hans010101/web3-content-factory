export type IntegrationCategory = "ai" | "data" | "publishing";

export interface IntegrationField {
  key: string;
  label: string;
  placeholder?: string;
  kind?: "text" | "url" | "password" | "textarea";
  required?: boolean;
  secret?: boolean;
}

export interface IntegrationDefinition {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  cost: string;
  fields: IntegrationField[];
  models?: string[];
  defaultConfig?: Record<string, string>;
  testable?: boolean;
}

const squareAccounts = [
  ["binance-square-flash", "Binance Square · Web3 闪讯", "突发、公告与监管"],
  ["binance-square-market", "Binance Square · 加密市场", "行情、ETF 与宏观"],
  ["binance-square-onchain", "Binance Square · 链上雷达", "巨鲸、安全与资金流"],
  ["binance-square-research", "Binance Square · 项目研究所", "项目、赛道与治理"],
].map(([id, name, specialty]): IntegrationDefinition => ({ id, name, category: "publishing", description: `${specialty}账号；凭据与其他账号独立保存。`, cost: "平台规则", testable: false, defaultConfig: { accountName: name.split(" · ")[1], specialty }, fields: [
  { key: "accountName", label: "账号名称", required: true },
  { key: "specialty", label: "内容侧重", required: true },
  { key: "apiKey", label: "API Key", kind: "password", secret: true, required: true },
  { key: "apiSecret", label: "API Secret", kind: "password", secret: true, required: true },
] }));

export const integrationCatalog: IntegrationDefinition[] = [
  { id: "deepseek", name: "DeepSeek", category: "ai", description: "适合中文资讯改写与推理，使用官方 OpenAI 兼容接口。", cost: "按量计费", models: ["deepseek-chat", "deepseek-reasoner"], defaultConfig: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" }, testable: true, fields: [
    { key: "apiKey", label: "API Key", kind: "password", secret: true, required: true, placeholder: "sk-…" },
    { key: "baseUrl", label: "接口地址", kind: "url", required: true },
    { key: "model", label: "模型", required: true },
  ] },
  { id: "openrouter", name: "OpenRouter", category: "ai", description: "一个 API 接入多家模型，模型 ID 可按服务商目录自由填写。", cost: "按模型计费", defaultConfig: { baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/auto" }, testable: true, fields: [
    { key: "apiKey", label: "API Key", kind: "password", secret: true, required: true, placeholder: "sk-or-…" },
    { key: "baseUrl", label: "接口地址", kind: "url", required: true },
    { key: "model", label: "模型 ID", required: true },
  ] },
  { id: "custom-openai", name: "自定义兼容模型", category: "ai", description: "接入任何实现 OpenAI Chat Completions 协议的模型服务。", cost: "由服务商决定", defaultConfig: { baseUrl: "", model: "" }, testable: true, fields: [
    { key: "apiKey", label: "API Key", kind: "password", secret: true, required: true },
    { key: "baseUrl", label: "接口地址", kind: "url", required: true, placeholder: "https://example.com/v1" },
    { key: "model", label: "模型 ID", required: true },
  ] },
  { id: "x", name: "X API", category: "data", description: "近期推文搜索与 Web3 舆情增强；并不等于覆盖 X 全站。", cost: "通常按量", testable: true, fields: [
    { key: "bearerToken", label: "Bearer Token", kind: "password", secret: true, required: true },
    { key: "query", label: "默认检索式", kind: "textarea", placeholder: "(bitcoin OR ethereum OR web3) -is:retweet lang:en" },
  ] },
  { id: "coingecko", name: "CoinGecko Demo", category: "data", description: "补充币价、市值、成交量与涨跌幅。", cost: "免费额度", testable: true, fields: [{ key: "apiKey", label: "Demo API Key", kind: "password", secret: true, required: true }] },
  { id: "youtube", name: "YouTube Data", category: "data", description: "发现视频类 Web3 热点和频道动态。", cost: "免费配额", testable: true, fields: [
    { key: "apiKey", label: "API Key", kind: "password", secret: true, required: true },
    { key: "query", label: "默认关键词", placeholder: "bitcoin ethereum crypto web3" },
  ] },
  { id: "github", name: "GitHub", category: "data", description: "提高调用额度，并跟踪指定项目 Release。", cost: "免费额度", testable: true, fields: [
    { key: "token", label: "Personal Access Token（可选）", kind: "password", secret: true },
    { key: "repos", label: "仓库列表（每行一个）", kind: "textarea", placeholder: "bitcoin/bitcoin\nethereum/go-ethereum" },
  ] },
  { id: "web-reader", name: "公开网页监控", category: "data", description: "监控没有 RSS 的项目官网或长文；优先使用 Jina Reader，失败时回退原网页直读。", cost: "免费", testable: true, fields: [
    { key: "urls", label: "公开网页 URL（每行一个，最多 10 个）", kind: "textarea", required: true, placeholder: "https://project.example/blog\nhttps://project.example/announcements" },
  ] },
  { id: "onchain", name: "链上 RPC", category: "data", description: "读取区块与交易基础数据；RPC 地址可能包含密钥，按敏感信息保存。", cost: "免费额度", testable: true, fields: [{ key: "rpcUrl", label: "EVM RPC URL", kind: "password", secret: true, required: true }] },
  { id: "exchange-announcements", name: "交易所公告订阅", category: "data", description: "只接官方 RSS/Atom，不依赖逆向网页接口。", cost: "免费", testable: true, fields: [{ key: "feedUrls", label: "官方订阅地址（每行一个）", kind: "textarea", required: true }] },
  ...squareAccounts,
];

export function getIntegrationDefinition(id: string) {
  return integrationCatalog.find((item) => item.id === id);
}
