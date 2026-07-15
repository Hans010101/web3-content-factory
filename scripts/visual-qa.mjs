#!/usr/bin/env node
import path from "node:path";
import { inspectVisual } from "../lib/visual/qa.mjs";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("用法: node scripts/visual-qa.mjs <image.png> [more.png]");
  process.exit(2);
}

const reports = await Promise.all(files.map((file) => inspectVisual(path.resolve(file))));
console.log(JSON.stringify(reports, null, 2));
if (reports.some((report) => !report.passed)) process.exitCode = 1;
