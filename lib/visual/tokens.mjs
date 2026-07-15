export const CANVAS = Object.freeze({ width: 1200, height: 1500, scale: 1 });

export const COLORS = Object.freeze({
  ink: "#172126",
  muted: "#667085",
  faint: "#98A2B3",
  surface: "#FFFFFF",
  surfaceRaised: "#F9FAFB",
  stroke: "#E4E7EC",
  background: "#F6F7F9",
  amber: "#D92D20",
  amberSoft: "#B42318",
  green: "#039855",
  red: "#D92D20",
  blue: "#2E5AAC",
  purple: "#7A5AF8",
});

export const CATEGORY_THEME = Object.freeze({
  breaking: { label: "快讯", color: COLORS.red },
  market: { label: "市场异动", color: COLORS.blue },
  onchain: { label: "链上雷达", color: COLORS.purple },
  policy: { label: "监管 / 宏观", color: COLORS.muted },
  research: { label: "项目研究", color: COLORS.green },
});

export const BRAND = Object.freeze({
  name: "SIGNAL FORGE",
  chineseName: "Web3 情报中枢",
  strapline: "更早发现 · 交叉核实 · 清晰解读",
  fontFamily: "Hiragino Sans GB, PingFang SC, Noto Sans CJK SC, sans-serif",
  monoFamily: "SFMono-Regular, Menlo, monospace",
});
