/**
 * 企业微信 API 封装
 */

interface AccessTokenResponse {
    errcode: number;
    errmsg: string;
    access_token?: string;
    expires_in?: number;
}

interface SendMessageResponse {
    errcode: number;
    errmsg: string;
}

// Access Token 缓存
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * 获取企业微信 Access Token
 */
export async function getAccessToken(
    corpId: string,
    secret: string
): Promise<string> {
    // 检查缓存是否有效
    if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
        return cachedToken;
    }

    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${secret}`;
    const res = await fetch(url);
    const data = (await res.json()) as AccessTokenResponse;

    if (data.errcode !== 0 || !data.access_token) {
        throw new Error(`获取 Access Token 失败: ${data.errmsg}`);
    }

    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in || 7200) * 1000;

    return cachedToken;
}

/**
 * 发送文本消息
 */
export async function sendTextMessage(
    accessToken: string,
    agentId: string,
    userId: string,
    content: string
): Promise<void> {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;

    const body = {
        touser: userId,
        msgtype: 'text',
        agentid: parseInt(agentId, 10),
        text: {
            content,
        },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = (await res.json()) as SendMessageResponse;
    if (data.errcode !== 0) {
        throw new Error(`发送消息失败: ${data.errmsg}`);
    }
}

/**
 * 发送 Markdown 消息（企业微信支持简单 Markdown）
 */
export async function sendMarkdownMessage(
    accessToken: string,
    agentId: string,
    userId: string,
    content: string
): Promise<void> {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;

    const body = {
        touser: userId,
        msgtype: 'markdown',
        agentid: parseInt(agentId, 10),
        markdown: {
            content,
        },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = (await res.json()) as SendMessageResponse;
    if (data.errcode !== 0) {
        throw new Error(`发送 Markdown 消息失败: ${data.errmsg}`);
    }
}
