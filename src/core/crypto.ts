/**
 * AES-256-GCM 加密模块
 * 用于密码数据的加解密
 */

import { webcrypto } from 'crypto';

// 使用 Node.js webcrypto API
const subtle = webcrypto.subtle;

// 缓存密钥以提高性能
let cachedKey: webcrypto.CryptoKey | null = null;
let cachedKeySecret: string | null = null;

/**
 * 从密钥字符串派生 CryptoKey
 */
export async function getKey(secret: string): Promise<webcrypto.CryptoKey> {
  if (cachedKey && cachedKeySecret === secret) return cachedKey;
  const keyData = new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32));
  cachedKey = await subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  cachedKeySecret = secret;
  return cachedKey;
}

/**
 * AES-256-GCM 加密
 * @param text 明文
 * @param secret 密钥
 * @returns Base64 编码的密文 (IV + Ciphertext)
 */
export async function encrypt(text: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  );
  const buf = new Uint8Array(12 + ct.byteLength);
  buf.set(iv);
  buf.set(new Uint8Array(ct), 12);
  return Buffer.from(buf).toString('base64');
}

/**
 * AES-256-GCM 解密
 * @param b64 Base64 编码的密文
 * @param secret 密钥
 * @returns 明文
 */
export async function decrypt(b64: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const buf = Buffer.from(b64, 'base64');
  const dec = await subtle.decrypt(
    { name: 'AES-GCM', iv: buf.subarray(0, 12) },
    key,
    buf.subarray(12)
  );
  return new TextDecoder().decode(dec);
}
