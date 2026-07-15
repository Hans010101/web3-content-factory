#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderCardPng } from "../lib/visual/render-card.mjs";
import { inspectVisual, validateCardData } from "../lib/visual/qa.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.resolve(root, process.argv[2] ?? "templates/visual/demo-cards.json");
const outputDir = path.resolve(root, process.argv[3] ?? "public/demo-assets");
const cards = JSON.parse(await readFile(inputPath, "utf8"));
await mkdir(outputDir, { recursive: true });

const report = [];
for (const card of cards) {
  const dataIssues = validateCardData(card);
  if (dataIssues.some((issue) => issue.severity === "error")) {
    report.push({ id: card.id, passed: false, issues: dataIssues });
    continue;
  }
  const outputPath = path.join(outputDir, `${card.id}.png`);
  await renderCardPng(card, outputPath);
  const visual = await inspectVisual(outputPath, { kind: card.kind });
  report.push({ id: card.id, ...visual, issues: [...dataIssues, ...visual.issues] });
}

const reportPath = path.join(outputDir, "visual-qa-report.json");
await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), inputPath, cards: report }, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, reportPath, passed: report.every((item) => item.passed), generated: report.length }, null, 2));
if (report.some((item) => !item.passed)) process.exitCode = 1;
