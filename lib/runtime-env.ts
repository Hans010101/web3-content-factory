export interface Web3ContentFactoryRuntimeEnv {
  DB?: D1Database;
  MASTER_ENCRYPTION_KEY?: string;
  BROWSER?: {
    quickAction(action: "screenshot", input: Record<string, unknown>): Promise<Response>;
  };
}

const runtime = globalThis as typeof globalThis & { __web3ContentFactoryRuntimeEnv?: Web3ContentFactoryRuntimeEnv };

export function setRuntimeEnv(env: Web3ContentFactoryRuntimeEnv) {
  runtime.__web3ContentFactoryRuntimeEnv = env;
}

export function getRuntimeEnv() {
  return runtime.__web3ContentFactoryRuntimeEnv ?? {};
}
