import { getRuntimeEnv } from "@/lib/runtime-env";

export interface RequestUser {
  id: string;
  email: string;
  displayName: string;
  local: boolean;
}

const SESSION_COOKIE = "web3_content_factory_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sessionKey() {
  const secret = getRuntimeEnv().MASTER_ENCRYPTION_KEY;
  if (!secret) return null;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signSession(id: string) {
  const key = await sessionKey();
  if (!key) return null;
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id))));
}

export async function getAnonymousSessionId(request: Request) {
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return null;
  const [id, signature, extra] = decodeURIComponent(raw).split(".");
  if (!id || !signature || extra || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const key = await sessionKey();
  if (!key) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), new TextEncoder().encode(id));
    return valid ? id : null;
  } catch {
    return null;
  }
}

export async function createAnonymousSessionCookie() {
  const id = crypto.randomUUID();
  const signature = await signSession(id);
  if (!signature) return null;
  return `${SESSION_COOKIE}=${encodeURIComponent(`${id}.${signature}`)}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getRequestUser(request: Request): Promise<RequestUser | null> {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const name = request.headers.get("oai-authenticated-user-name")?.trim();
  if (email) return { id: await sha256(email), email, displayName: name || email.split("@")[0], local: false };

  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return { id: "local-development-user", email: "local@web3-content-factory.invalid", displayName: "本地开发用户", local: true };
  }
  const anonymousSessionId = await getAnonymousSessionId(request);
  if (anonymousSessionId) {
    return {
      id: `anonymous:${await sha256(anonymousSessionId)}`,
      email: "anonymous@web3-content-factory.invalid",
      displayName: "个人工作区",
      local: false,
    };
  }
  return null;
}
