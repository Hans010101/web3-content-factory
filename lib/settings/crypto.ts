import { getRuntimeEnv } from "@/lib/runtime-env";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const memory = globalThis as typeof globalThis & { __web3ContentFactoryLocalKey?: CryptoKey };

const bytesToBase64 = (bytes: Uint8Array) => {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
};
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function encryptionKey(persistent: boolean) {
  const secret = getRuntimeEnv().MASTER_ENCRYPTION_KEY;
  if (secret) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
    return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  if (persistent) throw new Error("生产存储缺少 MASTER_ENCRYPTION_KEY，已拒绝保存密钥");
  if (!memory.__web3ContentFactoryLocalKey) memory.__web3ContentFactoryLocalKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return memory.__web3ContentFactoryLocalKey;
}

export async function encryptSecrets(value: Record<string, string>, persistent: boolean) {
  if (!Object.keys(value).length) return { ciphertext: "", iv: "" };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(persistent), encoder.encode(JSON.stringify(value)));
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv) };
}

export async function decryptSecrets(ciphertext: string, iv: string, persistent: boolean) {
  if (!ciphertext) return {};
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, await encryptionKey(persistent), base64ToBytes(ciphertext));
  return JSON.parse(decoder.decode(plaintext)) as Record<string, string>;
}
