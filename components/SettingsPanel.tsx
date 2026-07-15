"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Field = { key: string; label: string; placeholder?: string; kind?: "text" | "url" | "password" | "textarea"; required?: boolean; secret?: boolean };
type Definition = { id: string; name: string; category: "ai" | "data" | "publishing"; description: string; cost: string; fields: Field[]; models?: string[]; defaultConfig?: Record<string, string>; testable?: boolean };
type State = { provider: string; config: Record<string, unknown>; enabled: boolean; configured: boolean; secretStatus: Record<string, boolean>; updatedAt: string };
type Payload = { user: { email: string; displayName: string; local: boolean }; catalog: Definition[]; integrations: State[]; activeAi: { provider: string; model: string } | null };

function IntegrationCard({ definition, state, active, onChanged, notify }: { definition: Definition; state?: State; active: boolean; onChanged: () => Promise<void>; notify: (message: string) => void }) {
  const initial = useMemo(() => ({ ...(definition.defaultConfig ?? {}), ...(state?.config ?? {}) }), [definition, state]);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, String(value ?? "")])));
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  async function save() {
    setBusy("save");
    try {
      const response = await fetch(`/api/settings/integrations/${definition.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ config: Object.fromEntries(definition.fields.filter((field) => !field.secret).map((field) => [field.key, values[field.key] ?? ""])), secrets, enabled: true }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "保存失败");
      setSecrets({});
      await onChanged();
      notify(`${definition.name} 已安全保存`);
    } catch (error) { notify(error instanceof Error ? error.message : "保存失败"); }
    finally { setBusy(""); }
  }

  async function test() {
    setBusy("test");
    try {
      const response = await fetch(`/api/settings/integrations/${definition.id}/test`, { method: "POST" });
      const payload = await response.json() as { detail?: string; latencyMs?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "测试失败");
      notify(`${payload.detail} · ${payload.latencyMs}ms`);
    } catch (error) { notify(error instanceof Error ? error.message : "测试失败"); }
    finally { setBusy(""); }
  }

  async function activate() {
    const model = values.model || definition.models?.[0] || "";
    setBusy("active");
    try {
      const response = await fetch("/api/settings/ai/active", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: definition.id, model }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "启用失败");
      await onChanged();
      notify(`${definition.name} / ${model} 已设为默认模型`);
    } catch (error) { notify(error instanceof Error ? error.message : "启用失败"); }
    finally { setBusy(""); }
  }

  return <article className={`integration-card panel ${active ? "active-provider" : ""}`}>
    <header><div><h3>{definition.name}</h3><p>{definition.description}</p></div><span className={state?.configured ? "configured" : "unconfigured"}>{active ? "● 当前使用" : state?.configured ? "✓ 已配置" : "待配置"}</span></header>
    <div className="integration-fields">{definition.fields.map((field) => <label key={field.key}><span>{field.label}{field.required ? " *" : ""}</span>{field.key === "model" && definition.models?.length ? <select value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}>{definition.models.map((model) => <option key={model}>{model}</option>)}</select> : field.kind === "textarea" ? <textarea rows={3} value={values[field.key] ?? ""} placeholder={field.placeholder} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}/> : <input type={field.secret ? "password" : field.kind === "url" ? "url" : "text"} value={field.secret ? secrets[field.key] ?? "" : values[field.key] ?? ""} placeholder={field.secret && state?.secretStatus?.[field.key] ? "已保存 · 留空表示不修改" : field.placeholder} onChange={(event) => field.secret ? setSecrets((current) => ({ ...current, [field.key]: event.target.value })) : setValues((current) => ({ ...current, [field.key]: event.target.value }))}/>}</label>)}</div>
    <footer><small>{definition.cost}{state?.updatedAt ? ` · 更新于 ${new Date(state.updatedAt).toLocaleString("zh-CN")}` : ""}</small><div>{definition.testable && state?.configured && <button disabled={Boolean(busy)} onClick={test}>{busy === "test" ? "检测中…" : "测试连接"}</button>}<button className="primary" disabled={Boolean(busy)} onClick={save}>{busy === "save" ? "保存中…" : "保存配置"}</button>{definition.category === "ai" && state?.configured && <button className={active ? "active-button" : ""} disabled={Boolean(busy) || active} onClick={activate}>{active ? "正在使用" : "设为默认"}</button>}</div></footer>
  </article>;
}

export function SettingsPanel({ notify }: { notify: (message: string) => void }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/settings/integrations", { cache: "no-store" });
      const body = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(body.error || "配置中心加载失败");
      setPayload(body); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "配置中心加载失败"); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  if (error) return <div className="page"><div className="settings-error panel"><h2>无法读取个人配置</h2><p>{error}</p><button onClick={() => void load()}>重新加载</button></div></div>;
  if (!payload) return <div className="page"><div className="settings-loading panel">正在读取个人配置…</div></div>;
  const byCategory = (category: Definition["category"]) => payload.catalog.filter((item) => item.category === category);
  const stateFor = (id: string) => payload.integrations.find((item) => item.provider === id);
  return <div className="page settings-page">
    <section className="settings-hero"><div><span>个人工作空间</span><h2>API 与模型配置</h2><p>每位用户使用自己的服务密钥。浏览器只显示配置状态，后台按当前登录身份隔离并加密保存。</p></div><aside><strong>{payload.user.displayName}</strong><span>{payload.user.local ? "本地临时配置 · 重启后清空" : payload.user.email}</span></aside></section>
    <section className="security-strip"><b>密钥安全</b><span>API Key 不会在列表接口中回传，也不会写入浏览器存储或前端代码。</span><em>生产环境需配置 MASTER_ENCRYPTION_KEY</em></section>
    <section className="settings-section"><div className="settings-title"><div><span>01</span><h2>内容生成模型</h2><p>选择一个默认模型负责事实约束下的二创；未配置时自动使用本地模板。</p></div><b>{payload.activeAi ? `${payload.catalog.find((item) => item.id === payload.activeAi?.provider)?.name} / ${payload.activeAi.model}` : "尚未选择默认模型"}</b></div><div className="integration-grid ai-grid">{byCategory("ai").map((definition) => <IntegrationCard key={definition.id} definition={definition} state={stateFor(definition.id)} active={payload.activeAi?.provider === definition.id} onChanged={load} notify={notify}/>)}</div></section>
    <section className="settings-section"><div className="settings-title"><div><span>02</span><h2>数据源 API</h2><p>保存后，热点采集会自动按当前用户读取对应配置，不需要重复传参。</p></div><b>{byCategory("data").filter((item) => stateFor(item.id)?.configured).length} / {byCategory("data").length} 已配置</b></div><div className="integration-grid">{byCategory("data").map((definition) => <IntegrationCard key={definition.id} definition={definition} state={stateFor(definition.id)} active={false} onChanged={load} notify={notify}/>)}</div></section>
    <section className="settings-section"><div className="settings-title"><div><span>03</span><h2>发布平台账号</h2><p>账号凭据同样按用户隔离；发布前仍保留人工审核和平台授权校验。</p></div><b>默认 DRY-RUN</b></div><div className="integration-grid publishing-grid">{byCategory("publishing").map((definition) => <IntegrationCard key={definition.id} definition={definition} state={stateFor(definition.id)} active={false} onChanged={load} notify={notify}/>)}</div></section>
  </div>;
}
