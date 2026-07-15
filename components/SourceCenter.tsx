"use client";

import { sourceCatalog } from "@/lib/sources/catalog";

export type SourceProbeView = {
  id: string;
  status: "live" | "needs_config" | "degraded" | "unavailable";
  detail: string;
  latencyMs?: number;
  checkedAt: string;
  configured?: boolean;
  tier?: 0 | 1 | 2;
  backends?: string[];
  activeBackend?: string | null;
  remediation?: string;
  requiresConfig?: string[];
};
export type SourceRunView = { collected: number; inserted: number; error?: string };

export function SourceCenter({ probes, runs, loading, collecting, onRefresh, onCollect, onConfigure }: { probes: Record<string, SourceProbeView>; runs: Record<string, SourceRunView>; loading: boolean; collecting: string; onRefresh: () => void; onCollect: (id: string) => void; onConfigure: () => void }) {
  const values = Object.values(probes);
  const summary = {
    available: values.filter((item) => item.status === "live" || item.configured).length,
    config: values.filter((item) => item.status === "needs_config" && !item.configured).length,
    issue: values.filter((item) => !item.configured && (item.status === "degraded" || item.status === "unavailable")).length,
    routed: values.filter((item) => (item.backends?.length ?? 0) > 1).length,
  };
  const icons = ["B", "R", "所", "治", "监", "D", "G", "全", "H", "W", "网", "链", "C", "Y", "X"];

  return <div className="page">
    <section className="source-hero"><div><h2>信息源诊断中心</h2><p>真实探测、首选与回退路由、故障隔离和修复建议集中管理</p></div><div><strong>{summary.available}</strong><span>可用/已配置</span><strong>{summary.routed}</strong><span>多后端路由</span><strong>{summary.config}</strong><span>待配置</span><strong>{summary.issue}</strong><span>需关注</span><button className="source-refresh" disabled={loading} onClick={onRefresh}>{loading ? "体检中…" : "重新体检"}</button></div></section>
    <section className="doctor-principles panel"><span>体检规则</span><p><b>真实执行</b> 不是只检查配置是否存在</p><p><b>故障隔离</b> 单个来源异常不拖垮全局</p><p><b>有序回退</b> 首选失效才切换备选</p><p><b>60 秒缓存</b> 减少重复探测和外部请求</p></section>
    <section className="source-grid">{sourceCatalog.map((source, index) => {
      const probe = probes[source.id]; const status = probe?.status ?? "checking";
      const label = probe?.configured && status === "needs_config" ? "已配置待采集" : status === "live" ? "已验证" : status === "needs_config" ? "待配置" : status === "degraded" ? "已降级" : status === "unavailable" ? "异常" : "检测中";
      const needsInput = Boolean(probe?.requiresConfig?.length); const run = runs[source.id]; const canCollect = Boolean(probe?.configured) || (!needsInput && (status === "live" || status === "degraded"));
      return <article className={`panel source-card ${probe?.configured ? "configured" : status}`} key={source.id}>
        <header><span className={`source-logo source-${index}`}>{icons[index] ?? "源"}</span><div><h3>{source.name}</h3><p>{source.kind}</p></div><em>● {label}</em></header>
        <div className="source-route"><span>接入等级 T{probe?.tier ?? (source.access.includes("待填") ? 1 : 0)}</span><strong>{probe?.activeBackend ?? probe?.backends?.[0] ?? source.access}</strong>{(probe?.backends?.length ?? 0) > 1 && <small>{probe?.backends?.join(" → ")}</small>}</div>
        <div className="source-proof"><span>{source.role}</span><strong>{probe?.latencyMs ? `${probe.latencyMs}ms` : source.access}</strong><p title={probe?.detail}>{probe?.configured && status === "needs_config" ? "个人配置已保存；首次采集将通过官方端点完成真实验证。" : probe?.detail ?? "正在执行真实端点探测…"}</p></div>
        {run && <div className={`source-run ${run.error ? "failed" : "passed"}`}><span>{run.error ? "采集失败" : `发现 ${run.collected} · 新增 ${run.inserted}`}</span><small title={run.error}>{run.error ?? "已写入热点事件库"}</small></div>}
        {(status === "degraded" || status === "unavailable") && probe?.remediation && <div className="source-remedy"><b>处理建议</b><span>{probe.remediation}</span></div>}
        <button className="source-collect" disabled={!canCollect || Boolean(collecting)} onClick={() => onCollect(source.id)}>{collecting === source.id ? "正在采集…" : canCollect ? "立即采集" : "配置后启用"}</button>
        <footer><span>接入 <b>{source.access}</b></span><span>成本 <b className={source.cost === "按量" ? "cost" : ""}>{source.cost}</b></span></footer>
      </article>;
    })}</section>
    <section className="panel connector-box"><div><h3>适配边界</h3><p>服务器版不复用个人浏览器 Cookie，也不把 X、Reddit 等登录态抓取伪装成免费稳定 API。需要认证的平台继续使用独立账号与官方授权。</p></div><button onClick={onConfigure}>进入配置中心</button></section>
  </div>;
}
