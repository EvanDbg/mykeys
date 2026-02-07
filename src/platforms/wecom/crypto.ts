/**
 * 企业微信消息加解密模块
 * 参考: https://developer.work.weixin.qq.com/document/path/90968
 */

import crypto from 'crypto';

/**
 * 生成签名
 */
export function generateSignature(
    token: string,
    timestamp: string,
    nonce: string,
    encrypt?: string
): string {
    const arr = encrypt ? [token, timestamp, nonce, encrypt] : [token, timestamp, nonce];
    arr.sort();
    const str = arr.join('');
    return crypto.createHash('sha1').update(str).digest('hex');
}

/**
 * 验证签名
 */
export function verifySignature(
    token: string,
    timestamp: string,
    nonce: string,
    msgSignature: string,
    encrypt?: string
): boolean {
    const signature = generateSignature(token, timestamp, nonce, encrypt);
    return signature === msgSignature;
}

/**
 * 解密企业微信消息
 * EncodingAESKey 是 Base64 编码的 43 位字符串，解码后为 32 字节 AES 密钥
 */
export function decryptMessage(
    encodingAesKey: string,
    encryptedMsg: string
): { message: string; corpId: string } {
    // 解码 AES 密钥
    const aesKey = Buffer.from(encodingAesKey + '=', 'base64');
    const iv = aesKey.subarray(0, 16);

    // 解密
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(false);

    let decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedMsg, 'base64')),
        decipher.final(),
    ]);

    // 去除 PKCS#7 填充
    const padLen = decrypted[decrypted.length - 1];
    decrypted = decrypted.subarray(0, decrypted.length - padLen);

    // 解析消息体: random(16) + msg_len(4) + msg + corp_id
    const msgLen = decrypted.readUInt32BE(16);
    const message = decrypted.subarray(20, 20 + msgLen).toString('utf8');
    const corpId = decrypted.subarray(20 + msgLen).toString('utf8');

    return { message, corpId };
}

/**
 * 加密企业微信消息（用于被动回复）
 */
export function encryptMessage(
    encodingAesKey: string,
    corpId: string,
    replyMsg: string
): string {
    // 解码 AES 密钥
    const aesKey = Buffer.from(encodingAesKey + '=', 'base64');
    const iv = aesKey.subarray(0, 16);

    // 构造消息体: random(16) + msg_len(4) + msg + corp_id
    const random = crypto.randomBytes(16);
    const msgBuffer = Buffer.from(replyMsg, 'utf8');
    const msgLen = Buffer.alloc(4);
    msgLen.writeUInt32BE(msgBuffer.length, 0);
    const corpIdBuffer = Buffer.from(corpId, 'utf8');

    let data = Buffer.concat([random, msgLen, msgBuffer, corpIdBuffer]);

    // PKCS#7 填充
    const blockSize = 32;
    const padLen = blockSize - (data.length % blockSize);
    const padding = Buffer.alloc(padLen, padLen);
    data = Buffer.concat([data, padding]);

    // 加密
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    cipher.setAutoPadding(false);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return encrypted.toString('base64');
}

/**
 * 生成随机字符串
 */
export function generateNonce(): string {
    return crypto.randomBytes(8).toString('hex');
}
