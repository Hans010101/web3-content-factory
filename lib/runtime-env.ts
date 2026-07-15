export interface SignalForgeRuntimeEnv {
  DB?: D1Database;
  MASTER_ENCRYPTION_KEY?: string;
}

const runtime = globalThis as typeof globalThis & { __signalForgeRuntimeEnv?: SignalForgeRuntimeEnv };

export function setRuntimeEnv(env: SignalForgeRuntimeEnv) {
  runtime.__signalForgeRuntimeEnv = env;
}

export function getRuntimeEnv() {
  return runtime.__signalForgeRuntimeEnv ?? {};
}
