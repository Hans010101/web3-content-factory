export function requirePublicHttpUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`URL 格式无效：${raw}`); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error(`只允许无内嵌凭据的公开 HTTP(S) URL：${raw}`);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const privateHost = host === "localhost" || host.endsWith(".local") || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:") || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === "0.0.0.0";
  if (privateHost) throw new Error(`拒绝访问本地或私有网络地址：${raw}`);
  return url;
}
