#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCaptureManifest, captureEvidenceWithPage } from "../lib/visual/evidence-config.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((item) => {
  const [key, ...rest] = item.replace(/^--/, "").split("=");
  return [key, rest.join("=") || true];
}));
if (!args.url) {
  console.error("用法: node scripts/capture-evidence.mjs --url=https://… --event-id=EVT-… [--output=evidence.png] [--dry-run]");
  process.exit(2);
}

const options = {
  url: args.url,
  eventId: args["event-id"] || `EVT-${Date.now()}`,
  outputPath: path.resolve(args.output || "evidence.png"),
};
const manifest = buildCaptureManifest(options);
if (args["dry-run"]) {
  console.log(JSON.stringify(manifest, null, 2));
  process.exit(0);
}

let playwright;
try {
  playwright = await import("playwright");
} catch {
  console.error("当前环境未安装 Playwright。可先使用 --dry-run 验证截图配置；部署截图 worker 时再安装 playwright 与 Chromium。");
  process.exit(3);
}

const browser = await playwright.chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: manifest.viewport, deviceScaleFactor: manifest.viewport.deviceScaleFactor });
  const page = await context.newPage();
  const completed = await captureEvidenceWithPage(page, options);
  const manifestPath = options.outputPath.replace(/\.png$/i, ".json");
  await writeFile(manifestPath, `${JSON.stringify(completed, null, 2)}\n`);
  console.log(JSON.stringify({ image: options.outputPath, manifest: manifestPath }, null, 2));
} finally {
  await browser.close();
}
