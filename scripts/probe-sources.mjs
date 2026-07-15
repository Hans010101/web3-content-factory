#!/usr/bin/env node

const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const collect = process.argv.includes("--collect");
const response = await fetch(`${baseUrl}/api/health`, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`health endpoint HTTP ${response.status}`);
const report = await response.json();

console.table(report.adapters.map((item) => ({
  id: item.id,
  status: item.status,
  latency: item.latencyMs ? `${item.latencyMs}ms` : "—",
  detail: item.detail,
})));

if (collect) {
  const runnable = report.adapters.filter((item) => item.status === "live").map((item) => item.id);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const results = [];
  for (const adapter of runnable) {
    const collected = await fetch(`${baseUrl}/api/collect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adapters: [adapter], since, limitPerAdapter: 2, topics: ["BTC", "ETH"] }),
    });
    const payload = await collected.json();
    const item = payload.results?.[0] ?? { adapter, errors: [payload.error || `HTTP ${collected.status}`] };
    results.push({ adapter, collected: item.collected ?? 0, inserted: item.inserted ?? 0, result: item.errors?.length ? item.errors.join("；") : "通过" });
  }
  console.table(results);
  if (results.some((item) => item.result !== "通过")) process.exitCode = 1;
}

if (report.adapters.some((item) => item.status === "unavailable")) process.exitCode = 1;
