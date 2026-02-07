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
} from './crypto.js';
import { getAccessToken, sendTextMessage } from './api.js';
import {
    PasswordService,
    parseDate,
} from '../../core/password-service.js';
import type { WeComConfig } from '../../config.js';
import type { SessionData } from '../../core/storage.js';

const HELP_TEXT = `🔐 密码管理助手

🔍 搜索：直接发送关键词
➕ 添加：/add 或 /add 名称
❌ 删除：/del ID
📄 长文本：#存 名称\n内容
📋 列表：/list
⏰ 到期：/expiring

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
            // 确保请求体是字符串，并清理 BOM
            let body = req.body;
            if (typeof body !== 'string') {
                body = JSON.stringify(body);
            }
            body = body.replace(/^\uFEFF/, '').trim();

            const { msg_signature, timestamp, nonce } = req.query as Record<
                string,
                string
            >;

            // 解析 XML
            const xmlData = await parseStringPromise(body, {
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
        const userId = msg.FromUserName;
        const userIdNum = parseInt(userId, 10) || this.hashUserId(userId);

        // 处理菜单点击事件
        if (msg.MsgType === 'event' && msg.Event === 'click') {
            return await this.handleMenuClick(msg.EventKey || '', userIdNum);
        }

        if (msg.MsgType !== 'text' || !msg.Content) {
            return null;
        }

        const text = msg.Content.trim();

        // 命令处理
        if (text === '/start' || text === '/help' || text === '帮助') {
            return HELP_TEXT;
        }

        if (text === '/list' || text === '列表') {
            return await this.handleList(userIdNum);
        }

        if (text === '/expiring' || text === '到期') {
            return await this.handleExpiring();
        }

        if (text === '/cancel' || text === '取消') {
            await this.passwordService.clearSession(userIdNum);
            return '✅ 已取消';
        }

        // 添加密码指令：/add 或 /add 名称
        if (text === '/add' || text === '添加') {
            await this.passwordService.setSession(userIdNum, { step: 'ask_name' });
            return '➕ 开始添加密码\n\n📝 请输入名称：';
        }

        if (text.startsWith('/add ')) {
            const name = text.slice(5).trim();
            if (name) {
                await this.passwordService.setSession(userIdNum, { step: 'ask_site', name });
                return `📝 保存「${name}」\n\n🌐 请输入网站：`;
            }
        }

        // 删除密码指令：/del ID
        if (text.startsWith('/del ')) {
            const idStr = text.slice(5).trim();
            const id = parseInt(idStr, 10);
            if (!isNaN(id)) {
                return await this.handleDelete(id);
            }
            return '❓ 格式：/del ID\n\n💡 发送 /list 查看 ID';
        }

        // 长文本保存：#存 名称\n内容
        if (text.startsWith('#存')) {
            return await this.handleSaveLongText(text);
        }

        // 获取会话状态
        const session = await this.passwordService.getSession(userIdNum);

        if (session.step !== 'idle') {
            return await this.handleFlow(userIdNum, text, session);
        }

        // 默认行为：搜索
        return await this.handleSearch(text, userIdNum);
    }

    /**
     * 处理菜单点击事件
     */
    private async handleMenuClick(eventKey: string, userId: number): Promise<string> {
        switch (eventKey) {
            case 'CMD_LIST':
                return await this.handleList(userId);
            case 'CMD_ADD':
                await this.passwordService.setSession(userId, { step: 'ask_name' });
                return '➕ 开始添加密码\n\n📝 请输入名称：';
            case 'CMD_EXPIRING':
                return await this.handleExpiring();
            case 'CMD_HELP':
                return HELP_TEXT;
            default:
                return HELP_TEXT;
        }
    }

    /**
     * 处理搜索
     */
    private async handleSearch(text: string, userId?: number): Promise<string> {
        const results = await this.passwordService.searchSecrets(text);

        if (results.length === 0) {
            return `🔍 未找到「${text}」\n\n💡 输入 /add ${text} 可新建`;
        }

        if (results.length === 1) {
            return await this.handleShowDetail(results[0].id);
        }

        // 保存搜索结果 ID 到 session，等待用户回复序号
        if (userId !== undefined) {
            await this.passwordService.setSession(userId, {
                step: 'picking',
                pickingIds: results.map(r => r.id),
            });
        }

        return `🔍 找到 ${results.length} 条：\n\n${results
            .map((x, i) => `${i + 1}. ${x.name} (${x.site})`)
            .join('\n')}\n\n回复序号查看详情`;
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
            case 'ask_name':
                session.name = text;
                session.step = 'ask_site';
                await this.passwordService.setSession(userId, session);
                return `📝 保存「${text}」\n\n🌐 请输入网站：`;

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

            case 'picking':
                // 处理列表序号选择
                const num = parseInt(text, 10);
                if (!isNaN(num) && session.pickingIds && num >= 1 && num <= session.pickingIds.length) {
                    await this.passwordService.clearSession(userId);
                    return await this.handleShowDetail(session.pickingIds[num - 1]);
                }
                // 不是有效序号，清除状态并当作搜索
                await this.passwordService.clearSession(userId);
                return await this.handleSearch(text, userId);

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
    private async handleList(userId?: number): Promise<string> {
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

        // 保存列表 ID 到 session，等待用户回复序号
        if (userId !== undefined) {
            await this.passwordService.setSession(userId, {
                step: 'picking',
                pickingIds: secrets.map(s => s.id),
            });
        }

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

        const deleteHint = `\n\n🗑️ 删除请发送: /del ${id}`;

        if (detail.isRaw) {
            return `🔐 ${detail.name}\n\n${detail.password}${detail.expiryInfo}${deleteHint}`;
        }

        return `🔐 ${detail.name}
🌐 ${detail.site}
👤 ${detail.account}
🔑 ${detail.password}${detail.extra ? '\n📝 ' + detail.extra : ''}${detail.expiryInfo}${deleteHint}`;
    }

    /**
     * 处理删除
     */
    private async handleDelete(id: number): Promise<string> {
        const detail = await this.passwordService.getSecretDetail(id);
        if (!detail) {
            return '❌ 该记录不存在';
        }

        await this.passwordService.deleteSecret(id);
        return `✅ 已删除「${detail.name}」`;
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
