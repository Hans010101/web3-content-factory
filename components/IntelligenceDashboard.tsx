"use client";

import { useCallback, useMemo, useState } from "react";
import { sourceCatalog } from "@/lib/sources/catalog";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SourceCenter, type SourceProbeView, type SourceRunView } from "@/components/SourceCenter";
import { VisualFactory } from "@/components/VisualFactory";

type EventItem = {
  id: string;
  title: string;
  summary: string;
  topic: string;
  score: number;
  confidence: number;
  status: "已确认" | "核验中" | "观察中";
  age: string;
  assets: string[];
  market: string;
  marketTone: "up" | "down" | "flat";
  priority: "P0" | "P1" | "P2";
  owner: string;
  sla: string;
  nextAction: string;
  sources: { name: string; type: string; trust: number }[];
  signals: { label: string; value: string; width: number }[];
};

const events: EventItem[] = [
  {
    id: "evt-eth-etf",
    title: "ETH 现货 ETF 单日净流入创近三月新高",
    summary: "多家基金披露数据与链上托管地址变化一致，ETH 现货成交量同步放大。",
    topic: "ETF / 机构资金",
    score: 94,
    confidence: 96,
    status: "已确认",
    age: "4 分钟前",
    assets: ["ETH", "LDO"],
    market: "+3.84%",
    marketTone: "up",
    priority: "P1",
    owner: "加密市场",
    sla: "11 分钟内发布",
    nextAction: "补充 ETF 分项流入数据后，生成行情解读并送审。",
    sources: [
      { name: "基金官方披露", type: "一手来源", trust: 99 },
      { name: "链上托管地址", type: "链上数据", trust: 96 },
      { name: "X 机构讨论", type: "热度信号", trust: 78 },
    ],
    signals: [
      { label: "传播速度", value: "8.7×", width: 91 },
      { label: "市场反应", value: "+3.84%", width: 82 },
      { label: "跨源一致", value: "6 个来源", width: 88 },
    ],
  },
  {
    id: "evt-protocol",
    title: "某借贷协议出现异常大额资金转移",
    summary: "安全团队已暂停部分合约，初步链上证据显示约 1,240 万美元资产流出。",
    topic: "安全事件",
    score: 91,
    confidence: 82,
    status: "核验中",
    age: "9 分钟前",
    assets: ["DEFI", "ETH"],
    market: "-6.20%",
    marketTone: "down",
    priority: "P0",
    owner: "链上雷达",
    sla: "4 分钟内完成核验",
    nextAction: "等待项目方第二次确认；先生成预警稿，不直接定性为攻击。",
    sources: [
      { name: "项目官方频道", type: "一手来源", trust: 92 },
      { name: "链上交易记录", type: "链上数据", trust: 97 },
      { name: "安全研究员", type: "专业来源", trust: 89 },
    ],
    signals: [
      { label: "传播速度", value: "11.2×", width: 97 },
      { label: "市场反应", value: "-6.20%", width: 89 },
      { label: "跨源一致", value: "3 个来源", width: 67 },
    ],
  },
  {
    id: "evt-btc-whale",
    title: "沉睡 7 年的 BTC 地址向交易所转入 1,850 BTC",
    summary: "地址历史标签与多次拆分路径已完成核对，尚未观察到集中卖出成交。",
    topic: "巨鲸 / 交易所流入",
    score: 86,
    confidence: 91,
    status: "已确认",
    age: "16 分钟前",
    assets: ["BTC"],
    market: "-0.62%",
    marketTone: "down",
    priority: "P1",
    owner: "链上雷达",
    sla: "18 分钟内发布",
    nextAction: "核对交易所归集地址，并明确‘转入不等于卖出’。",
    sources: [
      { name: "Bitcoin 链上", type: "链上数据", trust: 99 },
      { name: "地址标签服务", type: "专业来源", trust: 84 },
      { name: "Binance 行情", type: "市场数据", trust: 98 },
    ],
    signals: [
      { label: "传播速度", value: "5.4×", width: 72 },
      { label: "市场反应", value: "-0.62%", width: 35 },
      { label: "跨源一致", value: "4 个来源", width: 76 },
    ],
  },
  {
    id: "evt-l2",
    title: "主流 L2 公布新一轮协议升级时间表",
    summary: "升级计划包含费用模型调整与证明系统更新，GitHub 版本标签已同步发布。",
    topic: "项目升级",
    score: 79,
    confidence: 98,
    status: "已确认",
    age: "28 分钟前",
    assets: ["L2", "ETH"],
    market: "+1.13%",
    marketTone: "up",
    priority: "P2",
    owner: "项目研究所",
    sla: "今日 18:00 前",
    nextAction: "提炼升级影响，安排研究账号发布三点式解读。",
    sources: [
      { name: "项目官方博客", type: "一手来源", trust: 99 },
      { name: "GitHub Release", type: "代码来源", trust: 99 },
    ],
    signals: [
      { label: "传播速度", value: "3.1×", width: 58 },
      { label: "市场反应", value: "+1.13%", width: 43 },
      { label: "跨源一致", value: "2 个来源", width: 60 },
    ],
  },
];

const navItems = [
  ["radar", "◉", "热点雷达"],
  ["studio", "✦", "内容工作台"],
  ["visual", "▧", "视觉工厂"],
  ["matrix", "⌘", "账号矩阵"],
  ["queue", "↗", "发布队列"],
  ["sources", "◎", "信息源"],
  ["settings", "⚙", "配置中心"],
] as const;

const accountRows = [
  { name: "Web3 闪讯", tag: "突发 / 公告", color: "orange", jobs: 0, state: "待配置", last: "尚未接入" },
  { name: "加密市场", tag: "行情 / 宏观", color: "cyan", jobs: 0, state: "待配置", last: "尚未接入" },
  { name: "链上雷达", tag: "巨鲸 / 安全", color: "violet", jobs: 0, state: "待配置", last: "尚未接入" },
  { name: "项目研究所", tag: "项目 / 赛道", color: "green", jobs: 0, state: "待配置", last: "尚未接入" },
];

type SourceProbe = SourceProbeView;
type SourceRun = SourceRunView;
type BackendEvent = { id: string; title: string; summary: string; category: string; confidence: number; heatScore: number; status: string; symbols: string[]; tags: string[]; trustScore: number; firstSeenAt: string; marketSnapshot: Record<string, string | number> };

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{score}</strong><span>热度</span></div>
    </div>
  );
}

export function IntelligenceDashboard() {
  const [activeNav, setActiveNav] = useState<(typeof navItems)[number][0]>("radar");
  const [selectedId, setSelectedId] = useState(events[0].id);
  const [filter, setFilter] = useState("全部");
  const [draftTone, setDraftTone] = useState<"balanced" | "casual" | "pro">("balanced");
  const [draft, setDraft] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [toast, setToast] = useState("");
  const [sourceProbes, setSourceProbes] = useState<Record<string, SourceProbe>>({});
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceCollecting, setSourceCollecting] = useState("");
  const [sourceRuns, setSourceRuns] = useState<Record<string, SourceRun>>({});
  const [eventItems, setEventItems] = useState(events);
  const selected = eventItems.find((item) => item.id === selectedId) ?? eventItems[0] ?? events[0];
  const visibleEvents = useMemo(() => filter === "全部" ? eventItems : eventItems.filter((e) => e.status === filter), [filter, eventItems]);
  const sourceSummary = useMemo(() => ({ live: Object.values(sourceProbes).filter((item) => item.status === "live" || item.configured).length, config: Object.values(sourceProbes).filter((item) => item.status === "needs_config" && !item.configured).length, issue: Object.values(sourceProbes).filter((item) => !item.configured && (item.status === "degraded" || item.status === "unavailable")).length }), [sourceProbes]);
  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);
  const refreshSources = useCallback(async (fresh = false) => {
    setSourceLoading(true);
    try {
      const response = await fetch(`/api/health${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
      const payload = await response.json() as { adapters?: SourceProbe[] };
      setSourceProbes(Object.fromEntries((payload.adapters ?? []).map((item) => [item.id, item])));
      showToast("信息源连通性检测完成");
    } catch {
      showToast("连通性检测失败，请稍后重试");
    } finally {
      setSourceLoading(false);
    }
  }, [showToast]);

  async function collectSource(sourceId: string) {
    setSourceCollecting(sourceId);
    try {
      const collectedAt = new Date();
      const since = new Date(collectedAt);
      since.setUTCDate(since.getUTCDate() - 7);
      const response = await fetch("/api/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adapters: [sourceId], since: since.toISOString(), limitPerAdapter: 5, topics: ["BTC", "ETH", "SOL"] }),
      });
      const payload = await response.json() as { results?: Array<{ collected: number; inserted: number; errors: string[] }> };
      const result = payload.results?.[0];
      if (!result || result.errors.length) throw new Error(result?.errors.join("；") || `HTTP ${response.status}`);
      setSourceRuns((current) => ({ ...current, [sourceId]: { collected: result.collected, inserted: result.inserted } }));
      const dashboardResponse = await fetch("/api/dashboard", { cache: "no-store" });
      const dashboard = await dashboardResponse.json() as { events?: BackendEvent[] };
      if (dashboard.events?.length) {
        const sourceName = sourceCatalog.find((item) => item.id === sourceId)?.name ?? sourceId;
        const nextEvents = dashboard.events.slice(0, 20).map((event): EventItem => {
          const marketValue = Object.values(event.marketSnapshot).find((value) => typeof value === "string" && /[+-]?\d+(\.\d+)?%/.test(value));
          const market = typeof marketValue === "string" ? marketValue : "待观察";
          const elapsedMinutes = Math.max(0, Math.round((collectedAt.getTime() - Date.parse(event.firstSeenAt)) / 60_000));
          return {
            id: event.id, title: event.title, summary: event.summary, topic: event.category.toUpperCase(), score: Math.round(event.heatScore), confidence: event.confidence,
            status: event.status === "verified" ? "已确认" : event.status === "developing" ? "核验中" : "观察中",
            age: elapsedMinutes < 60 ? `${elapsedMinutes} 分钟前` : `${Math.floor(elapsedMinutes / 60)} 小时前`, assets: event.symbols.length ? event.symbols : ["WEB3"],
            market, marketTone: market.startsWith("+") ? "up" : market.startsWith("-") ? "down" : "flat",
            priority: event.heatScore >= 85 ? "P0" : event.heatScore >= 70 ? "P1" : "P2", owner: event.category === "market" ? "加密市场" : event.category === "security" || event.category === "onchain" ? "链上雷达" : "Web3 闪讯",
            sla: event.heatScore >= 85 ? "10 分钟内完成核验" : "30 分钟内完成研判", nextAction: event.status === "verified" ? "基于已确认事实生成草稿，并进入人工审核。" : "补充第二个独立来源，完成交叉核验后再发布。",
            sources: [{ name: sourceName, type: "真实采集证据", trust: event.trustScore }],
            signals: [{ label: "综合热度", value: String(Math.round(event.heatScore)), width: event.heatScore }, { label: "事实置信", value: `${event.confidence}%`, width: event.confidence }, { label: "来源可信", value: String(event.trustScore), width: event.trustScore }],
          };
        });
        setEventItems(nextEvents);
        setSelectedId(nextEvents[0].id);
      }
      showToast(`采集完成：发现 ${result.collected} 条，新增 ${result.inserted} 条`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "采集失败";
      setSourceRuns((current) => ({ ...current, [sourceId]: { collected: 0, inserted: 0, error: message } }));
      showToast(`采集失败：${message}`);
    } finally {
      setSourceCollecting("");
    }
  }

  async function generateDraft() {
    const opener = draftTone === "casual" ? "刚刚，市场里出现了一个值得留意的新信号。" : draftTone === "pro" ? "市场情报更新：多源数据已确认一项高优先级事件。" : "刚刚，一条重要的 Web3 市场信号完成了多源核验。";
    const fallback = `${opener}\n\n${selected.title}。${selected.summary}\n\n目前关联资产为 $${selected.assets.join("、$")}，市场即时反应 ${selected.market}。现有证据来自 ${selected.sources.map((s) => s.name).join("、")}。\n\n当前状态：${selected.status}｜置信度 ${selected.confidence}%\n信息仅供参考，不构成投资建议。`;
    setAiGenerating(true);
    try {
      const response = await fetch("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: selected.title, summary: selected.summary, facts: [selected.summary, `关联资产：${selected.assets.join("、")}`, `市场反应：${selected.market}`], unknowns: ["后续影响范围与持续时间", "市场反应是否由单一事件驱动"], sources: selected.sources.map((source) => source.name), assets: selected.assets, market: selected.market, confidence: selected.confidence, tone: draftTone }) });
      const payload = await response.json() as { content?: string; provider?: string; model?: string; error?: string };
      if (response.status === 409) { setDraft(fallback); showToast("未配置默认模型，已使用本地事实模板"); return; }
      if (!response.ok || !payload.content) throw new Error(payload.error || "模型没有返回正文");
      setDraft(payload.content);
      showToast(`已由 ${payload.provider} / ${payload.model} 生成`);
    } catch (error) {
      setDraft(fallback);
      showToast(`模型调用失败，已安全回退本地模板：${error instanceof Error ? error.message : "未知错误"}`);
    } finally { setAiGenerating(false); }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">W3</div><div><strong>Web3 内容工厂</strong><span>热点 · 创作 · 分发</span></div></div>
        <nav>
          <p className="nav-label">工作空间</p>
          {navItems.map(([id, icon, label]) => (
            <button key={id} className={activeNav === id ? "nav-item active" : "nav-item"} onClick={() => { setActiveNav(id); if (id === "sources" && !Object.keys(sourceProbes).length) void refreshSources(); }}>
              <span>{icon}</span>{label}{id === "queue" && <em>6</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="usage-card"><span>本月付费数据</span><strong>$0.00 <small>/ $100 上限</small></strong><div><i style={{ width: "0%" }} /></div><small>当前仅使用免费数据源</small></div>
          <button className="profile"><span>HP</span><div><strong>内容管理员</strong><small>Cloudflare 正式版</small></div><b>···</b></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p>情报控制台 <span>/ {navItems.find((n) => n[0] === activeNav)?.[2]}</span></p><h1>{navItems.find((n) => n[0] === activeNav)?.[2]}</h1></div>
          <div className="top-actions"><span className="live-pill"><i /> {sourceSummary.live ? `${sourceSummary.live} 个源本次验证通过` : "等待信息源检测"}</span><button aria-label="搜索">⌕</button><button aria-label="通知">♢<em /></button><button className="primary" onClick={() => { setActiveNav("studio"); void generateDraft(); }}>＋ 新建内容</button></div>
        </header>

        {activeNav === "radar" && (
          <div className="page radar-page">
            <section className="metric-grid">
              <article><span>活跃热点</span><strong>24</strong><small className="positive">↑ 18% 较昨日</small><div className="spark cyan"><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
              <article><span>P0 / P1 事件</span><strong>3</strong><small className="urgent-copy">1 条即将超时</small><div className="mini-dots"><i/><i/><i/><i/><i/><i/><i/></div></article>
              <article><span>热点覆盖率</span><strong>87%</strong><small className="positive">4 个账号协同</small><div className="spark green"><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
              <article><span>平均领先时间</span><strong>8m 42s</strong><small className="positive">↑ 2m 11s</small><div className="speed-mark">⚡</div></article>
            </section>

            <section className="action-center panel">
              <div className="action-intro"><span>运营行动中心</span><strong>现在有 3 项需要处理</strong><small>按时效、风险和内容价值排序</small></div>
              <button className="action-item critical" onClick={() => setSelectedId("evt-protocol")}><span className="action-level">P0</span><p><strong>安全事件等待二次确认</strong><small>剩余 04:12 · 避免提前定性</small></p><b>立即核验 →</b></button>
              <button className="action-item" onClick={() => setActiveNav("queue")}><span className="action-level">P1</span><p><strong>2 篇高热度草稿待审核</strong><small>预计损失领先时间 11 分钟</small></p><b>进入审核 →</b></button>
              <button className="action-item gap" onClick={() => setActiveNav("matrix")}><span className="action-level">缺口</span><p><strong>项目与赛道覆盖不足</strong><small>24h 覆盖率 72%，建议补充研究内容</small></p><b>查看矩阵 →</b></button>
            </section>

            <section className="radar-layout">
              <div className="panel feed-panel">
                <div className="panel-head"><div><h2>实时热点流</h2><p>按热度、可信度与市场相关性综合排序</p></div><div className="filters">{["全部", "已确认", "核验中", "观察中"].map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item}</button>)}</div></div>
                <div className="event-list">
                  {visibleEvents.map((item) => (
                    <button key={item.id} className={selectedId === item.id ? "event-row selected" : "event-row"} onClick={() => setSelectedId(item.id)}>
                      <ScoreRing score={item.score} />
                      <div className="event-main"><div className="event-meta"><span className={`priority priority-${item.priority.toLowerCase()}`}>{item.priority}</span><span className={`status ${item.status}`}>{item.status}</span><span>{item.topic}</span><span>{item.age}</span></div><h3>{item.title}</h3><p>{item.summary}</p><div className="event-tags">{item.assets.map((asset) => <span key={asset}>${asset}</span>)}<b>{item.sources.length} 个来源</b><em>→ {item.owner}</em></div></div>
                      <div className={`market ${item.marketTone}`}><small>市场反应</small><strong>{item.market}</strong><span>›</span></div>
                    </button>
                  ))}
                </div>
              </div>

              <aside className="panel detail-panel">
                <div className="detail-top"><div><span className={`priority priority-${selected.priority.toLowerCase()}`}>{selected.priority}</span><span className={`status ${selected.status}`}>{selected.status}</span></div><button onClick={() => showToast("事件已加入重点跟踪")}>☆</button></div>
                <h2>{selected.title}</h2><p>{selected.summary}</p>
                <div className="next-action"><span>下一步运营动作</span><strong>{selected.sla}</strong><p>{selected.nextAction}</p></div>
                <div className="confidence"><span>事实置信度</span><strong>{selected.confidence}%</strong><div><i style={{ width: `${selected.confidence}%` }} /></div></div>
                <h3 className="section-label">信号强度</h3>
                <div className="signal-list">{selected.signals.map((signal) => <div key={signal.label}><span>{signal.label}</span><b>{signal.value}</b><div><i style={{ width: `${signal.width}%` }} /></div></div>)}</div>
                <h3 className="section-label">证据来源</h3>
                <div className="source-list">{selected.sources.map((source, index) => <div key={source.name}><span className={`source-icon s${index}`}>{index === 0 ? "官" : index === 1 ? "链" : "讯"}</span><p><strong>{source.name}</strong><small>{source.type}</small></p><b>{source.trust}</b></div>)}</div>
                <div className="detail-actions"><button onClick={() => showToast("已打开事实包")}>查看事实包</button><button className="primary" onClick={() => { setActiveNav("studio"); void generateDraft(); }}>生成内容 →</button></div>
              </aside>
            </section>
          </div>
        )}

        {activeNav === "studio" && (
          <div className="page studio-page">
            <section className="studio-grid">
              <div className="panel facts-panel"><div className="panel-head"><div><h2>事件事实包</h2><p>所有表述都必须由证据支撑</p></div><span className="score-badge">{selected.confidence}% 可信</span></div><h3>{selected.title}</h3><p className="lede">{selected.summary}</p><div className="fact-block"><span>已确认事实</span><ul><li>事件已由 {selected.sources[0].name} 首次确认</li><li>关联资产：{selected.assets.join("、")}</li><li>市场即时反应为 {selected.market}</li></ul></div><div className="fact-block warning"><span>仍待确认</span><ul><li>后续影响范围与持续时间</li><li>市场反应是否由单一事件驱动</li></ul></div><div className="evidence-chips">{selected.sources.map(s => <button key={s.name}>✓ {s.name}</button>)}</div></div>
              <div className="panel editor-panel"><div className="panel-head"><div><h2>二创编辑器</h2><p>事实约束写作 · 原创结构输出</p></div><button onClick={() => showToast("已保存草稿")}>保存</button></div><div className="tone-switch"><span>表达风格</span>{(["balanced", "casual", "pro"] as const).map(tone => <button key={tone} className={draftTone === tone ? "active" : ""} onClick={() => setDraftTone(tone)}>{tone === "balanced" ? "平衡" : tone === "casual" ? "更口语" : "更专业"}</button>)}</div><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="选择事实包并生成草稿……"/><div className="editor-footer"><span>{draft.length} 字 · 来源 {selected.sources.length}</span><div><button disabled={aiGenerating} onClick={() => void generateDraft()}>{aiGenerating ? "模型生成中…" : "重新生成"}</button><button className="primary" onClick={() => { setActiveNav("visual"); showToast("正文已送入视觉工厂"); }}>下一步：配图 →</button></div></div></div>
              <aside className="panel routing-panel"><div className="panel-head"><div><h2>发布路由</h2><p>匹配最适合的专业账号</p></div></div>{accountRows.map((account, idx) => <label key={account.name} className="route-row"><input type="radio" name="route" defaultChecked={idx === 0}/><span className={`avatar ${account.color}`}>{account.name.slice(0, 1)}</span><p><strong>{account.name}</strong><small>{account.tag}</small></p><em>{idx === 0 ? "96%" : `${84 - idx * 7}%`}</em></label>)}<div className="guardrail"><strong>发布护栏</strong><p>该事件不含价格预测；来源数量与置信度符合账号策略。</p><span>✓ 可进入审核</span></div></aside>
            </section>
          </div>
        )}

        {activeNav === "visual" && (
          <VisualFactory event={selected} notify={showToast} onReview={() => { setActiveNav("queue"); showToast("真实截图已核验并送入审核队列"); }}/>
        )}

        {activeNav === "matrix" && <div className="page"><section className="matrix-overview"><div><h2>账号矩阵</h2><p>一个事实中枢，多个专业表达出口</p></div><button className="primary" onClick={() => showToast("真实账号将在密钥接入后添加")}>＋ 添加账号</button></section><section className="account-grid">{accountRows.map((a,i)=><article className="account-card panel" key={a.name}><header><span className={`avatar ${a.color}`}>{a.name.slice(0,1)}</span><div><h3>{a.name}</h3><p>{a.tag}</p></div><em className={a.state === "在线" ? "online":"pending"}>● {a.state}</em></header><div className="account-stats"><p><span>今日任务</span><strong>{a.jobs}</strong></p><p><span>发布上限</span><strong>100</strong></p><p><span>最低置信</span><strong>{80+i*3}%</strong></p></div><div className="account-rule"><span>内容侧重</span><p>{i===0?"交易所公告 · 监管 · 突发":i===1?"价格异动 · ETF · 宏观":i===2?"巨鲸 · 攻击 · 资金流":"协议升级 · 融资 · 治理"}</p></div><footer><span>最近发布：{a.last}</span><button>管理策略</button></footer></article>)}</section><section className="panel coverage"><div className="panel-head"><div><h2>矩阵覆盖</h2><p>过去 24 小时热点覆盖与账号协同</p></div><span className="score-badge">87% 总覆盖率</span></div><div className="coverage-bars">{[["市场与宏观",94],["安全与链上",89],["交易所动态",96],["项目与赛道",72]].map(([n,v])=><div key={n as string}><span>{n}</span><div><i style={{width:`${v}%`}}/></div><b>{v}%</b></div>)}</div></section></div>}

        {activeNav === "queue" && <div className="page"><div className="dry-run-banner"><strong>DRY-RUN 验证模式</strong><span>账号密钥尚未配置，所有发布任务只验证流程，不会对外发送。</span></div><section className="panel queue-panel"><div className="panel-head"><div><h2>发布队列</h2><p>审核、定时、发布与失败重试集中管理</p></div><button className="primary" onClick={()=>showToast("当前为验证模式，未执行对外发布")}>验证审核流程</button></div><div className="queue-table"><div className="table-head"><span>内容</span><span>目标账号</span><span>状态</span><span>计划时间</span><span>操作</span></div>{eventItems.slice(0,3).map((e,i)=><div className="table-row" key={e.id}><div><span className="thumb-mini">W3</span><p><strong>{e.title}</strong><small>{e.assets.map(a=>`$${a}`).join(" ")} · 发布预览</small></p></div><span>{accountRows[i].name}</span><span className="job-state j0">验证待审核</span><span>不对外发送</span><button onClick={()=>showToast("验证任务详情已打开")}>•••</button></div>)}</div></section></div>}

        {activeNav === "sources" && (
          <SourceCenter
            probes={sourceProbes}
            runs={sourceRuns}
            loading={sourceLoading}
            collecting={sourceCollecting}
            onRefresh={() => void refreshSources(true)}
            onCollect={(id) => void collectSource(id)}
            onConfigure={() => setActiveNav("settings")}
          />
        )}
        {activeNav === "settings" && <SettingsPanel notify={showToast}/>}
      </section>
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}
