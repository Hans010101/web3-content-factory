const BASE = Object.freeze({
  waitUntil: "domcontentloaded",
  timeoutMs: 20_000,
  viewport: { width: 1440, height: 1200, deviceScaleFactor: 2 },
  mask: ["video", "[data-testid='videoPlayer']"],
  remove: ["header", "nav", "aside", "[role='dialog']", "[aria-label*='cookie' i]", ".cookie-banner", ".ad", "[data-ad]"],
});

export const EVIDENCE_PROFILES = Object.freeze({
  x: {
    ...BASE,
    match: ["x.com", "twitter.com"],
    target: "article[data-testid='tweet']",
    ready: "article[data-testid='tweet']",
    keep: ["article[data-testid='tweet']"],
    note: "保留账号、时间、正文与互动区域；登录墙出现时应切换到 API 渲染卡。",
  },
  binanceAnnouncement: {
    ...BASE,
    match: ["binance.com"],
    target: "article, main",
    ready: "main",
    keep: ["main"],
    note: "公告页优先截标题、发布时间及正文首段，避免截取推荐内容。",
  },
  sec: {
    ...BASE,
    match: ["sec.gov"],
    target: "main, #main-content",
    ready: "h1",
    keep: ["main", "#main-content"],
    note: "监管材料必须保留文件编号、发布日期及标题。",
  },
  github: {
    ...BASE,
    match: ["github.com"],
    target: "main, .repository-content",
    ready: "main",
    keep: ["main", ".repository-content"],
    note: "Release/提交证据需保留仓库、标签或 commit hash。",
  },
  generic: {
    ...BASE,
    match: [],
    target: "article, main, body",
    ready: "body",
    keep: ["article", "main"],
    note: "通用模式仅作兜底；新高频站点应添加专属 profile。",
  },
});

export function resolveEvidenceProfile(url) {
  const hostname = new URL(url).hostname.toLowerCase();
  return Object.entries(EVIDENCE_PROFILES).find(([key, profile]) => key !== "generic" && profile.match.some((domain) => hostname.endsWith(domain)))?.[1] ?? EVIDENCE_PROFILES.generic;
}

export function buildCaptureManifest({ url, eventId, capturedAt = new Date().toISOString() }) {
  const profile = resolveEvidenceProfile(url);
  return {
    schemaVersion: 1,
    eventId,
    url,
    capturedAt,
    profile: Object.entries(EVIDENCE_PROFILES).find(([, value]) => value === profile)?.[0] ?? "generic",
    viewport: profile.viewport,
    selectors: { target: profile.target, ready: profile.ready, remove: profile.remove, mask: profile.mask },
    provenance: { sourceUrl: url, captureEngine: "playwright-compatible", contentHash: null },
  };
}

export async function captureEvidenceWithPage(page, options) {
  const profile = resolveEvidenceProfile(options.url);
  await page.setViewportSize({ width: profile.viewport.width, height: profile.viewport.height });
  await page.goto(options.url, { waitUntil: profile.waitUntil, timeout: profile.timeoutMs });
  await page.waitForSelector(profile.ready, { timeout: profile.timeoutMs });
  await page.evaluate((selectors) => {
    for (const selector of selectors) document.querySelectorAll(selector).forEach((node) => node.remove());
  }, profile.remove);
  const target = page.locator(profile.target).first();
  await target.screenshot({ path: options.outputPath, type: "png", animations: "disabled" });
  return buildCaptureManifest(options);
}
