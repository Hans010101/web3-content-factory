import { getRequestUser } from "@/lib/auth/user";
import { apiError, readJson } from "@/lib/http";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const runtime = "edge";

type ScreenshotInput = { url?: string };

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

function normalizePublicUrl(raw: string) {
  if (!raw || raw.length > 2_048) throw new Error("请输入有效的原帖链接");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("链接格式不正确"); }
  if (url.protocol !== "https:") throw new Error("只允许抓取 HTTPS 公共页面");
  if (url.username || url.password) throw new Error("链接中不能包含账号或密码");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal") ||
    hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:") || isPrivateIpv4(hostname)) {
    throw new Error("拒绝访问本地或私有网络地址");
  }
  return url;
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return apiError("需要进入个人工作区后才能抓取截图", 401);

  try {
    const input = await readJson<ScreenshotInput>(request);
    const source = normalizePublicUrl(input.url?.trim() ?? "");
    const isXPost = /(^|\.)((x|twitter)\.com)$/i.test(source.hostname);
    if (isXPost) {
      return apiError("X 会拦截无登录态的云端截图。请上传手机或浏览器的原始截图；系统会保留这条原帖链接用于溯源", 422);
    }
    const browser = getRuntimeEnv().BROWSER;
    if (!browser) return apiError("云端截图服务尚未绑定，请在 Cloudflare 部署后使用", 503);
    const result = await browser.quickAction("screenshot", {
      url: source.toString(),
      viewport: { width: 1200, height: 900, deviceScaleFactor: 1.25 },
      gotoOptions: { waitUntil: "networkidle0", timeout: 30_000 },
      screenshotOptions: { type: "png", fullPage: false, captureBeyondViewport: false },
    });
    if (!result.ok) return apiError(`截图服务返回 HTTP ${result.status}`, 502);
    const image = await result.arrayBuffer();
    const headers = new Headers(result.headers);
    headers.set("content-type", "image/png");
    headers.set("cache-control", "private, no-store");
    headers.set("x-source-url", source.toString());
    headers.set("x-captured-at", new Date().toISOString());
    headers.set("content-disposition", `inline; filename="source-${Date.now()}.png"`);
    return new Response(image, { status: 200, headers });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "截图失败", 400);
  }
}
