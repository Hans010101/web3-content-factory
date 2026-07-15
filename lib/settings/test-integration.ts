import { getIntegrationDefinition } from "./catalog";
import { getIntegrationWithSecrets } from "./store";
import { requirePublicHttpUrl } from "@/lib/sources/public-url";

const timeout = () => AbortSignal.timeout(12_000);
const ok = (detail: string, latencyMs: number) => ({ ok: true, detail, latencyMs });

async function fetchChecked(url: string, init: RequestInit, label: string) {
  const started = Date.now();
  const response = await fetch(url, { ...init, signal: timeout() });
  if (!response.ok) {
    const message = (await response.text()).slice(0, 240).replace(/sk-[A-Za-z0-9_-]+/g, "[已脱敏]");
    throw new Error(`${label} HTTP ${response.status}${message ? `：${message}` : ""}`);
  }
  return ok(`${label} 已通过官方端点验证`, Date.now() - started);
}

const join = (base: string, path: string) => `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

export async function testIntegration(userId: string, provider: string) {
  const definition = getIntegrationDefinition(provider);
  const item = await getIntegrationWithSecrets(userId, provider);
  if (!definition || !item) throw new Error("请先保存配置");
  const values = { ...item.config, ...item.secrets } as Record<string, string>;
  if (definition.category === "ai") return fetchChecked(join(values.baseUrl, "models"), { headers: { authorization: `Bearer ${values.apiKey}`, accept: "application/json" } }, definition.name);
  if (provider === "x") return fetchChecked("https://api.x.com/2/tweets/search/recent?query=bitcoin&max_results=10", { headers: { authorization: `Bearer ${values.bearerToken}` } }, "X Recent Search");
  if (provider === "coingecko") return fetchChecked("https://api.coingecko.com/api/v3/ping", { headers: { "x-cg-demo-api-key": values.apiKey } }, "CoinGecko");
  if (provider === "youtube") return fetchChecked(`https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&maxResults=1&key=${encodeURIComponent(values.apiKey)}`, {}, "YouTube Data API");
  if (provider === "github") return fetchChecked("https://api.github.com/rate_limit", { headers: values.token ? { authorization: `Bearer ${values.token}`, accept: "application/vnd.github+json" } : { accept: "application/vnd.github+json" } }, "GitHub REST API");
  if (provider === "onchain") {
    const started = Date.now();
    const response = await fetch(values.rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }), signal: timeout() });
    const payload = await response.json() as { result?: string; error?: { message?: string } };
    if (!response.ok || !payload.result) throw new Error(`RPC 校验失败：${payload.error?.message ?? `HTTP ${response.status}`}`);
    return ok("RPC 已返回有效区块高度", Date.now() - started);
  }
  if (provider === "exchange-announcements") {
    const url = String(values.feedUrls).split(/\r?\n/).map((value) => value.trim()).find(Boolean);
    if (!url) throw new Error("没有可检测的订阅地址");
    const started = Date.now();
    const response = await fetch(url, { headers: { accept: "application/rss+xml, application/atom+xml, text/xml" }, signal: timeout() });
    const body = await response.text();
    if (!response.ok || !/<(rss|feed)\b/i.test(body)) throw new Error(`订阅地址未返回有效 RSS/Atom（HTTP ${response.status}）`);
    return ok("官方订阅已返回有效 RSS/Atom", Date.now() - started);
  }
  if (provider === "web-reader") {
    const url = String(values.urls).split(/\r?\n/).map((value) => value.trim()).find(Boolean);
    if (!url) throw new Error("没有可检测的公开网页 URL");
    const parsed = requirePublicHttpUrl(url);
    return fetchChecked(`https://r.jina.ai/${parsed.href}`, { headers: { accept: "text/plain" } }, "Jina Reader 网页读取");
  }
  throw new Error("该服务暂不支持自动连通性测试");
}
