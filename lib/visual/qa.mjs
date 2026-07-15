import sharp from "sharp";
import { measureTextUnits } from "./text.mjs";

const REQUIRED_DIMENSIONS = { width: 1200, height: 1500 };

export async function inspectVisual(path, expected = {}) {
  const image = sharp(path);
  const [metadata, stats, brandInk, footerInk, rightPanelInk] = await Promise.all([
    image.metadata(),
    image.stats(),
    countDarkInkPixels(image.clone(), { left: 72, top: 82, width: 390, height: 66 }),
    countDarkInkPixels(image.clone(), { left: 70, top: 1380, width: 1060, height: 90 }),
    expected.kind === "info"
      ? countDarkInkPixels(image.clone(), { left: 1100, top: 650, width: 26, height: 276 })
      : Promise.resolve(0),
  ]);
  const target = { ...REQUIRED_DIMENSIONS, ...expected };
  const issues = [];
  if (metadata.format !== "png") issues.push({ severity: "error", code: "FORMAT", message: "输出必须为 PNG" });
  if (metadata.width !== target.width || metadata.height !== target.height) issues.push({ severity: "error", code: "DIMENSIONS", message: `期望 ${target.width}×${target.height}，实际 ${metadata.width}×${metadata.height}` });
  if ((metadata.size ?? 0) > 8 * 1024 * 1024) issues.push({ severity: "warning", code: "FILE_SIZE", message: "文件超过 8MB，建议压缩" });
  const channelRange = stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.max - channel.min, 0);
  if (channelRange < 120) issues.push({ severity: "warning", code: "LOW_RANGE", message: "画面动态范围偏低，可能为空图或对比度不足" });
  if (stats.isOpaque === false) issues.push({ severity: "warning", code: "ALPHA", message: "图片含透明区域，平台转码后背景可能异常" });
  if (brandInk < 800) issues.push({ severity: "error", code: "BRAND_TEXT_MISSING", message: "品牌区有效文字像素不足，可能发生字体渲染失败" });
  if (footerInk < 300) issues.push({ severity: "error", code: "FOOTER_TEXT_MISSING", message: "来源/声明区有效文字像素不足" });
  if (rightPanelInk > 12) issues.push({ severity: "error", code: "RIGHT_SAFE_ZONE", message: "核心信息文字进入右侧安全区，可能发生裁切" });
  return {
    path,
    passed: !issues.some((issue) => issue.severity === "error"),
    metadata: { format: metadata.format, width: metadata.width, height: metadata.height, bytes: metadata.size, space: metadata.space },
    issues,
  };
}

async function countDarkInkPixels(image, region) {
  const data = await image.extract(region).greyscale().raw().toBuffer();
  let count = 0;
  for (const value of data) if (value < 170) count += 1;
  return count;
}

export function validateCardData(card) {
  const issues = [];
  if (!card.title?.trim()) issues.push({ severity: "error", code: "TITLE", message: "缺少标题" });
  if (!card.source?.trim()) issues.push({ severity: "error", code: "SOURCE", message: "缺少来源" });
  if (!card.updatedAt?.trim()) issues.push({ severity: "error", code: "UPDATED_AT", message: "缺少更新时间" });
  if (card.title?.length > 54) issues.push({ severity: "warning", code: "TITLE_LENGTH", message: "标题超过 54 字，可能发生截断" });
  const limits = {
    info: { title: 21 * 3, summary: 27 * 4 },
    market: { title: 24 * 2 },
    timeline: { title: 25 * 2 },
  }[card.kind] ?? {};
  for (const [field, capacity] of Object.entries(limits)) {
    if (measureTextUnits(card[field]) > capacity) {
      issues.push({ severity: "warning", code: "TEXT_CAPACITY", message: `${field} 超过模板安全容量，输出将以省略号截断` });
    }
  }
  if (card.kind === "info" && !card.summary?.trim()) issues.push({ severity: "error", code: "SUMMARY", message: "信息卡缺少核心信息" });
  if (card.kind === "market" && (!Array.isArray(card.series) || card.series.length < 2)) issues.push({ severity: "error", code: "SERIES", message: "行情卡至少需要两个行情点" });
  if (card.kind === "timeline" && (!Array.isArray(card.events) || card.events.length < 2)) issues.push({ severity: "error", code: "EVENTS", message: "时间线卡至少需要两个节点" });
  return issues;
}
