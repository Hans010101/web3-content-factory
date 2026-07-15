import sharp from "sharp";
import { BRAND, CANVAS, CATEGORY_THEME, COLORS } from "./tokens.mjs";
import { escapeXml, formatNumber, tspans, wrapText } from "./text.mjs";

const defs = `
  <defs>
    <radialGradient id="glow" cx="87%" cy="8%" r="70%">
      <stop offset="0" stop-color="#D92D20" stop-opacity=".10" />
      <stop offset=".45" stop-color="#F04438" stop-opacity=".03" />
      <stop offset="1" stop-color="#F6F7F9" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="line" x1="0" x2="1"><stop stop-color="#B42318"/><stop offset="1" stop-color="#F04438"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#101828" flood-opacity=".10"/></filter>
  </defs>`;

function baseFrame({ category = "breaking", status = "已确认", updatedAt = "" } = {}) {
  const theme = CATEGORY_THEME[category] ?? CATEGORY_THEME.breaking;
  return `${defs}
  <rect width="1200" height="1500" fill="${COLORS.background}"/>
  <rect width="1200" height="1500" fill="url(#glow)"/>
  <path d="M72 72H1128" stroke="${COLORS.stroke}"/>
  <circle cx="91" cy="119" r="13" fill="${COLORS.amber}"/>
  <text x="119" y="131" fill="${COLORS.ink}" font-family="${BRAND.monoFamily}" font-size="31" font-weight="700" letter-spacing="3">${BRAND.name}</text>
  <text x="1110" y="129" fill="${COLORS.muted}" text-anchor="end" font-family="${BRAND.fontFamily}" font-size="24">${escapeXml(BRAND.chineseName)}</text>
  <rect x="72" y="196" width="174" height="54" rx="27" fill="${theme.color}" fill-opacity=".14" stroke="${theme.color}" stroke-opacity=".65"/>
  <text x="159" y="232" text-anchor="middle" fill="${theme.color}" font-family="${BRAND.fontFamily}" font-size="25" font-weight="700">${escapeXml(theme.label)}</text>
  <rect x="264" y="196" width="142" height="54" rx="27" fill="${COLORS.surfaceRaised}" stroke="${COLORS.stroke}"/>
  <circle cx="294" cy="223" r="7" fill="${status.includes("待") ? COLORS.amber : COLORS.green}"/>
  <text x="318" y="232" fill="${COLORS.ink}" font-family="${BRAND.fontFamily}" font-size="23">${escapeXml(status)}</text>
  <text x="1128" y="229" text-anchor="end" fill="${COLORS.faint}" font-family="${BRAND.monoFamily}" font-size="20">${escapeXml(updatedAt)}</text>`;
}

function footer(source = "", reference = "") {
  return `<path d="M72 1368H1128" stroke="${COLORS.stroke}"/>
    <text x="72" y="1416" fill="${COLORS.faint}" font-family="${BRAND.fontFamily}" font-size="20">来源</text>
    <text x="142" y="1416" fill="${COLORS.muted}" font-family="${BRAND.fontFamily}" font-size="21">${escapeXml(source)}</text>
    <text x="1128" y="1416" text-anchor="end" fill="${COLORS.faint}" font-family="${BRAND.monoFamily}" font-size="19">${escapeXml(reference)}</text>
    <text x="72" y="1461" fill="${COLORS.faint}" font-family="${BRAND.fontFamily}" font-size="18">${escapeXml(BRAND.strapline)} · 信息不构成投资建议</text>`;
}

function metricBoxes(metrics = [], y = 1003) {
  const items = metrics.slice(0, 3);
  const width = 328;
  return items.map((item, index) => {
    const x = 72 + index * 352;
    const accent = item.tone === "negative" ? COLORS.red : item.tone === "positive" ? COLORS.green : COLORS.amber;
    return `<rect x="${x}" y="${y}" width="${width}" height="174" rx="22" fill="${COLORS.surface}" stroke="${COLORS.stroke}"/>
      <text x="${x + 28}" y="${y + 47}" fill="${COLORS.faint}" font-family="${BRAND.fontFamily}" font-size="21">${escapeXml(item.label)}</text>
      <text x="${x + 28}" y="${y + 109}" fill="${accent}" font-family="${BRAND.monoFamily}" font-size="40" font-weight="700">${escapeXml(item.value)}</text>
      <text x="${x + 28}" y="${y + 147}" fill="${COLORS.muted}" font-family="${BRAND.fontFamily}" font-size="18">${escapeXml(item.detail ?? "")}</text>`;
  }).join("\n");
}

export function renderInfoCardSvg(data) {
  const title = wrapText(data.title, 21, 3);
  // 27 CJK units × 31px leaves a generous safety margin inside the panel.
  // Font metrics differ slightly between macOS and Linux, so do not use the
  // theoretical maximum width here.
  const summary = wrapText(data.summary, 27, 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 1200 1500">
    ${baseFrame(data)}
    ${tspans(title, 72, 348, 86, `fill="${COLORS.ink}" font-family="${BRAND.fontFamily}" font-size="68" font-weight="760" letter-spacing="-1"`)}
    <rect x="72" y="636" width="1056" height="292" rx="28" fill="${COLORS.surface}" stroke="${COLORS.stroke}" filter="url(#shadow)"/>
    <rect x="72" y="636" width="7" height="292" rx="4" fill="${COLORS.amber}"/>
    <text x="112" y="690" fill="${COLORS.amberSoft}" font-family="${BRAND.fontFamily}" font-size="22" font-weight="700">核心信息</text>
    ${tspans(summary, 112, 747, 48, `fill="${COLORS.ink}" font-family="${BRAND.fontFamily}" font-size="31"`)}
    ${metricBoxes(data.metrics, 1150)}
    ${footer(data.source, data.reference)}
  </svg>`;
}

function chartPath(values, x = 96, y = 738, width = 1008, height = 255) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (numbers.length < 2) return "";
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const range = max - min || 1;
  return numbers.map((value, index) => {
    const px = x + (index / (numbers.length - 1)) * width;
    const py = y + height - ((value - min) / range) * height;
    return `${index === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
  }).join(" ");
}

export function renderMarketCardSvg(data) {
  const title = wrapText(data.title, 24, 2);
  const change = Number(data.changePercent ?? 0);
  const changeColor = change >= 0 ? COLORS.green : COLORS.red;
  const path = chartPath(data.series ?? []);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
    ${baseFrame({ ...data, category: "market" })}
    ${tspans(title, 72, 346, 76, `fill="${COLORS.ink}" font-family="${BRAND.fontFamily}" font-size="61" font-weight="760"`)}
    <text x="72" y="566" fill="${COLORS.ink}" font-family="${BRAND.monoFamily}" font-size="74" font-weight="800">${escapeXml(data.symbol ?? "—")}</text>
    <text x="1128" y="558" text-anchor="end" fill="${changeColor}" font-family="${BRAND.monoFamily}" font-size="58" font-weight="750">${change >= 0 ? "+" : ""}${formatNumber(change)}%</text>
    <text x="1128" y="602" text-anchor="end" fill="${COLORS.muted}" font-family="${BRAND.fontFamily}" font-size="21">${escapeXml(data.window ?? "1 小时")}</text>
    <rect x="72" y="650" width="1056" height="452" rx="28" fill="${COLORS.surface}" stroke="${COLORS.stroke}"/>
    <path d="M96 800H1104M96 928H1104" stroke="${COLORS.stroke}" stroke-dasharray="8 10"/>
    <path d="${path}" fill="none" stroke="url(#line)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="1104" cy="${(() => { const nums=(data.series??[]).map(Number).filter(Number.isFinite); if(!nums.length) return 865; const min=Math.min(...nums), max=Math.max(...nums), range=max-min||1; return (738+255-((nums.at(-1)-min)/range)*255).toFixed(1); })()}" r="11" fill="${COLORS.amber}" stroke="${COLORS.surface}" stroke-width="5"/>
    ${metricBoxes(data.metrics)}
    ${footer(data.source, data.reference)}
  </svg>`;
}

export function renderTimelineCardSvg(data) {
  const title = wrapText(data.title, 25, 2);
  const events = (data.events ?? []).slice(0, 5);
  const eventSvg = events.map((event, index) => {
    const y = 605 + index * 142;
    const lines = wrapText(event.text, 39, 2);
    return `<circle cx="111" cy="${y}" r="12" fill="${index === events.length - 1 ? COLORS.amber : COLORS.blue}"/>
      ${index < events.length - 1 ? `<path d="M111 ${y + 14}V${y + 128}" stroke="${COLORS.stroke}" stroke-width="4"/>` : ""}
      <text x="154" y="${y - 2}" fill="${COLORS.amberSoft}" font-family="${BRAND.monoFamily}" font-size="20" font-weight="700">${escapeXml(event.time)}</text>
      ${tspans(lines, 154, y + 39, 35, `fill="${COLORS.ink}" font-family="${BRAND.fontFamily}" font-size="25"`)}`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
    ${baseFrame(data)}
    ${tspans(title, 72, 348, 76, `fill="${COLORS.ink}" font-family="${BRAND.fontFamily}" font-size="61" font-weight="760"`)}
    <rect x="72" y="526" width="1056" height="760" rx="28" fill="${COLORS.surface}" stroke="${COLORS.stroke}"/>
    ${eventSvg}
    ${footer(data.source, data.reference)}
  </svg>`;
}

export async function renderCardPng(data, outputPath) {
  const renderers = { info: renderInfoCardSvg, market: renderMarketCardSvg, timeline: renderTimelineCardSvg };
  const renderer = renderers[data.kind];
  if (!renderer) throw new Error(`Unknown visual kind: ${data.kind}`);
  const svg = renderer(data);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(outputPath);
  return { outputPath, width: CANVAS.width, height: CANVAS.height, kind: data.kind };
}
