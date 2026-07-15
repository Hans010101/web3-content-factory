import type { ContentDraft, MatrixAccount } from "../domain";

export interface PublishPayload {
  draft: ContentDraft;
  account: MatrixAccount;
  assetUrls: string[];
  idempotencyKey: string;
}

export interface PublishResult {
  ok: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
}

export interface PublishingAdapter {
  readonly platform: MatrixAccount["platform"];
  validate(payload: PublishPayload): Promise<{ valid: boolean; errors: string[] }>;
  publish(payload: PublishPayload): Promise<PublishResult>;
}
