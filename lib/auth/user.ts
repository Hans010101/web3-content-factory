export interface RequestUser {
  id: string;
  email: string;
  displayName: string;
  local: boolean;
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
  return null;
}
