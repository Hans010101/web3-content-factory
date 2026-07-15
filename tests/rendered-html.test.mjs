import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function importTypeScript(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const url = `data:text/javascript;base64,${Buffer.from(output).toString("base64")}#${Date.now()}-${Math.random()}`;
  return import(url);
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function loadWorker(envOverrides = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("workflow-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...envOverrides };
  const context = { waitUntil() {}, passThroughOnException() {} };
  return (path, init) => worker.fetch(new Request(`http://localhost${path}`, init), env, context);
}

test("visual factory captures public pages and rejects private-network targets", async () => {
  let capturedInput;
  const fetchApp = await loadWorker({
    BROWSER: {
      async quickAction(action, input) {
        assert.equal(action, "screenshot");
        capturedInput = input;
        const png = new Uint8Array(16_000);
        png.set([137, 80, 78, 71]);
        return new Response(png, { headers: { "content-type": "image/png" } });
      },
    },
  });
  const headers = { "content-type": "application/json" };
  const blocked = await fetchApp("/api/visual/screenshot", { method: "POST", headers, body: JSON.stringify({ url: "https://127.0.0.1/private" }) });
  assert.equal(blocked.status, 400);
  assert.match(await blocked.text(), /私有网络/);

  const xBlocked = await fetchApp("/api/visual/screenshot", { method: "POST", headers, body: JSON.stringify({ url: "https://x.com/Cloudflare/status/123456789" }) });
  assert.equal(xBlocked.status, 422);
  assert.match(await xBlocked.text(), /上传手机或浏览器的原始截图/);

  const captured = await fetchApp("/api/visual/screenshot", { method: "POST", headers, body: JSON.stringify({ url: "https://example.com/research" }) });
  assert.equal(captured.status, 200);
  assert.match(captured.headers.get("content-type") ?? "", /image\/png/);
  assert.equal(new Uint8Array(await captured.arrayBuffer())[0], 137);
  assert.equal(capturedInput.url, "https://example.com/research");
});

test("server-renders the intelligence workbench", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Web3 内容工厂/);
  assert.match(html, /情报|热点|Web3/i);
  assert.match(html, /事件|信号|内容/i);
  assert.match(html, /视觉工厂/);
});

test("API completes collect, draft, approve, queue and dry-run publish", async () => {
  const fetchApp = await loadWorker();
  const headers = { "content-type": "application/json" };
  const collected = await fetchApp("/api/collect", { method: "POST", headers, body: JSON.stringify({ adapters: ["mock"], topics: ["BTC"], limitPerAdapter: 1 }) });
  assert.equal(collected.status, 201);
  assert.equal((await collected.json()).totalInserted, 1);

  const generated = await fetchApp("/api/events/evt-protocol-outflow/drafts", { method: "POST", headers, body: JSON.stringify({ accountId: "acc-onchain", format: "flash" }) });
  assert.equal(generated.status, 201);
  const draftId = (await generated.json()).draft.id;
  const approved = await fetchApp(`/api/drafts/${draftId}/approve`, { method: "POST", headers, body: JSON.stringify({ actor: "test-editor" }) });
  assert.equal(approved.status, 200);
  const queued = await fetchApp(`/api/drafts/${draftId}/queue`, { method: "POST", headers, body: JSON.stringify({ accountId: "acc-onchain" }) });
  assert.equal(queued.status, 201);
  const published = await fetchApp("/api/publications/run", { method: "POST", headers, body: JSON.stringify({ limit: 1 }) });
  const publishResult = await published.json();
  assert.equal(published.status, 200);
  assert.equal(publishResult.mode, "dry-run");
  assert.equal(publishResult.results[0].ok, true);
  assert.match(publishResult.results[0].platformUrl, /binance\.com\/square\/post\/mock-/);
});

test("source registry exposes the full matrix and credentialed adapters fail closed", async () => {
  const fetchApp = await loadWorker();
  const dashboard = await fetchApp("/api/dashboard");
  assert.equal(dashboard.status, 200);
  const sourceHealth = (await dashboard.json()).sourceHealth;
  assert.equal(sourceHealth.length, 15);
  assert.ok(sourceHealth.some((source) => source.id === "defillama"));
  assert.ok(sourceHealth.some((source) => source.id === "regulatory"));
  assert.ok(sourceHealth.some((source) => source.id === "x" && source.access.includes("Token")));
  assert.ok(sourceHealth.some((source) => source.id === "web-reader" && source.cost === "免费"));

  const response = await fetchApp("/api/collect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ adapters: ["exchange-announcements", "web-reader", "coingecko", "youtube", "onchain", "x"], limitPerAdapter: 1 }),
  });
  assert.equal(response.status, 201);
  const results = (await response.json()).results;
  assert.equal(results.length, 6);
  assert.ok(results.every((item) => item.collected === 0 && item.errors.length === 1));
  assert.match(results.map((item) => item.errors[0]).join(" "), /apiKey 未配置/);
  assert.match(results.map((item) => item.errors[0]).join(" "), /rpcUrl 未配置/);
  assert.match(results.map((item) => item.errors[0]).join(" "), /bearerToken 未配置/);
  assert.match(results.map((item) => item.errors[0]).join(" "), /feedUrls 未配置/);
  assert.match(results.map((item) => item.errors[0]).join(" "), /urls 未配置/);
});

test("personal API settings are isolated and never return plaintext secrets", async () => {
  const fetchApp = await loadWorker();
  const userA = { "content-type": "application/json", "oai-authenticated-user-email": "alice@example.com", "oai-authenticated-user-name": "Alice" };
  const userB = { "content-type": "application/json", "oai-authenticated-user-email": "bob@example.com", "oai-authenticated-user-name": "Bob" };
  const secret = "sk-private-alice-only-123";

  const saved = await fetchApp("/api/settings/integrations/deepseek", { method: "PUT", headers: userA, body: JSON.stringify({ config: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" }, secrets: { apiKey: secret } }) });
  assert.equal(saved.status, 200);
  const savedText = await saved.text();
  assert.doesNotMatch(savedText, new RegExp(secret));
  assert.match(savedText, /"apiKey":true/);

  const activated = await fetchApp("/api/settings/ai/active", { method: "PUT", headers: userA, body: JSON.stringify({ provider: "deepseek", model: "deepseek-chat" }) });
  assert.equal(activated.status, 200);

  const aliceSettings = await fetchApp("/api/settings/integrations", { headers: userA });
  const aliceText = await aliceSettings.text();
  assert.equal(aliceSettings.status, 200);
  assert.doesNotMatch(aliceText, new RegExp(secret));
  const alice = JSON.parse(aliceText);
  assert.equal(alice.integrations.length, 1);
  assert.equal(alice.activeAi.provider, "deepseek");

  const bobSettings = await fetchApp("/api/settings/integrations", { headers: userB });
  const bob = await bobSettings.json();
  assert.equal(bobSettings.status, 200);
  assert.equal(bob.integrations.length, 0);
  assert.equal(bob.activeAi, null);
});

test("public web reader rejects private-network URLs", async () => {
  const fetchApp = await loadWorker();
  const response = await fetchApp("/api/collect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ adapters: ["web-reader"], configs: { "web-reader": { urls: ["http://127.0.0.1:3000/private"] } }, limitPerAdapter: 1 }) });
  assert.equal(response.status, 201);
  const result = (await response.json()).results[0];
  assert.equal(result.collected, 0);
  assert.match(result.errors[0], /拒绝访问本地或私有网络地址/);
});

test("hotness scoring is weighted, clamped and banded", async () => {
  const { calculateHotness, hotnessBand, HOTNESS_WEIGHTS } = await importTypeScript("../lib/scoring.ts");
  const weightTotal = Object.values(HOTNESS_WEIGHTS).reduce((sum, value) => sum + value, 0);
  assert.equal(weightTotal, 1);
  assert.equal(
    calculateHotness({
      velocity: 100,
      marketAnomaly: 80,
      sourceTrust: 60,
      crossSource: 40,
      assetRelevance: 20,
      novelty: 0,
    }),
    61,
  );
  assert.equal(
    calculateHotness({
      velocity: 200,
      marketAnomaly: -50,
      sourceTrust: 100,
      crossSource: 100,
      assetRelevance: 100,
      novelty: 100,
    }),
    80,
  );
  assert.equal(hotnessBand(90), "critical");
  assert.equal(hotnessBand(70), "hot");
  assert.equal(hotnessBand(50), "rising");
  assert.equal(hotnessBand(49.9), "watch");
});

test("routing respects confidence and account specialization", async () => {
  const { routeEvent } = await importTypeScript("../lib/routing.ts");
  const now = new Date().toISOString();
  const event = {
    id: "evt-1",
    slug: "btc-market-move",
    title: "BTC market move",
    summary: "",
    category: "market",
    status: "verified",
    confidence: 82,
    heatScore: 80,
    velocityScore: 80,
    marketScore: 90,
    trustScore: 75,
    crossSourceScore: 70,
    relevanceScore: 90,
    noveltyScore: 55,
    symbols: ["BTC"],
    tags: ["ETF"],
    facts: [],
    unknowns: [],
    marketSnapshot: {},
    firstSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const decisions = routeEvent(event, [
    {
      id: "market",
      name: "加密市场",
      platform: "binance_square",
      specialty: "market",
      tone: "数据驱动",
      topicRules: ["market", "btc", "etf"],
      minConfidence: 75,
      dailyLimit: 12,
      enabled: true,
    },
    {
      id: "research",
      name: "项目研究",
      platform: "binance_square",
      specialty: "project",
      tone: "专业",
      topicRules: ["project"],
      minConfidence: 85,
      dailyLimit: 4,
      enabled: true,
    },
    {
      id: "disabled",
      name: "停用账号",
      platform: "binance_square",
      specialty: "market",
      tone: "",
      topicRules: ["market"],
      minConfidence: 0,
      dailyLimit: 99,
      enabled: false,
    },
  ]);

  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].accountId, "market");
  assert.equal(decisions[0].recommended, true);
  assert.ok(decisions[0].score >= 65);
  assert.ok(decisions[0].reasons.some((reason) => reason.includes("主定位")));
});

test("mock Square publisher validates assets and returns deterministic id", async () => {
  const { MockBinanceSquarePublisher } = await importTypeScript("../lib/publishing/mock.ts");
  const publisher = new MockBinanceSquarePublisher();
  const now = new Date().toISOString();
  const payload = {
    idempotencyKey: "event-v1-market-angle",
    assetUrls: ["1.png", "2.png", "3.png", "4.png"],
    draft: {
      id: "draft-1",
      eventId: "event-1",
      accountId: "market",
      format: "brief",
      status: "approved",
      headline: "BTC 市场异动",
      body: "成交量上升，事实仍在更新。",
      angle: "market",
      sourceCitationIds: ["evidence-1"],
      version: 1,
      generatedBy: "test",
      createdAt: now,
      updatedAt: now,
    },
    account: {
      id: "market",
      name: "加密市场",
      platform: "binance_square",
      specialty: "market",
      tone: "数据驱动",
      topicRules: ["market"],
      minConfidence: 75,
      dailyLimit: 12,
      enabled: true,
    },
  };

  assert.deepEqual(await publisher.validate(payload), { valid: true, errors: [] });
  const result = await publisher.publish(payload);
  assert.equal(result.ok, true);
  assert.equal(result.platformPostId, "mock-event-v1-mar");
  assert.match(result.platformUrl, /binance\.com\/square\/post\/mock-/);

  const invalid = await publisher.validate({ ...payload, assetUrls: [...payload.assetUrls, "5.png"] });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes("4")));
});

test("example configuration is internally consistent and contains no secrets", async () => {
  const [sources, accounts, policies] = await Promise.all(
    ["sources", "accounts", "policies"].map(async (name) =>
      JSON.parse(await readFile(new URL(`../config/${name}.example.json`, import.meta.url), "utf8")),
    ),
  );

  assert.equal(new Set(sources.sources.map((source) => source.id)).size, sources.sources.length);
  assert.ok(sources.sources.some((source) => source.costTier === "free" && source.enabled));
  const paid = sources.sources.filter((source) => source.costTier === "metered");
  assert.ok(paid.every((source) => Number.isFinite(source.monthlyCapUsd)));

  assert.equal(new Set(accounts.accounts.map((account) => account.id)).size, accounts.accounts.length);
  assert.ok(accounts.accounts.every((account) => account.secretEnv.startsWith("BINANCE_SQUARE_API_KEY_")));
  assert.ok(accounts.accounts.every((account) => !("apiKey" in account)));

  const weightTotal = Object.entries(policies.scoring)
    .filter(([key]) => !key.endsWith("Threshold"))
    .reduce((sum, [, value]) => sum + value, 0);
  assert.equal(Math.round(weightTotal * 100), 100);
  assert.equal(policies.publishing.defaultMode, "dry-run");
  assert.equal(policies.publishing.requireIdempotencyKey, true);
});
