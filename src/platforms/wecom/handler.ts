/**
 * 企业微信消息处理器
 */

import { Request, Response } from 'express';
import { parseStringPromise, Builder } from 'xml2js';
import {
    verifySignature,
    decryptMessage,
    encryptMessage,
    generateSignature,
    generateNonce,
} from './crypto';
import { getAccessToken, sendTextMessage } from './api';
import {
    PasswordService,
    parseDate,
} from '../../core/password-service';
import type { WeComConfig } from '../../config';
import type { SessionData } from '../../core/storage';

const HELP_TEXT = `🔐 密码管理助手

📝 保存：直接发送名称开始引导
📄 长文本：#存 名称
内容
🔍 搜索：发送关键词
📋 列表：发送 /list
⏰ 到期：发送 /expiring

🔒 AES加密 ⏰ 到期提醒`;

interface WeComMessage {
    ToUserName: string;
    FromUserName: string;
    CreateTime: string;
    MsgType: string;
    Content?: string;
    MsgId?: string;
    Event?: string;
    EventKey?: string;
}

export class WeComHandler {
    constructor(
        private config: WeComConfig,
        private passwordService: PasswordService
    ) { }

    /**
     * 处理 URL 验证请求 (GET)
     */
    async verifyUrl(req: Request, res: Response): Promise<void> {
        const { msg_signature, timestamp, nonce, echostr } = req.query as Record<
            string,
            string
        >;

        if (!verifySignature(this.config.token, timestamp, nonce, msg_signature, echostr)) {
            res.status(403).send('Invalid signature');
            return;
        }

        // 解密 echostr
        const { message } = decryptMessage(this.config.encodingAesKey, echostr);
        res.send(message);
    }

    /**
     * 处理消息回调 (POST)
     */
    async handleMessage(req: Request, res: Response): Promise<void> {
        try {
            const { msg_signature, timestamp, nonce } = req.query as Record<
                string,
                string
            >;

            // 解析 XML
            const xmlData = await parseStringPromise(req.body, {
                explicitArray: false,
            });
            const encryptedMsg = xmlData.xml.Encrypt;

            // 验证签名
            if (
                !verifySignature(
                    this.config.token,
                    timestamp,
                    nonce,
                    msg_signature,
                    encryptedMsg
                )
            ) {
                res.status(403).send('Invalid signature');
                return;
            }

            // 解密消息
            const { message, corpId } = decryptMessage(
                this.config.encodingAesKey,
                encryptedMsg
            );

            // 验证 CorpID
            if (corpId !== this.config.corpId) {
                res.status(403).send('Invalid CorpID');
                return;
            }

            // 解析解密后的 XML
            const msgData = await parseStringPromise(message, { explicitArray: false });
            const msg: WeComMessage = msgData.xml;

            // 处理消息
            const reply = await this.processMessage(msg);

            if (reply) {
                // 构造被动回复
                const replyXml = this.buildReplyXml(msg.FromUserName, msg.ToUserName, reply);
                const encrypted = encryptMessage(
                    this.config.encodingAesKey,
                    this.config.corpId,
                    replyXml
                );
                const newNonce = generateNonce();
                const newTimestamp = Math.floor(Date.now() / 1000).toString();
                const signature = generateSignature(
                    this.config.token,
                    newTimestamp,
                    newNonce,
                    encrypted
                );

                const responseXml = `<xml>
<Encrypt><![CDATA[${encrypted}]]></Encrypt>
<MsgSignature><![CDATA[${signature}]]></MsgSignature>
<TimeStamp>${newTimestamp}</TimeStamp>
<Nonce><![CDATA[${newNonce}]]></Nonce>
</xml>`;

                res.type('application/xml').send(responseXml);
            } else {
                res.send('success');
            }
        } catch (error) {
            console.error('WeCom message handling error:', error);
            res.send('success');
        }
    }

    /**
     * 处理消息内容
     */
    private async processMessage(msg: WeComMessage): Promise<string | null> {
        if (msg.MsgType !== 'text' || !msg.Content) {
            return null;
        }

        const userId = msg.FromUserName;
        const text = msg.Content.trim();

        // 命令处理
        if (text === '/start' || text === '/help' || text === '帮助') {
            return HELP_TEXT;
        }

        if (text === '/list' || text === '列表') {
            return await this.handleList();
        }

        if (text === '/expiring' || text === '到期') {
            return await this.handleExpiring();
        }

        if (text === '/cancel' || text === '取消') {
            await this.passwordService.clearSession(parseInt(userId, 10) || this.hashUserId(userId));
            return '✅ 已取消';
        }

        // 获取会话状态
        const userIdNum = parseInt(userId, 10) || this.hashUserId(userId);
        const session = await this.passwordService.getSession(userIdNum);

        if (session.step !== 'idle') {
            return await this.handleFlow(userIdNum, text, session);
        }

        // 长文本保存
        if (text.startsWith('#存')) {
            return await this.handleSaveLongText(text);
        }

        // 搜索或新建
        if (!text.includes(' ') && text.length <= 20) {
            const results = await this.passwordService.searchSecrets(text);
            if (results.length > 0) {
                if (results.length === 1) {
                    return await this.handleShowDetail(results[0].id);
                }
                return `🔍 找到 ${results.length} 条：\n\n${results
                    .map((x, i) => `${i + 1}. ${x.name} (${x.site})`)
                    .join('\n')}\n\n回复序号查看详情`;
            }
        }

        // 开始新建流程
        await this.passwordService.setSession(userIdNum, { step: 'ask_site', name: text });
        return `📝 保存「${text}」\n\n🌐 请输入网站：`;
    }

    /**
     * 处理交互流程
     */
    private async handleFlow(
        userId: number,
        text: string,
        session: SessionData
    ): Promise<string> {
        switch (session.step) {
            case 'ask_site':
                session.site = text;
                session.step = 'ask_account';
                await this.passwordService.setSession(userId, session);
                return '👤 请输入账号：';

            case 'ask_account':
                session.account = text;
                session.step = 'ask_password';
                await this.passwordService.setSession(userId, session);
                return '🔑 请输入密码：';

            case 'ask_password':
                session.password = text;
                session.step = 'ask_expiry';
                await this.passwordService.setSession(userId, session);
                return '📅 设置到期时间？\n\n回复日期（如 2025-12-31）或"否"跳过';

            case 'ask_expiry':
                if (text === '否' || text === '不' || text === 'no') {
                    session.expiresAt = null;
                } else {
                    const exp = parseDate(text);
                    if (!exp) {
                        return '❓ 日期格式不对，请输入如 2025-12-31 或 12-31';
                    }
                    session.expiresAt = exp;
                }
                session.step = 'ask_extra';
                await this.passwordService.setSession(userId, session);
                return '📝 添加备注？\n\n输入备注内容或"否"跳过';

            case 'ask_extra':
                if (text === '否' || text === '不' || text === 'no') {
                    session.extra = null;
                } else {
                    session.extra = text;
                }
                return await this.finishSave(userId, session);

            default:
                return HELP_TEXT;
        }
    }

    /**
     * 完成保存
     */
    private async finishSave(userId: number, session: SessionData): Promise<string> {
        await this.passwordService.saveSecret({
            name: session.name!,
            site: session.site!,
            account: session.account!,
            password: session.password!,
            extra: session.extra,
            expiresAt: session.expiresAt,
        });

        await this.passwordService.clearSession(userId);

        return `✅ 保存成功！

🏷️ ${session.name}
🌐 ${session.site}
👤 ${session.account}
🔑 ******${session.extra ? '\n📝 ' + session.extra : ''}${session.expiresAt ? '\n📅 ' + session.expiresAt : ''}`;
    }

    /**
     * 处理列表命令
     */
    private async handleList(): Promise<string> {
        const secrets = await this.passwordService.getAllSecrets();
        if (!secrets.length) {
            return '📭 没有数据';
        }

        const lines = secrets.map((x, i) => {
            let prefix = '';
            if (x.expires_at) {
                const days = Math.ceil(
                    (new Date(x.expires_at).getTime() - Date.now()) / 864e5
                );
                if (days <= 0) prefix = '⚠️ ';
                else if (days <= 7) prefix = '🔴 ';
            }
            return `${i + 1}. ${prefix}${x.name} (${x.site})`;
        });

        return `📋 共 ${secrets.length} 条：\n\n${lines.join('\n')}\n\n回复序号查看详情`;
    }

    /**
     * 处理到期命令
     */
    private async handleExpiring(): Promise<string> {
        const secrets = await this.passwordService.getExpiringSecrets(30);
        if (!secrets.length) {
            return '✅ 30天内没有到期';
        }

        const lines = secrets.map((x) => {
            const days = Math.ceil(
                (new Date(x.expires_at!).getTime() - Date.now()) / 864e5
            );
            const icon = days <= 0 ? '⚠️' : days <= 3 ? '🔴' : days <= 7 ? '🟡' : '🟢';
            return `${icon} ${x.name} (${days}天)`;
        });

        return `⏰ 即将到期：\n\n${lines.join('\n')}`;
    }

    /**
     * 显示详情
     */
    private async handleShowDetail(id: number): Promise<string> {
        const detail = await this.passwordService.getSecretDetail(id);
        if (!detail) {
            return '❌ 不存在';
        }

        if (detail.isRaw) {
            return `🔐 ${detail.name}\n\n${detail.password}${detail.expiryInfo}`;
        }

        return `🔐 ${detail.name}
🌐 ${detail.site}
👤 ${detail.account}
🔑 ${detail.password}${detail.extra ? '\n📝 ' + detail.extra : ''}${detail.expiryInfo}`;
    }

    /**
     * 保存长文本
     */
    private async handleSaveLongText(text: string): Promise<string> {
        const nl = text.indexOf('\n');
        if (nl === -1) {
            return '❓ 格式：#存 名称\n内容';
        }

        let name = text.slice(3, nl).trim();
        let exp: string | null = null;

        const dm = name.match(/@([\d\-\/]+)$/);
        if (dm) {
            exp = parseDate(dm[1]);
            name = name.slice(0, dm.index).trim();
        }

        const content = text.slice(nl + 1);
        if (!name || !content) {
            return '❓ 名称和内容不能为空';
        }

        await this.passwordService.saveLongText(name, content, exp);
        return `✅ 已保存「${name}」${exp ? '\n📅 ' + exp : ''}`;
    }

    /**
     * 构造回复 XML
     */
    private buildReplyXml(
        toUser: string,
        fromUser: string,
        content: string
    ): string {
        return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;
    }

    /**
     * 将字符串 userId 转换为数字
     */
    private hashUserId(userId: string): number {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
}
