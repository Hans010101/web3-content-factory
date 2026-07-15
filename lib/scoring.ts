import type { HotnessSignals } from "./domain";

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const HOTNESS_WEIGHTS = {
  velocity: 0.25,
  marketAnomaly: 0.2,
  sourceTrust: 0.2,
  crossSource: 0.15,
  assetRelevance: 0.1,
  novelty: 0.1,
} as const;

export function calculateHotness(signals: HotnessSignals) {
  const normalized = Object.fromEntries(
    Object.entries(signals).map(([key, value]) => [key, clamp(value)]),
  ) as unknown as HotnessSignals;

  const score =
    normalized.velocity * HOTNESS_WEIGHTS.velocity +
    normalized.marketAnomaly * HOTNESS_WEIGHTS.marketAnomaly +
    normalized.sourceTrust * HOTNESS_WEIGHTS.sourceTrust +
    normalized.crossSource * HOTNESS_WEIGHTS.crossSource +
    normalized.assetRelevance * HOTNESS_WEIGHTS.assetRelevance +
    normalized.novelty * HOTNESS_WEIGHTS.novelty;

  return Math.round(score * 10) / 10;
}

export function hotnessBand(score: number) {
  if (score >= 85) return "critical";
  if (score >= 70) return "hot";
  if (score >= 50) return "rising";
  return "watch";
}
