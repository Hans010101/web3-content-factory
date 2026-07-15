import type { PublishingAdapter, PublishPayload } from "./types";

export class MockBinanceSquarePublisher implements PublishingAdapter {
  readonly platform = "binance_square" as const;

  async validate(payload: PublishPayload) {
    const errors: string[] = [];
    if (!payload.draft.headline.trim()) errors.push("缺少标题");
    if (!payload.draft.body.trim()) errors.push("缺少正文");
    if (payload.assetUrls.length > 4) errors.push("图片数量不能超过 4 张");
    return { valid: errors.length === 0, errors };
  }

  async publish(payload: PublishPayload) {
    const validation = await this.validate(payload);
    if (!validation.valid) return { ok: false, error: validation.errors.join("；") };
    const id = `mock-${payload.idempotencyKey.slice(0, 12)}`;
    return { ok: true, platformPostId: id, platformUrl: `https://www.binance.com/square/post/${id}` };
  }
}
