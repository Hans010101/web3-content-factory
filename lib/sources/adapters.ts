import type { CollectedSignal, SourceAdapter, SourceContext, SourceHealth, SourceHealthStatus } from "./types";
import { requirePublicHttpUrl } from "./public-url";

const USER_AGENT = "SignalForge/1.0 (Web3 intelligence source validation)";
const nowIso = () => new Date().toISOString();
const health = (status: SourceHealthStatus, detail: string, latencyMs?: number): SourceHealth => ({ ok: status === "live", status, detail, latencyMs, checkedAt: nowIso() });
const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
const configString = (context: SourceContext, key: string) => typeof context.config?.[key] === "string" ? context.config[key] as string : "";
const timeoutSignal = (ms = 12_000) => AbortSignal.timeout(ms);

async function contentFingerprint(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].slice(0, 10).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function timedFetch(url: string, init: RequestInit = {}) {
  const started = Date.now();
  const response = await fetch(url, { ...init, signal: init.signal ?? timeoutSignal(), headers: { accept: "application/json", "user-agent": USER_AGENT, ...init.headers } });
  return { response, latencyMs: Date.now() - started };
}

async function probeJson(url: string, label: string, init?: RequestInit) {
  try {
    const { response, latencyMs } = await timedFetch(url, init);
    if (response.status === 429) return health("degraded", `${label} 可达，但当前触发频控`, latencyMs);
    if (!response.ok) return health("unavailable", `${label} HTTP ${response.status}`, latencyMs);
    await response.json();
    return health("live", `${label} 已返回有效 JSON`, latencyMs);
  } catch (error) {
    return health("unavailable", error instanceof Error ? error.message : `${label} 不可达`);
  }
}

const stripCdata = (value: string) => value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
const decodeXml = (value: string) => stripCdata(value).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const field = (xml: string, names: string[]) => {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match?.[1]) return decodeXml(match[1]);
  }
  return "";
};

function classify(text: string) {
  if (/hack|exploit|attack|vulnerab|漏洞|攻击/i.test(text)) return "security" as const;
  if (/regulat|enforcement|sec\b|cftc|policy|监管|处罚/i.test(text)) return "regulation" as const;
  if (/price|market|volume|etf|价格|成交量/i.test(text)) return "market" as const;
  if (/release|upgrade|proposal|governance|升级|提案/i.test(text)) return "project" as const;
  return "breaking" as const;
}

async function collectFeeds(feedUrls: string[], context: SourceContext, tag: string, trust = 90) {
  const since = Date.parse(context.since);
  const signals: CollectedSignal[] = [];
  const errors: string[] = [];
  for (const feedUrl of feedUrls) {
    let xml = "";
    try {
      const { response } = await timedFetch(feedUrl, { headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
      if (!response.ok) throw new Error(`RSS ${response.status}`);
      xml = await response.text();
      if (!/<(rss|feed)\b/i.test(xml)) throw new Error("返回内容不是 RSS/Atom");
    } catch (error) {
      errors.push(`${new URL(feedUrl).hostname}: ${error instanceof Error ? error.message : "读取失败"}`);
      continue;
    }
    const entries = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)];
    for (const [, , entry] of entries) {
      const title = field(entry, ["title"]);
      const summary = field(entry, ["description", "summary", "content"]);
      const dateText = field(entry, ["pubDate", "published", "updated"]);
      const date = Date.parse(dateText);
      const publishedAt = Number.isFinite(date) ? new Date(date).toISOString() : nowIso();
      const linkText = field(entry, ["link", "guid", "id"]);
      const href = entry.match(/<link[^>]+href=["']([^"']+)/i)?.[1];
      const url = href || (linkText.startsWith("http") ? linkText : feedUrl);
      if (!title || (Number.isFinite(date) && date < since)) continue;
      const searchable = `${title} ${summary}`;
      const symbols = (context.topics ?? []).filter((topic) => searchable.toLowerCase().includes(topic.toLowerCase())).map((topic) => topic.toUpperCase());
      signals.push({ externalId: field(entry, ["guid", "id"]) || url || `${feedUrl}:${title}`, title, summary: summary || title, publishedAt, url, category: classify(searchable), symbols, tags: [tag, "official"], evidence: { sourceName: new URL(feedUrl).hostname, kind: "announcement", title, url, excerpt: (summary || title).slice(0, 500), publishedAt, trustScore: trust, isPrimary: true }, raw: { feedUrl } });
      if (signals.length >= context.limit) return signals;
    }
  }
  if (!signals.length && errors.length === feedUrls.length) throw new Error(`全部订阅源失败：${errors.join("；")}`);
  return signals;
}

export class RssSourceAdapter implements SourceAdapter {
  readonly id = "official-rss"; readonly name = "项目官方 RSS"; readonly costTier = "free" as const; readonly category = "项目公告"; readonly requiresConfig: string[] = [];
  private defaults = ["https://blog.ethereum.org/feed.xml"];
  async healthcheck() { try { const { response, latencyMs } = await timedFetch(this.defaults[0], { headers: { accept: "application/rss+xml" } }); const text = await response.text(); return response.ok && /<(rss|feed)\b/i.test(text) ? health("live", "以太坊官方 RSS 已返回有效订阅", latencyMs) : health("unavailable", `官方 RSS HTTP ${response.status}`, latencyMs); } catch (error) { return health("unavailable", error instanceof Error ? error.message : "RSS 不可达"); } }
  async collect(context: SourceContext) { return collectFeeds([...this.defaults, ...asStrings(context.config?.feedUrls)], context, "official-rss", 94); }
}

export class ExchangeAnnouncementsAdapter implements SourceAdapter {
  readonly id = "exchange-announcements"; readonly name = "交易所官方公告"; readonly costTier = "free" as const; readonly category = "交易所公告"; readonly requiresConfig = ["feedUrls"];
  async healthcheck() { return health("needs_config", "等待配置交易所官方 RSS/Atom 地址；不使用未公开或逆向接口"); }
  async collect(context: SourceContext) { const feeds = asStrings(context.config?.feedUrls); if (!feeds.length) throw new Error("feedUrls 未配置"); return collectFeeds(feeds, context, "exchange-announcement", 98); }
}

interface BinanceTicker { symbol: string; priceChangePercent: string; lastPrice: string; quoteVolume: string; closeTime: number; }
export class BinanceMarketAdapter implements SourceAdapter {
  readonly id = "binance-market"; readonly name = "Binance 公开市场数据"; readonly costTier = "free" as const; readonly category = "行情与成交量"; readonly requiresConfig: string[] = [];
  private baseUrl = "https://data-api.binance.vision";
  async healthcheck() { return probeJson(`${this.baseUrl}/api/v3/ping`, "Binance 公共行情 API"); }
  async collect(context: SourceContext): Promise<CollectedSignal[]> {
    const baseUrl = configString(context, "baseUrl") || this.baseUrl;
    const threshold = typeof context.config?.changeThreshold === "number" ? context.config.changeThreshold : 5;
    const quoteAsset = (configString(context, "quoteAsset") || "USDT").toUpperCase();
    const { response } = await timedFetch(`${baseUrl}/api/v3/ticker/24hr`); if (!response.ok) throw new Error(`Binance market API ${response.status}`);
    const tickers = await response.json() as BinanceTicker[]; const requested = new Set((context.topics ?? []).map((topic) => topic.toUpperCase()));
    return tickers.filter((ticker) => ticker.symbol.endsWith(quoteAsset)).filter((ticker) => !requested.size || requested.has(ticker.symbol) || requested.has(ticker.symbol.slice(0, -quoteAsset.length))).filter((ticker) => Math.abs(Number(ticker.priceChangePercent)) >= threshold).sort((a, b) => Math.abs(Number(b.priceChangePercent)) - Math.abs(Number(a.priceChangePercent))).slice(0, context.limit).map((ticker) => { const base = ticker.symbol.slice(0, -quoteAsset.length); const direction = Number(ticker.priceChangePercent) >= 0 ? "上涨" : "下跌"; const title = `${base} 24 小时${direction} ${Math.abs(Number(ticker.priceChangePercent)).toFixed(2)}%`; const publishedAt = new Date(ticker.closeTime).toISOString(); return { externalId: `${ticker.symbol}:${Math.floor(ticker.closeTime / 3_600_000)}`, title, summary: `${ticker.symbol} 最新价 ${ticker.lastPrice}，24 小时成交额 ${ticker.quoteVolume} ${quoteAsset}。`, publishedAt, category: "market" as const, symbols: [base], tags: ["market", "price-move"], evidence: { sourceName: "Binance Public Market Data", kind: "market" as const, title, excerpt: `${ticker.symbol} priceChangePercent=${ticker.priceChangePercent}, lastPrice=${ticker.lastPrice}`, publishedAt, trustScore: 96, isPrimary: true }, raw: ticker as unknown as Record<string, unknown> }; });
  }
}

interface LlamaProtocol { id: string; name: string; symbol?: string; url?: string; tvl?: number; change_1d?: number; change_7d?: number; category?: string; }
export class DefiLlamaAdapter implements SourceAdapter {
  readonly id = "defillama"; readonly name = "DefiLlama 协议数据"; readonly costTier = "free" as const; readonly category = "DeFi TVL 与协议"; readonly requiresConfig: string[] = [];
  async healthcheck() { return probeJson("https://api.llama.fi/protocols", "DefiLlama 基础 API"); }
  async collect(context: SourceContext): Promise<CollectedSignal[]> { const { response } = await timedFetch("https://api.llama.fi/protocols", { signal: timeoutSignal(25_000) }); if (!response.ok) throw new Error(`DefiLlama ${response.status}`); const rows = await response.json() as LlamaProtocol[]; const threshold = typeof context.config?.changeThreshold === "number" ? context.config.changeThreshold : 5; return rows.filter((row) => Math.abs(Number(row.change_1d ?? 0)) >= threshold && Number(row.tvl ?? 0) >= 1_000_000).sort((a,b)=>Math.abs(Number(b.change_1d))-Math.abs(Number(a.change_1d))).slice(0, context.limit).map((row)=>{ const change=Number(row.change_1d); const title=`${row.name} TVL 24 小时${change>=0?"上升":"下降"} ${Math.abs(change).toFixed(1)}%`; return { externalId:`${row.id}:${new Date().toISOString().slice(0,13)}`, title, summary:`当前 TVL 约 ${(Number(row.tvl)/1e6).toFixed(1)} 百万美元，7 日变化 ${Number(row.change_7d??0).toFixed(1)}%。`, publishedAt:nowIso(), url:row.url, category:"onchain" as const, symbols:row.symbol?[row.symbol]:[], tags:["defi","tvl",row.category??"protocol"], evidence:{sourceName:"DefiLlama",kind:"onchain" as const,title,url:row.url,excerpt:`tvl=${row.tvl}; change_1d=${row.change_1d}; change_7d=${row.change_7d}`,publishedAt:nowIso(),trustScore:88,isPrimary:false}, raw:row as unknown as Record<string,unknown>}; }); }
}

interface GithubRelease { id: number; name: string | null; tag_name: string; html_url: string; published_at: string; body?: string; }
export class GithubAdapter implements SourceAdapter {
  readonly id = "github"; readonly name = "GitHub 项目动态"; readonly costTier = "free" as const; readonly category = "Release 与开发动态"; readonly requiresConfig: string[] = [];
  async healthcheck() { return probeJson("https://api.github.com/rate_limit", "GitHub REST API", { headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" } }); }
  async collect(context: SourceContext): Promise<CollectedSignal[]> { const repos = asStrings(context.config?.repos); const selected = repos.length ? repos : ["bitcoin/bitcoin", "ethereum/go-ethereum"]; const token=configString(context,"token"); const baseHeaders:Record<string,string>={accept:"application/vnd.github+json","x-github-api-version":"2022-11-28"}; const rows=await Promise.all(selected.map(async(repo)=>{ const url=`https://api.github.com/repos/${repo}/releases?per_page=5`; let backend=token?"authenticated":"anonymous"; let {response}=await timedFetch(url,{headers:token?{...baseHeaders,authorization:`Bearer ${token}`} : baseHeaders}); if(token&&(response.status===401||response.status===403)){backend="anonymous-fallback";({response}=await timedFetch(url,{headers:baseHeaders}));} if(!response.ok) throw new Error(`GitHub ${repo} ${response.status}`); return {repo,backend,releases:await response.json() as GithubRelease[]}; })); return rows.flatMap(({repo,backend,releases})=>releases.filter(r=>Date.parse(r.published_at)>=Date.parse(context.since)).map(r=>({externalId:`${repo}:${r.id}`,title:`${repo} 发布 ${r.name||r.tag_name}`,summary:(r.body||`新版本 ${r.tag_name} 已发布`).slice(0,500),publishedAt:r.published_at,url:r.html_url,category:"project" as const,symbols:[],tags:["github","release",repo,backend],evidence:{sourceName:`GitHub · ${repo}`,kind:"announcement" as const,title:r.name||r.tag_name,url:r.html_url,excerpt:(r.body||r.tag_name).slice(0,500),publishedAt:r.published_at,trustScore:96,isPrimary:true},raw:{...r,backend} as unknown as Record<string,unknown>}))).slice(0,context.limit); }
}

interface GdeltArticle { url: string; title: string; seendate: string; domain: string; language?: string; sourcecountry?: string; }
const gdeltDate = (value:string) => { const match=value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/); return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z` : nowIso(); };
export class GdeltAdapter implements SourceAdapter {
  readonly id="gdelt"; readonly name="GDELT 全球新闻"; readonly costTier="free" as const; readonly category="全球新闻发现"; readonly requiresConfig:string[]=[];
  private endpoint="https://api.gdeltproject.org/api/v2/doc/doc";
  async healthcheck(){ const result=await probeJson(`${this.endpoint}?query=bitcoin&mode=artlist&maxrecords=1&format=json`,"GDELT DOC 2.0"); return result.status==="unavailable"&&/abort|timeout/i.test(result.detail)?health("degraded","GDELT 可达性测试超时；按官方限频策略延后重试"):result; }
  async collect(context:SourceContext):Promise<CollectedSignal[]>{ const query=configString(context,"query")||"(bitcoin OR ethereum OR cryptocurrency OR stablecoin OR blockchain)"; const url=`${this.endpoint}?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=${Math.min(50,context.limit)}&timespan=6h&sort=datedesc&format=json`; const {response}=await timedFetch(url); if(response.status===429) throw new Error("GDELT 已触发频控，请至少间隔 5 秒并使用 5 分钟轮询"); if(!response.ok) throw new Error(`GDELT ${response.status}`); const data=await response.json() as {articles?:GdeltArticle[]}; return (data.articles??[]).map(row=>({externalId:row.url,title:row.title,summary:`${row.domain} · ${row.sourcecountry??"全球"} · ${row.language??""}`,publishedAt:gdeltDate(row.seendate),url:row.url,category:classify(row.title),symbols:[],tags:["gdelt","global-news"],evidence:{sourceName:row.domain,kind:"article" as const,title:row.title,url:row.url,excerpt:row.title,publishedAt:gdeltDate(row.seendate),trustScore:66,isPrimary:false},raw:row as unknown as Record<string,unknown>})); }
}

export class RegulatoryAdapter implements SourceAdapter {
  readonly id="regulatory"; readonly name="SEC / CFTC 官方监管源"; readonly costTier="free" as const; readonly category="监管政策"; readonly requiresConfig:string[]=[];
  private feeds=["https://www.sec.gov/news/pressreleases.rss","https://www.cftc.gov/RSS/RSSGP/rssgp.xml"];
  async healthcheck(){ const settled=await Promise.allSettled(this.feeds.map(async url=>{const result=await timedFetch(url,{headers:{accept:"application/rss+xml"}});const text=await result.response.text();if(!result.response.ok||!/<(rss|feed)\b/i.test(text))throw new Error(`${new URL(url).hostname} 无效`);return result;}));const live=settled.filter((item):item is PromiseFulfilledResult<Awaited<ReturnType<typeof timedFetch>>>=>item.status==="fulfilled");if(live.length===this.feeds.length)return health("live","SEC 与 CFTC 官方 RSS 均已返回有效订阅",Math.max(...live.map(item=>item.value.latencyMs)));if(live.length)return health("degraded",`监管官方源部分可用（${live.length}/${this.feeds.length}）`,Math.max(...live.map(item=>item.value.latencyMs)));return health("unavailable","SEC 与 CFTC 在当前运行环境均不可达"); }
  async collect(context:SourceContext){ return collectFeeds([...this.feeds,...asStrings(context.config?.feedUrls)],context,"regulatory",99); }
}

interface DiscourseTopic { id:number; title:string; slug:string; created_at:string; last_posted_at:string; posts_count:number; }
export class GovernanceAdapter implements SourceAdapter {
  readonly id="governance"; readonly name="治理论坛"; readonly costTier="free" as const; readonly category="治理与提案"; readonly requiresConfig:string[]=[];
  private forums=["https://gov.optimism.io","https://forum.arbitrum.foundation","https://research.lido.fi"];
  async healthcheck(){ try{ const results=await Promise.all(this.forums.map(url=>timedFetch(`${url}/latest.json`))); const valid=results.every(r=>r.response.ok); return valid?health("live","Optimism、Arbitrum、Lido 治理论坛均可读取",Math.max(...results.map(r=>r.latencyMs))):health("degraded","部分治理论坛不可用"); }catch(error){return health("unavailable",error instanceof Error?error.message:"治理论坛不可达");} }
  async collect(context:SourceContext):Promise<CollectedSignal[]>{ const forums=asStrings(context.config?.forums); const selected=forums.length?forums:this.forums; const lists=await Promise.all(selected.map(async base=>{const {response}=await timedFetch(`${base}/latest.json`); if(!response.ok)throw new Error(`Discourse ${response.status}: ${base}`); const data=await response.json() as {topic_list?:{topics?:DiscourseTopic[]}}; return {base,topics:data.topic_list?.topics??[]};})); return lists.flatMap(({base,topics})=>topics.filter(t=>Date.parse(t.last_posted_at)>=Date.parse(context.since)).map(t=>({externalId:`${base}:${t.id}`,title:t.title,summary:`治理讨论共 ${t.posts_count} 条回复，最近更新于 ${t.last_posted_at}。`,publishedAt:t.created_at,url:`${base}/t/${t.slug}/${t.id}`,category:"project" as const,symbols:[],tags:["governance","proposal"],evidence:{sourceName:new URL(base).hostname,kind:"announcement" as const,title:t.title,url:`${base}/t/${t.slug}/${t.id}`,excerpt:`posts=${t.posts_count}; last_posted_at=${t.last_posted_at}`,publishedAt:t.created_at,trustScore:90,isPrimary:true},raw:t as unknown as Record<string,unknown>}))).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,context.limit); }
}

interface HnItem { id:number; title?:string; url?:string; time:number; score?:number; descendants?:number; type?:string; }
export class HackerNewsAdapter implements SourceAdapter {
  readonly id="hacker-news"; readonly name="Hacker News"; readonly costTier="free" as const; readonly category="科技热点"; readonly requiresConfig:string[]=[];
  private base="https://hacker-news.firebaseio.com/v0";
  async healthcheck(){return probeJson(`${this.base}/topstories.json`,"Hacker News 官方 API");}
  async collect(context:SourceContext):Promise<CollectedSignal[]>{const {response}=await timedFetch(`${this.base}/topstories.json`);if(!response.ok)throw new Error(`HN ${response.status}`);const ids=(await response.json() as number[]).slice(0,60);const items=await Promise.all(ids.map(async id=>{const {response:r}=await timedFetch(`${this.base}/item/${id}.json`);return r.ok?await r.json() as HnItem:null;}));const keywords=asStrings(context.config?.keywords);const terms=(keywords.length?keywords:["bitcoin","ethereum","crypto","blockchain","stablecoin","web3","defi"]).map(k=>k.toLowerCase());return items.filter((item):item is HnItem=>Boolean(item?.title&&item.type==="story"&&terms.some(k=>item.title!.toLowerCase().includes(k)))).slice(0,context.limit).map(item=>({externalId:String(item.id),title:item.title!,summary:`Hacker News 热度 ${item.score??0} 分，${item.descendants??0} 条讨论。`,publishedAt:new Date(item.time*1000).toISOString(),url:item.url||`https://news.ycombinator.com/item?id=${item.id}`,category:"breaking" as const,symbols:[],tags:["hacker-news","technology"],evidence:{sourceName:"Hacker News",kind:"post" as const,title:item.title!,url:item.url||`https://news.ycombinator.com/item?id=${item.id}`,excerpt:`score=${item.score}; comments=${item.descendants}`,publishedAt:new Date(item.time*1000).toISOString(),trustScore:62,isPrimary:false},raw:item as unknown as Record<string,unknown>}));}
}

const dayStamp=(daysAgo:number)=>{const d=new Date(Date.now()-daysAgo*86400000);return d.toISOString().slice(0,10).replaceAll("-","");};
interface WikiView { timestamp:string; views:number; article:string; }
export class WikimediaAdapter implements SourceAdapter {
  readonly id="wikimedia";readonly name="Wikipedia Pageviews";readonly costTier="free" as const;readonly category="关注度变化";readonly requiresConfig:string[]=[];
  private base="https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user";
  async healthcheck(){return probeJson(`${this.base}/Bitcoin/daily/${dayStamp(4)}/${dayStamp(2)}`,"Wikimedia Analytics API");}
  async collect(context:SourceContext):Promise<CollectedSignal[]>{const pages=asStrings(context.config?.pages);const selected=pages.length?pages:["Bitcoin","Ethereum","Cryptocurrency","Blockchain","Stablecoin"];const series=await Promise.all(selected.map(async page=>{const {response}=await timedFetch(`${this.base}/${encodeURIComponent(page)}/daily/${dayStamp(8)}/${dayStamp(2)}`);if(!response.ok)throw new Error(`Wikimedia ${page} ${response.status}`);return {page,items:(await response.json() as {items?:WikiView[]}).items??[]};}));return series.map(({page,items})=>{const views=items.map(i=>i.views);const latest=views.at(-1)??0;const baseline=views.slice(0,-1).reduce((a,b)=>a+b,0)/Math.max(1,views.length-1);const change=baseline?((latest-baseline)/baseline)*100:0;const title=`${page} Wikipedia 关注度${change>=0?"上升":"下降"} ${Math.abs(change).toFixed(1)}%`;return{externalId:`${page}:${dayStamp(2)}`,title,summary:`最近完整日浏览量 ${latest.toLocaleString()}，对比前 6 日均值。`,publishedAt:new Date(Date.now()-2*86400000).toISOString(),url:`https://en.wikipedia.org/wiki/${encodeURIComponent(page)}`,category:"breaking" as const,symbols:[page.toUpperCase()],tags:["wikimedia","attention"],evidence:{sourceName:"Wikimedia Analytics",kind:"market" as const,title,url:`https://en.wikipedia.org/wiki/${encodeURIComponent(page)}`,excerpt:`latest=${latest}; baseline=${baseline.toFixed(0)}; change=${change.toFixed(1)}%`,publishedAt:new Date(Date.now()-2*86400000).toISOString(),trustScore:70,isPrimary:true},raw:{page,items}};}).sort((a,b)=>Math.abs(Number(b.raw.items.at(-1)?.views??0))-Math.abs(Number(a.raw.items.at(-1)?.views??0))).slice(0,context.limit);}
}

export class WebReaderAdapter implements SourceAdapter {
  readonly id="web-reader"; readonly name="公开网页监控"; readonly category="官网与长文"; readonly costTier="free" as const; readonly requiresConfig=["urls"];
  async healthcheck(){
    const started=Date.now();
    try { const {response}=await timedFetch("https://r.jina.ai/https://example.com",{headers:{accept:"text/plain"}}); const body=await response.text(); if(response.ok&&/Example Domain/i.test(body)) return health("live","Jina Reader 已真实返回可读正文；原网页直读作为回退",Date.now()-started); }
    catch { /* probe fallback below */ }
    try { const {response,latencyMs}=await timedFetch("https://example.com",{headers:{accept:"text/html"}}); if(response.ok) return health("degraded","Jina Reader 当前不可用，已切换原网页直读回退",latencyMs); }
    catch { /* final unavailable below */ }
    return health("unavailable","Jina Reader 与原网页直读均不可用",Date.now()-started);
  }
  async collect(context:SourceContext):Promise<CollectedSignal[]> {
    const rawUrls=asStrings(context.config?.urls); if(!rawUrls.length) throw new Error("urls 未配置");
    const urls=rawUrls.slice(0,Math.min(10,context.limit));
    const settled=await Promise.allSettled(urls.map(async(raw)=>{
      const target=requirePublicHttpUrl(raw); let body=""; let backend="Jina Reader"; let title="";
      try { const {response}=await timedFetch(`https://r.jina.ai/${target.href}`,{headers:{accept:"text/plain"}}); if(!response.ok) throw new Error(`Jina ${response.status}`); body=(await response.text()).slice(0,120_000); if(body.length<80) throw new Error("正文过短"); title=body.match(/^Title:\s*(.+)$/im)?.[1]?.trim()||body.match(/^#\s+(.+)$/m)?.[1]?.trim()||""; }
      catch { backend="原网页直读回退"; const {response}=await timedFetch(target.href,{headers:{accept:"text/html, text/plain"}}); if(!response.ok) throw new Error(`原网页 HTTP ${response.status}`); const length=Number(response.headers.get("content-length")||0); if(length>2_000_000) throw new Error("网页正文超过 2MB 安全上限"); const html=(await response.text()).slice(0,200_000); title=decodeXml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||""); body=decodeXml(html); }
      const cleaned=body.replace(/^Title:.*$/im,"").replace(/^URL Source:.*$/im,"").replace(/^Markdown Content:.*$/im,"").replace(/[#>*_`\[\]]/g," ").replace(/\s+/g," ").trim();
      if(cleaned.length<60) throw new Error("没有提取到足够的公开正文");
      const summary=cleaned.slice(0,600); const fingerprint=await contentFingerprint(`${title}\n${summary}`); const publishedAt=nowIso(); const searchable=`${title} ${summary}`;
      return {externalId:`${target.hostname}:${fingerprint}`,title:title||`${target.hostname} 页面内容更新`,summary,publishedAt,url:target.href,category:classify(searchable),symbols:(context.topics??[]).filter(topic=>searchable.toLowerCase().includes(topic.toLowerCase())).map(topic=>topic.toUpperCase()),tags:["web-reader","official-page",backend],evidence:{sourceName:target.hostname,kind:"article" as const,title:title||target.hostname,url:target.href,excerpt:summary,publishedAt,trustScore:82,isPrimary:true},raw:{backend,contentFingerprint:fingerprint}} satisfies CollectedSignal;
    }));
    const signals=settled.filter((item):item is PromiseFulfilledResult<CollectedSignal>=>item.status==="fulfilled").map(item=>item.value);
    if(!signals.length){const errors=settled.filter((item):item is PromiseRejectedResult=>item.status==="rejected").map(item=>item.reason instanceof Error?item.reason.message:String(item.reason));throw new Error(`网页读取全部失败：${errors.join("；")}`);}
    return signals;
  }
}

abstract class ConfiguredAdapter implements SourceAdapter { abstract readonly id:string;abstract readonly name:string;abstract readonly category:string;abstract readonly costTier:"free"|"freemium"|"paid";abstract readonly requiresConfig:string[];async healthcheck(){return health("needs_config",`等待配置：${this.requiresConfig.join("、")}`);}abstract collect(context:SourceContext):Promise<CollectedSignal[]>;protected required(context:SourceContext,key:string){const value=configString(context,key);if(!value)throw new Error(`${key} 未配置`);return value;}}
export class CoinGeckoAdapter extends ConfiguredAdapter {readonly id="coingecko";readonly name="CoinGecko Demo";readonly category="市场价格补充";readonly costTier="freemium" as const;readonly requiresConfig=["apiKey"];async collect(context:SourceContext):Promise<CollectedSignal[]>{const key=this.required(context,"apiKey");const {response}=await timedFetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h",{headers:{"x-cg-demo-api-key":key}});if(!response.ok)throw new Error(`CoinGecko ${response.status}`);const rows=await response.json() as Array<Record<string,unknown>>;return rows.filter(r=>Math.abs(Number(r.price_change_percentage_24h??0))>=5).slice(0,context.limit).map(r=>{const change=Number(r.price_change_percentage_24h);const title=`${r.name} 24 小时${change>=0?"上涨":"下跌"} ${Math.abs(change).toFixed(1)}%`;return{externalId:`${r.id}:${new Date().toISOString().slice(0,13)}`,title,summary:`价格 $${r.current_price}，24 小时成交量 $${r.total_volume}。`,publishedAt:nowIso(),url:`https://www.coingecko.com/en/coins/${r.id}`,category:"market" as const,symbols:[String(r.symbol).toUpperCase()],tags:["coingecko","market"],evidence:{sourceName:"CoinGecko",kind:"market" as const,title,excerpt:`price=${r.current_price}; change24h=${change}`,publishedAt:nowIso(),trustScore:85,isPrimary:false},raw:r};});}}
export class YouTubeAdapter extends ConfiguredAdapter {readonly id="youtube";readonly name="YouTube Data";readonly category="视频热点";readonly costTier="freemium" as const;readonly requiresConfig=["apiKey"];async collect(context:SourceContext):Promise<CollectedSignal[]>{const key=this.required(context,"apiKey");const query=configString(context,"query")||"bitcoin ethereum crypto web3";const url=`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=${Math.min(50,context.limit)}&publishedAfter=${encodeURIComponent(context.since)}&q=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`;const {response}=await timedFetch(url);if(!response.ok)throw new Error(`YouTube ${response.status}`);const data=await response.json() as {items?:Array<{id:{videoId:string};snippet:{title:string;description:string;publishedAt:string;channelTitle:string}}>};return(data.items??[]).map(row=>({externalId:row.id.videoId,title:row.snippet.title,summary:row.snippet.description||`来自 ${row.snippet.channelTitle}`,publishedAt:row.snippet.publishedAt,url:`https://www.youtube.com/watch?v=${row.id.videoId}`,category:"breaking" as const,symbols:[],tags:["youtube","video"],evidence:{sourceName:row.snippet.channelTitle,kind:"post" as const,title:row.snippet.title,url:`https://www.youtube.com/watch?v=${row.id.videoId}`,excerpt:row.snippet.description.slice(0,500),publishedAt:row.snippet.publishedAt,trustScore:55,isPrimary:false},raw:row as unknown as Record<string,unknown>}));}}
export class OnchainAdapter extends ConfiguredAdapter {readonly id="onchain";readonly name="链上 RPC / 浏览器";readonly category="链上基础数据";readonly costTier="freemium" as const;readonly requiresConfig=["rpcUrl"];async collect(context:SourceContext):Promise<CollectedSignal[]>{const rpcUrl=this.required(context,"rpcUrl");const {response}=await timedFetch(rpcUrl,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_blockNumber",params:[]})});if(!response.ok)throw new Error(`RPC ${response.status}`);const data=await response.json() as {result?:string;error?:unknown};if(!data.result)throw new Error(`RPC 返回无效：${JSON.stringify(data.error)}`);return[];}}
export class XAdapter extends ConfiguredAdapter {readonly id="x";readonly name="X 舆情增强";readonly category="社交实时讨论";readonly costTier="paid" as const;readonly requiresConfig=["bearerToken"];async collect(context:SourceContext):Promise<CollectedSignal[]>{const token=this.required(context,"bearerToken");const query=configString(context,"query")||"(bitcoin OR ethereum OR crypto OR web3) -is:retweet lang:en";const url=`https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${Math.max(10,Math.min(100,context.limit))}&tweet.fields=created_at,public_metrics,author_id`;const {response}=await timedFetch(url,{headers:{authorization:`Bearer ${token}`}});if(!response.ok)throw new Error(`X API ${response.status}`);const data=await response.json() as {data?:Array<{id:string;text:string;created_at:string;author_id:string;public_metrics?:Record<string,number>}>};return(data.data??[]).map(row=>({externalId:row.id,title:row.text.slice(0,120),summary:row.text,publishedAt:row.created_at,url:`https://x.com/i/web/status/${row.id}`,category:classify(row.text),symbols:[],tags:["x","social"],evidence:{sourceName:`X user ${row.author_id}`,kind:"post" as const,title:row.text.slice(0,120),url:`https://x.com/i/web/status/${row.id}`,excerpt:row.text.slice(0,500),publishedAt:row.created_at,trustScore:50,isPrimary:false},raw:row as unknown as Record<string,unknown>}));}}

export class MockSourceAdapter implements SourceAdapter {readonly id="mock";readonly name="演示信号源";readonly costTier="free" as const;readonly category="测试";readonly requiresConfig:string[]=[];async healthcheck(){return health("live","演示数据可用");}async collect(context:SourceContext):Promise<CollectedSignal[]>{const publishedAt=nowIso();const signal:CollectedSignal={externalId:`demo-${publishedAt.slice(0,13)}`,title:"演示：巨鲸地址向交易所转入大额 BTC",summary:"链上演示监控识别到一笔大额交易所流入，用于验证采集、评分、二创和发布工作流。",publishedAt,category:"onchain",symbols:[context.topics?.[0]?.toUpperCase()||"BTC"],tags:["onchain","whale","demo"],evidence:{sourceName:"演示链上监控",kind:"onchain",title:"大额交易所流入",excerpt:"演示信号，不代表真实链上事件。",publishedAt,trustScore:70,isPrimary:true},raw:{demo:true}};return[signal].slice(0,context.limit);}}

export const sourceAdapters:SourceAdapter[]=[new BinanceMarketAdapter(),new RssSourceAdapter(),new ExchangeAnnouncementsAdapter(),new GovernanceAdapter(),new RegulatoryAdapter(),new DefiLlamaAdapter(),new GithubAdapter(),new GdeltAdapter(),new HackerNewsAdapter(),new WikimediaAdapter(),new WebReaderAdapter(),new OnchainAdapter(),new CoinGeckoAdapter(),new YouTubeAdapter(),new XAdapter(),new MockSourceAdapter()];
export function getSourceAdapter(id:string){return sourceAdapters.find(adapter=>adapter.id===id);}
