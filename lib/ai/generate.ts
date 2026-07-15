import { getActiveAi, getIntegrationWithSecrets } from "@/lib/settings/store";

export interface GenerationInput {
  title: string;
  summary: string;
  facts?: string[];
  unknowns?: string[];
  sources?: string[];
  assets?: string[];
  market?: string;
  confidence?: number;
  tone?: "balanced" | "casual" | "pro";
}

const join = (base: string, path: string) => `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

export async function generateWithUserModel(userId: string, input: GenerationInput) {
  const active = await getActiveAi(userId);
  if (!active) throw new Error("NO_ACTIVE_MODEL");
  const integration = await getIntegrationWithSecrets(userId, active.provider);
  if (!integration?.enabled || !integration.secrets.apiKey) throw new Error("MODEL_NOT_CONFIGURED");
  const baseUrl = String(integration.config.baseUrl ?? "");
  const model = active.model || String(integration.config.model ?? "");
  const tone = input.tone === "casual" ? "自然口语、短句、避免营销腔" : input.tone === "pro" ? "专业克制、数据优先、解释因果边界" : "口语化与专业度平衡、清晰紧凑";
  const system = `你是 Web3 资讯编辑。只能使用用户提供的事实，不得补写未给出的数字、主体、因果或引语。把不确定信息明确写成“仍待确认”。输出中文正文，不要输出写作说明。风格：${tone}。结构包含：一句结论、事实与市场影响、风险边界、来源说明。末尾保留“信息仅供参考，不构成投资建议”。`;
  const user = JSON.stringify({ 标题: input.title, 摘要: input.summary, 已确认事实: input.facts ?? [], 待确认: input.unknowns ?? [], 来源: input.sources ?? [], 相关资产: input.assets ?? [], 市场反应: input.market ?? "未知", 置信度: input.confidence ?? "未知" }, null, 2);
  const response = await fetch(join(baseUrl, "chat/completions"), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${integration.secrets.apiKey}`, ...(active.provider === "openrouter" ? { "HTTP-Referer": "https://web3-content-factory.local", "X-OpenRouter-Title": "Web3 Content Factory" } : {}) },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.35, max_tokens: 900 }),
    signal: AbortSignal.timeout(45_000),
  });
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: Record<string, number>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ? `模型服务返回：${payload.error.message}` : `模型服务 HTTP ${response.status}`);
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("模型没有返回可用正文");
  return { content, provider: active.provider, model, usage: payload.usage ?? null };
}
