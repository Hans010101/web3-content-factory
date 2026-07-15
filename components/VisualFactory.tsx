"use client";

import { useEffect, useState } from "react";

type VisualEvent = {
  title: string;
  summary: string;
  market: string;
  marketTone: "up" | "down" | "flat";
  assets: string[];
  sources: { name: string }[];
};

export function VisualFactory({ event, notify, onReview }: { event: VisualEvent; notify(message: string): void; onReview(): void }) {
  const [mode, setMode] = useState<"source" | "combo" | "card" | "timeline">("source");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [capturedAt, setCapturedAt] = useState("");
  const [captureKind, setCaptureKind] = useState<"" | "云端抓取" | "人工原图">("");
  const [error, setError] = useState("");
  const hasCapture = Boolean(imageUrl);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  async function capture() {
    setCapturing(true);
    setError("");
    try {
      const response = await fetch("/api/visual/screenshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || `截图失败（HTTP ${response.status}）`);
      }
      const nextUrl = URL.createObjectURL(await response.blob());
      setImageUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return nextUrl; });
      setCapturedAt(response.headers.get("x-captured-at") || new Date().toISOString());
      setCaptureKind("云端抓取");
      setMode("source");
      notify("真实原帖截图已生成，请核对作者与上下文");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "截图失败，请稍后重试";
      setError(message);
      notify(message);
    } finally {
      setCapturing(false);
    }
  }

  function uploadScreenshot(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) { setError("仅支持 PNG、JPG 或 WebP 截图"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("截图不能超过 10 MB"); return; }
    const nextUrl = URL.createObjectURL(file);
    setImageUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return nextUrl; });
    setCapturedAt(new Date().toISOString());
    setCaptureKind("人工原图");
    setError("");
    setMode("source");
    notify("原始截图已载入，请补充链接并核对作者与上下文");
  }

  const modes = [
    ["source", "原帖截图", "X / 公告 / 研究员原文"],
    ["combo", "截图 + 解读", "原帖证据与中文要点同屏"],
    ["card", "行情补充卡", "价格、成交量与关键数据"],
    ["timeline", "事件时间线", "多节点事件回顾"],
  ] as const;

  return (
    <div className="page visual-page">
      <div className="visual-policy panel">
        <div><span>证据优先工作流</span><strong>真实截图做主图，自制卡片只补充结论</strong></div>
        <p>保留作者头像、账号、发布时间与正文上下文；发布时附原链接，避免裁切成误导性表达。</p>
      </div>
      <section className="visual-grid evidence-first">
        <div className="panel template-panel">
          <div className="panel-head"><div><h2>素材类型</h2><p>先证据，后解读</p></div></div>
          {modes.map(([id, name, description], index) => (
            <button key={id} onClick={() => setMode(id)} className={mode === id ? "template-choice active" : "template-choice"}>
              <span className={`tpl tpl-${index}`}><i/><b/><em/></span><p><strong>{name}</strong><small>{description}</small></p><b>›</b>
            </button>
          ))}
          <div className="source-capture-form">
            <label htmlFor="source-post-url">原始内容链接</label>
            <textarea id="source-post-url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="粘贴 X 帖子、官方公告或公开网页的 HTTPS 链接" rows={4}/>
            <button className="primary" disabled={capturing || !sourceUrl.trim()} onClick={() => void capture()}>{capturing ? "云端抓取中…" : "抓取真实截图"}</button>
            <label className="upload-screenshot">上传原始截图<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadScreenshot(event.target.files?.[0])}/></label>
            <small>自动抓取仅访问公开页面，不带入登录态。若 X 拦截机器人，请上传手机/浏览器原图；系统不会用自制卡伪装成原帖。</small>
            {error && <p className="capture-error">{error}</p>}
          </div>
        </div>

        <div className="panel canvas-panel">
          <div className="canvas-toolbar"><span>{mode === "source" ? "原始证据 · PNG" : "1080 × 1350 · PNG"}</span><div><b>{hasCapture ? "已抓取" : "等待原链接"}</b></div></div>
          {mode === "source" || mode === "combo" ? (
            <div className={`screenshot-stage ${hasCapture ? "has-image" : ""}`}>
              {/* Blob URLs are short-lived capture results and cannot use the framework image optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {hasCapture ? <img src={imageUrl} alt="公开原帖的真实截图预览"/> : <div className="capture-empty"><span>↗</span><strong>粘贴公开原帖链接</strong><p>支持 X 帖子与公开网页；抓取后在这里核对作者、时间和完整语境。</p></div>}
              {mode === "combo" && hasCapture && <div className="capture-caption"><span>中文要点</span><strong>{event.title}</strong><p>{event.summary}</p></div>}
            </div>
          ) : (
            <div className="artboard light-card"><div className="card-brand"><span>W3</span><b>WEB3 内容工厂</b><em>补充解读</em></div><div className="card-status">● 已确认 · 数据补充</div><h2>{event.title}</h2><p>{event.summary}</p><div className="card-number"><span>市场即时反应</span><strong className={event.marketTone}>{event.market}</strong></div><div className="card-coins">{event.assets.map((asset) => <span key={asset}>${asset}</span>)}</div><footer><span>来源：{event.sources.slice(0, 2).map((source) => source.name).join(" · ")}</span><b>辅助图</b></footer></div>
          )}
          <div className="qa-bar evidence-qa">
            <span className={hasCapture ? "checked" : ""}>① 作者与账号可见</span><span className={hasCapture ? "checked" : ""}>② 时间与正文完整</span><span>③ 已附原文链接</span>
            <button disabled={!hasCapture} onClick={() => notify("截图已加入当前发布素材包")}>加入素材包</button>
          </div>
        </div>

        <aside className="panel asset-panel">
          <div className="panel-head"><div><h2>发布素材包</h2><p>建议 2–4 张，按证据强度排序</p></div></div>
          {[
            ["原始证据截图", hasCapture ? "已抓取，待人工核验" : "等待抓取", hasCapture],
            ["中文结论卡", "根据事实包生成", true],
            ["市场反应图表", "可选补充", false],
            ["事件时间线", "复杂事件时启用", false],
          ].map(([name, status, ready], index) => <div className="asset-row" key={String(name)}><span>{index + 1}</span><p><strong>{name}</strong><small>{status}</small></p><b className={ready ? "ready" : "pending"}>{ready ? "✓" : "○"}</b></div>)}
          <div className="evidence-meta"><span>来源链接</span><p>{sourceUrl || "尚未填写（送审前必填）"}</p><span>素材方式</span><p>{captureKind || "尚未生成"}</p><span>抓取 / 上传时间</span><p>{capturedAt ? new Date(capturedAt).toLocaleString("zh-CN", { hour12: false }) : "尚未生成"}</p></div>
          <button className="primary full" disabled={!hasCapture || !sourceUrl.trim()} onClick={onReview}>完成核验并送审 →</button>
        </aside>
      </section>
    </div>
  );
}
